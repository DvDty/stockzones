import { useEffect } from 'react';

/**
 * Stands in for @inertiajs/react in the static build, which has no Inertia
 * app around the page.
 */
export function Head({ title }: { title?: string }) {
    useEffect(() => {
        if (title) {
            document.title = `${title} - stockzones`;
        }
    }, [title]);

    return null;
}
