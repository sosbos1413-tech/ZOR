/*
 * One versioned save for every progression system (pass, collection, packs,
 * campaign, tower, daily, album…). Stored in the browser only.
 *
 *   const save = AMB.Save.create(localStorage);
 *   const st = save.get('tower');            // defaults filled in from the registry
 *   save.update('tower', (s) => { s.best = 3; });
 *
 * Adding a new system later = one AMB.Save.register(name, { defaults, migrate }) call;
 * older saves simply get that system's defaults the first time it is read.
 */
(function () {
  const AMB = (globalThis.AMB = globalThis.AMB || {});
  const KEY = 'amb_save_v1';
  const VERSION = 1;
  const LEGACY = { pass: 'amb_pass_v1' };          // per-system keys used before the unified save
  const REGISTRY = {};                              // name -> { defaults(now), version, migrate(old, fromVersion) }

  /** Describe a system's saved state. defaults() must return a fresh object every call. */
  function register(name, def) {
    if (!name || typeof def.defaults !== 'function') throw new Error('Save.register needs a name and defaults()');
    REGISTRY[name] = { version: def.version || 1, defaults: def.defaults, migrate: def.migrate || null };
  }

  // in-memory stand-in when localStorage is blocked (private mode, sandboxed previews…)
  function memoryStorage() { const m = {}; return { getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, removeItem: (k) => { delete m[k]; } }; }
  function browserStorage() {
    try { const s = globalThis.localStorage, k = '__amb_t'; s.setItem(k, '1'); s.removeItem(k); return s; } catch (e) { return memoryStorage(); }
  }

  const clone = (o) => JSON.parse(JSON.stringify(o));
  const isObj = (o) => o && typeof o === 'object' && !Array.isArray(o);
  // fill keys missing from an older save with their default values (never overwrites saved values)
  function fill(dst, def) {
    for (const k of Object.keys(def)) {
      if (!(k in dst)) dst[k] = clone(def[k]);
      else if (isObj(dst[k]) && isObj(def[k])) fill(dst[k], def[k]);
    }
    return dst;
  }

  // hooks.onForeignWrite(cb): called when ANOTHER tab/window wrote our key. Default: the browser 'storage' event (it never fires in the tab that wrote).
  // a field whose saved type differs from its default's type (null where an object is expected, "x" where a number is expected, array vs object) is replaced by the default.
  // Unknown keys (from a newer game version) are kept; a default of null or an empty {} map accepts anything of an object kind.
  const kindOf = (v) => (v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v);
  function repair(dst, def) {
    for (const k of Object.keys(def)) {
      const d = def[k], v = dst[k];
      if (d === null || d === undefined) continue;
      if (kindOf(v) !== kindOf(d)) { dst[k] = clone(d); continue; }
      if (isObj(d) && Object.keys(d).length) repair(v, d);
    }
    return dst;
  }

  function create(storage, nowFn, hooks) {
    const realStorage = !storage;
    storage = storage || browserStorage();
    const now = nowFn || (() => Date.now());
    let root = null, corrupt = false, recovered = false;
    const rawNow = (() => { try { return storage.getItem(KEY); } catch (e) { return null; } })();
    const dayOf = (t) => { const d = new Date(t); return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(); };
    try { root = JSON.parse(rawNow); } catch (e) { corrupt = true; }
    if (root !== null && (!isObj(root) || !isObj(root.systems))) { corrupt = true; root = null; }
    if (corrupt) {
      try { storage.setItem(KEY + '_corrupt', String(rawNow)); } catch (e) { /* ignore */ }
      // restore the automatic daily backup if there is one
      try { const bak = JSON.parse(storage.getItem(KEY + '_bak')); if (isObj(bak) && isObj(bak.systems)) { root = bak; recovered = true; } } catch (e) { /* no usable backup */ }
    } else if (root && root.bakDay !== dayOf(now())) {
      // automatic backup: once a day keep a copy of the save as it was before today's changes
      try { storage.setItem(KEY + '_bak', rawNow); } catch (e) { /* ignore */ }
    }
    if (!root) {
      root = { v: VERSION, created: now(), systems: {}, sysV: {} };
      // bring over data saved by older versions of the game (e.g. the battle pass)
      for (const [name, key] of Object.entries(LEGACY)) {
        try { const old = JSON.parse(storage.getItem(key)); if (isObj(old)) root.systems[name] = old; } catch (e) { /* ignore */ }
      }
    }
    root.sysV = root.sysV || {};
    root.bakDay = dayOf(now());
    let listeners = [];

    // every change is written to storage at once (nothing to "save" by hand); `updated` shows in the save screen
    // single writer: when another tab writes the save, this tab's copy is stale. It stops writing (so it can never overwrite the newer progress) and asks the player to reload.
    const checked = {};
    let locked = false, lockListeners = [];
    const lock = () => { if (locked) return; locked = true; lockListeners.forEach((f) => { try { f(); } catch (e) { /* ignore */ } }); };
    const hook = (hooks && hooks.onForeignWrite) || (realStorage && typeof window !== 'undefined' && window.addEventListener ? ((cb) => window.addEventListener('storage', (e) => { if (e.key === KEY || e.key === null) cb(); })) : null);
    if (hook) hook(lock);
    const write = () => { if (locked) return false; try { root.updated = now(); storage.setItem(KEY, JSON.stringify(root)); return true; } catch (e) { return false; } };
    write();

    /** State of one system: migrated + defaults filled. The returned object is live: change it, then call save.write(). */
    function get(name) {
      const reg = REGISTRY[name];
      let s = root.systems[name];
      if (!isObj(s)) s = root.systems[name] = reg ? reg.defaults(now()) : {};
      if (reg) {
        const from = root.sysV[name] || 1;
        if (reg.migrate && from < reg.version) { root.systems[name] = s = reg.migrate(s, from) || s; root.sysV[name] = reg.version; write(); }
        root.sysV[name] = reg.version;
        fill(s, reg.defaults(now()));
        if (!checked[name]) { checked[name] = true; repair(s, reg.defaults(now())); }
      }
      return s;
    }
    function set(name, data) { root.systems[name] = data; write(); emit(name); }
    function update(name, fn) { const s = get(name); const r = fn(s); write(); emit(name); return r; }
    function reset(name) { delete root.systems[name]; delete root.sysV[name]; write(); emit(name); }
    function emit(name) { listeners.forEach((f) => { try { f(name); } catch (e) { /* listener errors never break saving */ } }); }
    const onChange = (f) => { listeners.push(f); return () => { listeners = listeners.filter((x) => x !== f); }; };

    /** Adapter so modules written against a plain key/value store (pass.js) keep working inside the unified save. */
    function storageFor(name) {
      return {
        getItem: () => (root.systems[name] === undefined ? null : JSON.stringify(root.systems[name])),
        setItem: (k, v) => { try { root.systems[name] = JSON.parse(v); write(); emit(name); } catch (e) { /* ignore */ } },
        removeItem: () => reset(name),
      };
    }

    const exportJSON = () => JSON.stringify(root);
    function importJSON(text) {
      const r = JSON.parse(text);
      if (!isObj(r) || !isObj(r.systems)) throw new Error('ملف الحفظ مو صحيح');
      try { storage.setItem(KEY + '_preimport', JSON.stringify(root)); } catch (e) { /* ignore */ }   // the previous save stays recoverable
      root = r; root.sysV = root.sysV || {}; root.bakDay = dayOf(now());
      Object.keys(checked).forEach((k) => delete checked[k]);   // re-validate every system against its defaults on next access
      write(); emit('*'); return true;
    }
    /** the previous saves we keep: 'preimport' (before the last import), 'bak' (daily), 'corrupt' (the unreadable one) */
    function hasBackup(kind) { try { const r = JSON.parse(storage.getItem(KEY + '_' + kind)); return isObj(r) && isObj(r.systems); } catch (e) { return false; } }
    function restore(kind) {
      const r = JSON.parse(storage.getItem(KEY + '_' + kind));
      if (!isObj(r) || !isObj(r.systems)) throw new Error('ما فيه نسخة صالحة');
      try { storage.setItem(KEY + '_prerestore', JSON.stringify(root)); } catch (e) { /* ignore */ }
      root = r; root.sysV = root.sysV || {}; root.bakDay = dayOf(now());
      Object.keys(checked).forEach((k) => delete checked[k]);
      write(); emit('*'); return true;
    }

    return { get, set, update, reset, write, storageFor, hasBackup, restore, isLocked: () => locked, onLock: (f) => { lockListeners.push(f); if (locked) f(); }, onChange, exportJSON, importJSON, wasCorrupt: corrupt, recovered, updated: () => root.updated || 0, systems: () => Object.keys(root.systems), now };
  }

  AMB.Save = { create, register, KEY, VERSION, LEGACY, REGISTRY, memoryStorage, browserStorage };
})();
