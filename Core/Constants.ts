/**
 * src/Core/Constants.ts
 * 操作类型：修改
 *
 * 核心常量定义
 * 关联规则：计划书 §5 核心数值表 + v1.2 变体包参数
 */

/** 公共领土上限（= 初值） */
export const MAX_PUBLIC_TERRITORY = 100;

/** 公共领土初值 */
export const INITIAL_PUBLIC_TERRITORY = 100;

/** 私有领土初值 */
export const INITIAL_PRIVATE_TERRITORY = 0;

/** 抢夺阈值 m（Q1：占领使公共<0 触发抢夺） */
export const ROBBERY_THRESHOLD_M = 0;

/** 发射成功阈值（双骰和 ≥7） */
export const LAUNCH_THRESHOLD = 7;

/** 发射成功奖励（私有 +2） */
export const LAUNCH_REWARD = 2;

/** 崩坏系数初值（每次崩坏 +1） */
export const COLLAPSE_INITIAL_X = 2;

/** 最大玩家数 */
export const MAX_PLAYERS = 4;

/** 最小玩家数 */
export const MIN_PLAYERS = 2;

/** 开发过度阈值（第 3 次连续对子触发） */
export const DEV_CHAIN_OVERLOAD_THRESHOLD = 3;

/** v1.2 默认：公敌税基础值 */
export const DEFAULT_LEADER_TAX_BASE = 1;

/** v1.2 默认：枯竭冲刺阈值 */
export const DEFAULT_SPRINT_THRESHOLD = 30;

/** v1.2 默认：枯竭冲刺奖励 */
export const DEFAULT_SPRINT_BONUS = 2;

/** v1.2 默认：复仇成功阈值 */
export const DEFAULT_REVENGE_SUCCESS_THRESHOLD = 4;

/** v1.2 默认：复仇失败成本 */
export const DEFAULT_REVENGE_FAILURE_COST = 1;
