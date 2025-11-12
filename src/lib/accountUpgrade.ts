import { supabase } from "@/integrations/supabase/client";

export interface LocalSession {
  started_at: string;
  ended_at?: string;
  duration_sec?: number;
  plan?: any;
  summary?: any;
}

export interface LocalExerciseEvent {
  session_id: string;
  exercise_slug: string;
  round: number;
  score?: number;
  inputs?: any;
  outputs?: any;
  created_at: string;
}

export async function migrateLocalToSupabase(userId: string): Promise<boolean> {
  try {
    const localSessions = JSON.parse(localStorage.getItem("local_sessions") || "[]") as LocalSession[];
    const localEvents = JSON.parse(localStorage.getItem("local_events") || "[]") as LocalExerciseEvent[];

    if (!localSessions.length && !localEvents.length) {
      return false; // Nothing to migrate
    }

    // Insert sessions first
    if (localSessions.length > 0) {
      const sessionsToInsert = localSessions.map((s) => ({
        ...s,
        user_id: userId,
      }));

      const { error: sessionsError } = await supabase
        .from("sessions")
        .insert(sessionsToInsert);

      if (sessionsError) {
        console.error("Error migrating sessions:", sessionsError);
        throw sessionsError;
      }
    }

    // Insert events
    if (localEvents.length > 0) {
      const { error: eventsError } = await supabase
        .from("exercise_events")
        .insert(localEvents);

      if (eventsError) {
        console.error("Error migrating events:", eventsError);
        throw eventsError;
      }
    }

    // Mark migration as complete
    await supabase
      .from("profiles")
      .update({
        accessibility_prefs: {
          migrated_local_at: new Date().toISOString(),
        },
      })
      .eq("user_id", userId);

    // Clear local storage
    localStorage.removeItem("local_sessions");
    localStorage.removeItem("local_events");

    return true; // Migration successful
  } catch (error) {
    console.error("Migration failed:", error);
    return false;
  }
}

export function hasLocalData(): boolean {
  const localSessions = JSON.parse(localStorage.getItem("local_sessions") || "[]");
  const localEvents = JSON.parse(localStorage.getItem("local_events") || "[]");
  return localSessions.length > 0 || localEvents.length > 0;
}

export function saveLocalSession(session: LocalSession) {
  const sessions = JSON.parse(localStorage.getItem("local_sessions") || "[]");
  sessions.push(session);
  localStorage.setItem("local_sessions", JSON.stringify(sessions));
}

export function saveLocalEvent(event: LocalExerciseEvent) {
  const events = JSON.parse(localStorage.getItem("local_events") || "[]");
  events.push(event);
  localStorage.setItem("local_events", JSON.stringify(events));
}
