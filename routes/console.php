<?php

use App\Services\MarketData;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('stockzones:sync {--force : Ignore the refresh interval}', function (MarketData $data) {
    $symbols = array_column($data->rows(), 'symbol');
    $data->refresh($symbols, (bool) $this->option('force'));
    $this->info('Synced '.count($symbols).' symbols.');
})->purpose('Fetch the latest price bars for every market and watchlist stock');

Schedule::command('stockzones:sync')->everyFiveMinutes()->withoutOverlapping();
