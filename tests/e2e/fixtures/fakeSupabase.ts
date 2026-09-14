/**
 * fakeSupabase — a request-level, in-memory Supabase for driving the REAL app
 * in a real browser with no network and no credentials.
 *
 * Why this exists. The anonSession fixture needs "Anonymous sign-ins" enabled
 * on the project, and even when it is, every run writes into the live
 * database. That leaves the product's central promises — the difficulty
 * changes while you play, the level you earn is the level you come back to,
 * a broken microphone never counts against you — unverifiable by automation
 * anywhere the toggle is off, and unrepeatable anywhere it is on.
 *
 * This fixture intercepts every request to the project's Supabase host and
 * answers it from an in-memory table store that speaks enough PostgREST
 * (filters, order, limit, upsert-on-conflict, single/maybeSingle, RPC) for the
 * SPA to boot signed in and run whole sessions. Everything the app writes —
 * exercise_events, adaptation_trial_logs, clinical_progression_state,
 * user_skill_mastery, sessions — lands in `backend.rows(table)` where a spec
 * can read it back as ground truth. Edge functions get deterministic canned
 * answers, so the speech path can be exercised without Azure.
 *
 * It is deliberately NOT a Supabase emulator: unsupported query shapes are
 * logged in `backend.unmatched` rather than guessed at, and a spec that finds
 * one there should extend this file, not paper over it.
 */
import {
  test as base,
  expect,
  type BrowserContext,
  type Page,
  type Route,
} from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export const SUPABASE_HOST = 'wjedbpjaiqdxhmjzkcxo.supabase.co';
const PROJECT_REF = SUPABASE_HOST.split('.')[0];
const STORAGE_KEY = `sb-${PROJECT_REF}-auth-token`;

/** Fixed identities so specs can assert on rows by id. */
export const USER_ID = '11111111-1111-4111-8111-111111111111';
export const PROFILE_ID = '22222222-2222-4222-8222-222222222222';
export const USER_EMAIL = 'offline-e2e@example.invalid';

type Row = Record<string, unknown>;
type Pred = (row: Row) => boolean;

export interface LoggedRequest {
  method: string;
  path: string;
  table: string | null;
  query: Record<string, string>;
  body: unknown;
  status: number;
}

export interface FakeBackendOptions {
  /** Rows to seed per table before the app boots. `profiles` gets a default patient. */
  seed?: Record<string, Row[]>;
  /** Override or extend the canned edge-function responses. */
  functions?: Record<string, (body: unknown) => { status?: number; json: unknown }>;
  /** Override RPC responses by name. */
  rpc?: Record<string, (args: unknown) => unknown>;
}

export interface FakeBackend {
  rows(table: string): Row[];
  seed(table: string, rows: Row[]): void;
  /** Every request the fake answered, in order. */
  log: LoggedRequest[];
  /** Requests the fake had no specific handling for (answered with an empty default). */
  unmatched: LoggedRequest[];
  /** Page errors captured from every page in the context. */
  pageErrors: string[];
  /**
   * Writes the fake refused the way Postgres would (CHECK constraint
   * violations). A real backend rejects these rows silently as far as the
   * patient is concerned — the telemetry hook retries, logs and moves on — so
   * the proof must fail loudly instead of passing on a row that never landed.
   */
  rejected: LoggedRequest[];
  /** Reset everything except the seeds — for "second session" scenarios use `rows` instead. */
  clearLog(): void;
}

// ─── JWT / session ───────────────────────────────────────────────────────────

function b64url(input: string): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=+$/, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function makeUser(nowIso: string) {
  return {
    id: USER_ID,
    aud: 'authenticated',
    role: 'authenticated',
    email: USER_EMAIL,
    email_confirmed_at: nowIso,
    phone: '',
    confirmed_at: nowIso,
    last_sign_in_at: nowIso,
    app_metadata: { provider: 'email', providers: ['email'] },
    user_metadata: { display_name: 'Offline E2E' },
    identities: [],
    created_at: nowIso,
    updated_at: nowIso,
    is_anonymous: false,
  };
}

