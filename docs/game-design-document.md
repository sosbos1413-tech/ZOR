# HIDEOUT — سيد المخبأ
### Game Design Document (working title: *HIDEOUT*)

This document organizes the full design vision into a structured reference, and tracks what
the playable prototype (`/hideout.html`) actually implements today versus what remains as
backlog for a full production. It exists so the huge original brief (74 numbered sections,
covering roughly a full commercial mobile game) has one authoritative, buildable shape instead
of being re-read from scratch every session.

**Status of this document:** vertical-slice prototype delivered. A brief this size — a
Backpack-Battles-adjacent Base-Building Roguelike-Auto-Battler with a full city, six districts,
28+ rooms, a dozen bosses, an equipment layer, and deep meta-progression — is genuinely a
multi-month, multi-person production. What follows is organized so each remaining system can be
picked up independently without re-deriving the vision.

---

## 1. Pitch & Pillars

**Fantasy:** the player is a small crime boss turning a shabby basement into a hideout that
works like a well-oiled machine — one door, two rooms, two people at the start; eventually
floors, generators, workshops, tunnels, security doors, surveillance, a large crew, income
streams, secret rooms, emergency exits.

**Core pillar — placement over power.** A player with mediocre rooms/crew but excellent layout
should be able to beat a player with stronger items but a badly-designed hideout. Numbers
(character level, weapon level) are never allowed to be the whole story; adjacency, power
budgeting, room depth (how far the Vault sits from the entrance), and crew-to-room fit are.

**The hideout is the one system everything else refers back to.** It is simultaneously
inventory, base, production line, crew housing, and battlefield. There is no separate "arena" —
a raid happens *in* the same grid the player built.

**Genre blend:** Backpack/spatial-inventory management + base building + roguelike run
structure + auto-battler combat + tactical defense + crew management + light simulation +
resource management — unified by one system (the hideout), not stitched together as separate
minigames.

---

## 2. Platform, Orientation, Controls

- Mobile-first, **portrait 9:16**, never forces landscape.
- Touch-only: tap, drag-and-drop (pointer-drag with a following ghost + snap-to-grid), press,
  long-press, pinch-zoom where relevant.
- One-thumb-reachable: primary actions live in the bottom third of the screen (bottom nav,
  build tray, phase button).
- No dependency on tiny buttons; card/room targets are sized for a fingertip.

Prototype: implemented as a single static HTML/CSS/JS page (no build step, no framework),
`max-width:480px` centered column, `100dvh` height, pointer events for build-mode placement.
This matches the pattern already used by this repo's other game (`index.html`) for easy
GitHub Pages hosting and eventual Android WebView packaging via
`.github/workflows/build-android.yml`.

---

## 3. World & Tone

Fully fictional world. Primary city (working name): **VANTA CITY** — a huge city with distinct
districts. No real cities, no real gangs, no real branding.

Tone: **Crime Cartoon** — underground, neon, humorous, stylish, urban, slightly exaggerated.
Deliberately *not* photorealistic or grim; the game should be visually fun even when the
subject matter (crime, raids, heat) is tense.

## 4. Art Direction

**"Cartoon Crime Diorama."** Characters: cartoon proportions, slightly bigger heads, small
bodies, exaggerated readable silhouettes, clear per-character shape language, slightly
over-acted animation. The hideout renders as a side-view cutaway dollhouse/diorama — the player
can always see inside every room (someone typing in the server room, a mechanic fixing a part
in the workshop, someone asleep in the bedroom, someone eating in the kitchen). The hideout
should feel *alive* even when the player isn't doing anything.

