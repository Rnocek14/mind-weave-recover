import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { User, Session } from '@supabase/supabase-js';

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (
    email: string,
    password: string,
    displayName?: string,
    requestedRole?: string,
    accountIntent?: string,
  ) => {
    const redirectUrl = `${window.location.origin}/`;
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        // Metadata is persisted on the auth user so it survives email
        // confirmation:
        //  - requested_role (clinician): Auth.tsx reconciles it into
        //    role_requests on first authenticated load and routes to approval.
        //  - account_intent (caregiver): read by the handle_new_user trigger to
        //    provision a family Care Account + caregiver membership WITHOUT a
        //    patient profile, and by Auth.tsx to route into caregiver setup.
        //  - consented_terms_at: timestamp of the required Terms/Privacy
        //    consent checkbox at signup (the form cannot submit without it).
        data: {
          display_name: displayName,
          consented_terms_at: new Date().toISOString(),
          ...(requestedRole && requestedRole !== "patient"
            ? { requested_role: requestedRole }
            : {}),
          ...(accountIntent ? { account_intent: accountIntent } : {}),
        },
      },
    });
    return { error };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    return { error };
  };

  const signInAnonymously = async () => {
    const { error } = await supabase.auth.signInAnonymously();
    return { error };
  };

  return { user, session, loading, signUp, signIn, signOut, signInAnonymously };
};
