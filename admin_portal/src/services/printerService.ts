/**
 * Printer Service — Client-side helper for printing receipts
 * Includes: Health monitoring, retry queue, alert notifications
 */

export interface PrinterSettings {
    enabled: boolean;
    printerIp: string;
    printerPort: number;
    autoPrint: boolean;
    printCopies: number;
}

export const DEFAULT_PRINTER_SETTINGS: PrinterSettings = {
    enabled: false,
    printerIp: '',
    printerPort: 9100,
    autoPrint: false,
    printCopies: 1,
};

// ─── Health Status ───────────────────────────────────────────────

export type PrinterHealthStatus = 'online' | 'offline' | 'checking' | 'unknown';

export interface PrinterHealthState {
    status: PrinterHealthStatus;
    lastChecked: Date | null;
    lastOnline: Date | null;
    responseTimeMs: number;
    consecutiveFailures: number;
    error?: string;
}

export const DEFAULT_HEALTH_STATE: PrinterHealthState = {
    status: 'unknown',
    lastChecked: null,
    lastOnline: null,
    responseTimeMs: 0,
    consecutiveFailures: 0,
};

// Consecutive failures before declaring offline
const OFFLINE_THRESHOLD = 2;

/**
 * Check printer health via the /api/print/health endpoint
 */
export async function checkHealth(
    settings: PrinterSettings
): Promise<{ online: boolean; responseTimeMs: number; error?: string }> {
    if (!settings.printerIp) {
        return { online: false, responseTimeMs: 0, error: 'No printer IP configured' };
    }

    try {
        const res = await fetch('/api/print/health', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                printerIp: settings.printerIp,
                printerPort: settings.printerPort,
            }),
        });

        const data = await res.json();
        return {
            online: data.online === true,
            responseTimeMs: data.responseTimeMs || 0,
            error: data.error,
        };
    } catch (err: any) {
        return { online: false, responseTimeMs: 0, error: err.message || 'Network error' };
    }
}

// ─── Alert Notifications ─────────────────────────────────────────

/**
 * Send printer alert email (offline/online transition)
 */
export async function sendPrinterAlert(params: {
    type: 'offline' | 'online';
    businessName: string;
    printerIp: string;
    printerPort: number;
    errorDetails?: string;
    lastSuccessfulPrint?: string;
    adminEmail?: string;
}): Promise<{ success: boolean; rateLimited?: boolean }> {
    try {
        const res = await fetch('/api/print/printer-alert', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(params),
        });

        const data = await res.json();
        return {
            success: data.success === true,
            rateLimited: data.rateLimited,
        };
    } catch {
        return { success: false };
    }
}

// ─── Print Functions ─────────────────────────────────────────────

/**
 * Print an order receipt via the API route
 */
export async function printOrder(
    settings: PrinterSettings,
    order: any,
    businessName?: string
): Promise<{ success: boolean; message: string }> {
    if (!settings.enabled || !settings.printerIp) {
        return { success: false, message: 'Printer not configured' };
    }

    try {
        const res = await fetch('/api/print', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                printerIp: settings.printerIp,
                printerPort: settings.printerPort,
                order,
                businessName,
                copies: settings.printCopies,
            }),
        });

        const data = await res.json();

        if (!res.ok) {
            return { success: false, message: data.error || data.details || 'Print failed' };
        }

        return { success: true, message: data.message || 'Printed successfully' };
    } catch (err: any) {
        return { success: false, message: err.message || 'Network error' };
    }
}

/**
 * Send a test print to verify printer connection
 */
export async function testPrint(
    settings: PrinterSettings,
    businessName?: string
): Promise<{ success: boolean; message: string }> {
    if (!settings.printerIp) {
        return { success: false, message: 'Printer IP not set' };
    }

    try {
        const res = await fetch('/api/print', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                printerIp: settings.printerIp,
                printerPort: settings.printerPort,
                testPrint: true,
                businessName,
            }),
        });

        const data = await res.json();

        if (!res.ok) {
            return { success: false, message: data.error || data.details || 'Test print failed' };
        }

        return { success: true, message: 'Test receipt printed!' };
    } catch (err: any) {
        return { success: false, message: err.message || 'Network error' };
    }
}

// ─── Retry Queue ─────────────────────────────────────────────────

export interface RetryItem {
    id: string;
    order: any;
    businessName: string;
    addedAt: Date;
    retryCount: number;
}

const MAX_RETRIES = 3;
const RETRY_INTERVAL_MS = 10_000; // 10 seconds

/**
 * Manages a retry queue for failed print jobs.
 * When a print fails, add to the queue. When printer comes back online,
 * call processQueue to retry.
 */
export class PrintRetryQueue {
    private queue: RetryItem[] = [];
    private processing = false;

    add(order: any, businessName: string): void {
        // Don't add duplicates
        if (this.queue.some((item) => item.id === order.id || item.id === order.orderNumber)) return;
        this.queue.push({
            id: order.id || order.orderNumber || `retry-${Date.now()}`,
            order,
            businessName,
            addedAt: new Date(),
            retryCount: 0,
        });
    }

    get items(): readonly RetryItem[] {
        return this.queue;
    }

    get size(): number {
        return this.queue.length;
    }

    clear(): void {
        this.queue = [];
    }

    /**
     * Process the retry queue — called when printer is back online
     */
    async processQueue(
        settings: PrinterSettings,
        onSuccess?: (item: RetryItem) => void,
        onFail?: (item: RetryItem, error: string) => void
    ): Promise<number> {
        if (this.processing || this.queue.length === 0) return 0;
        this.processing = true;

        let printed = 0;
        const remaining: RetryItem[] = [];

        for (const item of this.queue) {
            const result = await printOrder(settings, item.order, item.businessName);

            if (result.success) {
                printed++;
                onSuccess?.(item);
            } else {
                item.retryCount++;
                if (item.retryCount < MAX_RETRIES) {
                    remaining.push(item);
                } else {
                    onFail?.(item, `Max retries (${MAX_RETRIES}) exceeded: ${result.message}`);
                }
            }

            // Small delay between prints
            await new Promise((r) => setTimeout(r, 500));
        }

        this.queue = remaining;
        this.processing = false;

        return printed;
    }
}

// ─── Screen Wake Lock ────────────────────────────────────────────

/**
 * Request a screen wake lock to prevent display sleep.
 * Only works on HTTPS and supported browsers.
 * Returns a release function to call when no longer needed.
 */
export async function requestWakeLock(): Promise<{ success: boolean; release?: () => Promise<void> }> {
    if (!('wakeLock' in navigator)) {
        console.warn('Wake Lock API not supported in this browser');
        return { success: false };
    }

    try {
        const wakeLock = await (navigator as any).wakeLock.request('screen');
        console.log('Screen wake lock acquired');

        return {
            success: true,
            release: async () => {
                await wakeLock.release();
                console.log('Screen wake lock released');
            },
        };
    } catch (err: any) {
        console.error('Wake lock failed:', err.message);
        return { success: false };
    }
}
