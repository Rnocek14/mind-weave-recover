import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Database, Users } from "lucide-react";
import type { PhenotypeDistribution, RetentionCohortRow, FunctionalTrend } from "@/hooks/useCohortAnalytics";

const FIELD_LABELS: Record<string, string> = {
  aphasia_type: "Aphasia Type",
  stroke_mechanism_tag: "Stroke Mechanism",
  laterality: "Laterality",
  primary_territory: "Vascular Territory",
  chronicity_tag: "Chronicity",
};

interface Props {
  phenotypeDistributions: PhenotypeDistribution[];
  retentionByCohort: RetentionCohortRow[];
  functionalTrends: FunctionalTrend[];
}

export function DataReadinessAccordion({ phenotypeDistributions, retentionByCohort, functionalTrends }: Props) {
  const populatedFields = phenotypeDistributions.filter(d => d.counts.some(c => c.value !== "unknown")).length;
  const totalRetentionWords = retentionByCohort.reduce((s, r) => s + r.totalWords, 0);
  const totalCheckins = functionalTrends.reduce((s, f) => s + f.count, 0);

  return (
    <Accordion type="single" collapsible>
      <AccordionItem value="readiness" className="border rounded-lg">
        <AccordionTrigger className="px-4 py-2 text-sm font-semibold hover:no-underline">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-muted-foreground" />
            Data Readiness
            <Badge variant="outline" className="text-[10px] ml-2">
              {populatedFields}/5 phenotype fields • {totalRetentionWords} retention words • {totalCheckins} check-ins
            </Badge>
          </div>
        </AccordionTrigger>
        <AccordionContent className="px-4 pb-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {phenotypeDistributions.map((dist) => (
              <Card key={dist.field} className="border-border/50">
                <CardHeader className="pb-1 pt-2">
                  <CardTitle className="text-xs font-medium flex items-center gap-1.5">
                    <Users className="w-3 h-3 text-muted-foreground" />
                    {FIELD_LABELS[dist.field] || dist.field}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pb-2">
                  {dist.counts.length > 0 ? (
                    <ResponsiveContainer width="100%" height={120}>
                      <BarChart data={dist.counts} layout="vertical" margin={{ left: 70 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" allowDecimals={false} tick={{ fontSize: 9 }} />
                        <YAxis type="category" dataKey="value" tick={{ fontSize: 9 }} width={65} />
                        <Tooltip />
                        <Bar dataKey="count" fill="hsl(var(--muted-foreground))" radius={[0, 3, 3, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-[10px] text-muted-foreground">No data</p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground mt-3">
            This section validates that structured phenotype columns, retention snapshots, and functional check-ins are populating correctly.
          </p>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
