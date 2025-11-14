import { AdminResearchAnalytics } from '@/hooks/useAdminResearchAnalytics';

export const exportToCSV = (analytics: AdminResearchAnalytics): string => {
  const headers = [
    'Cluster',
    'Stroke_Mechanism',
    'Hemisphere',
    'Lesion_Zone',
    'Chronicity',
    'Cohort_Size',
    'Avg_Accuracy_%',
    'Improvement_Trend',
    'Sessions_Per_Week',
    'Red_Flag_Rate',
    'Plateau_Acceptance_%',
    'Fatigue_Acceptance_%',
    'Low_Engagement_Acceptance_%',
    'Low_Adherence_Acceptance_%',
    'Accuracy_StdDev',
    'Trend_StdDev',
    'Top_Strategy_1',
    'Top_Strategy_1_Score_%',
    'Top_Strategy_2',
    'Top_Strategy_2_Score_%'
  ];

  const rows = analytics.clusters.map(cluster => {
    const clusterLabel = `${cluster.clusterProfile.strokeMechanism}_${cluster.clusterProfile.hemisphere}_${cluster.clusterProfile.lesionZone}_${cluster.clusterProfile.chronicity}`;
    
    return [
      clusterLabel,
      cluster.clusterProfile.strokeMechanism,
      cluster.clusterProfile.hemisphere,
      cluster.clusterProfile.lesionZone,
      cluster.clusterProfile.chronicity,
      cluster.metrics.cohortSize,
      (cluster.metrics.avgSessionAccuracy * 100).toFixed(1),
      cluster.metrics.improvementTrend.toFixed(3),
      cluster.metrics.sessionsPerWeek.toFixed(1),
      cluster.metrics.redFlagRate.toFixed(3),
      ((cluster.metrics.interventionAcceptance.plateau || 0) * 100).toFixed(1),
      ((cluster.metrics.interventionAcceptance.fatigue || 0) * 100).toFixed(1),
      ((cluster.metrics.interventionAcceptance.low_engagement || 0) * 100).toFixed(1),
      ((cluster.metrics.interventionAcceptance.low_adherence || 0) * 100).toFixed(1),
      cluster.metrics.outcomeVariability.accuracyStdDev.toFixed(3),
      cluster.metrics.outcomeVariability.trendStdDev.toFixed(3),
      cluster.topStrategies[0]?.name || 'N/A',
      ((cluster.topStrategies[0]?.effectivenessScore || 0) * 100).toFixed(1),
      cluster.topStrategies[1]?.name || 'N/A',
      ((cluster.topStrategies[1]?.effectivenessScore || 0) * 100).toFixed(1)
    ];
  });

  return [headers, ...rows]
    .map(row => row.map(cell => `"${cell}"`).join(','))
    .join('\n');
};

export const downloadCSV = (csv: string, filename: string) => {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
};
