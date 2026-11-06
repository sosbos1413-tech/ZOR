/*
 * Play against a friend, each on their own phone (ui side of core/netsync.js).
 *   host: "سوّ غرفة" -> a short room code -> the friend types it in "ادخل غرفة" -> both pick a hero -> same match, same seed.
 * The two phones talk directly (WebRTC through the free PeerJS broker, loaded only when you open a room).
 * Only the moves of each prep round are sent; both phones replay them and get the identical fight.
 */
(function () {
  const AMB = globalThis.AMB;
  const UI = () => globalThis.AMB_UI;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const randCode = () => Array.from({ length: 5 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');
  const PEER_SRC = 'https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js';
  const useLocal = () => /[?&]nettest=1/.test(location.search);   // two tabs of the same browser (for testing without internet)

  // ------------------------------------------------------------------ transports: both give a "link" { send(obj), onmessage, onclose, close() }
  function makeLink(raw) { return { raw, onmessage: null, onclose: null, send: null, close: null }; }
  function loadPeerJS() {
    return new Promise((res, rej) => {
      if (globalThis.Peer) return res();
      const s = document.createElement('script'); s.src = PEER_SRC; s.onload = () => res(); s.onerror = () => rej(new Error('load'));
      document.head.appendChild(s); setTimeout(() => rej(new Error('timeout')), 12000);
    });
  }
  function openPeer(id) {
    return new Promise((res, rej) => {
      const p = id ? new Peer(id, { debug: 0 }) : new Peer({ debug: 0 });
      p.on('open', () => res(p)); p.on('error', rej); setTimeout(() => rej(new Error('timeout')), 12000);
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
          const peer = await openPeer('zor-' + code);
          const linked = new Promise((res) => peer.on('connection', (c) => { c.on('open', () => res(wrapConn(c))); }));
          return { code, linked, close: () => { try { peer.destroy(); } catch (e) { /* ignore */ } } };
        } catch (e) { if (!e || e.type !== 'unavailable-id') throw e; }
      }
      throw new Error('no id');
    },
    async join(code) {
      await loadPeerJS();
      const peer = await openPeer();
      return new Promise((res, rej) => {
        const conn = peer.connect('zor-' + code, { reliable: true });
        const to = setTimeout(() => rej(new Error('timeout')), 12000);
        peer.on('error', (e) => { clearTimeout(to); rej(e); });
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
  const transport = () => (useLocal() ? Locals : Peers);

  // ------------------------------------------------------------------ lobby
  let room = null;   // { code, close } while waiting for a friend
  const ui = () => UI();
  function fresh(idx, link) { return { idx, link, theirHero: null, theirStart: null, myHero: null, inbox: null, sentReady: false, peerReady: null, iClaimed: false, peerReward: null, rec: null, over: false }; }

  function openMenu() {
    ui().modal(`<h2>العب ضد صاحبك</h2><p class="hint">كل واحد من جواله. واحد يسوّي غرفة ويعطي صاحبه الرمز، والثاني يدخلها.</p>
      <div class="net-btns"><button class="btn primary big" data-act="netHost">سوّ غرفة</button><button class="btn big" data-act="netJoin">ادخل غرفة</button></div>
      <p class="hint">تحتاج نت للاثنين. ما تنحسب هالمباريات في الممر ولا تعطي جوائز.</p>`);
  }
  async function host() {
    ui().modal(`<h2>جاري تجهيز الغرفة…</h2><p class="hint">لحظة</p>`);
    try {
      room = await transport().host();
    } catch (e) { ui().modal(`<h2>ما قدرت أسوّي الغرفة</h2><p class="hint">تأكد من النت وجرّب مرة ثانية.</p><div class="net-btns"><button class="btn" data-act="closeModal">تمام</button></div>`); return; }
    const code = room.code;
    ui().modal(`<h2>غرفتك جاهزة</h2><p class="hint">أعطِ صاحبك هالرمز، وخلّه يضغط «ادخل غرفة»:</p>
      <div class="net-code" dir="ltr">${code}</div>
      <div class="net-btns"><button class="btn" data-act="netCopy">نسخ الرمز</button><button class="btn" data-act="netShare">إرسال</button><button class="btn ghost" data-act="netCancel">إلغاء</button></div>
      <p class="hint" id="net-status">ينتظر صاحبك…</p>`);
    const myRoom = room;
    myRoom.linked.then((link) => { if (room !== myRoom) { link.close(); return; } room = null; connected(0, link); });
  }
  function joinForm() {
    ui().modal(`<h2>ادخل غرفة</h2><p class="hint">اكتب الرمز اللي عطاك إياه صاحبك:</p>
      <input id="net-in" class="net-input" dir="ltr" maxlength="5" autocapitalize="characters" autocomplete="off" placeholder="XXXXX">
      <div class="net-btns"><button class="btn primary big" data-act="netJoinGo">دخول</button><button class="btn ghost" data-act="closeModal">إلغاء</button></div><p class="hint" id="net-status"></p>`);
    setTimeout(() => { const i = document.getElementById('net-in'); if (i) i.focus(); }, 100);
  }
  async function join() {
    const input = document.getElementById('net-in'), code = (input && input.value || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    const st = document.getElementById('net-status');
    if (code.length < 4) { if (st) st.textContent = 'اكتب الرمز كامل'; return; }
    if (st) st.textContent = 'جاري الدخول…';
    try { const link = await transport().join(code); connected(1, link); }
    catch (e) { if (st) st.textContent = (e && e.type === 'peer-unavailable') || (e && e.message === 'timeout') ? 'ما لقيت الغرفة. تأكد من الرمز وإن صاحبك فاتحها' : 'ما قدرت أتصل، جرّب مرة ثانية'; }
  }

  function connected(idx, link) {
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
    n.link.send({ t: 'hero', hero });
    waiting('ينتظر صاحبك يختار بطله…');
    tryStart();
  }
  function tryStart() {
    const S = ui().S, n = S.net; if (!n || !n.myHero || !n.theirHero) return;
    if (n.idx === 0) {   // the host decides the seed
      const seed = 1 + Math.floor(Math.random() * 2 ** 30);
      n.link.send({ t: 'start', seed, heroes: [n.myHero, n.theirHero] });
      begin(seed, [n.myHero, n.theirHero]);
    } else if (n.theirStart) begin(n.theirStart.seed, n.theirStart.heroes);
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
    const players = n.heroes.map((h, k) => ({ heroId: h, name: k === i ? 'أنت' : 'صاحبك' }));
    const m = new AMB.Match({ mode: 'online', seed: n.seed, isolated: true, players });
    n.rec = AMB.NetSync.record(m, i);
    n.sentReady = false; n.peerReady = null; n.iClaimed = false; n.peerReward = null; n.over = false;
    return m;
  }

  // ------------------------------------------------------------------ in the match
  function waiting(text) {
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
    if (!n.peerReady || n.peerReady.round !== m.round) waiting('جاهز! ينتظر صاحبك…');
    pump();
  }
  function rewardClaimed() {
    const S = ui().S, n = S.net, m = S.match;
    n.iClaimed = true;
    n.link.send({ t: 'reward', round: m.round, ops: n.rec.take() });
    if (!n.peerReward || n.peerReward.round !== m.round) waiting('ينتظر صاحبك يختار مكافأته…');
    pump();
  }
  function pump() {
    const S = ui().S, n = S.net; if (!n || !S.match) return;
    const m = S.match, other = 1 - n.idx;
    if (n.sentReady && n.peerReady && n.peerReady.round === m.round && S.phase === 'waiting') {
      const bad = AMB.NetSync.replay(m, other, n.peerReady.ops);
      if (bad.length) console.warn('online: replay problems', bad);
      n.sentReady = false; n.peerReady = null;
      ui().closeOverlay();
      ui().startCombat();
    }
    if (n.iClaimed && n.peerReward && n.peerReward.round === m.round && S.phase === 'result') {
      const bad = AMB.NetSync.replay(m, other, n.peerReward.ops);
      if (bad.length) console.warn('online: reward replay problems', bad);
      n.iClaimed = false; n.peerReward = null;
      ui().closeOverlay();
      ui().afterReward();
    }
  }
  function onMessage(msg) {
    const S = ui().S, n = S.net; if (!n || !msg) return;
    switch (msg.t) {
      case 'hero': n.theirHero = msg.hero; tryStart(); break;
      case 'start': n.theirStart = msg; tryStart(); break;
      case 'ready': n.peerReady = msg; pump(); break;
      case 'reward': n.peerReward = msg; pump(); break;
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
  function cancelRoom() { if (room) { room.close(); room = null; } ui().closeModal(); }

  function installActions() {
    const u = ui(); if (!u || u.ACT.netHost) return;
    Object.assign(u.ACT, {
      netMenu: () => openMenu(),
      netHost: () => host(),
      netJoin: () => joinForm(),
      netJoinGo: () => join(),
      netCancel: () => cancelRoom(),
      netCopy: () => { const c = room && room.code; if (!c) return; try { navigator.clipboard.writeText(c); u.toast('نسخت الرمز', 'good'); } catch (e) { u.toast('الرمز: ' + c, ''); } },
      netShare: () => { const c = room && room.code; if (!c) return; const text = `تعال العب ضدي في ZOR! ادخل «ادخل غرفة» واكتب الرمز: ${c}\n${location.href.split('?')[0]}`; if (navigator.share) navigator.share({ text }).catch(() => {}); else { try { navigator.clipboard.writeText(text); u.toast('نسخت الدعوة', 'good'); } catch (e) { u.toast('الرمز: ' + c, ''); } } },
      netLeave: () => { leave(); u.ACT.abandon(); },
    });
  }

  AMB.NetUI = { installActions, heroChosen, makeMatch, iAmReady, rewardClaimed, pump, leave, openMenu, useLocal };
  if (UI()) installActions();
})();
