/**
 * Terms of Service — plain-language terms for NeuroRecover.
 * Launch draft; recommend legal review as the product grows.
 */
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useNavigate, Link } from "react-router-dom";

const LAST_UPDATED = "July 16, 2026";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      <div className="space-y-2 text-base leading-relaxed text-muted-foreground">{children}</div>
    </section>
  );
}

export default function TermsOfService() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-4 py-6 sm:py-10 space-y-6">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="-ml-2">
          <ArrowLeft className="mr-1 h-4 w-4" /> Back
        </Button>

        <header>
          <h1 className="text-2xl font-bold text-foreground">Terms of Service</h1>
          <p className="mt-1 text-sm text-muted-foreground">Last updated: {LAST_UPDATED}</p>
        </header>

        <Section title="What NeuroRecover is">
          <p>
            NeuroRecover is an app for practicing speech and language skills,
            built for people recovering from stroke and aphasia. By creating an
            account you agree to these terms and to our{" "}
            <Link to="/privacy" className="text-primary underline">Privacy Policy</Link>.
          </p>
        </Section>

        <Section title="Not medical care">
          <p>
            NeuroRecover is a practice tool, not medical care. It does not
            diagnose, treat, or replace your doctor or speech-language
            pathologist. Scores and levels in the app describe your practice —
            they are not a medical assessment. Always follow the guidance of
            your care team, and contact them (or emergency services) about any
            health concern.
          </p>
        </Section>

        <Section title="Your account">
          <ul className="list-disc pl-5 space-y-1">
            <li>Give accurate information when you sign up.</li>
            <li>Keep your password private.</li>
            <li>
              A caregiver or clinician account must only be used to support
              people who have agreed to be supported.
            </li>
          </ul>
        </Section>

        <Section title="Your content">
          <p>
            Recordings you make and photos you upload stay yours. You give us
            permission to store and process them only to provide the service —
            scoring your practice, showing your progress, and sharing sessions
            with the clinician or caregiver connected to your account, as
            described in the Privacy Policy.
          </p>
        </Section>

        <Section title="Acceptable use">
          <p>
            Don't misuse the app: no attempting to access other people's data,
            no disrupting the service, and no uploading content that is illegal
            or harmful.
          </p>
        </Section>

        <Section title="The service">
          <p>
            We work hard to keep NeuroRecover available and reliable, but it is
            provided "as is", without warranties. Features may change as the
            app improves. We may suspend accounts that break these terms.
          </p>
        </Section>

        <Section title="Ending your account">
          <p>
            You can stop using NeuroRecover at any time and ask for your
            account and data to be deleted (see the Privacy Policy for how).
          </p>
        </Section>

        <Section title="Changes to these terms">
          <p>
            If these terms change in an important way, we will tell you in the
            app before the change applies to you.
          </p>
        </Section>
      </div>
    </div>
  );
}
