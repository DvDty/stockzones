import type { Row, Status, Timeline } from '@/types/timeline';

/**
 * Open / break / closed and the next bell at `now`, from the row's schedule.
 * Mirrors MarketData::status() so a payload can be shown long after it was built.
 */
export function liveStatus(
    row: Row,
    now: number,
): Pick<Row, 'status' | 'next_open' | 'next_close'> {
    const open = row.schedule.filter((s) => !s.holiday);

    for (let i = 0; i < open.length; i++) {
        const session = open[i];

        if (now >= session.start && now < session.end) {
            return {
                status: 'open',
                next_open: open[i + 1]?.start ?? null,
                next_close: session.end,
            };
        }

        if (session.start > now) {
            const status: Status =
                open[i - 1]?.day === session.day ? 'break' : 'closed';

            return { status, next_open: session.start, next_close: null };
        }
    }

    return { status: 'closed', next_open: null, next_close: null };
}

/** The timeline with every row's status brought up to `now`; unchanged rows keep their identity. */
export function withLiveStatus(data: Timeline, now: number): Timeline {
    let changed = false;

    const rows = data.rows.map((row) => {
        const live = liveStatus(row, now);

        if (
            live.status === row.status &&
            live.next_open === row.next_open &&
            live.next_close === row.next_close
        ) {
            return row;
        }

        changed = true;

        return { ...row, ...live };
    });

    return changed ? { ...data, rows } : data;
}