**Prototype approximation:** since a full art pipeline is out of scope for a code-only session,
the prototype renders rooms as color-coded cards (border/glow colored by category) with an
emoji icon per room type, and crew as emoji tokens that idle-drift inside their assigned room
on a slow interval, with idle bob/pulse animation on synergy/penalty triggers. This is a
placeholder that keeps the *functional* diorama-readability goal (you can see who's where and
what's active) without committing to final art direction.

## 5. Color System

Dark, modern, not grim: charcoal / dark navy / concrete-gray backgrounds with strong functional
neon accents:

| Color | Meaning |
|---|---|
| Yellow | electricity / power |
| Red | danger / defense |
| Cyan | information / tech |
| Green | health / support |
| Violet | special / advanced tech |
| Gold | economy |
| Orange | production |

Implemented as CSS custom properties (`--yellow`, `--red`, `--cyan`, `--green`, `--violet`,
`--gold`, `--orange`) and used consistently as each room category's accent border/glow color
(see §8 catalog) so the player learns the mapping passively.

---

## 6. Screen Layout

**HIDEOUT SCREEN** is the main screen:

- **Top:** a compact resource bar — Cash, Respect, Intel, Parts, Heat. Five values, no more —
  deliberately not a ten-icon dashboard.
- **Middle (~65–75% of height):** the hideout viewport — pan/scroll + pinch-zoom-ready
  container, tap a room for its bottom sheet, drag from the build tray to place rooms.
- **Bottom:** persistent nav (Hideout / Crew / City / Shop / Upgrades) outside a run-cycle
  moment, replaced conceptually during an active cycle by the contextual **phase button**
  (Shop → Build → Crew → Event → Threat → Raid → Reward) that always tells the player the one
  next action.

Implemented 1:1 in the prototype: `#resbar`, `#stage`/`#viewport`/`#grid`, `#bottomnav`,
`#phaseBtn`, `#buildBar`.

---

## 7. The Grid & Room Shapes

The hideout is a **grid** (`COLS×ROWS`, prototype uses 7×11) but the grid is only emphasized
visually in **Build Mode** — otherwise cells disappear behind the diorama art.

Base unit: **Cell**. Rooms occupy 1–6 cells in shapes: `1×1, 1×2, 2×1, 2×2, 2×3, 3×2, L, T`
(`SHAPES` table in code), all rotatable in 90° steps (`rotN`).

**Expansion is not "get a free rectangle."** When the player earns an expansion, they are
offered **3 random multi-cell shapes** and must choose one, then choose *where* to attach it —
validated so it (a) stays in bounds, (b) never overlaps the entrance or existing rooms, and
(c) must touch the already-unlocked footprint (no floating, unreachable islands). This is what
makes every run's hideout shape different even with the same room catalog.

Implemented: `EXPANSION_POOL`, `openExpansionPicker()`, `armExpansion()`, validated placement
in `expansionClickHandler()`.

---

## 8. Room Catalog

Every room carries: id, name (EN+AR), category, shape, power cost/output, crew capacity, base
effect, rarity, upgrade cost, and participates in the synergy system (§9). 28 rooms are
implemented across all seven categories from the brief:

| Category | Color | Rooms implemented |
|---|---|---|
| UTILITY | yellow | Generator, Battery Room, Ventilation, Maintenance |
| SUPPORT | green | Bedroom, Kitchen, Lounge, Clinic |
| TECH | cyan | Intel Room, Server Room, Surveillance, Hacker Lab |
| PRODUCTION | orange | Workshop, Parts Storage, Repair Bay |
| DEFENSE | red | Guard Room, Security Station, Armory |
| ECONOMY | gold | Vault, Storage, Front Business |
| SPECIAL | violet | Panic Room, War Room, Control Room, Black Market, Secret Vault |

Not yet in the prototype's data table but designed and easy to slot in with the same schema:
Trap Control, Underground Tunnel (full mechanical treatment — see §14 Traps backlog).

Each room's `desc` field carries its one-line functional description shown in its info sheet;
`cost` drives shop price; `rarity` drives shop draw weighting (`weightedRoom()`).

---

## 9. Synergy System

Rooms are never isolated. `SYN` is a data table of `{a, b, kind: bonus|penalty, label, pct,
stat}` rules; `computeRoomState()` scans every pair of **orthogonally-adjacent placed rooms**
each render and returns bonuses/penalties per room, which the economy tick (§12) reads to scale
production/healing/etc. Implemented pairs mirror the brief's examples:

- Workshop + Storage/Parts Room → faster Parts production (+20%)
- Workshop + Generator → +10% production
- Workshop + Clinic → −10% recovery (noise)
- Clinic + Bedroom → +15% recovery
- Generator + Maintenance → +15% efficiency
- Generator + Bedroom → morale penalty (noise)
- Intel Room + Control Room → better threat intel
- Armory + Guard Room → +20% defense
- Black Market + Security Station → suspicion (Heat) penalty
- Front Business + Lounge → +15% cash (good atmosphere)

Vault/Secret Vault get a special case instead of a pair rule: `distFromEntrance()` — the
farther from the entrance, the safer, shown directly in the room's info sheet as a
safe/at-risk pill. This operationalizes §17 of the brief ("vault location is a real decision")
without needing a full explicit door-graph editor yet.

Visual feedback: rooms flash a green ring (`pulseSyn`) or red ring (`pulseWarn`) and a small
▲N / ▼N badge shows bonus/penalty count on the room card, so the player can read their layout's
health without opening every sheet.

---

## 10. Power Grid

`computePower()` sums produced vs. required; `applyPowerPriority()` auto-shuts down the lowest
category-priority consuming rooms when required exceeds produced, in this order (highest
priority kept alive first): **Defense → Support → Economy → Tech → Production → Special →
Utility**. Powered-down rooms render dim (`inactive` class), stop producing/healing, and fight
at half effectiveness in a raid (`roomDefenseWeight`).

**Player-set priority (§14) is implemented:** every room carries a `priority` of
high / normal / low, set from its info sheet. Shutdown order is the player's tier first,
category order only as a tiebreak, so "keep Security alive, drop the Workshop" is a real
instruction the player gives rather than a fixed rule.

**Battery buffer (§15) is implemented:** `batteryCharge` banks surplus power (10 per Battery
Room) and is drained to keep rooms alive through a deficit, which is what buys the player time
after a generator dies or a Power Surge lands. Charging/draining happens exactly once per cycle
in `runEconomyTick()` — `applyPowerPriority()` is a pure view computation, so re-rendering can
never silently burn stored power.

Traps also draw power, and an unpowered trap does nothing — a defensive layout that outruns its
generator quietly stops defending.

---

## 11. Doors, Hallways & the Raid Path

Rather than a separate door-placement tool, the prototype treats **any two orthogonally-adjacent
placed rooms as connected**, and any room touching the entrance as an entrance-adjacent node
(`buildGraph()`). This is the deliberate scope cut that keeps a real, working pathfinding-based
raid possible without a full door/hallway editor:

- `roomDefenseWeight(room)` gives DEFENSE-category rooms (and Guard Rooms scaled by assigned
  crew) a much higher "resistance" weight.
- `findPath(targetUid)` runs Dijkstra from the entrance to the raid's objective room, so
  attackers **actually route around your strongest defenses if a weaker path exists** — exactly
  the strategic layout tension in the brief's §17 example (a Vault directly behind the entrance
  is undefended; a Vault behind Security → Hallway → Guard Room is genuinely safer).

