/**
 * useUiProfile — reads the adaptive UI profile for the current user.
 *
 * Phase 2C-i: READ-ONLY. No writes. Falls back to `standard` for
 * anonymous / unauthenticated / loading states so guests never get
 * a partial UI.
 *
 * Dev override: append `?uiProfile=simplified-non-fluent` (etc.) to
 * any URL to preview a variant without touching the DB. Only honored
 * in dev mode (`import.meta.env.DEV`).
 *
 * Future phases:
 *   - 2C-iv onboarding will write rows via a clinician picker.
 *   - 2C-v will auto-select variants from the stroke profile.
 */

import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import type { UiVariant } from '@/lib/ui/variantClass';

export interface UiProfile {
  variant: UiVariant;
  density: 'comfortable' | 'spacious';
  readingLoadCap: number;
  decisionCap: number;
  autoSelected: boolean;
  source: 'system' | 'clinician' | 'user';
}

const DEFAULT_PROFILE: UiProfile = {
  variant: 'standard',
  density: 'comfortable',
  readingLoadCap: 40,
  decisionCap: 4,
  autoSelected: true,
  source: 'system',
};

const VALID_VARIANTS: UiVariant[] = [
  'standard',
  'simplified-fluent',
  'simplified-non-fluent',
  'simplified-neglect',
  'minimal',
];

function isPreviewHost(): boolean {
  if (typeof window === 'undefined') return false;
  const h = window.location.hostname;
  return h.includes('lovable.app') || h.includes('lovableproject.com') || h === 'localhost';
}

const STORAGE_KEY = 'uiProfileOverride';

function readUrlOverride(): UiVariant | null {
  if (typeof window === 'undefined') return null;
  if (!import.meta.env.DEV && !isPreviewHost()) return null;
  try {
    const params = new URLSearchParams(window.location.search);
    const v = params.get('uiProfile');
    if (v && (VALID_VARIANTS as string[]).includes(v)) {
      sessionStorage.setItem(STORAGE_KEY, v);
      return v as UiVariant;
    }
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (stored && (VALID_VARIANTS as string[]).includes(stored)) {
      return stored as UiVariant;
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function useUiProfile(): { profile: UiProfile; loading: boolean } {
  const { user, loading: authLoading } = useAuth();
  const location = useLocation();
  const [profile, setProfile] = useState<UiProfile>(DEFAULT_PROFILE);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Dev URL override always wins
    const override = readUrlOverride();
    if (override) {
      setProfile({ ...DEFAULT_PROFILE, variant: override, source: 'user', autoSelected: false });
      setLoading(false);
      return;
    }

    if (authLoading) return;
    if (!user?.id) {
      setProfile(DEFAULT_PROFILE);
      setLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('user_ui_profile')
        .select('variant, density, reading_load_cap, decision_cap, auto_selected, source')
        .eq('user_id', user.id)
        .maybeSingle();

      if (cancelled) return;
      if (error || !data) {
        setProfile(DEFAULT_PROFILE);
      } else {
        setProfile({
          variant: data.variant as UiVariant,
          density: data.density as 'comfortable' | 'spacious',
          readingLoadCap: data.reading_load_cap,
          decisionCap: data.decision_cap,
          autoSelected: data.auto_selected,
          source: data.source as 'system' | 'clinician' | 'user',
        });
      }
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.id, authLoading, location.search]);

  return { profile, loading };
}
