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
  const hint = (id) => (AMB.CollectionUI ? AMB.CollectionUI.unlockHint(id) : 'من الباكجات');

  function cardTile(id) {
    const d = C.def(id), owned = C.owned(id);
    const card = UI().cardHTML(d, { k: 'alb' + id, lvl: owned ? C.level(id) : 0, cls: owned ? '' : 'unowned', attrs: `data-act="${d.role ? 'detail' : 'heroInfo'}" data-id="${id}"` });
    return `<div class="al-tile ${owned ? '' : 'miss'}">${card}${owned ? '' : `<small class="al-hint">🔒 ${hint(id)}</small>`}</div>`;
  }

  function rewardText(rw) {
    const bits = [];
    if (rw.shards) bits.push(`${icon('gem')} ${rw.shards}`);
    if (rw.packs) bits.push(`📦 ${rw.packs === 1 ? 'باكج' : rw.packs + ' باكجات'}`);
    if (rw.title) bits.push(`لقب «${P.COSMETICS.title[rw.title].name}»`);
    if (rw.frame) bits.push(`إطار`);
    return bits.join(' · ');
  }

  function worldSection(w) {
    const p = A.progress(w), st = A.state(w), rw = A.reward(w);
    const btn = st === 'ready' ? `<button class="btn primary" data-act="albClaim" data-w="${w}">استلم الجائزة</button>` : st === 'claimed' ? '<span class="al-done">✓ تم الاستلام</span>' : '';
    return `<section class="al-world ${st}" style="--wc:${W(w).color}">
      <header><h3>${W(w).name}</h3><span class="al-count">${p.owned}/${p.total}</span><span class="al-rw">${rewardText(rw)}</span>${btn}</header>
      <div class="al-bar"><i style="width:${(100 * p.owned) / p.total}%"></i></div>
      <div class="al-grid">${A.units(w).sort((a, b) => AMB.DATA.UNITS[a].tier - AMB.DATA.UNITS[b].tier).map(cardTile).join('')}</div></section>`;
  }

  function render() {
    const root = $('codex'); if (!root) return;
    const t = A.total(), as = A.allState(), rwAll = AMB.ECONOMY.album.all;
    root.innerHTML = `<div class="al-head"><div class="al-total"><b>${t.owned}/${t.total}</b> وحدة<div class="al-bar big"><i style="width:${(100 * t.owned) / t.total}%"></i></div></div>
        <div class="al-grand ${as}">${as === 'claimed' ? '✓ ' : '🏆 '}كل الوحدات: ${rewardText(rwAll)}
          ${as === 'ready' ? '<button class="btn primary" data-act="albClaimAll">استلم</button>' : ''}</div>
        <button class="ibtn" data-act="info" data-k="albinfo" title="شرح">ⓘ</button></div>
      ${A.worlds().map(worldSection).join('')}
      <section class="al-world" style="--wc:#ff5a64"><header><h3>الأبطال</h3><span class="al-count">${C.ownedHeroes().length}/${A.heroes().length}</span></header>
        <div class="al-grid">${A.heroes().map((h) => cardTile(h.id)).join('')}</div></section>
      <section class="al-world" style="--wc:#ffd24a"><header><h3>🌟 حصريات الأحداث</h3><span class="al-count">${A.exclusives().filter((id) => C.owned(id)).length}/${A.exclusives().length}</span></header>
        <div class="al-grid">${A.exclusives().map(cardTile).join('')}</div></section>
      <h3 class="al-items-h">المعدات والتعاويذ</h3><div class="codex-grid">${UI().itemsHTML()}</div>`;
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
    ui.overlay(`<div class="rv-wrap"><h2>🏆 جائزة الألبوم</h2><p class="cam-pay">${rewardText(res.reward)}</p>
      ${cards.length ? `<div class="cam-pack-row">${cards.map((c, i) => `<div class="cu">${ui.portrait(C.def(c.id), { k: 'alr' + i + c.id })}<small style="color:${RAR[c.rarity].color}">${RAR[c.rarity].name}${c.isNew ? ' · جديدة!' : ''}</small></div>`).join('')}</div>` : ''}
      ${res.reward.title ? `<p class="hint">جهّز اللقب والإطار من «ممر الصدع» ← «ملفي»</p>` : ''}
      <div class="rv-btns"><button class="btn primary" data-act="packDone">تم</button></div></div>`);
  }

  AMB.TIPS = AMB.TIPS || {};
  AMB.TIPS.albinfo = () => ({ title: 'الألبوم', html: `<p>كل بطاقات اللعبة هنا. البطاقة اللي ما تملكها تظهر ظلًا مع طريقة الحصول عليها.</p>
    <p>اجمع <b>الوحدات الخمس</b> لأي عالم واستلم جائزته مرة واحدة (شظايا + لقب + إطار بلون العالم). وكل الوحدات العشرين = باكجين + لقب «جامع الصدع».</p>` });

  function installActions() {
    const ui = UI(); if (!ui || ui.ACT.albClaim) return;
    Object.assign(ui.ACT, {
      albClaim: (d) => { const r = A.claim(d.w); if (!r) return; celebrate(r); render(); ['PacksUI', 'PassUI'].forEach((k) => AMB[k] && AMB[k].refreshMenu && AMB[k].refreshMenu()); },
      albClaimAll: () => { const r = A.claimAll(); if (!r) return; celebrate(r, r.packs); render(); ['PacksUI', 'CollectionUI'].forEach((k) => AMB[k] && AMB[k].refreshMenu && AMB[k].refreshMenu()); },
    });
  }

  AMB.AlbumUI = { render, refreshMenu, installActions };
  if (UI()) installActions();
  refreshMenu();
})();
