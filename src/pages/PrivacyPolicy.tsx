/**
 * Privacy Policy — plain-language, honest disclosure for a speech-therapy app
 * that records patient voice audio.
 *
 * Written to be readable by the app's actual audience (stroke survivors with
 * aphasia and their caregivers): short sentences, headings, no legalese where
 * plain words work. This is a solid launch draft — it should still be reviewed
 * by a lawyer as the product grows.
 */
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

const LAST_UPDATED = "July 16, 2026";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      <div className="space-y-2 text-base leading-relaxed text-muted-foreground">{children}</div>
    </section>
  );
}

export default function PrivacyPolicy() {
  const navigate = useNavigate();
  return (
    <div className="min-h-dvh bg-background">
      <div className="mx-auto max-w-2xl px-4 py-6 sm:py-10 space-y-6">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="-ml-2">
          <ArrowLeft className="mr-1 h-4 w-4" /> Back
        </Button>

        <header>
          <h1 className="text-2xl font-bold text-foreground">Privacy Policy</h1>
          <p className="mt-1 text-sm text-muted-foreground">Last updated: {LAST_UPDATED}</p>
        </header>

        <Section title="The short version">
          <p>
            NeuroRecover is a speech practice app. To help you practice, we
            record what you say during exercises and keep your practice
            history. Your data is used for your therapy — to score your
            practice, show your progress, and let your therapist or caregiver
            review it. We do not sell your data.
          </p>
        </Section>

        <Section title="What we collect">
          <p>When you use NeuroRecover, we store:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              <span className="text-foreground font-medium">Account information</span> —
              your email address and the name you give us.
            </li>
            <li>
              <span className="text-foreground font-medium">Voice recordings</span> —
              short audio clips of your answers during speaking exercises, so
              your speech can be scored and your therapist can listen to them
              later.
            </li>
            <li>
              <span className="text-foreground font-medium">Transcripts</span> —
              the text of what you said, produced by speech recognition.
            </li>
            <li>
              <span className="text-foreground font-medium">Practice history</span> —
              which exercises you did, your answers, scores, difficulty levels,
              and progress over time.
            </li>
            <li>
              <span className="text-foreground font-medium">Photos you upload</span> —
              if you add personal photos for naming practice.
            </li>
          </ul>
        </Section>

        <Section title="How your data is used">
          <ul className="list-disc pl-5 space-y-1">
            <li>To score your practice and adjust difficulty to your level.</li>
            <li>To show your progress to you.</li>
            <li>
              To let the clinician or caregiver connected to your account
              review your sessions, including listening to practice recordings.
            </li>
            <li>To fix problems with the app and make it work better.</li>
          </ul>
          <p>
            We do not sell your data. We do not use it for advertising.
          </p>
        </Section>

        <Section title="Services that process your data">
          <p>
            Some processing happens on trusted service providers we use to run
            the app. They process your data only to provide the service:
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              <span className="text-foreground font-medium">Supabase</span> —
              stores your account, practice history, and recordings.
            </li>
            <li>
              <span className="text-foreground font-medium">Microsoft Azure Speech</span> —
              converts your recorded speech to text and analyzes pronunciation.
            </li>
            <li>
              <span className="text-foreground font-medium">AI language services</span> —
              short pieces of text (such as a word you said and the target
              word) may be sent to AI services to judge how close in meaning
              they are, and to generate Maya's spoken guidance.
            </li>
          </ul>
        </Section>

        <Section title="Who can see your data">
          <ul className="list-disc pl-5 space-y-1">
            <li>You.</li>
            <li>
              A clinician or caregiver you (or your care team) connected to
              your account.
            </li>
            <li>
              No one else, except as required by law.
            </li>
          </ul>
        </Section>

        <Section title="Your choices">
          <ul className="list-disc pl-5 space-y-1">
            <li>
              You can practice without the microphone — every speaking exercise
              has a tap or type alternative.
            </li>
            <li>
              You can review your privacy settings in the app under{" "}
              <span className="text-foreground font-medium">Settings → Privacy</span>.
            </li>
            <li>
              You can ask for your account and its data to be deleted. Use the
              privacy settings in the app, or ask the person who set up your
              account to do it with you.
            </li>
          </ul>
        </Section>

        <Section title="Not medical care">
          <p>
            NeuroRecover is a practice tool. It does not replace your doctor or
            speech-language pathologist, and nothing in the app is medical
            advice or a diagnosis. Always follow the guidance of your care
            team.
          </p>
        </Section>

        <Section title="Changes to this policy">
          <p>
            If this policy changes in an important way, we will tell you in
            the app before the change applies to you.
          </p>
        </Section>
      </div>
    </div>
  );
}