/** A session supabase-js will accept from localStorage without a network call. */
export function makeSession(nowMs = Date.now()) {
  const iat = Math.floor(nowMs / 1000);
  const exp = iat + 60 * 60 * 24 * 365; // a year: never near the refresh margin
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = b64url(
    JSON.stringify({
      iss: `https://${SUPABASE_HOST}/auth/v1`,
      sub: USER_ID,
      aud: 'authenticated',
      exp,
      iat,
      email: USER_EMAIL,
      role: 'authenticated',
      aal: 'aal1',
      session_id: randomUUID(),
      is_anonymous: false,
    }),
  );
  const nowIso = new Date(nowMs).toISOString();
  return {
    access_token: `${header}.${payload}.offline-e2e-signature`,
    token_type: 'bearer',
    expires_in: exp - iat,
    expires_at: exp,
    refresh_token: 'offline-e2e-refresh',
    user: makeUser(nowIso),
  };
}

// ─── PostgREST filter parsing ────────────────────────────────────────────────

const RESERVED = new Set(['select', 'order', 'limit', 'offset', 'on_conflict', 'columns']);

function readColumn(row: Row, key: string): unknown {
  // `plan->>modality` / `summary->accuracy` — JSON path into a column.
  const parts = key.split(/->>|->/);
  let value: unknown = row[parts[0]];
  for (let i = 1; i < parts.length && value != null; i++) {
    value = (value as Record<string, unknown>)[parts[i]];
  }
  return value;
}

function coerce(value: string): unknown {
  if (value === 'null') return null;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return value;
}

function looseEq(a: unknown, b: string): boolean {
  if (a == null) return b === 'null';
  if (typeof a === 'number') return Number(b) === a;
  if (typeof a === 'boolean') return String(a) === b;
  return String(a) === b;
}

function compare(a: unknown, b: string): number {
  if (typeof a === 'number') return a - Number(b);
  return String(a) < b ? -1 : String(a) > b ? 1 : 0;
}

function splitTopLevel(expr: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = '';
  for (const ch of expr) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) {
      out.push(cur);
      cur = '';
      continue;
    }
    cur += ch;
  }
  if (cur) out.push(cur);
  return out;
}

function parseLeaf(col: string, opAndValue: string): Pred {
  let negate = false;
  let rest = opAndValue;
  if (rest.startsWith('not.')) {
    negate = true;
    rest = rest.slice(4);
  }
  const dot = rest.indexOf('.');
  const op = dot === -1 ? rest : rest.slice(0, dot);
  const raw = dot === -1 ? '' : rest.slice(dot + 1);
  let pred: Pred;
  switch (op) {
    case 'eq':
      pred = (r) => looseEq(readColumn(r, col), raw);
      break;
    case 'neq':
      pred = (r) => !looseEq(readColumn(r, col), raw);
      break;
    case 'gt':
      pred = (r) => readColumn(r, col) != null && compare(readColumn(r, col), raw) > 0;
      break;
    case 'gte':
      pred = (r) => readColumn(r, col) != null && compare(readColumn(r, col), raw) >= 0;
      break;
    case 'lt':
      pred = (r) => readColumn(r, col) != null && compare(readColumn(r, col), raw) < 0;
      break;
    case 'lte':
      pred = (r) => readColumn(r, col) != null && compare(readColumn(r, col), raw) <= 0;
      break;
    case 'is': {
      const want = coerce(raw);
      pred = (r) => {
        const v = readColumn(r, col);
        return want === null ? v == null : v === want;
      };
      break;
    }
    case 'in': {
      const list = raw
        .replace(/^\(/, '')
        .replace(/\)$/, '')
        .split(',')
        .map((s) => s.trim().replace(/^"(.*)"$/, '$1'));
      pred = (r) => list.some((v) => looseEq(readColumn(r, col), v));
      break;
    }
    case 'like':
    case 'ilike': {
      const re = new RegExp(
        '^' + raw.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/%/g, '.*') + '$',
        op === 'ilike' ? 'i' : '',
      );
      pred = (r) => re.test(String(readColumn(r, col) ?? ''));
      break;
    }
    case 'cs': // contains (arrays / json) — good enough for array columns
      pred = (r) => {
        const v = readColumn(r, col);
        const wanted = raw.replace(/^\{|\}$/g, '').split(',').filter(Boolean);
        return Array.isArray(v) && wanted.every((w) => v.map(String).includes(w));
      };
      break;
    default:
      pred = () => true;
  }
  return negate ? (r) => !pred(r) : pred;
}

