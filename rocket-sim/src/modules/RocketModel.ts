/* =========================================================
   火箭模型加载、节点解析、动画控制
   ========================================================= */

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { STAGE_CONFIG } from '../data/missionData';

export interface StageNodes {
  /** 根 Group —— 所有尚未分离的部件都挂在这下面 */
  root: THREE.Group;

  boosters: THREE.Object3D[];
  stage1?: THREE.Object3D;
  stage2?: THREE.Object3D;
  upperStage?: THREE.Object3D;
  fairingHalves: THREE.Object3D[];
  satellite?: THREE.Object3D;
  solarPanels: THREE.Object3D[];

  /** 所有主发动机喷口的世界坐标点位（每帧动态计算） */
  mainNozzleAnchors: THREE.Object3D[]; // 一级喷口参考节点（本地坐标，挂在 stage1 下）
  boosterNozzleAnchors: THREE.Object3D[];
  stage2NozzleAnchor?: THREE.Object3D;
  upperNozzleAnchor?: THREE.Object3D;
}

export type PartName =
  | 'boosterL'
  | 'boosterR'
  | 'stage1'
  | 'fairingL'
  | 'fairingR'
  | 'stage2'
  | 'upperStage'
  | 'satellite'
  | 'solarPanelL'
  | 'solarPanelR';

/** 动画进度 0..1 中 某个部件的状态 */
export interface PartAnimationState {
  /** 是否已从根上拆下挂到 scene 上 */
  detached: boolean;
  /** hinge 角度 0-1 */
  hingeProgress: number;
  /** 分离远离进度 0-1 */
  sepProgress: number;
}

export class RocketModel {
  nodes!: StageNodes;
  partState: Record<PartName, PartAnimationState> = {
    boosterL:   { detached: false, hingeProgress: 0, sepProgress: 0 },
    boosterR:   { detached: false, hingeProgress: 0, sepProgress: 0 },
    stage1:     { detached: false, hingeProgress: 0, sepProgress: 0 },
    fairingL:   { detached: false, hingeProgress: 0, sepProgress: 0 },
    fairingR:   { detached: false, hingeProgress: 0, sepProgress: 0 },
    stage2:     { detached: false, hingeProgress: 0, sepProgress: 0 },
    upperStage: { detached: false, hingeProgress: 0, sepProgress: 0 },
    satellite:  { detached: false, hingeProgress: 0, sepProgress: 0 },
    solarPanelL:{ detached: false, hingeProgress: 0, sepProgress: 0 },
    solarPanelR:{ detached: false, hingeProgress: 0, sepProgress: 0 },
  };

  /** 世界尺度（默认 GLB 可能单位太大或太小，加载后自动归一化） */
  scaleFactor = 1;

  /** 火箭全长（米，加载后填入） */
  rocketLengthMeters = 50;

  private _partInitialLocal = new Map<PartName, { pos: THREE.Vector3; quat: THREE.Quaternion; scale: THREE.Vector3 }>();

  constructor(
    private scene: THREE.Scene,
  ) {}

