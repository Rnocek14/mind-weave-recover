import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, BarChart3 } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface OutcomePredictionCardProps {
  userId: string;
  profileId: string | undefined;
}

/**
 * Surfaces the latest outcome prediction for the clinician.
 */
export function OutcomePredictionCard({ userId, profileId }: OutcomePredictionCardProps) {
  const [prediction, setPrediction] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profileId) return;

    const fetch = async () => {
      const { data } = await supabase
        .from("outcome_predictions")
        .select("prediction_data, clinical_context, created_at")
        .eq("profile_id", profileId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      setPrediction(data);
      setLoading(false);
    };

    fetch();
  }, [profileId]);

  if (loading || !prediction) return null;

  const pd = prediction.prediction_data as any;
  const trajectory = pd?.trajectory || pd?.predicted_trajectory || "unknown";
  const confidence = pd?.confidence || pd?.confidence_score || null;
  const domains = pd?.domain_predictions || pd?.domains || {};

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-2 pt-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-primary" />
          Outcome Prediction
        </CardTitle>
      </CardHeader>
      <CardContent className="pb-3 space-y-3">
        <div className="flex items-center gap-3">
          <TrendingUp className={`w-5 h-5 ${
            trajectory === "improving" || trajectory === "positive" ? "text-emerald-500" :
            trajectory === "stable" || trajectory === "plateau" ? "text-primary" :
            "text-amber-500"
          }`} />
          <div>
            <p className="text-sm font-semibold text-foreground capitalize">
              {trajectory.replace(/_/g, " ")} trajectory
            </p>
            {confidence && (
              <p className="text-xs text-muted-foreground">
                Confidence: {typeof confidence === "number" ? `${Math.round(confidence * 100)}%` : confidence}
              </p>
            )}
          </div>
        </div>

        {Object.keys(domains).length > 0 && (
          <div className="space-y-1.5 pt-2 border-t border-border/50">
            {Object.entries(domains).slice(0, 4).map(([domain, data]: [string, any]) => (
              <div key={domain} className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground capitalize">{domain.replace(/_/g, " ")}</span>
                <span className="font-medium text-foreground">
                  {typeof data === "string" ? data : data?.expected || data?.prediction || "—"}
                </span>
              </div>
            ))}
          </div>
        )}

        <p className="text-[10px] text-muted-foreground">
          Generated {new Date(prediction.created_at).toLocaleDateString()}
        </p>
      </CardContent>
    </Card>
  );
}
