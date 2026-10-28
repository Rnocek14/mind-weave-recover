import { test as base, expect } from '@playwright/test';
import { isBlockedBackendRequest, resolveE2EEnvironment } from '../../../scripts/e2e-environment.mjs';

// Every browser spec uses this automatic fixture. It intercepts backend
// requests, including WebSockets, before the test opens a page.
export const test = base.extend<{ backendIsolation: void }>({
  backendIsolation: [async ({ context }, use) => {
    const settings = resolveE2EEnvironment();
    const blocked: string[] = [];
    await context.route('**/*', async (route) => {
      const url = new URL(route.request().url());
      if (isBlockedBackendRequest(url.href, settings)) {
        blocked.push(url.origin); // Do not capture query strings or auth tokens.
        await route.abort('blockedbyclient');
      } else if (settings.suite === 'public' && url.origin === settings.supabaseURL) {
        await route.fulfill({ status: 503, contentType: 'application/json', body: '{"message":"Public E2E has no backend"}' });
      } else {
        await route.continue();
      }
    });
    await context.routeWebSocket('**/*', (socket) => {
      const url = new URL(socket.url());
      url.protocol = url.protocol === 'wss:' ? 'https:' : 'http:';
      if (isBlockedBackendRequest(url.href, settings)) {
        blocked.push(url.origin);
        socket.close();
      } else if (settings.suite === 'public' && url.origin === settings.supabaseURL) {
        socket.close();
      } else {
        socket.connectToServer();
      }
    });
    await use();
    expect(blocked, 'An app request attempted to reach production or an unapproved Supabase backend').toEqual([]);
  }, { auto: true }],
});

export { expect };
export type { Page } from '@playwright/test';
