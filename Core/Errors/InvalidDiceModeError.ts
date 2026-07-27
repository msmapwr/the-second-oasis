/**
 * 非法掷骰模式错误
 */
import { GameError } from './GameError';

export class InvalidDiceModeError extends GameError {
  constructor(Message: string = '非法的掷骰模式') {
    super(Message, 'INVALID_DICE_MODE');
    this.name = 'InvalidDiceModeError';
  }
}
