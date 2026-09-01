/* =========================================================
   CZ-6A Rocket Simulator · Main Entry
   ========================================================= */

import './style.css';
import * as THREE from 'three';
import { SceneManager, type ViewMode } from './core/SceneManager';
import { RocketModel } from './modules/RocketModel';
import { LaunchSite } from './modules/LaunchSite';
import { ParticleFX, type FlameEmitter } from './modules/ParticleFX';
import { TrajectoryLine } from './modules/TrajectoryLine';
import { MissionController } from './core/MissionController';
import { CameraInput } from './core/CameraInput';
import { UIController } from './ui/UIController';
import { formatTPlus } from './utils/math';
import { FLIGHT_EVENTS } from './data/missionData';

/* ==========================================================
   把所有可能抛错的东西全部放入 boot() 内 try/catch，
   避免模块顶层 new SceneManager() WebGL 失败导致脚本整体 crash。
   ========================================================== */

/** 显示加载阶段的统一入口（DOM 元素安全访问） */
function setLoadingUI(progress: number, sub: string, errorMsg?: string) {
  const ls = document.getElementById('loading-screen');
  const bar = document.getElementById('loading-bar') as HTMLDivElement | null;
  const pct = document.getElementById('loading-percent') as HTMLDivElement | null;
  const subEl = document.getElementById('loading-sub') as HTMLDivElement | null;
  if (errorMsg && ls) {
    // 切换为错误态
    const title = ls.querySelector<HTMLDivElement>('.loading-title');
    if (title) {
      title.textContent = 'SYSTEM ERROR · 系统初始化失败';
      title.style.color = '#ff6b6b';
    }
    if (subEl) {
      subEl.innerHTML = errorMsg;
      subEl.style.color = '#ffb0b0';
      subEl.style.whiteSpace = 'pre-wrap';
      subEl.style.lineHeight = '1.7';
    }
    if (bar) {
      bar.style.background =
        'linear-gradient(90deg, #ff4d4d, #ff884d)';
      bar.style.width = '100%';
    }
    if (pct) pct.textContent = 'ERR';
    return;
  }
  const p = Math.max(0, Math.min(1, progress));
  if (bar) bar.style.width = (p * 100).toFixed(1) + '%';
  if (pct) pct.textContent = Math.round(p * 100) + '%';
  if (subEl) subEl.textContent = sub;
}

function showLoadingDone() {
  const ls = document.getElementById('loading-screen');
  if (!ls) return;
  ls.classList.add('hidden');
  setTimeout(() => {
    if (ls) ls.style.display = 'none';
  }, 650);
}

/* 全局错误捕获（兜底） */
window.addEventListener('error', (e) => {
  const msg = `[${e.filename || 'script'}:${e.lineno}] ${e.message}`;
  console.error('[RSIM global error]', msg);
  setLoadingUI(0, '脚本运行时错误：\n' + msg, msg);
});
window.addEventListener('unhandledrejection', (e) => {
  const msg = (e.reason && (e.reason.stack || e.reason.message)) || String(e.reason);
  console.error('[RSIM unhandled promise]', msg);
  setLoadingUI(0, '异步任务失败：\n' + msg, msg);
});

