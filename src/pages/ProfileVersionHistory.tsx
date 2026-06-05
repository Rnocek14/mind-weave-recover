import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  ArrowLeft, History, RotateCcw, FileText, User, Bot, 
  GitMerge, AlertCircle, CheckCircle2, Clock, Calendar
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useClinicalProfileVersions } from '@/hooks/useClinicalProfileVersions';
import { useToast } from '@/hooks/use-toast';
import { Link, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ProfileVersionDiff } from '@/components/ProfileVersionDiff';

const SOURCE_TYPE_LABELS = {
  initial_onboarding: 'Initial Setup',
  note_parsing: 'AI Parsed',
  manual_edit: 'Manual Edit',
  merge: 'Merged',
  clinician_override: 'Clinician Override',
};

const SOURCE_TYPE_ICONS = {
  initial_onboarding: User,
  note_parsing: Bot,
  manual_edit: User,
  merge: GitMerge,
  clinician_override: User,
};

const SOURCE_TYPE_COLORS = {
  initial_onboarding: 'bg-primary/10 text-primary border-primary/20',
  note_parsing: 'bg-success/10 text-success border-success/20',
  manual_edit: 'bg-secondary/10 text-secondary border-secondary/20',
  merge: 'bg-warning/10 text-warning border-warning/20',
  clinician_override: 'bg-destructive/10 text-destructive border-destructive/20',
};

