/**
 * Fetches active dose targets for a profile and compares with actual dose logs.
 */
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { localYYYYMMDD } from "@/lib/localDate";

export interface DoseComparison {
  domainSlug: string;
  domainLabel: string;
  prescribed: number; // minutes per day target
  completed: number; // actual minutes in window
  completedPerDay: number;
  ratio: number; // 0-1+
  daysInWindow: number;
}

export function useDoseTargets(profileId: string | undefined, daysBack: number = 7) {
  const [comparisons, setComparisons] = useState<DoseComparison[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!profileId) {
      setIsLoading(false);
      return;
    }

    const load = async () => {
      setIsLoading(true);
      try {
        const today = localYYYYMMDD();
        const start = new Date();
        start.setDate(start.getDate() - (daysBack - 1));
        const startStr = localYYYYMMDD(start);

        // Fetch active dose targets
        const { data: targets } = await (supabase as any)
          .from("dose_targets")
          .select("domain_slug, target_value, target_frequency")
          .eq("profile_id", profileId)
          .lte("effective_from", today)
          .or(`effective_until.is.null,effective_until.gte.${startStr}`);

        // Fetch dose logs for this window
        const { data: logs } = await (supabase as any)
          .from("dose_logs")
          .select("domain_slug, dose_value")
          .eq("profile_id", profileId)
          .gte("log_date", startStr)
          .lte("log_date", today);

        // Fetch domain labels
        const { data: domains } = await supabase
          .from("recovery_domains")
          .select("slug, display_name")
          .eq("is_active", true);

        const domainLabelMap: Record<string, string> = {};
        (domains || []).forEach((d) => {
          domainLabelMap[d.slug] = d.display_name;
        });

        // Aggregate logs by domain
        const logsByDomain: Record<string, number> = {};
        (logs || []).forEach((l: any) => {
          logsByDomain[l.domain_slug] = (logsByDomain[l.domain_slug] || 0) + (l.dose_value || 0);
        });

        // Build comparisons
        const result: DoseComparison[] = (targets || []).map((t: any) => {
          const completed = logsByDomain[t.domain_slug] || 0;
          const prescribed = t.target_value || 0;
          const completedPerDay = daysBack > 0 ? Math.round(completed / daysBack) : 0;
          return {
            domainSlug: t.domain_slug,
            domainLabel: domainLabelMap[t.domain_slug] || t.domain_slug.replace(/_/g, " "),
            prescribed,
            completed: Math.round(completed),
            completedPerDay,
            ratio: prescribed > 0 ? completed / (prescribed * daysBack) : 0,
            daysInWindow: daysBack,
          };
        });

        setComparisons(result);
      } catch (err) {
        console.error("[useDoseTargets] error:", err);
      } finally {
        setIsLoading(false);
      }
    };

    load();
  }, [profileId, daysBack]);

  return { comparisons, isLoading };
}
