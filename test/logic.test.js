import test from 'node:test';
import assert from 'node:assert/strict';
import { seedData } from '../src/data.js';
import { splitsTotal, splitsValid, assetProtection, releaseCompleteness, truthCheck, computeRiskAlerts, canDecide, decideRelease, kpis, visibleArtists } from '../src/logic.js';

test('splitsTotal and splitsValid', () => {
  const d = seedData();
  assert.equal(splitsTotal(d.songs.find(s => s.id === 's3')), 92);
  assert.equal(splitsValid(d.songs.find(s => s.id === 's3')), false);
  assert.equal(splitsValid(d.songs.find(s => s.id === 's2')), true);
});

test('assetProtection grades songs on IP risk', () => {
  const d = seedData();
  const clean = assetProtection(d.songs.find(s => s.id === 's2'));
  assert.equal(clean.score, 100);
  assert.equal(clean.grade, 'A');
  assert.equal(clean.issues.length, 0);

  const fastMoney = assetProtection(d.songs.find(s => s.id === 's4'));
  assert.equal(fastMoney.score, 40); // -25 masters, -25 publishing, -10 advance-for-equity
  assert.equal(fastMoney.grade, 'D');
  assert.ok(fastMoney.issues.includes('Masters not owned by artist'));
  assert.ok(fastMoney.issues.includes('Publishing not retained'));
  assert.ok(fastMoney.issues.includes('Equity traded for short-term advance'));

  const nightDrive = assetProtection(d.songs.find(s => s.id === 's3'));
  assert.equal(nightDrive.score, 75); // -10 split sheet, -15 invalid splits
  assert.ok(nightDrive.issues.includes('Splits total 92%, not 100%'));
});

test('releaseCompleteness flags every blocker', () => {
  const d = seedData();
  const r3 = releaseCompleteness(d.releases.find(r => r.id === 'r3'), d.songs);
  assert.equal(r3.metadata, false);
  assert.ok(r3.blockers.includes('Missing UPC'));
  assert.ok(r3.blockers.includes('Missing ISRC: "Midnight"'));

  const r1 = releaseCompleteness(d.releases.find(r => r.id === 'r1'), d.songs);
  assert.equal(r1.metadata, true);
  assert.equal(r1.assets, true);
  assert.equal(r1.splits, true);
  assert.equal(r1.contracts, false);
  assert.ok(r1.blockers.includes('No producer agreement: "First Light"'));

  const r2 = releaseCompleteness(d.releases.find(r => r.id === 'r2'), d.songs);
  assert.equal(r2.splits, false);
  assert.ok(r2.blockers.includes('Splits total 92% on "Night Drive"'));
  assert.ok(r2.blockers.includes('Split not approved by Lil Verse: "Night Drive"'));
  assert.ok(r2.blockers.includes('No split sheet: "Night Drive"'));

  const r6 = releaseCompleteness(d.releases.find(r => r.id === 'r6'), d.songs);
  assert.equal(r6.assets, false);
  assert.ok(r6.blockers.includes('Missing WAV master: "Horizon"'));
});

test('truthCheck verdicts match the integrity lens', () => {
  const d = seedData();
  const by = id => d.metrics.find(m => m.releaseId === id);
  assert.equal(truthCheck(by('r4')).verdict, 'verified');
  assert.equal(truthCheck(by('r5')).verdict, 'fraud');
  assert.ok(truthCheck(by('r5')).flags.some(f => f.level === 'fraud'));
  assert.equal(truthCheck(by('r7')).verdict, 'questionable');
  assert.equal(truthCheck(by('r7')).flags.length, 2); // low fan equity + shipment gap
});

test('canDecide is restricted to executive and super_admin', () => {
  assert.equal(canDecide('executive'), true);
  assert.equal(canDecide('super_admin'), true);
  assert.equal(canDecide('manager'), false);
  assert.equal(canDecide('fan'), false);
});

test('decideRelease approves, rejects, and logs open risks', () => {
  const d = seedData();
  const exec = d.users.find(u => u.role === 'executive');
  const res = decideRelease(d, 'r2', 'approve', exec);
  assert.equal(res.ok, true);
  assert.ok(res.withRisks > 0);
  assert.equal(d.releases.find(r => r.id === 'r2').status, 'approved');
  assert.equal(d.auditLog.length, 1);
  assert.match(d.auditLog[0].action, /WITH \d+ open risk/);

  decideRelease(d, 'r3', 'reject', exec);
  assert.equal(d.releases.find(r => r.id === 'r3').status, 'rejected');
});

test('decideRelease blocks managers and non-review statuses', () => {
  const d = seedData();
  const mgr = d.users.find(u => u.role === 'manager');
  assert.equal(decideRelease(d, 'r2', 'approve', mgr).ok, false);
  const exec = d.users.find(u => u.role === 'executive');
  assert.equal(decideRelease(d, 'r4', 'approve', exec).ok, false); // already live
  assert.equal(d.auditLog.length, 0);
});

test('visibleArtists scopes by role', () => {
  const d = seedData();
  assert.equal(visibleArtists(d, d.users.find(u => u.role === 'executive')).length, 3);
  assert.equal(visibleArtists(d, d.users.find(u => u.role === 'super_admin')).length, 4);
  assert.equal(visibleArtists(d, d.users.find(u => u.role === 'manager')).length, 2);
});

test('kpis aggregate the catalog', () => {
  const k = kpis(seedData());
  assert.equal(k.artists, 4);
  assert.equal(k.releases, 7);
  assert.equal(k.pendingApprovals, 3);
  assert.equal(k.scheduled, 1);
  assert.equal(k.live, 2);
  assert.equal(k.revenue, 66400);
});

test('computeRiskAlerts surfaces every seeded risk class', () => {
  const alerts = computeRiskAlerts(seedData());
  const messages = alerts.map(a => a.message).join(' | ');
  assert.match(messages, /Missing ISRC: "Midnight"/);
  assert.match(messages, /Splits total 92%/);
  assert.match(messages, /No producer agreement/);
  assert.match(messages, /IP protection grade D/); // Fast Money
  assert.match(messages, /integrity check/); // Fast Money metrics
  assert.ok(alerts.every(a => ['high', 'medium'].includes(a.severity)));
});
