#!/usr/bin/env node
/**
 * compute-monthly.js — adds computed, per-city data to cities.json:
 *
 *   iana          IANA time zone, so pages format times in the CITY's clock
 *                 (including daylight saving), not the visitor's.
 *   ishaInterval  minutes after Maghrib for methods that define Isha as an
 *                 interval rather than a sun angle (Umm al-Qura: 90 minutes,
 *                 120 during Ramadan). 0 = use ishaAngle.
 *   monthly       times on the 15th of every month of YEAR, local clock time.
 *
 * The solar maths is a copy of the NOAA-style solver embedded in
 * _template.html (the one that renders "today's" times in the browser), so the
 * static table and the live card always agree.
 *
 * Usage:  node compute-monthly.js && node build.js
 */
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, 'cities.json');
const CITIES = JSON.parse(fs.readFileSync(FILE, 'utf8'));
const YEAR = 2027;

const IANA = {
    mecca: 'Asia/Riyadh', medina: 'Asia/Riyadh', riyadh: 'Asia/Riyadh',
    jakarta: 'Asia/Jakarta', bandung: 'Asia/Jakarta', surabaya: 'Asia/Jakarta',
    istanbul: 'Europe/Istanbul', cairo: 'Africa/Cairo', dhaka: 'Asia/Dhaka', dubai: 'Asia/Dubai',
    karachi: 'Asia/Karachi', lahore: 'Asia/Karachi', multan: 'Asia/Karachi', faisalabad: 'Asia/Karachi', islamabad: 'Asia/Karachi',
    'kuala-lumpur': 'Asia/Kuala_Lumpur', london: 'Europe/London', birmingham: 'Europe/London', manchester: 'Europe/London',
    'new-york': 'America/New_York', toronto: 'America/Toronto', chicago: 'America/Chicago', 'los-angeles': 'America/Los_Angeles',
    doha: 'Asia/Qatar', 'kuwait-city': 'Asia/Kuwait', amman: 'Asia/Amman', casablanca: 'Africa/Casablanca', marrakech: 'Africa/Casablanca',
    lagos: 'Africa/Lagos', paris: 'Europe/Paris', berlin: 'Europe/Berlin', sydney: 'Australia/Sydney', tehran: 'Asia/Tehran',
    baghdad: 'Asia/Baghdad', damascus: 'Asia/Damascus', hyderabad: 'Asia/Kolkata', tunis: 'Africa/Tunis', algiers: 'Africa/Algiers',
    khartoum: 'Africa/Khartoum', singapore: 'Asia/Singapore', tashkent: 'Asia/Tashkent', sarajevo: 'Europe/Sarajevo',
};

const DEG = Math.PI / 180;
const sin = (x) => Math.sin(x * DEG), cos = (x) => Math.cos(x * DEG), tan = (x) => Math.tan(x * DEG);
const asinD = (x) => Math.asin(x) / DEG, atan2D = (y, x) => Math.atan2(y, x) / DEG, acosD = (x) => Math.acos(x) / DEG;

function julianDay(Y, M, D) {
    if (M <= 2) { Y -= 1; M += 12; }
    const A = Math.floor(Y / 100), B = 2 - A + Math.floor(A / 4);
    return Math.floor(365.25 * (Y + 4716)) + Math.floor(30.6001 * (M + 1)) + D + B - 1524.5;
}
function sunPosition(jd) {
    const D = jd - 2451545.0;
    const g = (357.529 + 0.98560028 * D) % 360;
    const q = (280.459 + 0.98564736 * D) % 360;
    const L = (q + 1.915 * sin(g) + 0.020 * sin(2 * g)) % 360;
    const e = 23.439 - 0.00000036 * D;
    let RA = atan2D(cos(e) * sin(L), cos(L)) / 15;
    if (RA < 0) RA += 24;
    const decl = asinD(sin(e) * sin(L));
    let eqt = q / 15 - RA;
    if (eqt > 12) eqt -= 24;
    if (eqt < -12) eqt += 24;
    return { decl, eqt };
}
function times(c, jd) {
    const sp = sunPosition(jd);
    const noon = 12 - c.lng / 15 - sp.eqt;
    const at = (angle, dir) => {
        const cosH = (sin(angle) - sin(c.lat) * sin(sp.decl)) / (cos(c.lat) * cos(sp.decl));
        if (cosH < -1 || cosH > 1) return null;
        const H = acosD(cosH) / 15;
        return dir < 0 ? noon - H : noon + H;
    };
    const asrAngle = atan2D(1, (c.asr === 'hanafi' ? 2 : 1) + tan(Math.abs(c.lat - sp.decl)));
    const maghrib = at(-0.833, 1);
    return {
        fajr: at(-c.fajrAngle, -1),
        sunrise: at(-0.833, -1),
        dhuhr: noon,
        asr: at(asrAngle, 1),
        maghrib,
        isha: c.ishaInterval ? (maghrib === null ? null : maghrib + c.ishaInterval / 60) : at(-c.ishaAngle, 1),
    };
}
function fmt(hUTC, Y, M, D, zone) {
    if (hUTC === null || Number.isNaN(hUTC)) return null;
    const d = new Date(Date.UTC(Y, M - 1, D) + Math.round(hUTC * 60) * 60000);
    return new Intl.DateTimeFormat('en-GB', { timeZone: zone, hour: '2-digit', minute: '2-digit', hour12: false }).format(d);
}
const addMin = (hhmm, m) => {
    const t = Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3)) + m;
    return `${String(Math.floor(t / 60) % 24).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
};

module.exports = { times, julianDay, fmt, IANA };
if (require.main !== module) return;

for (const c of CITIES) {
    c.iana = IANA[c.slug];
    if (!c.iana) throw new Error(`no IANA zone for ${c.slug}`);
    c.ishaInterval = /Umm al-Qura/.test(c.method) ? 90 : 0;
    if (c.ishaInterval && c.ranges && c.ranges.maghrib) {
        // Isha is exactly Maghrib + 90 min under Umm al-Qura, so its annual range is too.
        c.ranges.isha = { earliest: addMin(c.ranges.maghrib.earliest, 90), latest: addMin(c.ranges.maghrib.latest, 90) };
    }
    c.monthlyYear = YEAR;
    c.monthly = [];
    for (let M = 1; M <= 12; M++) {
        const t = times(c, julianDay(YEAR, M, 15));
        const row = { month: M };
        for (const k of ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha']) row[k] = fmt(t[k], YEAR, M, 15, c.iana);
        c.monthly.push(row);
    }
}

fs.writeFileSync(FILE, JSON.stringify(CITIES, null, 2) + '\n', 'utf8');
console.log(`monthly tables computed for ${CITIES.length} cities (${YEAR})`);
