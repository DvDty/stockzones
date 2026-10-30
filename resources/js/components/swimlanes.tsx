import { area, line, scaleLinear } from 'd3';
import type { ScaleLinear } from 'd3';
import { useId, useMemo, useRef, useState } from 'react';
import { AddStock } from '@/components/add-stock';
import { useElementWidth } from '@/hooks/use-element-width';
import { api, isStatic } from '@/lib/api';
import { plotPoints, tradingAt, valueAt } from '@/lib/series';
import type { PlotPoint } from '@/lib/series';
import {
    clock,
    dayLabel,
    duration,
    hourTicks,
    pct,
    price,
    tone,
    zoneName,
} from '@/lib/time';
import { cn } from '@/lib/utils';
import type { Baseline, Exchange, Row, Timeline, Zone } from '@/types/timeline';

const LABEL_W = 284;
const RIGHT_PAD = 16;
const HEADER_H = 40;
const REGION_H = 28;
const ROW_H = { market: 60, stock: 44 };
const TICK_STEP = { '24h': 2, '3d': 6, '1w': 12 } as const;

export type ScaleMode = 'shared' | 'row';

interface Props {
    data: Timeline;
    baseline: Baseline;
    zone: Zone;
    scaleMode: ScaleMode;
    now: number;
    onChange: () => void;
}

export function Swimlanes({
    data,
    baseline,
    zone,
    scaleMode,
    now,
    onChange,
}: Props) {
    const [ref, width] = useElementWidth<HTMLDivElement>();
    const [hoverT, setHoverT] = useState<number | null>(null);
    const plotW = Math.max(200, width - LABEL_W - RIGHT_PAD);
    const tz = zoneName(zone);

    const x = useMemo(
        () => scaleLinear().domain([data.from, data.to]).range([0, plotW]),
        [data.from, data.to, plotW],
    );

    const series = useMemo(
        () =>
            new Map(
                data.rows.map((row) => [
                    row.key,
                    plotPoints(row, baseline, data.from),
                ]),
            ),
        [data.rows, data.from, baseline],
    );

    // Markets share one % scale so their moves are comparable; stocks get their own.
    const sharedDomain = useMemo(() => {
        let max = 0;

        for (const row of data.rows) {
            if (row.kind !== 'stock') {
                for (const p of series.get(row.key) ?? []) {
                    max = Math.max(max, Math.abs(p[1]));
                }
            }
        }

        return Math.max(0.5, max * 1.1);
    }, [data.rows, series]);

    const ticks = useMemo(
        () => hourTicks(data.from, data.to, TICK_STEP[data.range], tz),
        [data.from, data.to, data.range, tz],
    );

    const nyse = data.rows.find((r) => r.exchange === 'nyse');
    const exchanges = new Map(data.exchanges.map((e) => [e.key, e]));

    const regions = useMemo(() => {
        const groups = new Map<string, Row[]>();

        for (const row of data.rows) {
            groups.set(row.region, [...(groups.get(row.region) ?? []), row]);
        }

        return [...groups.entries()];
    }, [data.rows]);

    const nowX = x(Math.min(now, data.to));

    const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const px = e.clientX - rect.left - LABEL_W;

        setHoverT(px >= 0 && px <= plotW ? Math.min(x.invert(px), now) : null);
    };

    return (
        <div
            ref={ref}
            className="relative select-none"
            onPointerMove={onPointerMove}
            onPointerLeave={() => setHoverT(null)}
        >
            <Axis
                ticks={ticks}
                x={x}
                tz={tz}
                nowX={nowX}
                hoverT={hoverT}
                nyse={nyse}
                from={data.from}
                to={data.to}
            />

            {regions.map(([region, rows]) => (
                <section key={region}>
                    <div
                        className="flex items-end border-b border-line pb-1.5 pl-1 text-[11px] font-medium tracking-[0.12em] text-dim uppercase"
                        style={{ height: REGION_H }}
                    >
                        {region}
                    </div>
                    {rows.map((row) => (
                        <Lane
                            key={row.key}
                            row={row}
                            exchange={exchanges.get(row.exchange)}
                            points={series.get(row.key) ?? []}
                            x={x}
                            plotW={plotW}
                            domain={
                                row.kind === 'stock' || scaleMode === 'row'
                                    ? undefined
                                    : sharedDomain
                            }
                            ticks={ticks}
                            now={now}
                            hoverT={hoverT}
                            onChange={onChange}
                        />
                    ))}
                </section>
            ))}

            {/* Overlay: future shading, NY bells, now line, crosshair. */}
            <div
                className="pointer-events-none absolute bottom-0"
                style={{ left: LABEL_W, top: HEADER_H, width: plotW }}
            >
                <div
                    className="absolute inset-y-0 right-0 bg-[repeating-linear-gradient(135deg,transparent_0_6px,rgba(255,255,255,0.025)_6px_7px)]"
                    style={{ left: nowX }}
                />
                {nyse?.sessions
                    .filter((s) => !s.holiday)
                    .map((s) => (
                        <div key={s.start}>
                            {s.start >= data.from && (
                                <div
                                    className="absolute inset-y-0 border-l border-dashed border-bell/70"
                                    style={{ left: x(s.start) }}
                                />
                            )}
                            {s.end <= data.to && (
                                <div
                                    className="absolute inset-y-0 border-l border-dotted border-bell/35"
                                    style={{ left: x(s.end) }}
                                />
                            )}
                        </div>
                    ))}
                {now <= data.to && (
                    <div
                        className="absolute inset-y-0 w-px bg-now/80"
                        style={{ left: nowX }}
                    />
                )}
                {hoverT !== null && (
                    <div
                        className="absolute inset-y-0 w-px bg-fg/40"
                        style={{ left: x(hoverT) }}
                    />
                )}
            </div>
        </div>
    );
}

