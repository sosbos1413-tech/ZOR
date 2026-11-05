/*
 * Procedural SVG art: every unit/hero gets an original emblem built from its
 * world colour, world glyph, role icon and tier ring. No external images.
 */
(function () {
  const AMB = (globalThis.AMB = globalThis.AMB || {});

  const ICONS = {
    shield: '<path d="M12 2.5l7.5 3v5.8c0 4.8-3.2 8.6-7.5 10.2-4.3-1.6-7.5-5.4-7.5-10.2V5.5z" fill="currentColor" opacity=".9"/>',
    sword: '<path d="M19.5 3.5l1 1-10 10 1.6 1.6-1.4 1.4-1.6-1.6-3.6 3.6-1.4-1.4 3.6-3.6-1.6-1.6 1.4-1.4 1.6 1.6z" fill="currentColor"/>',
    dagger: '<path d="M20.5 3.5l-3 7.5-5 5-3.5-3.5 5-5zM8 14.5l1.5 1.5-4.5 4.5-1.5-1.5z" fill="currentColor"/>',
    orb: '<circle cx="12" cy="12" r="6.5" fill="currentColor" opacity=".85"/><circle cx="9.5" cy="9.5" r="2" fill="#fff" opacity=".7"/><circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" stroke-width="1.2" stroke-dasharray="2 2.5"/>',
    bow: '<path d="M6 2.5c9 3 9 16 0 19" fill="none" stroke="currentColor" stroke-width="2"/><path d="M6 2.5v19" stroke="currentColor" stroke-width="1"/><path d="M3 12h16m-3-3l3 3-3 3" fill="none" stroke="currentColor" stroke-width="2"/>',
    cross: '<path d="M9.5 3h5v6.5H21v5h-6.5V21h-5v-6.5H3v-5h6.5z" fill="currentColor"/>',
    wings: '<path d="M11.4 2.6C6.6 3.6 2.6 7.6 1.6 14.2c2-1.6 4-2.2 5.8-1.8-1.8 1.5-2.4 3.9-2 6 1.6-1.7 3.4-2.3 5-1.9-.8 1.5-.6 3.4.6 4.8.9-2.3 1.2-9.6 0-18.7z" fill="currentColor"/><path d="M11.4 2.6C6.6 3.6 2.6 7.6 1.6 14.2c2-1.6 4-2.2 5.8-1.8-1.8 1.5-2.4 3.9-2 6 1.6-1.7 3.4-2.3 5-1.9-.8 1.5-.6 3.4.6 4.8.9-2.3 1.2-9.6 0-18.7z" transform="matrix(-1 0 0 1 24 0)" fill="currentColor"/>',
    crown: '<path d="M3 18.5l1.6-11 5 4.6L12 4.5l2.4 7.6 5-4.6 1.6 11z" fill="currentColor"/><rect x="3" y="19.3" width="18" height="2" rx="1" fill="currentColor"/>',
    wind: '<path d="M3 8h11a3 3 0 1 0-3-3M3 12h15a3 3 0 1 1-3 3M3 16h8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
    fang: '<path d="M5 4h14l-3 9-2-4-2 11-2-11-2 4z" fill="currentColor"/>',
    eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="3.2" fill="currentColor"/>',
    note: '<path d="M9 18V5l11-2v13" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="6.5" cy="18" r="2.5" fill="currentColor"/><circle cx="17.5" cy="16" r="2.5" fill="currentColor"/>',
    star: '<path d="M12 2.5l2.8 6.3 6.7.6-5.1 4.5 1.5 6.6L12 17l-5.9 3.5 1.5-6.6-5.1-4.5 6.7-.6z" fill="currentColor"/>',
    gold: '<circle cx="12" cy="12" r="8.5" fill="#ffc94a"/><circle cx="12" cy="12" r="5.8" fill="none" stroke="#b9851a" stroke-width="1.6"/>',
    essence: '<path d="M12 2.5l6 9.5-6 9.5-6-9.5z" fill="#8ff0ff"/><path d="M12 6l3.6 6L12 18l-3.6-6z" fill="#3aa9e0"/>',
    flame: '<path d="M12 2.2c1.2 3.6 5.3 5.6 5.3 10.4a5.3 5.3 0 0 1-10.6 0c0-2.1 1-3.4 2.1-4.4.2 1.7.9 2.5 1.8 2.8C10.1 7.9 10.4 5 12 2.2z" fill="currentColor"/>',
    moon: '<path d="M15.6 3A9.2 9.2 0 1 0 21 14.2 7.6 7.6 0 0 1 15.6 3z" fill="currentColor"/>',
    bolt: '<path d="M13.6 1.8L5 13.6h5.6L9.4 22.2 19 9.6h-5.9z" fill="currentColor"/>',
    leaf: '<path d="M20.5 3.5C10.5 3.5 4.5 8.6 4.5 15.4c0 1.6.4 3 1.1 4C6.8 14.6 10 11.6 14.6 9.6 11 12.2 8.6 15.2 7.8 20c1.2.7 2.5 1 3.8 1C18 21 20.5 13 20.5 3.5z" fill="currentColor"/>',
    burst: '<path d="M12 1.5l2.2 6.3 6.3-2.2-2.2 6.3 6.2 2.4-6.2 2.4 2.2 6.3-6.3-2.2L12 22.5l-2.2-6.3-6.3 2.2 2.2-6.3L1.5 12l6.2-2.4-2.2-6.3 6.3 2.2z" fill="currentColor"/>',
    blast: '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M12 5.5l1.8 4.7 4.7 1.8-4.7 1.8L12 18.5l-1.8-4.7L5.5 12l4.7-1.8z" fill="currentColor"/>',
    slash: '<path d="M4.5 3l5.5 18M10.5 3l5.5 18M16.5 3l4 13" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"/>',
    snow: '<path d="M12 2v20M3.4 7l17.2 10M3.4 17L20.6 7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><circle cx="12" cy="12" r="2.6" fill="currentColor"/>',
    drop: '<path d="M12 2.4C8 8 5.4 11 5.4 14.6a6.6 6.6 0 0 0 13.2 0C18.6 11 16 8 12 2.4z" fill="currentColor"/>',
    skull: '<path fill-rule="evenodd" d="M12 3a8 8 0 0 0-8 8c0 2.7 1.3 4.5 3 5.6V20h3v-2h4v2h3v-3.4c1.7-1.1 3-2.9 3-5.6a8 8 0 0 0-8-8zM9 9.4a1.9 1.9 0 1 0 .01 0zm6 0a1.9 1.9 0 1 0 .01 0z" fill="currentColor"/>',
    target: '<circle cx="12" cy="12" r="6.8" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M12 1.5v6M12 16.5v6M1.5 12h6M16.5 12h6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><circle cx="12" cy="12" r="1.9" fill="currentColor"/>',
    arrows: '<path d="M3.5 19L20 5M3.5 12H20.5M3.5 5L20 19" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><path d="M20.5 3.5v5h-5zM21.5 12l-4.5-3v6zM20.5 20.5v-5h-5z" fill="currentColor"/>',
    taunt: '<path d="M12 2.5l7.5 3v5.8c0 4.8-3.2 8.6-7.5 10.2-4.3-1.6-7.5-5.4-7.5-10.2V5.5z" fill="currentColor"/><path d="M12 7.5v6.2" stroke="#000" stroke-width="2.4" stroke-linecap="round"/><circle cx="12" cy="17" r="1.4" fill="#000"/>',
    healall: '<circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2"/><path d="M10 6h4v4h4v4h-4v4h-4v-4H6v-4h4z" fill="currentColor"/>',
    gem: '<path d="M12 2l8 9-8 11-8-11z" fill="currentColor"/><path d="M4 11h16M12 2l-3 9 3 11 3-11z" fill="none" stroke="#000" stroke-width=".9" opacity=".45"/>',
    coin: '<circle cx="12" cy="12" r="9" fill="currentColor"/><circle cx="12" cy="12" r="6" fill="none" stroke="#000" stroke-width="1.4" opacity=".45"/>',
    heart: '<path d="M12 20.5S3 15 3 8.8A4.6 4.6 0 0 1 12 6.6a4.6 4.6 0 0 1 9 2.2C21 15 12 20.5 12 20.5z" fill="currentColor"/>',
  };
  const ROLE_ICON = { guardian: 'shield', fighter: 'sword', assassin: 'dagger', mage: 'orb', marksman: 'bow', support: 'wings', hero: 'crown' };
  const TIER_RING = { 1: '#d9cfbd', 2: '#3d9bf0', 3: '#ffc21a' };

  function icon(name, cls) {
    return `<svg class="ic ${cls || ''}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ICONS.star}</svg>`;
  }

  function hash(str) { let h = 0; for (const c of str) h = (h * 31 + c.charCodeAt(0)) | 0; return Math.abs(h); }

  /** Emblem portrait for a unit def or hero def. */
  function portrait(def, opts) {
    opts = opts || {};
    const W = AMB.DATA.WORLDS[def.world];
    const isHero = !def.role;
    const role = isHero ? 'hero' : def.role;
    const ring = isHero ? '#ffe28a' : TIER_RING[def.tier];
    const h = hash(def.id);
    const gid = 'g' + def.id + (opts.k || '');
    const rot = h % 360;
    // a few deterministic "rift shards" per character for a unique silhouette
    let shards = '';
    for (let i = 0; i < 4; i++) {
      const a = ((h >> (i * 3)) % 360) * Math.PI / 180;
      const r1 = 18 + ((h >> i) % 10), r2 = 40 + ((h >> (i + 2)) % 8);
      const x1 = 50 + Math.cos(a) * r1, y1 = 50 + Math.sin(a) * r1;
      const x2 = 50 + Math.cos(a + 0.25) * r2, y2 = 50 + Math.sin(a + 0.25) * r2;
      const x3 = 50 + Math.cos(a - 0.2) * r2, y3 = 50 + Math.sin(a - 0.2) * r2;
      shards += `<path d="M${x1.toFixed(1)} ${y1.toFixed(1)}L${x2.toFixed(1)} ${y2.toFixed(1)}L${x3.toFixed(1)} ${y3.toFixed(1)}z" fill="${W.color}" opacity=".35"/>`;
    }
    // manga-panel frame: cut corners for units, octagon for heroes
    const imgSrc = AMB.IMAGES && AMB.IMAGES[def.id];
    const hasChar = (AMB.chars && AMB.chars.has(def.id)) || !!imgSrc;
    const art = imgSrc ? `<image href="${imgSrc}" x="0" y="0" width="100" height="100" preserveAspectRatio="xMidYMin slice"/>`
      : hasChar ? AMB.chars.draw(def.id)
      : `<g transform="translate(26 24) scale(2.0)" color="#fff" style="filter:drop-shadow(2px 2px 0 #000)">${ICONS[ROLE_ICON[role]]}</g>`;
    // small role badge (units only) so the role stays readable now that the art is a face
    const badge = !isHero && hasChar
      ? `<g transform="translate(8 66)"><circle cx="11" cy="11" r="11" fill="#000"/><circle cx="11" cy="11" r="9" fill="${ring}"/><g transform="translate(4 4) scale(.58)" color="#121010">${ICONS[ROLE_ICON[role]]}</g></g>`
      : '';
    const frame = isHero ? 'M30 3H70L97 30V70L70 97H30L3 70V30Z' : 'M3 20L20 3H97V80L80 97H3Z';
    if (opts.bare) {
      return `<svg class="portrait bare" viewBox="0 0 100 100" preserveAspectRatio="${imgSrc ? 'xMidYMid' : 'xMidYMin'} slice" aria-label="${def.name}">
      <defs><linearGradient id="${gid}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${W.color}"/><stop offset="1" stop-color="#1a1412"/></linearGradient>
      <pattern id="${gid}h" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(${rot % 90})"><circle cx="2.5" cy="2.5" r="1.1" fill="#000" opacity=".28"/></pattern></defs>
      <rect width="100" height="100" fill="url(#${gid})"/><rect width="100" height="100" fill="url(#${gid}h)"/>
      <g transform="rotate(${rot} 50 50)">${shards.replace(/opacity=".35"/g, 'opacity=".5" stroke="#000" stroke-width="1"').replace(new RegExp(W.color, 'g'), '#fff6dc')}</g>
      <text x="50" y="72" text-anchor="middle" font-size="58" fill="#000" opacity=".2" font-weight="900">${W.glyph}</text>${art}</svg>`;
    }
    return `<svg class="portrait ${opts.cls || ''}" viewBox="0 0 100 100" aria-label="${def.name}">
      <defs>
        <linearGradient id="${gid}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${W.color}"/><stop offset="1" stop-color="#1a1412"/></linearGradient>
        <pattern id="${gid}h" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(${rot % 90})"><circle cx="2.5" cy="2.5" r="1.1" fill="#000" opacity=".28"/></pattern>
        <clipPath id="${gid}c"><path d="${frame}"/></clipPath>
      </defs>
      <g clip-path="url(#${gid}c)">
        <rect width="100" height="100" fill="url(#${gid})"/>
        <rect width="100" height="100" fill="url(#${gid}h)"/>
        <g transform="rotate(${rot} 50 50)">${shards.replace(/opacity=".35"/g, 'opacity=".55" stroke="#000" stroke-width="1"').replace(new RegExp(W.color, 'g'), '#fff6dc')}</g>
        <text x="50" y="72" text-anchor="middle" font-size="58" fill="#000" opacity=".22" font-weight="900">${W.glyph}</text>
        ${art}
      </g>
      ${badge}
      <path d="${frame}" fill="none" stroke="#000" stroke-width="6" stroke-linejoin="round"/>
      <path d="${frame}" fill="none" stroke="${ring}" stroke-width="2.5" stroke-linejoin="round" transform="translate(50 50) scale(.9) translate(-50 -50)"/>
    </svg>`;
  }

  function stars(n) { return n ? `<span class="stars s${n}">${'★'.repeat(n)}</span>` : ''; }

  const WORLD_ICON = { ember: 'flame', tide: 'moon', neon: 'bolt', sylvan: 'leaf' };
  const SKILL_ICON = { nuke: 'burst', cleave: 'slash', aoe: 'blast', stunAoe: 'snow', stunStrike: 'bolt', burn: 'flame', drain: 'drop', execute: 'skull',
    snipe: 'target', multishot: 'arrows', taunt: 'taunt', shieldSelf: 'shield', healSelf: 'heart', healLowest: 'cross', healAll: 'healall', hasteAllies: 'wind' };
  const STAT_ICON = { atkPct: 'sword', hpPct: 'heart', dr: 'shield', asPct: 'wind', startMana: 'orb', skillPower: 'burst', lifesteal: 'drop', range: 'target', crit: 'dagger' };
  AMB.art = { icon, portrait, stars, ROLE_ICON, TIER_RING, ICONS, WORLD_ICON, SKILL_ICON, STAT_ICON };
})();
