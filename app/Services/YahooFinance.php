<?php

namespace App\Services;

use Carbon\CarbonImmutable;
use Illuminate\Http\Client\Pool;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;

/**
 * Thin client for Yahoo Finance's public (unofficial) chart and search endpoints.
 */
class YahooFinance
{
    private const BASE = 'https://query1.finance.yahoo.com';

    // Yahoo rate-limits full browser user agents but accepts a bare one.
    private const USER_AGENT = 'Mozilla/5.0';

    /**
     * Fetch intraday bars for several symbols at once.
     *
     * @param  array<int, string>  $symbols
     * @return array<string, array<int, array{0: int, 1: float}>> [ts, close] pairs keyed by symbol
     */
    public function bars(array $symbols, string $range = '5d', string $interval = '5m'): array
    {
        return array_map(fn (array $chart) => $chart['bars'], $this->charts($symbols, $range, $interval));
    }

    /**
     * Official daily closes, keyed by the exchange's local date.
     *
     * @param  array<int, string>  $symbols
     * @return array<string, array<string, float>>
     */
    public function dailyCloses(array $symbols, string $range = '3mo'): array
    {
        return array_map(function (array $chart) {
            $closes = [];

            foreach ($chart['bars'] as [$ts, $close]) {
                $closes[CarbonImmutable::createFromTimestamp($ts, $chart['timezone'])->toDateString()] = $close;
            }

            return $closes;
        }, $this->charts($symbols, $range, '1d'));
    }

    /**
     * @param  array<int, string>  $symbols
     * @return array<string, array{timezone: string, bars: array<int, array{0: int, 1: float}>}>
     */
    private function charts(array $symbols, string $range, string $interval): array
    {
        $responses = Http::pool(fn (Pool $pool) => array_map(
            fn (string $symbol) => $pool->as($symbol)
                ->withUserAgent(self::USER_AGENT)
                ->timeout(15)
                ->get(self::BASE.'/v8/finance/chart/'.rawurlencode($symbol), [
                    'range' => $range,
                    'interval' => $interval,
                    'includePrePost' => 'false',
                ]),
            $symbols,
        ));

        $charts = [];

        foreach ($responses as $symbol => $response) {
            if (! $response instanceof Response || ! $response->successful()) {
                continue;
            }

            $result = $response->json('chart.result.0');
            $timestamps = $result['timestamp'] ?? [];
            $closes = $result['indicators']['quote'][0]['close'] ?? [];
            $bars = [];

            foreach ($timestamps as $i => $ts) {
                if (isset($closes[$i])) {
                    $bars[] = [(int) $ts, (float) $closes[$i]];
                }
            }

            $charts[$symbol] = [
                'timezone' => $result['meta']['exchangeTimezoneName'] ?? 'UTC',
                'bars' => $bars,
            ];
        }

        return $charts;
    }

    /**
     * Search for tradable symbols.
     *
     * @return array<int, array{symbol: string, name: string, exchange: string, type: string}>
     */
    public function search(string $query): array
    {
        $response = Http::withUserAgent(self::USER_AGENT)
            ->timeout(10)
            ->get(self::BASE.'/v1/finance/search', [
                'q' => $query,
                'quotesCount' => 20,
                'newsCount' => 0,
            ]);

        if (! $response->successful()) {
            return [];
        }

        return collect($response->json('quotes', []))
            ->filter(fn (array $quote) => isset($quote['symbol'], $quote['exchange']))
            ->map(fn (array $quote) => [
                'symbol' => $quote['symbol'],
                'name' => trim($quote['longname'] ?? $quote['shortname'] ?? $quote['symbol']),
                'exchange' => $quote['exchange'],
                'type' => $quote['quoteType'] ?? 'EQUITY',
            ])
            ->values()
            ->all();
    }
}
