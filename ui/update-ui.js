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
  const busy = () => { const u = UI(); return !u || u.S.screen === 'match' || u.S.screen === 'hero' || document.getElementById('overlay').classList.contains('on'); };

  function showBanner(text, withBtn) {
    if (!banner) { banner = document.createElement('div'); banner.className = 'upd-banner'; document.body.appendChild(banner); }
    banner.innerHTML = `<span>${text}</span>${withBtn ? '<button class="btn small primary" id="upd-now">حدّث الآن</button>' : ''}`;
    const b = banner.querySelector('#upd-now'); if (b) b.onclick = () => apply(pending);
  }
  function apply(v) { ss.set('zor_upd', v); location.replace(location.pathname + '?v=' + encodeURIComponent(v)); }   // the query string skips a stale cached copy

  function tick() {
    if (!pending) return;
    if (busy()) { showBanner('🔄 فيه تحديث جديد — يتطبّق بعد المباراة'); return; }
    if (ss.get('zor_upd') === pending) { showBanner('🔄 فيه تحديث جديد', true); return; }   // already tried once for this version: let the player decide
    const v = pending; pending = null;
    showBanner('🔄 جاري تحديث اللعبة… تقدّمك محفوظ');
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
  if (ss.get('zor_upd') === mine) { ss.del('zor_upd'); window.addEventListener('load', () => setTimeout(() => UI() && UI().toast('تم تحديث اللعبة ✓', 'good'), 800)); }
  setTimeout(check, 2500);
  setInterval(check, 5 * 60 * 1000);
  setInterval(tick, 3000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check(); });
  AMB.Update = { check, build: mine };
})();
