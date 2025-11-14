import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, AlertTriangle, Info } from "lucide-react";
import { RedFlag, RedFlagSeverity } from "@/lib/redFlagDetector";

interface RedFlagAlertsProps {
  flags: RedFlag[];
}

export const RedFlagAlerts = ({ flags }: RedFlagAlertsProps) => {
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

  // Sort by severity: red > orange > yellow
  const sortedFlags = [...flags].sort((a, b) => {
    const severityOrder = { red: 0, orange: 1, yellow: 2 };
    return severityOrder[a.severity] - severityOrder[b.severity];
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-destructive" />
          Red Flag Alerts
        </CardTitle>
        <CardDescription>
          {flags.length} potential concern{flags.length !== 1 ? 's' : ''} detected requiring attention
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {sortedFlags.map((flag, index) => (
          <Alert key={index} className={getSeverityStyles(flag.severity)}>
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
          </Alert>
        ))}
      </CardContent>
    </Card>
  );
};
