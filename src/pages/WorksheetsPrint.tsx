/**
 * WorksheetsPrint — the printable Home Practice Pack.
 *
 * Rendered as real paper pages: large print (18pt+ body), one task block per
 * page, black-and-white and ink-friendly, page breaks between sheets. The
 * hosted PDF is generated from this exact route, so what a user prints and
 * what they download are the same document.
 *
 * Not part of the app shell — no nav chrome, no auth.
 */

import { useMemo } from 'react';
import { buildWorksheetPack } from '@/lib/worksheets/buildWorksheetPack';

const SITE = 'neurorecover.app';

function Page({ children, footer }: { children: React.ReactNode; footer?: string }) {
  return (
    <section className="ws-page">
      <div className="ws-page-body">{children}</div>
      <div className="ws-foot">
        <span>{footer ?? 'NeuroRecover — free home practice pack'}</span>
        <span>{SITE}</span>
      </div>
    </section>
  );
}

function WriteLines({ count }: { count: number }) {
  return (
    <div className="ws-lines">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="ws-line" />
      ))}
    </div>
  );
}

export default function WorksheetsPrint() {
  const pack = useMemo(() => buildWorksheetPack(), []);
  const sentenceSection = pack.sections.find((s) => s.id === 'sentences')!;
  const categorySection = pack.sections.find((s) => s.id === 'categories')!;
  const clueSection = pack.sections.find((s) => s.id === 'clues')!;
  const pairSection = pack.sections.find((s) => s.id === 'pairs')!;

  return (
    <div className="ws-root">
      <style>{`
        .ws-root { background: #fff; color: #000; font-family: Georgia, 'Times New Roman', serif; }
        .ws-toolbar {
          position: sticky; top: 0; z-index: 10; display: flex; gap: 12px; align-items: center;
          justify-content: center; padding: 12px; background: #111; color: #fff; font-family: system-ui, sans-serif;
        }
        .ws-toolbar button {
          background: #fff; color: #111; border: 0; border-radius: 6px; padding: 8px 16px;
          font-weight: 600; font-size: 15px; cursor: pointer;
        }
        .ws-page {
          width: 8.5in; min-height: 11in; margin: 16px auto; padding: 0.75in 0.7in 0.5in;
          background: #fff; box-sizing: border-box; box-shadow: 0 0 0 1px #ddd;
          display: flex; flex-direction: column;
        }
        .ws-page-body { flex: 1; }
        .ws-h1 { font-size: 30pt; line-height: 1.15; margin: 0 0 6pt; }
        .ws-h2 { font-size: 22pt; line-height: 1.2; margin: 0 0 8pt; border-bottom: 2px solid #000; padding-bottom: 4pt; }
        .ws-instruction { font-size: 15pt; margin: 0 0 14pt; }
        .ws-item { font-size: 18pt; line-height: 1.9; margin: 0 0 16pt; }
        .ws-num { font-weight: bold; margin-right: 8pt; }
        .ws-blank { display: inline-block; min-width: 1.6in; border-bottom: 1.5pt solid #000; }
        .ws-lines { margin-top: 10pt; }
        .ws-line { border-bottom: 1pt solid #666; height: 30pt; }
        .ws-note {
          border: 1.5pt solid #000; padding: 10pt 12pt; font-size: 12pt; font-family: system-ui, sans-serif;
          margin-top: 14pt; line-height: 1.45;
        }
        .ws-note strong { text-transform: uppercase; letter-spacing: 0.04em; font-size: 11pt; }
        .ws-foot {
          display: flex; justify-content: space-between; font-size: 9pt; color: #555;
          border-top: 0.5pt solid #999; padding-top: 6pt; margin-top: 12pt; font-family: system-ui, sans-serif;
        }
        .ws-pair-row { display: flex; gap: 0.5in; font-size: 22pt; padding: 10pt 0; border-bottom: 1pt dotted #999; }
        .ws-pair-row span { flex: 1; text-align: center; }
        .ws-cols { column-count: 2; column-gap: 0.5in; }
        .ws-key { font-family: system-ui, sans-serif; font-size: 12pt; line-height: 1.7; }
        .ws-cover-rule { border: 0; border-top: 3pt solid #000; margin: 14pt 0; }
        .ws-ladder { font-size: 13pt; font-family: system-ui, sans-serif; line-height: 1.5; }
        .ws-ladder li { margin-bottom: 9pt; }
        @media print {
          .ws-toolbar { display: none; }
          .ws-page { margin: 0; box-shadow: none; page-break-after: always; width: auto; min-height: auto; padding: 0; }
          .ws-page:last-child { page-break-after: auto; }
          @page { size: letter; margin: 0.7in; }
        }
      `}</style>

      <div className="ws-toolbar">
        <span>Home Practice Pack — {pack.sentences.reduce((n, s) => n + s.items.length, 0)} sentences · {pack.categories.length} word sprints · {pack.clues.length} riddles · {pack.pairs.length} listening pairs</span>
        <button type="button" onClick={() => window.print()}>Print / Save as PDF</button>
      </div>

      {/* Cover */}
      <Page footer="Free to print, copy, and share">
        <h1 className="ws-h1">Home Practice Pack</h1>
        <p style={{ fontSize: '16pt', margin: '0 0 4pt' }}>Speech and language practice after stroke</p>
        <hr className="ws-cover-rule" />
        <p style={{ fontSize: '14pt', lineHeight: 1.6 }}>
          These pages were built from the practice activities in NeuroRecover — an
          app one family made after a stroke, so practice could happen at the
          kitchen table between speech therapy sessions.
        </p>
        <p style={{ fontSize: '14pt', lineHeight: 1.6 }}>
          Use them in any order. Five minutes counts. Stop before frustration,
          not after it.
        </p>
        <div className="ws-note">
          <strong>Please note</strong>
          <br />
          These are practice activities, not medical treatment, and they do not
          replace care from a licensed speech-language pathologist. If speech
          changes are new or sudden, contact a doctor.
        </div>
        <p style={{ fontSize: '13pt', marginTop: '24pt' }}>
          Every section in this pack can also be played out loud, free, at{' '}
          <strong>{SITE}/free-aphasia-games</strong>
        </p>
      </Page>

      {/* Caregiver guide */}
      <Page footer="For the practice partner">
        <h2 className="ws-h2">How to help without giving the answer</h2>
        <p className="ws-instruction">
          Start at the top. Only move down a step when they stall. Each step
          gives a little more help — so they keep the part they can still do.
        </p>
        <ol className="ws-ladder">
          <li><strong>Wait 10 full seconds.</strong> Retrieval is slow before it is impossible. Silence is the most useful thing you can offer.</li>
          <li><strong>Point at the problem.</strong> “Something in there isn’t right — can you find it?”</li>
          <li><strong>Give the category.</strong> “It should be something you drive.”</li>
          <li><strong>Give the first sound.</strong> “It starts with wh…”</li>
          <li><strong>Offer a choice of two.</strong> “Is it a wheel or a window?”</li>
          <li><strong>Say it, then hand it back.</strong> “Wheel. Can you say the whole sentence?”</li>
        </ol>
        <div className="ws-note">
          <strong>Three rules that matter more than the exercises</strong>
          <br />
          1. A correct idea in the wrong words is still a success — credit it.
          <br />
          2. End every session on something they got right.
          <br />
          3. Short and often beats long and rare.
        </div>
      </Page>

      {/* Fix the sentence — by level */}
      {pack.sentences.map((block) =>
        block.items.map((item, i) =>
          i % 4 === 0 ? (
            <Page key={`s-${block.level}-${i}`} footer={`Fix the Sentence — Level ${block.level}`}>
              <h2 className="ws-h2">Fix the Sentence · Level {block.level}</h2>
              <p className="ws-instruction">{sentenceSection.instruction}</p>
              {block.items.slice(i, i + 4).map((it, j) => (
                <p className="ws-item" key={j}>
                  <span className="ws-num">{i + j + 1}.</span>
                  {it.sentence}
                  <br />
                  <span style={{ fontSize: '14pt' }}>The right word: </span>
                  <span className="ws-blank" />
                </p>
              ))}
              <div className="ws-note">
                <strong>Partner</strong>
                <br />
                {sentenceSection.partnerNote}
              </div>
            </Page>
          ) : null
        )
      )}

      {/* Word-finding sprints */}
      {pack.categories.map((c, i) => (
        <Page key={`c-${i}`} footer="Word-Finding Sprint">
          <h2 className="ws-h2">Word-Finding Sprint</h2>
          <p className="ws-instruction">{c.prompt} <em>({c.hint})</em></p>
          <WriteLines count={c.lines} />
          <div className="ws-note">
            <strong>Partner</strong>
            <br />
            {categorySection.partnerNote}
          </div>
        </Page>
      ))}

      {/* Two clues */}
      {pack.clues.map((_, i) =>
        i % 6 === 0 ? (
          <Page key={`q-${i}`} footer="Two Clues">
            <h2 className="ws-h2">Two Clues</h2>
            <p className="ws-instruction">{clueSection.instruction}</p>
            {pack.clues.slice(i, i + 6).map((c, j) => (
              <p className="ws-item" key={j}>
                <span className="ws-num">{i + j + 1}.</span>
                {c.clues.join('  ·  ')} <span className="ws-blank" />
              </p>
            ))}
            <div className="ws-note">
              <strong>Partner</strong>
              <br />
              {clueSection.partnerNote}
            </div>
          </Page>
        ) : null
      )}

      {/* Listening pairs */}
      {pack.pairs.map((_, i) =>
        i % 12 === 0 ? (
          <Page key={`p-${i}`} footer="Listening Pairs">
            <h2 className="ws-h2">Listening Pairs</h2>
            <p className="ws-instruction">{pairSection.instruction}</p>
            {pack.pairs.slice(i, i + 12).map((p, j) => (
              <div className="ws-pair-row" key={j}>
                <span>{p.word1}</span>
                <span>{p.word2}</span>
              </div>
            ))}
            <div className="ws-note">
              <strong>Partner</strong>
              <br />
              {pairSection.partnerNote}
            </div>
          </Page>
        ) : null
      )}

      {/* Progress tracker */}
      <Page footer="Progress tracker">
        <h2 className="ws-h2">Practice Log</h2>
        <p className="ws-instruction">
          Mark the days you practice. Any amount counts — the streak matters
          more than the length.
        </p>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13pt', fontFamily: 'system-ui, sans-serif' }}>
          <thead>
            <tr>
              {['Date', 'What we practiced', 'Minutes', 'Went well'].map((h) => (
                <th key={h} style={{ textAlign: 'left', borderBottom: '2pt solid #000', padding: '6pt 4pt' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 14 }).map((_, i) => (
              <tr key={i}>
                {Array.from({ length: 4 }).map((__, j) => (
                  <td key={j} style={{ borderBottom: '1pt solid #999', height: '34pt' }} />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </Page>

      {/* Answer key */}
      <Page footer="Answer key">
        <h2 className="ws-h2">Answer Key</h2>
        <div className="ws-key ws-cols">
          {pack.sentences.map((block) => (
            <div key={block.level} style={{ breakInside: 'avoid', marginBottom: '10pt' }}>
              <p style={{ fontWeight: 700, margin: '0 0 4pt' }}>Fix the Sentence · Level {block.level}</p>
              {block.items.map((it, i) => (
                <div key={i}>
                  {i + 1}. <strong>{it.answer}</strong>
                  {it.alternatives.length > 0 && <span> (also: {it.alternatives.join(', ')})</span>}
                </div>
              ))}
            </div>
          ))}
          <div style={{ breakInside: 'avoid' }}>
            <p style={{ fontWeight: 700, margin: '0 0 4pt' }}>Two Clues</p>
            {pack.clues.map((c, i) => (
              <div key={i}>
                {i + 1}. <strong>{c.answer}</strong>
                {c.alternatives.length > 0 && <span> (also: {c.alternatives.join(', ')})</span>}
              </div>
            ))}
          </div>
        </div>
        <div className="ws-note">
          <strong>Remember</strong>
          <br />
          Any answer that makes the sentence true is correct, even when it is not
          the one printed here. Reaching a different sensible word is successful
          word finding.
        </div>
      </Page>
    </div>
  );
}