function Axis({
    ticks,
    x,
    tz,
    nowX,
    hoverT,
    nyse,
    from,
    to,
}: {
    ticks: { t: number; midnight: boolean }[];
    x: ScaleLinear<number, number>;
    tz: string;
    nowX: number;
    hoverT: number | null;
    nyse: Row | undefined;
    from: number;
    to: number;
}) {
    return (
        <div
            className="sticky top-0 z-20 border-b border-line bg-canvas/95 backdrop-blur"
            style={{ height: HEADER_H, paddingLeft: LABEL_W }}
        >
            <div className="relative h-full">
                {ticks
                    // Day labels are wider than hour labels; drop hours that would collide.
                    .filter(
                        (tick) =>
                            tick.midnight ||
                            !ticks.some(
                                (o) =>
                                    o.midnight &&
                                    Math.abs(x(o.t) - x(tick.t)) < 64,
                            ),
                    )
                    .map(({ t, midnight }) => (
                        <div
                            key={t}
                            className="absolute bottom-1.5 -translate-x-1/2 text-[11px] whitespace-nowrap"
                            style={{ left: x(t) }}
                        >
                            {midnight ? (
                                <span className="font-medium text-fg">
                                    {dayLabel(t, tz)}
                                </span>
                            ) : (
                                <span className="num text-dim">
                                    {clock(t, tz)}
                                </span>
                            )}
                        </div>
                    ))}
                {nyse?.sessions
                    .filter(
                        (s) => !s.holiday && s.start >= from && s.start <= to,
                    )
                    .map((s) => (
                        <div
                            key={s.start}
                            className="absolute top-1 ml-1 rounded-sm bg-bell/15 px-1.5 text-[10px] leading-4 font-medium whitespace-nowrap text-bell"
                            style={{ left: x(s.start) }}
                        >
                            NY open
                        </div>
                    ))}
                <div
                    className="absolute top-1 -ml-1 -translate-x-full rounded-sm bg-now/15 px-1.5 text-[10px] leading-4 font-medium text-now"
                    style={{ left: nowX }}
                >
                    now
                </div>
                {hoverT !== null && (
                    <div
                        className="num absolute top-1 z-10 -translate-x-1/2 rounded-sm bg-fg px-1.5 text-[11px] leading-4 font-medium whitespace-nowrap text-canvas"
                        style={{ left: x(hoverT) }}
                    >
                        {clock(hoverT, tz)} · {dayLabel(hoverT, tz)}
                    </div>
                )}
            </div>
        </div>
    );
}

