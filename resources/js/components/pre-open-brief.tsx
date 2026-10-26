import { useMemo } from 'react';
import { clock, duration, pct, tone, zoneName } from '@/lib/time';
import { cn } from '@/lib/utils';
import type { Row, Timeline, Zone } from '@/types/timeline';

interface Bell {
    t: number;
    kind: 'open' | 'close';
    city: string;
}

/**
 * The "before New York" view: countdown to the US open, what the futures
 * are doing, and how each region's markets are moving.
 */
export function PreOpenBrief({
    data,
    now,
    zone,
}: {
    data: Timeline;
    now: number;
    zone: Zone;
}) {
    const markets = data.rows.filter((r) => r.parent === null);
    const sp = markets.find((r) => r.exchange === 'nyse');
    const futures = markets.find((r) => r.kind === 'future');
    const cities = new Map(data.exchanges.map((e) => [e.key, e.city]));

    const regions = useMemo(() => {
        const groups = new Map<string, Row[]>();

        for (const row of markets.filter((r) => r.kind === 'index')) {
            groups.set(row.region, [...(groups.get(row.region) ?? []), row]);
        }

        return [...groups.entries()];
    }, [markets]);

    const bells = useMemo(() => {
        const seen = new Set<string>();
        const events: Bell[] = [];

        for (const row of markets) {
            if (row.kind === 'future' || seen.has(row.exchange)) {
                continue;
            }

            seen.add(row.exchange);
            const city = cities.get(row.exchange) ?? row.exchange;

            for (const s of row.sessions.filter((s) => !s.holiday)) {
                // Lunch breaks aren't bells: only the day's first open and last close.
                const sameDay = row.sessions.filter((o) => o.day === s.day);

                if (s.start > now && s === sameDay[0]) {
                    events.push({ t: s.start, kind: 'open', city });
                }

                if (s.end > now && s === sameDay[sameDay.length - 1]) {
                    events.push({ t: s.end, kind: 'close', city });
                }
            }

            if (
                row.next_open &&
                !events.some((e) => e.t === row.next_open && e.city === city)
            ) {
                events.push({ t: row.next_open, kind: 'open', city });
            }
        }

        return events.sort((a, b) => a.t - b.t).slice(0, 6);
    }, [markets, cities, now]);

    const nyOpen = sp?.status === 'open';
    const nyNext = nyOpen ? sp?.next_close : sp?.next_open;

    return (
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,2.85fr)]">
            <div className="flex flex-col justify-between rounded-xl border border-line bg-panel p-4">
                <div>
                    <div className="text-[11px] font-medium tracking-[0.12em] text-dim uppercase">
                        New York
                    </div>
                    <div className="mt-1 flex items-baseline gap-2">
                        <span
                            className={cn(
                                'size-2 rounded-full',
                                nyOpen ? 'bg-up' : 'bg-bell',
                            )}
                        />
                        <span className="text-[15px] text-muted">
                            {nyOpen ? 'Open · closes in' : 'Opens in'}
                        </span>
                    </div>
                    <div className="num mt-0.5 font-mono text-[34px] leading-none font-medium tracking-tight">
                        {nyNext ? duration(nyNext - now) : '—'}
                    </div>
                    {nyNext && (
                        <div className="mt-1.5 text-[12px] text-dim">
                            {clock(nyNext, zoneName(zone))}{' '}
                            {zone === 'utc' ? 'UTC' : 'your time'}
                            {' · '}
                            {clock(nyNext, 'America/New_York')} New York
                        </div>
                    )}
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 border-t border-line pt-3">
                    <Stat
                        label="S&P futures"
                        value={futures?.last?.pct}
                        hint="vs prior settle"
                    />
                    <Stat
                        label="S&P 500"
                        value={sp?.last?.pct}
                        hint={nyOpen ? 'today' : 'last session'}
                    />
                </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
                {regions.map(([region, rows]) => (
                    <RegionCard key={region} region={region} rows={rows} />
                ))}
                <div className="rounded-xl border border-line bg-panel p-4 sm:col-span-3">
                    <div className="mb-2 text-[11px] font-medium tracking-[0.12em] text-dim uppercase">
                        Next bells
                    </div>
                    <div className="flex flex-wrap gap-x-5 gap-y-1.5">
                        {bells.map((b) => (
                            <div
                                key={`${b.city}${b.t}${b.kind}`}
                                className="flex items-baseline gap-1.5 text-[12.5px]"
                            >
                                <span
                                    className={
                                        b.kind === 'open'
                                            ? 'text-up'
                                            : 'text-muted'
                                    }
                                >
                                    {b.kind === 'open' ? '▲' : '▼'}
                                </span>
                                <span className="text-fg">{b.city}</span>
                                <span className="text-dim">
                                    {b.kind === 'open' ? 'opens' : 'closes'}
                                </span>
                                <span className="num font-mono text-muted">
                                    {duration(b.t - now)}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

function Stat({
    label,
    value,
    hint,
}: {
    label: string;
    value: number | null | undefined;
    hint: string;
}) {
    return (
        <div>
            <div className="text-[11px] text-dim">{label}</div>
            <div
                className={cn(
                    'num font-mono text-[18px] font-medium',
                    tone(value),
                )}
            >
                {pct(value)}
            </div>
            <div className="text-[10.5px] text-dim">{hint}</div>
        </div>
    );
}

function RegionCard({ region, rows }: { region: string; rows: Row[] }) {
    const values = rows
        .map((r) => r.last?.pct)
        .filter((v): v is number => v != null);
    const avg = values.length
        ? values.reduce((a, b) => a + b, 0) / values.length
        : null;
    const max = Math.max(1, ...values.map(Math.abs));
    const live = rows.filter((r) => r.status !== 'closed').length;

    return (
        <div className="rounded-xl border border-line bg-panel p-4">
            <div className="flex items-baseline justify-between">
                <div className="text-[11px] font-medium tracking-[0.12em] text-dim uppercase">
                    {region}
                </div>
                <div
                    className={cn(
                        'num font-mono text-[15px] font-medium',
                        tone(avg),
                    )}
                >
                    {pct(avg)}
                </div>
            </div>
            <div className="mt-0.5 text-[11px] text-dim">
                {live
                    ? `${live} of ${rows.length} trading`
                    : 'All closed · last session'}
            </div>
            <div className="mt-3 space-y-1.5">
                {rows.map((r) => {
                    const v = r.last?.pct ?? 0;
                    const w = (Math.abs(v) / max) * 50;

                    return (
                        <div
                            key={r.key}
                            className="grid grid-cols-[minmax(0,1fr)_64px_52px] items-center gap-2 text-[12px]"
                        >
                            <span className="flex min-w-0 items-center gap-1.5">
                                <span
                                    className={cn(
                                        'size-1.5 shrink-0 rounded-full',
                                        r.status === 'open'
                                            ? 'bg-up'
                                            : r.status === 'break'
                                              ? 'bg-bell'
                                              : 'bg-line-strong',
                                    )}
                                />
                                <span className="truncate text-fg/90">
                                    {r.name}
                                </span>
                            </span>
                            <span className="relative h-1.5 rounded-full bg-line/60">
                                <span className="absolute inset-y-0 left-1/2 w-px bg-line-strong" />
                                <span
                                    className={cn(
                                        'absolute inset-y-0 rounded-full',
                                        v >= 0
                                            ? 'left-1/2 bg-up'
                                            : 'right-1/2 bg-down',
                                    )}
                                    style={{ width: `${w}%` }}
                                />
                            </span>
                            <span
                                className={cn(
                                    'num text-right font-mono text-[11.5px]',
                                    tone(r.last?.pct),
                                )}
                            >
                                {pct(r.last?.pct)}
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
