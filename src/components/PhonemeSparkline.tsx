/**
 * Tiny SVG sparkline for phoneme accuracy trends
 * No external dependencies - pure SVG polyline
 */

import { memo } from 'react';
import { cn } from '@/lib/utils';

interface SparklinePoint {
  accuracy: number;
}

interface PhonemeSparklineProps {
  points: SparklinePoint[];
  width?: number;
  height?: number;
  className?: string;
  showDelta?: boolean;
  delta?: number | null;
}

export const PhonemeSparkline = memo(({
  points,
  width = 64,
  height = 20,
  className,
  showDelta = true,
  delta,
}: PhonemeSparklineProps) => {
  // Need at least 3 points for a meaningful sparkline
  if (points.length < 3) {
    return (
      <span className={cn("text-xs text-muted-foreground italic", className)}>
        Needs more data
      </span>
    );
  }

  // Build SVG path
  const padding = 2;
  const innerWidth = width - padding * 2;
  const innerHeight = height - padding * 2;

  // Normalize Y values (0-100 accuracy → SVG coordinates)
  const minY = 0;
  const maxY = 100;
  const yScale = (val: number) => 
    padding + innerHeight - ((val - minY) / (maxY - minY)) * innerHeight;

  // X evenly spaced
  const xStep = innerWidth / (points.length - 1);
  const xScale = (idx: number) => padding + idx * xStep;

  // Build polyline points string
  const polylinePoints = points
    .map((p, i) => `${xScale(i)},${yScale(p.accuracy)}`)
    .join(' ');

  // Determine trend color based on overall direction
  const firstPoint = points[0].accuracy;
  const lastPoint = points[points.length - 1].accuracy;
  const overallTrend = lastPoint - firstPoint;
  
  const strokeColor = overallTrend >= 5 
    ? 'hsl(var(--success))' 
    : overallTrend <= -5 
      ? 'hsl(var(--destructive))' 
      : 'hsl(var(--muted-foreground))';

  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <svg 
        width={width} 
        height={height} 
        className="shrink-0"
        aria-label={`Trend: ${points.length} data points`}
      >
        {/* Subtle background line at 70% (threshold) */}
        <line
          x1={padding}
          y1={yScale(70)}
          x2={width - padding}
          y2={yScale(70)}
          stroke="hsl(var(--muted))"
          strokeWidth={1}
          strokeDasharray="2,2"
        />
        {/* Sparkline */}
        <polyline
          points={polylinePoints}
          fill="none"
          stroke={strokeColor}
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Endpoint dot */}
        <circle
          cx={xScale(points.length - 1)}
          cy={yScale(lastPoint)}
          r={2}
          fill={strokeColor}
        />
      </svg>

      {/* Delta chip */}
      {showDelta && delta !== null && delta !== 0 && (
        <span
          className={cn(
            "text-xs font-medium",
            delta > 0 ? "text-success" : "text-destructive"
          )}
        >
          {delta > 0 ? '+' : ''}{delta}%
        </span>
      )}
    </div>
  );
});

PhonemeSparkline.displayName = 'PhonemeSparkline';
