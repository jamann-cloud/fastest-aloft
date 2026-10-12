# Fastest Aloft

The fastest aircraft in the air right now, on a live map. Every 10 seconds it re-checks the leader against its closest challengers.

Live: https://jamann-cloud.github.io/fastest-aloft/

Data comes from free community ADS-B feeds (adsb.lol, adsb.fi) plus a periodic OpenSky snapshot, read through a small Cloudflare relay (`relay/worker.js`) because the feeds block direct browser requests. Routes and aircraft details come from adsbdb, and photos from Planespotters.net. Speeds shown are ground speeds. Only aircraft within range of volunteer receivers can be seen.
