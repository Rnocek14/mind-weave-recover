import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = 'admin' | 'moderator' | 'caregiver' | 'user';

interface UserPermissions {
  isAdmin: boolean;
  isModerator: boolean;
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
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setRoles([]);
      setIsLoading(false);
      return;
    }

    // CRITICAL: flip back into loading whenever userId changes (including
    // undefined→defined). Without this, guards see isLoading=false + no
    // roles for one render and redirect before the role fetch resolves.
    setIsLoading(true);
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
        if (!cancelled) setIsLoading(false);
      }
    };

    fetchRoles();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return {
    isAdmin: roles.includes('admin'),
    isModerator: roles.includes('moderator') || roles.includes('admin'),
    isCaregiver: roles.includes('caregiver') || roles.includes('moderator') || roles.includes('admin'),
    roles,
    isLoading,
  };
}
