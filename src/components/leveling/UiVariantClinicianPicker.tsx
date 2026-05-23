/**
 * UiVariantClinicianPicker — Phase 2C-iv
 *
 * Clinician-facing control to set a patient's adaptive UI variant.
 * Lives on the Patient Hub → Plan tab. Writes to `user_ui_profile`
 * with source='clinician' and auto_selected=false so it overrides
 * any future system suggestion (2C-v) until reset.
 *
 * RLS: insert/update gated to assigned clinicians + admins.
 * Patient themselves can also edit via their own settings (future).
 */

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Eye, Save } from "lucide-react";
import type { UiVariant } from "@/lib/ui/variantClass";

const VARIANT_OPTIONS: { value: UiVariant; label: string; hint: string }[] = [
  { value: "standard", label: "Standard", hint: "Default density, full chrome. Most patients." },
  { value: "simplified-fluent", label: "Simplified — Fluent aphasia", hint: "Larger text, fewer words, icon-led. Comprehension support." },
  { value: "simplified-non-fluent", label: "Simplified — Non-fluent aphasia", hint: "Typing-first, low decision count, longer timeouts." },
  { value: "simplified-neglect", label: "Simplified — Left neglect", hint: "Right-weighted layout, anchor cues on the left edge." },
  { value: "minimal", label: "Minimal", hint: "Flat chrome, no progress bars, one decision per screen. Severe cases." },
];

interface Props {
  /** Patient user_id (auth.users.id) */
  userId: string;
}

export function UiVariantClinicianPicker({ userId }: Props) {
  const [current, setCurrent] = useState<UiVariant>("standard");
  const [selected, setSelected] = useState<UiVariant>("standard");
  const [source, setSource] = useState<"system" | "clinician" | "user">("system");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("user_ui_profile")
        .select("variant, source")
        .eq("user_id", userId)
        .maybeSingle();
      if (cancelled) return;
      if (!error && data) {
        setCurrent(data.variant as UiVariant);
        setSelected(data.variant as UiVariant);
        setSource(data.source as "system" | "clinician" | "user");
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [userId]);

  if (!userId) {
    return (
      <Card className="p-5 space-y-2 border-dashed">
        <div className="flex items-start gap-2">
          <Eye className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-foreground">Adaptive UI variant</h3>
            <p className="text-xs text-muted-foreground">
              Pick a patient from the clinician dashboard to set their adaptive UI variant. This control writes to the selected patient's profile.
            </p>
          </div>
        </div>
      </Card>
    );
  }

  const dirty = selected !== current;

  const save = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("user_ui_profile")
      .upsert({
        user_id: userId,
        variant: selected,
        source: "clinician",
        auto_selected: false,
      }, { onConflict: "user_id" });
    setSaving(false);
    if (error) {
      toast({ title: "Couldn't save UI variant", description: error.message, variant: "destructive" });
      return;
    }
    setCurrent(selected);
    setSource("clinician");
    toast({ title: "UI variant updated", description: `Patient will see the ${selected} variant on next load.` });
  };

  const selectedHint = VARIANT_OPTIONS.find(o => o.value === selected)?.hint;
  const canSave = Boolean(userId) && dirty && !saving && !loading;

  return (
    <Card className="p-5 space-y-4">
      <div className="flex items-start gap-2">
        <Eye className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-foreground">Adaptive UI variant</h3>
          <p className="text-xs text-muted-foreground">
            Choose how the app's chrome adapts for this patient. Affects layout density and supports — never changes scoring, content, or progression.
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="ui-variant" className="text-xs font-medium">Variant</Label>
        <Select
          value={selected}
          onValueChange={(v) => setSelected(v as UiVariant)}
          disabled={!userId || loading || saving}
        >
          <SelectTrigger id="ui-variant" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {VARIANT_OPTIONS.map(opt => (
              <SelectItem key={opt.value} value={opt.value}>
                <div className="flex flex-col items-start">
                  <span className="font-medium">{opt.label}</span>
                  <span className="text-xs text-muted-foreground">{opt.hint}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selectedHint && (
          <p className="text-xs text-muted-foreground italic">{selectedHint}</p>
        )}
        {!userId && (
          <p className="text-xs text-muted-foreground">Select a patient profile before saving a clinician override.</p>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 pt-2 border-t border-border">
        <div className="text-xs text-muted-foreground">
          Current: <span className="font-mono text-foreground">{current}</span>
          {" · "}set by <span className="font-medium">{source}</span>
        </div>
        <Button
          onClick={save}
          disabled={!canSave}
          size="sm"
        >
          <Save className="w-3.5 h-3.5 mr-1.5" />
          {saving ? "Saving…" : "Save"}
        </Button>
      </div>
    </Card>
  );
}
