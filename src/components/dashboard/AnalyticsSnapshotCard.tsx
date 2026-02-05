/**
 * Analytics Snapshot Card
 * 
 * Compact card for the Analytics tab that answers one user question
 * with a quick glance and "See more" deep link.
 */

import { ReactNode } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface AnalyticsSnapshotCardProps {
  icon: ReactNode;
  title: string;
  status: 'positive' | 'neutral' | 'warning' | 'muted';
  headline: string;
  detail?: string;
  linkTo?: string;
  linkLabel?: string;
  children?: ReactNode;
  className?: string;
}

const statusColors: Record<AnalyticsSnapshotCardProps['status'], string> = {
  positive: 'text-success',
  neutral: 'text-primary',
  warning: 'text-warning',
  muted: 'text-muted-foreground',
};

const statusBg: Record<AnalyticsSnapshotCardProps['status'], string> = {
  positive: 'bg-success/10',
  neutral: 'bg-primary/10',
  warning: 'bg-warning/10',
  muted: 'bg-muted',
};

export const AnalyticsSnapshotCard = ({
  icon,
  title,
  status,
  headline,
  detail,
  linkTo,
  linkLabel = 'See details',
  children,
  className,
}: AnalyticsSnapshotCardProps) => {
  return (
    <Card className={cn('relative overflow-hidden', className)}>
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-center gap-2 mb-3">
          <div className={cn('p-2 rounded-lg', statusBg[status])}>
            <span className={statusColors[status]}>{icon}</span>
          </div>
          <span className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            {title}
          </span>
        </div>

        {/* Headline */}
        <h3 className={cn('text-lg font-semibold mb-1', statusColors[status])}>
          {headline}
        </h3>

        {/* Detail */}
        {detail && (
          <p className="text-sm text-muted-foreground mb-3">{detail}</p>
        )}

        {/* Optional children for custom content */}
        {children}

        {/* Deep link */}
        {linkTo && (
          <div className="mt-3 pt-3 border-t border-border">
            <Button
              variant="ghost"
              size="sm"
              className="p-0 h-auto text-primary hover:text-primary/80"
              asChild
            >
              <Link to={linkTo} className="flex items-center gap-1">
                {linkLabel}
                <ChevronRight className="w-4 h-4" />
              </Link>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
