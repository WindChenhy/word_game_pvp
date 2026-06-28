// === 主菜单场景 · 2D 涂鸦杂志风 ===

const THEMES = ['splatoon', 'tokyo'];

function currentTheme() {
  return localStorage.getItem('wd_theme') || 'splatoon';
}

function setTheme(name) {
  if (!THEMES.includes(name)) return;
  document.documentElement.setAttribute('data-theme', name);
  localStorage.setItem('wd_theme', name);
  // 同步给 swatch 标 active
  document.querySelectorAll('.theme-swatch').forEach(el => {
    el.classList.toggle('active', el.dataset.theme === name);
  });
}

export class MenuScene {
  constructor({ onStart }) {
    this.onStart = onStart;
    this.layer = document.getElementById('scene-layer');
  }

  render() {
    this.layer.classList.remove('hidden');
    this.layer.classList.add('menu-mode');
    this.layer.innerHTML = `
      <!-- 背景插画（2D AI 出） -->
      <div class="menu-bg" style="background-image: url('./assets/bg/menu_bg.jpg')"></div>

      <!-- 装饰：散落手写笔记 + 胶带 + 涂鸦 -->
      <div class="doodle-note doodle-note--1 handwrite--marker">GO! GO! GO!</div>
      <div class="doodle-note doodle-note--2 handwrite--caveat">试试看～</div>
      <div class="doodle-note doodle-note--3 handwrite--marker">PUSH!</div>
      <div class="doodle-note doodle-note--4 handwrite--caveat">加油哦！</div>

      <!-- 撕纸横条 + 顶部胶带 -->
      <div class="menu-tape-top">
        <div class="washi-tape washi-tape--mint" style="top:-12px; left:20%; transform:rotate(-8deg)"></div>
        <div class="washi-tape washi-tape--pink" style="top:-8px; right:18%; transform:rotate(6deg)"></div>
      </div>

      <!-- 标题区（杂志风） -->
      <div class="menu-title-block">
        <div class="menu-tagline handwrite--marker">JAVELIN · WORD · DUEL</div>
        <h1 class="menu-title">
          <span class="menu-title-cn">标枪单词对战</span>
          <span class="menu-title-en handwrite--marker">WORD BATTLE</span>
        </h1>
      </div>

      <!-- 主菜单卡（撕纸白卡 + 4 角胶带） -->
      <div class="menu-card torn-paper--top torn-paper--bottom">
        <div class="washi-tape washi-tape" style="top:-10px; left:-12px; transform:rotate(-15deg)"></div>
        <div class="washi-tape washi-tape--lime" style="top:-10px; right:-12px; transform:rotate(12deg)"></div>
        <div class="washi-tape washi-tape--orange" style="bottom:-10px; left:-12px; transform:rotate(10deg)"></div>
        <div class="washi-tape washi-tape--pink" style="bottom:-10px; right:-12px; transform:rotate(-12deg)"></div>

        <!-- VS 对峙（mascot 大图） -->
        <div class="menu-vs">
          <div class="menu-mascot menu-mascot--player">
            <img src="./assets/mascot_squid_alpha.png" alt="黄鱿鱼" />
            <div class="sticker sticker--yellow menu-mascot-tag">YOU</div>
          </div>
          <div class="menu-vs-badge handwrite--marker">VS</div>
          <div class="menu-mascot menu-mascot--enemy">
            <img src="./assets/mascot_octopus_alpha.png" alt="粉章鱼" />
            <div class="sticker sticker--pink menu-mascot-tag">ENEMY</div>
          </div>
        </div>

        <!-- 模式按钮 -->
        <div class="menu-modes">
          <button class="mode-card mode-card--training" data-mode="training">
            <div class="washi-tape washi-tape--lime" style="top:-6px; left:10px; transform:rotate(-8deg)"></div>
            <span class="mode-card-icon">🏹</span>
            <span class="mode-card-label">训练模式</span>
            <span class="sticker sticker--mint">无压力</span>
            <span class="mode-card-desc handwrite--caveat">随便打打</span>
          </button>
          <button class="mode-card mode-card--pve" data-mode="pve">
            <div class="washi-tape washi-tape" style="top:-6px; right:10px; transform:rotate(7deg)"></div>
            <span class="mode-card-icon">⚔</span>
            <span class="mode-card-label">闯关模式</span>
            <span class="sticker sticker--pink">PVE</span>
            <span class="mode-card-desc handwrite--caveat">打怪升级</span>
          </button>
          <button class="mode-card mode-card--pvp" data-mode="pvp">
            <span class="mode-card-icon">👥</span>
            <span class="mode-card-label">真人 PK</span>
            <span class="sticker sticker--yellow">1v1</span>
            <span class="mode-card-desc handwrite--caveat">online battle</span>
          </button>
        </div>

        <!-- 数据条 -->
        <div class="menu-stats">
          <div class="menu-stat">
            <div class="menu-stat-val">30</div>
            <div class="menu-stat-label handwrite--marker">词库</div>
          </div>
          <div class="menu-stat">
            <div class="menu-stat-val">6</div>
            <div class="menu-stat-label handwrite--marker">主题</div>
          </div>
          <div class="menu-stat">
            <div class="menu-stat-val">∞</div>
            <div class="menu-stat-label handwrite--marker">连击</div>
          </div>
        </div>
      </div>

      <!-- 主题切换器 -->
      <div class="theme-switcher">
        <div class="theme-swatch" data-theme="splatoon" title="喷喷风 · 黄粉"></div>
        <div class="theme-swatch" data-theme="tokyo" title="霓虹东京 · 橙紫"></div>
      </div>
    `;

    // 应用已保存的主题
    setTheme(currentTheme());

    // 模式按钮
    this.layer.querySelectorAll('.mode-card').forEach(btn => {
      btn.addEventListener('click', () => {
        if (btn.classList.contains('mode-card--disabled')) return;
        const mode = btn.dataset.mode;
        this.onStart(mode);
      });
    });

    // 主题切换
    this.layer.querySelectorAll('.theme-swatch').forEach(el => {
      el.addEventListener('click', () => setTheme(el.dataset.theme));
    });
  }

  hide() {
    this.layer.classList.add('hidden');
    this.layer.classList.remove('menu-mode');
  }
}
