#!/usr/bin/env node
/**
 * build.js — generates per-city prayer time pages from _template.html + cities.json.
 *
 * Usage:
 *   cd marketing/website/prayer-times
 *   node build.js
 *
 * Reads:  _template.html, cities.json
 * Writes: <slug>/index.html for each city in cities.json
 *
 * Add a new city: append to cities.json, re-run this script, commit.
 * Total time per city: ~2 seconds of script + a minute of review.
 */

const fs = require('fs');
const path = require('path');

const TEMPLATE = fs.readFileSync(path.join(__dirname, '_template.html'), 'utf8');
const CITIES = JSON.parse(fs.readFileSync(path.join(__dirname, 'cities.json'), 'utf8'));

let generated = 0;

// Above roughly 48 degrees of latitude, true astronomical twilight does not end
// on some summer nights, so Fajr and Isha cannot be derived from a sun angle and
// every app falls back to an approximation rule. Saying which rule, and that one
// is being applied at all, is the single most useful thing a page for a northern
// city can tell someone.
// Annual earliest/latest for each prayer, precomputed in cities.json. Unlike
// today's times these are stable facts about a location, so they belong in the
// static HTML — which previously contained no clock times at all, leaving 42
// near-identical pages with nothing for Google to index.
const RANGES = (c) => {
    if (!c.ranges) return '';
    const row = (label, r) => r
        ? `<tr><td style="padding:8px 12px;border-bottom:1px solid var(--border);"><strong>${label}</strong></td><td style="padding:8px 12px;border-bottom:1px solid var(--border);">${r.earliest}</td><td style="padding:8px 12px;border-bottom:1px solid var(--border);">${r.latest}</td></tr>`
        : `<tr><td style="padding:8px 12px;border-bottom:1px solid var(--border);"><strong>${label}</strong></td><td colspan="2" style="padding:8px 12px;border-bottom:1px solid var(--border);">no true twilight for part of the year</td></tr>`;
    const spread = (r) => {
        if (!r) return null;
        const m = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
        return m(r.latest) - m(r.earliest);
    };
    const fs_ = spread(c.ranges.fajr);
    const summary = fs_ === null
        ? `${c.city} sits far enough north that Fajr cannot be calculated from a sun angle for part of the summer.`
        : `Across the year Fajr in ${c.city} moves by about ${Math.round(fs_ / 60)} hours ${fs_ % 60} minutes between its earliest and latest.`;
    return `
        <h3 style="text-align: left; margin: 28px 0 12px; font-size: 19px;">How much prayer times move across the year in ${c.city}</h3>
        <p style="font-size: 16px; color: var(--text-muted); margin-bottom: 16px;">
            ${summary} These are the earliest and latest each prayer falls, calculated for ${c.city}&rsquo;s
            coordinates using ${c.method === 'no single national standard — mosques differ' ? 'an 18&deg;/17&deg; twilight convention' : c.method} and the
            ${c.asr === 'hanafi' ? 'Hanafi' : 'standard'} Asr calculation. Standard time is used throughout &mdash; add an hour wherever daylight saving applies.
        </p>
        <table style="width:100%;border-collapse:collapse;font-size:15px;color:var(--text-muted);margin-bottom:16px;">
            <thead><tr>
                <th style="text-align:left;padding:8px 12px;border-bottom:2px solid var(--border);">Prayer</th>
                <th style="text-align:left;padding:8px 12px;border-bottom:2px solid var(--border);">Earliest in the year</th>
                <th style="text-align:left;padding:8px 12px;border-bottom:2px solid var(--border);">Latest in the year</th>
            </tr></thead>
            <tbody>
                ${row('Fajr', c.ranges.fajr)}
                ${row('Dhuhr', c.ranges.dhuhr)}
                ${row('Asr', c.ranges.asr)}
                ${row('Maghrib', c.ranges.maghrib)}
                ${row('Isha', c.ranges.isha)}
            </tbody>
        </table>`;
};

