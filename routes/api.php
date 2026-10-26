<?php

use App\Http\Controllers\Api\SymbolSearchController;
use App\Http\Controllers\Api\TimelineController;
use App\Http\Controllers\Api\WatchlistController;
use Illuminate\Support\Facades\Route;

Route::get('/timeline', TimelineController::class);
Route::get('/symbols', SymbolSearchController::class);
Route::post('/watchlist', [WatchlistController::class, 'store']);
Route::delete('/watchlist/{item}', [WatchlistController::class, 'destroy']);
