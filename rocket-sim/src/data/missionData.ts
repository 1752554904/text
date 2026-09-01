/* =========================================================
   任务剖面假数据 · CZ-6A SSO Mission Profile
   所有数据均为工程合理范围的仿真数据，非真实涉密数据
   ========================================================= */

export type FlightPhaseId =
  | 'idle'
  | 'ignition'          // 1 点火
  | 'gravity_turn'      // 2 程序转弯
  | 'booster_meco'      // 3 助推关机
  | 'booster_sep'       // 4 助推分离
  | 'fairing_sep'       // 5 整流罩分离
  | 'stage1_meco'       // 6 一级关机
  | 'stage1_sep'        // 7 一级分离
  | 'stage2_ignition'   // 8 二级开机
  | 'stage2_meco'       // 9 二级关机
  | 'upper_ignition'    // 10 末级开机
  | 'upper_meco'        // 11 末级关机
  | 'satellite_deploy'; // 12 卫星展开

export interface FlightEvent {
  id: FlightPhaseId;
  index: number;
  name: string;      // 中文显示名
  en: string;        // 英文名
  tTime: number;     // T+ 触发时间（秒）
  duration: number;  // 事件动画持续（秒）
  phaseName: string; // 所属阶段中文名
}

export const FLIGHT_EVENTS: FlightEvent[] = [
  { id: 'ignition',         index: 1,  name: '点火',             en: 'LIFTOFF IGNITION',       tTime: 0.0,   duration: 3.0, phaseName: '发射段' },
  { id: 'gravity_turn',     index: 2,  name: '程序转弯',         en: 'GRAVITY TURN',           tTime: 12.0,  duration: 110.0, phaseName: '一级动力飞行' },
  { id: 'booster_meco',     index: 3,  name: '助推关机',         en: 'BOOSTER MECO',           tTime: 125.0, duration: 2.0, phaseName: '一级动力飞行' },
  { id: 'booster_sep',      index: 4,  name: '助推分离',         en: 'BOOSTER SEPARATION',     tTime: 128.0, duration: 6.0, phaseName: '一级动力飞行' },
  { id: 'fairing_sep',      index: 5,  name: '整流罩分离',       en: 'FAIRING JETTISON',       tTime: 260.0, duration: 5.0, phaseName: '一级动力飞行' },
  { id: 'stage1_meco',      index: 6,  name: '一级关机',         en: 'STAGE 1 MECO',           tTime: 350.0, duration: 2.0, phaseName: '一级动力飞行' },
  { id: 'stage1_sep',       index: 7,  name: '一级分离',         en: 'STAGE 1 SEPARATION',     tTime: 352.0, duration: 5.0, phaseName: '级间过渡' },
  { id: 'stage2_ignition',  index: 8,  name: '二级开机',         en: 'STAGE 2 IGNITION',       tTime: 358.0, duration: 3.0, phaseName: '二级动力飞行' },
  { id: 'stage2_meco',      index: 9,  name: '二级关机',         en: 'STAGE 2 SECO',           tTime: 750.0, duration: 2.0, phaseName: '二级动力飞行' },
  { id: 'upper_ignition',   index: 10, name: '末级开机',         en: 'UPPER STAGE IGNITION',   tTime: 1500.0,duration: 3.0, phaseName: '末级轨道插入' },
  { id: 'upper_meco',       index: 11, name: '末级关机',         en: 'UPPER STAGE SECO',       tTime: 1635.0,duration: 2.0, phaseName: '末级轨道插入' },
  { id: 'satellite_deploy', index: 12, name: '卫星展开',         en: 'SATELLITE DEPLOY',       tTime: 1740.0,duration: 20.0, phaseName: '载荷部署' },
];

/** 任务总时长（秒） */
export const MISSION_END_TIME = 1900;

/* ---------- 关键遥测数据插值锚点 ----------
   (时间T+, 高度m, 速度m/s, 俯仰度, 质量kg, G加速度, 推力百分比)
   在任意 T+ 时刻可线性/样条插值
------------------------------------------- */
export interface TelemetryKeyframe {
  t: number;        // 任务时间 s
  alt: number;      // 高度 m
  vel: number;      // 速度 m/s（沿飞行方向）
  pitch: number;    // 俯仰角（90°=垂直向上）
  mass: number;     // 质量 kg
  g: number;        // 轴向过载 G
  throttle: number; // 主级推力 0-100 %
  heading: number;  // 航向角（固定）
}

