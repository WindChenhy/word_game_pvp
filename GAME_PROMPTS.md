# 标枪单词对战 — Game Development Prompt Pack

> 用途：把这套 prompt 喂给 `game-development` skill（或任意 LLM 编码 agent），即可按模块驱动出整套游戏的设计文档 / 原型 / 代码。
> 设计原则：每个 prompt 都能**独立运行**（单独给一个 agent 也能落地一个模块），但模块之间用统一的命名和数据结构（`Word / Combo / Skin / Stage / Match`）串起来。

---

## 0. 总览 Prompt（必先跑一次）

```
你是 game-development skill 引擎。请基于以下 Game Design Document，输出一份【可实现的浏览器游戏】完整方案。

## 游戏名
标枪单词对战（Javelin Word Duel）

## 核心 Loop
玩家通过【输入英文单词 / 句子】作为攻击手段，
在三种场景中与对手对战：训练、PVE 闯关、PVP 真人 PK。
答对 = 攻击伤害，答错 / 慢答 = 被攻击。
连击 = 眩晕、控制、特效升级。

## 平台 / 技术栈（默认）
- 浏览器可玩，零构建优先；用 Three.js + 原生 HTML/CSS/JS 或 Vite
- 移动端优先：触屏虚拟键盘 + 全屏布局
- 单局时长 60–120 秒
- 美术：低多边形 + 霓虹轮廓，矢量风格，方便后续 AI 生成扩展

## 必须包含的模块
1. 训练模式（背单词 + 场景造句）
2. PVE 闯关模式
3. PVP 真人 PK
4. 皮肤系统
5. 排行榜
6. 商店

## 交付要求
- 输出：一份 `DESIGN.md`（玩法）+ 一份 `ARCHITECTURE.md`（模块/数据/状态机）+ 一个能 `npm run dev` 跑起来的最小可玩原型
- 原型必须跑通：玩家输入 "apple" → 发射一支标枪 → 命中对手 → 扣血 → 胜利结算

## 约束
- 不用任何需要付费 key 的后端；PVP 用本地双人或 WebRTC P2P 兜底
- 数据本地存储（localStorage / IndexedDB），榜单本地 mock
- 单词库内置一份 500 词基础词表（CEFR A1–B1），按主题分类
```

---

## 1. 训练模式 Prompt

```
## 目标
实现【训练模式】模块，让玩家在没有战斗压力的环境下熟悉输入节奏和单词量。

## 子模式
### 1.1 常规背单词
- 屏幕中央显示一个中文释义（例：苹果）
- 玩家输入英文 `apple` → 正确：标枪飞向目标，绿色爆点 → 错误：红色抖动 + 错误提示
- 模式参考：多邻国、Anki、扇贝的输入校验逻辑
- 数据：内置 500 词表（JSON 数组），每词含 `id, word, pos, zh, en_example, difficulty, theme`

### 1.2 分类类型背单词
- 顶部 Tab 切换：食物 / 旅行 / 商务 / 校园 / 情绪 / 科技 …
- 每个主题独立成关，每关 20 词，连续 3 错回主菜单
- 进度持久化到 localStorage

### 1.3 场景造句
- 固定场景：显示场景描述 + 必用词（例：咖啡店 → 必含 buy / coffee / please）
  - 玩家输入完整句子，校验：
    1. 是否包含所有必用词（顺序无关、大小写无关）
    2. 句法是否合理（用 compromise.js 之类的轻量 NLP 库做 POS 检查）
  - 校验通过 → 释放对应角色的【场景技】
- 随机场景：每局从 50 个场景模板中随机抽 1 个，限时 15 秒

## UI 规范
- 顶部：场景卡（图标 + 描述）
- 中部：敌人立绘（可点击的"靶子"）
- 底部：触屏输入框 + 提交按钮 + 计时进度条
- 输入框失焦时自动聚焦（移动端防键盘收起）

## 验收
- 能流畅背完一轮 20 词
- 场景造句能识别正确/错误并给出针对性提示
- 单词库与主题、难度、必用词字段完整可扩展
```

---

## 2. PVE 闯关模式 Prompt