### Traps (§53) — shipped

Six traps install onto a placed room (max 2 per room), each with a cash cost, a power draw and
a cooldown analogue (one-shot traps are consumed once they fire):

| Trap | Effect |
|---|---|
| Security Door 🚪 | permanent extra resistance, small damage |
| Alarm 🔔 | +1 tactical command every raid |
| Smoke System 💨 | −35% attacker damage inside that room |
| Barricade 🧱 | resistance with no power draw, but consumed on use |
| EMP Device 📡 | heavy one-shot hit when attackers enter |
| Decoy Room 🎭 | **negative** path weight — lures attackers in, then hurts them |

The Decoy is the interesting one: `weight` feeds the attacker's pathfinding, so a positive
weight makes a room look dangerous and routes attackers *around* it, while the Decoy's negative
weight makes a wing look abandoned and pulls them *in*. A decoy projects an "aura" onto
adjacent rooms as well — without that, the detour through a decoy always costs an extra hop and
no attacker would ever take the bait, making the trap decorative. Verified in a headless test:
with two separated wings, the raid path flips from the left wing to the trapped right wing the
moment a Decoy is installed, and the EMP then fires for real damage.

**Still backlog:** traps attach to a *room*, not to a specific *connection* between two rooms.
Per-door placement would let door choice be independent of room choice — a natural v2.

---

## 12. Cycle Loop

Each run advances through cycles:

```
HIDEOUT → SHOP → BUILD → CREW → EVENT → THREAT PREVIEW → RAID → REWARD → next cycle
```

`advancePhase()` drives this state machine; every phase either resolves itself (an event choice
auto-advances) or exposes one clear button (`#shopDoneBtn`, `#crewDoneBtn`, `#buildExit` +
phase button, `#startRaidBtn`, `#rewardNext`) so the player is never blocked on a hidden
affordance. `runEconomyTick()` runs once per cycle (Cash/Parts/Intel production, Clinic
healing, morale drift, Heat drift) before the Event fires.

---

## 13. Crew

Characters are not cards floating in a menu — every crew member has a `room` field and is
rendered as a token physically inside that room. Schema: name, role, hp/maxHp, dmg, def,
trait `{name, desc}`, flaw `{name, desc}`, morale, loyalty, level, rarity, injured flag.

