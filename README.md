# Fastest Aloft

The fastest aircraft in the air right now, on a live map. Every 10 seconds it re-checks the leader against its closest challengers.

Live: https://jamann-cloud.github.io/fastest-aloft/

Data comes from the free community ADS-B feeds adsb.lol and adsb.fi, read through a small relay (`api/relay.js`) because the feeds block direct browser requests. The app sweeps the world one aircraft type at a time and re-checks the leader every 10 seconds. Routes and aircraft details come from adsbdb, photos from Planespotters.net, and the basemap from Esri. Speeds shown are ground speeds. Only aircraft within range of volunteer receivers can be seen.

## Hosting

Deployed on Vercel from this repo: Vercel serves the page and runs `api/relay.js`, which the app finds automatically on any `*.vercel.app` address. `tools/preview.cjs` and the `live-preview` workflow screenshot the live site in WebKit and Chromium and push the results to the `previews` branch.
