// === Config: 全局常量与可调参数 ===
// 所有 balance / 数值都在这里集中调，方便 playtest 微调

export const CONFIG = {
  // 玩家
  PLAYER: {
    MAX_HP: 100,
    DAMAGE_ON_TIMEOUT: 10,
    ATTACK_INTERVAL_MS: 3000, // PVE 中敌人攻击间隔（仅参考，逻辑在 combat.js）
  },

  // 敌人（按类型）
  ENEMY_TYPES: {
    normal: { hp: 60, attackInterval: 3000, damage: 8, color: 0xff4d6d, size: 1.0 },
    elite:  { hp: 120, attackInterval: 2000, damage: 12, color: 0xff8a5b, size: 1.2 },
    boss:   { hp: 300, attackInterval: 1500, damage: 18, color: 0xff4757, size: 1.8 },
  },

  // 伤害公式
  COMBAT: {
    DAMAGE_PER_WORD_LENGTH: 1,       // damage = word.length × multiplier
    COMBO_STUN_THRESHOLD: 3,         // combo >= 3 → 眩晕
    COMBO_STUN_DURATION_MS: 2000,
    COMBO_BONUS_DAMAGE_THRESHOLD: 5, // combo >= 5 → 伤害 +50%
    COMBO_BONUS_MULTIPLIER: 1.5,
    INPUT_TIMEOUT_MS: 8000,          // 输入框超时（视为失败）
  },

  // 视觉
  FX: {
    JAVELIN_SPEED: 18,                // units/s
    JAVELIN_LIFETIME: 1.5,
    CAMERA_SHAKE_ON_HIT: 0.15,
    CAMERA_SHAKE_ON_DAMAGE: 0.25,
  },

  // 场景（横版格斗布局：玩家在 -X，敌人在 +X，相机在 +Z 远端）
  SCENE: {
    ARENA_WIDTH: 14,
    ARENA_DEPTH: 8,
    PLAYER_X: -5,
    ENEMY_X: 5,
  },

  // 输入归一化
  INPUT: {
    NORMALIZE: true,                  // trim + lowercase + unicode normalize
  },

  // PVP 模式
  PVP: {
    SERVER_URL: `ws://${window.location.hostname}:3001`,
  },

  // Supabase Realtime 配置（用于 Vercel 部署）
  SUPABASE: {
    URL: 'https://spmoyhabfpoovteowrdb.supabase.co',
    KEY: 'sb_publishable_Wd3R0sTMPeXtgaDnUnwKpg_f4RsOqHY',
  },
};

// 自动检测部署模式：Vercel 环境使用 Supabase Realtime，本地使用 WebSocket
const isVercel = window.location.hostname.endsWith('.vercel.app');
export const PVP_MODE = isVercel ? 'supabase' : 'websocket';

export const COLORS = {
  BG_TOP: 0x0b0d12,
  BG_BOTTOM: 0x1a1f2c,
  GROUND: 0x1a2030,
  GRID: 0x2a3040,
  PLAYER: 0x4cc9f0,
  PLAYER_GLOW: 0x00ffb3,
  ENEMY: 0xff4d6d,
  JAVELIN: 0x00ffb3,
  JAVELIN_HIT: 0xffd166,
  TEXT: 0xe6edf3,
};

export const SCENES = {
  MENU: 'menu',
  TRAINING: 'training',
  PVE: 'pve',
  RESULT: 'result',
};
