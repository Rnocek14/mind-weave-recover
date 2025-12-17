import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, AlertTriangle, Info, Calendar, MessageCircle, Eye, X } from "lucide-react";
import { RedFlag, RedFlagSeverity } from "@/lib/redFlagDetector";
import { useState } from "react";

interface RedFlagAlertsProps {
  flags: RedFlag[];
  onDismiss?: (flag: RedFlag, notes?: string) => void;
}

export const RedFlagAlerts = ({ flags, onDismiss }: RedFlagAlertsProps) => {
  const [dismissedFlags, setDismissedFlags] = useState<Set<string>>(new Set());

  if (flags.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-3 p-4 rounded-lg bg-primary/10 border border-primary/20">
            <Info className="h-5 w-5 text-primary flex-shrink-0" />
            <div>
              <p className="font-medium text-primary">All Clear</p>
              <p className="text-sm text-muted-foreground mt-1">
                No red flags detected. User is progressing well.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const getSeverityIcon = (severity: RedFlagSeverity) => {
    switch (severity) {
      case 'red':
        return <AlertCircle className="h-5 w-5" />;
      case 'orange':
        return <AlertTriangle className="h-5 w-5" />;
      case 'yellow':
        return <Info className="h-5 w-5" />;
    }
  };

  const getSeverityStyles = (severity: RedFlagSeverity) => {
    switch (severity) {
      case 'red':
        return 'border-destructive/50 bg-destructive/5 text-destructive';
      case 'orange':
        return 'border-orange-500/50 bg-orange-500/5 text-orange-600';
      case 'yellow':
        return 'border-yellow-500/50 bg-yellow-500/5 text-yellow-600';
    }
  };

  const getEscalationAction = (severity: RedFlagSeverity) => {
    switch (severity) {
      case 'red':
        return {
          label: 'Schedule clinician review',
          icon: Calendar,
          description: 'This pattern may need professional evaluation',
        };
      case 'orange':
        return {
          label: 'Discuss with caregiver',
          icon: MessageCircle,
          description: 'Consider discussing this with the care team',
        };
      case 'yellow':
        return {
          label: 'Monitor this week',
          icon: Eye,
          description: 'Keep an eye on this pattern',
        };
    }
  };

  const handleDismiss = (flag: RedFlag, index: number) => {
    const flagKey = `${flag.type}-${index}`;
    setDismissedFlags(prev => new Set([...prev, flagKey]));
    onDismiss?.(flag, 'Acknowledged by user');
  };

  // Sort by severity: red > orange > yellow
  const sortedFlags = [...flags].sort((a, b) => {
    const severityOrder = { red: 0, orange: 1, yellow: 2 };
    return severityOrder[a.severity] - severityOrder[b.severity];
  });

  const visibleFlags = sortedFlags.filter((_, index) => 
    !dismissedFlags.has(`${sortedFlags[index].type}-${index}`)
  );

  if (visibleFlags.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-3 p-4 rounded-lg bg-primary/10 border border-primary/20">
            <Info className="h-5 w-5 text-primary flex-shrink-0" />
            <div>
              <p className="font-medium text-primary">Flags Acknowledged</p>
              <p className="text-sm text-muted-foreground mt-1">
                All flags have been reviewed and acknowledged.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-destructive" />
          Red Flag Alerts
        </CardTitle>
        <CardDescription>
          {visibleFlags.length} potential concern{visibleFlags.length !== 1 ? 's' : ''} detected requiring attention
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {visibleFlags.map((flag, index) => {
          const escalation = getEscalationAction(flag.severity);
          const EscalationIcon = escalation.icon;
          
          return (
            <Alert key={index} className={getSeverityStyles(flag.severity)}>
              <div className="flex flex-col gap-3">
                <div className="flex gap-3">
                  {getSeverityIcon(flag.severity)}
                  <div className="flex-1 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <AlertDescription className="font-medium text-base">
                          {flag.message}
                        </AlertDescription>
                        <AlertDescription className="mt-1">
                          {flag.details}
                        </AlertDescription>
                      </div>
                      <Badge variant="outline" className={getSeverityStyles(flag.severity)}>
                        {flag.severity.toUpperCase()}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Detected: {new Date(flag.detectedAt).toLocaleString()}
                    </p>
                  </div>
                </div>
                
                {/* Escalation CTA */}
                <div className="flex items-center gap-2 pt-2 border-t border-current/10">
                  <Button
                    size="sm"
                    variant={flag.severity === 'red' ? 'default' : 'outline'}
                    className="gap-1.5"
                    onClick={() => {
                      // For now, just show a toast - in a full implementation this would
                      // open a scheduling modal or contact form
                      console.log('Escalation action:', escalation.label, flag);
                    }}
                  >
                    <EscalationIcon className="h-3.5 w-3.5" />
                    {escalation.label}
                  </Button>
                  
                  {flag.severity !== 'red' && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="gap-1.5 text-muted-foreground"
                      onClick={() => handleDismiss(flag, index)}
                    >
                      <X className="h-3.5 w-3.5" />
                      Dismiss
                    </Button>
                  )}
                  
                  <span className="text-xs text-muted-foreground ml-auto">
                    {escalation.description}
                  </span>
                </div>
              </div>
            </Alert>
          );
        })}
      </CardContent>
    </Card>
  );
};
