import { curveStepAfter, line, scaleLinear } from 'd3';
import { useMemo, useState } from 'react';
import { useElementWidth } from '@/hooks/use-element-width';
import { plotPoints, tradingAt, valueAt } from '@/lib/series';
import type { PlotPoint } from '@/lib/series';
import { clock, dayLabel, hourTicks, pct, tone, zoneName } from '@/lib/time';
import { cn } from '@/lib/utils';
import type { Row, Timeline, Zone } from '@/types/timeline';

const H = 440;
const M = { top: 16, right: 16, bottom: 28, left: 52 };
const TICK_STEP = { '24h': 2, '3d': 6, '1w': 12 } as const;

// Colour follows region: warm for Asia-Pacific, blues for Europe, greens for the Americas.
const REGION_COLORS: Record<string, string[]> = {
    'Asia-Pacific': ['#f6b44b', '#f28c3a', '#e8664a', '#f7d37a', '#d9784f'],
    Europe: ['#6aa8ff', '#3f7fe8', '#9cc4ff', '#5b6cf0'],
    Americas: ['#3fd29a', '#1fae7a', '#8be8c2', '#5fd0c9'],
};

interface Line {
    row: Row;
    color: string;
    points: PlotPoint[];
}

/**
 * Every market on one chart as % change since the start of the window, so
 * they can be compared directly. Lines are faint while a market is closed.
 */
