<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\YahooFinance;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class SymbolSearchController extends Controller
{
    /**
     * Search stocks listed on the same exchange as the market row they'll be added to,
     * so they share its trading hours on the timeline.
     */
    public function __invoke(Request $request, YahooFinance $yahoo): JsonResponse
    {
        $validated = $request->validate([
            'q' => ['required', 'string', 'min:1', 'max:64'],
            'market' => ['required', Rule::in(array_keys(config('stockzones.markets')))],
        ]);

        $exchange = config('stockzones.exchanges.'.config("stockzones.markets.{$validated['market']}.exchange"));

        $results = collect($yahoo->search($validated['q']))
            ->filter(fn (array $quote) => in_array($quote['exchange'], $exchange['yahoo_codes'], true))
            ->filter(fn (array $quote) => in_array($quote['type'], ['EQUITY', 'ETF', 'INDEX'], true))
            ->values();

        return response()->json(['exchange' => $exchange['name'], 'results' => $results]);
    }
}
