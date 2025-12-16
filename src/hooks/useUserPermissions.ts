import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = 'admin' | 'moderator' | 'user';

interface UserPermissions {
  isAdmin: boolean;
  isModerator: boolean;
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

    const fetchRoles = async () => {
      try {
        const { data, error } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', userId);

        if (error) {
          console.error('Error fetching user roles:', error);
          setRoles([]);
        } else {
          setRoles(data?.map(r => r.role as AppRole) || []);
        }
      } catch (err) {
        console.error('Failed to fetch permissions:', err);
        setRoles([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchRoles();
  }, [userId]);

  return {
    isAdmin: roles.includes('admin'),
    isModerator: roles.includes('moderator') || roles.includes('admin'),
    roles,
    isLoading,
  };
}
