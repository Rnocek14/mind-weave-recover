/**
 * Hospital release safeguard: the required "Regression gate" check refuses
 * merge when the isolated authenticated staging workflow has not passed on
 * THIS pull request head SHA. Workflow success without its actual game-entry
 * job success (e.g. skipped for a fork) is NOT clinical verification.
 *
 * Pure audit of GitHub Actions status: no credentials, patient content, or
 * backend writes. The caller supplies a read-only GITHUB_TOKEN.
 */
import { pathToFileURL } from 'node:url';

export const REQUIRED_WORKFLOW = 'NeuroSpark audit authenticated game-entry matrix';
export const REQUIRED_PATH = '.github/workflows/neurospark-audit-staging.yml';
export const REQUIRED_JOBS = [
  'Audited game readiness (chromium-desktop)',
  'Audited game readiness (mobile-safari)',
];

export function findExactStagingRun(runs, sha, headRef) {
  if (!Array.isArray(runs)) throw new Error('GitHub Actions returned no valid run list');
  const matching = runs.filter(run =>
    run.head_sha === sha
    && run.event === 'pull_request'
    && run.name === REQUIRED_WORKFLOW
    && run.path === REQUIRED_PATH
    && run.head_branch === headRef
  );
  return matching.sort((a, b) =>
    Number(b.run_number ?? 0) - Number(a.run_number ?? 0)
  )[0] ?? null;
}

export function assessStagingRun(run, jobs) {
  if (!run) return { state: 'pending', reason: 'No exact-head staging run yet' };
  if (run.status !== 'completed') {
    return { state: 'pending', reason: 'Staging run not completed' };
  }
  if (run.conclusion !== 'success') {
    return {
      state: 'failed',
      reason: 'Staging workflow ended without success',
    };
  }
  if (!Array.isArray(jobs)) {
    return { state: 'failed', reason: 'Staging job evidence unavailable' };
  }
  for (const requiredName of REQUIRED_JOBS) {
    const required = jobs.filter(job => job.name === requiredName);
    if (required.length !== 1 || required[0].status !== 'completed'
      || required[0].conclusion !== 'success') {
      return {
        state: 'failed',
        reason: 'Required authenticated desktop/mobile staging job not successful',
      };
    }
  }
  return { state: 'success', runId: run.id };
}

async function fetchJson(fetchImpl, url, token) {
  const response = await fetchImpl(url, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });
  if (!response.ok) {
    throw new Error(`GitHub staging gate API unavailable (HTTP ${response.status})`);
  }
  return response.json();
}

export async function waitForStagingEvidence({
  repo,
  headSha,
  headRef,
  token,
  fetchImpl = fetch,
  sleep = ms => new Promise(resolve => setTimeout(resolve, ms)),
  now = () => Date.now(),
  maxWaitMs = 15 * 60 * 1000,
  intervalMs = 12000,
  progress = () => {},
}) {
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo ?? '')
    || !/^[a-f0-9]{40}$/.test(headSha ?? '')
    || typeof headRef !== 'string' || headRef.length < 1 || headRef.length > 200
    || !token || typeof token !== 'string') {
    throw new Error('Exact PR head, repository and read-only Actions token required');
  }
  if (!Number.isFinite(maxWaitMs) || maxWaitMs < 0
    || !Number.isFinite(intervalMs) || intervalMs <= 0) {
    throw new Error('Invalid bounded staging gate wait');
  }

  const deadline = now() + maxWaitMs;
  while (true) {
    const runs = await fetchJson(fetchImpl,
      `https://api.github.com/repos/${repo}/actions/runs?head_sha=${headSha}&event=pull_request&per_page=100`,
      token);
    const run = findExactStagingRun(runs.workflow_runs, headSha, headRef);
    let jobs = null;
    if (run?.status === 'completed' && run.conclusion === 'success') {
      const response = await fetchJson(fetchImpl,
        `https://api.github.com/repos/${repo}/actions/runs/${run.id}/jobs?per_page=100`,
        token);
      jobs = response.jobs;
    }
    const result = assessStagingRun(run, jobs);
    if (result.state === 'success') {
      progress('Exact-head authenticated staging verification passed');
      return result;
    }
    if (result.state === 'failed') {
      throw new Error(`Clinical staging release gate blocked: ${result.reason}`);
    }
    if (now() >= deadline) {
      throw new Error('Clinical staging release gate timed out without a verified passing run');
    }
    progress('Awaiting required exact-head authenticated staging verification');
    await sleep(Math.min(intervalMs, deadline - now()));
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  waitForStagingEvidence({
    repo: process.env.GITHUB_REPOSITORY,
    headSha: process.env.PR_HEAD_SHA,
    headRef: process.env.PR_HEAD_REF,
    token: process.env.GITHUB_TOKEN,
    progress: message => console.log(message),
  }).catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
