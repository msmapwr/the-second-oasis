import { El, Clear } from '../Dom';
import { Component } from './Component';
import { PlayerPalette } from '@/Store/PlayerPalette';
import { LOG_LEVEL_COLORS } from '@/UI/Theme';
import { FONT_STACK } from '@/Config/UiConstants';
import { DiceMode } from '@/Types/Dice';
import type { DecisionTrace, ModeEvaluation } from '@/AI/TransparentLog';
import { IsModeTrace } from '@/AI/TransparentLog';

export type LogLevel =
  | 'Info' | 'Dice' | 'Occupy' | 'Robbery' | 'Collapse' | 'Overload'
  | 'Launch' | 'Tiebreaker' | 'GameOver' | 'Tax' | 'Sprint' | 'Revenge';

export class BattleLogTerminal extends Component {
  private _LogBody!: HTMLElement;

  Mount(Parent: HTMLElement): void {
    const Wrap = El({ Tag: 'div', Class: 'battle-log panel-surface', Parent });
    El({
      Tag: 'div', Class: 'font-mono text-dim', Parent: Wrap,
      Style: 'font-size:11px;margin-bottom:4px;letter-spacing:1px;',
      Text: '战局日志',
    });
    this._LogBody = El({
      Tag: 'div', Class: 'log-terminal', Parent: Wrap,
      Style:
        'flex:1;overflow-y:auto;padding:10px;background:var(--space-bg);' +
        'border:1px solid var(--space-border);font-family:' + FONT_STACK.Mono + ';' +
        'font-size:12px;line-height:1.6;',
    });
    this.SetRoot(Wrap);
  }

  AppendLog(Level: LogLevel, Text: string): void {
    const Color = LOG_LEVEL_COLORS[Level] ?? '#9CA3AF';
    const Time = new Date();
    const TimeStr =
      String(Time.getHours()).padStart(2, '0') + ':' +
      String(Time.getMinutes()).padStart(2, '0') + ':' +
      String(Time.getSeconds()).padStart(2, '0');
    const Line = El({
      Tag: 'div', Parent: this._LogBody,
      Class: 'log-line fade-in',
      Style: `color:${Color};`,
    });
    El({ Tag: 'span', Parent: Line, Class: 'text-dim', Style: 'margin-right:8px;', Text: `[${TimeStr}]` });
    El({ Tag: 'span', Parent: Line, Style: `color:${Color};`, Text });
    this._LogBody.scrollTop = this._LogBody.scrollHeight;
  }

  AppendAIDecision(Trace: DecisionTrace): void {
    const Player = PlayerPalette.LabelLong(Trace.PlayerId);
    if (IsModeTrace(Trace)) {
      const EvalText = Trace.Evaluations.map((E: ModeEvaluation) => {
        const ModeName =
          E.Mode === DiceMode.Steady ? '稳健' :
          E.Mode === DiceMode.Aggressive ? '激进' :
          E.Mode === DiceMode.Revenge ? '复仇' : '不开发';
        return `${ModeName}:${E.FinalScore.toFixed(1)}`;
      }).join(' / ');
      this.AppendLog('Info', `[${Player}] ${Trace.Reason}（评分：${EvalText}）`);
    } else {
      this.AppendLog('Info', `[${Player}] ${Trace.Reason}`);
    }
  }

  ClearLog(): void {
    Clear(this._LogBody);
  }
}
