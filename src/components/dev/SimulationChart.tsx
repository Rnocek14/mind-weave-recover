import type { TrialLogEntry } from '@/lib/simulation/sessionSimulator';

interface Props {
  log: TrialLogEntry[];
  height?: number;
}

/**
 * Lightweight inline-SVG chart: difficulty + cue dependency over trials,
 * with markers for blocked escalations and difficulty changes.
 * No external chart deps — keeps the dev harness self-contained.
 */
export function SimulationChart({ log, height = 200 }: Props) {
  if (log.length === 0) return null;

  const width = Math.max(600, log.length * 18);
  const padX = 36;
  const padY = 24;
  const innerW = width - padX * 2;
  const innerH = height - padY * 2;

  const maxDiff = Math.max(10, ...log.map((l) => l.difficulty));
  const x = (i: number) => padX + (i / Math.max(1, log.length - 1)) * innerW;
  const yDiff = (d: number) => padY + innerH - (d / maxDiff) * innerH;
  const yCue = (c: number) => padY + innerH - c * innerH; // c is 0..1

  const diffPath = log.map((l, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${yDiff(l.difficulty)}`).join(' ');
  const cuePath = log.map((l, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${yCue(Math.min(1, l.cueDependency))}`).join(' ');

  return (
    <div className="w-full overflow-x-auto rounded border bg-card">
      <svg width={width} height={height} className="block">
        {/* Axes */}
        <line x1={padX} y1={padY} x2={padX} y2={height - padY} stroke="currentColor" strokeOpacity={0.2} />
        <line x1={padX} y1={height - padY} x2={width - padX} y2={height - padY} stroke="currentColor" strokeOpacity={0.2} />

        {/* Difficulty line */}
        <path d={diffPath} fill="none" stroke="hsl(var(--primary))" strokeWidth={2} />
        {/* Cue dependency line */}
        <path d={cuePath} fill="none" stroke="hsl(var(--destructive))" strokeWidth={1.5} strokeDasharray="4 3" />

        {/* Threshold line for cue dependency = 0.5 */}
        <line
          x1={padX}
          x2={width - padX}
          y1={yCue(0.5)}
          y2={yCue(0.5)}
          stroke="hsl(var(--destructive))"
          strokeOpacity={0.3}
          strokeDasharray="2 4"
        />

        {/* Event markers */}
        {log.map((l) => {
          const cx = x(l.trialIndex);
          const cy = yDiff(l.difficulty);
          if (l.escalationBlocked) {
            return (
              <g key={`b${l.trialIndex}`}>
                <circle cx={cx} cy={cy} r={5} fill="hsl(var(--destructive))" opacity={0.8} />
                <title>{`t${l.trialIndex} blocked: ${l.escalationBlocked.reason}`}</title>
              </g>
            );
          }
          if (l.difficultyChange) {
            const up = l.difficultyChange.direction === 'up';
            return (
              <g key={`c${l.trialIndex}`}>
                <circle cx={cx} cy={cy} r={4} fill={up ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))'} />
                <title>{`t${l.trialIndex} ${l.difficultyChange.direction}: ${l.difficultyChange.reason}`}</title>
              </g>
            );
          }
          return null;
        })}

        {/* Labels */}
        <text x={padX} y={padY - 6} fontSize={10} fill="currentColor" opacity={0.6}>
          difficulty (solid) · cue dependency (dashed) · ● up ○ down ⬤ blocked
        </text>
      </svg>
    </div>
  );
}
