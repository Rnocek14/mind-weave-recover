import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { FileText, Upload, CheckCircle2, AlertCircle, Clock, Sparkles, Calendar, Trash2, History } from 'lucide-react';
import { BackButton } from '@/components/layout/BackButton';
import { useClinicalNotes, CreateNoteParams } from '@/hooks/useClinicalNotes';
import { useClinicalProfileVersions } from '@/hooks/useClinicalProfileVersions';
import { useMergeConflicts } from '@/hooks/useMergeConflicts';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { setProfileProvenance } from '@/lib/profileProvenance';
import { useDocumentConsent, DOCUMENT_CONSENT_TEXT } from '@/hooks/useDocumentConsent';
import { Checkbox } from '@/components/ui/checkbox';
import { format } from 'date-fns';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { 
  detectProfileConflicts, 
  autoMergeProfiles, 
  generateConflictSummary 
} from '@/lib/profileConflictDetector';
import { useRecoverySummary } from '@/hooks/useRecoverySummary';

const NOTE_TYPE_LABELS = {
  mri_report: 'MRI Report',
  ct_scan: 'CT Scan',
  discharge_summary: 'Discharge Summary',
  progress_note: 'Progress Note',
  neuropsych_eval: 'Neuropsych Evaluation',
  initial_assessment: 'Initial Assessment',
  other: 'Other Document',
};

const NOTE_TYPE_ICONS = {
  mri_report: '🧠',
  ct_scan: '🔬',
  discharge_summary: '📋',
  progress_note: '📝',
  neuropsych_eval: '🧩',
  initial_assessment: '🏥',
  other: '📄',
};