```
## 目标
把【背单词】包装成 RPG 闯关体验，每关是一个 Boss，连续攻击通关后获得奖励。

## 战斗循环
1. 关卡开始：屏幕上方出现敌人立绘 + 血条（默认 100 HP）
2. 敌人每 3 秒自动攻击一次，玩家必须在窗口内完成 1 次输入
3. 玩家输入正确单词 → 释放【标枪攻击】
   - 基础伤害 = 词长度（apple = 5 伤害）
   - 连击（连续 3 词全对）→ 触发【眩晕】：敌人停止攻击 2 秒
4. 玩家输入错误 / 超时 → 玩家扣血（固定 10）
5. 血量归零 → 胜利 / 失败结算

## 战斗系统字段
- `player.hp` / `enemy.hp`（React 状态机 / Vue reactive）
- `combo`（int，连续正确数）
- `stun_timer`（int，秒）
- `last_word`（string，回放用）

## 敌人类型（每 5 关换一个）
- 普通兵：HP 60，攻击间隔 3s
- 精英：HP 120，攻击间隔 2s，附带【拼写混淆】buff（词随机多 1 个字母）
- Boss：HP 300，攻击间隔 1.5s，每 30% 血量触发【全屏大招】（强制限时输入 3 词）

## 奖励
- 通关后弹结算：金币 + 经验 + 随机皮肤碎片
- 失败 3 次内可复活（看广告，mock 一个 5s 倒计时即可）

## 状态机
IDLE → INPUTING → ATTACKING → STUNNED → ENEMY_ATTACK → IDLE
                  ↓
              WIN / LOSE

## 验收
- 至少 10 关可玩
- 连击眩晕、特效、Boss 大招全部跑通
- 结算页能正确计算金币 / 经验
```

---

## 3. PVP 真人 PK Prompt

```
## 目标
PVE 同框架，但是对手是真人。MVP 用【本地双人对战】（同一设备分屏）演示完整 PK 体验。

## 模式
### 3.1 本地双人
- 屏幕左右分屏，各自一个输入框
- 系统每 5 秒同步出一个【共同题目】（同一释义，先答对者得分）
- 答对一次 +1 分，先到 10 分者胜
- 提示："左边红方是真人，右边蓝方也是真人"

### 3.2 在线 PK（M2 阶段）
- 通道：WebRTC DataChannel（PeerJS 简化接入）
- 房间号：6 位数字，房间状态在 P2P 内同步
- 反作弊：服务端只做最小校验（首版纯 P2P，标注 MVP-Lite）

## 视觉差异化
- PVP 必须有 PVE 没有的：
  - 双方血条对峙（屏幕顶部左右各一）
  - 实时比分板
  - 击打反馈：标枪命中时有震屏 + 屏幕闪光
  - 失败时显示"被 X 击败"

## 验收
- 本地双人能完整跑完 1 局 10 分
- 在线 PK 房主能创建房间、玩家能加入、双方输入实时同步
```

---

## 4. 皮肤系统 Prompt

```
## 目标
皮肤是核心商业化入口。每个皮肤覆盖 4 个视觉层，互不影响，可叠加也可单独购买。

## 皮肤四件套
1. **人物** — 主角立绘（站立 / 攻击 / 眩晕 / 胜利 4 个状态）
2. **攻击特效** — 标枪飞行轨迹 + 命中爆点（粒子 / 着色器）
3. **连击特效** — 屏幕边框 + 文字浮层（combo x3/x5/x10 不同强度）
4. **胜利特效** — 结算页 3D 烟花 / 角色舞蹈

## 数据结构
```ts
type Skin = {
  id: string;
  name: string;
  rarity: 'R' | 'SR' | 'SSR';
  layers: {
    character: AssetRef;
    attack_vfx: AssetRef;
    combo_vfx: AssetRef;
    victory_vfx: AssetRef;
  };
  price: number; // 金币
  unlock_condition?: { type: 'level' | 'achievement' | 'paid'; value: any };
};
```

## 美术生产
- 角色：AI 生图（matrix_generate_image），风格 "low poly neon, white background, full body, T-pose" → 后处理转 4 帧 PNG sprite
- 特效：Three.js 粒子 + GLSL fragment shader（霓虹辉光 / 像素爆炸 / 火焰尾迹）

## 解锁
- R 级：金币购买（300 / 800 / 1500）
- SR 级：通关特定 Boss 奖励
- SSR 级：PVP 达到黄金段位 / 限时活动

## 验收
- 商店能预览每个皮肤的 4 层效果
- 装备后战斗中立即生效并持久化
- 至少 3 套完整皮肤（1R + 1SR + 1SSR）作为种子内容
```

---

## 5. 排行榜 Prompt

