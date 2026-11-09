/*
 * Battle pass screen ("ممر الصدع"): track, missions, profile; plus the cosmetics applied in the match UI.
 * Logic lives in core/pass.js. Progress is saved in this browser only.
 */
(function () {
  const AMB = globalThis.AMB;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const store = AMB.save.storageFor('pass');   // battle pass lives inside the unified save (core/save.js)
  // character rewards also give the card (unlock or +1 copy) — see core/collection.js
  const pass = (AMB.pass = AMB.Pass.create(store, null, (r) => {
    if (r.type === 'shards') { if (AMB.wallet) AMB.wallet.add('shards', r.n, 'mission'); return; }   // daily-mission shards
    if (r.shards && AMB.wallet) AMB.wallet.add('shards', r.shards, 'pass');   // some free-track levels also pay shards
    if (AMB.collection) AMB.collection.grantPassReward(r);
  }, (type) => (AMB.album ? AMB.album.ownedCosmetics(type) : [])));
  if (AMB.events) AMB.Pass.wire(pass, AMB.events);   // missions also count campaign fights, upgrades, packs and stars
  // rewards claimed before characters could be unlocked: make sure those characters are owned
  if (AMB.collection) ['free', 'premium'].forEach((t) => (pass.state().claimed[t] || []).forEach((l) => { const r = pass.reward(l, t); if (r && r.type === 'avatar' && !AMB.collection.owned(r.id)) AMB.collection.grantPassReward(r); }));
  const P = AMB.Pass, C = P.COSMETICS, TYPE = pass.TYPE_NAME;
  const { icon, portrait } = AMB.art;
  const UI = () => globalThis.AMB_UI;
  let tab = 'track';

  const avatarDef = (id) => AMB.DATA.UNITS[id] || AMB.DATA.HEROES[id] || null;
  const SLOTS = [['title', 'اللقب'], ['frame', 'إطار البطل'], ['arena', 'ثيم الساحة'], ['fx', 'تأثير الفوز'], ['avatar', 'الصورة الرمزية']];

  // ---------------------------------------------------------------- where does an item come from?
  function source(type, id) {
    for (const [tr, tbl] of [['free', P.FREE], ['premium', P.PREMIUM]]) {
      for (const [lv, r] of Object.entries(tbl)) if (r.type === type && r.id === id) return { track: tr, level: +lv };
    }
    return null;
  }

  // ---------------------------------------------------------------- previews
  function preview(type, id, extra) {
    if (type === 'frame') { const f = C.frame[id] || {}; return `<span class="pv frame" style="--c1:${f.c1 || '#555'};--c2:${f.c2 || '#222'}">${icon('crown')}</span>`; }
    if (type === 'arena') return `<span class="pv arena ar-${id}"></span>`;
    if (type === 'fx') return `<span class="pv fxsw">${((C.fx[id] || {}).colors || []).map((c) => `<i style="background:${c}"></i>`).join('')}</span>`;
    if (type === 'title') return `<span class="pv title">${esc((C.title[id] || {}).name || id)}</span>`;
    if (type === 'perk') return `<span class="pv perk">${icon('wind')}<b>+${(extra && extra.sec) || 5}ث</b></span>`;
    if (type === 'avatar') { const d = avatarDef(id); return `<span class="pv avatar">${d ? portrait(d, { bare: true, k: 'pv' + id }) : ''}</span>`; }
    return '';
  }

  // ---------------------------------------------------------------- applied in the match UI
  function applyCosmetics() {
    const el = document.documentElement, f = pass.equipped('frame'), fr = C.frame[f];
    el.dataset.frame = f || 'default';
    if (fr && fr.c1) { el.style.setProperty('--frame-c1', fr.c1); el.style.setProperty('--frame-c2', fr.c2); }
  }
  const arenaClass = () => { const a = pass.equipped('arena'); return a && a !== 'default' ? 'ar-' + a : ''; };
  const fxColors = () => (C.fx[pass.equipped('fx')] || C.fx.default).colors;
  const avatarId = () => pass.equipped('avatar');
  const titleName = () => (C.title[pass.equipped('title')] || C.title.default).name;

  // ---------------------------------------------------------------- results panel (xp gained)
  function resultPanel(r) {
    if (!r) return '';
    if (r.mult === 0) return `<div class="xp-panel"><div class="xp-h"><b>ممر الصدع</b></div><p class="hint">المباراة الودية ما تعطي خبرة، جرّب «ضد الكمبيوتر» عشان تتقدم في الممر.</p></div>`;
    const lv = pass.level(), pct = pass.maxed() ? 100 : Math.round((100 * pass.xpInLevel()) / P.SEASON.xpPerLevel);
    const up = r.levelAfter > r.levelBefore;
    return `<div class="xp-panel"><div class="xp-h"><b>ممر الصدع</b><span class="xp-gain">+${r.xp} خبرة</span></div>
      ${r.ended ? '<p class="hint">انتهى الموسم، ما تنضاف خبرة جديدة.</p>' : ''}
      <ul class="xp-lines">${r.lines.map((l) => `<li><span>${l[0]}</span><b>+${l[1]}</b></li>`).join('')}</ul>
      <div class="xp-bar"><i style="width:${pct}%"></i></div>
      <div class="xp-lv">المستوى <b>${lv}</b>${up ? ` <span class="xp-up">ارتفعت من ${r.levelBefore} ← ${r.levelAfter} 🎉</span>` : ''}</div>
      ${pass.unclaimedCount() ? `<button class="btn primary" data-act="go" data-to="pass">عندك ${pass.unclaimedCount()} مكافأة أو مهمة جاهزة تستلمها</button>` : ''}</div>`;
  }

  function refreshMenu() {
    const b = $('menu-pass'); if (!b) return;
    const n = pass.unclaimedCount();
    (b.querySelector('.mt-l') || b).innerHTML = `ممر الصدع <small>${pass.level()}</small>${n ? `<span class="dot">${n}</span>` : ''}`;
  }

  // ---------------------------------------------------------------- tips (ⓘ)
  const ibtnP = (k) => `<button class="ibtn" data-act="info" data-k="${k}" title="شرح">ⓘ</button>`;
  AMB.TIPS = AMB.TIPS || {};
  AMB.TIPS.passinfo = () => ({ title: 'مكافآت الممر', html: '<p>كل المكافآت <b>للشكل بس</b> (ألقاب، إطارات، ثيمات، تأثيرات، صور)، والشخصيات تفتح بطاقاتها.</p><p>الوحيد المختلف «مؤقت التجهيز»: وقت زيادة تفكر فيه بس. <b>ما فيه شي يقوّي الوحدات.</b></p><p>المسار المميز للعرض بس الحين (قريب).</p>' });
  AMB.TIPS.missinfo = () => ({ title: 'المهام', html: '<p>مهام اليوم تعطي <b>خبرة ممر + شظايا</b> تشتري فيها باكجات.</p><p>تنحسب المباريات السريعة وعلى نفس الجهاز وقتالات الحملة، وتطوير البطاقات وفتح الباكجات. المباراة الودية ما تنحسب.</p>' });

  // ---------------------------------------------------------------- screen
  function cellHTML(level, track) {
    const r = pass.reward(level, track); if (!r) return '<div class="pcell empty"></div>';
    const claimed = pass.isClaimed(level, track), can = pass.canClaim(level, track), reached = level <= pass.level();
    const premLock = track === 'premium' && !pass.isPremium();
    const cls = claimed ? 'claimed' : can ? 'can' : premLock ? 'premlock' : reached ? '' : 'locked';
    const act = can ? 'passClaim' : claimed && r.type !== 'perk' ? 'passEquipReward' : premLock && reached ? 'passPremium' : '';
    return `<div class="pcell ${cls} ${r.big ? 'big' : ''}" ${act ? `data-act="${act}"` : ''} data-level="${level}" data-track="${track}" title="${esc(TYPE[r.type] + ': ' + pass.rewardName(r))}">
      ${preview(r.type, r.id, r)}<span class="pc-name">${esc(pass.rewardName(r))}</span>
      <span class="pc-state">${claimed ? '✓' : can ? 'استلم' : premLock ? '🔒' : ''}</span></div>`;
  }

  function trackHTML() {
    const cols = [];
    for (let l = 1; l <= P.SEASON.levels; l++) {
      cols.push(`<div class="pcol ${l === pass.level() ? 'now' : ''} ${l <= pass.level() ? 'reached' : ''}" data-col="${l}"><div class="plv">${l}</div>${cellHTML(l, 'free')}</div>`);
    }
    const n = [];
    for (let l = 1; l <= pass.level(); l++) ['free', 'premium'].forEach((t) => { if (pass.canClaim(l, t)) n.push(1); });
    return `<div class="ptools"><button class="btn primary" data-act="passClaimAll" ${n.length ? '' : 'disabled'}>استلم الكل (${n.length})</button>
      ${ibtnP('passinfo')}</div>
      <div class="ptrack-wrap"><div class="prow-labels"><span></span><b>مجاني</b><b>بريميوم 🔒</b></div><div class="ptrack" id="ptrack">${cols.join('')}</div></div>`;
  }

  function missionHTML(m) {
    const pct = Math.round((m.progress / m.target) * 100);
    return `<div class="mission ${m.done ? 'done' : ''} ${m.claimed ? 'claimed' : ''}"><div class="m-top"><b>${esc(m.name)}</b><span class="m-xp">+${m.xp} خبرة${m.shards ? ` · ${icon('gem')} ${m.shards}` : ''}</span></div>
      <div class="xp-bar"><i style="width:${pct}%"></i></div>
      <div class="m-bot"><span>${m.progress.toLocaleString('en-US')} / ${m.target.toLocaleString('en-US')}</span>
      ${m.claimed ? '<span class="m-ok">✓ تم الاستلام</span>' : m.done ? `<button class="btn small primary" data-act="passClaimMission" data-id="${m.id}">استلم</button>` : '<span class="m-wait">جارية</span>'}</div></div>`;
  }
  function missionsHTML() {
    const d = new Date(), mid = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1), hrs = Math.max(1, Math.ceil((mid - d) / 3600000));
    return `<h3>مهام اليوم <small>تتجدد بعد ${hrs} ساعة</small></h3><div class="missions">${pass.dailyMissions().map(missionHTML).join('')}</div>
      <h3>مهام الأسبوع</h3><div class="missions">${pass.weeklyMissions().map(missionHTML).join('')}</div>
      <p class="hint">${ibtnP('missinfo')} المباراة الودية ما تنحسب</p>`;
  }

  function optionHTML(type, id) {
    const owned = pass.owned(type).includes(id), on = pass.equipped(type) === id;
    const src = source(type, id);
    const hint = owned ? '' : src ? `${src.track === 'premium' ? 'بريميوم' : 'مجاني'} · مستوى ${src.level}` : '—';
    const name = type === 'avatar' ? ((avatarDef(id) || {}).name || id) : ((C[type][id] || {}).name || id);
    return `<button class="opt ${on ? 'on' : ''} ${owned ? '' : 'locked'}" ${owned ? `data-act="passEquip" data-type="${type}" data-id="${id}"` : 'disabled'} title="${esc(name)}">
      ${preview(type, id)}<span class="o-name">${esc(name)}</span>${on ? '<span class="o-on">✓</span>' : ''}${hint ? `<span class="o-hint">${hint}</span>` : ''}</button>`;
  }
  function profileHTML() {
    const av = avatarId(), def = av ? avatarDef(av) : null;
    const prevHero = def ? portrait(def, { bare: true, k: 'prof' }) : `<span class="no-av">${icon('crown')}</span>`;
    const sections = SLOTS.map(([type, label]) => {
      let ids;
      if (type === 'avatar') { const all = Object.values(P.FREE).concat(Object.values(P.PREMIUM)).filter((r) => r.type === 'avatar').map((r) => r.id); ids = all; }
      else ids = Object.keys(C[type]);
      const noneOpt = type === 'avatar' ? `<button class="opt ${av ? '' : 'on'}" data-act="passEquip" data-type="avatar" data-id=""><span class="pv avatar none">${icon('crown')}</span><span class="o-name">بطلك الافتراضي</span>${av ? '' : '<span class="o-on">✓</span>'}</button>` : '';
      return `<h3>${label}</h3><div class="opts">${noneOpt}${ids.map((id) => optionHTML(type, id)).join('')}</div>`;
    }).join('');
    return `<div class="prof-card"><span class="prof-av">${prevHero}</span><div><b class="prof-title">${esc(titleName())}</b>
      ${pass.prepBonus() ? `<div class="hint">⏱ +${pass.prepBonus()} ث تجهيز</div>` : ''}</div></div>${sections}`;
  }

  function render() {
    const root = $('pass'); if (!root) return;
    const lv = pass.level(), pct = pass.maxed() ? 100 : Math.round((100 * pass.xpInLevel()) / P.SEASON.xpPerLevel);   // percent of the level, not raw XP
    const days = pass.daysLeft();
    // kid #10: no season countdown and no premium teaser until the player has finished the campaign's first level
    const fresh = !(AMB.campaign && AMB.campaign.isCleared('l1boss'));
    root.innerHTML = `<div class="pass-head"><div class="ph-lv"><small>المستوى</small><b>${lv}</b></div>
      <div class="ph-mid"><div class="ph-name">${P.SEASON.name}</div><div class="xp-bar big"><i style="width:${pct}%"></i></div>
        <div class="ph-sub">${pass.maxed() ? 'وصلت لأعلى مستوى 🎉' : `${pass.xpInLevel()} / ${P.SEASON.xpPerLevel} خبرة للمستوى ${lv + 1}`} ${fresh ? '' : ` · ${pass.ended() ? '<b style="color:var(--red)">انتهى الموسم</b>' : `باقي ${days} يوم`}`}</div></div>
      ${fresh ? '' : `<button class="btn ph-prem" data-act="passPremium" title="مو متاح للحين">${pass.isPremium() ? '✓ بريميوم' : '👑 بريميوم · قريب'}</button>`}</div>
      <div class="ptabs">${[['track', 'المسار'], ['missions', 'المهام'], ['profile', 'ملفي']].map(([k, n]) => `<button class="${tab === k ? 'on' : ''}" data-act="passTab" data-v="${k}">${n}${k === 'missions' && pass.dailyMissions().concat(pass.weeklyMissions()).some((m) => m.done && !m.claimed) ? ' <span class="dot sm"></span>' : ''}</button>`).join('')}</div>
      <div class="pbody">${tab === 'track' ? trackHTML() : tab === 'missions' ? missionsHTML() : profileHTML()}</div>`;
    if (tab === 'track') { const tr = $('ptrack'); if (tr) { const col = tr.querySelector(`[data-col="${Math.max(1, lv - 1)}"]`); if (col) tr.scrollLeft = col.offsetLeft - 8; } }
    refreshMenu();
  }

  // ---------------------------------------------------------------- actions
  const toast = (m, k) => UI() && UI().toast(m, k);
  function after() { applyCosmetics(); render(); }
  function installActions() {
    const ACT = UI().ACT;
    Object.assign(ACT, {
      passTab: (d) => { tab = d.v; render(); },
      passClaim: (d) => {
        const lvl = +d.level, tr = d.track, r = pass.claim(lvl, tr);
        if (!r) return;
        UI().sfx('merge');
        if (r.type !== 'perk' && pass.equipped(r.type) === (r.type === 'avatar' ? null : 'default')) pass.equip(r.type, r.id);   // first item of a kind is equipped for you
        toast(`استلمت: ${pass.rewardName(r)} (${TYPE[r.type]})`, 'good'); after();
      },
      passClaimAll: () => {
        const got = pass.claimAll(); if (!got.length) return;
        got.forEach((g) => { const r = g.reward; if (r.type !== 'perk' && pass.equipped(r.type) === (r.type === 'avatar' ? null : 'default')) pass.equip(r.type, r.id); });
        UI().sfx('merge'); toast(`استلمت ${got.length} مكافأة`, 'good'); after();
      },
      passEquipReward: (d) => { const r = pass.reward(+d.level, d.track); if (r && pass.equip(r.type, r.id)) { UI().sfx('click'); toast(`تم تجهيز: ${pass.rewardName(r)}`, 'good'); after(); } },
      passEquip: (d) => { if (pass.equip(d.type, d.id === '' ? null : d.id)) { UI().sfx('click'); after(); } },
      passClaimMission: (d) => { const r = pass.claimMission(d.id); if (r) { UI().sfx('merge'); toast(`+${r.xp} خبرة${r.shards ? ` و +${r.shards} شظية` : ''}${r.levelUp ? ' — ارتفع مستواك!' : ''}`, 'good'); after(); } },
      passPremium: () => toast('المسار المميز قريب · والمجاني متاح لك كله', ''),
    });
  }

  AMB.PassUI = { render, refreshMenu, resultPanel, applyCosmetics, arenaClass, fxColors, avatarId, avatarDef, titleName, preview, installActions };
  // the match UI loads first and exposes AMB_UI; hook up once it exists
  if (UI()) { installActions(); }
  applyCosmetics(); refreshMenu();
})();
