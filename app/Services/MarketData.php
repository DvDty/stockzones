<?php

namespace App\Services;

use App\Models\DailyClose;
use App\Models\PriceBar;
use App\Models\WatchlistItem;
use Illuminate\Support\Facades\Cache;

/**
 * Keeps price bars in sync with Yahoo and builds the timeline payload.
 */
class MarketData
{
    /**
     * Visible window per range: seconds back from now, and seconds ahead so
     * upcoming sessions (like the next New York open) are visible too.
     */
    public const RANGES = [
        '24h' => ['back' => 24 * 3600, 'ahead' => 6 * 3600, 'bucket' => 300],
        '3d' => ['back' => 72 * 3600, 'ahead' => 12 * 3600, 'bucket' => 900],
        '1w' => ['back' => 168 * 3600, 'ahead' => 12 * 3600, 'bucket' => 1800],
    ];

    // Extra history loaded before the window so the first visible day has a previous close.
    private const BASELINE_LOOKBACK = 8 * 86400;

    public function __construct(
        private YahooFinance $yahoo,
        private MarketCalendar $calendar,
    ) {}

    /**
     * Every row on the timeline: configured markets, each followed by the stocks added under it.
     *
     * @return array<int, array<string, mixed>>
     */
    public function rows(): array
    {
        $watchlist = WatchlistItem::orderBy('position')->orderBy('id')->get()->groupBy('market_key');
        $rows = [];

        foreach (config('stockzones.markets') as $key => $market) {
            $rows[] = [
                'key' => $key,
                'name' => $market['name'],
                'symbol' => $market['symbol'],
                'kind' => $market['kind'] ?? 'index',
                'region' => $market['region'],
                'exchange' => $market['exchange'],
                'parent' => null,
                'watchlist_id' => null,
            ];

            foreach ($watchlist->get($key, []) as $item) {
                $rows[] = [
                    'key' => $key.':'.$item->symbol,
                    'name' => $item->name,
                    'symbol' => $item->symbol,
                    'kind' => 'stock',
                    'region' => $market['region'],
                    'exchange' => $market['exchange'],
                    'parent' => $key,
                    'watchlist_id' => $item->id,
                ];
            }
        }

        return $rows;
    }

    /**
     * Fetch fresh bars for any symbol whose data is older than the refresh interval.
     *
     * @param  array<int, string>  $symbols
     */
    public function refresh(array $symbols, bool $force = false): void
    {
        $stale = array_values(array_filter(
            array_unique($symbols),
            fn (string $symbol) => $force || ! Cache::has($this->syncKey($symbol)),
        ));

        if ($stale === []) {
            return;
        }

        // Another request is already syncing; serve what we have.
        $lock = Cache::lock('stockzones:sync', 60);

        if (! $lock->get()) {
            return;
        }

        try {
            $known = PriceBar::whereIn('symbol', $stale)->distinct()->pluck('symbol')->all();
            $new = array_values(array_diff($stale, $known));
            $existing = array_values(array_intersect($stale, $known));

            // New symbols get a month of history; known ones only need the recent days.
            $fetched = array_merge(
                $new ? $this->yahoo->bars($new, '1mo') : [],
                $existing ? $this->yahoo->bars($existing, '5d') : [],
            );
            $daily = array_merge(
                $new ? $this->yahoo->dailyCloses($new, '3mo') : [],
                $existing ? $this->yahoo->dailyCloses($existing, '1mo') : [],
            );

            foreach ($stale as $symbol) {
                $bars = $fetched[$symbol] ?? null;

                if ($bars === null) {
                    // Failed: try again in a minute instead of on every request.
                    Cache::put($this->syncKey($symbol), now()->getTimestamp(), 60);

                    continue;
                }

                foreach (array_chunk($bars, 300) as $chunk) {
                    PriceBar::upsert(
                        array_map(fn (array $bar) => ['symbol' => $symbol, 'ts' => $bar[0], 'close' => $bar[1]], $chunk),
                        ['symbol', 'ts'],
                        ['close'],
                    );
                }

                $closes = [];

                foreach ($daily[$symbol] ?? [] as $date => $close) {
                    $closes[] = ['symbol' => $symbol, 'date' => $date, 'close' => $close];
                }

                DailyClose::upsert($closes, ['symbol', 'date'], ['close']);

                Cache::put($this->syncKey($symbol), now()->getTimestamp(), config('stockzones.refresh_minutes') * 60);
            }
        } finally {
            $lock->release();
        }
    }

