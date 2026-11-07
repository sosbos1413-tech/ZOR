/*
 * Player profile bootstrap: one save, one event bus, one wallet shared by
 * every progression system. In the browser it runs once on load and exposes
 * AMB.save / AMB.events / AMB.wallet. Tests call AMB.Profile.boot(memoryStorage).
 */
(function () {
  const AMB = globalThis.AMB;
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
    return { save, events, wallet, collection, packs, campaign, login, album, tower, weekly, tutorial, heroes };
  }
  AMB.Profile = { boot };
  if (typeof document !== 'undefined' && !AMB.save) {
    const p = boot();
    AMB.save = p.save; AMB.events = p.events; AMB.wallet = p.wallet; AMB.collection = p.collection; AMB.packs = p.packs; AMB.campaign = p.campaign; AMB.login = p.login; AMB.album = p.album; AMB.tower = p.tower; AMB.weekly = p.weekly; AMB.tutorial = p.tutorial;
  }
})();
