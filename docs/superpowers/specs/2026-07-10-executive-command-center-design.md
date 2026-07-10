# Executive Command Center — Prototype v1 Design

**Date:** 2026-07-10
**Status:** Approved by user (pending written-spec review)

## 1. Purpose

A tool for music-industry executives: the Executive Command Center from the platform plan, overlaid with the methodology's executive lens (metric integrity checks, IP/asset protection, deal risk). This is the **first vertical slice** of the full 10-phase platform. It validates the executive experience before committing to a production stack.

## 2. Delivery Form

One **self-contained HTML file** (`executive-command-center.html`):

- No build step, no external network dependencies (CSP-safe, works offline, can be emailed).
- Vanilla JS, hash-based view router (`#/overview`, `#/approvals`, `#/roster`, `#/truthcheck`, `#/analytics`).
- One embedded `DATA` object acting as the mock database.
- Inline SVG for all charts.
- Dark, high-end dashboard aesthetic; status badges; risk colors. Responsive.

## 3. Mock Data Model

Embedded `DATA` object mirroring the platform plan's suggested entities so the prototype ports cleanly to a real backend later:

- `artists` — id, name, slug, genre, health summary, assigned executive.
- `releases` — id, title, type (single/EP/album/video/exclusive drop), primary artist, status (`draft` → `metadata_review` → `asset_review` → `splits_review` → `executive_review` → `approved` / `rejected` → `scheduled` → `live` → `archived`), release date, territories, UPC, completeness flags.
- `songs` — id, title, artist, ISRC, master owner, publishing owner, contract-on-file flags, asset checklist (WAV master, clean, instrumental, stems, artwork, lyric file…).
- `splits` — per-song contributors with role, percentage, approval status, agreement document flag.
- `metrics` — per-release reported streams, unique listeners, physical/repeat-purchase counts, shipment vs. verified sales, saves, playlist adds.
- `airplaySpins` — song, station, market, country, date, source type, detection method, estimated audience, confidence.
- `auditLog` — timestamped actions (approvals, rejections, rights changes).
- `users`/roles — enough to drive the role switcher (`executive`, `super_admin`, `manager`).

Data is crafted so every view has meaningful signal: some releases are clean, some carry deliberate risks (splits at 92%, missing ISRC, no producer agreement, suspicious metrics).

## 4. Layout

- **Left sidebar:** role-aware navigation (menu items shown/hidden by active role), product name, role switcher.
- **Top bar:** executive name, global search across artists/releases/songs.
- **Main area:** active view.
- **Audit-log drawer:** slide-out panel listing all recorded actions this session.

## 5. Views

### 5.1 Overview + Risk Alerts (`#/overview`)

- KPI cards: total artists, total releases, pending approvals, scheduled, live, revenue summary.
- **Risk Alerts feed** — each alert names the record and the seeded risk, e.g. "'Midnight' — missing ISRC, blocks distribution," "'Night Drive' — splits total 92%," "No signed producer agreement on file." Clicking an alert navigates to the relevant record/view.
- Recent uploads / recent activity strip.

### 5.2 Release Approval Queue (`#/approvals`)

- Releases in `executive_review`, each showing: completeness checklist (metadata / assets / splits / contracts), listed blockers, artist, type, target date.
- **Approve / Reject** buttons: update status in-memory, re-render, and append to the audit log. A release with hard blockers shows a warning before approval (approve-with-risk is allowed but logged as such — executives can override, the system just makes the risk explicit).

### 5.3 Roster + Rights/IP Protection (`#/roster`)

- Assigned-artist roster with catalog-health indicators (releases live/pending, open risks).
- Artist drill-down: their songs with
  - **Splits table** — auto-flags any song whose splits ≠ 100%; shows contributor approval status and agreement-document presence.
  - Master owner / publishing owner per song.
  - **Asset-Protection Scorecard** — grades each song on IP risk: owns masters? publishing retained? contracts on file? equity traded for a short-term advance? (the equity-trade lesson). Rendered as a letter-grade or 0–100 score with the failing factors listed.

### 5.4 Metric Truth-Check (`#/truthcheck`)

Per-release integrity checks of reported numbers:

- **Fan Equity vs. Access:** streaming "users" contrasted with real fan equity (physical purchases, repeat purchases) — conversion ratio surfaced.
- **Shipment vs. Scan:** reported shipped units vs. verified sales; gap highlighted.
- **"impossible-math" flag:** raised when numbers are internally inconsistent (e.g., verified sales exceed shipments, listeners exceed plausible stream ratios) with a plain-English explanation of why the math fails.
- Each release gets a truth-confidence badge (Verified / Questionable / impossible-math).

### 5.5 Analytics + Airplay (`#/analytics`) — stubbed charts

- Streams-over-time and fan-growth line/area charts (inline SVG, mock series).
- Fan-equity conversion bar chart (streams → saves → purchases funnel).
- **Airplay:** spins by song, by station, by market; table of recent spins with source type, detection method, and confidence clearly labeled (per platform plan Phase 9: never imply licensed BDS data).

## 6. Cross-Cutting Behavior

- **Role switcher:** `executive` sees assigned artists + approval queue; `manager` sees their artist projects without approve rights (buttons hidden/disabled); `super_admin` sees platform-wide data. Enforced in render logic only (prototype — no real auth).
- **Audit log:** approvals, rejections, and any simulated rights change append entries with timestamp, actor role, and action.
- All state is in-memory; refresh resets to seed data. This is acceptable and stated in the UI footer.

## 7. Branding / Language

Platform-safe naming per the platform plan: "Executive Command Center," "Catalog Vault," "Airplay Monitor," "Rights & Splits." No "BDS," no "Spotify clone," no Billboard/Luminate/Mediabase claims.

## 8. Out of Scope for v1 (later slices)

Real auth/RBAC enforcement, file upload/storage, public streaming player, release builder editing screens, airplay CSV import, distribution export, any backend or persistence. The mock data model intentionally mirrors the platform plan's entities so a later slice can swap `DATA` for API calls.

## 9. Testing / Acceptance

- File opens directly in a browser (double-click) with zero console errors and no network requests.
- All five views render; navigation, search, alert-click-through, and role switcher work.
- Approve/Reject transitions status, updates KPIs and queue, and logs to the audit drawer.
- Every seeded risk (92% splits, missing ISRC, missing contract, impossible-math metric) is visibly surfaced in at least one view.
- Splits ≠ 100% is always flagged wherever splits appear.
- Manager role cannot trigger approve/reject.

## 10. Future Slices (decomposition of the full platform)

1. **v1 (this spec):** Executive Command Center prototype, mock data.
2. Production stack bring-up (Next.js + Postgres/Supabase decision deferred) + real RBAC.
3. Catalog Asset Vault + uploads.
4. Release Builder workflow.
5. Rights/Splits with real documents.
6. Public streaming & sales layer.
7. Analytics event pipeline, Airplay import, Distribution export.