function Lane({
    row,
    exchange,
    points,
    x,
    plotW,
    domain,
    ticks,
    now,
    hoverT,
    onChange,
}: {
    row: Row;
    exchange: Exchange | undefined;
    points: PlotPoint[];
    x: ScaleLinear<number, number>;
    plotW: number;
    domain: number | undefined;
    ticks: { t: number; midnight: boolean }[];
    now: number;
    hoverT: number | null;
    onChange: () => void;
}) {
    const uid = useId().replace(/:/g, '');
    const isStock = row.kind === 'stock';
    const h = isStock ? ROW_H.stock : ROW_H.market;

    const d = useMemo(() => {
        const own = Math.max(...points.map((p) => Math.abs(p[1])), 0);

        return domain ?? Math.max(isStock ? 1 : 0.5, own * 1.15);
    }, [domain, points, isStock]);

    const y = scaleLinear()
        .domain([-d, d])
        .range([h - 5, 5])
        .clamp(true);
    const y0 = y(0);

    const { solid, carries } = useMemo(() => {
        const segments: PlotPoint[][] = [];

        for (const p of points) {
            const current = segments[segments.length - 1];

            if (current && current[0][2] === p[2]) {
                current.push(p);
            } else {
                segments.push([p]);
            }
        }

        // Dashed "held value" lines while the market is closed.
        const holds: { x1: number; x2: number; v: number }[] = [];

        segments.forEach((seg, i) => {
            const last = seg[seg.length - 1];
            const next = segments[i + 1];
            const end = next ? next[0][0] : tradingAt(row, now) ? last[0] : now;

            if (end > last[0]) {
                holds.push({ x1: last[0], x2: end, v: last[1] });
            }
        });

        return { solid: segments, carries: holds };
    }, [points, row, now]);

    const lineGen = line<PlotPoint>()
        .x((p) => x(p[0]))
        .y((p) => y(p[1]));
    const areaGen = area<PlotPoint>()
        .x((p) => x(p[0]))
        .y0(y0)
        .y1((p) => y(p[1]));

    const hovered = hoverT !== null ? valueAt(points, hoverT) : null;
    const last = points[points.length - 1];
    const liveNow = row.status === 'open' && last;

    const paths = (
        <>
            {solid.map((seg) => (
                <g key={seg[0][0]}>
                    <path
                        d={areaGen(seg) ?? ''}
                        fill="currentColor"
                        opacity={0.12}
                    />
                    <path
                        d={lineGen(seg) ?? ''}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={isStock ? 1.25 : 1.6}
                        strokeLinejoin="round"
                        strokeLinecap="round"
                    />
                </g>
            ))}
            {carries.map((c) => (
                <line
                    key={c.x1}
                    x1={x(c.x1)}
                    x2={x(c.x2)}
                    y1={y(c.v)}
                    y2={y(c.v)}
                    stroke="currentColor"
                    strokeOpacity={0.45}
                    strokeDasharray="2 4"
                />
            ))}
        </>
    );

    return (
        <div
            className={cn(
                'group relative flex border-b border-line/70',
                isStock && 'bg-panel/40',
            )}
            style={{ height: h }}
        >
            <LaneLabel
                row={row}
                exchange={exchange}
                now={now}
                hoverT={hoverT}
                hovered={hovered}
                latest={last?.[1] ?? null}
                onChange={onChange}
            />
            <svg
                width={plotW}
                height={h}
                className="block shrink-0 overflow-visible"
            >
                <defs>
                    <clipPath id={`${uid}-up`}>
                        <rect x={0} y={-10} width={plotW} height={y0 + 10} />
                    </clipPath>
                    <clipPath id={`${uid}-down`}>
                        <rect x={0} y={y0} width={plotW} height={h - y0 + 10} />
                    </clipPath>
                    <pattern
                        id={`${uid}-hatch`}
                        width={6}
                        height={6}
                        patternUnits="userSpaceOnUse"
                        patternTransform="rotate(45)"
                    >
                        <line
                            x1={0}
                            y1={0}
                            x2={0}
                            y2={6}
                            stroke="#ffffff"
                            strokeOpacity={0.06}
                            strokeWidth={2}
                        />
                    </pattern>
                    <clipPath id={`${uid}-plot`}>
                        <rect x={0} y={-10} width={plotW} height={h + 20} />
                    </clipPath>
                </defs>

                {ticks.map(({ t, midnight }) => (
                    <line
                        key={t}
                        x1={x(t)}
                        x2={x(t)}
                        y1={0}
                        y2={h}
                        stroke="#ffffff"
                        strokeOpacity={midnight ? 0.08 : 0.03}
                    />
                ))}

                <g clipPath={`url(#${uid}-plot)`}>
                    {row.sessions.map((s) => (
                        <g key={s.start}>
                            <rect
                                x={x(s.start)}
                                y={3}
                                width={Math.max(1, x(s.end) - x(s.start))}
                                height={h - 6}
                                rx={3}
                                fill={
                                    s.holiday ? `url(#${uid}-hatch)` : '#ffffff'
                                }
                                fillOpacity={s.holiday ? 1 : 0.035}
                                stroke="#ffffff"
                                strokeOpacity={0.05}
                            />
                            {s.holiday && x(s.end) - x(s.start) > 60 && (
                                <text
                                    x={(x(s.start) + x(s.end)) / 2}
                                    y={h / 2 + 4}
                                    textAnchor="middle"
                                    className="fill-dim text-[10px]"
                                >
                                    Holiday
                                </text>
                            )}
                        </g>
                    ))}

                    <line
                        x1={0}
                        x2={plotW}
                        y1={y0}
                        y2={y0}
                        stroke="#ffffff"
                        strokeOpacity={0.09}
                        strokeDasharray="1 3"
                    />

                    <g clipPath={`url(#${uid}-up)`} className="text-up">
                        {paths}
                    </g>
                    <g clipPath={`url(#${uid}-down)`} className="text-down">
                        {paths}
                    </g>

                    {liveNow && (
                        <g className={last[1] >= 0 ? 'text-up' : 'text-down'}>
                            <circle
                                cx={x(last[0])}
                                cy={y(last[1])}
                                r={3}
                                fill="currentColor"
                                className="pulse-ring"
                            />
                            <circle
                                cx={x(last[0])}
                                cy={y(last[1])}
                                r={2.5}
                                fill="currentColor"
                            />
                        </g>
                    )}

                    {hovered && hoverT !== null && (
                        <circle
                            cx={x(hoverT)}
                            cy={y(hovered[1])}
                            r={3}
                            className={
                                hovered[1] >= 0 ? 'fill-up' : 'fill-down'
                            }
                            stroke="#090b0f"
                            strokeWidth={1.5}
                        />
                    )}
                </g>
            </svg>
        </div>
    );
}

