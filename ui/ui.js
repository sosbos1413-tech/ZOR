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
  function toast(msg, kind) {
    const el = document.createElement('div');
    el.className = 'toast ' + (kind || '');
    el.textContent = msg;
    $('toasts').appendChild(el);
    setTimeout(() => el.remove(), kind === 'err' ? 4200 : 2500);
  }
  function show(screen) {
    document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('active', s.id === 'scr-' + screen));
    S.screen = screen;
    document.body.classList.toggle('in-match', screen === 'match');   // page scroll is locked only during a match
    window.scrollTo(0, 0);
    if (globalThis.AMB && AMB.PassUI) { if (screen === 'menu') AMB.PassUI.refreshMenu(); if (screen === 'pass') AMB.PassUI.render(); }
    if (globalThis.AMB && AMB.CollectionUI) { if (screen === 'menu') AMB.CollectionUI.refreshMenu(); if (screen === 'cards') AMB.CollectionUI.render(); }
    if (globalThis.AMB && AMB.PacksUI) { if (screen === 'menu') AMB.PacksUI.refreshMenu(); if (screen === 'packs') AMB.PacksUI.render(); }
    if (globalThis.AMB && AMB.CampaignUI) { if (screen === 'campaign') AMB.CampaignUI.render(); if (screen === 'menu') AMB.CampaignUI.refreshMenu(); }
    if (globalThis.AMB && AMB.DailyUI && screen === 'menu') AMB.DailyUI.onMenu();
  }
  function modal(html) { $('modal').innerHTML = `<button class="btn small ghost x" data-act="closeModal">✕</button>` + html; $('modal-back').classList.add('on');
    // opening any details window stops the prep timer so you can read in peace
    if (S.phase === 'prep' && !S.paused) { S.paused = true; S.pausedLeft = S.deadline - Date.now(); S._mp = true; renderTop(); }
  }
  function closeModal() {
    $('modal-back').classList.remove('on');
    if (S._mp) { S._mp = false; if (S.paused && S.phase === 'prep') { S.paused = false; S.deadline = Date.now() + S.pausedLeft; renderTop(); } }   // resume the prep timer
  }
  function overlay(html) { $('overlay').innerHTML = html; $('overlay').classList.add('on'); }
  function closeOverlay() { $('overlay').classList.remove('on'); $('overlay').innerHTML = ''; }

  const me = () => S.match.players[S.v];
  const opp = () => S.match.players[1 - S.v];
  const res = (r) => { if (!r.ok) toast(r.reason, 'err'); return r.ok; };

  // hero ownership (core/collection.js): player 1 picks among owned heroes; a brand-new player first picks a starter.
  // Player 2 on the same device is a guest and may use any hero.
  const starterPick = () => S.pickIdx === 0 && AMB.collection && AMB.collection.needsStarter();
  const heroLocked = (id) => S.pickIdx === 0 && AMB.collection && !starterPick() && !AMB.collection.owned(id);
  function renderHeroSelect() {
    const who = starterPick() ? 'اختر بطلك الأول — اختيار دائم، والباقين تفتحهم من الباكجات أو الباتل باس'
      : S.mode === 'hotseat' ? `اللاعب ${S.pickIdx + 1}: اختر بطلك${S.pickIdx === 1 ? ' (ضيف: كل الأبطال متاحة)' : ''}` : 'اختر بطلك';
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
        <h3>${h.name}</h3><div class="title">${h.title}</div>
        <div class="world">${W.name}</div>
        <div class="style">${h.style}</div>
        <div class="ab"><b>سلبية — ${h.passive.name}:</b> ${h.passive.text}</div>
        ${h.abilities.map((a) => `<div class="ab"><b>${a.name}</b> <span style="color:var(--ess)">(${a.cost} جوهر)</span>: ${a.text}</div>`).join('')}
        <div class="ab" style="color:var(--muted)">وحدات عالمه (رنين +${CFG.hero.resonancePerAlly * 100}%): ${units}</div>
        <div style="text-align:center;margin-top:8px"><button class="btn small" data-act="heroInfo" data-id="${h.id}">تفاصيل</button></div>
      </div>`;
    }).join('');
    $('hero-confirm').disabled = !cur;
    $('hero-confirm').textContent = starterPick() ? 'اعتمده بطلي الأول' : S.mode === 'hotseat' && S.pickIdx === 0 ? 'تأكيد والانتقال للاعب 2' : 'ابدأ المباراة';
  }

  const maxR = () => (S.match && S.match.rules ? S.match.rules.maxRounds : CFG.match.maxRounds);
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
        { heroId: S.picks[0], name: 'أنت' },
        { heroId: aiHero, name: 'الخصم الآلي', isAI: true, aiStyle: styles[Math.floor(Math.random() * 3)], difficulty: S.mode === 'friendly' ? 'easy' : S.difficulty },
      ];
    }
    // campaign fight (ui/campaign-ui.js): fixed enemy line-up, short best-of-3 rules, your card levels count
    S.match = S.mode === 'campaign' ? new AMB.Match(AMB.campaign.matchOptions(S.campaign.fightId, S.picks[0])) : new AMB.Match({ mode: S.mode, players });
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
    S.combat = null;
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
      <p class="hint">${S.mode === 'hotseat' ? esc(p.name) + ': ' : ''}اختر مكافأة واحدة.${o.trailing ? ' <b style="color:var(--red)">خيار إضافي لأنك متأخر بالحياة.</b>' : ''}</p>
      <div class="rw-grid">${o.options.map((id, i) => { const r = rewardHTML(id, o.stage); return `<button class="rw-card ${id.startsWith('bless') ? 'bless' : id}" data-act="claimReward" data-idx="${i}"><span class="rw-ic">${icon(r.R.icon)}</span><b>${r.R.name}</b><span class="rw-tx">${r.text}</span>${r.tags}</button>`; }).join('')}</div></div>`);
  }
  function rewardHandoff(pi) {
    const p = S.match.players[pi];
    overlay(`<div class="ov-card"><h2>دور ${esc(p.name)}</h2><p class="hint">سلّم الجهاز لـ ${esc(p.name)} لاختيار المكافأة.</p>
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
      <p class="hint">الجولة ${S.match.round}. سلّم الجهاز لـ ${esc(p.name)}. لا ينظر الخصم أثناء التجهيز.</p>
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
    let tutNext = false; try { tutNext = S.match.round === 1 && localStorage.getItem('amb_tut') !== '1'; } catch (e) { /* ignore */ }
    if (!tutNext) { const st = S.match.stageInfo(), first = st.rounds[0] === S.match.round;
      if (S.match.rules) banner(`الجولة ${S.match.round} من ${maxR()}<small>أول من يفوز بجولتين يكسب القتال</small>`, S.match.round === 1 ? '' : 'fight');
      else if (st.id === 'finale') banner('الحسم!<small>جولة أخيرة: الخسارة هنا تتضاعف</small>', 'fight');
      else if (first) banner(`${st.name}<small>الجولة ${S.match.round} من ${CFG.match.maxRounds}</small>`);
      else banner('الجولة ' + S.match.round); }
    const p = me();
    const inc = p.lastIncome;
    if (inc && !tutNext) {
      const ess = S.match.round > 1 ? CFG.economy.essencePerRound + (HEROES[p.heroId].passive.id === 'deep_reserve' ? 1 : 0) : 0;
      toast(`+${inc.total} ذهب${ess ? ` · +${ess} جوهر` : ''}`, 'good');
    }
    setTimeout(() => {
      if (S.phase !== 'resources') return;
      S.phase = 'prep';
      S.deadline = Date.now() + prepSeconds() * 1000;
      renderMatch();
      let seen = true; try { seen = localStorage.getItem('amb_tut') === '1'; } catch (e) { /* ignore */ }
      if (!seen && S.match.round === 1) showTutorial();
    }, 900);
  }

  function endPrep() {
    if (S.phase !== 'prep' && S.phase !== 'resources') return;
    commitDrag();
    const m = S.match;
    m.autoFill(S.v);
    S.sel = null;
    if (S.mode === 'hotseat' && S.queue.length) { handoff(S.queue.shift()); return; }
    if (S.mode !== 'hotseat' && !S.aiFirst) AMB.AI.prep(m, 1);
    startCombat();
  }

  setInterval(() => {
    if (S.screen !== 'match' || S.phase !== 'prep') { if (document.querySelector('.drag-ghost')) cancelDrag(); return; }
    const el = document.querySelector('.timer');
    if (S.paused) return;
    const left = Math.max(0, S.deadline - Date.now());
    if (el) { el.textContent = Math.ceil(left / 1000) + 's'; el.classList.toggle('warn', left < 6000); }
    if (left <= 0) endPrep();
  }, 200);

  // ======================================================================= combat playback
  function startCombat() {
    const m = S.match;
    cancelDrag();
    closeOverlay();
    S.combatViewer = 0;
    S.v = 0;
    S.combat = m.createCombat(true);
    S.phase = 'combat';
    renderMatch();
    buildTokens();
    banner('قتال!', 'fight');
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
    if (rep.winner != null) sfx(S.mode === 'hotseat' || rep.winner === 0 ? 'win' : 'lose');
    const names = m.players.map((p) => p.name);
    let title, cls;
    if (rep.winner === null) { title = 'تعادل'; cls = ''; }
    else if (S.mode === 'hotseat') { title = `فاز ${esc(names[rep.winner])} بالجولة`; cls = 'win'; }
    else { title = rep.winner === 0 ? 'فزت بالجولة!' : 'خسرت الجولة'; cls = rep.winner === 0 ? 'win' : 'lose'; }
    const rows = rep.players.map((r, i) => `<tr><td>${esc(names[i])} ${r.heroKilled ? '— <b style="color:var(--red)">سقط البطل!</b>' : ''}</td>
      <td>${fmt(r.direct, 1)}</td><td>${r.backlash}</td><td><b>${lifeStr(r.lifeAfter)}</b></td></tr>`).join('');
    const over = m.isOver;
    overlay(`<div class="ov-card"><h2 class="${cls}">${title}</h2>
      <div class="hint">الجولة ${rep.round} · مدة القتال ${fmt(rep.duration, 1)} ث</div>
      <table><tr><th></th><th>ضرر مباشر</th><th>ارتداد الخسارة</th><th>الحياة</th></tr>${rows}</table>
      ${(() => {
        if (S.mode === 'hotseat') return '';
        const me0 = rep.players[0];
        if (rep.winner === 1 && me0.exposed) return `<p class="tip"><b>لماذا خسرت؟</b> سقطت وحداتك الأمامية فانكشف بطلك وصار قابلًا للهجوم. ضع حرّاسًا ومقاتلين في الصف الأمامي (4 وحدات كحد أقصى)، أو ارفع مستواك لتزيد وحداتك.</p>`;
        if (rep.winner === 1) return `<p class="tip"><b>لماذا خسرت؟</b> قوة تشكيلة الخصم كانت أعلى. جرّب تفعيل التآزر (وحدات من نفس العالم أو الدور)، وجهّز معدات وقدرات البطل.</p>`;
        return '';
      })()}
      ${rep.finale ? `<p class="tip"><b>جولة الحسم:</b> ارتداد الخسارة تضاعف ×${CFG.match.finaleLossMult}. ${over ? 'الأعلى حياة يفوز.' : ''}</p>` : ''}
      <p class="hint">الضرر المباشر = ضربات تلقاها البطل بعد انكشافه أو في الساحة. ارتداد الخسارة = ${CFG.damage.lossBase} + الجولة×${CFG.damage.lossPerRound} + نجوم وحدات الخصم الناجية (حتى ${CFG.damage.survivorCap}).</p>
      <button class="btn primary big" data-act="${over ? 'toResults' : m.rewardPending ? 'rewards' : 'nextRound'}">${over ? 'عرض النتائج' : m.rewardPending ? '🎁 اختر مكافأتك' : 'الجولة التالية'}</button></div>`);
  }

  // ---- card helpers shared by shop / bench / field / codex
  function cardStats(def, star) {
    const sm = CFG.stars.mult[star || 1];
    return { hp: Math.round(def.hp * sm), atk: Math.round(def.atk * sm) };
  }
  // Icon language: every fact on a card is a symbol, only numbers (and one short name) remain as text.
  const ART = AMB.art;
  const disc = (cls, iconName, title) => `<span class="bd ${cls}" title="${esc(title || '')}">${icon(iconName)}</span>`;
  const gems = (n) => `<span class="gems t${n}">${icon('gem').repeat(n)}</span>`;
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
    const atk = isHero ? def.board.atk : cardStats(def, star).atk;
    const hp = isHero ? (o.life != null ? o.life : 100) : cardStats(def, star).hp;
    const numCls = (n) => (String(n).length > 3 ? ' class="sm"' : '');
    const atkBd = `<span class="hc-atk">${icon('sword')}<b${numCls(atk)}>${atk}</b></span>`;
    const hpBd = `<span class="hc-hp">${icon('heart')}<b${numCls(hp)}>${hp}</b></span>`;
    const roleD = isHero ? disc('role hero', 'crown', 'بطل') : disc('role', ART.ROLE_ICON[def.role], ROLES[def.role].name);
    if (o.size === 'mini') {
      const items = (o.items || []).map((it) => `<i title="${esc(ITEMS[it].name)}">${icon(ITEMS[it].icon)}</i>`).join('');
      const mid = o.live ? `<div class="hc-bar"><div class="hpb"><b></b><i></i></div>${isHero ? '' : '<div class="mpb"><i></i></div>'}</div>` : (items ? `<div class="hc-its">${items}</div>` : '');
      return `<div class="tcard hc mini ${tier}${sc}${sel} ${o.cls || ''}" style="--wc:${W.color}" title="${esc(def.name)}" ${attrs}>
        <i class="hc-halo"></i><div class="hc-art">${portrait(def, { bare: true, k: o.k })}<i class="sheen"></i></div><div class="hc-ring"></div>
        ${roleD}${isHero ? '' : stars(star)}${o.prog ? `<span class="hc-prog" title="نسخ متطابقة: واحدة إضافية وتترقى">${o.prog}</span>` : ''}${atkBd}${hpBd}${mid}</div>`;
    }
    const own = o.own ? `<span class="hc-own ${o.own.pair ? 'up' : ''}">${o.own.pair ? '↑' : '×' + o.own.n}</span>` : '';
    const rolePill = isHero ? '' : `<span class="rolepill ${ROLES[def.role].kind}" title="${esc(ROLES[def.role].desc)} · تُوضع: ${esc(ROLES[def.role].place)}">${icon(ART.ROLE_ICON[def.role])}${ROLES[def.role].name}</span>`;
    const iconsRow = isHero
      ? disc('world', ART.WORLD_ICON[def.world], W.name) + roleD
      : disc('world', ART.WORLD_ICON[def.world], W.name) + rolePill + disc('skill', ART.SKILL_ICON[def.skill.type] || 'star', def.skill.name);
    const RA = AMB.ECONOMY && AMB.ECONOMY.rarities[def.rarity];
    const rar = RA ? `<span class="hc-rar" title="الندرة: ${RA.name}">${RA.name}</span>` : '';
    const lvl = o.lvl ? `<span class="hc-lvl" title="مستوى البطاقة (في الحملة والبرج)">Lv ${o.lvl}</span>` : '';
    return `<div class="tcard hc full ${tier}${sc} r-${def.rarity || 'common'} ${o.cls || ''}" style="--wc:${W.color}" ${attrs}>
      <div class="hc-frame"><i class="sheen"></i></div>${rar}${lvl}
      <div class="hc-art">${portrait(def, { bare: true, k: o.k })}</div><div class="hc-ring"></div>
      <div class="hc-name"><b>${def.name}</b></div>
      <div class="hc-icons">${iconsRow}</div>
      ${isHero ? '' : gems(def.tier).replace('class="gems', 'class="hc-gems gems')}
      ${isHero ? '' : `<span class="hc-cost"><i></i><b>${def.cost}</b></span>`}
      ${atkBd}${hpBd}${own}
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
    return `<div class="tcard hc full item ${it.kind} ${o.cls || ''}" ${o.attrs || ''} title="${esc(it.name + ': ' + it.text)}">
      <div class="hc-frame"></div>
      <div class="hc-art iconart">${icon(it.icon, 'big-ic')}</div><div class="hc-ring"></div>
      <div class="hc-name"><b>${it.name}</b></div>
      <div class="hc-chips">${itemChips(it)}</div>
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
  const SFX = {
    click: (c) => tone(c, { f: 520, to: 780, d: 0.06, v: 0.08, type: 'triangle' }),
    buy: (c) => { tone(c, { f: 660, d: 0.07, v: 0.1, type: 'square' }); tone(c, { f: 990, d: 0.12, v: 0.1, type: 'square', at: 0.06 }); },
    reroll: (c) => noise(c, 0.18, 0.06, 2500),
    hit: (c) => { noise(c, 0.07, 0.12, 1200); tone(c, { f: 170, to: 80, d: 0.07, v: 0.1, type: 'square' }); },
    crit: (c) => { noise(c, 0.14, 0.2, 700); tone(c, { f: 300, to: 60, d: 0.18, v: 0.18, type: 'sawtooth' }); tone(c, { f: 1200, d: 0.08, v: 0.08, type: 'triangle' }); },
    cast: (c) => { tone(c, { f: 300, to: 900, d: 0.3, v: 0.1, type: 'sawtooth' }); tone(c, { f: 600, to: 1800, d: 0.3, v: 0.05, type: 'triangle', at: 0.04 }); },
    heal: (c) => { tone(c, { f: 660, d: 0.12, v: 0.08 }); tone(c, { f: 880, d: 0.16, v: 0.08, at: 0.09 }); tone(c, { f: 1320, d: 0.2, v: 0.06, at: 0.18 }); },
    death: (c) => { noise(c, 0.3, 0.14, 300); tone(c, { f: 220, to: 40, d: 0.35, v: 0.16, type: 'sawtooth' }); },
    merge: (c) => { [523, 659, 784, 1047].forEach((f, i) => tone(c, { f, d: 0.22, v: 0.12, type: 'triangle', at: i * 0.07 })); noise(c, 0.25, 0.06, 4000); },
    banner: (c) => { tone(c, { f: 90, to: 50, d: 0.35, v: 0.2, type: 'sawtooth' }); noise(c, 0.25, 0.08, 500); },
    win: (c) => { [523, 659, 784, 1047, 1319].forEach((f, i) => tone(c, { f, d: 0.28, v: 0.13, type: 'triangle', at: i * 0.11 })); },
    lose: (c) => { [392, 330, 262, 196].forEach((f, i) => tone(c, { f, d: 0.34, v: 0.13, type: 'sawtooth', at: i * 0.16 })); },
  };
  function sfx(name) {
    const c = audio(); if (!c || !SFX[name]) return;
    const now = performance.now(), gap = { hit: 70, crit: 120, heal: 150, cast: 120, death: 120 }[name] || 0;
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
    if (fury) fury.textContent = c.t > CFG.combat.furyStart ? `غضب ×${fmt(c.fury(), 2)}` : (c.assault ? 'هجوم على مركز القيادة!' : '');

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
        burst(el, (WORLDS[f.world] || {}).color || '#ffd24a', 14, { r: 44, s: 6 }); sfx('cast');
      } else if (e.type === 'attack' && byId[e.from] && byId[e.to]) {
        const ea = anchorEl(byId[e.from]), eb = anchorEl(byId[e.to]);
        if (!ea || !eb) continue;
        const a = center(ea), b = center(eb);
        const L = Math.hypot(b.x - a.x, b.y - a.y) || 1;
        ea.style.setProperty('--dx', ((b.x - a.x) / L) * 9 + 'px');
        ea.style.setProperty('--dy', ((b.y - a.y) / L) * 9 + 'px');
        ea.style.setProperty('--bx', (-(b.x - a.x) / L) * 4 + 'px'); ea.style.setProperty('--by', (-(b.y - a.y) / L) * 4 + 'px');
        flash(ea, 'atk', 230);
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
        addFloat(50, e.side === S.combatViewer ? 84 : 16, 'سقط خط الدفاع — البطل مكشوف!', 'big');
      } else if (e.type === 'assault') {
        addFloat(50, e.side === S.combatViewer ? 80 : 20, 'هجوم على مركز القيادة!', 'big');
      } else if (e.type === 'retreat') {
        addFloat(50, e.side === S.combatViewer ? 80 : 20, 'انسحب البطل إلى مركز القيادة', 'big');
      } else if (e.type === 'sealed') {
        addFloat(50, e.side === S.combatViewer ? 88 : 12, 'تحصّن مركز القيادة (حد الضرر)', 'label');
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
  }

  function renderTop() {
    const m = S.match, p = me(), o = opp();
    const ph = S.phase;
    const steps = [['resources', 'الموارد'], ['shop', 'الشراء والتطوير'], ['form', 'الترتيب والقدرات'], ['combat', 'القتال'], ['result', 'النتائج']];
    const activeIdx = { resources: [0], prep: [1, 2], handoff: [], combat: [3], result: [4] }[ph] || [];
    const phases = steps.map(([, n], i) => `<span class="phase ${activeIdx.includes(i) ? 'on' : activeIdx.length && i < Math.min(...activeIdx) ? 'done' : ''}">${i + 1}. ${n}</span>`).join('');
    const need = m.xpNeeded(p);
    const left = ph === 'prep' ? Math.ceil(Math.max(0, S.deadline - Date.now()) / 1000) + 's' : '—';
    const avail = p.essence - m.reservedEssence(p);
    $('topbar').innerHTML = `
      <span class="tb-round">الجولة ${m.round}<small>/${maxR()}</small></span>
      ${m.rules ? `<span class="stagechip" title="أول من يفوز بجولتين يكسب القتال"><b>${p.stats.wins} – ${o.stats.wins}</b><span class="pips">${[0, 1].map((k) => `<i class="pip ${k < p.stats.wins ? 'done' : ''}"></i>`).join('')}</span></span>` : ''}
      <span ${m.rules ? 'style="display:none" ' : ''}class="stagechip" title="المراحل: كل مرحلة تنتهي بمكافأة تختارها (ما عدا الأخيرة)"><b>${m.stageInfo().name}</b><span class="pips">${[1, 2, 3, 4, 5, 6, 7].map((r) => `<i class="pip ${r < m.round ? 'done' : r === m.round ? 'now' : ''} ${CFG.match.stages.some((st) => st.rounds[1] === r && r < 7) ? 'gap' : ''}"></i>`).join('')}</span></span>
      <div class="phases">${phases}</div>
      <span class="timer" title="مؤقت مرحلة التجهيز">${S.paused ? '⏸' : left}</span>
      <span class="tb-spacer"></span>
      <span class="lifechip me" title="حياة بطلك">${portrait(myAvatar(p, 0), { k: 'tb0' })}${esc(p.name)} ${icon('heart')} ${lifeStr(p.life)}</span>
      <span class="lifechip" title="حياة بطل الخصم">${portrait(HEROES[o.heroId], { k: 'tb1' })}${esc(o.name)} ${icon('heart')} ${lifeStr(o.life)}</span>
      <span class="res gold" title="الذهب">${icon('gold')} ${p.gold}</span>
      <span class="res ess" title="الجوهر: متاح / الإجمالي (يُدفع فقط عند تفعيل القدرة)">${icon('essence')} ${avail}/${p.essence}</span>
      <span class="lvl" title="المستوى = الحد الأقصى للوحدات في الساحة"><span class="lw">مستوى</span> ${p.level} <span class="xpbar"><i style="width:${need ? (p.xp / need) * 100 : 100}%"></i></span> <small style="color:var(--muted)">${need ? p.xp + '/' + need : 'MAX'}</small></span>
      <button class="btn small mob-hide" data-act="tutorial" title="دليل سريع">؟</button>
      <button class="btn small mob-only" data-act="panels" title="التآزر وقدرات البطل">${S.panels ? 'إغلاق' : 'البطل'}</button>
      <button class="btn small" data-act="pause" title="إيقاف مؤقت">${S.paused ? '▶' : '⏸'}</button>
      ${soundBtn()}
      <button class="btn small" data-act="menuMatch">☰</button>`;
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
          inner = cardHTML(def, { size: 'mini', star: f.star, live: true, k: 'c' + f.id, attrs: `data-fid="${f.id}"`, cls: mine ? '' : 'foe' });
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
      const act = mine && !inCombat ? `data-act="slot" data-slot="${slot}" data-drop="board:${slot}"` : '';
      let rec = '';
      if (mine && !inCombat && S.sel && S.sel.kind === 'unit') { const su = m.findUnit(p, S.sel.uid); if (su) { const sd = ROLES[UNITS[su.defId].role].side; if (sd === 'any' || (sd === 'front') === (slot[0] === 'f')) rec = ' rec'; } }
      return `<div class="cell ${cls}${rec}" ${act} data-row="${slot[0] === 'f' ? 'أمامي' : 'خلفي'}">${inner}</div>`;
    };
    const row = (side, ch, mine) => [0, 1, 2, 3].map((k) => cell(side, ch + (mine ? k : 3 - k), mine)).join('');
    const o = 1 - v;
    const fe = $('field');
    if (AMB.PassUI) { const ac = (v === 0 && S.mode !== 'hotseat') ? AMB.PassUI.arenaClass() : ''; [...fe.classList].filter((c) => c.startsWith('ar-')).forEach((c) => fe.classList.remove(c)); if (ac) fe.classList.add(ac); }
    fe.style.setProperty('--mw', WORLDS[HEROES[p.heroId].world].color);
    fe.style.setProperty('--ew', WORLDS[HEROES[m.players[o].heroId].world].color);
    $('slots').innerHTML =
      row(o, 'b', false) + row(o, 'f', false) +
      `<div class="divider"><span>${sc && !inCombat ? (m.players[1 - v].lineup ? 'تشكيلة الخصم لهذه الجولة' : 'آخر تشكيلة للخصم (استطلاع)') : inCombat ? '' : 'الخصم — لم يقاتل بعد'}</span></div>` +
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
      let life = p.life, onBoard = p.summoned, exposed = false, status;
      if (inCombat) {
        const hf = S.combat.sides[side].hero;
        life = hf.hp / CFG.combat.heroHpScale;
        onBoard = hf.onBoard;
        exposed = S.combat.sides[side].exposed;
        status = onBoard ? (S.combat.targetable(hf) ? '<span class="st risk">في الساحة — قابل للاستهداف</span>' : '<span class="st safe">في الساحة — محمي بخط الدفاع</span>')
          : hf.sealed ? '<span class="st safe">مركز القيادة محصّن</span>' : exposed ? '<span class="st risk">مكشوف! يمكن مهاجمته</span>' : '<span class="st safe">محمي بخط الدفاع</span>';
      } else {
        const board = side === S.v ? p.board : null;
        const front = board ? Object.keys(board).filter((x) => x[0] === 'f').length : null;
        status = onBoard ? '<span class="st">مستدعى إلى الساحة</span>' : front === 0 ? '<span class="st risk">لا يوجد خط دفاع!</span>' : front ? `<span class="st safe">محمي (${front} في الصف الأمامي)</span>` : '<span class="st">مركز القيادة</span>';
      }
      el.style.setProperty('--wc', WORLDS[h.world].color);
      el.className = 'post' + (onBoard && !inCombat ? ' empty-hero' : '') + (exposed && !onBoard ? ' exposed' : '');
      el.innerHTML = `${portrait(h, { k: 'post' + side })}
        <div class="pl"><div class="pn">${esc(p.name)} · ${h.name}</div>
        <div class="lifebar"><i style="width:${Math.max(0, (life / p.maxLife) * 100)}%"></i></div>
        <div class="st">${icon('heart')} ${lifeStr(life)}/${p.maxLife} — ${status}</div></div>`;
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
    if (S.phase === 'combat' || S.phase === 'result') {
      $('bench').innerHTML = `<span class="lbl">احتياط</span>` + p.bench.map((u) => `<div class="bslot">${u ? cardHTML(UNITS[u.defId], { size: 'mini', star: u.star, items: u.items, k: 'bc' + u.uid, cls: 'ghost' }) : ''}</div>`).join('');
      return;
    }
    $('bench').innerHTML = `<span class="lbl">احتياط</span>` + p.bench.map((u, i) =>
      `<div class="bslot" data-act="bench" data-idx="${i}" data-drop="bench:${i}">${u ? pieceHTML(u, { sel: S.sel && S.sel.kind === 'unit' && S.sel.uid === u.uid }) : ''}</div>`).join('');
  }

  function renderShop() {
    const m = S.match, p = me();
    const prep = S.phase === 'prep' || S.phase === 'resources';
    const E = CFG.economy;
    if (!prep) {
      $('shopbar').innerHTML = `<div class="hint" style="padding:10px">🔒 ${S.phase === 'combat' ? 'القتال جارٍ' : 'المتجر مغلق'}${coach() && S.phase === 'combat' ? ' · تلقائي بالكامل' : ''}</div>`;
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
        <button class="btn" data-act="reroll" title="اختصار: D">تحديث <span>${freeR ? 'مجاني' : icon('gold') + E.rerollCost}</span></button>
        <button class="btn" data-act="xp" ${p.level >= E.maxLevel ? 'disabled' : ''} title="اختصار: F">+${E.xpPerBuy} خبرة <span>${icon('gold')}${E.xpCost}</span></button>
        <button class="btn ${p.shopLocked ? 'on' : ''}" data-act="lock" title="يبقي نفس العروض للجولة القادمة">${p.shopLocked ? '🔒 مقفل' : '🔓 قفل'}</button>
      </div>
      <div class="shop-row"><div class="shop-cards">${cards}</div>
      <div class="item-cards">${items}</div></div>
      <div class="shop-actions">
        <button class="btn" data-act="upgrades" title="تقدّم الترقية لكل وحدة">ترقية ★</button>
        <button class="btn primary ready-btn" data-act="ready" title="Enter">جاهز ⚔</button>
      </div>`;
  }

  function synergyHTML(list) {
    if (!list.length) return '<div class="hint">ضع وحدات لتفعيل التآزر</div>';
    // active synergies show their effect; the rest are one short row each (3 at most) with "+N" opening the full list
    const act = list.filter((s) => s.activeTier >= 0), rest = list.filter((s) => s.activeTier < 0);
    const shown = act.concat(rest.slice(0, 3)), hidden = rest.length - 3;
    AMB.TIPS.syn = () => ({ title: 'كل التآزرات', html: list.map((s) => `<div class="syn-full"><b>${s.name}</b> <small>(${s.count}${s.nextN ? '/' + s.nextN : ''})</small>${s.tiers.map((t) => `<div class="hint">• ${t.n}: ${t.text}</div>`).join('')}</div>`).join('') });
    return shown.map((s) => {
      const color = s.kind === 'world' ? WORLDS[s.id].color : s.kind === 'special' ? '#ffcf4a' : '#3ee6ff';
      const tiers = s.tiers.map((t, i) => (i === s.activeTier ? `<b>${t.n}</b>` : t.n)).join(' › ');
      const on = s.activeTier >= 0;
      const desc = on ? s.tiers[s.activeTier].text : `عند ${s.tiers[0].n}: ${s.tiers[0].text}`;
      return `<div class="syn ${on ? 'on' : ''}" style="--sc:${color}" title="${esc(s.tiers.map((t) => t.n + ': ' + t.text).join('\n'))}">
        <span class="cnt">${s.count}${s.nextN ? '/' + s.nextN : ''}</span><span class="nm">${s.name}</span><span class="tiers">${tiers}</span></div>
        ${on ? `<div class="syn-desc">${desc}</div>` : ''}`;
    }).join('') + (hidden > 0 ? `<button class="btn small ghost syn-more" data-act="info" data-k="syn">+${hidden} تآزر آخر</button>` : '');
  }

  function renderLeft() {
    const m = S.match, p = me(), o = opp();
    const board = Object.values(p.board);
    const ev = AMB.synergy.evaluate(board, p.heroId);
    const front = Object.keys(p.board).filter((s) => s[0] === 'f').length;
    const heroFront = p.summoned && p.heroSlot[0] === 'f';
    let guard;
    AMB.TIPS.guard = () => ({ title: 'حماية البطل', html: '<p>ما دام عندك أي وحدة حيّة في الصف الأمامي، <b>ما يقدر العدو يستهدف بطلك</b>. إذا سقطت كلها ينكشف البطل ويتلقى الضرر.</p><p>القتلة يقفزون للصف الخلفي لكن لا يضربون البطل المحمي. وإذا استدعيت بطلك للساحة يتلقى الضرر كاملًا.</p>' });
    if (heroFront) guard = `<div class="guard-status risk">${icon('shield')}<b>البطل في الأمام: مكشوف</b>${ibtn('guard')}</div>`;
    else if (front === 0) guard = `<div class="guard-status risk">${icon('shield')}<b>مكشوف!</b>${coach() ? ' ضع وحدات أمامية' : ''}${ibtn('guard')}</div>`;
    else guard = `<div class="guard-status safe">${icon('shield')}<b>خط الدفاع: ${front}</b>${ibtn('guard')}</div>`;
    const hw = WORLDS[HEROES[p.heroId].world];
    const sc = m.players[1 - S.v].lineup ? m.buildCombatSpec(1 - S.v) : m.scout[1 - S.v];
    const oppSyn = sc ? AMB.synergy.evaluate(sc.units, sc.heroId).list.filter((s) => s.activeTier >= 0) : [];
    const timeline = m.history.map((r) => `<span class="${r.winner === null ? 'wd' : r.winner === S.v ? 'w0' : 'w1'}" title="الجولة ${r.round}">${r.round}</span>`).join('');
    $('panel-left').innerHTML = `
      <section><h4>حماية البطل</h4>${guard}</section>
      <section><h4>التآزر <small>${board.length}/${p.level} وحدات</small></h4>
        <div class="syn ${ev.resonance ? 'on' : ''}" style="--sc:${hw.color}" title="كل وحدة من عالم بطلك تكتسب +${CFG.hero.resonancePerAlly * 100}% صحة وهجوم"><span class="cnt">${ev.resonance}</span><span class="nm">رنين البطل (${hw.name})</span></div>
        ${synergyHTML(ev.list)}</section>
      <section><h4>الخصم</h4>
        <div class="hero-box">${portrait(HEROES[o.heroId], { k: 'lo' })}<div><div class="nm">${esc(o.name)}</div><div class="ti">${HEROES[o.heroId].name} · ${WORLDS[HEROES[o.heroId].world].name}</div>
        <div class="ti">مستوى ${o.level} · ${icon('heart')} ${lifeStr(o.life)}</div></div></div>
        ${oppSyn.length ? '<div class="hint" style="margin-top:6px">تآزره: ' + oppSyn.slice(0, 3).map((s) => s.name).join('، ') + '</div>' : ''}
        ${sc && sc.summoned ? '<div class="hint">استدعى بطله</div>' : ''}</section>
      <section><h4>سجل الجولات</h4><div class="timeline">${timeline || '<span class="hint">—</span>'}</div></section>`;
  }

  function renderRight() {
    const m = S.match, p = me();
    const h = HEROES[p.heroId];
    const prep = S.phase === 'prep' || S.phase === 'resources';
    const avail = p.essence - m.reservedEssence(p);
    const abil = h.abilities.map((a) => {
      const cost = m.abilityCost(p, a);
      const trig = p.abilities[a.id] || '';
      const fired = S.combat && S.phase !== 'prep' && S.combat.sides[S.v] && S.combat.sides[S.v].abilities.find((x) => x.def.id === a.id && x.fired);
      const opts = [`<option value="">— غير مجهزة —</option>`].concat(Object.values(ABILITY_TRIGGERS).map((t) => `<option value="${t.id}" ${trig === t.id ? 'selected' : ''}>تفعيل: ${t.name}</option>`)).join('');
      return `<div class="ability ${trig ? 'armed' : ''}" title="${esc(a.text)}"><div class="ah"><span>${a.name} ${ibtn('hero', `data-id="${h.id}"`)}</span><span class="cost">${icon('essence')}${cost}${cost !== a.cost ? ` <s style="opacity:.5">${a.cost}</s>` : ''}</span></div>
        ${prep ? `<select data-ab="${a.id}">${opts}</select>` : `<div class="hint">${trig ? (fired ? '✔ فُعّلت في هذا القتال' : 'مجهزة: ' + ABILITY_TRIGGERS[trig].name) : 'غير مجهزة'}</div>`}</div>`;
    }).join('');
    AMB.TIPS.summon = () => ({ title: 'استدعاء البطل', html: `<p>${p.summoned ? 'بطلك الحين يقاتل في الساحة (اسحبه لتغيير موقعه).' : 'بطلك الحين في مركز القيادة خلف صفوفك.'}</p>
      <p><b>الفايدة:</b> يهاجم بقوة ${h.board.atk + CFG.hero.boardAtkPerRound * m.round}، والحلفاء +${CFG.hero.summonAuraAtk * 100}% هجوم، والقدرات أرخص بـ${CFG.hero.summonAbilityDiscount}.</p>
      <p><b>المخاطرة:</b> يتلقى الضرر كاملًا (حتى الضرر المساحي)، وينسحب بعد خسارة ${CFG.combat.summonKnockout} حياة، ووصول حياته للصفر = خسارة فورية.</p>` });
    const summonTxt = p.summoned ? 'إعادة البطل إلى مركز القيادة' : 'استدعاء البطل إلى الساحة';
    const bag = [];
    for (let i = 0; i < CFG.economy.itemBenchSize; i++) {
      const id = p.items[i];
      if (!id) { bag.push('<div class="bagslot"></div>'); continue; }
      const it = ITEMS[id];
      const sel = S.sel && S.sel.kind === 'item' && S.sel.idx === i;
      bag.push(`<div class="bagslot ${it.kind} ${sel ? 'sel' : ''}" data-act="bagSel" data-idx="${i}" title="${esc(it.name + ': ' + it.text)}">${icon(it.icon)}</div>`);
    }
    const armed = p.armedSpells.map((id, i) => `<span class="chip" data-act="disarm" data-idx="${i}" title="اضغط لإلغاء التجهيز">${icon(ITEMS[id].icon)} ${ITEMS[id].name} ✕</span>`).join('');
    $('panel-right').innerHTML = `
      <section><div class="hero-box">${portrait(h, { k: 'rh' })}<div style="flex:1"><div class="nm">${h.name}</div><div class="ti">${h.title} · ${WORLDS[h.world].name}</div>
        <div class="lifebar-big"><i style="width:${(p.life / p.maxLife) * 100}%"></i></div><div class="ti">${icon('heart')} ${lifeStr(p.life)} / ${p.maxLife}</div></div></div>
        <div class="passive" title="${esc(h.passive.text)}"><b>${h.passive.name}</b> ${ibtn('hero', `data-id="${h.id}"`)}</div>
        ${prep ? `<div class="summon-row"><button class="btn summon-btn ${p.summoned ? 'on' : ''}" data-act="summon">${summonTxt}</button>${ibtn('summon')}</div>` : ''}
      </section>
      <section><h4>قدرات البطل <span class="cost" style="color:var(--ess)">${icon('essence')} متاح ${avail}</span></h4>${abil}
        ${coach() ? '<div class="hint">الجوهر يُصرف فقط إذا تفعّلت القدرة</div>' : ''}</section>
      <section><h4>المعدات والتعاويذ</h4><div class="bag">${bag.join('')}</div>
        ${armed ? `<div class="armed-spells">${armed}</div>` : ''}
        ${coach() ? '<div class="hint" style="margin-top:6px">اضغط معدة ثم وحدة لتجهيزها</div>' : ''}</section>
      <section><h4>التحديد</h4>${selectionHTML()}</section>
      ${coach() ? `<section class="hint">اضغط وحدة ثم خانة لنقلها، أو اسحبها · <span class="kbd">D</span> تحديث · <span class="kbd">F</span> خبرة · <span class="kbd">Enter</span> جاهز</section>` : ''}`;
  }

  function selectionHTML() {
    const m = S.match, p = me();
    const prep = S.phase === 'prep' || S.phase === 'resources';
    if (!S.sel || !prep) return '<div class="hint">لا شيء محدد.</div>';
    if (S.sel.kind === 'unit') {
      const u = m.findUnit(p, S.sel.uid);
      if (!u) return '';
      const d = UNITS[u.defId];
      const sm = CFG.stars.mult[u.star];
      return `<div class="selinfo"><b>${d.name}</b> ${stars(u.star)}<br>
        <span class="pill" style="--pc:${WORLDS[d.world].color}">${WORLDS[d.world].name}</span><span class="pill">${ROLES[d.role].name}</span><span class="pill" style="--pc:var(--t${d.tier})">فئة ${d.tier}</span><br>
        صحة ${fmt(d.hp * sm)} · هجوم ${fmt(d.atk * sm)} · مدى ${d.range}<br>
        <b>${d.skill.name}:</b> ${d.skill.text}
        ${u.items.length ? '<br>معدات: ' + u.items.map((i) => ITEMS[i].name).join('، ') : ''}
        <div class="row"><button class="btn small" data-act="detail" data-id="${d.id}" data-star="${u.star}">التفاصيل</button>
        <button class="btn small danger" data-act="sell">بيع +${m.sellValue(u)} ذهب</button>
        ${u.items.length ? '<button class="btn small" data-act="unequip">نزع المعدات</button>' : ''}</div></div>`;
    }
    if (S.sel.kind === 'item') {
      const it = ITEMS[p.items[S.sel.idx]];
      if (!it) return '';
      return `<div class="selinfo"><b>${it.name}</b> (${it.kind === 'equip' ? 'معدة' : 'تعويذة'})<br>${it.text}
        <div class="row">${it.kind === 'spell' ? '<button class="btn small" data-act="arm">تجهيز للقتال القادم</button>' : '<span class="hint">اضغط على وحدة لتجهيزها بهذه المعدة.</span>'}
        <button class="btn small danger" data-act="sellItem">بيع +${Math.floor(it.cost / 2)}</button></div></div>`;
    }
    if (S.sel.kind === 'hero') return '<div class="hint">البطل محدد: اضغط خانة في ساحتك لنقله.</div>';
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
        return `<div class="pb sel"><span class="pb-name">${d.name} ${stars(u.star)} <span class="rolepill ${R.kind}">${icon(ART.ROLE_ICON[d.role])}${R.name}</span></span>
          <span class="pb-tip">تُوضع: <b>${R.place}</b> · اضغط خانة مضيئة لنقلها</span>
          <span class="pb-btns"><button class="btn small danger" data-act="sell">بيع +${m.sellValue(u)}</button>
          <button class="btn small" data-act="${onBoard ? 'toBench' : 'toBoard'}">${onBoard ? 'للاحتياط' : 'للساحة'}</button>
          <button class="btn small" data-act="detail" data-id="${d.id}" data-star="${u.star}">تفاصيل</button>
          ${u.items.length ? '<button class="btn small" data-act="unequip">نزع المعدات</button>' : ''}
          <button class="btn small ghost" data-act="deselect">✕</button></span></div>`;
      }
    }
    if (sel && sel.kind === 'item') {
      const it = ITEMS[p.items[sel.idx]];
      if (it) return `<div class="pb sel"><span class="pb-name">${icon(it.icon)} ${it.name}</span><span class="pb-tip">${it.kind === 'equip' ? 'اضغط وحدة لتجهيزها بها' : it.text}</span>
        <span class="pb-btns">${it.kind === 'spell' ? '<button class="btn small" data-act="arm">جهّز للقتال</button>' : ''}<button class="btn small danger" data-act="sellItem">بيع +${Math.floor(it.cost / 2)}</button><button class="btn small ghost" data-act="deselect">✕</button></span></div>`;
    }
    if (sel && sel.kind === 'hero') return `<div class="pb sel"><span class="pb-name">البطل</span><span class="pb-tip">اضغط خانة في ساحتك لنقله</span><span class="pb-btns"><button class="btn small ghost" data-act="deselect">✕</button></span></div>`;
    const bag = p.items.map((id, i) => `<button class="bagchip" data-act="bagSel" data-idx="${i}" title="${esc(ITEMS[id].name)}: ${esc(ITEMS[id].text)}">${icon(ITEMS[id].icon)}</button>`).join('');
    return `<div class="pb"><span class="pb-count">في الساحة ${cnt}${p.summoned ? ' + البطل' : ''}</span>${bag ? `<span class="pb-bag" title="معداتك: اضغط واحدة ثم وحدة">${bag}</span>` : ''}
      ${coach() ? '<span class="pb-tip">اضغط وحدة لتغييرها · ٣ نسخ = ★</span>' : ''}
      <span class="pb-btns"><button class="btn small" data-act="autoArrange" title="يختار أقوى وحداتك ويضع الحراس أمام والباقي خلف">ترتيب تلقائي</button></span></div>`;
  }

  function renderCombatCtrl() {
    const el = $('combat-ctrl');
    if (S.phase === 'combat') {
      el.innerHTML = `<span class="clock">0.0s</span>
        ${[1, 2, 4].map((s) => `<button class="btn small ${S.speed === s ? 'on' : ''}" data-act="speed" data-v="${s}">${s}x</button>`).join('')}
        <button class="btn small" data-act="skip">تخطي ⏭</button><span class="fury"></span>`;
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
      ['الصحة', (s) => d.hp * SM[s]], ['الهجوم', (s) => d.atk * SM[s]], ['سرعة الهجوم (ضربة/ث)', () => d.as, 2],
      ['الضرر في الثانية', (s) => d.atk * SM[s] * d.as], ['المدى', () => d.range], ['الدفاع (تقليل ضرر)', () => d.def * 100, 0, '%'],
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
      match = `<div class="hint">في هذه المباراة: تملك ${ow.length ? ow.map((u) => '★'.repeat(u.star)).join(' ، ') : 'لا شيء'} · المتبقي في المخزون المشترك: ${S.match.pool[id]}/${CFG.economy.poolSize[d.tier]}</div>`;
    }
    modal(`<div class="detail-head">${portrait(d, { k: 'md' })}<div><h2>${d.name} ${star ? stars(star) : ''}</h2><div class="hint" style="direction:ltr;text-align:right">${d.en}</div>
      <span class="pill" style="--pc:${W.color}">${W.name}</span><span class="pill">${R.name}</span><span class="pill" style="--pc:var(--t${d.tier})">فئة ${d.tier} · تكلفة ${d.cost}</span>
      <div class="hint">${R.desc} ${d.role === 'assassin' ? 'يقفز للصف الخلفي في بداية القتال.' : ''}</div></div></div>
      <table><tr><th>الخاصية</th><th>★</th><th>★★</th><th>★★★</th></tr>
      ${rows.map(([n, f, dg, suf]) => `<tr><td>${n}</td>${[1, 2, 3].map((s) => { const v = f(s), b = f(1); return `<td>${fmt(v, dg || 0)}${suf || ''}${s > 1 && v !== b ? `<div class="delta">+${Math.round(((v - b) / b) * 100)}%</div>` : ''}</td>`; }).join('')}</tr>`).join('')}</table>
      <div class="skillbox"><b>المهارة — ${sk.name}:</b> ${sk.text}
        ${skRows ? `<table><tr><th></th><th>★</th><th>★★</th><th>★★★</th></tr>${skRows}</table>` : ''}</div>
      <div class="hint"><b>التطوير:</b> ${CFG.stars.copiesPerStar} نسخ ★ = ★★ ، و ${CFG.stars.copiesPerStar} نسخ ★★ = ★★★ (الحد الأقصى). الصحة والهجوم ×${SM[2]} ثم ×${SM[3]}؛ السرعة والمدى ثابتان كي لا تصبح وحدة واحدة غير قابلة للمواجهة.</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px">
        <div><span class="wtag" style="--w:${W.color}">${SYNERGIES[d.world].name}</span>${synOf(d.world)}</div>
        <div><b>${SYNERGIES[d.role].name}</b>${synOf(d.role)}</div></div>
      <p class="hint">${W.lore}</p>${match}`);
  }

  function heroDetail(id) {
    const h = HEROES[id], W = WORLDS[h.world];
    modal(`<div class="detail-head">${portrait(h, { k: 'mh' })}<div><h2>${h.name}</h2><div class="hint">${h.title}</div>
      <span class="pill" style="--pc:${W.color}">${W.name}</span><div class="hint">${h.style}</div></div></div>
      <div class="skillbox"><b>سلبية — ${h.passive.name}:</b> ${h.passive.text}</div>
      ${h.abilities.map((a) => `<div class="skillbox"><b>${a.name}</b> — <span style="color:var(--ess)">${a.cost} جوهر</span><br>${a.text}</div>`).join('')}
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
      const preview = maxed ? 'وصلت للحد الأقصى ★★★' : `عند ${'★'.repeat(target + 1)}: صحة ${fmt(d.hp * SM[target])} → <b>${fmt(d.hp * SM[target + 1])}</b>، هجوم ${fmt(d.atk * SM[target])} → <b>${fmt(d.atk * SM[target + 1])}</b>${d.skill.dmg ? `، ${d.skill.name} ${d.skill.dmg[target - 1]} → <b>${d.skill.dmg[target]}</b>` : d.skill.heal ? `، علاج ${d.skill.heal[target - 1]} → <b>${d.skill.heal[target]}</b>` : d.skill.shield ? `، درع ${d.skill.shield[target - 1]} → <b>${d.skill.shield[target]}</b>` : ''}`;
      const inShop = p.shop.map((x, i) => [x, i]).filter((e) => e[0] === id);
      const btn = inShop.length && !maxed ? `<button class="btn small primary" data-act="buyFromUpg" data-idx="${inShop[0][1]}">شراء من المتجر (${d.cost})</button>` : `<span class="hint">${maxed ? '' : 'غير متوفر في المتجر الآن'}</span>`;
      return `<div class="upg-row">${portrait(d, { k: 'up' + id })}<div><b>${d.name}</b> <span class="hint">★×${byStar[0]} ★★×${byStar[1]} ★★★×${byStar[2]} · المخزون ${m.pool[id]}</span>
        ${maxed ? '' : `<div class="hint">نسخ ${'★'.repeat(target)}: ${have}/${need} للترقية</div><div class="prog"><i style="width:${(have / need) * 100}%"></i></div>`}
        <div class="hint">${preview}</div></div>${btn}</div>`;
    }).join('');
    modal(`<h2>شاشة التطوير</h2><p class="hint">اجمع ${need} نسخ متطابقة بنفس عدد النجوم ليتم دمجها تلقائيًا في وحدة أقوى (تنتقل المعدات معها). الحد الأقصى ★★★.
      المخزون مشترك بين اللاعبين، فإذا جمع خصمك نفس الوحدة تصبح أصعب.</p>${rows || '<p class="hint">لا تملك وحدات بعد.</p>'}`);
  }

  function howto() {
    modal(`<h2>كيف ألعب؟</h2>
      <div class="skillbox"><b>الهدف:</b> أوصل حياة بطل الخصم إلى الصفر. كل جولة: موارد ← شراء وتطوير ← ترتيب وقدرات ← قتال تلقائي ← نتائج.</div>
      <div class="skillbox"><b>المتجر:</b> اشترِ الوحدات بالذهب، حدّث العروض (${CFG.economy.rerollCost} ذهب)، اشترِ خبرة لرفع المستوى (= عدد الوحدات في الساحة). الفائدة: +1 لكل ${CFG.economy.interestPer} ذهب مدخر (حتى ${CFG.economy.interestMax}). سلاسل الفوز/الخسارة تمنح ذهبًا إضافيًا.</div>
      <div class="skillbox"><b>التطوير:</b> ${CFG.stars.copiesPerStar} نسخ متطابقة = نجمة إضافية تلقائيًا.</div>
      <div class="skillbox"><b>الساحة:</b> صف أمامي (خط الدفاع) وصف خلفي. الحراس والمقاتلون في الأمام، السحرة والقناصة والدعم في الخلف. القتلة يقفزون إلى الصف الخلفي للعدو.</div>
      <div class="skillbox"><b>البطل:</b> يبقى في مركز القيادة ولا يمكن استهدافه ما دام لديك وحدة حية في الصف الأمامي. إذا سقط خط الدفاع يصبح مكشوفًا. يمكنك استدعاؤه للساحة ليقاتل بنفسه — مكسب كبير ومخاطرة حقيقية.</div>
      <div class="skillbox"><b>القدرات:</b> جهّز قدرات البطل واختر متى تُفعّل (بداية القتال، بعد 5 ثوانٍ، عند سقوط أول حليف، عند انكشاف البطل). تستهلك الجوهر.</div>
      <div class="skillbox"><b>التآزر:</b> وحدات من نفس العالم أو الدور تفعّل مكافآت. وحدات عالم بطلك تكتسب رنينًا. وجود 3–4 عوالم مختلفة يفعّل "تقارب العوالم" فلا تكون التشكيلات المختلطة أضعف.</div>
      <div class="skillbox"><b>المراحل والمكافآت:</b> المباراة ${CFG.match.maxRounds} جولات في 4 مراحل: ${CFG.match.stages.map((x) => x.name + ' (' + (x.rounds[0] === x.rounds[1] ? 'الجولة ' + x.rounds[0] : 'الجولتان ' + x.rounds[0] + '–' + x.rounds[1]) + ')').join('، ')}. بعد كل مرحلة (عدا الأخيرة) تختار <b>مكافأة من 3</b>: وحدة مجانية، ذهب، خبرة، جوهر، معدة، <b>بركة دائمة</b> للفريق، أو شفاء للبطل. جولة الحسم تضاعف ارتداد الخسارة ×${CFG.match.finaleLossMult}. إن لم يسقط بطل قبلها، يفوز الأعلى حياة. وفي القتال نفسه يتصاعد الضرر بعد ${CFG.combat.furyStart} ثانية (الغضب).</div>`);
  }

  function matchMenu() {
    const wasPaused = S.paused;
    S.paused = true; S.pausedLeft = S.deadline - Date.now();
    S._resumeAfterMenu = !wasPaused;
    modal(`<h2>القائمة</h2><div style="display:grid;gap:10px;margin-top:12px">
      <button class="btn" data-act="resumeMenu">متابعة</button>
      <button class="btn" data-act="tutorial">دليل سريع</button>
      <button class="btn" data-act="howto">كل القواعد</button>
      <button class="btn danger" data-act="surrender">استسلام (${esc(me().name)})</button>
      <button class="btn ghost" data-act="abandon">خروج للقائمة الرئيسية (لا تُسجَّل)</button></div>`);
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
    if (S.mode === 'campaign') return AMB.CampaignUI.showResult(m, secs);   // campaign has its own results screen
    if (S.mode !== 'friendly' && !m._recorded) { AMB.telemetry.recordMatch(m, { seconds: secs }); m._recorded = true; }
    if (!m._counted) { m._counted = true; try { localStorage.setItem('amb_played', String(+(localStorage.getItem('amb_played') || 0) + 1)); } catch (e) { /* ignore */ } }
    if (!m._passDone) { m._passDone = true; try { S.passResult = AMB.pass.recordMatch(m.summary(0)); } catch (e) { S.passResult = null; } }
    let title;
    if (m.winner === null || m.winner === undefined) title = 'تعادل';
    else if (S.mode === 'hotseat') title = `فاز ${esc(m.players[m.winner].name)}!`;
    else title = m.winner === 0 ? 'نصر!' : 'هزيمة';
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
    $('results').innerHTML = `${stage}<div class="res-banner"><h1>${title}</h1><p class="hint">${m.round} جولات · ${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')} دقيقة ${S.mode === 'friendly' ? '· مباراة ودية (لم تُسجَّل)' : ''}</p>
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
      if (!rows.length) return '<p class="hint">لا توجد بيانات بعد — العب مباراة.</p>';
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
        <p class="hint">لاختبار التوازن على نطاق واسع شغّل محاكي الذكاء الاصطناعي: <code>node tools/simulate.js 800</code></p>
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
      else if (!occ) toast('اختر وحدة لتجهيزها', 'err');
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
    go: (d) => { show(d.to); if (d.to === 'stats') renderStats(); if (d.to === 'codex') renderCodex(); },
    howto: () => howto(),
    tutorial: () => showTutorial(),
    diff: (d) => { S.difficulty = d.v; document.querySelectorAll('#diff-seg button').forEach((b) => b.classList.toggle('on', b.dataset.v === d.v)); },
    mode: (d) => { S.mode = d.v; S.picks = [null, null]; S.pickIdx = 0; renderHeroSelect(); show('hero'); },
    pickHero: (d, el, e) => {
      if (e.target.closest('[data-act="heroInfo"]')) return;
      if (heroLocked(d.id)) { toast('هذا البطل مقفل: افتحه من الباكجات (ليجندري) أو الباتل باس', 'err'); return; }
      S.picks[S.pickIdx] = d.id; renderHeroSelect();
    },
    heroInfo: (d, el, e) => { e.stopPropagation(); heroDetail(d.id); },
    heroConfirm: () => {
      if (!S.picks[S.pickIdx] || heroLocked(S.picks[S.pickIdx])) return;
      if (starterPick()) {   // one-time starter choice, then continue to the match as usual
        AMB.collection.chooseStarter(S.picks[0]); sfx('merge'); toast(`${HEROES[S.picks[0]].name} صار بطلك! افتح الباقين من الباكجات أو الباتل باس`, 'good');
        renderHeroSelect(); return;
      }
      if (S.mode === 'hotseat' && S.pickIdx === 0) { S.pickIdx = 1; renderHeroSelect(); return; }
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
          if (have === 2) toast(`عندك نسختان من «${UNITS[r.unit.defId].name}»: اشترِ ثالثة وتترقى ★ تلقائيًا`, 'good');
        }
      }
      renderMatch();
      if (S.pop) {
        const pe = document.querySelector(`[data-drag="unit:${S.pop.uid}"]`);
        if (pe) { if (S.pop.merged) { burst(pe, '#ffd24a', 26, { r: 60, s: 7 }); burst(pe, '#ffffff', 10, { r: 40 }); banner('★ ترقية!', 'merge'); } else burst(pe, '#ffffff', 6, { r: 26 }); }
        setTimeout(() => { S.pop = null; }, 800);
      }
    },
    buyFromUpg: (d) => { const r = S.match.buy(S.v, +d.idx); if (res(r) && r.merged && r.merged.length) toast(`تطوير! ${UNITS[r.merged[r.merged.length - 1].defId].name} ${'★'.repeat(r.merged[r.merged.length - 1].star)}`, 'good'); renderMatch(); upgradesModal(); },
    buyItem: (d) => { if (prepActive() && res(S.match.buyItem(S.v, +d.idx))) renderMatch(); },
    reroll: () => { if (prepActive() && res(S.match.reroll(S.v))) { sfx('reroll'); renderMatch(); } },
    sound: () => { SND.on = !SND.on; try { localStorage.setItem('amb_sound', SND.on ? '1' : '0'); } catch (e) { /* ignore */ } if (SND.on) sfx('click'); document.querySelectorAll('[data-act="sound"]').forEach((b) => { if (b.id === 'menu-sound') b.querySelector('.mt-ic').textContent = SND.on ? '🔊' : '🔇'; else b.textContent = SND.on ? '🔊' : '🔇'; }); },
    xp: () => { if (prepActive()) { const lv = me().level; if (res(S.match.buyXp(S.v))) { if (me().level > lv) toast(`المستوى ${me().level}! يمكنك وضع ${me().level} وحدات`, 'good'); renderMatch(); } } },
    lock: () => { if (prepActive()) { S.match.toggleLock(S.v); renderMatch(); } },
    ready: () => prepActive() && endPrep(),
    deselect: () => { S.sel = null; renderMatch(); },
    autoArrange: () => { if (!prepActive()) return; S.match.autoArrange(S.v); S.sel = null; toast('تم ترتيب أقوى وحداتك: الحراس أمام والباقي خلف', 'good'); renderMatch(); },
    toBench: () => {
      const m = S.match, p = me(); if (!S.sel || S.sel.kind !== 'unit') return;
      const bi = p.bench.indexOf(null); if (bi < 0) { toast('الاحتياط ممتلئ: بع وحدة أو بدّل مكانها', 'err'); return; }
      if (res(m.move(S.v, S.sel.uid, { zone: 'bench', idx: bi }))) { S.sel = null; renderMatch(); }
    },
    toBoard: () => {
      const m = S.match, p = me(); if (!S.sel || S.sel.kind !== 'unit') return;
      const u = m.findUnit(p, S.sel.uid); if (!u) return;
      const sd = ROLES[UNITS[u.defId].role].side, F = ['f1', 'f2', 'f0', 'f3'], B = ['b1', 'b2', 'b0', 'b3'];
      const order = (sd === 'back' ? B.concat(F) : sd === 'front' ? F.concat(B) : F.concat(B)).filter((x) => !p.board[x] && !(p.summoned && p.heroSlot === x));
      if (!order.length || Object.keys(p.board).length >= p.level) { toast(`الساحة ممتلئة (${p.level}/${p.level}). اضغط وحدة في الساحة لتبديلها، أو بع وحدة، أو ارفع مستواك`, 'err'); return; }
      if (res(m.move(S.v, u.uid, { zone: 'board', slot: order[0] }))) { S.sel = null; renderMatch(); }
    },
    sell: () => { if (prepActive() && S.sel && S.sel.kind === 'unit' && res(S.match.sell(S.v, S.sel.uid))) { S.sel = null; renderMatch(); } },
    unequip: () => { if (S.sel && S.sel.kind === 'unit' && res(S.match.unequip(S.v, S.sel.uid))) renderMatch(); },
    bagSel: (d) => { if (!prepActive()) return; const i = +d.idx; S.sel = S.sel && S.sel.kind === 'item' && S.sel.idx === i ? null : { kind: 'item', idx: i }; renderMatch(); },
    arm: () => { if (S.sel && S.sel.kind === 'item' && res(S.match.armSpell(S.v, S.sel.idx))) { S.sel = null; toast('جُهّزت التعويذة للقتال القادم', 'good'); renderMatch(); } },
    disarm: (d) => { if (prepActive() && res(S.match.disarmSpell(S.v, +d.idx))) renderMatch(); },
    sellItem: () => { if (S.sel && S.sel.kind === 'item' && res(S.match.sellItem(S.v, S.sel.idx))) { S.sel = null; renderMatch(); } },
    summon: () => { if (prepActive() && res(S.match.toggleSummon(S.v))) { S.sel = null; toast(me().summoned ? 'استُدعي البطل إلى الساحة' : 'عاد البطل إلى مركز القيادة', 'good'); renderMatch(); } },
    detail: (d, el, e) => { e.stopPropagation(); unitDetail(d.id, d.star ? +d.star : 0); },
    upgrades: () => upgradesModal(),
    closeModal: () => { closeModal(); if (S._resumeAfterMenu) { ACT.resumeMenu(); } },
    pause: () => {
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
      if (S._resumeAfterMenu) { S.paused = false; if (S.phase === 'prep') S.deadline = Date.now() + S.pausedLeft; }
      S._resumeAfterMenu = false;
      renderTop();
    },
    surrender: () => {
      const m = S.match;
      closeModal(); S._resumeAfterMenu = false; S.paused = false;
      cancelAnimationFrame(S.raf);
      m.winner = 1 - S.v; m.phase = 'over'; m.endedAt = Date.now();
      me().life = 0;
      showResults();
    },
    abandon: () => { closeModal(); closeOverlay(); S._resumeAfterMenu = false; S.paused = false; cancelAnimationFrame(S.raf); S.phase = 'idle'; S.match = null; show('menu'); },
    speed: (d) => { S.speed = +d.v; renderCombatCtrl(); },
    skip: () => skipCombat(),
    nextRound: () => { closeOverlay(); if (S.match.isOver) showResults(); else nextRound(); },
    rewards: () => {
      const m = S.match; closeOverlay();
      if (S.mode === 'hotseat') { S.rewardQueue = [1]; rewardHandoff(0); }
      else { S.rewardQueue = []; showRewards(0); }
    },
    rewardGo: (d) => showRewards(+d.pi),
    claimReward: (d) => {
      const m = S.match, pi = S.rewardFor, r = m.claimReward(pi, +d.idx);
      if (!r.ok) { toast(r.reason, 'err'); return; }
      sfx('merge');
      let msg = 'استلمت: ' + r.text; if (r.item) msg += ' — ' + AMB.DATA.ITEMS[r.item].name;
      toast(S.mode === 'hotseat' ? m.players[pi].name + ': ' + msg : msg, 'good');
      if (S.mode !== 'hotseat') { const a = AMB.AI.claimReward(m, 1); if (a && a.ok) setTimeout(() => toast('الخصم اختار: ' + AMB.DATA.REWARDS[a.id].name, ''), 700); }
      afterReward();
    },
    toResults: () => showResults(),
    info: (d, el, e) => { if (e) e.stopPropagation(); if (d.k === 'hero') { heroDetail(d.id); return; } const t = AMB.TIPS[d.k]; if (!t) return; const x = t(); modal(`<h2>${x.title}</h2><div class="tip-body">${x.html}</div>`); },
    again: () => { if (S.mode === 'campaign') { startMatch(); return; } S.picks = [S.picks[0], S.picks[1]]; S.pickIdx = 0; renderHeroSelect(); show('hero'); },
    statsExport: () => {
      const blob = new Blob([JSON.stringify(AMB.telemetry.load(), null, 2)], { type: 'application/json' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'multiverse-telemetry.json'; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    },
    statsReset: () => { if (confirm('مسح جميع الإحصائيات؟')) { AMB.telemetry.reset(); renderStats(); } },
    codexF: (d) => { S.codexF[d.k] = d.v; renderCodex(); },
  };

  document.addEventListener('click', (e) => {
    if (e.target.closest && e.target.closest('.btn') && !e.target.closest('[data-act="sound"]')) sfx('click');
    if (e.target === $('modal-back')) { ACT.closeModal(); return; }
    const el = e.target.closest('[data-act]');
    if (!el) { if (S.sel && S.screen === 'match' && !e.target.closest('.panel,.shopbar,.field,.bench-row,.modal')) { S.sel = null; renderMatch(); } return; }
    const fn = ACT[el.dataset.act];
    if (fn) fn(el.dataset, el, e);
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
  // the four heroes on the main menu
  (function fillMenu() {
    const el = $('menu-heroes');
    if (el) el.innerHTML = Object.values(HEROES).map((h, i) => cardHTML(h, { k: 'menu' + i })).join('');
    const ms = $('menu-sound'); if (ms) ms.querySelector('.mt-ic').textContent = SND.on ? '🔊' : '🔇';
  })();

  // debug / testing hook
  globalThis.AMB_UI = { S, ACT, itemsHTML: () => Object.values(ITEMS).map((it) => itemCardHTML(it)).join(''), renderMatch, cardHTML, itemCardHTML, show, toast, sfx, burst, modal, closeModal, overlay, closeOverlay, startMatch, portrait, stars };
  if (AMB.PassUI) { AMB.PassUI.installActions(); AMB.PassUI.applyCosmetics(); AMB.PassUI.refreshMenu(); }
})();