export function OverlayChart({
    data,
    zone,
    now,
}: {
    data: Timeline;
    zone: Zone;
    now: number;
}) {
    const [ref, width] = useElementWidth<HTMLDivElement>();
    const [hoverT, setHoverT] = useState<number | null>(null);
    const [focus, setFocus] = useState<string | null>(null);
    const [hidden, setHidden] = useState<Set<string>>(new Set());
    const tz = zoneName(zone);
    const innerW = Math.max(200, width - M.left - M.right);
    const innerH = H - M.top - M.bottom;

    const lines = useMemo(() => {
        const used: Record<string, number> = {};

        return data.rows
            .filter((r) => r.parent === null)
            .map((row): Line => {
                const palette = REGION_COLORS[row.region] ?? ['#c9d4e3'];
                const i = used[row.region] ?? 0;
                used[row.region] = i + 1;

                return {
                    row,
                    color: palette[i % palette.length],
                    points: plotPoints(row, 'window', data.from),
                };
            });
    }, [data.rows, data.from]);

    const visible = lines.filter((l) => !hidden.has(l.row.key));
    const extent =
        Math.max(
            0.5,
            ...visible.flatMap((l) => l.points.map((p) => Math.abs(p[1]))),
        ) * 1.1;

    const x = scaleLinear().domain([data.from, data.to]).range([0, innerW]);
    const y = scaleLinear().domain([-extent, extent]).range([innerH, 0]).nice();
    const ticks = hourTicks(data.from, data.to, TICK_STEP[data.range], tz);
    const gen = line<PlotPoint>()
        .x((p) => x(p[0]))
        .y((p) => y(p[1]));
    // While closed the value holds, then steps to the opening price.
    const held = line<PlotPoint>()
        .x((p) => x(p[0]))
        .y((p) => y(p[1]))
        .curve(curveStepAfter);

    // Split each line into trading and closed stretches.
    const stretches = (l: Line) => {
        const parts: { trading: boolean; pts: PlotPoint[] }[] = [];
        const pts = [...l.points];
        const end = pts[pts.length - 1];

        if (end && end[0] < now) {
            pts.push([now, end[1], end[2]]);
        }

        for (let i = 0; i < pts.length; i++) {
            const mid = i === 0 ? pts[0][0] : (pts[i - 1][0] + pts[i][0]) / 2;
            const trading = tradingAt(l.row, mid) && i > 0;
            const current = parts[parts.length - 1];

            if (current && current.trading === trading) {
                current.pts.push(pts[i]);
            } else {
                parts.push({
                    trading,
                    pts: current
                        ? [current.pts[current.pts.length - 1], pts[i]]
                        : [pts[i]],
                });
            }
        }

        return parts;
    };

    const readout =
        hoverT !== null
            ? visible
                  .map((l) => ({
                      l,
                      v: valueAt(l.points, hoverT)?.[1] ?? null,
                  }))
                  .filter((r) => r.v !== null)
                  .sort((a, b) => (b.v ?? 0) - (a.v ?? 0))
            : [];

    return (
        <div className="rounded-xl border border-line bg-panel p-4">
            <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1.5">
                {lines.map((l) => {
                    const off = hidden.has(l.row.key);
                    const last = l.points[l.points.length - 1]?.[1] ?? null;

                    return (
                        <button
                            key={l.row.key}
                            type="button"
                            onMouseEnter={() => setFocus(l.row.key)}
                            onMouseLeave={() => setFocus(null)}
                            onClick={() => {
                                const next = new Set(hidden);
                                if (off) {
                                    next.delete(l.row.key);
                                } else {
                                    next.add(l.row.key);
                                }

                                setHidden(next);
                            }}
                            className={cn(
                                'flex items-center gap-1.5 text-[12px]',
                                off && 'opacity-35',
                            )}
                        >
                            <span
                                className="h-0.5 w-3 rounded-full"
                                style={{ background: l.color }}
                            />
                            <span className="text-fg/90">{l.row.name}</span>
                            <span
                                className={cn(
                                    'num font-mono text-[11px]',
                                    tone(last),
                                )}
                            >
                                {pct(last)}
                            </span>
                        </button>
                    );
                })}
            </div>

            <div ref={ref} className="relative">
                <svg
                    width={width}
                    height={H}
                    className="block"
                    onPointerMove={(e) => {
                        const px =
                            e.clientX -
                            e.currentTarget.getBoundingClientRect().left -
                            M.left;
                        setHoverT(
                            px >= 0 && px <= innerW
                                ? Math.min(x.invert(px), now)
                                : null,
                        );
                    }}
                    onPointerLeave={() => setHoverT(null)}
                >
                    <g transform={`translate(${M.left},${M.top})`}>
                        {y.ticks(6).map((v) => (
                            <g key={v}>
                                <line
                                    x1={0}
                                    x2={innerW}
                                    y1={y(v)}
                                    y2={y(v)}
                                    stroke="#ffffff"
                                    strokeOpacity={v === 0 ? 0.18 : 0.05}
                                />
                                <text
                                    x={-8}
                                    y={y(v) + 4}
                                    textAnchor="end"
                                    className="num fill-dim font-mono text-[10.5px]"
                                >
                                    {pct(v, 1)}
                                </text>
                            </g>
                        ))}
                        {ticks.map(({ t, midnight }) => (
                            <g key={t}>
                                {midnight && (
                                    <line
                                        x1={x(t)}
                                        x2={x(t)}
                                        y1={0}
                                        y2={innerH}
                                        stroke="#ffffff"
                                        strokeOpacity={0.07}
                                    />
                                )}
                                <text
                                    x={x(t)}
                                    y={innerH + 18}
                                    textAnchor="middle"
                                    className={cn(
                                        'text-[10.5px]',
                                        midnight ? 'fill-fg' : 'num fill-dim',
                                    )}
                                >
                                    {midnight ? dayLabel(t, tz) : clock(t, tz)}
                                </text>
                            </g>
                        ))}

                        <rect
                            x={x(Math.min(now, data.to))}
                            y={0}
                            width={Math.max(
                                0,
                                innerW - x(Math.min(now, data.to)),
                            )}
                            height={innerH}
                            fill="#ffffff"
                            fillOpacity={0.015}
                        />
                        <line
                            x1={x(Math.min(now, data.to))}
                            x2={x(Math.min(now, data.to))}
                            y1={0}
                            y2={innerH}
                            className="stroke-now"
                            strokeOpacity={0.7}
                        />

                        {visible.map((l) => {
                            const dim = focus !== null && focus !== l.row.key;

                            return (
                                <g key={l.row.key} opacity={dim ? 0.12 : 1}>
                                    {stretches(l).map((s, i) => (
                                        <path
                                            key={i}
                                            d={
                                                (s.trading ? gen : held)(
                                                    s.pts,
                                                ) ?? ''
                                            }
                                            fill="none"
                                            stroke={l.color}
                                            strokeWidth={
                                                s.trading
                                                    ? focus === l.row.key
                                                        ? 2.4
                                                        : 1.6
                                                    : 1
                                            }
                                            strokeOpacity={s.trading ? 1 : 0.35}
                                            strokeDasharray={
                                                s.trading ? undefined : '2 3'
                                            }
                                            strokeLinejoin="round"
                                        />
                                    ))}
                                </g>
                            );
                        })}

                        {hoverT !== null && (
                            <g>
                                <line
                                    x1={x(hoverT)}
                                    x2={x(hoverT)}
                                    y1={0}
                                    y2={innerH}
                                    stroke="#ffffff"
                                    strokeOpacity={0.35}
                                />
                                {readout.map(({ l, v }) => (
                                    <circle
                                        key={l.row.key}
                                        cx={x(hoverT)}
                                        cy={y(v ?? 0)}
                                        r={2.5}
                                        fill={l.color}
                                    />
                                ))}
                            </g>
                        )}
                    </g>
                </svg>

                {hoverT !== null && (
                    <div
                        className="pointer-events-none absolute top-2 z-10 w-52 rounded-lg border border-line-strong bg-raised/95 p-2.5 text-[11.5px] shadow-xl shadow-black/50"
                        style={
                            x(hoverT) > innerW / 2
                                ? { left: M.left + x(hoverT) - 220 }
                                : { left: M.left + x(hoverT) + 12 }
                        }
                    >
                        <div className="num mb-1.5 font-mono text-muted">
                            {clock(hoverT, tz)} · {dayLabel(hoverT, tz)}
                        </div>
                        {readout.map(({ l, v }) => (
                            <div
                                key={l.row.key}
                                className="flex items-center justify-between gap-2 py-px"
                            >
                                <span className="flex min-w-0 items-center gap-1.5">
                                    <span
                                        className="h-0.5 w-2.5 shrink-0"
                                        style={{ background: l.color }}
                                    />
                                    <span
                                        className={cn(
                                            'truncate',
                                            tradingAt(l.row, hoverT)
                                                ? 'text-fg'
                                                : 'text-dim',
                                        )}
                                    >
                                        {l.row.name}
                                    </span>
                                </span>
                                <span className={cn('num font-mono', tone(v))}>
                                    {pct(v)}
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
            <p className="mt-2 text-[11.5px] text-dim">
                % change since the start of the window. Dashed stretches are
                hours the market was closed.
            </p>
        </div>
    );
}
