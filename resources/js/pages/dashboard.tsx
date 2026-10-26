import { Head } from '@inertiajs/react';
import { Heatmap } from '@/components/heatmap';
import { OverlayChart } from '@/components/overlay-chart';
import { PreOpenBrief } from '@/components/pre-open-brief';
import { Swimlanes } from '@/components/swimlanes';
import type { ScaleMode } from '@/components/swimlanes';
import { useNow, useStored, useTimeline } from '@/hooks/use-timeline';
import { duration, zoneName } from '@/lib/time';
import { cn } from '@/lib/utils';
import type { Baseline, Range, View, Zone } from '@/types/timeline';

export default function Dashboard() {
    const [view, setView] = useStored<View>('view', 'lanes', [
        'lanes',
        'overlay',
        'heatmap',
    ]);
    const [range, setRange] = useStored<Range>('range', '24h', [
        '24h',
        '3d',
        '1w',
    ]);
    const [baseline, setBaseline] = useStored<Baseline>('baseline', 'close', [
        'close',
        'window',
    ]);
    const [scaleMode, setScaleMode] = useStored<ScaleMode>('scale', 'shared', [
        'shared',
        'row',
    ]);
    const [zone, setZone] = useStored<Zone>('zone', 'local', ['local', 'utc']);
    const { data, error, loading, reload } = useTimeline(range);
    const now = useNow();

    return (
        <>
            <Head title="Markets around the clock" />
            <div className="mx-auto max-w-[1600px] px-4 pb-16 sm:px-6">
                <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 py-4">
                    <div className="flex items-baseline gap-3">
                        <h1 className="text-[19px] font-semibold tracking-tight">
                            stock<span className="text-bell">zones</span>
                        </h1>
                        <span className="hidden text-[12.5px] text-dim md:inline">
                            Follow the markets around the clock
                        </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <Segmented
                            value={view}
                            onChange={setView}
                            options={[
                                ['lanes', 'Timeline'],
                                ['overlay', 'Overlay'],
                                ['heatmap', 'Heatmap'],
                            ]}
                        />
                        <Segmented
                            value={range}
                            onChange={setRange}
                            options={[
                                ['24h', '24h'],
                                ['3d', '3 days'],
                                ['1w', 'Week'],
                            ]}
                        />
                        {view === 'lanes' && (
                            <>
                                <Segmented
                                    value={baseline}
                                    onChange={setBaseline}
                                    title="What each % is measured against"
                                    options={[
                                        ['close', 'vs prev close'],
                                        ['window', 'vs window start'],
                                    ]}
                                />
                                <Segmented
                                    value={scaleMode}
                                    onChange={setScaleMode}
                                    title="Shared scale makes rows comparable"
                                    options={[
                                        ['shared', 'Shared scale'],
                                        ['row', 'Per row'],
                                    ]}
                                />
                            </>
                        )}
                        <Segmented
                            value={zone}
                            onChange={setZone}
                            options={[
                                [
                                    'local',
                                    zoneName('local')
                                        .split('/')
                                        .pop()
                                        ?.replace('_', ' ') ?? 'Local',
                                ],
                                ['utc', 'UTC'],
                            ]}
                        />
                        <button
                            type="button"
                            onClick={() => void reload()}
                            className="flex h-8 items-center gap-1.5 rounded-lg border border-line px-2.5 text-[12px] text-muted hover:border-line-strong hover:text-fg"
                            title="Refresh now"
                        >
                            <span
                                className={cn(
                                    'inline-block',
                                    loading && 'animate-spin',
                                )}
                            >
                                ↻
                            </span>
                            {data?.synced_at
                                ? `${duration(now - data.synced_at)} ago`
                                : 'Refresh'}
                        </button>
                    </div>
                </header>

                {error && (
                    <div className="mb-4 rounded-lg border border-down/30 bg-down/10 px-3 py-2 text-[13px] text-down">
                        Couldn't load market data ({error}). Showing the last
                        data loaded.
                    </div>
                )}

                {!data ? (
                    <div className="grid h-[60vh] place-items-center text-[13px] text-dim">
                        Loading markets…
                    </div>
                ) : (
                    <div className="space-y-5">
                        <PreOpenBrief data={data} now={now} zone={zone} />

                        {view === 'lanes' && (
                            <div className="rounded-xl border border-line bg-panel/50 px-3 pb-2">
                                <Swimlanes
                                    data={data}
                                    baseline={baseline}
                                    zone={zone}
                                    scaleMode={scaleMode}
                                    now={now}
                                    onChange={() => void reload()}
                                />
                            </div>
                        )}
                        {view === 'overlay' && (
                            <OverlayChart data={data} zone={zone} now={now} />
                        )}
                        {view === 'heatmap' && (
                            <Heatmap data={data} zone={zone} now={now} />
                        )}

                        <p className="text-[11.5px] text-dim">
                            Index data from Yahoo Finance, 5–15 min bars, may be
                            delayed. Hover a market row and press + to add a
                            stock from that exchange.
                        </p>
                    </div>
                )}
            </div>
        </>
    );
}

function Segmented<T extends string>({
    value,
    onChange,
    options,
    title,
}: {
    value: T;
    onChange: (value: T) => void;
    options: [T, string][];
    title?: string;
}) {
    return (
        <div
            className="flex h-8 items-center rounded-lg border border-line bg-panel p-0.5"
            title={title}
        >
            {options.map(([key, label]) => (
                <button
                    key={key}
                    type="button"
                    onClick={() => onChange(key)}
                    className={cn(
                        'h-full rounded-md px-2.5 text-[12px] whitespace-nowrap transition-colors',
                        value === key
                            ? 'bg-raised text-fg shadow-sm shadow-black/40'
                            : 'text-muted hover:text-fg',
                    )}
                >
                    {label}
                </button>
            ))}
        </div>
    );
}
