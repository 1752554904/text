/* =========================================================
   飞行状态机 + 时间轴控制器：推进 T+ 时间、触发事件动画、
   维护下点距离(downrange)累计、计算火箭世界位姿
   ========================================================= */

import * as THREE from 'three';
import {
  FLIGHT_EVENTS,
  TELEMETRY_KEYFRAMES,
  MISSION_END_TIME,
  type FlightPhaseId,
  type FlightEvent,
  type TelemetryKeyframe,
} from '../data/missionData';
import { interpTelemetry, smoothstep, clamp } from '../utils/math';
import { RocketModel, type PartName } from '../modules/RocketModel';
import type { ParticleFX } from '../modules/ParticleFX';
import type { LaunchSite } from '../modules/LaunchSite';

export interface MissionState {
  /** T+ 时间（秒） */
  missionTime: number;
  /** 飞行速度倍率 */
  timeScale: number;
  /** 是否运行中（发射后=true，暂停后=false） */
  running: boolean;
  /** 已触发的事件 */
  firedEvents: Set<FlightPhaseId>;
  /** 当前活跃的阶段 id */
  activePhase: FlightPhaseId;
  /** 遥测插值结果 */
  telemetry: TelemetryKeyframe;
  /** 累计下点水平距离（米） */
  downrange: number;
  /** 事件进度（当前正在执行的事件动画 0..1 映射） */
  eventProgress: Map<FlightPhaseId, number>;
}

/** 相机模式由外部 SceneManager 管，这里只暴露数据 */
export class MissionController {
  readonly state: MissionState = {
    missionTime: 0,
    timeScale: 1,
    running: false,
    firedEvents: new Set(),
    activePhase: 'idle',
    telemetry: { ...TELEMETRY_KEYFRAMES[0] },
    downrange: 0,
    eventProgress: new Map(),
  };

  /** 事件回调（UI 用） */
  onPhaseEnter?: (ev: FlightEvent) => void;
  onStateChange?: () => void;

  /** 上次 tick 的 T+（用于 dt 积分水平位移） */
  private _lastT = 0;

  constructor(
    private rocket: RocketModel,
    private fx: ParticleFX,
    private launchSite: LaunchSite,
  ) {}

  /* ============ 外部控制 ============ */
  /** 开始发射（或从暂停恢复） */
  launchOrResume() {
    if (!this.state.running) {
      this.state.running = true;
      this._notify();
    }
  }
  pause() {
    this.state.running = false;
    this._notify();
  }
  setTimeScale(k: number) {
    this.state.timeScale = clamp(k, 0.1, 8);
    this._notify();
  }
  /** 全重置 */
  reset() {
    this.state.missionTime = 0;
    this.state.running = false;
    this.state.firedEvents.clear();
    this.state.activePhase = 'idle';
    this.state.telemetry = { ...TELEMETRY_KEYFRAMES[0] };
    this.state.downrange = 0;
    this.state.eventProgress.clear();
    this._lastT = 0;
    this.rocket.resetAll();
    // 发射台摆杆复位
    this.launchSite.setHoldArms(0);
    this._notify();
  }

  /* ============ 主循环 ============ */
  tick(realDt: number) {
    if (!this.state.running) {
      // 即便未运行，也要保持火箭当前位置（待命状态）
      this._applyRocketPose();
      return;
    }
    const dt = realDt * this.state.timeScale;
    this.state.missionTime = Math.min(MISSION_END_TIME, this.state.missionTime + dt);
    const t = this.state.missionTime;

    // 插值遥测
    this.state.telemetry = interpTelemetry(TELEMETRY_KEYFRAMES, t);

    // 累计 downrange：基于"水平速度"积分
    // 速度方向 = 沿飞行方向 * cos(pitch°) 为水平分量
    const pitchRad = (this.state.telemetry.pitch * Math.PI) / 180;
    const vHoriz = this.state.telemetry.vel * Math.cos(pitchRad);
    const prevT = this._lastT;
    const dtEffective = Math.max(0, t - prevT);
    this.state.downrange += vHoriz * dtEffective;
    this._lastT = t;

    // 检查所有事件
    for (const ev of FLIGHT_EVENTS) {
      const fired = this.state.firedEvents.has(ev.id);
      if (!fired && t >= ev.tTime) {
        this.state.firedEvents.add(ev.id);
        this.state.activePhase = ev.id;
        this.state.eventProgress.set(ev.id, 0);
        this.onPhaseEnter?.(ev);
      }
      // 动画进度 [0,1]
      if (fired) {
        const k = clamp((t - ev.tTime) / Math.max(0.001, ev.duration), 0, 1);
        this.state.eventProgress.set(ev.id, k);
      }
    }

    // ---- 把状态机映射到模型 + 特效 ----
    this._applyPartsSeparation();
    this._applyEffects(t);
    this._applyRocketPose();

    if (t >= MISSION_END_TIME) {
      this.state.running = false;
    }
    this._notify();
  }

