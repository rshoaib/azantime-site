/*
 * Cookie consent for azantime.app — a plain-JS mirror of the web-monorepo @web/consent package.
 *
 * - The inline snippet in every page <head> sets Google Consent Mode v2 defaults to "denied"
 *   BEFORE the AdSense loader runs. Ads can then only be non-personalised until a visitor accepts.
 * - This file shows the banner until the visitor chooses, stores the choice in localStorage
 *   ("consent" = "accepted" | "rejected"), re-applies a stored choice on every page load, and
 *   lets the visitor change it later from the footer "Cookie choices" link.
 * The AdSense loader itself is never gated on the choice (Google's reviewer must see it);
 * consent governs personalisation, which is what Consent Mode is for.
 */
(function () {
  var KEY = 'consent';
  var GRANTED = { ad_storage: 'granted', ad_user_data: 'granted', ad_personalization: 'granted', analytics_storage: 'granted', functionality_storage: 'granted', security_storage: 'granted' };
  var DENIED = { ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied', analytics_storage: 'denied', functionality_storage: 'granted', security_storage: 'granted' };

  window.dataLayer = window.dataLayer || [];
  if (typeof window.gtag !== 'function') window.gtag = function () { window.dataLayer.push(arguments); };

  function read() {
    try { var v = localStorage.getItem(KEY); return v === 'accepted' || v === 'rejected' ? v : 'pending'; } catch (e) { return 'pending'; }
  }
  function apply(choice) {
    window.gtag('consent', 'update', choice === 'accepted' ? GRANTED : DENIED);
  }
  function save(choice) {
    try { localStorage.setItem(KEY, choice); } catch (e) { /* private mode: choice lasts this page only */ }
    apply(choice);
    var b = document.getElementById('az-consent');
    if (b) b.parentNode.removeChild(b);
  }
  function btn(label, primary, onClick) {
    var x = document.createElement('button');
    x.type = 'button';
    x.textContent = label;
    x.style.cssText = 'padding:8px 16px;font-size:14px;border-radius:6px;cursor:pointer;color:#fff;' +
      (primary ? 'border:1px solid #2563eb;background:#2563eb;font-weight:600;' : 'border:1px solid #4b5563;background:transparent;');
    x.addEventListener('click', onClick);
    return x;
  }
  function show() {
    if (document.getElementById('az-consent')) return;
    var wrap = document.createElement('div');
    wrap.id = 'az-consent';
    wrap.setAttribute('role', 'dialog');
    wrap.setAttribute('aria-label', 'Cookie consent');
    wrap.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:9999;background:#111827;color:#fff;padding:16px;' +
      'box-shadow:0 -4px 12px rgba(0,0,0,.25);font:14px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;';
    var inner = document.createElement('div');
    inner.style.cssText = 'max-width:960px;margin:0 auto;display:flex;flex-wrap:wrap;align-items:center;gap:12px;justify-content:space-between;';
    var p = document.createElement('p');
    p.style.cssText = 'flex:1 1 300px;margin:0;';
    p.innerHTML = 'We use cookies for personalised advertising by Google. If you reject, Google shows only non-personalised ads. ' +
      'See our <a href="/privacy/" style="color:#fff;text-decoration:underline;">Privacy Policy</a>.';
    var row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:8px;flex-shrink:0;';
    row.appendChild(btn('Reject', false, function () { save('rejected'); }));
    row.appendChild(btn('Accept', true, function () { save('accepted'); }));
    inner.appendChild(p); inner.appendChild(row); wrap.appendChild(inner);
    document.body.appendChild(wrap);
  }

  var choice = read();
  if (choice !== 'pending') apply(choice);

  function init() {
    if (read() === 'pending') show();
    var links = document.querySelectorAll('[data-cookie-choices]');
    for (var i = 0; i < links.length; i++) {
      links[i].addEventListener('click', function (e) { e.preventDefault(); show(); });
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
