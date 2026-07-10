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
