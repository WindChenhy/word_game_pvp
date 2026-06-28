// === 训练模式：单词作为实体飞向靶子，无战斗压力 ===

import { state, EVENTS } from '../state.js';
import { pickSession } from '../words.js';
import { submitAnswerTraining } from '../systems/combat.js';
import { SCENES } from '../config.js';

export class TrainingScene {
  constructor({ arena, projectiles, hud, menu }) {
    this.arena = arena;
    this.projectiles = projectiles;
    this.hud = hud;
    this.menu = menu;
    this.words = pickSession(20);
    this.index = 0;
    this.score = 0;
  }

  enter() {
    state.reset();
    state.setScene(SCENES.TRAINING);
    state.player.hp = 9999;
    state.player.maxHp = 9999;
    this.arena.setupTrainingTarget();
    this.hud.show(true);
    this.hud.bind();
    this.hud.setSceneInfo('训练模式 · 20 词');
    this.menu.hide();
    document.getElementById('scene-bg').style.backgroundImage = "url('./assets/bg/training_bg.jpg')";
    this._mountMagazine('training');
    this._nextWord();

    this._unbind = [];
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
    // 始终先清掉旧的（防止中途切换模式残留）
    this._unmountMagazine();
    const wrap = document.createElement('div');
    wrap.className = 'scene-bg-magazine';
    if (kind === 'training') {
      wrap.innerHTML = `
        <div class="magazine-title magazine-title--training">TRAIN!</div>
        <div class="magazine-subtitle magazine-subtitle--training">打靶 time~</div>
        <div class="magazine-corner magazine-corner--bl">20 WORDS · NO PRESSURE</div>
        <div class="magazine-corner magazine-corner--br">FREE PRACTICE</div>
      `;
    } else {
      wrap.innerHTML = `
        <div class="magazine-title magazine-title--pve">BATTLE!</div>
        <div class="magazine-subtitle magazine-subtitle--pve">let's duel!</div>
        <div class="magazine-corner magazine-corner--bl">STAGE 1 · NORMAL</div>
        <div class="magazine-corner magazine-corner--br">60 HP</div>
      `;
    }
    document.getElementById('app').appendChild(wrap);
  }

  _unmountMagazine() {
    const el = document.querySelector('.scene-bg-magazine');
    if (el) el.remove();
  }

  _nextWord() {
    if (this.index >= this.words.length) {
      this._finish();
      return;
    }
    state.setWord(this.words[this.index]);
    document.getElementById('player-hp-text').textContent = `${this.index + 1}/${this.words.length}`;
  }

  onSubmit(rawInput) {
    const result = submitAnswerTraining(rawInput);
    if (result.ok) {
      this.score += 1;
      this.hud.showInputCorrect();
      this.arena.playerFireFlash();
      this.projectiles.fire(
        result.word.word,
        this.arena.player,
        this.arena.target,
        () => this.arena.hitTrainingTarget(result.word.word.length)
      );
      this.index += 1;
      setTimeout(() => this._nextWord(), 700);
    } else {
      this.hud.showInputError();
    }
  }

  _finish() {
    const layer = document.getElementById('scene-layer');
    layer.classList.remove('hidden');
    layer.innerHTML = `
      <div class="scene-card">
        <div class="result-title win">训练完成</div>
        <div class="scene-stats">
          <div class="scene-stat">
            <div class="scene-stat-val">${this.score}</div>
            <div class="scene-stat-label">答对</div>
          </div>
          <div class="scene-stat">
            <div class="scene-stat-val">${state.maxCombo}</div>
            <div class="scene-stat-label">最高连击</div>
          </div>
          <div class="scene-stat">
            <div class="scene-stat-val">${this.words.length}</div>
            <div class="scene-stat-label">总数</div>
          </div>
        </div>
        <div class="scene-btn-group">
          <button class="scene-btn" id="back-menu">回到主菜单</button>
          <button class="scene-btn" id="retry-training">再来一轮</button>
        </div>
      </div>
    `;
    layer.querySelector('#back-menu').addEventListener('click', () => this.exit());
    layer.querySelector('#retry-training').addEventListener('click', () => {
      this.words = pickSession(20);
      this.index = 0;
      this.score = 0;
      state.reset();
      state.player.hp = 9999;
      state.player.maxHp = 9999;
      this.arena.setupTrainingTarget();
      this.hud.show(true);
      this.hud.bind();
      layer.classList.add('hidden');
      this._nextWord();
    });
  }
}