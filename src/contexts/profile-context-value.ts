import { createContext } from "react";
import type { Tables } from "@/integrations/supabase/types";

export type Profile = Tables<"profiles">;

export interface ProfileContextValue {
  activeProfile: Profile | null;
  allProfiles: Profile[];
  loading: boolean;
  switchProfile: (profileId: string) => Promise<void>;
  createProfile: (data: {
    profile_name: string;
    birthdate?: string;
    stroke_date?: string;
    avatar_url?: string;
    profile_notes?: string;
  }) => Promise<void>;
  refreshProfiles: () => Promise<void>;
}

export const ProfileContext = createContext<ProfileContextValue | null>(null);
