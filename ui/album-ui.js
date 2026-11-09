/*
 * "الألبوم": every card of the game. Cards you don't own are shadows. Own all 5 units of a world
 * to claim its set reward; own all 20 for the grand reward. Logic: core/album.js.
 */
(function () {
  const AMB = globalThis.AMB;
  const $ = (id) => document.getElementById(id);
  const A = AMB.album, C = AMB.collection, RAR = AMB.ECONOMY.rarities, P = AMB.Pass;
  const { icon } = AMB.art;
  const UI = () => globalThis.AMB_UI;
  const W = (id) => AMB.DATA.WORLDS[id];
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const hint = (id) => (AMB.CollectionUI ? AMB.CollectionUI.unlockHint(id) : 'من الباكجات');

  // the album is a storybook: one page per world, then the heroes, the event exclusives and the gear
  const PAGES = ['ember', 'tide', 'neon', 'sylvan', 'heroes', 'exclusive', 'items'];
  let page = 0, dir = 0, hub = true;   // the album opens on the world map (a compass); a world opens its storybook page
  const pageName = (k) => (W(k) ? W(k).name : k === 'heroes' ? 'الأبطال' : k === 'exclusive' ? '🌟 حصريات الأحداث' : 'المعدات والتعاويذ');
  const pageColor = (k) => (W(k) ? W(k).color : k === 'heroes' ? '#ff5a64' : k === 'exclusive' ? '#ffd24a' : '#b8a89a');

  function cardTile(id) {
    const d = C.def(id), owned = C.owned(id), s = A.cardState(id);
    const card = UI().cardHTML(d, { k: 'alb' + id, lvl: owned ? C.level(id) : 0, cls: owned ? '' : 'unowned', attrs: `data-act="${d.role ? 'detail' : 'heroInfo'}" data-id="${id}"` });
    const chip = s === 'ready' ? `<button class="al-claim" data-act="albCard" data-id="${id}">+${A.cardPrize(id)} ${icon('gem')}</button>` : s === 'claimed' ? '<span class="al-got">✓</span>' : '';
    // kid #8: a sticker book: every owned character gets a one-line "who am I" caption (role + home world)
    const who = owned && d.role && AMB.DATA.ROLES[d.role] && W(d.world) ? `<small class="al-who">${AMB.DATA.ROLES[d.role].name} من ${W(d.world).name}</small>` : '';
    return `<div class="al-tile ${owned ? '' : 'miss'} ${s}">${card}${who}${owned ? chip : `<small class="al-hint">🔒 ${hint(id)}</small>`}</div>`;
  }

  function rewardText(rw) {
    const bits = [];
    if (rw.shards) bits.push(`${icon('gem')} ${rw.shards}`);
    if (rw.packs) bits.push(`📦 ${rw.packs === 1 ? 'باكج' : rw.packs + ' باكجات'}`);
    if (rw.title) bits.push(`لقب «${P.COSMETICS.title[rw.title].name}»`);
    if (rw.frame) bits.push(`إطار`);
    return bits.join(' · ');
  }

  function pageHTML(k) {
    if (k === 'items') return `<div class="codex-grid">${UI().itemsHTML()}</div>`;
    const ids = A.pageIds(k), owned = ids.filter((id) => C.owned(id)).length, ready = A.pageReady(k), prize = A.pagePrize(k);
    let setRow = '';
    if (W(k)) {
      const st = A.state(k), rw = A.reward(k), p = A.progress(k);
      setRow = `<div class="al-set ${st}"><span>جائزة إكمال العالم: ${rewardText(rw)}</span><b>${p.owned}/${p.total}</b>${st === 'ready' ? `<button class="btn small primary" data-act="albClaim" data-w="${k}">استلم</button>` : st === 'claimed' ? '<span class="al-done">✓</span>' : ''}</div>`;
    }
    const allBtn = ready.length ? `<button class="btn big primary al-all" data-act="albPage" data-k="${k}">استلام الكل · +${prize} ${icon('gem')} <small>(${ready.length} ${ready.length === 1 ? 'شخصية' : 'شخصيات'})</small></button>`
      : `<div class="al-all done">${owned === ids.length ? '✓ كل جوائز الصفحة مستلمة' : 'اجمع شخصيات جديدة وتجيك جوائزها هنا'}</div>`;
    return `${setRow}<div class="al-grid">${ids.map(cardTile).join('')}</div>${allBtn}`;
  }

  function hubHTML(t) {
    const arm = (w, pos) => { const p = A.progress(w), wd = W(w), rd = A.pageReady(w).length + (A.state(w) === 'ready' ? 1 : 0);
      return `<button class="wm-arm wm-${pos} ${p.owned ? '' : 'locked'} ${p.owned >= p.total ? 'done' : ''}" style="--wc:${wd.color}" data-act="albOpen" data-p="${PAGES.indexOf(w)}" aria-label="${esc(wd.name)}">
        <span class="wm-ic">${icon(AMB.art.WORLD_ICON[w])}</span><b>${esc(wd.name)}</b><small><bdi dir="ltr">${p.owned}/${p.total}</bdi> وحدة</small>${rd ? `<i class="wm-go">🎁 ${rd}</i>` : ''}</button>`; };
    const side = (key, label) => { const rd = key === 'items' ? 0 : A.pageReady(key).length; return `<button class="btn small" data-act="albOpen" data-p="${PAGES.indexOf(key)}">${label}${rd ? ` <span class="dot">${rd}</span>` : ''}</button>`; };
    return `<div class="wm wm-col"><div class="wm-lines"><i></i><i></i></div>${arm('sylvan', 'top')}${arm('ember', 'left')}${arm('neon', 'right')}${arm('tide', 'bottom')}
      <div class="wm-core"><svg viewBox="0 0 100 100" aria-hidden="true"><polygon points="50,4 58,34 90,24 66,46 96,60 62,62 70,94 50,70 30,94 38,62 4,60 34,46 10,24 42,34" fill="#f2c94c" stroke="#a87a12" stroke-width="1.5"/></svg><b><bdi dir="ltr">${t.owned}/${t.total}</bdi></b></div></div>
      <div class="al-side">${side('heroes', '🛡 الأبطال')}${side('exclusive', '🌟 حصريات الأحداث')}${side('items', '⚔ المعدات والتعاويذ')}</div>`;
  }

  function render() {
    const root = $('codex'); if (!root) return;
    const t = A.total(), as = A.allState(), rwAll = AMB.ECONOMY.album.all, k = PAGES[page];
    const readyOn = (key) => key !== 'items' && A.pageReady(key).length;
    root.innerHTML = `<div class="al-head"><div class="al-total"><b>${t.owned}/${t.total}</b> وحدة<div class="al-bar big"><i style="width:${(100 * t.owned) / t.total}%"></i></div></div>
        <div class="al-grand ${as}">${as === 'claimed' ? '✓ ' : '🏆 '}كل الوحدات: ${rewardText(rwAll)}
          ${as === 'ready' ? '<button class="btn primary" data-act="albClaimAll">استلم</button>' : ''}</div>
        <button class="ibtn" data-act="info" data-k="albinfo" title="شرح">ⓘ</button></div>
      ${hub ? hubHTML(t) : `<div class="al-top"><button class="btn small ghost" data-act="albOpen" data-p="-1">‹ خريطة العوالم</button></div>`}
      ${hub ? '' : `<div class="al-book" style="--wc:${pageColor(k)}">
        <div class="al-pagehead"><button class="al-flip" data-act="albGo" data-d="1" ${page >= PAGES.length - 1 ? 'disabled' : ''}>›</button>
          <div class="al-title"><small>الصفحة ${page + 1} من ${PAGES.length}</small><h3>${pageName(k)}</h3>${W(k) && W(k).lore ? `<p class="al-lore">${W(k).lore}</p>` : ''}</div>
          <button class="al-flip" data-act="albGo" data-d="-1" ${page <= 0 ? 'disabled' : ''}>‹</button></div>
        <div class="al-sheet ${dir > 0 ? 'in-r' : dir < 0 ? 'in-l' : ''}">${pageHTML(k)}</div>
        <div class="al-dots">${PAGES.map((key, i) => `<button class="${i === page ? 'on' : ''}" data-act="albGoTo" data-i="${i}" title="${pageName(key)}">${readyOn(key) ? '<i></i>' : ''}</button>`).join('')}</div>
      </div>`}`;
    dir = 0;
    refreshMenu();
  }

  function refreshMenu() {
    const b = $('menu-album'); if (!b) return;
    const n = A.readyCount(), l = b.querySelector('.mt-l');
    l.innerHTML = `الألبوم${n ? `<span class="dot">${n}</span>` : ''}`;
  }

  function celebrate(res, packs) {
    const ui = UI();
    ui.sfx('merge');
    const cards = (packs || []).flatMap((p) => p.cards);
    ui.overlay(`<div class="rv-wrap"><h2>🏆 كمّلت الصفحة!</h2><p class="cam-pay">${rewardText(res.reward)}</p>
      ${cards.length ? `<div class="cam-pack-row">${cards.map((c, i) => `<div class="cu">${ui.portrait(C.def(c.id), { k: 'alr' + i + c.id })}<small style="color:${RAR[c.rarity].color}">${RAR[c.rarity].name}${c.isNew ? ' · جديدة!' : ''}</small></div>`).join('')}</div>` : ''}
      ${res.reward.title ? `<p class="hint">جهّز اللقب والإطار من «ممر الصدع» ← «ملفي»</p>` : ''}
      <div class="rv-btns"><button class="btn primary" data-act="packDone">تم</button></div></div>`);
    // kid #8: a completed page is a party: confetti in the world's colours
    setTimeout(() => { const h = document.querySelector('#overlay .rv-wrap h2'); if (h && ui.burst) ['#ffd24a', '#ff5aa0', '#5fe3ff', '#ffffff'].forEach((c, i) => setTimeout(() => ui.burst(h, c, 18, { r: 160, s: 8 }), i * 120)); }, 200);
  }

  AMB.TIPS = AMB.TIPS || {};
  AMB.TIPS.albinfo = () => ({ title: 'الألبوم', html: `<p>كل بطاقات اللعبة هنا. البطاقة اللي ما تملكها تطلع ظل مع طريقة الحصول عليها.</p>
    <p>الألبوم كتاب: كل صفحة عالم، وتقلبها بالأسهم أو بسحبة. كل شخصية تحصل عليها لأول مرة تعطيك <b>٥٠ شظية</b> (والأسطوري <b>١٠٠</b>)، وفي نهاية الصفحة زر <b>استلام الكل</b>. شخصيات البداية ما تعطي جائزة.</p>
    <p>وإكمال كل شخصيات عالم يعطيك جائزة العالم (شظايا + لقب + إطار)، وكل الوحدات = باكجات + لقب «جامع الصدع».</p>` });

  function installActions() {
    const ui = UI(); if (!ui || ui.ACT.albClaim) return;
    Object.assign(ui.ACT, {
      albOpen: (d) => { const i = +d.p; if (i < 0) { hub = true; } else { hub = false; dir = i > page ? 1 : i < page ? -1 : 0; page = i; } ui.sfx('click'); render(); window.scrollTo(0, 0); },
      albGo: (d) => { page = Math.max(0, Math.min(PAGES.length - 1, page + +d.d)); dir = +d.d; ui.sfx('click'); render(); },
      albGoTo: (d) => { const i = +d.i; dir = i > page ? 1 : -1; page = i; ui.sfx('click'); render(); },
      albCard: (d) => { const r = A.claimCard(d.id); if (!r) return; ui.sfx('merge'); ui.toast(`+${r.shards} شظية`, 'good'); render(); ['PacksUI', 'PassUI'].forEach((k) => AMB[k] && AMB[k].refreshMenu && AMB[k].refreshMenu()); },
      albPage: (d) => { const r = A.claimPage(d.k); if (!r) return; ui.sfx('merge'); ui.toast(`+${r.shards} شظية من ${r.count} ${r.count === 1 ? 'شخصية' : 'شخصيات'}`, 'good'); render(); ['PacksUI', 'PassUI'].forEach((k) => AMB[k] && AMB[k].refreshMenu && AMB[k].refreshMenu()); },
      albClaim: (d) => { const r = A.claim(d.w); if (!r) return; celebrate(r); render(); ['PacksUI', 'PassUI'].forEach((k) => AMB[k] && AMB[k].refreshMenu && AMB[k].refreshMenu()); },
      albClaimAll: () => { const r = A.claimAll(); if (!r) return; celebrate(r, r.packs); render(); ['PacksUI', 'CollectionUI'].forEach((k) => AMB[k] && AMB[k].refreshMenu && AMB[k].refreshMenu()); },
    });
  }

  // swipe between pages
  (function swipe() {
    let x0 = null;
    document.addEventListener('touchstart', (e) => { x0 = e.target.closest && e.target.closest('#codex .al-book') ? e.touches[0].clientX : null; }, { passive: true });
    document.addEventListener('touchend', (e) => {
      if (x0 == null) return; const dx = e.changedTouches[0].clientX - x0; x0 = null;
      if (Math.abs(dx) < 70) return;
      // RTL book: swipe right = next page
      const d = dx > 0 ? 1 : -1, np = page + d; if (np < 0 || np >= PAGES.length || !UI()) return;
      page = np; dir = d; render();
    }, { passive: true });
  })();
  AMB.AlbumUI = { render, refreshMenu, installActions };
  if (UI()) installActions();
  refreshMenu();
})();