export default function ClinicalDocuments() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { fetchNotes, createNote, updateNoteWithParseResults, deleteNote, isLoading } = useClinicalNotes(user?.id);
  const { createVersion, getActiveProfile } = useClinicalProfileVersions(user?.id);
  const { createConflictRecord } = useMergeConflicts(user?.id);
  const { generateSummary } = useRecoverySummary(user?.id);
  const { hasConsent, isRecording, recordConsent } = useDocumentConsent();

  
  const [notes, setNotes] = useState<any[]>([]);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  
  // Upload form state
  const [noteType, setNoteType] = useState<CreateNoteParams['note_type']>('ct_scan');
  const [documentDate, setDocumentDate] = useState(new Date().toISOString().split('T')[0]);
  const [documentTitle, setDocumentTitle] = useState('');
  const [rawText, setRawText] = useState('');
  const [consentChecked, setConsentChecked] = useState(false);


  useEffect(() => {
    loadNotes();
  }, [user?.id]);

  const loadNotes = async () => {
    const data = await fetchNotes();
    setNotes(data);
  };

  const regenerateSummaries = async (reason: string) => {
    if (!user?.id) return;

    console.log(`Regenerating recovery summaries: ${reason}`);
    
    try {
      // Regenerate both progress and education summaries in parallel
      await Promise.all([
        generateSummary('progress'),
        generateSummary('education')
      ]);

      toast({
        title: 'AI Summaries Updated',
        description: 'Your recovery summaries have been regenerated with the latest clinical data',
        duration: 5000,
      });
    } catch (error) {
      console.error('Error regenerating summaries:', error);
      // Don't show error toast - summaries are a nice-to-have
    }
  };

  const handleUploadAndParse = async () => {
    if (!rawText.trim()) {
      toast({
        title: 'Missing content',
        description: 'Please paste or enter the clinical document text',
        variant: 'destructive',
      });
      return;
    }

    setIsParsing(true);
    
    try {
      // Step 1: Create the clinical note
      const note = await createNote({
        note_type: noteType,
        document_date: documentDate,
        raw_text: rawText,
        document_title: documentTitle || NOTE_TYPE_LABELS[noteType],
        source_system: 'manual_upload',
      });

      // Step 2: Parse the note
      const { data, error } = await supabase.functions.invoke('parse-clinical-notes', {
        body: { clinicalNote: rawText },
      });

      if (error) throw error;

      if (data.profile) {
        // Step 3: Update note with parsed results
        const confidence = data.profile.extraction_metadata?.confidence_score > 0.8 ? 'high' :
                          data.profile.extraction_metadata?.confidence_score > 0.5 ? 'medium' : 'low';
        
        await updateNoteWithParseResults(
          note.id,
          data.profile,
          'v1.0',
          confidence
        );

        // Step 4: Get active profile for conflict detection
        const activeProfile = await getActiveProfile();

        if (activeProfile && activeProfile.profile_data) {
          // Step 5: Detect conflicts
          const conflictResult = detectProfileConflicts(
            activeProfile.profile_data,
            data.profile
          );

          if (conflictResult.hasConflicts) {
            // Create conflict record
            await createConflictRecord(
              activeProfile.id,
              note.id,
              data.profile,
              conflictResult
            );

            // Show conflict notification
            const conflictSummary = generateConflictSummary(conflictResult);
            
            toast({
              title: '⚠️ Profile Conflicts Detected',
              description: conflictSummary,
              variant: conflictResult.recommendation === 'manual_resolution_required' ? 'destructive' : 'default',
              duration: 8000,
            });

            // If safe to auto-merge, do it
            if (conflictResult.safeToAutoMerge && conflictResult.recommendation === 'auto_merge') {
              const mergedProfile = autoMergeProfiles(
                activeProfile.profile_data,
                data.profile,
                conflictResult
              );

              await createVersion(
                mergedProfile,
                'merge',
                {
                  sourceNoteId: note.id,
                  changeReason: `Auto-merged from ${NOTE_TYPE_LABELS[noteType]} with ${conflictResult.conflicts.length} low-priority conflicts resolved automatically`,
                  confidence: confidence,
                }
              );

              // Provenance: active profile now derives from an uploaded
              // document; carry the parser's per-field confidence (plan A2).
              await setProfileProvenance(user?.id, 'document', data.profile.field_confidence);

              toast({
                title: '✓ Auto-merged successfully',
                description: 'Conflicts were automatically resolved and merged into your profile',
              });

              // Regenerate AI summaries after profile update
              await regenerateSummaries('Profile updated via auto-merge');
            } else {
              // Conflicts require manual review - don't create version yet
              toast({
                title: 'Manual review required',
                description: 'Please review and resolve conflicts before merging. Go to Merge Conflicts page.',
                variant: 'default',
              });
            }
          } else {
            // No conflicts - create version normally
            await createVersion(
              data.profile,
              'note_parsing',
              {
                sourceNoteId: note.id,
                changeReason: `Parsed from ${NOTE_TYPE_LABELS[noteType]} dated ${format(new Date(documentDate), 'MMM d, yyyy')}`,
                confidence: confidence,
              }
            );

            // Provenance: profile derived from an uploaded document (plan A2).
            await setProfileProvenance(user?.id, 'document', data.profile.field_confidence);


            toast({
              title: 'Document uploaded and parsed',
              description: 'Clinical profile has been updated with new information',
            });

            // Regenerate AI summaries after profile update
            await regenerateSummaries('New clinical note parsed');
          }
        } else {
          // No existing profile - create initial version
          await createVersion(
            data.profile,
            'initial_onboarding',
            {
              sourceNoteId: note.id,
              changeReason: `Initial profile from ${NOTE_TYPE_LABELS[noteType]}`,
              confidence: confidence,
            }
          );

          // Provenance: initial profile derived from an uploaded document (plan A2).
          await setProfileProvenance(user?.id, 'document', data.profile.field_confidence);


          toast({
            title: 'Initial profile created',
            description: 'Clinical profile has been created from uploaded document',
          });

          // Regenerate AI summaries after initial profile creation
          await regenerateSummaries('Initial clinical profile created');
        }

        // Reset form and close dialog
        setRawText('');
        setDocumentTitle('');
        setNoteType('ct_scan');
        setDocumentDate(new Date().toISOString().split('T')[0]);
        setIsUploadDialogOpen(false);
        
        // Reload notes
        await loadNotes();
      }
    } catch (error: any) {
      console.error('Error uploading and parsing:', error);
      toast({
        title: 'Upload failed',
        description: error.message || 'Failed to upload and parse document',
        variant: 'destructive',
      });
    } finally {
      setIsParsing(false);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!confirm('Are you sure you want to delete this document? This action cannot be undone.')) {
      return;
    }

    try {
      await deleteNote(noteId);
      await loadNotes();
    } catch (error) {
      console.error('Error deleting note:', error);
    }
  };

  const getConfidenceBadge = (confidence: string | null) => {
    if (!confidence) return null;
    
    const variants = {
      high: 'default',
      medium: 'secondary',
      low: 'outline',
    } as const;

    return (
      <Badge variant={variants[confidence as keyof typeof variants]}>
        {confidence} confidence
      </Badge>
    );
  };

  const getParsingStatusIcon = (note: any) => {
    if (!note.parsed_at) {
      return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
    
    if (note.parsing_confidence === 'high') {
      return <CheckCircle2 className="h-4 w-4 text-success" />;
    }
    
    if (note.parsing_confidence === 'low') {
      return <AlertCircle className="h-4 w-4 text-warning" />;
    }
    
    return <CheckCircle2 className="h-4 w-4 text-primary" />;
  };

  return (
    <div className="container max-w-6xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <BackButton />
          <div>
            <h1 className="text-3xl font-bold">Clinical Documents</h1>
            <p className="text-muted-foreground">
              Manage and track all your clinical notes, scans, and assessments
            </p>
          </div>
        </div>
        
        <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Upload className="h-4 w-4" />
              Upload New Document
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Upload Clinical Document</DialogTitle>
              <DialogDescription>
                Upload a new MRI, CT scan, progress note, or other clinical document. 
                AI will automatically extract relevant clinical information.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="note-type">Document Type</Label>
                  <Select value={noteType} onValueChange={(value) => setNoteType(value as any)}>
                    <SelectTrigger id="note-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mri_report">MRI Report</SelectItem>
                      <SelectItem value="ct_scan">CT Scan</SelectItem>
                      <SelectItem value="discharge_summary">Discharge Summary</SelectItem>
                      <SelectItem value="progress_note">Progress Note</SelectItem>
                      <SelectItem value="neuropsych_eval">Neuropsych Evaluation</SelectItem>
                      <SelectItem value="initial_assessment">Initial Assessment</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="document-date">Document Date</Label>
                  <Input
                    id="document-date"
                    type="date"
                    value={documentDate}
                    onChange={(e) => setDocumentDate(e.target.value)}
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="document-title">Title (optional)</Label>
                <Input
                  id="document-title"
                  placeholder="e.g., 3-month follow-up CT"
                  value={documentTitle}
                  onChange={(e) => setDocumentTitle(e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="raw-text">Document Text</Label>
                <Textarea
                  id="raw-text"
                  placeholder="Paste clinical notes, scan report, or assessment findings here..."
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  rows={12}
                  className="font-mono text-sm"
                />
              </div>
              
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setIsUploadDialogOpen(false)}
                  disabled={isParsing}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleUploadAndParse}
                  disabled={isParsing || !rawText.trim()}
                  className="gap-2"
                >
                  {isParsing ? (
                    <>
                      <Sparkles className="h-4 w-4 animate-pulse" />
                      Parsing with AI...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4" />
                      Upload & Parse
                    </>
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Documents</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{notes.length}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Parsed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-success">
              {notes.filter(n => n.parsed_at).length}
            </div>
          </CardContent>
        </Card>
        
        <Card className="cursor-pointer hover:border-primary transition-colors" onClick={() => navigate('/profile-history')}>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center justify-between">
              Profile Versions
              <History className="h-4 w-4" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">
              View History →
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Documents Timeline */}
      <Card>
        <CardHeader>
          <CardTitle>Document Timeline</CardTitle>
          <CardDescription>
            All your clinical documents in chronological order
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center space-y-3">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
                <p className="text-muted-foreground">Loading documents...</p>
              </div>
            </div>
          ) : notes.length === 0 ? (
            <div className="text-center py-12 space-y-4">
              <FileText className="h-16 w-16 mx-auto text-muted-foreground opacity-50" />
              <div>
                <h3 className="text-lg font-semibold mb-2">No documents yet</h3>
                <p className="text-muted-foreground mb-4">
                  Upload your first clinical document to get started
                </p>
                <Button onClick={() => setIsUploadDialogOpen(true)} className="gap-2">
                  <Upload className="h-4 w-4" />
                  Upload Document
                </Button>
              </div>
            </div>
          ) : (
            <ScrollArea className="h-[600px] pr-4">
              <div className="space-y-4">
                {notes.map((note, index) => (
                  <div key={note.id}>
                    <div className="flex gap-4">
                      {/* Timeline dot and line */}
                      <div className="flex flex-col items-center">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-lg">
                          {NOTE_TYPE_ICONS[note.note_type as keyof typeof NOTE_TYPE_ICONS]}
                        </div>
                        {index < notes.length - 1 && (
                          <div className="w-0.5 h-full bg-border mt-2" />
                        )}
                      </div>
                      
                      {/* Document card */}
                      <Card className="flex-1 mb-4">
                        <CardHeader>
                          <div className="flex items-start justify-between">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <CardTitle className="text-lg">
                                  {note.document_title || NOTE_TYPE_LABELS[note.note_type as keyof typeof NOTE_TYPE_LABELS]}
                                </CardTitle>
                                {getParsingStatusIcon(note)}
                              </div>
                              <CardDescription className="flex items-center gap-3">
                                <span className="flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  {format(new Date(note.document_date), 'MMM d, yyyy')}
                                </span>
                                <span>•</span>
                                <Badge variant="outline" className="text-xs">
                                  {NOTE_TYPE_LABELS[note.note_type as keyof typeof NOTE_TYPE_LABELS]}
                                </Badge>
                              </CardDescription>
                            </div>
                            
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label="Delete note"
                              onClick={() => handleDeleteNote(note.id)}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </CardHeader>
                        
                        <CardContent className="space-y-3">
                          {/* Parsing status */}
                          {note.parsed_at ? (
                            <div className="flex items-center justify-between p-3 bg-success/5 border border-success/20 rounded-lg">
                              <div className="flex items-center gap-2">
                                <CheckCircle2 className="h-4 w-4 text-success" />
                                <span className="text-sm font-medium">Parsed successfully</span>
                              </div>
                              <div className="flex items-center gap-2">
                                {getConfidenceBadge(note.parsing_confidence)}
                                <Badge variant="secondary" className="text-xs">
                                  v{note.parser_version}
                                </Badge>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                              <Clock className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm text-muted-foreground">Not yet parsed</span>
                            </div>
                          )}
                          
                          {/* Document excerpt */}
                          <div className="space-y-2">
                            <Label className="text-xs text-muted-foreground">Document Excerpt</Label>
                            <p className="text-sm text-muted-foreground line-clamp-3 font-mono bg-muted p-3 rounded">
                              {note.raw_text.substring(0, 200)}...
                            </p>
                          </div>
                          
                          {/* Metadata */}
                          <div className="grid grid-cols-2 gap-4 pt-2 text-xs text-muted-foreground">
                            <div>
                              <span className="font-medium">Uploaded:</span>{' '}
                              {format(new Date(note.uploaded_at), 'MMM d, yyyy h:mm a')}
                            </div>
                            {note.parsed_at && (
                              <div>
                                <span className="font-medium">Parsed:</span>{' '}
                                {format(new Date(note.parsed_at), 'MMM d, yyyy h:mm a')}
                              </div>
                            )}
                          </div>
                          
                          {/* Extracted impairments preview */}
                          {note.extracted_profile && note.extracted_profile.impairments && (
                            <div className="space-y-2 pt-3 border-t">
                              <Label className="text-xs text-muted-foreground">Extracted Information</Label>
                              <div className="flex flex-wrap gap-1">
                                {Object.entries(note.extracted_profile.impairments).map(([category, items]: [string, any]) => 
                                  (items as string[]).map((item, idx) => (
                                    <Badge key={`${category}-${idx}`} variant="secondary" className="text-xs">
                                      {item.replace(/_/g, ' ')}
                                    </Badge>
                                  ))
                                )}
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </div>
                    
                    {index < notes.length - 1 && <div className="ml-5" />}
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
