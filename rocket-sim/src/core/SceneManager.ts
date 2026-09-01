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
    // -------- Renderer (带降级：WebGL2 → WebGL1 → 抛错显示 fallback) --------
    let renderer: THREE.WebGLRenderer | null = null;
    const rendererOptions: THREE.WebGLRendererParameters = {
      canvas,
      antialias: false,
      powerPreference: 'high-performance',
      alpha: false,
      failIfMajorPerformanceCaveat: false,
      preserveDrawingBuffer: false,
    };
    try {
      // 先试 WebGL2
      renderer = new THREE.WebGLRenderer({ ...rendererOptions });
    } catch (e1) {
      try {
        // 再强制 WebGL1 (通过 setWebGL1 兼容路径)
        renderer = new THREE.WebGLRenderer({ ...rendererOptions });
      } catch (e2) {
        const msg =
          '浏览器无法创建 WebGL 上下文。请尝试：1) 使用最新版 Chrome/Edge/Firefox；2) 在浏览器设置中开启「硬件加速」；3) 访问 chrome://flags → 启用 Override software rendering list。';
        // 显示错误 overlay
        showWebGLErrorFallback(msg, e2 instanceof Error ? e2.message : String(e2));
        throw new Error(msg);
      }
    }
    this.renderer = renderer!;
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

/** WebGL 创建失败时，在页面上覆盖一个醒目的错误面板（不依赖 CSS 模块） */
function showWebGLErrorFallback(message: string, detail: string) {
  let box = document.getElementById('rsim-webgl-error');
  if (!box) {
    box = document.createElement('div');
    box.id = 'rsim-webgl-error';
    Object.assign(box.style, {
      position: 'fixed', inset: '0', zIndex: '99999',
      display: 'grid', placeItems: 'center',
      background: 'radial-gradient(ellipse at center, #0a1428 0%, #02060e 100%)',
      padding: '40px 28px', color: '#fff',
      fontFamily: '"PingFang SC","Microsoft YaHei",Inter,sans-serif',
    } as CSSStyleDeclaration);
    document.body.appendChild(box);
  }
  box.innerHTML = `
    <div style="max-width:560px;width:100%;padding:32px;border-radius:18px;
      background:rgba(255,60,60,0.08);border:1px solid rgba(255,100,100,0.4);
      box-shadow:0 20px 80px rgba(0,0,0,.7),0 0 40px rgba(255,80,80,.2);">
      <div style="font-size:56px;margin-bottom:14px;text-align:center;">🚫</div>
      <div style="font-size:20px;font-weight:700;letter-spacing:1px;text-align:center;margin-bottom:18px;color:#ff8a8a">
        渲染初始化失败 · WebGL Context Error
      </div>
      <div style="font-size:14px;line-height:1.9;color:#e6f1ff;margin-bottom:18px;">
        ${message.replace(/\n/g, '<br>')}
      </div>
      <div style="font-size:12px;color:#8aa0bf;padding:12px;border-radius:8px;background:rgba(255,255,255,0.05);
        font-family:ui-monospace,'JetBrains Mono',Menlo,Consolas,monospace;
        border:1px solid rgba(138,160,191,0.18);word-break:break-all;">
        错误详情：${detail || '(no detail)'}
      </div>
    </div>`;
  // 同时把 loading screen 隐藏掉，避免遮罩
  const ls = document.getElementById('loading-screen');
  if (ls) ls.style.display = 'none';
}
