/*
 * "مجموعتي" screen: every card with its rarity, level and duplicate copies, and the upgrade button.
 * Logic lives in core/collection.js. Card levels only count in progression fights (campaign, tower, events).
 */
(function () {
  const AMB = globalThis.AMB;
  const $ = (id) => document.getElementById(id);
  const C = AMB.collection, RAR = AMB.ECONOMY.rarities;
  const { icon } = AMB.art;
  const UI = () => globalThis.AMB_UI;
  let firstVisit = null;   // null until the screen is first drawn in this session
  let justUp = '', filter = '', roleF = '', deckOnly = false, upOnly = false;   // rarity filter ('' = all), role filter, show only the deck

  const pct = (a, b) => (b ? Math.min(100, Math.round((a / b) * 100)) : 100);

  // where can a locked card come from?
  function unlockHint(id) {
    const P = AMB.Pass; let src = '';
    if (P) for (const [lv, r] of Object.entries(P.FREE)) if (!src && r.type === 'avatar' && r.id === id) src = `الباتل باس: مستوى ${lv}`;   // the premium track is not available yet, so it is not advertised
    if (AMB.DATA.UNITS[id] && AMB.DATA.UNITS[id].exclusive) return 'حصرية: الحدث الأسبوعي';
    return src ? `باكجات · ${src}` : 'من الباكجات';
  }
  function tile(id) {
    const d = C.def(id), owned = C.owned(id), lv = C.level(id), need = C.needed(id), have = C.copies(id), max = C.isMax(id);
    const card = UI().cardHTML(d, { k: 'col' + id, lvl: owned ? (d.role || !AMB.heroes ? lv : AMB.heroes.level(id)) : 0, pow: owned && d.role ? C.power(id) : 1, cls: owned ? '' : 'unowned', attrs: `data-act="${d.role ? 'detail' : 'heroInfo'}" data-id="${id}"` });
    const bar = max ? '<div class="cp-bar max"><i style="width:100%"></i><span>المستوى الأقصى ✓</span></div>'
      : `<div class="cp-bar ${have >= need ? 'ready' : ''}"><i style="width:${pct(have, need)}%"></i><span>نسخ ${have}/${need}</span></div>`;
    const gain = Math.round(AMB.ECONOMY.cards.levelBonus * 100);
    const btn = !owned ? `<span class="cp-lock">🔒 ${unlockHint(id)}</span>`
      : max ? '' : C.canUpgrade(id) ? `<button class="btn small primary" data-act="colUpgrade" data-id="${id}">⬆ طوّر +${gain}%</button>`
      : `<span class="cp-need">تحتاج ${need - have} نسخة ${need - have === 1 ? 'زيادة' : 'زيادة'} من الباكجات</span>`;
    const bonus = Math.round((C.power(id) - 1) * 100);
    const inDeck = d.role && owned && C.inDeck(id);
    const dk = d.role && owned ? `<button class="btn small dk ${inDeck ? 'on' : ''}" data-act="colDeck" data-id="${id}">${inDeck ? '✓ في الديك' : '＋ للديك'}</button>` : '';
    return `<div class="cp-tile ${inDeck ? 'indeck' : ''}" data-card="${id}">${card}${owned ? bar : ''}<div class="cp-foot">${btn}<span class="cp-pow" title="قوة البطاقة في الحملة والبرج">${bonus > 0 ? '+' + bonus + '%' : '±0%'}</span></div>${dk ? `<div class="cp-foot">${dk}</div>` : ''}</div>`;
  }

  AMB.TIPS = AMB.TIPS || {};
  AMB.TIPS.colinfo = () => ({ title: 'تطوير البطاقات', html: `<p>كل مستوى +${Math.round(AMB.ECONOMY.cards.levelBonus * 100)}% صحة وهجوم، والندرة الأعلى أقوى بس تحتاج نسخ أكثر.</p>
    <p>النسخ المطلوبة للمستويات 2 إلى 5:</p>${Object.entries(RAR).map(([k, r]) => `<div class="hint">• <b style="color:${r.color}">${r.name}</b>: ${r.copies.join(' / ')}</div>`).join('')}
    <p><b>المستويات والندرة تنحسب في كل الأطوار</b> (الحملة والبرج والأحداث والمباراة السريعة وضد صاحبك)، إلا «على نفس الجهاز» فالاثنين متساويين.</p>` });
  // the deck strip: your 12 slots, role counts, auto-build. Progression fights shop only from this deck.
  function deckBar() {
    const L = C.deckLimits(), deck = C.deck(), rc = C.roleCounts(deck), ROLE = AMB.DATA.ROLES, ui = UI();
    const slots = []; for (let i = 0; i < L.size; i++) slots.push(deck[i] ? `<button class="dslot" data-act="colDeck" data-id="${deck[i]}" title="${C.def(deck[i]).name}: اضغط للإزالة">${ui.portrait(C.def(deck[i]), { k: 'dk' + i + deck[i] })}</button>` : `<i class="dslot empty"></i>`);
    const ok = deck.length >= L.min;
    return `<div class="deck-bar ${ok ? '' : 'bad'}"><div class="db-top"><b>🃏 ديكك <span>${deck.length}/${L.size}</span></b>
        <span class="db-btns"><button class="btn small primary" data-act="colAuto">ترتيب تلقائي</button><button class="btn small ghost" data-act="colClear">تفريغ</button><button class="ibtn" data-act="info" data-k="deckinfo" title="شرح">ⓘ</button></span></div>
      <div class="db-slots">${slots.join('')}</div>
      <div class="db-roles">${Object.entries(rc).map(([r, n]) => `<span class="${n ? '' : 'z'}">${icon(AMB.art.ROLE_ICON[r])}${ROLE[r].name} ${n}</span>`).join('')}</div>
      ${ok ? '' : `<div class="db-warn">تحتاج ${L.min} وحدات على الأقل في الديك (وإلا تدخل بكل وحداتك)</div>`}</div>`;
  }
  AMB.TIPS.deckinfo = () => ({ title: 'الديك', html: `<p>الديك هو <b>الوحدات اللي تطلع لك في المتجر</b> أثناء الحملة والبرج والأحداث (حتى ${C.deckLimits().size} وحدة، والحد الأدنى ${C.deckLimits().min}). اختر الأدوار والعوالم اللي تكمّل بعض عشان التآزر.</p>
    <p>المباراة السريعة وعلى نفس الجهاز ما تستخدم الديك: الكل يلعب بكل الوحدات. والأبطال خارج الديك.</p><p>«ترتيب تلقائي» يختار لك ديك متوازن من أقوى بطاقاتك.</p>` });
  function render() {
    const root = $('collection'); if (!root) return;
    const ids = C.ids().filter((id) => (!filter || C.rarity(id) === filter) && (!roleF || C.def(id).role === roleF) && (!deckOnly || C.inDeck(id)) && (!upOnly || C.canUpgrade(id) || id === justUp))
      .sort((a, b) => RAR[C.rarity(b)].order - RAR[C.rarity(a)].order || (C.def(a).role ? 1 : 0) - (C.def(b).role ? 1 : 0));
    const ready = C.ids().filter((id) => C.canUpgrade(id)).length;
    const fb = (v, n, col) => `<button class="btn small ${filter === v ? 'on' : ''}" data-act="colFilter" data-v="${v}" ${col ? `style="--rc:${col}"` : ''}>${n}</button>`;
    // the deck and the "how to upgrade" box fold away so the cards show up sooner: open on the first visit, folded after that (each remembers the player's choice)
    const ST = AMB.settings;
    if (firstVisit === null) { firstVisit = !(ST && ST.seen('colVisited')); if (ST) ST.markSeen('colVisited'); }
    const isOpen = (k) => !(ST ? ST.folded(k, !firstVisit) : false);
    const L = C.deckLimits(), dn = C.deck().length;
    root.innerHTML = `<div class="col-head">
        ${C.needsStarter() ? '' : `<details class="col-fold" data-fold="colDeck" ${isOpen('colDeck') ? 'open' : ''}><summary><b>🃏 ديكك <span class="${dn >= L.min ? '' : 'bad'}">${dn}/${L.size}</span></b><small>للحملة والبرج والأحداث</small></summary>${deckBar()}</details>`}
        ${C.needsStarter() ? '<div class="col-starter">ما اخترت بطلك الأول للحين: اضغط «العب» واختر واحد من الأربعة.</div>' : ''}
        <div><b>${C.ownedCount()} / ${C.ids().length}</b> بطاقة · ${ready ? `<span class="col-ready">${ready} جاهزة للتطوير</span>` : 'ما فيه ترقيات جاهزة'}</div>
        <details class="col-fold" data-fold="colHow" ${isOpen('colHow') ? 'open' : ''}><summary><b>كيف أطوّر بطاقاتي؟</b>${ready ? `<small class="col-ready">⬆ ${ready} جاهزة</small>` : ''}</summary>
        <div class="up-how">كل نسخة <u>مكررة</u> من باكج تروح لبطاقتها. لما يكتمل شريط النسخ يطلع زر <b>⬆ طوّر</b> ويرفع قوتها <b>+${Math.round(AMB.ECONOMY.cards.levelBonus * 100)}%</b> في الحملة والبرج والأحداث.
          ${ready ? `<button class="btn small primary" data-act="colRole" data-v="up">⬆ ${ready} جاهزة الحين</button>` : '<span class="hint">ما فيه بطاقة جاهزة الحين، افتح باكجات.</span>'} <button class="ibtn" data-act="info" data-k="colinfo" title="شرح">ⓘ</button></div>
        <div class="rar-legend">${Object.entries(RAR).map(([k, r]) => `<span class="rl r-${k}"><i></i>${r.name} <small>+${Math.round((r.power - 1) * 100)}%</small></span>`).join('')}</div>
        <button class="btn primary small" data-act="go" data-to="packs">افتح باكجات للحصول على نسخ</button></details>
        <div class="filters">${fb('', 'الكل')}${Object.entries(RAR).map(([k, r]) => fb(k, r.name, r.color)).join('')}</div>
        <div class="filters"><button class="btn small ${roleF === '' && !deckOnly && !upOnly ? 'on' : ''}" data-act="colRole" data-v="">كل الأدوار</button><button class="btn small ${upOnly ? 'on' : ''}" data-act="colRole" data-v="up">⬆ جاهزة للتطوير</button><button class="btn small ${deckOnly ? 'on' : ''}" data-act="colRole" data-v="deck">الديك فقط</button>${Object.entries(AMB.DATA.ROLES).map(([k, r]) => `<button class="btn small ${roleF === k ? 'on' : ''}" data-act="colRole" data-v="${k}">${r.name}</button>`).join('')}</div>
      </div>
      <div class="col-grid">${ids.map(tile).join('')}</div>`;
    refreshMenu();
  }

  function refreshMenu() {
    const b = $('menu-cards'); if (!b) return;
    const n = C.ids().filter((id) => C.canUpgrade(id)).length;
    (b.querySelector('.mt-l') || b).innerHTML = `مجموعتي${n ? `<span class="dot">${n}</span>` : ''}`;
  }

  function installActions() {
    const ui = UI(); if (!ui || ui.ACT.colUpgrade) return;
    Object.assign(ui.ACT, {
      colFilter: (d) => { justUp = ''; filter = d.v || ''; render(); },
      colRole: (d) => { justUp = ''; deckOnly = d.v === 'deck'; upOnly = d.v === 'up'; roleF = deckOnly || upOnly ? '' : (d.v || ''); render(); },
      colDeck: (d) => { const r = C.toggleDeck(d.id); if (!r.ok) { ui.toast(r.reason, 'err'); return; } ui.sfx('click'); const y = window.scrollY; render(); window.scrollTo(0, y); },
      colAuto: () => { C.autoBuild(); ui.sfx('merge'); ui.toast('تم ترتيب ديك متوازن', 'good'); render(); },
      colClear: () => { C.setDeck([]); render(); },
      deckEdit: () => { ui.closeModal(); ui.show('cards'); },
      colUpgrade: (d) => {
        const id = d.id, d0 = C.def(id), before = C.level(id), p0 = C.power(id);
        const lv = C.upgrade(id); if (!lv) return;
        justUp = id;
        ui.sfx('merge');
        const g = (v, p) => Math.round(v * p), p1 = C.power(id), c = AMB.ECONOMY.cards.levelBonus;
        const row = (n, a, b) => `<div class="up-row"><span>${n}</span><b>${a}</b><i>←</i><b class="new">${b}</b></div>`;
        const rows = (d0.hp ? row('❤️ الصحة', g(d0.hp, p0), g(d0.hp, p1)) + row('⚔️ الهجوم', g(d0.atk, p0), g(d0.atk, p1)) : '') + row('📈 القوة في الحملة', '+' + Math.round((p0 - 1) * 100) + '%', '+' + Math.round((p1 - 1) * 100) + '%');
        const nx = C.isMax(id) ? 'وصلت المستوى الأقصى ✓' : `للمستوى التالي: ${C.copies(id)}/${C.needed(id)} نسخ`;
        ui.modal(`<h2>تطوّرت ${d0.name}!</h2><div class="up-card">${ui.cardHTML(d0, { k: 'up' + id, lvl: lv, pow: C.power(id) })}</div>
          <div class="up-lv">المستوى ${before} ← <b>${lv}</b></div><div class="up-rows">${rows}</div>
          <p class="hint">كل مستوى يزيد الصحة والهجوم +${Math.round(c * 100)}%. السرعة والمدى ما تتغير. ينحسب في كل الأطوار ما عدا «على نفس الجهاز».</p><p class="hint">${nx}</p>`);
        render();
        const el = document.querySelector('#modal .tcard');
        if (el && ui.burst) [RAR[C.rarity(id)].color, '#ffffff', '#ffd24a'].forEach((cc) => ui.burst(el, cc, 14, { r: 100, s: 6 }));
      },
    });
  }

  // used before a progression fight: no valid deck -> build one for you; and a one-line summary for the fight previews
  AMB.DeckGate = {
    ensure() { if (!C.deckValid()) { C.autoBuild(); if (UI()) UI().toast('رتبت لك ديك تلقائي', 'good'); } return true; },
    line() { const L = C.deckLimits(), n = C.deck().length; return `<div class="deck-line ${n >= L.min ? '' : 'bad'}">🃏 ديكك: <b>${n}/${L.size}</b>${n >= L.min ? '' : ' (ناقص: يرتّب لك تلقائيًا)'} <button class="btn small" data-act="deckEdit">عدّل</button></div>`; },
  };
  // remember each folded section (the toggle event does not bubble: listen in the capture phase)
  document.addEventListener('toggle', (e) => { const d = e.target; if (d && d.dataset && d.dataset.fold && AMB.settings) AMB.settings.setFolded(d.dataset.fold, !d.open); }, true);
  AMB.CollectionUI = { render, refreshMenu, installActions, unlockHint };
  if (UI()) installActions();
  refreshMenu();
})();
