import { state, EVENTS } from '../state.js';
import { NetworkClient } from '../network.js';
import { CONFIG } from '../config.js';

const PVP_STATE = {
  CONNECTING: 'connecting',
  MATCHMAKING: 'matchmaking',
  BATTLE: 'battle',
  RESULT: 'result',
};

export class PvpScene {
  constructor({ arena, projectiles, hud, menu }) {
    this.arena = arena;
    this.projectiles = projectiles;
    this.hud = hud;
    this.menu = menu;
    this.net = new NetworkClient();
    this._pvpState = null;
    this._side = null;
    this._pendingAnswer = false;
    this._unbindNet = [];
  }

  enter() {
    // Clean any previous connection before starting fresh
    this.net.disconnect();
    this._unbindNet.forEach(fn => fn());
    this._unbindNet = [];

    this._pvpState = PVP_STATE.CONNECTING;
    this._side = null;
    this._pendingAnswer = false;
    this._connectAttempt = 0;
    this._hits = 0;
    this._misses = 0;

    document.getElementById('scene-layer').classList.add('hidden');
    state.reset();
    state.setScene('pvp');
    this.menu.hide();
    this.hud.show(false);
    document.getElementById('scene-bg').style.backgroundImage = "url('./assets/bg/pve_bg.jpg')";

    this._showConnecting();
    this._doConnect();
  }

  exit() {
    this._connectAttempt++;
    this.arena._clearEnemy();
    this.hud.show(false);
    this.hud.unbind();
    this.projectiles.clear();
    this._unbindNet.forEach(fn => fn());
    this._unbindNet = [];
    this.net.disconnect();
    document.getElementById('scene-bg').style.backgroundImage = '';
    this._unmountMagazine();
    this.menu.render();
  }

  _doConnect() {
    this._connectAttempt++;

    // Detect file:// protocol which blocks WebSocket connections
    if (window.location.protocol === 'file:') {
      this._showConnectionError('无法在 file:// 协议下连接服务器，请使用 HTTP 服务器（如 npx http-server 或 python -m http.server）打开页面');
      return;
    }
    const attempt = this._connectAttempt;
    this.net.connect(CONFIG.PVP.SERVER_URL)
      .then(() => {
        if (attempt !== this._connectAttempt) return;
        this._pvpState = PVP_STATE.MATCHMAKING;
        this._showMatchmaking();
        this._bindEvents();
        this.net.send({ type: 'find_match' });
      })
      .catch((err) => {
        if (attempt !== this._connectAttempt) return;
        console.warn('[PVP] Connection failed:', err?.message || err);
        this._showConnectionError(err?.message || '未知错误');
      });
  }

  _bindEvents() {
    this._unbindNet.push(this.net.on('matched', (msg) => {
      this._side = msg.side;
    }));

    this._unbindNet.push(this.net.on('game_start', () => {
      this._side = this._side;
      state.player.hp = 100;
      state.player.maxHp = 100;
      state.enemy = { hp: 100, maxHp: 100 };
      this._pendingAnswer = false;
      this._startBattle();
    }));

    this._unbindNet.push(this.net.on('new_word', (msg) => {
      this._pendingAnswer = false;
      state.setWord(msg.word);
    }));

    this._unbindNet.push(this.net.on('hit', (msg) => {
      if (msg.attacker === this._side) {
        this._hits++;
        state.sessionStats.hits = this._hits;
        this.hud.showInputCorrect();
        this.arena.playerFireFlash();
        this.projectiles.fire(
          msg.word,
          this.arena.player,
          this.arena.enemy,
          () => {
            this.arena.hitEnemy(msg.damage);
            this.arena.shake(CONFIG.FX.CAMERA_SHAKE_ON_HIT);
          }
        );
      }
      if (msg.victim === this._side) {
        this.arena.hitPlayer(msg.damage);
        this.arena.shake(CONFIG.FX.CAMERA_SHAKE_ON_DAMAGE);
      }
    }));

    this._unbindNet.push(this.net.on('self_hit', (msg) => {
      if (msg.player === this._side) {
        this._misses++;
        state.sessionStats.misses = this._misses;
        this.hud.showInputError();
        this.arena.hitPlayer(msg.damage);
        this.arena.shake(CONFIG.FX.CAMERA_SHAKE_ON_DAMAGE);
      }
    }));

    this._unbindNet.push(this.net.on('hp_update', (msg) => {
      if (this._side === 'player1') {
        state.player.hp = msg.player1_hp;
        state.enemy.hp = msg.player2_hp;
      } else {
        state.player.hp = msg.player2_hp;
        state.enemy.hp = msg.player1_hp;
      }
    }));

    this._unbindNet.push(this.net.on('game_over', (msg) => {
      this._finish(msg.winner === this._side, msg.reason);
    }));

    this._unbindNet.push(this.net.on('disconnected', () => {
      if (this._pvpState === PVP_STATE.BATTLE) {
        this._finish(false, 'disconnect');
      } else {
        this._showConnectionError();
      }
    }));
  }

