/*
 * Deterministic auto-combat simulation.
 *
 * Battlefield coordinates (side 0 is drawn at the bottom):
 *   y = -1  side-0 command post (hero when NOT summoned)
 *   y =  0  side-0 back row        y = 1  side-0 front row
 *   y =  3  side-1 front row       y = 4  side-1 back row
 *   y =  5  side-1 command post
 *   x = column 0..3 (side 1 is mirrored so both players see "their" left)
 *
 * Hero protection rule: a hero can only be targeted when its side has no
 * living non-hero unit deployed in the FRONT row ("defence line"), or when a
 * summoned hero stands in the front row itself. Area skills that splash onto
 * a summoned hero still hurt it (that is the risk of summoning).
 */
(function () {
  const AMB = (globalThis.AMB = globalThis.AMB || {});
  const { dist, clamp } = AMB.util;

  const EMPTY_MODS = () => ({ atkPct: 0, hpPct: 0, asPct: 0, dr: 0, lifesteal: 0, crit: 0, critDmg: 0,
    skillPower: 0, startMana: 0, range: 0, startShieldPct: 0, regenPct: 0 });

  function slotPos(side, slot) {
    const row = slot[0] === 'f' ? 'front' : 'back';
    const col = +slot[1];
    if (side === 0) return { row, x: col, y: row === 'front' ? 1 : 0 };
    return { row, x: 3 - col, y: row === 'front' ? 3 : 4 };
  }
  const postPos = (side) => ({ x: 1.5, y: side === 0 ? -1 : 5 });

  class Combat {
    /**
     * @param specs [sideSpec, sideSpec] — see Match.buildCombatSpec
     * @param opts { seed, round, record }
     */
    constructor(specs, opts) {
      this.C = AMB.CONFIG.combat;
      this.round = opts.round || 1;
      this.rng = AMB.util.RNG(opts.seed || 1);
      this.record = opts.record !== false;
      this.t = 0;
      this.events = [];
      this.fighters = [];
      this.sides = [0, 1].map((s) => ({
        spec: specs[s], deaths: 0, exposed: false, exposedAt: null, abilities: [], spellsTimed: [],
        hero: null, synergy: null, blazing: false,
      }));
      this.assault = null;
      this.over = false;
      this.result = null;
      this.nextId = 1;
      specs.forEach((spec, s) => this._setupSide(s, spec));
      this._updateExposure(true);
    }

    emit(e) { if (this.record) { e.t = this.t; this.events.push(e); } }
    drainEvents() { const e = this.events; this.events = []; return e; }

    _setupSide(s, spec) {
      const { UNITS, HEROES, ITEMS, SYNERGIES } = AMB.DATA;
      const HC = AMB.CONFIG.hero;
      const side = this.sides[s];
      const hero = HEROES[spec.heroId];
      // hero level (progression fights): stronger summoned body, stronger summoned form, stronger abilities
      const HL = Math.max(1, spec.heroLevel || 1) - 1;
      const lvAtk = 1 + 0.05 * HL, lvVan = 1 + 0.03 * HL, lvAb = 1 + 0.03 * HL;
      side.abilityPower = lvAb;
      const VS = (HC.vanguardScale == null ? 1 : HC.vanguardScale) * lvVan;
      const vg = (k) => (((hero.vanguard || {})[k]) || 0) * VS;
      const syn = AMB.synergy.evaluate(spec.units, spec.heroId);
      side.synergy = syn;
      const spells = (spec.spells || []).map((id) => ITEMS[id].spell);

      // --- units
      spec.units.forEach((u) => {
        const def = UNITS[u.defId];
        const pos = slotPos(s, u.slot);
        const mods = EMPTY_MODS();
        syn.list.forEach((sy) => sy.effects.forEach((eff) => {
          if (AMB.synergy.appliesTo(SYNERGIES[sy.id], eff, def, pos.row)) mods[eff.stat] += eff.value;
        }));
        (u.items || []).forEach((it) => ITEMS[it].effects.forEach((eff) => (mods[eff.stat] += eff.value)));
        if (def.world === hero.world) { mods.atkPct += HC.resonancePerAlly; mods.hpPct += HC.resonancePerAlly; }
        if (hero.passive.id === 'ancient_bark' && pos.row === 'front') mods.hpPct += 0.15;
        if (spec.summoned) {   // each hero leads differently once it stands on the board
          mods.atkPct += HC.summonAuraAtk + vg('allyAtk'); mods.asPct += vg('allyAs'); mods.dr += vg('allyDr'); mods.regenPct += vg('allyRegen');
          if (pos.row === 'front') mods.hpPct += vg('frontHp');
        }
        spells.forEach((sp) => { if (sp.type === 'buffAll') mods.atkPct += sp.atkPct; });
        const bl = spec.blessings || {};
        mods.atkPct += bl.atkPct || 0; mods.hpPct += bl.hpPct || 0; mods.asPct += bl.asPct || 0;   // stage-reward blessings

        const sm = AMB.CONFIG.stars.mult[u.star] * (u.power || 1);   // power: card level × rarity (progression fights only, else 1)
        const maxHp = def.hp * sm * (1 + mods.hpPct);
        const f = this._fighter(s, {
          uid: u.uid, defId: def.id, name: def.name, role: def.role, world: def.world, star: u.star,
          isHero: false, onBoard: true, slot: u.slot, row: pos.row, x: pos.x, y: pos.y,
          maxHp, hp: maxHp, atk: def.atk * sm * (1 + mods.atkPct), as: def.as * (1 + mods.asPct),
          range: def.range + mods.range, def: def.def + mods.dr, crit: def.crit + mods.crit,
          critDmg: this.C.critMult + mods.critDmg, lifesteal: mods.lifesteal, skillPower: 1 + mods.skillPower,
          regenPct: mods.regenPct, mana: mods.startMana, maxMana: def.mana, skill: def.skill,
        });
        if (mods.startShieldPct) f.shield += maxHp * mods.startShieldPct;
      });

      // --- hero (summoned onto the board, or waiting at the command post)
      const scale = this.C.heroHpScale;
      const hMods = EMPTY_MODS();
      syn.list.forEach((sy) => sy.effects.forEach((eff) => { if (eff.scope === 'all') hMods[eff.stat] += eff.value; }));
      spells.forEach((sp) => { if (sp.type === 'buffAll') hMods.atkPct += sp.atkPct; });
      hMods.atkPct += (spec.blessings || {}).atkPct || 0; hMods.asPct += (spec.blessings || {}).asPct || 0;
      const hp = spec.life * scale;
      const base = { uid: 'hero' + s, defId: hero.id, name: hero.name, role: 'hero', world: hero.world, star: 0,
        isHero: true, maxHp: spec.maxLife * scale, hp, maxMana: Infinity, mana: 0, skill: null };
      let hf;
      if (spec.summoned) {
        const pos = slotPos(s, spec.heroSlot);
        hf = this._fighter(s, Object.assign(base, {
          onBoard: true, slot: spec.heroSlot, row: pos.row, x: pos.x, y: pos.y,
          atk: (hero.board.atk + HC.boardAtkPerRound * this.round) * (1 + hMods.atkPct + vg('heroAtk')) * (HC.boardPower == null ? 1 : HC.boardPower) * (spec.heroPower || 1) * lvAtk,
          as: hero.board.as * (1 + hMods.asPct + vg('heroAs')), range: hero.board.range, def: hero.board.def + hMods.dr + vg('heroDef'),
          crit: hero.board.crit + vg('heroCrit'), critDmg: this.C.critMult, lifesteal: 0, skillPower: 1, regenPct: hMods.regenPct,
        }));
      } else {
        const pos = postPos(s);
        hf = this._fighter(s, Object.assign(base, {
          onBoard: false, passive: true, row: 'post', x: pos.x, y: pos.y,
          atk: 0, as: 0, range: 0, def: 0, crit: 0, critDmg: 1, lifesteal: 0, skillPower: 1, regenPct: 0,
        }));
      }
      side.hero = hf;
      hf.startHp = hp;   // healing/regen can undo damage taken in THIS combat, but never raise a hero above the life it started with
      if (spec.summoned) {
        hf.floorHp = Math.max(0, hp - (this.C.summonKnockout + vg('knockoutBonus')) * scale);
        if (vg('heroShield')) hf.shield += vg('heroShield') * scale;
      } else {
        const cap = this.C.postDamageCapBase + this.C.postDamageCapPerRound * this.round;
        hf.floorHp = Math.max(0, hp - cap * scale);
      }

      // --- armed hero abilities & spells
      (spec.abilities || []).forEach((a) => {
        const def = hero.abilities.find((x) => x.id === a.id);
        if (def) side.abilities.push({ def, trigger: a.trigger, fired: false });
      });
      spells.forEach((sp, i) => {
        const id = spec.spells[i];
        if (sp.type === 'shieldFront') side.spellsTimed.push({ id, sp, at: 0, fired: false });
        if (sp.type === 'hitBack') side.spellsTimed.push({ id, sp, at: sp.at, fired: false });
        if (sp.type === 'hasteAll') side.spellsTimed.push({ id, sp, at: 0, fired: false });
      });
    }

    _fighter(side, props) {
      const f = Object.assign({
        id: this.nextId++, side, alive: true, shield: 0, buffs: [], dots: [], stun: 0,
        target: null, tauntBy: null, tauntUntil: 0, atkCd: 0.2 + this.rng.next() * 0.3,
        dmgDealt: 0, healDone: 0, leaped: false, passive: false,
      }, props);
      f.moveSpeed = f.role === 'assassin' ? this.C.assassinMoveSpeed : this.C.moveSpeed;
      this.fighters.push(f);
      return f;
    }

    // ---------------------------------------------------------------- helpers
    enemiesOf(f) { return this.fighters.filter((e) => e.side !== f.side && e.alive); }
    alliesOf(f) { return this.fighters.filter((e) => e.side === f.side && e.alive && !e.passive); }
    sideFighters(s) { return this.fighters.filter((e) => e.side === s && e.alive && !e.passive); }

    buffSum(f, key) {
      let v = 0;
      for (const b of f.buffs) if (b[key]) v += b[key];
      return v;
    }

    targetable(e) {
      if (!e.alive) return false;
      if (!e.isHero) return true;
      if (e.sealed) return false;
      if (e.onBoard && e.row === 'front') return true;
      return this.sides[e.side].exposed;
    }

    _updateExposure(initial) {
      [0, 1].forEach((s) => {
        const side = this.sides[s];
        const front = this.fighters.some((f) => f.side === s && f.alive && !f.isHero && f.row === 'front');
        if (!front && !side.exposed) {
          side.exposed = true;
          side.exposedAt = this.t;
          this.emit({ type: 'exposed', side: s });
          if (this.sides[s].spec && AMB.DATA.HEROES[this.sides[s].spec.heroId].passive.id === 'blazing_will' && !side.blazing) {
            side.blazing = true;
            this.sideFighters(s).forEach((a) => a.buffs.push({ atkPct: 0.25, until: Infinity }));
            this.emit({ type: 'heroAbility', side: s, name: 'إرادة متقدة' });
          }
        }
      });
    }

    effAtk(f) { return f.atk * (1 + this.buffSum(f, 'atkPct')); }
    effAs(f) { return f.as * (1 + this.buffSum(f, 'asPct')); }
    effDef(f) { return clamp(f.def + this.buffSum(f, 'dr'), 0, this.C.maxDef); }
    fury() { return this.t > this.C.furyStart ? 1 + this.C.furyPerSec * (this.t - this.C.furyStart) : 1; }

    findTarget(f) {
      const enemies = this.enemiesOf(f).filter((e) => this.targetable(e));
      if (!enemies.length) return null;
      if (f.tauntBy && f.tauntUntil > this.t) {
        const tb = this.fighters.find((x) => x.id === f.tauntBy);
        if (tb && tb.alive) return tb;
      }
      if (f.role === 'assassin') {
        const hero = enemies.find((e) => e.isHero);
        if (hero) return hero;
        // back line first: farthest from own side
        const dir = f.side === 0 ? 1 : -1;
        enemies.sort((a, b) => (b.y - a.y) * dir || dist(f, a) - dist(f, b) || a.id - b.id);
        return enemies[0];
      }
      let best = null, bd = Infinity;
      for (const e of enemies) {
        const d = dist(f, e) + (e.isHero && !e.onBoard ? 0.5 : 0); // tiny bias: units before the post
        if (d < bd - 1e-6 || (Math.abs(d - bd) < 1e-6 && e.id < best.id)) { best = e; bd = d; }
      }
      return best;
    }

    // ---------------------------------------------------------------- damage
    damage(src, tgt, raw, opts) {
      if (!tgt.alive || raw <= 0) return 0;
      opts = opts || {};
      let def = this.effDef(tgt);
      if (opts.skill) def *= this.C.skillDefFactor;
      let dmg = raw * (1 - def) * this.fury();
      if (tgt.isHero && !tgt.onBoard) dmg *= this.C.commandPostFortify;
      if (tgt.shield > 0) {
        const absorbed = Math.min(tgt.shield, dmg);
        tgt.shield -= absorbed;
        dmg -= absorbed;
      }
      if (tgt.isHero && tgt.floorHp > 0 && tgt.hp - dmg <= tgt.floorHp) {
        dmg = Math.max(0, tgt.hp - tgt.floorHp);
        tgt.hp = tgt.floorHp;
        if (src) src.dmgDealt += dmg;
        if (dmg > 0) this.emit({ type: 'damage', id: tgt.id, amount: Math.round(dmg), crit: !!opts.crit, skill: !!opts.skill });
        this._heroFloor(tgt);
        return dmg;
      }
      tgt.hp -= dmg;
      if (src && src !== tgt && tgt.thorns && tgt.thorns.until > this.t && !opts.dot && !opts.thorn) this.damage(null, src, dmg * tgt.thorns.pct, { thorn: true, skill: true });   // "thorns" twist: a share of the hit goes back
      if (src) {
        src.dmgDealt += dmg;
        if (src.lifesteal && !opts.dot) this.heal(src, dmg * src.lifesteal, true);
      }
      if (!opts.dot && !opts.thorn && !tgt.passive) tgt.mana = Math.min(tgt.maxMana, tgt.mana + this.C.manaPerHit);
      this.emit({ type: 'damage', id: tgt.id, amount: Math.round(dmg), crit: !!opts.crit, skill: !!opts.skill });
      if (tgt.hp <= 0) this.kill(tgt, src);
      return dmg;
    }

    heal(f, amount, quiet) {
      if (!f.alive || amount <= 0) return;
      const before = f.hp;
      f.hp = Math.min(f.isHero && f.startHp != null ? f.startHp : f.maxHp, f.hp + amount);
      const done = f.hp - before;
      if (done > 0.5 && !quiet) this.emit({ type: 'heal', id: f.id, amount: Math.round(done) });
    }

    // A hero hit its per-combat floor: a summoned hero retreats to the command
    // post (knockout), a command-post hero is "sealed" for the rest of combat.
    _heroFloor(h) {
      if (h.onBoard) {
        h.onBoard = false; h.passive = true; h.row = 'post';
        Object.assign(h, postPos(h.side));
        h.target = null; h.buffs = []; h.dots = []; h.stun = 0;
        this.emit({ type: 'retreat', id: h.id, side: h.side });
        this.fighters.forEach((f) => { if (f.target === h) f.target = null; });
      } else if (!h.sealed) {
        h.sealed = true;
        this.emit({ type: 'sealed', id: h.id, side: h.side });
      }
    }

    kill(f, src) {
      f.alive = false;
      f.hp = 0;
      this.sides[f.side].deaths += f.isHero ? 0 : 1;
      this.emit({ type: 'death', id: f.id, hero: f.isHero });
      this._updateExposure();
    }

    // ---------------------------------------------------------------- skills
    cast(f) {
      const sk = f.skill;
      const s = Math.max(0, f.star - 1);
      const p = f.skillPower;
      const tgt = f.target && f.target.alive ? f.target : this.findTarget(f);
      const needsTarget = ['nuke', 'cleave', 'aoe', 'stunAoe', 'stunStrike', 'burn', 'drain', 'execute'].includes(sk.type);
      if (needsTarget && !tgt) return false;
      f.mana = 0;
      this.emit({ type: 'cast', id: f.id, name: sk.name });
      // splash spreads sideways along the target's row (it no longer drags the squishy back row down with the front line)
      const enemiesNear = (c, r) => this.enemiesOf(f).filter((e) => (this.targetable(e) || (e.isHero && e.onBoard)) && dist(e, c) <= r && (e === c || Math.abs(e.y - c.y) < 0.6));
      switch (sk.type) {
        case 'nuke': this.damage(f, tgt, sk.dmg[s] * p, { skill: true }); break;
        case 'cleave':
        case 'aoe': enemiesNear(tgt, sk.radius).forEach((e) => this.damage(f, e, sk.dmg[s] * p, { skill: true })); break;
        case 'stunAoe': enemiesNear(tgt, sk.radius).forEach((e) => { this.damage(f, e, sk.dmg[s] * p, { skill: true }); this.stun(e, sk.stun[s]); }); break;
        case 'stunStrike': this.damage(f, tgt, sk.dmg[s] * p, { skill: true }); this.stun(tgt, sk.stun[s]); break;
        case 'burn': tgt.dots.push({ dps: sk.dps[s] * p, until: this.t + sk.dur, src: f.id }); break;
        case 'drain': { const d = this.damage(f, tgt, sk.dmg[s] * p, { skill: true }); this.heal(f, d); break; }
        case 'execute': {
          const low = tgt.hp / tgt.maxHp < 0.4;
          this.damage(f, tgt, sk.dmg[s] * p * (low ? 2 : 1), { skill: true, crit: low });
          break;
        }
        case 'snipe': {
          const list = this.enemiesOf(f).filter((e) => this.targetable(e));
          if (!list.length) break;
          list.sort((a, b) => a.hp - b.hp || a.id - b.id);
          this.emit({ type: 'attack', from: f.id, to: list[0].id, ranged: true });
          this.damage(f, list[0], sk.dmg[s] * p, { skill: true });
          break;
        }
        case 'multishot': {
          const list = this.enemiesOf(f).filter((e) => this.targetable(e)).sort((a, b) => dist(f, a) - dist(f, b) || a.id - b.id).slice(0, sk.count);
          list.forEach((e) => { this.emit({ type: 'attack', from: f.id, to: e.id, ranged: true }); this.damage(f, e, sk.dmg[s] * p, { skill: true }); });
          break;
        }
        case 'taunt':
          this.enemiesOf(f).forEach((e) => { if (!e.passive && dist(e, f) <= sk.radius) { e.tauntBy = f.id; e.tauntUntil = this.t + sk.dur; e.target = f; } });
          f.shield += sk.shield[s] * p;
          break;
        case 'shieldSelf': f.shield += sk.shield[s] * p; break;
        case 'healSelf': this.heal(f, sk.heal[s] * p); break;
        case 'healLowest': {
          const list = this.alliesOf(f).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp || a.id - b.id);
          if (list.length) this.heal(list[0], sk.heal[s] * p);
          break;
        }
        case 'healAll': this.alliesOf(f).forEach((a) => this.heal(a, sk.heal[s] * p)); break;
        case 'hasteAllies': this.alliesOf(f).forEach((a) => a.buffs.push({ asPct: sk.pct[s], until: this.t + sk.dur })); break;
      }
      if (sk.extra) this._twist(f, sk, tgt, s, p);
      return true;
    }

    // A card's own twist on top of its basic skill (units of the same role no longer play the same):
    // bleed / sunder / slow / vampiric / rally / ward / charge · barrier / haste / cleanse / bolster · thorns / wall / chill / mend / bash
    _twist(f, sk, tgt, s, p) {
      const t = this.t, base = ((sk.dmg || sk.heal || sk.shield || sk.dps || [240, 400, 680])[s]) * p;
      const allies = () => this.alliesOf(f), lowest = () => this.alliesOf(f).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp || a.id - b.id)[0];
      switch (sk.extra) {
        case 'bleed': if (tgt && tgt.alive) tgt.dots.push({ dps: base * 0.12, until: t + 4, src: f.id }); break;
        case 'sunder': if (tgt && tgt.alive) tgt.buffs.push({ dr: -0.2, until: t + 5 }); break;
        case 'slow': if (tgt && tgt.alive) tgt.buffs.push({ asPct: -0.3, until: t + 4 }); break;
        case 'vampiric': this.heal(f, base * 0.5); break;
        case 'rally': f.buffs.push({ asPct: 0.3, until: t + 4 }); break;
        case 'ward': f.shield += base * 0.6; break;
        case 'charge': allies().filter((a) => a !== f && !a.passive).sort((a, b) => dist(f, a) - dist(f, b)).slice(0, 2).forEach((a) => { a.mana = Math.min(a.maxMana, a.mana + 25); }); break;
        case 'barrier': if (sk.type === 'healAll') allies().forEach((a) => { a.shield += base * 0.3; }); else { const l = lowest(); if (l) l.shield += base * 0.5; } break;
        case 'haste': { const l = lowest(); if (l) l.buffs.push({ asPct: 0.2, until: t + 4 }); break; }
        case 'cleanse': if (sk.type === 'healAll') allies().forEach((a) => { a.stun = 0; }); else { const l = lowest(); if (l) l.stun = 0; } break;
        case 'bolster': allies().forEach((a) => a.buffs.push({ dr: 0.12, until: t + 4 })); break;
        case 'thorns': f.thorns = { pct: 0.25, until: t + 4 }; break;
        case 'wall': f.buffs.push({ dr: 0.3, until: t + 4 }); break;
        case 'chill': this.enemiesOf(f).forEach((e) => { if (!e.passive && dist(e, f) <= 2.2) e.buffs.push({ asPct: -0.25, until: t + 4 }); }); break;
        case 'mend': this.heal(f, base * 0.4); break;
        case 'bash': { const e = this.enemiesOf(f).filter((x) => this.targetable(x)).sort((a, b) => dist(f, a) - dist(f, b) || a.id - b.id)[0]; if (e) this.stun(e, 0.8); break; }
        default: break;
      }
    }

    stun(f, dur) { if (f.alive && !f.passive) { f.stun = Math.max(f.stun, dur); this.emit({ type: 'stun', id: f.id }); } }

    // ---------------------------------------------------------------- hero abilities / spells
    _fireAbility(s, ab) {
      ab.fired = true;
      const a = ab.def;
      const allies = this.sideFighters(s);
      const enemies = this.sideFighters(1 - s);
      const P = this.sides[s].abilityPower || 1;   // hero level
      const heroCap = (f) => (f.isHero ? Math.min(f.maxHp, 500) : f.maxHp);
      this.emit({ type: 'heroAbility', side: s, name: a.name });
      switch (a.type) {
        case 'buffAllies': allies.forEach((f) => f.buffs.push({ atkPct: (a.atkPct || 0) * P, asPct: (a.asPct || 0) * P, until: this.t + a.dur })); break;
        case 'shieldAllies': allies.forEach((f) => (f.shield += (a.amount + a.scale * this.round) * P)); break;
        case 'healAllies': allies.forEach((f) => this.heal(f, heroCap(f) * a.pct * P)); break;
        case 'stunEnemies': enemies.forEach((f) => this.stun(f, a.dur)); break;
        case 'frontDR': allies.filter((f) => f.row === 'front').forEach((f) => f.buffs.push({ dr: Math.min(0.6, a.dr * P), until: this.t + a.dur })); break;
        case 'stunFront': enemies.filter((f) => f.row === 'front').forEach((f) => { this.stun(f, a.dur); this.damage(null, f, (a.dmg + a.scale * this.round) * P, { skill: true }); }); break;
        case 'damageCluster': {
          if (!enemies.length) break;
          let best = enemies[0], bn = -1;
          enemies.forEach((e) => { const n = enemies.filter((o) => dist(o, e) <= a.radius).length; if (n > bn) { bn = n; best = e; } });
          this.emit({ type: 'blast', x: best.x, y: best.y, r: a.radius });
          enemies.filter((o) => dist(o, best) <= a.radius).forEach((o) => this.damage(null, o, (a.dmg + a.scale * this.round) * P, { skill: true }));
          break;
        }
      }
    }

    _fireSpell(s, st) {
      st.fired = true;
      const sp = st.sp;
      const name = AMB.DATA.ITEMS[st.id].name;
      this.emit({ type: 'spell', side: s, name });
      if (sp.type === 'shieldFront') this.sideFighters(s).filter((f) => f.row === 'front').forEach((f) => (f.shield += sp.amount));
      if (sp.type === 'hasteAll') this.sideFighters(s).forEach((f) => f.buffs.push({ asPct: sp.asPct, until: this.t + sp.dur }));
      if (sp.type === 'hitBack') {
        const targets = this.sideFighters(1 - s).filter((f) => f.row === 'back');
        targets.forEach((f) => this.damage(null, f, sp.dmg, { skill: true }));
        if (targets.length) this.emit({ type: 'blast', x: 1.5, y: s === 0 ? 4 : 0, r: 2 });
      }
    }

    _triggers() {
      [0, 1].forEach((s) => {
        const side = this.sides[s];
        side.abilities.forEach((ab) => {
          if (ab.fired) return;
          const tr = ab.trigger;
          if ((tr === 'start') || (tr === 't5' && this.t >= 5) ||
              (tr === 'firstDeath' && side.deaths >= 1) || (tr === 'exposed' && side.exposed)) this._fireAbility(s, ab);
        });
        side.spellsTimed.forEach((st) => { if (!st.fired && this.t >= st.at) this._fireSpell(s, st); });
      });
    }

    // ---------------------------------------------------------------- main loop
    step() {
      if (this.over) return;
      const dt = this.C.dt;
      this._triggers();

      // assassins leap over the defence line once
      if (this.t >= this.C.assassinLeapAt) {
        for (const f of this.fighters) {
          if (f.alive && f.role === 'assassin' && !f.leaped && f.stun <= 0) {
            f.leaped = true;
            const dir = f.side === 0 ? 1 : -1;
            const back = this.enemiesOf(f).filter((e) => !e.isHero || this.targetable(e))
              .sort((a, b) => (b.y - a.y) * dir || Math.abs(a.x - f.x) - Math.abs(b.x - f.x) || a.id - b.id)[0];
            if (back) {
              f.x = back.x + (f.x > back.x ? 0.35 : -0.35);
              f.y = back.y + dir * 0.55;
              f.target = back;
              this.emit({ type: 'leap', id: f.id });
            }
          }
        }
      }

      for (const f of this.fighters) {
        if (!f.alive) continue;
        f.buffs = f.buffs.filter((b) => b.until > this.t);
        if (f.dots.length) {
          f.dots = f.dots.filter((d) => d.until > this.t);
          for (const d of f.dots) {
            const src = this.fighters.find((x) => x.id === d.src);
            this.damage(src && src.alive ? src : null, f, d.dps * dt, { skill: true, dot: true });
            if (!f.alive) break;
          }
          if (!f.alive) continue;
        }
        if (f.regenPct) f.hp = Math.min(f.isHero && f.startHp != null ? f.startHp : f.maxHp, f.hp + (f.isHero ? Math.min(f.maxHp, 500) : f.maxHp) * f.regenPct * dt);
        if (f.passive) continue;
        if (f.stun > 0) { f.stun -= dt; continue; }

        if (!f.target || !f.target.alive || !this.targetable(f.target) || (f.tauntBy && f.tauntUntil > this.t && f.target.id !== f.tauntBy)) {
          f.target = this.findTarget(f);
        }
        if (f.skill && f.mana >= f.maxMana) { if (this.cast(f)) continue; }
        const tgt = f.target;
        if (!tgt) continue;
        const range = f.range <= 1 ? this.C.meleeRange : f.range + 0.15;
        const d = dist(f, tgt);
        if (d > range) {
          const step = Math.min(f.moveSpeed * dt, d - range + 0.01);
          f.x += ((tgt.x - f.x) / d) * step;
          f.y += ((tgt.y - f.y) / d) * step;
        } else {
          f.atkCd -= dt;
          if (f.atkCd <= 0) {
            f.atkCd += 1 / Math.max(0.1, this.effAs(f));
            const crit = this.rng.chance(f.crit);
            this.emit({ type: 'attack', from: f.id, to: tgt.id, ranged: f.range > 1 });
            this.damage(f, tgt, this.effAtk(f) * (crit ? f.critDmg : 1), { crit });
            if (f.skill) f.mana = Math.min(f.maxMana, f.mana + this.C.manaPerAttack);
          }
        }
      }

      this.t += dt;
      this._checkEnd();
    }

    _checkEnd() {
      const h0 = this.sides[0].hero, h1 = this.sides[1].hero;
      if (!h0.alive || !h1.alive) {
        const winner = !h0.alive && !h1.alive ? null : h0.alive ? 0 : 1;
        return this._finish(winner);
      }
      const a0 = this.sideFighters(0).length, a1 = this.sideFighters(1).length;
      if (!this.assault) {
        if (a0 === 0 && a1 === 0) return this._finish(null);
        if (a0 === 0 || a1 === 0) {
          const loser = a0 === 0 ? 0 : 1;
          this.assault = { side: loser, until: this.t + this.C.assaultWindow };
          this.emit({ type: 'assault', side: loser });
        }
      } else if (this.t >= this.assault.until || this.sides[this.assault.side].hero.sealed) {
        return this._finish(1 - this.assault.side);
      }
      if (this.t >= this.C.timeCap) {
        if (this.assault) return this._finish(1 - this.assault.side);
        return this._finish(null);
      }
    }

    _finish(winner) {
      this.over = true;
      const scale = this.C.heroHpScale;
      const sides = this.sides.map((sd, s) => ({
        heroLife: Math.max(0, sd.hero.hp / scale),
        heroKilled: !sd.hero.alive,
        survivors: this.fighters.filter((f) => f.side === s && f.alive && !f.isHero).map((f) => ({ defId: f.defId, star: f.star })),
        abilitiesFired: sd.abilities.filter((a) => a.fired).map((a) => a.def.id),
        exposed: sd.exposed,
      }));
      const unitDamage = {};
      this.fighters.forEach((f) => { if (!f.isHero) unitDamage[f.uid] = Math.round(f.dmgDealt); });
      this.result = { winner, duration: this.t, sides, unitDamage };
      this.emit({ type: 'end', winner });
    }

    runToEnd() {
      let guard = 0;
      while (!this.over && guard++ < 100000) this.step();
      return this.result;
    }
  }

  AMB.Combat = Combat;
  AMB.combatGeom = { slotPos, postPos };
})();
