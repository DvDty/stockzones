import type { Zone } from '@/types/timeline';

const localZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

export function zoneName(zone: Zone): string {
    return zone === 'utc' ? 'UTC' : localZone;
}

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(
    timeZone: string,
    options: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormat {
    const key = timeZone + JSON.stringify(options);
    let f = formatters.get(key);

    if (!f) {
        f = new Intl.DateTimeFormat('en-GB', { timeZone, ...options });
        formatters.set(key, f);
    }

    return f;
}

export function clock(t: number, timeZone: string): string {
    return formatter(timeZone, { hour: '2-digit', minute: '2-digit' }).format(
        t * 1000,
    );
}

export function dayLabel(t: number, timeZone: string): string {
    return formatter(timeZone, {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
    }).format(t * 1000);
}

/** Hour (0-23) and minute of a timestamp in a zone. */
function parts(t: number, timeZone: string): { hour: number; minute: number } {
    const p = formatter(timeZone, {
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
    }).formatToParts(t * 1000);

    return {
        hour: Number(p.find((x) => x.type === 'hour')?.value),
        minute: Number(p.find((x) => x.type === 'minute')?.value),
    };
}

/**
 * Axis ticks that fall on round hours in the chosen zone (so ticks line up
 * with local midnight even in zones with odd UTC offsets).
 */
export function hourTicks(
    from: number,
    to: number,
    stepHours: number,
    timeZone: string,
): { t: number; midnight: boolean }[] {
    const ticks: { t: number; midnight: boolean }[] = [];

    // Walk every 15 minutes so half-hour offsets are found too.
    for (let t = Math.ceil(from / 900) * 900; t <= to; t += 900) {
        const { hour, minute } = parts(t, timeZone);

        if (minute === 0 && hour % stepHours === 0) {
            ticks.push({ t, midnight: hour === 0 });
        }
    }

    return ticks;
}

export function duration(seconds: number): string {
    const s = Math.max(0, Math.round(seconds));
    const d = Math.floor(s / 86400);
    const h = Math.floor((s % 86400) / 3600);
    const m = Math.floor((s % 3600) / 60);

    if (d > 0) {
        return `${d}d ${h}h`;
    }

    if (h > 0) {
        return `${h}h ${String(m).padStart(2, '0')}m`;
    }

    return `${m}m`;
}

export function pct(value: number | null | undefined, digits = 2): string {
    if (value === null || value === undefined || Number.isNaN(value)) {
        return '—';
    }

    const sign = value > 0 ? '+' : value < 0 ? '−' : '';

    return `${sign}${Math.abs(value).toFixed(digits)}%`;
}

export function price(value: number | null | undefined): string {
    if (value === null || value === undefined) {
        return '—';
    }

    return value.toLocaleString('en-US', {
        minimumFractionDigits: value < 1000 ? 2 : 0,
        maximumFractionDigits: 2,
    });
}

export function tone(value: number | null | undefined): string {
    if (!value) {
        return 'text-muted';
    }

    return value > 0 ? 'text-up' : 'text-down';
}
