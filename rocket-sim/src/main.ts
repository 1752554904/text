/* =========================================================
   CZ-6A Rocket Simulator · Main Entry
   ========================================================= */

import './style.css';
import * as THREE from 'three';
import { SceneManager } from './core/SceneManager';
import { RocketModel } from './modules/RocketModel';
import { LaunchSite } from './modules/LaunchSite';
import { ParticleFX, type FlameEmitter } from './modules/ParticleFX';
import { TrajectoryLine } from './modules/TrajectoryLine';
import { MissionController } from './core/MissionController';
import { CameraInput } from './core/CameraInput';
import { UIController } from './ui/UIController';
import { formatTPlus } from './utils/math';
import { FLIGHT_EVENTS } from './data/missionData';

const canvas = document.getElementById('viewport') as HTMLCanvasElement;

/* ---------- 各模块实例 ---------- */
const sceneMgr = new SceneManager(canvas);
const launchSite = new LaunchSite(sceneMgr.scene);
const rocket = new RocketModel(sceneMgr.scene);
const fx = new ParticleFX(sceneMgr.scene);
const trajectory = new TrajectoryLine(sceneMgr.scene);

/* ---------- 尾焰 Emitter（按关键字注册） ----------
   0: 助推 atmospheric
   1: 主级(1级) atmospheric
   2: 二级 vacuum
   3: 末级 plasma
----------------------------------------------- */
function buildEmitters() {
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
  // 至少兜底：若模型完全没有锚点节点 → 在 root 底部挂一个临时锚
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

/* ---------- Mission & UI & Input ---------- */
const mission = new MissionController(rocket, fx, launchSite);
const ui = new UIController(mission, sceneMgr, {
  onLaunch: () => {
    if (!mission.state.firedEvents.has('ignition')) {
      // 点火：发射前 1s 先推到 T-1 ramp up
      mission.launchOrResume();
    } else {
      mission.launchOrResume();
    }
  },
  onPauseToggle: () => {
    if (mission.state.running) mission.pause();
    else mission.launchOrResume();
  },
  onReset: () => {
    mission.reset();
  },
  onSpeedChange: (k) => mission.setTimeScale(k),
  onViewChange: (v) => sceneMgr.setViewMode(v),
});
const camInput = new CameraInput(sceneMgr);

mission.onPhaseEnter = (ev) => {
  // 事件触发时的 UI 侧反馈（可扩展 toast）
  console.info(`[FLIGHT EVENT ${ev.index}] ${ev.name} @ ${formatTPlus(ev.tTime)}`);
};

/* ---------- Boot ---------- */
let loadingPhase = 0;
const setLoadingSub = (s: string) => ui.setLoading(loadingPhase, s);

async function boot() {
  ui.setLoading(0, '正在初始化飞行软件...');

  // Phase 1: 场景基础已构造
  loadingPhase = 0.05;
  setLoadingSub('正在加载 CZ-6A 箭体模型 (14MB) ...');
  await rocket.load((p) => {
    ui.setLoading(0.05 + p * 0.7, '正在加载 CZ-6A 箭体模型...');
  });
  loadingPhase = 0.76;

  setLoadingSub('装配喷管与分离机构...');
  buildEmitters();
  // 在发射后让火箭先显示待命（姿态已经正确）
  rocket.nodes.root.position.set(0, 0, 0);
  loadingPhase = 0.86;

  setLoadingSub('校准轨道预测模块...');
  // 预热 trajectory downrange 积分
  mission.reset();
  trajectory.update(0, 0);
  loadingPhase = 0.94;

  setLoadingSub('建立发射场气象与环境...');
  launchSite.update(0, 0.016);
  fx.update(0.016);
  loadingPhase = 1.0;
  ui.setLoading(1, '系统就绪，待发射指令');

  // 先隐藏一下，给个淡入
  setTimeout(() => ui.hideLoading(), 450);

  startLoop();
}
boot();

/* ---------- 主循环 ---------- */
function startLoop() {
  const clock = new THREE.Clock();
  let lastUiSync = 0;
  rocket.nodes.root.updateMatrixWorld(true);

  const tmpRocketPos = new THREE.Vector3();
  const tmpForward = new THREE.Vector3();

  function frame() {
    const dt = Math.min(0.05, clock.getDelta());

    // 1. 推进任务状态机（会更新火箭位姿、部件动画、特效强度）
    mission.tick(dt);

    rocket.nodes.root.updateMatrixWorld(true);

    // 2. 粒子 & 场景更新（必须在状态机之后）
    fx.update(dt);
    launchSite.update(mission.state.telemetry.alt, dt);

    // 3. 轨迹预测
    trajectory.update(mission.state.missionTime, mission.state.downrange);

    // 4. 相机
    rocket.getWorldPosition(tmpRocketPos);
    tmpForward.copy(rocket.getForwardWorld());
    sceneMgr.updateCamera(tmpRocketPos, tmpForward, dt);

    // 5. UI（每帧太频繁，每 60ms 同步一次）
    const now = performance.now();
    if (now - lastUiSync > 60) {
      ui.sync();
      lastUiSync = now;
    }

    // 6. 渲染
    sceneMgr.render();

    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // 窗口 resize 已在 SceneManager 中处理
  window.addEventListener('beforeunload', () => {
    camInput.dispose();
    sceneMgr.dispose();
  });
}

/* 导出调试接口（可选，F12 里 window.RSIM.xxx） */
declare global {
  interface Window {
    RSIM?: {
      rocket: RocketModel;
      sceneMgr: SceneManager;
      mission: MissionController;
      fx: ParticleFX;
      launchSite: LaunchSite;
      trajectory: TrajectoryLine;
      EVENTS: typeof FLIGHT_EVENTS;
    };
  }
}
window.RSIM = { rocket, sceneMgr, mission, fx, launchSite, trajectory, EVENTS: FLIGHT_EVENTS };