**Roles implemented:** Enforcer, Guard, Hacker, Mechanic, Medic, Scout, Driver, Fixer, Leader
(`ROLES` table) — matching §19 exactly. Recruited crew get a randomized trait/flaw pair per
role (`randomCrew()`), e.g. Enforcer → *Lone Wolf* (+30% damage alone in a room, implemented
and checked during combat) / *Short Temper*. Rarity is on the character record for future
tuning but the prototype does not yet gate raw power by rarity — see backlog.

**Backlog:** the brief's relationships graph (Friends/Rivals/Partners/Mentor/Grudge, §22) and
loyalty-driven betrayal/attrition arcs (§23) are designed but not implemented — they're a
content-and-tuning-heavy system best built once the core loop is validated, not before.

---

## 14. Raid Combat

`startRaid()` picks an objective (Vault/Generator/Intel/Workshop/Control Room/a crewed room,
weighted by what actually exists in the base — §35), resolves the shortest-resistance path to
it, and **steps room-by-room down that path on a timer** (`raidTick()`), each step:

1. Defenders assigned to that room deal damage to the attacker's pooled HP (scaled by
   category, Armory adjacency, Lone-Wolf trait, powered-down state).
2. If the attacker survives, they strike back at a random defender in that room (can injure and
   evacuate a crew member — permanent death is intentionally *not* implemented, per §55: crew
   go to `injured` state instead of dying).
3. The room is marked cleared (green outline) and the attacker advances to the next room on the
   path.

**Tactical Commands** (§32–33): the player gets a pool of 3 (4 with an active Control Room) —
Lockdown, Rally, Overclock, Medkit, Fall Back, Decoy, Emergency Power — each implemented with a
real, if simplified, combat effect (`useTactical()`), spendable live during the raid's timed
resolution, matching the brief's "≈80% auto-combat, ≈20% tactical" ratio: commands blunt or
delay, they never substitute for a good layout.

Raids run as **multiple independent squads** (`RAID.squads`), each with its own entry point,
HP pool, path and progress. A single squad is the normal case; the structure exists because
some bosses breach from two directions at once. Any squad reaching the objective ends the raid
as a breach; the defenders only win by destroying *all* squads.

**Threat Preview** (§36) gates information behind Intel/Surveillance/War Room presence — a
base with no Intel Room only sees "something is coming," a well-built one sees the objective
and rough attacker strength. From the preview the player can jump straight to the Path overlay
to inspect the route before committing.

**Loss states** are graded, not binary: partial loss on defeat (stolen cash / disabled
generator / drained intel, scaled by objective) vs. a `checkGameOver()` run-ending state only
when the whole crew is down or the base is destitute — matching §54–55's "minor / serious /
run-ending" ladder.

---

## 15. Heat & Economy

Four resources only — **Cash, Respect, Intel, Parts** — deliberately no fifth "gacha" currency,
per §44. **Heat** is a separate 0–100 risk meter (not spent) that scales raid frequency/strength
*and* rewards together (win more when Heat is high), drifts down each cycle, and rises with
district danger level and aggressive event choices — implementing the brief's risk/reward
intent directly rather than as a pure penalty.

---

## 16. City & Districts

`DISTRICTS` implements the six named zones (Old Block → Neon District → Industrial Zone →
Docks → Downtown → The Heights) as a light, functional structure: each carries a threat level
that scales raid difficulty/reward and a cycle-count gate, shown in a City tab list.

### Bosses (§47–51) — shipped

A boss appears every 5th cycle and rotates through five kits. Each one **changes a rule**
rather than just carrying more HP:

| Boss | Rule it changes |
|---|---|
| BREAKER 🔨 | forces the objective to the Generator — power itself is the target |
| THE TWINS 👥 | two squads breach from two different points at once (front door + the least-defended rear room) |
| THE GRID 🕸️ | a Power Surge every 3 ticks knocks rooms offline mid-raid |
| THE GHOST 👻 | defeats the Threat Preview entirely — no path, no objective, no Intel |
| THE COLLECTOR 🎩 | ignores objective types and walks to the single most valuable room you own |

Verified by driving each kit directly in a headless test: Breaker retargets the generator, the
Twins spawn two squads with distinct entry labels and path lengths, the Grid logs real surges
and takes rooms offline, and the Collector correctly picks the highest-value room by
cost × rarity × level.