  /** 获取按飞行事件归一化的"当前进度"（一个事件的进度在 duration 时间内到 1） */
  getProgressOf(id: FlightPhaseId): number {
    return this.state.eventProgress.get(id) ?? (this.state.firedEvents.has(id) ? 1 : 0);
  }

  /* ============ 内部 ============ */
  private _notify() {
    this.onStateChange?.();
  }

  /** 将当前遥测 → 火箭 root 的世界位置 & 俯仰 */
  private _applyRocketPose() {
    const tm = this.state.telemetry;
    const hdgRad = (tm.heading * Math.PI) / 180;
    // 水平位移分量
    const x = this.state.downrange * Math.sin(hdgRad);
    const z = this.state.downrange * Math.cos(hdgRad);
    const y = tm.alt;
    this.rocket.nodes.root.position.set(x, y, z);

    // 旋转：
    // 默认箭体指 +Y。Heading 是绕 Y 的偏航（之后 pitch 会倾斜），所以顺序为：
    // Heading 绕 Y 旋转，然后 pitch = 90°-targetPitch 绕新的本地 X 轴倾斜
    // （pitch=90° -> 垂直向上, 绕X不转；pitch越小 -> 越水平）
    const qHdg = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), hdgRad);
    const pitchTilt = THREE.MathUtils.degToRad(90 - tm.pitch);
    // 先把 X 轴旋转 heading：
    const localX = new THREE.Vector3(1, 0, 0).applyQuaternion(qHdg);
    const qPitch = new THREE.Quaternion().setFromAxisAngle(localX, pitchTilt);
    this.rocket.nodes.root.quaternion.copy(qHdg).multiply(qPitch);
  }

  /** 把事件进度映射到部件分离 / 展开动画 */
  private _applyPartsSeparation() {
    // 2 程序转弯不涉及部件变化
    // 3 助推关机：无动画（只关尾焰——由 _applyEffects 处理）
    // 4 助推分离：进度 → booster L/R sep
    const bsep = this.getProgressOf('booster_sep');
    this.rocket.setPartProgress('boosterL', bsep, 0);
    this.rocket.setPartProgress('boosterR', bsep, 0);

    // 5 整流罩：先 hinge 再 sep
    const fsep = this.getProgressOf('fairing_sep');
    const fh = smoothstep(0, 0.55, fsep);
    const fs = smoothstep(0.4, 1, fsep);
    this.rocket.setPartProgress('fairingL', fs, fh);
    this.rocket.setPartProgress('fairingR', fs, fh);

    // 6 一级关机：无部件动画
    // 7 一级分离
    const s1s = this.getProgressOf('stage1_sep');
    this.rocket.setPartProgress('stage1', s1s, 0);

    // 8 二级开机 / 9 关机：只影响特效
    // 10/11 末级：只影响特效
    // 12 卫星展开：卫星 + 太阳能板 hinge 展开
    const sd = this.getProgressOf('satellite_deploy');
    const satHinge = smoothstep(0, 0.4, sd);
    const satSep = smoothstep(0.35, 0.8, sd);
    this.rocket.setPartProgress('satellite', satSep * 0.05, 0);
    // 太阳能板 hinge
    const sp = smoothstep(0.25, 1, sd);
    this.rocket.setPartProgress('solarPanelL', 0, sp);
    this.rocket.setPartProgress('solarPanelR', 0, sp);
  }

  /** 把各阶段映射到特效强度 */
  private _lastBoosterShock = false;
  private _lastStage1Shock = false;
  private _lastFairingShock = false;
  private _lastSatelliteFlash = false;
  private _holdArmProgress = 0;
  private _liftoffSmokeEmitAcc = 0;

  private _applyEffects(t: number) {
    // ------- 各发动机强度 -------
    // 1. 助推：点火 → 助推关机 (T=0 到 booster_meco.tTime=125)，再慢慢 ramp 掉
    const boostK = this._engineIntensity(0, FLIGHT_EVENTS[2].tTime, t, 0.8, 2.5)
      * (this.state.firedEvents.has('ignition') ? 1 : 0);

    // 2. 主级（一级）：0 → stage1_meco=350
    const s1K = this._engineIntensity(0, FLIGHT_EVENTS[5].tTime, t, 0.8, 2.0)
      * (this.state.firedEvents.has('ignition') ? 1 : 0);

    // 3. 二级：stage2_ignition(358) → stage2_meco(750)
    const s2K = this._engineIntensity(
      FLIGHT_EVENTS[7].tTime, FLIGHT_EVENTS[8].tTime, t, 0.6, 1.5);

    // 4. 末级：upper_ignition(1500) → upper_meco(1635)
    const upK = this._engineIntensity(
      FLIGHT_EVENTS[9].tTime, FLIGHT_EVENTS[10].tTime, t, 0.8, 1.2);

    // 把强度写回各 emitter 的 intensity（外部创建 emitter 时已绑定 anchors）
    // 我们这里通过 ParticleFX 的 _flameSystems[i].emitter.intensity 直接写
    // 需要和外部顺序匹配：按 createFlameEmitter 调用顺序
    //   0: boosters atmospheric, 1: stage1 atmospheric, 2: stage2 vacuum, 3: upper plasma
    const fs = (this.fx as any)._flameSystems as any[];
    if (fs[0]) fs[0].emitter.intensity = boostK;
    if (fs[1]) fs[1].emitter.intensity = s1K;
    if (fs[2]) fs[2].emitter.intensity = s2K;
    if (fs[3]) fs[3].emitter.intensity = upK;

    // ------- 发射台摆杆：点火时(T>=0)3s 内收回 -------
    const armsTarget = t >= 0 && this.state.firedEvents.has('ignition')
      ? smoothstep(0, 3.0, t)
      : 0;
    this._holdArmProgress = THREE.MathUtils.lerp(this._holdArmProgress, armsTarget, 0.2);
    this.launchSite.setHoldArms(this._holdArmProgress);

    // ------- 点火瞬间的 Pad smoke 爆发（T=0 后几秒持续） -------
    if (this.state.firedEvents.has('ignition') && t < 8) {
      const emitRate = 55 * Math.max(s1K, boostK); // #/s
      this._liftoffSmokeEmitAcc += emitRate * (t - (this.state.missionTime - (t - this.state.missionTime) > 0 ? 0 : 0));
      // 用 tick 的增量来发射：我们在 fx.update 之前被调用，所以用一个本地 dt
      const dt = 1 / 60; // 估计
      void dt;
      // 直接基于已累计的时间 —— 用个小技巧：按 t 的单调
      const accKey = '_smokeTimer';
      if (!(this as any)[accKey]) (this as any)[accKey] = 0;
      (this as any)[accKey] += emitRate * 0.016;
      while ((this as any)[accKey] > 1) {
        (this as any)[accKey] -= 1;
        const anchor = this.rocket.nodes.mainNozzleAnchors[0] ?? this.rocket.nodes.root;
        const p = new THREE.Vector3();
        anchor.getWorldPosition(p);
        p.y -= 20;
        this.fx.spawnPadSmoke(p, 1, 40 + Math.random() * 30);
      }
    }

    // ------- 分离冲击触发 -------
    const bSep = this.getProgressOf('booster_sep');
    if (!this._lastBoosterShock && bSep > 0.05) {
      this._lastBoosterShock = true;
      this._spawnShocksAt(this.rocket.nodes.boosters, 1.2);
    }
    const s1Sep = this.getProgressOf('stage1_sep');
    if (!this._lastStage1Shock && s1Sep > 0.08) {
      this._lastStage1Shock = true;
      this._spawnShocksAt(this.rocket.nodes.stage1 ? [this.rocket.nodes.stage1] : [], 1.5);
    }
    const fSep = this.getProgressOf('fairing_sep');
    if (!this._lastFairingShock && fSep > 0.05) {
      this._lastFairingShock = true;
      this._spawnShocksAt(this.rocket.nodes.fairingHalves, 0.8);
    }
    const sD = this.getProgressOf('satellite_deploy');
    if (!this._lastSatelliteFlash && sD > 0.4) {
      this._lastSatelliteFlash = true;
      this._spawnShocksAt(this.rocket.nodes.satellite ? [this.rocket.nodes.satellite] : [], 0.5);
    }
  }

  private _spawnShocksAt(objs: THREE.Object3D[], strength: number) {
    for (const o of objs) {
      if (!o) continue;
      const p = new THREE.Vector3();
      o.getWorldPosition(p);
      this.fx.spawnSeparationShock(p, strength);
    }
  }

  private _engineIntensity(
    tStart: number, tEnd: number, t: number,
    rampIn: number, rampOut: number
  ): number {
    if (t < tStart) return 0;
    if (t > tEnd + rampOut) return 0;
    const rise = smoothstep(tStart, tStart + rampIn, t);
    const fall = t < tEnd ? 1 : 1 - smoothstep(tEnd, tEnd + rampOut, t);
    return clamp(rise * fall, 0, 1);
  }
}
