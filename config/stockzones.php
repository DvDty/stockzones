<?php

/*
|--------------------------------------------------------------------------
| Exchanges
|--------------------------------------------------------------------------
|
| Trading hours are written in each exchange's own local time and converted
| at runtime, so daylight saving changes are handled by the timezone database.
| A session whose close is earlier than its open runs past midnight. "days"
| are ISO weekdays (1 = Monday) on which a session opens. "yahoo_codes" are
| the exchange codes Yahoo's search returns for stocks listed there.
|
*/

return [

    'exchanges' => [
        'asx' => [
            'name' => 'ASX',
            'city' => 'Sydney',
            'timezone' => 'Australia/Sydney',
            'sessions' => [['10:00', '16:00']],
            'yahoo_codes' => ['ASX'],
        ],
        'tse' => [
            'name' => 'Tokyo Stock Exchange',
            'city' => 'Tokyo',
            'timezone' => 'Asia/Tokyo',
            'sessions' => [['09:00', '11:30'], ['12:30', '15:30']],
            'yahoo_codes' => ['JPX', 'OSA'],
        ],
        'krx' => [
            'name' => 'Korea Exchange',
            'city' => 'Seoul',
            'timezone' => 'Asia/Seoul',
            'sessions' => [['09:00', '15:30']],
            'yahoo_codes' => ['KSC', 'KOE'],
        ],
        'sse' => [
            'name' => 'Shanghai Stock Exchange',
            'city' => 'Shanghai',
            'timezone' => 'Asia/Shanghai',
            'sessions' => [['09:30', '11:30'], ['13:00', '15:00']],
            'yahoo_codes' => ['SHH', 'SHZ'],
        ],
        'hkex' => [
            'name' => 'Hong Kong Exchange',
            'city' => 'Hong Kong',
            'timezone' => 'Asia/Hong_Kong',
            'sessions' => [['09:30', '12:00'], ['13:00', '16:00']],
            'yahoo_codes' => ['HKG'],
        ],
        'xetra' => [
            'name' => 'Xetra',
            'city' => 'Frankfurt',
            'timezone' => 'Europe/Berlin',
            'sessions' => [['09:00', '17:30']],
            'yahoo_codes' => ['GER'],
        ],
        'euronext' => [
            'name' => 'Euronext',
            'city' => 'Paris',
            'timezone' => 'Europe/Paris',
            'sessions' => [['09:00', '17:30']],
            'yahoo_codes' => ['PAR', 'AMS', 'BRU', 'LIS', 'MIL'],
        ],
        'lse' => [
            'name' => 'London Stock Exchange',
            'city' => 'London',
            'timezone' => 'Europe/London',
            'sessions' => [['08:00', '16:30']],
            'yahoo_codes' => ['LSE', 'IOB'],
        ],
        'cme' => [
            'name' => 'CME Globex',
            'city' => 'Chicago',
            'timezone' => 'America/New_York',
            'days' => [7, 1, 2, 3, 4],
            'sessions' => [['18:00', '17:00']],
            'yahoo_codes' => ['CME', 'CBT'],
        ],
        'nyse' => [
            'name' => 'NYSE / Nasdaq',
            'city' => 'New York',
            'timezone' => 'America/New_York',
            'sessions' => [['09:30', '16:00']],
            'yahoo_codes' => ['NYQ', 'NMS', 'NGM', 'NCM', 'ASE', 'PCX', 'BTS'],
        ],
    ],

    /*
    |--------------------------------------------------------------------------
    | Markets
    |--------------------------------------------------------------------------
    |
    | The rows on the timeline, in "follow the sun" order. Each is an index
    | (or futures contract) on an exchange above. Individual stocks are added
    | from the UI and attach to one of these rows.
    |
    */

    'markets' => [
        'asx200' => ['name' => 'ASX 200', 'symbol' => '^AXJO', 'exchange' => 'asx', 'region' => 'Asia-Pacific'],
        'nikkei' => ['name' => 'Nikkei 225', 'symbol' => '^N225', 'exchange' => 'tse', 'region' => 'Asia-Pacific'],
        'kospi' => ['name' => 'KOSPI', 'symbol' => '^KS11', 'exchange' => 'krx', 'region' => 'Asia-Pacific'],
        'shanghai' => ['name' => 'SSE Composite', 'symbol' => '000001.SS', 'exchange' => 'sse', 'region' => 'Asia-Pacific'],
        'hangseng' => ['name' => 'Hang Seng', 'symbol' => '^HSI', 'exchange' => 'hkex', 'region' => 'Asia-Pacific'],
        'dax' => ['name' => 'DAX', 'symbol' => '^GDAXI', 'exchange' => 'xetra', 'region' => 'Europe'],
        'cac40' => ['name' => 'CAC 40', 'symbol' => '^FCHI', 'exchange' => 'euronext', 'region' => 'Europe'],
        'stoxx50' => ['name' => 'Euro Stoxx 50', 'symbol' => '^STOXX50E', 'exchange' => 'xetra', 'region' => 'Europe'],
        'ftse' => ['name' => 'FTSE 100', 'symbol' => '^FTSE', 'exchange' => 'lse', 'region' => 'Europe'],
        'es' => ['name' => 'S&P 500 futures', 'symbol' => 'ES=F', 'exchange' => 'cme', 'region' => 'Americas', 'kind' => 'future'],
        'sp500' => ['name' => 'S&P 500', 'symbol' => '^GSPC', 'exchange' => 'nyse', 'region' => 'Americas'],
        'nasdaq' => ['name' => 'Nasdaq Composite', 'symbol' => '^IXIC', 'exchange' => 'nyse', 'region' => 'Americas'],
    ],

    // Minutes before price data for a symbol is fetched again.
    'refresh_minutes' => (int) env('STOCKZONES_REFRESH_MINUTES', 5),

];
