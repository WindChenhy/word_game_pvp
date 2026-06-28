// === HUD 更新：订阅 state 事件并刷新 DOM ===
// 不持有判定逻辑

import { state, EVENTS } from '../state.js';
import { CONFIG } from '../config.js';

export class HUD {
  constructor() {
    this.hudEl = document.getElementById('hud');
    this.enemyHpFill = document.getElementById('enemy-hp-fill');
    this.enemyHpText = document.getElementById('enemy-hp-text');
    this.playerHpFill = document.getElementById('player-hp-fill');
    this.playerHpText = document.getElementById('player-hp-text');
    this.promptZh = document.getElementById('prompt-zh');
    this.promptTheme = document.getElementById('prompt-theme');
    this.sceneInfo = document.getElementById('scene-info');
    this.comboDisplay = document.getElementById('combo-display');
    this.comboNum = document.getElementById('combo-num');
    this.timerFill = document.getElementById('timer-fill');
    this.timerText = document.getElementById('timer-text');
    this.hudTimer = document.getElementById('hud-timer');
    this.fxLayer = document.getElementById('fx-layer');
    this.inputEl = document.getElementById('word-input');
    this.submitBtn = document.getElementById('submit-btn');

    this._unbind = [];
    this._stunActive = false;
  }

  show(show = true) {
    this.hudEl.hidden = !show;
  }

  bind() {
    this._unbind.push(state.on(EVENTS.WORD_CHANGE, (w) => this._renderWord(w)));
    this._unbind.push(state.on(EVENTS.PLAYER_HIT, (e) => this._onPlayerHit(e)));
    this._unbind.push(state.on(EVENTS.ENEMY_HIT, (e) => this._onEnemyHit(e)));
    this._unbind.push(state.on(EVENTS.COMBO_CHANGE, (c) => this._renderCombo(c)));
    this._unbind.push(state.on(EVENTS.STUN_START, () => {
      this._stunActive = true;
      this._floatTextCenter('⚡ 眩晕！', 'stun');
    }));
    this._unbind.push(state.on(EVENTS.PLAYER_DEAD, () => this._renderDead()));
  }

  unbind() {
    this._unbind.forEach(fn => fn && fn());
    this._unbind = [];
    this._stunActive = false;
  }

  /** 设置场景信息（左下角） */
  setSceneInfo(text) {
    this.sceneInfo.textContent = text;
  }

  /** 帧级更新（HP / 计时） */
  tick(now = performance.now()) {
    const playerPct = (state.player.hp / state.player.maxHp) * 100;
    this.playerHpFill.style.width = `${playerPct}%`;
    this.playerHpText.textContent = `${state.player.hp}/${state.player.maxHp}`;

    if (state.enemy) {
      const enemyPct = (state.enemy.hp / state.enemy.maxHp) * 100;
      this.enemyHpFill.style.width = `${enemyPct}%`;
      this.enemyHpText.textContent = `${state.enemy.hp}/${state.enemy.maxHp}`;
    }

    if (state.inputDeadline > 0) {
      const remaining = Math.max(0, state.inputDeadline - now);
      const totalMs = CONFIG.COMBAT.INPUT_TIMEOUT_MS;
      const ratio = Math.min(1, remaining / totalMs);
      this.timerFill.style.transform = `scaleX(${ratio})`;
      if (ratio < 0.3) {
        this.timerFill.classList.add('danger');
        this.hudTimer.classList.add('danger');
      } else {
        this.timerFill.classList.remove('danger');
        this.hudTimer.classList.remove('danger');
      }
      this.timerText.textContent = Math.ceil(remaining / 1000);
    } else {
      this.timerFill.style.transform = 'scaleX(0)';
      this.hudTimer.classList.remove('danger');
      this.timerText.textContent = '';
    }
  }

  _renderWord(w) {
    this.promptZh.textContent = w.zh;
    this.promptTheme.textContent = w.theme.join(' · ');
    if (!this._stunActive) {
      this.sceneInfo.textContent = w.theme[0] || '';
    }
    this.inputEl.value = '';
    this.inputEl.classList.remove('correct', 'wrong');
    this.inputEl.focus();
    // 新词到达时重置计时条为满格
    this.timerFill.style.transform = 'scaleX(1)';
    this.timerFill.classList.remove('danger');
    this.hudTimer.classList.remove('danger');
    this.timerText.textContent = Math.ceil(CONFIG.COMBAT.INPUT_TIMEOUT_MS / 1000);
  }

  _renderCombo(c) {
    this.comboNum.textContent = c;
    if (c >= 2) {
      this.comboDisplay.classList.add('active');
      // 连击越高弹得越猛
      const boost = Math.min(0.5, c * 0.08);
      this.comboDisplay.style.transform = `translateX(-50%) scale(${1.35 + boost})`;
      // 增加金色脉冲动画
      this.comboDisplay.classList.remove('pulse');
      void this.comboDisplay.offsetWidth;  // 强制 reflow 重启动画
      this.comboDisplay.classList.add('pulse');
      setTimeout(() => {
        this.comboDisplay.style.transform = 'translateX(-50%) scale(1)';
      }, 220);
    } else {
      this.comboDisplay.classList.remove('active');
      this.comboDisplay.classList.remove('pulse');
    }
  }

  _renderDead() {
    this.inputEl.disabled = true;
  }

  _onPlayerHit({ amount }) {
    this._flash('danger');
    this._floatText(`-${amount}`, 'damage', 70, 60);
  }

  _onEnemyHit({ amount }) {
    this._floatText(`-${amount}`, 'damage', 30, 60);
  }

  _flash(kind = '') {
    const el = document.createElement('div');
    el.className = `fx-flash ${kind}`;
    this.fxLayer.appendChild(el);
    setTimeout(() => el.remove(), 280);
  }

  _floatText(text, kind = '', x = 50, y = 50) {
    const el = document.createElement('div');
    el.className = `fx-float ${kind}`;
    el.textContent = text;
    el.style.left = `${x}%`;
    el.style.top = `${y}%`;
    this.fxLayer.appendChild(el);
    setTimeout(() => el.remove(), 1200);
  }

  _floatTextCenter(text, kind = '') {
    this._floatText(text, kind, 50, 45);
  }

  showInputError() {
    this.inputEl.classList.add('wrong');
    setTimeout(() => this.inputEl.classList.remove('wrong'), 400);
  }

  showInputCorrect() {
    this.inputEl.classList.add('correct');
    setTimeout(() => this.inputEl.classList.remove('correct'), 220);
  }
}