export const TELEMETRY_KEYFRAMES: TelemetryKeyframe[] = [
  { t: 0,      alt: 0,        vel: 0,       pitch: 90.0, mass: 530000, g: 0.0,  throttle: 0,   heading: 115 },
  { t: 2,      alt: 0,        vel: 0,       pitch: 90.0, mass: 530000, g: 1.15, throttle: 100, heading: 115 },
  { t: 8,      alt: 65,       vel: 78,      pitch: 90.0, mass: 526500, g: 1.4,  throttle: 100, heading: 115 },
  { t: 12,     alt: 210,      vel: 135,     pitch: 89.0, mass: 524200, g: 1.6,  throttle: 100, heading: 115 },
  { t: 60,     alt: 9200,     vel: 780,     pitch: 82.0, mass: 475000, g: 2.4,  throttle: 100, heading: 115 },
  { t: 90,     alt: 20500,    vel: 1180,    pitch: 72.0, mass: 440000, g: 2.8,  throttle: 100, heading: 115 },
  { t: 125,    alt: 52000,    vel: 1680,    pitch: 58.0, mass: 396000, g: 3.5,  throttle: 100, heading: 115 }, // 助推关机
  { t: 128,    alt: 56000,    vel: 1750,    pitch: 56.0, mass: 368000, g: 2.9,  throttle: 100, heading: 115 }, // 助推分离
  { t: 180,    alt: 88000,    vel: 2420,    pitch: 45.0, mass: 328000, g: 3.0,  throttle: 100, heading: 115 },
  { t: 260,    alt: 128000,   vel: 3420,    pitch: 32.0, mass: 272000, g: 3.4,  throttle: 100, heading: 115 }, // 整流罩分离
  { t: 300,    alt: 148000,   vel: 4180,    pitch: 27.0, mass: 242000, g: 3.6,  throttle: 100, heading: 115 },
  { t: 350,    alt: 175000,   vel: 5280,    pitch: 22.4, mass: 204000, g: 4.1,  throttle: 100, heading: 115 }, // 一级关机
  { t: 352,    alt: 178000,   vel: 5310,    pitch: 22.2, mass: 200000, g: 0.0,  throttle: 0,   heading: 115 }, // 一级分离
  { t: 358,    alt: 185000,   vel: 5350,    pitch: 21.8, mass: 128000, g: 1.2,  throttle: 100, heading: 115 }, // 二级开机
  { t: 450,    alt: 240000,   vel: 6050,    pitch: 17.5, mass: 112000, g: 1.6,  throttle: 100, heading: 115 },
  { t: 600,    alt: 330000,   vel: 7050,    pitch: 10.2, mass: 92000,  g: 2.1,  throttle: 100, heading: 115 },
  { t: 750,    alt: 420000,   vel: 7620,    pitch: 4.1,  mass: 75000,  g: 2.8,  throttle: 100, heading: 115 }, // 二级关机
  { t: 900,    alt: 460000,   vel: 7630,    pitch: 2.2,  mass: 75000,  g: 0.0,  throttle: 0,   heading: 115 }, // 滑行段
  { t: 1200,   alt: 500000,   vel: 7640,    pitch: 0.8,  mass: 75000,  g: 0.0,  throttle: 0,   heading: 115 },
  { t: 1500,   alt: 430000,   vel: 7650,    pitch: 0.2,  mass: 74500,  g: 0.8,  throttle: 100, heading: 115 }, // 末级开机
  { t: 1635,   alt: 500000,   vel: 7780,    pitch: 0.0,  mass: 70500,  g: 1.0,  throttle: 100, heading: 115 }, // 末级关机
  { t: 1740,   alt: 500000,   vel: 7780,    pitch: 0.0,  mass: 70500,  g: 0.0,  throttle: 0,   heading: 115 }, // 卫星展开
  { t: 1900,   alt: 500200,   vel: 7781,    pitch: 0.0,  mass: 6200,   g: 0.0,  throttle: 0,   heading: 115 }, // 任务结束
];

