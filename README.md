# stockzones

Follow the world's stock markets around the clock. Each market gets its own row on a shared
timeline showing its trading sessions, so you can see what Asia and Europe did before New York opens.

## Running it

```bash
composer run dev
```

Then open http://localhost:8000. Price data is fetched from Yahoo Finance when the page loads
(at most every 5 minutes per symbol) and stored in SQLite. To keep it fresh in the background, also run:

```bash
php artisan schedule:work
```

`php artisan stockzones:sync --force` fetches everything right away.

## Views

- **Timeline**: one lane per market, with shaded trading sessions (including lunch breaks), % change, and the NYSE open marked across every lane. Hover to read every market at the same moment.
- **Overlay**: all markets on one chart as % change since the start of the window.
- **Heatmap**: markets by 1h, 3h or 6h blocks, colored by how much each moved.

Switches: range (24h, 3 days, week), what % is measured against (previous close or window start),
shared or per-row scale, and local time or UTC.

Stocks shown under a market are listed in `config/stockzones.php` under `stocks`. When running
the Laravel app you can also hover a market row and press **+** to add one listed on that exchange.

## Published static site

`.github/workflows/publish.yml` runs every hour (and on every push to `main`). It fetches fresh
data, writes it as static JSON and deploys the dashboard to GitHub Pages. No server or database
is kept between runs, so hosting is free as long as the repository is public.

In the static site, stocks come only from the config (there's no **+**), and open/closed status is
worked out in the browser from the trading schedule, so countdowns stay right while the data ages.

To try the static build locally:

```bash
npm run build:static
php artisan stockzones:export dist/data
```

Then serve `dist/` with any static file server.

## Where things live

- `config/stockzones.php`: exchanges (local trading hours and timezone), the markets shown and their stocks
- `app/Services/MarketCalendar.php`: turns local trading hours into UTC sessions (DST-safe)
- `app/Services/MarketData.php`: syncing, % change against the official previous close, holidays, open/closed status
- `app/Services/YahooFinance.php`: data source (unofficial API, swappable)
- `resources/js/components`: `swimlanes`, `overlay-chart`, `heatmap`, `pre-open-brief`
- `resources/js/static.tsx`, `resources/static/index.html`, `vite.static.config.ts`: the static build
