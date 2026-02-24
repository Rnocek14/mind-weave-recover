import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ClipboardList } from 'lucide-react';
import { useStandardizedAssessments } from '@/hooks/useStandardizedAssessments';
import { AddAssessmentDialog } from '@/components/AddAssessmentDialog';
import { Skeleton } from '@/components/ui/skeleton';

interface StandardizedAssessmentsCardProps {
  userId: string;
}

export function StandardizedAssessmentsCard({ userId }: StandardizedAssessmentsCardProps) {
  const { assessments, loading, addAssessment } = useStandardizedAssessments(userId);

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  // Group by type, show latest only
  const latestByType = new Map<string, typeof assessments[0]>();
  assessments.forEach(a => {
    if (!latestByType.has(a.assessmentType)) {
      latestByType.set(a.assessmentType, a);
    }
  });

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

  const getScoreSummary = (type: string, scores: Record<string, any>) => {
    switch (type) {
      case 'WAB-R':
        return scores.aphasia_quotient != null ? `AQ: ${scores.aphasia_quotient}` : null;
      case 'BNT':
        return scores.total_correct != null ? `${scores.total_correct}/60` : null;
      case 'NIHSS':
        return scores.total_score != null ? `Score: ${scores.total_score}` : null;
      case 'ASHA-NOMS':
        return scores.spoken_expression != null ? `Expression: ${scores.spoken_expression}/7` : null;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div /> {/* spacer */}
        <AddAssessmentDialog onAdd={addAssessment} />
      </div>

      {latestByType.size === 0 ? (
        <div className="text-center py-6 text-muted-foreground">
          <ClipboardList className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No standardized assessments recorded yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {Array.from(latestByType.entries()).map(([type, assessment]) => {
            const summary = getScoreSummary(type, assessment.scores);
            return (
              <Card key={type} className="p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <Badge variant="secondary" className="shrink-0">{type}</Badge>
                    <div className="min-w-0">
                      {summary && <p className="text-sm font-medium">{summary}</p>}
                      <p className="text-xs text-muted-foreground">{formatDate(assessment.assessmentDate)}</p>
                    </div>
                  </div>
                  {assessment.notes && (
                    <p className="text-xs text-muted-foreground truncate max-w-[150px]">{assessment.notes}</p>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
