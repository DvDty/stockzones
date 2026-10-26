import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import type { SearchResult } from '@/lib/api';
import type { Row } from '@/types/timeline';

export function AddStock({
    market,
    onClose,
    onAdded,
}: {
    market: Row;
    onClose: () => void;
    onAdded: () => void;
}) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<SearchResult[]>([]);
    const [exchange, setExchange] = useState('');
    const [state, setState] = useState<'idle' | 'searching' | 'error'>('idle');
    const box = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const onDown = (e: MouseEvent) => {
            if (box.current && !box.current.contains(e.target as Node)) {
                onClose();
            }
        };
        const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();

        document.addEventListener('mousedown', onDown);
        document.addEventListener('keydown', onKey);

        return () => {
            document.removeEventListener('mousedown', onDown);
            document.removeEventListener('keydown', onKey);
        };
    }, [onClose]);

    useEffect(() => {
        const q = query.trim();

        if (q.length < 2) {
            setResults([]);

            return;
        }

        let cancelled = false;
        const id = setTimeout(async () => {
            setState('searching');

            try {
                const response = await api.search(q, market.key);

                if (!cancelled) {
                    setResults(response.results);
                    setExchange(response.exchange);
                    setState('idle');
                }
            } catch {
                if (!cancelled) {
                    setState('error');
                }
            }
        }, 300);

        return () => {
            cancelled = true;
            clearTimeout(id);
        };
    }, [query, market.key]);

    const add = async (result: SearchResult) => {
        await api.addStock(market.key, result.symbol, result.name);
        onAdded();
    };

    return (
        <div
            ref={box}
            className="absolute top-full left-1 z-30 mt-1 w-80 rounded-lg border border-line-strong bg-raised p-2 shadow-2xl shadow-black/60"
        >
            <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={`Search ${market.name} stocks, e.g. Rheinmetall`}
                className="w-full rounded-md border border-line bg-panel px-2.5 py-1.5 text-[13px] text-fg outline-none placeholder:text-dim focus:border-muted"
            />
            <div className="mt-1 max-h-72 overflow-y-auto">
                {state === 'searching' && (
                    <p className="px-2 py-2 text-[12px] text-dim">Searching…</p>
                )}
                {state === 'error' && (
                    <p className="px-2 py-2 text-[12px] text-down">
                        Search failed. Try again.
                    </p>
                )}
                {state === 'idle' &&
                    query.trim().length >= 2 &&
                    results.length === 0 && (
                        <p className="px-2 py-2 text-[12px] text-dim">
                            No matches listed on {exchange || 'this exchange'}.
                        </p>
                    )}
                {results.map((r) => (
                    <button
                        key={r.symbol}
                        type="button"
                        onClick={() => add(r)}
                        className="flex w-full items-baseline justify-between gap-3 rounded-md px-2 py-1.5 text-left hover:bg-line"
                    >
                        <span className="truncate text-[13px] text-fg">
                            {r.name}
                        </span>
                        <span className="shrink-0 font-mono text-[11px] text-muted">
                            {r.symbol}
                        </span>
                    </button>
                ))}
            </div>
        </div>
    );
}
