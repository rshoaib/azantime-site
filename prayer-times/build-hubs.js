#!/usr/bin/env node
/**
 * build-hubs.js — writes a computed city-comparison block into each country
 * hub page (prayer-times/<country>/index.html), between the markers
 * <!-- HUB-DATA --> and <!-- /HUB-DATA -->. Idempotent: re-running replaces the
 * block. Data comes from cities.json (run compute-monthly.js first).
 *
 * Usage:  node compute-monthly.js && node build.js && node build-hubs.js
 */
const fs = require('fs');
const path = require('path');
const CITIES = JSON.parse(fs.readFileSync(path.join(__dirname, 'cities.json'), 'utf8'));

const HUBS = {
    pakistan: 'Pakistan',
    'saudi-arabia': 'Saudi Arabia',
    indonesia: 'Indonesia',
    morocco: 'Morocco',
    'united-kingdom': 'United Kingdom',
    'united-states': 'United States',
};

const toMin = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
const fmtDur = (m) => `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} min`;
const th = 'text-align:left;padding:8px 10px;border-bottom:2px solid var(--border);';
const td = 'padding:8px 10px;border-bottom:1px solid var(--border);';

function block(slug, country) {
    const cs = CITIES.filter((c) => c.country === country);
    const name = country === 'United Kingdom' ? 'the UK' : country === 'United States' ? 'the USA' : country;
    const rows = cs.map((c) => {
        const r = c.ranges || {};
        const range = (x) => (x ? `${x.earliest}&ndash;${x.latest}` : 'no true twilight in summer');
        const qibla = c.slug === 'mecca' ? 'the Kaaba is in the city' : `${c.qibla}&deg;`;
        return `<tr><td style="${td}"><a href="/prayer-times/${c.slug}/">${c.city}</a></td><td style="${td}">${range(r.fajr)}</td><td style="${td}">${range(r.maghrib)}</td><td style="${td}">${qibla}</td></tr>`;
    }).join('\n                ');

    // Sentences computed from the monthly tables, so they differ by country.
    const jun = cs.map((c) => ({ c, r: c.monthly[5] }));
    const withFast = jun.filter((x) => x.r.fajr && x.r.maghrib).map((x) => ({ ...x, m: toMin(x.r.maghrib) - toMin(x.r.fajr) }));
    const facts = [];
    if (withFast.length >= 2) {
        withFast.sort((a, b) => b.m - a.m);
        const hi = withFast[0], lo = withFast[withFast.length - 1];
        if (hi.c.slug !== lo.c.slug) {
            facts.push(`On 15 June a fast from Fajr to Maghrib lasts ${fmtDur(hi.m)} in ${hi.c.city} but ${fmtDur(lo.m)} in ${lo.c.city} &mdash; a difference of ${hi.m - lo.m} minutes inside one country.`);
        }
    }
    const noFajr = jun.filter((x) => !x.r.fajr).map((x) => x.c.city);
    if (noFajr.length) facts.push(`In ${noFajr.join(', ')} there is no Fajr by sun angle on 15 June at all, which is why summer timetables there differ between mosques.`);
    const mar = cs.map((c) => ({ c, d: c.monthly[2].dhuhr })).sort((a, b) => toMin(a.d) - toMin(b.d));
    if (mar.length >= 2 && mar[0].d !== mar[mar.length - 1].d) {
        const first = mar[0], last = mar[mar.length - 1];
        facts.push(`Dhuhr on 15 March is at ${first.d} in ${first.c.city} and ${last.d} in ${last.c.city}: the same prayer, ${toMin(last.d) - toMin(first.d)} minutes apart on the clock, because of where each city sits in its time zone.`);
    }

    // Computed FAQ (AdSense gate item 3, 2026-11-16): the hubs were 261-286 words; these answers come
    // from the same monthly tables, so every number differs by country and is reproducible.
    const fastOn = (c, mi) => { const r = c.monthly[mi]; return r.fajr && r.maghrib ? toMin(r.maghrib) - toMin(r.fajr) : null; };
    const ref = cs[0];
    const fJun = fastOn(ref, 5), fDec = fastOn(ref, 11);
    const longer = fJun !== null && fDec !== null ? (fJun >= fDec ? ['June', fJun, 'December', fDec] : ['December', fDec, 'June', fJun]) : null;
    const qs = cs.filter((c) => c.slug !== 'mecca').map((c) => c.qibla);
    const qMin = qs.length ? Math.min(...qs) : null, qMax = qs.length ? Math.max(...qs) : null;
    const methods = [...new Set(cs.map((c) => c.method))];
    const asrH = cs.filter((c) => c.asr === 'hanafi').map((c) => c.city);
    const faq = [];
    if (longer) faq.push([`When is the longest fast in ${name}?`, `Around the June solstice${longer[0] === 'December' ? ' in the northern hemisphere, but here the long days fall in December' : ''}. In ${ref.city}, a fast from Fajr to Maghrib on 15 ${longer[0]} lasts ${fmtDur(longer[1])}; on 15 ${longer[2]} it lasts ${fmtDur(longer[3])}. Ramadan moves about 11 days earlier each year, so the fast length you meet depends on the year.`]);
    if (qMin !== null) faq.push([`Which way is the Qibla from ${name}?`, qMin === qMax ? `${qMin}&deg; from true north.` : `Between ${qMin}&deg; and ${qMax}&deg; from true north, depending on the city (see the table). These are true-north bearings; a phone compass shows magnetic north unless it corrects for declination.`]);
    const methodText = methods.map((m) => m === 'no single national standard — mosques differ' ? 'there is no single national standard (mosques differ), so the pages use an 18&deg;/17&deg; twilight convention' : m).join('; ');
    faq.push([`Which calculation method is used for ${name}?`, `${methodText.charAt(0).toUpperCase() + methodText.slice(1)}, with ${asrH.length ? `the Hanafi Asr time in ${asrH.join(', ')}` : 'the standard Asr time'}. Each city page states how many minutes apart the standard and Hanafi Asr times are, and names its method.`]);
    if (!longer && cs.some((c) => !c.monthly[5].fajr)) faq.push([`Why is there no Fajr time in June for some cities in ${name}?`, `In mid-summer the sun does not sink far enough below the horizon for the Fajr and Isha twilight angles to be reached, so no time can be calculated by angle. Mosques then use a high-latitude rule (for example one-seventh of the night or the nearest day with a true Fajr); the city pages say when this happens instead of inventing a time.`]);
    const faqHtml = faq.map(([q, a]) => `<h4 style="margin: 16px 0 6px; font-size: 16px;">${q}</h4>
        <p style="font-size: 16px; color: var(--text-muted); margin-bottom: 8px;">${a}</p>`).join('\n        ');

    return `<!-- HUB-DATA -->
        <h3 style="text-align: left; margin: 28px 0 12px; font-size: 19px;">How the cities in ${name} compare</h3>
        <p style="font-size: 16px; color: var(--text-muted); margin-bottom: 16px;">
            Earliest and latest Fajr and Maghrib across the year (standard time) and the great-circle qibla bearing,
            calculated for each city&rsquo;s coordinates with the method shown on its page. ${facts.join(' ')}
        </p>
        <div style="overflow-x:auto;">
        <table style="width:100%;border-collapse:collapse;font-size:15px;color:var(--text-muted);margin-bottom:16px;">
            <thead><tr><th style="${th}">City</th><th style="${th}">Fajr range</th><th style="${th}">Maghrib range</th><th style="${th}">Qibla</th></tr></thead>
            <tbody>
                ${rows}
            </tbody>
        </table>
        </div>
        <div class="az-ad" data-ad-placement="hub-mid"></div>
        <h3 style="text-align: left; margin: 28px 0 8px; font-size: 19px;">Questions about prayer times in ${name}</h3>
        ${faqHtml}
        <!-- /HUB-DATA -->`;
}

for (const [slug, country] of Object.entries(HUBS)) {
    const file = path.join(__dirname, slug, 'index.html');
    let html = fs.readFileSync(file, 'utf8');
    const b = block(slug, country);
    if (html.includes('<!-- HUB-DATA -->')) {
        html = html.replace(/<!-- HUB-DATA -->[\s\S]*?<!-- \/HUB-DATA -->/, b);
    } else {
        // Insert at the end of the "About Prayer Times" panel (first </div> before the cream section closes).
        const start = html.indexOf('<section style="background: var(--cream)');
        const end = html.indexOf('</section>', start);
        const close = html.lastIndexOf('</div>', end);
        if (start < 0 || close < start) throw new Error(`no about panel in ${slug}`);
        html = html.slice(0, close) + '    ' + b + '\n    ' + html.slice(close);
    }
    fs.writeFileSync(file, html, 'utf8');
    console.log(`  ✓ ${slug}`);
}
