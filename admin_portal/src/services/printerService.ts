/**
 * Printer Service — Client-side helper for printing receipts
 * Calls the /api/print endpoint which handles TCP communication
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
