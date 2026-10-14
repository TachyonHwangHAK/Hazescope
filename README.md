# HazeScope SG

A static web app that shows live Singapore haze readings from NEA, cross-checks them against Meteorological Service Singapore (MSS) weather data and a regional haze model, and explains them through a voice assistant in English or 华语.

No build step, no backend, no API keys. It runs as-is on GitHub Pages.

## Features

- **Live readings** — 24-hour PSI and 1-hour PM2.5 for NEA's five regions, a 24-hour trend chart (PSI or PM2.5), and the official MOH/NEA health advisory with the current band highlighted.
- **Cross-check panel** — six checks that compare sources:
  NEA data freshness · 1-hour vs 24-hour PM2.5 trend · NEA stations vs the CAMS model over Singapore · MSS wind direction vs elevated PM2.5 upwind · MSS forecast wording vs NEA readings · rain washout.
- **Regional view** — modelled PM2.5 and US AQI for 13 cities in Malaysia, Indonesia and Brunei, with places upwind of Singapore flagged, and a 24-hour model outlook per city.
- **Map** — Singapore regions and the wider region, MSS wind arrow, and an upwind sector.
- **Updates every second** — the clock, countdown and "published x min ago" tick every second; new data is fetched on a configurable interval (1, 2, 5, 10, 15, 30 or 60 minutes; default 5).
- **Assistant** — AetherGuard, BreatheNova or 清风, each with its own tone. Answers come from the live data on the page (outdoor exercise, children and older people, chronic conditions, masks, weather, haze source, regional cities, trend, reliability), and it can switch theme or language and start the tour. Optional voice input where the browser supports it.
- **Voice** — female or male voiceovers in English or 华语 using the device's speech voices.
- **Guided tour** on first visit (skippable, replayable from Settings).
- **Themes** — Dark (default), Light, Colourful, Glass.
- **Languages** — English (default) and 华语.
- Works offline from the last saved readings, pauses fetching in background tabs, respects reduced-motion settings, keyboard accessible.

## Deploy to GitHub Pages

1. Create a repository and copy this folder's contents to its root (`index.html` must be at the top level).
2. Commit and push.
3. In the repository, open **Settings → Pages**, set **Source** to *Deploy from a branch*, choose your branch (e.g. `main`) and folder `/ (root)`, then save.
4. After a minute the site is live at `https://<user>.github.io/<repo>/`.

The `.nojekyll` file stops GitHub from running Jekyll over the files. All paths are relative, so a project-page URL works.

