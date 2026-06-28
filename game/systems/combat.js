// === 战斗逻辑：纯函数，deterministic ===
// 所有伤害 / 连击 / 眩晕的规则都在这里
// UI / Three.js 只读取结果，不参与判定

import { CONFIG } from '../config.js';
import { state, EVENTS } from '../state.js';
import { checkAnswer } from '../words.js';

/**
 * 玩家提交答案
 * @returns {{ ok: boolean, damage?: number, word?: object, reason?: string }}
 */
export function submitAnswer(rawInput) {
  if (!state.currentWord) return { ok: false, reason: 'no_word' };
  const input = state.normalizeInput(rawInput);
  const word = state.currentWord;

  if (!checkAnswer(input, word.word)) {
    // 答错：连击断 + 玩家挨打
    state.combo = 0;
    state.emit(EVENTS.COMBO_CHANGE, 0);
    state.sessionStats.misses += 1;
    const dmg = CONFIG.PLAYER.DAMAGE_ON_TIMEOUT;
    damagePlayer(dmg, 'wrong_answer');
    return { ok: false, reason: 'wrong' };
  }

  // 答对
  state.combo += 1;
  state.maxCombo = Math.max(state.maxCombo, state.combo);
  state.emit(EVENTS.COMBO_CHANGE, state.combo);
  state.sessionStats.hits += 1;
  state.sessionStats.correctWords.push(word.word);

  // 计算伤害 = 词长度 × (combo >= 5 ? 1.5 : 1)
  const multiplier = state.combo >= CONFIG.COMBAT.COMBO_BONUS_DAMAGE_THRESHOLD
    ? CONFIG.COMBAT.COMBO_BONUS_MULTIPLIER
    : 1;
  const damage = Math.round(word.word.length * CONFIG.COMBAT.DAMAGE_PER_WORD_LENGTH * multiplier);

  damageEnemy(damage, word);

  // 连击眩晕
  if (state.combo >= CONFIG.COMBAT.COMBO_STUN_THRESHOLD) {
    triggerStun();
  }

  return { ok: true, damage, word };
}

/**
 * 敌人攻击（每隔 ATTACK_INTERVAL_MS 调用）
 */
export function enemyAttackTick(now = performance.now()) {
  if (!state.enemy || state.enemy.hp <= 0) return;
  if (state.scene !== 'pve') return;
  if (state.isStunned(now)) return;

  const interval = state.enemy.attackInterval || 3000;
  if (now - state.lastEnemyAttack < interval) return;

  state.lastEnemyAttack = now;
  const dmg = state.enemy.damage || 10;
  damagePlayer(dmg, 'enemy_attack');
}

function damagePlayer(amount, reason) {
  state.player.hp = Math.max(0, state.player.hp - amount);
  state.sessionStats.damageTaken += amount;
  state.emit(EVENTS.PLAYER_HIT, { amount, reason });

  if (state.player.hp <= 0) {
    state.emit(EVENTS.PLAYER_DEAD, state.sessionStats);
  }
}

function damageEnemy(amount, word) {
  if (!state.enemy) return;
  state.enemy.hp = Math.max(0, state.enemy.hp - amount);
  state.sessionStats.damageDealt += amount;
  state.emit(EVENTS.ENEMY_HIT, { amount, word });

  if (state.enemy.hp <= 0) {
    state.emit(EVENTS.ENEMY_DEAD, state.sessionStats);
  }
}

function triggerStun() {
  state.stunUntil = performance.now() + CONFIG.COMBAT.COMBO_STUN_DURATION_MS;
  state.emit(EVENTS.STUN_START, { until: state.stunUntil });
}

/**
 * 输入超时（INPUT_TIMEOUT_MS 内无提交）
 */
export function checkInputTimeout(now = performance.now()) {
  if (!state.currentWord) return;
  if (state.scene !== 'pve') return;
  if (now > state.inputDeadline) {
    state.inputDeadline = now + CONFIG.COMBAT.INPUT_TIMEOUT_MS;
    // 视同答错
    submitAnswer('');
  }
}

/**
 * 训练模式专用：只判对错，不计入战斗
 */
export function submitAnswerTraining(rawInput) {
  if (!state.currentWord) return { ok: false };
  const input = state.normalizeInput(rawInput);
  const word = state.currentWord;

  if (!checkAnswer(input, word.word)) {
    state.combo = 0;
    state.emit(EVENTS.COMBO_CHANGE, 0);
    return { ok: false, word };
  }
  state.combo += 1;
  state.maxCombo = Math.max(state.maxCombo, state.combo);
  state.emit(EVENTS.COMBO_CHANGE, state.combo);
  return { ok: true, word };
}