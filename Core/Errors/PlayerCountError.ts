/**
 * 玩家数非法错误
 */
import { GameError } from './GameError';

export class PlayerCountError extends GameError {
  constructor(Message: string = '玩家数必须在 2~4 之间') {
    super(Message, 'PLAYER_COUNT');
    this.name = 'PlayerCountError';
  }
}
