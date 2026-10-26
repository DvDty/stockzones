<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\WatchlistItem;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Validation\Rule;

class WatchlistController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'market_key' => ['required', Rule::in(array_keys(config('stockzones.markets')))],
            'symbol' => ['required', 'string', 'max:32'],
            'name' => ['required', 'string', 'max:255'],
        ]);

        $item = WatchlistItem::firstOrCreate(
            ['market_key' => $validated['market_key'], 'symbol' => $validated['symbol']],
            ['name' => $validated['name'], 'position' => (int) WatchlistItem::max('position') + 1],
        );

        return response()->json($item, $item->wasRecentlyCreated ? 201 : 200);
    }

    public function destroy(WatchlistItem $item): Response
    {
        $item->delete();

        return response()->noContent();
    }
}
