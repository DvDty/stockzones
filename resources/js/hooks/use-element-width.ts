import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';

export function useElementWidth<T extends HTMLElement>(): [
    RefObject<T | null>,
    number,
] {
    const ref = useRef<T>(null);
    const [width, setWidth] = useState(0);

    useEffect(() => {
        const el = ref.current;

        if (!el) {
            return;
        }

        const observer = new ResizeObserver(([entry]) =>
            setWidth(entry.contentRect.width),
        );
        observer.observe(el);

        return () => observer.disconnect();
    }, []);

    return [ref, width];
}
