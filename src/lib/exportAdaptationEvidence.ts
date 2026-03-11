/**
 * Export Adaptation Evidence
 * 
 * CSV export and copy-to-clipboard summary for adaptation proof data.
 */

import type { AdaptationProofSummary } from '@/hooks/useAdaptationProof';
import type { AdaptationOutcomesSummary } from '@/hooks/useAdaptationOutcomes';

export function buildAdaptationCSV(
  summary: AdaptationProofSummary,
  outcomes: AdaptationOutcomesSummary | null,
): string {
  const headers = [
    'Exercise',
    'Total_Trials',
    'Telemetry_Coverage_%',
    'Adapted_Trials',
    'Adaptation_Rate_%',
    'Dominant_Mode',
    'Focus_Phonemes',
    'Top_Cue_Type',
    'Difficulty_Range',
    'Data_Quality_Issues',
  ];

  const rows = summary.rows.map(row => {
    const modes = Object.entries(row.adaptationModes).sort((a, b) => b[1] - a[1]);
    const dominantMode = modes[0]?.[0] || 'none';
    const cues = Object.entries(row.cueTypesRecommended)
      .filter(([k]) => k !== 'none')
      .sort((a, b) => b[1] - a[1]);
    const topCue = cues[0]?.[0] || 'none';
    const diffs = Object.keys(row.difficultyLevels).map(Number).sort();
    const diffRange = diffs.length > 1 ? `${diffs[0]}-${diffs[diffs.length - 1]}` : (diffs[0]?.toString() || '—');

    return [
      row.exerciseSlug,
      row.totalTrials,
      Math.round(row.telemetryCoverage * 100),
      row.adaptedTrials,
      Math.round(row.adaptationRate * 100),
      dominantMode,
      row.focusPhonemesUsed.join('; ') || 'none',
      topCue,
      diffRange,
      row.dataQualityIssues.length,
    ];
  });

  // Add summary row
  rows.push([
    'TOTAL',
    summary.totalTrials,
    Math.round(summary.telemetryCoverage * 100),
    summary.totalAdapted,
    Math.round(summary.overallAdaptationRate * 100),
    summary.dominantMode,
    '',
    '',
    '',
    summary.globalDataQuality.length,
  ]);

  let csv = [headers, ...rows]
    .map(row => row.map(cell => `"${cell}"`).join(','))
    .join('\n');

  // Append outcomes if available
  if (outcomes) {
    csv += '\n\n"Outcome Comparisons"\n';
    csv += '"Comparison","Group_A","A_Accuracy_%","A_Trials","Group_B","B_Accuracy_%","B_Trials","Lift_pp","Significant"\n';
    for (const comp of outcomes.comparisons) {
      csv += [
        comp.label,
        comp.groupA.name,
        Math.round(comp.groupA.accuracy * 100),
        comp.groupA.trials,
        comp.groupB.name,
        Math.round(comp.groupB.accuracy * 100),
        comp.groupB.trials,
        comp.lift.toFixed(1),
        comp.significant ? 'Yes' : 'No',
      ].map(c => `"${c}"`).join(',') + '\n';
    }
  }

  return csv;
}

export function buildTextSummary(
  summary: AdaptationProofSummary,
  outcomes: AdaptationOutcomesSummary | null,
  daysBack: number,
): string {
  const lines: string[] = [
    `Adaptation Summary (${daysBack} days)`,
    `─────────────────────────────`,
    `Trials: ${summary.totalTrials}`,
    `Telemetry coverage: ${Math.round(summary.telemetryCoverage * 100)}%`,
    `Adapted trials: ${Math.round(summary.overallAdaptationRate * 100)}%`,
    `Games adapted: ${summary.gamesWithAdaptation} / ${summary.totalGames}`,
    `Dominant mode: ${summary.dominantMode}`,
    '',
  ];

  if (outcomes && outcomes.hasEnoughData) {
    lines.push(
      'Outcome Comparison',
      `─────────────────────────────`,
      `Adapted accuracy: ${Math.round(outcomes.adaptedAccuracy * 100)}%`,
      `Non-adapted accuracy: ${Math.round(outcomes.nonAdaptedAccuracy * 100)}%`,
      `Lift: ${outcomes.overallLift > 0 ? '+' : ''}${outcomes.overallLift.toFixed(1)}pp`,
      '',
    );

    for (const comp of outcomes.comparisons) {
      if (comp.groupA.trials > 0 && comp.groupB.trials > 0) {
        lines.push(
          `${comp.label}: ${Math.round(comp.groupA.accuracy * 100)}% vs ${Math.round(comp.groupB.accuracy * 100)}% (${comp.lift > 0 ? '+' : ''}${comp.lift.toFixed(1)}pp)`,
        );
      }
    }
  }

  if (summary.globalDataQuality.length > 0) {
    lines.push('', 'Data Quality Issues:');
    for (const issue of summary.globalDataQuality) {
      lines.push(`⚠ ${issue.description} (${issue.count}×)`);
    }
  }

  return lines.join('\n');
}

export function downloadCSV(csv: string, filename: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}
