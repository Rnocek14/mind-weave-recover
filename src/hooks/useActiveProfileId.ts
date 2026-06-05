/**
 * useActiveProfileId
 *
 * Returns the currently active profile id from ProfileContext, or null.
 * Tolerates being called outside ProfileProvider (returns null) so it's
 * safe to drop into any data hook without breaking tests or storybook.
 *
 * Use to scope Supabase queries by profile_id alongside the existing
 * user_id filter. Prevents cross-profile data leaks when one auth user
 * has multiple patient profiles.
 */
import { useContext } from "react";
import { ProfileContext } from "@/contexts/profile-context-value";

export function useActiveProfileId(): string | null {
  const ctx = useContext(ProfileContext);
  return ctx?.activeProfile?.id ?? null;
}
