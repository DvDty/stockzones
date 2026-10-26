import { interpolateRgb, scaleLinear } from 'd3';
import { useMemo, useState } from 'react';
import { useElementWidth } from '@/hooks/use-element-width';
import { clock, dayLabel, hourTicks, pct, zoneName } from '@/lib/time';
import { cn } from '@/lib/utils';
import type { Timeline, Zone } from '@/types/timeline';

const LABEL_W = 180;
const CELL_H = 26;
const BUCKET_HOURS = { '24h': 1, '3d': 3, '1w': 6 } as const;

interface Cell {
    start: number;
    value: number | null;
}

/**
 * Markets × time buckets, each cell coloured by how much the market moved
 * during that bucket. Blank cells are hours it wasn't trading.
 */
export function Heatmap({
    data,
    zone,
    now,
}: {
    data: Timeline;
    zone: Zone;
    now: number;
}) {
    const [ref, width] = useElementWidth<HTMLDivElement>();
    const [hover, setHover] = useState<{ row: string; cell: Cell } | null>(
        null,
    );
    const tz = zoneName(zone);
    const step = BUCKET_HOURS[data.range] * 3600;

    const grid = useMemo(() => {
        // Blocks start on round hours in the display zone, so days line up.
        const starts = hourTicks(
            data.from - step,
            Math.min(now, data.to),
            BUCKET_HOURS[data.range],
            tz,
        )
            .map((tick) => tick.t)
            .filter((t) => t + step > data.from && t < now);

        return data.rows.map((row) => {
            const pts = row.points;

            const cells = starts.map((start): Cell => {
                const end = start + step;
                const inside = pts.filter((p) => p[0] >= start && p[0] < end);

                if (inside.length === 0) {
                    return { start, value: null };
                }

                // From the last price before the bucket (or its first) to its last price.
                const before = [...pts].reverse().find((p) => p[0] < start);
                const open = (before ?? inside[0])[1];
                const close = inside[inside.length - 1][1];

                return { start, value: (close / open - 1) * 100 };
            });

            return { row, cells };
        });
    }, [data.rows, data.from, data.to, data.range, step, now, tz]);

    const values = grid
        .flatMap((g) => g.cells.map((c) => c.value))
        .filter((v): v is number => v !== null)
        .map(Math.abs)
        .sort((a, b) => a - b);
    const cap = Math.max(0.2, values[Math.floor(values.length * 0.95)] ?? 0.2);

    const color = (v: number) => {
        const k = Math.min(1, Math.abs(v) / cap);

        return v >= 0
            ? interpolateRgb('#1a2129', '#2fc27a')(k)
            : interpolateRgb('#1a2129', '#f0525c')(k);
    };

    const columns = grid[0]?.cells.length ?? 0;
    const cellW = Math.max(4, (width - LABEL_W) / Math.max(1, columns));
    const x = scaleLinear()
        .domain([0, columns])
        .range([0, cellW * columns]);

    return (
        <div className="rounded-xl border border-line bg-panel p-4">
            <div ref={ref}>
                <div
                    className="relative mb-1 h-5"
                    style={{ marginLeft: LABEL_W }}
                >
                    {grid[0]?.cells.map((c, i) => {
                        const label = clock(c.start, tz);
                        const midnight = label === '00:00';
                        const every = Math.ceil(44 / cellW);

                        return midnight || i % every === 0 ? (
                            <span
                                key={c.start}
                                className={cn(
                                    'absolute text-[10.5px] whitespace-nowrap',
                                    midnight
                                        ? 'font-medium text-fg'
                                        : 'num text-dim',
                                )}
                                style={{ left: x(i) }}
                            >
                                {midnight ? dayLabel(c.start, tz) : label}
                            </span>
                        ) : null;
                    })}
                </div>

                {grid.map(({ row, cells }) => (
                    <div
                        key={row.key}
                        className="flex items-center"
                        style={{ height: CELL_H }}
                    >
                        <div
                            className={cn(
                                'truncate pr-3 text-[12.5px]',
                                row.parent ? 'pl-4 text-muted' : 'text-fg',
                            )}
                            style={{ width: LABEL_W }}
                        >
                            {row.parent && '↳ '}
                            {row.name}
                        </div>
                        <div className="flex">
                            {cells.map((c) => (
                                <div
                                    key={c.start}
                                    onMouseEnter={() =>
                                        setHover({ row: row.name, cell: c })
                                    }
                                    onMouseLeave={() => setHover(null)}
                                    className="border-r border-b border-panel"
                                    style={{
                                        width: cellW,
                                        height: CELL_H,
                                        background:
                                            c.value === null
                                                ? 'rgba(255,255,255,0.015)'
                                                : color(c.value),
                                    }}
                                />
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            <div className="mt-3 flex min-h-5 flex-wrap items-center justify-between gap-3 text-[11.5px] text-dim">
                <span>
                    {hover ? (
                        <>
                            <span className="text-fg">{hover.row}</span>
                            {' · '}
                            {dayLabel(hover.cell.start, tz)}{' '}
                            {clock(hover.cell.start, tz)}–
                            {clock(hover.cell.start + step, tz)}
                            {' · '}
                            <span
                                className={
                                    hover.cell.value === null
                                        ? ''
                                        : hover.cell.value >= 0
                                          ? 'text-up'
                                          : 'text-down'
                                }
                            >
                                {hover.cell.value === null
                                    ? 'not trading'
                                    : pct(hover.cell.value)}
                            </span>
                        </>
                    ) : (
                        `Each cell is the move during a ${BUCKET_HOURS[data.range]}h block. Blank means closed.`
                    )}
                </span>
                <span className="flex items-center gap-1.5">
                    <span className="num font-mono">{pct(-cap, 1)}</span>
                    <span
                        className="h-2 w-28 rounded-full"
                        style={{
                            background: `linear-gradient(90deg, #f0525c, #1a2129, #2fc27a)`,
                        }}
                    />
                    <span className="num font-mono">{pct(cap, 1)}</span>
                </span>
            </div>
        </div>
    );
}