/* ---------- 各子级 / 部件配置 ---------- */
export interface StageConfig {
  /** 对应 GLB 内 Mesh/Group 的名称匹配关键词（按顺序匹配第一个命中）*/
  nodeKeywords: string[];
  /** 分离后退距离（米，沿 -Z 即下方/反方向）*/
  sepBackDistance: number;
  /** 分离侧向偏移（米）*/
  sepSideOffset: number;
  /** 分离后旋转速度度/秒 */
  sepRotSpeed: number;
  /** 喷口位置（相对于该部件的本地坐标下 Y 负方向多少米） */
  nozzleLocalOffsetY: number;
  /** 是否为需要 hinge 式打开的结构（整流罩半壳） */
  hingeAngle?: number;
  hingeAxis?: 'x' | 'y' | 'z';
}

export const STAGE_CONFIG: Record<string, StageConfig> = {
  boosterL: {
    nodeKeywords: ['booster_L', 'Booster_L', '助推_左', 'left_booster', '助推器左'],
    sepBackDistance: 3,
    sepSideOffset: -14,
    sepRotSpeed: 8,
    nozzleLocalOffsetY: 18,
  },
  boosterR: {
    nodeKeywords: ['booster_R', 'Booster_R', '助推_右', 'right_booster', '助推器右'],
    sepBackDistance: 3,
    sepSideOffset: 14,
    sepRotSpeed: -8,
    nozzleLocalOffsetY: 18,
  },
  stage1: {
    nodeKeywords: ['stage1', 'Stage1', '一级', 'core_stage', '芯一级'],
    sepBackDistance: 6,
    sepSideOffset: 0,
    sepRotSpeed: -2,
    nozzleLocalOffsetY: 26,
  },
  fairingL: {
    nodeKeywords: ['fairing_L', 'Fairing_L', '整流罩_左', 'fairing_half_L', '整流罩半边左'],
    sepBackDistance: 0,
    sepSideOffset: -3,
    sepRotSpeed: 0,
    nozzleLocalOffsetY: 0,
    hingeAngle: 90,
    hingeAxis: 'z',
  },
  fairingR: {
    nodeKeywords: ['fairing_R', 'Fairing_R', '整流罩_右', 'fairing_half_R', '整流罩半边右'],
    sepBackDistance: 0,
    sepSideOffset: 3,
    sepRotSpeed: 0,
    nozzleLocalOffsetY: 0,
    hingeAngle: 90,
    hingeAxis: 'z',
  },
  stage2: {
    nodeKeywords: ['stage2', 'Stage2', '二级'],
    sepBackDistance: 0,
    sepSideOffset: 0,
    sepRotSpeed: 0,
    nozzleLocalOffsetY: 8,
  },
  upperStage: {
    nodeKeywords: ['upper', 'Upper', '末级', 'third_stage', 'YF_50D', '上面级'],
    sepBackDistance: 0,
    sepSideOffset: 0,
    sepRotSpeed: 0,
    nozzleLocalOffsetY: 3,
  },
  satellite: {
    nodeKeywords: ['satellite', 'Satellite', '卫星', 'payload', '载荷'],
    sepBackDistance: 0,
    sepSideOffset: 0,
    sepRotSpeed: 0,
    nozzleLocalOffsetY: 0,
  },
  solarPanelL: {
    nodeKeywords: ['solar_L', 'Solar_L', '太阳翼左', 'panel_L', '太阳能板左'],
    sepBackDistance: 0,
    sepSideOffset: 0,
    sepRotSpeed: 0,
    nozzleLocalOffsetY: 0,
    hingeAngle: 180,
    hingeAxis: 'y',
  },
  solarPanelR: {
    nodeKeywords: ['solar_R', 'Solar_R', '太阳翼右', 'panel_R', '太阳能板右'],
    sepBackDistance: 0,
    sepSideOffset: 0,
    sepRotSpeed: 0,
    nozzleLocalOffsetY: 0,
    hingeAngle: 180,
    hingeAxis: 'y',
  },
};
