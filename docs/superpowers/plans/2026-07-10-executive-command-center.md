# Executive Command Center Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a single self-contained HTML prototype (`executive-command-center.html`) of the Executive Command Center for an independent music platform, per the spec at `docs/superpowers/specs/2026-07-10-executive-command-center-design.md`.

**Architecture:** Pure functions (data + logic) live in `src/*.js` ES modules and are unit-tested with Node's built-in test runner. A tiny build script (`build.js`) inlines data, logic, UI, and CSS into one HTML file from a shell template. The browser deliverable has zero imports, zero network requests. UI is vanilla JS with a hash router and HTML-string view renderers.

**Tech Stack:** Vanilla JS (ES2022), inline SVG/HTML charts, Node 20+ `node:test` for tests, no npm dependencies at all.

## Global Constraints

- Deliverable is ONE file: `executive-command-center.html` at repo root. Zero external requests — no CDN scripts, fonts, images, or `https://` URLs anywhere in the built file.
- No npm packages. Dev tooling is Node built-ins only (`node --test`, `node:fs`, `node:child_process`).
- NEVER use `alert()`, `confirm()`, or `prompt()` — risky approvals use an inline two-click confirm.
- Release statuses verbatim: `draft`, `metadata_review`, `asset_review`, `splits_review`, `executive_review`, `approved`, `scheduled`, `live`, `archived`, `rejected`.
- Roles in prototype: `executive`, `manager`, `super_admin`. Only executive and super_admin may approve/reject.
- Product language: "Executive Command Center", "Airplay Monitor", "Rights & Splits". Never "BDS", never "Spotify clone", no Billboard/Luminate/Mediabase claims.
- Dark theme, fixed palette (validated dark-surface values): page `#0d0d0d`, surface `#1a1a19`, ink `#ffffff`/`#c3c2b7`, muted `#898781`, grid `#2c2c2a`, series blue `#3987e5`, good `#0ca30c`, warning `#fab219`, serious `#ec835a`, critical `#d03b3b`.
- Run `node --test test/` after every code change; commit at the end of every task.
- All commits end with: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`

## File Structure

```
package.json                  — {"type":"module"}, test/build scripts
build.js                      — assembles executive-command-center.html from src/
src/shell.html                — HTML skeleton with /*INJECT:*/ markers
src/styles.css                — all styling (dark theme)
src/data.js                   — seedData(): the mock database (pure, no imports)
src/logic.js                  — pure business logic (no imports, no DOM)
src/ui.js                     — DOM rendering, router, events (browser-only, no imports/exports)
test/data.test.js             — seed data integrity
test/logic.test.js            — logic unit tests
test/build.test.js            — built file is self-contained
executive-command-center.html      — BUILT OUTPUT (committed)
```

---

### Task 1: Scaffolding + seed data module

**Files:**
- Create: `package.json`, `.gitignore`, `src/data.js`
- Test: `test/data.test.js`

**Interfaces:**
- Produces: `seedData(): object` — returns a **fresh** deep object each call with keys `users`, `artists`, `songs`, `releases`, `metrics`, `airplaySpins`, `trend`, `auditLog`. Later tasks rely on the exact ids and field names below.

- [ ] **Step 1: Create `package.json` and `.gitignore`**

`package.json`:

```json
{
  "name": "executive-command-center",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test test/",
    "build": "node build.js"
  }
}
```

`.gitignore`:

```
.DS_Store
```

- [ ] **Step 2: Write the failing test**

`test/data.test.js`:

```js
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
```

- [ ] **Step 3: Run test to verify it fails**

Run: `node --test test/`
Expected: FAIL — `Cannot find module '../src/data.js'`

- [ ] **Step 4: Write `src/data.js`**

```js
// Mock database for the prototype. Mirrors the planned platform entities so a
// later slice can swap this for API calls. seedData() must return a FRESH object
// every call (the UI mutates it; refresh resets).
export function seedData() {
  return {
    users: [
      { id: 'u-exec', name: 'A. Reeves', role: 'executive' },
      { id: 'u-mgr', name: 'J. Blake', role: 'manager', managedArtistIds: ['a1', 'a2'] },
      { id: 'u-admin', name: 'Platform Admin', role: 'super_admin' },
    ],
    artists: [
      { id: 'a1', name: 'Nova Reign', genre: 'R&B', executiveId: 'u-exec' },
      { id: 'a2', name: 'Rico Vale', genre: 'Hip-Hop', executiveId: 'u-exec' },
      { id: 'a3', name: 'The Marlowes', genre: 'Alt Soul', executiveId: 'u-exec' },
      { id: 'a4', name: 'DJ Cassius', genre: 'Electronic', executiveId: 'u-other' },
    ],
    songs: [
      { id: 's1', artistId: 'a1', title: 'First Light', isrc: 'US-ECC-26-00001',
        masterOwner: 'artist', publishingOwner: 'artist',
        producerAgreementOnFile: false, splitSheetOnFile: true, advanceTradedEquity: false,
        assets: { wavMaster: true, mp3Preview: true, artwork: true, lyricFile: true },
        splits: [
          { name: 'Nova Reign', role: 'artist', pct: 60, approved: true },
          { name: 'Beat Chemist', role: 'producer', pct: 25, approved: true },
          { name: 'J. Pen', role: 'writer', pct: 15, approved: true },
        ] },
      { id: 's2', artistId: 'a1', title: 'Undertow', isrc: 'US-ECC-26-00002',
        masterOwner: 'artist', publishingOwner: 'artist',
        producerAgreementOnFile: true, splitSheetOnFile: true, advanceTradedEquity: false,
        assets: { wavMaster: true, mp3Preview: true, artwork: true, lyricFile: true },
        splits: [
          { name: 'Nova Reign', role: 'artist', pct: 70, approved: true },
          { name: 'Beat Chemist', role: 'producer', pct: 30, approved: true },
        ] },
      { id: 's3', artistId: 'a2', title: 'Night Drive', isrc: 'US-ECC-26-00003',
        masterOwner: 'artist', publishingOwner: 'artist',
        producerAgreementOnFile: true, splitSheetOnFile: false, advanceTradedEquity: false,
        assets: { wavMaster: true, mp3Preview: true, artwork: true, lyricFile: false },
        splits: [
          { name: 'Rico Vale', role: 'artist', pct: 50, approved: true },
          { name: 'Track Marshal', role: 'producer', pct: 30, approved: true },
          { name: 'Lil Verse', role: 'writer', pct: 12, approved: false },
        ] },
      { id: 's4', artistId: 'a2', title: 'Fast Money', isrc: 'US-ECC-25-00090',
        masterOwner: 'label', publishingOwner: 'third_party',
        producerAgreementOnFile: true, splitSheetOnFile: true, advanceTradedEquity: true,
        assets: { wavMaster: true, mp3Preview: true, artwork: true, lyricFile: true },
        splits: [
          { name: 'Rico Vale', role: 'artist', pct: 40, approved: true },
          { name: 'D. Weaver', role: 'producer', pct: 40, approved: true },
          { name: 'Ghost Ink', role: 'writer', pct: 20, approved: true },
        ] },
      { id: 's5', artistId: 'a3', title: 'Midnight', isrc: '',
        masterOwner: 'artist', publishingOwner: 'artist',
        producerAgreementOnFile: true, splitSheetOnFile: true, advanceTradedEquity: false,
        assets: { wavMaster: true, mp3Preview: true, artwork: true, lyricFile: true },
        splits: [
          { name: 'The Marlowes', role: 'artist', pct: 80, approved: true },
          { name: 'Night Owl', role: 'producer', pct: 20, approved: true },
        ] },
      { id: 's6', artistId: 'a3', title: 'Second Wind', isrc: 'US-ECC-26-00006',
        masterOwner: 'artist', publishingOwner: 'artist',
        producerAgreementOnFile: true, splitSheetOnFile: true, advanceTradedEquity: false,
        assets: { wavMaster: true, mp3Preview: true, artwork: true, lyricFile: true },
        splits: [
          { name: 'The Marlowes', role: 'artist', pct: 75, approved: true },
          { name: 'Night Owl', role: 'producer', pct: 25, approved: true },
        ] },
      { id: 's7', artistId: 'a1', title: 'Horizon', isrc: 'US-ECC-26-00007',
        masterOwner: 'artist', publishingOwner: 'artist',
        producerAgreementOnFile: true, splitSheetOnFile: true, advanceTradedEquity: false,
        assets: { wavMaster: false, mp3Preview: true, artwork: true, lyricFile: true },
        splits: [
          { name: 'Nova Reign', role: 'artist', pct: 65, approved: true },
          { name: 'Beat Chemist', role: 'producer', pct: 35, approved: true },
        ] },
      { id: 's8', artistId: 'a4', title: 'Full Circle', isrc: 'US-ECC-25-00042',
        masterOwner: 'artist', publishingOwner: 'artist',
        producerAgreementOnFile: true, splitSheetOnFile: true, advanceTradedEquity: false,
        assets: { wavMaster: true, mp3Preview: true, artwork: true, lyricFile: true },
        splits: [
          { name: 'DJ Cassius', role: 'artist', pct: 100, approved: true },
        ] },
    ],
    releases: [
      { id: 'r1', title: 'First Light — Single', type: 'single', artistId: 'a1',
        status: 'executive_review', releaseDate: '2026-08-14', territories: ['Worldwide'],
        upc: '00602445001', songIds: ['s1'] },
      { id: 'r2', title: 'Night Drive — Single', type: 'single', artistId: 'a2',
        status: 'executive_review', releaseDate: '2026-08-01', territories: ['US', 'CA'],
        upc: '00602445002', songIds: ['s3'] },
      { id: 'r3', title: 'Midnight EP', type: 'ep', artistId: 'a3',
        status: 'executive_review', releaseDate: '2026-09-05', territories: ['Worldwide'],
        upc: '', songIds: ['s5', 's6'] },
      { id: 'r4', title: 'Undertow', type: 'single', artistId: 'a1',
        status: 'live', releaseDate: '2026-03-20', territories: ['Worldwide'],
        upc: '00602445004', songIds: ['s2'] },
      { id: 'r5', title: 'Fast Money', type: 'single', artistId: 'a2',
        status: 'live', releaseDate: '2025-11-07', territories: ['Worldwide'],
        upc: '00602445005', songIds: ['s4'] },
      { id: 'r6', title: 'Horizon', type: 'single', artistId: 'a1',
        status: 'asset_review', releaseDate: '2026-10-02', territories: ['Worldwide'],
        upc: '00602445006', songIds: ['s7'] },
      { id: 'r7', title: 'Full Circle LP', type: 'album', artistId: 'a4',
        status: 'scheduled', releaseDate: '2026-07-24', territories: ['Worldwide'],
        upc: '00602445007', songIds: ['s8'] },
    ],
    metrics: [
      { releaseId: 'r4', reportedStreams: 2400000, uniqueListeners: 610000,
        physicalSales: 8200, repeatPurchases: 1900, shippedUnits: 10000,
        verifiedSales: 9400, saves: 88000, playlistAdds: 12400, revenue: 41200 },
      { releaseId: 'r5', reportedStreams: 5100000, uniqueListeners: 890000,
        physicalSales: 320, repeatPurchases: 40, shippedUnits: 50000,
        verifiedSales: 61000, saves: 30100, playlistAdds: 9800, revenue: 18300 },
      { releaseId: 'r7', reportedStreams: 950000, uniqueListeners: 240000,
        physicalSales: 150, repeatPurchases: 12, shippedUnits: 20000,
        verifiedSales: 4100, saves: 8000, playlistAdds: 2100, revenue: 6900 },
    ],
    airplaySpins: [
      { songId: 's2', station: 'WQHT', market: 'New York', country: 'US', playedAt: '2026-07-06',
        sourceType: 'radio', detectionMethod: 'fingerprint', estAudience: 412000, confidence: 0.96 },
      { songId: 's2', station: 'KPWR', market: 'Los Angeles', country: 'US', playedAt: '2026-07-05',
        sourceType: 'radio', detectionMethod: 'fingerprint', estAudience: 380000, confidence: 0.94 },
      { songId: 's2', station: 'WGCI', market: 'Chicago', country: 'US', playedAt: '2026-07-05',
        sourceType: 'radio', detectionMethod: 'provider import', estAudience: 265000, confidence: 0.88 },
      { songId: 's4', station: 'WVEE', market: 'Atlanta', country: 'US', playedAt: '2026-07-04',
        sourceType: 'radio', detectionMethod: 'manual verification', estAudience: 240000, confidence: 0.75 },
      { songId: 's4', station: 'Shade 45', market: 'National', country: 'US', playedAt: '2026-07-03',
        sourceType: 'internet radio', detectionMethod: 'provider import', estAudience: 150000, confidence: 0.82 },
      { songId: 's2', station: 'WQHT', market: 'New York', country: 'US', playedAt: '2026-07-02',
        sourceType: 'radio', detectionMethod: 'fingerprint', estAudience: 405000, confidence: 0.97 },
      { songId: 's4', station: 'DJ Pool One', market: 'Southeast', country: 'US', playedAt: '2026-07-01',
        sourceType: 'DJ pool', detectionMethod: 'manual verification', estAudience: 60000, confidence: 0.6 },
      { songId: 's2', station: 'KBXX', market: 'Houston', country: 'US', playedAt: '2026-06-30',
        sourceType: 'radio', detectionMethod: 'fingerprint', estAudience: 210000, confidence: 0.93 },
    ],
    trend: [
      { label: 'Nov', value: 410000 }, { label: 'Dec', value: 520000 },
      { label: 'Jan', value: 480000 }, { label: 'Feb', value: 640000 },
      { label: 'Mar', value: 720000 }, { label: 'Apr', value: 690000 },
      { label: 'May', value: 810000 }, { label: 'Jun', value: 935000 },
    ],
    auditLog: [],
  };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `node --test test/`
Expected: PASS — 3 tests pass.

- [ ] **Step 6: Commit**

```bash
git add package.json .gitignore src/data.js test/data.test.js
git commit -m "feat: scaffold prototype and add seed data with seeded risk cases

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Logic — splits validation + asset-protection scorecard

**Files:**
- Create: `src/logic.js`
- Test: `test/logic.test.js` (create)

**Interfaces:**
- Consumes: song objects from `seedData()` (fields `splits[].pct`, `masterOwner`, `publishingOwner`, `producerAgreementOnFile`, `splitSheetOnFile`, `advanceTradedEquity`).
- Produces: `splitsTotal(song): number`, `splitsValid(song): boolean`, `assetProtection(song): { score: number, grade: 'A'|'B'|'C'|'D'|'F', issues: string[] }`.

- [ ] **Step 1: Write the failing tests**

`test/logic.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { seedData } from '../src/data.js';
import { splitsTotal, splitsValid, assetProtection } from '../src/logic.js';

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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test test/`
Expected: FAIL — `Cannot find module '../src/logic.js'`

- [ ] **Step 3: Write `src/logic.js`**

```js
// Pure business logic. No imports, no DOM — every function takes plain data.
// This file is inlined into the built HTML with `export ` stripped.

export function splitsTotal(song) {
  return song.splits.reduce((t, c) => t + c.pct, 0);
}

export function splitsValid(song) {
  return splitsTotal(song) === 100;
}

export function assetProtection(song) {
  const issues = [];
  let score = 100;
  if (song.masterOwner !== 'artist') { score -= 25; issues.push('Masters not owned by artist'); }
  if (song.publishingOwner !== 'artist') { score -= 25; issues.push('Publishing not retained'); }
  if (!song.producerAgreementOnFile) { score -= 15; issues.push('No producer agreement on file'); }
  if (!song.splitSheetOnFile) { score -= 10; issues.push('No split sheet on file'); }
  if (!splitsValid(song)) { score -= 15; issues.push(`Splits total ${splitsTotal(song)}%, not 100%`); }
  if (song.advanceTradedEquity) { score -= 10; issues.push('Equity traded for short-term advance'); }
  const grade = score >= 90 ? 'A' : score >= 75 ? 'B' : score >= 60 ? 'C' : score >= 40 ? 'D' : 'F';
  return { score, grade, issues };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test test/`
Expected: PASS — 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/logic.js test/logic.test.js
git commit -m "feat: add splits validation and asset-protection scorecard logic

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Logic — release completeness + metric truth-check

**Files:**
- Modify: `src/logic.js` (append)
- Test: `test/logic.test.js` (append)

**Interfaces:**
- Consumes: `splitsTotal`, `splitsValid` from Task 2; release objects (`songIds`, `upc`, `releaseDate`) and metric objects from Task 1.
- Produces:
  - `releaseCompleteness(release, songs): { metadata: boolean, assets: boolean, splits: boolean, contracts: boolean, blockers: string[] }`
  - `truthCheck(m): { flags: {level: 'fraud'|'questionable', text: string}[], fanEquity: number, verdict: 'verified'|'questionable'|'fraud' }`

- [ ] **Step 1: Append failing tests to `test/logic.test.js`**

First change the logic import line at the top of the file to:

```js
import { splitsTotal, splitsValid, assetProtection, releaseCompleteness, truthCheck } from '../src/logic.js';
```

Then append:

```js
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test test/`
Expected: FAIL — `does not provide an export named 'releaseCompleteness'`

- [ ] **Step 3: Append implementation to `src/logic.js`**

```js
export function releaseCompleteness(release, songs) {
  const tracks = release.songIds.map(id => songs.find(s => s.id === id));
  const blockers = [];

  const metadata = Boolean(release.upc) && Boolean(release.releaseDate) && tracks.every(t => Boolean(t.isrc));
  if (!release.upc) blockers.push('Missing UPC');
  if (!release.releaseDate) blockers.push('Missing release date');
  for (const t of tracks) if (!t.isrc) blockers.push(`Missing ISRC: "${t.title}"`);

  const assets = tracks.every(t => t.assets.wavMaster && t.assets.artwork);
  for (const t of tracks) {
    if (!t.assets.wavMaster) blockers.push(`Missing WAV master: "${t.title}"`);
    if (!t.assets.artwork) blockers.push(`Missing artwork: "${t.title}"`);
  }

  const splits = tracks.every(t => splitsValid(t) && t.splits.every(c => c.approved));
  for (const t of tracks) {
    if (!splitsValid(t)) blockers.push(`Splits total ${splitsTotal(t)}% on "${t.title}"`);
    for (const c of t.splits) if (!c.approved) blockers.push(`Split not approved by ${c.name}: "${t.title}"`);
  }

  const contracts = tracks.every(t => t.producerAgreementOnFile && t.splitSheetOnFile);
  for (const t of tracks) {
    if (!t.producerAgreementOnFile) blockers.push(`No producer agreement: "${t.title}"`);
    if (!t.splitSheetOnFile) blockers.push(`No split sheet: "${t.title}"`);
  }

  return { metadata, assets, splits, contracts, blockers };
}

// Metric integrity check.
export function truthCheck(m) {
  const flags = [];
  if (m.verifiedSales > m.shippedUnits) {
    flags.push({ level: 'fraud', text: `Verified sales (${m.verifiedSales.toLocaleString('en-US')}) exceed shipped units (${m.shippedUnits.toLocaleString('en-US')}) — the math is impossible.` });
  }
  if (m.uniqueListeners > m.reportedStreams) {
    flags.push({ level: 'fraud', text: 'More unique listeners than total streams — the math is impossible.' });
  }
  const fanEquity = m.uniqueListeners ? (m.physicalSales + m.repeatPurchases) / m.uniqueListeners : 0;
  if (fanEquity < 0.001) {
    flags.push({ level: 'questionable', text: `Fan-equity conversion is ${(fanEquity * 100).toFixed(3)}% — conversion from listeners to buyers is near zero.` });
  }
  const gap = m.shippedUnits ? (m.shippedUnits - m.verifiedSales) / m.shippedUnits : 0;
  if (gap > 0.5) {
    flags.push({ level: 'questionable', text: `${Math.round(gap * 100)}% of shipped units are unverified at retail — shipment is not sales.` });
  }
  const verdict = flags.some(f => f.level === 'fraud') ? 'fraud' : flags.length ? 'questionable' : 'verified';
  return { flags, fanEquity, verdict };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test test/`
Expected: PASS — 7 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/logic.js test/logic.test.js
git commit -m "feat: add release completeness and metric truth-check logic

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Logic — risk alerts, approval workflow, KPIs, role scoping

**Files:**
- Modify: `src/logic.js` (append)
- Test: `test/logic.test.js` (append)

**Interfaces:**
- Consumes: `releaseCompleteness`, `assetProtection`, `truthCheck` from Tasks 2–3.
- Produces:
  - `computeRiskAlerts(data): { severity: 'high'|'medium', message: string, view: string, targetId: string }[]`
  - `canDecide(role): boolean` — true for `'executive'` and `'super_admin'`
  - `decideRelease(data, releaseId, decision, actor): { ok: boolean, error?: string, withRisks?: number }` — `decision` is `'approve'|'reject'`; mutates status and unshifts onto `data.auditLog` entries of shape `{ at, actor, role, action }`
  - `kpis(data): { artists, releases, pendingApprovals, scheduled, live, revenue }`
  - `visibleArtists(data, user): artist[]`

- [ ] **Step 1: Append failing tests to `test/logic.test.js`**

Change the logic import line to:

```js
import { splitsTotal, splitsValid, assetProtection, releaseCompleteness, truthCheck, computeRiskAlerts, canDecide, decideRelease, kpis, visibleArtists } from '../src/logic.js';
```

Append:

```js
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test test/`
Expected: FAIL — `does not provide an export named 'canDecide'`

- [ ] **Step 3: Append implementation to `src/logic.js`**

```js
export function computeRiskAlerts(data) {
  const alerts = [];
  for (const release of data.releases) {
    if (['live', 'archived', 'rejected'].includes(release.status)) continue;
    const c = releaseCompleteness(release, data.songs);
    for (const b of c.blockers) {
      alerts.push({ severity: 'high', message: `"${release.title}" — ${b}`, view: 'approvals', targetId: release.id });
    }
  }
  for (const song of data.songs) {
    const ap = assetProtection(song);
    if (ap.grade === 'D' || ap.grade === 'F') {
      alerts.push({ severity: 'high', message: `"${song.title}" — IP protection grade ${ap.grade}: ${ap.issues.join('; ')}`, view: 'roster', targetId: song.artistId });
    }
  }
  for (const m of data.metrics) {
    const t = truthCheck(m);
    if (t.verdict === 'verified') continue;
    const release = data.releases.find(r => r.id === m.releaseId);
    alerts.push({
      severity: t.verdict === 'fraud' ? 'high' : 'medium',
      message: `"${release.title}" — metrics ${t.verdict === 'fraud' ? 'fail the integrity check' : 'look questionable'}`,
      view: 'truthcheck', targetId: m.releaseId,
    });
  }
  return alerts;
}

export function canDecide(role) {
  return role === 'executive' || role === 'super_admin';
}

export function decideRelease(data, releaseId, decision, actor) {
  if (!canDecide(actor.role)) return { ok: false, error: 'Role not permitted to approve or reject releases' };
  const release = data.releases.find(r => r.id === releaseId);
  if (!release || release.status !== 'executive_review') return { ok: false, error: 'Release is not awaiting executive review' };
  const c = releaseCompleteness(release, data.songs);
  release.status = decision === 'approve' ? 'approved' : 'rejected';
  const riskNote = decision === 'approve' && c.blockers.length ? ` WITH ${c.blockers.length} open risk(s)` : '';
  data.auditLog.unshift({
    at: new Date().toISOString(),
    actor: actor.name,
    role: actor.role,
    action: `${decision === 'approve' ? 'Approved' : 'Rejected'} "${release.title}"${riskNote}`,
  });
  return { ok: true, withRisks: c.blockers.length };
}

export function kpis(data) {
  return {
    artists: data.artists.length,
    releases: data.releases.length,
    pendingApprovals: data.releases.filter(r => r.status === 'executive_review').length,
    scheduled: data.releases.filter(r => r.status === 'scheduled').length,
    live: data.releases.filter(r => r.status === 'live').length,
    revenue: data.metrics.reduce((t, m) => t + m.revenue, 0),
  };
}

export function visibleArtists(data, user) {
  if (user.role === 'super_admin') return data.artists;
  if (user.role === 'executive') return data.artists.filter(a => a.executiveId === user.id);
  return data.artists.filter(a => (user.managedArtistIds || []).includes(a.id));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test test/`
Expected: PASS — 13 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/logic.js test/logic.test.js
git commit -m "feat: add risk alerts, approval workflow, KPIs, and role scoping

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: Shell, styles, and build pipeline

**Files:**
- Create: `src/shell.html`, `src/styles.css`, `src/ui.js` (staging stub — fully replaced in Task 6), `build.js`
- Test: `test/build.test.js`

**Interfaces:**
- Consumes: `src/data.js`, `src/logic.js` (inlined with `export ` stripped).
- Produces: `executive-command-center.html` at repo root; DOM ids the UI code relies on: `#app`, `#sidebar`, `#nav`, `#roleSwitch`, `#whoami`, `#search`, `#auditBtn`, `#view`, `#auditDrawer`, `#auditList`, `#foot`.

- [ ] **Step 1: Write the failing test**

`test/build.test.js`:

```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/`
Expected: FAIL — `Cannot find module ... build.js`

- [ ] **Step 3: Write `src/shell.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Executive Command Center</title>
<style>
/*INJECT:CSS*/
</style>
</head>
<body>
<div id="app">
  <aside id="sidebar">
    <div class="brand">ECC<span>Executive Command Center</span></div>
    <nav id="nav"></nav>
    <div class="role-box">
      <label for="roleSwitch">Viewing as</label>
      <select id="roleSwitch"></select>
    </div>
  </aside>
  <div id="main">
    <header id="topbar">
      <div id="whoami"></div>
      <input id="search" type="search" placeholder="Search artists, releases, songs…" autocomplete="off">
      <button id="auditBtn" class="btn" type="button" data-action="audit">Audit Log</button>
    </header>
    <main id="view"></main>
    <footer id="foot">Prototype — mock data only. Refresh resets to seed data.</footer>
  </div>
  <aside id="auditDrawer" hidden>
    <h2>Audit Log</h2>
    <ul id="auditList"></ul>
  </aside>
</div>
<script>
"use strict";
/*INJECT:DATA*/
/*INJECT:LOGIC*/
/*INJECT:UI*/
</script>
</body>
</html>
```

- [ ] **Step 4: Write `src/styles.css`**

```css
:root {
  --page: #0d0d0d; --surface: #1a1a19; --surface-2: #232322;
  --ink: #ffffff; --ink-2: #c3c2b7; --muted: #898781;
  --grid: #2c2c2a; --line: #383835; --border: rgba(255, 255, 255, 0.10);
  --series-1: #3987e5; --series-2: #199e70; --series-3: #c98500;
  --good: #0ca30c; --warning: #fab219; --serious: #ec835a; --critical: #d03b3b;
}
* { box-sizing: border-box; margin: 0; padding: 0; }
body { background: var(--page); color: var(--ink); font: 14px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif; }
#app { display: flex; min-height: 100vh; }
#sidebar { width: 232px; flex-shrink: 0; background: var(--surface); border-right: 1px solid var(--border); padding: 20px 14px; display: flex; flex-direction: column; gap: 18px; position: sticky; top: 0; height: 100vh; }
.brand { font-weight: 800; font-size: 20px; letter-spacing: 2px; }
.brand span { display: block; font-size: 11px; font-weight: 400; color: var(--muted); letter-spacing: 0.5px; margin-top: 2px; }
#nav { display: flex; flex-direction: column; gap: 2px; }
#nav a { color: var(--ink-2); text-decoration: none; padding: 9px 12px; border-radius: 8px; }
#nav a:hover { background: var(--surface-2); color: var(--ink); }
#nav a.active { background: var(--surface-2); color: var(--ink); font-weight: 600; box-shadow: inset 2px 0 0 var(--series-1); }
.role-box { margin-top: auto; }
.role-box label { font-size: 11px; color: var(--muted); display: block; margin-bottom: 4px; }
.role-box select { width: 100%; background: var(--surface-2); color: var(--ink); border: 1px solid var(--border); border-radius: 8px; padding: 8px; font: inherit; }
#main { flex: 1; display: flex; flex-direction: column; min-width: 0; }
#topbar { display: flex; align-items: center; gap: 14px; padding: 14px 24px; border-bottom: 1px solid var(--border); background: var(--surface); position: sticky; top: 0; z-index: 5; }
#whoami { font-weight: 600; white-space: nowrap; }
#search { flex: 1; max-width: 420px; background: var(--surface-2); border: 1px solid var(--border); color: var(--ink); border-radius: 8px; padding: 8px 12px; font: inherit; }
#view { padding: 24px; max-width: 1180px; width: 100%; }
#foot { margin-top: auto; padding: 12px 24px; color: var(--muted); font-size: 12px; border-top: 1px solid var(--border); }
h1 { font-size: 22px; margin-bottom: 14px; }
h2 { font-size: 16px; }
h3 { font-size: 15px; }
.card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 16px; margin-bottom: 14px; }
.card-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 6px; flex-wrap: wrap; }
.kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; margin-bottom: 18px; }
.kpi { margin-bottom: 0; }
.kpi-val { font-size: 24px; font-weight: 700; }
.kpi-label { color: var(--muted); font-size: 12px; }
.badge { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 11px; font-weight: 600; border: 1px solid var(--border); white-space: nowrap; }
.b-good { color: var(--good); }
.b-warn { color: var(--warning); }
.b-crit { color: var(--critical); }
.b-info { color: var(--series-1); }
.b-muted { color: var(--muted); }
.grade-A, .grade-B { color: var(--good); }
.grade-C { color: var(--warning); }
.grade-D, .grade-F { color: var(--critical); }
.alert { display: flex; gap: 10px; align-items: center; padding: 10px 12px; border: 1px solid var(--border); border-radius: 10px; margin-bottom: 8px; color: var(--ink-2); text-decoration: none; background: var(--surface); }
.alert:hover { background: var(--surface-2); }
.tbl { width: 100%; border-collapse: collapse; margin: 10px 0; }
.tbl th { text-align: left; color: var(--muted); font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; padding: 8px; border-bottom: 1px solid var(--line); }
.tbl td { padding: 8px; border-bottom: 1px solid var(--grid); }
.tbl .num { text-align: right; font-variant-numeric: tabular-nums; }
.row-bad td { background: rgba(208, 59, 59, 0.08); }
.btn { background: var(--surface-2); border: 1px solid var(--border); color: var(--ink); border-radius: 8px; padding: 8px 14px; cursor: pointer; font: inherit; }
.btn:hover { border-color: var(--muted); }
.btn-sm { padding: 4px 10px; font-size: 12px; }
.btn-good { border-color: var(--good); color: var(--good); }
.btn-crit { border-color: var(--critical); color: var(--critical); }
.btn-warn { border-color: var(--warning); color: var(--warning); }
.actions, .confirm-row { display: flex; gap: 10px; align-items: center; margin-top: 10px; flex-wrap: wrap; }
.checks { display: flex; gap: 6px; flex-wrap: wrap; margin: 8px 0; }
.blockers { margin: 8px 0 4px 18px; color: var(--ink-2); }
.blockers li { margin-bottom: 3px; }
.muted { color: var(--muted); }
.warn-text { color: var(--warning); }
.crit-text { color: var(--critical); }
.good-text { color: var(--good); }
.empty { color: var(--muted); padding: 18px 0; }
.stat-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 10px; margin: 10px 0; }
.stat-label { display: block; color: var(--muted); font-size: 11px; }
.stat-val { font-size: 16px; font-weight: 600; font-variant-numeric: tabular-nums; }
.scorecard { background: var(--surface-2); border-radius: 8px; padding: 10px 14px; margin-top: 8px; }
.scorecard ul { margin: 4px 0 0 18px; }
#auditDrawer { position: fixed; right: 0; top: 0; height: 100vh; width: 320px; background: var(--surface); border-left: 1px solid var(--border); padding: 20px; overflow-y: auto; z-index: 10; }
#auditDrawer h2 { margin-bottom: 10px; }
#auditList { list-style: none; }
#auditList li { padding: 8px 0; border-bottom: 1px solid var(--grid); font-size: 13px; }
svg { max-width: 100%; height: auto; display: block; }
.grid { stroke: var(--grid); stroke-width: 1; }
.tick { fill: var(--muted); font-size: 10px; }
.series-line { stroke: var(--series-1); stroke-width: 2; fill: none; }
.dot { fill: var(--series-1); }
.chart-row { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.hbar-row { display: grid; grid-template-columns: 110px 1fr 90px; gap: 10px; align-items: center; margin-bottom: 8px; }
.hbar-label { color: var(--ink-2); font-size: 12px; }
.hbar-track { background: var(--surface-2); border-radius: 4px; height: 14px; }
.hbar-fill { height: 100%; border-radius: 4px; background: var(--series-1); min-width: 2px; }
.hbar-val { text-align: right; font-variant-numeric: tabular-nums; font-size: 12px; color: var(--ink-2); }
@media (max-width: 900px) {
  .chart-row { grid-template-columns: 1fr; }
  #sidebar { display: none; }
}
```

- [ ] **Step 5: Write the staging stub `src/ui.js`**

This file is fully replaced in Task 6; the stub keeps the build green meanwhile.

```js
document.getElementById('view').innerHTML = '<h1>Overview</h1><p class="empty">UI loads in Task 6.</p>';
```

- [ ] **Step 6: Write `build.js`**

```js
import { readFileSync, writeFileSync } from 'node:fs';

const read = (p) => readFileSync(p, 'utf8');
const stripExports = (s) => s.replace(/^export /gm, '');

let html = read('src/shell.html');
const inject = (marker, content) => { html = html.replace(marker, () => content); };
inject('/*INJECT:CSS*/', read('src/styles.css'));
inject('/*INJECT:DATA*/', stripExports(read('src/data.js')));
inject('/*INJECT:LOGIC*/', stripExports(read('src/logic.js')));
inject('/*INJECT:UI*/', read('src/ui.js'));

writeFileSync('executive-command-center.html', html);
console.log(`Built executive-command-center.html (${(html.length / 1024).toFixed(1)} KB)`);
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `node --test test/`
Expected: PASS — 14 tests pass (build test included).

- [ ] **Step 8: Open in a browser and eyeball**

Run: `node build.js && open executive-command-center.html`
Expected: dark page, ECC sidebar, topbar with search and Audit Log button, "UI loads in Task 6." body, zero console errors.

- [ ] **Step 9: Commit**

```bash
git add src/shell.html src/styles.css src/ui.js build.js test/build.test.js executive-command-center.html
git commit -m "feat: add shell, dark theme styles, and single-file build pipeline

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 6: UI core + Overview view

**Files:**
- Modify: `src/ui.js` — replace the stub entirely with the code below
- Modify (rebuild): `executive-command-center.html`

**Interfaces:**
- Consumes (as in-scope globals in the built file): `seedData`, `kpis`, `computeRiskAlerts`, `visibleArtists`, plus DOM ids from Task 5.
- Produces (relied on by Tasks 7–10): state vars `data`, `currentUser`, `searchTerm`, `selectedArtistId`, `pendingConfirm`; helpers `fmt`, `money`, `esc`, `shortNum`, `flag`, `statusBadge`, `currentView`, `scopedData`, `render`; the `renderers` object mapping view id → renderer function; the `onClick` delegated handler.

- [ ] **Step 1: Replace `src/ui.js` with the full UI core**

```js
/* ---------- state ---------- */
let data = seedData();
let currentUser = data.users[0];        // default: the executive
let searchTerm = '';
let selectedArtistId = null;            // roster drill-down
let pendingConfirm = null;              // release id awaiting approve-with-risks confirm

const VIEWS = [
  { id: 'overview', label: 'Overview' },
  { id: 'approvals', label: 'Approval Queue' },
  { id: 'roster', label: 'Roster & Rights' },
  { id: 'truthcheck', label: 'Metric Truth-Check' },
  { id: 'analytics', label: 'Analytics & Airplay' },
];

/* ---------- helpers ---------- */
const fmt = new Intl.NumberFormat('en-US');
const money = (n) => '$' + fmt.format(n);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const shortNum = (v) => v >= 1e6 ? (v / 1e6).toFixed(1) + 'M' : v >= 1e3 ? Math.round(v / 1e3) + 'K' : String(Math.round(v));
const flag = (ok) => ok ? '<span class="badge b-good">on file</span>' : '<span class="badge b-crit">missing</span>';

const STATUS_CLASS = {
  live: 'b-good', approved: 'b-good', scheduled: 'b-info',
  executive_review: 'b-warn', splits_review: 'b-warn', asset_review: 'b-warn', metadata_review: 'b-warn',
  draft: 'b-muted', archived: 'b-muted', rejected: 'b-crit',
};
const statusBadge = (s) => `<span class="badge ${STATUS_CLASS[s] || 'b-muted'}">${s.replace(/_/g, ' ')}</span>`;

function currentView() {
  const id = location.hash.replace(/^#\//, '') || 'overview';
  return VIEWS.some(v => v.id === id) ? id : 'overview';
}

// Everything the active role is allowed to see.
function scopedData() {
  const artists = visibleArtists(data, currentUser);
  const artistIds = new Set(artists.map(a => a.id));
  const songs = data.songs.filter(s => artistIds.has(s.artistId));
  const songIds = new Set(songs.map(s => s.id));
  const releases = data.releases.filter(r => artistIds.has(r.artistId));
  const releaseIds = new Set(releases.map(r => r.id));
  return {
    artists, songs, releases,
    metrics: data.metrics.filter(m => releaseIds.has(m.releaseId)),
    airplaySpins: data.airplaySpins.filter(sp => songIds.has(sp.songId)),
    auditLog: data.auditLog,
  };
}

/* ---------- views ---------- */
function viewPlaceholder(title) {
  return `<h1>${title}</h1><p class="empty">View under construction.</p>`;
}

function viewOverview() {
  const sd = scopedData();
  const k = kpis(sd);
  const alerts = computeRiskAlerts(sd);
  const cards = [
    ['Artists', fmt.format(k.artists)],
    ['Releases', fmt.format(k.releases)],
    ['Pending approvals', fmt.format(k.pendingApprovals)],
    ['Scheduled', fmt.format(k.scheduled)],
    ['Live', fmt.format(k.live)],
    ['Revenue', money(k.revenue)],
  ].map(([label, val]) => `<div class="card kpi"><div class="kpi-val">${val}</div><div class="kpi-label">${label}</div></div>`).join('');

  const alertRows = alerts.length
    ? alerts.map(a => `<a class="alert" href="#/${a.view}" ${a.view === 'roster' ? `data-action="goto-artist" data-id="${a.targetId}"` : ''}>
        <span class="badge ${a.severity === 'high' ? 'b-crit' : 'b-warn'}">${a.severity}</span><span>${esc(a.message)}</span></a>`).join('')
    : '<p class="empty">No open risks.</p>';

  const recent = data.auditLog.slice(0, 5).map(a =>
    `<li>${esc(a.actor)} (${a.role.replace('_', ' ')}): ${esc(a.action)}</li>`).join('');

  return `<h1>Overview</h1>
    <div class="kpi-grid">${cards}</div>
    <div class="card"><h2>Risk Alerts</h2><p class="muted">Missing splits, ISRC, contracts, and metric fraud — surfaced, not buried.</p>${alertRows}</div>
    <div class="card"><h2>Recent actions</h2>${recent ? `<ul class="blockers">${recent}</ul>` : '<p class="empty">No actions yet this session.</p>'}</div>`;
}

function viewSearch() {
  const q = searchTerm.trim().toLowerCase();
  const sd = scopedData();
  const artists = sd.artists.filter(a => a.name.toLowerCase().includes(q));
  const songs = sd.songs.filter(s => s.title.toLowerCase().includes(q));
  const releases = sd.releases.filter(r => r.title.toLowerCase().includes(q));
  const section = (title, rows) => rows.length ? `<div class="card"><h2>${title}</h2>${rows.join('')}</div>` : '';
  return `<h1>Search: “${esc(searchTerm)}”</h1>
    ${section('Artists', artists.map(a => `<a class="alert" href="#/roster" data-action="goto-artist" data-id="${a.id}"><span>${esc(a.name)}</span><span class="muted">${esc(a.genre)}</span></a>`))}
    ${section('Releases', releases.map(r => `<a class="alert" href="#/roster" data-action="goto-artist" data-id="${r.artistId}"><span>${esc(r.title)}</span>${statusBadge(r.status)}</a>`))}
    ${section('Songs', songs.map(s => `<a class="alert" href="#/roster" data-action="goto-artist" data-id="${s.artistId}"><span>${esc(s.title)}</span><span class="muted">${esc(data.artists.find(a => a.id === s.artistId).name)}</span></a>`))}
    ${!artists.length && !songs.length && !releases.length ? '<p class="empty">Nothing in your scope matches.</p>' : ''}`;
}

const renderers = {
  overview: viewOverview,
  approvals: () => viewPlaceholder('Approval Queue'),
  roster: () => viewPlaceholder('Roster & Rights'),
  truthcheck: () => viewPlaceholder('Metric Truth-Check'),
  analytics: () => viewPlaceholder('Analytics & Airplay'),
};

/* ---------- rendering ---------- */
function renderNav() {
  document.getElementById('nav').innerHTML = VIEWS.map(v =>
    `<a href="#/${v.id}" class="${!searchTerm && currentView() === v.id ? 'active' : ''}">${v.label}</a>`).join('');
}

function renderTopbar() {
  document.getElementById('whoami').innerHTML =
    `${esc(currentUser.name)} <span class="badge b-info">${currentUser.role.replace('_', ' ')}</span>`;
}

function renderAudit() {
  document.getElementById('auditList').innerHTML = data.auditLog.length
    ? data.auditLog.map(a => `<li><span class="muted">${a.at.slice(0, 19).replace('T', ' ')}</span><br>${esc(a.actor)} (${a.role.replace('_', ' ')}): ${esc(a.action)}</li>`).join('')
    : '<li class="muted">No actions recorded this session.</li>';
}

function render() {
  renderNav();
  renderTopbar();
  renderAudit();
  document.getElementById('view').innerHTML = searchTerm.trim() ? viewSearch() : renderers[currentView()]();
}

/* ---------- events ---------- */
function onClick(e) {
  const t = e.target.closest('[data-action]');
  if (!t) return;
  const action = t.dataset.action;
  if (action === 'audit') {
    const d = document.getElementById('auditDrawer');
    d.hidden = !d.hidden;
  } else if (action === 'goto-artist') {
    e.preventDefault();
    selectedArtistId = t.dataset.id;
    if (currentView() !== 'roster' || searchTerm) {
      searchTerm = '';
      document.getElementById('search').value = '';
      if (location.hash !== '#/roster') { location.hash = '#/roster'; return; }
    }
    render();
  } else if (action === 'back') {
    selectedArtistId = null;
    render();
  }
}

function boot() {
  const roleSel = document.getElementById('roleSwitch');
  roleSel.innerHTML = data.users.map(u =>
    `<option value="${u.id}">${esc(u.name)} — ${u.role.replace('_', ' ')}</option>`).join('');
  roleSel.addEventListener('change', () => {
    currentUser = data.users.find(u => u.id === roleSel.value);
    selectedArtistId = null;
    pendingConfirm = null;
    render();
  });
  document.getElementById('search').addEventListener('input', (e) => {
    searchTerm = e.target.value;
    render();
  });
  window.addEventListener('hashchange', () => {
    searchTerm = '';
    document.getElementById('search').value = '';
    render();
  });
  document.addEventListener('click', onClick);
  render();
}

boot();
```

- [ ] **Step 2: Rebuild and run tests**

Run: `node --test test/ && node build.js`
Expected: 14 tests PASS; build succeeds.

- [ ] **Step 3: Browser smoke test**

Run: `open executive-command-center.html`
Verify, with zero console errors:
- Overview shows 6 KPI cards: Artists 3, Releases 6, Pending approvals 3, Scheduled 0, Live 2, Revenue $59,500 (executive scope — DJ Cassius excluded).
- Risk Alerts list includes the 92% splits, missing ISRC, missing producer agreement, IP grade D, and impossible-math entries.
- Switching role to Platform Admin changes KPIs to Artists 4 / Releases 7 / Scheduled 1 / Revenue $66,400; switching to J. Blake shows Artists 2.
- Typing "night" in search lists Night Drive song + release; clearing restores the view.
- Sidebar links switch views (other views show "View under construction").
- Audit Log button toggles the drawer ("No actions recorded this session.").

- [ ] **Step 4: Commit**

```bash
git add src/ui.js executive-command-center.html
git commit -m "feat: add UI core, router, role switcher, search, and Overview view

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 7: Release Approval Queue view

**Files:**
- Modify: `src/ui.js`
- Modify (rebuild): `executive-command-center.html`

**Interfaces:**
- Consumes: `releaseCompleteness`, `canDecide`, `decideRelease`, `statusBadge`, `pendingConfirm`, `scopedData`, `render`.
- Produces: `viewApprovals()`, `approvalCard(release, sd)`; new `onClick` actions `ask-confirm`, `cancel-confirm`, `decide`.

- [ ] **Step 1: Register the real renderer**

In `src/ui.js`, replace:

```js
  approvals: () => viewPlaceholder('Approval Queue'),
```

with:

```js
  approvals: viewApprovals,
```

- [ ] **Step 2: Add the view functions (below `viewSearch`)**

```js
function viewApprovals() {
  const sd = scopedData();
  const queue = sd.releases.filter(r => r.status === 'executive_review');
  const decided = sd.releases.filter(r => ['approved', 'rejected'].includes(r.status));
  const decidedRows = decided.map(r =>
    `<a class="alert" href="#/roster" data-action="goto-artist" data-id="${r.artistId}"><span>${esc(r.title)}</span>${statusBadge(r.status)}</a>`).join('');
  return `<h1>Approval Queue</h1>
    ${queue.length ? queue.map(r => approvalCard(r, sd)).join('') : '<p class="empty">Nothing awaiting executive review.</p>'}
    ${decided.length ? `<div class="card"><h2>Decided this session</h2>${decidedRows}</div>` : ''}`;
}

function approvalCard(r, sd) {
  const artist = data.artists.find(a => a.id === r.artistId);
  const c = releaseCompleteness(r, data.songs);
  const checks = [['Metadata', c.metadata], ['Assets', c.assets], ['Splits', c.splits], ['Contracts', c.contracts]]
    .map(([label, ok]) => `<span class="badge ${ok ? 'b-good' : 'b-crit'}">${ok ? '✓' : '✗'} ${label}</span>`).join(' ');
  const blockers = c.blockers.length
    ? `<ul class="blockers">${c.blockers.map(b => `<li>${esc(b)}</li>`).join('')}</ul>` : '';

  let actions;
  if (!canDecide(currentUser.role)) {
    actions = `<p class="muted">Viewing as ${currentUser.role.replace('_', ' ')} — approval decisions are reserved for executives.</p>`;
  } else if (pendingConfirm === r.id && c.blockers.length) {
    actions = `<div class="confirm-row">
      <span class="warn-text">Approving with ${c.blockers.length} open risk(s) — this will be logged.</span>
      <button class="btn btn-warn" data-action="decide" data-id="${r.id}" data-decision="approve">Confirm Approve</button>
      <button class="btn" data-action="cancel-confirm">Cancel</button></div>`;
  } else {
    actions = `<div class="actions">
      <button class="btn btn-good" data-action="${c.blockers.length ? 'ask-confirm' : 'decide'}" data-id="${r.id}" data-decision="approve">Approve</button>
      <button class="btn btn-crit" data-action="decide" data-id="${r.id}" data-decision="reject">Reject</button></div>`;
  }

  return `<div class="card">
    <div class="card-head"><h2>${esc(r.title)}</h2>${statusBadge(r.status)}</div>
    <p class="muted">${esc(artist.name)} · ${r.type} · target ${r.releaseDate} · ${r.territories.join(', ')}</p>
    <div class="checks">${checks}</div>${blockers}${actions}</div>`;
}
```

- [ ] **Step 3: Extend `onClick`**

In `onClick`, replace:

```js
  } else if (action === 'back') {
```

with:

```js
  } else if (action === 'ask-confirm') {
    pendingConfirm = t.dataset.id;
    render();
  } else if (action === 'cancel-confirm') {
    pendingConfirm = null;
    render();
  } else if (action === 'decide') {
    const res = decideRelease(data, t.dataset.id, t.dataset.decision, currentUser);
    pendingConfirm = null;
    if (res.ok) render();
  } else if (action === 'back') {
```

- [ ] **Step 4: Rebuild, test, smoke-test**

Run: `node --test test/ && node build.js && open executive-command-center.html`
Verify in the browser, zero console errors:
- Approval Queue lists 3 releases with check badges and blockers ("First Light — Single" ✗ Contracts; "Night Drive — Single" ✗ Splits + ✗ Contracts; "Midnight EP" ✗ Metadata).
- Clicking Approve on a risky release shows the inline "Confirm Approve" row (no browser dialog); Cancel restores buttons.
- Confirm Approve → card moves to "Decided this session" as `approved`; Overview "Pending approvals" drops; Audit Log drawer shows "Approved … WITH n open risk(s)".
- Reject moves a release to `rejected`.
- As J. Blake (manager), buttons are replaced by the "reserved for executives" note.

- [ ] **Step 5: Commit**

```bash
git add src/ui.js executive-command-center.html
git commit -m "feat: add release approval queue with risk-aware confirm and audit logging

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 8: Roster & Rights view

**Files:**
- Modify: `src/ui.js`
- Modify (rebuild): `executive-command-center.html`

**Interfaces:**
- Consumes: `assetProtection`, `splitsTotal`, `flag`, `selectedArtistId`, `scopedData`.
- Produces: `viewRoster()`, `artistDetail(artist, sd)`.

- [ ] **Step 1: Register the real renderer**

Replace:

```js
  roster: () => viewPlaceholder('Roster & Rights'),
```

with:

```js
  roster: viewRoster,
```

- [ ] **Step 2: Add the view functions (below `approvalCard`)**

```js
function viewRoster() {
  const sd = scopedData();
  if (selectedArtistId) {
    const artist = sd.artists.find(a => a.id === selectedArtistId);
    if (artist) return artistDetail(artist, sd);
    selectedArtistId = null; // out of scope for this role
  }
  const rows = sd.artists.map(a => {
    const releases = sd.releases.filter(r => r.artistId === a.id);
    const songs = sd.songs.filter(s => s.artistId === a.id);
    const openIssues = songs.reduce((n, s) => n + assetProtection(s).issues.length, 0);
    const pipeline = releases.filter(r => !['live', 'archived', 'rejected'].includes(r.status)).length;
    return `<tr>
      <td>${esc(a.name)}</td><td>${esc(a.genre)}</td>
      <td class="num">${releases.filter(r => r.status === 'live').length}</td>
      <td class="num">${pipeline}</td>
      <td>${openIssues ? `<span class="badge b-warn">${openIssues} open</span>` : '<span class="badge b-good">clear</span>'}</td>
      <td><button class="btn btn-sm" data-action="goto-artist" data-id="${a.id}">Open</button></td></tr>`;
  }).join('');
  return `<h1>Roster & Rights</h1>
    <table class="tbl"><thead><tr><th>Artist</th><th>Genre</th><th>Live</th><th>In pipeline</th><th>IP issues</th><th></th></tr></thead>
    <tbody>${rows}</tbody></table>`;
}

function artistDetail(artist, sd) {
  const songs = sd.songs.filter(s => s.artistId === artist.id);
  const cards = songs.map(s => {
    const ap = assetProtection(s);
    const total = splitsTotal(s);
    const splitRows = s.splits.map(c => `<tr>
      <td>${esc(c.name)}</td><td>${esc(c.role)}</td><td class="num">${c.pct}%</td>
      <td>${c.approved ? '<span class="badge b-good">approved</span>' : '<span class="badge b-warn">pending</span>'}</td></tr>`).join('');
    const totalRow = `<tr class="${total === 100 ? '' : 'row-bad'}">
      <td colspan="2"><strong>Total</strong></td><td class="num"><strong>${total}%</strong></td>
      <td>${total === 100 ? '' : '<span class="badge b-crit">must equal 100%</span>'}</td></tr>`;
    return `<div class="card">
      <div class="card-head"><h3>${esc(s.title)}</h3><span class="badge grade-${ap.grade}">IP grade ${ap.grade} · ${ap.score}/100</span></div>
      <p class="muted">ISRC: ${s.isrc ? esc(s.isrc) : '<span class="badge b-crit">missing</span>'} ·
        Master: ${esc(s.masterOwner)} · Publishing: ${esc(s.publishingOwner)}</p>
      <p class="muted">Producer agreement: ${flag(s.producerAgreementOnFile)} · Split sheet: ${flag(s.splitSheetOnFile)}</p>
      <table class="tbl"><thead><tr><th>Contributor</th><th>Role</th><th>Split</th><th>Status</th></tr></thead>
      <tbody>${splitRows}${totalRow}</tbody></table>
      ${ap.issues.length
        ? `<div class="scorecard"><strong>Asset-protection issues</strong><ul>${ap.issues.map(i => `<li>${esc(i)}</li>`).join('')}</ul></div>`
        : '<p class="good-text">Fully protected: masters, publishing, and paper all in order.</p>'}
    </div>`;
  }).join('');
  return `<button class="btn btn-sm" data-action="back">← Roster</button>
    <h1>${esc(artist.name)}</h1><p class="muted">${esc(artist.genre)}</p>${cards}`;
}
```

- [ ] **Step 3: Rebuild, test, smoke-test**

Run: `node --test test/ && node build.js && open executive-command-center.html`
Verify, zero console errors:
- Roster table lists 3 artists (executive view) with live/pipeline counts and IP-issue badges.
- Opening Rico Vale shows: Night Drive with red 92% total row + "must equal 100%" badge + pending approval for Lil Verse; Fast Money with IP grade D · 40/100 and all three asset-protection issues.
- Opening Nova Reign shows First Light's missing producer agreement and Undertow's "Fully protected" line.
- Overview risk alerts for roster items ("IP protection grade D") now jump straight into the Rico Vale detail page.
- The ← Roster button returns to the table.

- [ ] **Step 4: Commit**

```bash
git add src/ui.js executive-command-center.html
git commit -m "feat: add roster and rights view with splits table and IP scorecard

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 9: Metric Truth-Check view

**Files:**
- Modify: `src/ui.js`
- Modify (rebuild): `executive-command-center.html`

**Interfaces:**
- Consumes: `truthCheck`, `scopedData`, `fmt`, `esc`.
- Produces: `viewTruthcheck()`.

- [ ] **Step 1: Register the real renderer**

Replace:

```js
  truthcheck: () => viewPlaceholder('Metric Truth-Check'),
```

with:

```js
  truthcheck: viewTruthcheck,
```

- [ ] **Step 2: Add the view function (below `artistDetail`)**

```js
function viewTruthcheck() {
  const sd = scopedData();
  if (!sd.metrics.length) return '<h1>Metric Truth-Check</h1><p class="empty">No reported metrics in scope.</p>';
  const cards = sd.metrics.map(m => {
    const release = data.releases.find(r => r.id === m.releaseId);
    const t = truthCheck(m);
    const badge = t.verdict === 'verified' ? '<span class="badge b-good">Verified</span>'
      : t.verdict === 'questionable' ? '<span class="badge b-warn">Questionable</span>'
      : '<span class="badge b-crit">Impossible math</span>';
    const stats = [
      ['Reported streams', fmt.format(m.reportedStreams)],
      ['Unique listeners', fmt.format(m.uniqueListeners)],
      ['Physical + repeat purchases', fmt.format(m.physicalSales + m.repeatPurchases)],
      ['Fan-equity conversion', (t.fanEquity * 100).toFixed(2) + '%'],
      ['Shipped units', fmt.format(m.shippedUnits)],
      ['Verified sales', fmt.format(m.verifiedSales)],
    ].map(([label, val]) => `<div class="stat"><span class="stat-label">${label}</span><span class="stat-val">${val}</span></div>`).join('');
    const flags = t.flags.length
      ? `<ul class="blockers">${t.flags.map(f => `<li class="${f.level === 'fraud' ? 'crit-text' : 'warn-text'}">${esc(f.text)}</li>`).join('')}</ul>`
      : '<p class="good-text">Numbers are internally consistent and backed by real fan equity.</p>';
    return `<div class="card"><div class="card-head"><h2>${esc(release.title)}</h2>${badge}</div>
      <div class="stat-grid">${stats}</div>${flags}</div>`;
  }).join('');
  return `<h1>Metric Truth-Check</h1>
    <p class="muted">Every reported number is checked for internal consistency and real fan conversion.</p>
    ${cards}`;
}
```

- [ ] **Step 3: Rebuild, test, smoke-test**

Run: `node --test test/ && node build.js && open executive-command-center.html`
Verify, zero console errors:
- Executive view shows Undertow = Verified (green), Fast Money = impossible-math (red) with the impossible-sales flag text.
- Platform Admin also sees Full Circle LP = Questionable (amber) with two flags.
- The Overview metric alerts click through to this view.

- [ ] **Step 4: Commit**

```bash
git add src/ui.js executive-command-center.html
git commit -m "feat: add metric truth-check view with impossible-math fraud flags

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 10: Analytics & Airplay view (charts)

**Files:**
- Modify: `src/ui.js`
- Modify (rebuild): `executive-command-center.html`

**Interfaces:**
- Consumes: `scopedData`, `data.trend`, `fmt`, `esc`, `shortNum`; chart CSS classes `.grid`, `.tick`, `.series-line`, `.dot`, `.hbar-*` from Task 5.
- Produces: `lineChart({points, w, h, label})`, `barChartH({rows, label, color?})` (rows: `{label, value, color?}[]`), `viewAnalytics()`.

Chart rules honored: single hue per single-series chart (series blue), funnel uses one blue ordinal ramp (`#86b6ef` → `#3987e5` → `#1c5cab`), direct value labels on every bar, muted grid, no dual axes, `role="img"` + `aria-label`, native `<title>` tooltips on line points.

- [ ] **Step 1: Register the real renderer**

Replace:

```js
  analytics: () => viewPlaceholder('Analytics & Airplay'),
```

with:

```js
  analytics: viewAnalytics,
```

- [ ] **Step 2: Add chart helpers and the view (below `viewTruthcheck`)**

```js
function lineChart({ points, w = 640, h = 200, label }) {
  const pad = { l: 46, r: 12, t: 12, b: 24 };
  const max = Math.max(...points.map(p => p.value));
  const x = (i) => pad.l + (i * (w - pad.l - pad.r)) / (points.length - 1);
  const y = (v) => pad.t + (1 - v / max) * (h - pad.t - pad.b);
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
  const gridLines = [0, 0.5, 1].map(f => {
    const v = max * f;
    return `<line class="grid" x1="${pad.l}" x2="${w - pad.r}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}"/>
      <text class="tick" x="${pad.l - 6}" y="${(y(v) + 4).toFixed(1)}" text-anchor="end">${shortNum(v)}</text>`;
  }).join('');
  const dots = points.map((p, i) =>
    `<circle class="dot" cx="${x(i).toFixed(1)}" cy="${y(p.value).toFixed(1)}" r="3"><title>${esc(p.label)}: ${fmt.format(p.value)}</title></circle>`).join('');
  const xLabels = points.map((p, i) =>
    `<text class="tick" x="${x(i).toFixed(1)}" y="${h - 6}" text-anchor="middle">${esc(p.label)}</text>`).join('');
  return `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(label)}">${gridLines}<path class="series-line" d="${path}"/>${dots}${xLabels}</svg>`;
}

function barChartH({ rows, label, color = 'var(--series-1)' }) {
  const max = Math.max(...rows.map(r => r.value));
  const bars = rows.map(r => `<div class="hbar-row">
    <span class="hbar-label">${esc(r.label)}</span>
    <div class="hbar-track"><div class="hbar-fill" style="width:${(r.value / max * 100).toFixed(1)}%;background:${r.color || color}"></div></div>
    <span class="hbar-val">${fmt.format(r.value)}</span></div>`).join('');
  return `<div role="img" aria-label="${esc(label)}">${bars}</div>`;
}

function viewAnalytics() {
  const sd = scopedData();
  const streams = sd.metrics.reduce((t, m) => t + m.reportedStreams, 0);
  const saves = sd.metrics.reduce((t, m) => t + m.saves, 0);
  const purchases = sd.metrics.reduce((t, m) => t + m.physicalSales + m.repeatPurchases, 0);
  const funnel = barChartH({
    label: 'Fan-equity funnel: streams to saves to purchases',
    rows: [
      { label: 'Streams', value: streams, color: '#86b6ef' },
      { label: 'Saves', value: saves, color: '#3987e5' },
      { label: 'Purchases', value: purchases, color: '#1c5cab' },
    ],
  });
  const byStation = {};
  for (const sp of sd.airplaySpins) byStation[sp.station] = (byStation[sp.station] || 0) + 1;
  const stationRows = Object.entries(byStation)
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
  const spinRows = sd.airplaySpins.map(sp => {
    const song = data.songs.find(s => s.id === sp.songId);
    return `<tr><td>${esc(song.title)}</td><td>${esc(sp.station)}</td><td>${esc(sp.market)}</td>
      <td>${sp.playedAt}</td><td>${esc(sp.sourceType)}</td><td>${esc(sp.detectionMethod)}</td>
      <td class="num">${fmt.format(sp.estAudience)}</td><td class="num">${Math.round(sp.confidence * 100)}%</td></tr>`;
  }).join('');
  return `<h1>Analytics & Airplay Monitor</h1>
    <div class="card"><h2>Monthly streams — platform-wide (mock)</h2>
      ${lineChart({ points: data.trend, label: 'Monthly streams, trailing eight months' })}</div>
    <div class="chart-row">
      <div class="card"><h2>Fan-equity funnel</h2>
        <p class="muted">Conversion from access to ownership.</p>${funnel}</div>
      <div class="card"><h2>Spins by station</h2>
        ${stationRows.length ? barChartH({ label: 'Airplay spins by station', rows: stationRows }) : '<p class="empty">No spins in scope.</p>'}</div>
    </div>
    <div class="card"><h2>Recent spins</h2>
      <p class="muted">Source and detection method shown for every spin — no licensed-chart claims.</p>
      <table class="tbl"><thead><tr><th>Song</th><th>Station</th><th>Market</th><th>Date</th><th>Source</th><th>Detection</th><th>Est. audience</th><th>Confidence</th></tr></thead>
      <tbody>${spinRows}</tbody></table></div>`;
}
```

- [ ] **Step 3: Rebuild, test, smoke-test**

Run: `node --test test/ && node build.js && open executive-command-center.html`
Verify, zero console errors:
- Line chart renders 8 monthly points with y-axis ticks and hoverable point tooltips.
- Funnel shows the collapse from millions of streams to hundreds/thousands of purchases (tiny purchase bar is intentional — the label carries the value).
- Spins-by-station bars sorted descending; spins table shows source, detection, and confidence for every row.
- No layout overflow at a narrow window width (chart-row stacks).

- [ ] **Step 4: Commit**

```bash
git add src/ui.js executive-command-center.html
git commit -m "feat: add analytics and airplay monitor view with inline SVG charts

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 11: Final QA against the spec

**Files:**
- Modify: none expected (fixes only if QA fails)

- [ ] **Step 1: Full test suite + fresh build**

Run: `node --test test/ && node build.js`
Expected: all tests PASS; build succeeds.

- [ ] **Step 2: Self-containment audit**

Run: `grep -cE 'https?://' executive-command-center.html || echo CLEAN`
Expected: `CLEAN` (or `0`).

- [ ] **Step 3: Walk the spec's acceptance checklist (spec §9) in the browser**

Open `executive-command-center.html` and verify each item:
1. Opens by double-click; zero console errors; Network tab shows zero requests besides the file itself.
2. All five views render; nav, search, alert click-through, and role switcher work.
3. Approve/Reject transitions status, updates KPIs and queue, logs to the audit drawer.
4. Every seeded risk (92% splits, missing ISRC, missing producer agreement, missing WAV master, Fast Money IP grade D, impossible-math metrics) is visible in at least one view.
5. Splits ≠ 100% is flagged in both the roster splits table and the approval queue blockers.
6. As J. Blake (manager), approve/reject buttons never appear.
7. Refresh resets all decisions (footer states this).

- [ ] **Step 4: Fix anything that fails, re-run steps 1–3, then commit**

```bash
git add -A
git commit -m "chore: final QA pass for Executive Command Center prototype v1

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Plan Self-Review Notes

- Spec coverage: §2 delivery form → Tasks 5–6; §3 data model → Task 1; §5.1 → Task 6; §5.2 → Task 7; §5.3 → Task 8; §5.4 → Task 9; §5.5 → Task 10; §6 cross-cutting (roles, audit) → Tasks 4, 6, 7; §7 branding → copy inside Tasks 5–10; §9 acceptance → Task 11.
- Two-click confirm replaces `confirm()` (browser-dialog constraint).
- Executive-scope KPI check in Task 6 (`$59,500`, Artists 3) intentionally differs from the unscoped Task 4 unit test (`$66,400`, Artists 4): the view feeds `kpis()` scoped data.
