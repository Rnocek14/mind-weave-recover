import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { MessageCircle } from "lucide-react";
import {
  getTransferTrend,
  getCarryoverReport,
  type WordCarryover,
} from "@/lib/transferLedger";

/**
 * Transfer trend — the progress surface that shows GENERALIZATION, not
 * memorization: how practiced words are surviving into real conversation.
 *
 * Renders nothing until the ledger has conversational data (honesty rule:
 * no empty charts pretending to be measurements). All data is device-local.
 */

const STATUS_META: Record<WordCarryover["status"], { label: string; className: string }> = {
  strong: { label: "in your conversations", className: "bg-success-light text-success" },
  fading: { label: "getting quiet", className: "bg-accent/25 text-accent-foreground" },
  lost: { label: "needs another visit", className: "bg-muted text-muted-foreground" },
  new: { label: "just practiced", className: "bg-primary/10 text-primary" },
};

export function TransferTrendCard() {
  const trend = useMemo(() => getTransferTrend(), []);
  const report = useMemo(() => getCarryoverReport(), []);

  const conversational = report.filter((r) => r.lastConversationalUseDay !== null || r.status !== "new");
  if (trend.length === 0 && conversational.length === 0) return null;

  const totals = trend.reduce(
    (acc, p) => ({
      spontaneous: acc.spontaneous + p.spontaneous,
      elicited: acc.elicited + p.elicited,
      cued: acc.cued + p.cued,
    }),
    { spontaneous: 0, elicited: 0, cued: 0 },
  );
  const strong = report.filter((r) => r.status === "strong");
  const fading = report.filter((r) => r.status === "fading" || r.status === "lost");

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center gap-2">
        <MessageCircle className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-semibold">Words in real conversation</h3>
        <span className="text-[10px] text-muted-foreground ml-auto">last 14 days</span>
      </div>

      {/* Transfer tier totals */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl bg-secondary/10 p-2">
          <p className="text-xl font-bold text-secondary">{totals.spontaneous}</p>
          <p className="text-[11px] text-muted-foreground leading-tight">used on your own</p>
        </div>
        <div className="rounded-xl bg-primary/10 p-2">
          <p className="text-xl font-bold text-primary">{totals.elicited}</p>
          <p className="text-[11px] text-muted-foreground leading-tight">found in chat</p>
        </div>
        <div className="rounded-xl bg-muted p-2">
          <p className="text-xl font-bold text-foreground">{totals.cued}</p>
          <p className="text-[11px] text-muted-foreground leading-tight">with a little help</p>
        </div>
      </div>

      {/* Per-word carryover chips */}
      {(strong.length > 0 || fading.length > 0) && (
        <div className="flex flex-wrap gap-1.5">
          {[...strong, ...fading].slice(0, 8).map((w) => (
            <span
              key={w.word}
              className={`text-xs rounded-full px-2.5 py-1 font-medium ${STATUS_META[w.status].className}`}
            >
              {w.word} · {STATUS_META[w.status].label}
            </span>
          ))}
        </div>
      )}

      <p className="text-[10px] text-muted-foreground">
        Based on your review chats. Words getting quiet come back in your next chat automatically.
      </p>
    </Card>
  );
}
