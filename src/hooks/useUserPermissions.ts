import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = 'admin' | 'moderator' | 'clinician' | 'caregiver' | 'user';

interface UserPermissions {
  isAdmin: boolean;
  isModerator: boolean;
  isClinician: boolean;
  isCaregiver: boolean;
  roles: AppRole[];
  isLoading: boolean;
}

/**
 * Hook to check real user permissions from the database.
 * This is the authorization boundary - NOT uiMode.
 * uiMode controls UI density, permissions control access.
 */
export function useUserPermissions(userId: string | undefined): UserPermissions {
  const [roles, setRoles] = useState<AppRole[]>([]);
  // Track which userId the current `roles` value corresponds to. If it
  // doesn't match the userId prop, we're stale and must report loading=true
  // synchronously — otherwise guards see isAdmin=false for one render
  // during the userId-undefined → defined transition and redirect.
  const [loadedForUserId, setLoadedForUserId] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) {
      setRoles([]);
      setLoadedForUserId(null);
      return;
    }

    let cancelled = false;

    const fetchRoles = async () => {
      try {
        const { data, error } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', userId);

        if (cancelled) return;

        if (error) {
          console.error('Error fetching user roles:', error);
          setRoles([]);
        } else {
          setRoles(data?.map(r => r.role as AppRole) || []);
        }
      } catch (err) {
        if (cancelled) return;
        console.error('Failed to fetch permissions:', err);
        setRoles([]);
      } finally {
        if (!cancelled) setLoadedForUserId(userId);
      }
    };

    fetchRoles();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  // Synchronous loading state: if userId is set but roles haven't been
  // loaded for THIS userId yet, we're loading. Survives the render gap
  // before useEffect runs.
  const isLoading = userId ? loadedForUserId !== userId : false;

  return {
    isAdmin: !isLoading && roles.includes('admin'),
    isModerator: !isLoading && (roles.includes('moderator') || roles.includes('admin')),
    // A clinician is anyone with the clinician role, or the broader moderator/admin roles.
    isClinician: !isLoading && (roles.includes('clinician') || roles.includes('moderator') || roles.includes('admin')),
    isCaregiver: !isLoading && (roles.includes('caregiver') || roles.includes('clinician') || roles.includes('moderator') || roles.includes('admin')),
    roles: isLoading ? [] : roles,
    isLoading,
  };
}

