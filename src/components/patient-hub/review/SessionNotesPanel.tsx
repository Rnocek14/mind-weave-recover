/**
 * Session Notes Panel — read existing clinician_session_notes for this session
 * and let the assigned clinician (or owner) add a new observation.
 *
 * RLS enforces who can read/write — we just respect it.
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { FileText } from "lucide-react";

interface SessionNotesPanelProps {
  sessionId: string;
  profileId: string | undefined;
}

interface NoteRow {
  id: string;
  note_text: string;
  note_type: string;
  created_at: string;
  clinician_id: string;
}

export function SessionNotesPanel({ sessionId, profileId }: SessionNotesPanelProps) {
  const { user } = useAuth();
  const [notes, setNotes] = useState<NoteRow[]>([]);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("clinician_session_notes")
      .select("id, note_text, note_type, created_at, clinician_id")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: false });
    setNotes((data ?? []) as NoteRow[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, [sessionId]);

  const save = async () => {
    if (!user?.id || !draft.trim() || !profileId) return;
    setSaving(true);
    const { error } = await supabase.from("clinician_session_notes").insert({
      session_id: sessionId,
      profile_id: profileId,
      user_id: user.id,
      clinician_id: user.id,
      note_type: "observation",
      note_text: draft.trim(),
    });
    setSaving(false);
    if (error) {
      toast.error("Could not save note");
      return;
    }
    setDraft("");
    toast.success("Note saved");
    load();
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1.5">
        <FileText className="w-3.5 h-3.5 text-muted-foreground" />
        <h4 className="text-sm font-medium text-foreground">Clinician notes</h4>
      </div>

      {loading ? (
        <div className="text-xs text-muted-foreground">Loading…</div>
      ) : notes.length > 0 ? (
        <ul className="space-y-2">
          {notes.map((n) => (
            <li key={n.id} className="rounded-md border border-border bg-card px-3 py-2">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
                {new Date(n.created_at).toLocaleString()} · {n.note_type}
              </div>
              <div className="text-sm text-foreground whitespace-pre-wrap">{n.note_text}</div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="text-xs text-muted-foreground">No notes for this session yet.</div>
      )}

      <div className="space-y-2">
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Observation, plan adjustment, or contextual note…"
          rows={3}
          className="text-sm"
        />
        <div className="flex justify-end">
          <Button size="sm" onClick={save} disabled={saving || !draft.trim()}>
            {saving ? "Saving…" : "Add note"}
          </Button>
        </div>
      </div>
    </div>
  );
}
