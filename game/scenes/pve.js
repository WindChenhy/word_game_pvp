// === PVE 模式：玩家血条 vs 敌人血条，连击 / 眩晕 / 结算 ===

import { state, EVENTS } from '../state.js';
import { pickWord } from '../words.js';
import { submitAnswer, enemyAttackTick, checkInputTimeout } from '../systems/combat.js';
import { CONFIG, SCENES } from '../config.js';

export class PveScene {
  constructor({ arena, projectiles, hud, menu }) {
    this.arena = arena;
    this.projectiles = projectiles;
    this.hud = hud;
    this.menu = menu;
  }

  enter(stageIndex = 0) {
    document.getElementById('scene-layer').classList.add('hidden');
    state.reset();
    state.setScene(SCENES.PVE);

    const enemyType = stageIndex === 0 ? 'normal' : 'elite';
    const cfg = CONFIG.ENEMY_TYPES[enemyType];
    state.enemy = {
      type: enemyType,
      hp: cfg.hp,
      maxHp: cfg.hp,
      attackInterval: cfg.attackInterval,
      damage: cfg.damage,
    };

    this.arena._clearEnemy();
    this.arena._setupEnemy();
    this.menu.hide();
    document.getElementById('scene-bg').style.backgroundImage = "url('./assets/bg/pve_bg.jpg')";
    this._mountMagazine('pve');
    this.hud.show(true);
    this.hud.bind();
    this.hud.setSceneInfo(`第 ${stageIndex + 1} 关 · ${enemyType === 'normal' ? '普通怪' : '精英怪'}`);

    this._unbind = [];
    // 命中视觉反馈（缩放/tint/数字 popup）改由 projectiles.onHit 触发，
    // 避免和 ENEMY_HIT 事件双触发。ENEMY_HIT 仍由 hud.js 监听（更新血条）
    this._unbind.push(state.on(EVENTS.PLAYER_HIT, (e) => {
      this.arena.hitPlayer(e?.amount || 0);
      this.arena.shake(CONFIG.FX.CAMERA_SHAKE_ON_DAMAGE);
    }));
    this._unbind.push(state.on(EVENTS.PLAYER_DEAD, () => this._finish(false)));
    this._unbind.push(state.on(EVENTS.ENEMY_DEAD, () => {
      setTimeout(() => this._finish(true), 900);
    }));
    this._unbind.push(state.on(EVENTS.STUN_START, ({ until }) => {
      this.arena.setStunVfx(true);
      const remain = until - performance.now();
      setTimeout(() => this.arena.setStunVfx(false), remain);
    }));

    this._nextWord();
  }

  exit() {
    this.hud.show(false);
    this.hud.unbind();
    this._unbind.forEach(fn => fn && fn());
    this._unbind = [];
    this.projectiles.clear();
    document.getElementById('scene-bg').style.backgroundImage = '';
    this._unmountMagazine();
    this.menu.render();
  }

  _mountMagazine(kind) {
    this._unmountMagazine();
    const wrap = document.createElement('div');
    wrap.className = 'scene-bg-magazine';
    wrap.innerHTML = `
      <div class="magazine-title magazine-title--pve">BATTLE!</div>
      <div class="magazine-subtitle magazine-subtitle--pve">let's duel!</div>
      <div class="magazine-corner magazine-corner--bl">STAGE 1 · NORMAL</div>
      <div class="magazine-corner magazine-corner--br">60 HP</div>
    `;
    document.getElementById('app').appendChild(wrap);
  }

  _unmountMagazine() {
    const el = document.querySelector('.scene-bg-magazine');
    if (el) el.remove();
  }

  tick(dt, now) {
    if (state.scene !== SCENES.PVE) return;
    if (!state.enemy || state.enemy.hp <= 0) return;
    if (state.player.hp <= 0) return;
    enemyAttackTick(now);
    checkInputTimeout(now);
  }

  _nextWord() {
    state.setWord(pickWord());
  }

  onSubmit(rawInput) {
    const result = submitAnswer(rawInput);
    if (result.ok) {
      this.hud.showInputCorrect();
      // 炮口闪光
      this.arena.playerFireFlash();
      // 单词作为实体飞向敌人
      const dmg = result.word.word.length;
      this.projectiles.fire(
        result.word.word,
        this.arena.player,
        this.arena.enemy,
        () => {
          // 命中瞬间立刻弹伤害数字 + 震动
          this.arena.hitEnemy(dmg);
          this.arena.shake(CONFIG.FX.CAMERA_SHAKE_ON_HIT);
        }
      );
      setTimeout(() => {
        if (state.scene === SCENES.PVE && state.enemy && state.enemy.hp > 0 && state.player.hp > 0) {
          this._nextWord();
        }
      }, 500);
    } else {
      this.hud.showInputError();
      setTimeout(() => {
        if (state.scene === SCENES.PVE && state.enemy && state.enemy.hp > 0 && state.player.hp > 0) {
          this._nextWord();
        }
      }, 700);
    }
  }

  _finish(win) {
    const stats = state.sessionStats;
    const accuracy = stats.hits + stats.misses > 0
      ? Math.round((stats.hits / (stats.hits + stats.misses)) * 100)
      : 0;

    const layer = document.getElementById('scene-layer');
    layer.classList.remove('hidden');
    layer.innerHTML = `
      <div class="scene-card">
        <div class="result-title ${win ? 'win' : 'lose'}">${win ? '胜利' : '失败'}</div>
        <div class="scene-stats">
          <div class="scene-stat">
            <div class="scene-stat-val">${stats.damageDealt}</div>
            <div class="scene-stat-label">总伤害</div>
          </div>
          <div class="scene-stat">
            <div class="scene-stat-val">${accuracy}%</div>
            <div class="scene-stat-label">命中率</div>
          </div>
          <div class="scene-stat">
            <div class="scene-stat-val">${state.maxCombo}</div>
            <div class="scene-stat-label">最高连击</div>
          </div>
        </div>
        ${win ? '<div class="scene-subtitle">+ 30 金币 · + 20 经验</div>' : ''}
        <div class="scene-btn-group">
          <button class="scene-btn" id="back-menu">回到主菜单</button>
          ${win ? '<button class="scene-btn" id="next-stage" disabled>下一关 · 即将开放</button>' : '<button class="scene-btn" id="retry-pve">再战一次</button>'}
        </div>
      </div>
    `;
    layer.querySelector('#back-menu').addEventListener('click', () => this.exit());
    if (!win) {
      layer.querySelector('#retry-pve').addEventListener('click', () => this.enter(0));
    }
  }
}