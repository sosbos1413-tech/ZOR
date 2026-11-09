/*
 * Player profile bootstrap: one save, one event bus, one wallet shared by
 * every progression system. In the browser it runs once on load and exposes
 * AMB.save / AMB.events / AMB.wallet. Tests call AMB.Profile.boot(memoryStorage).
 */
(function () {
  const AMB = globalThis.AMB;
  // player settings that travel with the save (export/import): big-text mode, combat speed, one-time hints already shown
  AMB.Save.register('settings', { version: 1, defaults: () => ({ bigText: false, speed: 0, seen: {}, fold: {} }) });
  const SPEEDS = [1, 2, 4];
  function Settings(save) {
    const st = () => save.get('settings');
    return {
      bigText: () => !!st().bigText,
      setBigText(on) { save.update('settings', (s) => { s.bigText = !!on; }); return !!on; },
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
    return { save, events, wallet, collection, packs, campaign, login, album, tower, weekly, tutorial, heroes, settings };
  }
  AMB.Profile = { boot };
  if (typeof document !== 'undefined' && !AMB.save) {
    const p = boot();
    AMB.save = p.save; AMB.events = p.events; AMB.wallet = p.wallet; AMB.collection = p.collection; AMB.packs = p.packs; AMB.campaign = p.campaign; AMB.login = p.login; AMB.album = p.album; AMB.tower = p.tower; AMB.weekly = p.weekly; AMB.tutorial = p.tutorial; AMB.settings = p.settings;
  }
})();