**Still backlog:** per-district enemy rosters, unique room unlocks and a district-specific boss
roster (each district currently draws from the same five kits).

---

## 17. Meta-Progression

Deliberately light, per §56: on a run-ending failure the player banks **Legacy** (derived from
final Respect + cycles survived) into `META` (persisted in `localStorage` under
`hideout_meta_v1`, independent of the run save), spendable in the Upgrades tab on small
permanent conveniences (currently: one extra shop/inventory-adjacent slot). This intentionally
stops short of the large permanent power multipliers the brief explicitly warns against
("don't make the first runs impossible next to later ones — skill must still matter").

Run start (§57): pick **Leader** (3 options, each a real Leader-role crew member with a
trait/flaw) → pick **Front Business** (6 options, each with a real starting-resource bonus) →
begin. Implemented in the boot/setup screen.

---

## 18. Quality-of-Life

Implemented: rotate-before-placing in Build Mode, room/crew bottom-sheet inspectors, live
synergy/penalty badges on room cards, toast feedback for every meaningful action, autosave to
`localStorage` after every state-mutating action (`save()`), resize-responsive grid sizing.

**Overlays (§60) — shipped.** Three toggles on the left edge of the hideout view:

- **⚡ Power** — per-room draw/output and priority tier, dim for anything shut off, with a
  produced/used/battery readout in the HUD.
- **🧭 Path** — draws the numbered route attackers would actually take through the current
  layout, with the objective marked in red and off-path rooms dimmed. This is the single most
  important screen in the game: it teaches the core pillar ("a Vault one step from the door is
  not a Vault") without a word of tutorial text, and it is reachable straight from the Threat
  Preview so the player can inspect the route *before* committing to the raid.
- **⚠️ Threat** — flags concrete weaknesses: a Vault too close to the entrance, a Defense room
  with no power, a room on the attack path with neither crew nor traps.

**Build-mode Undo (§60) — shipped:** a 12-deep snapshot stack covering room placement, trap
installation and expansions.

Still backlog from §60: Auto-Sort *suggestion* (explicitly not an auto-solver, per the brief),
side-by-side item Compare, and item Lock/Freeze in the shop.

---

## 19. What Shipped vs. What's Backlog

**Shipped in `hideout.html` (playable now):**
Portrait mobile shell · resource bar · grid hideout with irregular room shapes & rotation ·
validated expansion-shape offers · 28-room catalog across all 7 categories · adjacency synergy
& penalty system with visual feedback · power grid with player-set priority tiers and a battery
buffer · 6 traps incl. a path-luring Decoy Room · living crew with roles/traits/flaws/morale/
loyalty · room/crew inspector sheets · Shop with reroll & rarity weighting · full
Shop→Build→Crew→Event→Threat→Raid→Reward cycle loop · 7 random events with branching choices ·
Dijkstra pathfinded, multi-squad raid combat that respects player layout · 7 tactical commands
usable live during a raid · 5 distinct rule-changing boss kits · graded win/partial-loss/
run-ending outcomes · Power/Path/Threat overlays · build-mode undo · Heat risk/reward meter ·
4-currency economy · 6-district City structure with cycle-gated unlocks · Leader/Front-Business
run setup · cross-run Legacy meta-progression · full localStorage autosave/resume with
migration of older saves.

**Explicitly deferred (clear next milestones, not forgotten):** final diorama art & character
animation (current build uses a functional emoji/color placeholder), sound design & music,
equipment/inventory slots on individual crew members, per-district unique content
(enemies/rooms/events) and per-district boss rosters, traps attached to individual doors rather
than rooms, relationship graph between crew members, Codex/Collection screen, and Android
packaging (the repo already has a `build-android.yml` pattern from its other game that
`hideout.html` can reuse once art/content are further along).

## 21. Verification

The prototype is exercised by headless-browser tests rather than by eyeball alone:

- a 5-cycle full-loop run (buy → place rooms and traps → expand → assign crew → event → raid
  with tactical commands → reward), ending with a page reload to confirm the save resumes;
- a boss harness that drives all five kits directly and asserts each one changes its rule;
- a trap harness with two separated wings that asserts the Decoy Room actually flips the
  attacker's chosen route and that its payload fires.

All three run clean with zero console/page errors.

---

## 20. File Map

- `/hideout.html` — the entire playable prototype (markup, styles, game logic; no external
  dependencies, so it runs by opening the file directly or hosting it statically).
- `/docs/HIDEOUT_GDD.md` — this document.
