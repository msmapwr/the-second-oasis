/**
 * 游戏阶段枚举
 * 关联规则：计划书 §6 回合流程
 * GameState 状态机的所有合法阶段
 */
export enum GamePhase {
  /** 初始化（构造后未启动） */
  Init = 'Init',
  /** 发射序章（首轮 / 开发过度后玩家重新发射） */
  LaunchPhase = 'LaunchPhase',
  /** 等待玩家选模式 */
  SelectMode = 'SelectMode',
  /** 掷骰中（内部瞬态） */
  Rolling = 'Rolling',
  /** 开发链判定中（内部瞬态） */
  DevChainResolving = 'DevChainResolving',
  /** 占领结算中（内部瞬态） */
  Occupying = 'Occupying',
  /** 溢出判定中（内部瞬态） */
  OverflowChecking = 'OverflowChecking',
  /** 抢夺裁决中（内部瞬态） */
  RobberyResolving = 'RobberyResolving',
  /** 崩坏结算中（内部瞬态） */
  CollapseResolving = 'CollapseResolving',
  /** 回合结束，待推进下一位玩家 */
  TurnEnd = 'TurnEnd',
  /** 终局（公共归零） */
  GameOver = 'GameOver',
  /** 加赛中（终局平局时） */
  Tiebreaker = 'Tiebreaker',
}
