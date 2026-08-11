/**
 * Smart Coach Lab — Isolated test harness for the Smart Coach system.
 * 
 * Three-panel layout: Setup + State | Conversation | Debug Inspector
 */

import React, { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { ChevronDown, RotateCcw, Download, Copy, Play, Zap, ShieldAlert, Flag } from 'lucide-react';
import { toast } from 'sonner';
import {
  createInitialCoachState,
  runCoachTurn,
  createArcState,
  type CoachState,
  type CoachMode,
  type TargetSkill,
  type CoachTurnResult,
} from '@/lib/smartCoach';
import { getSessionLogs, clearSessionLogs, exportLogsAsJson } from '@/lib/smartCoach/coachLogger';

// ─── Scenario Presets ────────────────────────────────────────
interface Preset {
  label: string;
  topic: string;
  subtopic?: string;
  targetSkill: TargetSkill;
  mode: CoachMode;
  supportLevel: 0 | 1 | 2 | 3;
  keywords: string;
}

const PRESETS: Preset[] = [
  { label: 'Food conversation', topic: 'food', targetSkill: 'sentence_expansion', mode: 'warmup', supportLevel: 0, keywords: 'food,eat,pizza,drink,meal' },
  { label: 'Hesitation test', topic: 'food', targetSkill: 'word_finding', mode: 'scaffold', supportLevel: 1, keywords: 'food,eat,cook,restaurant' },
  { label: 'Circumlocution test', topic: 'kitchen items', targetSkill: 'semantic_precision', mode: 'scaffold', supportLevel: 1, keywords: 'kitchen,spoon,fork,cup,plate' },
  { label: 'Off-topic drift', topic: 'daily routine', targetSkill: 'fluency', mode: 'expand', supportLevel: 0, keywords: 'morning,routine,wake,breakfast' },
  { label: 'High support recovery', topic: 'family', targetSkill: 'word_finding', mode: 'support', supportLevel: 3, keywords: 'family,mom,dad,brother,sister' },
];

const CANNED_UTTERANCES = [
  { label: '✅ Good answer', text: 'I like pepperoni pizza' },
  { label: '⏸ Hesitation', text: 'uh... I like...' },
  { label: '🔄 Circumlocution', text: 'the thing you eat with cheese on top' },
  { label: '✂️ Incomplete', text: 'I went to the...' },
  { label: '🚫 Off-topic', text: 'my dog is funny' },
  { label: '😶 Silence', text: '' },
];

// ─── Turn Record ─────────────────────────────────────────────
interface TurnRecord {
  index: number;
  userUtterance: string;
  result: CoachTurnResult;
  stateBefore: CoachState;
}

// ─── Component ───────────────────────────────────────────────
export default function SmartCoachLab() {
  // Setup state
  const [topic, setTopic] = useState('food');
  const [subtopic, setSubtopic] = useState('');
  const [targetSkill, setTargetSkill] = useState<TargetSkill>('sentence_expansion');
  const [startMode, setStartMode] = useState<CoachMode>('warmup');
  const [startSupport, setStartSupport] = useState<0 | 1 | 2 | 3>(0);
  const [maxTurns, setMaxTurns] = useState(8);
  const [keywords, setKeywords] = useState('food,eat,pizza,drink,meal');

  // Session state
  const [coachState, setCoachState] = useState<CoachState | null>(null);
  const [turns, setTurns] = useState<TurnRecord[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [userInput, setUserInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const isActive = coachState !== null;

  const startSession = useCallback(() => {
    clearSessionLogs();
    const state = createInitialCoachState({
      topic,
      topicKeywords: keywords.split(',').map(k => k.trim()).filter(Boolean),
      targetSkill,
    });
    // Apply overrides from setup
    const overriddenState: CoachState = {
      ...state,
      subtopic: subtopic || undefined,
      mode: startMode,
      supportLevel: startSupport,
    };
    setCoachState(overriddenState);
    setTurns([]);
    toast.success('Smart Coach session started');
  }, [topic, subtopic, keywords, targetSkill, startMode, startSupport]);

  const resetSession = useCallback(() => {
    setCoachState(null);
    setTurns([]);
    clearSessionLogs();
    toast.info('Session reset');
  }, []);

  const labArcRef = React.useRef(createArcState());

  const submitUtterance = useCallback(async (utterance: string) => {
    if (!coachState || isProcessing) return;
    setIsProcessing(true);

    const stateBefore = { ...coachState };
    try {
      const result = await runCoachTurn({
        state: coachState,
        userUtterance: utterance,
        maxTurns,
        arcState: labArcRef.current,
      });
      if (result.updatedArc) labArcRef.current = result.updatedArc;
      setCoachState(result.nextState);
      setTurns(prev => [...prev, { index: prev.length + 1, userUtterance: utterance, result, stateBefore }]);
    } catch (err) {
      console.error('[SmartCoachLab] Turn error:', err);
      toast.error('Turn failed — check console');
    } finally {
      setIsProcessing(false);
      setUserInput('');
      inputRef.current?.focus();
    }
  }, [coachState, isProcessing, maxTurns]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (userInput.trim() || userInput === '') submitUtterance(userInput);
  };

  const loadPreset = (preset: Preset) => {
    setTopic(preset.topic);
    setSubtopic(preset.subtopic || '');
    setTargetSkill(preset.targetSkill);
    setStartMode(preset.mode);
    setStartSupport(preset.supportLevel);
    setKeywords(preset.keywords);
    toast.info(`Loaded preset: ${preset.label}`);
  };

  const forceMode = (mode: CoachMode) => {
    if (!coachState) return;
    setCoachState({ ...coachState, mode });
    toast.info(`Forced mode → ${mode}`);
  };

  const adjustSupport = (delta: number) => {
    if (!coachState) return;
    const next = Math.max(0, Math.min(3, coachState.supportLevel + delta)) as 0 | 1 | 2 | 3;
    setCoachState({ ...coachState, supportLevel: next });
  };

  const exportLogs = () => {
    const json = exportLogsAsJson();
    navigator.clipboard.writeText(json);
    toast.success('Turn logs copied to clipboard');
  };

  const copyText = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied`);
  };

  return (
    <div className="min-h-dvh bg-background p-4">
      <div className="max-w-[1600px] mx-auto">
        <div className="flex items-center gap-3 mb-4">
          <h1 className="text-xl font-bold text-foreground">Smart Coach Lab</h1>
          <Badge variant="outline" className="text-xs">Isolated Test Harness</Badge>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr_400px] gap-4">
          {/* ════════ LEFT: Setup + Live State ════════ */}
          <div className="space-y-4">
            {/* Setup */}
            <Card>
              <CardHeader className="py-3 px-4"><CardTitle className="text-sm">Session Setup</CardTitle></CardHeader>
              <CardContent className="px-4 pb-4 space-y-3">
                {/* Presets */}
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Preset</label>
                  <div className="flex flex-wrap gap-1">
                    {PRESETS.map(p => (
                      <Button key={p.label} size="sm" variant="outline" className="text-xs h-7" onClick={() => loadPreset(p)}>
                        {p.label}
                      </Button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Topic</label>
                  <Input value={topic} onChange={e => setTopic(e.target.value)} className="h-8 text-sm" disabled={isActive} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Subtopic</label>
                  <Input value={subtopic} onChange={e => setSubtopic(e.target.value)} className="h-8 text-sm" placeholder="optional" disabled={isActive} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Target Skill</label>
                  <Select value={targetSkill} onValueChange={v => setTargetSkill(v as TargetSkill)} disabled={isActive}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="word_finding">word_finding</SelectItem>
                      <SelectItem value="sentence_expansion">sentence_expansion</SelectItem>
                      <SelectItem value="semantic_precision">semantic_precision</SelectItem>
                      <SelectItem value="fluency">fluency</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-muted-foreground">Start Mode</label>
                    <Select value={startMode} onValueChange={v => setStartMode(v as CoachMode)} disabled={isActive}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(['warmup', 'expand', 'scaffold', 'support', 'wrapup'] as CoachMode[]).map(m => (
                          <SelectItem key={m} value={m}>{m}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Support Lvl</label>
                    <Select value={String(startSupport)} onValueChange={v => setStartSupport(Number(v) as 0 | 1 | 2 | 3)} disabled={isActive}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {[0, 1, 2, 3].map(n => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Max Turns</label>
                  <Input type="number" value={maxTurns} onChange={e => setMaxTurns(Number(e.target.value))} className="h-8 text-sm" min={1} max={30} disabled={isActive} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Keywords (comma-separated)</label>
                  <Input value={keywords} onChange={e => setKeywords(e.target.value)} className="h-8 text-sm" disabled={isActive} />
                </div>
                <div className="flex gap-2 pt-1">
                  {!isActive ? (
                    <Button onClick={startSession} size="sm" className="flex-1"><Play className="w-3 h-3 mr-1" />Start</Button>
                  ) : (
                    <Button onClick={resetSession} size="sm" variant="destructive" className="flex-1"><RotateCcw className="w-3 h-3 mr-1" />Reset</Button>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Live State */}
            {coachState && (
              <Card>
                <CardHeader className="py-3 px-4"><CardTitle className="text-sm">Live State</CardTitle></CardHeader>
                <CardContent className="px-4 pb-4">
                  <div className="space-y-1.5 text-xs font-mono">
                    <StateRow label="topic" value={coachState.topic} />
                    {coachState.subtopic && <StateRow label="subtopic" value={coachState.subtopic} />}
                    <StateRow label="mode" value={<ModeBadge mode={coachState.mode} />} />
                    <StateRow label="supportLevel" value={<SupportBadge level={coachState.supportLevel} />} />
                    <StateRow label="turnCount" value={coachState.turnCount} />
                    <StateRow label="isStuck" value={coachState.isStuck ? '⚠️ true' : 'false'} />
                    <StateRow label="frustrationRisk" value={<FrustrationBadge risk={coachState.frustrationRisk} />} />
                    <StateRow label="targetSkill" value={coachState.targetSkill || '—'} />
                    <Separator className="my-2" />
                    <div className="text-muted-foreground">topicKeywords:</div>
                    <div className="flex flex-wrap gap-1">{coachState.topicKeywords.map(k => <Badge key={k} variant="secondary" className="text-[10px]">{k}</Badge>)}</div>
                    <div className="text-muted-foreground mt-1">establishedFacts ({coachState.establishedFacts.length}):</div>
                    {coachState.establishedFacts.length > 0 ? (
                      <div className="text-[10px] text-muted-foreground max-h-20 overflow-y-auto">{coachState.establishedFacts.map((f, i) => <div key={i}>• {f}</div>)}</div>
                    ) : <div className="text-[10px] text-muted-foreground">none yet</div>}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Test Actions */}
            {isActive && (
              <Card>
                <CardHeader className="py-3 px-4"><CardTitle className="text-sm">Actions</CardTitle></CardHeader>
                <CardContent className="px-4 pb-4 space-y-2">
                  <div className="flex gap-1 flex-wrap">
                    <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => forceMode('support')}><ShieldAlert className="w-3 h-3 mr-1" />Force Support</Button>
                    <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => forceMode('wrapup')}><Flag className="w-3 h-3 mr-1" />Force Wrapup</Button>
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline" className="text-xs h-7 flex-1" onClick={() => adjustSupport(1)}>Support +1</Button>
                    <Button size="sm" variant="outline" className="text-xs h-7 flex-1" onClick={() => adjustSupport(-1)}>Support −1</Button>
                  </div>
                  <Separator />
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline" className="text-xs h-7 flex-1" onClick={exportLogs}><Download className="w-3 h-3 mr-1" />Export Logs</Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* ════════ CENTER: Conversation ════════ */}
          <div className="flex flex-col">
            <Card className="flex-1 flex flex-col min-h-[600px]">
              <CardHeader className="py-3 px-4"><CardTitle className="text-sm">Conversation</CardTitle></CardHeader>
              <CardContent className="flex-1 flex flex-col px-4 pb-4">
                <ScrollArea className="flex-1 pr-2 mb-3">
                  <div className="space-y-3">
                    {!isActive && <p className="text-sm text-muted-foreground text-center py-8">Configure session and press Start</p>}
                    {turns.map((t) => (
                      <div key={t.index} className="space-y-2">
                        {/* User */}
                        <div className="flex justify-end">
                          <div className="bg-primary text-primary-foreground rounded-lg px-3 py-2 max-w-[80%] text-sm">
                            {t.userUtterance || <span className="italic opacity-70">(silence)</span>}
                          </div>
                        </div>
                        {/* Coach */}
                        <div className="flex justify-start gap-2 items-start">
                          <div className="bg-muted rounded-lg px-3 py-2 max-w-[80%] text-sm">
                            {t.result.output}
                          </div>
                          <div className="flex flex-col gap-0.5 pt-1">
                            <ModeBadge mode={t.result.nextState.mode} />
                            {t.result.usedFallback && <Badge variant="destructive" className="text-[9px] h-4">fallback</Badge>}
                          </div>
                        </div>
                      </div>
                    ))}
                    {isProcessing && <div className="text-sm text-muted-foreground animate-pulse text-center">Processing turn...</div>}
                  </div>
                </ScrollArea>

                {/* Canned utterances */}
                {isActive && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    {CANNED_UTTERANCES.map(c => (
                      <Button key={c.label} size="sm" variant="ghost" className="text-xs h-6 px-2" onClick={() => submitUtterance(c.text)} disabled={isProcessing}>
                        {c.label}
                      </Button>
                    ))}
                  </div>
                )}

                {/* Input */}
                <form onSubmit={handleSubmit} className="flex gap-2">
                  <Input
                    ref={inputRef}
                    value={userInput}
                    onChange={e => setUserInput(e.target.value)}
                    placeholder={isActive ? 'Type simulated utterance...' : 'Start a session first'}
                    disabled={!isActive || isProcessing}
                    className="text-sm"
                  />
                  <Button type="submit" size="sm" disabled={!isActive || isProcessing}>
                    <Zap className="w-3 h-3 mr-1" />Send
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>

          {/* ════════ RIGHT: Debug Inspector ════════ */}
          <div>
            <Card className="min-h-[600px]">
              <CardHeader className="py-3 px-4"><CardTitle className="text-sm">Turn Inspector ({turns.length} turns)</CardTitle></CardHeader>
              <CardContent className="px-4 pb-4">
                <ScrollArea className="h-[calc(100vh-180px)]">
                  {turns.length === 0 && <p className="text-xs text-muted-foreground text-center py-8">No turns yet</p>}
                  <div className="space-y-2">
                    {[...turns].reverse().map(t => (
                      <TurnInspectorCard key={t.index} turn={t} onCopy={copyText} />
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────

function StateRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-muted-foreground">{label}:</span>
      <span>{typeof value === 'string' || typeof value === 'number' ? value : value}</span>
    </div>
  );
}

function ModeBadge({ mode }: { mode: CoachMode }) {
  const colors: Record<CoachMode, string> = {
    warmup: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
    expand: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    scaffold: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
    support: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    transfer_bridge: 'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200',
    wrapup: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  };
  return <Badge className={`text-[9px] h-4 ${colors[mode]}`}>{mode}</Badge>;
}

function SupportBadge({ level }: { level: number }) {
  const colors = ['bg-green-100 text-green-800', 'bg-yellow-100 text-yellow-800', 'bg-orange-100 text-orange-800', 'bg-red-100 text-red-800'];
  return <Badge className={`text-[9px] h-4 ${colors[level]}`}>lvl {level}</Badge>;
}

function FrustrationBadge({ risk }: { risk: string }) {
  const c = risk === 'high' ? 'bg-red-100 text-red-800' : risk === 'medium' ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800';
  return <Badge className={`text-[9px] h-4 ${c}`}>{risk}</Badge>;
}

function TurnInspectorCard({ turn, onCopy }: { turn: TurnRecord; onCopy: (text: string, label: string) => void }) {
  const { result, stateBefore, userUtterance, index } = turn;
  const a = result.analysis;
  const v = result.validation;

  return (
    <Card className="border-border">
      <Collapsible>
        <CollapsibleTrigger className="w-full">
          <div className="flex items-center justify-between px-3 py-2 text-xs hover:bg-muted/50">
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold">#{index}</span>
              <ModeBadge mode={stateBefore.mode} />
              <span>→</span>
              <ModeBadge mode={result.nextState.mode} />
              {result.usedFallback && <Badge variant="destructive" className="text-[9px] h-4">fallback</Badge>}
              {!v.valid && <Badge variant="destructive" className="text-[9px] h-4">validation ✗</Badge>}
            </div>
            <ChevronDown className="w-3 h-3 text-muted-foreground" />
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-3 pb-3 space-y-3 text-xs">
            {/* Turn Meta */}
            <Section title="Turn Metadata">
              <KV label="Mode" value={`${stateBefore.mode} → ${result.nextState.mode}`} />
              <KV label="Support" value={`${stateBefore.supportLevel} → ${result.nextState.supportLevel}`} />
              <KV label="Turn" value={result.nextState.turnCount} />
            </Section>

            {/* Utterance Analysis */}
            <Section title="Utterance Analysis">
              <KV label="transcript" value={`"${a.transcript}"`} mono />
              <KV label="wordCount" value={a.wordCount} />
              <KV label="onTopic" value={a.onTopic ? '✅' : '❌'} />
              <KV label="semanticMatch" value={a.semanticMatch.toFixed(2)} />
              <KV label="confidence" value={a.confidence.toFixed(2)} />
              <KV label="likelyErrorType" value={<Badge variant="secondary" className="text-[9px]">{a.likelyErrorType}</Badge>} />
              <div className="flex flex-wrap gap-1 mt-1">
                {a.phonologicalApprox && <Badge variant="outline" className="text-[9px]">phonological</Badge>}
                {a.circumlocution && <Badge variant="outline" className="text-[9px]">circumlocution</Badge>}
                {a.incompleteThought && <Badge variant="outline" className="text-[9px]">incomplete</Badge>}
                {a.pauseDetected && <Badge variant="outline" className="text-[9px]">pause</Badge>}
                {a.hesitationDetected && <Badge variant="outline" className="text-[9px]">hesitation</Badge>}
              </div>
            </Section>

            {/* Cue Decision */}
            <Section title="Cue Decision">
              <KV label="cueType" value={<Badge className="text-[9px] bg-purple-100 text-purple-800">{result.cueDecision.cueType}</Badge>} />
              <KV label="rationale" value={result.cueDecision.rationale} />
            </Section>

            {/* Validation */}
            <Section title="Validation">
              <KV label="valid" value={v.valid ? '✅ passed' : '❌ failed'} />
              {v.reasons.length > 0 && (
                <div className="text-destructive font-mono text-[10px] mt-1">
                  {v.reasons.map((r, i) => <div key={i}>• {r}</div>)}
                </div>
              )}
            </Section>

            {/* Output */}
            <Section title="Output">
              {result.debugRawOutput && result.debugRawOutput !== result.output && (
                <div>
                  <span className="text-muted-foreground">raw:</span>
                  <div className="font-mono text-[10px] bg-destructive/10 rounded p-1 mt-0.5 text-destructive">{result.debugRawOutput}</div>
                </div>
              )}
              <div>
                <span className="text-muted-foreground">final:</span>
                <div className="font-mono text-[10px] bg-muted rounded p-1 mt-0.5">{result.output}</div>
              </div>
              <KV label="usedFallback" value={result.usedFallback ? '⚠️ yes' : 'no'} />
            </Section>

            {/* Prompt */}
            {result.debugPrompt && (
              <Section title="Prompt Sent">
                <div className="relative">
                  <pre className="font-mono text-[10px] bg-muted rounded p-2 max-h-32 overflow-y-auto whitespace-pre-wrap">{result.debugPrompt}</pre>
                  <Button size="sm" variant="ghost" className="absolute top-0 right-0 h-5 w-5 p-0" onClick={() => onCopy(result.debugPrompt!, 'Prompt')}>
                    <Copy className="w-3 h-3" />
                  </Button>
                </div>
              </Section>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="font-semibold text-muted-foreground mb-1 text-[10px] uppercase tracking-wider">{title}</div>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function KV({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex justify-between items-center gap-2">
      <span className="text-muted-foreground shrink-0">{label}:</span>
      <span className={mono ? 'font-mono text-[10px]' : ''}>{typeof value === 'string' || typeof value === 'number' ? String(value) : value}</span>
    </div>
  );
}
