# 标枪单词对战 · Javelin Word Duel

> 输入英文单词 = 释放攻击标枪。把"背单词"和"动作对战"缝合起来的轻量浏览器游戏。

## 快速启动

**零构建**，刷新即玩。

### 方式一：统一服务器（推荐）

同时提供页面 + WebSocket，一个命令搞定。

```bash
cd server
npm install          # 首次运行
node index.js        # http://localhost:3001
```

### 方式二：Python HTTP + Node WebSocket

如果习惯用 `python -m http.server`，可以用启动脚本自动拉起两个服务：

```bash
python run.py
# → 页面 http://localhost:8000
# → WebSocket ws://localhost:3001 （自动启动）
```

> **注意**：不能用 `file://` 直接打开 —— ES modules + import map 需要 HTTP 协议。PVP 模式依赖 WebSocket 服务器（端口 3001），无论哪种方式都需要先启动服务端。

## 项目结构

```
word_game/
├── index.html                入口 + HUD DOM + import map
├── styles.css                全部样式（Splatoon 飓虹 + 移动优先）
├── main.js                   引导 + 主循环 + 场景路由
├── run.py                    一键启动脚本（HTTP + WebSocket）
├── GAME_PROMPTS.md           模块化 prompt pack（设计源头）
├── server/
│   ├── index.js              Node.js WebSocket 服务器 + 静态文件服务
│   └── package.json          依赖：ws
├── game/
│   ├── config.js             配置常量（HP、伤害、眩晕阈值、PVP 地址）
│   ├── words.js              30 词词库（CEFR A1，6 主题）
│   ├── state.js              全局状态 + 事件总线
│   ├── network.js            WebSocket 客户端封装
│   ├── systems/
│   │   └── combat.js         战斗逻辑（纯函数）
│   ├── three/
│   │   ├── arena.js          Three.js 场景（灯光 / 玩家 / 敌人 / 靶子）
│   │   └── wordProjectile.js 标枪发射 / 飞行 / 命中动画
│   ├── ui/
│   │   └── hud.js            HUD 更新（订阅 state 事件，血条 / 计时 / 连击）
│   └── scenes/
│       ├── menu.js           主菜单（2D 涂鸦杂志风 + 主题切换）
│       ├── training.js       训练模式
│       ├── pve.js            PVE 闯关模式
│       └── pvp.js            PVP 在线对战模式
├── assets/
│   ├── bg/                   场景背景图
│   ├── generated/            AI 生成素材
│   ├── mascot_squid_alpha.png  黄鱿鱼 mascot
│   └── mascot_octopus_alpha.png 粉章鱼 mascot
└── docs/                     设计文档 + 截图记录
```

## 功能总览

### 三种游戏模式

| 模式 | 说明 |
|------|------|
| **训练模式** | 无压力练习，连续 20 词打靶，适合熟悉输入节奏 |
| **PVE 闯关** | 对战 AI 敌人，敌人自动攻击，答对扣敌人血，答错/超时扣自己血 |
| **PVP 真人对战** | 在线匹配真人，WebSocket 实时同步，双方同时答题 |

### 核心机制

- **输入即攻击**：输入正确的英文单词发射标枪，词长 = 基础伤害
- **连击系统**：
  - 连续答对 ≥3 次 → 眩晕敌人（停止攻击 2 秒）
  - 连续答对 ≥5 次 → 伤害 ×1.5 加成
  - 连击数实时显示在屏幕中央
- **超时惩罚**：每个词有 8 秒输入时限，超时视同答错
- **倒计时进度条**：顶部进度条 + 秒数显示，低于 30% 时变红闪烁

### HUD 系统

- 双方血条（顶部对峙显示）
- 每词倒计时进度条（含秒数显示）
- 连击数浮层
- 伤害飘字 + 屏幕震动反馈
- 输入正确/错误视觉反馈（输入框变色 + 抖动）

### 主题切换

游戏支持两套视觉主题，右下角可切换：

| 主题 | 风格 |
|------|------|
| **Splatoon** | 奶油米白底 + 黄粉阵营色，喷射战士风格 |
| **Tokyo** | 深紫底 + 橙紫霓虹，80s synthwave 风格 |

### 移动端适配

- 触屏软键盘 + 提交按钮
- 输入框失焦自动重聚焦（防键盘收起）
- 响应式布局，支持各类屏幕尺寸

## 技术栈

| 技术 | 用途 |
|------|------|
| **Three.js** (CDN importmap) | 3D 场景渲染（玩家/敌人/标枪飞行） |
| **原生 HTML/CSS/JS** | UI 层 + 业务逻辑，零构建 |
| **WebSocket (ws)** | PVP 在线对战通信 |
| **requestAnimationFrame** | 主循环驱动（帧级 tick） |
| **事件驱动架构** | state.js 事件总线解耦各模块 |

## 调参位置

所有数值集中在 `game/config.js`：

```js
CONFIG.PLAYER.MAX_HP              // 玩家血量（默认 100）
CONFIG.PLAYER.DAMAGE_ON_TIMEOUT   // 超时/答错受到的伤害（默认 10）
CONFIG.ENEMY_TYPES.normal.hp      // 普通怪血量（默认 60）
CONFIG.ENEMY_TYPES.normal.damage  // 普通怪攻击伤害（默认 8）
CONFIG.COMBAT.INPUT_TIMEOUT_MS    // 输入超时时间（默认 8000ms）
CONFIG.COMBAT.COMBO_STUN_THRESHOLD // 眩晕连击阈值（默认 3）
CONFIG.COMBAT.COMBO_BONUS_DAMAGE_THRESHOLD // 伤害加成阈值（默认 5）
CONFIG.FX.JAVELIN_SPEED           // 标枪飞行速度
CONFIG.FX.CAMERA_SHAKE_ON_HIT     // 命中震屏强度
CONFIG.FX.CAMERA_SHAKE_ON_DAMAGE  // 受伤震屏强度
CONFIG.PVP.SERVER_URL             // PVP WebSocket 服务器地址
```

## 操作方式

| 设备 | 输入方式 |
|------|---------|
| 桌面 | 键盘输入英文 + Enter 提交 |
| 移动 | 触屏软键盘 + ⚡ 提交按钮 |

## 词库

内置 30 个 CEFR A1 级别常用词，覆盖 6 个主题：

| 主题 | 词汇示例 |
|------|---------|
| food | apple, banana, bread, water, coffee |
| travel | train, plane, hotel, ticket, beach |
| animal | cat, dog, bird, tiger, fish |
| color | red, blue, green, yellow, black |
| family | mother, father, sister, brother, friend |
| action | run, jump, eat, drink, sleep |

每个词包含：英文、中文释义、词性、主题、难度、例句、音标。

## 后续计划

- [ ] 更多关卡（精英怪 + Boss 多阶段）
- [ ] 音效（type / hit / miss / win）
- [ ] 结算页金币 / 经验系统
- [ ] 词库扩展到 200 → 500 词
- [ ] 皮肤系统 + 商店
- [ ] 排行榜
- [ ] 主题分类练习模式

## License

Personal project.
