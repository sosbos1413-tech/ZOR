/*
 * Match state machine + economy. UI-independent: the browser UI, the AI and
 * the headless simulator all drive a Match through the same methods.
 *
 * Round phases: resources -> shop -> formation -> combat -> result
 * (shop and formation share one prep timer; the UI shows both steps.)
 */
(function () {
  const AMB = (globalThis.AMB = globalThis.AMB || {});
  const SLOTS = ['f0', 'f1', 'f2', 'f3', 'b0', 'b1', 'b2', 'b3'];

  function newPlayer(i, opts) {
    const E = AMB.CONFIG.economy;
    const hero = AMB.DATA.HEROES[opts.heroId];
    return {
      index: i, name: opts.name || `لاعب ${i + 1}`, heroId: hero.id, isAI: !!opts.isAI,
      aiStyle: opts.aiStyle || 'balanced', difficulty: opts.difficulty || 'normal',
      life: AMB.CONFIG.match.heroLife + Math.max(0, (opts.heroLevel || 1) - 1) * (AMB.CONFIG.match.heroLifePerLevel || 0), maxLife: AMB.CONFIG.match.heroLife + Math.max(0, (opts.heroLevel || 1) - 1) * (AMB.CONFIG.match.heroLifePerLevel || 0),
      gold: 0, xp: 0, level: E.startLevel, essence: E.essenceStart,
      bench: new Array(E.benchSize).fill(null),
      board: {},            // slot -> unit
      items: [],            // owned item ids (equipment not yet equipped + unarmed spells)
      armedSpells: [],
      abilities: {},        // abilityId -> trigger
      summoned: false, heroSlot: 'b1',
      shop: [], itemShop: [], shopLocked: false, freeRerolls: 0,
      winStreak: 0, lossStreak: 0, lastWon: false, lastIncome: null,
      stats: { damageDealt: 0, goldSpent: 0, rerolls: 0, unitsBought: 0, merges: 0, wins: 0, losses: 0, draws: 0 },
      alive: true,
      blessings: { atkPct: 0, hpPct: 0, asPct: 0 }, rewardOffer: null, rewardLog: [],
      lineup: opts.lineup || null,   // scripted enemy (campaign): { units:[[defId,star,slot,fromRound]], summon, blessings, abilities }
      cardPower: opts.cardPower || null,
      heroLevel: opts.heroLevel || 1,     // hero level from the profile (progression fights only)   // { defId: mult } from the collection — progression fights only
      allowed: opts.allowedUnits ? new Set(opts.allowedUnits) : null,   // units this player owns — progression fights only
    };
  }

  class Match {
    constructor(opts) {
      this.mode = opts.mode || 'ai';
      this.seed = opts.seed || Math.floor(Math.random() * 2 ** 31);
      this.rng = AMB.util.RNG(this.seed);
      // card levels/rarity and hero level count in every mode that passes them (campaign, tower, events, quick vs AI, online); same-device (hotseat) passes none, so it stays even. The deck limit is progression-only.
      this.progression = !!opts.progression;
      this.rules = opts.rules || null;   // short-match rules (campaign): { maxRounds, winsNeeded, start: { gold, level } }
      this.players = opts.players.map((p, i) => newPlayer(i, this.progression ? p : Object.assign({}, p, { allowedUnits: null })));
      // online play: each player has their OWN random stream, unit pool and unit ids, so both phones can replay each other's moves and stay identical
      this.isolated = !!opts.isolated;
      this.round = 0;
      this.phase = 'idle';
      this.pool = {};
      Object.values(AMB.DATA.UNITS).forEach((u) => (this.pool[u.id] = AMB.CONFIG.economy.poolSize[u.tier]));
      if (this.isolated) this.players.forEach((p, i) => { p.rng = AMB.util.RNG(this.seed * 7 + i * 7919 + 13); p.pool = Object.assign({}, this.pool); p.uidN = 0; });
      this.history = [];       // per-round reports
      this.scout = [null, null]; // last board each player fought with
      this.winner = undefined;
      this.startedAt = Date.now();
      this.log = [];
    }

    _rng(p) { return this.isolated ? p.rng : this.rng; }
    _pool(p) { return this.isolated ? p.pool : this.pool; }
    _uid(p) { return this.isolated ? 'u' + p.index + '_' + (++p.uidN) : AMB.util.uid('u'); }

    // ================================================================ round flow
    startRound() {
      const E = AMB.CONFIG.economy;
      if (this.rewardPending && AMB.AI && AMB.AI.claimRewards) AMB.AI.claimRewards(this);   // never leave a draft open
      this.round++;
      this.phase = 'resources';
      // short-match start gold/level go in BEFORE the first shop is rolled (the first shop used to be rolled at level 3 whatever the start level was)
      if (this.rules && this.round === 1) this.players.forEach((p) => { const st = this.rules.start; if (!p.lineup && st) { p.gold += st.gold || 0; p.level = Math.max(p.level, st.level || 0); } });
      this.players.forEach((p) => {
        const interest = Math.min(E.interestMax, Math.floor(p.gold / E.interestPer));
        const streak = Math.max(p.winStreak, p.lossStreak);
        let streakBonus = 0;
        E.streakBonus.forEach(([n, b]) => { if (streak >= n) streakBonus = b; });
        const win = this.round > 1 && p.lastWon ? E.winBonus : 0;   // the win bonus is for WINNING the last round (a drawn round does not pay it)
        const dataStream = AMB.DATA.HEROES[p.heroId].passive.id === 'data_stream' ? 1 : 0;   // Nayako: +1 gold every round
        const income = (this.round === 1 ? E.baseIncome : E.baseIncome + interest + streakBonus + win) + dataStream;
        p.lastIncome = { base: E.baseIncome, interest: this.round === 1 ? 0 : interest, streak: this.round === 1 ? 0 : streakBonus, win, total: income };
        p.gold += income;
        if (this.round > 1) this._gainXp(p, E.xpPerRound);
        const essGain = E.essencePerRound + (AMB.DATA.HEROES[p.heroId].passive.id === 'deep_reserve' ? 1 : 0);
        if (this.round > 1) p.essence = Math.max(p.essence, Math.min(E.essenceMax, p.essence + essGain));   // a 'pure essence' reward above the cap is kept (never clamped away)
        p.freeRerolls = AMB.DATA.HEROES[p.heroId].passive.id === 'free_reroll' ? 1 : 0;
        if (!p.shopLocked || !p.shop.length) this._rollShop(p);
        p.shopLocked = false;
        this._validateAbilities(p);
      });
      this.players.forEach((p, i) => { if (p.lineup) this.applyLineup(i); });
      this.phase = 'prep';
    }

    // ================================================================ economy
    /** put items into the bag; the bag holds itemBenchSize (6): the rest turns into gold (+3 each, like the 'item' reward) so the limit can never be bypassed */
    _stash(p, items) { const cap = AMB.CONFIG.economy.itemBenchSize; items.forEach((it) => { if (p.items.length < cap) p.items.push(it); else p.gold += 3; }); }
    xpNeeded(p) { return AMB.CONFIG.economy.xpToLevel[Math.max(3, p.level)] || null; }   // levels 1-2 (scripted line-ups) use the level-3 cost; null never means "free level-up"
    _gainXp(p, n) {
      const E = AMB.CONFIG.economy;
      if (p.level >= E.maxLevel) return;
      p.xp += n;
      while (p.level < E.maxLevel && this.xpNeeded(p) != null && p.xp >= this.xpNeeded(p)) { p.xp -= this.xpNeeded(p); p.level++; }
      if (p.level >= E.maxLevel) p.xp = 0;
    }

    _drawUnit(p) {
      const odds = AMB.CONFIG.economy.tierOdds[Math.max(3, p.level)];
      const tier = this._rng(p).weighted(odds.map((w, i) => [i + 1, w]).filter((e) => e[1] > 0));
      const mine = (u) => !p.allowed || p.allowed.has(u.id);   // progression: only units the player owns
      let entries = Object.values(AMB.DATA.UNITS).filter((u) => u.tier === tier && mine(u)).map((u) => [u.id, this._pool(p)[u.id]]);
      let pick = this._rng(p).weighted(entries);
      if (!pick) { // tier exhausted (or none owned in it): fall back to any available unit you own
        entries = Object.values(AMB.DATA.UNITS).filter(mine).map((u) => [u.id, this._pool(p)[u.id]]);
        pick = this._rng(p).weighted(entries);
      }
      return pick;
    }

    _rollShop(p) {
      const E = AMB.CONFIG.economy;
      p.shop = [];
      for (let i = 0; i < E.shopSlots; i++) p.shop.push(this._drawUnit(p));
      const items = Object.keys(AMB.DATA.ITEMS);
      p.itemShop = [];
      for (let i = 0; i < E.itemShopSlots; i++) p.itemShop.push(this._rng(p).pick(items));
    }

    reroll(pi) {
      const p = this.players[pi];
      const cost = AMB.CONFIG.economy.rerollCost;
      if (p.freeRerolls > 0) p.freeRerolls--;
      else if (p.gold < cost) return this._fail('ما عندك ذهب يكفي للتحديث');
      else { p.gold -= cost; p.stats.goldSpent += cost; }
      p.stats.rerolls++;
      this._rollShop(p);
      return { ok: true };
    }

    buyXp(pi) {
      const p = this.players[pi];
      const E = AMB.CONFIG.economy;
      if (p.level >= E.maxLevel) return this._fail('وصلت لأعلى مستوى');
      if (p.gold < E.xpCost) return this._fail('ما عندك ذهب يكفي');
      p.gold -= E.xpCost; p.stats.goldSpent += E.xpCost;
      this._gainXp(p, E.xpPerBuy);
      return { ok: true };
    }

    toggleLock(pi) { const p = this.players[pi]; p.shopLocked = !p.shopLocked; return { ok: true }; }

    allUnits(p) {
      return [...p.bench.filter(Boolean), ...Object.values(p.board)];
    }
    boardUnits(p) { return Object.values(p.board); }
    boardCount(p) { return Object.keys(p.board).length; }

    canBuy(pi, shopIdx) {
      const p = this.players[pi];
      const defId = p.shop[shopIdx];
      if (!defId) return { ok: false, reason: 'فارغ' };
      const def = AMB.DATA.UNITS[defId];
      if (p.gold < def.cost) return { ok: false, reason: 'ما عندك ذهب يكفي' };
      if (this._pool(p)[defId] <= 0) return { ok: false, reason: 'خلصت نسخ هالوحدة من المخزون' };
      const benchFree = p.bench.indexOf(null) >= 0;
      if (!benchFree) {
        const same = this.allUnits(p).filter((u) => u.defId === defId && u.star === 1).length;
        if (same < AMB.CONFIG.stars.copiesPerStar - 1) return { ok: false, reason: 'الاحتياط ممتلئ' };
      }
      return { ok: true };
    }

    buy(pi, shopIdx) {
      const chk = this.canBuy(pi, shopIdx);
      if (!chk.ok) return this._fail(chk.reason);
      const p = this.players[pi];
      const defId = p.shop[shopIdx];
      const def = AMB.DATA.UNITS[defId];
      p.gold -= def.cost; p.stats.goldSpent += def.cost; p.stats.unitsBought++;
      this._pool(p)[defId]--;
      p.shop[shopIdx] = null;
      const unit = { uid: this._uid(p), defId, star: 1, items: [] };
      const idx = p.bench.indexOf(null);
      if (idx >= 0) p.bench[idx] = unit;
      else p._overflow = unit; // will merge immediately
      const merged = this._merge(p, unit);
      return { ok: true, unit, merged };
    }

    /** Merge 3 copies of the same unit+star into one higher star unit (recursive). */
    _merge(p, newUnit) {
      const S = AMB.CONFIG.stars;
      const merges = [];
      let check = newUnit;
      while (check && check.star < S.maxStar) {
        const list = this.allUnits(p).filter((u) => u.defId === check.defId && u.star === check.star);
        if (p._overflow && p._overflow.defId === check.defId && p._overflow.star === check.star && !list.includes(p._overflow)) list.push(p._overflow);
        if (list.length < S.copiesPerStar) break;
        const use = list.slice(0, S.copiesPerStar);
        // keep the position of a board copy if one exists
        const onBoard = use.map((u) => this._locate(p, u)).find((l) => l && l.zone === 'board');
        const keepLoc = onBoard || use.map((u) => this._locate(p, u)).find((l) => l) || null;
        const items = [];
        use.forEach((u) => { items.push(...u.items); this._remove(p, u); });
        if (p._overflow && use.includes(p._overflow)) p._overflow = null;
        const up = { uid: this._uid(p), defId: check.defId, star: check.star + 1, items: [] };
        const maxI = AMB.CONFIG.economy.maxItemsPerUnit;
        items.forEach((it) => (up.items.length < maxI ? up.items.push(it) : this._stash(p, [it])));
        if (keepLoc && keepLoc.zone === 'board') p.board[keepLoc.slot] = up;
        else {
          const bi = keepLoc && keepLoc.zone === 'bench' ? keepLoc.idx : p.bench.indexOf(null);
          if (bi >= 0) p.bench[bi] = up; else this._placeAnywhere(p, up);
        }
        merges.push(up); p.stats.merges++;
        check = up;
      }
      if (p._overflow) { // could not merge after all — refund
        p.gold += AMB.DATA.UNITS[p._overflow.defId].cost; this._pool(p)[p._overflow.defId]++; p._overflow = null;
      }
      return merges;
    }

    _placeAnywhere(p, u) {
      const bi = p.bench.indexOf(null);
      if (bi >= 0) { p.bench[bi] = u; return; }
      const slot = SLOTS.find((s) => !p.board[s] && !(p.summoned && p.heroSlot === s));
      if (slot) p.board[slot] = u;
    }

    _locate(p, u) {
      const bi = p.bench.indexOf(u);
      if (bi >= 0) return { zone: 'bench', idx: bi };
      for (const s of SLOTS) if (p.board[s] === u) return { zone: 'board', slot: s };
      return null;
    }
    _remove(p, u) {
      const loc = this._locate(p, u);
      if (!loc) return;
      if (loc.zone === 'bench') p.bench[loc.idx] = null; else delete p.board[loc.slot];
    }
    findUnit(p, uid) { return this.allUnits(p).find((u) => u.uid === uid) || null; }

    copiesOf(u) { return Math.pow(AMB.CONFIG.stars.copiesPerStar, u.star - 1); }
    sellValue(u) { return Math.round(AMB.DATA.UNITS[u.defId].cost * this.copiesOf(u) * AMB.CONFIG.economy.sellRefund); }

    sell(pi, uid) {
      const p = this.players[pi];
      const u = this.findUnit(p, uid);
      if (!u) return this._fail('ما لقيت الوحدة');
      this._remove(p, u);
      p.gold += this.sellValue(u);
      this._pool(p)[u.defId] += this.copiesOf(u);
      this._stash(p, u.items);
      return { ok: true };
    }

    /** dest: {zone:'bench', idx} | {zone:'board', slot} — swaps if occupied. */
    move(pi, uid, dest) {
      // a friend's move arrives over the network: reject any destination the UI could never send (unknown slot, bench index out of range)
      if (!dest || typeof dest !== 'object') return this._fail('وجهة غلط');
      if (dest.zone === 'board' ? !SLOTS.includes(dest.slot) : dest.zone === 'bench' ? !(Number.isInteger(dest.idx) && dest.idx >= 0 && dest.idx < AMB.CONFIG.economy.benchSize) : true) return this._fail('وجهة غلط');
      const p = this.players[pi];
      const u = this.findUnit(p, uid);
      if (!u) return this._fail('ما لقيت الوحدة');
      const from = this._locate(p, u);
      if (dest.zone === 'board') {
        if (p.summoned && p.heroSlot === dest.slot) {
          if (from.zone !== 'board') return this._fail('البطل واقف في هالخانة');
          p.heroSlot = from.slot; delete p.board[from.slot]; p.board[dest.slot] = u; return { ok: true };
        }
        const other = p.board[dest.slot] || null;
        if (from.zone === 'bench' && !other && this.boardCount(p) >= p.level) return this._fail(`الساحة ممتلئة (${p.level}/${p.level}). بدّل مع وحدة في الساحة، أو بع وحدة، أو ارفع مستواك بزر «خبرة»`);
        this._remove(p, u);
        if (other) { this._remove(p, other); this._put(p, other, from); }
        p.board[dest.slot] = u;
      } else {
        const other = p.bench[dest.idx] || null;
        this._remove(p, u);
        if (other) { p.bench[dest.idx] = null; this._put(p, other, from); }
        p.bench[dest.idx] = u;
      }
      return { ok: true };
    }
    _put(p, u, loc) { if (loc.zone === 'bench') p.bench[loc.idx] = u; else p.board[loc.slot] = u; }

    // ---------------------------------------------------------------- items & spells
    buyItem(pi, idx) {
      const p = this.players[pi];
      const id = p.itemShop[idx];
      if (!id) return this._fail('فارغ');
      const it = AMB.DATA.ITEMS[id];
      if (p.gold < it.cost) return this._fail('ما عندك ذهب يكفي');
      if (p.items.length >= AMB.CONFIG.economy.itemBenchSize) return this._fail('حقيبة المعدات ممتلئة');
      p.gold -= it.cost; p.stats.goldSpent += it.cost;
      p.items.push(id);
      p.itemShop[idx] = null;
      return { ok: true };
    }

    equip(pi, itemIdx, uid) {
      const p = this.players[pi];
      const id = p.items[itemIdx];
      if (!id || AMB.DATA.ITEMS[id].kind !== 'equip') return this._fail('هذي مو معدة تنلبس');
      const u = this.findUnit(p, uid);
      if (!u) return this._fail('اختر وحدة');
      if (u.items.length >= AMB.CONFIG.economy.maxItemsPerUnit) return this._fail('الوحدة ما تشيل معدات زيادة');
      p.items.splice(itemIdx, 1);
      u.items.push(id);
      return { ok: true };
    }

    unequip(pi, uid) {
      const p = this.players[pi];
      const u = this.findUnit(p, uid);
      if (!u || !u.items.length) return this._fail('ما فيه معدات');
      if (p.items.length + u.items.length > AMB.CONFIG.economy.itemBenchSize) return this._fail('الحقيبة ممتلئة');
      p.items.push(...u.items); u.items = [];
      return { ok: true };
    }

    sellItem(pi, itemIdx) {
      const p = this.players[pi];
      const id = p.items[itemIdx];
      if (!id) return this._fail('فارغ');
      p.items.splice(itemIdx, 1);
      p.gold += Math.floor(AMB.DATA.ITEMS[id].cost / 2);
      return { ok: true };
    }

    armSpell(pi, itemIdx) {
      const p = this.players[pi];
      const id = p.items[itemIdx];
      if (!id || AMB.DATA.ITEMS[id].kind !== 'spell') return this._fail('هذي مو تعويذة');
      if (p.armedSpells.length >= AMB.CONFIG.economy.maxArmedSpells) return this._fail('وصلت الحد الأقصى من التعاويذ');
      p.items.splice(itemIdx, 1);
      p.armedSpells.push(id);
      return { ok: true };
    }
    disarmSpell(pi, idx) {
      const p = this.players[pi];
      if (p.items.length >= AMB.CONFIG.economy.itemBenchSize) return this._fail('الحقيبة ممتلئة');
      const [id] = p.armedSpells.splice(idx, 1);
      if (id) p.items.push(id);
      return { ok: true };
    }

    // ---------------------------------------------------------------- hero
    abilityCost(p, ab) {
      const d = p.summoned ? AMB.CONFIG.hero.summonAbilityDiscount + (((AMB.DATA.HEROES[p.heroId] || {}).vanguard || {}).extraDiscount || 0) : 0;
      return Math.max(1, ab.cost - d);
    }
    reservedEssence(p) {
      const hero = AMB.DATA.HEROES[p.heroId];
      return Object.keys(p.abilities).reduce((s, id) => s + this.abilityCost(p, hero.abilities.find((a) => a.id === id)), 0);
    }
    setAbility(pi, abilityId, trigger) {
      const p = this.players[pi];
      const hero = AMB.DATA.HEROES[p.heroId];
      const ab = hero.abilities.find((a) => a.id === abilityId);
      if (!ab) return this._fail('ما أعرف هالقدرة');
      if (!trigger) { delete p.abilities[abilityId]; return { ok: true }; }
      const had = p.abilities[abilityId];
      if (!had) {
        if (this.reservedEssence(p) + this.abilityCost(p, ab) > p.essence) return this._fail('ما عندك جوهر يكفي');
      }
      p.abilities[abilityId] = trigger;
      return { ok: true };
    }
    _validateAbilities(p) {
      while (this.reservedEssence(p) > p.essence) {
        const k = Object.keys(p.abilities).pop();
        delete p.abilities[k];
      }
    }

    toggleSummon(pi, slot) {
      if (slot != null && !SLOTS.includes(slot)) return this._fail('خانة غلط');
      const p = this.players[pi];
      if (p.summoned) { p.summoned = false; this._validateAbilities(p); return { ok: true }; }
      const s = slot || p.heroSlot;
      const target = !p.board[s] ? s : SLOTS.slice().reverse().find((x) => !p.board[x]);
      if (!target) return this._fail('ما فيه خانة فاضية تنزّل فيها البطل');
      p.heroSlot = target;
      p.summoned = true;
      return { ok: true };
    }
    moveHero(pi, slot) {
      if (!SLOTS.includes(slot)) return this._fail('خانة غلط');
      const p = this.players[pi];
      if (!p.summoned) return this._fail('البطل مو في الساحة');
      const other = p.board[slot];
      if (other) { delete p.board[slot]; p.board[p.heroSlot] = other; }
      p.heroSlot = slot;
      return { ok: true };
    }

    /** Smart arrangement: the strongest `level` units on the board, tanks in front, ranged behind, the rest on the bench. */
    autoArrange(pi) {
      const p = this.players[pi], U = AMB.DATA.UNITS, R = AMB.DATA.ROLES;
      const pw = (u) => (AMB.AI && AMB.AI.power ? AMB.AI.power(u) : U[u.defId].tier * AMB.CONFIG.stars.mult[u.star]);
      const all = this.allUnits(p).slice().sort((a, b) => pw(b) - pw(a));
      const want = all.slice(0, p.level);
      let front = want.filter((u) => R[U[u.defId].role].side === 'front');
      let back = want.filter((u) => R[U[u.defId].role].side === 'back');
      const any = want.filter((u) => R[U[u.defId].role].side === 'any');
      any.forEach((u) => (front.length <= back.length ? front : back).push(u));
      if (!front.length && back.length > 1) { back.sort((a, b) => U[b.defId].hp * AMB.CONFIG.stars.mult[b.star] - U[a.defId].hp * AMB.CONFIG.stars.mult[a.star]); front.push(back.shift()); }   // somebody must hold the line
      while (front.length > 4) back.push(front.pop());
      while (back.length > 4) front.push(back.pop());
      const FR = ['f1', 'f2', 'f0', 'f3'], BK = ['b1', 'b2', 'b0', 'b3'];
      const skip = (arr) => arr.filter((x) => !(p.summoned && p.heroSlot === x));
      const fs = skip(FR), bs = skip(BK);
      p.board = {};
      const spill = [];   // units that found no slot go to the bench instead of vanishing
      const put = (u, first, second) => { const slot = first.shift() || second.shift(); if (slot) p.board[slot] = u; else spill.push(u); };
      front.forEach((u) => put(u, fs, bs));
      back.forEach((u) => put(u, bs, fs));
      const rest = all.filter((u) => !Object.values(p.board).includes(u));
      p.bench = new Array(AMB.CONFIG.economy.benchSize).fill(null);
      rest.forEach((u) => { const bi = p.bench.indexOf(null); if (bi >= 0) p.bench[bi] = u; else this._placeAnywhere(p, u); });
      return { ok: true };
    }

    /** Fill empty board capacity from the bench (used when the timer expires). */
    autoFill(pi) {
      const p = this.players[pi];
      const free = () => SLOTS.filter((s) => !p.board[s] && !(p.summoned && p.heroSlot === s));
      const bench = p.bench.map((u, i) => [u, i]).filter((e) => e[0]);
      bench.sort((a, b) => b[0].star - a[0].star || AMB.DATA.UNITS[b[0].defId].tier - AMB.DATA.UNITS[a[0].defId].tier);
      for (const [u] of bench) {
        if (this.boardCount(p) >= p.level) break;
        const role = AMB.DATA.UNITS[u.defId].role;
        const pref = ['guardian', 'fighter'].includes(role) ? 'f' : 'b';
        const fs = free();
        const slot = fs.find((s) => s[0] === pref) || fs[0];
        if (!slot) break;
        this.move(pi, u.uid, { zone: 'board', slot });
      }
      // too many units on board (e.g. never possible, but be safe)
      while (this.boardCount(p) > p.level) {
        const s = Object.keys(p.board).pop();
        const bi = p.bench.indexOf(null);
        if (bi < 0) { this.sell(pi, p.board[s].uid); } else this.move(pi, p.board[s].uid, { zone: 'bench', idx: bi });
      }
    }

    // ================================================================ combat
    buildCombatSpec(pi) {
      const p = this.players[pi];
      const grow = p.lineup && p.lineup.growth ? 1 + p.lineup.growth * (this.round - 1) : 1;   // long boss fights: the scripted enemy gets stronger every round
      return {
        heroId: p.heroId, life: p.life, maxLife: p.maxLife, summoned: p.summoned, heroSlot: p.heroSlot,
        units: Object.entries(p.board).map(([slot, u]) => ({ uid: u.uid, defId: u.defId, star: u.star, items: u.items.slice(), slot, power: ((p.cardPower && p.cardPower[u.defId]) || 1) * grow })),
        heroPower: ((p.cardPower && p.cardPower[p.heroId]) || 1) * grow,
        heroLevel: p.heroLevel || 1,
        spells: p.armedSpells.slice(),
        blessings: Object.assign({}, p.blessings),
        abilities: Object.entries(p.abilities).map(([id, trigger]) => ({ id, trigger })),
      };
    }

    createCombat(record) {
      this.phase = 'combat';
      this.players.forEach((_, i) => this.autoFill(i));
      const specs = [this.buildCombatSpec(0), this.buildCombatSpec(1)];
      this.scout = specs.map((s) => JSON.parse(JSON.stringify(s)));
      this._combatSpecs = specs;
      return new AMB.Combat(specs, { seed: this.isolated ? ((this.seed * 31 + this.round * 104729) % 2147483647) : this.rng.int(2 ** 31), round: this.round, record });
    }

    /** Apply a finished combat result: hero damage, streaks, essence, spells. */
    resolveCombat(result) {
      const D = AMB.CONFIG.damage;
      const M = AMB.CONFIG.match;
      const report = { round: this.round, winner: result.winner, duration: result.duration, players: [] };
      this.players.forEach((p, i) => {
        const sr = result.sides[i];
        const before = p.life;
        p.life = sr.heroLife;
        const direct = before - p.life;
        let backlash = 0;
        const opp = result.sides[1 - i];
        if (result.winner === 1 - i && !sr.heroKilled) {
          backlash = D.lossBase + Math.floor(this.round * D.lossPerRound) + Math.min(D.survivorCap, opp.survivors.reduce((s, u) => s + u.star * D.perSurvivor, 0));
          if (this.isFinale()) backlash = Math.round(backlash * M.finaleLossMult);
        } else if (result.winner === null) backlash = D.drawBase + Math.floor(this.round / 3);
        let collapse = 0;
        if (this.round >= M.collapseStartRound) {
          const k = this.round - M.collapseStartRound;
          collapse = M.collapseDamage[Math.min(k, M.collapseDamage.length - 1)];
        }
        p.life = Math.max(0, p.life - backlash - collapse);
        if (sr.heroKilled) p.life = 0;
        // essence: pay for fired abilities only (unfired ones are refunded)
        const hero = AMB.DATA.HEROES[p.heroId];
        let spent = 0;
        sr.abilitiesFired.forEach((id) => (spent += this.abilityCost(p, hero.abilities.find((a) => a.id === id))));
        p.essence = Math.max(0, p.essence - spent);
        p.armedSpells = [];
        // streaks
        p.lastWon = result.winner === i;
        if (result.winner === i) { p.winStreak++; p.lossStreak = 0; p.stats.wins++; }
        else if (result.winner === 1 - i) { p.lossStreak++; p.winStreak = 0; p.stats.losses++; }
        else { p.stats.draws++; }
        const dmg = Object.values(p.board).reduce((s, u) => s + (result.unitDamage[u.uid] || 0), 0);
        p.stats.damageDealt += dmg;
        report.players.push({ direct: Math.round(direct * 10) / 10, backlash, collapse, lifeAfter: p.life, heroKilled: sr.heroKilled,
          survivors: sr.survivors.length, essenceSpent: spent, abilities: sr.abilitiesFired, exposed: sr.exposed,
          board: Object.values(p.board).map((u) => ({ defId: u.defId, star: u.star, items: u.items.slice() })),
          synergies: AMB.synergy.evaluate(Object.values(p.board), p.heroId).list.filter((s) => s.activeTier >= 0).map((s) => s.id),
          summoned: p.summoned, damage: dmg });
        p._lastDirect = direct;
      });
      this.history.push(report);
      this.phase = 'result';

      // game over checks
      const dead = this.players.map((p) => p.life <= 0);
      if (dead[0] || dead[1]) {
        // both heroes fell in the same round (rift collapse): the round's winner takes the match; a drawn round is a draw
        this.winner = dead[0] && dead[1] ? (report.winner != null ? report.winner : null) : dead[0] ? 1 : 0;
      } else if (this.rules) {   // short match: first to winsNeeded round wins; after maxRounds more round wins, then more life
        const w = this.players.map((p) => p.stats.wins), need = this.rules.winsNeeded || 2;
        if (w[0] >= need || w[1] >= need) this.winner = w[0] >= need ? 0 : 1;
        else if (this.round >= this.rules.maxRounds) {
          const [a, b] = this.players.map((p) => p.life);
          this.winner = w[0] !== w[1] ? (w[0] > w[1] ? 0 : 1) : a !== b ? (a > b ? 0 : 1) : null;
        }
      } else if (this.round >= M.maxRounds) {
        const [a, b] = this.players.map((p) => p.life);
        if (a !== b) this.winner = a > b ? 0 : 1;
        else { const w = this.players.map((p) => p.stats.wins); this.winner = w[0] === w[1] ? null : w[0] > w[1] ? 0 : 1; }   // tie-break: rounds won
      }
      if (this.winner !== undefined) { this.phase = 'over'; this.endedAt = Date.now(); }
      else this.offerRewards();
      report.finale = this.isFinale(report.round);
      return report;
    }

    // ================================================================ stages & rewards
    stageIndex(round) { const st = AMB.CONFIG.match.stages; const r = round == null ? this.round : round; const i = st.findIndex((x) => r >= x.rounds[0] && r <= x.rounds[1]); return i < 0 ? st.length - 1 : i; }
    stageInfo(round) { return AMB.CONFIG.match.stages[this.stageIndex(round)]; }
    isFinale(round) { return this.stageInfo(round).id === 'finale'; }
    /** true while any player still has an unclaimed reward draft */
    get rewardPending() { return this.players.some((p) => p.rewardOffer && !p.rewardOffer.claimed); }

    /** Build 3 distinct offers per player after the last round of a stage (not the final stage). */
    offerRewards() {
      if (this.rules) return false;   // no reward drafts in short (campaign) matches
      const si = this.stageIndex(this.round);
      if (si >= AMB.CONFIG.match.stages.length - 1) return false;
      if (this.round !== AMB.CONFIG.match.stages[si].rounds[1]) return false;   // only at the end of a stage
      const R = AMB.DATA.REWARDS, M = AMB.CONFIG.match;
      this.players.forEach((p, pi) => {
        const trailing = this.players[1 - pi].life - p.life >= M.catchUpGap;   // comeback help: a 4th option
        const pool = AMB.DATA.REWARD_POOLS[si].filter((id) => id !== 'heal' || p.life < p.maxLife);
        const picks = ['unit'];
        const rest = pool.slice();
        while (picks.length < (trailing ? 4 : 3) && rest.length) picks.push(rest.splice(this._rng(p).int(rest.length), 1)[0]);
        for (let i = picks.length - 1; i > 0; i--) { const j = this._rng(p).int(i + 1); [picks[i], picks[j]] = [picks[j], picks[i]]; }
        p.rewardOffer = { stage: si, options: picks, claimed: false, trailing };
      });
      return true;
    }

    rewardText(id, stage) { const r = AMB.DATA.REWARDS[id]; return r.text(r, stage); }

    claimReward(pi, idx) {
      const p = this.players[pi], o = p.rewardOffer;
      if (!o || o.claimed) return this._fail('ما فيه مكافأة');
      const id = o.options[idx]; if (!id) return this._fail('هذا الخيار مو صحيح');
      const R = AMB.DATA.REWARDS[id], st = o.stage, out = { ok: true, id, text: R.name + ' — ' + this.rewardText(id, st) };
      switch (id) {
        case 'gold': p.gold += R.n[st]; break;
        case 'xp': this._gainXp(p, R.n[st]); break;
        case 'essence': p.essence = Math.min(AMB.CONFIG.economy.essenceMax + 3, p.essence + R.n[st]); break;
        case 'heal': p.life = Math.min(p.maxLife, p.life + R.n[st]); break;
        case 'item': { const ids = Object.keys(AMB.DATA.ITEMS); const pick = this._rng(p).pick(ids); if (p.items.length < AMB.CONFIG.economy.itemBenchSize) p.items.push(pick); else p.gold += 3; out.item = pick; break; }
        case 'bless_atk': p.blessings.atkPct += R.pct[st]; break;
        case 'bless_hp': p.blessings.hpPct += R.pct[st]; break;
        case 'bless_as': p.blessings.asPct += R.pct[st]; break;
        case 'unit': {
          const tier = R.tiers[st], hero = AMB.DATA.HEROES[p.heroId];
          const mine = (u) => !p.allowed || p.allowed.has(u.id);
          const entries = Object.values(AMB.DATA.UNITS).filter((u) => u.tier === tier && this._pool(p)[u.id] > 0 && mine(u)).map((u) => [u.id, u.world === hero.world ? 2 : 1]);
          const any = entries.length ? entries : Object.values(AMB.DATA.UNITS).filter((u) => this._pool(p)[u.id] > 0 && mine(u)).map((u) => [u.id, 1]);
          const defId = this._rng(p).weighted(any);
          if (defId) { out.unit = defId; out.text += ' → ' + AMB.DATA.UNITS[defId].name; this._grantUnit(p, defId); }
          break;
        }
      }
      o.claimed = true; o.chosen = id;
      p.rewardLog.push({ round: this.round, id, stage: st });
      return out;
    }

    /** a free unit goes to the bench (merging if it completes a trio); if there is no room it converts to its gold cost */
    _grantUnit(p, defId) {
      this._pool(p)[defId]--;
      const unit = { uid: this._uid(p), defId, star: 1, items: [] };
      const idx = p.bench.indexOf(null);
      if (idx >= 0) p.bench[idx] = unit; else p._overflow = unit;
      this._merge(p, unit);
    }

    /** compact facts about one player's match, for the battle pass (xp + missions) */
    summary(pi) {
      const p = this.players[pi], last = this.history[this.history.length - 1];
      const board = last ? last.players[pi].board : [];
      const worlds = new Set(board.map((u) => AMB.DATA.UNITS[u.defId].world));
      const opp = this.players[1 - pi];
      const mode = this.rules ? 'campaign' : this.mode === 'friendly' ? 'friendly' : this.mode === 'hotseat' ? 'hotseat' : (opp.difficulty || 'normal');
      return { mode, won: this.winner === pi, roundsPlayed: this.round, roundsWon: p.stats.wins,
        finaleWon: !!(last && last.round >= AMB.CONFIG.match.maxRounds && last.winner === pi),
        buys: p.stats.unitsBought, rerolls: p.stats.rerolls, merges: p.stats.merges, summoned: this.history.some((r) => r.players[pi].summoned),
        stageRewards: p.rewardLog.length, damage: p.stats.damageDealt, worldsUsed: worlds.size };
    }

    /** Scripted (campaign) opponent: put the fixed line-up on the board for this round. */
    applyLineup(pi) {
      const p = this.players[pi], L = p.lineup;
      p.board = {}; p.bench = p.bench.map(() => null); p.shop = []; p.itemShop = [];
      L.units.forEach(([defId, star, slot, from], k) => {
        if ((from || 1) > this.round) return;
        p.board[slot] = { uid: 'e' + k + defId, defId, star: star || 1, items: [] };
      });
      p.level = Math.max(1, Object.keys(p.board).length);
      p.summoned = !!L.summon; if (L.summon) p.heroSlot = L.summon;
      p.blessings = Object.assign({ atkPct: 0, hpPct: 0, asPct: 0 }, L.blessings || {});
      p.essence = 99; p.abilities = {};
      (L.abilities || []).forEach((id) => (p.abilities[id] = 'start'));
    }

    get isOver() { return this.phase === 'over'; }

    _fail(reason) { return { ok: false, reason }; }
  }

  AMB.Match = Match;
  AMB.SLOTS = SLOTS;
})();
