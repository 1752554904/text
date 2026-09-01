/* =========================================================
   工具函数集
   ========================================================= */

import type { TelemetryKeyframe } from '../data/missionData';

/** 线性插值 */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** 平滑缓动 0-1 */
export function smoothstep(e0: number, e1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

/** 夹紧到 [a,b] */
export function clamp(v: number, a: number, b: number): number {
  return Math.max(a, Math.min(b, v));
}

/** 在关键帧数组中取给定时间点的插值结果 */
export function interpTelemetry(
  keys: TelemetryKeyframe[],
  t: number
): TelemetryKeyframe {
  if (keys.length === 0) throw new Error('keys empty');
  if (t <= keys[0].t) return { ...keys[0] };
  if (t >= keys[keys.length - 1].t) return { ...keys[keys.length - 1] };
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i];
    const b = keys[i + 1];
    if (t >= a.t && t <= b.t) {
      const k = (t - a.t) / (b.t - a.t);
      return {
        t,
        alt: lerp(a.alt, b.alt, k),
        vel: lerp(a.vel, b.vel, k),
        pitch: lerp(a.pitch, b.pitch, k),
        mass: lerp(a.mass, b.mass, k),
        g: lerp(a.g, b.g, k),
        throttle: lerp(a.throttle, b.throttle, k),
        heading: lerp(a.heading, b.heading, k),
      };
    }
  }
  return { ...keys[keys.length - 1] };
}

/**
 * 把 pitch+heading+alt 转换为相对发射点的世界坐标
 * (发射点在世界原点，Y=向上，X=东，Z=北)
 * pitch = 90° -> 沿 +Y 上升；pitch=0° -> 水平
 * heading = 0° -> 指向 +X(东)，90° -> +Z(北)，115° -> 东偏北
 * 同时将 "下点(水平投影距离)" 一并返回
 */
export function computeFlightPosition(
  tm: TelemetryKeyframe,
  prev: { downrange: number }
): {
  position: { x: number; y: number; z: number };
  downrange: number;
} {
  // 1) 用当前速度 * 上一帧 dt 近似计算 downrange 增量（调用方要累加）
  // 这里我们根据时间重算：按 T+ 时间计算累计速度曲线下面积 ——
  // 为简化，我们把 altitude 作为 Y，用 pitch 把水平方向分量反推出距离
  const pitchRad = (tm.pitch * Math.PI) / 180;
  const hdgRad = (tm.heading * Math.PI) / 180;

  const y = tm.alt; // 高度就是 Y
  // 水平距离：通过 downrange 调用方维护
  const dr = prev.downrange;
  const x = dr * Math.sin(hdgRad);
  const z = dr * Math.cos(hdgRad);
  // pitch 在这里主要决定箭体朝向，而不是位移 —— 位移我们由 downrange 累计更合理
  void pitchRad;
  return { position: { x, y, z }, downrange: dr };
}

/** 将 T+ 秒格式化为 "mm:ss.d" */
export function formatTPlus(sec: number): string {
  if (sec < 0) {
    const s = Math.abs(sec);
    const m = Math.floor(s / 60);
    const rs = (s - m * 60).toFixed(1);
    return `T-${String(m).padStart(2, '0')}:${rs.padStart(4, '0')}`;
  }
  const m = Math.floor(sec / 60);
  const s = (sec - m * 60).toFixed(1);
  return `T+${String(m).padStart(2, '0')}:${s.padStart(4, '0')}`;
}

/** 数字格式化加千分位 */
export function fmtInt(n: number): string {
  return Math.round(n).toLocaleString('en-US');
}
