/**
 * 发射未完成错误（在全员发射成功前尝试进入主循环）
 */
import { GameError } from './GameError';

export class LaunchNotCompletedError extends GameError {
  constructor(Message: string = '仍有玩家未发射成功，不能进入主循环') {
    super(Message, 'LAUNCH_NOT_COMPLETED');
    this.name = 'LaunchNotCompletedError';
  }
}