function LaneLabel({
    row,
    exchange,
    now,
    hoverT,
    hovered,
    latest,
    onChange,
}: {
    row: Row;
    exchange: Exchange | undefined;
    now: number;
    hoverT: number | null;
    hovered: PlotPoint | null;
    latest: number | null;
    onChange: () => void;
}) {
    const [adding, setAdding] = useState(false);
    const [removing, setRemoving] = useState(false);
    const anchor = useRef<HTMLDivElement>(null);
    const isStock = row.kind === 'stock';

    // While hovering, the value at that moment; otherwise the latest.
    const shownPct = hoverT !== null ? (hovered?.[1] ?? null) : latest;

    const remove = async () => {
        if (row.watchlist_id === null) {
            return;
        }

        setRemoving(true);

        try {
            await api.removeStock(row.watchlist_id);
            onChange();
        } finally {
            setRemoving(false);
        }
    };

    return (
        <div
            ref={anchor}
            className={cn(
                'relative flex shrink-0 items-center justify-between gap-2 pr-4',
                isStock ? 'pl-5' : 'pl-1',
            )}
            style={{ width: LABEL_W }}
        >
            <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                    {isStock && <span className="text-dim">↳</span>}
                    <span
                        className={cn(
                            'truncate font-medium',
                            isStock ? 'text-[13px] text-fg/90' : 'text-[14px]',
                        )}
                        title={`${row.name} (${row.symbol})`}
                    >
                        {row.name}
                    </span>
                    {row.kind === 'future' && (
                        <span className="rounded-sm bg-raised px-1 text-[9px] font-medium tracking-wide text-muted">
                            FUT
                        </span>
                    )}
                    {!isStatic && !isStock && row.kind !== 'future' && (
                        <button
                            type="button"
                            onClick={() => setAdding(true)}
                            className="ml-0.5 hidden size-4 items-center justify-center rounded-sm text-[13px] leading-none text-muted group-hover:flex hover:bg-raised hover:text-fg"
                            title="Add a stock from this exchange"
                        >
                            +
                        </button>
                    )}
                    {isStock && row.watchlist_id !== null && (
                        <button
                            type="button"
                            onClick={remove}
                            disabled={removing}
                            className="ml-0.5 hidden size-4 items-center justify-center rounded-sm text-[13px] leading-none text-muted group-hover:flex hover:bg-raised hover:text-down"
                            title="Remove"
                        >
                            ×
                        </button>
                    )}
                </div>
                {!isStock && (
                    <StatusLine
                        row={row}
                        exchange={exchange}
                        now={now}
                        hoverT={hoverT}
                    />
                )}
            </div>

            <div className="w-[76px] shrink-0 text-right">
                <div
                    className={cn(
                        'num font-mono text-[13px] font-medium',
                        tone(shownPct),
                    )}
                >
                    {pct(shownPct)}
                </div>
                {(!isStock || hoverT !== null) && (
                    <div className="num font-mono text-[10.5px] text-dim">
                        {hoverT !== null
                            ? tradingAt(row, hoverT)
                                ? 'trading'
                                : 'closed'
                            : price(row.last?.price)}
                    </div>
                )}
            </div>

            {adding && (
                <AddStock
                    market={row}
                    onClose={() => setAdding(false)}
                    onAdded={() => {
                        setAdding(false);
                        onChange();
                    }}
                />
            )}
        </div>
    );
}

