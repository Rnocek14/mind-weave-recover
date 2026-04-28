/**
 * TypingFallbackBar — Reusable inline typing input that any speech-driven game
 * can mount when the mic fails or the patient prefers typing.
 *
 * Shared so we don't ship 5 different broken implementations.
 *
 * Usage:
 *   <TypingFallbackBar
 *     visible={useTyping}
 *     onSubmit={(text) => handlePatientResponse(text)}
 *     placeholder="Type your answer…"
 *   />
 *
 * Persists the user's preference in sessionStorage('preferTypingInput').
 */
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send } from 'lucide-react';

interface TypingFallbackBarProps {
  visible: boolean;
  onSubmit: (text: string) => void;
  placeholder?: string;
  buttonLabel?: string;
  /** Auto-clear input after submit (default true) */
  clearOnSubmit?: boolean;
  /** Multi-line input (uses Textarea-style sizing) */
  multiline?: boolean;
}

export function TypingFallbackBar({
  visible,
  onSubmit,
  placeholder = 'Type your answer…',
  buttonLabel = 'Send',
  clearOnSubmit = true,
  multiline = false,
}: TypingFallbackBarProps) {
  const [value, setValue] = useState('');
  if (!visible) return null;

  const submit = () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
    if (clearOnSubmit) setValue('');
  };

  return (
    <div className="flex flex-col gap-2 mt-3 p-3 rounded-lg bg-muted/40 border border-border">
      <div className="text-xs text-muted-foreground">Typing instead of speaking</div>
      <div className="flex gap-2">
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !multiline) {
              e.preventDefault();
              submit();
            }
          }}
          className="flex-1"
          autoFocus
        />
        <Button onClick={submit} disabled={!value.trim()} className="min-h-[44px]">
          <Send className="w-4 h-4 mr-1" />
          {buttonLabel}
        </Button>
      </div>
    </div>
  );
}

/** Helper: read the persisted typing preference. */
export function getPreferTyping(): boolean {
  try {
    return sessionStorage.getItem('preferTypingInput') === 'true';
  } catch {
    return false;
  }
}

/** Helper: persist the typing preference (used by toggle buttons). */
export function setPreferTyping(value: boolean) {
  try {
    sessionStorage.setItem('preferTypingInput', String(value));
  } catch {
    /* ignore */
  }
}
