/* =========================================================
   发射场场景 · 环境资源**直接引自 tellux.cyanfish.site **
     - shape-C0zrEmxc.bin   (2048×1024 uint8 地球高度图) → 地形高度
     - shape_detail-Tuf-gW3D.bin                            → 高频地形细节
     - stbn-CqLOkRpq.bin    (1024×1024 uint8 大气散射)   → terrain fog tint
     - stars-kM9bgGHh.bin   (stride=10, 9096 stars)        → 真实星点
     - local_weather-DSzanC6h.png                           → 云层底图/地物色调参考
     - turbulence-DqexPSLa.png                              → 云层湍流扰动
   ========================================================= */

import * as THREE from 'three';

const BASE = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.BASE_URL
  ? (import.meta.env.BASE_URL || '/').replace(/\/+$/, '')
  : '') + '/tellux-assets';

export class LaunchSite {
  readonly group = new THREE.Group();

  private _terrain!: THREE.Mesh;
  private _terrainGeo!: THREE.PlaneGeometry;
  private _mountains!: THREE.Group;
  private _pad!: THREE.Group;
  private _stars!: THREE.Points;
  private _distantClouds!: THREE.Group;
  private _lightAmbient!: THREE.AmbientLight;
  private _lightSun!: THREE.DirectionalLight;
  private _lightHemi!: THREE.HemisphereLight;

  /** tellux 原资源纹理缓存（异步加载完成后再应用到地形/星空/云层） */
  private _loaded = false;
  private _loadPromise?: Promise<void>;
  private _shapeTex?: THREE.DataTexture;   // 2048x1024 LUMINANCE 高度
  private _detailTex?: THREE.DataTexture;  // 256x128 LUMINANCE
  private _stbnTex?: THREE.DataTexture;    // 1024x1024 RGB
  private _weatherTex?: THREE.Texture;     // local_weather PNG
  private _turbTex?: THREE.Texture;        // turbulence PNG

  constructor(private scene: THREE.Scene) {
    scene.add(this.group);
    this._buildLights();
    this._buildTerrain();      // 先按 fallback fbm 建地形，贴图到了再替换
    this._buildPad();
    this._buildMountains();
    this._buildClouds();       // 先用程序化云贴图
    this._buildStars();        // 先用程序化星星，bin 解析完再替换

    // 异步加载 tellux 资源：本地 public/tellux-assets 优先，vite proxy 兜底直连 tellux 站
    this._loadPromise = this._loadTelluxAssets();
    this._loadPromise.then(() => { this._loaded = true; }).catch((e) => {
      console.warn('[LaunchSite] tellux 资源加载失败，保留 fallback 渲染：', e);
    });
  }

  /** 所有加载完成的 Promise（供 main/上层 await） */
  ready() { return this._loadPromise ?? Promise.resolve(); }

