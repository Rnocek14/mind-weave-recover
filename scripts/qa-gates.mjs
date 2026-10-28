/** Fail closed on GitHub job results. No network access or credentials required. */
import { pathToFileURL } from 'node:url';

export function assertJobsPassed(needs, required) {
  if (!needs || typeof needs !== 'object' || Array.isArray(needs)) {
    throw new Error('QA gate requires a job-results object.');
  }
  if (!Array.isArray(required) || !required.length
    || required.some((id) => typeof id !== 'string' || !/^[a-z][a-z0-9_-]*$/.test(id))
    || new Set(required).size !== required.length) {
    throw new Error('QA gate requires explicit, unique job IDs.');
  }
  const blocked = required.filter((id) => !Object.hasOwn(needs, id)
    || needs[id]?.result !== 'success');
  if (blocked.length) throw new Error(`QA gate blocked: ${blocked.join(', ')} did not complete successfully.`);
  return { passed: true, required: [...required] };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const results = JSON.parse(process.env.QA_JOB_RESULTS ?? 'null');
    const verified = assertJobsPassed(results, process.argv.slice(2));
    console.log(`QA gate passed: ${verified.required.join(', ')}`);
  } catch (error) {
    // Never echo the supplied JSON: workflow contexts may contain sensitive data.
    console.error(error instanceof SyntaxError ? 'QA gate received invalid JSON.' : error.message);
    process.exitCode = 1;
  }
}
