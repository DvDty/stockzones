<?php

use App\Services\MarketCalendar;
use Carbon\CarbonImmutable;

function utc(string $time): int
{
    return CarbonImmutable::parse($time, 'UTC')->getTimestamp();
}

it('converts New York hours to UTC across the daylight saving change', function () {
    $nyse = ['timezone' => 'America/New_York', 'sessions' => [['09:30', '16:00']]];
    $calendar = new MarketCalendar;

    // Still on EDT (UTC-4) until November 1, 2026.
    $before = $calendar->sessions($nyse, utc('2026-10-26 00:00'), utc('2026-10-27 00:00'));
    expect($before)->toContain(['start' => utc('2026-10-26 13:30'), 'end' => utc('2026-10-26 20:00'), 'day' => '2026-10-26']);

    // EST (UTC-5) afterwards.
    $after = $calendar->sessions($nyse, utc('2026-11-02 00:00'), utc('2026-11-03 00:00'));
    expect($after)->toContain(['start' => utc('2026-11-02 14:30'), 'end' => utc('2026-11-02 21:00'), 'day' => '2026-11-02']);
});

it('splits sessions around a lunch break into the same trading day', function () {
    $tokyo = ['timezone' => 'Asia/Tokyo', 'sessions' => [['09:00', '11:30'], ['12:30', '15:30']]];

    $sessions = (new MarketCalendar)->sessions($tokyo, utc('2026-10-26 00:00'), utc('2026-10-26 12:00'));

    expect($sessions)->toBe([
        ['start' => utc('2026-10-26 00:00'), 'end' => utc('2026-10-26 02:30'), 'day' => '2026-10-26'],
        ['start' => utc('2026-10-26 03:30'), 'end' => utc('2026-10-26 06:30'), 'day' => '2026-10-26'],
    ]);
});

it('runs overnight futures sessions past midnight and skips the weekend', function () {
    $cme = ['timezone' => 'America/New_York', 'days' => [7, 1, 2, 3, 4], 'sessions' => [['18:00', '17:00']]];

    $sessions = (new MarketCalendar)->sessions($cme, utc('2026-10-23 12:00'), utc('2026-10-26 23:00'));

    expect($sessions)->toBe([
        // Thursday evening to Friday 17:00 ET.
        ['start' => utc('2026-10-22 22:00'), 'end' => utc('2026-10-23 21:00'), 'day' => '2026-10-23'],
        // Nothing on Saturday; reopens Sunday 18:00 ET.
        ['start' => utc('2026-10-25 22:00'), 'end' => utc('2026-10-26 21:00'), 'day' => '2026-10-26'],
        ['start' => utc('2026-10-26 22:00'), 'end' => utc('2026-10-27 21:00'), 'day' => '2026-10-27'],
    ]);
});
