import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import config from '../../../playwright.config';

describe('web Playwright server env loading', () => {
  it('starts the web server through the local env aware wrapper', () => {
    const [webServer] = Array.isArray(config.webServer)
      ? config.webServer
      : [config.webServer];

    expect(webServer?.command).toBe('sh ./test/e2e/start-e2e-server.sh');
  });

  it('uses .env.local as the only local env-file fallback', () => {
    const script = readFileSync(
      resolve(__dirname, '../../../test/e2e/start-e2e-server.sh'),
      'utf8'
    );

    expect(script).toContain('.env.local');
    expect(script).not.toContain('--env-file=.env ');
  });
});
