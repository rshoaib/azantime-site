/*
 * Manual AdSense units for azantime.app (no Auto ads).
 *
 * A page marks where an ad may go with <div class="az-ad" data-ad-placement="..."></div>.
 * Placements are only in reading content (city timetables, country comparison, converter notes),
 * never next to app screenshots of the adhan player or the Qibla compass.
 *
 * SLOTS maps a placement to the AdSense ad-unit slot ID. Empty = that placement renders nothing:
 * no empty box, no request. Ad units are created in the AdSense account (by Rizwan), then their
 * slot IDs go here.
 */
(function () {
  var CLIENT = 'ca-pub-3166995085202346';
  var SLOTS = {
    'city-mid': '',
    'hub-mid': '',
    'tool-below': '',
  };
  function fill() {
    var els = document.querySelectorAll('.az-ad[data-ad-placement]');
    for (var i = 0; i < els.length; i++) {
      var el = els[i], slot = SLOTS[el.getAttribute('data-ad-placement')];
      if (!slot || el.getAttribute('data-filled')) continue;
      el.setAttribute('data-filled', '1');
      el.style.cssText = 'margin:28px auto;text-align:center;max-width:800px;';
      el.setAttribute('aria-label', 'Advertisement');
      var ins = document.createElement('ins');
      ins.className = 'adsbygoogle';
      ins.style.display = 'block';
      ins.setAttribute('data-ad-client', CLIENT);
      ins.setAttribute('data-ad-slot', slot);
      ins.setAttribute('data-ad-format', 'auto');
      ins.setAttribute('data-full-width-responsive', 'true');
      el.appendChild(ins);
      try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch (e) { /* ignore */ }
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fill); else fill();
})();
