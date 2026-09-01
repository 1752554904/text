/* =========================================================
   飞行轨迹指引线：根据遥测关键帧，生成未来一段的预测轨迹
   （Catmull-Rom 平滑曲线路径，带箭头标记）
   ========================================================= */

import * as THREE from 'three';
import {
  TELEMETRY_KEYFRAMES,
  type TelemetryKeyframe,
} from '../data/missionData';
import { interpTelemetry } from '../utils/math';

export class TrajectoryLine {
  readonly group = new THREE.Group();
  private _line: THREE.Line;
  private _geo: THREE.BufferGeometry;
  private _mat: THREE.LineBasicMaterial;
  private _markers: THREE.Mesh[] = [];

  /** 预测精度（点数） */
  private _segments = 240;

  constructor(scene: THREE.Scene) {
    this._geo = new THREE.BufferGeometry();
    const positions = new Float32Array(this._segments * 3);
    const colors = new Float32Array(this._segments * 3);
    this._geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this._geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    this._mat = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      linewidth: 2,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    this._line = new THREE.Line(this._geo, this._mat);
    this._line.frustumCulled = false;
    this.group.add(this._line);

    // 生成 N 个箭头小圆锥标记
    const coneGeo = new THREE.ConeGeometry(1, 3, 8);
    for (let i = 0; i < 16; i++) {
      const m = new THREE.Mesh(
        coneGeo,
        new THREE.MeshBasicMaterial({
          color: new THREE.Color().setHSL(0.55, 0.9, 0.6),
          transparent: true,
          opacity: 0.9,
        })
      );
      this._markers.push(m);
      this.group.add(m);
    }

    scene.add(this.group);

    // 先计算一次未来轨迹
    this.update(0, 0);
  }

  /**
   * @param currentT 当前 T+ 时间
   * @param downrange 当前下点（用于匹配当前世界坐标）
   */
  update(currentT: number, downrange: number) {
    const tMax = TELEMETRY_KEYFRAMES[TELEMETRY_KEYFRAMES.length - 1].t;
    const tStart = Math.max(0, currentT - 6); // 回溯一小段"已经飞过的"
    const tEnd = tMax;
    const N = this._segments;
    const pos = this._geo.attributes.position as THREE.BufferAttribute;
    const col = this._geo.attributes.color as THREE.BufferAttribute;

    // 我们需要把 (telemetry alt + heading + downrange累计) 转成 世界 XYZ
    // 这里要和 MissionController 内的积分保持一致：
    // 重新对每个 keyframe 间段积分得到 downrange(t)
    const table = this._precomputeDownrangeTable(N + 1, tStart, tEnd);

    const c = new THREE.Color();
    // 当前位置：用传入的 downrange 平移整个轨迹，让"已飞行段终点"对齐火箭当前位置
    // 计算对应 t = currentT 的积分 downrange
    const curAtMission = this._integratedDownrange(currentT);
    const offsetXZ = downrange - curAtMission;

    for (let i = 0; i < N; i++) {
      const k = i / (N - 1);
      const t = tStart + k * (tEnd - tStart);
      const tm = interpTelemetry(TELEMETRY_KEYFRAMES, t);
      const dr = this._integratedDownrange(t) + offsetXZ;
      const hdgRad = (tm.heading * Math.PI) / 180;
      const x = dr * Math.sin(hdgRad);
      const z = dr * Math.cos(hdgRad);
      const y = tm.alt;

      pos.setXYZ(i, x, y, z);

      // 颜色：已飞段 -> 过去=蓝紫, 未来=青绿
      const progressFrac = (t - currentT) / Math.max(1, tMax - currentT);
      if (t < currentT) {
        // 已飞段：渐淡紫蓝 -> 透明
        const fade = 1 - Math.min(1, (currentT - t) / 30);
        c.setHSL(0.75, 0.6, 0.5);
        col.setXYZ(i, c.r * fade, c.g * fade, c.b * fade);
      } else {
        // 未来段：青绿 渐变 → 橙（靠近轨道插入）
        const hue = THREE.MathUtils.lerp(0.55, 0.08, progressFrac);
        c.setHSL(hue, 0.9, 0.62);
        col.setXYZ(i, c.r, c.g, c.b);
      }
    }
    pos.needsUpdate = true;
    col.needsUpdate = true;

    // 隐藏已飞过段之前的"旧点"的 opacity（没法 per-point，所以由 colors 降低）——上面已做

    // 更新箭头标记位置 & 朝向（方向 = 轨迹切线）
    const arrowInterval = Math.floor((N - 1) / this._markers.length);
    const tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3();
    for (let i = 0; i < this._markers.length; i++) {
      const idx = Math.min(N - 2, i * arrowInterval + 4);
      tmpA.fromBufferAttribute(pos, idx);
      tmpB.fromBufferAttribute(pos, idx + 2);
      const m = this._markers[i];
      m.position.lerpVectors(tmpA, tmpB, 0.5);
      // 方向 tmpB - tmpA
      const dir = tmpB.sub(tmpA).normalize();
      m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
      // 已飞段的箭头隐藏
      const t = tStart + (idx / N) * (tEnd - tStart);
      const show = t > currentT + 4;
      m.visible = show;
    }

    void table;
  }

  /* ---------- 与 MissionController 同步的 downrange 积分算法 ---------- */
  private _drCache: { t: number; dr: number }[] | null = null;
  private _ensureDrCache() {
    if (this._drCache) return;
    const arr: { t: number; dr: number }[] = [];
    let dr = 0;
    const last = TELEMETRY_KEYFRAMES[TELEMETRY_KEYFRAMES.length - 1].t;
    const N = 2000;
    for (let i = 0; i <= N; i++) {
      const t = (i / N) * last;
      if (i > 0) {
        const tm = interpTelemetry(TELEMETRY_KEYFRAMES, t);
        const tmPrev = interpTelemetry(TELEMETRY_KEYFRAMES, (t - last / N));
        const pitchRad = ((tm.pitch + tmPrev.pitch) / 2) * Math.PI / 180;
        const vH = ((tm.vel + tmPrev.vel) / 2) * Math.cos(pitchRad);
        dr += vH * (last / N);
      }
      arr.push({ t, dr });
    }
    this._drCache = arr;
  }
  private _integratedDownrange(t: number): number {
    this._ensureDrCache();
    const arr = this._drCache!;
    if (t <= arr[0].t) return arr[0].dr;
    if (t >= arr[arr.length - 1].t) return arr[arr.length - 1].dr;
    // 二分查找
    let lo = 0, hi = arr.length - 1;
    while (lo < hi - 1) {
      const mid = (lo + hi) >> 1;
      if (arr[mid].t <= t) lo = mid; else hi = mid;
    }
    const a = arr[lo], b = arr[hi];
    const k = (t - a.t) / Math.max(1e-6, b.t - a.t);
    return a.dr + (b.dr - a.dr) * k;
  }

  private _precomputeDownrangeTable(n: number, tStart: number, tEnd: number) {
    const out: { t: number; dr: number; tm: TelemetryKeyframe }[] = [];
    for (let i = 0; i < n; i++) {
      const k = i / (n - 1);
      const t = tStart + k * (tEnd - tStart);
      out.push({ t, dr: this._integratedDownrange(t), tm: interpTelemetry(TELEMETRY_KEYFRAMES, t) });
    }
    return out;
  }
}
