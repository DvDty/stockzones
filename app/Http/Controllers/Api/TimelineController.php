<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\MarketData;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class TimelineController extends Controller
{
    public function __invoke(Request $request, MarketData $data): JsonResponse
    {
        $validated = $request->validate([
            'range' => ['sometimes', Rule::in(array_keys(MarketData::RANGES))],
        ]);

        return response()->json($data->timeline($validated['range'] ?? '24h'));
    }
}
