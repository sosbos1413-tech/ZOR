/*
 * Battle pass ("ممر الصدع"), season 1. Pure logic + data, no DOM, so it is testable.
 * Progress is stored in the player's browser (localStorage) — there is no server.
 *
 * Fairness: every reward is cosmetic except the small "prep time" perk (+5s / +10s on the
 * planning timer). Nothing changes card or hero strength.
 * The premium track is UI only: it stays locked (`premium=false`) until real payments exist.
 */
(function () {
  const AMB = (globalThis.AMB = globalThis.AMB || {});
  const DAY = 86400000;

  const SEASON = {
    id: 's1', name: 'موسم الصدع الأول', days: 42, levels: 30, xpPerLevel: 100,
    xp: { played: 30, won: 40, perRoundWon: 6, finaleWon: 15, firstWinOfDay: 40 },
    modeMult: { easy: 0.6, normal: 1, hard: 1.25, hotseat: 0.8, friendly: 0, campaign: 0 },   // friendly games give nothing (no farming)
  };

  // ------------------------------------------------------------- cosmetics registry (applied by the UI)
  const COSMETICS = {
    frame: {
      default: { name: 'بدون إطار' },
      bronze: { name: 'إطار برونزي', c1: '#d9a066', c2: '#7a4a1f' },
      alb_ember: { name: 'إطار الجمر', c1: '#ff7a45', c2: '#7a2208' }, alb_tide: { name: 'إطار المدّ', c1: '#3ec9ff', c2: '#12507a' }, alb_neon: { name: 'إطار النيون', c1: '#c45cff', c2: '#4a1d7a' }, alb_sylvan: { name: 'إطار الغابة', c1: '#52d67c', c2: '#1f5a2c' },
      silver: { name: 'إطار فضي', c1: '#e8eef7', c2: '#8794a8' },
      forest: { name: 'إطار الغابة', c1: '#8be07a', c2: '#2f7a2c' },
      ember: { name: 'إطار الجمر', c1: '#ffb347', c2: '#d9341c' },
      gold: { name: 'إطار ذهبي', c1: '#fff1a6', c2: '#e3a800' },
      diamond: { name: 'إطار ألماسي', c1: '#e0fbff', c2: '#3ec9ff' },
      aurora: { name: 'إطار الشفق', c1: '#c9a6ff', c2: '#3ee6ff' },
      crimson: { name: 'إطار قرمزي', c1: '#ff9aa2', c2: '#a5141b' },
    },
    arena: {
      default: { name: 'الساحة الأساسية' },
      stardust: { name: 'غبار النجوم' },
      neongrid: { name: 'شبكة النيون' },
      moonwaves: { name: 'أمواج القمر' },
      volcano: { name: 'مرجل البركان' },
      riftgold: { name: 'الصدع الذهبي' },
      inkwash: { name: 'حبر المانغا' },
      enchanted: { name: 'الغابة المسحورة' },
      storm: { name: 'العاصفة الكهربائية' },
      frost: { name: 'الجليد الأزرق' },
    },
    fx: {
      default: { name: 'احتفال عادي', colors: ['#ffd24a', '#ff4f8b', '#5fe3ff', '#7bd46a', '#ffffff'] },
      bluespark: { name: 'شرر أزرق', colors: ['#5fe3ff', '#3ea0ff', '#ffffff', '#a8f0ff'] },
      petals: { name: 'بتلات', colors: ['#ffb3c7', '#ff7aa2', '#ffe0ea', '#ffffff'] },
      goldrain: { name: 'مطر ذهبي', colors: ['#ffd24a', '#fff1a6', '#e3a800', '#ffffff'] },
      lightning: { name: 'برق', colors: ['#fff6a8', '#ffffff', '#b9a6ff', '#5fe3ff'] },
      inferno: { name: 'لهب', colors: ['#ff4f1a', '#ffb347', '#ffd24a', '#ffffff'] },
      emerald: { name: 'زمرد', colors: ['#52d67c', '#b8ffcf', '#ffffff', '#2f7a2c'] },
      violet: { name: 'بنفسج', colors: ['#c45cff', '#e6c8ff', '#ffffff', '#7a4dff'] },
      crystal: { name: 'كريستال', colors: ['#e0fbff', '#9fe8ff', '#ffffff', '#3ec9ff'] },
    },
    title: {
      default: { name: 'لاعب جديد' },
      t_recruit: { name: 'مجنّد الصدع' }, t_junior: { name: 'قائد صغير' }, t_formation: { name: 'ماهر التشكيلات' },
      t_stars: { name: 'جامع النجوم' }, t_stages: { name: 'سيّد المراحل' }, t_rift: { name: 'سيّد الصدع' },
      t_elite: { name: 'نخبة الصدع' }, t_legend: { name: 'أسطورة العوالم' }, t_finale: { name: 'صاحب الحسم' },
      // album rewards (core/album.js) — not part of the pass tracks
      alb_ember: { name: 'جامع الجمر' }, alb_tide: { name: 'جامع المدّ' }, alb_neon: { name: 'جامع النيون' }, alb_sylvan: { name: 'جامع الغابة' }, alb_all: { name: 'جامع الصدع' },
    },
  };

  // ------------------------------------------------------------- reward tracks (30 levels each)
  const mk = (type, id, extra) => Object.assign({ type, id }, extra || {});
  const FREE = {
    1: mk('title', 't_recruit'), 2: mk('frame', 'bronze'), 3: mk('avatar', 'yuta'), 4: mk('arena', 'stardust'),
    5: mk('perk', 'prep5', { sec: 5 }), 6: mk('fx', 'bluespark'), 7: mk('avatar', 'mitsuki'), 8: mk('title', 't_junior'),
    9: mk('frame', 'silver'), 10: mk('arena', 'neongrid'), 11: mk('avatar', 'kinoko'), 12: mk('fx', 'petals'),
    13: mk('title', 't_formation'), 14: mk('avatar', 'mizuki'), 15: mk('perk', 'prep10', { sec: 5 }), 16: mk('frame', 'forest'),
    17: mk('arena', 'moonwaves'), 18: mk('title', 't_stars'), 19: mk('avatar', 'akane'), 20: mk('fx', 'goldrain'),
    21: mk('frame', 'ember'), 22: mk('title', 't_stages'), 23: mk('avatar', 'miyuki'), 24: mk('arena', 'volcano'),
    25: mk('fx', 'lightning'), 26: mk('avatar', 'reiji'), 27: mk('frame', 'gold'), 28: mk('avatar', 'kashiwagi'),
    29: mk('fx', 'inferno'), 30: mk('arena', 'riftgold', { big: true }),
  };
  const PREMIUM = {
    1: mk('avatar', 'kagira'), 2: mk('frame', 'crimson'), 3: mk('title', 't_elite'), 4: mk('arena', 'inkwash'), 5: mk('fx', 'emerald'),
    6: mk('avatar', 'merin'), 7: mk('avatar', 'kota'), 8: mk('frame', 'diamond'), 9: mk('avatar', 'kazehaya'), 10: mk('arena', 'enchanted', { big: true }),
    11: mk('avatar', 'yozora'), 12: mk('fx', 'violet'), 13: mk('title', 't_finale'), 14: mk('avatar', 'kurenai'), 15: mk('avatar', 'shirayuki'),
    16: mk('frame', 'aurora'), 17: mk('arena', 'storm'), 18: mk('avatar', 'ryujin'), 19: mk('fx', 'crystal'), 20: mk('avatar', 'zerokai', { big: true }),
    21: mk('avatar', 'juzo'), 22: mk('arena', 'frost'), 23: mk('avatar', 'natsuki'), 24: mk('title', 't_legend'), 25: mk('avatar', 'seiji'),
    26: mk('avatar', 'ibara'), 27: mk('avatar', 'tetsuya'), 28: mk('title', 't_rift'), 29: mk('avatar', 'ryuji'), 30: mk('avatar', 'orath', { big: true }),
  };

  function rewardName(r) {
    if (!r) return '';
    if (r.type === 'perk') return `مؤقت التجهيز +${r.sec} ث`;
    if (r.type === 'avatar') return AMB.DATA ? ((AMB.DATA.UNITS[r.id] || AMB.DATA.HEROES[r.id] || {}).name || r.id) : r.id;
    return (COSMETICS[r.type] && COSMETICS[r.type][r.id] ? COSMETICS[r.type][r.id].name : r.id);
  }
  const TYPE_NAME = { title: 'لقب', frame: 'إطار', arena: 'ثيم ساحة', fx: 'تأثير فوز', avatar: 'شخصية', perk: 'ميزة' };

  // ------------------------------------------------------------- missions
  // Daily missions: 3 a day from this pool. Each gives battle-pass XP + shards (to buy packs).
  // Stats count in every mode (quick matches, same device, campaign) except friendly matches.
  const DAILY = [
    { id: 'd_play2', name: 'العب مباراتين أو قتالين', stat: 'matches', target: 2, xp: 50, shards: 30 },
    { id: 'd_win1', name: 'افز بمباراة', stat: 'wins', target: 1, xp: 60, shards: 30 },
    { id: 'd_fights3', name: 'افز بـ٣ قتالات (أي نمط)', stat: 'fights_won', target: 3, xp: 60, shards: 50 },
    { id: 'd_rounds5', name: 'افز بـ٥ جولات', stat: 'rounds_won', target: 5, xp: 50, shards: 30 },
    { id: 'd_buy10', name: 'اشترِ ١٠ وحدات', stat: 'buys', target: 10, xp: 40, shards: 30 },
    { id: 'd_merge1', name: 'رقِّ وحدة (٣ نسخ ← نجمة)', stat: 'merges', target: 1, xp: 50, shards: 30 },
    { id: 'd_summon1', name: 'استدعِ بطلك إلى الساحة', stat: 'summons', target: 1, xp: 40, shards: 30 },
    { id: 'd_reroll8', name: 'حدّث المتجر ٨ مرات', stat: 'rerolls', target: 8, xp: 30, shards: 30 },
    { id: 'd_reward2', name: 'اختر مكافأتي مراحل', stat: 'stage_rewards', target: 2, xp: 40, shards: 30 },
    { id: 'd_finale', name: 'افز بجولة الحسم', stat: 'finale_won', target: 1, xp: 70, shards: 40 },
    { id: 'd_dmg', name: 'تسبّب بـ ٥٠٠٠ ضرر بوحداتك', stat: 'damage', target: 5000, xp: 40, shards: 30 },
    { id: 'd_upgrade1', name: 'طوّر بطاقة', stat: 'upgrades', target: 1, xp: 40, shards: 40 },
    { id: 'd_pack1', name: 'افتح باكج', stat: 'packs', target: 1, xp: 30, shards: 30 },
    { id: 'd_stars3', name: 'اجمع ٣ نجوم جديدة في الحملة', stat: 'stars', target: 3, xp: 60, shards: 50 },
    { id: 'd_tower2', name: 'اصعد طابقين في البرج', stat: 'tower_floors', target: 2, xp: 50, shards: 50 },
    { id: 'd_campaign2', name: 'العب قتالين في الحملة', stat: 'campaign', target: 2, xp: 40, shards: 40 },
  ];
  const WEEKLY = [
    { id: 'w_win5', name: 'افز بـ٥ مباريات', stat: 'wins', target: 5, xp: 200 },
    { id: 'w_play10', name: 'العب ١٠ مباريات', stat: 'matches', target: 10, xp: 150 },
    { id: 'w_merge8', name: 'رقِّ ٨ وحدات', stat: 'merges', target: 8, xp: 180 },
    { id: 'w_rounds30', name: 'افز بـ٣٠ جولة', stat: 'rounds_won', target: 30, xp: 200 },
    { id: 'w_worlds', name: 'ادخل مباراة بوحدات من ٤ عوالم', stat: 'four_worlds', target: 1, xp: 150 },
    { id: 'w_event', name: 'أكمل الحدث الأسبوعي', stat: 'event_cleared', target: 1, xp: 150 },
    { id: 'w_finale3', name: 'افز بـ٣ جولات حسم', stat: 'finale_won', target: 3, xp: 180 },
  ];

  const dayKey = (t) => { const d = new Date(t); return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(); };
  const weekKey = (t) => { const d = new Date(t); const o = new Date(d.getFullYear(), 0, 1); return d.getFullYear() * 100 + Math.floor(((d - o) / DAY + o.getDay()) / 7); };
  const hash = (s) => {   // murmur-style mixing so neighbouring days give unrelated orders
    let h = 2166136261;
    for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
    h ^= h >>> 16; h = Math.imul(h, 2246822507); h ^= h >>> 13; h = Math.imul(h, 3266489909); h ^= h >>> 16;
    return h >>> 0;
  };
  function pick3(pool, key) {
    const idx = pool.map((_, i) => i).sort((a, b) => (hash(key + ':' + a) - hash(key + ':' + b)) || a - b);
    return idx.slice(0, 3).map((i) => pool[i]);
  }

  // ------------------------------------------------------------- state
  const KEY = 'amb_pass_v1';
  const blank = (now) => ({ v: 1, season: SEASON.id, start: now, xp: 0, premium: false, claimed: { free: [], premium: [] }, claimedMissions: [], daily: { key: 0, p: {} }, weekly: { key: 0, p: {} },
    firstWinDay: 0, matches: 0, equip: { title: 'default', frame: 'default', arena: 'default', fx: 'default', avatar: null } });

  function create(storage, nowFn, onReward, extraOwned) {
    const now = nowFn || (() => Date.now());
    let st;
    try { st = JSON.parse(storage.getItem(KEY)); } catch (e) { st = null; }
    if (!st || st.season !== SEASON.id) st = blank(now());
    const save = () => { try { storage.setItem(KEY, JSON.stringify(st)); } catch (e) { /* storage blocked */ } };
    const roll = () => {   // new day / new week -> fresh mission progress
      const dk = dayKey(now()), wk = weekKey(now());
      if (st.daily.key !== dk) { st.daily = { key: dk, p: {} }; st.claimedMissions = st.claimedMissions.filter((id) => !id.startsWith('d_')); }
      if (st.weekly.key !== wk) { st.weekly = { key: wk, p: {} }; st.claimedMissions = st.claimedMissions.filter((id) => !id.startsWith('w_')); }
    };
    roll();
    function bumpAll(sm) {
      const bump = (p, k, n) => { if (n) p[k] = (p[k] || 0) + n; };
      [st.daily.p, st.weekly.p].forEach((p) => {
        bump(p, 'matches', 1); if (sm.won) { bump(p, 'wins', 1); bump(p, 'fights_won', 1); }
        bump(p, 'rounds_won', sm.roundsWon || 0); bump(p, 'buys', sm.buys || 0); bump(p, 'rerolls', sm.rerolls || 0);
        bump(p, 'merges', sm.merges || 0); bump(p, 'summons', sm.summoned ? 1 : 0); bump(p, 'stage_rewards', sm.stageRewards || 0); bump(p, 'damage', Math.round(sm.damage || 0));
        bump(p, 'finale_won', sm.finaleWon ? 1 : 0); bump(p, 'four_worlds', sm.worldsUsed >= 4 ? 1 : 0);
      });
    }

    const api = {
      SEASON, COSMETICS, FREE, PREMIUM, TYPE_NAME, rewardName,
      state: () => st,
      level: () => Math.min(SEASON.levels, 1 + Math.floor(st.xp / SEASON.xpPerLevel)),
      xpInLevel: () => (api.level() >= SEASON.levels ? SEASON.xpPerLevel : st.xp % SEASON.xpPerLevel),
      maxed: () => api.level() >= SEASON.levels,
      daysLeft: () => Math.max(0, Math.ceil((st.start + SEASON.days * DAY - now()) / DAY)),
      ended: () => now() >= st.start + SEASON.days * DAY,
      isPremium: () => !!st.premium,
      setPremium: (v) => { st.premium = !!v; save(); },        // dev / future payment hook only
      addXp(n) { if (api.ended() || n <= 0) return 0; const b = api.level(); st.xp += Math.round(n); save(); return api.level() - b; },

      dailyMissions() { roll(); return pick3(DAILY, 'd' + st.daily.key).map((m) => api._m(m, st.daily.p)); },
      weeklyMissions() { roll(); return pick3(WEEKLY, 'w' + st.weekly.key).map((m) => api._m(m, st.weekly.p)); },
      _m(m, prog) { const v = Math.min(m.target, prog[m.stat] || 0); return Object.assign({}, m, { progress: v, done: v >= m.target, claimed: st.claimedMissions.includes(m.id) }); },
      claimMission(id) {
        const m = api.dailyMissions().concat(api.weeklyMissions()).find((x) => x.id === id);
        if (!m || !m.done || m.claimed) return null;
        st.claimedMissions.push(id); const before = api.level(); st.xp += m.xp; save();
        if (m.shards && onReward) { try { onReward({ type: 'shards', n: m.shards, mission: id }); } catch (e) { /* never blocks claiming */ } }
        return { xp: m.xp, shards: m.shards || 0, levelUp: api.level() - before > 0 };
      },
      /** add progress to a mission stat (daily + weekly), e.g. track('upgrades', 1) */
      track(stat, n) { if (!(n > 0)) return; roll(); [st.daily.p, st.weekly.p].forEach((p) => { p[stat] = (p[stat] || 0) + n; }); save(); },
      /** mission stats from a finished match/fight summary, without the match XP (campaign pays its own) */
      recordStats(sm) { roll(); bumpAll(sm); save(); },

      /** summary: { mode, won, roundsPlayed, roundsWon, finaleWon, buys, rerolls, merges, summoned, stageRewards, damage, worldsUsed } */
      recordMatch(sm) {
        roll();
        const X = SEASON.xp, mult = SEASON.modeMult[sm.mode] != null ? SEASON.modeMult[sm.mode] : 1;
        const lines = [['مباراة', X.played], ['جولات فزت بها', X.perRoundWon * sm.roundsWon]];
        if (sm.won) lines.push(['فوز بالمباراة', X.won]);
        if (sm.finaleWon) lines.push(['جولة الحسم', X.finaleWon]);
        const today = dayKey(now());
        if (sm.won && st.firstWinDay !== today && mult > 0) { lines.push(['أول فوز اليوم', X.firstWinOfDay]); st.firstWinDay = today; }
        let xp = Math.round(lines.reduce((s, l) => s + l[1], 0) * mult);
        const beforeLevel = api.level();
        const added = api.ended() ? 0 : xp;
        if (mult > 0) { bumpAll(sm); st.matches++; }
        st.xp += added; save();
        const doneNow = [];   // missions that are complete but unclaimed (the UI shows a dot)
        return { xp: added, mult, lines: lines.map((l) => [l[0], Math.round(l[1] * mult)]), levelBefore: beforeLevel, levelAfter: api.level(), ended: api.ended(),
          missionsReady: api.dailyMissions().concat(api.weeklyMissions()).filter((m) => m.done && !m.claimed).map((m) => m.id), doneNow };
      },

      // ---- rewards
      reward(level, track) { return (track === 'premium' ? PREMIUM : FREE)[level] || null; },
      canClaim(level, track) {
        if (level > api.level() || level < 1) return false;
        if (track === 'premium' && !st.premium) return false;
        return !st.claimed[track].includes(level) && !!api.reward(level, track);
      },
      claim(level, track) { if (!api.canClaim(level, track)) return null; st.claimed[track].push(level); save(); const r = api.reward(level, track); if (onReward) { try { onReward(r, level, track); } catch (e) { /* reward hook never blocks claiming */ } } return r; },
      claimAll() { const got = []; for (let l = 1; l <= api.level(); l++) ['free', 'premium'].forEach((t) => { const r = api.claim(l, t); if (r) got.push({ level: l, track: t, reward: r }); }); return got; },
      isClaimed: (level, track) => st.claimed[track].includes(level),
      unclaimedCount() { let n = 0; for (let l = 1; l <= api.level(); l++) ['free', 'premium'].forEach((t) => { if (api.canClaim(l, t)) n++; }); return n + api.dailyMissions().concat(api.weeklyMissions()).filter((m) => m.done && !m.claimed).length; },

      // ---- owned cosmetics + equip
      owned(type) {
        const base = { title: ['default'], frame: ['default'], arena: ['default'], fx: ['default'], avatar: [] }[type].slice();
        ['free', 'premium'].forEach((t) => st.claimed[t].forEach((l) => { const r = api.reward(l, t); if (r && r.type === type && !base.includes(r.id)) base.push(r.id); }));
        if (extraOwned) (extraOwned(type) || []).forEach((id) => { if (!base.includes(id)) base.push(id); });   // e.g. album rewards
        return base;
      },
      equipped: (type) => st.equip[type],
      equip(type, id) { if (id !== null && !api.owned(type).includes(id)) return false; st.equip[type] = id; save(); return true; },
      prepBonus() { let s = 0; ['free', 'premium'].forEach((t) => st.claimed[t].forEach((l) => { const r = api.reward(l, t); if (r && r.type === 'perk') s += r.sec; })); return s; },
    };
    return api;
  }

  /** connect a pass to the game event bus so missions count upgrades, packs, campaign fights and stars */
  function wire(pass, events) {
    events.on('cardUpgraded', () => pass.track('upgrades', 1));
    events.on('packOpened', () => pass.track('packs', 1));
    events.on('towerEnd', (r) => {   // tower fights count as fights won / matches; each new floor counts toward "climb 2 floors"
      if (r.summary) pass.recordStats(Object.assign({}, r.summary, { won: r.won }));
      if (r.first) pass.track('tower_floors', 1);
    });
    events.on('eventEnd', (r) => {   // weekly-event fights count as fights won; finishing the event counts for the weekly mission
      if (r.summary) pass.recordStats(Object.assign({}, r.summary, { won: r.won }));
      if (r.completed) pass.track('event_cleared', 1);
    });
    events.on('fightEnd', (r) => {
      if (r.summary) pass.recordStats(Object.assign({}, r.summary, { won: r.won }));
      pass.track('campaign', 1);
      if (r.newBest) pass.track('stars', r.stars - (r.prevStars || 0));
    });
  }

  AMB.Pass = { create, wire, KEY, SEASON, COSMETICS, FREE, PREMIUM, DAILY, WEEKLY, dayKey, weekKey, rewardName };
})();
