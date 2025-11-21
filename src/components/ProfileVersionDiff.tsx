import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Plus, Minus, ArrowRight } from 'lucide-react';

interface ProfileVersionDiffProps {
  oldVersion: any;
  newVersion: any;
}

export function ProfileVersionDiff({ oldVersion, newVersion }: ProfileVersionDiffProps) {
  const oldProfile = oldVersion?.profile_data || {};
  const newProfile = newVersion?.profile_data || {};

  // Helper to get differences in arrays
  const getArrayDiff = (oldArr: string[] = [], newArr: string[] = []) => {
    const added = newArr.filter(item => !oldArr.includes(item));
    const removed = oldArr.filter(item => !newArr.includes(item));
    const unchanged = oldArr.filter(item => newArr.includes(item));
    return { added, removed, unchanged };
  };

  // Compare impairments
  const impairmentDiffs = {
    motor: getArrayDiff(oldProfile.impairments?.motor, newProfile.impairments?.motor),
    speech: getArrayDiff(oldProfile.impairments?.speech, newProfile.impairments?.speech),
    cognitive: getArrayDiff(oldProfile.impairments?.cognitive, newProfile.impairments?.cognitive),
    visual: getArrayDiff(oldProfile.impairments?.visual, newProfile.impairments?.visual),
  };

  // Check if fields changed
  const strokeLocationChanged = JSON.stringify(oldProfile.stroke_location) !== JSON.stringify(newProfile.stroke_location);
  const affectedSideChanged = oldProfile.affected_side !== newProfile.affected_side;

  const hasChanges = Object.values(impairmentDiffs).some(diff => 
    diff.added.length > 0 || diff.removed.length > 0
  ) || strokeLocationChanged || affectedSideChanged;

  if (!hasChanges) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          No changes detected between these versions
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Motor Impairments */}
      {(impairmentDiffs.motor.added.length > 0 || impairmentDiffs.motor.removed.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Motor Impairments</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {impairmentDiffs.motor.removed.map(item => (
              <div key={item} className="flex items-center gap-2 text-sm">
                <Minus className="h-4 w-4 text-destructive" />
                <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20">
                  {item.replace(/_/g, ' ')}
                </Badge>
                <span className="text-xs text-muted-foreground">removed</span>
              </div>
            ))}
            {impairmentDiffs.motor.added.map(item => (
              <div key={item} className="flex items-center gap-2 text-sm">
                <Plus className="h-4 w-4 text-success" />
                <Badge variant="outline" className="bg-success/10 text-success border-success/20">
                  {item.replace(/_/g, ' ')}
                </Badge>
                <span className="text-xs text-muted-foreground">added</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Speech Impairments */}
      {(impairmentDiffs.speech.added.length > 0 || impairmentDiffs.speech.removed.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Speech Impairments</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {impairmentDiffs.speech.removed.map(item => (
              <div key={item} className="flex items-center gap-2 text-sm">
                <Minus className="h-4 w-4 text-destructive" />
                <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20">
                  {item.replace(/_/g, ' ')}
                </Badge>
                <span className="text-xs text-muted-foreground">removed</span>
              </div>
            ))}
            {impairmentDiffs.speech.added.map(item => (
              <div key={item} className="flex items-center gap-2 text-sm">
                <Plus className="h-4 w-4 text-success" />
                <Badge variant="outline" className="bg-success/10 text-success border-success/20">
                  {item.replace(/_/g, ' ')}
                </Badge>
                <span className="text-xs text-muted-foreground">added</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Cognitive Impairments */}
      {(impairmentDiffs.cognitive.added.length > 0 || impairmentDiffs.cognitive.removed.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Cognitive Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {impairmentDiffs.cognitive.removed.map(item => (
              <div key={item} className="flex items-center gap-2 text-sm">
                <Minus className="h-4 w-4 text-destructive" />
                <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20">
                  {item.replace(/_/g, ' ')}
                </Badge>
                <span className="text-xs text-muted-foreground">removed</span>
              </div>
            ))}
            {impairmentDiffs.cognitive.added.map(item => (
              <div key={item} className="flex items-center gap-2 text-sm">
                <Plus className="h-4 w-4 text-success" />
                <Badge variant="outline" className="bg-success/10 text-success border-success/20">
                  {item.replace(/_/g, ' ')}
                </Badge>
                <span className="text-xs text-muted-foreground">added</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Visual Impairments */}
      {(impairmentDiffs.visual.added.length > 0 || impairmentDiffs.visual.removed.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Visual Impairments</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {impairmentDiffs.visual.removed.map(item => (
              <div key={item} className="flex items-center gap-2 text-sm">
                <Minus className="h-4 w-4 text-destructive" />
                <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20">
                  {item.replace(/_/g, ' ')}
                </Badge>
                <span className="text-xs text-muted-foreground">removed</span>
              </div>
            ))}
            {impairmentDiffs.visual.added.map(item => (
              <div key={item} className="flex items-center gap-2 text-sm">
                <Plus className="h-4 w-4 text-success" />
                <Badge variant="outline" className="bg-success/10 text-success border-success/20">
                  {item.replace(/_/g, ' ')}
                </Badge>
                <span className="text-xs text-muted-foreground">added</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Stroke Location Changes */}
      {strokeLocationChanged && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Stroke Location</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="bg-muted">
                {oldProfile.stroke_location ? 
                  (Array.isArray(oldProfile.stroke_location) 
                    ? oldProfile.stroke_location.join(', ').replace(/_/g, ' ')
                    : oldProfile.stroke_location.replace(/_/g, ' ')
                  )
                  : 'Not set'
                }
              </Badge>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
              <Badge variant="default">
                {newProfile.stroke_location ? 
                  (Array.isArray(newProfile.stroke_location) 
                    ? newProfile.stroke_location.join(', ').replace(/_/g, ' ')
                    : newProfile.stroke_location.replace(/_/g, ' ')
                  )
                  : 'Not set'
                }
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Affected Side Changes */}
      {affectedSideChanged && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Affected Side</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="bg-muted">
                {oldProfile.affected_side || 'Not set'}
              </Badge>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
              <Badge variant="default">
                {newProfile.affected_side || 'Not set'}
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
