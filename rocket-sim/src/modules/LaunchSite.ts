/* =========================================================
   发射场场景 · 地形（山区+平原）、发射塔、星空背景
   ========================================================= */

import * as THREE from 'three';

export class LaunchSite {
  readonly group = new THREE.Group();

  private _terrain!: THREE.Mesh;
  private _mountains!: THREE.Group;
  private _pad!: THREE.Group;
  private _stars!: THREE.Points;
  private _distantClouds!: THREE.Group;
  private _lightAmbient!: THREE.AmbientLight;
  private _lightSun!: THREE.DirectionalLight;
  private _lightHemi!: THREE.HemisphereLight;

  constructor(private scene: THREE.Scene) {
    scene.add(this.group);
    this._buildLights();
    this._buildTerrain();
    this._buildPad();
    this._buildMountains();
    this._buildClouds();
    this._buildStars();
  }

  /* ---------- 光照 ---------- */
  private _buildLights() {
    this._lightAmbient = new THREE.AmbientLight(0x6d8ab3, 0.55);
    this.group.add(this._lightAmbient);

    this._lightHemi = new THREE.HemisphereLight(0x88aaff, 0x2a3020, 0.45);
    this.group.add(this._lightHemi);

    this._lightSun = new THREE.DirectionalLight(0xfff1d6, 1.25);
    this._lightSun.position.set(-1500, 2200, -900);
    this._lightSun.castShadow = true;
    this._lightSun.shadow.mapSize.set(2048, 2048);
    this._lightSun.shadow.camera.left = -1200;
    this._lightSun.shadow.camera.right = 1200;
    this._lightSun.shadow.camera.top = 1200;
    this._lightSun.shadow.camera.bottom = -1200;
    this._lightSun.shadow.camera.near = 1;
    this._lightSun.shadow.camera.far = 6000;
    this._lightSun.shadow.bias = -0.0005;
    this.group.add(this._lightSun);

    // 太阳光晕（Sprite）
    const sunTex = this._makeGlowTexture(new THREE.Color(0xffcc66), 0.9);
    const sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: sunTex,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }));
    sunSprite.position.copy(this._lightSun.position).multiplyScalar(1.1);
    sunSprite.scale.setScalar(1200);
    this.group.add(sunSprite);
  }

  /* ---------- 平原地形 + 远山 ---------- */
  private _buildTerrain() {
    const size = 8000, seg = 220;
    const geo = new THREE.PlaneGeometry(size, size, seg, seg);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    // 伪随机地形（中心附近平，四周隆起）
    const rnd = mulberry32(20250901);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const d = Math.sqrt(x * x + z * z);
      // 发射场中央 600m 半径完全平坦
      let y = 0;
      if (d > 550) {
        const plateauFalloff = smoothstep(550, 1400, d);
        // 多层 fbm 噪声
        const n =
          fbm(x * 0.0015, z * 0.0015, 4, rnd) * 260 +
          fbm(x * 0.006, z * 0.006, 3, rnd) * 70;
        y = n * plateauFalloff;
      }
      pos.setY(i, y);
    }
    geo.computeVertexNormals();

    // 顶点颜色（草地+土黄+岩石灰）
    const color = new THREE.Color();
    const colors = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const d = Math.sqrt(x * x + z * z);
      if (d < 520) {
        color.setHSL(0.08, 0.15, 0.28); // 发射场深灰土
      } else if (y < 40) {
        color.setHSL(0.22, 0.25, 0.22); // 低草
      } else if (y < 140) {
        color.setHSL(0.1, 0.15, 0.35);  // 土黄
      } else if (y < 220) {
        color.setHSL(0.07, 0.08, 0.45); // 岩石
      } else {
        color.setHSL(0.58, 0.05, 0.85); // 雪山
      }
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const mat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.95,
      metalness: 0.0,
      flatShading: false,
    });
    this._terrain = new THREE.Mesh(geo, mat);
    this._terrain.receiveShadow = true;
    this.group.add(this._terrain);
  }

  /* ---------- 装饰性远山剪影 ---------- */
  private _buildMountains() {
    this._mountains = new THREE.Group();
    const rnd = mulberry32(777);
    for (let i = 0; i < 18; i++) {
      const geo = new THREE.ConeGeometry(
        220 + rnd() * 520,
        380 + rnd() * 700,
        5 + Math.floor(rnd() * 3)
      );
      const mat = new THREE.MeshStandardMaterial({
        color: new THREE.Color().setHSL(0.07 + rnd() * 0.08, 0.1, 0.18 + rnd() * 0.1),
        roughness: 1,
        metalness: 0,
        flatShading: true,
      });
      const m = new THREE.Mesh(geo, mat);
      const ang = (i / 18) * Math.PI * 2 + rnd() * 0.2;
      const dist = 3800 + rnd() * 1800;
      m.position.set(Math.cos(ang) * dist, 20 + rnd() * 60, Math.sin(ang) * dist);
      m.rotation.y = rnd() * Math.PI;
      m.castShadow = false;
      m.receiveShadow = false;
      this._mountains.add(m);
    }
    this.group.add(this._mountains);
  }

  /* ---------- 发射台/勤务塔 ---------- */
  private _buildPad() {
    this._pad = new THREE.Group();

    // 混凝土发射基座（圆形阶梯）
    for (let i = 0; i < 3; i++) {
      const r = 48 - i * 8;
      const geo = new THREE.CylinderGeometry(r, r, 3, 48);
      const mat = new THREE.MeshStandardMaterial({
        color: new THREE.Color().setHSL(0.08, 0.05, 0.35 - i * 0.04),
        roughness: 0.9,
      });
      const m = new THREE.Mesh(geo, mat);
      m.position.y = 1.5 + i * 3;
      m.receiveShadow = true;
      m.castShadow = true;
      this._pad.add(m);
    }

    // 发射中心火焰导流槽（黑色方坑）
    const flameGeo = new THREE.BoxGeometry(24, 2, 24);
    const flameMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 1 });
    const flame = new THREE.Mesh(flameGeo, flameMat);
    flame.position.y = 0.6;
    flame.receiveShadow = true;
    this._pad.add(flame);

    // 四根勤务塔立柱
    const towerPositions = [
      [ 28,  28], [-28,  28], [ 28, -28], [-28, -28],
    ];
    for (const [tx, tz] of towerPositions) {
      const tower = this._makeServiceTower();
      tower.position.set(tx, 0, tz);
      this._pad.add(tower);
    }

    // 中心 4 个摆杆（准备起飞前旋转离开的支架）
    for (let i = 0; i < 4; i++) {
      const armGeo = new THREE.BoxGeometry(1.2, 1.2, 12);
      const armMat = new THREE.MeshStandardMaterial({
        color: 0xffaa33, roughness: 0.55, metalness: 0.5,
      });
      const arm = new THREE.Mesh(armGeo, armMat);
      arm.castShadow = true;
      const ang = (i / 4) * Math.PI * 2;
      const grp = new THREE.Group();
      grp.position.set(
        Math.cos(ang) * 10,
        15 + i * 6,
        Math.sin(ang) * 10
      );
      grp.rotation.y = ang + Math.PI / 2;
      arm.position.z = 6; // 末端指向火箭
      grp.add(arm);
      grp.name = `holdArm_${i}`;
      this._pad.add(grp);
    }

    this.group.add(this._pad);
  }

  private _makeServiceTower(): THREE.Group {
    const g = new THREE.Group();
    const mastGeo = new THREE.BoxGeometry(2.4, 160, 2.4);
    const mastMat = new THREE.MeshStandardMaterial({
      color: 0xcfd8e4,
      roughness: 0.5,
      metalness: 0.65,
    });
    const mast = new THREE.Mesh(mastGeo, mastMat);
    mast.position.y = 80;
    mast.castShadow = true;
    mast.receiveShadow = true;
    g.add(mast);

    // 横梁
    for (let i = 0; i < 8; i++) {
      const beamGeo = new THREE.BoxGeometry(10, 0.6, 0.6);
      const beamMat = mastMat.clone();
      const b1 = new THREE.Mesh(beamGeo, beamMat);
      b1.position.set(0, 15 + i * 18, 0);
      b1.castShadow = true;
      g.add(b1);
    }

    // 红灯（顶层警示灯 Sprite）
    const redGlow = this._makeGlowTexture(new THREE.Color(0xff3030), 1);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: redGlow,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }));
    sprite.position.set(0, 162, 0);
    sprite.scale.setScalar(7);
    g.add(sprite);

    return g;
  }

  /* ---------- 低空云层（半透明 Sprite 层） ---------- */
  private _buildClouds() {
    this._distantClouds = new THREE.Group();
    const cloudTex = this._makeCloudTexture();
    const rnd = mulberry32(42);
    for (let i = 0; i < 28; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({
        map: cloudTex,
        transparent: true,
        opacity: 0.45 + rnd() * 0.25,
        depthWrite: false,
        color: new THREE.Color().setHSL(0.58, 0.1, 0.82 + rnd() * 0.1),
      }));
      const ang = rnd() * Math.PI * 2;
      const r = 800 + rnd() * 3500;
      s.position.set(
        Math.cos(ang) * r,
        260 + rnd() * 400,
        Math.sin(ang) * r
      );
      s.scale.setScalar(400 + rnd() * 400);
      this._distantClouds.add(s);
    }
    this.group.add(this._distantClouds);
  }

  /* ---------- 星空 ---------- */
  private _buildStars() {
    const N = 6000;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(N * 3);
    const col = new Float32Array(N * 3);
    const size = new Float32Array(N);
    const rnd = mulberry32(999);
    const c = new THREE.Color();
    for (let i = 0; i < N; i++) {
      // 均匀球面分布（半径大，随火箭升高也看不到边界）
      const u = rnd() * 2 - 1;
      const t = rnd() * Math.PI * 2;
      const r = 80000;
      const s = Math.sqrt(1 - u * u);
      pos[i * 3] = r * s * Math.cos(t);
      pos[i * 3 + 1] = r * u;
      pos[i * 3 + 2] = r * s * Math.sin(t);
      const temp = rnd();
      if (temp < 0.25) c.setRGB(1, 0.8, 0.6);    // 橙
      else if (temp < 0.55) c.setRGB(1, 1, 1);    // 白
      else if (temp < 0.85) c.setRGB(0.85, 0.92, 1); // 白蓝
      else c.setRGB(0.7, 0.75, 1);                 // 蓝
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
      size[i] = 0.5 + rnd() * 2.2;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));

    const starTex = this._makeStarTexture();
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uTex: { value: starTex },
        uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
        uFade: { value: 1.0 }, // 1=太空可见, 0=低空被大气隐藏
      },
      vertexShader: /* glsl */`
        attribute float aSize;
        varying vec3 vColor;
        uniform float uPixelRatio;
        void main() {
          vColor = color;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = aSize * uPixelRatio * (300.0 / -mv.z);
        }
      `,
      fragmentShader: /* glsl */`
        uniform sampler2D uTex;
        uniform float uFade;
        varying vec3 vColor;
        void main() {
          vec4 t = texture2D(uTex, gl_PointCoord);
          if (t.a < 0.02) discard;
          gl_FragColor = vec4(vColor, t.a * uFade);
        }
      `,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this._stars = new THREE.Points(geo, mat);
    // 星空跟随相机，避免飞过
    this._stars.frustumCulled = false;
    this.scene.add(this._stars);
  }

  /** 每帧更新（星星淡入淡出等） */
  update(rocketAltMeters: number, dt: number) {
    const fade = THREE.MathUtils.smoothstep(rocketAltMeters, 12000, 90000);
    const mat = this._stars.material as THREE.ShaderMaterial;
    mat.uniforms.uFade.value = THREE.MathUtils.lerp(mat.uniforms.uFade.value, fade, 1 - Math.pow(0.0001, dt));

    // 云层缓慢飘移
    if (this._distantClouds) {
      this._distantClouds.rotation.y += dt * 0.0015;
    }
  }

  /** 摆杆动画（点火瞬间移开，0..1：0=锁定，1=移开） */
  setHoldArms(retracted: number) {
    this._pad.children.forEach(c => {
      if (c.name.startsWith('holdArm_')) {
        c.rotation.z = THREE.MathUtils.lerp(0, -Math.PI * 0.7, retracted);
      }
    });
  }

  /* ---------- Procedural 纹理生成 ---------- */
  private _texCache = new Map<string, THREE.Texture>();

  private _makeGlowTexture(color: THREE.Color, strength: number): THREE.Texture {
    const key = 'glow_' + color.getHexString() + '_' + strength.toFixed(2);
    if (this._texCache.has(key)) return this._texCache.get(key)!;
    const s = 128;
    const c = document.createElement('canvas');
    c.width = c.height = s;
    const ctx = c.getContext('2d')!;
    const grd = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    grd.addColorStop(0, `rgba(${Math.round(color.r * 255)},${Math.round(color.g * 255)},${Math.round(color.b * 255)},${strength})`);
    grd.addColorStop(0.35, `rgba(${Math.round(color.r * 255)},${Math.round(color.g * 255)},${Math.round(color.b * 255)},${strength * 0.4})`);
    grd.addColorStop(1, `rgba(${Math.round(color.r * 255)},${Math.round(color.g * 255)},${Math.round(color.b * 255)},0)`);
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, s, s);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    this._texCache.set(key, tex);
    return tex;
  }

  private _makeStarTexture(): THREE.Texture {
    const key = 'star';
    if (this._texCache.has(key)) return this._texCache.get(key)!;
    const s = 64;
    const c = document.createElement('canvas');
    c.width = c.height = s;
    const ctx = c.getContext('2d')!;
    const grd = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.35, 'rgba(255,255,255,0.7)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, s, s);
    const tex = new THREE.CanvasTexture(c);
    this._texCache.set(key, tex);
    return tex;
  }

  private _makeCloudTexture(): THREE.Texture {
    const key = 'cloud';
    if (this._texCache.has(key)) return this._texCache.get(key)!;
    const s = 256;
    const c = document.createElement('canvas');
    c.width = c.height = s;
    const ctx = c.getContext('2d')!;
    // 多个软圆形叠加
    const rnd = mulberry32(123);
    for (let i = 0; i < 14; i++) {
      const x = rnd() * s;
      const y = rnd() * s;
      const r = 20 + rnd() * 70;
      const grd = ctx.createRadialGradient(x, y, 0, x, y, r);
      grd.addColorStop(0, 'rgba(255,255,255,0.9)');
      grd.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, s, s);
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    this._texCache.set(key, tex);
    return tex;
  }
}

/* ---------- 噪声工具 ---------- */
function mulberry32(a: number) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = a;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function smoothstep(e0: number, e1: number, x: number) {
  const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}
/** 2D value noise + fbm */
function valueNoise(x: number, y: number, rnd: () => number): number {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  function hash(ix: number, iy: number) {
    // 确定性哈希：把 ix,iy 转成 seed 再 mulberry
    const s = Math.imul(ix | 0, 374761393) ^ Math.imul(iy | 0, 668265263);
    const r = mulberry32(s);
    // 预热一次
    r(); return r();
  }
  const a = hash(xi, yi);
  const b = hash(xi + 1, yi);
  const c = hash(xi, yi + 1);
  const d = hash(xi + 1, yi + 1);
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const ab = a + (b - a) * u;
  const cd = c + (d - c) * u;
  return ab + (cd - ab) * v;
  void rnd;
}
function fbm(x: number, y: number, oct: number, rnd: () => number): number {
  let sum = 0, amp = 1, freq = 1, norm = 0;
  for (let i = 0; i < oct; i++) {
    sum += valueNoise(x * freq, y * freq, rnd) * amp;
    norm += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return sum / norm * 2 - 1;
}
