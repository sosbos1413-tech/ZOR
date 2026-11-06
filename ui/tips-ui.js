/*
 * Tap any badge on a card (world, role, skill, attack, health, rarity, cost, level, copies) and a small pop-up explains it.
 * The pop-up is NOT a window: it points at the badge, closes on the next tap / scroll, and never buys or selects the card.
 */
(function () {
  const AMB = globalThis.AMB, D = AMB.DATA;
  const { icon } = AMB.art;
  const UI = () => globalThis.AMB_UI;
  let pop = null, timer = 0;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const def = (id) => D.UNITS[id] || D.HEROES[id];
  const SM = () => AMB.CONFIG.stars.mult;
  const LABEL = { dmg: 'ضرر', heal: 'علاج', shield: 'درع', dps: 'ضرر/ث', stun: 'شلل (ث)', pct: 'نسبة' };
  const synLines = (sid) => (D.SYNERGIES[sid] ? D.SYNERGIES[sid].tiers.map((t) => `<div class="tp-l">• <b>${t.n}</b>: ${esc(t.text)}</div>`).join('') : '');

  function content(k, id, x) {
    const d = def(id); if (!d) return null;
    const isHero = !d.role;
    if (k === 'all') {   // small cards (phones): the icon strip opens ONE pop-up that explains world + role + skill together
      const parts = ['world', isHero ? 'herorole' : 'role'].concat(isHero ? [] : ['skill']).map((kk) => content(kk, id, x));
      return { ic: AMB.art.WORLD_ICON[d.world], title: d.name, color: D.WORLDS[d.world].color, html: parts.map((c) => `<div class="tp-sec"><div class="tp-sh">${icon(c.ic)}<b>${esc(c.title)}</b></div>${c.html.replace(/<div class="tp-s">التآزر[^<]*<\/div>/, '')}</div>`).join('') };
    }
    switch (k) {
      case 'world': { const W = D.WORLDS[d.world]; return { ic: AMB.art.WORLD_ICON[d.world], title: W.name, color: W.color, html: `<div class="tp-s">التآزر: كل ما جمعت وحدات من هذا العالم يقوون:</div>${synLines(d.world)}` }; }
      case 'role': { const R = D.ROLES[d.role]; return { ic: AMB.art.ROLE_ICON[d.role], title: R.name, html: `<div class="tp-l">${esc(R.desc)}</div><div class="tp-s">تُوضع: <b>${esc(R.place)}</b></div>${synLines(d.role)}` }; }
      case 'herorole': return { ic: 'crown', title: 'بطل', html: `<div class="tp-l"><b>${esc(d.passive.name)}</b>: ${esc(d.passive.text)}</div><div class="tp-s">قائدك: حياته هي حياتك، وسقوطه = خسارة.</div>` };
      case 'skill': {
        const s = d.skill, st = +x || 1, rows = [];
        Object.keys(s).forEach((key) => { if (Array.isArray(s[key]) && s[key].length === 3 && LABEL[key]) rows.push(`<div class="tp-l"><b>${LABEL[key]}</b>: <span class="tp-v ${st === 1 ? 'on' : ''}">★ ${s[key][0]}</span> <span class="tp-v ${st === 2 ? 'on' : ''}">★★ ${s[key][1]}</span> <span class="tp-v ${st === 3 ? 'on' : ''}">★★★ ${s[key][2]}</span></div>`); });
        return { ic: AMB.art.SKILL_ICON[s.type] || 'star', title: s.name, html: `<div class="tp-l">${esc(s.text)}</div>${rows.join('')}<div class="tp-s">تنطلق لما تمتلئ المانا (${d.mana}).</div>` };
      }
      case 'atk': case 'hp': {
        const lab = k === 'atk' ? 'الهجوم' : 'الصحة', base = isHero ? (k === 'atk' ? d.board.atk : 100) : (k === 'atk' ? d.atk : d.hp), m = SM();
        const v = (s) => Math.round(base * (isHero ? 1 : m[s]));
        return { ic: k === 'atk' ? 'sword' : 'heart', title: lab, html: isHero ? `<div class="tp-l">${k === 'atk' ? 'هجومه لما تستدعيه للساحة (ويكبر كل جولة).' : 'حياة البطل = حياتك في المباراة.'}</div>` : `<div class="tp-l"><span class="tp-v">★ ${v(1)}</span> <span class="tp-v">★★ ${v(2)}</span> <span class="tp-v">★★★ ${v(3)}</span></div><div class="tp-s">كل نجمة ترفع القوة. ٣ نسخ متطابقة = نجمة.</div>` };
      }
      case 'rar': { const R = AMB.ECONOMY.rarities[d.rarity]; return { ic: 'gem', title: R.name, color: R.color, html: `<div class="tp-l">قوة إضافية <b>+${Math.round((R.power - 1) * 100)}%</b> في الحملة والبرج والأحداث.</div><div class="tp-s">نسخ التطوير للمستويات 2–5: ${R.copies.join(' / ')}</div>` }; }
      case 'lvl': return { ic: 'up', title: 'مستوى ' + x, html: `<div class="tp-l">كل مستوى <b>+${Math.round(AMB.ECONOMY.cards.levelBonus * 100)}%</b> صحة وهجوم، في الحملة والبرج والأحداث فقط.</div><div class="tp-s">تطوّره بالنسخ المكررة من «مجموعتي».</div>` };
      case 'cost': return { ic: 'gold', title: d.cost + ' ذهب', html: `<div class="tp-l">سعر الشراء، وهو نفس رقم الفئة ${d.tier} (الجواهر).</div><div class="tp-s">البيع يرجّع نفس السعر.</div>` };
      case 'own': return { ic: 'star', title: x === 'up' ? '↑' : '×' + x, html: x === 'up' ? '<div class="tp-l">عندك نسختين: شراؤها يرقّيها لنجمة أقوى!</div>' : `<div class="tp-l">عندك ${x} نسخة منها. ٣ نسخ متطابقة تندمج لنجمة.</div>` };
    }
    return null;
  }

  function close() { if (pop) { pop.remove(); pop = null; } clearTimeout(timer); }
  function open(el, c) {
    close();
    pop = document.createElement('div'); pop.className = 'tip-pop';
    pop.innerHTML = `<div class="tp-h" style="${c.color ? `--c:${c.color}` : ''}">${icon(c.ic)}<b>${esc(c.title)}</b></div>${c.html}<i class="tp-arrow"></i>`;
    document.body.appendChild(pop);
    const r = el.getBoundingClientRect(), pw = pop.offsetWidth, ph = pop.offsetHeight, vw = innerWidth, vh = innerHeight;
    let left = r.left + r.width / 2 - pw / 2; left = Math.max(6, Math.min(vw - pw - 6, left));
    const above = r.top - ph - 12 > 4, top = above ? r.top - ph - 10 : Math.min(vh - ph - 6, r.bottom + 10);
    pop.style.left = left + 'px'; pop.style.top = top + 'px';
    const ar = pop.querySelector('.tp-arrow'); ar.style.left = Math.max(10, Math.min(pw - 22, r.left + r.width / 2 - left - 6)) + 'px'; ar.classList.toggle('dn', !above);
    timer = setTimeout(close, 7000);
  }

  function installActions() {
    const ui = UI(); if (!ui || ui.ACT.tip) return;
    ui.ACT.tip = (d, el, e) => { if (e) e.stopPropagation(); const c = content(d.k, d.id, d.x); if (c) { ui.sfx && ui.sfx('click'); open(el, c); } };
  }
  // any other tap or a scroll closes it (capture phase so the tap still does its normal job)
  document.addEventListener('click', (e) => { if (pop && !e.target.closest('[data-act="tip"]') && true) close(); }, true);
  window.addEventListener('scroll', close, true);
  window.addEventListener('resize', close);

  AMB.TipsUI = { open, close, content, installActions };
  if (UI()) installActions();
})();
