// === 单词实体化攻击：单词作为 Sprite 飞向敌人，命中爆炸 ===
// 每个单词是一张独立的 CanvasTexture，带霓虹边框 + 字体

import * as THREE from 'three';

const cache = new Map();

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function makeWordTexture(word) {
  if (cache.has(word)) return cache.get(word);

  // 检测字体是否加载：若 Orbitron 还在加载，异步加载完后让 cache 失效
  if (typeof document !== 'undefined' && document.fonts && !document.fonts.check('900 110px Orbitron')) {
    document.fonts.load('900 110px Orbitron').then(() => {
      cache.delete(word);
    }).catch(() => {});
  }

  const W = 512, H = 256;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  // 字体选择：Orbitron（游戏感字体） > Rajdhani（备选） > 系统字体
  const fontStack = '"Orbitron", "Rajdhani", "Helvetica Neue", "Arial Black", sans-serif';

  // === 背景：圆角矩形 + 深色 + 内渐变 ===
  const pad = 14, r = 38;
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, 'rgba(20, 32, 48, 0.97)');
  grad.addColorStop(1, 'rgba(8, 12, 22, 0.97)');
  ctx.fillStyle = grad;
  roundRect(ctx, pad, pad, W - 2 * pad, H - 2 * pad, r);
  ctx.fill();

  // === 内描边（暗色，给文字层次感）===
  ctx.strokeStyle = 'rgba(0, 255, 179, 0.15)';
  ctx.lineWidth = 1;
  roundRect(ctx, pad + 6, pad + 6, W - 2 * (pad + 6), H - 2 * (pad + 6), r - 6);
  ctx.stroke();

  // === 霓虹外发光边框 ===
  ctx.shadowColor = '#00ffb3';
  ctx.shadowBlur = 32;
  ctx.strokeStyle = '#00ffb3';
  ctx.lineWidth = 5;
  roundRect(ctx, pad, pad, W - 2 * pad, H - 2 * pad, r);
  ctx.stroke();
  ctx.shadowBlur = 0;

  // === 顶部装饰：横线 + 两端小三角（喷喷阵营色：玩家黄）===
  ctx.strokeStyle = 'rgba(255, 230, 0, 0.7)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(W * 0.25, pad + 14);
  ctx.lineTo(W * 0.75, pad + 14);
  ctx.stroke();
  ctx.fillStyle = '#ffe600';
  ctx.beginPath();
  ctx.arc(W * 0.25, pad + 14, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(W * 0.75, pad + 14, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255, 230, 0, 0.6)';
  ctx.beginPath();
  ctx.moveTo(W * 0.5 - 22, pad + 14);
  ctx.lineTo(W * 0.5 - 14, pad + 9);
  ctx.lineTo(W * 0.5 - 14, pad + 19);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(W * 0.5 + 22, pad + 14);
  ctx.lineTo(W * 0.5 + 14, pad + 9);
  ctx.lineTo(W * 0.5 + 14, pad + 19);
  ctx.closePath();
  ctx.fill();

  // === 底部装饰：字号提示 + 横线 ===
  ctx.strokeStyle = 'rgba(255, 230, 0, 0.4)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(W * 0.3, H - pad - 14);
  ctx.lineTo(W * 0.7, H - pad - 14);
  ctx.stroke();

  // === 主文字（喷喷：厚黑边 + 黄色字）===
  const fontSize = word.length > 8 ? 70 : word.length > 5 ? 92 : 110;
  ctx.font = `900 ${fontSize}px ${fontStack}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // 喷喷风：先画厚黑边，再填黄
  ctx.lineWidth = 8;
  ctx.strokeStyle = '#1a1a1a';
  ctx.strokeText(word.toUpperCase(), W / 2, H / 2 - 4);

  ctx.fillStyle = '#ffe600';
  ctx.shadowColor = '#ffe600';
  ctx.shadowBlur = 16;
  ctx.fillText(word.toUpperCase(), W / 2, H / 2 - 4);

  // 白色高光文字（叠在内层，缩小一点点）
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#ffffff';
  ctx.fillText(word.toUpperCase(), W / 2, H / 2 - 4);

  // === 底部小字：长度标识（黑边薄荷蓝）===
  ctx.font = `900 18px ${fontStack}`;
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#1a1a1a';
  ctx.textAlign = 'center';
  ctx.strokeText(`${word.length} LETTERS`, W / 2, H - pad - 12);
  ctx.fillStyle = '#00d4c8';
  ctx.fillText(`${word.length} LETTERS`, W / 2, H - pad - 12);

  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  tex.anisotropy = 4;
  tex.colorSpace = THREE.SRGBColorSpace;
  cache.set(word, tex);
  return tex;
}

export class WordProjectileSystem {
  constructor(scene, arena) {
    this.scene = scene;
    this.arena = arena;
    this.active = [];     // 飞行中的 sprite
    this.particles = [];   // 命中粒子
  }

  /**
   * 发射单词
   * @param {string} word
   * @param {THREE.Object3D} from  起点（玩家）
   * @param {THREE.Object3D} to    终点（敌人 / 靶子）
   * @param {(impactPoint: THREE.Vector3) => void} onHit
   */
  fire(word, from, to, onHit) {
    const tex = makeWordTexture(word);
    const mat = new THREE.SpriteMaterial({
      map: tex,
      transparent: true,
      depthTest: true,
      depthWrite: false,
    });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(2.6, 1.3, 1);

    const startPos = from.position.clone();
    startPos.y += 1.6;
    sprite.position.copy(startPos);
    this.scene.add(sprite);
    this.active.push(sprite);

    const endPos = to.position.clone();
    endPos.y += 1.4;
    const distance = startPos.distanceTo(endPos);
    const speed = 14;
    const duration = distance / speed;          // 秒
    const startTime = performance.now();

    const animate = () => {
      const now = performance.now();
      const t = Math.min(1, (now - startTime) / (duration * 1000));
      sprite.position.lerpVectors(startPos, endPos, t);

      // 轻微上下浮动（bobbing），保持 sprite 朝向相机即可读
      sprite.position.y = THREE.MathUtils.lerp(startPos.y, endPos.y, t) + Math.sin(now * 0.012) * 0.08;

      // 越接近敌人越大（撞击感），长轴方向适度拉伸模拟速度
      const scale = 2.6 * (1 + t * 0.3);
      sprite.scale.set(scale * (1 + t * 0.15), scale * 0.5, 1);

      if (t >= 1) {
        if (onHit) onHit(endPos.clone());
        this._spawnHitBurst(endPos, word.length);
        this._removeSprite(sprite);
      } else {
        requestAnimationFrame(animate);
      }
    };
    requestAnimationFrame(animate);
  }

  _removeSprite(sprite) {
    const idx = this.active.indexOf(sprite);
    if (idx >= 0) this.active.splice(idx, 1);
    this.scene.remove(sprite);
    sprite.material.dispose();
  }

  _spawnHitBurst(pos, intensity = 1) {
    const pool = this.arena?._geoPool;
    // 兜底：如果 arena 还没初始化池（旧调用路径），fallback 到动态 new
    const sphereSparkGeo = pool?.sphere.l   || new THREE.SphereGeometry(0.1, 6, 4);
    const sphereTrailGeo = pool?.sphere.xl  || new THREE.SphereGeometry(0.3, 8, 6);
    const ringGeos = pool?.ring || { s: new THREE.RingGeometry(0.1, 0.35, 24), m: new THREE.RingGeometry(0.2, 0.4, 32), l: new THREE.RingGeometry(0.05, 0.15, 24) };
    const barGeo = pool?.bar || new THREE.BoxGeometry(2.5, 0.08, 0.08);

    // === 火花球（向四周散射）===
    const sparkCount = Math.min(28, 14 + intensity * 3);
    const sparkColors = [0xffe600, 0xff3da6, 0x00d4c8, 0xc8ff00];  // 喷喷4色
    for (let i = 0; i < sparkCount; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: sparkColors[i % sparkColors.length],
        transparent: true,
        opacity: 1,
        depthWrite: false,
      });
      const p = new THREE.Mesh(sphereSparkGeo, mat);
      const sScale = 0.7 + Math.random() * 0.6;  // 用 scale 模拟尺寸变化，几何共享
      p.scale.set(sScale, sScale, sScale);
      p.position.copy(pos);
      const a = (i / sparkCount) * Math.PI * 2 + Math.random() * 0.3;
      const speed = 3 + Math.random() * 4;
      p.userData.vel = new THREE.Vector3(
        Math.cos(a) * speed,
        Math.random() * 5 + 1.5,
        Math.sin(a) * speed
      );
      p.userData.life = 0.5 + Math.random() * 0.4;
      p.userData.maxLife = p.userData.life;
      p.userData.isSpark = true;
      p.userData.ownsGeo = false;  // 标记：geometry 是共享的，销毁时不要 dispose
      this.scene.add(p);
      this.particles.push(p);
    }

    // === 拖尾粒子（每帧残影）===
    for (let i = 0; i < 5; i++) {
      setTimeout(() => {
        if (!this.scene) return;
        const trailMat = new THREE.MeshBasicMaterial({
          color: 0xffe600,
          transparent: true,
          opacity: 0.5 - i * 0.08,
          depthWrite: false,
        });
        const trail = new THREE.Mesh(sphereTrailGeo, trailMat);
        const tScale = 1 - i * 0.18;  // 0.3/0.3 → 1.0, 0.05/0.3 → 0.17
        trail.scale.set(tScale, tScale, tScale);
        trail.position.copy(pos);
        trail.lookAt(this.arena.camera.position);
        trail.userData.life = 0.2;
        trail.userData.maxLife = 0.2;
        trail.userData.isRing = true;
        trail.userData.expandSpeed = 6;
        trail.userData.ownsGeo = false;
        this.scene.add(trail);
        this.particles.push(trail);
      }, i * 30);
    }

    // === 3 层冲击波环（主冲击 + 中环 + 外环）===
    const ringConfigs = [
      { geo: ringGeos.s, life: 0.4, scale: 8, opacity: 0.95, color: 0xffe600 },     // 主冲击
      { geo: ringGeos.m, life: 0.6, scale: 12, opacity: 0.7, color: 0xff3da6 },     // 中环
      { geo: ringGeos.l, life: 0.25, scale: 5, opacity: 0.9, color: 0xffffff },     // 中心高光
    ];
    ringConfigs.forEach(cfg => {
      const mat = new THREE.MeshBasicMaterial({
        color: cfg.color,
        transparent: true,
        opacity: cfg.opacity,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const ring = new THREE.Mesh(cfg.geo, mat);
      ring.position.copy(pos);
      ring.lookAt(this.arena.camera.position);
      ring.userData.life = cfg.life;
      ring.userData.maxLife = cfg.life;
      ring.userData.isRing = true;
      ring.userData.expandSpeed = cfg.scale;
      ring.userData.ownsGeo = false;
      this.scene.add(ring);
      this.particles.push(ring);
    });

    // === 中央闪光线（垂直十字）===
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI;
      const mat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
      });
      const line = new THREE.Mesh(barGeo, mat);
      line.position.copy(pos);
      line.rotation.y = angle;
      line.lookAt(this.arena.camera.position);
      line.userData.life = 0.15;
      line.userData.maxLife = 0.15;
      line.userData.isRing = true;
      line.userData.expandSpeed = 0;
      line.userData.ownsGeo = false;
      this.scene.add(line);
      this.particles.push(line);
    }
  }

  update(dt, now) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.userData.life -= dt;
      if (p.userData.life <= 0) {
        this.scene.remove(p);
        // 共享 geometry（池化）不 dispose，只 dispose 自己 new 出来的
        if (p.userData.ownsGeo !== false && !p.userData.isRing) p.geometry.dispose();
        p.material.dispose();
        this.particles.splice(i, 1);
        continue;
      }
      const lifeRatio = p.userData.life / p.userData.maxLife;

      if (p.userData.isRing) {
        // 冲击波/拖尾/十字：放大 + 淡出
        const expandSpeed = p.userData.expandSpeed || 8;
        const ageProgress = 1 - lifeRatio;
        const s = 1 + ageProgress * expandSpeed;
        p.scale.set(s, s, s);
        p.material.opacity = lifeRatio * 0.9;
      } else {
        // 火花球：物理 + 重力 + 颜色微变
        p.position.add(p.userData.vel.clone().multiplyScalar(dt));
        p.userData.vel.y -= 12 * dt;
        p.material.opacity = lifeRatio;
        // 火花缩放：随着生命衰减变小
        const s = 0.7 + lifeRatio * 0.3;
        p.scale.set(s, s, s);
      }
    }
  }

  clear() {
    this.active.forEach(s => {
      this.scene.remove(s);
      s.material.dispose();
    });
    this.active = [];
    this.particles.forEach(p => {
      this.scene.remove(p);
      if (!p.userData.isRing) p.geometry.dispose();
      p.material.dispose();
    });
    this.particles = [];
  }
}