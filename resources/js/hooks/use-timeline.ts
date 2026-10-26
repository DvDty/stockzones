import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { Range, Timeline } from '@/types/timeline';

const REFRESH_MS = 2 * 60 * 1000;

export function useTimeline(range: Range) {
    const [data, setData] = useState<Timeline | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        setLoading(true);

        try {
            setData(await api.timeline(range));
            setError(null);
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
        } finally {
            setLoading(false);
        }
    }, [range]);

    useEffect(() => {
        void load();
        const id = setInterval(() => void load(), REFRESH_MS);

        return () => clearInterval(id);
    }, [load]);

    return { data, error, loading, reload: load };
}

/** Current unix time in seconds, ticking for live clocks and countdowns. */
export function useNow(intervalMs = 15000): number {
    const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));

    useEffect(() => {
        const id = setInterval(
            () => setNow(Math.floor(Date.now() / 1000)),
            intervalMs,
        );

        return () => clearInterval(id);
    }, [intervalMs]);

    return now;
}

/** A setting remembered in localStorage (falls back silently if unavailable). */
export function useStored<T extends string>(
    key: string,
    initial: T,
    allowed: readonly T[],
): [T, (value: T) => void] {
    const [value, setValue] = useState<T>(() => {
        try {
            const stored = localStorage.getItem(
                `stockzones:${key}`,
            ) as T | null;

            return stored && allowed.includes(stored) ? stored : initial;
        } catch {
            return initial;
        }
    });

    const set = useCallback(
        (next: T) => {
            setValue(next);

            try {
                localStorage.setItem(`stockzones:${key}`, next);
            } catch {
                // Storage unavailable; keep the in-memory value.
            }
        },
        [key],
    );

    return [value, set];
}
