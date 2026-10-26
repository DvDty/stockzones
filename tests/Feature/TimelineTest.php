<?php

use App\Models\WatchlistItem;
use App\Services\MarketData;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Http;

function at(string $time): int
{
    return CarbonImmutable::parse($time, 'UTC')->getTimestamp();
}

/**
 * A Yahoo chart response with the given [ts, close] bars.
 */
function chart(array $bars, string $timezone = 'Europe/Berlin'): array
{
    return ['chart' => ['result' => [[
        'meta' => ['exchangeTimezoneName' => $timezone],
        'timestamp' => array_column($bars, 0),
        'indicators' => ['quote' => [['close' => array_column($bars, 1)]]],
    ]]]];
}

beforeEach(function () {
    config(['stockzones.markets' => [
        'dax' => ['name' => 'DAX', 'symbol' => '^GDAXI', 'exchange' => 'xetra', 'region' => 'Europe'],
    ]]);
});

it('measures each day against the previous official close', function () {
    $this->travelTo(CarbonImmutable::parse('2026-10-26 12:00', 'UTC'));

    Http::fake(fn ($request) => Http::response(str_contains($request->url(), 'interval=1d')
        // Daily bars are stamped at local midnight: Thursday, Friday, and Monday in progress.
        ? chart([[at('2026-10-21 22:00'), 100.0], [at('2026-10-22 22:00'), 99.5], [at('2026-10-25 23:00'), 102.0]])
        : chart([
            [at('2026-10-23 15:00'), 99.0],
            [at('2026-10-26 08:00'), 101.0],
            [at('2026-10-26 11:55'), 102.0],
        ])));

    $row = $this->getJson('/api/timeline?range=24h')->assertOk()->json('rows.0');

    // Friday's last bar carries in from before the window, measured against Thursday.
    expect($row['points'][0])->toEqual([at('2026-10-23 15:00'), 99, -1])
        ->and($row['points'][2])->toEqual([at('2026-10-26 11:55'), 102, 2.513])
        ->and($row['previous_close'])->toEqual(99.5)
        ->and($row['status'])->toBe('open')
        ->and($row['next_close'])->toBe(at('2026-10-26 16:30'));
});

it('marks a trading day without any bars as a holiday', function () {
    $data = app(MarketData::class);
    $xetra = config('stockzones.exchanges.xetra');
    $now = at('2026-10-27 12:00');

    $series = $data->series($xetra, [[at('2026-10-23 15:00'), 99.0]], [], $now - 86400 * 3, $now, $now, 300);

    $monday = collect($series['sessions'])->firstWhere('day', '2026-10-26');
    $tuesday = collect($series['sessions'])->firstWhere('day', '2026-10-27');

    expect($monday['holiday'])->toBeTrue()
        ->and($tuesday['holiday'])->toBeTrue()
        ->and($series['status'])->toBe('closed');
});

it('only offers stocks listed on the market row exchange', function () {
    Http::fake(['*/v1/finance/search*' => Http::response(['quotes' => [
        ['symbol' => 'RHM.DE', 'exchange' => 'GER', 'quoteType' => 'EQUITY', 'longname' => 'Rheinmetall AG'],
        ['symbol' => 'RNMBY', 'exchange' => 'PNK', 'quoteType' => 'EQUITY', 'shortname' => 'Rheinmetall AG'],
    ]])]);

    $this->getJson('/api/symbols?q=rheinmetall&market=dax')
        ->assertOk()
        ->assertJsonCount(1, 'results')
        ->assertJsonPath('results.0.symbol', 'RHM.DE');
});

it('adds and removes watchlist stocks under a market', function () {
    Http::fake(fn () => Http::response(chart([])));

    $id = $this->postJson('/api/watchlist', ['market_key' => 'dax', 'symbol' => 'RHM.DE', 'name' => 'Rheinmetall AG'])
        ->assertCreated()
        ->json('id');

    $this->getJson('/api/timeline')
        ->assertJsonPath('rows.1.key', 'dax:RHM.DE')
        ->assertJsonPath('rows.1.parent', 'dax')
        ->assertJsonPath('rows.1.kind', 'stock');

    $this->deleteJson("/api/watchlist/{$id}")->assertNoContent();

    expect(WatchlistItem::count())->toBe(0);
});
