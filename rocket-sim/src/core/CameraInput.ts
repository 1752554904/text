/* =========================================================
   视角输入控制器：鼠标拖拽旋转、滚轮缩放、右键平移
   (对应 SceneManager 的 free 球坐标参数)
   ========================================================= */

import * as THREE from 'three';
import type { SceneManager } from '../core/SceneManager';

export class CameraInput {
  private _canvas: HTMLCanvasElement;
  private _isDown = false;
  private _downBtn = 0;
  private _lastX = 0;
  private _lastY = 0;

  /** 拖拽灵敏度（1 rad / 像素） */
  rotateSens = 0.005;
  panSens = 1.2;
  zoomSens = 0.0012;

  constructor(private scene: SceneManager) {
    const c = scene.renderer.domElement;
    this._canvas = c;
    c.addEventListener('pointerdown', this._onDown);
    window.addEventListener('pointermove', this._onMove);
    window.addEventListener('pointerup', this._onUp);
    c.addEventListener('wheel', this._onWheel, { passive: false });
    c.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  dispose() {
    const c = this._canvas;
    c.removeEventListener('pointerdown', this._onDown);
    window.removeEventListener('pointermove', this._onMove);
    window.removeEventListener('pointerup', this._onUp);
    c.removeEventListener('wheel', this._onWheel);
  }

  private _onDown = (e: PointerEvent) => {
    this._isDown = true;
    this._downBtn = e.button;
    this._lastX = e.clientX;
    this._lastY = e.clientY;
    (e.target as Element).setPointerCapture?.(e.pointerId);
  };
  private _onUp = (e: PointerEvent) => {
    this._isDown = false;
    void e;
  };
  private _onMove = (e: PointerEvent) => {
    if (!this._isDown) return;
    const dx = e.clientX - this._lastX;
    const dy = e.clientY - this._lastY;
    this._lastX = e.clientX;
    this._lastY = e.clientY;

    if (this._downBtn === 0) {
      // 左键：旋转（yaw + pitch）
      this.scene.freeYaw += dx * this.rotateSens;
      this.scene.freePitch = THREE.MathUtils.clamp(
        this.scene.freePitch - dy * this.rotateSens,
        -Math.PI / 2 + 0.02,
        Math.PI / 2 - 0.02
      );
    } else if (this._downBtn === 2) {
      // 右键：平移 freeTarget（基于相机右/上向量）
      const cam = this.scene.camera;
      const right = new THREE.Vector3();
      const up = new THREE.Vector3();
      cam.getWorldDirection(right);
      right.cross(cam.up).normalize();
      up.copy(cam.up);
      const dpan = new THREE.Vector3()
        .addScaledVector(right, -dx * this.panSens * 0.1 * (this.scene.freeDist / 200))
        .addScaledVector(up, dy * this.panSens * 0.1 * (this.scene.freeDist / 200));
      this.scene.freePanOffset.add(dpan);
    } else if (this._downBtn === 1) {
      // 中键：前后推拉距离
      this.scene.freeDist = THREE.MathUtils.clamp(
        this.scene.freeDist + dy * 0.6,
        5,
        500000,
      );
    }
  };
  private _onWheel = (e: WheelEvent) => {
    e.preventDefault();
    const factor = Math.exp(e.deltaY * this.zoomSens);
    this.scene.freeDist = THREE.MathUtils.clamp(
      this.scene.freeDist * factor,
      5,
      500000,
    );
  };
}
