/*
 * Hand-designed character busts, drawn as layered SVG (manga ink style).
 * Each character is a small spec (skin, hair style/colour, eyes, outfit,
 * collar, accessories, prop). Add a character = add one entry to SPEC.
 * All designs are original.
 */
(function () {
  const AMB = (globalThis.AMB = globalThis.AMB || {});
  const K = 'stroke="#000" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"';
  const KT = 'stroke="#000" stroke-width="1.4" stroke-linejoin="round" stroke-linecap="round"';

  // ------------------------------------------------------------ specs
  const S = (o) => Object.assign({ skin: '#f2c9a5', eyeStyle: 'sharp', brow: 'fierce', mouth: 'smirk', collar: 'v', extra: [], prop: null }, o);
  const SPEC = {
    // ---- heroes
    // Heroes: one clear personality each (brash / calm leader / mysterious / stoic guardian)
    kagira: S({ skin: '#e8b98f', hair: '#ff4f1a', hair2: '#ffd24a', hs: 'flame', eye: '#ffb300', eyeStyle: 'round', brow: 'fierce', mouth: 'grin',
      outfit: '#2b1612', trim: '#ff7a2a', collar: 'armor', extra: ['goggles', 'plaster', 'earring', 'scarf'], acc: '#ffd24a', cape: '#7a1f12', aura: true, prop: 'sword' }),
    merin: S({ skin: '#f4d6c0', hair: '#1fb2c6', hs: 'swept', eye: '#7ff0ff', eyeStyle: 'narrow', brow: 'calm', mouth: 'smile', noBlush: false,
      outfit: '#1b4d6b', trim: '#f2fbff', collar: 'robe', extra: ['tiara', 'shell', 'beauty', 'sidebraid'], acc: '#ffe28a', cape: '#2c7fa8', aura: true, prop: 'staff', top: 'crescent' }),
    zerokai: S({ skin: '#dfe6f0', hair: '#201a38', hs: 'hoodfringe', eye: '#39f0ff', eyeStyle: 'glow', brow: 'calm', mouth: 'smirk',
      outfit: '#12101f', trim: '#39f0ff', collar: 'hoodie', extra: ['monocle', 'circuit', 'mask2'], acc: '#39f0ff', aura: true, prop: 'orb' }),
    orath: S({ skin: '#8d5a3b', hair: '#3f6e2c', hs: 'bark', eye: '#9cff6a', eyeStyle: 'glow', brow: 'calm', mouth: 'none',
      outfit: '#3b2a1a', trim: '#6bd07a', collar: 'armor', extra: ['antlers', 'longbeard', 'moss', 'wrinkles'], beardC: '#dfe8d0', aura: true, prop: 'staff', top: 'leaf' }),

    // ---- Emberreach
    ash_ronin: S({ skin: '#e8b98f', hair: '#2a2a2a', hs: 'ponytail', eye: '#ff7a45', outfit: '#6b1f14', trim: '#d9d0c0', extra: ['headband'], acc: '#e0262f', prop: 'sword' }),
    forge_bulwark: S({ skin: '#c98e63', hair: '#7a5a48', hs: 'helm', eye: '#ff9d4a', eyeStyle: 'narrow', outfit: '#3a2a24', trim: '#ff7a45', collar: 'plate', extra: ['beard'], beardC: '#3a2a20', prop: 'hammer', mouth: 'none' }),
    spark_wraith: S({ skin: '#d9c9bd', hair: '#ff6a2a', hs: 'spiky', eye: '#ffee55', eyeStyle: 'glow', outfit: '#1a1210', trim: '#ff7a45', collar: 'high', extra: ['mask'], prop: 'daggers', mouth: 'none' }),
    pyre_archer: S({ hair: '#c2301a', hs: 'ponytail', eye: '#ffd24a', brow: 'calm', outfit: '#7a2a14', trim: '#ffcf4a', extra: ['markings'], prop: 'bow' }),
    caldera_seer: S({ skin: '#c98e63', hair: '#5a1a10', hs: 'hood', eye: '#ff5a2a', eyeStyle: 'glow', brow: 'calm', mouth: 'calm', outfit: '#4a1a14', trim: '#ff7a45', collar: 'robe', extra: ['markings'], prop: 'orb' }),

    // ---- Moontide
    wave_caller: S({ skin: '#f4d6c0', hair: '#3a8fe0', hs: 'twin', eye: '#8ff0ff', eyeStyle: 'round', brow: 'calm', mouth: 'smile', outfit: '#1f5f8a', trim: '#e8f7ff', collar: 'scarf', extra: ['shell'], prop: 'staff', top: 'crescent' }),
    coral_sentinel: S({ skin: '#e8b98f', hair: '#ff7a8a', hs: 'helm', eye: '#ffe38a', eyeStyle: 'narrow', brow: 'calm', mouth: 'calm', outfit: '#1b4d6b', trim: '#ff9fb0', collar: 'armor', extra: ['horns'], acc: '#ff9fb0', prop: 'shield' }),
    lunar_blade: S({ skin: '#e9e3ee', hair: '#e8f0ff', hs: 'short', eye: '#b8c8ff', brow: 'calm', outfit: '#23305a', trim: '#c8d8ff', extra: ['moon'], prop: 'sword' }),
    mist_witch: S({ skin: '#f4d6c0', hair: '#7aa8d8', hs: 'bob', eye: '#c8f0ff', eyeStyle: 'round', brow: 'calm', mouth: 'smile', outfit: '#2a3a6a', trim: '#9fd0ff', collar: 'high', extra: ['witchhat'], hatC: '#2a3a6a', prop: 'orb' }),
    tide_priest: S({ skin: '#8d5a3b', hair: '#e8f7ff', hs: 'short', eye: '#7ff0ff', eyeStyle: 'narrow', brow: 'calm', mouth: 'calm', outfit: '#e8f7ff', trim: '#3ec9ff', collar: 'robe', extra: ['halo', 'beard'], beardC: '#e8f7ff', acc: '#ffe28a', prop: 'staff', top: 'cross' }),

    // ---- Neon-9
    grid_hound: S({ skin: '#e8b98f', hair: '#ff3fd0', hs: 'spiky', eye: '#39f0ff', eyeStyle: 'glow', outfit: '#1a1030', trim: '#ff3fd0', collar: 'hoodie', extra: ['catears', 'headphones', 'mask'], prop: 'daggers', mouth: 'none' }),
    pixel_sniper: S({ hair: '#2affc0', hs: 'bob', eye: '#ff3fd0', eyeStyle: 'visor', brow: 'none', outfit: '#101a2a', trim: '#2affc0', collar: 'high', prop: 'bow' }),
    firewall_unit: S({ skin: '#9aa6c0', hair: '#7a5ad0', hs: 'helm', eye: '#ff4a4a', eyeStyle: 'visor', brow: 'none', mouth: 'none', outfit: '#2a2040', trim: '#c45cff', collar: 'plate', extra: ['antenna', 'robot'], prop: 'shield' }),
    spectral_coder: S({ skin: '#d9e8f0', hair: '#c8a0ff', hs: 'long', eye: '#e8ffff', eyeStyle: 'round', brow: 'calm', mouth: 'smile', outfit: '#2a1a4a', trim: '#39f0ff', collar: 'hoodie', extra: ['glasses', 'headphones'], prop: 'orb' }),
    chrome_ronin: S({ skin: '#b8bcc8', hair: '#e8e8f0', hs: 'mohawk', eye: '#ff3fd0', eyeStyle: 'glow', outfit: '#1a1a2a', trim: '#c8c8d8', collar: 'armor', extra: ['scar', 'robot'], prop: 'sword' }),

    // ---- Elder Grove
    moss_warden: S({ skin: '#8d5a3b', hair: '#4a7a2a', hs: 'hood', eye: '#d8ff6a', eyeStyle: 'narrow', brow: 'calm', mouth: 'calm', outfit: '#3a4a2a', trim: '#8ccf5a', collar: 'armor', extra: ['leaves'], prop: 'shield' }),
    thorn_fox: S({ hair: '#e8832a', hs: 'wild', eye: '#ffd24a', outfit: '#3a5a2a', trim: '#8ccf5a', extra: ['foxears', 'markings'], prop: 'daggers' }),
    root_shaman: S({ skin: '#c98e63', hair: '#2a1a10', hs: 'long', eye: '#9cff6a', eyeStyle: 'glow', brow: 'calm', mouth: 'calm', outfit: '#4a2a1a', trim: '#6bd07a', collar: 'robe', extra: ['antlers', 'markings'], prop: 'staff', top: 'leaf' }),
    wild_stalker: S({ skin: '#c98e63', hair: '#1f4a22', hs: 'wild', eye: '#ffee55', eyeStyle: 'glow', outfit: '#2a3a1a', trim: '#8ccf5a', extra: ['mask', 'scar'], prop: 'daggers', mouth: 'none' }),
  };

  // ------------------------------------------------------------ hair
  const HAIR = {
    spiky: {
      back: 'M30 46 L25 27 L35 31 L36 13 L44 24 L50 8 L56 24 L64 13 L65 31 L75 27 L70 46 Z',
      front: 'M34 41 L34 28 L42 34 L46 23 L50 34 L55 23 L58 34 L66 28 L66 41 L60 35 L54 39 L50 33 L46 39 L40 35 Z',
    },
    long: {
      back: 'M31 42 C27 20 40 13 50 13 C60 13 73 20 69 42 L73 84 L60 74 L40 74 L27 84 Z',
      front: 'M34 43 C32 26 42 18 50 18 C58 18 68 26 66 43 C62 33 56 29 50 28 C44 29 38 33 34 43 Z M34 42 L32 66 L39 58 Z M66 42 L68 66 L61 58 Z',
    },
    bob: {
      back: 'M30 46 C26 22 40 14 50 14 C60 14 74 22 70 46 L69 66 L31 66 Z',
      front: 'M33 40 C33 26 41 19 50 19 C59 19 67 26 67 40 L67 31 L33 31 Z M34 30 C40 22 60 22 66 30 L66 40 L58 33 L50 39 L42 33 L34 40 Z',
    },
    ponytail: {
      back: 'M32 42 C30 20 42 13 50 13 C58 13 70 20 68 42 Z M60 22 C84 14 92 44 80 68 C78 50 72 38 62 34 Z',
      front: 'M34 41 C33 27 41 19 50 19 C60 19 67 27 66 41 C60 32 54 28 46 30 C42 32 38 35 34 41 Z',
    },
    twin: {
      back: 'M32 40 C30 20 42 13 50 13 C58 13 70 20 68 40 Z M33 34 C16 38 11 62 18 86 C25 70 30 58 35 48 Z M67 34 C84 38 89 62 82 86 C75 70 70 58 65 48 Z',
      front: 'M33 40 C33 26 41 19 50 19 C59 19 67 26 67 40 L67 31 L33 31 Z M34 30 C40 22 60 22 66 30 L66 40 L58 33 L50 39 L42 33 L34 40 Z',
    },
    mohawk: {
      back: 'M34 40 C34 28 42 22 50 22 C58 22 66 28 66 40 Z',
      front: 'M43 32 L42 12 L48 20 L50 2 L54 20 L58 10 L57 32 Z',
    },
    short: {
      back: 'M33 40 C31 20 41 14 50 14 C59 14 69 20 67 40 Z',
      front: 'M33 42 C31 24 41 17 50 17 C60 17 69 24 67 42 C62 31 56 26 50 27 C44 26 38 31 33 42 Z',
    },
    wild: {
      back: 'M26 52 L20 30 L31 33 L28 14 L41 24 L45 6 L53 21 L62 6 L66 23 L77 16 L73 34 L82 38 L74 52 Z',
      front: 'M33 42 L31 27 L39 33 L40 22 L47 31 L52 21 L56 32 L62 23 L63 33 L69 28 L67 42 L61 35 L56 40 L50 34 L44 40 L38 35 Z',
    },
    flame: {
      back: 'M30 46 C25 40 24 30 28 22 C30 27 33 30 36 31 C34 22 36 12 42 5 C44 13 47 17 50 19 C52 11 57 5 65 3 C62 12 63 19 67 23 C72 17 77 13 83 12 C79 21 77 30 73 36 C79 34 82 38 83 44 C77 44 72 46 70 48 Z',
      front: 'M33 42 C32 30 36 24 42 21 L40 30 L46 25 L48 33 L52 24 L55 32 L60 22 L61 31 L67 28 C68 33 67 38 67 42 L62 36 L57 40 L50 34 L43 40 Z M33 42 L31 53 L36 46 Z M67 42 L69 53 L64 46 Z',
      tips: 'M42 5 L46 15 L39 12 Z M65 3 L62 15 L69 12 Z M83 12 L76 21 L82 26 Z M28 22 L35 29 L26 31 Z',
    },
    swept: {
      back: 'M30 40 C25 20 38 12 50 12 C62 12 75 20 70 40 C74 56 72 72 77 90 C68 84 64 75 62 66 L38 66 C36 75 32 84 23 90 C28 72 26 56 30 40 Z',
      front: 'M34 44 C32 26 42 17 52 17 C62 17 68 26 66 40 C62 30 54 25 46 28 C42 34 38 40 34 44 Z M45 24 C38 30 36 40 34 54 C41 46 45 37 49 28 Z',
    },
    hoodfringe: {
      back: 'M20 84 C16 44 26 12 50 9 C74 12 84 44 80 84 Z',
      front: 'M33 42 C32 27 41 20 50 20 C59 20 68 27 67 42 C62 33 57 29 53 31 C52 40 48 49 43 56 C41 50 38 46 34 49 Z',
    },
    bark: {
      back: 'M18 86 C14 42 26 8 50 6 C74 8 86 42 82 86 Z',
      lines: 'M28 28 C26 44 26 58 28 72 M39 16 C37 32 37 46 38 58 M61 16 C63 32 63 46 62 58 M72 28 C74 44 74 58 72 72 M50 10 L50 22',
      front: 'M33 42 C32 27 41 20 50 20 C59 20 68 27 67 42 C62 31 38 31 33 42 Z',
    },
    ponytail2: null,
    hood: {
      back: 'M20 80 C17 40 28 11 50 9 C72 11 83 40 80 80 Z',
      front: 'M33 42 C32 27 41 20 50 20 C59 20 68 27 67 42 C62 31 38 31 33 42 Z',
    },
    helm: {
      back: '',
      front: 'M31 44 C28 22 39 12 50 12 C61 12 72 22 69 44 L65 37 L35 37 Z M46 12 L50 3 L54 12 Z',
    },
  };

  // ------------------------------------------------------------ pieces
  const shade = (d, o) => `<path d="${d}" fill="#000" opacity="${o || 0.16}"/>`;

  function bodyPath(sp) {
    return `<path d="M12 100 L15 84 C17 75 30 71 42 69.5 L50 75 L58 69.5 C70 71 83 75 85 84 L88 100 Z" fill="${sp.outfit}" ${K}/>` +
      shade('M50 75 L58 69.5 C70 71 83 75 85 84 L88 100 L50 100 Z');
  }

  function collar(sp) {
    const t = sp.trim, o = sp.outfit, sk = sp.skin;
    switch (sp.collar) {
      case 'high': return `<path d="M39 62 L39 76 L61 76 L61 62 L56 67 L44 67 Z" fill="${t}" ${K}/>`;
      case 'scarf': return `<path d="M37 66 C44 73 56 73 63 66 L65 76 C56 82 44 82 35 76 Z" fill="${t}" ${K}/><path d="M56 78 L63 96 L54 91 Z" fill="${t}" ${K}/>`;
      case 'armor': return `<circle cx="22" cy="82" r="12" fill="${t}" ${K}/><circle cx="78" cy="82" r="12" fill="${t}" ${K}/><path d="M42 70 L50 80 L58 70" fill="none" ${K}/><circle cx="22" cy="82" r="5" fill="${o}" opacity=".6"/><circle cx="78" cy="82" r="5" fill="${o}" opacity=".6"/>`;
      case 'robe': return `<path d="M42 69 L50 86 L38 100 L24 100 L33 80 Z M58 69 L50 86 L62 100 L76 100 L67 80 Z" fill="${t}" ${K}/><path d="M42 70 L50 84 L58 70 Z" fill="${sk}" ${K}/>`;
      case 'hoodie': return `<path d="M35 67 C44 77 56 77 65 67 L68 78 C56 87 44 87 32 78 Z" fill="${t}" ${K}/><path d="M46 80 L45 92 M54 80 L55 92" ${KT} fill="none"/>`;
      case 'plate': return `<path d="M28 82 L72 82 L77 100 L23 100 Z" fill="${t}" ${K}/><path d="M50 82 L50 100" ${KT}/><path d="M38 66 L38 76 L62 76 L62 66 L56 70 L44 70 Z" fill="${t}" ${K}/>`;
      default: return `<path d="M42 70 L50 84 L58 70 Z" fill="${sk}" ${K}/><path d="M40 69 L50 80 L44 69Z M60 69 L50 80 L56 69Z" fill="${t}" ${KT}/>`;
    }
  }

  function eyes(sp) {
    const c = sp.eye;
    if (sp.eyeStyle === 'visor') {
      return `<path d="M36 42.5 H64 V49.5 H36 Z" fill="#0d0d14" ${K}/><path d="M38 44 H62 V48 H38 Z" fill="${c}"/><path d="M40 44.8 H48" stroke="#fff" stroke-width="1.2" opacity=".8"/>`;
    }
    let out = '';
    [-1, 1].forEach((d) => {
      const sx = 50 + d * 7.6;
      const ry = { sharp: 3.3, round: 4.4, narrow: 2.4, glow: 3 }[sp.eyeStyle] || 3.3;
      if (sp.eyeStyle === 'glow') {
        out += `<ellipse cx="${sx}" cy="46" rx="4.9" ry="${ry}" fill="${c}" ${KT}/><ellipse cx="${sx}" cy="46" rx="2.5" ry="${ry - 0.9}" fill="#fff" opacity=".9"/>`;
      } else {
        const r = Math.min(3.3, ry);
        out += `<ellipse cx="${sx}" cy="46" rx="4.9" ry="${ry}" fill="#fff"/>` +
          `<circle cx="${sx}" cy="46.2" r="${r}" fill="${c}"/>` +
          `<path d="M${sx - r} 46 A${r} ${r} 0 0 1 ${sx + r} 46 Z" fill="#000" opacity=".28"/>` +
          `<circle cx="${sx}" cy="46.4" r="${r * 0.42}" fill="#000"/>` +
          `<circle cx="${sx - r * 0.45}" cy="45" r="${r * 0.36}" fill="#fff"/><circle cx="${sx + r * 0.4}" cy="47.6" r="${r * 0.18}" fill="#fff" opacity=".9"/>`;
      }
      // thick upper lash line with an outward flick (anime look)
      const top = 46 - ry;
      const tilt = sp.eyeStyle === 'round' ? 0.2 : 1.1;
      const yo = top - tilt * 0.4, yi = top + tilt * 0.4;
      out += `<path d="M${sx - d * 5.1} ${yi.toFixed(1)} Q${sx} ${(top - 1).toFixed(1)} ${sx + d * 5.1} ${yo.toFixed(1)} L${sx + d * 6.5} ${(yo - 1.3).toFixed(1)}" fill="none" stroke="#000" stroke-width="2.1" stroke-linecap="round"/>`;
      out += `<path d="M${sx - 3.6} ${(46 + ry).toFixed(1)} Q${sx} ${(46 + ry + 0.8).toFixed(1)} ${sx + 3.6} ${(46 + ry).toFixed(1)}" fill="none" stroke="#000" stroke-width=".7" opacity=".5"/>`;
      if (!sp.noBlush && sp.mouth !== 'none') out += `<ellipse cx="${50 + d * 11}" cy="53.2" rx="3" ry="1.5" fill="#ff6a7a" opacity=".32"/>`;
    });
    return out;
  }

  function brows(sp) {
    if (sp.brow === 'none') return '';
    const col = sp.hs === 'helm' || sp.hs === 'hood' ? '#000' : sp.hair;
    const mk = (d) => {
      const o = 50 + d * 12.5, i = 50 + d * 3;
      const yo = sp.brow === 'fierce' ? 40.6 : 41.4, yi = sp.brow === 'fierce' ? 43.2 : 41.4;
      return `M${o} ${yo} L${i} ${yi}`;
    };
    return `<path d="${mk(-1)} ${mk(1)}" stroke="${col}" stroke-width="2" stroke-linecap="round" fill="none"/><path d="${mk(-1)} ${mk(1)}" stroke="#000" stroke-width=".8" stroke-linecap="round" fill="none" opacity=".5"/>`;
  }

  function mouth(sp) {
    if (sp.mouth === 'none') return '';
    if (sp.mouth === 'grin') return `<path d="M42.5 54.5 Q50 67 57.5 54.5 Q50 58 42.5 54.5 Z" fill="#6b1414" ${KT}/><path d="M44.5 55.6 Q50 58.4 55.5 55.6 L54.8 57.4 Q50 59.6 45.2 57.4 Z" fill="#fff"/>`;
    const m = { smirk: 'M46 57 Q50 58.4 54.5 55.6', calm: 'M47 57.2 L53 57.2', smile: 'M46 56 Q50 60 54 56', fierce: 'M46 58 Q50 55.4 54 58' }[sp.mouth];
    return `<path d="${m}" fill="none" stroke="#000" stroke-width="1.5" stroke-linecap="round"/>`;
  }

  function accessory(a, sp) {
    const t = sp.acc || sp.trim, h = sp.hair;
    switch (a) {
      case 'headband': return `<path d="M33 33 C40 28 60 28 67 33 L67 38 C60 34 40 34 33 38 Z" fill="${t}" ${K}/><path d="M67 35 L81 41 L72 43 L83 50 L66 41 Z" fill="${t}" ${KT}/>`;
      case 'horns': return `<path d="M38 25 C31 19 29 10 33 3 C38 9 42 16 45 24 Z M62 25 C69 19 71 10 67 3 C62 9 58 16 55 24 Z" fill="${t}" ${K}/>`;
      case 'antlers': return `<g fill="none" stroke="#000" stroke-width="5.5" stroke-linecap="round"><path d="M40 24 L33 5 M36.5 14 L26 12 M34.5 9 L35 1"/><path d="M60 24 L67 5 M63.5 14 L74 12 M65.5 9 L65 1"/></g><g fill="none" stroke="#d9c9a6" stroke-width="3" stroke-linecap="round"><path d="M40 24 L33 5 M36.5 14 L26 12 M34.5 9 L35 1"/><path d="M60 24 L67 5 M63.5 14 L74 12 M65.5 9 L65 1"/></g>`;
      case 'foxears': return `<path d="M34 31 L28 6 L49 21 Z M66 31 L72 6 L51 21 Z" fill="${h}" ${K}/><path d="M35 27 L32 13 L44 22 Z M65 27 L68 13 L56 22 Z" fill="#fff3dc" ${KT}/>`;
      case 'catears': return `<path d="M34 30 L31 9 L47 22 Z M66 30 L69 9 L53 22 Z" fill="${h}" ${K}/><path d="M35 26 L33 15 L43 22 Z M65 26 L67 15 L57 22 Z" fill="${sp.trim}" ${KT}/>`;
      case 'mask': return `<path d="M36 52 C42 58 58 58 64 52 L64 63 C58 70 42 70 36 63 Z" fill="${sp.outfit}" ${K}/><path d="M42 59 L58 59 M42 63 L58 63" stroke="${sp.trim}" stroke-width="1.2" opacity=".8"/>`;
      case 'halo': return `<ellipse cx="50" cy="9" rx="17" ry="5" fill="none" stroke="#000" stroke-width="5.5"/><ellipse cx="50" cy="9" rx="17" ry="5" fill="none" stroke="${t}" stroke-width="2.8"/>`;
      case 'crown': return `<path d="M36 22 L37 11 L44 17 L50 7 L56 17 L63 11 L64 22 Z" fill="${t}" ${K}/>`;
      case 'scar': return `<path d="M58 40 L63 56" stroke="#000" stroke-width="3" stroke-linecap="round"/><path d="M58 40 L63 56" stroke="#c0393f" stroke-width="1.3" stroke-linecap="round"/><path d="M57 46 L62 44 M58 51 L63 49" stroke="#000" stroke-width="1"/>`;
      case 'markings': return `<path d="M37 51 L44 52.4 M63 51 L56 52.4 M50 27 L50 33" stroke="${sp.trim}" stroke-width="2" stroke-linecap="round" fill="none"/><path d="M37 51 L44 52.4 M63 51 L56 52.4" stroke="#000" stroke-width=".6" opacity=".6" fill="none"/>`;
      case 'headphones': return `<path d="M34 42 C33 10 67 10 66 42" fill="none" stroke="#000" stroke-width="6" stroke-linecap="round"/><path d="M34 42 C33 10 67 10 66 42" fill="none" stroke="${sp.trim}" stroke-width="3" stroke-linecap="round"/><rect x="28" y="40" width="8" height="15" rx="3" fill="${sp.trim}" ${K}/><rect x="64" y="40" width="8" height="15" rx="3" fill="${sp.trim}" ${K}/>`;
      case 'leaves': return `<path d="M36 25 C30 16 36 8 44 13 C43 20 41 24 36 25 Z M48 18 C44 8 52 2 58 9 C56 15 53 18 48 18 Z M62 26 C70 20 74 12 66 8 C60 12 59 20 62 26 Z" fill="#7bd46a" ${K}/>`;
      case 'glasses': return `<circle cx="42.5" cy="46" r="6.2" fill="#fff" fill-opacity=".18" ${K}/><circle cx="57.5" cy="46" r="6.2" fill="#fff" fill-opacity=".18" ${K}/><path d="M48.7 45.5 L51.3 45.5" stroke="#000" stroke-width="1.6"/>`;
      case 'witchhat': return `<path d="M36 27 C40 16 44 8 50 -4 C52 6 58 18 64 27 Z" fill="${sp.hatC || '#2a3a6a'}" ${K}/><path d="M23 30 C36 22 64 22 77 30 C64 34 36 34 23 30 Z" fill="${sp.hatC || '#2a3a6a'}" ${K}/><path d="M38 25 C45 22 55 22 62 25" stroke="${t}" stroke-width="3" fill="none"/>`;
      case 'beard': return `<path d="M36.5 51 C36 65 42 72 50 72 C58 72 64 65 63.5 51 C59 58 41 58 36.5 51 Z" fill="${sp.beardC || sp.hair}" ${K}/>`;
      case 'shell': return `<circle cx="35" cy="54" r="2.8" fill="#fff" ${KT}/><circle cx="65" cy="54" r="2.8" fill="#fff" ${KT}/>`;
      case 'antenna': return `<path d="M56 21 L61 3" stroke="#000" stroke-width="4" stroke-linecap="round"/><path d="M56 21 L61 3" stroke="${t}" stroke-width="1.8" stroke-linecap="round"/><circle cx="61" cy="3" r="3" fill="#ff4a4a" ${KT}/>`;
      case 'moon': return `<path d="M62 36 C58 36 56 40 58 43 C58 40 61 38 64 39 C64 37.5 63.3 36.4 62 36 Z" fill="${t}" stroke="#000" stroke-width=".8"/>`;
      case 'robot': return `<path d="M36 52 L44 52 M56 52 L64 52" stroke="#000" stroke-width="1" opacity=".5"/><circle cx="35" cy="48" r="2.2" fill="${sp.trim}" ${KT}/><circle cx="65" cy="48" r="2.2" fill="${sp.trim}" ${KT}/>`;
      case 'goggles': return `<path d="M33 31 C40 26 60 26 67 31 L67 35 C60 30 40 30 33 35 Z" fill="#6b4a2a" ${K}/><circle cx="41" cy="24" r="5.6" fill="#8fe8ff" ${K}/><circle cx="59" cy="24" r="5.6" fill="#8fe8ff" ${K}/><path d="M38 22 L41 20.5 M56 22 L59 20.5" stroke="#fff" stroke-width="1.4" stroke-linecap="round"/>`;
      case 'plaster': return `<rect x="55" y="50.6" width="8.4" height="3.6" rx="1" fill="#f6efe0" ${KT} transform="rotate(-25 59 52.4)"/>`;
      case 'earring': return `<circle cx="34.6" cy="53.6" r="2.4" fill="${t}" ${KT}/><path d="M34.6 50.6 L34.6 51.4" stroke="#000" stroke-width="1"/>`;
      case 'scarf': return `<path d="M35 66 C44 75 56 75 65 66 L67 77 C56 85 44 85 33 77 Z" fill="${t}" ${K}/><path d="M60 78 C72 76 82 84 94 79 C88 91 76 93 64 88 Z" fill="${t}" ${K}/><path d="M66 82 L72 80 M72 86 L78 84" stroke="#000" stroke-width="1.2" opacity=".45"/>`;
      case 'tiara': return `<path d="M39 30 L43.5 23 L47 28 L50 20 L53 28 L56.5 23 L61 30 Z" fill="${sp.acc || '#ffe28a'}" ${K}/><circle cx="50" cy="25.5" r="2.3" fill="#7ff0ff" ${KT}/>`;
      case 'beauty': return `<circle cx="58.5" cy="55" r=".9" fill="#000" opacity=".7"/>`;
      case 'sidebraid': return `<path d="M33 56 C28 62 28 70 32 76 C34 82 32 88 28 92 M67 56 C72 62 72 70 68 76 C66 82 68 88 72 92" fill="none" stroke="#000" stroke-width="6.5" stroke-linecap="round"/><path d="M33 56 C28 62 28 70 32 76 C34 82 32 88 28 92 M67 56 C72 62 72 70 68 76 C66 82 68 88 72 92" fill="none" stroke="${sp.hair}" stroke-width="3.6" stroke-linecap="round" stroke-dasharray="4 1.6"/>`;
      case 'monocle': return `<circle cx="57.6" cy="46" r="7.4" fill="${sp.trim}" fill-opacity=".22" stroke="#000" stroke-width="2"/><circle cx="57.6" cy="46" r="5.2" fill="none" stroke="${sp.trim}" stroke-width="1" stroke-dasharray="2 1.4"/><path d="M65 44 L72 36" stroke="#000" stroke-width="1.6" stroke-linecap="round"/><circle cx="72" cy="35" r="1.6" fill="${sp.trim}" stroke="#000" stroke-width=".8"/><path d="M52 41 H56 M52 51 H60" stroke="${sp.trim}" stroke-width=".8" opacity=".9"/>`;
      case 'circuit': return `<path d="M61 40 L61 44 L66 44 M62 53 L66 53 L66 57 M44 53 L40 53 L40 58" fill="none" stroke="${sp.trim}" stroke-width="1" stroke-linecap="round"/><circle cx="66" cy="44" r="1.1" fill="${sp.trim}"/><circle cx="66" cy="57" r="1.1" fill="${sp.trim}"/><circle cx="40" cy="58" r="1.1" fill="${sp.trim}"/>`;
      case 'mask2': return `<path d="M36 54 C42 60 58 60 64 54 L64 64 C58 71 42 71 36 64 Z" fill="${sp.outfit}" ${K}/><path d="M43 61 H57 M43 65 H57" stroke="${sp.trim}" stroke-width="1" opacity=".9"/><circle cx="50" cy="63" r="1.4" fill="${sp.trim}"/>`;
      case 'longbeard': return `<path d="M34.5 50 C33 70 41 86 50 92 C59 86 67 70 65.5 50 C60 58 40 58 34.5 50 Z" fill="${sp.beardC}" ${K}/><path d="M42 66 C44 74 46 80 50 85 M58 66 C56 74 54 80 50 85 M50 62 L50 80" fill="none" stroke="#000" stroke-width=".9" opacity=".3"/>`;
      case 'moss': return `<ellipse cx="38" cy="14" rx="8" ry="4" fill="#5ab04a" ${KT}/><ellipse cx="62" cy="13" rx="7" ry="3.6" fill="#6bd07a" ${KT}/><circle cx="26" cy="74" r="5" fill="#5ab04a" ${KT}/><circle cx="74" cy="74" r="5.5" fill="#5ab04a" ${KT}/><path d="M30 14 C34 8 40 9 41 14 M58 11 C62 5 68 7 68 12" fill="none" stroke="#2f7a2c" stroke-width="1.4"/>`;
      case 'wrinkles': return `<path d="M39 38.5 C43 36.5 46 37 48 38.5 M52 38.5 C54 37 57 36.5 61 38.5 M40 52 C41 54 42 55 44 55.6 M60 52 C59 54 58 55 56 55.6" fill="none" stroke="#000" stroke-width="1" opacity=".5" stroke-linecap="round"/>`;
      default: return '';
    }
  }

  // props drawn BEHIND the body
  function propBack(sp) {
    const t = sp.trim, top = sp.top || 'orb';
    switch (sp.prop) {
      case 'sword': return `<path d="M70 76 L83 6 L88 9 L77 79 Z" fill="#e6ecf4" ${K}/><path d="M80 14 L84 16" ${KT}/><path d="M66 73 L82 80 L80 84 L64 77 Z" fill="${t}" ${K}/>`;
      case 'bow': return `<path d="M20 10 C0 40 0 62 20 92" fill="none" stroke="#000" stroke-width="7" stroke-linecap="round"/><path d="M20 10 C0 40 0 62 20 92" fill="none" stroke="${t}" stroke-width="3.6" stroke-linecap="round"/><path d="M20 10 L20 92" stroke="#fff" stroke-width=".9" opacity=".85"/>`;
      case 'staff': {
        const head = top === 'cross' ? `<path d="M77 4 H83 V10 H89 V16 H83 V22 H77 V16 H71 V10 H77 Z" fill="${sp.acc || '#ffe28a'}" ${K}/>`
          : top === 'crescent' ? `<path d="M88 8 C74 2 68 18 78 26 C72 16 78 10 88 8 Z" fill="${t}" ${K}/><circle cx="82" cy="17" r="3" fill="#fff" ${KT}/>`
          : top === 'leaf' ? `<path d="M80 22 C68 18 66 4 80 -2 C94 4 92 18 80 22 Z" fill="#7bd46a" ${K}/><path d="M80 20 L80 2" ${KT}/>`
          : `<circle cx="80" cy="14" r="8" fill="${t}" ${K}/><circle cx="77" cy="11" r="2.5" fill="#fff" opacity=".8"/>`;
        return `<path d="M80 98 L80 20" stroke="#000" stroke-width="6.5" stroke-linecap="round"/><path d="M80 98 L80 20" stroke="#8a6a44" stroke-width="3.2" stroke-linecap="round"/>${head}`;
      }
      case 'orb': return `<circle cx="80" cy="36" r="13" fill="none" stroke="${t}" stroke-width="1.6" stroke-dasharray="3 3" opacity=".9"/><circle cx="80" cy="36" r="9" fill="${t}" ${K}/><circle cx="77" cy="33" r="3" fill="#fff" opacity=".85"/>`;
      case 'hammer': return `<path d="M76 98 L70 26" stroke="#000" stroke-width="7" stroke-linecap="round"/><path d="M76 98 L70 26" stroke="#8a6a44" stroke-width="3.6" stroke-linecap="round"/><path d="M54 12 L88 8 L90 30 L56 34 Z" fill="#8a8f9a" ${K}/><path d="M58 16 L84 13" stroke="#fff" stroke-width="1.6" opacity=".6"/>`;
      case 'daggers': return `<path d="M17 14 L24 10 L47 58 L40 62 Z" fill="#e6ecf4" ${K}/><path d="M83 14 L76 10 L53 58 L60 62 Z" fill="#e6ecf4" ${K}/><path d="M38 60 L49 54 L51 58 L40 64 Z M62 60 L51 54 L49 58 L60 64 Z" fill="${t}" ${KT}/>`;
      default: return '';
    }
  }
  // props drawn IN FRONT of the body
  function propFront(sp) {
    if (sp.prop === 'shield') {
      return `<circle cx="22" cy="90" r="19" fill="${sp.trim}" ${K}/><circle cx="22" cy="90" r="13" fill="${sp.outfit}" ${K}/><circle cx="22" cy="90" r="4.5" fill="#ffd24a" ${KT}/>` +
        `<path d="M22 71 L22 77 M22 103 L22 109 M3 90 L9 90 M35 90 L41 90" stroke="#000" stroke-width="1.2" opacity=".5"/>`;
    }
    return '';
  }

  // ------------------------------------------------------------ draw
  function draw(id) {
    const sp = SPEC[id];
    if (!sp) return '';
    const H = HAIR[sp.hs] || HAIR.short;
    const hairFill = sp.hair;
    const isHood = sp.hs === 'hood' || sp.hs === 'hoodfringe' || sp.hs === 'bark';
    let o = '';
    if (sp.aura) o += `<circle cx="50" cy="48" r="46" fill="#fff" opacity=".10"/><circle cx="50" cy="48" r="34" fill="#fff" opacity=".12"/>`;
    o += propBack(sp);
    if (sp.cape) o += `<path d="M5 100 L10 66 C20 58 32 64 42 68 L58 68 C68 64 80 58 90 66 L95 100 Z" fill="${sp.cape}" ${K}/>`;
    if (H.back) o += `<path d="${H.back}" fill="${hairFill}" ${K}/>` + (isHood ? shade(H.back, 0.18) : '');
    if (H.tips && sp.hair2) o += `<path d="${H.tips}" fill="${sp.hair2}" ${KT}/>`;
    if (H.lines) o += `<path d="${H.lines}" fill="none" stroke="#000" stroke-width="1.4" opacity=".35" stroke-linecap="round"/>`;
    if (sp.extra.includes('foxears') || sp.extra.includes('catears') || sp.extra.includes('antlers') || sp.extra.includes('horns')) {
      // ears/horns sit behind the face but in front of back hair
      o += sp.extra.filter((a) => ['foxears', 'catears', 'antlers', 'horns'].includes(a)).map((a) => accessory(a, sp)).join('');
    }
    o += bodyPath(sp);
    o += `<path d="M44 58 L44 72 L50 76 L56 72 L56 58 Z" fill="${sp.skin}" ${K}/>` + `<path d="M44 63 C47 68 53 68 56 63 L56 67 C53 72 47 72 44 67 Z" fill="#000" opacity=".2"/>`;
    o += collar(sp);
    // ears + head
    o += `<ellipse cx="34.5" cy="47" rx="3" ry="4.4" fill="${sp.skin}" ${KT}/><ellipse cx="65.5" cy="47" rx="3" ry="4.4" fill="${sp.skin}" ${KT}/>`;
    const face = 'M35.5 38 C35.5 28 42 22.5 50 22.5 C58 22.5 64.5 28 64.5 38 L63.5 48 C62.5 56 57 62.5 50 63.5 C43 62.5 37.5 56 36.5 48 Z';
    o += `<path d="${face}" fill="${sp.skin}" ${K}/>` + shade('M50 23 C58 23 64.5 29 64.5 38 L63.5 48 C62.5 56 57 62.5 50 63.5 Z', 0.1);
    o += `<path d="M50 51 L48.8 53.2 L50.6 53.6" fill="none" stroke="#000" stroke-width="1" opacity=".55" stroke-linecap="round"/>`;
    o += eyes(sp) + brows(sp) + mouth(sp);
    // front hair / hood shading
    if (H.front) {
      o += `<path d="${H.front}" fill="${hairFill}" ${K}/>`;
      if (sp.hs !== 'helm') o += `<path d="M44 21 C43 26 42 30 40 35 M50 20 C50 25 50 29 50 33 M57 21 C58 26 59 30 61 35" fill="none" stroke="#000" stroke-width=".9" opacity=".28" stroke-linecap="round"/>`;
      if (sp.hs !== 'helm') o += `<path d="M39 25 C45 20 56 20 62 26" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" opacity=".38"/>`;
      else o += `<path d="M34 37 L66 37" stroke="#000" stroke-width="1.6" opacity=".5"/><path d="M40 20 C46 16 56 16 62 21" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" opacity=".4"/>`;
    }
    // remaining accessories
    o += sp.extra.filter((a) => !['foxears', 'catears', 'antlers', 'horns'].includes(a)).map((a) => accessory(a, sp)).join('');
    o += propFront(sp);
    const k = sp.aura ? 0.98 : 1.13; // heroes show more of the silhouette (hair, antlers, cape)
    return `<g class="chr" transform="translate(50 56) scale(${k}) translate(-50 -54)">${o}</g>`;
  }

  AMB.chars = { SPEC, draw, has: (id) => !!SPEC[id] };
})();
