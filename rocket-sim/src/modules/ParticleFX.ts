/* =========================================================
   电影级粒子特效系统：
   1. 主发动机尾焰（cone + shader 粒子 + 加性混合 + 抖动）
   2. 发射台蒸汽/大烟雾（大而慢的 Billboard Sprite，Alpha）
   3. 分离冲击爆裂（爆炸火花 + 尘雾环）
   4. 高空尾迹（细长粒子 trail）
   ========================================================= */

import * as THREE from 'three';

export interface FlameEmitter {
  anchors: THREE.Object3D[];  // 喷口锚点（取 worldPos）
  direction: THREE.Vector3;   // 喷射方向（火箭下向，随锚点的本地 down）
  intensity: number;          // 0..1 强度
  lengthScale: number;        // 尾焰长度缩放
  style: 'atmospheric' | 'vacuum' | 'plasma'; // 大气/真空/等离子（末级）
}

export class ParticleFX {
  readonly scene: THREE.Scene;
  private _group = new THREE.Group();

  /** 引擎尾焰：每个 engine 一个独立的 Points，共享 shader 材质 */
  private _flameSystems: Array<{
    emitter: FlameEmitter;
    points: THREE.Points;
    geo: THREE.BufferGeometry;
    births: Float32Array;
    rands: Float32Array;
    seeds: Float32Array;
  }> = [];

  /** 发射台烟雾（大 Sprite） */
  private _smoke: Array<{
    sprite: THREE.Sprite;
    birth: number; life: number;
    vx: number; vy: number; vz: number;
    spin: number;
    size0: number; size1: number;
    opacity0: number;
  }> = [];
  private _smokeMax = 120;
  private _smokeMat!: THREE.SpriteMaterial;
  private _smokeTex!: THREE.Texture;

  /** 分离冲击效果池：复用 */
  private _shocks: Array<{
    sparks: THREE.Points;
    shockRing: THREE.Mesh;
    dust: THREE.Points;
    birth: number; life: number;
    pos: THREE.Vector3;
  }> = [];
  private _shockMax = 20;

  private _sparkTex!: THREE.Texture;

