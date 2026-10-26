<?php

namespace App\Services;

use Carbon\CarbonImmutable;

/**
 * Turns an exchange's local trading hours into concrete UTC sessions.
 */
class MarketCalendar
{
    /**
     * Sessions that overlap the given window, oldest first.
     *
     * Each session belongs to a trading day (the local date it closes on), so
     * sessions split by a lunch break share the same "day".
     *
     * @param  array{timezone: string, sessions: array<int, array{0: string, 1: string}>, days?: array<int, int>}  $exchange
     * @return array<int, array{start: int, end: int, day: string}>
     */
    public function sessions(array $exchange, int $from, int $to): array
    {
        $tz = $exchange['timezone'];
        $days = $exchange['days'] ?? [1, 2, 3, 4, 5];

        // Pad by two days so sessions that start before the window (or run
        // past midnight) are still found.
        $date = CarbonImmutable::createFromTimestamp($from, $tz)->subDays(2)->startOfDay();
        $last = CarbonImmutable::createFromTimestamp($to, $tz)->addDay()->startOfDay();

        $sessions = [];

        for (; $date <= $last; $date = $date->addDay()) {
            if (! in_array($date->dayOfWeekIso, $days, true)) {
                continue;
            }

            foreach ($exchange['sessions'] as [$open, $close]) {
                $start = $this->at($date, $open);
                $end = $this->at($date, $close);

                if ($end <= $start) {
                    $end = $this->at($date->addDay(), $close);
                }

                if ($end->getTimestamp() > $from && $start->getTimestamp() < $to) {
                    $sessions[] = [
                        'start' => $start->getTimestamp(),
                        'end' => $end->getTimestamp(),
                        'day' => $end->toDateString(),
                    ];
                }
            }
        }

        return $sessions;
    }

    private function at(CarbonImmutable $date, string $time): CarbonImmutable
    {
        [$hour, $minute] = array_map('intval', explode(':', $time));

        return $date->setTime($hour, $minute);
    }
}
