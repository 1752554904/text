/* =========================================================
   场景核心 · SceneManager (Three.js + postprocessing)
   ========================================================= */

import * as THREE from 'three';
import {
  EffectComposer,
  RenderPass,
  BloomEffect,
  EffectPass,
  SMAAEffect,
  SMAAPreset,
} from 'postprocessing';

export type ViewMode = 'follow' | 'orbital' | 'pad' | 'free';

export class SceneManager {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly composer: EffectComposer;
  readonly bloom: BloomEffect;

  /** 相机视角模式 */
  viewMode: ViewMode = 'follow';

  /** 自由视角（OrbitControls-like，手搓）参数 */
  freeYaw = -Math.PI / 4;    // 水平角
  freePitch = 0.35;           // 俯仰（弧度，0=水平）
  freeDist = 220;             // 到目标的距离
  freeTarget = new THREE.Vector3(0, 50, 0);
  freePanOffset = new THREE.Vector3();

  /** 跟随相机参数 */
  followBack = 90;
  followUp = 40;
  followPitchOffset = 0;

  /** 视图尺寸 */
  get width() { return window.innerWidth; }
  get height() { return window.innerHeight; }

  constructor(private canvas: HTMLCanvasElement) {
    // -------- Renderer --------
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,          // SMAA 在 composer 做
      powerPreference: 'high-performance',
      alpha: false,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(this.width, this.height, false);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // -------- Scene --------
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x0a1428, 0.00018);

    // -------- Camera --------
    this.camera = new THREE.PerspectiveCamera(55, this.width / this.height, 0.1, 1e7);
    this.camera.position.set(-200, 120, -240);
    this.camera.lookAt(0, 60, 0);

    // -------- Postprocessing (电影级) --------
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));

    this.bloom = new BloomEffect({
      intensity: 0.9,
      luminanceThreshold: 0.55,
      luminanceSmoothing: 0.25,
      mipmapBlur: true,
      radius: 0.55,
    });
    const smaa = new SMAAEffect({ preset: SMAAPreset.ULTRA });
    this.composer.addPass(new EffectPass(this.camera, this.bloom, smaa));

    // 窗口 resize
    window.addEventListener('resize', this._onResize);
  }

  private _onResize = () => {
    this.camera.aspect = this.width / this.height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(this.width, this.height, false);
    this.composer.setSize(this.width, this.height);
  };

  /** 设置当前视角模式 */
  setViewMode(mode: ViewMode) {
    this.viewMode = mode;
    if (mode === 'pad') {
      // 发射场远景
      this.freeYaw = -Math.PI / 3.2;
      this.freePitch = 0.18;
      this.freeDist = 650;
      this.freeTarget.set(0, 50, 0);
    } else if (mode === 'orbital') {
      this.freeDist = 4000;
      this.freePitch = 0.55;
    }
  }

  /**
   * 更新相机姿态
   * @param rocketWorldPos 火箭世界坐标
   * @param rocketForward 火箭前端方向（单位向量，指向上）
   * @param dt 帧间秒
   */
  updateCamera(
    rocketWorldPos: THREE.Vector3,
    rocketForward: THREE.Vector3,
    dt: number
  ) {
    switch (this.viewMode) {
      case 'follow': {
        // 在火箭后上方跟踪 + 缓动插值
        // 向后 = -forward, 向上 = world up 加一点 forward.up
        const back = rocketForward.clone().multiplyScalar(-this.followBack);
        const upOffset = new THREE.Vector3(0, this.followUp, 0);
        const target = rocketWorldPos.clone()
          .add(back)
          .add(upOffset);
        this.camera.position.lerp(target, 1 - Math.pow(0.001, dt));
        const lookAt = rocketWorldPos.clone()
          .add(rocketForward.clone().multiplyScalar(30));
        this._smoothLookAt(lookAt, dt);
        break;
      }
      case 'orbital':
      case 'pad':
      case 'free': {
        // 球坐标相机，始终 lookAt freeTarget
        // 轨道模式把 freeTarget 跟随火箭
        if (this.viewMode === 'orbital') {
          this.freeTarget.lerp(rocketWorldPos, 1 - Math.pow(0.005, dt));
        }
        const cp = Math.cos(this.freePitch);
        const sp = Math.sin(this.freePitch);
        const cy = Math.cos(this.freeYaw);
        const sy = Math.sin(this.freeYaw);
        const dir = new THREE.Vector3(cp * sy, sp, cp * cy).multiplyScalar(this.freeDist);
        const pos = this.freeTarget.clone().add(dir).add(this.freePanOffset);
        this.camera.position.lerp(pos, 1 - Math.pow(0.0001, dt));
        this._smoothLookAt(this.freeTarget.clone().add(this.freePanOffset), dt);
        break;
      }
    }
  }

  private _tmpLook = new THREE.Vector3();
  private _smoothLookAt(target: THREE.Vector3, dt: number) {
    this._tmpLook.lerp(target, 1 - Math.pow(0.0001, dt));
    this.camera.lookAt(this._tmpLook);
  }

  /** 渲染一帧 */
  render() {
    this.composer.render();
  }

  /** 释放资源 */
  dispose() {
    window.removeEventListener('resize', this._onResize);
    this.composer.dispose();
    this.renderer.dispose();
  }
}
