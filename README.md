# StormLane: weather-aware truck routing

A React + Django app that helps a truck driver pick the safest route. It weighs forecast weather at the times the truck
will actually be on each stretch of road, the weight of the load, and the travel time.

- **Live app:** _add your hosted URL_
- **Walkthrough:** _add your Loom link_

<!-- Add a screenshot: docs/screenshot.png -->

## What it does

1. You enter an origin and destination (with autocomplete), a departure time, a load weight, and a checkpoint
   interval (10, 25 or 50 mi).
2. The backend finds **3 distinct routes**, places a checkpoint every N miles along each, and works out the truck's
   **ETA at every checkpoint**.
3. It fetches the hourly forecast at each checkpoint **for that ETA**, then classifies wind, rain and snow with the
   risk and load rules.
4. It adds up how many miles fall in each risk level and **ranks the routes** using the brief's priority order, then
   explains why the winner won.
5. The map shows all routes. The selected route is coloured by risk, with clickable checkpoints (ETA, weather, what
   drove the risk). A **48-hour corridor heatmap** with a play/scrub slider moves a truck marker along each route in
   step with the forecast hour.

A **Demo storm** toggle swaps the live forecast for a synthetic storm placed on the fastest route. Real weather is
often calm, so this lets you see every risk level and the recommendation logic at work. Everything after the weather
source is the same code. Results computed this way are clearly labelled.

## Architecture

```
frontend/  React 18 + TypeScript + Vite + react-leaflet
backend/   Django 5 + DRF, stateless (no database), in-memory cache
           planner/
             risk.py           risk & load rules: pure functions, fully unit tested
             recommend.py      ranking + human-readable reasons
             service.py        routes -> checkpoints -> ETA weather -> risk -> summary
             alternatives.py   3 distinct routes (OSRM alternatives + via-point fallback)
             heatmap.py        hourly risk grid over the trip corridor
             route.py, geo.py  route model, distance/ETA interpolation, simplification
             providers/        OSRM (routing), Photon (geocoding), Open-Meteo (weather), synthetic storm
```

In production, one Docker image builds the React app and Django serves it through WhiteNoise, so the whole app is a
single service.