  _showConnecting() {
    const layer = document.getElementById('scene-layer');
    layer.classList.remove('hidden');
    layer.innerHTML = `
      <div class="scene-card">
        <div class="pvp-icon pvp-icon--connecting"><span class="pvp-icon-emoji">🔗</span></div>
        <div class="result-title">连接中...</div>
        <div class="scene-subtitle">正在连接到对战服务器</div>
        <div class="scene-btn-group">
          <button class="scene-btn" id="pvp-back-menu">返回主菜单</button>
        </div>
      </div>
    `;
    layer.querySelector('#pvp-back-menu').addEventListener('click', () => this.exit());
  }

  _showMatchmaking() {
    const layer = document.getElementById('scene-layer');
    layer.classList.remove('hidden');
    layer.innerHTML = `
      <div class="scene-card">
        <div class="pvp-icon pvp-icon--searching"><span class="pvp-icon-emoji">🔍</span></div>
        <div class="result-title">寻找对手中...</div>
        <div class="scene-subtitle">正在匹配实力相近的玩家</div>
        <div class="pvp-dots"><span>.</span><span>.</span><span>.</span></div>
        <div class="scene-btn-group">
          <button class="scene-btn" id="pvp-cancel-match">取消匹配</button>
        </div>
      </div>
    `;
    layer.querySelector('#pvp-cancel-match').addEventListener('click', () => {
      this.net.send({ type: 'cancel_match' });
      this.exit();
    });
  }

  _showConnectionError(errMsg = '') {
    const layer = document.getElementById('scene-layer');
    layer.classList.remove('hidden');
    const hint = errMsg
      ? `<div class="scene-subtitle error-detail">${errMsg}</div>`
      : '';
    layer.innerHTML = `
      <div class="scene-card">
        <div class="pvp-icon pvp-icon--error"><span class="pvp-icon-emoji">⚠️</span></div>
        <div class="result-title lose">连接失败</div>
        <div class="scene-subtitle">无法连接到对战服务器</div>
        ${hint}
        <div class="scene-btn-group">
          <button class="scene-btn" id="pvp-retry">重试</button>
          <button class="scene-btn" id="pvp-back-menu-err">返回主菜单</button>
        </div>
      </div>
    `;
    layer.querySelector('#pvp-retry').addEventListener('click', () => {
      this.net.disconnect();
      this._pvpState = PVP_STATE.CONNECTING;
      this._showConnecting();
      this._doConnect();
    });
    layer.querySelector('#pvp-back-menu-err').addEventListener('click', () => this.exit());
  }

  _startBattle() {
    this._pvpState = PVP_STATE.BATTLE;
    document.getElementById('scene-layer').classList.add('hidden');
    state.setScene('pvp');

    this.arena._clearEnemy();
    this.arena._setupEnemy();

    this.hud.show(true);
    this.hud.bind();
    this.hud.setSceneInfo('PVP · 真人对抗');
    this._mountMagazine();
  }

  _mountMagazine() {
    this._unmountMagazine();
    const wrap = document.createElement('div');
    wrap.className = 'scene-bg-magazine';
    wrap.innerHTML = `
      <div class="magazine-title magazine-title--pve">PVP BATTLE!</div>
      <div class="magazine-subtitle magazine-subtitle--pve">real-time duel</div>
    `;
    document.getElementById('app').appendChild(wrap);
  }

  _unmountMagazine() {
    const el = document.querySelector('.scene-bg-magazine');
    if (el) el.remove();
  }

  tick(dt, now) {
    if (this._pvpState !== PVP_STATE.BATTLE) return;
    if (!this._pendingAnswer && state.inputDeadline > 0 && now > state.inputDeadline) {
      this._pendingAnswer = true;
      this.net.send({ type: 'submit_answer', word: '' });
    }
  }

  onSubmit(rawInput) {
    if (this._pvpState !== PVP_STATE.BATTLE || this._pendingAnswer) return;
    this._pendingAnswer = true;
    this.net.send({ type: 'submit_answer', word: rawInput });
  }

  _finish(won, reason) {
    this._pvpState = PVP_STATE.RESULT;
    const subtitle = reason === 'disconnect'
      ? '对手已断开连接'
      : won ? '恭喜你赢得了比赛！' : '再接再厉，下次一定！';

    const layer = document.getElementById('scene-layer');
    layer.classList.remove('hidden');
    layer.innerHTML = `
      <div class="scene-card">
        <div class="result-title ${won ? 'win' : 'lose'}">${won ? '胜利' : '失败'}</div>
        <div class="scene-stats">
          <div class="scene-stat">
            <div class="scene-stat-val">${state.sessionStats.hits}</div>
            <div class="scene-stat-label">答对</div>
          </div>
          <div class="scene-stat">
            <div class="scene-stat-val">${state.sessionStats.misses}</div>
            <div class="scene-stat-label">答错</div>
          </div>
          <div class="scene-stat">
            <div class="scene-stat-val">${state.maxCombo}</div>
            <div class="scene-stat-label">最高连击</div>
          </div>
        </div>
        <div class="scene-subtitle">${subtitle}</div>
        <div class="scene-btn-group">
          <button class="scene-btn" id="pvp-back-result">返回主菜单</button>
        </div>
      </div>
    `;
    layer.querySelector('#pvp-back-result').addEventListener('click', () => this.exit());
  }
}
