'use client';

import { useEffect } from 'react';

/**
 * Global handler: number input'larina tiklandiginda icerigi otomatik secer.
 * Boylece kullanici "0" degerini elle silmek zorunda kalmaz.
 */
export default function NumberInputAutoSelect() {
    useEffect(() => {
        const handler = (e: FocusEvent) => {
            const target = e.target as HTMLInputElement;
            if (target.tagName === 'INPUT' && target.type === 'number') {
                target.select();
            }
        };
        document.addEventListener('focusin', handler);
        return () => document.removeEventListener('focusin', handler);
    }, []);

    return null;
}
