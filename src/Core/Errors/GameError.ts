/**
 * 游戏错误基类
 * 关联规范：CodeBuddy代码规范 §6.1
 * 所有 Core 层错误继承此类，带 Code 字段便于分类处理
 */
export class GameError extends Error {
  constructor(Message: string, public readonly Code: string) {
    super(Message);
    this.name = 'GameError';
    // 维持原型链（TS 编译 ES5 目标时需要，ESNext 目标下也无害）
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
