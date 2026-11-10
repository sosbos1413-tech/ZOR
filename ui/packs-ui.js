/*
 * "الباكجات" screen: buy/open packs with shards, see the odds and the legendary pity counter,
 * and a card-by-card reveal. Logic lives in core/packs.js.
 */
(function () {
  const AMB = globalThis.AMB;
  const $ = (id) => document.getElementById(id);
  const P = AMB.packs, C = AMB.collection, W = AMB.wallet, RAR = AMB.ECONOMY.rarities;
  const { icon } = AMB.art;
  const UI = () => globalThis.AMB_UI;
  const PACK = 'basic';
  let busy = false;

  const shardsHTML = (n) => `<span class="shards">${icon('gem')}<b>${n.toLocaleString('en-US')}</b></span>`;

  AMB.TIPS = AMB.TIPS || {};
  AMB.TIPS.pity = () => { const d = P.def(PACK), R = RAR[d.pity.rarity]; return { title: 'ضمان ' + R.name, html: `<p>إذا فتحت ${d.pity.after} باكجات بدون ${R.name}، الباكج اللي بعدها يحتوي ${R.name} أكيد. العدّاد يرجع للصفر كلما طلعت لك ${R.name}.</p>` }; };
  AMB.TIPS.shards = () => ({ title: 'الشظايا', html: '<p>الشظايا تجيك من الحملة والمهام اليومية والدخول اليومي.</p><p>اللعبة ما تبيع شي بفلوس حقيقية.</p>' });
  AMB.TIPS.odds = () => ({ title: 'النسب', html: `<p>مع الضمان، المعدل الفعلي للـ${RAR.legendary.name} تقريبًا بطاقة كل 8–9 باكجات.</p><p>النسخة المكررة تطوّر البطاقة، ونسخة بطاقة وصلت لأعلى مستوى تتحوّل إلى شظايا.</p>` });
  // adult #25: the wish: pick the hero you want; the legendary guarantee brings it
  function wishHTML() {
    const missing = Object.values(AMB.DATA.HEROES).filter((h) => !h.exclusive && !(AMB.collection && AMB.collection.owned(h.id)));
    if (!missing.length) return '';
    const w = P.wish && P.wish(), h = w ? AMB.DATA.HEROES[w] : null;
    return `<div class="pk-wish"><span>🎯 أمنيتي: <b>${h ? h.name : 'ما اخترت'}</b></span><button class="btn small" data-act="wishPick">${h ? 'غيّر' : 'اختر بطل'}</button>
      <small>لما يشتغل ضمان الأسطوري، يجيك البطل اللي اخترته.</small></div>`;
  }
  function pityHTML() {
    const d = P.def(PACK), left = P.pityLeft(PACK), done = d.pity.after - left;
    const segs = Array.from({ length: d.pity.after }, (_, i) => `<i class="${i < done ? 'on' : ''}"></i>`).join('');
    const R = RAR[d.pity.rarity];
    // kid #10: the guarantee counter is folded behind a small "ⓘ الضمان" line (no countdown pushing to open more)
    return `<details class="pity-fold"><summary>ⓘ الضمان</summary><div class="pity ${left === 0 ? 'ready' : ''}" style="--rc:${R.color}">
      <div class="pity-t">${left === 0 ? `🎉 الباكج الجاي فيه <b>${R.name}</b> مضمون!` : `باقي <b>${left}</b> على ضمان <b>${R.name}</b>`} <button class="ibtn" data-act="info" data-k="pity" title="شرح">ⓘ</button></div>
      <div class="pity-bar">${segs}</div>
      </div></details>`;
  }

  function render() {
    const root = $('packs'); if (!root) return;
    const d = P.def(PACK), cost = d.cost.shards, st = P.stats();
    const odds = P.oddsTable(PACK).map((o) => `<li class="r-${o.rarity}"><i></i>${RAR[o.rarity].name}<b>${o.pct.toFixed(o.pct < 1 ? 1 : 0)}%</b></li>`).join('');
    root.innerHTML = `<div class="pk-top">${shardsHTML(W.balance('shards'))}<button class="ibtn" data-act="info" data-k="shards" title="شرح">ⓘ</button></div>
      <div class="pk-main">
        <div class="pk-pack"><div class="pk-art"><span class="pk-logo">ZOR</span><span class="pk-name">${d.name}</span><span class="pk-n">${d.cards} بطاقات</span></div>
          <button class="btn primary big" data-act="packOpen" ${W.canAfford(d.cost) ? '' : 'disabled'}>افتح · ${icon('gem')} ${cost}</button>
          ${W.canAfford({ shards: cost * 2 }) ? `<button class="btn" data-act="packOpen5">افتح ×${Math.min(5, Math.floor(W.balance ? W.balance('shards') / cost : 5))} مرة وحدة</button>` : ''}
          ${W.canAfford(d.cost) ? '' : `<div class="hint">تحتاج ${cost - W.balance('shards')} شظية إضافية</div>`}</div>
        <div class="pk-side">${pityHTML()}
          <div class="pk-odds"><b>نسبة ظهور كل بطاقة</b><ul>${odds}</ul>
            <button class="ibtn" data-act="info" data-k="odds" title="شرح">ⓘ</button></div>
          <div class="pk-stats hint">فتحت ${st.opened} باكج · ${Object.keys(RAR).map((r) => `${RAR[r].name}: ${st.found[r] || 0}`).join(' · ')}</div>
          <button class="btn" data-act="go" data-to="cards">مجموعتي ←</button></div>
      </div>`;
    refreshMenu();
  }

  function refreshMenu() {
    const b = $('menu-packs'); if (!b) return;
    const n = Math.floor(W.balance('shards') / P.def(PACK).cost.shards);
    (b.querySelector('.mt-l') || b).innerHTML = `الباكجات${n ? `<span class="dot">${n}</span>` : ''}`;
  }

  function tagFor(c) {
    if (c.refund) return `<span class="rv-tag gold">+${c.refund} ${icon('gem')}</span>`;
    if (c.isNew) return '<span class="rv-tag new">جديدة!</span>';
    if (c.canUpgrade) return '<span class="rv-tag up">↑ جاهزة للتطوير</span>';
    return `<span class="rv-tag">+1 نسخة · ${c.copies}/${C.needed(c.id) || '—'}</span>`;
  }

  function reveal(res) {
    const ui = UI(), FX = AMB.FX;
    const best = res.cards.reduce((b, c) => (RAR[c.rarity].order > RAR[b.rarity].order ? c : b), res.cards[0]);
    // the rarest cards turn last, after a build-up
    const order = res.cards.map((c, i) => ({ c, i })).sort((a, b) => RAR[a.c.rarity].order - RAR[b.c.rarity].order || a.i - b.i).map((x) => x.c);
    const T = FX ? FX.revealTimes(order) : order.map((_, i) => 0.35 + i * 0.45);
    const cards = order.map((c, i) => `<div class="rv" style="--d:${T[i].toFixed(2)}s;--rc:${RAR[c.rarity].color}" data-r="${c.rarity}">
        ${RAR[c.rarity].order >= 3 ? '<i class="rv-rays"></i>' : ''}<div class="rv-in"><div class="rv-back"><span>ZOR</span></div><div class="rv-front">${ui.cardHTML(C.def(c.id), { k: 'rv' + i + c.id, lvl: c.level })}${tagFor(c)}</div></div></div>`).join('');
    // UI v2: bigger cards (3 + 2 on phones), the rarest last with a longer build-up, and a «تخطي» button that turns the rest at once
    ui.overlay(`<div class="rv-wrap rv2 ${'best-' + best.rarity}"><h2>${res.forced ? 'الضمان اشتغل! ' : ''}${RAR[best.rarity].name === RAR.legendary.name ? '✨ أسطوري! ✨' : 'باكج الصدع'}</h2>
      <div class="rv-row">${cards}</div>
      ${res.refund ? `<p class="hint">نسخ بطاقات بالمستوى الأقصى تحوّلت إلى ${res.refund} شظية.</p>` : ''}
      <div class="rv-btns"><button class="btn rv-skip" data-act="rvSkip">${icon('skip')} تخطي</button><button class="btn primary big" data-act="packDone" data-to="cards">${res.cards.some((c) => c.isNew) ? '🎉 شوف شخصياتك الجديدة' : '📚 شوف مجموعتك'}</button>
        <button class="btn ghost" data-act="packOpen" ${W.canAfford(P.def(PACK).cost) ? '' : 'disabled'}>باكج ثاني · ${icon('gem')} ${P.def(PACK).cost.shards}</button><button class="btn ghost" data-act="packDone">تم</button></div></div>`);
    const wrap = document.querySelector('.rv-wrap');
    const timers = [];
    const at = (fn, ms) => timers.push(setTimeout(fn, ms));
    const live = () => $('overlay').classList.contains('on') && wrap.isConnected;
    order.forEach((c, i) => {
      const L = RAR[c.rarity].order;
      if (FX && L >= 3) at(() => { if (live()) FX.charge(wrap, c.rarity); }, Math.max(0, T[i] * 1000 - (L === 4 ? 1300 : 600)));
      at(() => {
        if (!live()) return;
        const el = wrap.querySelectorAll('.rv')[i];
        if (FX) FX.reveal(el, c.rarity, wrap, c); else ui.sfx(L >= 3 ? 'merge' : 'click');
        if (i === order.length - 1) wrap.classList.add('rv-done');
      }, T[i] * 1000 + 300);
    });
    // skip: stop the remaining timers, turn every card now, and give the best card its effect once
    wrap._skip = () => {
      if (wrap.classList.contains('rv-done')) return;
      timers.forEach(clearTimeout); timers.length = 0;
      ['rv-charge-3', 'rv-charge-4'].forEach((k) => wrap.classList.remove(k));
      wrap.classList.add('rv-skipped', 'rv-done');
      const els = wrap.querySelectorAll('.rv');
      els.forEach((el) => el.classList.add('hit'));
      const bi = order.indexOf(best);
      if (FX && els[bi]) FX.reveal(els[bi], best.rarity, wrap, best); else ui.sfx('click');
    };
  }

  function installActions() {
    const ui = UI(); if (!ui || ui.ACT.packOpen) return;
    Object.assign(ui.ACT, {
      wishPick: () => {
        const missing = Object.values(AMB.DATA.HEROES).filter((h) => !h.exclusive && !(AMB.collection && AMB.collection.owned(h.id)));
        ui.modal(`<h2>🎯 أي بطل تبي؟</h2><div class="hero-grid wish-grid">${missing.map((h) => `<button class="wish-h" data-act="wishSet" data-id="${h.id}">${ui.portrait(h, { k: 'wsh' + h.id })}<b>${h.name}</b></button>`).join('')}</div>`);
      },
      wishSet: (d) => { if (P.setWish(d.id)) { ui.closeModal(); ui.toast(`🎯 ${AMB.DATA.HEROES[d.id].name} صار أمنيتك`, 'good'); render(); } },
      packOpen: () => {
        if (busy) return; busy = true; setTimeout(() => (busy = false), 600);
        const res = P.open(PACK);
        if (!res) { ui.toast('ما عندك شظايا كافية', 'err'); return; }
        render(); reveal(res);
      },
      // adult #27: open several packs at once, one summary (new characters first)
      packOpen5: () => {
        if (busy) return; busy = true; setTimeout(() => (busy = false), 600);
        const all = []; let n = 0, refund = 0;
        while (n < 5 && P.canOpen(PACK)) { const r = P.open(PACK); if (!r) break; n++; refund += r.refund || 0; all.push(...r.cards); }
        if (!n) { ui.toast('ما عندك شظايا كافية', 'err'); return; }
        render(); ui.sfx('merge');
        all.sort((a, b) => (b.isNew ? 1 : 0) - (a.isNew ? 1 : 0) || RAR[b.rarity].order - RAR[a.rarity].order);
        ui.overlay(`<div class="rv-wrap"><h2>📦 ×${n} باكجات</h2><p class="hint">${all.filter((c) => c.isNew).length} شخصية جديدة${refund ? ` · ${refund} شظية من النسخ الزايدة` : ''}</p>
          <div class="cam-pack-row">${all.map((c, i) => `<div class="cu">${ui.portrait(C.def(c.id), { k: 'p5' + i + c.id })}<small style="color:${RAR[c.rarity].color}">${RAR[c.rarity].name}${c.isNew ? ' · جديدة!' : ''}</small></div>`).join('')}</div>
          <div class="rv-btns"><button class="btn primary big" data-act="packDone" data-to="cards">${all.some((c) => c.isNew) ? '🎉 شوف شخصياتك الجديدة' : '📚 شوف مجموعتك'}</button><button class="btn ghost" data-act="packDone">تم</button></div></div>`);
      },
      rvSkip: () => { const w = document.querySelector('#overlay .rv-wrap'); if (w && w._skip) w._skip(); },
      packDone: (d) => { ui.closeOverlay(); if (d.to) ui.show(d.to); else render(); },
    });
  }

  AMB.PacksUI = { render, refreshMenu, installActions, reveal };
  if (UI()) installActions();
  refreshMenu();
})();