async function boot() {
  const canvas = document.getElementById('viewport') as HTMLCanvasElement | null;
  if (!canvas) {
    setLoadingUI(0, 'DOM 结构异常：#viewport canvas 未找到', 'DOM 结构异常');
    return;
  }

  setLoadingUI(0.02, '正在启动 Three.js 渲染管线（WebGL2/WebGL1 降级）...');

  /* ====== 各模块实例声明（都在内部，避免顶层 WebGL 报错） ====== */
  let sceneMgr: SceneManager;
  try {
    sceneMgr = new SceneManager(canvas);
  } catch (e) {
    // SceneManager 内部已显示 fallback UI；再把错误同步到 loading 面板
    const msg = e instanceof Error ? (e.stack || e.message) : String(e);
    console.error('SceneManager 初始化失败：', e);
    setLoadingUI(0.02, 'WebGL 上下文创建失败：\n' + msg, msg);
    return;
  }

  setLoadingUI(0.05, '生成地形/发射台/星空环境 (加载 tellux 原资源)...');
  const launchSite = new LaunchSite(sceneMgr.scene);

  setLoadingUI(0.08, '初始化箭体加载器...');
  const rocket = new RocketModel(sceneMgr.scene);

  setLoadingUI(0.10, '建立粒子系统（尾焰/烟雾/冲击）...');
  const fx = new ParticleFX(sceneMgr.scene);

  setLoadingUI(0.12, '校准轨道预测曲线...');
  const trajectory = new TrajectoryLine(sceneMgr.scene);

  setLoadingUI(0.14, '等待地形/星空贴图 (tellux.cyanfish.site 原资源) 加载完毕...');
  try {
    await launchSite.ready();
  } catch (e) {
    console.warn('[boot] launchSite tellux 资源加载失败（已 fallback）:', e);
  }

  setLoadingUI(0.15, '开始加载 CZ-6A 箭体模型 (14MB) — 首次加载需下载...');
  try {
    // 注意：Vite public 路径用 import.meta.env.BASE_URL
    await rocket.load((p) => {
      setLoadingUI(0.15 + p * 0.7, p < 1 ? `正在解析 CZ-6A 箭体模型 ... ${(p * 100).toFixed(0)}%` : '箭体载入完毕');
    });
  } catch (err) {
    const msg = err instanceof Error ? (err.stack || err.message) : String(err);
    setLoadingUI(0.25, 'GLB 模型加载失败，请确认 public/models/CZ-6A.glb 是否存在：\n' + msg, msg);
    return;
  }

  setLoadingUI(0.88, '装配喷管与分离机构...');
  buildEmitters(rocket, fx);
  rocket.nodes.root.position.set(0, 0, 0);
  rocket.nodes.root.updateMatrixWorld(true);

  setLoadingUI(0.91, '建立遥测状态机与事件调度...');
  const mission = new MissionController(rocket, fx, launchSite);

  setLoadingUI(0.93, '绑定 UI 控件（发射/暂停/重置/速度/视角）...');
  const ui = new UIController(mission, sceneMgr, {
    onLaunch: () => {
      if (!mission.state.running) mission.launchOrResume();
    },
    onPauseToggle: () => {
      if (mission.state.running) mission.pause();
      else mission.launchOrResume();
    },
    onReset: () => mission.reset(),
    onSpeedChange: (k) => mission.setTimeScale(k),
    onViewChange: (v) => sceneMgr.setViewMode(v as ViewMode),
  });

  setLoadingUI(0.96, '校准摄像机与鼠标输入...');
  mission.reset();
  trajectory.update(0, 0);
  launchSite.update(0, 0.016);
  fx.update(0.016);
  const camInput = new CameraInput(sceneMgr);

  mission.onPhaseEnter = (ev) => {
    console.info(`[FLIGHT EVENT ${ev.index}] ${ev.name} @ ${formatTPlus(ev.tTime)}`);
  };

  setLoadingUI(1.0, '✅ 系统就绪 · 点击「点火发射」按钮开始任务');
  setTimeout(() => showLoadingDone(), 300);

  startLoop({ sceneMgr, launchSite, rocket, fx, trajectory, mission, camInput, ui });

  // 调试接口
  (window as any).RSIM = {
    rocket, sceneMgr, mission, fx, launchSite, trajectory, EVENTS: FLIGHT_EVENTS,
  };
}

