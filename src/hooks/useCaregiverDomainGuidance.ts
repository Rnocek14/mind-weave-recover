/**
 * Hook that provides personalized caregiver guidance based on
 * the patient's cognitive domain scores.
 */

import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { COGNITIVE_DOMAINS } from "@/lib/cognitiveStateEngine";
import { getActionsForDomain, type CaregiverAction } from "@/lib/caregiverActionMap";
import { useActiveProfileId } from "@/hooks/useActiveProfileId";

interface DomainGuidance {
  domainSlug: string;
  domainLabel: string;
  caregiverLabel: string;
  score: number;
  actions: CaregiverAction[];
}

interface CaregiverGuidanceResult {
  primaryStruggle: DomainGuidance | null;
  secondaryStruggle: DomainGuidance | null;
  isLoading: boolean;
}

export function useCaregiverDomainGuidance(userId: string | undefined): CaregiverGuidanceResult {
  const activeProfileId = useActiveProfileId();
  const { data: scores, isLoading } = useQuery({
    queryKey: ["caregiver-domain-scores", userId, activeProfileId],
    queryFn: async () => {
      if (!userId) return [];
      let query = supabase
        .from("cognitive_domain_scores")
        .select("domain_slug, score, trial_count, computed_at")
        .eq("user_id", userId)
        .eq("granularity", "day")
        .gte("trial_count", 3)
        .order("computed_at", { ascending: false });
      if (activeProfileId) query = query.eq("profile_id", activeProfileId);
      const { data, error } = await query;

      // De-duplicate: keep latest per domain
      const seen = new Set<string>();
      return (data || []).filter((row) => {
        if (seen.has(row.domain_slug)) return false;
        seen.add(row.domain_slug);
        return true;
      });
    },
    enabled: !!userId,
    staleTime: 5 * 60_000,
  });

  const guidance = useMemo(() => {
    if (!scores?.length) return { primaryStruggle: null, secondaryStruggle: null };

    // Sort ascending by score — lowest = most struggle
    const sorted = [...scores].sort((a, b) => a.score - b.score);

    const toGuidance = (row: typeof sorted[0]): DomainGuidance => {
      const meta = COGNITIVE_DOMAINS.find((d) => d.slug === row.domain_slug);
      const caregiverLabel = meta?.patientLabel?.toLowerCase() || row.domain_slug.replace(/_/g, " ");
      return {
        domainSlug: row.domain_slug,
        domainLabel: meta?.label || row.domain_slug,
        caregiverLabel,
        score: row.score,
        actions: getActionsForDomain(row.domain_slug),
      };
    };

    return {
      primaryStruggle: sorted[0] ? toGuidance(sorted[0]) : null,
      secondaryStruggle: sorted[1] ? toGuidance(sorted[1]) : null,
    };
  }, [scores]);

  return { ...guidance, isLoading };
}
