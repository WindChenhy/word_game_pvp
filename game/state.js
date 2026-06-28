// === 全局状态 + 简易事件总线 ===
// 单一 source of truth，跨场景共享

import { CONFIG, SCENES } from './config.js';

class GameState {
  constructor() {
    this.scene = SCENES.MENU;          // 当前场景
    this.player = { hp: CONFIG.PLAYER.MAX_HP, maxHp: CONFIG.PLAYER.MAX_HP };
    this.enemy = null;                 // 当前敌人（仅 PVE）
    this.combo = 0;
    this.maxCombo = 0;
    this.stunUntil = 0;
    this.currentWord = null;           // { id, word, zh, theme, ... }
    this.inputBuffer = '';             // 当前输入
    this.inputDeadline = 0;            // 超时时间戳
    this.lastEnemyAttack = performance.now();  // 上次敌人攻击时间戳（init 时刻，避免首次 tick 立即触发）
    this.sessionStats = {
      hits: 0,
      misses: 0,
      damageDealt: 0,
      damageTaken: 0,
      correctWords: [],
    };
    this.listeners = new Map();
  }

  on(event, fn) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event).add(fn);
    return () => this.listeners.get(event).delete(fn);
  }

  emit(event, payload) {
    const set = this.listeners.get(event);
    if (set) for (const fn of set) fn(payload);
  }

  reset() {
    this.scene = SCENES.MENU;
    this.player.hp = CONFIG.PLAYER.MAX_HP;
    this.enemy = null;
    this.combo = 0;
    this.maxCombo = 0;
    this.stunUntil = 0;
    this.currentWord = null;
    this.inputBuffer = '';
    this.inputDeadline = 0;
    this.lastEnemyAttack = 0;
    this.sessionStats = { hits: 0, misses: 0, damageDealt: 0, damageTaken: 0, correctWords: [] };
  }

  setScene(sceneName) {
    this.scene = sceneName;
    this.emit('scene:change', sceneName);
  }

  setWord(word) {
    this.currentWord = word;
    this.inputBuffer = '';
    this.inputDeadline = performance.now() + CONFIG.COMBAT.INPUT_TIMEOUT_MS;
    this.emit('word:change', word);
  }

  /** 输入归一化 */
  normalizeInput(s) {
    return CONFIG.INPUT.NORMALIZE ? s.trim().toLowerCase().normalize('NFC') : s;
  }

  isStunned(now = performance.now()) {
    return now < this.stunUntil;
  }
}

export const state = new GameState();

// 全局事件常量
export const EVENTS = {
  SCENE_CHANGE: 'scene:change',
  WORD_CHANGE: 'word:change',
  PLAYER_ATTACK: 'player:attack',
  ENEMY_HIT: 'enemy:hit',
  ENEMY_DEAD: 'enemy:dead',
  PLAYER_HIT: 'player:hit',
  PLAYER_DEAD: 'player:dead',
  COMBO_CHANGE: 'combo:change',
  STUN_START: 'stun:start',
  INPUT_TIMEOUT: 'input:timeout',
  RESULT: 'result',
};