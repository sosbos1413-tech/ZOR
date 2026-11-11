/*
 * Play against a friend, each on their own phone (ui side of core/netsync.js).
 *   host: "سوّ غرفة" -> a room code (XXXXX-XXXXX, 50 random bits) -> the friend types it in "ادخل غرفة" -> both pick a hero -> same match, same seed.
 * The two phones talk directly (WebRTC through the free PeerJS broker, loaded only when you open a room); when that fails,
 * through the ntfy.sh relay (topic and HMAC key derived from the code: strangers can neither find the room nor inject messages).
 * Only the moves of each prep round are sent; both phones replay them and get the identical fight.
 */
(function () {
  const AMB = globalThis.AMB;
  const UI = () => globalThis.AMB_UI;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const N = AMB.NetSync;
  // room codes: 10 characters (50 bits, crypto random) from an alphabet without I/O/0/1, shown as XXXXX-XXXXX. See core/netsync.js
  const randCode = () => N.newCode();
  const PEER_SRC = 'https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js';
  // Subresource Integrity of that exact file: sha384 of dist/peerjs.min.js inside the npm tarball peerjs-1.5.4.tgz (tarball checked
  // against the registry's sha512 integrity; unpkg serves the tarball's files byte for byte). If it ever fails to load, play falls back to the relay.
  const PEER_SRI = 'sha384-nlUQ8ZqCbvStErob+biJNzSgltf6urV3VGqhfIfzhmg9RXmpeRm76ELw0pYnKlTR';
  const useLocal = () => /[?&]nettest=1/.test(location.search);   // two tabs of the same browser (for testing without internet)

  // ------------------------------------------------------------------ transports: both give a "link" { send(obj), onmessage, onclose, close() }
  function makeLink(raw) { return { raw, onmessage: null, onclose: null, send: null, close: null }; }
  function loadPeerJS() {
    return new Promise((res, rej) => {
      if (globalThis.Peer) return res();
      const s = document.createElement('script'); s.src = PEER_SRC; s.integrity = PEER_SRI; s.crossOrigin = 'anonymous'; s.onload = () => res(); s.onerror = () => rej(Object.assign(new Error('load'), { type: 'load' }));
      document.head.appendChild(s); setTimeout(() => rej(Object.assign(new Error('load'), { type: 'load' })), 15000);
    });
  }
  // STUN finds your public address; TURN relays the game when two phones cannot reach each other directly (mobile networks usually need it)
  const ICE = { iceServers: [
    { urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:global.stun.twilio.com:3478' },
    { urls: ['turn:openrelay.metered.ca:80', 'turn:openrelay.metered.ca:443', 'turn:openrelay.metered.ca:443?transport=tcp'], username: 'openrelayproject', credential: 'openrelayproject' },
  ] };
  function openPeer(id) {
    return new Promise((res, rej) => {
      const p = id ? new Peer(id, { debug: 0, config: ICE }) : new Peer({ debug: 0, config: ICE });
      const to = setTimeout(() => rej(Object.assign(new Error('broker'), { type: 'broker' })), 15000);
      p.on('open', () => { clearTimeout(to); res(p); }); p.on('error', (e) => { clearTimeout(to); rej(e); });
      // the broker drops idle phones (screen off, app in background): reconnect so the room code keeps working
      p.on('disconnected', () => { try { p.reconnect(); } catch (e) { /* ignore */ } });
    });
  }
  function wrapConn(conn) {
    const link = makeLink(conn);
    link.send = (o) => { try { conn.send(JSON.stringify(o)); } catch (e) { /* closed */ } };
    link.close = () => { try { conn.close(); } catch (e) { /* ignore */ } };
    conn.on('data', (d) => { try { link.onmessage && link.onmessage(JSON.parse(d)); } catch (e) { /* ignore bad message */ } });
    conn.on('close', () => link.onclose && link.onclose());
    conn.on('error', () => link.onclose && link.onclose());
    return link;
  }
  const Peers = {
    async host() {
      await loadPeerJS();
      for (let i = 0; i < 6; i++) {
        const code = randCode();
        try {
          const peer = await openPeer(N.room(code).peerId);   // a one-way hash of the code: the broker never sees the code itself
          const linked = new Promise((res) => peer.on('connection', (c) => { c.on('open', () => res(wrapConn(c))); }));
          return { code, linked, close: () => { try { peer.destroy(); } catch (e) { /* ignore */ } } };
        } catch (e) { if (!e || e.type !== 'unavailable-id') throw e; }
      }
      throw new Error('no id');
    },
    async join(code, step, ms) {
      step = step || (() => {});
      await loadPeerJS(); step('٢/٣ الاتصال بخدمة الغرف…');
      const peer = await openPeer(); step('٣/٣ أبحث عن الغرفة وأربط الجوالين… (قد تاخذ نص دقيقة)');
      return new Promise((res, rej) => {
        const conn = peer.connect(N.room(code).peerId, { reliable: true });
        const to = setTimeout(() => rej(Object.assign(new Error('connect'), { type: 'connect' })), ms || 25000);   // found the room but cannot link the two phones
        peer.on('error', (e) => { clearTimeout(to); rej(e); });
        conn.on('error', () => { clearTimeout(to); rej(Object.assign(new Error('connect'), { type: 'connect' })); });
        conn.on('open', () => { clearTimeout(to); res(wrapConn(conn)); });
      });
    },
  };
  const Locals = {   // BroadcastChannel: lets two tabs of one browser play each other
    async host() {
      const code = randCode(), id = 'h' + Math.random(), ch = new BroadcastChannel('zor-' + code);
      const linked = new Promise((res) => { ch.onmessage = (ev) => { if (ev.data.t === 'join') { const link = mkLocal(ch, id, ev.data.id); ch.postMessage({ t: 'welcome', from: id, to: ev.data.id }); res(link); } }; });
      return { code, linked, close: () => {} };
    },
    async join(code) {
      const id = 'g' + Math.random(), ch = new BroadcastChannel('zor-' + code);
      return new Promise((res, rej) => {
        const to = setTimeout(() => rej(new Error('timeout')), 4000);
        ch.onmessage = (ev) => { if (ev.data.t === 'welcome' && ev.data.to === id) { clearTimeout(to); res(mkLocal(ch, id, ev.data.from)); } };
        ch.postMessage({ t: 'join', id });
      });
    },
  };
  function mkLocal(ch, me, other) {
    const link = makeLink(ch);
    link.send = (o) => ch.postMessage({ t: 'msg', from: me, to: other, d: JSON.stringify(o) });
    link.close = () => { ch.postMessage({ t: 'bye', from: me, to: other }); };
    ch.onmessage = (ev) => { const m = ev.data; if (m.to !== me || m.from !== other) return; if (m.t === 'msg') link.onmessage && link.onmessage(JSON.parse(m.d)); else if (m.t === 'bye') link.onclose && link.onclose(); };
    return link;
  }
  // ---- fallback: relay the messages through a free public pub/sub service (ntfy.sh). Slower than a direct link but it works on any network
  // that can open a web page (mobile carriers often block direct phone-to-phone links). Messages are tiny: only each player's moves.
  // the relay may be changed from the link only to ntfy itself or a local test server (a shared link must not be able to redirect every game message to a stranger's server)
  const RELAY = (() => { const m = /[?&]relay=([^&]+)/.exec(location.search); if (!m) return 'https://ntfy.sh'; try { const u = new URL(decodeURIComponent(m[1])); return (/(^|\.)ntfy\.sh$/.test(u.hostname) && u.protocol === 'https:') || /^(localhost|127\.0\.0\.1)$/.test(u.hostname) ? u.origin : 'https://ntfy.sh'; } catch (e) { return 'https://ntfy.sh'; } })();
  // Security (4.3): the topic is a one-way hash of the room code (unguessable, does not reveal the code), and every message is
  // signed with HMAC-SHA256 under a key also derived from the code. A message that fails the check (a stranger, an old build,
  // a tampered relay) is dropped without a word. Both phones run the same build anyway (version handshake on the hero step).
  const relayGet = (R, ev) => { try { return N.open(R.key, JSON.parse(ev.data).message); } catch (e) { return null; } };
  const relayPost = (R, obj) => fetch(`${RELAY}/${R.topic}`, { method: 'POST', body: N.seal(R.key, obj) });
  function relayLink(code, me, other) {
    const R = N.room(code), link = makeLink(null), seen = new Set(), pending = []; let seq = 0, sending = false, closed = false, es = null;
    const open = () => {
      es = new EventSource(`${RELAY}/${R.topic}/sse?since=10m`);
      es.onmessage = (ev) => {
        const m = relayGet(R, ev);
        if (!m || m.to !== me || m.from !== other || (m.t !== 'msg' && m.t !== 'bye') || seen.has(m.seq)) return;   // only my friend's messages, each once (a reconnect replays recent ones)
        seen.add(m.seq); if (m.t === 'bye') { link.onclose && link.onclose(); return; }
        link.onmessage && link.onmessage(m.o);
      };
    };
    const flush = async () => {
      if (sending) return; sending = true;
      while (pending.length && !closed) { try { const r = await relayPost(R, pending[0]); if (!r.ok) throw new Error('http ' + r.status); pending.shift(); } catch (e) { await new Promise((res) => setTimeout(res, 1500)); } }
      sending = false;
    };
    link.send = (o) => { pending.push({ t: 'msg', from: me, to: other, seq: ++seq, o }); flush(); };
    link.close = () => { pending.push({ t: 'bye', from: me, to: other, seq: ++seq }); flush(); closed = true; setTimeout(() => { try { es && es.close(); } catch (e) { /* ignore */ } }, 1500); };
    link.start = open; link.kind = 'relay';
    return link;
  }
  const Relays = {
    async host(code) {
      const R = N.room(code), id = 'h' + N.newCode().slice(0, 8);
      let es; const linked = new Promise((res, rej) => {
        es = new EventSource(`${RELAY}/${R.topic}/sse?since=10m`);
        es.onmessage = async (ev) => {
          const m = relayGet(R, ev);
          if (!m || m.t !== 'hello' || typeof m.id !== 'string') return;
          es.close(); const link = relayLink(code, id, m.id); link.start();
          await relayPost(R, { t: 'welcome', from: id, to: m.id }).catch(() => {});
          res(link);
        };
      });
      return { code, linked, close: () => { try { es.close(); } catch (e) { /* ignore */ } } };
    },
    async join(code, step) {
      const R = N.room(code), id = 'g' + N.newCode().slice(0, 8);
      step && step('أتصل عن طريق الخدمة الاحتياطية…');
      return new Promise((res, rej) => {
        const es = new EventSource(`${RELAY}/${R.topic}/sse?since=1m`); let tries = 0;
        const hello = () => relayPost(R, { t: 'hello', id }).catch(() => {});
        es.onopen = () => hello();
        const iv = setInterval(() => { if (++tries > 8) { clearInterval(iv); es.close(); rej(Object.assign(new Error('relay'), { type: 'relay' })); } else hello(); }, 5000);
        es.onmessage = (ev) => { const m = relayGet(R, ev); if (m && m.t === 'welcome' && m.to === id && typeof m.from === 'string') { clearInterval(iv); es.close(); const link = relayLink(code, id, m.from); link.start(); res(link); } };
        es.onerror = () => { /* EventSource retries by itself; the tries counter ends the wait */ };
      });
    },
  };
  // host: open BOTH kinds of room with the same code (the first friend to arrive wins). join: try the direct link, then fall back to the relay.
  const Both = {
    async host() {
      let direct = null, relay;
      try { direct = await Peers.host(); } catch (e) { direct = null; }
      const code = direct ? direct.code : randCode();
      relay = await Relays.host(code);
      const linked = new Promise((res) => { if (direct) direct.linked.then((l) => { relay.close(); res(l); }); relay.linked.then((l) => { if (direct) direct.close(); res(l); }); });
      return { code, linked, close: () => { relay.close(); if (direct) direct.close(); } };
    },
    async join(code, step) {
      try { return await Peers.join(code, step, 12000); }
      catch (e) { return Relays.join(code, step); }   // any failure of the direct link: use the relay
    },
  };
  const RelayOnly = { host: () => { const code = randCode(); return Relays.host(code); }, join: (code, step) => Relays.join(code, step) };
  const transport = () => (useLocal() ? Locals : /[?&]forcerelay=1/.test(location.search) ? RelayOnly : Both);

  // ------------------------------------------------------------------ lobby
  let room = null;   // { code, close } while waiting for a friend
  const ui = () => UI();
  function fresh(idx, link) { return { idx, link, theirHero: null, theirStart: null, myHero: null, inbox: null, sentReady: false, peerReady: null, iClaimed: false, peerReward: null, rec: null, over: false }; }

  function openMenu() {
    ui().modal(`<h2>العب ضد صاحبك</h2><p class="hint">كل واحد من جواله. واحد يسوّي غرفة ويعطي صاحبه الرمز، والثاني يدخلها.</p>
      <div class="net-btns"><button class="btn primary big" data-act="netHost">سوّ غرفة</button><button class="btn big" data-act="netJoin">ادخل غرفة</button></div>
      <p class="hint">تحتاج نت للاثنين. أول 3 مباريات مع أصحابك كل يوم تنحسب في ممر الصدع (بدون شظايا)، والأبطال كلهم مفتوحين.</p>`);
  }
  async function host() {
    ui().modal(`<h2>جاري تجهيز الغرفة…</h2><p class="hint">لحظة</p>`);
    try {
      room = await transport().host();
    } catch (e) { ui().modal(`<h2>ما قدرت أسوّي الغرفة</h2><p class="hint">${explain(e)}</p><div class="net-btns"><button class="btn" data-act="closeModal">تمام</button></div>`); return; }
    const code = room.code; keepAwake();
    ui().modal(`<h2>غرفتك جاهزة</h2><p class="hint">أعطِ صاحبك هالرمز، وخلّه يضغط «ادخل غرفة»:</p>
      <div class="net-code" dir="ltr">${N.showCode(code)}</div>
      <div class="net-btns"><button class="btn" data-act="netCopy">نسخ الرمز</button><button class="btn" data-act="netShare">إرسال</button><button class="btn ghost" data-act="netCancel">إلغاء</button></div>
      <div class="net-btns"><button class="btn small" data-act="netDiag">فحص الاتصال</button></div><div class="hint" id="net-diag" dir="rtl" style="text-align:right"></div>
      <p class="hint" id="net-status">ننتظر صاحبك… <b>لا تطفّي الشاشة ولا تطلع من اللعبة</b> لين يدخل</p>`);
    const myRoom = room;
    myRoom.linked.then((link) => { if (room !== myRoom) { link.close(); return; } room = null; connected(0, link); });
  }
  function joinForm() {
    ui().modal(`<h2>ادخل غرفة</h2><p class="hint">اكتب الرمز اللي عطاك إياه صاحبك:</p>
      <input id="net-in" class="net-input" dir="ltr" maxlength="16" autocapitalize="characters" autocomplete="off" spellcheck="false" placeholder="XXXXX-XXXXX">
      <div class="net-btns"><button class="btn primary big" data-act="netJoinGo">دخول</button><button class="btn ghost" data-act="closeModal">إلغاء</button></div><p class="hint" id="net-status"></p>
      <div class="net-btns"><button class="btn small" data-act="netDiag">فحص الاتصال</button></div><div class="hint" id="net-diag" dir="rtl" style="text-align:right"></div>`);
    setTimeout(() => { const i = document.getElementById('net-in'); if (i) i.focus(); }, 100);
  }
  async function join() {
    const input = document.getElementById('net-in'), code = N.normCode(input && input.value);
    const st = document.getElementById('net-status');
    if (!code) { if (st) st.textContent = 'الرمز ١٠ حروف وأرقام (مثل ABCDE-23456). تأكد منه واكتبه كامل'; return; }
    const step = (t) => { const e = document.getElementById('net-status'); if (e) e.textContent = t; };
    step('١/٣ تحميل خدمة الاتصال…');
    try { const link = await transport().join(code, step); connected(1, link); }
    catch (e) { if (st) st.textContent = explain(e); }
  }

  // connection check: tells you which of the three needed things works on THIS phone / network
  async function diagnose(out) {
    const line = (ok, t) => { out.innerHTML += `<div>${ok === null ? '⏳' : ok ? '✅' : '❌'} ${t}</div>`; };
    const time = async (fn) => { const t0 = Date.now(); try { const r = await fn(); return [true, Date.now() - t0, r]; } catch (e) { return [false, Date.now() - t0, e]; } };
    out.innerHTML = '';
    let r2;
    let r = await time(() => loadPeerJS()); line(r[0], `خدمة الاتصال (تحميل المكتبة): ${r[0] ? r[1] + ' ms' : 'فشل'}`);
    r = await time(() => new Promise((res, rej) => { const w = new WebSocket('wss://0.peerjs.com/peerjs?key=peerjs&id=zorchk' + Math.random().toString(36).slice(2, 8) + '&token=x'); const to = setTimeout(() => { try { w.close(); } catch (e) { /* ignore */ } rej(new Error('timeout')); }, 9000); w.onopen = () => { clearTimeout(to); w.close(); res(); }; w.onerror = () => { clearTimeout(to); rej(new Error('error')); }; }));
    line(r[0], `خدمة الغرف (الوسيط): ${r[0] ? r[1] + ' ms' : 'ما وصلت'}`);
    r = await time(() => new Promise((res) => {
      const types = new Set(); const pc = new RTCPeerConnection(ICE); pc.createDataChannel('x');
      pc.onicecandidate = (e) => { if (e.candidate) { const m = / typ (\w+)/.exec(e.candidate.candidate); if (m) types.add(m[1]); } else { pc.close(); res(types); } };
      pc.createOffer().then((o) => pc.setLocalDescription(o)); setTimeout(() => { try { pc.close(); } catch (e) { /* ignore */ } res(types); }, 9000);
    }));
    r2 = await time(() => new Promise((res, rej) => { const to = setTimeout(() => { try { es.close(); } catch (e) { /* ignore */ } rej(new Error('timeout')); }, 9000); const es = new EventSource(`${RELAY}/zor-check-${Math.random().toString(36).slice(2, 8)}/sse`); es.onopen = () => { clearTimeout(to); es.close(); res(); }; }));
    line(r2[0], `الخدمة الاحتياطية (ترحيل الرسائل): ${r2[0] ? r2[1] + ' ms' : 'ما وصلت'}`);
    const T = [...r[2]]; line(T.includes('srflx') || T.includes('relay'), `ربط الجوالين: ${T.length ? T.join(' + ') : 'ما وصلت أي إشارة'}${T.includes('relay') ? ' (فيه ترحيل)' : T.includes('srflx') ? '' : ' ← الشبكة تمنع الربط المباشر'}`);
    out.innerHTML += '<div class="hint" style="margin-top:6px">صوّر هالنتيجة وارسلها لي</div>';
  }

  // say WHAT failed, so a bad code is not confused with a blocked network
  function explain(e) {
    const t = (e && (e.type || e.message)) || '';
    if (t === 'peer-unavailable' || t === 'timeout') return 'ما لقيت الغرفة. تأكد من الرمز، وإن صاحبك فاتح نافذة «غرفتك جاهزة» وما طفى الشاشة';
    if (t === 'relay') return 'ما لقيت الغرفة. تأكد من الرمز، وإن صاحبك فاتح نافذة «غرفتك جاهزة»، والنت شغّال عند الاثنين';
    if (t === 'load') return 'ما قدرت أحمّل خدمة الاتصال. النت عندك ممكن يحجبها، جرّب واي فاي أو شبكة ثانية';
    if (t === 'broker' || t === 'network' || t === 'server-error' || t === 'socket-error' || t === 'socket-closed') return 'ما قدرت أوصل لخدمة الغرف. تأكد من النت، أو جرّب شبكة ثانية';
    if (t === 'connect' || t === 'webrtc') return 'لقيت الغرفة بس ما قدرت أربط الجوالين. جرّبوا الاثنين على نفس الواي فاي، أو غيّروا الشبكة';
    return 'ما قدرت أتصل (' + t + '). جرّب مرة ثانية';
  }
  // keep the phone awake while waiting in the room
  let wake = null;
  const keepAwake = async () => { try { if (navigator.wakeLock) wake = await navigator.wakeLock.request('screen'); } catch (e) { /* ignore */ } };
  const letSleep = () => { try { if (wake) wake.release(); } catch (e) { /* ignore */ } wake = null; };

  function connected(idx, link) {
    letSleep();
    const S = ui().S;
    S.net = fresh(idx, link);
    link.onmessage = onMessage;
    link.onclose = onClose;
    S.mode = 'online'; S.picks = [null, null]; S.pickIdx = 0;
    ui().closeModal();
    ui().toast('اتصلت مع صاحبك ✓', 'good');
    ui().renderHeroSelect(); ui().show('hero');
  }

  // after "confirm" on the hero screen
  function heroChosen(hero) {
    const S = ui().S, n = S.net; if (!n) return;
    n.myHero = hero;
    // online matches are always equal: card power and hero level are never sent or applied (progress is for the campaign/tower/events only)
    n.link.send({ t: 'hero', hero, ver: buildOf() });
    waiting('ننتظر صاحبك يختار بطله…');
    tryStart();
  }
  function tryStart() {
    const S = ui().S, n = S.net; if (!n || !n.myHero || !n.theirHero) return;
    if (n.idx === 0) {   // the host decides the seed
      const seed = 1 + Math.floor(Math.random() * 2 ** 30);
      const weekly = AMB.Match.weeklyNow();   // the host's rule of the week, so both phones play the same rule
      n.link.send({ t: 'start', seed, heroes: [n.myHero, n.theirHero], weekly });
      n.weekly = weekly; begin(seed, [n.myHero, n.theirHero]);
    } else if (n.theirStart) { n.weekly = AMB.Match.WEEKLY[n.theirStart.weekly] ? n.theirStart.weekly : null; begin(n.theirStart.seed, n.theirStart.heroes); }
  }
  function begin(seed, heroes) {
    const S = ui().S, n = S.net;
    n.seed = seed; n.heroes = heroes; n.started = true;
    ui().closeOverlay();
    ui().startMatch();
  }
  /** called by ui.js startMatch() when S.mode === 'online' */
  function makeMatch() {
    const S = ui().S, n = S.net, i = n.idx;
    const players = n.heroes.map((h, k) => ({ heroId: h, name: k === i ? 'أنت' : 'صاحبك', cardPower: null, heroLevel: 1 }));
    const m = new AMB.Match({ mode: 'online', seed: n.seed, isolated: true, players, weekly: n.weekly || null });
    n.rec = AMB.NetSync.record(m, i);
    n.sentReady = false; n.peerReady = null; n.iClaimed = false; n.peerReward = null; n.over = false;
    // B7: after every fight both phones compare who won, both lives and the fight length (same channel as the state hash)
    const resolve = m.resolveCombat;
    m.resolveCombat = function (result) { const rep = resolve.call(this, result); if (S.net === n) shareValue('c' + rep.round, AMB.NetSync.combatPrint(rep)); return rep; };
    return m;
  }

  // ------------------------------------------------------------------ in the match
  function waiting(text, ms) {
    const n0 = ui().S.net; if (n0) { clearTimeout(n0.waitT); n0.waitT = null; }
    // a friend who never answers (closed the app, frozen) must not hold the match forever
    if (n0 && ms) n0.waitT = setTimeout(() => { const n1 = ui().S.net; if (n1 === n0 && !n1.over && document.querySelector('.net-wait')) netProblem('صاحبك ما رد من فترة طويلة. ممكن انقطع. ارجعوا للقائمة وجرّبوا من جديد.'); }, ms);
    ui().overlay(`<div class="ov-card net-wait"><h2>${esc(text)}</h2><div class="net-dots"><i></i><i></i><i></i></div>
      <div class="net-btns"><button class="btn ghost" data-act="netLeave">اخرج</button></div></div>`);
  }
  function iAmReady() {
    const S = ui().S, n = S.net, m = S.match;
    const ops = n.rec.take();
    n.sentReady = true;
    n.link.send({ t: 'ready', round: m.round, ops });
    S.phase = 'waiting';
    ui().renderMatch(true);
    if (!n.peerReady || n.peerReady.round !== m.round) waiting('جاهز! ننتظر صاحبك…', 150000);
    pump();
  }
  function rewardClaimed() {
    const S = ui().S, n = S.net, m = S.match;
    n.iClaimed = true;
    n.link.send({ t: 'reward', round: m.round, ops: n.rec.take() });
    if (!n.peerReward || n.peerReward.round !== m.round) waiting('ننتظر صاحبك يختار مكافأته…', 150000);
    pump();
  }
  // the two phones disagree (bad message, different versions): end the match cleanly instead of hanging on "waiting for your friend"
  function netProblem(text) {
    const S = ui().S, n = S.net; if (!n || n.over) return;
    n.over = true; try { n.link.send({ t: 'leave' }); } catch (e) { /* ignore */ }
    ui().closeOverlay();
    ui().modal(`<h2>اختلفت المباراة بين الجوالين</h2><p class="hint">${text}</p><div class="net-btns"><button class="btn primary" data-act="abandon">للقائمة</button></div>`);
  }
  const buildOf = () => { const m = document.querySelector('meta[name="zor-build"]'); return m ? m.content : 'dev'; };
  // desync check: after both phones applied everybody's moves they must hold the SAME state; each sends a fingerprint and compares it with the other's
  // keys: 'p<round>' after prep, 'r<round>' after the reward draft (state hash), 'c<round>' after the fight (combat fingerprint)
  function shareHash(key) {
    const S = ui().S, m = S.match; if (!S.net || !m) return;
    shareValue(key, AMB.NetSync.hash(m));
  }
  function shareValue(key, h) {
    const n = ui().S.net; if (!n) return;
    n.myHash = n.myHash || {}; n.peerHash = n.peerHash || {};
    n.myHash[key] = h;
    try { n.link.send({ t: 'sync', key, h }); } catch (e) { /* ignore */ }
    checkHash(key);
  }
  function checkHash(key) {
    const n = ui().S.net; if (!n || !n.myHash || !n.peerHash) return;
    if (n.myHash[key] == null || n.peerHash[key] == null || n.myHash[key] === n.peerHash[key]) return;
    if (key[0] === 'c') { console.warn('online: fight result differs', n.myHash[key], n.peerHash[key]); netProblem('نتيجة القتال طلعت غير عند صاحبك. غالبًا النسختين مختلفتين، حدّثوا الاثنين وابدأوا من جديد.'); }
    else netProblem('حالة اللعبة ما تطابقت بين الجوالين (غالبًا نسختين مختلفتين). حدّثوا الاثنين وابدأوا من جديد.');
  }
  function pump() {
    try { pumpInner(); } catch (e) { netProblem('صار خطأ في الاتصال. جرّبوا مباراة جديدة وتأكدوا إن الاثنين على آخر نسخة.'); }
  }
  function pumpInner() {
    const S = ui().S, n = S.net; if (!n || !S.match) return;
    const m = S.match, other = 1 - n.idx;
    if (n.sentReady && n.peerReady && n.peerReady.round === m.round && S.phase === 'waiting') {
      const bad = AMB.NetSync.replay(m, other, n.peerReady.ops);
      if (bad.length) { console.warn('online: replay problems', bad); netProblem('حركة صاحبك ما انطبقت عندك. غالبًا النسختين مختلفتين، حدّثوا الاثنين.'); return; }
      shareHash('p' + m.round);
      n.sentReady = false; n.peerReady = null;
      ui().closeOverlay();
      ui().startCombat();
    }
    if (n.iClaimed && n.peerReward && n.peerReward.round === m.round && S.phase === 'result') {
      const bad = AMB.NetSync.replay(m, other, n.peerReward.ops);
      if (bad.length) { console.warn('online: reward replay problems', bad); netProblem('جائزة صاحبك ما انطبقت عندك. حدّثوا الاثنين.'); return; }
      shareHash('r' + m.round);
      n.iClaimed = false; n.peerReward = null;
      ui().closeOverlay();
      ui().afterReward();
    }
  }
  const isHero = (h) => typeof h === 'string' && Object.prototype.hasOwnProperty.call(AMB.DATA.HEROES, h);
  function onMessage(msg) {
    const S = ui().S, n = S.net; if (!n || !msg) return;
    // teen #17: the friend already started the next game of the series while I am still on the results screen: keep its messages for later
    if (n.done && (msg.t === 'hero' || msg.t === 'start' || msg.t === 'again')) { (n.later = n.later || []).push(msg); return; }
    switch (msg.t) {
      case 'again': break;
      case 'hero': if (!isHero(msg.hero)) { netProblem('البطل اللي وصلنا من صاحبك مو معروف عندي. حدّثوا الاثنين.'); break; }
        if (msg.ver && buildOf() !== 'dev' && msg.ver !== 'dev' && msg.ver !== buildOf()) { netProblem('نسخة اللعبة عندك مختلفة عن صاحبك. حدّثوا الصفحة عند الاثنين وجرّبوا من جديد.'); break; }
        n.theirHero = msg.hero; tryStart(); break;
      case 'start': if (!Number.isInteger(msg.seed) || !Array.isArray(msg.heroes) || msg.heroes.length !== 2 || !msg.heroes.every(isHero)) { netProblem('بداية المباراة اللي وصلت من صاحبك مو مفهومة. حدّثوا الاثنين.'); break; }
        n.theirStart = msg; tryStart(); break;
      case 'ready': n.peerReady = msg; pump(); break;
      case 'reward': n.peerReward = msg; pump(); break;
      case 'sync': if (typeof msg.key !== 'string' || !/^[prc]\d{1,3}$/.test(msg.key) || typeof msg.h !== 'string' || msg.h.length > 80) break;
        n.peerHash = n.peerHash || {}; n.peerHash[msg.key] = msg.h; checkHash(msg.key); break;
      case 'leave': peerLeft(); break;
      default: break;
    }
  }
  function onClose() {
    const S = ui().S, n = S.net; if (!n || n.over || n.closing) return;
    if (S.match && !S.match.isOver) {
      n.over = true;
      ui().modal(`<h2>انقطع الاتصال</h2><p class="hint">صاحبك طلع أو النت انقطع.</p><div class="net-btns"><button class="btn primary" data-act="abandon">للقائمة</button></div>`);
    } else if (S.screen === 'hero' || S.phase === 'idle') {
      n.over = true; ui().closeOverlay();
      ui().modal(`<h2>انقطع الاتصال</h2><p class="hint">صاحبك طلع قبل ما تبدأ المباراة.</p><div class="net-btns"><button class="btn primary" data-act="abandon">للقائمة</button></div>`);
    }
  }
  function peerLeft() {
    const S = ui().S, n = S.net, m = S.match; if (!n || n.over) return;
    n.over = true;
    if (m && !m.isOver) {
      m.players[1 - n.idx].life = 0; m.winner = n.idx; m.phase = 'over';
      ui().closeModal(); ui().closeOverlay();
      ui().toast('صاحبك انسحب، فزت!', 'good');
      ui().showResults();
    } else {
      ui().closeOverlay();
      ui().modal(`<h2>صاحبك طلع</h2><p class="hint">طلع قبل ما تبدأ المباراة.</p><div class="net-btns"><button class="btn primary" data-act="abandon">للقائمة</button></div>`);
    }
  }
  function leave() {   // I leave: tell the friend, drop the link
    const S = ui().S, n = S.net; if (!n) return;
    n.closing = true;
    try { n.link.send({ t: 'leave' }); } catch (e) { /* ignore */ }
    setTimeout(() => { try { n.link.close(); } catch (e) { /* ignore */ } }, 250);
    S.net = null;
  }
  function cancelRoom() { letSleep(); if (room) { room.close(); room = null; } ui().closeModal(); }

  function installActions() {
    const u = ui(); if (!u || u.ACT.netHost) return;
    Object.assign(u.ACT, {
      netMenu: () => openMenu(),
      netAgain: () => rematch(),
      netHost: () => host(),
      netJoin: () => joinForm(),
      netJoinGo: () => join(),
      netCancel: () => cancelRoom(),
      netDiag: () => { const o = document.getElementById('net-diag'); if (o) { o.textContent = 'جاري الفحص…'; diagnose(o); } },
      netCopy: () => { const c = room && N.showCode(room.code); if (!c) return; try { navigator.clipboard.writeText(c); u.toast('نسخت الرمز', 'good'); } catch (e) { u.toast('الرمز: ' + c, ''); } },
      netShare: () => { const c = room && N.showCode(room.code); if (!c) return; const text = `تعال العب ضدي في ZOR! ادخل «ادخل غرفة» واكتب الرمز: ${c}\n${location.href.split('?')[0]}`; if (navigator.share) navigator.share({ text }).catch(() => {}); else { try { navigator.clipboard.writeText(text); u.toast('نسخت الدعوة', 'good'); } catch (e) { u.toast('الرمز: ' + c, ''); } } },
      netLeave: () => { leave(); u.ACT.abandon(); },
    });
  }

  // teen #17: a best-of-3 series with the same friend on the same link: the score carries over, and you cannot pick a hero you already used in it
  function seriesNote(m) {
    const S = ui().S, n = S.net; if (!n || !m || !m.isOver) return '';
    if (!n.done) {
      n.done = true; n.series = n.series || { me: 0, them: 0, used: [] };
      if (n.series.me >= 2 || n.series.them >= 2) n.series = { me: 0, them: 0, used: [] };   // a finished series: the next game starts a new one
      if (m.winner === n.idx) n.series.me++; else if (m.winner === 1 - n.idx) n.series.them++;
      if (n.myHero && !n.series.used.includes(n.myHero)) n.series.used.push(n.myHero);
    }
    const s = n.series, end = s.me >= 2 ? '🏆 فزت بالسلسلة!' : s.them >= 2 ? 'صاحبك فاز بالسلسلة' : 'سلسلة أفضل من 3';
    return `<div class="series-box"><b>${end}</b> · أنت <b>${s.me}</b> – <b>${s.them}</b> صاحبك${S.net && !n.over ? '<br><button class="btn primary" data-act="netAgain">⚔ المباراة الجاية مع صاحبك</button>' : ''}<small>في السلسلة ما تقدر تعيد نفس البطل</small></div>`;
  }
  function rematch() {
    const S = ui().S, n = S.net; if (!n || n.over) { ui().toast('الاتصال انقطع', 'err'); return; }
    const nx = fresh(n.idx, n.link); nx.series = n.series; S.net = nx;
    try { n.link.send({ t: 'again' }); } catch (e) { /* ignore */ }
    S.mode = 'online'; S.picks = [null, null]; S.pickIdx = 0; S.match = null;
    ui().renderHeroSelect(); ui().show('hero');
    (n.later || []).forEach((msg) => onMessage(msg));   // what the friend already sent for this game
  }
  const usedInSeries = (id) => { const n = ui().S.net; return !!(n && n.series && !(n.series.me >= 2 || n.series.them >= 2) && n.series.used.includes(id)); };

  AMB.NetUI = { seriesNote, rematch, usedInSeries, installActions, heroChosen, makeMatch, iAmReady, rewardClaimed, pump, leave, openMenu, useLocal };
  if (UI()) installActions();
})();
