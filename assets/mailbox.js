// Per-address mailbox shared by the auth surfaces.
//
// signup.html and signin-email.html "send" verification messages here;
// inbox.html reads them back. Messages are keyed by the recipient address, so
// opening the WRONG address returns an empty inbox rather than someone else's
// code — that empty state is the assertion surface for "the run read the right
// mailbox" (permanent vs temporary), with no run-log inspection required.
//
// Codes are random per send. Nothing on any page names them, so a run has to
// read the inbox to learn a code; guessing or hard-coding cannot pass.
(function (global) {
  "use strict";

  var KEY = "lca.mailbox";
  var LIFETIME_MS = 60 * 60 * 1000;

  function norm(addr) {
    return String(addr == null ? "" : addr).trim().toLowerCase();
  }

  function readAll() {
    try {
      var raw = JSON.parse(localStorage.getItem(KEY) || "{}");
      return raw && typeof raw === "object" ? raw : {};
    } catch (e) {
      return {};
    }
  }

  function writeAll(box) {
    try { localStorage.setItem(KEY, JSON.stringify(box)); } catch (e) {}
  }

  function randHex(bytes) {
    var b = new Uint8Array(bytes);
    crypto.getRandomValues(b);
    var out = "";
    for (var i = 0; i < b.length; i++) out += b[i].toString(16).padStart(2, "0");
    return out;
  }

  function randCode() {
    var b = new Uint8Array(4);
    crypto.getRandomValues(b);
    var n = ((b[0] << 24 | b[1] << 16 | b[2] << 8 | b[3]) >>> 0) % 1000000;
    return String(n).padStart(6, "0");
  }


  // Distinguishes "storage is unusable" from "nothing was sent here". Without
  // this, a blocked localStorage reads exactly like a wrong-address lookup and
  // the wrong-mailbox assertion proves nothing.
  function available() {
    try {
      var k = KEY + ".probe";
      localStorage.setItem(k, "1");
      localStorage.removeItem(k);
      return true;
    } catch (e) {
      return false;
    }
  }

  // opts: {subject, kind:'otp'|'link', expired:boolean}
  function send(addr, opts) {
    var to = norm(addr);
    if (!to) return null;
    opts = opts || {};

    var now = Date.now();
    var msg = {
      id: "M-" + randHex(4).toUpperCase(),
      to: to,
      from: "no-reply@browserstack-demo.com",
      subject: opts.subject || "Verify your account",
      kind: opts.kind === "link" ? "link" : "otp",
      code: randCode(),
      token: randHex(8),
      at: now,
      // An already-expired message is a fixture, not an accident: it lets a run
      // exercise "refetch the newest code once" without waiting out a real TTL.
      expiresAt: opts.expired ? now - 1000 : now + LIFETIME_MS
    };

    if (!available()) return null;

    var box = readAll();
    if (!Array.isArray(box[to])) box[to] = [];
    box[to].push(msg);
    writeAll(box);
    return msg;
  }

  // Newest first, so "the most recent message" is always index 0.
  function list(addr) {
    var to = norm(addr);
    var box = readAll();
    var msgs = Array.isArray(box[to]) ? box[to].slice() : [];
    msgs.sort(function (a, b) { return b.at - a.at; });
    return msgs;
  }

  function latest(addr) {
    var msgs = list(addr);
    return msgs.length ? msgs[0] : null;
  }

  function isExpired(msg) {
    return !msg || Date.now() > msg.expiresAt;
  }

  // Returns 'ok' | 'expired' | 'mismatch' | 'empty' | 'unavailable'
  function verifyCode(addr, code) {
    if (!available()) return "unavailable";
    var msg = latest(addr);
    if (!msg) return "empty";
    if (String(code).trim() !== msg.code) return "mismatch";
    if (isExpired(msg)) return "expired";
    return "ok";
  }

  function verifyToken(addr, tok) {
    var msgs = list(addr);
    for (var i = 0; i < msgs.length; i++) {
      if (msgs[i].token === tok) return isExpired(msgs[i]) ? "expired" : "ok";
    }
    return msgs.length ? "mismatch" : "empty";
  }

  function clear(addr) {
    if (addr == null) { writeAll({}); return; }
    var box = readAll();
    delete box[norm(addr)];
    writeAll(box);
  }

  function addresses() {
    return Object.keys(readAll());
  }

  global.lcaMail = {
    send: send,
    list: list,
    latest: latest,
    verifyCode: verifyCode,
    available: available,
    verifyToken: verifyToken,
    isExpired: isExpired,
    clear: clear,
    addresses: addresses,
    normalise: norm,
    LIFETIME_MS: LIFETIME_MS
  };
})(window);
