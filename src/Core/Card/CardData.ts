/**
 * src/Core/Card/CardData.ts
 * 操作类型：新建
 *
 * 塔罗牌 78 张卡牌定义数据
 * 来源：TarotCards.xml（知乎专栏"七十八张塔罗牌牌面独特的图案和意义"）
 *
 * 设计要点：
 * - 零运行时依赖（纯 TS 字面量）
 * - 全部 Readonly，安全性由 TypeScript 编译器保证
 * - 22 大阿尔卡那 + 56 小阿尔卡那（四花色各 14 张）
 */

import type { CardDefinition } from '@/Types/Card';
import {
  CardType,
  CardSuit,
  CardRarity,
  CardTarget,
} from '@/Types/Card';

const MAJOR = CardSuit.Major;
const SWORDS = CardSuit.Swords;
const WANDS = CardSuit.Wands;
const CUPS = CardSuit.Cups;
const PENTACLES = CardSuit.Pentacles;

const CMD = CardType.Command;
const CTR = CardType.Counter;
const CST = CardType.Constant;

const L = CardRarity.Legendary;
const R = CardRarity.Rare;
const U = CardRarity.Uncommon;
const C = CardRarity.Common;

const SELF = CardTarget.Self;
const ENEMY = CardTarget.SingleEnemy;
const ALL_ACTIVE = CardTarget.AllActivePlayers;
const ALL_POOR = CardTarget.AllPoor;
const RICHEST = CardTarget.RichestOther;
const ANY = CardTarget.AnyPlayer;
const STACK = CardTarget.CardOnStack;
const ROB_INIT = CardTarget.RobberyInitiator;
const ROB_BOTH = CardTarget.RobberyBothSides;
const OCCUPY = CardTarget.OccupyingPlayer;
const OVERFLOW = CardTarget.OverflowSource;
const CHOICE = CardTarget.Choice;

/**
 * 全部 78 张塔罗牌定义
 * 顺序：大阿尔卡那 0~XXI → 宝剑 Ace~King → 权杖 Ace~King → 圣杯 Ace~King → 金币 Ace~King
 * 只读数组，外部不可修改
 */