function parseLogic(expr: string, mode: 'and' | 'or'): Pred {
  const inner = expr.replace(/^\(/, '').replace(/\)$/, '');
  const preds = splitTopLevel(inner).map((tok) => {
    if (tok.startsWith('and(')) return parseLogic(tok.slice(3), 'and');
    if (tok.startsWith('or(')) return parseLogic(tok.slice(2), 'or');
    if (tok.startsWith('not.and(')) {
      const p = parseLogic(tok.slice(7), 'and');
      return (r: Row) => !p(r);
    }
    if (tok.startsWith('not.or(')) {
      const p = parseLogic(tok.slice(6), 'or');
      return (r: Row) => !p(r);
    }
    const dot = tok.indexOf('.');
    return parseLeaf(tok.slice(0, dot), tok.slice(dot + 1));
  });
  return mode === 'and' ? (r) => preds.every((p) => p(r)) : (r) => preds.some((p) => p(r));
}

function buildPredicate(query: Record<string, string>): Pred {
  const preds: Pred[] = [];
  for (const [key, value] of Object.entries(query)) {
    if (RESERVED.has(key)) continue;
    if (key === 'or') preds.push(parseLogic(value, 'or'));
    else if (key === 'and') preds.push(parseLogic(value, 'and'));
    else preds.push(parseLeaf(key, value));
  }
  return (r) => preds.every((p) => p(r));
}

function applyOrder(rows: Row[], order: string | undefined): Row[] {
  if (!order) return rows;
  const terms = order.split(',').map((t) => {
    const [col, ...mods] = t.split('.');
    return { col, desc: mods.includes('desc'), nullsFirst: mods.includes('nullsfirst') };
  });
  return [...rows].sort((a, b) => {
    for (const t of terms) {
      const av = readColumn(a, t.col);
      const bv = readColumn(b, t.col);
      if (av == null && bv == null) continue;
      if (av == null) return t.nullsFirst ? -1 : 1;
      if (bv == null) return t.nullsFirst ? 1 : -1;
      const c = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv));
      if (c !== 0) return t.desc ? -c : c;
    }
    return 0;
  });
}

// ─── The fake ────────────────────────────────────────────────────────────────

function parsePrefer(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of (header ?? '').split(',')) {
    const [k, v] = part.trim().split('=');
    if (k) out[k] = v ?? '';
  }
  return out;
}

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': '*',
  'access-control-allow-methods': 'GET,POST,PATCH,PUT,DELETE,OPTIONS,HEAD',
  'access-control-expose-headers': 'Content-Range, X-Supabase-Api-Version',
};

function defaultProfile(nowIso: string): Row {
  return {
    id: PROFILE_ID,
    user_id: USER_ID,
    profile_kind: 'patient',
    is_active: true,
    profile_name: 'Offline Demo Patient',
    avatar_url: null,
    birthdate: null,
    stroke_date: null,
    profile_notes: null,
    care_account_id: null,
    clinical_profile: null,
    onboarding_completed: true,
    created_at: nowIso,
    updated_at: nowIso,
    profile_created_at: nowIso,
  };
}

/** Deterministic stand-ins for the speech services, keyed by function name. */
function defaultFunctions(): NonNullable<FakeBackendOptions['functions']> {
  return {
    'analyze-pronunciation': (body) => {
      const b = (body ?? {}) as Record<string, unknown>;
      const target = String(b.referenceText ?? b.targetWord ?? b.target ?? '');
      return {
        json: {
          ok: true,
          data: {
            transcript: target,
            pronunciationScore: 86,
            accuracyScore: 88,
            fluencyScore: 84,
            completenessScore: 100,
            prosodyScore: 80,
            words: target
              ? [{ word: target, accuracyScore: 88, errorType: 'None', phonemes: [] }]
              : [],
            duration: 1.1,
          },
        },
      };
    },
    'analyze-speech': () => ({ json: { ok: true, transcript: '', confidence: 0 } }),
    'compute-speech-profile': () => ({ json: { ok: true } }),
    'compute-adaptation-profile': () => ({ json: { ok: true } }),
    'calculate-learning-rates': () => ({ json: { ok: true } }),
    'predict-outcomes': () => ({ json: { ok: true } }),
    'get-embedding': () => ({ status: 503, json: { error: 'embeddings disabled in offline e2e' } }),
    'text-to-speech-stream': () => ({ status: 503, json: { error: 'tts disabled in offline e2e' } }),
  };
}

