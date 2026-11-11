/*
 * Automatic updates. The built game (docs/index.html, dist/zor.html) carries a build id in
 * <meta name="zor-build"> and is published next to version.json. While the game is open it checks
 * that file (at start, when you come back to the tab, and every 5 minutes). A new version is applied
 * by itself when you are NOT in a match (progress is saved instantly, nothing is lost); during a match
 * a small banner waits until you are back at the menus. Only runs when served over http(s).
 */
(function () {
  const AMB = globalThis.AMB;
  const meta = document.querySelector('meta[name="zor-build"]');
  if (!meta || !/^https?:$/.test(location.protocol)) return;
  const mine = meta.content;
  let pending = null, banner = null;
  const ss = { get: (k) => { try { return sessionStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { sessionStorage.setItem(k, v); } catch (e) { /* ignore */ } }, del: (k) => { try { sessionStorage.removeItem(k); } catch (e) { /* ignore */ } } };
  const UI = () => globalThis.AMB_UI;
  const busy = () => { const u = UI(); return !u || u.S.screen === 'match' || u.S.screen === 'hero' || document.getElementById('overlay').classList.contains('on') || document.getElementById('modal-back').classList.contains('on') || !!u.S.net; };

  // the notice comes, stays ~2 seconds and goes (it never sits on top of the cards); it is not repeated for the same message
  let hideT = 0, lastMsg = '';
  function showBanner(text, withBtn, ms) {
    if (text === lastMsg && !withBtn) return;
    lastMsg = text;
    if (!banner) { banner = document.createElement('div'); banner.className = 'upd-banner'; document.body.appendChild(banner); }
    const inMatch = UI() && UI().S.screen === 'match';
    banner.innerHTML = `<span>${text}</span>${withBtn && !inMatch ? '<button class="btn small primary" id="upd-now">حدّث الآن</button>' : ''}`;
    banner.style.pointerEvents = withBtn && !inMatch ? '' : 'none';
    banner.classList.remove('gone'); void banner.offsetWidth;
    const b = banner.querySelector('#upd-now'); if (b) b.onclick = () => apply(pending);
    clearTimeout(hideT); hideT = setTimeout(() => { if (banner) banner.classList.add('gone'); }, ms || 2000);
  }
  function apply(v) { ss.set('zor_upd', v); location.replace(location.pathname + '?v=' + encodeURIComponent(v)); }   // the query string skips a stale cached copy

  function tick() {
    if (!pending) return;
    if (busy()) { showBanner('🔄 فيه تحديث جديد، ينزل بعد المباراة'); return; }
    if (ss.get('zor_upd') === pending) { showBanner('🔄 فيه تحديث جديد', true, 6000); return; }   // already tried once for this version: let the player decide
    const v = pending; pending = null;
    showBanner('🔄 جاري تحديث اللعبة… تقدمك محفوظ');
    setTimeout(() => apply(v), 1200);
  }
  async function check() {
    try {
      const r = await fetch('version.json?' + Date.now(), { cache: 'no-store' });
      if (!r.ok) return;
      const j = await r.json();
      if (j && j.v && j.v !== mine) { pending = j.v; tick(); }
    } catch (e) { /* offline: try later */ }
  }

  // after an update: say so once
  if (ss.get('zor_upd') === mine) { ss.del('zor_upd'); window.addEventListener('load', () => setTimeout(() => UI() && UI().toast('حدّثنا اللعبة ✓', 'good'), 800)); }
  // installable app: register the service worker (offline play + the "install app" prompt); updates still arrive through version.json
  // files this page loaded before the worker took over (first visit) are handed to it, so the game also starts offline next time
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).catch(() => {});
    const handOver = () => navigator.serviceWorker.ready.then((reg) => {
      const urls = performance.getEntriesByType('resource').map((r) => r.name).concat([...document.querySelectorAll('svg image')].map((i) => i.href.baseVal ? new URL(i.href.baseVal, location.href).href : ''));
      if (reg.active) reg.active.postMessage({ cache: [...new Set(urls)].filter(Boolean) });
    }).catch(() => {});
    if (document.readyState === 'complete') setTimeout(handOver, 1500); else window.addEventListener('load', () => setTimeout(handOver, 1500));
  }
  setTimeout(check, 2500);
  setInterval(check, 5 * 60 * 1000);
  setInterval(tick, 3000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check(); });
  AMB.Update = { check, build: mine };
})();