  /** 加载 GLB，onProgress 0-1 */
  async load(onProgress: (p: number) => void): Promise<void> {
    const loader = new GLTFLoader();
    onProgress(0.02);
    const glb = await loader.loadAsync(
      `${(import.meta.env.BASE_URL || '/').replace(/\/+$/, '')}/models/CZ-6A.glb`,
      (xhr) => {
        if (xhr.total) onProgress(0.02 + 0.9 * (xhr.loaded / xhr.total));
      }
    );
    onProgress(0.94);

    const sceneObj = glb.scene;

    // 计算包围盒，归一化尺寸到大约 50 米高
    const box = new THREE.Box3().setFromObject(sceneObj);
    const size = new THREE.Vector3();
    box.getSize(size);
    const maxY = Math.max(size.x, size.y, size.z);
    // 目标全长 ~ 50m (CZ-6A 约 50 米)
    this.scaleFactor = 50 / maxY;
    sceneObj.scale.setScalar(this.scaleFactor);
    this.rocketLengthMeters = size.y * this.scaleFactor;

    // 让火箭站立在发射台（底部 y=0）
    box.setFromObject(sceneObj);
    const min = box.min;
    sceneObj.position.y -= min.y;

    // 创建根节点
    const root = new THREE.Group();
    root.name = 'RocketRoot';
    // 把加载对象挂到 root 下
    root.add(sceneObj);

    this.nodes = {
      root,
      boosters: [],
      fairingHalves: [],
      solarPanels: [],
      mainNozzleAnchors: [],
      boosterNozzleAnchors: [],
    };

    // ---------- 递归查找命名节点 ----------
    this._resolveNamedNodes(sceneObj);

    // ---------- 补充默认（兜底）：按 bounding box 空间切分 ----------
    this._ensureNodesBySpatialCut(sceneObj);

    // ---------- 为各主级创建喷口 Anchor（本地坐标小 Group 挂在各部件下） ----------
    this._installNozzleAnchors();

    this.scene.add(root);

    // 缓存初始变换
    this._cacheInitialTransform('boosterL', this.nodes.boosters[0]);
    this._cacheInitialTransform('boosterR', this.nodes.boosters[1]);
    this._cacheInitialTransform('stage1', this.nodes.stage1);
    this._cacheInitialTransform('stage2', this.nodes.stage2);
    this._cacheInitialTransform('upperStage', this.nodes.upperStage);
    this._cacheInitialTransform('fairingL', this.nodes.fairingHalves[0]);
    this._cacheInitialTransform('fairingR', this.nodes.fairingHalves[1]);
    this._cacheInitialTransform('satellite', this.nodes.satellite);
    this._cacheInitialTransform('solarPanelL', this.nodes.solarPanels[0]);
    this._cacheInitialTransform('solarPanelR', this.nodes.solarPanels[1]);

    // 默认所有 mesh 打开阴影
    sceneObj.traverse((c) => {
      if ((c as THREE.Mesh).isMesh) {
        const m = c as THREE.Mesh;
        m.castShadow = true;
        m.receiveShadow = true;
        // 稍微提高材质金属感，让火箭更有质感
        const mat = m.material as THREE.MeshStandardMaterial | THREE.MeshStandardMaterial[];
        const mats = Array.isArray(mat) ? mat : [mat];
        mats.forEach((mm) => {
          if (mm && 'roughness' in mm) {
            mm.roughness = Math.min(mm.roughness ?? 0.8, 0.75);
            mm.metalness = Math.max(mm.metalness ?? 0.1, 0.25);
            mm.envMapIntensity = 0.9;
          }
        });
      }
    });

    onProgress(1.0);
  }

  private _cacheInitialTransform(name: PartName, obj?: THREE.Object3D) {
    if (!obj) return;
    this._partInitialLocal.set(name, {
      pos: obj.position.clone(),
      quat: obj.quaternion.clone(),
      scale: obj.scale.clone(),
    });
  }

  /** 按关键词匹配找节点 */
  private _resolveNamedNodes(root: THREE.Object3D) {
    function find(keywords: string[]): THREE.Object3D | undefined {
      let hit: THREE.Object3D | undefined;
      root.traverse((o) => {
        if (hit) return;
        const n = o.name || '';
        if (keywords.some(k => n.toLowerCase().includes(k.toLowerCase()))) {
          hit = o;
        }
      });
      return hit;
    }
    this.nodes.boosters = [
      find(STAGE_CONFIG.boosterL.nodeKeywords),
      find(STAGE_CONFIG.boosterR.nodeKeywords),
    ].filter(Boolean) as THREE.Object3D[];

    this.nodes.stage1 = find(STAGE_CONFIG.stage1.nodeKeywords);
    this.nodes.stage2 = find(STAGE_CONFIG.stage2.nodeKeywords);
    this.nodes.upperStage = find(STAGE_CONFIG.upperStage.nodeKeywords);
    this.nodes.satellite = find(STAGE_CONFIG.satellite.nodeKeywords);

    this.nodes.fairingHalves = [
      find(STAGE_CONFIG.fairingL.nodeKeywords),
      find(STAGE_CONFIG.fairingR.nodeKeywords),
    ].filter(Boolean) as THREE.Object3D[];

    this.nodes.solarPanels = [
      find(STAGE_CONFIG.solarPanelL.nodeKeywords),
      find(STAGE_CONFIG.solarPanelR.nodeKeywords),
    ].filter(Boolean) as THREE.Object3D[];
  }

