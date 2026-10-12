// Fastest Aloft relay (Vercel Node function).
// The public flight feeds don't send CORS headers, so the page reads them through here.
// /api/<feed>/<path> is rewritten to /api/relay?path=<feed>/<path> by vercel.json.
// ?min=<kt> trims the response to aircraft at least that fast, which keeps worldwide
// per-type lookups small enough for a phone.

const UPSTREAM = {
  lol: "https://api.adsb.lol",
  fi: "https://opendata.adsb.fi",
  ps: "https://api.planespotters.net",
};
const NUM = "-?\\d+(?:\\.\\d+)?";
const ROUTES = [
  { key: "lol", re: new RegExp(`^lol/v2/(point/${NUM}/${NUM}/\\d{1,3}|hex/[0-9a-f]{6}|mil|type/[A-Z0-9]{2,4})$`, "i") },
  { key: "fi", re: new RegExp(`^fi/api/v2/(lat/${NUM}/lon/${NUM}/dist/\\d{1,3}|hex/[0-9a-f]{6}|mil)$`, "i") },
  { key: "ps", re: /^ps\/pub\/photos\/hex\/[0-9a-f]{6}$/i },
];
const EXTRA_ORIGINS = ["https://jamann-cloud.github.io", "null"];
const KEEP = ["hex", "type", "flight", "r", "t", "desc", "ownOp", "year", "dbFlags", "lat", "lon", "alt_baro", "alt_geom",
  "gs", "tas", "ias", "mach", "track", "true_heading", "baro_rate", "geom_rate", "squawk", "ws", "wd", "oat", "category", "seen", "seen_pos"];
const UA = "FastestAloft/1.0 (+https://github.com/jamann-cloud/fastest-aloft)";

module.exports = async (req, res) => {
  const origin = req.headers.origin;
  const self = `https://${req.headers.host}`;
  const allowed = !origin || origin === self || EXTRA_ORIGINS.includes(origin);
  res.setHeader("Vary", "Origin");
  if (origin && allowed) res.setHeader("Access-Control-Allow-Origin", origin);
  if (!allowed) return res.status(403).send("Forbidden");
  if (req.method === "OPTIONS") { res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS"); return res.status(204).end(); }

  const path = String(req.query.path || "").replace(/^\/+/, "");
  if (!path) return res.status(200).send("Fastest Aloft relay is running");
  const route = req.method === "GET" && ROUTES.find(r => r.re.test(path));
  if (!route) return res.status(404).send("Not found");
  const target = `${UPSTREAM[route.key]}/${path.slice(route.key.length + 1)}`;

  let up;
  try {
    up = await fetch(target, { headers: { "User-Agent": UA, Accept: "application/json" }, signal: AbortSignal.timeout(9000) });
  } catch (e) {
    res.setHeader("Cache-Control", "no-store");
    return res.status(502).json({ error: "Feed unreachable" });
  }
  if (!up.ok) {
    res.setHeader("Cache-Control", "no-store");
    if (up.headers.get("retry-after")) res.setHeader("Retry-After", up.headers.get("retry-after"));
    return res.status(up.status).json({ error: `Feed answered ${up.status}` });
  }

  if (route.key === "ps") {
    res.setHeader("Cache-Control", "public, s-maxage=86400");
    return res.status(200).json(await up.json());
  }

  let data;
  try { data = await up.json(); } catch (e) { return res.status(502).json({ error: "Feed sent unreadable data" }); }
  const list = data.ac || data.aircraft || [];
  const min = Number(req.query.min) || 0;
  const ac = [];
  for (const a of list) {
    if (min && (typeof a.gs !== "number" || a.gs < min || a.alt_baro === "ground")) continue;
    const o = {};
    for (const k of KEEP) if (a[k] !== undefined) o[k] = a[k];
    ac.push(o);
  }
  // share identical requests briefly so several viewers don't multiply the load on the free feeds
  const ttl = /\/hex\//.test(path) ? 3 : 8;
  res.setHeader("Cache-Control", `public, s-maxage=${ttl}, stale-while-revalidate=${ttl}`);
  return res.status(200).json({ ac, total: list.length, now: Date.now() });
};
