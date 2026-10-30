export type Range = '24h' | '3d' | '1w';
export type Baseline = 'close' | 'window';
export type View = 'lanes' | 'overlay' | 'heatmap';
export type Zone = 'local' | 'utc';
export type Status = 'open' | 'break' | 'closed';

/** [unix seconds, price, % vs previous close] */
export type Point = [number, number, number | null];

export interface Session {
    start: number;
    end: number;
    day: string;
    holiday: boolean;
}

export interface Exchange {
    key: string;
    name: string;
    city: string;
    timezone: string;
}

export interface Row {
    key: string;
    name: string;
    symbol: string;
    kind: 'index' | 'future' | 'stock';
    region: string;
    exchange: string;
    parent: string | null;
    watchlist_id: number | null;
    sessions: Session[];
    /** Sessions from a day before the data was built to a few days after. */
    schedule: Session[];
    points: Point[];
    last: { t: number; price: number; pct: number | null } | null;
    previous_close: number | null;
    status: Status;
    next_open: number | null;
    next_close: number | null;
}

export interface Timeline {
    range: Range;
    now: number;
    from: number;
    to: number;
    synced_at: number | null;
    exchanges: Exchange[];
    rows: Row[];
}
