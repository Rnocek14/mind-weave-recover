import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import {
  BarChart3, AlertTriangle, Shield, Activity, Target,
  Database, FlaskConical, Cpu, ClipboardCheck, ImageIcon, Brain, Mic,
} from "lucide-react";

interface NavItem {
  title: string;
  description: string;
  href: string;
  icon: typeof BarChart3;
  badge?: string;
}

const NAV_SECTIONS: { heading: string; items: NavItem[] }[] = [
  {
    heading: "System Oversight",
    items: [
      {
        title: "Alert Rollup",
        description: "Unresolved alerts across all patients",
        href: "/admin/alerts",
        icon: AlertTriangle,
      },
      {
        title: "Override Audit",
        description: "Clinician overrides and reversal history",
        href: "/admin/overrides",
        icon: Shield,
      },
      {
        title: "Adaptation Stream",
        description: "Engine adaptation events across sessions",
        href: "/admin/adaptations",
        icon: Activity,
      },
      {
        title: "Success-Band Monitor",
        description: "Challenge zone distribution across users",
        href: "/admin/success-band",
        icon: Target,
      },
      {
        title: "Telemetry Anomalies",
        description: "Detector output: rules, severity, recent runs",
        href: "/admin/telemetry-anomalies",
        icon: AlertTriangle,
        badge: "New",
      },
    ],
  },
  {
    heading: "Analytics & Research",
    items: [
      {
        title: "Voice Analytics",
        description: "Voice interaction adoption, recognition, and fallback metrics",
        href: "/admin/voice-analytics",
        icon: Mic,
        badge: "New",
      },
      {
        title: "Parser Analytics",
        description: "Clinical note parsing accuracy and throughput",
        href: "/admin/analytics",
        icon: BarChart3,
      },
      {
        title: "Cluster Analytics",
        description: "Patient cohort patterns and groupings",
        href: "/analytics/cluster",
        icon: BarChart3,
      },
      {
        title: "Outcomes Validation",
        description: "Prediction accuracy and outcome tracking",
        href: "/admin/outcomes-validation",
        icon: FlaskConical,
      },
      {
        title: "Research Export",
        description: "De-identified data exports for research",
        href: "/admin/research-export",
        icon: Database,
      },
    ],
  },
  {
    heading: "Engine & Pipeline",
    items: [
      {
        title: "Engine Simulation",
        description: "Test lesson engine against clinical profiles",
        href: "/admin/engine-simulation",
        icon: Cpu,
      },
      {
        title: "Pipeline Health",
        description: "Speech processing pipeline status",
        href: "/admin/pipeline",
        icon: Activity,
      },
    ],
  },
  {
    heading: "Content & Review",
    items: [
      {
        title: "Clinical Review",
        description: "Review flagged utterances and sessions",
        href: "/admin?tab=review",
        icon: ClipboardCheck,
      },
      {
        title: "Photo Library",
        description: "Manage exercise photo assets",
        href: "/admin?tab=photos",
        icon: ImageIcon,
      },
      {
        title: "Tools",
        description: "Profile computation and maintenance",
        href: "/admin?tab=tools",
        icon: Brain,
      },
    ],
  },
];

const SECTION_TOUR_IDS: Record<string, string> = {
  "System Oversight": "ad-hub-oversight",
  "Analytics & Research": "ad-hub-analytics",
  "Engine & Pipeline": "ad-hub-engine",
  "Content & Review": "ad-hub-content",
};

export function AdminNavHub() {
  return (
    <div className="space-y-8">
      {NAV_SECTIONS.map((section) => (
        <div key={section.heading} data-tour={SECTION_TOUR_IDS[section.heading]} className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            {section.heading}
          </h2>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {section.items.map((item) => (
              <Link key={item.href} to={item.href}>
                <Card className="p-4 h-full hover:border-primary/40 hover:bg-accent/30 transition-colors cursor-pointer group">
                  <div className="flex items-start gap-3">
                    <div className="rounded-lg bg-primary/10 p-2 text-primary group-hover:bg-primary/20 transition-colors">
                      <item.icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-sm text-foreground">{item.title}</h3>
                        {item.badge && (
                          <Badge variant="secondary" className="text-xs">{item.badge}</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                        {item.description}
                      </p>
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
