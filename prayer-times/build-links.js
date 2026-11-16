#!/usr/bin/env node
/**
 * build-links.js — writes a "Prayer times in nearby cities" block into every city page
 * (prayer-times/<slug>/index.html), between <!-- CITY-LINKS --> and <!-- /CITY-LINKS -->.
 * Idempotent. Lists the other cities in the same country, the country page when one exists,
 * and the nearest other cities by great-circle distance (computed from cities.json).
 *
 * Why: 43 city pages had only 1-2 internal links pointing at them (GSC audit 2026-11-16),
 * so Google discovered them slowly. Run after build.js / build-hubs.js:
 *   node compute-monthly.js && node build.js && node build-hubs.js && node build-links.js
 */
const fs = require('fs');
const path = require('path');
const CITIES = JSON.parse(fs.readFileSync(path.join(__dirname, 'cities.json'), 'utf8'));
const HUBS = { Pakistan: 'pakistan', 'Saudi Arabia': 'saudi-arabia', Indonesia: 'indonesia', Morocco: 'morocco', 'United Kingdom': 'united-kingdom', 'United States': 'united-states' };

const rad = (d) => (d * Math.PI) / 180;
function km(a, b) {
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * 6371 * Math.asin(Math.sqrt(h)));
}
const li = 'style="margin-bottom: 6px;"';

for (const c of CITIES) {
  const file = path.join(__dirname, c.slug, 'index.html');
  if (!fs.existsSync(file)) continue;
  const same = CITIES.filter((x) => x.country === c.country && x.slug !== c.slug);
  const near = CITIES.filter((x) => x.slug !== c.slug && x.country !== c.country)
    .map((x) => ({ x, d: km(c, x) })).sort((a, b) => a.d - b.d).slice(0, 4);
  const items = [];
  for (const x of same) items.push(`<li ${li}><a href="/prayer-times/${x.slug}/">Prayer times in ${x.city}</a> (${km(c, x).toLocaleString('en-US')} km away)</li>`);
  if (HUBS[c.country]) items.push(`<li ${li}><a href="/prayer-times/${HUBS[c.country]}/">All ${c.country} cities compared</a></li>`);
  for (const { x, d } of near) items.push(`<li ${li}><a href="/prayer-times/${x.slug}/">Prayer times in ${x.city}, ${x.country}</a> (${d.toLocaleString('en-US')} km away)</li>`);
  const block = `<!-- CITY-LINKS -->
<section style="margin: 0 auto; max-width: 800px; padding: 32px 20px 8px;">
    <h2 style="text-align: left; margin-bottom: 16px; font-size: 24px;">Prayer times in nearby cities</h2>
    <ul style="font-size: 16px; color: var(--text-muted); padding-left: 20px; margin: 0;">
        ${items.join('\n        ')}
    </ul>
    <p style="font-size: 14px; color: var(--text-muted); margin-top: 12px;"><a href="/prayer-times/">All ${CITIES.length} cities</a> · distances are straight-line between city centres.</p>
</section>
<!-- /CITY-LINKS -->`;
  let html = fs.readFileSync(file, 'utf8');
  const nl = html.includes('\r\n') ? '\r\n' : '\n';
  const b = block.replace(/\n/g, nl);
  if (html.includes('<!-- CITY-LINKS -->')) html = html.replace(/<!-- CITY-LINKS -->[\s\S]*?<!-- \/CITY-LINKS -->/, b);
  else {
    const at = html.indexOf('<section id="download"');
    if (at < 0) throw new Error(`no download section in ${c.slug}`);
    html = html.slice(0, at) + b + nl + nl + html.slice(at);
  }
  fs.writeFileSync(file, html, 'utf8');
}
console.log(`linked ${CITIES.length} city pages`);
