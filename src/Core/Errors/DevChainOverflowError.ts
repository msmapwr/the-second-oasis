/**
 * 开发链溢出错误（状态机异常时抛出，正常流程不应触发）
 */
import { GameError } from './GameError';

export class DevChainOverflowError extends GameError {
  constructor(Message: string = '开发链状态机溢出') {
    super(Message, 'DEV_CHAIN_OVERFLOW');
    this.name = 'DevChainOverflowError';
  }
}