// Times on the 15th of each month, precomputed by compute-monthly.js in the
// city's own clock (daylight saving included). Twelve rows of computed data per
// city is what actually distinguishes one city page from another.
const { times: solve, julianDay: jdOf } = require('./compute-monthly.js');
// Hanafi minus standard Asr, in minutes, on two sample days. Computed per city
// because the gap depends on latitude and season (it is larger in summer).
const ASR_GAP = (c) => {
    const gap = (M) => {
        const jd = jdOf(2027, M, 15);
        const a = solve({ ...c, asr: 'standard' }, jd).asr, b = solve({ ...c, asr: 'hanafi' }, jd).asr;
        return a === null || b === null ? null : Math.round((b - a) * 60);
    };
    const jun = gap(6), dec = gap(12);
    if (jun === null || dec === null) return 'The Hanafi time is always the later of the two.';
    return `In ${c.city} the Hanafi time comes <strong>${jun} minutes</strong> later than the standard time on 15 June and <strong>${dec} minutes</strong> later on 15 December &mdash; ${Math.abs(c.lat) < 15 ? 'close to the equator the season makes little difference.' : `the gap is larger in ${jun > dec ? 'June' : 'December'}, when the long ${c.lat >= 0 ? 'northern' : 'southern'} summer afternoon stretches it out.`}`;
};

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const toMin = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
const dur = (a, b) => { const m = toMin(b) - toMin(a); return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} min`; };
const offsetOn = (zone, month) => {
    const d = new Date(Date.UTC(2027, month, 15, 12));
    const part = new Intl.DateTimeFormat('en-US', { timeZone: zone, timeZoneName: 'shortOffset' }).formatToParts(d).find((p) => p.type === 'timeZoneName');
    return part ? part.value : '';
};
const MONTHLY = (c) => {
    if (!c.monthly) return '';
    const td = 'padding:6px 8px;border-bottom:1px solid var(--border);';
    const th = 'text-align:left;padding:6px 8px;border-bottom:2px solid var(--border);';
    const cell = (v) => v || '&mdash;';
    const rows = c.monthly.map((r) => `<tr><td style="${td}"><strong>${MONTHS[r.month - 1].slice(0, 3)}</strong></td><td style="${td}">${cell(r.fajr)}</td><td style="${td}">${cell(r.sunrise)}</td><td style="${td}">${cell(r.dhuhr)}</td><td style="${td}">${cell(r.asr)}</td><td style="${td}">${cell(r.maghrib)}</td><td style="${td}">${cell(r.isha)}</td></tr>`).join('\n                ');
    const jun = c.monthly[5], dec = c.monthly[11], mar = c.monthly[2];
    const north = c.lat >= 0;
    const longM = north ? jun : dec, shortM = north ? dec : jun;
    const fast = (r) => (r.fajr && r.maghrib ? dur(r.fajr, r.maghrib) : null);
    const fl = fast(longM), fs2 = fast(shortM);
    const fastLine = fl && fs2
        ? `A fast from Fajr to Maghrib lasts about <strong>${fl}</strong> on 15 ${MONTHS[longM.month - 1]} and <strong>${fs2}</strong> on 15 ${MONTHS[shortM.month - 1]}, the longest and shortest of these sample days.`
        : `On 15 ${MONTHS[longM.month - 1]} there is no Fajr by sun angle at all in ${c.city}, so a summer fast is timed by whichever high-latitude rule your mosque uses; on 15 ${MONTHS[shortM.month - 1]} a fast from Fajr to Maghrib lasts about <strong>${fs2 || 'n/a'}</strong>.`;
    const o1 = offsetOn(c.iana, 0), o7 = offsetOn(c.iana, 6);
    const dstLine = o1 !== o7
        ? `Clock times follow local daylight saving (${o1.replace('GMT', 'UTC')} in winter, ${o7.replace('GMT', 'UTC')} in summer), which is why Dhuhr jumps by about an hour when the clocks change even though solar noon barely moves.`
        : `${c.country} does not use daylight saving (${o1.replace('GMT', 'UTC')} all year), so the shift you see from month to month is the sun alone &mdash; Dhuhr stays within a few minutes of ${mar.dhuhr} all year.`;
    const ishaLine = c.ishaInterval
        ? ` Isha is shown ${c.ishaInterval} minutes after Maghrib, as the Umm al-Qura calendar defines it (it is extended to 120 minutes during Ramadan).`
        : '';
    return `
        <h3 style="text-align: left; margin: 28px 0 12px; font-size: 19px;">${c.city} prayer times through the year</h3>
        <p style="font-size: 16px; color: var(--text-muted); margin-bottom: 16px;">
            Calculated times on the 15th of each month of ${c.monthlyYear}, in local ${c.city} clock time. ${fastLine}
            ${dstLine}${ishaLine}
        </p>
        <div style="overflow-x:auto;">
        <table style="width:100%;border-collapse:collapse;font-size:14px;color:var(--text-muted);margin-bottom:16px;">
            <thead><tr><th style="${th}">15th of</th><th style="${th}">Fajr</th><th style="${th}">Sunrise</th><th style="${th}">Dhuhr</th><th style="${th}">Asr</th><th style="${th}">Maghrib</th><th style="${th}">Isha</th></tr></thead>
            <tbody>
                ${rows}
            </tbody>
        </table>
        </div>`;
};

// Makkah is a special case: the city's coordinates ARE the Kaaba's, so the
// great-circle bearing comes out as 0 and the generic sentence read "the Kaaba
// lies on a bearing of 0 degrees - roughly north", which is nonsense in the one
// city where the question does not arise.
const QIBLA_SECTION = (c) => {
    const heading = `<h3 style="text-align: left; margin: 28px 0 12px; font-size: 19px;">Qibla direction from ${c.city}</h3>`;
    if (c.slug === 'mecca') {
        return `
        ${heading}
        <p style="font-size: 16px; color: var(--text-muted); margin-bottom: 16px;">
            In Makkah the question does not arise in the usual way: the Kaaba is here, inside Masjid al-Haram.
            Worshippers in the Haram face it directly rather than along a bearing, and elsewhere in the city the
            direction is simply towards the Haram, so it changes depending on which district you are praying from.
            A qibla compass calibrated for a distant city will not help you inside Makkah.
        </p>`;
    }
    return `
        ${heading}
        <p style="font-size: 16px; color: var(--text-muted); margin-bottom: 16px;">
            From ${c.city} the Kaaba lies on a bearing of <strong>${c.qibla}&deg;</strong> &mdash; roughly
            ${c.qiblaCompass} &mdash; measured as a great-circle direction from the city&rsquo;s coordinates
            (${c.lat}, ${c.lng}). A compass needle points to magnetic north rather than true north, so a phone
            compass may read a few degrees off depending on local declination.
        </p>`;
};

const HIGH_LAT_NOTE = (c) => `
        <h3 style="text-align: left; margin: 28px 0 12px; font-size: 19px;">Why ${c.city} times vary more in summer</h3>
        <p style="font-size: 16px; color: var(--text-muted); margin-bottom: 16px;">
            ${c.city} sits at ${c.lat}&deg; north. Around midsummer the sun never drops far enough below the horizon
            for true astronomical twilight to end, so there is no angle at which Fajr or Isha can be calculated in the
            ordinary way. Every prayer app applies an approximation for those weeks &mdash; commonly the midpoint of
            the night, a fixed one-seventh of the night, or the nearest latitude at which the angle still occurs.
            Different apps choose differently, which is why summer Isha times in ${c.city} can differ by over an hour
            between two apps that agree perfectly in winter.
        </p>`;

for (const c of CITIES) {
    const html = TEMPLATE
        .replace(/\{\{CITY\}\}/g, c.city)
        .replace(/\{\{COUNTRY\}\}/g, c.country)
        .replace(/\{\{LAT\}\}/g, c.lat)
        .replace(/\{\{LNG\}\}/g, c.lng)
        .replace(/\{\{SLUG\}\}/g, c.slug)
        .replace(/\{\{QIBLA\}\}/g, c.qibla)
        .replace(/\{\{QIBLA_COMPASS\}\}/g, c.qiblaCompass)
        .replace(/\{\{METHOD\}\}/g, c.method)
        .replace(/\{\{ASR_NOTE\}\}/g, c.asrNote)
        .replace(/\{\{HIGH_LAT_NOTE\}\}/g, c.twilightGapDays > 0 ? HIGH_LAT_NOTE(c) : '')
        .replace(/\{\{RANGES\}\}/g, RANGES(c))
        .replace(/\{\{MONTHLY\}\}/g, MONTHLY(c))
        .replace(/\{\{ASR_GAP\}\}/g, ASR_GAP(c))
        .replace(/\{\{ISHA_INTERVAL\}\}/g, c.ishaInterval || 0)
        .replace(/\{\{IANA\}\}/g, c.iana)
        .replace(/\{\{QIBLA_SECTION\}\}/g, QIBLA_SECTION(c))
        .replace(/\{\{FAJR_ANGLE\}\}/g, c.fajrAngle)
        .replace(/\{\{ISHA_ANGLE\}\}/g, c.ishaAngle)
        .replace(/\{\{ASR_FACTOR\}\}/g, c.asr === 'hanafi' ? 2 : 1)
        .replace(/\{\{ASR_LABEL\}\}/g, c.asr === 'hanafi' ? 'Hanafi' : 'standard')
        .replace(/\{\{FAJR_EARLIEST\}\}/g, c.ranges && c.ranges.fajr ? c.ranges.fajr.earliest : 'n/a')
        .replace(/\{\{FAJR_LATEST\}\}/g, c.ranges && c.ranges.fajr ? c.ranges.fajr.latest : 'n/a');

    const dir = path.join(__dirname, c.slug);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const out = path.join(dir, 'index.html');
    fs.writeFileSync(out, html, 'utf8');
    console.log(`  ✓ ${c.slug}/index.html`);
    generated++;
}

console.log(`\nGenerated ${generated} city pages.`);
console.log(`Don't forget to add the new cities to /prayer-times/index.html and sitemap.xml.`);