```
## 目标
三个榜单，分别对应三种玩法的"段位"。

## 榜单
1. **单词类型排行** — 各主题词库（食物 / 旅行 / ...）背词速度榜，按"答对数 / 总用时"排序
2. **场景排位排行** — 场景造句的胜率榜
3. **随机排位排行** — PVP 段位榜（MVP 用本地 mock 数据，预留接口）

## 数据
- 每条记录：`{ player_id, name, avatar, score, rank_change, updated_at }`
- 前 100 名：localStorage mock
- 玩家自己：高亮置顶 + 显示"距离上一名还差 X 分"

## 视觉
- 经典三列 tab + 滚动列表
- 前 3 名有特殊底色（金 / 银 / 铜）
- 玩家自己用脉冲高亮

## 验收
- 三个 tab 都能正确显示
- 自己永远在第 1 位（如果分数进不了前 100）
- 榜单为空时显示"暂无数据"占位
```

---

## 6. 商店 Prompt

```
## 目标
皮肤购买 + 道具商城（MVP 阶段只做皮肤）。

## 购物车 / 购买流程
1. 选皮肤 → 详情页（360° 预览 / 4 层展示）
2. 确认价格（金币 / 现金两套）
3. 余额校验 → 扣款 → 写入 inventory → 立即装备（可选）
4. 不足时引导【看广告领金币】或【充值】（mock）

## 数据
- `inventory: Skin[]`
- `currency: { gold, gem }`
- `transactions: Purchase[]`（用于审计与回放）

## 验收
- 完整买一个皮肤的流程跑通
- 余额不足有友好提示
- 购买记录可查询
```

---

## 7. 通用 — 资产 / 数据 Prompt

```
## 词库 schema（基础 500 词，必填）
{
  "id": 1,
  "word": "apple",
  "pos": "n",
  "zh": "苹果",
  "theme": ["food", "fruit"],
  "difficulty": 1,            // 1-5
  "en_example": "I eat an apple every day.",
  "phonetic": "/ˈæp.əl/"
}

## 场景模板 schema
{
  "id": "cafe_buy",
  "scene": "在咖啡店点单",
  "required_words": ["buy", "coffee", "please"],
  "example_answer": "Could I buy a coffee, please?",
  "difficulty": 2
}

## 主题枚举（用于 Tab 与排行榜）
food / travel / business / campus / emotion / technology / sport / nature

## 视觉资产命名规范
- 角色：`char_<skin_id>_<state>.png`  （state: idle | attack | stun | win）
- 特效：`vfx_<type>_<skin_id>.json`  （type: attack | combo | victory）
- 音频：`sfx_<event>.mp3`  （event: type | hit | miss | win | coin）

## 不变量
- 所有 UI 文本走 i18n key，不硬编码中文
- 任何用户输入都必须做 trim + lowercase + unicode normalize
- 计时器统一用 game_loop（requestAnimationFrame + 累计 dt），避免 setTimeout 漂移
```

---

## 8. 一次性整体交付 Prompt（最快出原型版）

如果只想要一个能跑的最简原型，把这一段丢给 agent：

```
请用 Three.js + 原生 JS 做一个最小可玩原型：标枪单词对战。

## 必须有
1. 主菜单：3 个按钮（训练 / PVE / PVP）
2. 训练模式：屏幕显示中文"苹果"，玩家输入 "apple" 正确后从角色发射一支发光标枪命中靶子
3. PVE 模式：上方敌人立绘 + 血条 100，输入正确扣 10，敌人每 3s 自动扣玩家 5，血先到 0 者败
4. PVP 模式：分屏双人，同题目，先答对者得分
5. 皮肤：3 套角色立绘可切换
6. 排行榜：localStorage mock 显示前 10

## 美术
- 角色：纯色低多边形（红 / 蓝 / 绿 三个胶囊人）
- 标枪：发光线段，命中时圆形爆点
- 背景：渐变色 + 简单网格地面

## 词库
- 内置 30 个常用词（apple, banana, cat, dog, ...）按主题分组

## 验收
- `npm install && npm run dev` 启动后 5 分钟内能玩完一局 PVE
- 单词输入校验：去空格、转小写、unicode normalize
- 没有报错、没有 console warning
```

---

## 用法

- 想做**完整产品**：按 0 → 7 顺序跑
- 想做**MVP 原型**：直接跑 8
- 想做**某个模块**：把对应章节标题（`## 1. 训练模式 Prompt`）作为 prompt 喂给 agent
- 每跑完一个模块，agent 应该输出"已交付：X / Y / Z"清单
