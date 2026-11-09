/*
 * Guided first match ("التدريب"): 3 short rounds against a fixed, weak enemy with a scripted shop, so a new player learns
 * buy -> place (front/back) -> ready -> merge -> refresh by DOING each move. Mandatory for brand-new players (they get a
 * reward once). The step-by-step guide itself is ui/tutorial-ui.js; this file holds the match, the scripted shop and the reward.
 */
(function () {
  const AMB = globalThis.AMB;
  const T = () => AMB.ECONOMY.tutorial;

  AMB.Save.register('tutorial', { version: 1, defaults: () => ({ done: false, rewarded: false, plays: 0 }) });

  // the shop of each round is fixed (round 2 has three copies of one unit so a merge to a star is guaranteed)
  const SHOP = { 1: ['forge_bulwark', 'ash_ronin', 'pixel_sniper', 'wave_caller', 'grid_hound'], 2: ['ash_ronin', 'ash_ronin', 'ash_ronin', 'thorn_fox', 'moss_warden'], 3: ['thorn_fox', 'moss_warden', 'pixel_sniper', 'wave_caller', 'grid_hound'] };

  /**
   * Practice fight ("جرّب"): try a hero before it is yours. A short best-of-3 against an easy computer, any hero allowed,
   * no card levels and no hero level. The UI runs it as mode 'practice' and saves nothing from it (no rewards, XP, stats, pass).
   */
  function practiceOptions(heroId, seed) {
    const s = seed || 1 + Math.floor(Math.random() * 2 ** 30);
    const others = Object.keys(AMB.DATA.HEROES).filter((h) => h !== heroId);
    return {
      mode: 'practice', practice: true, seed: s, progression: false,
      rules: { maxRounds: 3, winsNeeded: 2, start: T().start },
      players: [{ heroId, name: 'أنت' }, { heroId: others[s % others.length], name: 'تدريب', isAI: true, aiStyle: 'balanced', difficulty: 'easy' }],
    };
  }

  function Tutorial(save, deps) {
    deps = deps || {};
    const st = () => save.get('tutorial');
    const api = {
      SHOP, practiceOptions,
      done: () => !!st().done,
      rewarded: () => !!st().rewarded,
      /** a brand-new player must do it: nothing cleared in the campaign yet and the tutorial not finished */
      required() { return !st().done && !(deps.campaign && deps.campaign.isCleared('l1f1')); },
      /** options for new AMB.Match(...) */
      matchOptions(heroId, seed) {
        const enemyHero = heroId === 'merin' ? 'zerokai' : 'merin';
        return {
          mode: 'tutorial', seed: seed || 4242, progression: false,
          rules: { maxRounds: 3, winsNeeded: 3, start: T().start },   // always three rounds: the third teaches levelling up and sending the hero
          players: [{ heroId, name: 'أنت' },
            { heroId: enemyHero, name: '', isAI: true, lineup: { units: T().enemy, summon: null, blessings: { atkPct: -0.15, hpPct: -0.15, asPct: 0 }, abilities: [] } }],
        };
      },
      /** put the scripted shop in place (call right after match.startRound()) */
      onRound(match) {
        const p = match.players[0], s = SHOP[match.round];
        if (s) { p.shop = s.slice(); p.itemShop = []; p.shopLocked = false; }
      },
      /** finish: marks done, pays the reward once. Returns { shards, first } */
      complete() {
        const first = !st().rewarded;
        save.update('tutorial', (s) => { s.done = true; s.plays++; s.rewarded = true; });
        let shards = 0;
        if (first && deps.wallet && T().reward.shards) { deps.wallet.add('shards', T().reward.shards, 'tutorial'); shards = T().reward.shards; }
        if (deps.events) deps.events.emit('tutorialDone', { first, shards });
        return { shards, first };
      },
      /** skip without finishing (replays only): no reward */
      markSeen() { save.update('tutorial', (s) => { s.done = true; }); },
    };
    return api;
  }
  Tutorial.practiceOptions = practiceOptions;
  AMB.Tutorial = Tutorial;
})();
