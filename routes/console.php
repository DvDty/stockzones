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

    if (! is_string($path)) {
        $this->error('Give a single directory path.');

        return 1;
    }
    File::ensureDirectoryExists($path);

    foreach (array_keys(MarketData::RANGES) as $range) {
        $timeline = $data->timeline($range);
        File::put("$path/timeline-$range.json", json_encode($timeline, JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR));

        $empty = array_column(array_filter($timeline['rows'], fn (array $row) => $row['last'] === null), 'symbol');

        // Publishing nothing would replace the last good data, so fail instead.
        if (count($empty) === count($rows)) {
            $this->error('No price data for any symbol; is Yahoo blocking requests?');

            return 1;
        }

        if ($empty !== []) {
            $this->warn("$range: no data for ".implode(', ', $empty));
        }
    }

    $this->info('Wrote '.count(MarketData::RANGES).' timelines for '.count($rows)." symbols to $path.");
})->purpose('Sync every symbol and write the timelines as static JSON');
