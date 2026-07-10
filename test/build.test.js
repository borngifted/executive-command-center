import test from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

test('build produces a self-contained file', () => {
  execSync('node build.js');
  const html = readFileSync('executive-command-center.html', 'utf8');
  assert.ok(html.includes('<title>Executive Command Center</title>'));
  assert.ok(!/https?:\/\//.test(html), 'no external URLs anywhere');
  assert.ok(!/^\s*import /m.test(html), 'no module imports leak into the page');
  assert.ok(!/^export /m.test(html), 'export keywords stripped');
  assert.ok(html.includes('function seedData'), 'data inlined');
  assert.ok(html.includes('function decideRelease'), 'logic inlined');
});