  /** 如果关键词没找到 —— 按空间几何切分兜底 */
  private _ensureNodesBySpatialCut(sceneObj: THREE.Object3D) {
    const bbox = new THREE.Box3().setFromObject(sceneObj);
    const H = bbox.max.y - bbox.min.y;
    const yBottom = bbox.min.y;

    const allMeshes: THREE.Mesh[] = [];
    sceneObj.traverse(c => { if ((c as THREE.Mesh).isMesh) allMeshes.push(c as THREE.Mesh); });

    const buckets: Record<string, THREE.Mesh[]> = {
      boosters: [], stage1: [], stage2: [], upper: [], fairing: [], satellite: [], solar: []
    };

    for (const m of allMeshes) {
      const c = new THREE.Vector3();
      new THREE.Box3().setFromObject(m).getCenter(c);
      // 转 sceneObj 本地
      sceneObj.worldToLocal(c);
      const ny = (c.y - yBottom) / H; // 0..1
      // 水平距中心
      const horiz = Math.sqrt(c.x * c.x + c.z * c.z);
      const W_half = (bbox.max.x - bbox.min.x) / 2;

      if (ny < 0.35 && horiz > W_half * 0.55) buckets.boosters.push(m);
      else if (ny < 0.38) buckets.stage1.push(m);
      else if (ny < 0.62) buckets.stage2.push(m);
      else if (ny < 0.76) buckets.upper.push(m);
      else if (ny < 0.92) buckets.fairing.push(m);
      else buckets.satellite.push(m);
    }
    // 太阳能板：在 satellite 里找非常扁的东西
    const satCenter = new THREE.Vector3();
    if (buckets.satellite.length) {
      const sbox = new THREE.Box3();
      buckets.satellite.forEach(m => sbox.expandByObject(m));
      sbox.getCenter(satCenter);
    }
    buckets.satellite = buckets.satellite.filter(m => {
      const sz = new THREE.Vector3();
      new THREE.Box3().setFromObject(m).getSize(sz);
      const flatness = Math.max(sz.x, sz.z) / Math.max(sz.y, 0.01);
      if (flatness > 6) {
        buckets.solar.push(m);
        return false;
      }
      return true;
    });

    function wrapInGroup(label: string, meshes: THREE.Mesh[]): THREE.Object3D | undefined {
      if (meshes.length === 0) return undefined;
      const g = new THREE.Group();
      g.name = label;
      meshes.forEach(m => {
        // 从原 parent 移动（注意保持世界变换 → 转本地）
        const wp = new THREE.Vector3(); const wq = new THREE.Quaternion(); const ws = new THREE.Vector3();
        m.getWorldPosition(wp); m.getWorldQuaternion(wq); m.getWorldScale(ws);
        g.attach(m);
      });
      return g;
    }

    const ensure = <K extends keyof StageNodes>(key: K, fallback: () => StageNodes[K]) => {
      const cur = this.nodes[key];
      if (Array.isArray(cur)) {
        if (cur.length === 0) (this.nodes[key] as unknown) = fallback();
      } else if (cur === undefined) {
        (this.nodes[key] as unknown) = fallback();
      }
    };

    // 助推分左右：按 x 中心正负
    if (this.nodes.boosters.length === 0) {
      const L: THREE.Mesh[] = [], R: THREE.Mesh[] = [];
      buckets.boosters.forEach(m => {
        const c = new THREE.Vector3();
        new THREE.Box3().setFromObject(m).getCenter(c);
        sceneObj.worldToLocal(c);
        (c.x < 0 ? L : R).push(m);
      });
      const gL = wrapInGroup('auto_booster_L', L);
      const gR = wrapInGroup('auto_booster_R', R);
      if (gL) { sceneObj.add(gL); this.nodes.boosters.push(gL); }
      if (gR) { sceneObj.add(gR); this.nodes.boosters.push(gR); }
    }
    ensure('stage1', () => {
      const g = wrapInGroup('auto_stage1', buckets.stage1);
      if (g) sceneObj.add(g);
      return g as any;
    });
    ensure('stage2', () => {
      const g = wrapInGroup('auto_stage2', buckets.stage2);
      if (g) sceneObj.add(g);
      return g as any;
    });
    ensure('upperStage', () => {
      const g = wrapInGroup('auto_upper', buckets.upper);
      if (g) sceneObj.add(g);
      return g as any;
    });
    if (this.nodes.fairingHalves.length === 0) {
      const L: THREE.Mesh[] = [], R: THREE.Mesh[] = [];
      buckets.fairing.forEach(m => {
        const c = new THREE.Vector3();
        new THREE.Box3().setFromObject(m).getCenter(c);
        sceneObj.worldToLocal(c);
        (c.x < 0 ? L : R).push(m);
      });
      const gL = wrapInGroup('auto_fairing_L', L);
      const gR = wrapInGroup('auto_fairing_R', R);
      if (gL) { sceneObj.add(gL); this.nodes.fairingHalves.push(gL); }
      if (gR) { sceneObj.add(gR); this.nodes.fairingHalves.push(gR); }
    }
    ensure('satellite', () => {
      const g = wrapInGroup('auto_satellite', buckets.satellite);
      if (g) sceneObj.add(g);
      return g as any;
    });
    if (this.nodes.solarPanels.length === 0) {
      const L: THREE.Mesh[] = [], R: THREE.Mesh[] = [];
      buckets.solar.forEach(m => {
        const c = new THREE.Vector3();
        new THREE.Box3().setFromObject(m).getCenter(c);
        sceneObj.worldToLocal(c);
        (c.x < 0 ? L : R).push(m);
      });
      const gL = wrapInGroup('auto_solar_L', L);
      const gR = wrapInGroup('auto_solar_R', R);
      if (gL) { sceneObj.add(gL); this.nodes.solarPanels.push(gL); }
      if (gR) { sceneObj.add(gR); this.nodes.solarPanels.push(gR); }
    }
  }

