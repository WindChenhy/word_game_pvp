# Playtest Notes

> 每次玩完一局把发现写这里，触发 balancing 决策

## 模板

```
## YYYY-MM-DD - {build / mode}
- 测试目标：
- 玩法验证：
- 观察到的卡点：
  - 输入延迟：
  - 难度：
  - 视觉反馈：
- 数据：
  - 平均输入耗时：
  - 平均命中率：
  - 平均最高连击：
- 调整动作：
- 后续任务：
```

## 2026-06-19 - M0 冒烟测试（自动化）

- 测试目标：vertical slice 跑通 + 核心循环验证
- 玩法验证：
  - ✅ 主菜单：训练 / PVE / PVP 三个按钮
  - ✅ 训练模式：答对 → combo+1，标枪飞向靶子
  - ✅ PVE 模式：敌人自动攻击（3s 间隔），玩家 HP 100，敌人 HP 60
  - ✅ 输入校验：`ticket` (6字符) → 敌人扣 6 血，公式正确
  - ✅ 答错反馈：扣玩家 10 血 + 输入框 shake
  - ✅ 连击累计：1 → 2 → 3 正常
  - ✅ 词库：6 主题 × 5 词 = 30 词随机抽取
- 观察到的卡点：
  - ⚠️ `_renderWord` 在眩晕时会覆盖 `sceneInfo`，M1 修复
  - ⚠️ PVE 第一关敌人配置太弱（普通 60HP，玩家 6 次即可击杀），M1 调数值
- 调试中发现并修复的 bug：
  1. `lastEnemyAttack = 0` 导致首次 tick 立即攻击玩家（玩家开局扣血）→ 改为 init 时设为 `performance.now()`
  2. `checkAnswer(input, word)` 参数错位（word 对象 vs 字符串）→ 改成 `word.word`
- 数据：
  - 平均输入耗时：~500ms（自动化测试） / 真实玩家待测
  - 平均命中率：测试期间 100%
  - 平均最高连击：3
- 调整动作：见 system-decisions.md
- 后续任务：M1 - Boss + 音效 + 连击特效 + 词库扩 200

## 截图

| 场景 | 截图 |
|---|---|
| 主菜单 | ![menu](./screenshot-menu.png) |
| 训练模式 | ![training](./screenshot-training.png) |
| PVE 模式 | ![pve](./screenshot-pve.png) |