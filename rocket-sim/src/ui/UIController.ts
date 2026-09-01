/* =========================================================
   UI 控制器：绑定 DOM、驱动遥测面板 & 事件时间线
   ========================================================= */

import { FLIGHT_EVENTS, type FlightEvent, type FlightPhaseId } from '../data/missionData';
import type { MissionController } from '../core/MissionController';
import { formatTPlus, fmtInt, clamp } from '../utils/math';
import type { SceneManager } from '../core/SceneManager';

export interface UIControllerOptions {
  onLaunch: () => void;
  onPauseToggle: () => void;
  onReset: () => void;
  onSpeedChange: (k: number) => void;
  onViewChange: (view: 'follow' | 'orbital' | 'pad' | 'free') => void;
}

export class UIController {
  private els: Record<string, HTMLElement | null> = {};
  private _loadingShown = true;
  private _timelineItems: { id: FlightPhaseId; el: HTMLDivElement }[] = [];

  constructor(
    private mission: MissionController,
    private scene: SceneManager,
    private opts: UIControllerOptions,
  ) {
    const $ = (id: string) => document.getElementById(id);
    this.els = {
      loadingScreen: $('loading-screen'),
      loadingSub: $('loading-sub'),
      loadingBar: $('loading-bar'),
      loadingPercent: $('loading-percent'),

      btnLaunch: $('btn-launch'),
      btnPause: $('btn-pause'),
      btnReset: $('btn-reset'),

      timeline: $('flight-timeline'),
      timelineStatus: $('timeline-status'),
      timer: $('mission-timer'),

      phase: $('tm-phase'),
      altVal: $('tm-alt-val'),
      altBar: $('tm-alt-bar'),
      velVal: $('tm-vel-val'),
      velBar: $('tm-vel-bar'),
      gVal: $('tm-g-val'),
      gBar: $('tm-g-bar'),
      mass: $('tm-mass'),
      mach: $('tm-mach'),
      pitch: $('tm-pitch'),
      throttle: $('tm-throttle'),
      heading: $('tm-heading'),
      downrange: $('tm-downrange'),
    };

    this._buildFlightTimeline();
    this._bindTopBar();
  }

  /* ---------- Loading ---------- */
  setLoading(progress: number, sub: string) {
    const p = clamp(progress, 0, 1);
    const bar = this.els.loadingBar as HTMLDivElement | null;
    const percent = this.els.loadingPercent as HTMLDivElement | null;
    const subEl = this.els.loadingSub as HTMLDivElement | null;
    if (bar) bar.style.width = (p * 100).toFixed(1) + '%';
    if (percent) percent.textContent = Math.round(p * 100) + '%';
    if (subEl) subEl.textContent = sub;
  }
  hideLoading() {
    if (!this._loadingShown) return;
    this._loadingShown = false;
    const sc = this.els.loadingScreen;
    if (sc) sc.classList.add('hidden');
  }

