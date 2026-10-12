// Loads the live site in WebKit (iPhone) and Chromium (desktop), saves screenshots and a report.
const fs = require("fs");
const { webkit, chromium, devices } = require("playwright");
const URL = process.env.SITE_URL || "https://fastest-aloft.vercel.app/";
const WAIT = Number(process.env.WAIT_MS || 32000);
(async () => {
  fs.mkdirSync("out", { recursive: true });
  const report = [];
  const runs = [
    ["iphone", webkit, devices["iPhone 15 Pro"]],
    ["iphone-open", webkit, devices["iPhone 15 Pro"]],
    ["desktop", chromium, { viewport: { width: 1366, height: 860 } }],
  ];
  for (const [name, type, dev] of runs) {
    const b = await type.launch();
    const ctx = await b.newContext(dev);
    const p = await ctx.newPage();
    const r = { name, tilesOk: 0, tilesBad: 0, failed: [], errors: [] };
    p.on("requestfailed", q => r.failed.push(`${q.failure()?.errorText} ${q.url().slice(0, 140)}`));
    p.on("response", s => {
      const u = s.url();
      if (/basemaps|arcgis|tile\./.test(u)) s.ok() ? r.tilesOk++ : r.tilesBad++;
      if (s.status() >= 400) r.failed.push(`${s.status()} ${u.slice(0, 140)}`);
    });
    p.on("pageerror", e => r.errors.push(String(e).slice(0, 300)));
    p.on("console", m => { if (m.type() === "error" || m.type() === "warning") r.errors.push(`${m.type()}: ${m.text().slice(0, 300)}`); });
    await p.goto(URL, { waitUntil: "domcontentloaded" });
    await p.waitForTimeout(WAIT);
    if (name === "iphone-open") { await p.click("#grab").catch(() => {}); await p.waitForTimeout(1200); }
    await p.screenshot({ path: `out/${name}.png` });
    r.info = await p.evaluate(() => {
      const tile = document.querySelector(".leaflet-tile");
      return {
        tilesInDom: document.querySelectorAll(".leaflet-tile-loaded").length,
        tileSrc: tile ? tile.src : null,
        tileSize: tile ? [tile.naturalWidth, tile.style.width] : null,
        paneFilter: getComputedStyle(document.querySelector(".leaflet-tile-pane") || document.body).filter,
        leafletCss: getComputedStyle(document.querySelector(".leaflet-container") || document.body).overflow,
        boot: document.getElementById("bootMsg")?.innerText,
        bootHidden: document.getElementById("boot")?.classList.contains("gone"),
        speed: document.getElementById("speed")?.innerText,
        callsign: document.getElementById("callsign")?.innerText,
        checks: document.getElementById("checkLog")?.innerText.slice(0, 300),
      };
    });
    r.failed = r.failed.slice(0, 20); r.errors = r.errors.slice(0, 15);
    report.push(r);
    await b.close();
  }
  fs.writeFileSync("out/report.json", JSON.stringify(report, null, 2));
})();