/* ---------- 尾焰 Emitter（按关键字注册）----------
   0: 助推 atmospheric
   1: 主级(1级) atmospheric
   2: 二级 vacuum
   3: 末级 plasma
----------------------------------------------- */
function buildEmitters(rocket: RocketModel, fx: ParticleFX) {
  const boosterAnchors = rocket.nodes.boosterNozzleAnchors;
  const stage1Anchors = rocket.nodes.mainNozzleAnchors;
  const stage2Anchor = rocket.nodes.stage2NozzleAnchor;
  const upperAnchor = rocket.nodes.upperNozzleAnchor;

  if (boosterAnchors.length) {
    const em: FlameEmitter = {
      anchors: boosterAnchors,
      direction: new THREE.Vector3(0, -1, 0),
      intensity: 0,
      lengthScale: 1,
      style: 'atmospheric',
    };
    fx.createFlameEmitter(em);
  }
  if (stage1Anchors.length) {
    const em: FlameEmitter = {
      anchors: stage1Anchors,
      direction: new THREE.Vector3(0, -1, 0),
      intensity: 0,
      lengthScale: 1.2,
      style: 'atmospheric',
    };
    fx.createFlameEmitter(em);
  }
  if (stage2Anchor) {
    const em: FlameEmitter = {
      anchors: [stage2Anchor],
      direction: new THREE.Vector3(0, -1, 0),
      intensity: 0,
      lengthScale: 0.9,
      style: 'vacuum',
    };
    fx.createFlameEmitter(em);
  }
  if (upperAnchor) {
    const em: FlameEmitter = {
      anchors: [upperAnchor],
      direction: new THREE.Vector3(0, -1, 0),
      intensity: 0,
      lengthScale: 0.7,
      style: 'plasma',
    };
    fx.createFlameEmitter(em);
  }
  const total = boosterAnchors.length + stage1Anchors.length + (stage2Anchor ? 1 : 0) + (upperAnchor ? 1 : 0);
  if (total === 0) {
    const anchor = new THREE.Group();
    anchor.name = 'FallbackNozzle';
    anchor.position.set(0, -rocket.rocketLengthMeters * 0.5 + 2, 0);
    rocket.nodes.root.add(anchor);
    for (let i = 0; i < 4; i++) {
      fx.createFlameEmitter({
        anchors: [anchor],
        direction: new THREE.Vector3(0, -1, 0),
        intensity: 0,
        lengthScale: 1,
        style: i < 2 ? 'atmospheric' : i === 2 ? 'vacuum' : 'plasma',
      });
    }
  }
}

/* ---------- 主循环 ---------- */
interface LoopDeps {
  sceneMgr: SceneManager;
  launchSite: LaunchSite;
  rocket: RocketModel;
  fx: ParticleFX;
  trajectory: TrajectoryLine;
  mission: MissionController;
  camInput: CameraInput;
  ui: UIController;
}
function startLoop(deps: LoopDeps) {
  const { sceneMgr, launchSite, rocket, fx, trajectory, mission, camInput, ui } = deps;
  const clock = new THREE.Clock();
  let lastUiSync = 0;
  let errShown = false;
  rocket.nodes.root.updateMatrixWorld(true);

  const tmpRocketPos = new THREE.Vector3();
  const tmpForward = new THREE.Vector3();

  function frame() {
    try {
      const dt = Math.min(0.05, clock.getDelta());

      // 1. 推进任务状态机
      mission.tick(dt);
      rocket.nodes.root.updateMatrixWorld(true);

      // 2. 粒子 & 场景更新
      fx.update(dt);
      launchSite.update(mission.state.telemetry.alt, dt);

      // 3. 轨迹预测
      trajectory.update(mission.state.missionTime, mission.state.downrange);

      // 4. 相机
      rocket.getWorldPosition(tmpRocketPos);
      tmpForward.copy(rocket.getForwardWorld());
      sceneMgr.updateCamera(tmpRocketPos, tmpForward, dt);

      // 5. UI
      const now = performance.now();
      if (now - lastUiSync > 60) {
        ui.sync();
        lastUiSync = now;
      }

      // 6. 渲染
      sceneMgr.render();
    } catch (e) {
      if (!errShown) {
        errShown = true;
        const msg = e instanceof Error ? (e.stack || e.message) : String(e);
        console.error('[RSIM Frame Error]', e);
        setLoadingUI(
          1,
          '渲染循环出现错误，已停止渲染循环：\n' + msg,
          msg
        );
        const ls = document.getElementById('loading-screen');
        if (ls) {
          ls.style.display = 'grid';
          ls.classList.remove('hidden');
        }
      }
      return;
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  window.addEventListener('beforeunload', () => {
    camInput.dispose();
    sceneMgr.dispose();
  });
}

/* Go! */
boot();