function defaultRpc(): NonNullable<FakeBackendOptions['rpc']> {
  return {
    get_resumable_session: () => null,
    close_stale_sessions: () => null,
    merge_profile_pref: () => null,
    switch_active_profile: () => null,
    telemetry_bucketed: () => [],
    get_cluster_assignments: () => [],
  };
}

// ─── Schema constraints the fake enforces ───────────────────────────────────
//
// The app writes validity labels the database only accepts if a migration
// added them to the CHECK constraint. Parse the allow-list from the migrations
// themselves (last definition wins) so a label the client invents without a
// migration is rejected here exactly as production would reject it.

const CONSTRAINED_TABLES = ['exercise_events', 'utterance_analyses'] as const;

function loadValidityLabelAllowLists(): Map<string, Set<string>> {
  const dir = resolve(process.cwd(), 'supabase/migrations');
  const files = readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  const out = new Map<string, Set<string>>();
  for (const tbl of CONSTRAINED_TABLES) {
    const constraint = `${tbl}_validity_label_chk`;
    let labels: Set<string> | null = null;
    for (const f of files) {
      const sql = readFileSync(resolve(dir, f), 'utf8');
      const re = new RegExp(`ADD CONSTRAINT\\s+${constraint}[\\s\\S]*?;`, 'g');
      for (const m of sql.matchAll(re)) {
        labels = new Set([...m[0].matchAll(/'([a-z_]+)'/g)].map((x) => x[1]));
      }
    }
    if (!labels || labels.size === 0) {
      throw new Error(`offline e2e: could not parse ${constraint} from supabase/migrations`);
    }
    out.set(tbl, labels);
  }
  return out;
}

const validityAllowLists = loadValidityLabelAllowLists();

/** Postgres-shaped error for a row the CHECK constraint would refuse, or null. */
function checkViolation(tbl: string, row: Row): { code: string; message: string; details: string; hint: null } | null {
  const allow = validityAllowLists.get(tbl);
  if (!allow) return null;
  const v = row.validity_label;
  if (v == null || allow.has(String(v))) return null;
  return {
    code: '23514',
    message: `new row for relation "${tbl}" violates check constraint "${tbl}_validity_label_chk"`,
    details: `Failing row contains validity_label=${String(v)}.`,
    hint: null,
  };
}