  /** 时间 s */
  t = 0;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    scene.add(this._group);
    this._smokeTex = this._makeCloudBillboard();
    this._sparkTex = this._makeSparkBillboard();
    this._smokeMat = new THREE.SpriteMaterial({
      map: this._smokeTex,
      transparent: true,
      opacity: 0.4,
      depthWrite: false,
      depthTest: true,
      color: 0x9bb0c9,
    });
  }

  /* =========================================================
     Engine flame
     ========================================================= */
  createFlameEmitter(cfg: FlameEmitter) {
    const MAX = 1500;
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(MAX * 3);
    const births = new Float32Array(MAX);
    const rands = new Float32Array(MAX);    // 每粒子随机种子（用于抖动和半径）
    const seeds = new Float32Array(MAX * 2); // 初始 (r, theta)
    births.fill(-1e6);
    for (let i = 0; i < MAX; i++) {
      rands[i] = Math.random();
      seeds[i * 2] = Math.random() * 0.7 + 0.3;
      seeds[i * 2 + 1] = Math.random() * Math.PI * 2;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('birth', new THREE.BufferAttribute(births, 1));
    geo.setAttribute('aRand', new THREE.BufferAttribute(rands, 1));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 2));

    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uLife: { value: 0.9 },
        uLength: { value: 28 },
        uWidth: { value: 2.0 },
        uIntensity: { value: 1.0 },
        uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
        uColorInner: { value: new THREE.Color(0xffffee) },
        uColorMid:   { value: new THREE.Color(0xffaa33) },
        uColorOuter: { value: new THREE.Color(0xff4400) },
        uStyle: { value: 0.0 }, // 0 大气, 1 真空, 2 等离子
      },
      vertexShader: /* glsl */`
        attribute float birth;
        attribute float aRand;
        attribute vec2 aSeed;
        uniform float uTime;
        uniform float uLife;
        uniform float uLength;
        uniform float uWidth;
        uniform float uPixelRatio;
        uniform float uStyle;
        varying float vAge;       // 0..1 归一化寿命
        varying float vRand;
        varying float vSeedR;

        void main() {
          float ageRaw = uTime - birth;
          float age = clamp(ageRaw / uLife, 0.0, 1.0);
          vAge = age;
          vRand = aRand;
          vSeedR = aSeed.x;
          // 未出生
          if (birth < -1e5) {
            gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
            gl_PointSize = 0.0;
            return;
          }
          // 粒子沿喷射方向 age*length 前进 (局部坐标：位置在发射时确定——我们在 JS 中把 position 更新为 anchorPos 一次，后面靠 age 推进)
          // 但为简化：我们让 JS 每帧把所有粒子 position 统一写回 anchorPos（同一起点），再在 shader 里偏移
          vec3 pos = position;
          // 半径膨胀：大气尾焰宽而发散，真空细而长
          float spread = mix(1.0, 0.25, uStyle);
          if (uStyle > 1.5) spread = 0.4; // 等离子中等
          float coneR = aSeed.x * (1.0 + age * 2.4 * spread);
          float ang = aSeed.y + age * 3.5 * (aRand - 0.5);
          vec3 radial = vec3(cos(ang), 0.0, sin(ang)) * coneR * uWidth;
          // 后向（-Y）推进
          float back = age * uLength * mix(1.0, 1.5, uStyle);
          pos += vec3(radial.x, -back, radial.z);

          // 湍流抖动（大气模式更剧烈）
          float turb = mix(2.5, 0.5, uStyle);
          float jitter = sin(uTime * 8.0 + float(gl_VertexID) * 0.37 + age * 20.0) * age * turb * (aRand - 0.5);
          pos.x += jitter;
          pos.z += jitter * 0.7;
          pos.y *= 1.0; // 保持轴向

          vec4 mv = modelViewMatrix * vec4(pos, 1.0);
          gl_Position = projectionMatrix * mv;
          float base = 26.0;
          if (uStyle > 0.5) base = 18.0; // 真空更细
          if (uStyle > 1.5) base = 30.0; // 等离子更亮更大
          float sz = base * (1.2 - age * 0.6) * uPixelRatio * (240.0 / max(1.0, -mv.z));
          gl_PointSize = sz;
        }
      `,
      fragmentShader: /* glsl */`
        uniform vec3 uColorInner;
        uniform vec3 uColorMid;
        uniform vec3 uColorOuter;
        uniform float uIntensity;
        uniform float uStyle;
        varying float vAge;
        varying float vRand;
        varying float vSeedR;

        void main() {
          vec2 d = gl_PointCoord - 0.5;
          float r = length(d) * 2.0;
          if (r > 1.0) discard;
          // 软圆
          float a = smoothstep(1.0, 0.0, r);
          // 核心更亮
          float core = smoothstep(0.35, 0.0, r);
          vec3 col = mix(uColorOuter, uColorMid, smoothstep(0.85, 0.25, r));
          col = mix(col, uColorInner, core);
          // 寿命前段淡入，尾段淡出
          float fade = smoothstep(0.0, 0.12, vAge) * (1.0 - smoothstep(0.5, 1.0, vAge));
          // 等离子尾焰加一点蓝紫色
          if (uStyle > 1.5) {
            col = mix(col, vec3(0.5, 0.35, 1.0), core * 0.6);
          } else if (uStyle > 0.5) {
            // 真空模式：钻石激波亮斑（Mach diamonds）
            float diamond = abs(sin(vAge * 20.0 + vSeedR * 10.0)) * smoothstep(0.2, 0.9, vAge);
            col += vec3(1.0, 0.9, 0.6) * diamond * 0.4;
          }
          float alpha = a * fade * uIntensity * (0.75 + 0.5 * (1.0 - vSeedR));
          gl_FragColor = vec4(col, alpha);
        }
      `,
    });

    const points = new THREE.Points(geo, mat);
    points.frustumCulled = false;
    this._group.add(points);
    this._flameSystems.push({ emitter: cfg, points, geo, births, rands, seeds });
  }

  /* =========================================================
     Pad smoke (launch billow)
     ========================================================= */
  spawnPadSmoke(position: THREE.Vector3, count: number, baseSize = 40) {
    for (let i = 0; i < count; i++) {
      if (this._smoke.length >= this._smokeMax) break;
      const m = new THREE.Sprite(this._smokeMat.clone());
      const sz0 = baseSize * (0.6 + Math.random() * 0.8);
      const sz1 = sz0 * (2.2 + Math.random() * 1.4);
      m.scale.setScalar(sz0);
      m.position.copy(position);
      m.position.x += (Math.random() - 0.5) * 18;
      m.position.z += (Math.random() - 0.5) * 18;
      m.position.y += Math.random() * 4;
      const opacity0 = 0.45 + Math.random() * 0.25;
      (m.material as THREE.SpriteMaterial).opacity = 0;
      this._group.add(m);
      this._smoke.push({
        sprite: m,
        birth: this.t,
        life: 8 + Math.random() * 6,
        vx: (Math.random() - 0.5) * 1.2,
        vy: 1.4 + Math.random() * 1.8,
        vz: (Math.random() - 0.5) * 1.2,
        spin: (Math.random() - 0.5) * 0.05,
        size0: sz0,
        size1: sz1,
        opacity0,
      });
    }
  }

  /* =========================================================
     Separation shock burst
     ========================================================= */
  spawnSeparationShock(pos: THREE.Vector3, strength: number = 1) {
    // 1) Sparks
    const SPARKS_N = 400;
    const sgeo = new THREE.BufferGeometry();
    const spos = new Float32Array(SPARKS_N * 3);
    const svel = new Float32Array(SPARKS_N * 3);
    const slife = new Float32Array(SPARKS_N);
    for (let i = 0; i < SPARKS_N; i++) {
      // 均匀球面速度（偏外）
      const u = Math.random() * 2 - 1;
      const t = Math.random() * Math.PI * 2;
      const s = Math.sqrt(1 - u * u);
      const speed = (60 + Math.random() * 160) * strength;
      svel[i * 3] = s * Math.cos(t) * speed;
      svel[i * 3 + 1] = u * speed;
      svel[i * 3 + 2] = s * Math.sin(t) * speed;
      spos[i * 3] = pos.x;
      spos[i * 3 + 1] = pos.y;
      spos[i * 3 + 2] = pos.z;
      slife[i] = 0.6 + Math.random() * 0.8;
    }
    sgeo.setAttribute('position', new THREE.BufferAttribute(spos, 3));
    sgeo.setAttribute('velocity', new THREE.BufferAttribute(svel, 3));
    sgeo.setAttribute('aLife', new THREE.BufferAttribute(slife, 1));
    const smat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: this.t },
        uBirth: { value: this.t },
        uTex: { value: this._sparkTex },
        uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
      },
      vertexShader: /* glsl */`
        attribute vec3 velocity;
        attribute float aLife;
        uniform float uTime;
        uniform float uBirth;
        uniform float uPixelRatio;
        varying float vAge;
        void main() {
          float t = uTime - uBirth;
          vAge = clamp(t / aLife, 0.0, 1.0);
          // p = p0 + v*t - 0.5*g*t^2 y
          vec3 p = position + velocity * t;
          p.y -= 4.9 * t * t * 0.3;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = (6.0 + (1.0 - vAge) * 10.0) * uPixelRatio * (200.0 / max(1.0, -mv.z));
        }
      `,
      fragmentShader: /* glsl */`
        uniform sampler2D uTex;
        varying float vAge;
        void main() {
          vec4 c = texture2D(uTex, gl_PointCoord);
          if (c.a < 0.02) discard;
          float a = c.a * (1.0 - vAge);
          vec3 col = mix(vec3(1.0, 0.95, 0.6), vec3(1.0, 0.35, 0.05), vAge);
          gl_FragColor = vec4(col, a);
        }
      `,
    });
    const sparks = new THREE.Points(sgeo, smat);
    sparks.frustumCulled = false;
    this._group.add(sparks);

    // 2) Shock ring (expand disk)
    const ringGeo = new THREE.RingGeometry(0.5, 1.0, 64);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xfff2c2,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.copy(pos);
    ring.rotation.x = -Math.PI / 2;
    ring.scale.setScalar(2 * strength);
    this._group.add(ring);

    // 3) Dust cloud (Points sprite-ish, 复用 shader 或用 sprites - 这里用 smoke sprites)
    const dustGeo = new THREE.BufferGeometry();
    const DN = 200;
    const dpos = new Float32Array(DN * 3);
    const dvel = new Float32Array(DN * 3);
    const drand = new Float32Array(DN);
    for (let i = 0; i < DN; i++) {
      const u = (Math.random() - 0.5);
      const t = Math.random() * Math.PI * 2;
      const speed = (20 + Math.random() * 30) * strength;
      // 水平扇出为主
      dvel[i * 3] = Math.cos(t) * speed;
      dvel[i * 3 + 1] = (1 + Math.random() * 2) * strength;
      dvel[i * 3 + 2] = Math.sin(t) * speed;
      dpos[i * 3] = pos.x + (Math.random() - 0.5) * 2;
      dpos[i * 3 + 1] = pos.y + (Math.random() - 0.5) * 2;
      dpos[i * 3 + 2] = pos.z + (Math.random() - 0.5) * 2;
      drand[i] = Math.random();
    }
    dustGeo.setAttribute('position', new THREE.BufferAttribute(dpos, 3));
    dustGeo.setAttribute('velocity', new THREE.BufferAttribute(dvel, 3));
    dustGeo.setAttribute('aRand', new THREE.BufferAttribute(drand, 1));
    const dustMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {
        uTime: { value: this.t }, uBirth: { value: this.t },
        uTex: { value: this._smokeTex },
        uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
      },
      vertexShader: /* glsl */`
        attribute vec3 velocity;
        attribute float aRand;
        uniform float uTime; uniform float uBirth;
        uniform float uPixelRatio;
        varying float vAge;
        void main() {
          float t = uTime - uBirth;
          float life = 3.5 + aRand * 2.0;
          vAge = clamp(t / life, 0.0, 1.0);
          vec3 p = position + velocity * t * mix(0.9, 0.4, vAge);
          p.y -= 0.3 * t * t * 0.1;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = (20.0 + vAge * 80.0) * uPixelRatio * (300.0 / max(1.0, -mv.z));
        }
      `,
      fragmentShader: /* glsl */`
        uniform sampler2D uTex;
        varying float vAge;
        void main() {
          vec4 c = texture2D(uTex, gl_PointCoord);
          if (c.a < 0.02) discard;
          float a = c.a * (0.65 * (1.0 - vAge) - 0.05);
          if (a <= 0.0) discard;
          vec3 col = mix(vec3(0.65,0.7,0.78), vec3(0.3,0.3,0.35), vAge);
          gl_FragColor = vec4(col, a);
        }
      `,
    });
    const dust = new THREE.Points(dustGeo, dustMat);
    dust.frustumCulled = false;
    this._group.add(dust);

    this._shocks.push({
      sparks, shockRing: ring, dust,
      birth: this.t,
      life: 4,
      pos: pos.clone(),
    });
  }

  /* =========================================================
     Update
     ========================================================= */
  update(dt: number) {
    this.t += dt;

    // ----- Flames -----
    for (const fs of this._flameSystems) {
      const mat = fs.points.material as THREE.ShaderMaterial;
      const MAX = fs.births.length;
      // 按 intensity 决定每帧发射数
      const styleNum =
        fs.emitter.style === 'atmospheric' ? 0 :
        fs.emitter.style === 'vacuum'      ? 1 : 2;
      const emitPerSec = (styleNum === 0 ? 900 : styleNum === 1 ? 600 : 700) * fs.emitter.intensity;
      const shouldEmit = emitPerSec * dt;
      let emitN = Math.floor(shouldEmit);
      const frac = shouldEmit - emitN;
      if (Math.random() < frac) emitN += 1;
      // 选一个喷口锚点（循环遍历）
      const anchors = fs.emitter.anchors.filter(a => a !== undefined);
      if (anchors.length === 0) continue;

      // 获取锚点的世界位置 & down 向量
      const anchorDowns = anchors.map(a => {
        const p = new THREE.Vector3();
        a.getWorldPosition(p);
        // 下方向 = 本地 (0,-1,0) 变换到世界
        const d = new THREE.Vector3(0, -1, 0).applyQuaternion(a.getWorldQuaternion(new THREE.Quaternion()));
        return { p, d };
      });

      // 把新发射的粒子的 position 设置为 anchor 世界坐标（Points 在 scene 下——世界坐标）
      // 由于 Points 挂在 _group 下，若 _group 无变换，和世界一致
      const positions = fs.geo.attributes.position as THREE.BufferAttribute;
      // 简单环形复用 cursor：我们用 Math.floor(t*emitPerSec) 作为全局递增序列
      let cursor = (Math.floor(this.t * 1e5) | 0) % MAX;
      for (let i = 0; i < emitN; i++) {
        const idx = cursor;
        cursor = (cursor + 1) % MAX;
        const src = anchorDowns[idx % anchorDowns.length];
        // 在喷口半径内抖动
        const right = new THREE.Vector3().crossVectors(src.d, new THREE.Vector3(0,1,0)).normalize();
        if (right.lengthSq() < 0.001) right.set(1,0,0);
        const fwd = new THREE.Vector3().crossVectors(right, src.d).normalize();
        const r = Math.random() * (styleNum === 0 ? 1.3 : styleNum === 1 ? 0.7 : 0.5);
        const ang = Math.random() * Math.PI * 2;
        const jitter = new THREE.Vector3()
          .addScaledVector(right, Math.cos(ang) * r)
          .addScaledVector(fwd, Math.sin(ang) * r);
        const pp = src.p.clone().add(jitter).addScaledVector(src.d, 0.2);
        positions.setXYZ(idx, pp.x, pp.y, pp.z);
        fs.births[idx] = this.t + Math.random() * 0.005;
      }
      positions.needsUpdate = true;
      (fs.geo.attributes.birth as THREE.BufferAttribute).needsUpdate = true;

      // uniforms
      mat.uniforms.uTime.value = this.t;
      mat.uniforms.uIntensity.value = fs.emitter.intensity;
      mat.uniforms.uStyle.value = styleNum;
      // 长度：大气 28m，真空 60m，等离子 40m
      const L = (styleNum === 0 ? 28 : styleNum === 1 ? 60 : 40) * fs.emitter.lengthScale;
      mat.uniforms.uLength.value = L;
      mat.uniforms.uWidth.value = fs.emitter.style === 'vacuum' ? 0.9 : fs.emitter.style === 'plasma' ? 1.2 : 2.0;
      mat.uniforms.uLife.value = fs.emitter.style === 'vacuum' ? 0.65 : fs.emitter.style === 'plasma' ? 0.6 : 0.9;
    }

    // ----- Smoke -----
    for (let i = this._smoke.length - 1; i >= 0; i--) {
      const s = this._smoke[i];
      const age = this.t - s.birth;
      if (age >= s.life) {
        this._group.remove(s.sprite);
        (s.sprite.material as THREE.Material).dispose();
        this._smoke.splice(i, 1);
        continue;
      }
      const k = age / s.life;
      s.sprite.position.x += s.vx * dt;
      s.sprite.position.y += s.vy * dt * (1 - k * 0.5);
      s.sprite.position.z += s.vz * dt;
      const sz = THREE.MathUtils.lerp(s.size0, s.size1, k);
      s.sprite.scale.setScalar(sz);
      const op = s.opacity0 * Math.sin(k * Math.PI);
      (s.sprite.material as THREE.SpriteMaterial).opacity = op;
      s.sprite.material.rotation += s.spin * dt;
    }

    // ----- Shocks -----
    for (let i = this._shocks.length - 1; i >= 0; i--) {
      const sh = this._shocks[i];
      const age = this.t - sh.birth;
      if (age >= sh.life) {
        this._group.remove(sh.sparks);
        this._group.remove(sh.shockRing);
        this._group.remove(sh.dust);
        (sh.sparks.geometry as THREE.BufferGeometry).dispose();
        (sh.sparks.material as THREE.Material).dispose();
        (sh.shockRing.geometry as THREE.BufferGeometry).dispose();
        (sh.shockRing.material as THREE.Material).dispose();
        (sh.dust.geometry as THREE.BufferGeometry).dispose();
        (sh.dust.material as THREE.Material).dispose();
        this._shocks.splice(i, 1);
        continue;
      }
      const k = age / sh.life;
      // Sparks
      const smat = sh.sparks.material as THREE.ShaderMaterial;
      smat.uniforms.uTime.value = this.t;
      // Ring
      const scale = THREE.MathUtils.lerp(2, 120, k);
      sh.shockRing.scale.setScalar(scale);
      const rmat = sh.shockRing.material as THREE.MeshBasicMaterial;
      rmat.opacity = (1 - k) * 0.7;
      rmat.color.setHSL(0.11, 0.8, THREE.MathUtils.lerp(0.95, 0.55, k));
      // Dust
      const dmat = sh.dust.material as THREE.ShaderMaterial;
      dmat.uniforms.uTime.value = this.t;
    }
  }

  /* ========= 内部纹理生成 ========= */
  private _makeCloudBillboard(): THREE.Texture {
    const SZ = 256;
    const c = document.createElement('canvas');
    c.width = c.height = SZ;
    const ctx = c.getContext('2d')!;
    const grd = ctx.createRadialGradient(SZ / 2, SZ / 2, 0, SZ / 2, SZ / 2, SZ / 2);
    grd.addColorStop(0, 'rgba(255,255,255,0.95)');
    grd.addColorStop(0.4, 'rgba(255,255,255,0.55)');
    grd.addColorStop(0.75, 'rgba(255,255,255,0.18)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, SZ, SZ);
    // 加一点噪点颗粒
    const img = ctx.getImageData(0, 0, SZ, SZ);
    for (let i = 0; i < img.data.length; i += 4) {
      const n = (Math.random() - 0.5) * 28;
      img.data[i] = Math.max(0, Math.min(255, img.data[i] + n));
      img.data[i + 1] = Math.max(0, Math.min(255, img.data[i + 1] + n));
      img.data[i + 2] = Math.max(0, Math.min(255, img.data[i + 2] + n));
    }
    ctx.putImageData(img, 0, 0);
    const t = new THREE.CanvasTexture(c);
    return t;
  }

  private _makeSparkBillboard(): THREE.Texture {
    const SZ = 64;
    const c = document.createElement('canvas');
    c.width = c.height = SZ;
    const ctx = c.getContext('2d')!;
    const grd = ctx.createRadialGradient(SZ / 2, SZ / 2, 0, SZ / 2, SZ / 2, SZ / 2);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.3, 'rgba(255,240,180,0.9)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, SZ, SZ);
    return new THREE.CanvasTexture(c);
  }
}
