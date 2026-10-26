import type { Baseline, Point, Row } from '@/types/timeline';

/** [unix seconds, % change, trading day index] */
export type PlotPoint = [number, number, number];

/**
 * % values to plot for a row: vs the previous close (resetting each trading
 * day), or vs the first price in the window (one continuous line).
 */
export function plotPoints(
    row: Row,
    baseline: Baseline,
    from: number,
): PlotPoint[] {
    const points = row.points;

    if (points.length === 0) {
        return [];
    }

    // Trading day index per point, so segments break at session resets.
    const dayOf = (t: number) => {
        for (let i = row.sessions.length - 1; i >= 0; i--) {
            if (row.sessions[i].start <= t + 60) {
                return row.sessions[i].day;
            }
        }

        return '';
    };

    const days: string[] = [];
    const result: PlotPoint[] = [];
    // Window mode: base on the price at the window's left edge (the carried-in point if any).
    const base = points[0][1];

    for (const [t, p, change] of points) {
        const value = baseline === 'window' ? (p / base - 1) * 100 : change;

        if (value === null) {
            continue;
        }

        const day = dayOf(t);

        if (days[days.length - 1] !== day) {
            days.push(day);
        }

        result.push([Math.max(t, from), value, days.length - 1]);
    }

    return result;
}

/** The latest point at or before t (markets hold their value while closed). */
export function valueAt<T extends [number, ...unknown[]]>(
    points: T[],
    t: number,
): T | null {
    let lo = 0;
    let hi = points.length - 1;
    let found: T | null = null;

    while (lo <= hi) {
        const mid = (lo + hi) >> 1;

        if (points[mid][0] <= t) {
            found = points[mid];
            lo = mid + 1;
        } else {
            hi = mid - 1;
        }
    }

    return found;
}

/** Whether the market was trading (inside a non-holiday session) at t. */
export function tradingAt(row: Row, t: number): boolean {
    return row.sessions.some((s) => !s.holiday && t >= s.start && t < s.end);
}

export function lastPrice(points: Point[]): number | null {
    return points.length ? points[points.length - 1][1] : null;
}