export async function installFakeSupabase(
  context: BrowserContext,
  options: FakeBackendOptions = {},
): Promise<FakeBackend> {
  const nowIso = new Date().toISOString();
  const store = new Map<string, Row[]>();
  const log: LoggedRequest[] = [];
  const unmatched: LoggedRequest[] = [];
  const pageErrors: string[] = [];
  const rejected: LoggedRequest[] = [];
  const functions = { ...defaultFunctions(), ...(options.functions ?? {}) };
  const rpc = { ...defaultRpc(), ...(options.rpc ?? {}) };

  const table = (name: string): Row[] => {
    if (!store.has(name)) store.set(name, []);
    return store.get(name)!;
  };
  table('profiles').push(defaultProfile(nowIso));
  for (const [name, rows] of Object.entries(options.seed ?? {})) {
    table(name).push(...rows.map((r) => ({ ...r })));
  }

  const session = makeSession();

  // Boot signed in: supabase-js reads this without a network round-trip.
  await context.addInitScript(
    ([key, value]) => {
      try {
        localStorage.setItem(key, value);
        localStorage.removeItem('offlineMode');
      } catch {
        /* ignore */
      }
    },
    [STORAGE_KEY, JSON.stringify(session)] as const,
  );

  context.on('page', (page) => {
    page.on('pageerror', (e) => pageErrors.push(e.message));
  });

  const respond = (
    route: Route,
    status: number,
    json: unknown,
    extraHeaders: Record<string, string> = {},
    entry?: LoggedRequest,
  ) => {
    if (entry) entry.status = status;
    return route.fulfill({
      status,
      headers: { 'content-type': 'application/json', ...CORS, ...extraHeaders },
      body: json === undefined ? '' : JSON.stringify(json),
    });
  };

  const handleRest = async (route: Route, url: URL, entry: LoggedRequest) => {
    const req = route.request();
    const method = req.method();
    const segments = url.pathname.replace(/^\/rest\/v1\//, '').split('/');
    const query = Object.fromEntries(url.searchParams.entries());
    entry.query = query;

    // RPC
    if (segments[0] === 'rpc') {
      const name = segments[1];
      const args = req.postDataJSON?.() ?? null;
      entry.body = args;
      if (name in rpc) return respond(route, 200, rpc[name](args), {}, entry);
      unmatched.push(entry);
      return respond(route, 200, null, {}, entry);
    }

    const name = segments[0];
    entry.table = name;
    const rows = table(name);
    const prefer = parsePrefer(req.headers()['prefer']);
    const wantsObject = (req.headers()['accept'] ?? '').includes('vnd.pgrst.object');
    const representation = prefer['return'] === 'representation' || method === 'GET';
    const pred = buildPredicate(query);

    const shape = (matched: Row[]) => {
      if (!wantsObject) return { status: 200, json: matched };
      if (matched.length === 1) return { status: 200, json: matched[0] };
      return {
        status: 406,
        json: {
          code: 'PGRST116',
          details: `The result contains ${matched.length} rows`,
          hint: null,
          message: 'JSON object requested, multiple (or no) rows returned',
        },
      };
    };

    if (method === 'GET' || method === 'HEAD') {
      let matched = applyOrder(rows.filter(pred), query.order);
      const total = matched.length;
      const range = req.headers()['range'];
      let from = Number(query.offset ?? 0);
      let to: number | null = query.limit != null ? from + Number(query.limit) - 1 : null;
      if (range) {
        const [a, b] = range.split('-').map(Number);
        from = a;
        to = Number.isFinite(b) ? b : null;
      }
      matched = matched.slice(from, to == null ? undefined : to + 1);
      const contentRange = matched.length
        ? `${from}-${from + matched.length - 1}/${total}`
        : `*/${total}`;
      const s = shape(matched);
      return respond(route, s.status, method === 'HEAD' ? undefined : s.json, { 'content-range': contentRange }, entry);
    }

    if (method === 'POST') {
      const body = req.postDataJSON?.();
      entry.body = body;
      const incoming: Row[] = Array.isArray(body) ? body : [body];
      const conflictCols = (query.on_conflict ?? '').split(',').filter(Boolean);
      const merge = prefer['resolution'] === 'merge-duplicates';
      const ignore = prefer['resolution'] === 'ignore-duplicates';
      // Postgres checks every row before any is written; one bad row fails the
      // whole statement.
      for (const raw of incoming) {
        const existing =
          conflictCols.length > 0
            ? rows.find((r) => conflictCols.every((c) => looseEq(r[c], String(raw[c]))))
            : undefined;
        const candidate = existing && merge ? { ...existing, ...raw } : raw;
        const violation = checkViolation(name, candidate);
        if (violation) {
          rejected.push(entry);
          return respond(route, 400, violation, {}, entry);
        }
      }
      const written: Row[] = [];
      for (const raw of incoming) {
        const row: Row = { ...raw };
        if (row.id == null) row.id = randomUUID();
        if (row.created_at == null) row.created_at = new Date().toISOString();
        const existing =
          conflictCols.length > 0
            ? rows.find((r) => conflictCols.every((c) => looseEq(r[c], String(row[c]))))
            : undefined;
        if (existing && ignore) {
          written.push(existing);
          continue;
        }
        if (existing && merge) {
          Object.assign(existing, row, { id: existing.id });
          written.push(existing);
          continue;
        }
        rows.push(row);
        written.push(row);
      }
      if (!representation) return respond(route, 201, undefined, {}, entry);
      const s = shape(written);
      return respond(route, s.status === 200 ? 201 : s.status, s.json, {}, entry);
    }

    if (method === 'PATCH') {
      const patch = req.postDataJSON?.() ?? {};
      entry.body = patch;
      const matched = rows.filter(pred);
      for (const r of matched) {
        const violation = checkViolation(name, { ...r, ...patch });
        if (violation) {
          rejected.push(entry);
          return respond(route, 400, violation, {}, entry);
        }
      }
      for (const r of matched) Object.assign(r, patch);
      if (!representation) return respond(route, 204, undefined, {}, entry);
      const s = shape(matched);
      return respond(route, s.status, s.json, {}, entry);
    }

    if (method === 'DELETE') {
      const matched = rows.filter(pred);
      store.set(
        name,
        rows.filter((r) => !matched.includes(r)),
      );
      if (!representation) return respond(route, 204, undefined, {}, entry);
      const s = shape(matched);
      return respond(route, s.status, s.json, {}, entry);
    }

    unmatched.push(entry);
    return respond(route, 405, { message: `offline e2e: ${method} not handled` }, {}, entry);
  };

  await context.route(
    (url) => url.hostname === SUPABASE_HOST,
    async (route) => {
      const req = route.request();
      const url = new URL(req.url());
      const entry: LoggedRequest = {
        method: req.method(),
        path: url.pathname,
        table: null,
        query: {},
        body: null,
        status: 0,
      };
      log.push(entry);

      if (req.method() === 'OPTIONS') return respond(route, 204, undefined, {}, entry);

      if (url.pathname.startsWith('/auth/v1/')) {
        const tail = url.pathname.replace('/auth/v1/', '');
        if (tail === 'user') return respond(route, 200, session.user, {}, entry);
        if (tail === 'token') return respond(route, 200, session, {}, entry);
        if (tail === 'logout') return respond(route, 204, undefined, {}, entry);
        unmatched.push(entry);
        return respond(route, 200, {}, {}, entry);
      }

      if (url.pathname.startsWith('/rest/v1/')) return handleRest(route, url, entry);

      if (url.pathname.startsWith('/functions/v1/')) {
        const name = url.pathname.replace('/functions/v1/', '').split('/')[0];
        const body = req.postDataJSON?.() ?? null;
        entry.body = body;
        const handler = functions[name];
        if (!handler) {
          unmatched.push(entry);
          return respond(route, 200, {}, {}, entry);
        }
        const r = handler(body);
        return respond(route, r.status ?? 200, r.json, {}, entry);
      }

      if (url.pathname.startsWith('/storage/v1/')) {
        if (req.method() === 'GET') return respond(route, 404, { error: 'not found' }, {}, entry);
        return respond(route, 200, { Key: url.pathname }, {}, entry);
      }

      unmatched.push(entry);
      return respond(route, 200, {}, {}, entry);
    },
  );

  // Keep the run hermetic: nothing else leaves the machine.
  await context.route(
    (url) => !['127.0.0.1', 'localhost'].includes(url.hostname) && url.hostname !== SUPABASE_HOST,
    (route) => route.abort('blockedbyclient'),
  );

  return {
    rows: (name) => table(name),
    seed: (name, extra) => {
      table(name).push(...extra.map((r) => ({ ...r })));
    },
    log,
    unmatched,
    pageErrors,
    rejected,
    clearLog: () => {
      log.length = 0;
      unmatched.length = 0;
    },
  };
}

// ─── Fixture ─────────────────────────────────────────────────────────────────

type OfflineFixtures = {
  backend: FakeBackend;
  /** A page that boots signed in against the in-memory backend. */
  offlinePage: Page;
};

export const test = base.extend<OfflineFixtures>({
  backend: async ({ context }, use) => {
    const backend = await installFakeSupabase(context);
    await use(backend);
  },
  offlinePage: async ({ context, backend }, use) => {
    void backend; // ordering: the routes and init script must exist before the page
    const page = await context.newPage();
    await use(page);
    await page.close();
  },
});

export { expect };