export const ALL_TAROT_CARDS: readonly CardDefinition[] = Object.freeze([

  // =========================================================================
  // 大阿尔卡那 Major Arcana：22 张
  // =========================================================================

  {
    Id: 'major_00', Index: '0', NameCn: '愚者', NameEn: 'The Fool',
    Keywords: '天真 冒险 开端 自由 无畏 本能',
    Suit: MAJOR, Type: CMD, Rarity: L,
    ApCost: 1,
    EffectDescription: '重掷本回合所有骰子��必须接受新结果，不可再次重掷。',
    EffectPhase: 'AfterRoll', EffectTarget: SELF, EffectMechanic: 'Reroll',
    Duration: null, ZeroSum: false, Condition: null, Trigger: null,
    Lore: '身穿斑斓服装的旅人，无视脚下悬崖，昂首前行。脚边小白狗狂吠警示，他却凭本能望向远方天空。左手白玫瑰象征纯洁热情，右手令牌象征力量。编号0，既是一切的开端，也是终结。',
  },
  {
    Id: 'major_01', Index: 'I', NameCn: '魔术师', NameEn: 'The Magician',
    Keywords: '创造 沟通 知识 力量 技巧 意志',
    Suit: MAJOR, Type: CMD, Rarity: L,
    ApCost: 3,
    EffectDescription: '将本回合任意一枚骰子的点数设为 1~6 中的任意值。',
    EffectPhase: 'AfterRoll', EffectTarget: SELF, EffectMechanic: 'SetDie',
    Duration: null, ZeroSum: false, Condition: null, Trigger: null,
    Lore: '魔术师高举令牌，右手指天左手指地，沟通天地。身前桌上摆放权杖、圣杯、宝剑、钱币四元素。红色袍子象征热情，白色内衣象征纯洁智慧。腰缠青蛇象征智慧与启发，头顶躺8字象征无限。',
  },
  {
    Id: 'major_02', Index: 'II', NameCn: '女祭司', NameEn: 'The High Priestess',
    Keywords: '直觉 神秘 潜意识 智慧 内省',
    Suit: MAJOR, Type: CMD, Rarity: L,
    ApCost: 1,
    EffectDescription: '查看牌库顶部 3 张牌，选择其中 1 张加入手牌，其余按原顺序放回。',
    EffectPhase: 'SelectMode', EffectTarget: SELF, EffectMechanic: 'Scry',
    Duration: null, ZeroSum: false, Condition: null, Trigger: null,
    Lore: '女祭司端坐于两根立柱之间——黑色代表阴性，白色代表阳性。她手持卷轴，上面写着"Tora"，象征隐藏的知识与神秘智慧。脚下新月代表直觉与潜意识的力量。',
  },
  {
    Id: 'major_03', Index: 'III', NameCn: '女皇', NameEn: 'The Empress',
    Keywords: '丰收 滋养 繁荣 母性 创造',
    Suit: MAJOR, Type: CMD, Rarity: L,
    ApCost: 2,
    EffectDescription: '自身私有领土 +3。若公共领土不足3，则加至公共归零为止。',
    EffectPhase: 'SelectMode', EffectTarget: SELF, EffectMechanic: 'TerritoryGain',
    Duration: null, ZeroSum: true, Condition: null, Trigger: null,
    Lore: '女皇安坐在丰饶的田园之中，头戴十二星冠冕，象征十二星座与一年的循环。手中权杖代表权威，盾牌上的金星符号象征爱与美。周围成熟的麦穗与茂密森林展现大地的丰产之力。',
  },
  {
    Id: 'major_04', Index: 'IV', NameCn: '皇帝', NameEn: 'The Emperor',
    Keywords: '权威 秩序 掌控 稳定 规则',
    Suit: MAJOR, Type: CMD, Rarity: L,
    ApCost: 2,
    EffectDescription: '指定一名其他玩家：该玩家本回合只能选择"稳健"模式。',
    EffectPhase: 'SelectMode', EffectTarget: ENEMY, EffectMechanic: 'ModeLock',
    Duration: null, ZeroSum: false, Condition: null, Trigger: null,
    Lore: '皇帝端坐于石座之上，身着红袍与铠甲，手持权杖与宝球，象征世俗权力与统治。背后是荒芜山脉，暗示他征服的疆域。四只公羊头装饰王座，象征白羊座的开拓精神与权威意志。',
  },
  {
    Id: 'major_05', Index: 'V', NameCn: '教皇', NameEn: 'The Hierophant',
    Keywords: '传统 指引 规则 信仰 教育',
    Suit: MAJOR, Type: CMD, Rarity: L,
    ApCost: 2,
    EffectDescription: '本回合你的开发链不会因非对子而清零。（对子仍正常累积，非对子时连击数保持不变）',
    EffectPhase: 'SelectMode', EffectTarget: SELF, EffectMechanic: 'DevChainProtect',
    Duration: null, ZeroSum: false, Condition: null, Trigger: null,
    Lore: '教皇端坐于两位侍者之间，右手做出祝福手势，左手持三重十字权杖，象征对精神世界的权威。两位侍者的衣袍上饰有红玫瑰与白百合，呼应魔术师牌的元素——教皇将知识体系化并传承下去。',
  },
  {
    Id: 'major_06', Index: 'VI', NameCn: '恋人', NameEn: 'The Lovers',
    Keywords: '选择 结合 和谐 爱情 价值',
    Suit: MAJOR, Type: CMD, Rarity: L,
    ApCost: 3,
    EffectDescription: '本回合掷骰结果强制视为对子，触发/延续开发链倍率。',
    EffectPhase: 'SelectMode', EffectTarget: SELF, EffectMechanic: 'ForceDouble',
    Duration: null, ZeroSum: false, Condition: null, Trigger: null,
    Lore: '画面中央是亚当与夏娃，天使拉斐尔在上方张开双臂庇护。背景中生命之树与智慧之树分立两侧，蛇缠绕于智慧树上。这张牌的核心不是浪漫本身，而是"做出选择"——在两条路之间，选择你真正想要的未来。',
  },
  {
    Id: 'major_07', Index: 'VII', NameCn: '战车', NameEn: 'The Chariot',
    Keywords: '胜利 意志 突破 行动力 征服',
    Suit: MAJOR, Type: CMD, Rarity: L,
    ApCost: 2,
    EffectDescription: '本回合 RawGain +2。',
    EffectPhase: 'SelectMode', EffectTarget: SELF, EffectMechanic: 'RawGainBonus',
    Duration: null, ZeroSum: false, Condition: null, Trigger: null,
    Lore: '战车手驾驶由黑白双狮拉动的战车，象征对立力量的调和。他头顶八角星冠，肩戴月牙护甲，手持权杖。战车的方形车身代表稳固的意志，唯有驾驭内在矛盾者方能驱车前进。',
  },
  {
    Id: 'major_08', Index: 'VIII', NameCn: '力量', NameEn: 'Strength',
    Keywords: '勇气 耐心 内在力量 柔能克刚',
    Suit: MAJOR, Type: CMD, Rarity: L,
    ApCost: 2,
    EffectDescription: '在本轮中（含当前回合剩余部分），若你受到崩坏伤害，减免其中的 50%（向下取整）。',
    EffectPhase: 'SelectMode', EffectTarget: SELF, EffectMechanic: 'CollapseShield',
    Duration: null, ZeroSum: false, Condition: null, Trigger: null,
    Lore: '一位身着白袍的女子，温柔而坚定地抚合狮子的嘴。她头顶无限符号，象征以柔克刚的永恒智慧。狮子代表野性与原始力量，女子代表内在的勇气与耐心——真正的力量不需要暴力来证明。',
  },
  {
    Id: 'major_09', Index: 'IX', NameCn: '隐士', NameEn: 'The Hermit',
    Keywords: '内省 独处 智慧 指引 耐心',
    Suit: MAJOR, Type: CMD, Rarity: L,
    ApCost: 0,
    EffectDescription: '跳过本回合掷骰与占领。自身私有领土 +1（从公共池），视为已完成本回合。',
    EffectPhase: 'SelectMode', EffectTarget: SELF, EffectMechanic: 'SkipTurn',
    Duration: null, ZeroSum: true, Condition: null, Trigger: null,
    Lore: '老者身披灰色斗篷，独自立于雪峰之巅。左手提着六芒星灯笼，右手拄着长杖。灯笼中并非火，而是一颗闪耀的六角星，象征内在智慧之光。他不需要从外界获取答案——答案在静默与自省之中。',
  },
  {
    Id: 'major_10', Index: 'X', NameCn: '命运之轮', NameEn: 'Wheel of Fortune',
    Keywords: '转折 机遇 循环 命运 变化',
    Suit: MAJOR, Type: CMD, Rarity: L,
    ApCost: 3,
    EffectDescription: '选择场上任意一名玩家的本回合骰子结果，重新随机生成一次（骰子模式不变）。',
    EffectPhase: 'AfterRoll', EffectTarget: ANY, EffectMechanic: 'RerollTarget',
    Duration: null, ZeroSum: false, Condition: null, Trigger: null,
    Lore: '命运之轮高悬于天空，斯芬克斯持剑端坐轮顶，象征着面对命运的智慧。左侧蛇形生物代表沉沦，右侧阿努比斯背负巨轮代表承受。四角的神牛、飞鹰、天使、狮子对应四元素——命运永不停歇地转动。',
  },
  {
    Id: 'major_11', Index: 'XI', NameCn: '正义', NameEn: 'Justice',
    Keywords: '公平 因果 裁决 平衡 责任',
    Suit: MAJOR, Type: CMD, Rarity: L,
    ApCost: 2,
    EffectDescription: '在当前抢夺或崩坏结算中：场上私有领土最高的玩家（排除发起者）必须分摊 50% 的损失总量（向下取整）。',
    EffectPhase: 'RobberyOrCollapse', EffectTarget: RICHEST, EffectMechanic: 'Redistribute',
    Duration: null, ZeroSum: false, Condition: null, Trigger: null,
    Lore: '正义女神端坐于两根石柱之间，右手持剑代表裁决的力量，左手持天秤代表客观的判断。她双目直视前方，不偏袒任何人。紫色披风象征威严，背后帷幕暗示真理有时需要被揭开才能看见。',
  },
  {
    Id: 'major_12', Index: 'XII', NameCn: '倒吊人', NameEn: 'The Hanged Man',
    Keywords: '牺牲 换个视角 暂停 放手 启迪',
    Suit: MAJOR, Type: CMD, Rarity: L,
    ApCost: 0,
    EffectDescription: '立即失去 2 私有领土（进入公共池）。下回合你的 RawGain 翻倍。',
    EffectPhase: 'SelectMode', EffectTarget: SELF, EffectMechanic: 'SacrificeForBonus',
    Duration: null, ZeroSum: true, Condition: null, Trigger: null,
    Lore: '一名男子倒吊于T形木架上，神情却安详宁静。他的双手被缚于背后，但头顶的光晕显示这不是刑罚，而是自愿的牺牲。换个角度看世界，暂停行动，反而获得更深的洞见。牺牲小利，换取更大的觉醒。',
  },
  {
    Id: 'major_13', Index: 'XIII', NameCn: '死神', NameEn: 'Death',
    Keywords: '结束 转变 新生 置死地而后生',
    Suit: MAJOR, Type: CMD, Rarity: L,
    ApCost: 3,
    EffectDescription: '清空所有玩家（含自己）的当前开发链连击数。不影响已获取的倍率收益。',
    EffectPhase: 'SelectMode', EffectTarget: ALL_ACTIVE, EffectMechanic: 'ResetAllChains',
    Duration: null, ZeroSum: false, Condition: null, Trigger: null,
    Lore: '死神身披黑甲骑白马，手持黑色蔷薇十字旗。马蹄之下，国王抗拒死亡、祭司崇敬死亡、妇人为恐惧昏厥、孩童天真仰望——四种态度面对同一真相。编号13并非厄运，而是"旧事物的终结，新事物的开始"。',
  },
  {
    Id: 'major_14', Index: 'XIV', NameCn: '节制', NameEn: 'Temperance',
    Keywords: '平衡 调和 中庸 耐心 融合',
    Suit: MAJOR, Type: CMD, Rarity: L,
    ApCost: 2,
    EffectDescription: '选择一名其他玩家。取你与该玩家私有领土之和的一半（向下取整），双方私有领土均设为该值。差额进入公共池。',
    EffectPhase: 'SelectMode', EffectTarget: ENEMY, EffectMechanic: 'Balance',
    Duration: null, ZeroSum: true, Condition: null, Trigger: null,
    Lore: '天使手持两只金杯，将水从一只杯倾入另一只，水在空中形成流动的无限循环。一只脚踏入水中，一只脚立于陆地，象征在物质与精神之间寻找平衡。胸口三角形的正方形图案代表"精神调和物质"。',
  },
  {
    Id: 'major_15', Index: 'XV', NameCn: '恶魔', NameEn: 'The Devil',
    Keywords: '欲望 束缚 物质主义 沉溺 控制',
    Suit: MAJOR, Type: CMD, Rarity: L,
    ApCost: 4,
    EffectDescription: '窃取目标玩家 3 私有领土归为己有。若目标不足 3，则取其全部。',
    EffectPhase: 'SelectMode', EffectTarget: ENEMY, EffectMechanic: 'Steal',
    Duration: null, ZeroSum: false, Condition: null, Trigger: null,
    Lore: '恶魔半人半兽立于石座之上，倒置的五角星在头顶闪烁。亚当与夏娃被锁链拴在石座上，但锁链松垮——他们本可随时挣脱，却被欲望与恐惧困住。这张牌揭示的真相是：束缚我们的往往不是外部力量，而是自己的选择。',
  },
  {
    Id: 'major_16', Index: 'XVI', NameCn: '高塔', NameEn: 'The Tower',
    Keywords: '骤变 崩塌 天启 破坏 释放',
    Suit: MAJOR, Type: CMD, Rarity: L,
    ApCost: 4,
    EffectDescription: '强制触发一次崩坏结算（即使当前抢夺触发次数不足2）。崩坏按当前X系数正常计算。',
    EffectPhase: 'SelectMode', EffectTarget: ALL_ACTIVE, EffectMechanic: 'ForceCollapse',
    Duration: null, ZeroSum: false, Condition: null, Trigger: null,
    Lore: '唯一一张没有正面含义的大牌。闪电从天而降，击碎巍峨高塔，金冠坠地。两人从塔中坠落，惊恐无助。无论地位高低，面对骤变无人能幸免。但崩塌也意味着旧的牢笼被打破——废墟之上，才能重建新世界。',
  },
  {
    Id: 'major_17', Index: 'XVII', NameCn: '星星', NameEn: 'The Star',
    Keywords: '希望 治愈 宁静 信心 灵感',
    Suit: MAJOR, Type: CMD, Rarity: L,
    ApCost: 3,
    EffectDescription: '自身私有领土 +3。此领土不来自公共池（凭空创造）。',
    EffectPhase: 'SelectMode', EffectTarget: SELF, EffectMechanic: 'PureHeal',
    Duration: null, ZeroSum: false, Condition: null, Trigger: null,
    Lore: '赤裸的女子跪于池边，右手将一瓶水倒入水池，左手将另一瓶水洒向大地。天空中有八颗星——一大七小。中央大星是希望之星，七颗小星对应七脉轮。经历高塔的毁灭后，星星带来宁静的治愈与新的信念。',
  },
  {
    Id: 'major_18', Index: 'XVIII', NameCn: '月亮', NameEn: 'The Moon',
    Keywords: '幻象 恐惧 潜意识 迷惑 不安',
    Suit: MAJOR, Type: CMD, Rarity: L,
    ApCost: 2,
    EffectDescription: '指定一名其他玩家：该玩家下回合必须选择"激进"模式（不可选稳健、不开发或复仇）。',
    EffectPhase: 'SelectMode', EffectTarget: ENEMY, EffectMechanic: 'ForceAggressive',
    Duration: null, ZeroSum: false, Condition: null, Trigger: null,
    Lore: '一轮满月高悬夜空，月光下有两只犬对月长啸。水边一只螯虾正从水面爬出，象征潜意识之物浮上意识的表面。远处两座塔之间有一条蜿蜒小路——月光下一切都不确定，恐惧往往只是自己的想象。',
  },
  {
    Id: 'major_19', Index: 'XIX', NameCn: '太阳', NameEn: 'The Sun',
    Keywords: '成功 活力 光明 快乐 成就感',
    Suit: MAJOR, Type: CST, Rarity: L,
    ApCost: 3,
    EffectDescription: '本卡打出后，在本轮剩余的所有己方回合中，你的每次 RawGain +1。效果持续至本大轮结束。',
    EffectPhase: 'SelectMode', EffectTarget: SELF, EffectMechanic: 'PersistentRawGain',
    Duration: 3, ZeroSum: false, Condition: null, Trigger: null,
    Lore: '一轮巨大的太阳照耀天空，向日葵在下方盛开。一个裸体孩童骑着白马，手持红色旗帜，面带纯真笑容。太阳是塔罗中最正面的一张牌——经过月亮的迷茫之后，黎明到来，一切豁然开朗，成功与喜悦触手可及。',
  },
  {
    Id: 'major_20', Index: 'XX', NameCn: '审判', NameEn: 'Judgement',
    Keywords: '觉醒 清算 重生 召唤 评价',
    Suit: MAJOR, Type: CMD, Rarity: L,
    ApCost: 3,
    EffectDescription: '所有私有领土 ≤ 2 的玩家（含自己，除已淘汰者），私有领土 +2（从公共池取）。每名玩家最多加至 2。',
    EffectPhase: 'SelectMode', EffectTarget: ALL_POOR, EffectMechanic: 'CatchupHeal',
    Duration: null, ZeroSum: true, Condition: null, Trigger: null,
    Lore: '天使加百列从天而降吹响号角，墓穴中的死者纷纷起身回应召唤。海面上漂浮着棺木，人们张开双臂迎接审判——这不是惩罚，而是觉醒。清算过去的因果，在新生中重新出发。对所有落后者而言，这是公平的重置。',
  },
  {
    Id: 'major_21', Index: 'XXI', NameCn: '世界', NameEn: 'The World',
    Keywords: '完成 圆满 达成 成功 整合',
    Suit: MAJOR, Type: CMD, Rarity: L,
    ApCost: 4,
    EffectDescription: '公共领土 −5，自身私有领土 +5。若公共不足 5，则取尽为止。',
    EffectPhase: 'SelectMode', EffectTarget: SELF, EffectMechanic: 'MassDrain',
    Duration: null, ZeroSum: true, Condition: null, Trigger: null,
    Lore: '一位舞者在桂冠花环中翩翩起舞，双手各持一支权杖。四角的神牛、飞鹰、天使、狮子再次出现——四种元素在此刻完成了整合。世界是塔罗大阿尔卡那之旅的终点：经历过一切之后，你终于抵达圆满。',
  },

  // =========================================================================
  // 小阿尔卡那 · 宝剑 Swords：14 张（反制 Counter）
  // =========================================================================

  {
    Id: 'minor_swords_ace', Index: 'Ace', NameCn: '宝剑首牌', NameEn: 'Ace of Swords',
    Keywords: '新挑战 理智 决心 胜利 双刃',
    Suit: SWORDS, Type: CTR, Rarity: R,
    ApCost: 2,
    EffectDescription: '反制：取消目标玩家刚打出的任意一张卡牌效果。被取消的牌进入弃牌堆，对方消耗的AP不返还。',
    EffectPhase: 'CounterWindow', EffectTarget: STACK, EffectMechanic: 'CancelCard',
    Duration: null, ZeroSum: false, Condition: null, Trigger: '任意卡牌被使用时',
    Lore: '云端中伸出一只强有力的手，紧握锋利宝剑，剑尖刺穿金色王冠。宝剑双刃——可救人也可伤人。这张首牌代表理智与决断的巅峰力量，但也警示：力量的使用需要智慧，否则会反噬自身。',
  },
  {
    Id: 'minor_swords_02', Index: '2', NameCn: '宝剑二', NameEn: 'Two of Swords',
    Keywords: '抉择 僵局 平衡 回避 盲视',
    Suit: SWORDS, Type: CTR, Rarity: C,
    ApCost: 1,
    EffectDescription: '反制：当抢夺发生时，迫使抢夺发起者重掷其裁决骰子。必须接受新结果。',
    EffectPhase: 'CounterWindow', EffectTarget: ROB_INIT, EffectMechanic: 'RerollRobbery',
    Duration: null, ZeroSum: false, Condition: null, Trigger: '抢夺发生时',
    Lore: '蒙眼女子双手交叉持两把长剑，端坐于海边的石凳上。她拒绝看见眼前的真相，也拒绝做出选择。身后的海洋象征潜意识，月亮高悬暗示情绪左右判断。有时候，僵持本身就是一种策略。',
  },
  {
    Id: 'minor_swords_03', Index: '3', NameCn: '宝剑三', NameEn: 'Three of Swords',
    Keywords: '心碎 悲伤 背叛 伤痛 分离',
    Suit: SWORDS, Type: CTR, Rarity: C,
    ApCost: 1,
    EffectDescription: '反制：当一名玩家通过占领获得私有领土时，使其实际收益 −1（最低为 0）。差额进入公共池。',
    EffectPhase: 'CounterWindow', EffectTarget: OCCUPY, EffectMechanic: 'ReduceGain',
    Duration: null, ZeroSum: true, Condition: null, Trigger: '占领结算时',
    Lore: '三把长剑刺穿一颗红心，背景是灰色的天空和连绵的雨。画面简单而直接——这是所有塔罗牌中最��白地描绘伤痛的一张。但雨终会停，破碎的心也会愈合。忍受此刻的痛，才能释放明日的坚强。',
  },
  {
    Id: 'minor_swords_04', Index: '4', NameCn: '宝剑四', NameEn: 'Four of Swords',
    Keywords: '休息 撤退 冥想 恢复 暂歇',
    Suit: SWORDS, Type: CTR, Rarity: C,
    ApCost: 1,
    EffectDescription: '反制：当崩坏发生时，你在此次崩坏中的损失 −2（最低为 0）。减免的部分不转移给他人。',
    EffectPhase: 'CounterWindow', EffectTarget: SELF, EffectMechanic: 'CollapseReduction',
    Duration: null, ZeroSum: false, Condition: null, Trigger: '崩坏结算时',
    Lore: '一名骑士合掌躺卧于教堂中的石棺之上，上方悬挂三把剑，侧面立着第四把。他并非死亡，而是在战斗间隙寻求片刻的宁静与恢复。教堂的彩绘玻璃窗透进光芒——撤退不是失败，是为了下一次更有力的出击。',
  },
  {
    Id: 'minor_swords_05', Index: '5', NameCn: '宝剑五', NameEn: 'Five of Swords',
    Keywords: '失败 争执 屈辱 赢得惨烈',
    Suit: SWORDS, Type: CTR, Rarity: C,
    ApCost: 2,
    EffectDescription: '反制：当抢夺发生时，使双方额外各损失 1 私有领土（进入公共池）。若任一方不足 1，则扣至 0。',
    EffectPhase: 'CounterWindow', EffectTarget: ROB_BOTH, EffectMechanic: 'ExtraLoss',
    Duration: null, ZeroSum: true, Condition: null, Trigger: '抢夺发生时',
    Lore: '一名得意洋洋的男子手持三把长剑，看着两个失败的对手垂头丧气地离开。地上散落两把被丢弃的剑。他赢了这场争执，但背影显得孤独——惨烈的胜利有时比失败更令人空虚。',
  },
  {
    Id: 'minor_swords_06', Index: '6', NameCn: '宝剑六', NameEn: 'Six of Swords',
    Keywords: '过渡 疗伤 前进 释怀 迁徙',
    Suit: SWORDS, Type: CTR, Rarity: C,
    ApCost: 2,
    EffectDescription: '反制：当一名玩家的占领收益触发了抢夺或崩坏时，使其 m2 溢出量 −2（最低为 1），从而降低后续抢夺/崩坏规模。',
    EffectPhase: 'CounterWindow', EffectTarget: OVERFLOW, EffectMechanic: 'ReduceOverflow',
    Duration: null, ZeroSum: false, Condition: null, Trigger: '溢出判定时',
    Lore: '一位摆渡人撑着长篙，载着一对母子穿过平静的水域。船头插着六把剑，船身虽沉但并不倾覆。前方的陆地象征着新的开始。这张牌的核心是"带着伤痛前行"——不必忘记，但必须继续。',
  },
  {
    Id: 'minor_swords_07', Index: '7', NameCn: '宝剑七', NameEn: 'Seven of Swords',
    Keywords: '诡计 偷窃 欺骗 策略 狡猾',
    Suit: SWORDS, Type: CTR, Rarity: C,
    ApCost: 2,
    EffectDescription: '反制：随机查看目标玩家 1 张手牌。若其中有卡牌，可选择弃掉其中 1 张（弃入弃牌堆）。',
    EffectPhase: 'CounterWindow', EffectTarget: ENEMY, EffectMechanic: 'HandDiscard',
    Duration: null, ZeroSum: false, Condition: null, Trigger: '任意时刻响应窗口',
    Lore: '一名男子蹑手蹑脚地抱着五把剑从军营溜走，回头得意地笑着。营地里还插着两把剑他没来得及带走。他以为自己智胜一筹，却没有注意到身后的追兵。聪明反被聪明误——投机取巧的胜利往往不会长久。',
  },
  {
    Id: 'minor_swords_08', Index: '8', NameCn: '宝剑八', NameEn: 'Eight of Swords',
    Keywords: '束缚 限制 困境 自我囚禁',
    Suit: SWORDS, Type: CTR, Rarity: C,
    ApCost: 2,
    EffectDescription: '反制：当崩坏发生时，将你本应承担的崩坏损失转移给私有领土最高的玩家（排除崩坏发起者）。',
    EffectPhase: 'CounterWindow', EffectTarget: RICHEST, EffectMechanic: 'RedirectCollapseLoss',
    Duration: null, ZeroSum: false, Condition: null, Trigger: '崩坏结算时',
    Lore: '一位蒙眼女子被八把长剑围困在泥泞地上，动弹不得。远处海边的城堡清晰可见，她脚边却有水在流淌——如果她挣脱眼罩，其实可以轻易跨过那些剑。束缚她的不是剑阵，而是她相信自己无法离开。',
  },
  {
    Id: 'minor_swords_09', Index: '9', NameCn: '宝剑九', NameEn: 'Nine of Swords',
    Keywords: '噩梦 恐惧 焦虑 失眠 内疚',
    Suit: SWORDS, Type: CTR, Rarity: C,
    ApCost: 2,
    EffectDescription: '反制：当抢夺发生时，使你作为被抢夺方的裁决骰子结果 +3。',
    EffectPhase: 'CounterWindow', EffectTarget: SELF, EffectMechanic: 'RobberyDefenseBonus',
    Duration: null, ZeroSum: false, Condition: null, Trigger: '自己作为抢夺防守方时',
    Lore: '一人从噩梦中惊醒，抱头坐在床上，表情痛苦。墙面上悬挂九把长剑，整齐排列在他背后。暗黑的被褥上刻着玫瑰与星座符号，暗示噩梦并非来自外部，而是内心焦虑的投射。夜深人静时，最大的敌人是自己的恐惧。',
  },
  {
    Id: 'minor_swords_10', Index: '10', NameCn: '宝剑十', NameEn: 'Ten of Swords',
    Keywords: '终结 最低谷 绝境 无可再惨',
    Suit: SWORDS, Type: CTR, Rarity: C,
    ApCost: 3,
    EffectDescription: '反制：当你受到任何负面效果（抢夺损失/崩坏损失/他人卡牌窃取）时，将该效果完全无效化。',
    EffectPhase: 'CounterWindow', EffectTarget: SELF, EffectMechanic: 'FullNegate',
    Duration: null, ZeroSum: false, Condition: null, Trigger: '任意负面效果作用于自己时',
    Lore: '一人趴倒在地，背上刺着十把长剑。天空是死寂的黑色，但远处的地平线上有一抹金色曙光。这是宝剑花色中最惨烈的一张——但"谷底"意味着此后只能向上。当他站起身拔掉剑，黎明就来了。',
  },
  {
    Id: 'minor_swords_page', Index: 'Page', NameCn: '宝剑侍从', NameEn: 'Page of Swords',
    Keywords: '侦察 好奇 警觉 少年智者',
    Suit: SWORDS, Type: CTR, Rarity: U,
    ApCost: 1,
    EffectDescription: '反制：查看目标玩家的所有手牌。',
    EffectPhase: 'CounterWindow', EffectTarget: ENEMY, EffectMechanic: 'PeekHand',
    Duration: null, ZeroSum: false, Condition: null, Trigger: '任意时刻响应窗口',
    Lore: '一位少年手持长剑立于山顶，剑尖朝天，神情警觉而好奇。风将他的头发与披风吹向后方，他却稳如磐石。他尚未经历真正的战斗，但敏锐的目光已经洞察到远方的风吹草动——信息的优势常常是真正的力量。',
  },
  {
    Id: 'minor_swords_knight', Index: 'Knight', NameCn: '宝剑骑士', NameEn: 'Knight of Swords',
    Keywords: '冲锋 急进 勇气 鲁莽 行动',
    Suit: SWORDS, Type: CTR, Rarity: U,
    ApCost: 2,
    EffectDescription: '反制：当抢夺发生时，与抢夺发起者交换双方的裁决骰子结果。（你获得对方的点数，对方获得你的点数）',
    EffectPhase: 'CounterWindow', EffectTarget: ROB_INIT, EffectMechanic: 'SwapRobberyDice',
    Duration: null, ZeroSum: false, Condition: null, Trigger: '抢夺发生时',
    Lore: '骑士高举长剑，身骑白马迎风冲锋。风将他的披风与马鬃吹得猎猎作响，但他毫不减速。他是四骑士中最具攻击性的——速度快如疾风，但也可能因冒进而犯下无法挽回的错误。抓住先机，一击致胜。',
  },
  {
    Id: 'minor_swords_queen', Index: 'Queen', NameCn: '宝剑女王', NameEn: 'Queen of Swords',
    Keywords: '理性 独立 洞察 冷静 决断',
    Suit: SWORDS, Type: CTR, Rarity: U,
    ApCost: 2,
    EffectDescription: '反制：本回合中，下一次有任何负面效果作用于你时，将其效果减半（向下取整）。',
    EffectPhase: 'CounterWindow', EffectTarget: SELF, EffectMechanic: 'HalveEffect',
    Duration: null, ZeroSum: false, Condition: null, Trigger: '任意负面效果作用于自己时',
    Lore: '女王端坐于宝座，右手高举长剑，左手伸出做出裁决的手势。她的面容冷静而坚定，天空中的云朵被她身后的风吹散。她经历过所有的伤痛——正因如此，她比任何人都知道如何精准地判断局势并果断出手。',
  },
  {
    Id: 'minor_swords_king', Index: 'King', NameCn: '宝剑国王', NameEn: 'King of Swords',
    Keywords: '权威 理智 法律 严苛 公正',
    Suit: SWORDS, Type: CTR, Rarity: R,
    ApCost: 3,
    EffectDescription: '反制：取消目标玩家刚打出的卡牌效果，并且对方消耗的AP不予扣除（对方的私有领土返还）。被取消的牌进入弃牌堆。',
    EffectPhase: 'CounterWindow', EffectTarget: STACK, EffectMechanic: 'CancelAndRefund',
    Duration: null, ZeroSum: false, Condition: null, Trigger: '任意卡牌被使用时',
    Lore: '国王端坐于宝座，右手高举正义之剑，左手轻抚王座扶手。他的披风上绣着蝴蝶与新月，象征理性中的直觉。他是四国王中最冷峻的一位——他以最严苛的标准执行规则。在他面前，没有任何花招能蒙混过关。',
  },

  // =========================================================================
  // 小阿尔卡那 · 权杖 Wands：14 张（指令 Command - 骰子）
  // =========================================================================

  {
    Id: 'minor_wands_ace', Index: 'Ace', NameCn: '权杖首牌', NameEn: 'Ace of Wands',
    Keywords: '新行动 创造 机会 灵感 潜能',
    Suit: WANDS, Type: CMD, Rarity: R,
    ApCost: 3,
    EffectDescription: '将本回合任意一枚骰子的点数设为 6。',
    EffectPhase: 'AfterRoll', EffectTarget: SELF, EffectMechanic: 'SetDieTo6',
    Duration: null, ZeroSum: false, Condition: null, Trigger: null,
    Lore: '云端中伸出一只强劲有力的大手，紧握一根粗壮的权杖。权杖上萌发绿色新叶，在空中飘舞。大手的周围环绕白色光芒——这是来自更高意志的赠礼，象征着无限的创造潜能，如火花般蕴含着燎原之势。',
  },
  {
    Id: 'minor_wands_02', Index: '2', NameCn: '权杖二', NameEn: 'Two of Wands',
    Keywords: '规划 远见 抉择 扩张 权力',
    Suit: WANDS, Type: CMD, Rarity: C,
    ApCost: 1,
    EffectDescription: '重掷本回合其中一枚骰子。可选择保留原结果或��用新结果。',
    EffectPhase: 'AfterRoll', EffectTarget: SELF, EffectMechanic: 'SelectiveReroll',
    Duration: null, ZeroSum: false, Condition: null, Trigger: null,
    Lore: '一位领主站在城堡塔顶，左手持权杖，右手扶着地球仪。他眺望着远方的海洋与大陆——他掌控着当前的领土，但目光已经投向了更广阔的世界。',
  },
  {
    Id: 'minor_wands_03', Index: '3', NameCn: '权杖三', NameEn: 'Three of Wands',
    Keywords: '远航 扩展 远见 贸易 前提',
    Suit: WANDS, Type: CMD, Rarity: C,
    ApCost: 2,
    EffectDescription: '本回合 RawGain +2。',
    EffectPhase: 'SelectMode', EffectTarget: SELF, EffectMechanic: 'RawGainBonus',
    Duration: null, ZeroSum: false, Condition: null, Trigger: null,
    Lore: '一位商人站在海边悬崖，身后三根权杖牢牢插在地上。他眺望着远方海面上即将归来的商船。前期的投入与规划已经完成——现在他只需等待收获的船只驶入港口。',
  },
  {
    Id: 'minor_wands_04', Index: '4', NameCn: '权杖四', NameEn: 'Four of Wands',
    Keywords: '庆祝 稳定 和谐 家园 丰收',
    Suit: WANDS, Type: CMD, Rarity: C,
    ApCost: 2,
    EffectDescription: '本回合在掷骰之前，选择"稳健"和"激进"各掷一次，取 RawGain 较高者作为实际结果。',
    EffectPhase: 'SelectMode', EffectTarget: SELF, EffectMechanic: 'BestOfTwoModes',
    Duration: null, ZeroSum: false, Condition: null, Trigger: null,
    Lore: '四根权杖搭成一座花环拱门，两位女子高举花束在舞蹈中穿行。远处是一座稳固的城堡。拱门象征阶段性的完成与庆祝——这不是终点，而是一个里程碑。',
  },
  {
    Id: 'minor_wands_05', Index: '5', NameCn: '权杖五', NameEn: 'Five of Wands',
    Keywords: '冲突 竞争 混乱 分歧',
    Suit: WANDS, Type: CMD, Rarity: C,
    ApCost: 2,
    EffectDescription: '场上所有活跃玩家的本回合 RawGain 均随机 ±1（各玩家独立掷硬币决定加减方向）。',
    EffectPhase: 'SelectMode', EffectTarget: ALL_ACTIVE, EffectMechanic: 'ChaosRawGain',
    Duration: null, ZeroSum: false, Condition: null, Trigger: null,
    Lore: '五个人手持权杖互相挥舞击打，但没有任何人在真正伤害对方——他们在竞争、在争论、在宣泄能量。混乱之中，有人受益，有人受损。',
  },
  {
    Id: 'minor_wands_06', Index: '6', NameCn: '权杖六', NameEn: 'Six of Wands',
    Keywords: '胜利 凯旋 认可 自信 荣耀',
    Suit: WANDS, Type: CMD, Rarity: C,
    ApCost: 2,
    EffectDescription: '本回合 RawGain +1，并从牌库抽 1 张牌。',
    EffectPhase: 'SelectMode', EffectTarget: SELF, EffectMechanic: 'GainAndDraw',
    Duration: null, ZeroSum: false, Condition: null, Trigger: null,
    Lore: '一位骑士身骑白马，头戴桂冠，高举挂有花环的权杖。五名追随者手持权杖簇拥左右。胜利者的光环不仅能带来当下的荣耀，也会吸引更多机会。',
  },
  {
    Id: 'minor_wands_07', Index: '7', NameCn: '权杖七', NameEn: 'Seven of Wands',
    Keywords: '坚守 抵抗 勇气 防御 不退',
    Suit: WANDS, Type: CMD, Rarity: C,
    ApCost: 1,
    EffectDescription: '本回合你的掷骰结果和卡牌使用不能被任何反制牌针对。',
    EffectPhase: 'SelectMode', EffectTarget: SELF, EffectMechanic: 'CounterImmunity',
    Duration: null, ZeroSum: false, Condition: null, Trigger: null,
    Lore: '一名男子立于高地，双手紧握一根权杖，抵挡从下方攻来的六根权杖。人数虽处于劣势，但位置优越——居高临下的防守者，有信念就能守住阵地。',
  },
  {
    Id: 'minor_wands_08', Index: '8', NameCn: '权杖八', NameEn: 'Eight of Wands',
    Keywords: '加速 迅捷 飞行 信息 突破',
    Suit: WANDS, Type: CMD, Rarity: C,
    ApCost: 2,
    EffectDescription: '本回合若你的骰子和 ≤ 3，将其自动提升至 4。（在开发链倍率计算前生效）',
    EffectPhase: 'AfterRoll', EffectTarget: SELF, EffectMechanic: 'SetMinimum',
    Duration: null, ZeroSum: false, Condition: null, Trigger: null,
    Lore: '八根权杖划破长空，齐头并进飞向前方。没有人物出现，只有纯粹的动能与速度——所有的阻碍都已被清除，现在一切都在高速运转。',
  },
  {
    Id: 'minor_wands_09', Index: '9', NameCn: '权杖九', NameEn: 'Nine of Wands',
    Keywords: '警惕 坚持 最后守卫 韧性',
    Suit: WANDS, Type: CMD, Rarity: C,
    ApCost: 2,
    EffectDescription: '本回合掷骰结果强制视为对子，触发/延续开发链倍率。',
    EffectPhase: 'SelectMode', EffectTarget: SELF, EffectMechanic: 'ForceDouble',
    Duration: null, ZeroSum: false, Condition: null, Trigger: null,
    Lore: '一名受伤的男子紧握权杖，身后竖立八根权杖形成保护栅栏。他头上缠着绷带，但眼神坚定地望着前方。他已经经历了八场战斗，这是最后一次防守——伤痕累累但依然站立。',
  },
  {
    Id: 'minor_wands_10', Index: '10', NameCn: '权杖十', NameEn: 'Ten of Wands',
    Keywords: '重负 压力 责任 超载 过度',
    Suit: WANDS, Type: CMD, Rarity: C,
    ApCost: 3,
    EffectDescription: '本回合 RawGain ×3。（注意：可能触发抢夺/崩坏）',
    EffectPhase: 'SelectMode', EffectTarget: SELF, EffectMechanic: 'TripleRawGain',
    Duration: null, ZeroSum: false, Condition: null, Trigger: null,
    Lore: '一人抱着十根沉重的权杖，弯腰艰难地走向前方的村庄。他已经承担了太多，脊背几乎被压弯——收获的代价是巨大的负担，但目的地就在前方不远。',
  },
  {
    Id: 'minor_wands_page', Index: 'Page', NameCn: '权杖侍从', NameEn: 'Page of Wands',
    Keywords: '探索 新消息 热情 初生牛犊',
    Suit: WANDS, Type: CMD, Rarity: U,
    ApCost: 1,
    EffectDescription: '查看牌库顶部 3 张牌，可按任意顺序放回牌库顶。',
    EffectPhase: 'SelectMode', EffectTarget: SELF, EffectMechanic: 'ArrangeTopDeck',
    Duration: null, ZeroSum: false, Condition: null, Trigger: null,
    Lore: '少年持权杖立于沙漠之中，双眼充满好奇与热情。他尚未踏上真正的冒险，但心中已经燃起了探索世界的火苗。新的消息即将到来。',
  },
  {
    Id: 'minor_wands_knight', Index: 'Knight', NameCn: '权杖骑士', NameEn: 'Knight of Wands',
    Keywords: '冒险 冲动 热情 说走就走',
    Suit: WANDS, Type: CMD, Rarity: U,
    ApCost: 3,
    EffectDescription: '本回合结束后，你额外获得一个追加回合（完整的掷骰+占领流程）。追加回合不计入轮次计算。',
    EffectPhase: 'SelectMode', EffectTarget: SELF, EffectMechanic: 'ExtraTurn',
    Duration: null, ZeroSum: false, Condition: null, Trigger: null,
    Lore: '骑士身骑烈马，高举燃烧的权杖，在沙漠中全速冲锋。他是四骑士中最具冒险精神的——不在乎目的地，只在乎此刻的速度与激情。说走就走，绝不犹豫。',
  },
  {
    Id: 'minor_wands_queen', Index: 'Queen', NameCn: '权杖女王', NameEn: 'Queen of Wands',
    Keywords: '自信 魅力 独立 热情 领导力',
    Suit: WANDS, Type: CMD, Rarity: U,
    ApCost: 3,
    EffectDescription: '本回合若你的掷骰结果不是对子，可将其强制视为对子。（本效果优先于开发链正常判定）',
    EffectPhase: 'AfterRoll', EffectTarget: SELF, EffectMechanic: 'ConditionalForceDouble',
    Duration: null, ZeroSum: false, Condition: null, Trigger: null,
    Lore: '女王端坐于饰有狮子雕刻的宝座，右手持盛开的向日葵权杖，左手轻抚黑猫。她是火元素的皇后——热情、自信、光芒四射。她知道自己想要什么，并且毫不畏惧地去争取。',
  },
  {
    Id: 'minor_wands_king', Index: 'King', NameCn: '权杖国王', NameEn: 'King of Wands',
    Keywords: '远见 创业 领导 大胆 魅力',
    Suit: WANDS, Type: CMD, Rarity: R,
    ApCost: 3,
    EffectDescription: '本回合选择你的确切骰子结果：指定两枚骰子的具体点数（1~6），或指定单骰的点数。对子规则正常判定。',
    EffectPhase: 'SelectMode', EffectTarget: SELF, EffectMechanic: 'ChooseExactDice',
    Duration: null, ZeroSum: false, Condition: null, Trigger: null,
    Lore: '国王端坐于宝座，右手持开花的权杖。他的披风以火蜥蜴为饰，脚下卧着活的火蜥蜴——象征对火焰的绝对掌控。他是四国王中最有远见的创业者——敢于构想并实现宏大的愿景。',
  },

  // =========================================================================
  // 小阿尔卡那 · 圣杯 Cups：14 张（指令 Command - 治疗/保护）
  // =========================================================================

  {
    Id: 'minor_cups_ace', Index: 'Ace', NameCn: '圣杯首牌', NameEn: 'Ace of Cups',
    Keywords: '丰收 爱 喜悦 满足 充盈',
    Suit: CUPS, Type: CMD, Rarity: R,
    ApCost: 2,
    EffectDescription: '自身私有领土 +3（从公共池取）。若公共不足3，取至公共归零。',
    EffectPhase: 'SelectMode', EffectTarget: SELF, EffectMechanic: 'TerritoryGain',
    Duration: null, ZeroSum: true, Condition: null, Trigger: null,
    Lore: '一只精致的手从云端伸出，托起华丽的黄金圣杯。杯中涌出五道蓝色水流，注入下方的荷花盛开的池塘。圣杯象征丰盛的情感与精神满足，爱如泉水般涌流不竭。',
  },
  {
    Id: 'minor_cups_02', Index: '2', NameCn: '圣杯二', NameEn: 'Two of Cups',
    Keywords: '结合 平等 交换 伙伴 和谐',
    Suit: CUPS, Type: CMD, Rarity: C,
    ApCost: 1,
    EffectDescription: '选择一名玩家。你与该玩家各交换 1 私有领土（若任一方不足 1 则无法使用）。',
    EffectPhase: 'SelectMode', EffectTarget: ENEMY, EffectMechanic: 'SwapTerritory',
    Duration: null, ZeroSum: false, Condition: null, Trigger: null,
    Lore: '一对男女面对面站立，各自手持一只圣杯。两人之间悬浮着双蛇缠绕的双翼权杖——赫尔墨斯之杖，象征沟通与平衡。这不是征服，而是自愿的互相给予。',
  },
  {
    Id: 'minor_cups_03', Index: '3', NameCn: '圣杯三', NameEn: 'Three of Cups',
    Keywords: '庆祝 友谊 合作 分享 欢庆',
    Suit: CUPS, Type: CMD, Rarity: C,
    ApCost: 2,
    EffectDescription: '场上所有私有领土低于 3 的活跃玩家（含自己），私有领土 +1（从公共池取）。',
    EffectPhase: 'SelectMode', EffectTarget: ALL_POOR, EffectMechanic: 'CatchupHeal',
    Duration: null, ZeroSum: true, Condition: null, Trigger: null,
    Lore: '三位女子高举圣杯围成一圈跳舞，脚下是丰收的瓜果与花朵。一个人开心不如大家一起开心，丰收的喜悦在分享中加倍。',
  },
  {
    Id: 'minor_cups_04', Index: '4', NameCn: '圣杯四', NameEn: 'Four of Cups',
    Keywords: '冷漠 不满足 反思 视而不见',
    Suit: CUPS, Type: CMD, Rarity: C,
    ApCost: 1,
    EffectDescription: '本回合你的私有领土不会被任何方式（抢夺/崩坏/卡牌窃取）减少。效果持续至下回合自己行动前。',
    EffectPhase: 'SelectMode', EffectTarget: SELF, EffectMechanic: 'TerritoryShield',
    Duration: null, ZeroSum: false, Condition: null, Trigger: null,
    Lore: '一名青年盘腿坐在树下，双臂交叉，对面前的三只圣杯视而不见。云端中伸出一只手递给他第四只圣杯，他依然低头沉思——真正的机会已经在手边了。',
  },
  {
    Id: 'minor_cups_05', Index: '5', NameCn: '圣杯五', NameEn: 'Five of Cups',
    Keywords: '失落 悲伤 遗憾 执着于失去',
    Suit: CUPS, Type: CMD, Rarity: C,
    ApCost: 1,
    EffectDescription: '自身失去 1 私有领土（进入公共池）。本轮中，你不会被抢夺（抢劫的触发判定跳过你）。',
    EffectPhase: 'SelectMode', EffectTarget: SELF, EffectMechanic: 'SacrificeForImmunity',
    Duration: null, ZeroSum: true, Condition: null, Trigger: null,
    Lore: '一个裹着黑色斗篷的人低头凝视地上翻倒的三只圣杯，背后还有两只立着的圣杯他却视而不见。他太专注于失去的东西，却没注意到身后还保留着什么——转身，桥就在那里。',
  },
  {
    Id: 'minor_cups_06', Index: '6', NameCn: '圣杯六', NameEn: 'Six of Cups',
    Keywords: '怀旧 纯真 回忆 给予 无私',
    Suit: CUPS, Type: CMD, Rarity: C,
    ApCost: 1,
    EffectDescription: '将自身 1 私有领土赠予另一名玩家，然后从牌库抽 2 张牌。',
    EffectPhase: 'SelectMode', EffectTarget: ENEMY, EffectMechanic: 'GiftAndDraw',
    Duration: null, ZeroSum: false, Condition: null, Trigger: null,
    Lore: '一个较大的孩子将一只插着白花的圣杯递给一个较小的孩子。这是关于纯真年代与无私给予的牌——付出不总是损失，有时候它带来的回报是完全意想不到的。',
  },
  {
    Id: 'minor_cups_07', Index: '7', NameCn: '圣杯七', NameEn: 'Seven of Cups',
    Keywords: '幻想 选择 白日梦 渴望 迷惑',
    Suit: CUPS, Type: CMD, Rarity: C,
    ApCost: 2,
    EffectDescription: '二选一：自身私有领土 +2（从公共池取）或指定一名玩家私有领土 −1（进入公共池）。',
    EffectPhase: 'SelectMode', EffectTarget: CHOICE, EffectMechanic: 'BranchingEffect',
    Duration: null, ZeroSum: true, Condition: null, Trigger: null,
    Lore: '七只圣杯在云端漂浮，每只杯中都浮现不同的幻象：财富、爱情、荣耀、知识、冒险……一名黑影人在杯前驻足，你必须拥有足够的清醒，才能从迷雾中抓住真正需要的东西。',
  },
  {
    Id: 'minor_cups_08', Index: '8', NameCn: '圣杯八', NameEn: 'Eight of Cups',
    Keywords: '离开 放下 追寻 转变 舍弃',
    Suit: CUPS, Type: CMD, Rarity: C,
    ApCost: 2,
    EffectDescription: '若你处于"荒地"状态（NeedsRelaunch），立即移除荒地状态并恢复为 Active，无需重新发射。',
    EffectPhase: 'SelectMode', EffectTarget: SELF, EffectMechanic: 'RemoveWasteland',
    Duration: null, ZeroSum: false, Condition: '仅荒地状态可用', Trigger: null,
    Lore: '一人拄杖转身离去，身后整齐排列八只圣杯，前方是嶙峋的山脉与一条通往远方的河。有些东西即使美好，也不再属于当下的旅程——离开不是放弃，是为了追寻更重要的目标。',
  },
  {
    Id: 'minor_cups_09', Index: '9', NameCn: '圣杯九', NameEn: 'Nine of Cups',
    Keywords: '愿望成真 满足 舒适 自得',
    Suit: CUPS, Type: CMD, Rarity: C,
    ApCost: 3,
    EffectDescription: '自身私有领土 +3。此领土不来自公共池（凭空创造）。',
    EffectPhase: 'SelectMode', EffectTarget: SELF, EffectMechanic: 'PureHeal',
    Duration: null, ZeroSum: false, Condition: null, Trigger: null,
    Lore: '一人双臂交叉，微笑端坐，身后九只圣杯整齐排列在高台上。他是塔罗中最"满足"的人物——不需要更多，现在已经足够。被称为"愿望牌"——此刻，你真正想要的已经来到身边。',
  },
  {
    Id: 'minor_cups_10', Index: '10', NameCn: '圣杯十', NameEn: 'Ten of Cups',
    Keywords: '圆满 幸福 和谐 家庭 归所',
    Suit: CUPS, Type: CMD, Rarity: C,
    ApCost: 3,
    EffectDescription: '场上所有活跃玩家私有领土 +1（从公共池取）。',
    EffectPhase: 'SelectMode', EffectTarget: ALL_ACTIVE, EffectMechanic: 'GlobalHeal',
    Duration: null, ZeroSum: true, Condition: null, Trigger: null,
    Lore: '一对夫妇相拥仰望天空中的彩虹，彩虹上方十只圣杯排列成壮丽的弧线。十只圣杯是圣杯花色的巅峰——情感的最高满足，不是一个人的快乐，而是所有人的共同幸福。',
  },
  {
    Id: 'minor_cups_page', Index: 'Page', NameCn: '圣杯侍从', NameEn: 'Page of Cups',
    Keywords: '灵感 直觉 创意 少年梦想家',
    Suit: CUPS, Type: CMD, Rarity: U,
    ApCost: 1,
    EffectDescription: '若你未完成发射（Not Launched），本回合发射成功阈值 −2（即 ≥5 即为成功）。',
    EffectPhase: 'LaunchPhase', EffectTarget: SELF, EffectMechanic: 'LaunchThresholdReduction',
    Duration: null, ZeroSum: false, Condition: '仅发射阶段可用', Trigger: null,
    Lore: '少年手持圣杯站在海边，一条鱼从杯中探出头来与他交谈。鱼儿象征潜意识深处的灵感——只有那些保持童心的人，才能听到来自内心的声音。',
  },
  {
    Id: 'minor_cups_knight', Index: 'Knight', NameCn: '圣杯骑士', NameEn: 'Knight of Cups',
    Keywords: '追求 邀请 浪漫 理想 和平',
    Suit: CUPS, Type: CMD, Rarity: U,
    ApCost: 1,
    EffectDescription: '本回合发射成功阈值 −3（即 ≥4 即为成功）。',
    EffectPhase: 'LaunchPhase', EffectTarget: SELF, EffectMechanic: 'LaunchThresholdReduction',
    Duration: null, ZeroSum: false, Condition: '仅发射阶段可用', Trigger: null,
    Lore: '骑士身着盔甲，身骑缓步白马，手持圣杯，神情优雅而平静。他是和平的使者，携带着情感的邀请函。他带来的不是战争，而是一场温柔的邀约。',
  },
  {
    Id: 'minor_cups_queen', Index: 'Queen', NameCn: '圣杯女王', NameEn: 'Queen of Cups',
    Keywords: '直觉 共情 关怀 深度情感',
    Suit: CUPS, Type: CMD, Rarity: U,
    ApCost: 2,
    EffectDescription: '本轮中，你的私有领土不能被任何方式窃取或削减（抢夺/崩坏/卡牌窃取均无效）。你自己主动消耗AP不受影响。',
    EffectPhase: 'SelectMode', EffectTarget: SELF, EffectMechanic: 'AbsoluteShield',
    Duration: null, ZeroSum: false, Condition: null, Trigger: null,
    Lore: '女王端坐于海边的宝座，双手捧着一只带盖的华丽圣杯。她的衣裙融入海水，脚下是贝壳与珊瑚。在她面前，一切恶意都化为虚无。',
  },
  {
    Id: 'minor_cups_king', Index: 'King', NameCn: '圣杯国王', NameEn: 'King of Cups',
    Keywords: '情感掌控 慈悲 从容 长者智慧',
    Suit: CUPS, Type: CMD, Rarity: R,
    ApCost: 3,
    EffectDescription: '本回合你消耗的所有 AP（私有领土扣除）在回合结束时返还一半（向上取整）。已返还的领土不触发任何二次效果。',
    EffectPhase: 'SelectMode', EffectTarget: SELF, EffectMechanic: 'ApRefund',
    Duration: null, ZeroSum: false, Condition: null, Trigger: null,
    Lore: '国王坐在漂浮于海面的宝座上，左手持权杖，右手持圣杯。宝座在惊涛骇浪中岿然不动——从容与慈悲不是天生的，是历尽风雨后修来的智慧。',
  },

  // =========================================================================
  // 小阿尔卡那 · 金币 Pentacles：14 张（恒常 Constant）
  // =========================================================================

  {
    Id: 'minor_pentacles_ace', Index: 'Ace', NameCn: '金币首牌', NameEn: 'Ace of Pentacles',
    Keywords: '物质 财富 地位 繁荣 根基',
    Suit: PENTACLES, Type: CST, Rarity: R,
    ApCost: 3,
    EffectDescription: '之后的 3 个己方回合开始时，私有领土 +1（凭空创造）。',
    EffectPhase: 'SelectMode', EffectTarget: SELF, EffectMechanic: 'RegenPerTurn',
    Duration: 3, ZeroSum: false, Condition: null, Trigger: null,
    Lore: '云端中伸出一只手，捧着一枚巨大的五角星金币。下方繁花盛开的庭园通向远方的山丘——象征以务实的根基开始，通往丰厚的回报。',
  },
  {
    Id: 'minor_pentacles_02', Index: '2', NameCn: '金币二', NameEn: 'Two of Pentacles',
    Keywords: '平衡 弹性 应变 兼顾 多元',
    Suit: PENTACLES, Type: CST, Rarity: C,
    ApCost: 2,
    EffectDescription: '之后的 2 个己方回合中，每次占领获得的私有领土 +1。',
    EffectPhase: 'SelectMode', EffectTarget: SELF, EffectMechanic: 'OccupationBonus',
    Duration: 2, ZeroSum: false, Condition: null, Trigger: null,
    Lore: '一位街头艺人手舞两枚金币��用∞形绳索将它们连接，在波浪起伏的海边灵活操控。生活本就是一场持续的平衡游戏。',
  },
  {
    Id: 'minor_pentacles_03', Index: '3', NameCn: '金币三', NameEn: 'Three of Pentacles',
    Keywords: '合作 工艺 计划 技能 建造',
    Suit: PENTACLES, Type: CST, Rarity: C,
    ApCost: 2,
    EffectDescription: '之后的 2 轮中，所有玩家的领土变化数额公开显示在战斗日志中。',
    EffectPhase: 'SelectMode', EffectTarget: ALL_ACTIVE, EffectMechanic: 'RevealTerritoryChanges',
    Duration: 2, ZeroSum: false, Condition: null, Trigger: null,
    Lore: '一位石匠站在教堂的长椅上，与两位设计图纸的修士讨论方案。公开透明的合作能让所有人的努力都看得到方向。',
  },
  {
    Id: 'minor_pentacles_04', Index: '4', NameCn: '金币四', NameEn: 'Four of Pentacles',
    Keywords: '守财 控制 安全 固执 囤积',
    Suit: PENTACLES, Type: CST, Rarity: C,
    ApCost: 2,
    EffectDescription: '直至下回合你行动前，你的私有领土不会降到当前值以下。（AP 消耗除外）',
    EffectPhase: 'SelectMode', EffectTarget: SELF, EffectMechanic: 'TerritoryFloor',
    Duration: 1, ZeroSum: false, Condition: null, Trigger: null,
    Lore: '一人头戴王冠，紧紧抓住一枚金币贴在胸前，双脚各踩一枚金币，头顶还顶着一枚。他拥有很多，但也因此被自己的财富牢牢困住。',
  },
  {
    Id: 'minor_pentacles_05', Index: '5', NameCn: '金币五', NameEn: 'Five of Pentacles',
    Keywords: '匮乏 疏离 困苦 忽视 寒冷',
    Suit: PENTACLES, Type: CST, Rarity: C,
    ApCost: 2,
    EffectDescription: '之后的 2 个己方回合结束时，场上私有领土最高的其他玩家失去 1 私有领土（进入公共池）。',
    EffectPhase: 'SelectMode', EffectTarget: RICHEST, EffectMechanic: 'LeaderLeech',
    Duration: 2, ZeroSum: true, Condition: null, Trigger: null,
    Lore: '两个衣衫褴褛的人在暴风雪中相互搀扶，经过一座明亮的教堂窗口。匮乏不仅是物质上的，也是心态上的自我放逐。',
  },
  {
    Id: 'minor_pentacles_06', Index: '6', NameCn: '金币六', NameEn: 'Six of Pentacles',
    Keywords: '施舍 慷慨 分配 不平等 恩惠',
    Suit: PENTACLES, Type: CST, Rarity: C,
    ApCost: 3,
    EffectDescription: '之后的 2 个己方回合中，每当有玩家通过占领获得私有领土时，你也获得 +1（凭空创造）。',
    EffectPhase: 'SelectMode', EffectTarget: SELF, EffectMechanic: 'MirrorGain',
    Duration: 2, ZeroSum: false, Condition: null, Trigger: null,
    Lore: '一位富商手持天秤，将金币分发给两名跪着的乞丐。从他人的丰收中分一杯羹，既是恩赐，也��寄生。',
  },
  {
    Id: 'minor_pentacles_07', Index: '7', NameCn: '金币七', NameEn: 'Seven of Pentacles',
    Keywords: '等待 评估 耕耘 耐心 投资',
    Suit: PENTACLES, Type: CST, Rarity: C,
    ApCost: 2,
    EffectDescription: '之后的 2 个己方回合中，你的开发链不会因掷出非对子而清零。',
    EffectPhase: 'SelectMode', EffectTarget: SELF, EffectMechanic: 'DevChainProtect',
    Duration: 2, ZeroSum: false, Condition: null, Trigger: null,
    Lore: '一位农夫拄着锄头，凝视着一棵正在生长的灌木。灌木上结了七枚金币，但他还没有摘下——耕耘时的耐心，决定了收获时的质量。',
  },
  {
    Id: 'minor_pentacles_08', Index: '8', NameCn: '金币八', NameEn: 'Eight of Pentacles',
    Keywords: '精进 专注 练习 技能 匠心',
    Suit: PENTACLES, Type: CST, Rarity: C,
    ApCost: 2,
    EffectDescription: '之后的 3 个己方回合开始时，查看牌库顶部 1 张牌，可选择是否将其加入手牌。',
    EffectPhase: 'SelectMode', EffectTarget: SELF, EffectMechanic: 'ScryEachTurn',
    Duration: 3, ZeroSum: false, Condition: null, Trigger: null,
    Lore: '一位工匠坐在工作台前，专注地用锤子与凿子雕刻一枚金币。真正的大师不是天赋异禀，而是每天比昨天多雕一刀。',
  },
  {
    Id: 'minor_pentacles_09', Index: '9', NameCn: '金币九', NameEn: 'Nine of Pentacles',
    Keywords: '独立 享受 自足 优雅 丰收',
    Suit: PENTACLES, Type: CST, Rarity: C,
    ApCost: 3,
    EffectDescription: '之后的 3 个己方回合中，你使用卡牌时 AP 消耗 −1（最低为 0）。',
    EffectPhase: 'SelectMode', EffectTarget: SELF, EffectMechanic: 'ApDiscount',
    Duration: 3, ZeroSum: false, Condition: null, Trigger: null,
    Lore: '一位优雅的女子站在丰饶的花园中，左手轻抚身后九枚金币，右手停着一只猎隼。她的丰足来自自己的独立与经营。',
  },
  {
    Id: 'minor_pentacles_10', Index: '10', NameCn: '金币十', NameEn: 'Ten of Pentacles',
    Keywords: '传承 富足 家族 永恒 遗产',
    Suit: PENTACLES, Type: CST, Rarity: C,
    ApCost: 4,
    EffectDescription: '之后的 2 个己方回合结束时，从私有领土最高的其他玩家处窃取 1 私有领土归为己有。',
    EffectPhase: 'SelectMode', EffectTarget: RICHEST, EffectMechanic: 'RecurringSteal',
    Duration: 2, ZeroSum: false, Condition: null, Trigger: null,
    Lore: '一座繁华的中世纪城镇广场上，一位白发族长坐在拱门下，身边围绕着家人与忠犬。这是金币花色的终极——不是一个人的财富，而是世代传承的繁荣根基。',
  },
  {
    Id: 'minor_pentacles_page', Index: 'Page', NameCn: '金币侍从', NameEn: 'Page of Pentacles',
    Keywords: '学习 务实 种子 踏实 积累',
    Suit: PENTACLES, Type: CST, Rarity: U,
    ApCost: 1,
    EffectDescription: '下一个大轮发牌阶段，你额外多抽 2 张牌。',
    EffectPhase: 'SelectMode', EffectTarget: SELF, EffectMechanic: 'ExtraDrawNextRound',
    Duration: 1, ZeroSum: false, Condition: null, Trigger: null,
    Lore: '少年双手捧着金币专注凝视，眼中的金币仿佛是整个世界的缩影。他是所有宫廷牌中最踏实好学的——不急于求成，一步一个脚印。',
  },
  {
    Id: 'minor_pentacles_knight', Index: 'Knight', NameCn: '金币骑士', NameEn: 'Knight of Pentacles',
    Keywords: '稳重 勤奋 责任 坚守 效率',
    Suit: PENTACLES, Type: CST, Rarity: U,
    ApCost: 2,
    EffectDescription: '之后的 2 个己方回合中，针对你的反制牌 AP 消耗 +1（对方需多支付 1 AP 才能对你使用反制）。',
    EffectPhase: 'SelectMode', EffectTarget: SELF, EffectMechanic: 'CounterCostPenalty',
    Duration: 2, ZeroSum: false, Condition: null, Trigger: null,
    Lore: '骑士身骑黑马，手持金币，站在农田之中一动不动。他是四骑士中最慢的一个——但也是最可靠的一个。想对他出手？先掂量一下代价。',
  },
  {
    Id: 'minor_pentacles_queen', Index: 'Queen', NameCn: '金币女王', NameEn: 'Queen of Pentacles',
    Keywords: '滋养 务实 富足 持家 慷慨',
    Suit: PENTACLES, Type: CST, Rarity: U,
    ApCost: 3,
    EffectDescription: '之后的每个大轮，你使用的第一张卡牌 AP 消耗为 0。（若为 0 AP 的牌则照常免费）',
    EffectPhase: 'SelectMode', EffectTarget: SELF, EffectMechanic: 'FirstCardFree',
    Duration: 999, ZeroSum: false, Condition: null, Trigger: null,
    Lore: '女王端坐于花园中的宝座，双手捧着膝上的一枚大金币，温柔俯视。她懂得财富的真正意义是滋养生命，而非累积数字。',
  },
  {
    Id: 'minor_pentacles_king', Index: 'King', NameCn: '金币国王', NameEn: 'King of Pentacles',
    Keywords: '财富 稳健 成就 物质掌控',
    Suit: PENTACLES, Type: CST, Rarity: R,
    ApCost: 3,
    EffectDescription: '每个大轮结束时，你额外获得 1 私有领土（凭空创造）。此效果持续整场对局。',
    EffectPhase: 'SelectMode', EffectTarget: SELF, EffectMechanic: 'RoundEndIncome',
    Duration: 999, ZeroSum: false, Condition: null, Trigger: null,
    Lore: '国王身披绣有葡萄藤与金币图案的奢华长袍，安坐于饰满牛首与果实的宝座。财富对他而言早已不是追求的目标，而是持续运转的自然节律。',
  },
]);

/**
 * 按 ID 快速查找卡牌定义
 */
export const CARD_BY_ID: ReadonlyMap<string, CardDefinition> = new Map(
  ALL_TAROT_CARDS.map((D) => [D.Id, D]),
);

/**
 * 按花色获取卡牌列表
 */
export function GetCardsBySuit(Suit: CardSuit): readonly CardDefinition[] {
  return ALL_TAROT_CARDS.filter((C) => C.Suit === Suit);
}

/**
 * 获取所有大阿尔卡那
 */
export const MAJOR_ARCANA: readonly CardDefinition[] = ALL_TAROT_CARDS.filter(
  (C) => C.Suit === CardSuit.Major,
);

/**
 * 获取所有小阿尔卡那
 */
export const MINOR_ARCANA: readonly CardDefinition[] = ALL_TAROT_CARDS.filter(
  (C) => C.Suit !== CardSuit.Major,
);
