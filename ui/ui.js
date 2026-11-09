/*
 * Browser UI. Drives core/match.js; holds no game rules of its own.
 */
(function () {
  const AMB = globalThis.AMB;
  const { UNITS, HEROES, WORLDS, ROLES, ITEMS, SYNERGIES, ABILITY_TRIGGERS } = AMB.DATA;
  const CFG = AMB.CONFIG;
  const { icon, portrait, stars } = AMB.art;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fmt = (n, d) => (Math.round(n * Math.pow(10, d || 0)) / Math.pow(10, d || 0)).toLocaleString('en-US');
  const lifeStr = (l) => Math.ceil(Math.max(0, l - 1e-6));

  const S = {
    screen: 'menu', mode: 'ai', difficulty: 'normal', picks: [null, null], pickIdx: 0,
    match: null, v: 0, sel: null, phase: 'idle', deadline: 0, paused: false, pausedLeft: 0,
    combat: null, speed: 2, raf: 0, queue: [], aiFirst: false, codexF: { world: '', role: '' },
    tokenEls: {}, startTs: 0, lastReport: null,
  };

  // ======================================================================= helpers
  // Less text on screen: short label + an ⓘ button that opens the full explanation.
  // Any module can register a tip:  AMB.TIPS.key = () => ({ title, html });  then  ibtn('key')
  AMB.TIPS = AMB.TIPS || {};
  const ibtn = (k, extra) => `<button class="ibtn" data-act="info" data-k="${k}" ${extra || ''} title="شرح">ⓘ</button>`;
  // beginners (fewer than 2 finished matches) get the extra hints, then they disappear
  const coach = () => { try { return +(localStorage.getItem('amb_played') || 0) < 2; } catch (e) { return false; } };
  function toast(msg, kind, html) {
    const box = $('toasts');
    // never pile up: the same message just restarts its timer, and at most 2 toasts show at once
    const same = [...box.children].find((x) => (x._m || x.textContent) === msg);
    if (same) { same.style.animation = 'none'; void same.offsetWidth; same.style.animation = ''; clearTimeout(same._t); same._t = setTimeout(() => same.remove(), kind === 'err' ? 4200 : 2500); return; }
    while (box.children.length >= 2) box.firstChild.remove();
    const el = document.createElement('div');
    el.className = 'toast ' + (kind || '');
    el._m = msg; if (html) el.innerHTML = msg; else el.textContent = msg;
    box.appendChild(el);
    el._t = setTimeout(() => el.remove(), kind === 'err' ? 4200 : 2500);
  }
  function show(screen) {
    document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('active', s.id === 'scr-' + screen));
    S.screen = screen;
    document.body.classList.toggle('in-match', screen === 'match');
    document.body.dataset.nav = ['menu', 'cards', 'packs', 'pass', 'campaign', 'tower', 'event', 'mode', 'codex', 'stats'].includes(screen) ? '1' : '0';
    document.body.classList.remove('more-open');
    document.querySelectorAll('#bnav button').forEach((b) => b.classList.toggle('on', b.dataset.n === screen));
    if (screen === 'menu') { try { fillMenu(); } catch (err) { reportErr(err); } }   // page scroll is locked only during a match
    window.scrollTo(0, 0);
    // every screen refreshes on its own: one that fails must never stop the others (or leave the player stuck)
    const T = (f) => { try { f(); } catch (err) { reportErr(err); } };
    const A = globalThis.AMB, menu = screen === 'menu';
    if (A && A.PassUI) { if (menu) T(() => A.PassUI.refreshMenu()); if (screen === 'pass') T(() => A.PassUI.render()); }
    if (A && A.CollectionUI) { if (menu) T(() => A.CollectionUI.refreshMenu()); if (screen === 'cards') T(() => A.CollectionUI.render()); }
    if (A && A.PacksUI) { if (menu) T(() => A.PacksUI.refreshMenu()); if (screen === 'packs') T(() => A.PacksUI.render()); }
    if (A && A.EventUI) { if (screen === 'event') T(() => A.EventUI.render()); if (menu) T(() => A.EventUI.refreshMenu()); }
    if (A && A.TowerUI) { if (screen === 'tower') T(() => A.TowerUI.render()); if (menu) T(() => A.TowerUI.refreshMenu()); }
    if (A && A.CampaignUI) { if (screen === 'campaign') T(() => A.CampaignUI.render()); if (menu) T(() => A.CampaignUI.refreshMenu()); }
    if (A && A.GiftUI && menu) T(() => A.GiftUI.onMenu());
    if (A && A.DailyUI && menu) T(() => A.DailyUI.onMenu());
  }
  // errors are shown on screen (short) so a problem on a real phone can be reported and fixed, instead of a button silently doing nothing
  let lastErr = '';
  function reportErr(err) {
    const msg = String((err && err.message) || err || 'خطأ').slice(0, 90);
    try { console.error(err); } catch (e) { /* ignore */ }
    if (msg === lastErr) return; lastErr = msg; setTimeout(() => { lastErr = ''; }, 4000);
    try { toast('⚠ ' + msg + (err && err.stack ? ' · ' + (String(err.stack).split('\n')[1] || '').trim().slice(-40) : ''), 'err'); } catch (e) { /* ignore */ }
  }
  window.addEventListener('error', (ev) => reportErr(ev.error || ev.message));
  window.addEventListener('unhandledrejection', (ev) => reportErr(ev.reason));
  function modal(html) { $('modal').innerHTML = `<button class="btn small ghost x" data-act="closeModal">✕</button>` + html; $('modal-back').classList.add('on');
    // opening any details window stops the prep timer so you can read in peace
    if (S.phase === 'prep' && !S.paused && S.mode !== 'online') { S.paused = true; S.pausedLeft = S.deadline - Date.now(); S._mp = true; renderTop(); }
  }
  function closeModal() {
    $('modal-back').classList.remove('on');
    if (S._mp) { S._mp = false; if (S.paused && S.phase === 'prep') { S.paused = false; S.deadline = Date.now() + S.pausedLeft; renderTop(); } }   // resume the prep timer
  }
  function overlay(html) { $('overlay').innerHTML = html; $('overlay').classList.add('on'); }
  function closeOverlay() { $('overlay').classList.remove('on'); $('overlay').innerHTML = ''; }

  const mySeat = () => (S.mode === 'online' && S.net ? S.net.idx : 0);
  const me = () => S.match.players[S.v];
  const opp = () => S.match.players[1 - S.v];
  const res = (r) => { if (!r.ok) toast(r.reason, 'err'); return r.ok; };

  // hero ownership (core/collection.js): player 1 picks among owned heroes; a brand-new player first picks a starter.
  // Player 2 on the same device is a guest and may use any hero.
  const starterPick = () => S.pickIdx === 0 && AMB.collection && AMB.collection.needsStarter();
  const heroLocked = (id) => S.pickIdx === 0 && AMB.collection && (starterPick() ? !AMB.DATA.HERO_STARTERS.includes(id) : !AMB.collection.owned(id));
  function renderHeroSelect() {
    const who = starterPick() ? 'اختر بطلك الأول. ما تقدر تغيّره، والباقين تفتحهم من الباكجات أو الباتل باس'
      : S.mode === 'hotseat' ? `اللاعب ${S.pickIdx + 1}: اختر بطلك${S.pickIdx === 1 ? ' (ضيف: كل الأبطال متاحين)' : ''}` : 'اختر بطلك';
    $('hero-title').textContent = who;
    if (S.picks[S.pickIdx] && heroLocked(S.picks[S.pickIdx])) S.picks[S.pickIdx] = null;
    const cur = S.picks[S.pickIdx];
    $('hero-grid').innerHTML = Object.values(HEROES).map((h) => {
      const W = WORLDS[h.world];
      const other = S.mode === 'hotseat' && S.pickIdx === 1 && S.picks[0] === h.id ? '<span class="pick-badge">اختيار اللاعب 1</span>' : '';
      const units = Object.values(UNITS).filter((u) => u.world === h.world).map((u) => u.name).join('، ');
      const lock = heroLocked(h.id) ? '<span class="hero-lock">🔒 مقفل<small>ليجندري: من الباكجات أو الباتل باس</small></span>' : '';
      return `<div class="hero-card ${cur === h.id ? 'sel' : ''} ${lock ? 'locked' : ''}" style="--wc:${W.color}" data-act="pickHero" data-id="${h.id}">${other}${lock}
        ${portrait(h, { k: 'hs' })}
        <h3>${h.name}</h3>${S.mode === 'hotseat' || S.mode === 'online' ? '' : heroLevelHTML(h.id)}<div class="title">${h.title}</div>
        <div class="world">${W.name}</div>
        <div class="style">${h.style}</div>
        <div class="ab"><b>سلبية: ${h.passive.name}</b> — ${h.passive.text}</div>
        ${h.abilities.map((a) => `<div class="ab"><b>${a.name}</b> <span style="color:var(--ess)">(${a.cost} جوهر)</span>: ${a.text}</div>`).join('')}
        ${h.vanguard ? `<div class="ab vg"><b>👑 ${h.vanguard.name}</b>: ${h.vanguard.text}</div>` : ''}
        <div class="ab" style="color:var(--muted)">وحدات عالمه (رنين +${CFG.hero.resonancePerAlly * 100}%): ${units}</div>
        <div style="text-align:center;margin-top:8px"><button class="btn small" data-act="heroInfo" data-id="${h.id}">تفاصيل</button></div>
      </div>`;
    }).join('');
    $('hero-confirm').disabled = !cur;
    $('hero-confirm').textContent = starterPick() ? 'خذه بطلي الأول' : S.mode === 'hotseat' && S.pickIdx === 0 ? 'تمام، دور اللاعب 2' : 'ابدأ المباراة';
  }

  const maxR = () => (S.match && S.match.rules ? S.match.rules.maxRounds : CFG.match.maxRounds);
  // rotate button: lock the screen to landscape / portrait (Android Chrome and the installed app; iPhones can't be locked from a web page)
  function rotateScreen() {
    const land = innerWidth > innerHeight;
    const want = land ? 'portrait' : 'landscape';
    const done = () => { try { toast(want === 'landscape' ? 'تم التدوير للعرض' : 'رجعت للطول', 'good'); } catch (e) { /* ignore */ } };
    const lock = () => screen.orientation.lock(want).then(done).catch(() => toast('جوالك ما يسمح بالتدوير من اللعبة، دوّره بنفسك أو شغّل التدوير التلقائي', 'err'));
    try {
      if (!(screen.orientation && screen.orientation.lock)) throw new Error('no lock');
      const fs = document.documentElement.requestFullscreen;
      if (!document.fullscreenElement && fs && !(matchMedia('(display-mode: standalone)').matches)) fs.call(document.documentElement).then(lock).catch(lock); else lock();
    } catch (e) { toast('جوالك ما يسمح بالتدوير من اللعبة، دوّره بنفسك أو شغّل التدوير التلقائي', 'err'); }
  }
  // closing/reloading in the middle of a match loses it: ask first (the browser shows its own wording)
  window.addEventListener('beforeunload', (e) => { if (S.match && S.screen === 'match' && S.mode !== 'tutorial' && !S.match.isOver) { e.preventDefault(); e.returnValue = ''; } });
  function startMatch() {
    S.panels = false; $('scr-match').classList.remove('show-panels');
    const heroIds = Object.keys(HEROES);
    let players;
    if (S.mode === 'hotseat') {
      players = [{ heroId: S.picks[0], name: 'لاعب 1' }, { heroId: S.picks[1], name: 'لاعب 2' }];
    } else {
      const aiHero = heroIds[Math.floor(Math.random() * heroIds.length)];
      const styles = ['mono', 'mixed', 'balanced'];
      players = [
        { heroId: S.picks[0], name: 'أنت', cardPower: AMB.collection ? AMB.collection.powerMap() : null, heroLevel: AMB.heroes ? AMB.heroes.level(S.picks[0]) : 1 },
        { heroId: aiHero, name: 'الكمبيوتر', isAI: true, aiStyle: styles[Math.floor(Math.random() * 3)], difficulty: S.mode === 'friendly' ? 'easy' : S.difficulty },
      ];
    }
    // campaign fight (ui/campaign-ui.js): fixed enemy line-up, short best-of-3 rules, your card levels count
    S.match = S.mode === 'campaign' ? new AMB.Match(AMB.campaign.matchOptions(S.campaign.fightId, S.picks[0]))
      : S.mode === 'tower' ? new AMB.Match(AMB.tower.matchOptions(S.tower.floor, S.picks[0]))
      : S.mode === 'event' ? new AMB.Match(AMB.weekly.matchOptions(S.event.stage, S.picks[0]))
      : S.mode === 'tutorial' ? new AMB.Match(AMB.tutorial.matchOptions(S.picks[0]))
      : S.mode === 'online' ? AMB.NetUI.makeMatch()
      : new AMB.Match({ mode: S.mode, players });
    // same hero on both sides (e.g. your Kiro vs the Ember boss Kiro): the enemy becomes its "shadow"
    const mirror = S.match.players[0].heroId === S.match.players[1].heroId;
    document.body.classList.toggle('mirror-foe', mirror);
    if (mirror && S.mode === 'campaign') { const hn = HEROES[S.match.players[1].heroId].name, e = S.match.players[1]; if (e.name.includes(hn)) e.name = e.name.replace(hn, 'ظلّ ' + hn); }
    S.startTs = Date.now();
    S.speed = 2;
    show('match');
    nextRound();
  }

  // ======================================================================= round flow
  function prepSeconds() {
    if (S.mode === 'tutorial') return 9999;   // no clock while you learn
    const bonus = AMB.pass ? AMB.pass.prepBonus() : 0;   // battle-pass perk (+ a few seconds, never stats)
    return prepBase() + bonus;
  }
  function prepBase() {
    const learn = S.match && S.match.round <= 2 ? 20 : 0;   // first two rounds: +20s to learn the screen
    if (S.mode === 'hotseat') return CFG.match.hotseatPrepSeconds + learn;
    if (S.mode === 'friendly') return CFG.match.prepSeconds * 2 + learn;
    return CFG.match.prepSeconds + learn;
  }

  function nextRound() {
    const m = S.match;
    m.startRound();
    if (S.mode === 'tutorial') AMB.tutorial.onRound(m);   // fixed shop for the guided match
    S.combat = null;
    if (S.mode === 'online') { beginPrep(mySeat()); return; }   // no computer opponent: your friend's moves arrive when they press ready
    if (S.mode === 'hotseat') {
      S.queue = m.round % 2 ? [0, 1] : [1, 0]; // alternate who shops first (shared pool)
      handoff(S.queue.shift());
    } else {
      S.aiFirst = m.round % 2 === 0;       // alternate first pick from the shared pool
      if (S.aiFirst) AMB.AI.prep(m, 1);
      beginPrep(0);
    }
  }

  // ---- quick-start guide: shown once automatically, reopen with "؟"
  function showTutorial() {
    const steps = [
      ['crown', 'اشترِ', 'اضغط بطاقة المتجر'],
      ['shield', 'ضعها في الساحة', '<b>حارس ومقاتل</b> قدّام · <b>ساحر وقناص ودعم</b> ورا'],
      ['star', 'غيّر رأيك', 'اضغط الوحدة: بيع أو تبديل'],
      ['burst', 'الترقية ★', '٣ نسخ متطابقة = نجمة'],
      ['sword', 'جاهز', 'القتال تلقائي · ' + (S.match && S.match.rules ? 'جولتين من ٣ تكسب' : '٧ جولات')],
    ];
    modal(`<h2>دليل سريع</h2><div class="tut">${steps.map((st, i) => `<div class="tut-step"><span class="tut-n">${i + 1}</span><span class="tut-ic">${icon(st[0])}</span><div><b>${st[1]}</b><p>${st[2]}</p></div></div>`).join('')}</div>
      <p class="hint" style="text-align:center;margin:8px 0 0">لو احتجت شرح أكثر اضغط ⓘ في أي مكان</p>
      <div style="text-align:center;margin-top:10px"><button class="btn primary big" data-act="closeModal">فهمت</button></div>`);
    try { localStorage.setItem('amb_tut', '1'); } catch (e) { /* ignore */ }
  }

  // ---- stage rewards (draft 1 of 3)
  function rewardHTML(id, stage) {
    const R = AMB.DATA.REWARDS[id], m = S.match;
    const unit = id === 'unit' ? `<span class="rw-tag">فئة ${R.tiers[stage]}</span>` : '';
    const bless = id.startsWith('bless') ? '<span class="rw-tag perm">دائمة</span>' : '';
    return { R, text: m.rewardText(id, stage), tags: unit + bless };
  }
  function showRewards(pi) {
    const m = S.match, p = m.players[pi], o = p.rewardOffer, st = AMB.CONFIG.match.stages[o.stage];
    S.rewardFor = pi;
    overlay(`<div class="ov-card rw"><h2>🎁 مكافأة مرحلة «${st.name}»</h2>
      <p class="hint">${S.mode === 'hotseat' ? esc(p.name) + ': ' : ''}اختر مكافأة واحدة.${o.trailing ? ' <b style="color:var(--red)">خيار زيادة لأنك متأخر بالحياة.</b>' : ''}</p>
      <div class="rw-grid">${o.options.map((id, i) => { const r = rewardHTML(id, o.stage); return `<button class="rw-card ${id.startsWith('bless') ? 'bless' : id}" data-act="claimReward" data-idx="${i}"><span class="rw-ic">${icon(r.R.icon)}</span><b>${r.R.name}</b><span class="rw-tx">${r.text}</span>${r.tags}</button>`; }).join('')}</div></div>`);
  }
  function rewardHandoff(pi) {
    const p = S.match.players[pi];
    overlay(`<div class="ov-card"><h2>دور ${esc(p.name)}</h2><p class="hint">عطِ الجهاز لـ ${esc(p.name)} عشان يختار المكافأة.</p>
      <button class="btn primary big" data-act="rewardGo" data-pi="${pi}">أنا جاهز</button></div>`);
  }
  function afterReward() {
    const m = S.match;
    if (S.mode === 'hotseat' && S.rewardQueue.length) { rewardHandoff(S.rewardQueue.shift()); return; }
    closeOverlay();
    if (S.mode !== 'hotseat') { /* AI already picked */ }
    nextRound();
  }

  function handoff(pi) {
    const p = S.match.players[pi];
    S.v = pi;
    S.phase = 'handoff';
    renderMatch();
    overlay(`<div class="ov-card"><h2>دور ${esc(p.name)}</h2>
      <p class="hint">الجولة ${S.match.round}. عطِ الجهاز لـ ${esc(p.name)}، والخصم لا يطالع وقت التجهيز.</p>
      <p>${portrait(HEROES[p.heroId], { k: 'ho' }).replace('class="portrait', 'style="width:80px;height:80px" class="portrait')}</p>
      <button class="btn primary big" data-act="handoffGo" data-pi="${pi}">أنا جاهز</button></div>`);
  }

  function beginPrep(pi) {
    closeOverlay();
    const ctr = document.querySelector('.center'); if (ctr) ctr.scrollTop = 0;
    S.v = pi;
    S.sel = null;
    S.phase = 'resources';
    S.paused = false;
    renderMatch();
    // the first-run guide opens in a moment: skip the round banner and income toast so nothing stacks on it
    const tutNext = false;
    if (!tutNext) { const st = S.match.stageInfo(), first = st.rounds[0] === S.match.round;
      if (S.match.rules) banner(`${icon('flag')} ${S.match.round}<small>/${maxR()}</small>`, S.match.round === 1 ? '' : 'fight');
      else if (st.id === 'finale') banner(`${icon('sword')}${icon('sword')} ${S.match.round}<small>/${CFG.match.maxRounds}</small>`, 'fight');
      else banner(`${icon('flag')} ${S.match.round}<small>/${CFG.match.maxRounds}</small>`); }
    const p = me();
    const inc = p.lastIncome;
    if (inc && !tutNext) {
      const ess = S.match.round > 1 ? CFG.economy.essencePerRound + (HEROES[p.heroId].passive.id === 'deep_reserve' ? 2 : 0) : 0;
      toast(`+${inc.total} ${icon('gold')}${ess ? ` &nbsp; +${ess} ${icon('essence')}` : ''}`, 'good', true);
    }
    setTimeout(() => {
      if (S.phase !== 'resources') return;
      S.phase = 'prep';
      S.deadline = Date.now() + prepSeconds() * 1000;
      renderMatch();
      if (AMB.TutorialUI) AMB.TutorialUI.poke();
    }, 900);
  }

  function endPrep() {
    if (S.phase !== 'prep' && S.phase !== 'resources') return;
    commitDrag();
    const m = S.match;
    m.autoFill(S.v);
    S.sel = null;
    if (S.mode === 'online') { AMB.NetUI.iAmReady(); return; }
    if (S.mode === 'hotseat' && S.queue.length) { handoff(S.queue.shift()); return; }
    if (S.mode !== 'hotseat' && !S.aiFirst) AMB.AI.prep(m, 1);
    startCombat();
  }

  setInterval(() => {
    if (S.screen !== 'match' || S.phase !== 'prep') { if (document.querySelector('.drag-ghost')) cancelDrag(); return; }
    const el = document.querySelector('.timer');
    if (S.paused) return;
    const left = Math.max(0, S.deadline - Date.now());
    if (el) { el.textContent = S.mode === 'tutorial' ? '∞' : Math.ceil(left / 1000) + 's'; el.classList.toggle('warn', left < 6000 && S.mode !== 'tutorial'); }
    if (left <= 0) endPrep();
  }, 200);

  // ======================================================================= combat playback
  function startCombat() {
    const m = S.match;
    cancelDrag();
    closeOverlay();
    S.combatViewer = mySeat();
    S.v = mySeat();
    S.combat = m.createCombat(true);
    S.phase = 'combat';
    renderMatch();
    buildTokens();
    banner(`${icon('sword')}`, 'fight');
    let last = performance.now(), acc = 0;
    const step = (ts) => {
      if (S.phase !== 'combat') return;
      const dt = Math.min(0.1, (ts - last) / 1000);
      last = ts;
      if (!S.paused) {
        acc += dt * S.speed;
        while (acc >= CFG.combat.dt && !S.combat.over) { S.combat.step(); acc -= CFG.combat.dt; }
      }
      drawCombat();
      if (S.combat.over) { setTimeout(finishCombat, 700); return; }
      S.raf = requestAnimationFrame(step);
    };
    S.raf = requestAnimationFrame(step);
  }

  function skipCombat() {
    if (S.phase !== 'combat') return;
    S.combat.runToEnd();
    S.combat.drainEvents();
    drawCombat(true);
  }

  function finishCombat() {
    if (S.phase !== 'combat') return;
    cancelDrag();
    cancelAnimationFrame(S.raf);
    S.phase = 'result';
    const m = S.match;
    const rep = m.resolveCombat(S.combat.result);
    S.lastReport = rep;
    renderMatch(true);
    const mi = mySeat();
    if (rep.winner != null) sfx(S.mode === 'hotseat' || rep.winner === mi ? 'win' : 'lose');
    let cls;
    if (rep.winner === null) cls = 'draw';
    else if (S.mode === 'hotseat') cls = 'win';
    else cls = rep.winner === mi ? 'win' : 'lose';
    const over = m.isOver;
    const side = (i) => { const r = rep.players[i], pl = m.players[i]; return `<div class="rr-side ${rep.winner === i ? 'won' : ''}">${portrait(r.heroKilled ? HEROES[pl.heroId] : HEROES[pl.heroId], { k: 'rr' + i })}
        <div class="rr-life">${icon(r.heroKilled ? 'skull' : 'heart')} <b>${lifeStr(r.lifeAfter)}</b></div>${(r.backlash + r.direct) > 0 ? `<div class="rr-dmg"><bdi dir="ltr">−${Math.round(r.backlash + r.direct)}</bdi></div>` : '<div class="rr-dmg">&nbsp;</div>'}</div>`; };
    const me0 = rep.players[mi];
    const why = S.mode !== 'hotseat' && rep.winner === 1 - mi ? (me0.exposed ? `<div class="rr-why">${icon('shield')}<i>✗</i> ➜ ${icon('warn')}</div>` : `<div class="rr-why">${icon('star')} ➜ ${icon('sword')}</div>`) : '';
    const title = rep.winner === null ? `الجولة ${m.round}: تعادل`
      : S.mode === 'hotseat' ? `الجولة ${m.round}: فاز ${esc(m.players[rep.winner].name)}`
      : over ? (rep.winner === mi ? 'فزت بالمباراة! 🎉' : 'خسرت المباراة')
      : `الجولة ${m.round}: ${rep.winner === mi ? 'فزت' : 'خسرت'}`;
    const whyTxt = S.mode !== 'hotseat' && rep.winner === 1 - mi ? (me0.exposed ? 'سقط خط الدفاع عندك' : 'العدو كان أقوى هالجولة') : '';
    overlay(`<div class="ov-card rr ${cls}"><div class="rr-title">${title}</div><div class="rr-big">${icon(rep.winner === null ? 'swap' : cls === 'lose' ? 'skull' : 'crown')}</div>
      <div class="rr-row">${side(0)}<div class="rr-vs">${icon('sword')}</div>${side(1)}</div>${why}${whyTxt ? `<div class="rr-note">${whyTxt}</div>` : ''}${rep.finale ? `<div class="rr-why">${icon('flame')} ×${CFG.match.finaleLossMult}</div>` : ''}
      <button class="btn primary big rr-go" data-act="${over ? 'toResults' : m.rewardPending ? 'rewards' : 'nextRound'}">${over ? 'النتيجة' : m.rewardPending ? 'اختر مكافأتك' : 'الجولة الجاية'}</button></div>`);
  }

  // ---- card helpers shared by shop / bench / field / codex
  function cardStats(def, star) {
    const sm = CFG.stars.mult[star || 1];
    return { hp: Math.round(def.hp * sm), atk: Math.round(def.atk * sm) };
  }
  // Icon language: every fact on a card is a symbol, only numbers (and one short name) remain as text.
  const ART = AMB.art;
  const disc = (cls, iconName, title, tip) => `<span class="bd ${cls}" title="${esc(title || '')}" ${tip ? `data-act="tip" data-k="${tip[0]}" data-id="${tip[1]}"${tip[2] ? ` data-x="${tip[2]}"` : ''}` : ''}>${icon(iconName)}</span>`;
  const gems = (n) => `<span class="gems t${n}">${'★'.repeat(n)}</span>`;
  const sv = (ic, v, cls) => `<span class="sv ${cls || ''}">${icon(ic)}<b>${v}</b></span>`;

  /** Fantasy-card look. 'full' = shop/codex card; 'mini' = board minion (oval portrait + attack/health discs). */
  function cardHTML(def, o) {
    o = o || {};
    const W = WORLDS[def.world];
    const isHero = !def.role;
    const tier = isHero ? 'hero' : 't' + def.tier;
    const star = o.star || 1;
    const sc = isHero ? '' : ' s' + star;
    const sel = o.sel ? ' sel' : '';
    const attrs = o.attrs || '';
    // card level / rarity (and hero level) power only exists in progression fights: show the real numbers where they count
    let pw = o.pow;
    if (pw == null && !isHero && S.screen === 'match' && S.match && S.match.players && S.match.players[S.v] && S.match.players[S.v].cardPower) pw = S.match.players[S.v].cardPower[def.id];
    pw = pw || 1;
    // a hero card outside a match shows the profile's hero level: life +1 per level, summoned attack +5% per level
    const hLv = isHero && o.life == null && S.screen !== 'match' && S.mode !== 'hotseat' && S.mode !== 'online' && AMB.heroes ? AMB.heroes.level(def.id) : 1;
    if (isHero && hLv > 1) pw = pw * AMB.heroes.power(def.id).atk;
    const atk = isHero ? Math.round(def.board.atk * pw) : Math.round(cardStats(def, star).atk * pw);
    const hp = isHero ? (o.life != null ? o.life : CFG.match.heroLife + (hLv - 1) * (CFG.match.heroLifePerLevel || 0)) : Math.round(cardStats(def, star).hp * pw);
    const upCls = pw > 1.001 ? ' up' : '';
    const numCls = (n) => (String(n).length > 3 ? ' class="sm"' : '');
    const tp = (k, id, x) => (o.size === 'mini' ? '' : ` data-act="tip" data-k="${k}" data-id="${id}"${x ? ` data-x="${x}"` : ''}`);   // full cards: every badge explains itself when tapped
    const atkBd = `<span class="hc-atk${upCls}"${tp('atk', def.id, star)}>${icon('sword')}<b${numCls(atk)}>${atk}</b></span>`;
    const hpBd = `<span class="hc-hp${isHero ? (hLv > 1 ? ' up' : '') : upCls}"${tp('hp', def.id, star)}>${icon('heart')}<b${numCls(hp)}>${hp}</b></span>`;
    const T3 = (k, id) => (o.size === 'mini' ? null : [k, id]);
    const roleD = isHero ? disc('role hero', 'crown', 'بطل', T3('herorole', def.id)) : disc('role', ART.ROLE_ICON[def.role], ROLES[def.role].name, T3('role', def.id));
    if (o.size === 'mini') {
      const items = (o.items || []).map((it) => `<i title="${esc(ITEMS[it].name)}">${icon(ITEMS[it].icon)}</i>`).join('');
      const mid = o.live ? `<div class="hc-bar"><div class="hpb"><b></b><i></i></div>${isHero ? '' : '<div class="mpb"><i></i></div>'}</div>` : (items ? `<div class="hc-its">${items}</div>` : '');
      return `<div class="tcard hc cv3 mini fr-${def.world} ${tier}${sc}${sel} r-${def.rarity || 'common'} ${o.cls || ''}" style="--wc:${W.color}" title="${esc(def.name)}" ${attrs}>
        <i class="hc-halo"></i><div class="hc-frame"></div><div class="hc-art">${portrait(def, { bare: true, k: o.k })}<i class="sheen"></i></div><div class="hc-ring"></div>
        ${roleD}${isHero ? '' : stars(star)}${o.prog ? `<span class="hc-prog" title="نسخ متطابقة: واحدة إضافية وتترقى">${o.prog}</span>` : ''}<i class="hc-sbar"></i>${atkBd}${hpBd}${mid}</div>`;
    }
    const own = o.own ? `<span class="hc-own ${o.own.pair ? 'up' : ''}" data-act="tip" data-k="own" data-id="${def.id}" data-x="${o.own.pair ? 'up' : o.own.n}">${o.own.pair ? '↑' : '×' + o.own.n}</span>` : '';
    const rolePill = isHero ? '' : `<span class="rolepill ${ROLES[def.role].kind}" data-act="tip" data-k="role" data-id="${def.id}">${icon(ART.ROLE_ICON[def.role])}${ROLES[def.role].name}</span>`;
    const iconsRow = isHero
      ? disc('world', ART.WORLD_ICON[def.world], W.name, ['world', def.id]) + roleD
      : disc('world', ART.WORLD_ICON[def.world], W.name, ['world', def.id]) + rolePill + disc('skill', ART.SKILL_ICON[def.skill.type] || 'star', def.skill.name, ['skill', def.id, star]);
    const RA = AMB.ECONOMY && AMB.ECONOMY.rarities[def.rarity];
    const rar = RA ? `<span class="hc-rar" data-act="tip" data-k="rar" data-id="${def.id}">${RA.name}</span>` : '';
    const lvl = o.lvl ? `<span class="hc-lvl" data-act="tip" data-k="lvl" data-id="${def.id}" data-x="${o.lvl}">Lv ${o.lvl}</span>` : '';
    const gemN = RA ? RA.order : 1;
    return `<div class="tcard hc cv3 full fr-${def.world} ${tier}${sc} r-${def.rarity || 'common'} ${o.cls || ''}" style="--wc:${W.color}" ${attrs}>
      <div class="hc-frame"><i class="sheen"></i></div>${rar}${lvl}
      <div class="hc-art">${portrait(def, { bare: true, k: o.k })}</div><div class="hc-ring"></div>
      <div class="hc-name ${def.name.length > 14 ? 'ln2' : def.name.length > 10 ? 'ln1' : ''}" data-act="tip" data-k="all" data-id="${def.id}" data-x="${star}"><b>${def.name}</b></div>
      <div class="hc-icons" data-act="tip" data-k="all" data-id="${def.id}" data-x="${star}">${iconsRow}</div>
      ${isHero ? '' : gems(gemN).replace('class="gems', 'data-act="tip" data-k="rar" data-id="' + def.id + '" class="hc-gems gems')}
      ${isHero ? '' : `<span class="hc-cost" data-act="tip" data-k="cost" data-id="${def.id}"><i></i><b>${def.cost}</b></span>`}
      <i class="hc-sbar"></i>${atkBd}${hpBd}${own}
      <span class="hc-info" data-act="${isHero ? 'heroInfo' : 'detail'}" data-id="${def.id}" title="تفاصيل">i</span></div>`;
  }

  const fmtStat = (stat, v) => (['startMana', 'range'].includes(stat) ? '+' + v : '+' + Math.round(v * 100) + '%');
  function itemChips(it) {
    if (it.kind === 'equip') return it.effects.map((e) => `<span class="sv">${icon(ART.STAT_ICON[e.stat] || 'star')}<b>${fmtStat(e.stat, e.value)}</b></span>`).join('');
    const sp = it.spell;
    const map = { buffAll: ['sword', '+' + Math.round(sp.atkPct * 100) + '%'], shieldFront: ['shield', sp.amount], hitBack: ['burst', sp.dmg], hasteAll: ['wind', '+' + Math.round(sp.asPct * 100) + '%'] }[sp.type];
    return map ? `<span class="sv">${icon(map[0])}<b>${map[1]}</b></span>` : '';
  }
  function itemCardHTML(it, o) {
    o = o || {};
    return `<div class="tcard hc cv3 full item ${it.kind} ${o.cls || ''}" ${o.attrs || ''} title="${esc(it.name + ': ' + it.text)}">
      <div class="hc-frame"></div>
      <div class="hc-art iconart">${icon(it.icon, 'big-ic')}</div><div class="hc-ring"></div>
      <div class="hc-name"><b>${it.name}</b></div>
      <i class="hc-sbar"></i><div class="hc-chips">${itemChips(it)}</div>
      <span class="hc-cost"><i></i><b>${it.cost}</b></span></div>`;
  }

  // ---- combat field: same grid as the prep field, cards stay in their cells
  function buildTokens() {
    renderField(true);
    const ctr = document.querySelector('.center'); if (ctr) ctr.scrollTop = 0;
    window.scrollTo(0, 0);
    const f = $('field');
    $('fx').setAttribute('viewBox', `0 0 ${f.clientWidth} ${f.clientHeight}`);
    $('fx').innerHTML = '';
    $('floats').innerHTML = '';
    S.cardEls = {};
    S.combat.fighters.forEach((fi) => {
      const el = document.querySelector(`[data-fid="${fi.id}"]`);
      if (el) S.cardEls[fi.id] = { el, hp: el.querySelector('.hpb i'), lag: el.querySelector('.hpb b'), mp: el.querySelector('.mpb i'), hpn: el.querySelector('.hc-hp b'), lagW: 100, last: -1 };
    });
  }

  const viewerSide = () => (S.combat && (S.phase === 'combat' || S.phase === 'result') ? S.combatViewer : S.v);
  const postEl = (side) => $(side === viewerSide() ? 'post-bottom' : 'post-top');
  const anchorEl = (fi) => (S.cardEls[fi.id] ? S.cardEls[fi.id].el : postEl(fi.side));
  function center(el) {
    const fr = $('field').getBoundingClientRect(), r = el.getBoundingClientRect();
    return { x: r.left - fr.left + r.width / 2, y: r.top - fr.top + r.height / 2 };
  }
  function addFloat(left, top, text, cls) {
    const fl = $('floats');
    if (fl.childElementCount > 40) fl.firstElementChild.remove();
    const el = document.createElement('div');
    el.className = 'float ' + (cls || '');
    el.style.left = left + '%';
    el.style.top = top + '%';
    el.textContent = text;
    fl.appendChild(el);
    setTimeout(() => el.remove(), cls && cls.includes('big') ? 1600 : 900);
  }
  function floatAt(el, text, cls, dy) {
    const f = $('field'), c = center(el);
    addFloat((c.x / f.clientWidth) * 100 + (Math.random() * 6 - 3), ((c.y + (dy || 0)) / f.clientHeight) * 100, text, cls);
  }
  function flash(el, cls, ms) { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); setTimeout(() => el.classList.remove(cls), ms); }

  // ---- sound (synthesised with WebAudio; starts after the first tap/click)
  const SND = { ctx: null, on: true, last: {} };
  try { SND.on = localStorage.getItem('amb_sound') !== '0'; } catch (e) { /* storage blocked */ }
  function audio() {
    if (!SND.on) return null;
    try {
      if (!SND.ctx) { const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null; SND.ctx = new AC(); }
      if (SND.ctx.state === 'suspended') SND.ctx.resume();
      return SND.ctx;
    } catch (e) { return null; }
  }
  function tone(c, o) {
    const t0 = c.currentTime + (o.at || 0), osc = c.createOscillator(), g = c.createGain();
    osc.type = o.type || 'sine'; osc.frequency.setValueAtTime(o.f, t0);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t0 + o.d);
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(o.v || 0.15, t0 + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.d);
    osc.connect(g); g.connect(c.destination); osc.start(t0); osc.stop(t0 + o.d + 0.02);
  }
  function noise(c, d, v, hp) {
    const n = Math.floor(c.sampleRate * d), buf = c.createBuffer(1, n, c.sampleRate), ch = buf.getChannelData(0);
    for (let i = 0; i < n; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = c.createBufferSource(), g = c.createGain(), f = c.createBiquadFilter();
    f.type = 'highpass'; f.frequency.value = hp || 800; g.gain.value = v;
    src.buffer = buf; src.connect(f); f.connect(g); g.connect(c.destination); src.start();
  }

  // --- sound building blocks: a swooshing "air" sound (band-passed noise gliding between two pitches) and metal (ringing partials)
  function swoosh(c, o) {
    const n = Math.floor(c.sampleRate * o.d), buf = c.createBuffer(1, n, c.sampleRate), ch = buf.getChannelData(0);
    for (let i = 0; i < n; i++) { const x = i / n; ch[i] = (Math.random() * 2 - 1) * Math.sin(Math.PI * Math.min(1, x * (o.sharp || 1))) * (1 - x * 0.3); }
    const t0 = c.currentTime + (o.at || 0), src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    f.type = 'bandpass'; f.Q.value = o.q || 2.2; f.frequency.setValueAtTime(o.f1, t0); f.frequency.exponentialRampToValueAtTime(o.f2, t0 + o.d);
    g.gain.value = o.v || 0.1; src.buffer = buf; src.connect(f); f.connect(g); g.connect(c.destination); src.start(t0);
  }
  function clang(c, o) {   // struck metal: inharmonic partials that die away at different speeds
    [[1, 1], [2.76, 0.7], [5.4, 0.5], [8.93, 0.3]].forEach(([r, a], i) => tone(c, { f: o.f * r, d: (o.d || 0.28) / (1 + i * 0.7), v: (o.v || 0.07) * a, type: i % 2 ? 'triangle' : 'sine', at: o.at || 0 }));
    noise(c, 0.04, (o.v || 0.07) * 0.8, 3000);
  }
  function thud(c, o) { tone(c, { f: o.f || 120, to: (o.f || 120) * 0.45, d: o.d || 0.14, v: o.v || 0.16, type: 'sine', at: o.at || 0 }); noise(c, 0.05, (o.v || 0.16) * 0.5, 250); }
  const SFX = {
    click: (c) => tone(c, { f: 520, to: 780, d: 0.06, v: 0.08, type: 'triangle' }),
    buy: (c) => { tone(c, { f: 660, d: 0.07, v: 0.1, type: 'square' }); tone(c, { f: 990, d: 0.12, v: 0.1, type: 'square', at: 0.06 }); },
    reroll: (c) => noise(c, 0.18, 0.06, 2500),
    hit: (c) => { thud(c, { f: 170, d: 0.07, v: 0.1 }); noise(c, 0.05, 0.07, 1500); },
    crit: (c) => { noise(c, 0.14, 0.2, 700); tone(c, { f: 300, to: 60, d: 0.18, v: 0.18, type: 'sawtooth' }); tone(c, { f: 1200, d: 0.08, v: 0.08, type: 'triangle' }); },
    cast: (c) => { tone(c, { f: 300, to: 900, d: 0.3, v: 0.1, type: 'sawtooth' }); tone(c, { f: 600, to: 1800, d: 0.3, v: 0.05, type: 'triangle', at: 0.04 }); },
    heal: (c) => { tone(c, { f: 660, d: 0.12, v: 0.08 }); tone(c, { f: 880, d: 0.16, v: 0.08, at: 0.09 }); tone(c, { f: 1320, d: 0.2, v: 0.06, at: 0.18 }); },
    death: (c) => { noise(c, 0.3, 0.14, 300); tone(c, { f: 220, to: 40, d: 0.35, v: 0.16, type: 'sawtooth' }); },
    merge: (c) => { [523, 659, 784, 1047].forEach((f, i) => tone(c, { f, d: 0.22, v: 0.12, type: 'triangle', at: i * 0.07 })); noise(c, 0.25, 0.06, 4000); },
    v_fighter: (c) => { swoosh(c, { d: 0.14, f1: 900, f2: 3200, q: 1.6, v: 0.13 }); clang(c, { f: 640, d: 0.3, v: 0.07, at: 0.1 }); thud(c, { f: 150, v: 0.1, at: 0.1 }); },
    v_assassin: (c) => { swoosh(c, { d: 0.09, f1: 2600, f2: 7000, q: 2.8, v: 0.1, sharp: 3 }); swoosh(c, { d: 0.08, f1: 2200, f2: 6200, q: 2.8, v: 0.08, at: 0.07, sharp: 3 }); tone(c, { f: 3300, to: 2400, d: 0.1, v: 0.025, type: 'sine', at: 0.05 }); },
    v_mage: (c) => { tone(c, { f: 420, to: 1400, d: 0.2, v: 0.05, type: 'sine' }); tone(c, { f: 630, to: 2100, d: 0.2, v: 0.025, type: 'triangle', at: 0.03 }); swoosh(c, { d: 0.22, f1: 600, f2: 4200, q: 3, v: 0.05 }); [1568, 2093].forEach((f, i) => tone(c, { f, d: 0.16, v: 0.03, type: 'sine', at: 0.19 + i * 0.05 })); },
    v_marksman: (c) => { tone(c, { f: 190, to: 140, d: 0.1, v: 0.12, type: 'triangle' }); tone(c, { f: 520, to: 300, d: 0.07, v: 0.05, type: 'square' }); swoosh(c, { d: 0.18, f1: 5200, f2: 1600, q: 2.4, v: 0.1, at: 0.04 }); thud(c, { f: 220, d: 0.08, v: 0.06, at: 0.2 }); },
    v_guardian: (c) => { thud(c, { f: 100, d: 0.2, v: 0.2 }); clang(c, { f: 420, d: 0.34, v: 0.09, at: 0.01 }); swoosh(c, { d: 0.09, f1: 500, f2: 1400, q: 1.2, v: 0.07 }); },
    v_support: (c) => { [784, 988, 1319].forEach((f, i) => tone(c, { f, d: 0.28, v: 0.04, type: 'sine', at: i * 0.07 })); swoosh(c, { d: 0.25, f1: 1800, f2: 5200, q: 4, v: 0.025 }); },
    c_fighter: (c) => { swoosh(c, { d: 0.22, f1: 500, f2: 2600, q: 1.4, v: 0.16 }); thud(c, { f: 90, d: 0.34, v: 0.22, at: 0.16 }); clang(c, { f: 520, d: 0.5, v: 0.1, at: 0.16 }); noise(c, 0.3, 0.07, 400); },
    c_assassin: (c) => { swoosh(c, { d: 0.12, f1: 2800, f2: 8000, q: 2.8, v: 0.1, sharp: 3 }); swoosh(c, { d: 0.12, f1: 8000, f2: 2400, q: 2.8, v: 0.09, at: 0.1, sharp: 3 }); noise(c, 0.26, 0.05, 3500); tone(c, { f: 900, to: 180, d: 0.3, v: 0.05, type: 'sine', at: 0.06 }); },
    c_mage: (c) => { tone(c, { f: 260, to: 1300, d: 0.45, v: 0.07, type: 'sine' }); tone(c, { f: 390, to: 1950, d: 0.45, v: 0.03, type: 'triangle', at: 0.04 }); swoosh(c, { d: 0.4, f1: 400, f2: 5200, q: 3, v: 0.07 }); [1319, 1760, 2349].forEach((f, i) => tone(c, { f, d: 0.3, v: 0.035, type: 'sine', at: 0.34 + i * 0.06 })); thud(c, { f: 80, v: 0.12, d: 0.3, at: 0.36 }); },
    c_marksman: (c) => { [0, 0.13, 0.26].forEach((t) => { tone(c, { f: 180, to: 130, d: 0.09, v: 0.1, type: 'triangle', at: t }); swoosh(c, { d: 0.14, f1: 5200, f2: 1800, q: 2.4, v: 0.08, at: t + 0.03 }); thud(c, { f: 210, d: 0.07, v: 0.05, at: t + 0.15 }); }); },
    c_guardian: (c) => { thud(c, { f: 80, d: 0.45, v: 0.24 }); clang(c, { f: 330, d: 0.6, v: 0.11, at: 0.02 }); clang(c, { f: 495, d: 0.5, v: 0.07, at: 0.12 }); noise(c, 0.3, 0.06, 600); },
    c_support: (c) => { [523, 659, 784, 1047, 1319].forEach((f, i) => tone(c, { f, d: 0.4, v: 0.045, type: 'sine', at: i * 0.07 })); swoosh(c, { d: 0.5, f1: 1200, f2: 5800, q: 4, v: 0.03 }); },
    land1: (c) => noise(c, 0.07, 0.05, 700),
    land2: (c) => { tone(c, { f: 130, to: 70, d: 0.16, v: 0.14, type: 'sine' }); noise(c, 0.12, 0.07, 500); },
    land3: (c) => { tone(c, { f: 100, to: 45, d: 0.3, v: 0.2, type: 'sawtooth' }); tone(c, { f: 60, to: 35, d: 0.35, v: 0.2, type: 'sine' }); noise(c, 0.26, 0.12, 300); },
    land4: (c) => { tone(c, { f: 64, to: 36, d: 0.9, v: 0.16, type: 'sine' }); noise(c, 0.5, 0.05, 140); [659, 880].forEach((f, i) => tone(c, { f, d: 0.5, v: 0.035, type: 'sine', at: 0.2 + i * 0.12 })); },
    charge: (c) => { tone(c, { f: 60, to: 300, d: 1.4, v: 0.07, type: 'sine' }); tone(c, { f: 120, to: 600, d: 1.4, v: 0.03, type: 'triangle' }); },
    epicCharge: (c) => { tone(c, { f: 100, to: 380, d: 0.6, v: 0.1, type: 'sawtooth' }); },
    epicHit: (c) => { tone(c, { f: 90, to: 40, d: 0.4, v: 0.22, type: 'sine' }); noise(c, 0.3, 0.12, 400); [523, 659, 784, 988].forEach((f, i) => tone(c, { f, d: 0.3, v: 0.1, type: 'triangle', at: 0.05 + i * 0.07 })); },
    legend: (c) => { tone(c, { f: 58, to: 34, d: 1.1, v: 0.16, type: 'sine' }); noise(c, 0.5, 0.05, 140); [392, 523, 659, 784].forEach((f, i) => tone(c, { f, d: 0.9, v: 0.05, type: 'sine', at: 0.1 + i * 0.12 })); },
    banner: (c) => { tone(c, { f: 90, to: 50, d: 0.35, v: 0.2, type: 'sawtooth' }); noise(c, 0.25, 0.08, 500); },
    win: (c) => { [523, 659, 784, 1047, 1319].forEach((f, i) => tone(c, { f, d: 0.28, v: 0.13, type: 'triangle', at: i * 0.11 })); },
    lose: (c) => { [392, 330, 262, 196].forEach((f, i) => tone(c, { f, d: 0.34, v: 0.13, type: 'sawtooth', at: i * 0.16 })); },
  };
  function sfx(name) {
    const c = audio(); if (!c || !SFX[name]) return;
    const now = performance.now(), gap = { hit: 70, crit: 120, heal: 150, cast: 120, death: 120, v_fighter: 90, v_assassin: 90, v_mage: 110, v_marksman: 90, v_guardian: 110, v_support: 140, c_fighter: 120, c_assassin: 120, c_mage: 120, c_marksman: 120, c_guardian: 120, c_support: 120 }[name] || 0;
    if (gap && now - (SND.last[name] || 0) < gap) return;   // many hits in one tick = one sound
    SND.last[name] = now;
    try { SFX[name](c); } catch (e) { /* ignore */ }
  }
  function soundBtn() { return `<button class="btn small" data-act="sound" title="الصوت">${SND.on ? '🔊' : '🔇'}</button>`; }

  // ---- visual effects (pure presentation)
  function burst(el, color, n, o) {
    o = o || {};
    if (!el || document.querySelectorAll('.fxp').length > 120) return;
    const r = el.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, d = (o.r || 26) * (0.5 + Math.random());
      const q = document.createElement('i');
      q.className = 'fxp' + (o.cls ? ' ' + o.cls : '');
      q.style.left = cx + 'px'; q.style.top = cy + 'px';
      q.style.setProperty('--tx', Math.cos(a) * d + 'px');
      q.style.setProperty('--ty', (o.up ? -d * 1.3 : Math.sin(a) * d) + 'px');
      q.style.setProperty('--c', color);
      q.style.setProperty('--s', (o.s || 4 + Math.random() * 4) + 'px');
      document.body.appendChild(q);
      setTimeout(() => q.remove(), 750);
    }
  }
  function banner(text, cls) {
    const b = document.createElement('div');
    b.className = 'round-banner ' + (cls || '');
    b.innerHTML = '<span>' + text + '</span>';
    document.body.appendChild(b);
    sfx(cls === 'merge' ? 'merge' : 'banner');
    setTimeout(() => b.remove(), 1500);
  }

  function drawCombat(skipFx) {
    const c = S.combat;
    const byId = {};
    c.fighters.forEach((f) => (byId[f.id] = f));
    for (const f of c.fighters) {
      const t = S.cardEls[f.id];
      if (!t) continue;
      const pct = Math.max(0, (f.hp / f.maxHp) * 100);
      t.hp.style.width = pct + '%';
      t.lagW = Math.max(pct, t.lagW - 1.2);
      t.lag.style.width = t.lagW + '%';
      if (t.mp) t.mp.style.width = Math.min(100, (f.mana / f.maxMana) * 100) + '%';
      if (t.hpn) { const v = Math.max(0, Math.ceil(f.isHero ? f.hp / CFG.combat.heroHpScale : f.hp)); if (v !== t.last) { t.hpn.textContent = v; t.hpn.className = v > 999 ? 'sm' : ''; t.last = v; } }
      const cl = t.el.classList;
      cl.toggle('dead', !f.alive);
      cl.toggle('retreated', f.alive && f.isHero && !f.onBoard);
      cl.toggle('stunned', f.stun > 0);
      cl.toggle('shielded', f.shield > 1);
    }
    renderPosts();
    const clock = document.querySelector('.combat-ctrl .clock');
    if (clock) clock.textContent = fmt(c.t, 1) + 's';
    const fury = document.querySelector('.combat-ctrl .fury');
    if (fury) fury.innerHTML = c.t > CFG.combat.furyStart ? `${icon('flame')}×${fmt(c.fury(), 2)}` : (c.assault ? icon('warn') : '');

    const events = c.drainEvents();
    if (skipFx) return;
    const fx = $('fx');
    for (const e of events) {
      const f = e.id != null ? byId[e.id] : null;
      const el = f ? anchorEl(f) : null;
      if (e.type === 'damage' && f && el) {
        if (e.amount >= 4 || e.crit) floatAt(el, e.amount, e.crit ? 'crit' : e.skill ? 'skill' : '');
        flash(el, 'hit', 110);
        if (e.amount >= 4 || e.crit) burst(el, e.crit ? '#ffd24a' : e.skill ? '#ff6b73' : '#ffffff', e.crit ? 12 : e.skill ? 8 : 3, { r: e.crit ? 34 : 22 });
        if (e.crit || f.isHero) flash($('field'), 'shake', 260);
        sfx(e.crit ? 'crit' : 'hit');
      } else if (e.type === 'death' && f && el) {
        burst(el, '#a9a9a9', 16, { r: 38, s: 7 }); burst(el, '#ff6b73', 6, { r: 30 }); sfx('death');
        if (f.isHero) flash($('field'), 'shake', 400);
      } else if (e.type === 'heal' && f && el) {
        floatAt(el, '+' + e.amount, 'heal');
        burst(el, '#5bf08b', 5, { up: true, cls: 'plus', r: 22, s: 7 }); sfx('heal');
      } else if (e.type === 'cast' && f && el) {
        flash(el, 'cast', 500); floatAt(el, e.name, 'label', 26);
        if (AMB.VFX && f.role) AMB.VFX.cast(f, el, { sfx });
        else { burst(el, (WORLDS[f.world] || {}).color || '#ffd24a', 14, { r: 44, s: 6 }); sfx('cast'); }
      } else if (e.type === 'attack' && byId[e.from] && byId[e.to]) {
        const ea = anchorEl(byId[e.from]), eb = anchorEl(byId[e.to]);
        if (!ea || !eb) continue;
        const a = center(ea), b = center(eb);
        const L = Math.hypot(b.x - a.x, b.y - a.y) || 1;
        ea.style.setProperty('--dx', ((b.x - a.x) / L) * 9 + 'px');
        ea.style.setProperty('--dy', ((b.y - a.y) / L) * 9 + 'px');
        ea.style.setProperty('--bx', (-(b.x - a.x) / L) * 4 + 'px'); ea.style.setProperty('--by', (-(b.y - a.y) / L) * 4 + 'px');
        flash(ea, 'atk', 230);
        if (AMB.VFX && AMB.VFX.attack(byId[e.from], byId[e.to], ea, eb, { sfx })) continue;
        if (!e.ranged) { const ring = document.createElement('i'); ring.className = 'impact'; const rb = eb.getBoundingClientRect(); ring.style.left = rb.left + rb.width / 2 + 'px'; ring.style.top = rb.top + rb.height / 2 + 'px'; document.body.appendChild(ring); setTimeout(() => ring.remove(), 330); }
        const ln = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        ln.setAttribute('x1', a.x); ln.setAttribute('y1', a.y); ln.setAttribute('x2', b.x); ln.setAttribute('y2', b.y);
        ln.setAttribute('stroke', byId[e.from].side === S.combatViewer ? '#5fe3ff' : '#ff8a90');
        ln.setAttribute('stroke-width', e.ranged ? 2 : 4); ln.setAttribute('stroke-linecap', 'round');
        ln.setAttribute('opacity', 0.85); ln.style.transition = 'opacity .25s';
        fx.appendChild(ln);
        requestAnimationFrame(() => (ln.style.opacity = 0));
        setTimeout(() => ln.remove(), 280);
      } else if (e.type === 'heroAbility' || e.type === 'spell') {
        addFloat(50, e.side === S.combatViewer ? 62 : 38, (e.type === 'spell' ? '✦ ' : '⚡ ') + e.name, 'big');
      } else if (e.type === 'exposed') {
        addFloat(50, e.side === S.combatViewer ? 84 : 16, 'سقط خط الدفاع!', 'big');
      } else if (e.type === 'assault') {
        addFloat(50, e.side === S.combatViewer ? 80 : 20, 'يهجمون على البطل!', 'big');
      } else if (e.type === 'retreat') {
        addFloat(50, e.side === S.combatViewer ? 80 : 20, 'البطل رجع لمركزه', 'big');
      } else if (e.type === 'sealed') {
        addFloat(50, e.side === S.combatViewer ? 88 : 12, 'البطل تحصّن (ضرر محدود)', 'label');
      } else if (e.type === 'leap' && f && el) {
        floatAt(el, 'قفزة!', 'label', 26);
      } else if (e.type === 'stun' && f && el) {
        floatAt(el, 'شلل', 'label', 20);
      }
    }
  }

  // ======================================================================= match rendering
  function renderMatch(keepTokens) {
    if (!S.match) return;
    renderTop();
    renderSlots();
    if (S.phase !== 'combat' && !keepTokens) { $('fx').innerHTML = ''; $('floats').innerHTML = ''; }
    renderPosts();
    renderBench();
    renderShop();
    renderLeft();
    renderRight();
    renderCombatCtrl();
    if (AMB.FX) AMB.FX.watch();
    dupHint();
    fitMatch();
  }
  // the first time a copy of a card that is already on the board gets placed: explain why the synergy number did not move
  function dupHint() {
    if (!S.match || S.phase !== 'prep' || S.mode === 'tutorial') return;
    const p = me(), n = dupCount(p), key = S.match.round + ':' + S.v;
    if (S.dupSeen == null || S.dupKey !== key) { S.dupKey = key; S.dupSeen = n; return; }
    if (n > S.dupSeen && !S.dupToldMatch) { S.dupToldMatch = S.match; toast('نفس الشخصية مرتين: التآزر يحسبها مرة وحدة. حط شخصيات مختلفة عشان يزيد', ''); }
    S.dupSeen = n;
  }
  // Phones: the browser's real usable height can be smaller than what the CSS assumes (address bar, gesture bar, PWA window).
  // If the shop would end below the screen, shrink the field a little until everything fits.
  function fitMatch() {
    const fw = document.querySelector('#scr-match .field-wrap'), shop = $('shopbar');
    if (!fw || !shop || S.screen !== 'match' || !matchMedia('(max-width: 860px) and (orientation: portrait)').matches) return;
    fw.style.removeProperty('--cwv'); shop.style.removeProperty('height');
    if (shop.scrollHeight > shop.clientHeight + 1) shop.style.height = shop.scrollHeight + 2 + 'px';   // the cards are taller than the shop box: grow the box, never cut a card
    const scr = $('scr-match'), vv = (globalThis.visualViewport && visualViewport.height) || innerHeight;
    const vh = Math.min(vv, innerHeight, scr ? scr.getBoundingClientRect().bottom : 1e5);   // whichever ends first: the window or the match screen itself
    let over = shop.getBoundingClientRect().bottom - (vh - 2);
    if (over <= 0) return;
    let cw = fw.querySelector('#slots') ? fw.querySelector('#slots .cell').getBoundingClientRect().width : 80;
    for (let i = 0; i < 4 && over > 0; i++) {
      cw = Math.max(44, cw - over / 4.4 - 0.5);
      fw.style.setProperty('--cwv', cw + 'px');
      over = shop.getBoundingClientRect().bottom - (vh - 2);
    }
  }
  // the visible height changes while the page is open (Chrome's address bar hides, the phone rotates, the app comes back from the background):
  // keep one CSS variable in step with the real visible height and re-fit the match whenever it changes
  let lastAppH = 0;
  function syncViewport() {
    try {
      const h = Math.round((globalThis.visualViewport && visualViewport.height) || innerHeight);
      if (h !== lastAppH) { lastAppH = h; document.documentElement.style.setProperty('--app-h', h + 'px'); }
      if (S.match && S.screen === 'match') fitMatch();
    } catch (e) { /* ignore */ }
  }
  ['resize', 'orientationchange', 'pageshow', 'focus', 'scroll'].forEach((ev) => window.addEventListener(ev, syncViewport, { passive: true }));
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { syncViewport(); setTimeout(syncViewport, 300); } });
  if (globalThis.visualViewport) { visualViewport.addEventListener('resize', syncViewport); visualViewport.addEventListener('scroll', syncViewport); }
  setInterval(() => { if (S.screen === 'match') syncViewport(); }, 800);   // safety net for browsers that skip the events
  syncViewport();

  function renderTop() {
    const m = S.match, p = me(), o = opp();
    const ph = S.phase;
    const need = m.xpNeeded(p);
    const left = ph === 'prep' ? (S.mode === 'tutorial' ? '∞' : Math.ceil(Math.max(0, S.deadline - Date.now()) / 1000) + 's') : '—';
    const avail = p.essence - m.reservedEssence(p);
    const lc = (pl, hid, k, me) => `<span class="lifechip ${me ? 'me' : ''}">${portrait(hid, { k })}${icon('heart')} <b>${lifeStr(pl.life)}</b><i class="lc-st"></i></span>`;
    $('topbar').innerHTML = `
      <span class="tb-round" title="${icon('flag').replace(/<[^>]+>/g, '')}">${icon('flag')} ${m.round}<small>/${maxR()}</small></span>
      ${m.rules ? `<span class="stagechip"><b>${p.stats.wins} – ${o.stats.wins}</b><span class="pips">${Array.from({ length: m.rules.winsNeeded || 2 }, (_, k) => k).map((k) => `<i class="pip ${k < p.stats.wins ? 'done' : ''}"></i>`).join('')}</span></span>`
        : `<span class="stagechip"><span class="pips">${[1, 2, 3, 4, 5, 6, 7].map((r) => `<i class="pip ${r < m.round ? 'done' : r === m.round ? 'now' : ''} ${CFG.match.stages.some((st) => st.rounds[1] === r && r < 7) ? 'gap' : ''}"></i>`).join('')}</span></span>`}
      <span class="timer">${S.paused ? icon('pause') : left}</span>
      <span class="tb-spacer"></span>
      ${lc(p, myAvatar(p, 0), 'tb0', true)}${lc(o, HEROES[o.heroId], 'tb1', false)}
      <span class="res gold">${icon('gold')} ${p.gold}</span>
      <span class="res ess">${icon('essence')} ${avail}/${p.essence}</span>
      <span class="lvl">${icon('crown')} <b>${p.level}</b> <span class="xpbar"><i style="width:${need ? (p.xp / need) * 100 : 100}%"></i></span></span>
      <button class="btn small mob-only ibtn2" data-act="panels">${S.panels ? '✕' : icon('crown')}</button>
      <button class="btn small ibtn2" data-act="pause">${S.paused ? icon('play') : icon('pause')}</button>
      ${soundBtn()}
      <button class="btn small ibtn2 rot-btn" data-act="rotate">تدوير</button>
      <button class="btn small ibtn2" data-act="menuMatch">☰</button>`;
  }

  // Field = a CSS grid of cards:  enemy post / enemy back / enemy front / rift / my front / my back / my post
  function renderSlots() {
    if (S.phase === 'combat' || S.phase === 'result') return; // combat view is built by buildTokens()
    renderField(false);
  }

  function renderField(inCombat) {
    const m = S.match;
    const v = inCombat ? S.combatViewer : S.v;
    const p = m.players[v];
    // campaign enemies are scripted and known: show this round's line-up instead of the last one seen
    const sc = m.players[1 - v].lineup ? m.buildCombatSpec(1 - v) : m.scout[1 - v];
    const cell = (side, slot, mine) => {
      let inner = '', cls = mine ? 'mine' : 'enemy', fid = '';
      if (inCombat) {
        const f = S.combat.fighters.find((x) => x.side === side && x.slot === slot);
        if (f) {
          const def = f.isHero ? HEROES[f.defId] : UNITS[f.defId];
          inner = cardHTML(def, { size: 'mini', star: f.star, live: true, k: 'c' + f.id, attrs: `data-fid="${f.id}"`, cls: mine ? 'ally' : 'foe' });
        }
      } else if (mine) {
        const u = p.board[slot];
        if (u) inner = pieceHTML(u, { sel: S.sel && S.sel.kind === 'unit' && S.sel.uid === u.uid });
        else if (p.summoned && p.heroSlot === slot) inner = heroPieceHTML(p);
      } else if (sc) {
        const u = sc.units.find((x) => x.slot === slot);
        if (u) inner = cardHTML(UNITS[u.defId], { size: 'mini', star: u.star, items: u.items, k: 'sc' + slot, cls: 'ghost' });
        else if (sc.summoned && sc.heroSlot === slot) inner = cardHTML(HEROES[sc.heroId], { size: 'mini', k: 'sch', cls: 'ghost' });
      }
      const SR = AMB.DATA.SLOT_ROLES[slot], srName = SR ? SR.map((r) => ROLES[r].name).join(' / ') : '';
      let inPlace = false;   // a card standing in a slot of its own role gets that role's bonus
      if (inCombat) { const ff = S.combat.fighters.find((x) => x.side === side && x.slot === slot); inPlace = !!(ff && ff.inPlace); }
      else if (mine) { const uu = p.board[slot]; inPlace = !!(uu && SR && SR.includes(UNITS[uu.defId].role)); }
      else if (sc) { const uu = sc.units.find((x) => x.slot === slot); inPlace = !!(uu && SR && SR.includes(UNITS[uu.defId].role)); }
      const act = mine && !inCombat ? `data-act="slot" data-slot="${slot}" data-drop="board:${slot}"` : '';
      let rec = '';
      if (mine && !inCombat && S.sel && S.sel.kind === 'unit') { const su = m.findUnit(p, S.sel.uid); if (su) { const sd = ROLES[UNITS[su.defId].role].side; if (sd === 'any' || (sd === 'front') === (slot[0] === 'f')) rec = ' rec'; } }
      if (!inner && mine && !inCombat) inner = `<i class="rowic">${icon(SR ? ART.ROLE_ICON[SR[0]] : (slot[0] === 'f' ? 'shield' : 'bow'))}</i>`;   // empty cell shows the role this slot is for
      return `<div class="cell ${cls}${rec}${inPlace ? ' inplace' : ''}" ${act} title="${esc(srName)}${SR && !inCombat ? ' — ' + esc(AMB.DATA.ROLE_BONUS[SR[0]].text) : ''}" data-sr="${SR ? SR[0] : ''}">${inner}</div>`;
    };
    const row = (side, ch, mine) => [0, 1, 2, 3].map((k) => cell(side, ch + (mine ? k : 3 - k), mine)).join('');
    const o = 1 - v;
    const fe = $('field');
    if (AMB.PassUI) { const ac = (v === 0 && S.mode !== 'hotseat') ? AMB.PassUI.arenaClass() : ''; [...fe.classList].filter((c) => c.startsWith('ar-')).forEach((c) => fe.classList.remove(c)); if (ac) fe.classList.add(ac); }
    fe.style.setProperty('--mw', WORLDS[HEROES[p.heroId].world].color);
    fe.style.setProperty('--ew', WORLDS[HEROES[m.players[o].heroId].world].color);
    $('slots').innerHTML =
      row(o, 'b', false) + row(o, 'f', false) +
      `<div class="divider"><span>${inCombat ? '' : icon('eye')}</span></div>` +
      row(v, 'f', true) + row(v, 'b', true);
  }

  function renderPosts() {
    const m = S.match;
    const inCombat = S.combat && (S.phase === 'combat' || S.phase === 'result');
    const viewer = inCombat ? S.combatViewer : S.v;
    [viewer, 1 - viewer].forEach((side) => {
      const el = postEl(side);
      if (!el) return;
      const p = m.players[side];
      const h = HEROES[p.heroId];
      let life = p.life, onBoard = p.summoned, exposed = false, safe = true, front = null;
      if (inCombat) {
        const hf = S.combat.sides[side].hero;
        life = hf.hp / CFG.combat.heroHpScale;
        onBoard = hf.onBoard;
        exposed = S.combat.sides[side].exposed;
        safe = onBoard ? !S.combat.targetable(hf) : !exposed;
      } else {
        const board = side === S.v ? p.board : null;
        front = board ? Object.keys(board).filter((x) => x[0] === 'f').length : null;
        safe = !onBoard && front !== 0;
      }
      // a shield with the number of front-row defenders (green) or a red warning (exposed); a crown when the hero fights on the field
      const st = onBoard && !inCombat ? `<span class="st">${icon('crown')}</span>` : safe ? `<span class="st safe">${icon('shield')}${front ? `<b>${front}</b>` : ''}</span>` : `<span class="st risk">${icon('warn')}</span>`;
      el.style.setProperty('--wc', WORLDS[h.world].color);
      el.className = 'post' + (onBoard && !inCombat ? ' empty-hero' : '') + (exposed && !onBoard ? ' exposed' : '') + (safe ? '' : ' risk');
      const chip = document.querySelectorAll('#topbar .lifechip')[side === viewer ? 0 : 1];   // the phone shows hero life + safety in the top bar (the posts are hidden there)
      if (chip) { const b = chip.querySelector('b'); if (b) b.textContent = lifeStr(life); const ls = chip.querySelector('.lc-st'); if (ls) ls.innerHTML = onBoard && !inCombat ? icon('crown') : safe ? icon('shield') : icon('warn'); chip.classList.toggle('risk', !safe && !(onBoard && !inCombat)); }
      // rebuilding the post (portrait + icons) every animation frame was the most expensive thing in combat: rebuild it only when something but the life changed
      const sig = [side, p.heroId, onBoard, inCombat, safe, exposed, front].join('|');
      if (el.dataset.sig !== sig || !el.querySelector('.lifebar i')) {
        el.dataset.sig = sig;
        el.innerHTML = `${portrait(h, { k: 'post' + side })}
        <div class="pl"><div class="lifebar"><i style="width:${Math.max(0, (life / p.maxLife) * 100)}%"></i></div>
        <div class="st">${icon('heart')} <b>${lifeStr(life)}</b></div></div>${st}`;
      } else {
        const bar = el.querySelector('.lifebar i'); if (bar) bar.style.width = Math.max(0, (life / p.maxLife) * 100) + '%';
        const lb = el.querySelector('.pl .st b'); if (lb) lb.textContent = lifeStr(life);
      }
    });
  }

  function pieceHTML(u, o) {
    const def = UNITS[u.defId];
    const same = me().bench.concat(Object.values(me().board)).filter((x) => x && x.defId === u.defId && x.star === u.star).length;
    return cardHTML(def, { size: 'mini', star: u.star, items: u.items, sel: o && o.sel, k: u.uid, prog: same >= 2 && u.star < 3 ? same + '/' + CFG.stars.copiesPerStar : '', cls: S.pop && S.pop.uid === u.uid ? (S.pop.merged ? 'pop merged' : 'pop') : '',
      attrs: `draggable="true" data-drag="unit:${u.uid}" title="${esc(def.name)} ${'★'.repeat(u.star)} — ${ROLES[def.role].name} / ${WORLDS[def.world].name}"` });
  }
  function heroPieceHTML(p) {
    const sel = S.sel && S.sel.kind === 'hero';
    return cardHTML(HEROES[p.heroId], { size: 'mini', life: lifeStr(p.life), sel, k: 'hb', attrs: `draggable="true" data-drag="hero" title="البطل ${esc(HEROES[p.heroId].name)} — في الساحة"` });
  }

  function renderBench() {
    const p = me();
    const lbl = `<span class="lbl">${icon('box')}</span>`;
    if (S.phase === 'combat' || S.phase === 'result') {
      $('bench').innerHTML = lbl + p.bench.map((u) => `<div class="bslot">${u ? cardHTML(UNITS[u.defId], { size: 'mini', star: u.star, items: u.items, k: 'bc' + u.uid, cls: 'ghost' }) : ''}</div>`).join('');
      return;
    }
    $('bench').innerHTML = lbl + p.bench.map((u, i) =>
      `<div class="bslot" data-act="bench" data-idx="${i}" data-drop="bench:${i}">${u ? pieceHTML(u, { sel: S.sel && S.sel.kind === 'unit' && S.sel.uid === u.uid }) : ''}</div>`).join('');
  }

  function renderShop() {
    const m = S.match, p = me();
    const prep = S.phase === 'prep' || S.phase === 'resources';
    const E = CFG.economy;
    if (!prep) {
      $('shopbar').innerHTML = `<div class="shop-closed">${icon(S.phase === 'combat' ? 'sword' : 'lock')}</div>`;
      return;
    }
    const owned = {};
    m.allUnits(p).forEach((u) => { owned[u.defId] = owned[u.defId] || { n: 0, s1: 0 }; owned[u.defId].n++; if (u.star === 1) owned[u.defId].s1++; });
    const cards = p.shop.map((id, i) => {
      if (!id) return `<div class="tcard hc full empty"></div>`;
      const d = UNITS[id];
      const ok = m.canBuy(S.v, i).ok;
      const ow = owned[id];
      const pair = ow && ow.s1 >= 2;
      return cardHTML(d, { cls: `${ok ? '' : 'cant'} ${pair ? 'pair' : ''}`, k: 'sh' + i,
        own: ow ? { n: ow.n, pair } : null,
        attrs: `data-act="buy" data-idx="${i}" title="${esc(d.skill.name)}: ${esc(d.skill.text)}"` });
    }).join('');
    const items = p.itemShop.map((id, i) => {
      if (!id) return `<div class="tcard hc full empty"></div>`;
      const it = ITEMS[id];
      return itemCardHTML(it, { cls: p.gold >= it.cost ? '' : 'cant', attrs: `data-act="buyItem" data-idx="${i}"` });
    }).join('');
    const freeR = p.freeRerolls > 0;
    $('shopbar').innerHTML = `
      <div class="shop-actions">
        <button class="btn ib-act" data-act="reroll" title="D"><span class="lb">تحديث</span><span class="cost">${freeR ? '0' : icon('gold') + E.rerollCost}</span></button>
        <button class="btn ib-act" data-act="xp" ${p.level >= E.maxLevel ? 'disabled' : ''} title="F"><span class="lb">خبرة</span><span class="cost">${icon('gold')}${E.xpCost}</span></button>
        <button class="btn ib-act ${p.shopLocked ? 'on' : ''}" data-act="lock"><span class="lb">${p.shopLocked ? 'مثبّت' : 'تثبيت'}</span></button>
      </div>
      <div class="shop-row"><div class="shop-cards">${cards}</div>
      <div class="item-cards">${items}</div></div>
      <div class="shop-actions">
        <button class="btn ib-act" data-act="upgrades"><span class="lb">تطوير</span></button>
        <button class="btn primary ready-btn" data-act="ready" title="Enter"><span class="lb">جاهز</span></button>
      </div>`;
  }

  const SYN_ICON = (s) => (s.kind === 'world' ? ART.WORLD_ICON[s.id] : s.kind === 'special' ? 'star' : ART.ROLE_ICON[s.id]);
  // synergy counts DIFFERENT characters: a second copy of the same card does not add. Say it, so nobody is surprised.
  const dupCount = (p) => { const b = Object.values(p.board), u = new Set(b.map((x) => x.defId)); return b.length - u.size; };
  function synergyHTML(list, dups) {
    if (!list.length && !dups) return `<div class="syn-empty">${icon('star')}</div>`;
    AMB.TIPS.syn = () => ({ title: 'كل التآزرات', html: '<p class="hint"><b>التآزر يحسب الشخصيات المختلفة.</b> نسختين من نفس البطاقة في الساحة تحسب مرة وحدة. النسخ المكررة فايدتها إنها تتدمج لنجمة أقوى (٣ نسخ = ★).</p>' + list.map((s) => `<div class="syn-full"><b>${s.name}</b> <small>(${s.count}${s.nextN ? '/' + s.nextN : ''})</small>${s.tiers.map((t) => `<div class="hint">• ${t.n}: ${t.text}</div>`).join('')}</div>`).join('') });
    // one chip per synergy: its icon + how many units you have / the next step; lit when active. Tap = the full list.
    return `<div class="synchips">${list.map((s) => {
      const color = s.kind === 'world' ? WORLDS[s.id].color : s.kind === 'special' ? '#ffcf4a' : '#3ee6ff', on = s.activeTier >= 0;
      return `<button class="schip ${on ? 'on' : ''}" style="--sc:${color}" data-act="info" data-k="syn">${icon(SYN_ICON(s))}<b>${s.count}</b>${s.nextN ? `<small>/${s.nextN}</small>` : ''}</button>`;
    }).join('')}${dups ? `<button class="schip dup" data-act="info" data-k="syn" title="نسخ مكررة ما تزيد التآزر">${icon('swap')}<b>${dups}</b><small>مكرر</small></button>` : ''}</div>`;
  }

  function renderLeft() {
    const m = S.match, p = me(), o = opp();
    const board = Object.values(p.board);
    const ev = AMB.synergy.evaluate(board, p.heroId);
    const front = Object.keys(p.board).filter((x) => x[0] === 'f').length;
    const heroFront = p.summoned && p.heroSlot[0] === 'f';
    const hw = WORLDS[HEROES[p.heroId].world];
    const sc = m.players[1 - S.v].lineup ? m.buildCombatSpec(1 - S.v) : m.scout[1 - S.v];
    const oppSyn = sc ? AMB.synergy.evaluate(sc.units, sc.heroId).list.filter((x) => x.activeTier >= 0) : [];
    const timeline = m.history.map((r) => `<span class="${r.winner === null ? 'wd' : r.winner === S.v ? 'w0' : 'w1'}">${r.round}</span>`).join('');
    AMB.TIPS.guard = () => ({ title: 'حماية البطل', html: '<p>طول ما عندك <b>أي وحدة حية على الساحة</b>، العدو ما يقدر يضرب بطلك. وإذا سقطت كلها ينكشف البطل ويتضرر. (سقوط الصف الأمامي بس يفعّل قدراتك «عند انكشاف الخط».)</p><p>القتلة يقفزون للصف الخلفي بس ما يقدرون يضربون البطل وهو محمي. وإذا نزّلت بطلك الساحة ياخذ الضرر كامل.</p>' });
    const guard = heroFront || front === 0 ? `<button class="guard risk" data-act="info" data-k="guard">${icon('warn')}</button>` : `<button class="guard safe" data-act="info" data-k="guard">${icon('shield')}<b>${front}</b></button>`;
    $('panel-left').innerHTML = `
      <section class="rail-guard">${guard}</section>
      <section><div class="rail-title">${icon('star')}<small>${board.length}/${p.level}</small></div>
        <div class="synchips"><button class="schip ${ev.resonance ? 'on' : ''}" style="--sc:${hw.color}" data-act="info" data-k="syn">${icon(ART.WORLD_ICON[HEROES[p.heroId].world])}<b>${ev.resonance}</b><small>♥</small></button></div>
        ${synergyHTML(ev.list)}</section>
      <section><div class="rail-title">${icon('skull')}</div>
        <div class="opp-mini">${portrait(HEROES[o.heroId], { k: 'lo' })}<div class="om-n"><span>${icon('crown')} ${o.level}</span><span>${icon('heart')} ${lifeStr(o.life)}</span></div></div>
        ${oppSyn.length ? `<div class="synchips">${oppSyn.slice(0, 4).map((x) => `<span class="schip on" style="--sc:${x.kind === 'world' ? WORLDS[x.id].color : '#3ee6ff'}">${icon(SYN_ICON(x))}<b>${x.count}</b></span>`).join('')}</div>` : ''}</section>
      <section><div class="timeline">${timeline || '<span class="wd">·</span>'}</div></section>`;
  }

  const ABILITY_ICON = { buffAllies: 'sword', damageCluster: 'blast', shieldAllies: 'shield', healAllies: 'healall', stunEnemies: 'bolt', frontDR: 'taunt', stunFront: 'snow' };
  function renderRight() {
    const m = S.match, p = me();
    const h = HEROES[p.heroId];
    const prep = S.phase === 'prep' || S.phase === 'resources';
    const avail = p.essence - m.reservedEssence(p);
    const TR = { start: '▶', t5: '⏱', firstDeath: '☠', exposed: '⚠' };   // when the ability fires: start / after 5 s / first ally dies / hero exposed
    const abil = h.abilities.map((a) => {
      const cost = m.abilityCost(p, a);
      const trig = p.abilities[a.id] || '';
      const fired = S.combat && S.phase !== 'prep' && S.combat.sides[S.v] && S.combat.sides[S.v].abilities.find((x) => x.def.id === a.id && x.fired);
      const trigs = Object.values(ABILITY_TRIGGERS).map((t) => `<button class="trg ${trig === t.id ? 'on' : ''}" data-act="abTrig" data-ab="${a.id}" data-t="${t.id}" ${prep ? '' : 'disabled'}>${TR[t.id] || '•'}</button>`).join('');
      return `<div class="ab ${trig ? 'armed' : ''} ${fired ? 'fired' : ''}"><button class="ab-ic" data-act="info" data-k="hero" data-id="${h.id}">${icon(ABILITY_ICON[a.type] || 'burst')}<span class="ab-cost">${icon('essence')}${cost}</span></button><div class="ab-trg">${trigs}</div></div>`;
    }).join('');
    const bag = [];
    for (let i = 0; i < CFG.economy.itemBenchSize; i++) {
      const id = p.items[i];
      if (!id) { bag.push('<div class="bagslot"></div>'); continue; }
      const it = ITEMS[id];
      const sel = S.sel && S.sel.kind === 'item' && S.sel.idx === i;
      bag.push(`<div class="bagslot ${it.kind} ${sel ? 'sel' : ''}" data-act="bagSel" data-idx="${i}">${icon(it.icon)}</div>`);
    }
    const armed = p.armedSpells.map((id, i) => `<span class="chip" data-act="disarm" data-idx="${i}">${icon(ITEMS[id].icon)} ✕</span>`).join('');
    AMB.TIPS.summon = () => ({ title: 'استدعاء البطل', html: `<p>${p.summoned ? 'بطلك الحين يقاتل في الساحة (اسحبه عشان تغيّر مكانه).' : 'بطلك الحين واقف خلف صفوفك.'}</p>
      ${h.vanguard ? `<p><b>👑 ${h.vanguard.name}:</b> ${h.vanguard.text}</p>` : ''}
      <p><b>الفايدة:</b> يهجم بقوة ${h.board.atk + CFG.hero.boardAtkPerRound * m.round}، ${CFG.hero.summonAuraAtk ? `والحلفاء +${CFG.hero.summonAuraAtk * 100}% هجوم، ` : ''}${CFG.hero.summonAbilityDiscount ? `وقدراته أرخص بـ${CFG.hero.summonAbilityDiscount}.` : 'وتأثير القيادة الخاص بالبطل (انظر تفاصيله).'}</p>
      <p><b>المخاطرة:</b> ياخذ الضرر كامل (حتى ضرر المنطقة)، وينسحب بعد ما تخسر ${CFG.combat.summonKnockout} حياة، وإذا وصلت حياته صفر تخسر المباراة على طول.</p>` });
    $('panel-right').innerHTML = `
      <section class="hero-card-mini">${portrait(h, { k: 'rh' })}
        <div class="hcm-r"><div class="lifebar-big"><i style="width:${(p.life / p.maxLife) * 100}%"></i></div><div class="hcm-n">${icon('heart')} <b>${lifeStr(p.life)}</b></div></div>
        <button class="chip-ic" data-act="info" data-k="hero" data-id="${h.id}">${icon('star')}</button></section>
      ${prep ? `<section><div class="summon-row"><button class="btn summon-btn ${p.summoned ? 'on' : ''}" data-act="summon">${icon('crown')}${icon('swap')}${icon('sword')}</button><button class="ibtn" data-act="info" data-k="summon">ⓘ</button></div></section>` : ''}
      <section><div class="rail-title">${icon('essence')}<small>${avail}</small></div><div class="abils">${abil}</div></section>
      <section><div class="bag">${bag.join('')}</div>${armed ? `<div class="armed-spells">${armed}</div>` : ''}</section>
      <section class="selbox">${selectionHTML()}</section>`;
  }

  function selectionHTML() {
    const m = S.match, p = me();
    const prep = S.phase === 'prep' || S.phase === 'resources';
    if (!S.sel || !prep) return '';
    if (S.sel.kind === 'unit') {
      const u = m.findUnit(p, S.sel.uid);
      if (!u) return '';
      const d = UNITS[u.defId], sm = CFG.stars.mult[u.star];
      return `<div class="selinfo">${portrait(d, { k: 'sel' })}<div class="si-r">${stars(u.star)}
        <span>${icon('sword')} ${fmt(d.atk * sm)}</span><span>${icon('heart')} ${fmt(d.hp * sm)}</span><span>${icon('target')} ${d.range}</span><span>${icon(ART.SKILL_ICON[d.skill.type] || 'star')}</span></div></div>`;
    }
    if (S.sel.kind === 'item') { const it = ITEMS[p.items[S.sel.idx]]; return it ? `<div class="selinfo item">${icon(it.icon, 'big-ic')}</div>` : ''; }
    return '';
  }

  // one row under the field: your selection's actions, or a default row with auto-arrange
  function prepBarHTML() {
    const m = S.match, p = me(), sel = S.sel, E = CFG.economy;
    const cnt = `${Object.keys(p.board).length}/${p.level}`;
    if (sel && sel.kind === 'unit') {
      const u = m.findUnit(p, sel.uid);
      if (u) {
        const d = UNITS[u.defId], R = ROLES[d.role], onBoard = Object.values(p.board).includes(u);
        return `<div class="pb sel"><span class="pb-name">${stars(u.star)} <span class="rolepill ${R.kind}">${icon(ART.ROLE_ICON[d.role])}</span></span>
          <span class="pb-btns"><button class="btn small danger ib" data-act="sell">بيع ${icon('gold')}+${m.sellValue(u)}</button>
          <button class="btn small ib" data-act="${onBoard ? 'toBench' : 'toBoard'}">${onBoard ? 'للاحتياط' : 'للساحة'}</button>
          <button class="btn small ib" data-act="detail" data-id="${d.id}" data-star="${u.star}">تفاصيل</button>
          ${u.items.length ? `<button class="btn small ib" data-act="unequip">نزع المعدة</button>` : ''}
          <button class="btn small ghost ib" data-act="deselect">إلغاء</button></span></div>`;
      }
    }
    if (sel && sel.kind === 'item') {
      const it = ITEMS[p.items[sel.idx]];
      if (it) return `<div class="pb sel"><span class="pb-name">${icon(it.icon)}</span>
        <span class="pb-btns">${it.kind === 'spell' ? `<button class="btn small ib" data-act="arm">تفعيل</button>` : ''}<button class="btn small danger ib" data-act="sellItem">بيع ${icon('gold')}+${Math.floor(it.cost / 2)}</button><button class="btn small ghost ib" data-act="deselect">إلغاء</button></span></div>`;
    }
    if (sel && sel.kind === 'hero') return `<div class="pb sel"><span class="pb-name">${icon('crown')}</span><span class="pb-btns"><button class="btn small ghost ib" data-act="deselect">✕</button></span></div>`;
    const bag = p.items.map((id, i) => `<button class="bagchip" data-act="bagSel" data-idx="${i}">${icon(ITEMS[id].icon)}</button>`).join('');
    const sev = AMB.synergy.evaluate(Object.values(p.board), p.heroId), dups = dupCount(p);
    const synStrip = sev.list.length || dups ? `<span class="pb-syn">${synergyHTML(sev.list.slice(0, 4), dups)}</span>` : '';
    return `<div class="pb"><span class="pb-count">${icon('shield')} ${cnt}${p.summoned ? ' +' + icon('crown') : ''}</span>${synStrip}${bag ? `<span class="pb-bag">${bag}</span>` : ''}
      <span class="pb-btns"><button class="btn small ib ${p.summoned ? 'on' : ''}" data-act="summon">${p.summoned ? '👑 رجّع البطل' : '👑 نزّل البطل'}</button><button class="btn small ib" data-act="autoArrange">تلقائي</button></span></div>`;
  }

  // the synergy chips stay visible during the fight, so you can see WHY your board is strong (same chips as the prep bar; no new panels)
  function combatSynHTML() {
    try {
      const pl = S.match && S.match.players[S.v]; if (!pl) return '';
      const sev = AMB.synergy.evaluate(Object.values(pl.board).filter(Boolean), pl.heroId);
      return sev.list.length ? `<span class="pb-syn cc-syn">${synergyHTML(sev.list.slice(0, 4), 0)}</span>` : '';
    } catch (e) { return ''; }
  }
  function renderCombatCtrl() {
    const el = $('combat-ctrl');
    if (S.phase === 'combat') {
      el.innerHTML = `<span class="clock">0.0s</span>
        ${[1, 2, 4].map((s) => `<button class="btn small ${S.speed === s ? 'on' : ''}" data-act="speed" data-v="${s}">${s}x</button>`).join('')}
        <button class="btn small ib" data-act="skip">تخطي</button><span class="fury"></span>${combatSynHTML()}`;
    } else if (S.phase === 'prep' || S.phase === 'resources') {
      el.innerHTML = prepBarHTML();
    } else el.innerHTML = '';
  }

  // ======================================================================= modals
  function unitDetail(id, star) {
    const d = UNITS[id];
    const W = WORLDS[d.world], R = ROLES[d.role];
    const SM = CFG.stars.mult;
    const rows = [
      ['الصحة', (s) => d.hp * SM[s]], ['الهجوم', (s) => d.atk * SM[s]], ['سرعة الهجوم (ضربة في الثانية)', () => d.as, 2],
      ['الضرر في الثانية', (s) => d.atk * SM[s] * d.as], ['المدى', () => d.range], ['الدفاع (ضرر أقل)', () => d.def * 100, 0, '%'],
      ['فرصة الحرجة', () => d.crit * 100, 0, '%'], ['المانا للمهارة', () => d.mana],
    ];
    const sk = d.skill;
    const vals = [['dmg', 'الضرر'], ['heal', 'العلاج'], ['shield', 'الدرع'], ['dps', 'ضرر/ث'], ['stun', 'الشلل (ث)'], ['pct', 'سرعة الهجوم %']];
    const skRows = vals.filter(([k]) => sk[k]).map(([k, n]) => `<tr><td>${n}</td>${sk[k].map((v, i) => `<td>${k === 'pct' ? Math.round(v * 100) + '%' : v}${i ? `<div class="delta">+${Math.round(((v - sk[k][0]) / sk[k][0]) * 100)}%</div>` : ''}</td>`).join('')}</tr>`).join('');
    const synOf = (sid) => SYNERGIES[sid].tiers.map((t) => `<div class="hint">• ${t.n}: ${t.text}</div>`).join('');
    let match = '';
    if (S.match) {
      const p = me();
      const ow = S.match.allUnits(p).filter((u) => u.defId === id);
      match = `<div class="hint">في هذه المباراة: تملك ${ow.length ? ow.map((u) => '★'.repeat(u.star)).join(' ، ') : 'لا شيء'} · المتبقي في المخزون المشترك: ${S.match._pool(me())[id]}/${CFG.economy.poolSize[d.tier]}</div>`;
    }
    modal(`<div class="detail-head">${portrait(d, { k: 'md' })}<div><h2>${d.name} ${star ? stars(star) : ''}</h2><div class="hint" style="direction:ltr;text-align:right">${d.en}</div>
      <span class="pill" style="--pc:${W.color}">${W.name}</span><span class="pill">${R.name}</span><span class="pill" style="--pc:var(--t${d.tier})">فئة ${d.tier} · تكلفة ${d.cost}</span>
      <div class="hint">${R.desc} ${d.role === 'assassin' ? 'يقفز للصف الخلفي في بداية القتال.' : ''}</div></div></div>
      <table><tr><th>الخاصية</th><th>★</th><th>★★</th><th>★★★</th></tr>
      ${rows.map(([n, f, dg, suf]) => `<tr><td>${n}</td>${[1, 2, 3].map((s) => { const v = f(s), b = f(1); return `<td>${fmt(v, dg || 0)}${suf || ''}${s > 1 && v !== b ? `<div class="delta">+${Math.round(((v - b) / b) * 100)}%</div>` : ''}</td>`; }).join('')}</tr>`).join('')}</table>
      <div class="skillbox"><b>المهارة — ${sk.name}:</b> ${sk.text}
        ${skRows ? `<table><tr><th></th><th>★</th><th>★★</th><th>★★★</th></tr>${skRows}</table>` : ''}</div>
      ${(d.traits && d.traits.length) || d.sig ? `<div class="skillbox rar-box"><b>صفات ${AMB.ECONOMY.rarities[d.rarity] ? AMB.ECONOMY.rarities[d.rarity].name : ''}:</b>${(d.traits || []).map((id) => `<div>• ${AMB.DATA.TRAITS[id].name}: ${AMB.DATA.TRAITS[id].text}</div>`).join('')}${d.sig ? `<div class="sig-line">★ <b>${AMB.DATA.SIGS[d.sig].name}</b>: ${AMB.DATA.SIGS[d.sig].text}</div>` : ''}</div>` : `<div class="hint">كومن: يسوي دور ${ROLES[d.role].name} الأساسي بدون صفات إضافية.</div>`}
      <div class="hint"><b>التطوير:</b> ${CFG.stars.copiesPerStar} نسخ ★ = ★★ ، و ${CFG.stars.copiesPerStar} نسخ ★★ = ★★★ (الحد الأقصى). الصحة والهجوم ×${SM[2]} ثم ×${SM[3]}؛ السرعة والمدى ما تتغير عشان ما تصير وحدة واحدة ما أحد يقدر عليها.</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px">
        <div><span class="wtag" style="--w:${W.color}">${SYNERGIES[d.world].name}</span>${synOf(d.world)}</div>
        <div><b>${SYNERGIES[d.role].name}</b>${synOf(d.role)}</div></div>
      <p class="hint">${W.lore}</p>${match}`);
  }

  function heroDetail(id) {
    const h = HEROES[id], W = WORLDS[h.world];
    modal(`<div class="detail-head">${portrait(h, { k: 'mh' })}<div><h2>${h.name}</h2><div class="hint">${h.title}</div>
      <span class="pill" style="--pc:${W.color}">${W.name}</span><div class="hint">${h.style}</div></div></div>
      ${heroLevelHTML(id)}<div class="hint" style="margin:-2px 0 6px">كل مباراة تلعبها بالبطل تعطيه خبرة. قوته من المستوى تنحسب في كل الأطوار ما عدا «على نفس الجهاز».</div>
      <div class="skillbox"><b>سلبية: ${h.passive.name}</b> — ${h.passive.text}</div>
      ${h.abilities.map((a) => `<div class="skillbox"><b>${a.name}</b> — <span style="color:var(--ess)">${a.cost} جوهر</span><br>${a.text}</div>`).join('')}
      ${h.vanguard ? `<div class="skillbox vg"><b>👑 ${h.vanguard.name}</b> (لما ينزل الساحة)<br>${h.vanguard.text}</div>` : ''}
      <table><tr><th>عند الاستدعاء</th><th></th></tr>
      <tr><td>الصحة</td><td>الحياة × ${CFG.combat.heroHpScale}</td></tr><tr><td>الهجوم</td><td>${h.board.atk} + ${CFG.hero.boardAtkPerRound} لكل جولة</td></tr>
      <tr><td>سرعة الهجوم</td><td>${h.board.as}</td></tr><tr><td>المدى</td><td>${h.board.range}</td></tr><tr><td>الدفاع</td><td>${Math.round(h.board.def * 100)}%</td></tr></table>
      <p class="hint">${W.lore}</p>`);
  }

  function upgradesModal() {
    const m = S.match, p = me();
    const groups = {};
    m.allUnits(p).forEach((u) => { (groups[u.defId] = groups[u.defId] || []).push(u); });
    const need = CFG.stars.copiesPerStar;
    const rows = Object.entries(groups).sort((a, b) => UNITS[b[0]].tier - UNITS[a[0]].tier).map(([id, list]) => {
      const d = UNITS[id];
      const byStar = [1, 2, 3].map((s) => list.filter((u) => u.star === s).length);
      const maxed = byStar[2] > 0 && byStar[0] === 0 && byStar[1] === 0;
      const target = byStar[0] > 0 || byStar[1] === 0 ? 1 : 2;
      const have = byStar[target - 1];
      const SM = CFG.stars.mult;
      const preview = maxed ? 'وصلت لأعلى مستوى ★★★' : `عند ${'★'.repeat(target + 1)}: صحة ${fmt(d.hp * SM[target])} → <b>${fmt(d.hp * SM[target + 1])}</b>، هجوم ${fmt(d.atk * SM[target])} → <b>${fmt(d.atk * SM[target + 1])}</b>${d.skill.dmg ? `، ${d.skill.name} ${d.skill.dmg[target - 1]} → <b>${d.skill.dmg[target]}</b>` : d.skill.heal ? `، علاج ${d.skill.heal[target - 1]} → <b>${d.skill.heal[target]}</b>` : d.skill.shield ? `، درع ${d.skill.shield[target - 1]} → <b>${d.skill.shield[target]}</b>` : ''}`;
      const inShop = p.shop.map((x, i) => [x, i]).filter((e) => e[0] === id);
      const btn = inShop.length && !maxed ? `<button class="btn small primary" data-act="buyFromUpg" data-idx="${inShop[0][1]}">شراء من المتجر (${d.cost})</button>` : `<span class="hint">${maxed ? '' : 'غير متوفر في المتجر الآن'}</span>`;
      return `<div class="upg-row">${portrait(d, { k: 'up' + id })}<div><b>${d.name}</b> <span class="hint">★×${byStar[0]} ★★×${byStar[1]} ★★★×${byStar[2]} · المخزون ${m._pool(me())[id]}</span>
        ${maxed ? '' : `<div class="hint">نسخ ${'★'.repeat(target)}: ${have}/${need} للترقية</div><div class="prog"><i style="width:${(have / need) * 100}%"></i></div>`}
        <div class="hint">${preview}</div></div>${btn}</div>`;
    }).join('');
    modal(`<h2>شاشة التطوير</h2><p class="hint">اجمع ${need} نسخ متطابقة بنفس النجوم وتندمج لوحدة أقوى لحالها (والمعدات تنتقل معها). أعلى مستوى ★★★.
      المخزون مشترك بين اللاعبين، فإذا خصمك جمع نفس الوحدة تصير أصعب عليك.</p>${rows || '<p class="hint">ما عندك وحدات للحين.</p>'}`);
  }

  function howto() {
    modal(`<h2>كيف ألعب؟</h2>
      <div class="skillbox"><b>الهدف:</b> نزّل حياة بطل الخصم لين تصير صفر. كل جولة: موارد ← شراء وتطوير ← ترتيب وقدرات ← قتال تلقائي ← نتيجة.</div>
      <div class="skillbox"><b>المتجر:</b> اشتر الوحدات بالذهب، وحدّث العروض (${CFG.economy.rerollCost} ذهب)، واشتر خبرة عشان ترفع المستوى (المستوى = عدد الوحدات اللي تحطها في الساحة). والفايدة: +1 عن كل ${CFG.economy.interestPer} ذهب موفّر (لين ${CFG.economy.interestMax}). وسلسلة الفوز أو الخسارة تعطيك ذهب زيادة.</div>
      <div class="skillbox"><b>التطوير:</b> ${CFG.stars.copiesPerStar} نسخ متطابقة = نجمة زيادة، وتنحسب لحالها.</div>
      <div class="skillbox"><b>الساحة:</b> صف أمامي (خط الدفاع) وصف خلفي. الحراس والمقاتلين قدّام، والسحرة والقناصة والدعم ورا. القتلة يقفزون للصف الخلفي عند العدو.</div>
      <div class="skillbox"><b>البطل:</b> يبقى خلف صفوفك وما أحد يقدر يضربه طول ما عندك أي وحدة حية على الساحة. وإذا سقطت كلها ينكشف. تقدر تنزّله الساحة يقاتل بنفسه، وهذا مكسب كبير بس فيه مخاطرة.</div>
      <div class="skillbox"><b>القدرات:</b> جهّز قدرات البطل واختر متى تشتغل (بداية القتال، بعد 5 ثواني، لما يسقط أول واحد من فريقك، أو لما ينكشف البطل). وتخسّر جوهر.</div>
      <div class="skillbox"><b>التآزر:</b> وحدات من نفس العالم أو نفس الدور تعطيك مكافآت. ووحدات عالم بطلك تاخذ رنين. وإذا جمعت 3 أو 4 عوالم مختلفة يشتغل «تقارب العوالم» عشان التشكيلة المختلطة ما تكون أضعف.</div>
      <div class="skillbox"><b>المراحل والمكافآت:</b> المباراة ${CFG.match.maxRounds} جولات في 4 مراحل: ${CFG.match.stages.map((x) => x.name + ' (' + (x.rounds[0] === x.rounds[1] ? 'الجولة ' + x.rounds[0] : 'الجولتان ' + x.rounds[0] + '–' + x.rounds[1]) + ')').join('، ')}. بعد كل مرحلة (عدا الأخيرة) تختار <b>مكافأة من 3</b>: وحدة مجانية، ذهب، خبرة، جوهر، معدة، <b>بركة دائمة</b> للفريق، أو شفاء للبطل. جولة الحسم تضاعف خسارة الحياة ×${CFG.match.finaleLossMult}. وإذا ما سقط أي بطل قبلها يفوز اللي حياته أعلى. وداخل القتال الضرر يزيد بعد ${CFG.combat.furyStart} ثانية (الغضب).</div>`);
  }

  function matchMenu() {
    const wasPaused = S.paused, canPause = S.mode !== 'online';   // online: the menu never freezes the prep clock (the friend is waiting)
    if (canPause) { S.paused = true; S.pausedLeft = S.phase === 'prep' ? S.deadline - Date.now() : null; }   // only a running prep timer has time left to restore
    S._resumeAfterMenu = canPause && !wasPaused;
    modal(`<h2>القائمة</h2><div style="display:grid;gap:10px;margin-top:12px">
      <button class="btn" data-act="resumeMenu">متابعة</button>
      <button class="btn" data-act="rotate">تدوير الشاشة (طول / عرض)</button>
      <button class="btn" data-act="tutorial">دليل سريع</button>
      <button class="btn" data-act="rules">كل القواعد</button>
      <button class="btn danger" data-act="surrender">انسحب (${esc(me().name)})</button>
      <button class="btn ghost" data-act="abandon">الخروج للقائمة (ما تنحسب)</button></div>`);
  }

  // hero experience: every finished match (except the guided tutorial and same-device play) levels up the hero you played
  // a match counts for progression only if at least one combat was actually fought (an instant surrender pays nothing)
  const fought = (m) => m.history.length >= 1;
  function awardHeroXp(m) {
    if (!AMB.heroes || m._heroXp || S.mode === 'tutorial' || S.mode === 'hotseat' || S.mode === 'friendly' || S.mode === 'online' || !fought(m)) return;
    m._heroXp = true;
    const seat = mySeat(), p = m.players[seat], won = m.winner === seat;
    const roundsWon = m.history.filter((r) => r.winner === seat).length;
    const r = AMB.heroes.addXp(p.heroId, AMB.heroes.matchXp({ won, roundsWon, short: !!m.rules }));
    const h = HEROES[p.heroId];
    setTimeout(() => {
      if (r.levelsUp > 0) { sfx('win'); toast(`⬆ ${h.name} صار مستوى ${r.level}! أقوى في كل الأطوار`, 'good'); }
      else toast(`+${r.gained} خبرة لـ${h.name}`, 'good');
    }, 900);
  }
  // little level badge + bar for a hero (hero select, hero details)
  function heroLevelHTML(id) {
    if (!AMB.heroes) return '';
    const pr = AMB.heroes.progress(id), rk = AMB.heroes.rank(id), pw = AMB.heroes.power(id);
    return `<div class="hlv" style="--rk:${rk.color}"><b>مستوى ${pr.level}</b><span class="hlv-rank">${rk.name}</span>
      <span class="hlv-bar"><i style="width:${pr.max ? 100 : Math.round(100 * pr.inLevel / pr.need)}%"></i></span><small>${pr.max ? 'أعلى مستوى' : `${pr.inLevel}/${pr.need}`}</small>
      ${pr.level > 1 ? `<div class="hlv-pw">حياته +${pr.level - 1} · نزوله للساحة +${Math.round((pw.atk - 1) * 100)}% هجوم · شكله +${Math.round((pw.vanguard - 1) * 100)}% · قدراته +${Math.round((pw.ability - 1) * 100)}%</div>` : ''}</div>`;
  }

  // ======================================================================= results / stats / codex
  function myAvatar(p, i) {   // equipped battle-pass avatar replaces only the picture of your own hero chip (never stats)
    if (i !== 0 || S.mode === 'hotseat' || !AMB.PassUI) return HEROES[p.heroId];
    const id = AMB.PassUI.avatarId();
    return (id && AMB.PassUI.avatarDef(id)) || HEROES[p.heroId];
  }
  function showResults() {
    const m = S.match;
    closeOverlay();
    cancelAnimationFrame(S.raf);
    S.phase = 'over';
    const secs = Math.round((Date.now() - S.startTs) / 1000);
    awardHeroXp(m);
    if (S.mode === 'campaign') return AMB.CampaignUI.showResult(m, secs);   // campaign and tower have their own results screens
    if (S.mode === 'tower') return AMB.TowerUI.showResult(m, secs);
    if (S.mode === 'event') return AMB.EventUI.showResult(m, secs);
    if (S.mode === 'tutorial') return AMB.TutorialUI.showResult(m, secs);
    if (S.mode !== 'friendly' && S.mode !== 'online' && !m._recorded) { try { AMB.telemetry.recordMatch(m, { seconds: secs }); } catch (e) { reportErr(e); } m._recorded = true; /* analytics must never block the results screen */ }
    if (!m._counted) { m._counted = true; try { localStorage.setItem('amb_played', String(+(localStorage.getItem('amb_played') || 0) + 1)); } catch (e) { /* ignore */ } }
    if (!m._passDone && S.mode !== 'online' && fought(m)) { m._passDone = true; try { S.passResult = AMB.pass.recordMatch(m.summary(0)); } catch (e) { S.passResult = null; } }
    let title;
    if (m.winner === null || m.winner === undefined) title = 'تعادل';
    else if (S.mode === 'hotseat') title = `فاز ${esc(m.players[m.winner].name)}!`;
    else title = m.winner === mySeat() ? 'نصر!' : 'هزيمة';
    const last = m.history[m.history.length - 1];
    const cols = m.players.map((p, i) => {
      const h = HEROES[p.heroId];
      const b = last ? last.players[i].board : [];
      const syn = last ? last.players[i].synergies.map((s) => SYNERGIES[s].name).join('، ') : '';
      return `<div class="res-col ${m.winner === i ? 'won' : ''}"><div class="hero-box">${portrait(h, { k: 'res' + i })}<div><div class="nm">${esc(p.name)} ${m.winner === i ? '🏆' : ''}</div><div class="ti">${h.name} · ${WORLDS[h.world].name}${p.isAI ? ' · ذكاء اصطناعي (' + p.aiStyle + ')' : ''}</div></div></div>
        <div class="kv"><span>الحياة المتبقية</span><b>${lifeStr(p.life)}</b></div>
        <div class="kv"><span>جولات فاز/خسر/تعادل</span><b>${p.stats.wins}/${p.stats.losses}/${p.stats.draws}</b></div>
        <div class="kv"><span>الضرر الكلي للوحدات</span><b>${fmt(p.stats.damageDealt)}</b></div>
        <div class="kv"><span>الذهب المنفق</span><b>${p.stats.goldSpent}</b></div>
        <div class="kv"><span>الوحدات المشتراة / التحديثات</span><b>${p.stats.unitsBought} / ${p.stats.rerolls}</b></div>
        <div class="kv"><span>المستوى النهائي</span><b>${p.level}</b></div>
        <div class="hint" style="margin-top:6px">التآزر النهائي: ${syn || '—'}</div>
        <div class="hint">المكافآت: ${p.rewardLog.length ? p.rewardLog.map((r) => AMB.DATA.REWARDS[r.id].name).join('، ') : '—'}</div>
        <div class="mini-board">${b.map((u, k) => `<div class="mini">${portrait(UNITS[u.defId], { k: 'rb' + i + k })}<div>${stars(u.star)}</div></div>`).join('')}</div></div>`;
    }).join('');
    const tl = m.history.map((r) => `<span class="${r.winner === null ? 'wd' : r.winner === 0 ? 'w0' : 'w1'}">${r.round}</span>`).join('');
    const myWin = S.mode === 'hotseat' ? m.winner != null : m.winner === 0;
    const wi = S.mode === 'hotseat' && m.winner != null ? m.winner : 0;   // vs AI: always show your own hero
    const heroDef = HEROES[m.players[wi].heroId];
    const own = S.mode !== 'hotseat' && wi === 0;
    const avDef = own ? myAvatar(m.players[0], 0) : heroDef;
    const ptitle = own && AMB.PassUI ? AMB.PassUI.titleName() : '';
    const stage = `<div class="res-stage ${m.winner == null ? 'draw' : myWin ? 'victory' : 'defeat'}" style="--wc:${WORLDS[heroDef.world].color}"><div class="res-rays"></div><div class="res-hero">${portrait(avDef, { bare: true, k: 'resh' })}<i class="sheen"></i></div><div class="res-hname">${avDef.name}</div>${ptitle ? `<div class="res-title">${ptitle}</div>` : ''}</div>`;
    $('results').innerHTML = `${stage}<div class="res-banner"><h1>${title}</h1><p class="hint">${m.round} جولات · ${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')} دقيقة ${S.mode === 'friendly' ? '· مباراة ودية (ما تنحسب)' : ''}</p>
      <div class="timeline">${tl}</div></div>
      ${AMB.PassUI ? AMB.PassUI.resultPanel(S.passResult) : ''}
      <div class="res-quick">${m.players.map((p, i) => `<div class="rq ${m.winner === i ? 'won' : ''}"><b>${esc(p.name)}</b><span>${icon('heart')} ${lifeStr(p.life)}</span><span>${icon('sword')} ${p.stats.wins}–${p.stats.losses}</span><span>${fmt(p.stats.damageDealt)} ضرر</span></div>`).join('')}</div>
      <details class="res-details"><summary>تفاصيل المباراة</summary><div class="res-cols">${cols}</div></details>
      <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-bottom:30px">
        <button class="btn primary big" data-act="again">مباراة جديدة</button>
        <button class="btn big" data-act="go" data-to="stats">الإحصائيات</button>
        <button class="btn big ghost" data-act="go" data-to="menu">القائمة الرئيسية</button></div>`;
    show('results');
    if (m.winner != null) { sfx(myWin ? 'win' : 'lose'); }
    if (myWin) setTimeout(() => { const h = document.querySelector('.res-hero'); if (h) (own && AMB.PassUI ? AMB.PassUI.fxColors() : ['#ffd24a', '#ff4f8b', '#5fe3ff', '#7bd46a', '#ffffff']).forEach((c) => burst(h, c, 14, { r: 150, s: 8 })); }, 250);
  }

  function renderStats() {
    const d = AMB.telemetry.load();
    const pct = (w, p) => (p ? Math.round(((w || 0) / p) * 100) : 0);
    const tbl = (obj, nameOf, extra) => {
      const rows = Object.entries(obj).sort((a, b) => b[1].picks - a[1].picks);
      if (!rows.length) return '<p class="hint">ما فيه بيانات للحين، العب مباراة.</p>';
      return `<table><tr><th>الاسم</th><th>مرات</th><th>نسبة الفوز</th><th></th>${extra ? '<th>نهائي</th><th>★★★</th>' : ''}</tr>${rows.map(([k, v]) =>
        `<tr><td>${nameOf(k)}</td><td>${v.picks}</td><td>${pct(v.wins, v.picks)}%</td><td><div class="bar"><i style="width:${pct(v.wins, v.picks)}%"></i></div></td>${extra ? `<td>${v.final || 0}</td><td>${v.threeStar || 0}</td>` : ''}</tr>`).join('')}</table>`;
    };
    const recent = d.recent.map((r) => `<tr><td>${new Date(r.at).toLocaleString('ar')}</td><td>${r.mode}</td><td>${r.heroes.map((h) => HEROES[h] ? HEROES[h].name : h).join(' ضد ')}</td><td>${r.winner === null ? 'تعادل' : 'لاعب ' + (r.winner + 1)}</td><td>${r.rounds}</td><td>${Math.round(r.seconds / 60 * 10) / 10}د</td></tr>`).join('');
    $('stats').innerHTML = `
      <div class="box"><h3>نظرة عامة</h3>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;text-align:center">
          <div><div class="big-num">${d.matches}</div><div class="hint">مباراة</div></div>
          <div><div class="big-num">${d.matches ? fmt(d.totalRounds / d.matches, 1) : 0}</div><div class="hint">متوسط الجولات</div></div>
          <div><div class="big-num">${d.matches ? fmt(d.totalSeconds / d.matches / 60, 1) : 0}</div><div class="hint">متوسط الدقائق</div></div></div>
        <p class="hint">تعادلات: ${d.draws} · استدعاء البطل: ${d.summons.used} لاعب، فوز ${pct(d.summons.wins, d.summons.used)}%</p>
        <p class="hint">لاختبار التوازن على نطاق واسع شغّل محاكي الكمبيوتر: <code>node tools/simulate.js 800</code></p>
        <div style="display:flex;gap:8px"><button class="btn small" data-act="statsExport">تصدير JSON</button><button class="btn small danger" data-act="statsReset">مسح البيانات</button></div></div>
      <div class="box"><h3>الأبطال</h3>${tbl(d.heroes, (k) => HEROES[k] ? HEROES[k].name : k)}</div>
      <div class="box"><h3>أنماط اللاعبين</h3>${tbl(d.styles, (k) => k === 'human' ? 'بشري' : k.replace('ai:', 'ذكاء اصطناعي: '))}</div>
      <div class="box"><h3>التآزر</h3>${tbl(d.synergies, (k) => SYNERGIES[k] ? SYNERGIES[k].name : k)}</div>
      <div class="box" style="grid-column:1/-1"><h3>الوحدات (استخدام ونسبة فوز)</h3>${tbl(d.units, (k) => UNITS[k] ? UNITS[k].name : k, true)}</div>
      <div class="box" style="grid-column:1/-1"><h3>آخر المباريات</h3>${recent ? `<table><tr><th>الوقت</th><th>النمط</th><th>الأبطال</th><th>الفائز</th><th>جولات</th><th>المدة</th></tr>${recent}</table>` : '<p class="hint">—</p>'}</div>`;
  }

  function renderCodex() {
    if (AMB.AlbumUI) { AMB.AlbumUI.render(); return; }
    const f = S.codexF;
    const fb = (kind, id, name) => `<button class="btn small ${f[kind] === id ? 'on' : ''}" data-act="codexF" data-k="${kind}" data-v="${id}">${name}</button>`;
    const units = Object.values(UNITS).filter((u) => (!f.world || u.world === f.world) && (!f.role || u.role === f.role)).sort((a, b) => a.tier - b.tier);
    $('codex').innerHTML = `
      <h3>الأبطال</h3>
      <div class="codex-grid">${Object.values(HEROES).map((h) => cardHTML(h, { k: 'cx', attrs: `data-act="heroInfo" data-id="${h.id}"` })).join('')}</div>
      <h3>الوحدات (${units.length})</h3>
      <div class="filters">${fb('world', '', 'كل العوالم')}${Object.values(WORLDS).map((w) => fb('world', w.id, w.name)).join('')}</div>
      <div class="filters">${fb('role', '', 'كل الأدوار')}${Object.values(ROLES).map((r) => fb('role', r.id, r.name)).join('')}</div>
      <div class="codex-grid">${units.map((d) => cardHTML(d, { k: 'cu', attrs: `data-act="detail" data-id="${d.id}"` })).join('')}</div>
      <h3>المعدات والتعاويذ</h3>
      <div class="codex-grid">${Object.values(ITEMS).map((it) => itemCardHTML(it)).join('')}</div>`;
  }

  // ======================================================================= input
  function clickSlot(slot) {
    const m = S.match, p = me(), v = S.v;
    const occ = p.board[slot];
    const heroHere = p.summoned && p.heroSlot === slot;
    const sel = S.sel;
    if (sel && sel.kind === 'item') {
      if (occ && res(m.equip(v, sel.idx, occ.uid))) { toast('تم التجهيز', 'good'); S.sel = null; }
      else if (!occ) toast('اختر وحدة تجهّزها', 'err');
    } else if (sel && sel.kind === 'unit') {
      if (occ && occ.uid === sel.uid) S.sel = null;
      else if (res(m.move(v, sel.uid, { zone: 'board', slot }))) S.sel = null;
    } else if (sel && sel.kind === 'hero') {
      if (!heroHere) res(m.moveHero(v, slot));
      S.sel = null;
    } else if (occ) S.sel = { kind: 'unit', uid: occ.uid };
    else if (heroHere) S.sel = { kind: 'hero' };
    renderMatch();
  }

  function clickBench(idx) {
    const m = S.match, p = me(), v = S.v;
    const occ = p.bench[idx];
    const sel = S.sel;
    if (sel && sel.kind === 'item') {
      if (occ && res(m.equip(v, sel.idx, occ.uid))) { toast('تم التجهيز', 'good'); S.sel = null; }
    } else if (sel && sel.kind === 'unit') {
      if (occ && occ.uid === sel.uid) S.sel = null;
      else if (res(m.move(v, sel.uid, { zone: 'bench', idx }))) S.sel = null;
    } else if (sel && sel.kind === 'hero') {
      toast('لإعادة البطل استخدم زر "إعادة البطل إلى مركز القيادة"', 'err'); S.sel = null;
    } else if (occ) S.sel = { kind: 'unit', uid: occ.uid };
    renderMatch();
  }

  const prepActive = () => S.screen === 'match' && (S.phase === 'prep' || S.phase === 'resources');

  const ACT = {
    go: (d) => { if (S.net && S.screen === 'hero') AMB.NetUI.leave(); show(d.to); if (d.to === 'stats') renderStats(); if (d.to === 'codex') renderCodex(); },
    howto: () => (AMB.TutorialUI ? AMB.TutorialUI.start({ replay: true }) : howto()),
    rules: () => howto(),   // inside a match: just the rules text (never restarts the tutorial / throws the match away)
    tutorial: () => showTutorial(),
    diff: (d) => { S.difficulty = d.v; document.querySelectorAll('#diff-seg button').forEach((b) => b.classList.toggle('on', b.dataset.v === d.v)); },
    mode: (d) => { S.mode = d.v; S.picks = [null, null]; S.pickIdx = 0; renderHeroSelect(); show('hero'); },
    pickHero: (d, el, e) => {
      if (e.target.closest('[data-act="heroInfo"]')) return;
      if (heroLocked(d.id)) { toast('هذا البطل مقفل: تفتحه من الباكجات (ليجندري) أو الباتل باس', 'err'); return; }
      S.picks[S.pickIdx] = d.id; renderHeroSelect();
    },
    heroInfo: (d, el, e) => { e.stopPropagation(); heroDetail(d.id); },
    heroConfirm: () => {
      if (!S.picks[S.pickIdx] || heroLocked(S.picks[S.pickIdx])) return;
      if (starterPick()) {   // one-time starter choice, then continue to the match as usual
        AMB.collection.chooseStarter(S.picks[0]); sfx('merge'); toast(`${HEROES[S.picks[0]].name} صار بطلك! الباقين تفتحهم من الباكجات أو الباتل باس`, 'good');
        renderHeroSelect(); return;
      }
      if (S.mode === 'hotseat' && S.pickIdx === 0) { S.pickIdx = 1; renderHeroSelect(); return; }
      if (S.mode === 'online') { AMB.NetUI.heroChosen(S.picks[0]); return; }
      startMatch();
    },
    handoffGo: (d) => beginPrep(+d.pi),
    slot: (d) => prepActive() && clickSlot(d.slot),
    bench: (d) => prepActive() && clickBench(+d.idx),
    buy: (d, el, e) => {
      if (!prepActive() || e.target.closest('[data-act="detail"]')) return;
      const m0 = S.match;
      const r = S.match.buy(S.v, +d.idx);
      S.pop = null;
      if (res(r)) {
        sfx('buy');
        if (r.merged && r.merged.length) {
          r.merged.forEach((u) => toast(`تطوير! ${UNITS[u.defId].name} ${'★'.repeat(u.star)}`, 'good'));
          S.pop = { uid: r.merged[r.merged.length - 1].uid, merged: true };
        } else {
          S.pop = { uid: r.unit.uid };
          const have = m0.allUnits(m0.players[S.v]).filter((x) => x.defId === r.unit.defId && x.star === 1).length;
          if (have === 2) toast(`عندك نسختين من «${UNITS[r.unit.defId].name}»: اشتر ثالثة وتتطور ★ لحالها`, 'good');
        }
      }
      renderMatch();
      if (S.pop) {
        const pe = document.querySelector(`[data-drag="unit:${S.pop.uid}"]`);
        if (pe) { if (S.pop.merged) { burst(pe, '#ffd24a', 26, { r: 60, s: 7 }); burst(pe, '#ffffff', 10, { r: 40 }); banner(`${icon('star')}${icon('up')}`, 'merge'); } else burst(pe, '#ffffff', 6, { r: 26 }); }
        setTimeout(() => { S.pop = null; }, 800);
      }
    },
    buyFromUpg: (d) => { const r = S.match.buy(S.v, +d.idx); if (res(r) && r.merged && r.merged.length) toast(`تطوير! ${UNITS[r.merged[r.merged.length - 1].defId].name} ${'★'.repeat(r.merged[r.merged.length - 1].star)}`, 'good'); renderMatch(); upgradesModal(); },
    buyItem: (d) => { if (prepActive() && res(S.match.buyItem(S.v, +d.idx))) renderMatch(); },
    reroll: () => { if (prepActive() && res(S.match.reroll(S.v))) { sfx('reroll'); renderMatch(); } },
    rotate: () => rotateScreen(),
    sound: () => { SND.on = !SND.on; try { localStorage.setItem('amb_sound', SND.on ? '1' : '0'); } catch (e) { /* ignore */ } if (SND.on) sfx('click'); document.querySelectorAll('[data-act="sound"]').forEach((b) => { if (b.id === 'menu-sound') b.querySelector('.mt-ic').textContent = SND.on ? '🔊' : '🔇'; else b.textContent = SND.on ? '🔊' : '🔇'; }); },
    xp: () => { if (prepActive()) { const lv = me().level; if (res(S.match.buyXp(S.v))) { if (me().level > lv) toast(`المستوى ${me().level}! تقدر تحط ${me().level} وحدات`, 'good'); renderMatch(); } } },
    lock: () => { if (prepActive()) { S.match.toggleLock(S.v); renderMatch(); } },
    ready: () => {
      if (!prepActive()) return;
      // a new player's most common mistake: pressing "ready" with gold still in the pocket
      const m = S.match, p = me();
      if (S.mode !== 'tutorial' && S.mode !== 'hotseat' && S.warnedRound !== m.round + ':' + S.v) {
        const can = (p.shop || []).filter((c) => c && UNITS[c] && p.gold >= UNITS[c].cost).length;
        if (p.gold >= 3 && can && p.bench.some((x) => !x) ) {
          S.warnedRound = m.round + ':' + S.v;
          modal(`<h2>عندك ذهب ما صرفته</h2><p class="hint">معك <b>${p.gold}</b> ذهب وفيه بطاقات في المتجر تقدر تشتريها. الذهب ما يضيع، بس الوحدات الزيادة تقوّيك في القتال.</p>
            <div style="display:flex;gap:8px;justify-content:center;margin-top:12px"><button class="btn primary big" data-act="closeModal">أرجع أشتري</button><button class="btn" data-act="readyForce">ابدأ القتال</button></div>`);
          return;
        }
      }
      endPrep();
    },
    readyForce: () => { closeModal(); if (prepActive()) endPrep(); },
    deselect: () => { S.sel = null; renderMatch(); },
    autoArrange: () => { if (!prepActive()) return; S.match.autoArrange(S.v); S.sel = null; toast('رتبت لك أقوى وحداتك: الحراس قدّام والباقي ورا', 'good'); renderMatch(); },
    toBench: () => {
      const m = S.match, p = me(); if (!S.sel || S.sel.kind !== 'unit') return;
      const bi = p.bench.indexOf(null); if (bi < 0) { toast('الاحتياط ممتلئ: بع وحدة أو بدّل معها', 'err'); return; }
      if (res(m.move(S.v, S.sel.uid, { zone: 'bench', idx: bi }))) { S.sel = null; renderMatch(); }
    },
    toBoard: () => {
      const m = S.match, p = me(); if (!S.sel || S.sel.kind !== 'unit') return;
      const u = m.findUnit(p, S.sel.uid); if (!u) return;
      const sd = ROLES[UNITS[u.defId].role].side, F = ['f1', 'f2', 'f0', 'f3'], B = ['b1', 'b2', 'b0', 'b3'];
      const order = (sd === 'back' ? B.concat(F) : sd === 'front' ? F.concat(B) : F.concat(B)).filter((x) => !p.board[x] && !(p.summoned && p.heroSlot === x));
      if (!order.length || Object.keys(p.board).length >= p.level) { toast(`الساحة ممتلئة (${p.level}/${p.level}). اضغط وحدة في الساحة تبدّل معها، أو بع وحدة، أو ارفع مستواك`, 'err'); return; }
      if (res(m.move(S.v, u.uid, { zone: 'board', slot: order[0] }))) { S.sel = null; renderMatch(); }
    },
    sell: () => { if (prepActive() && S.sel && S.sel.kind === 'unit' && res(S.match.sell(S.v, S.sel.uid))) { S.sel = null; renderMatch(); } },
    unequip: () => { if (S.sel && S.sel.kind === 'unit' && res(S.match.unequip(S.v, S.sel.uid))) renderMatch(); },
    bagSel: (d) => { if (!prepActive()) return; const i = +d.idx; S.sel = S.sel && S.sel.kind === 'item' && S.sel.idx === i ? null : { kind: 'item', idx: i }; renderMatch(); },
    arm: () => { if (S.sel && S.sel.kind === 'item' && res(S.match.armSpell(S.v, S.sel.idx))) { S.sel = null; toast('التعويذة جاهزة للقتال الجاي', 'good'); renderMatch(); } },
    disarm: (d) => { if (prepActive() && res(S.match.disarmSpell(S.v, +d.idx))) renderMatch(); },
    sellItem: () => { if (S.sel && S.sel.kind === 'item' && res(S.match.sellItem(S.v, S.sel.idx))) { S.sel = null; renderMatch(); } },
    summon: () => { if (prepActive() && res(S.match.toggleSummon(S.v))) { S.sel = null; toast(me().summoned ? 'البطل نزل الساحة' : 'البطل رجع لمركزه', 'good'); renderMatch(); } },
    detail: (d, el, e) => { e.stopPropagation(); unitDetail(d.id, d.star ? +d.star : 0); },
    upgrades: () => upgradesModal(),
    more: () => { document.body.classList.toggle('more-open'); sfx('click'); },
    closeModal: () => { closeModal(); if (S._resumeAfterMenu) { ACT.resumeMenu(); } },
    pause: () => {
      if (S.mode === 'online') { toast('ما يصير توقف وأنت تلعب مع صاحبك', 'err'); return; }
      if (S.phase === 'prep') {
        if (!S.paused) { S.paused = true; S.pausedLeft = S.deadline - Date.now(); }
        else { S.paused = false; S.deadline = Date.now() + S.pausedLeft; }
      } else if (S.phase === 'combat') S.paused = !S.paused;
      renderTop();
    },
    panels: () => { S.panels = !S.panels; $('scr-match').classList.toggle('show-panels', S.panels); renderTop(); },
    menuMatch: () => matchMenu(),
    resumeMenu: () => {
      closeModal();
      if (S._resumeAfterMenu) { S.paused = false; if (S.phase === 'prep') S.deadline = Date.now() + (S.pausedLeft != null ? S.pausedLeft : prepSeconds() * 1000); }   // menu opened during the 0.9s 'resources' phase: prep starts fresh instead of ending at once
      S._resumeAfterMenu = false;
      renderTop();
    },
    surrender: () => {
      const m = S.match;
      if (S.net) AMB.NetUI.leave();
      closeModal(); S._resumeAfterMenu = false; S.paused = false;
      cancelAnimationFrame(S.raf);
      m.winner = 1 - S.v; m.phase = 'over'; m.endedAt = Date.now();
      me().life = 0;
      showResults();
    },
    abandon: () => { if (S.net) AMB.NetUI.leave(); closeModal(); closeOverlay(); S._resumeAfterMenu = false; S.paused = false; cancelAnimationFrame(S.raf); S.phase = 'idle'; S.match = null; show('menu'); },
    speed: (d) => { S.speed = +d.v; renderCombatCtrl(); },
    skip: () => skipCombat(),
    nextRound: () => { closeOverlay(); if (S.match.isOver) showResults(); else nextRound(); },
    rewards: () => {
      const m = S.match; closeOverlay();
      if (S.mode === 'hotseat') { S.rewardQueue = [1]; rewardHandoff(0); }
      else { S.rewardQueue = []; showRewards(mySeat()); }
    },
    rewardGo: (d) => showRewards(+d.pi),
    claimReward: (d) => {
      const m = S.match, pi = S.rewardFor, r = m.claimReward(pi, +d.idx);
      if (!r.ok) { toast(r.reason, 'err'); return; }
      sfx('merge');
      let msg = 'استلمت: ' + r.text; if (r.item) msg += ' — ' + AMB.DATA.ITEMS[r.item].name;
      toast(S.mode === 'hotseat' ? m.players[pi].name + ': ' + msg : msg, 'good');
      if (S.mode === 'online') { AMB.NetUI.rewardClaimed(); return; }
      if (S.mode !== 'hotseat') { const a = AMB.AI.claimReward(m, 1); if (a && a.ok) setTimeout(() => toast('الخصم اختار: ' + AMB.DATA.REWARDS[a.id].name, ''), 700); }
      afterReward();
    },
    toResults: () => showResults(),
    abTrig: (d) => { if (!prepActive()) return; const cur = S.match.players[S.v].abilities[d.ab]; res(S.match.setAbility(S.v, d.ab, cur === d.t ? null : d.t)); renderMatch(); },
    info: (d, el, e) => { if (e) e.stopPropagation(); if (d.k === 'hero') { heroDetail(d.id); return; } const t = AMB.TIPS[d.k]; if (!t) return; const x = t(); modal(`<h2>${x.title}</h2><div class="tip-body">${x.html}</div>`); },
    again: () => { if (S.mode === 'online') { if (S.net) AMB.NetUI.leave(); show('menu'); return; } if (S.mode === 'tutorial') { AMB.TutorialUI.start(); return; } if (S.mode === 'campaign' || S.mode === 'tower' || S.mode === 'event') { startMatch(); return; } S.picks = [S.picks[0], S.picks[1]]; S.pickIdx = 0; renderHeroSelect(); show('hero'); },
    statsExport: () => {
      const blob = new Blob([JSON.stringify(AMB.telemetry.load(), null, 2)], { type: 'application/json' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'multiverse-telemetry.json'; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    },
    statsReset: () => { if (confirm('تبي تمسح كل الإحصائيات؟')) { AMB.telemetry.reset(); renderStats(); } },
    codexF: (d) => { S.codexF[d.k] = d.v; renderCodex(); },
  };

  document.addEventListener('click', (e) => {
    if (e.target.closest && e.target.closest('.btn') && !e.target.closest('[data-act="sound"]')) sfx('click');
    if (e.target === $('modal-back')) { ACT.closeModal(); return; }
    const el = e.target.closest('[data-act]');
    if (!el) { if (S.sel && S.screen === 'match' && !e.target.closest('.panel,.shopbar,.field,.bench-row,.modal')) { S.sel = null; renderMatch(); } return; }
    const fn = ACT[el.dataset.act];
    if (fn) { try { fn(el.dataset, el, e); } catch (err) { reportErr(err); } }
  });
  document.addEventListener('change', (e) => {
    const sel = e.target.closest('select[data-ab]');
    if (sel && prepActive()) { res(S.match.setAbility(S.v, sel.dataset.ab, sel.value || null)); renderMatch(); }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { if ($('modal-back').classList.contains('on')) ACT.closeModal(); else if (S.sel) { S.sel = null; if (S.match) renderMatch(); } return; }
    if (!prepActive() || $('modal-back').classList.contains('on') || $('overlay').classList.contains('on')) return;
    if (e.target.tagName === 'SELECT' || e.target.tagName === 'INPUT') return;
    const k = e.key.toLowerCase();
    if (k === 'd') ACT.reroll();
    else if (k === 'f') ACT.xp();
    else if (k === 'e') ACT.sell();
    else if (e.key === 'Enter') { e.preventDefault(); ACT.ready(); }
  });

  // drag & drop (desktop); click-to-move works everywhere
  document.addEventListener('dragstart', (e) => {
    const el = e.target.closest('[data-drag]');
    if (!el || !prepActive()) { e.preventDefault(); return; }
    const v = el.dataset.drag;
    S.sel = v === 'hero' ? { kind: 'hero' } : { kind: 'unit', uid: v.slice(5) };
    e.dataTransfer.setData('text/plain', v);
    e.dataTransfer.effectAllowed = 'move';
  });
  document.addEventListener('dragover', (e) => {
    const t = e.target.closest('[data-drop], .shopbar');
    if (t && prepActive()) { e.preventDefault(); t.classList.add('drop'); }
  });
  document.addEventListener('dragleave', (e) => { const t = e.target.closest('[data-drop], .shopbar'); if (t) t.classList.remove('drop'); });
  document.addEventListener('drop', (e) => {
    const t = e.target.closest('[data-drop], .shopbar');
    if (!t || !prepActive()) return;
    e.preventDefault();
    t.classList.remove('drop');
    if (t.classList.contains('shopbar')) { if (S.sel && S.sel.kind === 'unit') ACT.sell(); return; }
    const [zone, key] = t.dataset.drop.split(':');
    if (zone === 'board') clickSlot(key); else clickBench(+key);
  });

  // touch drag (phones/tablets): hold a board/bench card, move it, drop it on a cell, the bench, or the shop to sell
  let TD = null;
  document.addEventListener('click', (e) => { if (S.noClick) { e.stopPropagation(); e.preventDefault(); } }, true);
  document.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' || !prepActive()) return;
    const el = e.target.closest('[data-drag]');
    if (el) TD = { el, id: e.pointerId, x: e.clientX, y: e.clientY, v: el.dataset.drag, ghost: null, started: false };
  });
  const dropTarget = (x, y) => { const t = document.elementFromPoint(x, y); return t ? t.closest('[data-drop], .shopbar') : null; };
  document.addEventListener('pointermove', (e) => {
    if (!TD || e.pointerId !== TD.id) return;
    if (!TD.started) {
      if (Math.hypot(e.clientX - TD.x, e.clientY - TD.y) < 10) return;
      TD.started = true;
      S.sel = TD.v === 'hero' ? { kind: 'hero' } : { kind: 'unit', uid: TD.v.slice(5) };
      const r = TD.el.getBoundingClientRect();
      TD.w = r.width; TD.h = r.height;
      TD.ghost = TD.el.cloneNode(true);
      TD.ghost.removeAttribute('data-drag'); TD.ghost.removeAttribute('draggable');
      Object.assign(TD.ghost.style, { position: 'fixed', width: r.width + 'px', height: r.height + 'px', zIndex: 60, pointerEvents: 'none', opacity: '.9', transform: 'scale(1.15)', filter: 'drop-shadow(0 6px 8px #000a)' });
      TD.ghost.classList.add('drag-ghost');
      document.body.appendChild(TD.ghost);
      TD.el.style.opacity = '.3';
      try { document.body.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }   // keep receiving moves/up even if the card is re-rendered
    }
    TD.lx = e.clientX; TD.ly = e.clientY;
    TD.ghost.style.left = e.clientX - TD.w / 2 + 'px';
    TD.ghost.style.top = e.clientY - TD.h * 0.8 + 'px';   // above the finger so it stays visible
    document.querySelectorAll('.drop').forEach((n) => n.classList.remove('drop'));
    const t = dropTarget(e.clientX, e.clientY); if (t) t.classList.add('drop');
  });
  // drop the dragged card where the finger is (cell / bench / shop = sell)
  function applyDrop(x, y) {
    const t = dropTarget(x, y);
    if (t && t.classList.contains('shopbar')) ACT.sell();
    else if (t && t.dataset.drop) { const [zone, key] = t.dataset.drop.split(':'); if (zone === 'board') clickSlot(key); else clickBench(+key); }
  }
  // time ran out mid-drag: put the card down where the finger is, then clean up
  function commitDrag() {
    if (TD && TD.started && TD.lx != null) { try { applyDrop(TD.lx, TD.ly); } catch (err) { /* ignore */ } S.sel = null; S.noClick = true; setTimeout(() => { S.noClick = false; }, 350); }
    cancelDrag();
  }
  // called whenever the screen changes under the finger (timer ends, combat starts, overlays)
  function cancelDrag() {
    if (TD) { if (TD.el) TD.el.style.opacity = ''; try { document.body.releasePointerCapture(TD.id); } catch (err) { /* ignore */ } TD = null; }
    document.querySelectorAll('.drag-ghost').forEach((n) => n.remove());
    document.querySelectorAll('.drop').forEach((n) => n.classList.remove('drop'));
  }
  const endTouch = (e, cancel) => {
    if (!TD || e.pointerId !== TD.id) { if (!TD) document.querySelectorAll('.drag-ghost').forEach((n) => n.remove()); return; }
    const d = TD; TD = null;
    try { document.body.releasePointerCapture(d.id); } catch (err) { /* ignore */ }
    if (!d.started) return;
    document.querySelectorAll('.drop').forEach((n) => n.classList.remove('drop'));
    d.ghost.remove(); d.el.style.opacity = '';
    S.noClick = true; setTimeout(() => { S.noClick = false; }, 350);
    if (!cancel) applyDrop(e.clientX, e.clientY);
    S.sel = null; renderMatch();
  };
  document.addEventListener('pointerup', (e) => endTouch(e, false));
  document.addEventListener('pointercancel', (e) => endTouch(e, true));

  // card tilt + glare under the mouse
  document.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    const c = e.target.closest && e.target.closest('.tcard.hc.full:not(.empty)');
    if (S.tilt && S.tilt !== c) { S.tilt.style.removeProperty('--rx'); S.tilt.style.removeProperty('--ry'); S.tilt = null; }
    if (!c) return;
    const r = c.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
    c.style.setProperty('--ry', (x - 0.5) * 18 + 'deg'); c.style.setProperty('--rx', (0.5 - y) * 18 + 'deg');
    c.style.setProperty('--gx', x * 100 + '%'); c.style.setProperty('--gy', y * 100 + '%');
    S.tilt = c;
  });
  // the main menu shows your hero big, on their world's colours
  function fillMenu() {
    const el = $('menu-heroes');
    if (el) {
      const A = globalThis.AMB, id = (A.collection && A.collection.starterHero && A.collection.starterHero()) || A.DATA.HERO_STARTERS[0], h = HEROES[id] || HEROES[A.DATA.HERO_STARTERS[0]];
      el.innerHTML = `<div class="mv2-hero">${portrait(h, { bare: true, k: 'mhero' })}</div>`;
      const bg = $('mv2-bg'), W = WORLDS[h.world];
      if (bg) { bg.className = 'mv2-bg' + (h.world === 'tide' ? ' tide' : ''); bg.style.setProperty('--wc', W.color); }
    }
    const ms = $('menu-sound'); if (ms) ms.querySelector('.mt-ic').textContent = SND.on ? '🔊' : '🔇';
  }
  fillMenu();

  // phone back button: step back inside the game instead of leaving it
  (function backNav() {
    let armedAt = 0;
    try { history.replaceState({ zor: 0 }, ''); history.pushState({ zor: 1 }, ''); } catch (e) { return; }
    window.addEventListener('popstate', () => {
      let exiting = false;
      try {
        if ($('modal-back').classList.contains('on')) { ACT.closeModal(); }
        else if ($('overlay').classList.contains('on')) { closeOverlay(); }
        else if (document.body.classList.contains('more-open')) { document.body.classList.remove('more-open'); }
        else if (S.screen === 'match') { if (S.phase === 'over') show('menu'); else matchMenu(); }
        else if (S.screen !== 'menu') { show('menu'); }
        else if (Date.now() - armedAt < 2500) { exiting = true; }
        else { armedAt = Date.now(); toast('اضغط رجوع مرة ثانية للخروج'); }
      } catch (err) { reportErr(err); }
      if (exiting) { try { history.back(); } catch (e) { /* ignore */ } } else { try { history.pushState({ zor: 1 }, ''); } catch (e) { /* ignore */ } }
    });
  })();

  // accessibility: icon-only buttons get an accessible name (their title, or a known Arabic label by action)
  (function a11y() {
    const NAMES = { menuMatch: 'القائمة', pause: 'إيقاف مؤقت', closeModal: 'إغلاق', rotate: 'تدوير الشاشة', sound: 'الصوت', info: 'شرح', summon: 'نزّل البطل', tg: 'التالي' };
    const fix = (root) => (root.querySelectorAll ? root : document).querySelectorAll('button:not([aria-label])').forEach((b) => {
      const t = (b.textContent || '').trim(), name = b.getAttribute('title') || NAMES[b.dataset.act];
      if (name && (!t || t.length <= 2 || b.dataset.act === 'info')) b.setAttribute('aria-label', name);
    });
    try { fix(document); new MutationObserver((ms) => { let again = false; ms.forEach((m) => { if (m.addedNodes.length) again = true; }); if (again) fix(document); }).observe(document.body, { childList: true, subtree: true }); } catch (e) { /* ignore */ }
  })();

  // debug / testing hook
  globalThis.AMB_UI = { renderHeroSelect, startCombat, afterReward, showResults, S, ACT, itemsHTML: () => Object.values(ITEMS).map((it) => itemCardHTML(it)).join(''), renderMatch, cardHTML, itemCardHTML, show, toast, sfx, burst, modal, closeModal, overlay, closeOverlay, startMatch, portrait, stars };
  if (AMB.PassUI) { AMB.PassUI.installActions(); AMB.PassUI.applyCosmetics(); AMB.PassUI.refreshMenu(); }
})();
