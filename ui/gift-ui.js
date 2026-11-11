/*
 * Welcome gift: 5 packs opened one by one (new players right after choosing their first hero; old saves get an offer
 * on the main menu). Afterwards a first deck is built for you. Logic: AMB.packs.gift() in core/packs.js.
 */
(function () {
  const AMB = globalThis.AMB;
  const $ = (id) => document.getElementById(id);
  const C = AMB.collection, P = AMB.packs, RAR = AMB.ECONOMY.rarities;
  const { icon } = AMB.art;
  const UI = () => globalThis.AMB_UI;
  let results = null, step = 0, after = null;

  const tag = (c) => (c.isNew ? '<span class="rv-tag new">جديدة!</span>' : `<span class="rv-tag">+1 نسخة</span>`);

  function intro(onDone) {
    after = onDone || null;
    UI().overlay(`<div class="rv-wrap"><h2>🎁 هدية البداية</h2>
      <p class="gift-sub">٥ باكجات هدية تبني منها تشكيلتك الأولى</p>
      <div class="gift-packs">${[1, 2, 3, 4, 5].map((i) => `<div class="gift-pack" style="--d:${i * 0.12}s"><b>ZOR</b><small>${i}</small></div>`).join('')}</div>
      <p class="hint">كل باكج فيه 5 وحدات. مضمون إن عندك كل الأدوار وكل العوالم عشان تقدر تبني تشكيلة.</p>
      <div class="rv-btns"><button class="btn primary big" data-act="giftOpen">افتح الباكج الأول</button></div></div>`);
  }

  function showPack(i) {
    const ui = UI(), res = results[i];
    const best = res.cards.reduce((b, c) => (RAR[c.rarity].order > RAR[b.rarity].order ? c : b), res.cards[0]);
    const cards = res.cards.map((c, k) => `<div class="rv" style="--d:${k * 0.35}s;--rc:${RAR[c.rarity].color}" data-r="${c.rarity}">
        <div class="rv-in"><div class="rv-back"><span>ZOR</span></div><div class="rv-front">${ui.cardHTML(C.def(c.id), { k: 'gf' + i + k + c.id, lvl: c.level })}${tag(c)}</div></div></div>`).join('');
    ui.overlay(`<div class="rv-wrap best-${best.rarity}"><h2>🎁 هدية ${i + 1} من ${results.length}</h2><div class="rv-row">${cards}</div>
      <div class="gift-dots">${results.map((_, k) => `<i class="${k <= i ? 'on' : ''}"></i>`).join('')}</div>
      <div class="rv-btns">${i + 1 < results.length ? '<button class="btn primary big" data-act="giftNext">الباكج التالي</button>' : '<button class="btn primary big" data-act="giftNext">خلصت! رتّب تشكيلتك</button>'}
        <button class="btn ghost" data-act="giftNext" data-all="1">افتح الباقي</button></div></div>`);
    res.cards.forEach((c, k) => setTimeout(() => {
      if (!$('overlay').classList.contains('on')) return;
      ui.sfx(RAR[c.rarity].order >= 2 ? 'merge' : 'click');
      const el = document.querySelectorAll('.rv')[k];
      if (el && RAR[c.rarity].order >= 2 && ui.burst) [RAR[c.rarity].color, '#ffffff'].forEach((col) => ui.burst(el, col, 12, { r: 100, s: 6 }));
    }, 350 * k + 300));
  }

  function summary() {
    const ui = UI(), deck = C.autoBuild(), rc = C.roleCounts(deck);
    const ROLE = AMB.DATA.ROLES;
    ui.overlay(`<div class="rv-wrap"><h2>🃏 تشكيلتك الأولى جاهزة</h2><p class="gift-sub">رتبت لك ${deck.length} وحدات متوازنة من اللي طلع لك</p>
      <div class="deck-mini">${deck.map((id, i) => `<div class="dm" title="${C.def(id).name}">${ui.portrait(C.def(id), { k: 'gd' + i + id })}</div>`).join('')}</div>
      <div class="deck-roles">${Object.entries(rc).map(([r, n]) => `<span>${icon(AMB.art.ROLE_ICON[r])}${ROLE[r].name} ${n}</span>`).join('')}</div>
      <p class="hint">التشكيلة هي الوحدات اللي تطلع لك في متجر الحملة والبرج والأحداث. عدّله من «مجموعتي» متى ما بغيت.</p>
      <div class="rv-btns"><button class="btn primary big" data-act="giftDone">${after ? 'ابدأ أول قتال' : 'تمام'}</button><button class="btn" data-act="giftDeck">عدّل التشكيلة</button></div></div>`);
  }

  function offer() {   // old saves: the gift is waiting
    UI().overlay(`<div class="rv-wrap"><h2>🎁 هدية للجميع</h2><p class="gift-sub">٥ باكجات هدية وتشكيلة تتحكم في وحداتك بالحملة</p>
      <p class="hint">بطاقاتك الحالية كلها باقية، والباكجات تنضاف لها.</p>
      <div class="rv-btns"><button class="btn primary big" data-act="giftStart">استلم الهدية</button><button class="btn ghost" data-act="giftLater">لاحقًا</button></div></div>`);
  }

  function installActions() {
    const ui = UI(); if (!ui || ui.ACT.giftOpen) return;
    Object.assign(ui.ACT, {
      giftStart: () => intro(null),
      giftLater: () => ui.closeOverlay(),
      giftOpen: () => { results = P.gift(); if (!results) { ui.closeOverlay(); return; } step = 0; showPack(0); },
      giftNext: (d) => {
        step = d.all ? results.length : step + 1;
        if (step >= results.length) { summary(); return; }
        showPack(step);
      },
      giftDone: () => { ui.closeOverlay(); ['PacksUI', 'CollectionUI', 'AlbumUI'].forEach((k) => AMB[k] && AMB[k].refreshMenu && AMB[k].refreshMenu()); const f = after; after = null; if (f) f(); else ui.show('menu'); },
      giftDeck: () => { ui.closeOverlay(); after = null; ui.show('cards'); },
    });
  }

  /** called when the main menu shows: offer the gift to a player who has a hero but has not claimed it */
  let offered = false;
  function onMenu() {
    if (offered || !C.starterHero() || C.giftClaimed() || $('overlay').classList.contains('on')) return;
    offered = true; setTimeout(() => { if (document.querySelector('#scr-menu.active') && !$('overlay').classList.contains('on') && !C.giftClaimed()) offer(); }, 500);
  }

  AMB.GiftUI = { intro, onMenu, installActions };
  if (UI()) installActions();
  if (document.querySelector('#scr-menu.active')) onMenu();
})();
