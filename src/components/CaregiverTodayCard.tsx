import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { 
  Play, 
  Heart, 
  AlertTriangle, 
  TrendingUp, 
  MessageSquare,
  Sun,
  Save,
  Loader2
} from 'lucide-react';
import { useProfile } from '@/hooks/useProfile';
import { useDailyReadiness } from '@/hooks/useDailyReadiness';
import { useWeeklyRecoverySnapshot } from '@/hooks/useWeeklyRecoverySnapshot';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export function CaregiverTodayCard() {
  const { activeProfile } = useProfile();
  const { user } = useAuth();
  const profileId = activeProfile?.id;
  const navigate = useNavigate();
  const { todayCheckin, hasCheckedInToday } = useDailyReadiness(profileId);
  const { timeline } = useWeeklyRecoverySnapshot(profileId, 7);

  const patientName = activeProfile?.profile_name || 'Patient';

  const [noteText, setNoteText] = useState('');
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [noteSaved, setNoteSaved] = useState(false);

  // Compute streak
  const recent7 = timeline.slice(-7);
  const activeDays = recent7.filter(d => d.hasAnySignal).length;

  // Missed yesterday? Use UTC-consistent date comparison
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);
  const missedYesterday = timeline.length > 0 && !timeline.find(d => d.date === yesterdayStr)?.hasAnySignal;

  // Fatigue safety
  const fatigueHigh = todayCheckin && todayCheckin.fatigue_rating >= 4;
  const fatigueSafe = todayCheckin && todayCheckin.fatigue_rating <= 2;

  // Recommended action
  const actionText = fatigueHigh
    ? 'Consider a lighter or shorter session today'
    : 'Encourage a practice session today';

  const ActionIcon = fatigueHigh ? AlertTriangle : Play;

  const handleSaveNote = async () => {
    if (!noteText.trim() || !user?.id || !profileId) return;
    
    setIsSavingNote(true);
    try {
      // Save to dedicated caregiver_context_notes table (never creates fake sessions)
      // Store clean text — timestamp is in created_at column
      await supabase
        .from('caregiver_context_notes')
        .insert({
          user_id: user.id,
          profile_id: profileId,
          note: noteText.trim(),
        });
      
      setNoteSaved(true);
      setNoteText('');
      toast.success('Note saved — clinician can see it in patient context');
    } catch {
      toast.error('Could not save note');
    } finally {
      setIsSavingNote(false);
    }
  };

  return (
    <Card className="p-5 border-2 border-primary/20 bg-gradient-to-br from-primary/5 via-transparent to-accent/5">
      <div className="flex items-center gap-2 mb-4">
        <Sun className="w-5 h-5 text-amber-500" />
        <h2 className="font-bold text-lg">Today's Plan</h2>
      </div>

      <div className="space-y-3">
        {/* 1. Recommended action */}
        <div className="flex items-start gap-3 p-3 rounded-lg bg-card border">
          <ActionIcon className={`w-5 h-5 mt-0.5 shrink-0 ${fatigueHigh ? 'text-amber-500' : 'text-primary'}`} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">{actionText}</p>
            {!fatigueHigh && (
              <Button 
                size="sm" 
                className="mt-2 gap-1.5" 
                onClick={() => navigate('/lesson')}
              >
                <Play className="w-3.5 h-3.5" />
                Start Session
              </Button>
            )}
          </div>
        </div>

        {/* 2. Safety check — fatigue */}
        <div className="flex items-start gap-3 p-3 rounded-lg bg-card border">
          <Heart className={`w-5 h-5 mt-0.5 shrink-0 ${fatigueHigh ? 'text-red-500' : fatigueSafe ? 'text-green-500' : 'text-muted-foreground'}`} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">
              {!hasCheckedInToday 
                ? 'No check-in yet today'
                : fatigueHigh
                  ? `${patientName} reported high fatigue (${todayCheckin!.fatigue_rating}/5)`
                  : `Fatigue: ${todayCheckin!.fatigue_rating}/5 — looking good`
              }
            </p>
            {fatigueHigh && (
              <p className="text-xs text-muted-foreground mt-1">
                Consider rest or a shorter, easier session. Contact clinician if fatigue persists over multiple days.
              </p>
            )}
          </div>
        </div>

        {/* 3. Adherence nudge */}
        <div className="flex items-start gap-3 p-3 rounded-lg bg-card border">
          <TrendingUp className="w-5 h-5 mt-0.5 shrink-0 text-muted-foreground" />
          <div className="flex-1 min-w-0">
            {missedYesterday ? (
              <p className="text-sm font-medium text-amber-600 dark:text-amber-400">
                Missed yesterday — a short session today helps maintain progress
              </p>
            ) : (
              <p className="text-sm font-medium">
                {activeDays}/7 active days this week
                {activeDays >= 5 && (
                  <Badge variant="outline" className="ml-2 text-xs text-green-600 border-green-600/30">Great streak!</Badge>
                )}
              </p>
            )}
          </div>
        </div>

        {/* 4. Quick context note — persists to caregiver_context_notes table */}
        <div className="p-3 rounded-lg bg-muted/50 border border-dashed space-y-2">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">
              Had visitors? Bad sleep? Note anything that might affect today's practice.
            </p>
          </div>
          {noteSaved ? (
            <p className="text-xs text-green-600 dark:text-green-400 font-medium">
              ✓ Note saved — clinician will see it in patient context
            </p>
          ) : (
            <>
              <Textarea
                placeholder="e.g. Didn't sleep well, had visitors this morning..."
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                className="min-h-[60px] text-sm resize-none"
                rows={2}
              />
              <Button 
                size="sm" 
                variant="secondary"
                onClick={handleSaveNote}
                disabled={!noteText.trim() || isSavingNote}
                className="gap-1.5"
              >
                {isSavingNote ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Save className="w-3.5 h-3.5" />
                )}
                Save Note
              </Button>
            </>
          )}
        </div>
      </div>
    </Card>
  );
}