  /** 在每个部件下挂一个“喷口锚点”Group，粒子系统直接 getWorldPosition 用 */
  private _installNozzleAnchors() {
    const make = (parent: THREE.Object3D, offset: number): THREE.Object3D => {
      const anchor = new THREE.Group();
      anchor.name = 'NozzleAnchor';
      // 把 anchor 放到 parent 本地 bbox 的底部中心 - offset
      const bbox = new THREE.Box3().setFromObject(parent);
      const center = new THREE.Vector3();
      bbox.getCenter(center);
      parent.worldToLocal(center);
      const size = new THREE.Vector3();
      bbox.getSize(size);
      anchor.position.set(center.x, bbox.min.y - (parent.parent ? 0 : offset), center.z);
      anchor.position.y -= offset;
      parent.add(anchor);
      return anchor;
    };

    // 一级主发动机 —— stage1 底部
    if (this.nodes.stage1) {
      this.nodes.mainNozzleAnchors.push(make(this.nodes.stage1, STAGE_CONFIG.stage1.nozzleLocalOffsetY * 0));
    }
    // 助推
    this.nodes.boosters.forEach(b => {
      this.nodes.boosterNozzleAnchors.push(make(b, 0));
    });
    // 二级
    if (this.nodes.stage2) {
      this.nodes.stage2NozzleAnchor = make(this.nodes.stage2, 0);
    }
    // 末级
    if (this.nodes.upperStage) {
      this.nodes.upperNozzleAnchor = make(this.nodes.upperStage, 0);
    }
  }

