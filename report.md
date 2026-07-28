# 🌸 屎山代码分析报告 🌸

## 📑 目录

- [糟糕指数](#overall-score)
- [评分指标详情](#metrics-details)
- [最屎代码排行榜](#problem-files)
- [诊断结论](#conclusion)

![Score](https://img.shields.io/badge/Score-91%25-brightgreen)

## 糟糕指数 {#overall-score}

| 指标摘要 | 评分 |
|------|-------|
| **糟糕指数** | **91.32/100** |
| 屎山等级 | 🌸 偶有异味 |

> 如沐春风，仿佛被天使亲吻过

### 📊 统计信息

| 指标 | 数值 |
|--------|-------|
| 总文件数 | 158 |
| 已跳过 | 35 |
| 耗时 | 478ms |

## 评分指标详情 {#metrics-details}

| 指标摘要 | 评分 | 状态 |
|:-----|------:|:------:|
| 循环复杂度 | 1.59% | ✓✓ |
| 认知复杂度 | 1.98% | ✓✓ |
| 嵌套深度 | 1.20% | ✓✓ |
| 函数长度 | 0.58% | ✓✓ |
| 文件长度 | 2.16% | ✓✓ |
| 参数数量 | 5.74% | ✓✓ |
| 代码重复 | 1.80% | ✓✓ |
| 结构分析 | 1.04% | ✓✓ |
| 错误处理 | 13.93% | ✓✓ |
| 注释比例 | 47.15% | ○ |
| 命名规范 | 11.10% | ✓✓ |

## 最屎代码排行榜 {#problem-files}

### 1. src\Core\GameState.ts

**糟糕指数: 35.23**

**问题**: 🔄 复杂度问题: 14, ⚠️ 其他问题: 3, 🏗️ 结构问题: 7, ❌ 错误处理问题: 1, 📝 注释问题: 1

- 🔄 `UseCard()` L249: 复杂度: 15
- 🔄 `ApplyCardImmediateEffect()` L321: 复杂度: 44
- 🔄 `PlayTurn()` L609: 复杂度: 26
- 🔄 `ApplyCardDiceModifiers()` L1281: 复杂度: 26
- 🔄 `ApplyLeaderTax()` L1394: 复杂度: 13
- 🔍 ...还有 19 个问题实在太屎，列不完了

### 2. src\Audio\Synthesizer.ts

**糟糕指数: 24.45**

**问题**: 🔄 复杂度问题: 2, ⚠️ 其他问题: 5, 📋 重复问题: 2, ❌ 错误处理问题: 23, 🏷️ 命名问题: 10

- 🔄 `Play()` L130: 复杂度: 15
- 🔄 `Play()` L130: 认知复杂度: 17
- 📏 `_ApplyEnvelope()` L38: 5 参数数量
- 📏 `_PlayNoise()` L54: 5 参数数量
- 📏 `_PlayTone()` L77: 6 参数数量
- 🔍 ...还有 36 个问题实在太屎，列不完了

### 3. src\Core\MonteCarloSimulation.ts

**糟糕指数: 24.36**

**问题**: 🔄 复杂度问题: 3, ⚠️ 其他问题: 1, 🏗️ 结构问题: 1, 📝 注释问题: 1

- 🔄 `SimulateOneGame()` L30: 复杂度: 17
- 🔄 `SimulateOneGame()` L30: 认知复杂度: 29
- 🔄 `SimulateOneGame()` L30: 嵌套深度: 6
- 📏 `RunSimulation()` L110: 5 参数数量
- 🏗️ `SimulateOneGame()` L30: 嵌套过深: 6

### 4. src\App\AppController.ts

**糟糕指数: 24.09**

**问题**: 🔄 复杂度问题: 8, ⚠️ 其他问题: 3, 🏗️ 结构问题: 4, ❌ 错误处理问题: 2, 📝 注释问题: 1, 🏷️ 命名问题: 10

- 🔄 `_PlayGame()` L306: 复杂度: 13
- 🔄 `_HandleSelectMode()` L476: 复杂度: 12
- 🔄 `_LogTurn()` L657: 复杂度: 18
- 🔄 `_PlayGame()` L306: 认知复杂度: 21
- 🔄 `_HandleSelectMode()` L476: 认知复杂度: 16
- 🔍 ...还有 20 个问题实在太屎，列不完了

### 5. src\Render\Animation\NumberPopAnimation.ts

**糟糕指数: 14.75**

**问题**: ⚠️ 其他问题: 1, 📋 重复问题: 1, ❌ 错误处理问题: 1, 📝 注释问题: 1

- 📏 `constructor()` L30: 5 参数数量
- 📋 `constructor()` L30: 重复模式: constructor, Update
- ❌ L75: 未处理的易出错调用

### 6. src\UI\Components\GameStageView.ts

**糟糕指数: 14.32**

**问题**: ⚠️ 其他问题: 1, 🏗️ 结构问题: 1, ❌ 错误处理问题: 3, 📝 注释问题: 1, 🏷️ 命名问题: 2

- 📏 `constructor()` L42: 8 参数数量
- ❌ L134: 未处理的易出错调用
- ❌ L139: 未处理的易出错调用
- ❌ L157: 未处理的易出错调用
- 🏷️ `_Refresh()` L144: "_Refresh" - camelCase/PascalCase
- 🔍 ...还有 1 个问题实在太屎，列不完了

### 7. src\UI\Components\MainMenu.ts

**糟糕指数: 13.79**

**问题**: ⚠️ 其他问题: 3, 🏗️ 结构问题: 1, ❌ 错误处理问题: 1, 📝 注释问题: 1, 🏷️ 命名问题: 10

- 📏 `_BuildDialogPlayerRows()` L313: 115 代码量
- ❌ L308: 未处理的易出错调用
- 🏷️ `_BuildTopbar()` L68: "_BuildTopbar" - camelCase/PascalCase
- 🏷️ `_BuildMain()` L95: "_BuildMain" - camelCase/PascalCase
- 🏷️ `_BuildConsole()` L140: "_BuildConsole" - camelCase/PascalCase
- 🔍 ...还有 7 个问题实在太屎，列不完了

### 8. src\Render\Animation\AnimationCoordinator.ts

**糟糕指数: 13.78**

**问题**: 🔄 复杂度问题: 3, ⚠️ 其他问题: 1, 📋 重复问题: 1, 🏗️ 结构问题: 1, 🏷️ 命名问题: 7

- 🔄 `_OnTurn()` L77: 复杂度: 12
- 🔄 `_OnTurn()` L77: 认知复杂度: 20
- 🔄 `_OnTurn()` L77: 嵌套深度: 4
- 📋 `_PopNumber()` L154: 重复模式: _PopNumber, _PopPublic
- 🏗️ `_OnTurn()` L77: 中等嵌套: 4
- 🔍 ...还有 7 个问题实在太屎，列不完了

### 9. src\Render\MenuViewportRenderer.ts

**糟糕指数: 13.26**

**问题**: ⚠️ 其他问题: 4, ❌ 错误处理问题: 1, 📝 注释问题: 1, 🏷️ 命名问题: 6

- 📏 `_DrawOrbit()` L155: 5 参数数量
- 📏 `_DrawScan()` L174: 5 参数数量
- 📏 `_DrawMoon()` L208: 5 参数数量
- 📏 `_DrawReticle()` L294: 7 参数数量
- ❌ L114: 未处理的易出错调用
- 🔍 ...还有 6 个问题实在太屎，列不完了

### 10. src\UI\Dom.ts

**糟糕指数: 13.11**

**问题**: 🔄 复杂度问题: 2, ⚠️ 其他问题: 1, 🏗️ 结构问题: 1, ❌ 错误处理问题: 1, 📝 注释问题: 1

- 🔄 `El()` L46: 复杂度: 15
- 🔄 `El()` L46: 认知复杂度: 21
- 🏗️ `El()` L46: 中等嵌套: 3
- ❌ L140: 未处理的易出错调用

## 诊断结论 {#conclusion}

🌸 **偶有异味** - 基本没事，但是有伤风化

👍 继续保持，你是编码界的一股清流，代码洁癖者的骄傲

---

*由 [fuck-u-code](https://github.com/Done-0/fuck-u-code) 生成*