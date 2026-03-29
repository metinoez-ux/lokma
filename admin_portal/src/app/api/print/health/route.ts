export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server';
import net from 'net';

// CORS headers for local print relay (lokma.web.app → localhost:3000)
const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': '*',
};

// Handle CORS preflight
export async function OPTIONS() {
    return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

/**
 * Printer Health Check API
 * Tests TCP connectivity to a receipt printer without sending print data.
 * Optionally sends ESC/POS DLE EOT status command to check paper/cover status.
 */

// ESC/POS Status Commands
const DLE = 0x10;
const EOT = 0x04;

// DLE EOT n — Transmit real-time status
// n=1: Printer status, n=2: Offline cause, n=3: Error cause, n=4: Paper sensor
const STATUS_CMDS = {
    PRINTER: Buffer.from([DLE, EOT, 0x01]),
    OFFLINE: Buffer.from([DLE, EOT, 0x02]),
    ERROR: Buffer.from([DLE, EOT, 0x03]),
    PAPER: Buffer.from([DLE, EOT, 0x04]),
};

interface HealthResult {
    online: boolean;
    responseTimeMs: number;
    paperOk?: boolean;
    coverClosed?: boolean;
    error?: string;
}

async function checkPrinterTCP(
    ip: string,
    port: number,
    timeoutMs = 3000,
    sendStatusCmd = false
): Promise<HealthResult> {
    const start = Date.now();

    return new Promise((resolve) => {
        const socket = new net.Socket();
        let resolved = false;

        const finish = (result: HealthResult) => {
            if (resolved) return;
            resolved = true;
            socket.destroy();
            resolve(result);
        };

        const timer = setTimeout(() => {
            finish({
                online: false,
                responseTimeMs: Date.now() - start,
                error: `Connection timeout after ${timeoutMs}ms`,
            });
        }, timeoutMs);

        socket.connect(port, ip, () => {
            clearTimeout(timer);
            const connectTime = Date.now() - start;

            if (!sendStatusCmd) {
                // Simple connectivity check — TCP connection succeeded
                finish({
                    online: true,
                    responseTimeMs: connectTime,
                    paperOk: true, // Assume OK if we can't query
                    coverClosed: true,
                });
                return;
            }

            // Send DLE EOT to get printer status
            let statusData = Buffer.alloc(0);

            socket.on('data', (data) => {
                statusData = Buffer.concat([statusData, data]);

                // We expect at least 1 byte back per status query
                if (statusData.length >= 1) {
                    const byte = statusData[0];
                    // Bit 3 (0x08): offline
                    // Bit 5 (0x20): cover open
                    // For paper: bit 5+6 (0x60) = paper end
                    const isOnline = (byte & 0x08) === 0;
                    const coverClosed = (byte & 0x20) === 0;

                    finish({
                        online: isOnline,
                        responseTimeMs: Date.now() - start,
                        paperOk: true, // Extended check needs separate query
                        coverClosed,
                    });
                }
            });

            // Send printer status query
            socket.write(STATUS_CMDS.PRINTER);

            // If no response to status cmd within 1s, printer is still online (just doesn't support DLE EOT)
            setTimeout(() => {
                if (!resolved) {
                    finish({
                        online: true,
                        responseTimeMs: Date.now() - start,
                        paperOk: true,
                        coverClosed: true,
                    });
                }
            }, 1000);
        });

        socket.on('error', (err) => {
            clearTimeout(timer);
            finish({
                online: false,
                responseTimeMs: Date.now() - start,
                error: err.message,
            });
        });
    });
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { printerIp, printerPort = 9100, detailed = false } = body;

        if (!printerIp) {
            return NextResponse.json(
                { error: 'printerIp is required' },
                { status: 400 }
            );
        }

        const result = await checkPrinterTCP(printerIp, printerPort, 3000, detailed);

        return NextResponse.json({
            ...result,
            timestamp: new Date().toISOString(),
            printerIp,
            printerPort,
        }, { headers: CORS_HEADERS });
    } catch (error: any) {
        console.error('Health check error:', error);
        return NextResponse.json(
            {
                online: false,
                responseTimeMs: 0,
                error: error.message,
                timestamp: new Date().toISOString(),
            },
            { status: 500, headers: CORS_HEADERS }
        );
    }
}