function StatusLine({
    row,
    exchange,
    now,
    hoverT,
}: {
    row: Row;
    exchange: Exchange | undefined;
    now: number;
    hoverT: number | null;
}) {
    const t = hoverT ?? now;
    const local = exchange ? clock(t, exchange.timezone) : '';
    const todayHoliday = row.sessions.some(
        (s) => s.holiday && now >= s.start - 3 * 3600 && now < s.end,
    );

    let status: React.ReactNode;

    if (todayHoliday && row.status !== 'open') {
        status = <span className="text-dim">Holiday</span>;
    } else if (row.status === 'open') {
        status = (
            <span className="text-up">
                <span className="mr-1 inline-block size-1.5 rounded-full bg-up align-middle" />
                {row.next_close
                    ? `${duration(row.next_close - now)} left`
                    : 'Open'}
            </span>
        );
    } else if (row.status === 'break') {
        status = (
            <span className="text-bell">
                Lunch
                {row.next_open ? ` · ${duration(row.next_open - now)}` : ''}
            </span>
        );
    } else {
        status = (
            <span className="text-muted">
                {row.next_open
                    ? `Opens in ${duration(row.next_open - now)}`
                    : 'Closed'}
            </span>
        );
    }

    return (
        <div className="mt-0.5 flex items-center gap-1.5 text-[11px] whitespace-nowrap text-dim">
            <span className="shrink-0">{exchange?.city}</span>
            <span className="num shrink-0 font-mono text-muted">{local}</span>
            <span className="text-line-strong">·</span>
            <span className="truncate">{status}</span>
        </div>
    );
}