| API | Purpose | Key needed |
| --- | --- | --- |
| [OSRM](https://project-osrm.org/) public server | Routes, per-segment distance and duration | No |
| [Photon](https://photon.komoot.io/) (OpenStreetMap) | Place autocomplete | No |
| [Open-Meteo](https://open-meteo.com/) | Hourly forecast: wind, gusts, rain, showers, snowfall | No (optional `OPEN_METEO_API_KEY`) |
| Esri World Light Gray | Base map tiles | No |

### Endpoints

- `GET /api/geocode?q=…`: place suggestions
- `POST /api/plan`: `{origin, destination, departure, load_lbs, interval_mi, demo_storm}` returns routes,
  checkpoints, summaries and the recommendation
- `GET /api/heatmap?south&west&north&east&start&load_lbs`: the risk, wind, rain and snow grid for hours 0–48
- `GET /api/health`

## How the logic works

### Routes

OSRM is asked for up to 3 alternatives. It often returns only 1 or 2, so the backend also routes through *via
points* offset to either side of the straight line between origin and destination. It keeps a candidate only if:

- its travel time is no more than 1.5× the fastest route,
- it doesn't drive out to the via point and back on the same road,
- no more than 80% of it overlaps a route already chosen (compared on a ~1.4 mi grid).

### ETAs

OSRM returns a duration for every road segment. OSRM's public server only has a car profile, so each segment is
**capped at 65 mph** (`TRUCK_MAX_SPEED_MPH`) to approximate truck speed. The ETA at any mile is interpolated from the
cumulative truck time.

### Checkpoints and miles

Checkpoints sit at 0, N, 2N, … miles, plus the destination. Each one is responsible for the road **halfway to its
neighbours**, so the checkpoints cover the whole route exactly once. "Severe miles", "High miles" and so on are sums of
those stretches. The average risk is the mileage-weighted mean of the level scores (Low 0 to No Travel 4).

### Weather at the ETA

Open-Meteo hourly data, in UTC:

- **Wind** is an instantaneous value at each hour, so it is interpolated linearly to the ETA. Classification uses
  sustained 10 m wind; gusts are shown for information only.
- **Rain** (rain + showers, mm converted to in) and **snow** (snowfall, cm converted to in) are totals for the hour
  ending at each timestamp, which makes them hourly rates already. The value used is the hour that contains the ETA.

Points are snapped to a 0.05° grid (~3.5 mi), so overlapping routes share forecasts. Results are cached for 30 minutes.
Checkpoints beyond Open-Meteo's 16-day horizon are reported as "no forecast" and left out of the risk mileage.

### Risk rules

The thresholds in the brief, implemented in [`backend/planner/risk.py`](backend/planner/risk.py). Where two bands share
an endpoint (for example rain "0.10–0.25" and "0.25–0.50"), the endpoint belongs to the **higher** band, so 0.25 in/hr
is High. The No Travel bands are strict as written: rain **>** 1.00, snow **>** 3.0.

| | Low | Moderate | High | Severe | No Travel |
| --- | --- | --- | --- | --- | --- |
| Wind (mph) | <25 | 25–<35 | 35–<45 | 45–<55 | ≥55 |
| Rain (in/hr) | <0.10 | 0.10–<0.25 | 0.25–<0.50 | 0.50–1.00 | >1.00 |
| Snow (in/hr) | <0.5 | 0.5–<1.0 | 1.0–<2.0 | 2.0–3.0 | >3.0 |

The load rules raise the wind level: ≥55 mph is No Travel for any load; 45–54 mph with >30,000 lb is No Travel; 35–44
mph with >40,000 lb is Severe. A checkpoint's risk is the **worst** of wind (after load rules), rain and snow, and its
popup lists which condition caused it.

### Recommendation

Routes are sorted lexicographically by:

1. **No Travel miles.** A route that crosses a No Travel checkpoint never beats one that doesn't. The brief doesn't
   list this explicitly, but it follows from "No Travel".
2. Severe miles
3. High miles
4. Average risk
5. Travel time

Miles are rounded to whole miles and average risk to 0.01 before comparing, so noise-level differences don't decide a
tie. The UI says which criterion decided each comparison, for example "Fewer Severe miles than Route B (0 mi vs 50
mi)". It also warns when even the best route still has Severe or No Travel miles.

### Heatmap

The backend samples up to 180 grid points covering the corridor's bounding box (padded) at hourly steps from departure
to +48 h. Each point gets a continuous **risk index** whose integer part is exactly the categorical level, so heatmap
colours always agree with the checkpoint badges. Raw wind, rain and snow layers are included too. The grid rows are
spaced evenly in Web Mercator, so they line up exactly with the map.

On the frontend, all 49 hourly frames arrive in one ~130 KB response. Moving the slider just repaints a small canvas,
one pixel per cell, which the browser scales up with bilinear smoothing inside a Leaflet overlay, then masks to a soft
corridor around the routes. Values are blended between hours in 15-minute steps, so playback is continuous. Each repaint
takes about 0.2 ms and makes no network requests. The slider state lives in the map panel, so playback doesn't
re-render the sidebar.

## Assumptions and limitations

- No hours-of-service breaks. ETAs assume continuous driving. Adding FMCSA rest stops would push later checkpoints
  later.
- OSRM's car network has no truck restrictions (bridges, hazmat, weight limits). A truck profile such as GraphHopper,
  HERE or a self-hosted OSRM truck profile would plug into `providers/osrm.py`.
- The public OSRM and Open-Meteo services are rate-limited. A heavy burst of plans can briefly return "rate limit
  reached". Set `OPEN_METEO_API_KEY` for the commercial tier.
- Times are shown in the browser's time zone.

## Running locally

Requires Python 3.11+ and Node 20+.

```bash
# backend
cd backend
python -m venv .venv
.venv/Scripts/activate          # Windows; use `source .venv/bin/activate` on macOS/Linux
pip install -r requirements.txt
python manage.py runserver 8000

# frontend (second terminal)
cd frontend
npm install
npm run dev                     # http://localhost:5173, proxies /api to :8000
```

To use a different backend port: `API_PROXY=http://127.0.0.1:8010 npm run dev`.

### Tests

```bash
cd backend && pytest            # 65 tests: every risk band edge, load rules, ranking order, ETA weather lookup, API
cd frontend && npm run typecheck
```

## Deploying

### Vercel

`vercel.json` builds the React app as static files, and `api/index.py` runs Django as a Python function for `/api/*`.

1. On Vercel, choose **Add New → Project** and import this repo. Keep the root directory as `./`; the build settings
   come from `vercel.json`.
2. Add the environment variable `DJANGO_SECRET_KEY` (any long random string).
3. Deploy.

Every serverless instance starts with an empty forecast cache, so repeated plans hit Open-Meteo more often than they do
on a long-running server.

### Docker (Render, Railway, Fly.io, Cloud Run)

The `Dockerfile` builds the frontend and serves everything from Django with gunicorn on `$PORT`. On Render, choose
New → Blueprint and pick the repo to use `render.yaml`.

| Env var | Default | Purpose |
| --- | --- | --- |
| `DJANGO_SECRET_KEY` | dev key | Set in production |
| `DJANGO_DEBUG` | `1` (`0` in Docker) | |
| `DJANGO_ALLOWED_HOSTS` | `*` | Comma-separated |
| `TRUCK_MAX_SPEED_MPH` | `65` | Truck speed cap for ETAs |
| `OPEN_METEO_API_KEY` | empty | Optional: commercial Open-Meteo |
| `OSRM_URL` / `PHOTON_URL` | public servers | Point at self-hosted instances |
