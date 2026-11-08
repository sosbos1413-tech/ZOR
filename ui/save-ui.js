/*
 * "الحفظ" screen: progress is written to this browser after EVERY change (nothing to press). Here you see that,
 * ask the browser not to clear it, and move it between links/devices with a backup file.
 */
(function () {
  const AMB = globalThis.AMB;
  const $ = (id) => document.getElementById(id);
  const UI = () => globalThis.AMB_UI;
  let persisted = null;

  // ask the browser to keep our storage (it may otherwise clear it when the device is low on space)
  function askPersist() {
    try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist().then((ok) => { persisted = !!ok; }); } catch (e) { /* ignore */ }
  }
  const fmt = (t) => { if (!t) return '—'; const d = new Date(t); return d.toLocaleDateString('ar') + ' ' + d.toLocaleTimeString('ar', { hour: '2-digit', minute: '2-digit' }); };
  const sizeKB = () => { try { return Math.max(1, Math.round((localStorage.getItem(AMB.Save.KEY) || '').length / 1024)); } catch (e) { return 0; } };

  function open() {
    const sv = AMB.save;
    UI().modal(`<h2>💾 الحفظ</h2>
      <div class="save-box ok">✓ <b>الحفظ تلقائي</b>: تقدمك ينحفظ لحاله مع كل تغيير، ما تحتاج تضغط شي.</div>
      <div class="save-kv"><span>آخر حفظ</span><b>${fmt(sv.updated())}</b></div>
      <div class="save-kv"><span>حجم البيانات</span><b style="direction:ltr">${sizeKB()} KB</b></div>
      <div class="save-kv"><span>الحماية من المسح التلقائي</span><b>${persisted === null ? 'غير معروفة' : persisted ? 'مفعّلة ✓' : 'يقرّرها المتصفح'}</b></div>
      <div class="save-kv"><span>نسخة احتياطية يومية</span><b>تلقائية ✓</b></div>
      ${sv.recovered ? '<div class="save-box warn">رجّعنا تقدمك من النسخة الاحتياطية بعد ما صار خلل في الحفظ.</div>' : ''}
      <h3>نقل التقدّم</h3>
      <p class="hint">الحفظ مربوط بهالمتصفح وهالرابط. لو فتحت اللعبة من رابط أو جهاز ثاني ما يطلع تقدمك، انقله بملف.</p>
      <div class="save-btns">
        <button class="btn primary" data-act="saveExport">⬇ نزّل نسخة احتياطية</button>
        <button class="btn" data-act="saveImport">⬆ استرجع من ملف</button>
        ${sv.hasBackup('preimport') ? '<button class="btn ghost" data-act="saveRestore" data-k="preimport">↩ ارجع للنسخة قبل آخر استيراد</button>' : ''}
        ${sv.hasBackup('bak') ? '<button class="btn ghost" data-act="saveRestore" data-k="bak">↩ ارجع للنسخة اليومية التلقائية</button>' : ''}
        <input type="file" id="save-file" accept="application/json,.json" hidden>
      </div>`);
    const f = $('save-file');
    if (f) f.onchange = () => {
      const file = f.files && f.files[0]; if (!file) return;
      const rd = new FileReader();
      rd.onload = () => {
        try { AMB.save.importJSON(String(rd.result)); UI().toast('رجع تقدمك ✓ جاري إعادة التحميل', 'good'); setTimeout(() => location.reload(), 900); }
        catch (e) { UI().toast('الملف غير صالح', 'err'); }
      };
      rd.readAsText(file);
    };
  }

  function installActions() {
    const ui = UI(); if (!ui || ui.ACT.saveOpen) return;
    Object.assign(ui.ACT, {
      saveOpen: () => open(),
      saveExport: () => {
        const blob = new Blob([AMB.save.exportJSON()], { type: 'application/json' });
        const a = document.createElement('a'), d = new Date();
        a.href = URL.createObjectURL(blob);
        a.download = `zor-save-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}.json`;
        document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
        ui.toast('نزلت النسخة الاحتياطية', 'good');
      },
      saveImport: () => { const f = $('save-file'); if (f) f.click(); },
      saveRestore: (d) => { try { AMB.save.restore(d.k); ui.toast('رجعت النسخة ✓ جاري إعادة التحميل', 'good'); setTimeout(() => location.reload(), 900); } catch (e) { ui.toast('ما قدرت أرجّع النسخة', 'err'); } },
    });
  }

  // flush on leaving the page (every change is already written; this is just a safety net)
  const flush = () => { try { AMB.save.write(); } catch (e) { /* ignore */ } };
  window.addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
  document.addEventListener('pointerdown', function once() { askPersist(); document.removeEventListener('pointerdown', once); }, { once: true });

  // another tab wrote the save: this one is stale and has stopped writing; the player must reload (the newest tab wins)
  if (AMB.save && AMB.save.onLock) AMB.save.onLock(() => {
    const d = document.createElement('div'); d.id = 'save-lock';
    d.innerHTML = '<div class="sl-box"><h2>اللعبة مفتوحة في تبويب ثاني</h2><p>تقدمك انحفظ في التبويب الجديد. هذا التبويب ما يحفظ حتى ما يمسح عليه. حدّث الصفحة وكمّل.</p><button class="btn big primary" onclick="location.reload()">حدّث الصفحة</button></div>';
    document.body.appendChild(d);
  });
  AMB.SaveUI = { open, installActions };
  if (UI()) installActions();
})();
