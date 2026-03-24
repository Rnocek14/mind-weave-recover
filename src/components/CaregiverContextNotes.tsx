import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { MessageSquare } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';

interface CaregiverNote {
  id: string;
  note: string;
  created_at: string;
}

export function CaregiverContextNotes({ profileId }: { profileId: string | undefined }) {
  const [notes, setNotes] = useState<CaregiverNote[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (!profileId) { setIsLoading(false); return; }

    const load = async () => {
      const { data } = await supabase
        .from('caregiver_context_notes')
        .select('id, note, created_at')
        .eq('profile_id', profileId)
        .order('created_at', { ascending: false })
        .limit(3);
      
      setNotes(data || []);
      setIsLoading(false);
    };
    load();
  }, [profileId]);

  if (isLoading) return null;

  return (
    <div>
      <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
        <MessageSquare className="w-4 h-4" />
        Caregiver Context
      </h4>
      {notes.length === 0 ? (
        <p className="text-sm text-muted-foreground/70 italic">No caregiver context notes in the last 14 days.</p>
      ) : (
        <>
          <div className="space-y-2">
            {notes.map(n => {
              const d = new Date(n.created_at);
              const timeLabel = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) +
                ' ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
              return (
                <Card key={n.id} className="p-3 bg-muted/30">
                  <p className="text-sm">{n.note}</p>
                  <p className="text-xs text-muted-foreground mt-1">{timeLabel}</p>
                </Card>
              );
            })}
          </div>
          <button
            onClick={() => navigate('/clinician/review')}
            className="text-xs text-primary hover:underline mt-2 inline-block"
          >
            View all →
          </button>
        </>
      )}
    </div>
  );
}
