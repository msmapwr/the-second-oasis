/**
 * 抢夺阈值错误（无防守者可用等异常情况）
 */
import { GameError } from './GameError';

export class RobberyThresholdError extends GameError {
  constructor(Message: string = '抢夺裁决异常：无有效防守者') {
    super(Message, 'ROBBERY_THRESHOLD');
    this.name = 'RobberyThresholdError';
  }
}