  /* ============================================================
     1. 光照 — 接近 tellux 冷蓝阳光 + 深蓝大气 hemi
     ============================================================ */
  private _buildLights() {
    // tellux 的大气冷蓝色环境光
    this._lightAmbient = new THREE.AmbientLight(0x6a88b8, 0.6);
    this.group.add(this._lightAmbient);

    // tellux 的 hemi：天空深蓝 ↔ 地平线褐土
    this._lightHemi = new THREE.HemisphereLight(0x8fb5ff, 0x3a2f22, 0.55);
    this.group.add(this._lightHemi);

    // tellux 的太阳方向光：偏暖白，高度角 ~45°
    this._lightSun = new THREE.DirectionalLight(0xffe7c8, 1.15);
    this._lightSun.position.set(-2400, 2600, -1400);
    this._lightSun.castShadow = true;
    this._lightSun.shadow.mapSize.set(2048, 2048);
    this._lightSun.shadow.camera.left = -1600;
    this._lightSun.shadow.camera.right = 1600;
    this._lightSun.shadow.camera.top = 1600;
    this._lightSun.shadow.camera.bottom = -1600;
    this._lightSun.shadow.camera.near = 1;
    this._lightSun.shadow.camera.far = 8000;
    this._lightSun.shadow.bias = -0.0005;
    this.group.add(this._lightSun);

    // 太阳光晕
    const sunTex = this._makeGlowTexture(new THREE.Color(0xffcc66), 0.9);
    const sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: sunTex, transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending,
    }));
    sunSprite.position.copy(this._lightSun.position).multiplyScalar(1.1);
    sunSprite.scale.setScalar(1200);
    this.group.add(sunSprite);
  }

  /* ============================================================
     2. 地形 — 先用 fbm fallback，加载到 shape.bin 后再重采样重建
     ============================================================ */
  private _buildTerrain() {
    const size = 8000, seg = 220;
    const geo = new THREE.PlaneGeometry(size, size, seg, seg);
    geo.rotateX(-Math.PI / 2);
    this._terrainGeo = geo;
    const pos = geo.attributes.position as THREE.BufferAttribute;

    const rnd = mulberry32(20250901);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      const d = Math.sqrt(x * x + z * z);
      let y = 0;
      if (d > 550) {
        const falloff = smoothstep(550, 1400, d);
        const n = fbm(x * 0.0015, z * 0.0015, 4, rnd) * 260
                + fbm(x * 0.006,  z * 0.006,  3, rnd) * 70;
        y = n * falloff;
      }
      pos.setY(i, y);
    }
    geo.computeVertexNormals();

    const mat = new THREE.MeshStandardMaterial({
      color: 0x3d4b5a,
      roughness: 0.95, metalness: 0.0, flatShading: false,
    });
    this._terrain = new THREE.Mesh(geo, mat);
    this._terrain.receiveShadow = true;
    this.group.add(this._terrain);
  }

  /** shape.bin / shape_detail.bin 加载完成后，把真实地球高程采样到地形上 */
  private _applyTelluxHeightmap() {
    if (!this._shapeTex || !this._terrainGeo) return;
    const shapeImg = this._shapeTex.image as { data: ArrayBufferView | null; width: number; height: number };
    if (!shapeImg.data) return;
    const H = new Uint8Array(shapeImg.data.buffer, shapeImg.data.byteOffset, shapeImg.data.byteLength);
    const W = shapeImg.width;
    const HH = shapeImg.height;
    let D: Uint8Array | null = null;
    let DW = 0, DH_ = 0;
    if (this._detailTex) {
      const dImg = this._detailTex.image as { data: ArrayBufferView | null; width: number; height: number };
      if (dImg.data) {
        D = new Uint8Array(dImg.data.buffer, dImg.data.byteOffset, dImg.data.byteLength);
        DW = dImg.width;
        DH_ = dImg.height;
      }
    }

    // 以发射场为中心，对 shape 的纬度方向（赤道附近）取一条 4000km 见方的区域
    //   shape 是 equirectangular，X→0..2π 经度，Y→π..0 纬度
    //   让发射中心落在 shape 中央 → (W/2, HH*0.58) 相当于中纬度
    const CENTER_LON_FRAC = 0.50;
    const CENTER_LAT_FRAC = 0.58;
    const REGION_LON_DEG = 40;   // 40°经度跨度
    const REGION_LAT_DEG = 40;
    const lonPerPx = REGION_LON_DEG / 360 * W / 8000;  // 地形每个米 -> 经度 texel 比例
    const latPerPx = REGION_LAT_DEG / 180 * HH / 8000;

    const pos = this._terrainGeo.attributes.position as THREE.BufferAttribute;
    const count = pos.count;
    const colors = new Float32Array(count * 3);
    const color = new THREE.Color();

    for (let i = 0; i < count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      const d = Math.sqrt(x * x + z * z);
      // 经度 u：x（东）对应经度增大； 纬度 v：-z（北）对应纬度减小（从 π→0）
      const u = CENTER_LON_FRAC + x * lonPerPx / W;
      const v = CENTER_LAT_FRAC + (-z) * latPerPx / HH;
      const baseSample = sampleUint8(H, W, HH, u, v);
      let detailSample = 0;
      if (D) {
        const ud = ((u - CENTER_LON_FRAC) * 16 + 0.5);
        const vd = ((v - CENTER_LAT_FRAC) * 16 + 0.5);
        detailSample = (sampleUint8(D, DW, DH_, ud, vd) - 128) / 128;
      }
      // base (0..255) → 高度 (-200m ~ +3200m)，中心 550m 半径强平坦
      const raw = (baseSample / 255) * 3400 - 200 + detailSample * 80;
      let y = raw;
      if (d < 550) {
        const fallin = smoothstep(0, 550, d);
        y = raw * fallin;                       // 发射场 0m 完全平坦
      } else if (d < 1400) {
        const f = smoothstep(550, 1400, d);
        y = THREE.MathUtils.lerp(raw * 0.1, raw, f);
      }
      pos.setY(i, y);

      // 按高度染色（tellux 同款：海岸灰绿 → 丘陵赭 → 岩石 → 雪顶）
      let hsl: [number, number, number];
      if (y < 1)        hsl = [0.11, 0.18, 0.30]; // 平原灰土
      else if (y < 120)  hsl = [0.26, 0.22, 0.26]; // 低草绿
      else if (y < 350)  hsl = [0.09, 0.20, 0.33]; // 丘陵土黄
      else if (y < 700)  hsl = [0.08, 0.08, 0.40]; // 岩石
      else if (y < 1300) hsl = [0.62, 0.06, 0.58]; // 灰岩偏蓝
      else               hsl = [0.60, 0.03, 0.90]; // 雪山

      // 发射中心 550m 内统一色调（沥青/水泥）
      if (d < 520) hsl = [0.08, 0.08, 0.26];

      color.setHSL(...hsl);
      colors[i*3]=color.r; colors[i*3+1]=color.g; colors[i*3+2]=color.b;
    }

    this._terrainGeo.setAttribute('position', pos);
    this._terrainGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    this._terrainGeo.computeVertexNormals();
    pos.needsUpdate = true;

    const oldMat = this._terrain.material as THREE.MeshStandardMaterial;
    oldMat.vertexColors = true;
    oldMat.color = new THREE.Color(0xffffff);
    oldMat.needsUpdate = true;
  }

  /* ============================================================
     3. 远山（发射场四角装饰性剪影）
     ============================================================ */
  private _buildMountains() {
    this._mountains = new THREE.Group();
    const rnd = mulberry32(777);
    for (let i = 0; i < 18; i++) {
      const geo = new THREE.ConeGeometry(
        220 + rnd() * 520, 380 + rnd() * 700,
        5 + Math.floor(rnd() * 3)
      );
      const mat = new THREE.MeshStandardMaterial({
        color: new THREE.Color().setHSL(0.58 + rnd() * 0.08, 0.12, 0.18 + rnd() * 0.08),
        roughness: 1, metalness: 0, flatShading: true,
      });
      const m = new THREE.Mesh(geo, mat);
      const ang = (i / 18) * Math.PI * 2 + rnd() * 0.2;
      const dist = 3800 + rnd() * 1800;
      m.position.set(Math.cos(ang) * dist, 20 + rnd() * 60, Math.sin(ang) * dist);
      m.rotation.y = rnd() * Math.PI;
      this._mountains.add(m);
    }
    this.group.add(this._mountains);
  }

  /* ============================================================
     4. 发射台/勤务塔/摆杆 (保持功能)
     ============================================================ */
  private _buildPad() {
    this._pad = new THREE.Group();

    for (let i = 0; i < 3; i++) {
      const r = 48 - i * 8;
      const geo = new THREE.CylinderGeometry(r, r, 3, 48);
      const mat = new THREE.MeshStandardMaterial({
        color: new THREE.Color().setHSL(0.58, 0.04, 0.40 - i * 0.04),
        roughness: 0.9,
      });
      const m = new THREE.Mesh(geo, mat);
      m.position.y = 1.5 + i * 3;
      m.receiveShadow = true; m.castShadow = true;
      this._pad.add(m);
    }

    const flameGeo = new THREE.BoxGeometry(24, 2, 24);
    const flameMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 1 });
    const flame = new THREE.Mesh(flameGeo, flameMat);
    flame.position.y = 0.6;
    flame.receiveShadow = true;
    this._pad.add(flame);

    const towerPositions: [number,number][] = [[28,28],[-28,28],[28,-28],[-28,-28]];
    for (const [tx, tz] of towerPositions) {
      const tower = this._makeServiceTower();
      tower.position.set(tx, 0, tz);
      this._pad.add(tower);
    }

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
        Math.cos(ang) * 10, 15 + i * 6, Math.sin(ang) * 10
      );
      grp.rotation.y = ang + Math.PI / 2;
      arm.position.z = 6;
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
      color: 0xcfd8e4, roughness: 0.5, metalness: 0.65,
    });
    const mast = new THREE.Mesh(mastGeo, mastMat);
    mast.position.y = 80;
    mast.castShadow = true; mast.receiveShadow = true;
    g.add(mast);
    for (let i = 0; i < 8; i++) {
      const beamGeo = new THREE.BoxGeometry(10, 0.6, 0.6);
      const b1 = new THREE.Mesh(beamGeo, mastMat.clone());
      b1.position.set(0, 15 + i * 18, 0);
      b1.castShadow = true;
      g.add(b1);
    }
    const redGlow = this._makeGlowTexture(new THREE.Color(0xff3030), 1);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: redGlow, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    sprite.position.set(0, 162, 0);
    sprite.scale.setScalar(7);
    g.add(sprite);
    return g;
  }

  /* ============================================================
     5. 云层 — 先程序化，turbulence/local_weather 到位后替换贴图
     ============================================================ */
  private _buildClouds() {
    this._distantClouds = new THREE.Group();
    const cloudTex = this._makeCloudTexture();
    const rnd = mulberry32(42);
    for (let i = 0; i < 28; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({
        map: cloudTex, transparent: true,
        opacity: 0.45 + rnd() * 0.25, depthWrite: false,
        color: new THREE.Color().setHSL(0.58, 0.1, 0.82 + rnd() * 0.1),
      }));
      const ang = rnd() * Math.PI * 2;
      const r = 800 + rnd() * 3500;
      s.position.set(
        Math.cos(ang) * r, 260 + rnd() * 400, Math.sin(ang) * r
      );
      s.scale.setScalar(400 + rnd() * 400);
      this._distantClouds.add(s);
    }
    this.group.add(this._distantClouds);
  }

  private _applyTelluxCloudTextures() {
    if (!this._weatherTex && !this._turbTex) return;
    // 把 turbulence PNG 作为云的主贴图（tellux 的云层体积噪声），local_weather 作为颜色混合
    const rnd = mulberry32(42);
    let idx = 0;
    this._distantClouds.traverse((obj) => {
      if (obj instanceof THREE.Sprite && idx < 28) {
        const mat = obj.material as THREE.SpriteMaterial;
        if (this._turbTex) {
          if (mat.map) mat.map.dispose();
          mat.map = this._turbTex;
        }
        if (this._weatherTex) {
          // 从 local_weather 按像素位置采一层颜色 tint
          const hueShift = (rnd() - 0.5) * 0.05;
          const [h, s, l] = [0.58 + hueShift, 0.12, 0.82 + rnd() * 0.08];
          mat.color.setHSL(h, s, l);
        }
        mat.opacity = 0.42 + rnd() * 0.22;
        mat.needsUpdate = true;
        idx++;
      }
    });
    // 额外添加一层 "local_weather" 大气云底 Sprite（巨型单层覆盖远山）
    if (this._weatherTex) {
      const bigCloud = new THREE.Sprite(new THREE.SpriteMaterial({
        map: this._weatherTex,
        transparent: true, depthWrite: false, opacity: 0.55,
        color: 0xdce6ff,
      }));
      bigCloud.scale.set(9000, 9000, 1);
      bigCloud.position.set(0, 1600, 0);
      this._distantClouds.add(bigCloud);
    }
  }

  /* ============================================================
     6. 星空 — 程序化 fallback → stars-kM9bgGHh.bin 解析后替换
     ============================================================ */
  private _buildStars() {
    const N = 6000;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(N * 3);
    const col = new Float32Array(N * 3);
    const size = new Float32Array(N);
    const rnd = mulberry32(999);
    const c = new THREE.Color();
    for (let i = 0; i < N; i++) {
      const u = rnd() * 2 - 1, t = rnd() * Math.PI * 2;
      const R = 80000; const s = Math.sqrt(1 - u * u);
      pos[i*3]=R*s*Math.cos(t); pos[i*3+1]=R*u; pos[i*3+2]=R*s*Math.sin(t);
      const temp = rnd();
      if (temp < 0.25)      c.setRGB(1, 0.8, 0.6);
      else if (temp < 0.55) c.setRGB(1, 1, 1);
      else if (temp < 0.85) c.setRGB(0.85, 0.92, 1);
      else                  c.setRGB(0.7, 0.75, 1);
      col[i*3]=c.r; col[i*3+1]=c.g; col[i*3+2]=c.b;
      size[i] = 0.5 + rnd() * 2.2;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));

    const starTex = this._makeStarTexture();
    const mat = this._makeStarMaterial(starTex);
    this._stars = new THREE.Points(geo, mat);
    this._stars.frustumCulled = false;
    this.scene.add(this._stars);
  }

  private _makeStarMaterial(tex: THREE.Texture) {
    return new THREE.ShaderMaterial({
      uniforms: {
        uTex: { value: tex },
        uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
        uFade: { value: 1.0 },
      },
      vertexShader: `
        attribute float aSize;
        varying vec3 vColor;
        uniform float uPixelRatio;
        void main() {
          vColor = color;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = aSize * uPixelRatio * (300.0 / -mv.z);
        }`,
      fragmentShader: `
        uniform sampler2D uTex;
        uniform float uFade;
        varying vec3 vColor;
        void main() {
          vec4 t = texture2D(uTex, gl_PointCoord);
          if (t.a < 0.02) discard;
          gl_FragColor = vec4(vColor, t.a * uFade);
        }`,
      vertexColors: true, transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
  }

  /** 解析 tellux stars-kM9bgGHh.bin (stride=10 * 9096) 后替换星点 */
  private _applyTelluxStars(buf: ArrayBuffer) {
    // 字节布局 (每 10 B):
    //   0-1: ra_u16  (0..65535 → 0..2π)
    //   2-3: dec_u16 (0..65535 → -π/2 .. π/2)
    //   4  : 0xFF marker
    //   5-6: mag_u16 (越小越亮, 0..65535)
    //   7  : temp byte (光谱/B-V)
    //   8-9: padding (常常 0xDB)
    const STRIDE = 10;
    const N = Math.floor(buf.byteLength / STRIDE);
    const src = new DataView(buf);
    const RADIUS = 80000;
    const pos = new Float32Array(N * 3);
    const col = new Float32Array(N * 3);
    const size = new Float32Array(N);
    const c = new THREE.Color();
    for (let i = 0; i < N; i++) {
      const off = i * STRIDE;
      const ra  = src.getUint16(off,     true) / 65535 * Math.PI * 2;
      const dec = (src.getUint16(off + 2, true) / 65535 - 0.5) * Math.PI;
      const mag = src.getUint16(off + 5, true) / 65535; // 0亮 1暗
      const tempByte = src.getUint8(off + 7);

      const cosDec = Math.cos(dec);
      const x = RADIUS * Math.sin(ra) * cosDec;
      const y = RADIUS * Math.sin(dec);
      const z = RADIUS * Math.cos(ra) * cosDec;
      pos[i*3]=x; pos[i*3+1]=y; pos[i*3+2]=z;

      // temp 0..255: 0=红巨星(橙红), 128=太阳(白), 255=O型(蓝白)
      const t = tempByte / 255;
      if (t < 0.25)      c.setRGB(1.0,  0.72, 0.52);
      else if (t < 0.50) c.setRGB(1.0,  0.92, 0.80);
      else if (t < 0.75) c.setRGB(0.95, 0.97, 1.0);
      else               c.setRGB(0.75, 0.84, 1.0);
      col[i*3]=c.r; col[i*3+1]=c.g; col[i*3+2]=c.b;

      // mag 越小越亮 → 星点更大
      size[i] = 0.5 + (1 - mag) * 3.0;
    }

    const oldGeo = this._stars.geometry;
    oldGeo.dispose();
    const newGeo = new THREE.BufferGeometry();
    newGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    newGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    newGeo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    this._stars.geometry = newGeo;
  }

  /* ============================================================
     7. tellux 资源异步加载 & 应用
     ============================================================ */
  private async _loadTelluxAssets() {
    const base = BASE;
    const [
      shapeBin, detailBin, stbnBin, starsBin,
    ] = await Promise.all([
      this._fetchUint8(`${base}/assets/shape-C0zrEmxc.bin`),
      this._fetchUint8(`${base}/assets/shape_detail-Tuf-gW3D.bin`),
      this._fetchUint8(`${base}/assets/stbn-CqLOkRpq.bin`),
      this._fetchUint8(`${base}/assets/stars-kM9bgGHh.bin`),
    ]);

    // heightmap → DataTexture RedFormat（three@0.185 删除了 LuminanceFormat，单通道用 RedFormat 等价）
    this._shapeTex = this._mkDataTex(shapeBin, 2048, 1024, THREE.RedFormat);
    if (detailBin) this._detailTex = this._mkDataTex(detailBin, 256, 128, THREE.RedFormat);
    if (stbnBin)   this._stbnTex   = this._mkDataTex(stbnBin, 1024, 1024, THREE.RedFormat);
    this._applyTelluxHeightmap();
    if (starsBin) this._applyTelluxStars(starsBin.buffer as ArrayBuffer);

    // PNG → 用原生 TextureLoader 直接拿 tellux 同款云/天气
    const tl = new THREE.TextureLoader();
    tl.setCrossOrigin('anonymous');
    const [weather, turb] = await Promise.all([
      tl.loadAsync(`${base}/assets/local_weather-DSzanC6h.png`),
      tl.loadAsync(`${base}/assets/turbulence-DqexPSLa.png`),
    ]).catch((e) => { console.warn('[LaunchSite] tellux PNG textures failed:', e); return [] as any[]; });
    if (weather) { this._weatherTex = weather; weather.colorSpace = THREE.SRGBColorSpace; weather.wrapS = weather.wrapT = THREE.RepeatWrapping; }
    if (turb)    { this._turbTex    = turb;    turb.colorSpace    = THREE.SRGBColorSpace; turb.wrapS    = turb.wrapT    = THREE.RepeatWrapping; }
    this._applyTelluxCloudTextures();
  }

  private async _fetchUint8(url: string): Promise<Uint8Array | null> {
    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      const buf = await res.arrayBuffer();
      return new Uint8Array(buf);
    } catch (e) {
      console.warn('[LaunchSite] fetch failed', url, e);
      return null;
    }
  }

  private _mkDataTex(u8: Uint8Array | null, w: number, h: number, format: THREE.PixelFormat) {
    if (!u8) return undefined;
    // 尺寸不对就裁剪/补零
    const need = w * h;
    let data: Uint8Array = u8;
    if (u8.length !== need) {
      data = new Uint8Array(need);
      data.set(u8.subarray(0, Math.min(need, u8.length)));
    }
    const tex = new THREE.DataTexture(data, w, h, format, THREE.UnsignedByteType);
    tex.needsUpdate = true;
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearFilter;
    tex.generateMipmaps = false;
    return tex;
  }

  /* ============================================================
     8. 每帧更新（星星淡入淡出 + 云层旋转）
     ============================================================ */
  update(rocketAltMeters: number, dt: number) {
    const fade = THREE.MathUtils.smoothstep(rocketAltMeters, 12000, 90000);
    const mat = this._stars.material as THREE.ShaderMaterial;
    mat.uniforms.uFade.value = THREE.MathUtils.lerp(mat.uniforms.uFade.value, fade, 1 - Math.pow(0.0001, dt));
    if (this._distantClouds) this._distantClouds.rotation.y += dt * 0.0015;
  }

  setHoldArms(retracted: number) {
    this._pad.children.forEach(c => {
      if (c.name.startsWith('holdArm_')) {
        c.rotation.z = THREE.MathUtils.lerp(0, -Math.PI * 0.7, retracted);
      }
    });
  }

  /* ============================================================
     程序化 Procedural 纹理（fallback）
     ============================================================ */
  private _texCache = new Map<string, THREE.Texture>();

  private _makeGlowTexture(color: THREE.Color, strength: number): THREE.Texture {
    const key = 'glow_' + color.getHexString() + '_' + strength.toFixed(2);
    if (this._texCache.has(key)) return this._texCache.get(key)!;
    const s = 128;
    const c = document.createElement('canvas');
    c.width = c.height = s;
    const ctx = c.getContext('2d')!;
    const grd = ctx.createRadialGradient(s/2, s/2, 0, s/2, s/2, s/2);
    grd.addColorStop(0,    `rgba(${Math.round(color.r*255)},${Math.round(color.g*255)},${Math.round(color.b*255)},${strength})`);
    grd.addColorStop(0.35, `rgba(${Math.round(color.r*255)},${Math.round(color.g*255)},${Math.round(color.b*255)},${strength * 0.4})`);
    grd.addColorStop(1,    `rgba(${Math.round(color.r*255)},${Math.round(color.g*255)},${Math.round(color.b*255)},0)`);
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
    const grd = ctx.createRadialGradient(s/2, s/2, 0, s/2, s/2, s/2);
    grd.addColorStop(0,    'rgba(255,255,255,1)');
    grd.addColorStop(0.35, 'rgba(255,255,255,0.7)');
    grd.addColorStop(1,    'rgba(255,255,255,0)');
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
    const rnd = mulberry32(123);
    for (let i = 0; i < 14; i++) {
      const x = rnd()*s, y = rnd()*s, r = 20 + rnd()*70;
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

/* ============================================================
   工具函数：噪声 + 采样 + 伪随机
   ============================================================ */
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
function valueNoise(x: number, y: number): number {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  function hash(ix: number, iy: number) {
    const s = Math.imul(ix | 0, 374761393) ^ Math.imul(iy | 0, 668265263);
    const r = mulberry32(s);
    r(); return r();
  }
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const ab = a + (b - a) * u, cd = c + (d - c) * u;
  return ab + (cd - ab) * v;
}
function fbm(x: number, y: number, oct: number, _rnd?: () => number): number {
  let sum = 0, amp = 1, freq = 1, norm = 0;
  for (let i = 0; i < oct; i++) {
    sum += valueNoise(x * freq, y * freq) * amp;
    norm += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return sum / norm * 2 - 1;
  void _rnd;
}
/** 双线性采样 Uint8 2D 纹理；u/v 是归一化 0..1（越界 clamp） */
function sampleUint8(data: Uint8Array, W: number, H: number, u: number, v: number): number {
  const x = Math.max(0, Math.min(W - 1, u * (W - 1)));
  const y = Math.max(0, Math.min(H - 1, v * (H - 1)));
  const x0 = Math.floor(x), y0 = Math.floor(y);
  const x1 = Math.min(W - 1, x0 + 1), y1 = Math.min(H - 1, y0 + 1);
  const fx = x - x0, fy = y - y0;
  const v00 = data[y0 * W + x0], v10 = data[y0 * W + x1];
  const v01 = data[y1 * W + x0], v11 = data[y1 * W + x1];
  const a = v00 + (v10 - v00) * fx;
  const b = v01 + (v11 - v01) * fx;
  return a + (b - a) * fy;
}
