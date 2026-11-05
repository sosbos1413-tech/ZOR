/*
 * Daily login calendar popup (7 days). Shown once per session on the main menu when today's
 * reward is waiting; also opened from the menu button. Logic: core/daily.js, rewards: AMB.ECONOMY.login.
 */
(function () {
  const AMB = globalThis.AMB;
  const $ = (id) => document.getElementById(id);
  const L = AMB.login, RAR = AMB.ECONOMY.rarities;
  const { icon } = AMB.art;
  const UI = () => globalThis.AMB_UI;
  let shown = false;

  const rewardHTML = (rw) => [rw.shards ? `<b>${icon('gem')} ${rw.shards}</b>` : '', rw.packs ? `<b>📦 باكج</b>` : '', rw.card ? `<b style="color:${RAR[rw.card].color}">+ بطاقة ${RAR[rw.card].name}+</b>` : ''].filter(Boolean).join('');

  function calendarHTML(got) {
    const st = L.status(), R = L.rewards();
    const tiles = R.map((rw, i) => {
      const past = got ? i < (got.day - 1) || (got.day - 1 === i) : i < st.next;
      const today = !got && st.canClaim && i === st.next;
      const justNow = got && i === got.day - 1;
      return `<div class="lday ${past ? 'got' : ''} ${today ? 'today' : ''} ${justNow ? 'now' : ''} ${rw.big ? 'big' : ''}"><small>اليوم ${i + 1}</small>${rewardHTML(rw)}${past ? '<i class="lck">✓</i>' : ''}</div>`;
    }).join('');
    let body;
    if (got) {
      const cards = got.packs.flatMap((p) => p.cards).concat(got.card ? [got.card] : []);
      body = `<p class="cam-pay">استلمت جائزة اليوم ${got.day}${got.shards ? ` · ${icon('gem')} +${got.shards} شظية` : ''}</p>
        ${cards.length ? `<div class="cam-pack-row">${cards.map((c, i) => `<div class="cu">${UI().portrait(AMB.collection.def(c.id), { k: 'lg' + i + c.id })}<small style="color:${RAR[c.rarity].color}">${RAR[c.rarity].name}${c.isNew ? ' · جديدة!' : ''}</small></div>`).join('')}</div>` : ''}
        <div class="rv-btns"><button class="btn primary" data-act="loginClose">تم</button></div>`;
    } else {
      body = st.canClaim ? `<div class="rv-btns"><button class="btn primary big" data-act="loginClaim">استلم جائزة اليوم ${st.next + 1}</button><button class="btn ghost" data-act="loginClose">لاحقًا</button></div>`
        : `<p class="hint">استلمت جائزة اليوم. ارجع بكرة لجائزة اليوم ${st.next + 1}.</p><div class="rv-btns"><button class="btn" data-act="loginClose">تم</button></div>`;
    }
    return `<div class="login-wrap"><h2>🎁 الدخول اليومي</h2><p class="hint">ادخل كل يوم واستلم جائزة تكبر يومًا بعد يوم. لو فاتك يوم ما يرجع العدّاد، وبعد اليوم السابع تبدأ دورة جديدة.</p>
      <div class="lcal">${tiles}</div>${body}</div>`;
  }

  function open() { UI().overlay(calendarHTML(null)); }
  function refreshMenu() {
    const b = $('menu-login'); if (!b) return;
    (b.querySelector('.mt-l') || b).innerHTML = `الدخول اليومي${L.canClaim() ? '<span class="dot">1</span>' : ''}`;
  }
  /** called when the main menu shows: open the calendar once per session if a reward waits */
  function onMenu() {
    refreshMenu();
    if (shown || !L.canClaim() || $('overlay').classList.contains('on')) return;
    if (AMB.CampaignUI && AMB.CampaignUI.isNewbie()) return;   // first visit: no popups before the first fight
    shown = true; setTimeout(() => { if (L.canClaim() && !(AMB.CampaignUI && AMB.CampaignUI.isNewbie()) && document.querySelector('#scr-menu.active') && !$('overlay').classList.contains('on')) open(); }, 600);
  }

  function installActions() {
    const ui = UI(); if (!ui || ui.ACT.loginOpen) return;
    Object.assign(ui.ACT, {
      loginOpen: () => open(),
      loginClaim: () => {
        const got = L.claim(); if (!got) return;
        ui.sfx('merge'); ui.overlay(calendarHTML(got));
        const el = document.querySelector('.lday.now'); if (el && ui.burst) ['#ffd24a', '#5fe3ff', '#ffffff'].forEach((c) => ui.burst(el, c, 12, { r: 90, s: 6 }));
        refreshMenu(); ['PacksUI', 'CollectionUI', 'PassUI', 'CampaignUI'].forEach((k) => AMB[k] && AMB[k].refreshMenu && AMB[k].refreshMenu());
      },
      loginClose: () => ui.closeOverlay(),
    });
  }

  AMB.DailyUI = { open, refreshMenu, onMenu, installActions };
  if (UI()) installActions();
  // the game opens on the menu: offer today's reward right away
  if (document.querySelector('#scr-menu.active')) onMenu(); else refreshMenu();
})();
