/*
 * "الحملة" screen: 4 levels (one per world), each a path of 4 fights + a boss.
 * A fight preview shows the enemy line-up, the boss special and the rewards; then a short
 * best-of-3 match starts (ui.js startMatch with S.mode = 'campaign'). Logic: core/campaign.js, data: core/levels.js.
 */
(function () {
  const AMB = globalThis.AMB;
  const $ = (id) => document.getElementById(id);
  const CAM = AMB.campaign, LV = AMB.LEVELS, C = AMB.collection;
  const { icon } = AMB.art;
  const UI = () => globalThis.AMB_UI;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  let hero = null;   // hero used for campaign fights (remembered while the page is open)
  let starterSel = null;   // first-hero picker: the card selected before confirming
  let camWorld = null;     // the world map: null = the four-arm hub, otherwise one world's levels

  const W = (id) => AMB.DATA.WORLDS[id];
  const pickHero = () => {
    const owned = C.ownedHeroes();
    if (hero && owned.includes(hero)) return hero;
    return (hero = C.starterHero() && owned.includes(C.starterHero()) ? C.starterHero() : owned[0] || null);
  };

  const starRow = (n, cls) => `<span class="cstars ${cls || ''}">${[1, 2, 3].map((k) => `<i class="${k <= n ? 'on' : ''}">★</i>`).join('')}</span>`;

  function chestsHTML() {
    const tot = CAM.totalStars(), max = CAM.maxStars();
    // chests keep a minimum gap so the low thresholds (10★, 25★) never overlap: position = the real share, pushed right just enough
    let lastAt = -100; const MIN = 12;
    const items = CAM.chests().map((c) => { let at = (100 * c.need) / max; if (at < lastAt + MIN) at = lastAt + MIN; lastAt = at; c._at = Math.min(at, 100); return c; }).map((c) => `<button class="chest ${c.state}" style="--at:${c._at}%" ${c.state === 'ready' ? `data-act="camChest" data-id="${c.id}"` : 'disabled'} title="${esc(c.name)}: ${rewardText(c.reward)}">
        <span class="ch-ic">${c.state === 'claimed' ? '✓' : '🎁'}</span><b>${c.need}★</b></button>`).join('');
    return `<div class="cam-chests"><div class="cc-top"><span class="cc-total">★ <bdi dir="ltr">${tot}<small>/${max}</small></bdi></span>
        <span class="hint">${LV.CAMPAIGN.stars.rules.map((r) => '★'.repeat(r.n)).join(' · ')} <button class="ibtn" data-act="info" data-k="caminfo" title="شرح">ⓘ</button></span></div>
      <div class="cc-track"><i style="width:${(100 * tot) / max}%"></i>${items}</div></div>`;
  }
  function rewardText(rw) {
    const R = AMB.ECONOMY.rarities;
    return [rw.shards ? `${rw.shards} شظية` : '', rw.packs ? `${rw.packs === 1 ? 'باكج' : rw.packs + ' باكجات'}` : '', rw.card ? `بطاقة ${R[rw.card].name} أو أندر أكيد` : ''].filter(Boolean).join(' + ');
  }

  function node(l, f, i) {
    const cleared = CAM.isCleared(f.id, CAM.diff()), open = CAM.isUnlocked(f.id), next = CAM.next() === f.id;
    const cls = ['cnode', f.boss ? 'boss' : '', cleared ? 'cleared' : '', open ? 'open' : 'locked', next ? 'next' : ''].join(' ');
    const inner = f.boss ? UI().portrait(AMB.DATA.HEROES[l.hero], { bare: true, k: 'cb' + l.id }) : `<b>${i + 1}</b>`;
    return `<button class="${cls}" ${open ? `data-act="camFight" data-id="${f.id}"` : 'disabled'} title="${esc(f.name)}">${inner}${cleared ? starRow(CAM.stars(f.id), 'mini') : open ? '' : '<i class="lk">🔒</i>'}<span class="cn-name">${esc(f.name)}</span></button>`;
  }

  function render() {
    const root = $('campaign'); if (!root) return;
    const R = LV.CAMPAIGN.rewards;
    if (C.needsStarter()) {   // brand-new player: pick the first hero right here (same picker as the quick match), then straight to fight 1
      const ui = UI(), list = AMB.DATA.HERO_STARTERS.filter((id) => AMB.DATA.HEROES[id]);
      if (!list.includes(starterSel)) starterSel = null;
      root.innerHTML = `<div class="cam-starter"><h3>اختر بطلك الأول</h3><p class="hint">اضغط «جرّب» وشوف كل بطل يقاتل قبل لا تختار. والباقين تفتحهم بعدين من الحملة 🎁</p>
        <div class="hero-grid hp-grid">${list.map((id) => ui.heroPickHTML(AMB.DATA.HEROES[id], { act: 'camPick', sel: starterSel === id, trial: true, k: 'cst' })).join('')}</div>
        <div class="hero-foot cam-foot" ${starterSel ? '' : 'hidden'}><button class="btn primary big" data-act="camStarter" data-id="${starterSel || ''}" ${starterSel ? '' : 'disabled'}>${starterSel ? `خذ ${esc(AMB.DATA.HEROES[starterSel].name)} بطلي الأول` : 'اختر بطل'}</button></div></div>`;
      return;
    }
    if (AMB.tutorial && AMB.tutorial.required()) {   // brand-new player: the guided match comes first
      root.innerHTML = `<div class="cam-starter"><div class="tut-cta"><button class="btn primary big" data-act="tutGo">${icon('sword')} ${icon('hand')}</button></div></div>`; return;
    }
    AMB.TIPS = AMB.TIPS || {};
    AMB.TIPS.caminfo = () => ({ title: 'كيف تشتغل الحملة', html: `<p>كل قتال <b>تلعب 8 جولات ويفوز اللي يكسب جولات أكثر</b> ضد تشكيلة ثابتة. مستويات بطاقاتك وندرتها <b>تنحسب هنا</b>، والمتجر يعرض الوحدات اللي تملكها فقط.</p>
      <p>الفوز الأول: ${icon('gem')} ${R.fight.shards} + ${R.fight.passXp} خبرة ممر<br><b>3 صعوبات:</b> سهل (أضعف وجوائز أصغر)، متوسط، صعب (أقوى وجوائز مضاعفة، ينفتح بعد ما تخلص المستوى في متوسط). لكل صعوبة تقدمها ونجومها وصناديقها.<br>الزعيم (أفضل من 7 جولات): <b>كل نجمة لها جائزة</b> مرة وحدة: ★ ${icon('gem')} ${R.bossStars[0].shards} · ★★ ${icon('gem')} ${R.bossStars[1].shards} + باكج · ★★★ ${icon('gem')} ${R.bossStars[2].shards} + بطاقة نادرة أو أعلى<br>إنهاء المستوى: باكج مجاني<br>الإعادة: ${icon('gem')} ${R.replay.shards}</p>
      <h4>النجوم</h4>${LV.CAMPAIGN.stars.rules.map((r) => `<div>${'★'.repeat(r.n)} ${r.text}</div>`).join('')}` });
    const DF = LV.DIFFICULTY, cd = CAM.diff();
    const tabs = `<div class="cam-diff">${CAM.DIFFS.map((k) => `<button class="cd ${k === cd ? 'on' : ''}" style="--dc:${DF[k].color}" data-act="camDiff" data-v="${k}"><b>${DF[k].name}</b><small>★ ${CAM.totalStars(k)}/${CAM.maxStars()}</small></button>`).join('')}</div>
      <div class="hint cam-dnote">${cd === 'easy' ? 'أعداء أضعف وجوائز أصغر، لقصة مريحة' : cd === 'normal' ? 'الحملة الأساسية' : 'أعداء أقوى بـ30% وجوائز أكبر: باكجات مضاعفة وبطاقات أندر. كل مستوى ينفتح بعد ما تخلصه في «متوسط»'}</div>`;
    // ---- world map: a compass with four arms; tapping a world shows only that world's levels (Neon -> Neon-9 street + Network stage)
    const WORLD_ORDER = ['ember', 'sylvan', 'neon', 'tide'];   // left, top, right, bottom
    const worldLevels = (w) => LV.LEVELS.map((l, li) => ({ l, li })).filter((x) => x.l.world === w);
    const nextId = CAM.next(), nextF = nextId && CAM.find(nextId);
    if (camWorld && !worldLevels(camWorld).length) camWorld = null;
    if (!camWorld) {
      const arm = (w, pos) => {
        const ls = worldLevels(w), wd = W(w), total = ls.reduce((n, x) => n + x.l.fights.length, 0), cleared = ls.reduce((n, x) => n + CAM.progress(x.l.id).cleared, 0);
        const stars = ls.reduce((n, x) => n + CAM.levelStars(x.l.id), 0), maxS = total * 3, open = ls.some((x) => CAM.levelUnlocked(x.li)), here = nextF && nextF.level.world === w;
        return `<button class="wm-arm wm-${pos} ${open ? '' : 'locked'} ${here ? 'here' : ''} ${cleared >= total ? 'done' : ''}" style="--wc:${wd.color}" data-act="camWorld" data-w="${w}" aria-label="${esc(wd.name)}">
          <span class="wm-ic">${icon(AMB.art.WORLD_ICON[w])}</span><b>${esc(wd.name)}</b><small><bdi dir="ltr">${cleared}/${total}</bdi> · ★ <bdi dir="ltr">${stars}/${maxS}</bdi></small>${open ? '' : '<i class="wm-lock">🔒</i>'}${here ? '<i class="wm-go">▶ كمّل</i>' : ''}</button>`;
      };
      const totalAll = LV.LEVELS.reduce((n, l) => n + l.fights.length, 0), doneAll = LV.LEVELS.reduce((n, l) => n + CAM.progress(l.id).cleared, 0);
      root.innerHTML = tabs + `<div class="wm"><div class="wm-lines"><i></i><i></i></div>
        ${arm('sylvan', 'top')}${arm('ember', 'left')}${arm('neon', 'right')}${arm('tide', 'bottom')}
        <div class="wm-core"><svg viewBox="0 0 100 100" aria-hidden="true"><polygon points="50,4 58,34 90,24 66,46 96,60 62,62 70,94 50,70 30,94 38,62 4,60 34,46 10,24 42,34" fill="#f2c94c" stroke="#a87a12" stroke-width="1.5"/></svg><b><bdi dir="ltr">${doneAll}/${totalAll}</bdi></b></div></div>
        ${chestsHTML()}`;
      refreshMenu(); return;
    }
    const wd = W(camWorld);
    root.innerHTML = tabs + `<div class="wm-back"><button class="btn small ghost" data-act="camWorld" data-w="">‹ خريطة العوالم</button><b style="color:${wd.color}">${icon(AMB.art.WORLD_ICON[camWorld])} ${esc(wd.name)}</b></div>` + `<div class="cam-note">⚔️ 8 جولات في كل قتال (يفوز اللي يكسب جولات أكثر) · ⭐ النجوم تفتح صناديق · 👑 كل نجمة زعيم لها جائزة <button class="ibtn" data-act="info" data-k="caminfo" title="شرح">ⓘ</button></div>
      ${chestsHTML()}
      <div class="cam-levels">${LV.LEVELS.map((l, li) => ({ l, li })).filter((x) => x.l.world === camWorld).map(({ l, li }) => {
        const pr = CAM.progress(l.id), unlocked = CAM.levelUnlocked(li);
        const lockMsg = cd === 'hard' && !CAM.levelDone(l.id, 'normal') ? '🔒 خلّصه في «متوسط» أول' : '🔒 خلّص المستوى اللي قبله';
        return `<section class="cam-level ${unlocked ? '' : 'locked'} ${CAM.levelDone(l.id, cd) ? 'done' : ''}" style="--wc:${W(l.world).color}">
          <header><span class="cl-n">${li + 1}</span><div><h3>${esc(l.name)}</h3><small>${W(l.world).name} · ${pr.cleared}/${pr.total} · ★ ${CAM.levelStars(l.id)}/${l.fights.length * 3}${CAM.levelDone(l.id, cd) ? ' · ✓ مكتمل' : ''}</small></div>
          ${unlocked ? '' : `<span class="cl-lock">${lockMsg}</span>`}</header>
          ${(() => { const hd = AMB.DATA.HEROES[l.hero], dd = CAM.levelDiffs(l.id), has = AMB.collection && AMB.collection.owned(l.hero); return hd ? `<div class="cl-hero ${has ? 'got' : ''}" style="--wc:${W(l.world).color}"><span class="clh-p">${UI().portrait(hd, { k: 'clh' + l.id })}</span><div><b>${has ? '✓ ' : '🔒 '}${esc(hd.name)}</b><small>${has ? 'عندك هذا البطل' : 'جائزة المستوى: خلّص كل قتالاته على الثلاث صعوبات'}</small></div><span class="clh-d">${CAM.DIFFS.map((x) => `<i class="${dd[x] ? 'on' : ''}" style="--dc:${LV.DIFFICULTY[x].color}" title="${LV.DIFFICULTY[x].name}">${LV.DIFFICULTY[x].name}${dd[x] ? ' ✓' : ''}</i>`).join('')}</span></div>` : ''; })()}
          <div class="cpath">${l.fights.map((f, i) => node(l, f, i)).join('<i class="cline"></i>')}</div></section>`;
      }).join('')}</div>`;
    refreshMenu();
  }

  /** a player who has not won a campaign fight yet (and never played before): keep the menu simple */
  const isNewbie = () => !CAM.isCleared('l1f1') && !(AMB.pass && AMB.pass.state().xp > 0) && AMB.packs.stats().opened === 0;
  function refreshMenu() {
    document.body.classList.toggle('newbie', isNewbie());
    const b = $('menu-campaign'); if (!b) return;
    if (isNewbie()) { b.innerHTML = 'ابدأ المغامرة'; return; }
    const n = CAM.next(), f = n && CAM.find(n);
    const ch = CAM.readyChests();
    b.innerHTML = `الحملة${f ? ` <small>${f.li + 1}-${f.fi + 1}</small>` : '<small>✓</small>'}${ch ? `<span class="dot">${ch}</span>` : ''}`;
  }

  // what finishing the whole level pays on this difficulty
  function levelHint(pay, inline) {
    const lb = pay && pay.levelBonus; if (!lb || (!lb.packs && !lb.shards)) return '';
    const t = [lb.packs ? `${lb.packs === 1 ? 'باكج مجاني' : lb.packs + ' باكجات مجانية'}` : '', lb.shards ? `${icon('gem')} ${lb.shards} شظية` : ''].filter(Boolean).join(' + ');
    return inline ? ` · <b>${t}</b> لإنهاء المستوى` : `<div class="hint">+ <b>${t}</b> لإنهاء المستوى</div>`;
  }

  function preview(fightId) {
    const ui = UI(), x = CAM.find(fightId), f = x.fight, l = x.level, boss = f.boss ? (LV.BOSS[l.hero] || LV.BOSS[l.world]) : null;
    const pay = CAM.rewardsFor(fightId), st = CAM.stats(fightId);
    const h = pickHero();
    const unitsHTML = f.units.map(([id, star, , from], k) => `<div class="cu">${ui.portrait(AMB.DATA.UNITS[id], { k: 'cpv' + k + id })}${ui.stars(star)}${from > 1 ? `<small>من الجولة ${from}</small>` : ''}</div>`).join('');
    const heroes = C.ownedHeroes().map((id) => `<button class="hchip ${id === h ? 'on' : ''}" data-act="camHero" data-id="${id}" data-f="${fightId}">${ui.portrait(AMB.DATA.HEROES[id], { k: 'cph' + id })}<span>${AMB.DATA.HEROES[id].name}</span></button>`).join('');
    const prizeTxt = (p) => [p.shards ? `${icon('gem')} ${p.shards}` : '', p.passXp ? `+${p.passXp} خبرة` : '', p.packs ? '📦 باكج' : '', p.card ? `🃏 بطاقة ${AMB.ECONOMY.rarities[p.card].name}+` : ''].filter(Boolean).join(' · ');
    const reward = pay.boss
      ? `<div class="hint" style="margin-bottom:4px">قتال طويل: 8 جولات والزعيم يقوى كل جولة. كل نجمة لها جائزتها، وتنصرف مرة وحدة.</div>${pay.prizes.map((p) => `<div class="bp ${p.state}"><span class="bp-s">${'★'.repeat(p.star)}</span><span>${prizeTxt(p)}</span><i>${p.state === 'paid' ? '✓ استلمتها' : ''}</i></div>`).join('')}${levelHint(pay)}`
      : pay.replay ? `إعادة: ${icon('gem')} ${pay.shards}` : `${icon('gem')} ${pay.shards} شظية · +${pay.passXp} خبرة ممر${levelHint(pay, true)}`;
    ui.modal(`<div class="cam-pv" style="--wc:${W(l.world).color}">
      <h2>${f.boss ? '👑 ' : ''}${esc(f.name)}</h2><div class="hint">${esc(l.name)} · ${x.fi + 1}/${l.fights.length}</div>
      ${boss ? `<div class="boss-box">${ui.portrait(AMB.DATA.HEROES[l.hero], { k: 'cpb' })}<div><b>قدرة الزعيم: ${boss.name}</b><p>${boss.text}</p></div></div>` : ''}
      ${h === l.hero ? `<div class="hint">ستواجه <b>ظلّ ${AMB.DATA.HEROES[h].name}</b></div>` : ''}
      <h4>تشكيلة الخصم</h4><div class="cam-units">${unitsHTML}</div>
      <h4>الجائزة</h4><div class="cam-reward">${reward}</div>
      <h4>بطلك</h4><div class="hchips">${heroes}</div>${AMB.DeckGate ? AMB.DeckGate.line() : ''}${x.li >= 2 && C.ownedCount() < 40 ? '<div class="db-warn">⚠ هالمستوى أصعب: افتح باكجات وطوّر بطاقاتك أول عشان ترتاح فيه</div>' : ''}
      <h4>النجوم ${starRow(CAM.stars(fightId))} <button class="ibtn" data-act="info" data-k="caminfo" title="شرح">ⓘ</button></h4>
      ${st.attempts ? `<div class="hint">محاولات: ${st.attempts} · فوز: ${st.wins}</div>` : ''}
      <div class="cam-go"><button class="btn primary big" data-act="camGo" data-id="${fightId}" ${h ? '' : 'disabled'}>قاتل!</button></div></div>`);
  }

  function start(fightId) {
    if (AMB.DeckGate && !AMB.DeckGate.ensure()) return;
    const ui = UI(), S = ui.S;
    S.mode = 'campaign'; S.campaign = { fightId, diff: CAM.diff() }; S.picks = [pickHero(), null]; S.pickIdx = 0;
    ui.closeModal(); ui.startMatch();
  }

  /** results screen for a finished campaign fight (called from ui.js showResults) */
  function showResult(m, secs) {
    const ui = UI(), S = ui.S, fightId = S.campaign.fightId, x = CAM.find(fightId);
    if (!m._camDone) { m._camDone = true; S.camResult = CAM.recordResult(fightId, Object.assign(m.summary(0), { lifeLeft: m.players[0].life, maxLife: m.players[0].maxLife, roundsLost: m.players[0].stats.losses })); }
    // a new player starts on easy: after 3 easy wins, move up to medium once (they can switch back any time)
    try { const ST = AMB.settings; if (ST && !ST.seen('autoNormal') && CAM.diff() === 'easy' && m.winner === 0) { const won = ['l1f1', 'l1f2', 'l1f3', 'l1f4', 'l1boss'].filter((id) => CAM.isCleared(id, 'easy')).length; if (won >= 3) { ST.markSeen('autoNormal'); setTimeout(() => UI().toast('💪 صرت قوي! لو تبي جوائز أكبر جرّب «متوسط» من أعلى الحملة', 'good'), 1200); } } } catch (e) { /* ignore */ }
    const r = S.camResult, won = r.won, next = CAM.next(), nx = next && CAM.find(next);
    // why the 3rd star was missed: the hero loses life in a round you win too (the front line fell, or a drawn round), and the star needs it full
    const lifePct = Math.round(100 * m.players[0].life / m.players[0].maxLife);
    const whyNo3 = won && r.stars === 2 && lifePct < 100 ? `<p class="hint">فاتتك النجمة الثالثة: ما خسرت ولا جولة، بس حياة بطلك نزلت لـ${lifePct}٪ (العدو يضرب بطلك لما يسقط خط الدفاع حتى لو كسبت الجولة، وكذلك لو تعادلت جولة).</p>` : '';
    const score = `${m.players[0].stats.wins} – ${m.players[1].stats.wins}`;
    const pay = won ? [r.shards ? `${icon('gem')} +${r.shards} شظية` : '', r.passXp ? `+${r.passXp} خبرة ممر` : ''].filter(Boolean).join(' · ') : '';
    const bossPrizes = won && r.boss && r.prizes && r.prizes.length ? `<div class="cam-pack"><b>🏆 جوائز النجوم:</b>${r.prizes.map((p) => `<div class="bp paid"><span class="bp-s">${'★'.repeat(p.star)}</span><span>${[p.shards ? `${icon('gem')} ${p.shards}` : '', p.passXp ? `+${p.passXp} خبرة` : '', p.packs ? '📦 باكج مجاني' : '', p.card ? '🃏 بطاقة ' + AMB.ECONOMY.rarities[p.card].name + ' أو أندر' : ''].filter(Boolean).join(' · ')}</span></div>`).join('')}
      <div class="cam-pack-row">${(r.packs || []).map((pk) => pk.cards.map((c, i) => `<div class="cu">${ui.portrait(C.def(c.id), { k: 'bpk' + i + c.id })}<small class="r-${c.rarity}">${c.isNew ? 'جديدة!' : c.refund ? '+' + c.refund + ' شظية' : '+1 نسخة'}</small></div>`).join('')).join('')}${r.card ? `<div class="cu">${ui.portrait(C.def(r.card.id), { k: 'bcd' + r.card.id })}<small class="r-${r.card.rarity}">${r.card.isNew ? 'جديدة!' : '+1 نسخة'}</small></div>` : ''}</div></div>` : '';
    const lp = r.levelPacks || [];
    const heroWon = (r.heroes || []).map((id) => AMB.DATA.HEROES[id]).filter(Boolean).map((h) => `<div class="cam-pack hero-win"><b>👑 فتحت بطل جديد!</b><div class="cam-pack-row"><div class="cu">${ui.portrait(h, { k: 'hw' + h.id })}<small>${esc(h.name)}</small></div></div><p class="hint">لقيته في «ابدأ المباراة» وفي مجموعتي.</p></div>`).join('');
    const pack = lp.length || r.levelShards ? `<div class="cam-pack"><b>🎁 خلّصت المستوى!${lp.length ? ` ${lp.length === 1 ? 'باكج مجاني' : lp.length + ' باكجات مجانية'}` : ''}${r.levelShards ? ` · ${icon('gem')} +${r.levelShards} شظية` : ''}</b><div class="cam-pack-row">${lp.map((pk) => pk.cards.map((c, i) => `<div class="cu">${ui.portrait(C.def(c.id), { k: 'crp' + i + c.id })}<small class="r-${c.rarity}">${c.isNew ? 'جديدة!' : c.refund ? '+' + c.refund + ' شظية' : '+1 نسخة'}</small></div>`).join('')).join('')}</div></div>` : '';
    $('results').innerHTML = `<div class="res-stage ${won ? 'victory' : 'defeat'}" style="--wc:${W(x.level.world).color}"><div class="res-rays"></div>
        <div class="res-hero">${ui.portrait(AMB.DATA.HEROES[m.players[0].heroId], { bare: true, k: 'crh' })}<i class="sheen"></i></div>
        <div class="res-hname">${esc(x.fight.name)}</div></div>
      <div class="res-banner"><h1>${won ? (x.fight.boss ? 'هزمت الزعيم!' : 'فوز!') : m.players[0].stats.wins ? 'قربت! جرّب مرة ثانية' : 'هالمرة صعبة، جرّب مرة ثانية'}</h1><p class="hint">النتيجة ${score} · ${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')} دقيقة</p>
        ${won ? `<div class="res-stars">${[1, 2, 3].map((k) => `<i class="${k <= r.stars ? 'on' : ''}" style="--d:${0.3 + k * 0.35}s">★</i>`).join('')}</div>
          <p class="hint">${r.newBest ? (r.prevStars ? `رقم جديد! من ${r.prevStars} لين ${r.stars} نجوم` : `${r.stars} من 3 نجوم`) : `أفضل نتيجة لك هنا: ${CAM.stars(fightId)} نجوم`}${r.stars < 3 ? ' · ' + LV.CAMPAIGN.stars.rules[r.stars].text + ' = ★' : ''}</p>${whyNo3}` : ''}
        ${r.chestsReady > r.chestsBefore ? '<button class="btn primary" data-act="go" data-to="campaign">🎁 صندوق نجوم جاهز! افتحه من خريطة الحملة</button>' : ''}
        ${won ? `<p class="cam-pay">${r.first ? pay : `إعادة: ${pay || 'بدون جائزة'}`}</p>` : `<p class="res-tip">💡 ${UI().lossTip ? UI().lossTip(m) : 'طوّر بطاقاتك وجرّب مرة ثانية'}</p>`}</div>
      ${heroWon}${bossPrizes}${pack}
      ${r.first && fightId === 'l1f1' ? '<div class="cam-unlock">🔓 انفتح: الباكجات · مجموعتي · الممر · الدخول اليومي</div>' : ''}
      <div class="cam-btns">
        ${won && nx ? `<button class="btn primary big" data-act="camGo" data-id="${next}">القتال التالي: ${esc(nx.fight.name)}</button>` : ''}
        <button class="btn ${won ? '' : 'primary'} big" data-act="camGo" data-id="${fightId}">${won ? 'أعد القتال' : 'حاول مرة ثانية'}</button>
        <button class="btn big ghost" data-act="go" data-to="campaign">خريطة الحملة</button>
        ${won ? '' : '<button class="btn big ghost" data-act="go" data-to="cards">طوّر بطاقاتي</button>'}</div>`;
    ui.show('results');
    ui.sfx(won ? 'win' : 'lose');
    if (won) setTimeout(() => { const el = document.querySelector('.res-hero'); if (el) ['#ffd24a', '#ffffff', W(x.level.world).color].forEach((c) => ui.burst(el, c, 14, { r: 150, s: 8 })); }, 250);
  }

  function installActions() {
    const ui = UI(); if (!ui || ui.ACT.camFight) return;
    Object.assign(ui.ACT, {
      camWorld: (d) => { camWorld = d.w || null; ui.sfx('click'); render(); window.scrollTo(0, 0); },
      camFight: (d) => preview(d.id),
      camHero: (d) => { hero = d.id; preview(d.f); },
      camGo: (d) => start(d.id),
      camDiff: (d) => { CAM.setDiff(d.v); ui.sfx('click'); render(); },
      tutGo: () => AMB.TutorialUI.start({ after: () => { render(); preview(CAM.next()); } }),
      camPick: (d, el, e) => { if (e && e.target.closest('[data-act="heroInfo"], [data-act="heroTry"]')) return; starterSel = d.id; ui.sfx('click'); render(); },
      camStarter: (d) => {
        if (!d.id || !C.chooseStarter(d.id)) return;
        CAM.setDiff('easy');   // a brand-new player starts the campaign on easy; after 3 easy wins it moves up to medium once
        hero = d.id; ui.sfx('merge'); ui.toast(`${AMB.DATA.HEROES[d.id].name} صار بطلك!`, 'good');
        render();
        const afterTut = () => { render(); preview(CAM.next()); };
        const goTut = () => (AMB.tutorial.required() ? AMB.TutorialUI.start({ after: afterTut }) : afterTut());
        if (!C.giftClaimed() && AMB.GiftUI) setTimeout(() => AMB.GiftUI.intro(goTut), 250);
        else setTimeout(goTut, 250);
      },
      camChest: (d) => {
        const r = CAM.claimChest(d.id); if (!r) return;
        ui.sfx('merge');
        const C2 = AMB.collection, R = AMB.ECONOMY.rarities;
        const cards = r.packs.flatMap((p) => p.cards).concat(r.card ? [Object.assign({ isNew: r.card.isNew }, r.card)] : []);
        ui.overlay(`<div class="rv-wrap"><h2>🎁 ${esc(LV.CAMPAIGN.stars.chests.find((c) => c.id === d.id).name)}</h2>
          ${r.shards ? `<p class="cam-pay">${icon('gem')} +${r.shards} شظية</p>` : ''}
          ${cards.length ? `<div class="cam-pack-row">${cards.map((c, i) => `<div class="cu">${ui.portrait(C2.def(c.id), { k: 'chs' + i + c.id })}<small style="color:${R[c.rarity].color}">${R[c.rarity].name}${c.isNew ? ' · جديدة!' : ''}</small></div>`).join('')}</div>` : ''}
          <div class="rv-btns"><button class="btn primary" data-act="packDone">تم</button></div></div>`);
        render();
      },
    });
  }

  AMB.CampaignUI = { render, refreshMenu, showResult, installActions, isNewbie };
  if (UI()) installActions();
  refreshMenu();
})();
