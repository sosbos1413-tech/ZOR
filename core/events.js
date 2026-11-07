/*
 * Weekly event: a limited-time special level with a boss of one world; clearing it gives a card that cannot
 * come from packs. The event changes every week (Monday to Sunday, local time) and cycles through EVENTS,
 * so a missed one comes back after 4 weeks. Rewards are paid once per week's occurrence; an event's
 * exclusive card stays yours after the week ends. Settings: AMB.ECONOMY.events.
 */
(function () {
  const AMB = globalThis.AMB;
  const E = () => AMB.ECONOMY.events;
  const DAY = 864e5;

  // the rotation (order = week order). `exclusive` = a unit flagged exclusive in core/data.js.
  const EVENTS = [
    { id: 'ember', world: 'ember', name: 'عاصفة الجمر', exclusive: 'hinotori',
      boss: { name: 'سيّد الجمر المشتعل', text: 'وحدات الزعيم +30% هجوم و+10% صحة، ويستخدم «أمر الهجوم» و«نيزك الجمر» كل جولة.', blessings: { atkPct: 0.3, hpPct: 0.1 }, abilities: ['inferno_banner', 'meteor'] } },
    { id: 'tide', world: 'tide', name: 'مدّ القمر الأسود', exclusive: 'mikazuki',
      boss: { name: 'حارس المدّ الأبدي', text: 'وحدات الزعيم +30% صحة و+10% سرعة هجوم، ويستخدم «حاجز المدّ» و«ينبوع القمر» كل جولة.', blessings: { hpPct: 0.3, asPct: 0.1 }, abilities: ['tidal_ward', 'moon_spring'] } },
    { id: 'neon', world: 'neon', name: 'انقطاع نيون', exclusive: 'kaminari',
      boss: { name: 'عقل الشبكة المتمرّد', text: 'وحدات الزعيم +30% سرعة هجوم و+10% هجوم، ويستخدم «كسر السرعة» و«انهيار النظام» كل جولة.', blessings: { asPct: 0.3, atkPct: 0.1 }, abilities: ['overclock', 'system_crash'] } },
    { id: 'sylvan', world: 'sylvan', name: 'غضب الغابة', exclusive: 'kodama',
      boss: { name: 'قلب الغابة الأزلي', text: 'وحدات الزعيم +30% صحة و+10% هجوم، ويستخدم «جدار الأشواك» و«قيد الجذور» كل جولة.', blessings: { hpPct: 0.3, atkPct: 0.1 }, abilities: ['thorn_wall', 'rootbind'] } },
  ];

  AMB.Save.register('events', { version: 1, defaults: () => ({ weeks: {} }) });   // weeks[idx] = { stage: stages cleared 0..3, got: exclusive card given }

  const dayNum = (t) => { const d = new Date(t); return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / DAY); };   // local calendar day number
  const baseDay = () => { const [y, m, d] = E().epoch; return Math.floor(Date.UTC(y, m, d) / DAY); };
  const weekIndex = (t) => Math.floor((dayNum(t) - baseDay()) / 7);
  const eventOfWeek = (idx) => EVENTS[((idx % EVENTS.length) + EVENTS.length) % EVENTS.length];
  /** local midnight that ends the week containing t (next Monday 00:00) */
  function weekEnd(t) { const d = new Date(t), dow = (d.getDay() + 6) % 7; return new Date(d.getFullYear(), d.getMonth(), d.getDate() + (7 - dow)).getTime(); }

  function Events(save, deps) {
    deps = deps || {};
    const now = deps.now || (() => Date.now());
    const st = () => save.get('events');
    const rec = (idx) => st().weeks[idx] || { stage: 0, got: false };
    const api = {
      EVENTS, weekIndex, eventOfWeek,
      unlocked: () => !deps.campaign || deps.campaign.levelDone(E().unlock.campaignLevel),
      /** this week's event: { idx, event, endsAt, msLeft, stage (cleared 0..3), done } */
      current() {
        const t = now(), idx = weekIndex(t), ev = eventOfWeek(idx), r = rec(idx);
        return { idx, event: ev, endsAt: weekEnd(t), msLeft: weekEnd(t) - t, stage: r.stage, done: r.stage >= 3, got: r.got };
      },
      nextEvent() { return eventOfWeek(weekIndex(now()) + 1); },
      stageCount: () => E().stages.length,
      lineupFor(eventId, stage) {
        const ev = EVENTS.find((x) => x.id === eventId), order = EVENTS.indexOf(ev), S = E().stages[stage - 1];
        return AMB.Tower.generate({ n: S.n, seed: 91000 + order * 100 + stage, boss: !!S.boss, world: ev.world, special: S.boss ? ev.boss : null,
          name: S.boss ? `${ev.boss.name}` : `${ev.name} · المرحلة ${stage}` });
      },
      powerFor: (eventId, stage) => E().power[eventId][stage - 1],
      startFor: (stage) => E().start[stage - 1],
      rewardsFor: (stage) => E().rewards[stage - 1],
      canPlay(stage) { const c = api.current(); return api.unlocked() && stage >= 1 && stage <= Math.min(api.stageCount(), c.stage + 1); },
      /** options for new AMB.Match(...); `idx` (the week) is returned so the result is credited to the week the fight started in */
      matchOptions(stage, heroId, seed) {
        const c = api.current(), L = api.lineupFor(c.event.id, stage), C = deps.collection, power = api.powerFor(c.event.id, stage);
        const enemyPower = {}; L.units.forEach(([id]) => (enemyPower[id] = power)); enemyPower[L.heroId] = power;
        return {
          mode: 'event', seed, progression: true, eventWeek: c.idx,
          rules: Object.assign({}, AMB.LEVELS.CAMPAIGN.rules, { start: api.startFor(stage) }),
          players: [
            { heroId, name: 'أنت', cardPower: C ? C.powerMap() : null, allowedUnits: C ? C.playableUnits() : null, heroLevel: (globalThis.AMB.heroes ? AMB.heroes.level(heroId) : 1) },
            { heroId: L.heroId, name: L.name, isAI: true, cardPower: enemyPower, lineup: { units: L.units, summon: L.summon, blessings: L.blessings, abilities: L.abilities } },
          ],
        };
      },
      /** record a finished stage fight for the week `idx` it started in (default: this week) */
      recordResult(stage, res, idx) {
        if (idx == null) idx = weekIndex(now());
        const ev = eventOfWeek(idx), before = rec(idx), won = !!res.won;
        const first = won && stage === before.stage + 1;
        const out = { week: idx, event: ev.id, stage, won, first, shards: 0, passXp: 0, pack: null, card: null, completed: false, cardIsNew: false };
        save.update('events', (s) => {
          const w = s.weeks[idx] = s.weeks[idx] || { stage: 0, got: false };
          if (first) w.stage = stage;
        });
        if (first) {
          const pay = rewardsFor(stage);
          if (deps.wallet && pay.shards) { deps.wallet.add('shards', pay.shards, 'event'); out.shards = pay.shards; }
          if (deps.addPassXp && pay.passXp) { deps.addPassXp(pay.passXp); out.passXp = pay.passXp; }
          if (pay.pack && deps.packs) out.pack = deps.packs.open(pay.pack, { free: true });
          if (pay.exclusive && deps.collection) {
            const r = deps.collection.add(ev.exclusive, 1);
            out.card = { id: ev.exclusive, rarity: deps.collection.rarity(ev.exclusive), isNew: r.isNew }; out.cardIsNew = r.isNew; out.completed = true;
            save.update('events', (s) => { s.weeks[idx].got = true; });
          }
        }
        if (deps.events) deps.events.emit('eventEnd', Object.assign({}, out, { summary: res }));
        return out;
      },
    };
    const rewardsFor = (stage) => E().rewards[stage - 1];
    return api;
  }

  AMB.WeeklyEvents = Events;
  AMB.WEEKLY = EVENTS;
})();