  /** 世界坐标下：火箭"正前方"向量（头指向），单位向量 */
  getForwardWorld(): THREE.Vector3 {
    // root 默认 Y+ = 上方
    const up = new THREE.Vector3(0, 1, 0);
    up.applyQuaternion(this.nodes.root.quaternion);
    return up.normalize();
  }

  getWorldPosition(target: THREE.Vector3): THREE.Vector3 {
    return this.nodes.root.getWorldPosition(target);
  }

  /* ============ 状态重置 ============ */
  resetAll() {
    // 把 detached 的部件重新挂回原来的 parent（sceneObj）并恢复本地变换
    const sceneObj = this.nodes.root.children[0];
    const restore = (name: PartName, obj?: THREE.Object3D) => {
      if (!obj) return;
      sceneObj.attach(obj); // 保持世界位姿地挂回
      const init = this._partInitialLocal.get(name);
      if (init) {
        obj.position.copy(init.pos);
        obj.quaternion.copy(init.quat);
        obj.scale.copy(init.scale);
      }
    };
    restore('boosterL', this.nodes.boosters[0]);
    restore('boosterR', this.nodes.boosters[1]);
    restore('stage1', this.nodes.stage1);
    restore('stage2', this.nodes.stage2);
    restore('upperStage', this.nodes.upperStage);
    restore('fairingL', this.nodes.fairingHalves[0]);
    restore('fairingR', this.nodes.fairingHalves[1]);
    restore('satellite', this.nodes.satellite);
    restore('solarPanelL', this.nodes.solarPanels[0]);
    restore('solarPanelR', this.nodes.solarPanels[1]);

    // 恢复 root 位姿（默认 0 高度 不旋转）
    this.nodes.root.position.set(0, 0, 0);
    this.nodes.root.quaternion.identity();

    // 清空 partState
    (Object.keys(this.partState) as PartName[]).forEach(k => {
      this.partState[k] = { detached: false, hingeProgress: 0, sepProgress: 0 };
    });
  }

  /* ============ 分离 / 展开动画触发（设置目标进度，每帧 _tick 应用） ============ */
  /**
   * 设置某部件分离进度
   * @param part 部件名
   * @param sep 分离进度 0..1
   * @param hinge hinge 进度 0..1（整流罩 / 太阳翼）
   */
  setPartProgress(part: PartName, sep: number, hinge: number = 0) {
    const st = this.partState[part];
    const cfg = STAGE_CONFIG[part];
    if (!st || !cfg) return;

    // 首次分离 —— 从 root 内拆下、挂到 scene 上（保持世界位姿）
    if (!st.detached && (sep > 0 || hinge > 0.01)) {
      st.detached = true;
      const obj = this._resolvePart(part);
      if (obj) {
        // 保留世界坐标地移到 scene
        this.scene.attach(obj);
      }
    }

    st.sepProgress = THREE.MathUtils.clamp(sep, 0, 1);
    st.hingeProgress = THREE.MathUtils.clamp(hinge, 0, 1);
    this._applyPartTransform(part);
  }

  private _resolvePart(part: PartName): THREE.Object3D | undefined {
    switch (part) {
      case 'boosterL': return this.nodes.boosters[0];
      case 'boosterR': return this.nodes.boosters[1];
      case 'stage1': return this.nodes.stage1;
      case 'fairingL': return this.nodes.fairingHalves[0];
      case 'fairingR': return this.nodes.fairingHalves[1];
      case 'stage2': return this.nodes.stage2;
      case 'upperStage': return this.nodes.upperStage;
      case 'satellite': return this.nodes.satellite;
      case 'solarPanelL': return this.nodes.solarPanels[0];
      case 'solarPanelR': return this.nodes.solarPanels[1];
    }
  }

