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

Hover a market row and press **+** to add a stock listed on that exchange (e.g. Rheinmetall under DAX).

## Where things live

- `config/stockzones.php`: exchanges (local trading hours and timezone) and the markets shown
- `app/Services/MarketCalendar.php`: turns local trading hours into UTC sessions (DST-safe)
- `app/Services/MarketData.php`: syncing, % change against the official previous close, holidays, open/closed status
- `app/Services/YahooFinance.php`: data source (unofficial API, swappable)
- `resources/js/components`: `swimlanes`, `overlay-chart`, `heatmap`, `pre-open-brief`
