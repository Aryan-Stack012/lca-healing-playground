/* ============================================================
   LCA Playground backend — a service worker that behaves like a
   small same-origin REST API under api/v1/.

   Why a service worker: GitHub Pages is static, but the pages
   should produce REAL network activity — fetches visible in
   DevTools and the HAR, POST semantics, latency, error legs —
   so API steps and network-level tooling have something true to
   record. State is in-memory: a fresh browser session (every
   BrowserStack Automate VM) starts clean, which is exactly what
   record-then-replay needs.

   Guarantees:
   - Never caches or intercepts pages/assets — only api/v1/ paths.
   - Static *.json fixtures pass through to the network, so
     server-side callers that bypass the SW still get GET data.
   - Every wired page keeps a local fallback with byte-identical
     readout text, so nothing breaks while the SW is installing
     (it never controls the very first navigation) or if it is
     unavailable entirely.
   ============================================================ */
var VERSION = 'v1';

self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) { e.waitUntil(self.clients.claim()); });

/* in-memory state — deliberately resets with the SW lifetime */
var paidOrders = {};
var ticketCount = 0;

function json(body, status) {
  return new Response(JSON.stringify(body, null, 2), {
    status: status || 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'X-LCA-Backend': 'service-worker/' + VERSION
    }
  });
}
function delay(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

var STOCK = [
  { sku: 'NW-1001', name: 'Enterprise licence', available: true },
  { sku: 'NW-1002', name: 'Priority support', available: true },
  { sku: 'NW-1003', name: 'Additional seat', available: true },
  { sku: 'NW-1004', name: 'Audit log retention', available: true },
  { sku: 'NW-1005', name: 'SSO connector', available: true },
  { sku: 'NW-1006', name: 'Sandbox project', available: true },
  { sku: 'NW-1007', name: 'Data residency add-on', available: true }
];

self.addEventListener('fetch', function (e) {
  var url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;
  var scopePath = new URL(self.registration.scope).pathname;
  var apiRoot = scopePath + 'api/v1/';
  if (url.pathname.indexOf(apiRoot) !== 0) return;
  var route = url.pathname.slice(apiRoot.length);
  if (/\.json$/.test(route)) return;   // static fixtures stay on the network
  e.respondWith(handle(e.request, route));
});

function handle(req, route) {
  var m = req.method;
  return Promise.resolve().then(function () {

    if (route === 'health') {
      return json({ ok: true, engine: 'service-worker', version: VERSION, ticketsIssued: ticketCount });
    }

    if (route === 'quote') {
      if (m !== 'GET') return json({ error: 'method_not_allowed' }, 405);
      return delay(1200).then(function () {
        return json({ quote: 'Q-5591', validFor: '30 days' });
      });
    }

    if (route === 'stock') {
      if (m !== 'GET') return json({ error: 'method_not_allowed' }, 405);
      return json({ skus: STOCK, total: STOCK.length, available: STOCK.length });
    }

    if (route.indexOf('orders/') === 0) {
      if (m !== 'GET') return json({ error: 'method_not_allowed' }, 405);
      var id = route.slice('orders/'.length);
      if (id !== 'INV-4417') return json({ error: 'order_not_found', order: id }, 404);
      return json({
        order: id, amount: 149.00, currency: 'USD',
        status: paidOrders[id] ? 'paid' : 'unpaid',
        ref: paidOrders[id] ? 'SP-77214' : null
      });
    }

    if (route === 'payments') {
      if (m !== 'POST') return json({ error: 'method_not_allowed' }, 405);
      return req.json().catch(function () { return {}; }).then(function (b) {
        return delay(350).then(function () {
          var order = b.order || 'INV-4417';
          if (b.action === 'decline') {
            return json({ status: 'declined', ref: 'SP-77214', order: order }, 200);
          }
          paidOrders[order] = true;
          return json({ status: 'approved', ref: 'SP-77214', order: order, amount: b.amount || '149.00' }, 201);
        });
      });
    }

    if (route === 'otp/verify') {
      if (m !== 'POST') return json({ error: 'method_not_allowed' }, 405);
      return req.json().catch(function () { return {}; }).then(function (b) {
        var ok = b.code === '902137';
        return json({ accepted: ok, order: b.order || 'INV-4417' }, ok ? 200 : 401);
      });
    }

    if (route === 'tickets') {
      if (m !== 'POST') return json({ error: 'method_not_allowed' }, 405);
      ticketCount++;
      return json({ ticket: 'TKT-' + ticketCount, count: ticketCount }, 201);
    }

    /* deterministic failure legs — local replacement for httpbin */
    if (route.indexOf('status/') === 0) {
      var code = parseInt(route.slice('status/'.length), 10);
      if (code >= 200 && code < 600) return json({ status: code, note: 'deterministic status leg' }, code);
      return json({ error: 'bad_status_code' }, 400);
    }
    if (route.indexOf('latency/') === 0) {
      var ms = Math.min(parseInt(route.slice('latency/'.length), 10) || 0, 10000);
      return delay(ms).then(function () { return json({ delayed: ms }); });
    }

    return json({ error: 'not_found', route: route }, 404);
  }).catch(function (err) {
    return json({ error: 'backend_error', message: String(err && err.message || err) }, 500);
  });
}
