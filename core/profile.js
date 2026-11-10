/*
 * Player profile bootstrap: one save, one event bus, one wallet shared by
 * every progression system. In the browser it runs once on load and exposes
 * AMB.save / AMB.events / AMB.wallet. Tests call AMB.Profile.boot(memoryStorage).
 */
(function () {
  const AMB = globalThis.AMB;
  // player settings that travel with the save (export/import): big-text mode, combat speed, one-time hints already shown
  // comfort options (senior #31-33, #38): textSize 0/1/2, timer 'normal' | 'x2' | 'off' (vs the computer only), motion, vibration, sound volumes
  AMB.Save.register('settings', { version: 1, defaults: () => ({ bigText: false, speed: 0, seen: {}, fold: {}, textSize: 0, timer: 'normal', motion: true, vibe: true, sfx: 1, music: 1 }) });
  // adult #24/#30: small daily-capped rewards for quick matches and friend matches
  AMB.Save.register('dayPay', { version: 1, defaults: () => ({ day: '', qm: 0, online: 0 }) });
  const QM = { win: 10, loss: 5, cap: 60 }, ONLINE_XP_GAMES = 3;
  function DayPay(save, wallet, nowFn) {
    const today = () => { const d = new Date(nowFn ? nowFn() : Date.now()); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); };
    const fresh = () => { if (save.get('dayPay').day !== today()) save.update('dayPay', (s) => { s.day = today(); s.qm = 0; s.online = 0; }); return save.get('dayPay'); };
    return {
      QM, ONLINE_XP_GAMES,
      /** shards for a finished quick match vs the computer (not friendly): +10 win / +5 loss, at most 60 a day. Returns the amount paid. */
      quickMatch(won) { const st = fresh(), n = Math.max(0, Math.min(won ? QM.win : QM.loss, QM.cap - st.qm)); if (!n) return 0; save.update('dayPay', (s) => { s.qm += n; }); if (wallet) wallet.add('shards', n, 'quickMatch'); return n; },
      quickLeft() { return Math.max(0, QM.cap - fresh().qm); },
      /** the first 3 friend matches of the day give normal pass XP (never shards) */
      onlineCounts() { const st = fresh(); if (st.online >= ONLINE_XP_GAMES) return false; save.update('dayPay', (s) => { s.online++; }); return true; },
    };
  }
  AMB.DayPay = DayPay;
  const SPEEDS = [1, 2, 4];
  function Settings(save) {
    const st = () => save.get('settings');
    return {
      bigText: () => !!st().bigText || (st().textSize || 0) > 0,
      setBigText(on) { save.update('settings', (s) => { s.bigText = !!on; s.textSize = on ? Math.max(1, s.textSize || 0) : 0; }); return !!on; },
      textSize: () => Math.max(0, Math.min(2, st().textSize || (st().bigText ? 1 : 0))),
      setTextSize(v) { v = Math.max(0, Math.min(2, +v || 0)); save.update('settings', (s) => { s.textSize = v; s.bigText = v > 0; }); return v; },
      get: (k) => st()[k],
      set(k, v) { if (!['timer', 'motion', 'vibe', 'sfx', 'music'].includes(k)) return false; save.update('settings', (s) => { s[k] = v; }); return true; },
      /** combat speed: the last one the player picked; a new player starts at 1x */
      speed: () => (SPEEDS.includes(st().speed) ? st().speed : 1),
      setSpeed(v) { v = +v; if (!SPEEDS.includes(v)) return false; if (st().speed !== v) save.update('settings', (s) => { s.speed = v; }); return true; },
      /** one-time hints: seen(k) is false until markSeen(k) */
      seen: (k) => !!st().seen[k],
      markSeen(k) { if (!st().seen[k]) save.update('settings', (s) => { s.seen[k] = true; }); },
      /** folded (collapsed) sections; `dflt` is used until the player toggles that section once */
      folded: (k, dflt) => (k in st().fold ? !!st().fold[k] : !!dflt),
      setFolded(k, on) { save.update('settings', (s) => { s.fold[k] = !!on; }); },
    };
  }
  AMB.Settings = Settings;
  function boot(storage, nowFn, rng) {
    const save = AMB.Save.create(storage, nowFn);
    const events = AMB.Events();
    const wallet = AMB.Wallet(save, events);
    const collection = AMB.Collection(save, events);
    const heroes = AMB.HeroProg(save, events);
    AMB.heroes = heroes;   // the progression fights read the hero level from here
    const packs = AMB.Packs(save, wallet, collection, events, rng);
    // battle-pass XP from campaign rewards goes to the pass instance (created by the pass UI in the browser)
    const campaign = AMB.Campaign(save, { wallet, packs, collection, events, addPassXp: (n) => AMB.pass && AMB.pass.addXp(n) });
    const login = AMB.Login(save, { wallet, packs, collection, events, now: nowFn });
    const album = AMB.Album(save, { wallet, packs, collection, events });
    const tower = AMB.Tower(save, { wallet, packs, collection, events, campaign, addPassXp: (n) => AMB.pass && AMB.pass.addXp(n) });
    const weekly = AMB.WeeklyEvents(save, { wallet, packs, collection, events, campaign, now: nowFn, addPassXp: (n) => AMB.pass && AMB.pass.addXp(n) });
    const tutorial = AMB.Tutorial(save, { wallet, campaign, events });
    const settings = Settings(save);
    const dayPay = DayPay(save, wallet, nowFn);
    return { save, events, wallet, collection, packs, campaign, login, album, tower, weekly, tutorial, heroes, settings, dayPay };
  }
  /**
   * A one-time reset for everyone: when RESET_ID changes, every browser starts as a brand-new player on its next visit.
   * The old save is NOT deleted: it is moved to 'zor_before_reset' (the daily backups and resume data are dropped), so it can be brought back by hand.
   * Returns true when a reset happened.
   */
  const RESET_ID = 'fresh-2026-11-10';
  function resetOnce(storage, id) {
    id = id || RESET_ID;
    try {
      if (!storage || storage.__mem || storage.getItem('zor_reset_id') === id) return false;
      const main = storage.getItem(AMB.Save.KEY);
      if (main) storage.setItem('zor_before_reset', main);   // kept, never read by the game
      [AMB.Save.KEY, AMB.Save.KEY + '_bak', AMB.Save.KEY + '_preimport', AMB.Save.KEY + '_corrupt', AMB.Save.KEY + '_prerestore', 'amb_pass_v1', 'zor_resume_v1', 'amb_played', 'amb_tut', 'amb_telemetry_v1'].forEach((k) => storage.removeItem(k));
      Object.keys(storage).filter((k) => /^amb_(telemetry|tele)/.test(k)).forEach((k) => storage.removeItem(k));
      storage.setItem('zor_reset_id', id);
      return !!main;
    } catch (e) { return false; }
  }
  AMB.Profile = { boot, resetOnce, RESET_ID };
  if (typeof document !== 'undefined' && !AMB.save) {
    try { AMB.didReset = resetOnce(AMB.Save.browserStorage()); } catch (e) { AMB.didReset = false; }   // before anything reads the save
    const p = boot();
    AMB.save = p.save; AMB.events = p.events; AMB.wallet = p.wallet; AMB.collection = p.collection; AMB.packs = p.packs; AMB.campaign = p.campaign; AMB.login = p.login; AMB.album = p.album; AMB.tower = p.tower; AMB.weekly = p.weekly; AMB.tutorial = p.tutorial; AMB.settings = p.settings; AMB.dayPay = p.dayPay;
  }
})();
