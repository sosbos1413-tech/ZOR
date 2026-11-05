/*
 * "مجموعتي" screen: every card with its rarity, level and duplicate copies, and the upgrade button.
 * Logic lives in core/collection.js. Card levels only count in progression fights (campaign, tower, events).
 */
(function () {
  const AMB = globalThis.AMB;
  const $ = (id) => document.getElementById(id);
  const C = AMB.collection, RAR = AMB.ECONOMY.rarities;
  const UI = () => globalThis.AMB_UI;
  let filter = '';   // rarity filter ('' = all)

  const pct = (a, b) => (b ? Math.min(100, Math.round((a / b) * 100)) : 100);

  // where can a locked card come from?
  function unlockHint(id) {
    const P = AMB.Pass; let src = '';
    if (P) for (const [lv, r] of Object.entries(P.FREE)) if (!src && r.type === 'avatar' && r.id === id) src = `الباتل باس: مستوى ${lv}`;   // the premium track is not available yet, so it is not advertised
    if (AMB.DATA.UNITS[id] && AMB.DATA.UNITS[id].exclusive) return 'حصرية: الحدث الأسبوعي';
    return src ? `باكجات · ${src}` : 'من الباكجات';
  }
  function tile(id) {
    const d = C.def(id), owned = C.owned(id), lv = C.level(id), need = C.needed(id), have = C.copies(id), max = C.isMax(id);
    const card = UI().cardHTML(d, { k: 'col' + id, lvl: owned ? lv : 0, cls: owned ? '' : 'unowned', attrs: `data-act="${d.role ? 'detail' : 'heroInfo'}" data-id="${id}"` });
    const bar = max ? '<div class="cp-bar max"><i style="width:100%"></i><span>المستوى الأقصى</span></div>'
      : `<div class="cp-bar ${have >= need ? 'ready' : ''}"><i style="width:${pct(have, need)}%"></i><span>${have} / ${need}</span></div>`;
    const btn = !owned ? `<span class="cp-lock">🔒 ${unlockHint(id)}</span>`
      : max ? '' : `<button class="btn small ${C.canUpgrade(id) ? 'primary' : ''}" data-act="colUpgrade" data-id="${id}" ${C.canUpgrade(id) ? '' : 'disabled'}>طوّر ← Lv ${lv + 1}</button>`;
    const bonus = Math.round((C.power(id) - 1) * 100);
    return `<div class="cp-tile" data-card="${id}">${card}${owned ? bar : ''}<div class="cp-foot">${btn}<span class="cp-pow" title="قوة البطاقة في الحملة والبرج">${bonus > 0 ? '+' + bonus + '%' : '±0%'}</span></div></div>`;
  }

  AMB.TIPS = AMB.TIPS || {};
  AMB.TIPS.colinfo = () => ({ title: 'تطوير البطاقات', html: `<p>كل مستوى +${Math.round(AMB.ECONOMY.cards.levelBonus * 100)}% صحة وهجوم، والندرة الأعلى أقوى لكنها تحتاج نسخًا أكثر.</p>
    <p>النسخ المطلوبة للمستويات 2 إلى 5:</p>${Object.entries(RAR).map(([k, r]) => `<div class="hint">• <b style="color:${r.color}">${r.name}</b>: ${r.copies.join(' / ')}</div>`).join('')}
    <p><b>المستويات والندرة تُحتسب في الحملة والبرج والأحداث فقط</b>، أما المباراة السريعة وعلى نفس الجهاز فالكل متساوٍ.</p>` });
  function render() {
    const root = $('collection'); if (!root) return;
    const ids = C.ids().filter((id) => !filter || C.rarity(id) === filter)
      .sort((a, b) => RAR[C.rarity(b)].order - RAR[C.rarity(a)].order || (C.def(a).role ? 1 : 0) - (C.def(b).role ? 1 : 0));
    const ready = C.ids().filter((id) => C.canUpgrade(id)).length;
    const fb = (v, n, col) => `<button class="btn small ${filter === v ? 'on' : ''}" data-act="colFilter" data-v="${v}" ${col ? `style="--rc:${col}"` : ''}>${n}</button>`;
    root.innerHTML = `<div class="col-head">
        ${C.needsStarter() ? '<div class="col-starter">ما اخترت بطلك الأول للحين: اضغط «العب» واختر واحد من الأربعة.</div>' : ''}
        <div><b>${C.ownedCount()} / ${C.ids().length}</b> بطاقة · ${ready ? `<span class="col-ready">${ready} جاهزة للتطوير</span>` : 'لا توجد ترقيات جاهزة'}</div>
        <p class="hint">النسخ المكررة تطوّر البطاقة <button class="ibtn" data-act="info" data-k="colinfo" title="شرح">ⓘ</button></p>
        <div class="rar-legend">${Object.entries(RAR).map(([k, r]) => `<span class="rl r-${k}"><i></i>${r.name} <small>+${Math.round((r.power - 1) * 100)}%</small></span>`).join('')}</div>
        <button class="btn primary small" data-act="go" data-to="packs">افتح باكجات للحصول على نسخ</button>
        <div class="filters">${fb('', 'الكل')}${Object.entries(RAR).map(([k, r]) => fb(k, r.name, r.color)).join('')}</div>
      </div>
      <div class="col-grid">${ids.map(tile).join('')}</div>`;
    refreshMenu();
  }

  function refreshMenu() {
    const b = $('menu-cards'); if (!b) return;
    const n = C.ids().filter((id) => C.canUpgrade(id)).length;
    (b.querySelector('.mt-l') || b).innerHTML = `مجموعتي${n ? `<span class="dot">${n}</span>` : ''}`;
  }

  function installActions() {
    const ui = UI(); if (!ui || ui.ACT.colUpgrade) return;
    Object.assign(ui.ACT, {
      colFilter: (d) => { filter = d.v || ''; render(); },
      colUpgrade: (d) => {
        const lv = C.upgrade(d.id); if (!lv) return;
        ui.sfx('merge'); ui.toast(`${C.def(d.id).name} ← المستوى ${lv}`, 'good');
        render();
        const el = document.querySelector(`.cp-tile[data-card="${d.id}"] .tcard`);
        if (el && ui.burst) [RAR[C.rarity(d.id)].color, '#ffffff', '#ffd24a'].forEach((c) => ui.burst(el, c, 12, { r: 90, s: 6 }));
      },
    });
  }

  AMB.CollectionUI = { render, refreshMenu, installActions, unlockHint };
  if (UI()) installActions();
  refreshMenu();
})();