  /** 将当前 sep / hinge 进度应用到实际节点 */
  private _applyPartTransform(part: PartName) {
    const obj = this._resolvePart(part);
    const cfg = STAGE_CONFIG[part];
    const init = this._partInitialLocal.get(part);
    const st = this.partState[part];
    if (!obj || !cfg || !init || !st) return;

    // 目标姿态 = 初始火箭坐标系下的本地偏移，再加上 hinge + sep 偏移，
    // 由于已经 detach 到 scene（场景世界系），需要先还原"在火箭内部"的世界位姿，再叠加
    // 简化：基于火箭 root 当前世界位姿，按 init 本地 → 求初始世界，再叠加 sep/hinge
    const rocketRoot = this.nodes.root;
    const tmp = new THREE.Object3D();
    tmp.position.copy(init.pos);
    tmp.quaternion.copy(init.quat);
    tmp.scale.copy(init.scale);
    rocketRoot.add(tmp); // 此时 tmp 的世界矩阵 = 该部件初始未分离的世界位姿
    tmp.updateMatrixWorld(true);
    const basePos = new THREE.Vector3();
    const baseQuat = new THREE.Quaternion();
    tmp.getWorldPosition(basePos);
    tmp.getWorldQuaternion(baseQuat);
    rocketRoot.remove(tmp);

    // ---- Hinge 旋转（绕 obj 本地某轴旋转，基于 baseQuat 定义的本地） ----
    const hingeRot = new THREE.Quaternion();
    if (cfg.hingeAxis && cfg.hingeAngle) {
      const worldAxis = new THREE.Vector3(
        cfg.hingeAxis === 'x' ? 1 : 0,
        cfg.hingeAxis === 'y' ? 1 : 0,
        cfg.hingeAxis === 'z' ? 1 : 0
      ).applyQuaternion(baseQuat);
      const ang = THREE.MathUtils.degToRad(cfg.hingeAngle) * st.hingeProgress;
      // fairing 左/右 要镜像方向
      if (part === 'fairingL' && cfg.hingeAxis === 'z') worldAxis.negate();
      hingeRot.setFromAxisAngle(worldAxis, ang);
    }

    // ---- Separation 平移 + 自旋转 ----
    const worldSide = new THREE.Vector3(1, 0, 0).applyQuaternion(baseQuat); // 火箭右侧
    const worldBack = new THREE.Vector3(0, -1, 0).applyQuaternion(baseQuat); // 火箭下方
    const sepOffset = new THREE.Vector3()
      .addScaledVector(worldSide, cfg.sepSideOffset * st.sepProgress)
      .addScaledVector(worldBack, cfg.sepBackDistance * st.sepProgress)
      // 叠加抛物线下落（未进入太空的部件有重力），sep 越大下落越多
      .addScaledVector(new THREE.Vector3(0, -1, 0), 0.5 * 9.8 * (st.sepProgress * 4) ** 2 * (st.sepProgress > 0 ? 1 : 0) * 0.15);

    obj.position.copy(basePos).add(sepOffset);
    obj.quaternion.copy(baseQuat).premultiply(hingeRot);
    // 分离后的自旋（绕前向）
    if (cfg.sepRotSpeed && st.sepProgress > 0.1) {
      const forward = new THREE.Vector3(0, 1, 0).applyQuaternion(baseQuat);
      const spin = new THREE.Quaternion().setFromAxisAngle(forward, THREE.MathUtils.degToRad(cfg.sepRotSpeed) * st.sepProgress);
      obj.quaternion.premultiply(spin);
    }
    obj.scale.setFromMatrixScale(new THREE.Matrix4().compose(basePos, baseQuat, init.scale));
  }
}