    /**
     * @return array<string, mixed>
     */
    public function timeline(string $range): array
    {
        $config = self::RANGES[$range];
        $now = now()->getTimestamp();
        $from = $now - $config['back'];
        $to = $now + $config['ahead'];

        $rows = $this->rows();
        $exchanges = config('stockzones.exchanges');

        $this->refresh(array_column($rows, 'symbol'));

        $bars = PriceBar::whereIn('symbol', array_column($rows, 'symbol'))
            ->where('ts', '>=', $from - self::BASELINE_LOOKBACK)
            ->orderBy('ts')
            ->get(['symbol', 'ts', 'close'])
            ->groupBy('symbol');

        $closes = DailyClose::whereIn('symbol', array_column($rows, 'symbol'))
            ->where('date', '>=', date('Y-m-d', $from - self::BASELINE_LOOKBACK - 7 * 86400))
            ->orderBy('date')
            ->get(['symbol', 'date', 'close'])
            ->groupBy('symbol');

        $syncedAt = collect($rows)
            ->map(fn (array $row) => Cache::get($this->syncKey($row['symbol'])))
            ->filter()
            ->min();

        return [
            'range' => $range,
            'now' => $now,
            'from' => $from,
            'to' => $to,
            'synced_at' => $syncedAt,
            'exchanges' => collect($exchanges)->map(fn (array $exchange, string $key) => [
                'key' => $key,
                'name' => $exchange['name'],
                'city' => $exchange['city'],
                'timezone' => $exchange['timezone'],
            ])->values(),
            'rows' => array_map(function (array $row) use ($exchanges, $bars, $closes, $from, $to, $now, $config) {
                $series = $bars->get($row['symbol'], collect())
                    ->map(fn (PriceBar $bar) => [$bar->ts, $bar->close])
                    ->all();
                $daily = $closes->get($row['symbol'], collect())
                    ->mapWithKeys(fn (DailyClose $close) => [$close->date => $close->close])
                    ->all();

                return $row + $this->series(
                    $exchanges[$row['exchange']], $series, $daily, $from, $to, $now, $config['bucket'],
                );
            }, $rows),
        ];
    }

    /**
     * Sessions, % change points and current status for one symbol.
     *
     * @param  array<string, mixed>  $exchange
     * @param  array<int, array{0: int, 1: float}>  $bars  [ts, close] oldest first
     * @param  array<string, float>  $daily  official closes by local date, oldest first
     * @return array<string, mixed>
     */
    public function series(array $exchange, array $bars, array $daily, int $from, int $to, int $now, int $bucket): array
    {
        // Sessions reach back for baselines and forward for the next open.
        $sessions = $this->calendar->sessions($exchange, $from - self::BASELINE_LOOKBACK, max($to, $now + 5 * 86400));

        $this->markHolidays($sessions, $bars, $now);

        // Each bar's % change is measured against the previous trading day's official
        // close, falling back to that day's last intraday bar.
        $points = [];
        $carry = null;
        $day = null;
        $baseline = null;
        $lastClose = null;
        $s = 0;

        foreach ($bars as [$ts, $close]) {
            while (isset($sessions[$s + 1]) && $sessions[$s + 1]['start'] <= $ts + 60) {
                $s++;
            }

            $barDay = isset($sessions[$s]) && $sessions[$s]['start'] <= $ts + 60 ? $sessions[$s]['day'] : null;

            if ($barDay !== $day) {
                $baseline = ($barDay !== null ? $this->closeBefore($daily, $barDay) : null) ?? $lastClose ?? $baseline;
                $day = $barDay;
            }

            $lastClose = $close;
            $point = [$ts, $close, $baseline ? round(($close / $baseline - 1) * 100, 3) : null, $day];

            if ($ts >= $from) {
                $points[] = $point;
            } else {
                $carry = $point;
            }
        }

        $points = $this->downsample($points, $bucket);
        $last = end($points) ?: $carry;

        // The last point before the window lets a market that hasn't traded since
        // be drawn flat from the left edge.
        if ($carry) {
            array_unshift($points, $carry);
        }

        [$status, $nextOpen, $nextClose] = $this->status($sessions, $now);

        return [
            'sessions' => array_values(array_filter(
                $sessions,
                fn (array $session) => $session['end'] > $from && $session['start'] < $to,
            )),
            'points' => array_map(fn (array $p) => [$p[0], $p[1], $p[2]], $points),
            'last' => $last ? ['t' => $last[0], 'price' => $last[1], 'pct' => $last[2]] : null,
            'previous_close' => $baseline,
            'status' => $status,
            'next_open' => $nextOpen,
            'next_close' => $nextClose,
        ];
    }

