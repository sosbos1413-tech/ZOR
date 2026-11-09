#!/usr/bin/env node
/* Local stand-in for ntfy.sh, to test online play without internet:
 *   node tools/mock-ntfy.js 8796
 *   then open the game in two browser profiles with  ?forcerelay=1&relay=http://localhost:8796
 * POST /<topic> publishes, GET /<topic>/sse streams (stored messages are replayed first, like ?since=).
 * GET /_log lists every published body (handy to check that relay messages are signed and the topic is a hash). */
const http = require('http');
const port = +process.argv[2] || 8796;
const store = {}, subs = {}, log = []; let id = 0;
http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') { res.setHeader('Access-Control-Allow-Methods', 'GET,POST'); res.setHeader('Access-Control-Allow-Headers', '*'); res.end(); return; }
  const u = new URL(req.url, 'http://x'), parts = u.pathname.split('/').filter(Boolean);
  if (u.pathname === '/_log') { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(log)); return; }
  if (req.method === 'POST' && parts.length === 1) {
    let body = ''; req.on('data', (d) => (body += d)); req.on('end', () => {
      const topic = parts[0], m = { id: String(++id), time: Math.floor(Date.now() / 1000), event: 'message', topic, message: body };
      (store[topic] = store[topic] || []).push(m); log.push({ topic, len: body.length, head: body });
      (subs[topic] || []).forEach((r) => r.write('data: ' + JSON.stringify(m) + '\n\n'));
      res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(m));
    });
    return;
  }
  if (req.method === 'GET' && parts.length === 2 && parts[1] === 'sse') {
    const topic = parts[0];
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
    res.write('event: open\ndata: {}\n\n');
    (store[topic] || []).forEach((m) => res.write('data: ' + JSON.stringify(m) + '\n\n'));
    (subs[topic] = subs[topic] || []).push(res);
    req.on('close', () => { subs[topic] = subs[topic].filter((r) => r !== res); });
    return;
  }
  res.statusCode = 404; res.end();
}).listen(port, () => console.log('mock ntfy on', port));
