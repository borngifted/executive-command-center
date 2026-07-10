# Executive Command Center

A private dashboard for running an independent music catalog — approvals, rights, and honest numbers on one screen. Prototype v1, running entirely in the browser on sample data.

## Try it

- **Dashboard:** open `executive-command-center.html` (or the [live demo](https://borngifted.github.io/executive-command-center/executive-command-center.html))
- **Plain-English guide:** open `how-it-works.html` (or [read it online](https://borngifted.github.io/executive-command-center/how-it-works.html)) — written for non-technical partners

No install, no account, no network calls. The single HTML file can be emailed or opened from a USB stick.

## What it does

| Screen | Purpose |
|---|---|
| Overview | KPIs plus warning lights: missing paperwork, bad splits, suspicious numbers |
| Approvals | Releases stop for an executive signature; risky approvals need a second confirm and are logged |
| Artists & Rights | Per-song ownership, split tables that must total 100%, and an A–F IP-protection grade |
| Numbers Check | Flags impossible math (sales > shipments) and hollow metrics (millions of streams, no buyers) |
| Trends & Radio | Growth line, listener→buyer funnel, and radio spins with source labels |

A role switcher (executive / manager / admin) demonstrates access control: managers never see approve buttons. An audit drawer records every decision.

## Development

Zero dependencies. Node 20+ for tests and the build.

```bash
node --test      # 14 unit tests over the pure logic layer
node build.js    # inlines src/ into executive-command-center.html
```

Structure: `src/data.js` (sample catalog) · `src/logic.js` (pure business rules, unit-tested) · `src/ui.js` (rendering) · `src/shell.html` + `src/styles.css` (layout/theme) · `build.js` (assembles the single file).

The sample data is deliberately seeded with problems — a 92% split, a missing ISRC, an impossible sales report — so every feature demonstrates itself.

## Status

Prototype. Real auth, storage, uploads, and live data are the next slice; the screens and logic here are the blueprint for that build.