  /* ---------- Top bar events ---------- */
  private _bindTopBar() {
    const bl = this.els.btnLaunch as HTMLButtonElement | null;
    const bp = this.els.btnPause as HTMLButtonElement | null;
    const br = this.els.btnReset as HTMLButtonElement | null;
    bl?.addEventListener('click', () => this.opts.onLaunch());
    bp?.addEventListener('click', () => this.opts.onPauseToggle());
    br?.addEventListener('click', () => this.opts.onReset());

    document.querySelectorAll<HTMLButtonElement>('.speed-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.speed-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const s = parseFloat(btn.dataset.speed || '1');
        this.opts.onSpeedChange(s);
      });
    });

    document.querySelectorAll<HTMLButtonElement>('.view-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const v = btn.dataset.view as any;
        this.opts.onViewChange(v);
      });
    });
  }

  private _buildFlightTimeline() {
    const tl = this.els.timeline;
    if (!tl) return;
    tl.innerHTML = '';
    for (const ev of FLIGHT_EVENTS) {
      const row = document.createElement('div');
      row.className = 'tl-item';
      row.dataset.id = ev.id;
      row.innerHTML = `
        <span class="tl-name">${ev.index}. ${ev.name} · ${ev.en}</span>
        <span class="tl-time">${formatTPlus(ev.tTime)}</span>
      `;
      tl.appendChild(row);
      this._timelineItems.push({ id: ev.id, el: row });
    }
  }

  /* ---------- 每帧同步 UI ---------- */
  sync() {
    const s = this.mission.state;
    const tm = s.telemetry;

    // 按钮态
    const btnLaunch = this.els.btnLaunch as HTMLButtonElement | null;
    const btnPause = this.els.btnPause as HTMLButtonElement | null;
    if (btnLaunch) {
      if (!s.firedEvents.has('ignition')) {
        btnLaunch.disabled = false;
        (btnLaunch.querySelector('.btn-label') as HTMLElement)!.textContent = '点火发射';
        (btnLaunch.querySelector('.btn-icon') as HTMLElement)!.textContent = '🔥';
      } else if (s.running) {
        btnLaunch.disabled = true;
      } else {
        // 发射后暂停，按钮改名为"继续"
        btnLaunch.disabled = false;
        (btnLaunch.querySelector('.btn-label') as HTMLElement)!.textContent = '继续任务';
        (btnLaunch.querySelector('.btn-icon') as HTMLElement)!.textContent = '▶';
      }
    }
    if (btnPause) {
      btnPause.disabled = !s.firedEvents.has('ignition');
      (btnPause.querySelector('.btn-label') as HTMLElement)!.textContent = s.running ? '暂停' : '继续';
    }

    // Timer
    if (this.els.timer) {
      this.els.timer.textContent = formatTPlus(s.missionTime);
    }

    // Phase
    if (this.els.phase) {
      const active = this._findActivePhase();
      this.els.phase.textContent = active ? active.phaseName : '待命';
    }

    // Altitude bar: 0-550 km
    const altKm = tm.alt / 1000;
    this._setVal(this.els.altVal, altKm.toFixed(1) + ' km');
    this._setBar(this.els.altBar, clamp(altKm / 550, 0, 1));

    // Velocity: 0-8200 m/s
    this._setVal(this.els.velVal, Math.round(tm.vel).toLocaleString() + ' m/s');
    this._setBar(this.els.velBar, clamp(tm.vel / 8200, 0, 1));

    // G: 0-5
    this._setVal(this.els.gVal, tm.g.toFixed(1) + ' G');
    this._setBar(this.els.gBar, clamp(tm.g / 5, 0, 1));

    // Grid
    this._setVal(this.els.mass, fmtInt(tm.mass) + ' kg');
    // Mach = vel / 343，但高空音速略低，这里近似
    const mach = tm.vel / 343;
    this._setVal(this.els.mach, mach.toFixed(2));
    this._setVal(this.els.pitch, tm.pitch.toFixed(1) + '°');
    this._setVal(this.els.throttle, Math.round(tm.throttle) + '%');
    this._setVal(this.els.heading, Math.round(tm.heading) + '°');
    this._setVal(this.els.downrange, (s.downrange / 1000).toFixed(1) + ' km');

    // Timeline active / done
    let activeCount = 0, doneCount = 0;
    for (const { id, el } of this._timelineItems) {
      const ev = FLIGHT_EVENTS.find(e => e.id === id)!;
      el.classList.remove('active', 'done');
      if (s.firedEvents.has(id)) {
        const progress = s.eventProgress.get(id) ?? 1;
        if (progress >= 1) { el.classList.add('done'); doneCount++; }
        else { el.classList.add('active'); activeCount++; }
      }
    }
    if (this.els.timelineStatus) {
      this.els.timelineStatus.textContent =
        `${doneCount + activeCount} / ${FLIGHT_EVENTS.length} ${activeCount ? '执行中' : (doneCount === FLIGHT_EVENTS.length ? '已完成' : '待执行')}`;
    }
  }

  private _findActivePhase(): FlightEvent | undefined {
    const s = this.mission.state;
    // 找"当前执行中"（进度 <1 且已 fired），否则回退到最近一个 fired 的事件
    let lastFired: FlightEvent | undefined;
    for (const ev of FLIGHT_EVENTS) {
      if (s.firedEvents.has(ev.id)) {
        const p = s.eventProgress.get(ev.id) ?? 1;
        if (p < 1) return ev;
        lastFired = ev;
      }
    }
    return lastFired;
  }

  private _setVal(el: HTMLElement | null, v: string) {
    if (el && el.textContent !== v) el.textContent = v;
  }
  private _setBar(el: HTMLElement | null, v: number) {
    if (el) el.style.width = (v * 100).toFixed(1) + '%';
  }
}
