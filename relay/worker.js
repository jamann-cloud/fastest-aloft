// Fastest Aloft relay: fetches public flight data server-side and returns it with
// browser-friendly CORS headers. Only the exact data paths the app uses are allowed.
const UPSTREAM = {
  lol: "https://api.adsb.lol",
  fi: "https://opendata.adsb.fi",
  osky: "https://opensky-network.org",
};
const ALLOWED = [
  /^\/lol\/v2\/(point\/-?\d+(\.\d+)?\/-?\d+(\.\d+)?\/\d{1,3}|hex\/[0-9a-f]{6}|mil)$/i,
  /^\/fi\/api\/v2\/(lat\/-?\d+(\.\d+)?\/lon\/-?\d+(\.\d+)?\/dist\/\d{1,3}|hex\/[0-9a-f]{6}|mil)$/i,
  /^\/osky\/api\/states\/all$/,
];
const ORIGINS = ["https://jamann-cloud.github.io", "null"];

export default {
  async fetch(request, env, ctx) {
    const origin = request.headers.get("Origin") || "";
    const allowOrigin = ORIGINS.includes(origin) ? origin : ORIGINS[0];
    const cors = {
      "Access-Control-Allow-Origin": allowOrigin,
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Vary": "Origin",
    };
    if (request.method === "OPTIONS") return new Response(null, { headers: cors });
    if (origin && !ORIGINS.includes(origin)) return new Response("Forbidden", { status: 403, headers: cors });

    const url = new URL(request.url);
    if (url.pathname === "/") return new Response("Fastest Aloft relay is running", { headers: cors });
    if (request.method !== "GET" || !ALLOWED.some(r => r.test(url.pathname))) {
      return new Response("Not found", { status: 404, headers: cors });
    }
    const [, key, ...rest] = url.pathname.split("/");
    const target = `${UPSTREAM[key]}/${rest.join("/")}`;

    // Share identical requests for a few seconds to stay gentle on the free feeds.
    const ttl = key === "osky" ? 60 : 4;
    const cache = caches.default;
    const cacheKey = new Request(target);
    let res = await cache.match(cacheKey);
    if (!res) {
      const up = await fetch(target, {
        headers: { "User-Agent": "FastestAloft/1.0 (+https://jamann-cloud.github.io/fastest-aloft/)", "Accept": "application/json" },
      });
      res = new Response(up.body, up);
      res.headers.set("Cache-Control", `public, max-age=${ttl}`);
      if (up.ok) ctx.waitUntil(cache.put(cacheKey, res.clone()));
    }
    const out = new Response(res.body, res);
    for (const [k, v] of Object.entries(cors)) out.headers.set(k, v);
    out.headers.set("Cache-Control", "no-store");
    return out;
  },
};
