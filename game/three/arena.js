// === 横版格斗视角场景（polish 版：Bloom 后处理 + 双方踏板 + 远景招牌 + 头顶聚光 + 环境粒子） ===

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { COLORS, CONFIG } from '../config.js';

export class Arena {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    this.renderer.setSize(window.innerWidth, window.innerHeight, false);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene = new THREE.Scene();
    // 透明背景：让 CSS .scene-bg 背景图透过来
    this.scene.background = null;
    // 关掉 fog（远处都是建筑，没差别，省去深度排序开销）
    this.scene.fog = null;

    this.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
    this._setupCamera();

    this._setupLights();
    this._setupBackground();
    this._setupGround();
    this._setupCombatSpot();
    this._setupPlayer();
    this._setupEnemy();
    this._setupDustParticles();

    // 共享几何池（命中粒子、popup、远景小元素都从这里取，省 GC）
    this._initGeometryPool();

    // 后处理：直接渲染，Bloom 砍掉（喷喷是平涂感，bloom 是 8M 像素 × 5 mip 级别，性价比极差）
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.composer.addPass(new OutputPass());

    this.shakeAmount = 0;
    this.shakeUntil = 0;
    this._baseCameraPos = this.camera.position.clone();

    window.addEventListener('resize', () => this.onResize());
  }

  _setupCamera() {
    this.camera.position.set(0, 2.6, 13.5);
    this.camera.lookAt(0, 1.3, 0);
  }

  _setupLights() {
    // Splatoon 平涂光：暖白环境 + 阵营色软补光
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    this.scene.add(new THREE.HemisphereLight(0xffe9c4, 0xfff5e4, 0.6));

    const top = new THREE.DirectionalLight(0xffffff, 0.9);
    top.position.set(0, 10, 5);
    this.scene.add(top);

    // 玩家侧光（黄色软光）
    const playerLight = new THREE.PointLight(0xffe600, 1.4, 12);
    playerLight.position.set(CONFIG.SCENE.PLAYER_X - 1, 3, 2);
    this.scene.add(playerLight);
    this.playerLight = playerLight;

    // 敌人侧光（洋红软光）
    const enemyLight = new THREE.PointLight(0xff3da6, 1.3, 12);
    enemyLight.position.set(CONFIG.SCENE.ENEMY_X + 1, 3, 2);
    this.scene.add(enemyLight);
    this.enemyLight = enemyLight;
  }

  /** 远景：墨滴城市场景（InstancedMesh 优化：170+ mesh → 3 draw call） */
  _setupBackground() {
    const group = new THREE.Group();

    // === v9：3D 舞台拆光，只留极简 2D 软阴影 + 几个手绘涂鸦 ===
    // 之前那些圆环/对决盘/横梁灯/泡泡都是赛博味，跟 2D 涂鸦风打架
    // 现在的舞台几乎透明：AI 卡通背景接管视觉，3D 只承担 mascots 站立

    // === 1. 玩家 + 敌人脚下 2D 软阴影 blob（canvas 生成 radial 渐变）===
    this._addSoftShadow(group, -5, 0.02, 1.6, 0x000000, 0.35);
    this._addSoftShadow(group,  5, 0.02, 1.6, 0x000000, 0.35);

    // === 2. 头顶零星手绘涂鸦（5 个手画的小符号：星号 / 涂鸦线条 / 撕纸小角）===
    // 用 canvas 程序化画一个手绘 5 角星，黑边厚实 + 黄色填充
    this._addHandDoodle(group, -3.5, 6.5, 0, 'star', 0xffe600, 0.7);
    this._addHandDoodle(group,  2.2, 7.0, 0, 'star', 0xff3da6, 0.5);
    this._addHandDoodle(group,  0.0, 7.5, 0, 'splat', 0x00d4c8, 0.55);
    this._addHandDoodle(group,  4.0, 5.8, 0, 'star', 0xc8ff00, 0.45);
    this._addHandDoodle(group, -2.0, 5.2, 0, 'splat', 0xffe600, 0.4);

    // === 3. 几道涂鸦线条（手写波浪线，画在背景上）===
    this._addSquiggle(group, -1.5, 6.8, 0, 0xff3da6, 0.35);
    this._addSquiggle(group,  1.8, 5.5, 0, 0xffe600, 0.4);

    this.scene.add(group);
    this.bgGroup = group;
  }

  /** 在地面画一个 2D 软阴影 blob（canvas 生成的 radial 渐变） */
  _addSoftShadow(group, x, y, z, color, opacity) {
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');
    const cx = size / 2, cy = size / 2;
    const r = size / 2;
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    const hex = '#' + color.toString(16).padStart(6, '0');
    grad.addColorStop(0, hex + Math.round(opacity * 255).toString(16).padStart(2, '0'));
    grad.addColorStop(0.4, hex + Math.round(opacity * 0.5 * 255).toString(16).padStart(2, '0'));
    grad.addColorStop(1, hex + '00');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
    // 压扁成椭圆（横向 1.4x）
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 1 });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(3.2, 1.4, 1);  // 椭圆阴影
    sprite.position.set(x, y, z);
    group.add(sprite);
  }

  /** 在场景里加一个手绘涂鸦符号（5 角星 / 涂鸦 splat） */
  _addHandDoodle(group, x, y, z, kind, color, scale) {
    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');
    const cx = size / 2, cy = size / 2;
    const r = size * 0.42;
    const hex = '#' + color.toString(16).padStart(6, '0');

    ctx.lineWidth = 6;
    ctx.strokeStyle = '#1a1a1a';
    ctx.fillStyle = hex;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    if (kind === 'star') {
      // 5 角星，循环画 5 段交替内外半径
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const radius = i % 2 === 0 ? r : r * 0.42;
        const angle = (Math.PI / 2) * -1 + (i * Math.PI) / 5;  // 从上开始
        const px = cx + Math.cos(angle) * radius;
        const py = cy + Math.sin(angle) * radius;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (kind === 'splat') {
      // 涂鸦 splat：5-6 个圆组成的滴落
      ctx.beginPath();
      const drops = 7;
      for (let i = 0; i < drops; i++) {
        const a = (i / drops) * Math.PI * 2;
        const dist = r * (0.4 + Math.random() * 0.3);
        ctx.moveTo(cx + Math.cos(a) * dist, cy + Math.sin(a) * dist);
        ctx.arc(cx + Math.cos(a) * dist, cy + Math.sin(a) * dist, r * 0.18 + Math.random() * 0.08, 0, Math.PI * 2);
      }
      ctx.fill();
      ctx.stroke();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(scale, scale, 1);
    sprite.position.set(x, y, z);
    sprite.userData.bobSpeed = 0.5 + Math.random() * 0.5;
    sprite.userData.bobOffset = Math.random() * Math.PI * 2;
    group.add(sprite);
    if (!this._doodles) this._doodles = [];
    this._doodles.push(sprite);
  }

  /** 在场景里画一道手绘涂鸦波浪线（头顶点缀） */
  _addSquiggle(group, x, y, z, color, scale) {
    const w = 256, h = 64;
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    const hex = '#' + color.toString(16).padStart(6, '0');
    ctx.strokeStyle = hex;
    ctx.lineWidth = 8;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(20, h / 2);
    for (let i = 0; i < 5; i++) {
      const cx = 20 + (i + 0.5) * (w - 40) / 5;
      const cy = h / 2 + (i % 2 === 0 ? -16 : 16);
      const nextX = 20 + (i + 1) * (w - 40) / 5;
      ctx.quadraticCurveTo(cx, cy, nextX, h / 2);
    }
    ctx.stroke();
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(scale * 4, scale, 1);
    sprite.position.set(x, y, z);
    group.add(sprite);
  }

  _spawnSign(group, x, y, z, text, color = 0xffe600) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 256, 128);
    // 喷喷风格：厚黑边实色字
    ctx.font = '900 90px Orbitron, "Helvetica Neue", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 8;
    ctx.strokeStyle = '#1a1a1a';
    ctx.strokeText(text, 128, 64);
    ctx.fillStyle = '#' + color.toString(16).padStart(6, '0');
    ctx.fillText(text, 128, 64);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(2.5, 1.25, 1);
    sprite.position.set(x, y, z);
    group.add(sprite);
  }

  _setupGround() {
    const group = new THREE.Group();

    // === v9：地面拆光，AI 卡通背景的"地"已经画好了，3D 不再叠任何东西 ===
    // 完全透明地面，只是个 invisible plane 用来接 depth
    // 玩家/敌人的脚下"软阴影"已经在 _setupBackground 里加好

    // 不画任何几何体：纯空 group 即可
    this.scene.add(group);
    this.groundGroup = group;
  }

  /** 头顶聚光 + 战斗区光柱 */
  _setupCombatSpot() {
    // SpotLight
    const spot = new THREE.SpotLight(0xffffff, 2.5, 18, Math.PI / 5, 0.4);
    spot.position.set(0, 11, 0);
    spot.target.position.set(0, 0, 0);
    this.scene.add(spot);
    this.scene.add(spot.target);

    // 光柱（半透明圆锥，从头顶到地面）
    const coneGeo = new THREE.ConeGeometry(5, 11, 32, 1, true);
    const coneMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.04,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const cone = new THREE.Mesh(coneGeo, coneMat);
    cone.position.set(0, 5.5, 0);  // 锥心
    this.scene.add(cone);

    // 光柱底圈（地面光环）
    const haloGeo = new THREE.RingGeometry(4.8, 5.1, 64);
    const haloMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.25,
      side: THREE.DoubleSide,
    });
    const halo = new THREE.Mesh(haloGeo, haloMat);
    halo.rotation.x = -Math.PI / 2;
    halo.position.y = 0.02;
    this.scene.add(halo);

    this.combatSpot = spot;
    this.combatHalo = halo;
  }

  /** 环境尘埃粒子 */
  /** 共享几何池：所有临时粒子（命中火花 / 拖尾 / 冲击波 / popup）从这里取 */
  _initGeometryPool() {
    this._geoPool = {
      // 球（命中火花 / popup）：6 档尺寸复用
      sphere: {
        xs: new THREE.SphereGeometry(0.05, 6, 4),
        s:  new THREE.SphereGeometry(0.1,  6, 4),
        m:  new THREE.SphereGeometry(0.15, 6, 4),
        l:  new THREE.SphereGeometry(0.2,  8, 6),
        xl: new THREE.SphereGeometry(0.3,  8, 6),
        xxl:new THREE.SphereGeometry(0.5,  8, 6),
      },
      // 环（冲击波）：3 档
      ring: {
        s:  new THREE.RingGeometry(0.1,  0.35, 24),
        m:  new THREE.RingGeometry(0.2,  0.4,  32),
        l:  new THREE.RingGeometry(0.05, 0.15, 24),
      },
      // 立方（十字闪光线）
      bar: new THREE.BoxGeometry(2.5, 0.08, 0.08),
    };
  }

  _setupDustParticles() {
    const count = 80;
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 24;
      positions[i * 3 + 1] = Math.random() * 6 + 0.5;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 8;
      velocities[i * 3] = (Math.random() - 0.5) * 0.05;
      velocities[i * 3 + 1] = (Math.random() - 0.2) * 0.02;
      velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.05;
    }

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    // 程序纹理（小圆点）
    const c = document.createElement('canvas');
    c.width = c.height = 32;
    const ctx = c.getContext('2d');
    const grd = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.5, 'rgba(255,255,255,0.4)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, 32, 32);
    const tex = new THREE.CanvasTexture(c);

    const mat = new THREE.PointsMaterial({
      map: tex,
      vertexColors: true,
      size: 0.18,
      transparent: true,
      opacity: 0.75,
      depthWrite: false,
      sizeAttenuation: true,
    });

    // 喷喷色：每个粒子随机分配一个阵营色
    const colors = new Float32Array(count * 3);
    const splatPalette = [
      [1.0, 0.9, 0.0],     // 黄
      [1.0, 0.24, 0.65],   // 洋红
      [0.0, 0.83, 0.78],   // 薄荷
      [0.78, 1.0, 0.0],    // 酸橙
    ];
    for (let i = 0; i < count; i++) {
      const c = splatPalette[Math.floor(Math.random() * splatPalette.length)];
      colors[i * 3] = c[0];
      colors[i * 3 + 1] = c[1];
      colors[i * 3 + 2] = c[2];
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const points = new THREE.Points(geo, mat);
    this.scene.add(points);
    this.dust = { points, velocities };

    // 缓存伤害数字纹理（按数值复用）
    this._damageTexCache = new Map();
    this._activePopups = [];

    // 敌人 attack 帧预加载（v8：mascot 没有专门 attack 帧，用 tint 闪烁代替）
    this._enemyAttackTex = null;
    this._enemyAttackSwapUntil = 0;
    // 不再加载 enemy_attack.png（mascot 是静态可爱角色，攻击时通过 tint flash + bobbing 表现）
  }

  /** 敌人 attack 帧切换：250ms 切到 attack，再切回 idle */
  flashEnemyAttackFrame() {
    if (!this._enemyAttackTex || !this.enemySprite) return;
    this.enemySprite.material.map = this._enemyAttackTex;
    this.enemySprite.material.needsUpdate = true;
    this._enemyAttackSwapUntil = performance.now() + 250;
  }

  /**
   * 在 3D 空间中弹出伤害数字（如 "-8"），自动上浮 + 淡出 + 销毁
   * @param {number} value     - 伤害值（负数表示 -N，正数表示 +N）
   * @param {THREE.Vector3} worldPos - 弹出位置
   * @param {number} color     - 16 进制颜色（红 / 金等）
   */
  spawnDamagePopup(value, worldPos, color = 0xffd166) {
    const label = (value > 0 ? '+' : '') + value;
    let tex = this._damageTexCache.get(label);
    if (!tex) {
      const cv = document.createElement('canvas');
      cv.width = 256; cv.height = 128;
      const ctx = cv.getContext('2d');
      ctx.clearRect(0, 0, cv.width, cv.height);
      ctx.font = 'bold 96px Orbitron, "Rajdhani", system-ui';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const hex = '#' + color.toString(16).padStart(6, '0');
      ctx.shadowColor = hex;
      ctx.shadowBlur = 24;
      ctx.fillStyle = hex;
      ctx.fillText(label, 128, 64);
      ctx.shadowBlur = 12;
      ctx.fillText(label, 128, 64);
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#ffffff';
      ctx.fillText(label, 128, 64);
      tex = new THREE.CanvasTexture(cv);
      tex.colorSpace = THREE.SRGBColorSpace;
      this._damageTexCache.set(label, tex);
    }

    const mat = new THREE.SpriteMaterial({
      map: tex,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(2.4, 1.2, 1);
    sprite.position.copy(worldPos);
    sprite.position.y += 0.3;
    sprite.renderOrder = 999;
    this.scene.add(sprite);

    this._activePopups.push({
      sprite, mat,
      bornAt: performance.now(),
      duration: 900,
      startY: sprite.position.y,
    });
  }

  _updatePopups(now) {
    for (let i = this._activePopups.length - 1; i >= 0; i--) {
      const p = this._activePopups[i];
      const t = Math.min(1, (now - p.bornAt) / p.duration);
      p.sprite.position.y = p.startY + t * 1.4;
      const fade = t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3;
      p.mat.opacity = fade;
      const sc = 0.6 + Math.min(1, t * 3) * 0.6;
      p.sprite.scale.set(2.4 * sc, 1.2 * sc, 1);
      if (t >= 1) {
        this.scene.remove(p.sprite);
        p.mat.dispose();
        this._activePopups.splice(i, 1);
      }
    }
  }

  _setupPlayer() {
    const group = new THREE.Group();
    const ACCENT = 0xffe600;  // 喷喷玩家黄

    // === v9：3D 踏板/光环全删，只留 mascot 立绘 ===
    // 阵营识别交给顶部的"YOU"贴纸和脚下软阴影
    // 没有任何 3D 几何体，mascot 浮在 AI 卡通背景之上

    // === 角色立绘（v8：用 AI 出的鱿鱼/章鱼 mascot 替换 3D 机器人和怪物）===
    group.visible = false;
    this._loadCharacterSprite(
      '../assets/mascot_squid_alpha.png',
      group,
      { x: 0, y: 1.3, z: 0 },         // sprite 中心位置
      { x: 2.4, y: 2.4 },              // sprite 缩放（512x512 PNG 需要更大）
      'player',                        // 引用名（用于 update / hit）
      () => { group.visible = true; }  // 加载完成回调
    );

    group.position.set(CONFIG.SCENE.PLAYER_X, 0, 0);
    group.rotation.y = Math.PI / 2;
    this.scene.add(group);
    this.player = group;
  }

  _setupEnemy() {
    const group = new THREE.Group();

    // === v9：3D 底座/光环/尖刺全删，只留 mascot 立绘 ===
    // 跟玩家一样浮在 AI 卡通背景之上

    // === 角色立绘（v8：用 AI 出的鱿鱼/章鱼 mascot 替换 3D 机器人和怪物）===
    group.visible = false;
    this._loadCharacterSprite(
      '../assets/mascot_octopus_alpha.png',
      group,
      { x: 0, y: 1.7, z: 0 },
      { x: 3.0, y: 3.0 },
      'enemy',
      () => { group.visible = true; }
    );

    group.position.set(CONFIG.SCENE.ENEMY_X, 0, 0);
    group.rotation.y = -Math.PI / 2;
    this.scene.add(group);
    this.enemy = group;
  }

  /**
   * 异步加载角色立绘（AI 生成 PNG → SpriteMaterial → Sprite）
   * 自动 fade-in，加载失败时调用 onLoaded(null) 便于 fallback
   * @param {string} url           - PNG 路径
   * @param {THREE.Group} parent   - 要加入的 group（player 或 enemy）
   * @param {{x,y,z}} pos          - sprite 中心位置（相对 group）
   * @param {{x,y}} scale          - sprite 缩放
   * @param {'player'|'enemy'} refKey - 引用名，存到 this[refKey + 'Sprite']
   * @param {Function} onLoaded    - 加载完成回调（无论成功失败）
   */
  _loadCharacterSprite(url, parent, pos, scale, refKey, onLoaded) {
    new THREE.TextureLoader().load(
      url,
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.magFilter = THREE.LinearFilter;
        tex.minFilter = THREE.LinearMipmapLinearFilter;
        tex.generateMipmaps = true;

        const mat = new THREE.SpriteMaterial({
          map: tex,
          transparent: true,
          depthTest: true,
          depthWrite: false,
        });
        const sprite = new THREE.Sprite(mat);
        sprite.scale.set(scale.x, scale.y, 1);
        sprite.position.set(pos.x, pos.y, pos.z);
        parent.add(sprite);

        // 记录 base position 用于后续 idle bobbing
        sprite.userData.basePosY = pos.y;
        sprite.userData.baseScaleX = scale.x;
        sprite.userData.baseScaleY = scale.y;
        sprite.userData.idleTex = tex;  // 用于 attack 帧切回 idle

        // 记录引用
        if (refKey === 'player') this.playerSprite = sprite;
        else if (refKey === 'enemy') this.enemySprite = sprite;

        // fade-in 300ms
        sprite.material.opacity = 0;
        const startTime = performance.now();
        const fadeIn = () => {
          if (!sprite.material) return;
          const t = Math.min(1, (performance.now() - startTime) / 300);
          sprite.material.opacity = t;
          if (t < 1) requestAnimationFrame(fadeIn);
        };
        fadeIn();

        if (onLoaded) onLoaded(sprite);
      },
      undefined,
      (err) => {
        console.warn('[arena] 角色立绘加载失败，使用程序化几何 fallback:', url, err);
        if (onLoaded) onLoaded(null);
      }
    );
  }

  setupTrainingTarget() {
    this._clearEnemy();

    const group = new THREE.Group();

    // === v9：训练靶也拆光，跟 _setupEnemy 一样只留空 group ===
    // AI 卡通背景的"木人靶"已经是靶子了，3D 不用再加任何东西
    // 训练靶脚下软阴影已经在 _setupBackground 里加好了

    group.position.set(CONFIG.SCENE.ENEMY_X, 0, 0);
    group.rotation.y = -Math.PI / 2;
    this.scene.add(group);
    this.target = group;
    this.enemy = null;
  }

  _clearEnemy() {
    if (this.enemy) {
      this.scene.remove(this.enemy);
      this.enemy = null;
    }
    if (this.target) {
      this.scene.remove(this.target);
      this.target = null;
    }
  }

  hitTrainingTarget(damage = 0) {
    if (!this.target) return;
    this.target.scale.set(1.4, 1.4, 1.4);
    setTimeout(() => this.target && this.target.scale.set(1, 1, 1), 180);
    if (damage) {
      const pos = new THREE.Vector3();
      this.target.getWorldPosition(pos);
      pos.y += 1.8;
      this.spawnDamagePopup(-damage, pos, 0xffd166);
    }
  }

  hitEnemy(damage = 0) {
    if (!this.enemy) return;
    // 命中反应：sprite 缩放 + 颜色 tint + 后退
    if (this.enemySprite) {
      const sprite = this.enemySprite;
      const baseS = sprite.userData.baseScaleX || sprite.scale.x;
      // 缩放冲击
      sprite.scale.set(baseS * 1.18, baseS * 1.18, 1);
      // 颜色 tint 红色闪光
      sprite.material.color.setHex(0xffd166);  // 喷喷：金黄色 tint
      setTimeout(() => {
        if (sprite.material) {
          sprite.material.color.setHex(0xffffff);
          sprite.scale.set(baseS, baseS, 1);
        }
      }, 180);
    }
    // 底座/踏板 emissive 闪光（仅 Mesh 有效，sprite 自动跳过）
    this.enemy.traverse(o => {
      if (o.isMesh && o.material.emissive) {
        const orig = o.material.emissiveIntensity;
        o.material.emissiveIntensity = 1.5;
        setTimeout(() => { o.material.emissiveIntensity = orig; }, 150);
      }
    });
    // 后退
    const origX = this.enemy.position.x;
    this.enemy.position.x = CONFIG.SCENE.ENEMY_X + 0.2;
    setTimeout(() => this.enemy && (this.enemy.position.x = origX), 100);
    // 伤害数字 popup
    if (damage) {
      const pos = new THREE.Vector3();
      this.enemy.getWorldPosition(pos);
      pos.y += 2.0;
      this.spawnDamagePopup(-damage, pos, 0xff3da6);  // 喷喷洋红
    }
  }

  hitPlayer(damage = 0) {
    if (!this.player) return;
    // 敌人切到 attack 帧（视觉上"在打你"）
    this.flashEnemyAttackFrame();
    // 玩家受击：sprite tint 红 + 后退
    if (this.playerSprite) {
      const sprite = this.playerSprite;
      const baseS = sprite.userData.baseScaleX || sprite.scale.x;
      sprite.material.color.setHex(0xffd166);  // 喷喷：被击打黄光 tint
      setTimeout(() => {
        if (sprite.material) sprite.material.color.setHex(0xffffff);
      }, 200);
    }
    this.player.traverse(o => {
      if (o.isMesh && o.material.emissive) {
o.material.emissive.setHex(0xff3da6);  // 喷喷洋红
          o.material.emissiveIntensity = 1.5;
          setTimeout(() => {
            o.material.emissive.setHex(0xffe600);  // 喷喷黄
            o.material.emissiveIntensity = 0.25;
        }, 200);
      }
    });
    const origX = this.player.position.x;
    this.player.position.x = CONFIG.SCENE.PLAYER_X - 0.2;
    setTimeout(() => this.player && (this.player.position.x = origX), 100);
    // 玩家受击数字 popup（玩家侧用敌色）
    if (damage) {
      const pos = new THREE.Vector3();
      this.player.getWorldPosition(pos);
      pos.y += 1.6;
      this.spawnDamagePopup(-damage, pos, 0xff3da6);  // 喷喷洋红
    }
  }

  playerFireFlash() {
    if (!this.playerMuzzle) return;
    this.playerMuzzle.material.opacity = 1;
    setTimeout(() => { if (this.playerMuzzle) this.playerMuzzle.material.opacity = 0.85; }, 80);
  }

  setStunVfx(active) {
    if (!this.playerLight) return;
    this.playerLight.color.setHex(active ? 0xffd166 : 0xffe600);  // 喷喷：眩晕黄 / 玩家黄
    this.playerLight.intensity = active ? 4 : 2.5;
  }

  shake(amount = 0.2, durationMs = 200) {
    this.shakeAmount = amount;
    this.shakeUntil = performance.now() + durationMs;
  }

  onResize() {
    this.renderer.setSize(window.innerWidth, window.innerHeight, false);
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.composer.setSize(window.innerWidth, window.innerHeight);
  }

  update(dt, now = performance.now()) {
    // 玩家 idle - group 整体微浮 + sprite 自身呼吸
    if (this.player) {
      this.player.position.y = Math.sin(now * 0.003) * 0.06;
      // Sprite 自身呼吸（更明显的"活着"感）
      if (this.playerSprite && this.playerSprite.userData.basePosY !== undefined) {
        const baseY = this.playerSprite.userData.basePosY;
        const baseS = this.playerSprite.userData.baseScaleX;
        const breathe = Math.sin(now * 0.0028) * 0.04;
        this.playerSprite.position.y = baseY + breathe;
        const scalePulse = 1 + Math.sin(now * 0.0028) * 0.025;
        this.playerSprite.scale.set(baseS * scalePulse, baseS * scalePulse, 1);
      }
      // 踏板环脉动
      if (this.playerPadRing) {
        const s = 1 + Math.sin(now * 0.005) * 0.1;
        this.playerPadRing.scale.set(s, s, 1);
      }
    }

    // 敌人 idle - group 浮动 + sprite 自身呼吸（幅度更大，威胁感）
    if (this.enemy) {
      this.enemy.position.y = Math.sin(now * 0.003 + 1.5) * 0.05;
      if (this.enemySprite && this.enemySprite.userData.basePosY !== undefined) {
        const baseY = this.enemySprite.userData.basePosY;
        const baseS = this.enemySprite.userData.baseScaleX;
        const breathe = Math.sin(now * 0.0035 + 1.0) * 0.06;
        this.enemySprite.position.y = baseY + breathe;
        const scalePulse = 1 + Math.sin(now * 0.0035 + 1.0) * 0.035;
        this.enemySprite.scale.set(baseS * scalePulse, baseS * scalePulse, 1);
      }
      // 底座外环脉动
      if (this.enemyBaseAura) {
        const s = 1 + Math.sin(now * 0.004) * 0.15;
        this.enemyBaseAura.scale.set(s, s, 1);
        this.enemyBaseAura.material.opacity = 0.2 + Math.sin(now * 0.004) * 0.1;
      }
    }

    // 训练靶子：旋转
    if (this.target) {
      this.target.rotation.y += dt * 0.5;
    }

    // 头顶光柱底圈脉动
    if (this.combatHalo) {
      const s = 1 + Math.sin(now * 0.002) * 0.05;
      this.combatHalo.scale.set(s, s, 1);
    }

    // 尘埃粒子漂浮
    if (this.dust) {
      const pos = this.dust.points.geometry.attributes.position;
      const vel = this.dust.velocities;
      for (let i = 0; i < pos.count; i++) {
        let x = pos.getX(i) + vel[i * 3] * dt * 60;
        let y = pos.getY(i) + vel[i * 3 + 1] * dt * 60;
        let z = pos.getZ(i) + vel[i * 3 + 2] * dt * 60;
        if (x > 12) x = -12;
        if (x < -12) x = 12;
        if (y > 7) y = 0.5;
        if (y < 0.3) y = 0.3;
        pos.setXYZ(i, x, y, z);
      }
      pos.needsUpdate = true;
    }

    // 镜头震动
    if (now < this.shakeUntil) {
      const t = (this.shakeUntil - now) / 200;
      const s = this.shakeAmount * t;
      this.camera.position.x = this._baseCameraPos.x + (Math.random() - 0.5) * s;
      this.camera.position.y = this._baseCameraPos.y + (Math.random() - 0.5) * s;
    } else {
      this.camera.position.copy(this._baseCameraPos);
    }

    // 伤害数字 popup 动画
    this._updatePopups(now);

    // 敌人 attack 帧自动切回 idle
    if (this._enemyAttackSwapUntil > 0 && now > this._enemyAttackSwapUntil && this.enemySprite && this._enemyAttackTex) {
      this.enemySprite.material.map = this.enemySprite.userData.idleTex || this.enemySprite.material.map;
      this.enemySprite.material.needsUpdate = true;
      this._enemyAttackSwapUntil = 0;
    }

    this.composer.render();
  }
}