import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { 
  AlertTriangle, 
  RefreshCw, 
  Clock,
  CreditCard,
  Wifi,
  HelpCircle
} from 'lucide-react';

interface RecoverySummaryErrorStateProps {
  title: string;
  description: string;
  error: Error | null;
  onRetry: () => void;
  isRetrying: boolean;
}

export const RecoverySummaryErrorState = ({ 
  title, 
  description,
  error,
  onRetry,
  isRetrying
}: RecoverySummaryErrorStateProps) => {
  // Determine error type and customize message
  const getErrorDetails = () => {
    const errorMessage = error?.message?.toLowerCase() || '';
    
    if (errorMessage.includes('rate limit')) {
      return {
        icon: Clock,
        iconColor: 'text-orange-500',
        bgColor: 'bg-orange-50 dark:bg-orange-950/20',
        borderColor: 'border-orange-200 dark:border-orange-900',
        title: 'Rate Limit Reached',
        message: 'Too many requests in a short time. Please wait a moment before trying again.',
        suggestion: 'Try again in about 60 seconds.',
        severity: 'warning' as const
      };
    }
    
    if (errorMessage.includes('payment') || errorMessage.includes('credit') || errorMessage.includes('quota')) {
      return {
        icon: CreditCard,
        iconColor: 'text-amber-500',
        bgColor: 'bg-amber-50 dark:bg-amber-950/20',
        borderColor: 'border-amber-200 dark:border-amber-900',
        title: 'Service Unavailable',
        message: 'AI summary generation requires active credits or payment.',
        suggestion: 'Please check your account settings or contact support.',
        severity: 'warning' as const
      };
    }
    
    if (errorMessage.includes('network') || errorMessage.includes('fetch') || errorMessage.includes('timeout')) {
      return {
        icon: Wifi,
        iconColor: 'text-blue-500',
        bgColor: 'bg-blue-50 dark:bg-blue-950/20',
        borderColor: 'border-blue-200 dark:border-blue-900',
        title: 'Connection Issue',
        message: 'Unable to reach the AI service. Please check your internet connection.',
        suggestion: 'Make sure you\'re connected to the internet and try again.',
        severity: 'error' as const
      };
    }
    
    if (errorMessage.includes('404') || errorMessage.includes('not found')) {
      return {
        icon: HelpCircle,
        iconColor: 'text-purple-500',
        bgColor: 'bg-purple-50 dark:bg-purple-950/20',
        borderColor: 'border-purple-200 dark:border-purple-900',
        title: 'Service Configuration Error',
        message: 'The AI summary service endpoint could not be found.',
        suggestion: 'This may be a temporary issue. Please try again or contact support if it persists.',
        severity: 'error' as const
      };
    }

    // Default error
    return {
      icon: AlertTriangle,
      iconColor: 'text-red-500',
      bgColor: 'bg-red-50 dark:bg-red-950/20',
      borderColor: 'border-red-200 dark:border-red-900',
      title: 'Generation Failed',
      message: error?.message || 'An unexpected error occurred while generating your summary.',
      suggestion: 'Please try again. If the problem persists, contact support.',
      severity: 'error' as const
    };
  };

  const errorDetails = getErrorDetails();
  const ErrorIcon = errorDetails.icon;

  return (
    <Card className="overflow-hidden animate-fade-in">
      <CardHeader className="bg-gradient-to-r from-primary/5 to-primary/10 dark:from-primary/10 dark:to-primary/20">
        <CardTitle className="text-xl">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>

      <CardContent className="pt-6 space-y-6">
        {/* Main Error Alert */}
        <Alert 
          variant={errorDetails.severity === 'error' ? 'destructive' : 'default'}
          className={`${errorDetails.bgColor} ${errorDetails.borderColor} border-2`}
        >
          <ErrorIcon className={`h-5 w-5 ${errorDetails.iconColor}`} />
          <AlertTitle className="text-base font-semibold mb-2">
            {errorDetails.title}
          </AlertTitle>
          <AlertDescription className="space-y-2">
            <p className="text-sm leading-relaxed">
              {errorDetails.message}
            </p>
            <p className="text-xs text-muted-foreground italic">
              {errorDetails.suggestion}
            </p>
          </AlertDescription>
        </Alert>

        {/* Retry Action */}
        <div className="flex flex-col items-center gap-4 p-6 rounded-lg bg-muted/30 border-2 border-dashed">
          <div className="text-center space-y-2">
            <h4 className="font-medium">Want to try again?</h4>
            <p className="text-sm text-muted-foreground">
              Click below to regenerate your AI summary
            </p>
          </div>
          
          <Button
            onClick={onRetry}
            disabled={isRetrying}
            size="lg"
            className="min-w-[200px] shadow-lg hover:shadow-xl transition-all"
          >
            <RefreshCw className={`h-5 w-5 mr-2 ${isRetrying ? 'animate-spin' : ''}`} />
            {isRetrying ? 'Retrying...' : 'Retry Generation'}
          </Button>
        </div>

        {/* Technical Details (Collapsible) */}
        {error && (
          <details className="text-xs p-3 rounded-lg bg-muted/50 border">
            <summary className="cursor-pointer font-medium text-muted-foreground hover:text-foreground transition-colors">
              Technical Details
            </summary>
            <pre className="mt-2 p-2 rounded bg-background overflow-auto text-[10px] text-muted-foreground">
              {error.message}
            </pre>
          </details>
        )}

        {/* Help Resources */}
        <div className="flex items-start gap-3 p-4 rounded-lg bg-primary/5 border border-primary/10">
          <HelpCircle className="h-5 w-5 text-primary shrink-0 mt-0.5" />
          <div className="text-sm space-y-1">
            <p className="font-medium">Need Help?</p>
            <p className="text-muted-foreground text-xs">
              If this error continues to occur, please contact support with the technical details above.
              We're here to help ensure your recovery insights are always available.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
