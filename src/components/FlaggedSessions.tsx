import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Coffee, Battery, Clock, CheckCircle, XCircle } from "lucide-react";
import { SessionFlag } from "@/hooks/useCaregiverAnalytics";
import { format, parseISO } from "date-fns";

interface FlaggedSessionsProps {
  sessions: SessionFlag[];
}

export const FlaggedSessions = ({ sessions }: FlaggedSessionsProps) => {
  if (sessions.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-8">
            <CheckCircle className="h-12 w-12 text-primary mx-auto mb-4" />
            <p className="text-lg font-medium">No Flagged Sessions</p>
            <p className="text-sm text-muted-foreground mt-2">
              All recent sessions show good engagement and completion.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'red':
        return 'bg-destructive/10 border-destructive/20 text-destructive';
      case 'orange':
        return 'bg-orange-500/10 border-orange-500/20 text-orange-500';
      case 'yellow':
        return 'bg-yellow-500/10 border-yellow-500/20 text-yellow-600';
      default:
        return 'bg-muted';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'red':
        return <AlertCircle className="h-4 w-4" />;
      case 'orange':
        return <Battery className="h-4 w-4" />;
      case 'yellow':
        return <Coffee className="h-4 w-4" />;
      default:
        return null;
    }
  };

  const getInterventionIcon = (type: string) => {
    switch (type) {
      case 'frustration':
        return '😤';
      case 'fatigue':
        return '😮‍💨';
      case 'quit_attempt':
        return '🚪';
      default:
        return '⚠️';
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Flagged Sessions</CardTitle>
          <CardDescription>
            Sessions with engagement concerns (last 30 days)
          </CardDescription>
        </CardHeader>
      </Card>

      {sessions.map((session) => {
        const engagementSummary = (session.engagement_summary as any) || {};
        const sessionSummary = session.summary as any;
        const accuracy = sessionSummary?.accuracy 
          ? Math.round(sessionSummary.accuracy * 100) 
          : null;

        return (
          <Card key={session.id} className={getSeverityColor(session.severity)}>
            <CardContent className="pt-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-2">
                  {getSeverityIcon(session.severity)}
                  <div>
                    <p className="font-medium">
                      {format(parseISO(session.started_at), 'MMM d, yyyy • h:mm a')}
                    </p>
                    <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                      <Clock className="h-3 w-3" />
                      {session.duration_sec 
                        ? `${Math.round(session.duration_sec / 60)} minutes`
                        : 'Incomplete'}
                    </p>
                  </div>
                </div>

                <Badge variant="outline" className={getSeverityColor(session.severity)}>
                  {session.severity.toUpperCase()}
                </Badge>
              </div>

              {/* Engagement Flags */}
              {(engagementSummary.frustration || engagementSummary.fatigue) && (
                <div className="flex gap-2 mb-3 flex-wrap">
                  {engagementSummary.frustration && engagementSummary.frustration !== 'none' && (
                    <Badge variant="secondary" className="text-xs">
                      Frustration: {engagementSummary.frustration}
                    </Badge>
                  )}
                  {engagementSummary.fatigue && engagementSummary.fatigue !== 'none' && (
                    <Badge variant="secondary" className="text-xs">
                      Fatigue: {engagementSummary.fatigue}
                    </Badge>
                  )}
                  {accuracy !== null && (
                    <Badge variant="secondary" className="text-xs">
                      Accuracy: {accuracy}%
                    </Badge>
                  )}
                </div>
              )}

              {/* Interventions */}
              {session.interventions.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">
                    Interventions ({session.interventions.length})
                  </p>
                  <div className="space-y-2">
                    {session.interventions.map((intervention) => (
                      <div 
                        key={intervention.id}
                        className="flex items-center justify-between p-2 rounded-md bg-background/50 text-sm"
                      >
                        <div className="flex items-center gap-2">
                          <span>{getInterventionIcon(intervention.trigger_type)}</span>
                          <div>
                            <p className="font-medium capitalize">
                              {intervention.intervention.replace(/_/g, ' ')}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {format(parseISO(intervention.created_at), 'h:mm a')}
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-1">
                          {intervention.user_action === 'accepted' && (
                            <Badge variant="outline" className="text-xs bg-primary/10 border-primary/20 text-primary">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Accepted
                            </Badge>
                          )}
                          {intervention.user_action === 'dismissed' && (
                            <Badge variant="outline" className="text-xs bg-muted">
                              <XCircle className="h-3 w-3 mr-1" />
                              Dismissed
                            </Badge>
                          )}
                          {!intervention.user_action && (
                            <Badge variant="outline" className="text-xs bg-muted">
                              No response
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Quick interpretation */}
              {session.severity === 'red' && (
                <div className="mt-3 pt-3 border-t text-sm text-muted-foreground">
                  <p className="font-medium text-destructive mb-1">Needs attention</p>
                  <p>
                    {!session.ended_at && 'Session ended early. '}
                    {engagementSummary.fatigue === 'high' && 'High fatigue detected. '}
                    Consider reviewing session timing or difficulty level.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};