    /**
     * @param  array<string, float>  $daily
     */
    private function closeBefore(array $daily, string $day): ?float
    {
        $found = null;

        foreach ($daily as $date => $close) {
            if ($date >= $day) {
                break;
            }

            $found = $close;
        }

        return $found;
    }

    /**
     * A trading day with no bars at all, once it should have had some, was a holiday.
     *
     * @param  array<int, array<string, mixed>>  $sessions
     * @param  array<int, array{0: int, 1: float}>  $bars
     */
    private function markHolidays(array &$sessions, array $bars, int $now): void
    {
        $firstBar = $bars[0][0] ?? PHP_INT_MAX;
        $timestamps = array_column($bars, 0);
        $byDay = [];

        foreach ($sessions as $i => $session) {
            $byDay[$session['day']][] = $i;
        }

        foreach ($byDay as $indexes) {
            $start = $sessions[$indexes[0]]['start'];
            $end = $sessions[end($indexes)]['end'];

            // Too early to tell, or before our data begins.
            $holiday = $now > $start + 3600 && $start > $firstBar
                && ! $this->anyBetween($timestamps, $start - 60, min($end, $now) + 60);

            foreach ($indexes as $i) {
                $sessions[$i]['holiday'] = $holiday;
            }
        }
    }

    /**
     * @param  array<int, int>  $sorted
     */
    private function anyBetween(array $sorted, int $from, int $to): bool
    {
        $lo = 0;
        $hi = count($sorted);

        while ($lo < $hi) {
            $mid = intdiv($lo + $hi, 2);
            $sorted[$mid] < $from ? $lo = $mid + 1 : $hi = $mid;
        }

        return isset($sorted[$lo]) && $sorted[$lo] <= $to;
    }

    /**
     * @param  array<int, array<string, mixed>>  $sessions
     * @return array{0: string, 1: int|null, 2: int|null}
     */
    private function status(array $sessions, int $now): array
    {
        $open = array_values(array_filter($sessions, fn (array $session) => ! $session['holiday']));

        foreach ($open as $i => $session) {
            if ($now >= $session['start'] && $now < $session['end']) {
                return ['open', $open[$i + 1]['start'] ?? null, $session['end']];
            }

            if ($session['start'] > $now) {
                $previous = $open[$i - 1] ?? null;
                $status = $previous && $previous['day'] === $session['day'] ? 'break' : 'closed';

                return [$status, $session['start'], null];
            }
        }

        return ['closed', null, null];
    }

    /**
     * Keep the last point of each time bucket, but never merge across trading days.
     *
     * @param  array<int, array<int, mixed>>  $points
     * @return array<int, array<int, mixed>>
     */
    private function downsample(array $points, int $bucket): array
    {
        $kept = [];

        foreach ($points as $point) {
            $key = intdiv($point[0], $bucket).'|'.$point[3];
            $kept[$key] = $point;
        }

        return array_values($kept);
    }

    private function syncKey(string $symbol): string
    {
        return 'stockzones:synced:'.$symbol;
    }
}
