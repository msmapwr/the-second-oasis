/**
 * 非法回合阶段错误（在错误阶段调用了方法）
 */
import { GameError } from './GameError';

export class InvalidTurnPhaseError extends GameError {
  constructor(Message: string = '当前阶段不允许此操作') {
    super(Message, 'INVALID_TURN_PHASE');
    this.name = 'InvalidTurnPhaseError';
  }
}
