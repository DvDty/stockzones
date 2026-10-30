<?php

use App\Services\MarketData;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Schedule;

Artisan::command('stockzones:sync {--force : Ignore the refresh interval}', function (MarketData $data) {
    $symbols = array_column($data->rows(), 'symbol');
    $data->refresh($symbols, (bool) $this->option('force'));
    $this->info('Synced '.count($symbols).' symbols.');
})->purpose('Fetch the latest price bars for every market and watchlist stock');

Schedule::command('stockzones:sync')->everyFiveMinutes()->withoutOverlapping();

Artisan::command('stockzones:export {path=public/data : Directory to write the JSON files to}', function (MarketData $data) {
    $rows = $data->rows();
    $data->refresh(array_column($rows, 'symbol'), force: true);

    $path = $this->argument('path');
    File::ensureDirectoryExists($path);

    foreach (array_keys(MarketData::RANGES) as $range) {
        $timeline = $data->timeline($range);
        File::put("$path/timeline-$range.json", json_encode($timeline, JSON_UNESCAPED_SLASHES));

        $empty = collect($timeline['rows'])->filter(fn (array $row) => $row['last'] === null)->pluck('symbol');

        // Publishing nothing would replace the last good data, so fail instead.
        if ($empty->count() === count($rows)) {
            $this->error('No price data for any symbol; is Yahoo blocking requests?');

            return 1;
        }

        if ($empty->isNotEmpty()) {
            $this->warn("$range: no data for ".$empty->implode(', '));
        }
    }

    $this->info('Wrote '.count(MarketData::RANGES).' timelines for '.count($rows)." symbols to $path.");
})->purpose('Sync every symbol and write the timelines as static JSON');
