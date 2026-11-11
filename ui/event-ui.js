/*
 * "الحدث" screen: this week's special level (3 stages, the last is the event boss). The boss gives an
 * exclusive card that packs never drop. Logic: core/events.js, settings: AMB.ECONOMY.events.
 */
(function () {
  const AMB = globalThis.AMB;
  const $ = (id) => document.getElementById(id);
  const WK = AMB.weekly, C = AMB.collection;
  const { icon } = AMB.art;
  const UI = () => globalThis.AMB_UI;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const W = (id) => AMB.DATA.WORLDS[id];
  let hero = null, timer = 0;

  const pickHero = () => { const owned = C.ownedHeroes(); if (hero && owned.includes(hero)) return hero; return (hero = (C.starterHero() && owned.includes(C.starterHero()) ? C.starterHero() : owned[0]) || null); };
  function left(ms) { const h = Math.max(0, Math.floor(ms / 36e5)), d = Math.floor(h / 24); return d >= 1 ? `${d} يوم و ${h % 24} ساعة` : `${h} ساعة`; }
  const rewardHTML = (stage) => { const r = WK.rewardsFor(stage); return `${icon('gem')} ${r.shards}${r.pack ? ' · 📦' : ''}${r.exclusive ? ' · 🌟 بطاقة حصرية' : ''}`; };

  function stageRow(c, stage) {
    const L = WK.lineupFor(c.event.id, stage), cleared = stage <= c.stage, cur = stage === c.stage + 1, open = WK.canPlay(stage);
    const art = L.boss ? UI().portrait(AMB.DATA.HEROES[L.heroId], { bare: true, k: 'ev' + stage }) : `<b>${stage}</b>`;
    return `<button class="twrow ${L.boss ? 'boss' : ''} ${cleared ? 'cleared' : ''} ${cur ? 'cur' : ''} ${open ? '' : 'locked'}" style="--wc:${W(c.event.world).color}" ${open ? `data-act="evStage" data-n="${stage}"` : 'disabled'}>
      <span class="tw-n">${art}</span><span class="tw-mid"><b>${L.boss ? '👑 ' : ''}${esc(L.boss ? L.special.name : 'المرحلة ' + stage)}</b><small>${L.boss ? 'زعيم الحدث' : 'قتال ' + stage + ' من ' + WK.stageCount()}</small></span>
      <span class="tw-rw">${cleared ? '✓' : rewardHTML(stage)}</span>${cur ? '<span class="tw-go">قاتل</span>' : open ? '' : '<span class="tw-lock">🔒</span>'}</button>`;
  }

  function render() {
    const root = $('event'); if (!root) return;
    clearInterval(timer);
    if (C.needsStarter()) { root.innerHTML = '<div class="cam-note">اختر بطلك الأول من «الحملة» أول.</div>'; return; }
    if (!WK.unlocked()) { const c0 = WK.current(), ev0 = c0.event, ex0 = AMB.DATA.UNITS[ev0.exclusive];
      root.innerHTML = `<div class="cam-note">🔒 الحدث الأسبوعي يفتح بعد ما تخلّص <b>المستوى الأول من الحملة</b>.</div>
        <div class="ev-peek"><h3>حدث هالأسبوع: ${esc(ev0.name)}</h3><p class="hint">زعيم بقدرتين، وبطاقة حصرية ما تطلع من الباكجات: <b>${esc(ex0.name)}</b></p>
        <div class="ev-peek-card">${UI().cardHTML(ex0, { k: 'evp', cls: 'unowned', attrs: `data-act="detail" data-id="${ev0.exclusive}"` })}</div></div>`; return; }
    const c = WK.current(), ev = c.event, ex = AMB.DATA.UNITS[ev.exclusive], owned = C.owned(ev.exclusive), next = WK.nextEvent();
    const card = UI().cardHTML(ex, { k: 'evx', lvl: owned ? C.level(ev.exclusive) : 0, cls: owned ? '' : 'unowned', attrs: `data-act="detail" data-id="${ev.exclusive}"` });
    const rows = []; for (let s = WK.stageCount(); s >= 1; s--) rows.push(stageRow(c, s));
    root.innerHTML = `<div class="ev-banner" style="--wc:${W(ev.world).color}"><div class="ev-world">${W(ev.world).name}</div><h3>${esc(ev.name)}</h3>
        <div class="ev-time">⏳ باقي <b id="ev-left">${left(c.msLeft)}</b> · القادم: ${esc(next.name)}</div></div>
      <div class="ev-prize"><div class="ev-card">${card}</div><div class="ev-ptxt"><b>🌟 الجائزة الحصرية</b><p>${esc(ex.name)} <small>${esc(ex.en)}</small></p>
        <div class="hint">${owned ? '✓ تملكها (تعيد الحدث وتاخذ نسخة تطوير)' : 'ما تطلع من الباكجات، بس من هالحدث'} <button class="ibtn" data-act="info" data-k="evinfo" title="شرح">ⓘ</button></div>
        ${c.done ? '<div class="ev-done">✓ خلّصت حدث هذا الأسبوع</div>' : ''}</div></div>
      <div class="twlist">${rows.join('')}</div>`;
    refreshMenu();
    timer = setInterval(() => { const e = $('ev-left'); if (!e || UI().S.screen !== 'event') { clearInterval(timer); return; } e.textContent = left(WK.current().msLeft); }, 30000);
  }

  function refreshMenu() {
    const b = $('menu-event'); if (!b) return;
    const l = b.querySelector('.mt-l'), c = WK.current();
    l.innerHTML = `الحدث${WK.unlocked() && !c.done ? '<span class="dot">!</span>' : ''}`;
  }

  function preview(stage) {
    const ui = UI(), c = WK.current(), L = WK.lineupFor(c.event.id, stage), h = pickHero(), R = WK.rewardsFor(stage), first = stage === c.stage + 1;
    const units = L.units.map(([id, star, , from], k) => `<div class="cu">${ui.portrait(AMB.DATA.UNITS[id], { k: 'evp' + k + id })}${ui.stars(star)}${from > 1 ? `<small>من الجولة ${from}</small>` : ''}</div>`).join('');
    const heroes = C.ownedHeroes().map((id) => `<button class="hchip ${id === h ? 'on' : ''}" data-act="evHero" data-id="${id}" data-n="${stage}">${ui.portrait(AMB.DATA.HEROES[id], { k: 'evh' + id })}<span>${AMB.DATA.HEROES[id].name}</span></button>`).join('');
    const reward = first ? `${icon('gem')} ${R.shards} شظية · +${R.passXp} خبرة ممر${R.pack ? ' · <b>باكج مجاني</b>' : ''}${R.exclusive ? ` · <b>🌟 ${esc(AMB.DATA.UNITS[c.event.exclusive].name)} (حصرية)</b>` : ''}` : 'خلّصت هالمرحلة هالأسبوع: تدريب بدون جائزة';
    ui.modal(`<div class="cam-pv" style="--wc:${W(c.event.world).color}"><h2>${L.boss ? '👑 ' : ''}${esc(L.name)}</h2><div class="hint">${esc(c.event.name)} · تلعب 8 جولات ويفوز اللي يكسب جولات أكثر</div>
      ${L.boss ? `<div class="boss-box">${ui.portrait(AMB.DATA.HEROES[L.heroId], { k: 'evb' })}<div><b>قدرة الزعيم: ${esc(L.special.name)}</b><p>${esc(L.special.text)}</p></div></div>` : ''}
      <h4>تشكيلة الخصم</h4><div class="cam-units">${units}</div><h4>الجائزة</h4><div class="cam-reward">${reward}</div>
      <h4>بطلك</h4><div class="hchips">${heroes}</div>${AMB.DeckGate ? AMB.DeckGate.line() : ''}
      <div class="cam-go"><button class="btn primary big" data-act="evGo" data-n="${stage}" ${h ? '' : 'disabled'}>قاتل!</button></div></div>`);
  }

  function start(stage) {
    if (AMB.DeckGate && !AMB.DeckGate.ensure()) return;
    const ui = UI(), S = ui.S;
    S.mode = 'event'; S.event = { stage, week: WK.current().idx }; S.picks = [pickHero(), null]; S.pickIdx = 0;
    ui.closeModal(); ui.startMatch();
  }

  function showResult(m, secs) {
    const ui = UI(), S = ui.S, stage = S.event.stage;
    if (!m._evDone) { m._evDone = true; S.evResult = WK.recordResult(stage, Object.assign(m.summary(0), { lifeLeft: m.players[0].life, roundsLost: m.players[0].stats.losses }), S.event.week); }
    const r = S.evResult, ev = AMB.WEEKLY.find((e) => e.id === r.event), L = WK.lineupFor(ev.id, stage), won = r.won, score = `${m.players[0].stats.wins} – ${m.players[1].stats.wins}`;
    const pay = won && r.first ? [r.shards ? `${icon('gem')} +${r.shards} شظية` : '', r.passXp ? `+${r.passXp} خبرة ممر` : ''].filter(Boolean).join(' · ') : '';
    const ex = AMB.DATA.UNITS[ev.exclusive];
    const gift = (r.pack ? `<div class="cam-pack"><b>🎁 باكج مجاني:</b><div class="cam-pack-row">${r.pack.cards.map((c, i) => `<div class="cu">${ui.portrait(C.def(c.id), { k: 'evr' + i + c.id })}<small class="r-${c.rarity}">${c.isNew ? 'جديدة!' : c.refund ? '+' + c.refund + ' شظية' : '+1 نسخة'}</small></div>`).join('')}</div></div>` : '')
      + (r.card ? `<div class="cam-pack ev-gift"><b>🌟 بطاقة حصرية!</b><div class="cam-pack-row"><div class="cu big">${ui.portrait(ex, { k: 'evxr' })}<small class="r-legendary">${esc(ex.name)} · ${r.cardIsNew ? 'جديدة!' : '+1 نسخة'}</small></div></div></div>` : '');
    const nextStage = won && WK.canPlay(stage + 1) ? stage + 1 : null;
    $('results').innerHTML = `<div class="res-stage ${won ? 'victory' : 'defeat'}" style="--wc:${W(ev.world).color}"><div class="res-rays"></div>
        <div class="res-hero">${ui.portrait(won ? AMB.DATA.HEROES[m.players[0].heroId] : AMB.DATA.HEROES[L.heroId], { bare: true, k: 'evrh' })}<i class="sheen"></i></div><div class="res-hname">${esc(L.name)}</div></div>
      <div class="res-banner"><h1>${won ? (L.boss ? 'هزمت زعيم الحدث!' : 'فوز!') : 'خسارة'}</h1><p class="hint">النتيجة ${score} · ${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')} دقيقة</p>
        ${won ? `<p class="cam-pay">${r.first ? pay : 'تدريب: بدون جائزة'}</p>` : '<p class="hint">طوّر بطاقاتك وجرّب مرة ثانية</p>'}</div>${gift}
      <div class="cam-btns">${nextStage ? `<button class="btn primary big" data-act="evGo" data-n="${nextStage}">المرحلة التالية</button>` : ''}
        <button class="btn ${won ? '' : 'primary'} big" data-act="evGo" data-n="${stage}">${won ? 'أعد المرحلة' : 'حاول مرة ثانية'}</button>
        <button class="btn big ghost" data-act="go" data-to="event">الحدث</button>${won ? '' : '<button class="btn big ghost" data-act="go" data-to="cards">طوّر بطاقاتي</button>'}</div>`;
    ui.show('results'); ui.sfx(won ? 'win' : 'lose');
    if (won) setTimeout(() => { const el = document.querySelector('.res-hero'); if (el) ['#ffd24a', '#ffffff', W(ev.world).color].forEach((c) => ui.burst(el, c, 14, { r: 150, s: 8 })); }, 250);
  }

  AMB.TIPS = AMB.TIPS || {};
  AMB.TIPS.evinfo = () => { const R = AMB.ECONOMY.events.rewards; return { title: 'الحدث الأسبوعي', html: `<p>كل أسبوع (من الاثنين للأحد) حدث جديد من عالم مختلف: <b>${WK.stageCount()} مراحل</b> تلعب 8 جولات ويفوز اللي يكسب جولات أكثر، والأخيرة زعيم الحدث بقدرتين.</p>
    <p>كل مرحلة تعطي شظايا وخبرة ممر (والثانية باكج مجاني) مرة واحدة في الأسبوع. هزيمة الزعيم تعطيك <b>بطاقة حصرية</b> ما تطلع في الباكجات ولا تضيع بعد انتهاء الحدث.</p>
    <p>الأحداث الأربعة تدور، فلو فاتك حدث يرجع بعد 4 أسابيع (وتاخذ نسخة تطوير إضافية للبطاقة لو عندك). الخسارة بدون عقوبة وتقدر تعيد.</p>` }; };

  function installActions() {
    const ui = UI(); if (!ui || ui.ACT.evStage) return;
    Object.assign(ui.ACT, { evStage: (d) => preview(+d.n), evHero: (d) => { hero = d.id; preview(+d.n); }, evGo: (d) => start(+d.n) });
  }

  AMB.EventUI = { render, refreshMenu, showResult, installActions };
  if (UI()) installActions();
  refreshMenu();
})();
