import type { Range, Timeline } from '@/types/timeline';

async function request<T>(
    url: string,
    init?: { method: string; body?: string },
): Promise<T> {
    const response = await fetch(url, {
        ...init,
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
        },
    });

    if (!response.ok) {
        throw new Error(`${response.status} ${response.statusText}`);
    }

    return (response.status === 204 ? null : await response.json()) as T;
}

/** Built as a static site that reads pre-built JSON, with no Laravel backend. */
export const isStatic = import.meta.env.VITE_STATIC === 'true';

export interface SearchResult {
    symbol: string;
    name: string;
    exchange: string;
    type: string;
}

export const api = {
    timeline: (range: Range) =>
        isStatic
            ? request<Timeline>(
                  `${import.meta.env.BASE_URL}data/timeline-${range}.json`,
              )
            : request<Timeline>(`/api/timeline?range=${range}`),

    search: (q: string, market: string) =>
        request<{ exchange: string; results: SearchResult[] }>(
            `/api/symbols?${new URLSearchParams({ q, market })}`,
        ),

    addStock: (market_key: string, symbol: string, name: string) =>
        request('/api/watchlist', {
            method: 'POST',
            body: JSON.stringify({ market_key, symbol, name }),
        }),

    removeStock: (id: number) =>
        request(`/api/watchlist/${id}`, { method: 'DELETE' }),
};
