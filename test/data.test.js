import test from 'node:test';
import assert from 'node:assert/strict';
import { seedData } from '../src/data.js';

test('seedData returns a fresh object each call', () => {
  const a = seedData();
  const b = seedData();
  a.releases[0].status = 'approved';
  assert.equal(b.releases[0].status, 'executive_review');
});

test('all cross-references resolve', () => {
  const d = seedData();
  for (const s of d.songs) assert.ok(d.artists.some(a => a.id === s.artistId), `artist for ${s.id}`);
  for (const r of d.releases) {
    assert.ok(d.artists.some(a => a.id === r.artistId), `artist for ${r.id}`);
    for (const id of r.songIds) assert.ok(d.songs.some(s => s.id === id), `song ${id} in ${r.id}`);
  }
  for (const m of d.metrics) assert.ok(d.releases.some(r => r.id === m.releaseId));
  for (const sp of d.airplaySpins) assert.ok(d.songs.some(s => s.id === sp.songId));
});

test('seeded risk cases are present', () => {
  const d = seedData();
  const nightDrive = d.songs.find(s => s.title === 'Night Drive');
  assert.equal(nightDrive.splits.reduce((t, c) => t + c.pct, 0), 92);
  assert.equal(d.songs.find(s => s.title === 'Midnight').isrc, '');
  assert.equal(d.songs.find(s => s.title === 'First Light').producerAgreementOnFile, false);
  const fastMoney = d.metrics.find(m => m.releaseId === 'r5');
  assert.ok(fastMoney.verifiedSales > fastMoney.shippedUnits, 'impossible-math case seeded');
});
