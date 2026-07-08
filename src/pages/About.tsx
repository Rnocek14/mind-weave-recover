import { Brain, Activity, FileText, BarChart3, Shield, Zap, Target, Layers, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

const About = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="border-b border-border/50 backdrop-blur-sm bg-background/80 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center">
              <Brain className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold text-foreground tracking-tight">NeuroRecover</span>
          </div>
          <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="text-muted-foreground">
            <ArrowLeft className="w-4 h-4 mr-1" /> Back
          </Button>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-5xl mx-auto px-6 pt-16 pb-12">
        <p className="text-sm font-semibold uppercase tracking-widest text-primary mb-3">
          Continuous Recovery Intelligence
        </p>
        <h1 className="text-4xl md:text-5xl font-bold text-foreground leading-tight max-w-3xl">
          Structured speech practice that adapts to every individual's recovery.
        </h1>
        <p className="mt-6 text-lg text-muted-foreground max-w-2xl leading-relaxed">
          NeuroRecover is a clinician-informed digital practice tool for people recovering from stroke-related 
          language difficulties. It provides structured, adaptive home practice and gives clinicians 
          between-session visibility into recovery progress.
        </p>
      </section>

      {/* Problem */}
      <section className="max-w-5xl mx-auto px-6 py-12 border-t border-border/40">
        <div className="grid md:grid-cols-2 gap-12">
          <div>
            <h2 className="text-2xl font-bold text-foreground mb-4">The Problem</h2>
            <p className="text-muted-foreground leading-relaxed">
              After discharge, most stroke survivors practice speech independently with no structured guidance 
              and no feedback loop to their clinician. Therapists see patients for limited sessions and have 
              no visibility into what happens between visits — a critical gap in neuro-rehabilitation.
            </p>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-foreground mb-4">Our Approach</h2>
            <p className="text-muted-foreground leading-relaxed">
              NeuroRecover fills the post-discharge gap with adaptive practice that continuously adjusts to 
              each person's abilities, and generates detailed telemetry that clinicians can review. 
              Every session produces clinically meaningful data — not just engagement metrics.
            </p>
          </div>
        </div>
      </section>

      {/* Core Capabilities */}
      <section className="max-w-5xl mx-auto px-6 py-12 border-t border-border/40">
        <h2 className="text-2xl font-bold text-foreground mb-2">Core Capabilities</h2>
        <p className="text-muted-foreground mb-10">What makes NeuroRecover different from generic brain-training apps.</p>

        <div className="grid md:grid-cols-2 gap-6">
          <CapabilityCard
            icon={<FileText className="w-5 h-5" />}
            title="Clinical Note Parsing"
            description="Upload clinical documents and NeuroRecover automatically extracts diagnosis, lesion location, aphasia type, and severity to personalise the practice plan from day one."
          />
          <CapabilityCard
            icon={<Activity className="w-5 h-5" />}
            title="Adaptive Practice Engine"
            description="Real-time difficulty adjustment that maintains a therapeutic sweet spot — challenging enough to drive neuroplasticity, forgiving enough to maintain confidence and engagement."
          />
          <CapabilityCard
            icon={<Layers className="w-5 h-5" />}
            title="Cognitive State Tracking"
            description="Continuously monitors performance across multiple cognitive-linguistic domains including lexical retrieval, phonological processing, and semantic access — building a detailed recovery profile over time."
          />
          <CapabilityCard
            icon={<Target className="w-5 h-5" />}
            title="Speech Analysis"
            description="Phoneme-level pronunciation assessment and automatic speech recognition provide granular feedback on articulation accuracy, fluency patterns, and error classification."
          />
          <CapabilityCard
            icon={<BarChart3 className="w-5 h-5" />}
            title="Clinician-Facing Reporting"
            description="Automated progress notes with objective metrics, learning trajectories, and domain-specific trends — designed for easy integration into clinical documentation workflows."
          />
          <CapabilityCard
            icon={<Zap className="w-5 h-5" />}
            title="Evidence-Informed Exercises"
            description="17+ exercise types grounded in aphasia rehabilitation research — including Semantic Feature Analysis, phonological tasks, conversation practice, and narrative retell activities."
          />
        </div>
      </section>

      {/* For Clinicians */}
      <section className="max-w-5xl mx-auto px-6 py-12 border-t border-border/40">
        <h2 className="text-2xl font-bold text-foreground mb-2">For Clinicians</h2>
        <p className="text-muted-foreground mb-8">NeuroRecover is designed to complement professional therapy, not replace it.</p>
        
        <div className="grid md:grid-cols-3 gap-6">
          <InfoCard
            title="Between-Session Visibility"
            description="See exactly what your patient practiced, how they performed, and where they struggled — before your next appointment."
          />
          <InfoCard
            title="EHR-Friendly Exports"
            description="Copy structured progress notes directly into your documentation. Objective metrics, not subjective self-reports."
          />
          <InfoCard
            title="Recovery Trajectory Insights"
            description="Track learning rates across domains over time. Identify plateaus early and adjust treatment plans with data."
          />
        </div>
      </section>

      {/* Clinical Framework */}
      <section className="max-w-5xl mx-auto px-6 py-12 border-t border-border/40">
        <div className="rounded-2xl bg-muted/50 p-8 md:p-10">
          <div className="flex items-start gap-4 mb-6">
            <Shield className="w-6 h-6 text-primary mt-1 flex-shrink-0" />
            <div>
              <h3 className="text-xl font-bold text-foreground mb-2">Clinical Positioning</h3>
              <p className="text-muted-foreground leading-relaxed">
                NeuroRecover is a structured home practice tool informed by the ICF framework and 
                evidence-based aphasia rehabilitation approaches. It is <strong className="text-foreground">not a medical device</strong> and 
                is intended to supplement — not replace — professional speech-language pathology services. 
                All adaptive decisions are deterministic and transparent, with full audit trails available 
                for clinical review.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="max-w-5xl mx-auto px-6 py-10 border-t border-border/40">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Brain className="w-4 h-4" />
            <span>NeuroRecover — Continuous Recovery Intelligence</span>
          </div>
          <p className="text-xs text-muted-foreground">Confidential — For clinical review only</p>
        </div>
      </footer>
    </div>
  );
};

const CapabilityCard = ({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) => (
  <div className="rounded-xl border border-border/60 bg-card p-6 space-y-3">
    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
      {icon}
    </div>
    <h3 className="text-lg font-semibold text-foreground">{title}</h3>
    <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
  </div>
);

const InfoCard = ({ title, description }: { title: string; description: string }) => (
  <div className="rounded-xl bg-card border border-border/60 p-6 space-y-2">
    <h4 className="font-semibold text-foreground">{title}</h4>
    <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
  </div>
);

export default About;
