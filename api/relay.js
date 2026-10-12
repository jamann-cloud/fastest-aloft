// Vercel Edge Function: reads the public flight feeds server-side so the page can use them.
// /api/<feed>/<path> is rewritten here (see vercel.json). Only the paths the app uses are allowed.
export const config = { runtime: "edge" };

const UPSTREAM = {
  lol: "https://api.adsb.lol",
  fi: "https://opendata.adsb.fi",
  osky: "https://opensky-network.org",
};
const ALLOWED = [
  /^lol\/v2\/(point\/-?\d+(\.\d+)?\/-?\d+(\.\d+)?\/\d{1,3}|hex\/[0-9a-f]{6}|mil)$/i,
  /^fi\/api\/v2\/(lat\/-?\d+(\.\d+)?\/lon\/-?\d+(\.\d+)?\/dist\/\d{1,3}|hex\/[0-9a-f]{6}|mil)$/i,
  /^osky\/api\/states\/all$/,
];
const EXTRA_ORIGINS = ["https://jamann-cloud.github.io", "null"];

export default async function handler(request) {
  const url = new URL(request.url);
  const origin = request.headers.get("Origin");
  const allowed = !origin || origin === url.origin || EXTRA_ORIGINS.includes(origin);
  const cors = { "Access-Control-Allow-Origin": origin && allowed ? origin : url.origin, "Vary": "Origin" };
  if (!allowed) return new Response("Forbidden", { status: 403, headers: cors });
  if (request.method === "OPTIONS") return new Response(null, { headers: { ...cors, "Access-Control-Allow-Methods": "GET, OPTIONS" } });

  const path = (url.searchParams.get("path") || "").replace(/^\/+/, "");
  if (!path) return new Response("Fastest Aloft relay is running", { headers: cors });
  if (request.method !== "GET" || !ALLOWED.some(r => r.test(path))) return new Response("Not found", { status: 404, headers: cors });

  const [key, ...rest] = path.split("/");
  try {
    const up = await fetch(`${UPSTREAM[key]}/${rest.join("/")}`, {
      headers: { "User-Agent": "FastestAloft/1.0 (+https://github.com/jamann-cloud/fastest-aloft)", "Accept": "application/json" },
    });
    const ttl = key === "osky" ? 60 : 4;   // share identical requests briefly to stay gentle on the free feeds
    return new Response(up.body, {
      status: up.status,
      headers: { ...cors, "Content-Type": up.headers.get("Content-Type") || "application/json", "Cache-Control": `public, s-maxage=${ttl}, max-age=0` },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: "Upstream feed unreachable" }), { status: 502, headers: { ...cors, "Content-Type": "application/json" } });
  }
}