To preview locally, serve the folder over HTTP (ES modules don't load from `file://`):

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

## Demo mode

Add `?demo=1` to the URL, or choose **Settings → Data → Use demo data**, to run on synthetic readings in the exact API format. A banner states clearly that the numbers are not real. When live data can't be loaded at all, the page offers this as an option; it never switches to demo data on its own.

## Data sources

| What | Source | Endpoint |
|---|---|---|
| 24-hour PSI, sub-indices, 24-hour PM2.5 | NEA via data.gov.sg | `api-open.data.gov.sg/v2/real-time/api/psi` |
| 1-hour PM2.5 | NEA via data.gov.sg | `…/pm25` |
| Wind direction and speed, air temperature, humidity, rainfall | MSS via data.gov.sg | `…/wind-direction`, `…/wind-speed`, `…/air-temperature`, `…/relative-humidity`, `…/rainfall` |
| 2-hour and 24-hour forecasts | MSS via data.gov.sg | `…/two-hr-forecast`, `…/twenty-four-hr-forecast` |
| Regional PM2.5, PM10, US AQI, CO | CAMS global model via Open-Meteo | `air-quality-api.open-meteo.com/v1/air-quality` |

Health advisory bands follow MOH/NEA guidance as published on HealthHub; 1-hour PM2.5 bands follow haze.gov.sg (Normal 0–55, Elevated 56–150, High 151–250, Very High ≥251 µg/m³).

### Refresh behaviour and rate limits

data.gov.sg allows **6 requests per 10 seconds** without an API key. HazeScope queues its requests at no more than 5 per 10.5 seconds, retries once after a `429`, and pauses while the tab is hidden. A full refresh is 9 requests (11 on first load, which also fetches yesterday for a complete 24-hour chart), so it completes in about 15–20 seconds. The 24-hour forecast and the regional model are refetched at most every 15 and 10 minutes respectively, since they change slowly.

NEA publishes PSI and PM2.5 hourly. Fetching more often than every few minutes mainly refreshes the MSS weather readings.

## Project structure

```
index.html                 markup, icon sprite, first-paint theme script
manifest.webmanifest       install metadata
assets/css/app.css         all styles and the four theme token sets
assets/js/
  main.js                  bootstrap, rendering, settings, refresh loop
  config.js                endpoints, bands, cities, thresholds
  api.js                   rate-limited fetch and response normalisation
  data.js                  refresh orchestration, cache, per-source status
  analysis.js              summaries and cross-reference checks
  i18n.js                  English and 华语 strings
  assistant.js             personas and intent engine
  voice.js                 speech synthesis voice selection
  tutorial.js              guided tour
  chart.js                 SVG trend chart
  map.js                   Leaflet map (loaded from unpkg with SRI)
  sky.js                   animated hero sky
  anim.js                  lerp animation engine
  demo.js                  synthetic data for demo mode
assets/icons/              app icons
```

## Browser support

Current versions of Chrome, Edge, Safari (macOS and iOS) and Firefox. The styles use `color-mix()` and `backdrop-filter`, which need roughly Chrome/Edge 111+, Safari 16.2+ and Firefox 113+; older browsers get a plainer but working layout.

## Limitations and caveats

Please read these before relying on the app.

1. **Browser access to data.gov.sg was not verified end to end.** The build environment could not reach data.gov.sg, Open-Meteo, unpkg or CARTO directly. The PSI and PM2.5 response formats were checked against live responses; the MSS weather and forecast parsers follow the published schema and accept both naming variants. The app was tested in headless Chromium (desktop and iPhone-sized viewports) with responses in the same format. If data.gov.sg ever stops sending CORS headers, browser requests will fail; the app then shows the error state and the last saved readings. The fix would be a small proxy, which GitHub Pages can't host.
2. **Only Chromium was tested.** Safari, Firefox and Edge have not been run against this build. Please check on real devices, especially iOS Safari voice playback.
3. **The map was tested with a stub of Leaflet**, because the real library couldn't be downloaded during the build. If Leaflet or its SRI check fails, the map area shows a message and the region readings remain available.
4. **Voices depend on the device.** Browsers have no built-in "sweet" voice; the app picks the best installed female or male voice for the language and adjusts pitch. Some devices lack a voice for a language or gender; Settings shows which voice is in use. iOS only allows speech after a tap.
5. **The assistant is rule-based**, not a language model. It understands a defined set of questions in English and 华语 and says so when it doesn't.
6. **Regional figures are model estimates** (CAMS global, about 45 km resolution), not station measurements, and may differ from local monitoring. Open-Meteo's free tier is for non-commercial use, and requires attribution to CAMS and Open-Meteo (shown in the footer).
7. **Cross-checks are rules of thumb.** The upwind check uses the island-average wind and a ±45° sector out to 1,600 km; it is not a smoke trajectory model such as HYSPLIT.
8. **Rate limits are shared per network.** Many users behind one public IP could hit the data.gov.sg limit; the app backs off and retries. A data.gov.sg API key would raise the limit but would be visible in a public static site, so none is used.
9. **CARTO basemaps** are free for limited, non-commercial use. Check CARTO's terms before heavy or commercial traffic.
10. HazeScope SG is not affiliated with NEA, MSS or MOH, and it is not medical advice. For official advisories see haze.gov.sg and weather.gov.sg.
