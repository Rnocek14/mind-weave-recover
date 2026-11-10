/**
 * Hosted release-only negative authorization smoke.
 * No user sign-in, no real patient identifiers and no intentional mutations.
 * Only runs after Playwright's staging data attestation preflight succeeds.
 *
 * IMPORTANT: reject successful execution as an authorization failure, even if
 * the request returns no rows or a harmless value. PUBLIC/anon EXECUTE on an
 * elevated SECURITY DEFINER function is not a safe fallback.
 */
import { randomUUID } from 'node:crypto';
import { test, expect } from './fixtures/safeTest';
import { resolveE2EEnvironment } from '../../scripts/e2e-environment.mjs';

test('anonymous caller cannot invoke privileged admin/worker/session RPCs', async ({ request }) => {
  const settings = resolveE2EEnvironment();
  expect(settings.suite).toBe('staging');

  const denied = [
    // Nonexistent example.invalid email: cannot identify or grant a real user.
    { name: 'setup_admin_user',
      args: { admin_email: `unreachable-${randomUUID()}@example.invalid` } },
    // Zero batch size cannot lock or claim a real speech-analysis task.
    { name: 'claim_speech_analysis_jobs',
      args: { p_worker_id: 'synthetic-denied-check', p_batch_size: 0 } },
    // Random synthetic attempt cannot match an existing worker claim.
    { name: 'submit_speech_analysis_result',
      args: { p_attempt_id: randomUUID(), p_worker_id: 'synthetic-denied-check', p_success: false } },
    // Random session tests authorization rather than exposing a real patient.
    { name: 'get_session_summary',
      args: { p_session_id: randomUUID() } },
  ];

  for (const { name, args } of denied) {
    const response = await request.post(`${settings.supabaseURL}/rest/v1/rpc/${name}`, {
      data: args,
      headers: {
        apikey: settings.publishableKey,
        'Content-Type': 'application/json',
      },
      maxRedirects: 0,
      timeout: 20_000,
    });
    expect(
      [401, 403, 404],
      `${name} must reject an anonymous caller instead of executing as a definer`,
    ).toContain(response.status());
    // No returned body/patient content is retained in CI artifacts.
  }
});