export default function ProfileVersionHistory() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { fetchVersionHistory, createVersion, isLoading } = useClinicalProfileVersions(user?.id);
  
  const [versions, setVersions] = useState<any[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<any | null>(null);
  const [compareVersion, setCompareVersion] = useState<any | null>(null);
  const [showDiffDialog, setShowDiffDialog] = useState(false);
  const [showRestoreDialog, setShowRestoreDialog] = useState(false);
  const [versionToRestore, setVersionToRestore] = useState<any | null>(null);

  useEffect(() => {
    loadVersions();
  }, [user?.id]);

  const loadVersions = async () => {
    const data = await fetchVersionHistory();
    setVersions(data);
    if (data.length > 0) {
      setSelectedVersion(data[0]); // Select most recent version
    }
  };

  const handleRestore = async () => {
    if (!versionToRestore) return;

    try {
      await createVersion(
        versionToRestore.profile_data,
        'manual_edit',
        {
          changeReason: `Restored from version ${versionToRestore.version_number} (${format(new Date(versionToRestore.created_at), 'MMM d, yyyy')})`,
        }
      );

      toast({
        title: 'Version restored',
        description: 'Profile has been restored to the selected version',
      });

      setShowRestoreDialog(false);
      setVersionToRestore(null);
      await loadVersions();
    } catch (error: any) {
      console.error('Error restoring version:', error);
      toast({
        title: 'Restore failed',
        description: error.message || 'Failed to restore version',
        variant: 'destructive',
      });
    }
  };

  const handleCompare = (version: any) => {
    // Find the previous version to compare with
    const currentIndex = versions.findIndex(v => v.id === version.id);
    if (currentIndex < versions.length - 1) {
      setSelectedVersion(version);
      setCompareVersion(versions[currentIndex + 1]);
      setShowDiffDialog(true);
    } else {
      toast({
        title: 'No previous version',
        description: 'This is the first version, nothing to compare with',
        variant: 'destructive',
      });
    }
  };

  const getImpairmentCount = (profile: any) => {
    if (!profile?.impairments) return 0;
    return Object.values(profile.impairments)
      .flat()
      .filter(Boolean).length;
  };

  return (
    <div className="container max-w-6xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/clinical-documents">
            <Button variant="ghost" size="icon" aria-label="Go back">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <History className="h-8 w-8" />
              Profile Version History
            </h1>
            <p className="text-muted-foreground">
              Track changes to your clinical profile over time
            </p>
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Versions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{versions.length}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">AI Parsed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-success">
              {versions.filter(v => v.source_type === 'note_parsing').length}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Manual Edits</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-secondary">
              {versions.filter(v => v.source_type === 'manual_edit').length}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Current Active</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">
              v{versions.find(v => v.is_active)?.version_number || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Version Timeline */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Left: Version List */}
        <Card>
          <CardHeader>
            <CardTitle>Version Timeline</CardTitle>
            <CardDescription>All profile versions in chronological order</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-center space-y-3">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
                  <p className="text-muted-foreground">Loading versions...</p>
                </div>
              </div>
            ) : versions.length === 0 ? (
              <div className="text-center py-12 space-y-4">
                <History className="h-16 w-16 mx-auto text-muted-foreground opacity-50" />
                <div>
                  <h3 className="text-lg font-semibold mb-2">No version history</h3>
                  <p className="text-muted-foreground">
                    Version history will appear here as your profile evolves
                  </p>
                </div>
              </div>
            ) : (
              <ScrollArea className="h-[600px] pr-4">
                <div className="space-y-3">
                  {versions.map((version, index) => {
                    const SourceIcon = SOURCE_TYPE_ICONS[version.source_type as keyof typeof SOURCE_TYPE_ICONS];
                    const isActive = version.is_active;
                    const isSelected = selectedVersion?.id === version.id;
                    
                    return (
                      <div key={version.id}>
                        <button
                          onClick={() => setSelectedVersion(version)}
                          className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                            isSelected 
                              ? 'border-primary bg-primary/5' 
                              : 'border-border hover:border-primary/50 hover:bg-muted/50'
                          }`}
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <Badge variant={isActive ? 'default' : 'secondary'}>
                                v{version.version_number}
                              </Badge>
                              {isActive && (
                                <Badge variant="outline" className="gap-1">
                                  <CheckCircle2 className="h-3 w-3" />
                                  Active
                                </Badge>
                              )}
                            </div>
                            <SourceIcon className="h-4 w-4 text-muted-foreground" />
                          </div>
                          
                          <div className="space-y-2">
                            <Badge 
                              variant="outline" 
                              className={SOURCE_TYPE_COLORS[version.source_type as keyof typeof SOURCE_TYPE_COLORS]}
                            >
                              {SOURCE_TYPE_LABELS[version.source_type as keyof typeof SOURCE_TYPE_LABELS]}
                            </Badge>
                            
                            {version.change_reason && (
                              <p className="text-sm text-muted-foreground line-clamp-2">
                                {version.change_reason}
                              </p>
                            )}
                            
                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {format(new Date(version.created_at), 'MMM d, yyyy')}
                              </span>
                              <span>•</span>
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {format(new Date(version.created_at), 'h:mm a')}
                              </span>
                            </div>
                            
                            <div className="text-xs text-muted-foreground">
                              {getImpairmentCount(version.profile_data)} impairments documented
                            </div>
                          </div>
                        </button>
                        
                        {index < versions.length - 1 && (
                          <div className="h-4 w-0.5 bg-border mx-auto" />
                        )}
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        {/* Right: Version Details */}
        <Card>
          <CardHeader>
            <CardTitle>Version Details</CardTitle>
            <CardDescription>
              {selectedVersion 
                ? `Version ${selectedVersion.version_number} details` 
                : 'Select a version to view details'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!selectedVersion ? (
              <div className="text-center py-12 text-muted-foreground">
                <FileText className="h-16 w-16 mx-auto mb-4 opacity-50" />
                <p>Select a version from the timeline to view details</p>
              </div>
            ) : (
              <ScrollArea className="h-[600px] pr-4">
                <div className="space-y-4">
                  {/* Metadata */}
                  <div className="space-y-3 p-4 bg-muted/50 rounded-lg">
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <span className="text-muted-foreground">Version:</span>
                        <span className="ml-2 font-medium">v{selectedVersion.version_number}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Status:</span>
                        <Badge variant={selectedVersion.is_active ? 'default' : 'secondary'} className="ml-2">
                          {selectedVersion.is_active ? 'Active' : 'Historical'}
                        </Badge>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Source:</span>
                        <Badge 
                          variant="outline" 
                          className={`ml-2 ${SOURCE_TYPE_COLORS[selectedVersion.source_type as keyof typeof SOURCE_TYPE_COLORS]}`}
                        >
                          {SOURCE_TYPE_LABELS[selectedVersion.source_type as keyof typeof SOURCE_TYPE_LABELS]}
                        </Badge>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Date:</span>
                        <span className="ml-2 font-medium">
                          {format(new Date(selectedVersion.created_at), 'MMM d, yyyy')}
                        </span>
                      </div>
                    </div>
                    
                    {selectedVersion.change_reason && (
                      <div>
                        <span className="text-sm text-muted-foreground">Reason:</span>
                        <p className="text-sm mt-1">{selectedVersion.change_reason}</p>
                      </div>
                    )}
                  </div>

                  {/* Profile Data */}
                  <div className="space-y-4">
                    {/* Motor */}
                    {selectedVersion.profile_data?.impairments?.motor?.length > 0 && (
                      <div>
                        <h4 className="font-semibold mb-2 text-sm">Motor Impairments</h4>
                        <div className="flex flex-wrap gap-2">
                          {selectedVersion.profile_data.impairments.motor.map((item: string, idx: number) => (
                            <Badge key={idx} variant="outline">
                              {item.replace(/_/g, ' ')}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Speech */}
                    {selectedVersion.profile_data?.impairments?.speech?.length > 0 && (
                      <div>
                        <h4 className="font-semibold mb-2 text-sm">Speech Impairments</h4>
                        <div className="flex flex-wrap gap-2">
                          {selectedVersion.profile_data.impairments.speech.map((item: string, idx: number) => (
                            <Badge key={idx} variant="outline">
                              {item.replace(/_/g, ' ')}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Cognitive */}
                    {selectedVersion.profile_data?.impairments?.cognitive?.length > 0 && (
                      <div>
                        <h4 className="font-semibold mb-2 text-sm">Cognitive Status</h4>
                        <div className="flex flex-wrap gap-2">
                          {selectedVersion.profile_data.impairments.cognitive.map((item: string, idx: number) => (
                            <Badge key={idx} variant="outline">
                              {item.replace(/_/g, ' ')}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Visual */}
                    {selectedVersion.profile_data?.impairments?.visual?.length > 0 && (
                      <div>
                        <h4 className="font-semibold mb-2 text-sm">Visual Impairments</h4>
                        <div className="flex flex-wrap gap-2">
                          {selectedVersion.profile_data.impairments.visual.map((item: string, idx: number) => (
                            <Badge key={idx} variant="outline">
                              {item.replace(/_/g, ' ')}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Location & Side */}
                    {selectedVersion.profile_data?.stroke_location && (
                      <div>
                        <h4 className="font-semibold mb-2 text-sm">Stroke Location</h4>
                        <Badge>
                          {Array.isArray(selectedVersion.profile_data.stroke_location)
                            ? selectedVersion.profile_data.stroke_location.join(', ').replace(/_/g, ' ')
                            : selectedVersion.profile_data.stroke_location.replace(/_/g, ' ')}
                        </Badge>
                      </div>
                    )}

                    {selectedVersion.profile_data?.affected_side && (
                      <div>
                        <h4 className="font-semibold mb-2 text-sm">Affected Side</h4>
                        <Badge>{selectedVersion.profile_data.affected_side}</Badge>
                      </div>
                    )}
                  </div>

                  <Separator />

                  {/* Actions */}
                  <div className="flex gap-2">
                    <Button
                      onClick={() => handleCompare(selectedVersion)}
                      variant="outline"
                      className="flex-1 gap-2"
                      disabled={versions.findIndex(v => v.id === selectedVersion.id) === versions.length - 1}
                    >
                      <FileText className="h-4 w-4" />
                      Compare with Previous
                    </Button>
                    
                    {!selectedVersion.is_active && (
                      <Button
                        onClick={() => {
                          setVersionToRestore(selectedVersion);
                          setShowRestoreDialog(true);
                        }}
                        variant="default"
                        className="flex-1 gap-2"
                      >
                        <RotateCcw className="h-4 w-4" />
                        Restore This Version
                      </Button>
                    )}
                  </div>
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Diff Dialog */}
      <Dialog open={showDiffDialog} onOpenChange={setShowDiffDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Version Comparison</DialogTitle>
            <DialogDescription>
              Comparing v{selectedVersion?.version_number} with v{compareVersion?.version_number}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="flex justify-between text-sm">
              <div>
                <Badge variant="secondary">v{compareVersion?.version_number}</Badge>
                <span className="ml-2 text-muted-foreground">
                  {compareVersion && format(new Date(compareVersion.created_at), 'MMM d, yyyy')}
                </span>
              </div>
              <div>
                <Badge variant="default">v{selectedVersion?.version_number}</Badge>
                <span className="ml-2 text-muted-foreground">
                  {selectedVersion && format(new Date(selectedVersion.created_at), 'MMM d, yyyy')}
                </span>
              </div>
            </div>

            <Separator />

            <ProfileVersionDiff 
              oldVersion={compareVersion} 
              newVersion={selectedVersion} 
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Restore Confirmation Dialog */}
      <Dialog open={showRestoreDialog} onOpenChange={setShowRestoreDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Restore Version?</DialogTitle>
            <DialogDescription>
              Are you sure you want to restore your profile to version {versionToRestore?.version_number}?
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="p-4 bg-warning/10 border border-warning/20 rounded-lg">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-warning mt-0.5" />
                <div className="space-y-1">
                  <p className="font-medium text-sm">This will create a new version</p>
                  <p className="text-sm text-muted-foreground">
                    Restoring creates a new version with the data from v{versionToRestore?.version_number}. 
                    Your current profile will be preserved in history.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowRestoreDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleRestore} className="gap-2">
                <RotateCcw className="h-4 w-4" />
                Restore Version
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
