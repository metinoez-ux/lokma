/**
 * Firebase Metrics Service
 * 
 * Fetches Firebase usage metrics using Google Cloud Monitoring API
 * Provides real-time quota tracking for Firestore, Functions, Storage, and Auth
 */

import { google } from 'googleapis';

const PROJECT_ID = 'aylar-a45af';

// Free tier daily limits
const QUOTA_LIMITS = {
    FIRESTORE_READS: 50000,
    FIRESTORE_WRITES: 20000,
    FIRESTORE_DELETES: 20000,
    FIRESTORE_STORAGE_GB: 1,
    STORAGE_BANDWIDTH_GB: 10,
};

export interface FirebaseMetrics {
    firestore: {
        reads: { today: number; limit: number; percentage: number };
        writes: { today: number; limit: number; percentage: number };
        deletes: { today: number; limit: number; percentage: number };
        storage: { current: number; limit: number; percentage: number; unit: 'GB' };
    };
    functions: {
        invocations: { monthly: number };
        errors: { count: number; percentage: number };
    };
    storage: {
        bandwidth: { monthly: number; limit: number; percentage: number; unit: 'GB' };
        totalSize: { current: number; unit: 'GB' };
    };
    authentication: {
        totalUsers: number;
        activeUsers: { daily: number; monthly: number };
    };
    // User-level breakdown (estimated)
    usage: {
        superAdmins: { estimatedReads: number; percentage: number };
        businessAdmins: { estimatedReads: number; percentage: number };
        endUsers: { estimatedReads: number; percentage: number };
    };
}

/**
 * Get Firebase metrics from Cloud Monitoring API
 */
export async function getFirebaseMetrics(serviceAccountKey?: string): Promise<FirebaseMetrics> {
    try {
        // Initialize Google Auth
        const auth = serviceAccountKey
            ? new google.auth.GoogleAuth({
                credentials: JSON.parse(serviceAccountKey),
                scopes: ['https://www.googleapis.com/auth/monitoring.read'],
            })
            : new google.auth.GoogleAuth({
                scopes: ['https://www.googleapis.com/auth/monitoring.read'],
            });

        const authClient = await auth.getClient();
        const monitoring = google.monitoring({ version: 'v3', auth: authClient as any });

        // Calculate time range (last 24 hours for daily quotas)
        const endTime = new Date();
        const startTime = new Date(endTime.getTime() - 24 * 60 * 60 * 1000);

        // Fetch Firestore metrics
        const firestoreReads = await getMetric(monitoring, 'firestore.googleapis.com/document/read_count', startTime, endTime);
        const firestoreWrites = await getMetric(monitoring, 'firestore.googleapis.com/document/write_count', startTime, endTime);
        const firestoreDeletes = await getMetric(monitoring, 'firestore.googleapis.com/document/delete_count', startTime, endTime);
        const firestoreStorageBytes = await getMetric(monitoring, 'firestore.googleapis.com/storage/billable_bytes', startTime, endTime);

        // Fetch Functions metrics (last 30 days for monthly)
        const monthStartTime = new Date(endTime.getTime() - 30 * 24 * 60 * 60 * 1000);
        const functionsInvocations = await getMetric(monitoring, 'cloudfunctions.googleapis.com/function/execution_count', monthStartTime, endTime);
        const functionsErrors = await getMetric(monitoring, 'cloudfunctions.googleapis.com/function/user_error_count', monthStartTime, endTime);

        // Fetch Storage metrics
        const storageBandwidth = await getMetric(monitoring, 'storage.googleapis.com/network/sent_bytes_count', monthStartTime, endTime);
        const storageTotalBytes = await getMetric(monitoring, 'storage.googleapis.com/storage/total_bytes', startTime, endTime);

        // Calculate percentages
        const firestoreReadsCount = firestoreReads || 0;
        const firestoreWritesCount = firestoreWrites || 0;
        const firestoreDeletesCount = firestoreDeletes || 0;
        const firestoreStorageGB = (firestoreStorageBytes || 0) / (1024 ** 3);
        const storageBandwidthGB = (storageBandwidth || 0) / (1024 ** 3);
        const storageSizeGB = (storageTotalBytes || 0) / (1024 ** 3);

        const functionsInvocationsCount = functionsInvocations || 0;
        const functionsErrorsCount = functionsErrors || 0;
        const functionsErrorPercentage = functionsInvocationsCount > 0
            ? (functionsErrorsCount / functionsInvocationsCount) * 100
            : 0;

        // ESTIMATED user-level breakdown (simplified heuristic)
        // Assumption: Super admins use Master Catalog (10k reads/session), business admins moderate usage, end users minimal
        const estimatedSuperAdminReads = Math.floor(firestoreReadsCount * 0.60); // 60% from super admins accessing full catalog
        const estimatedBusinessAdminReads = Math.floor(firestoreReadsCount * 0.25); // 25% from business admins
        const estimatedEndUserReads = firestoreReadsCount - estimatedSuperAdminReads - estimatedBusinessAdminReads; // Rest from end users

        return {
            firestore: {
                reads: {
                    today: firestoreReadsCount,
                    limit: QUOTA_LIMITS.FIRESTORE_READS,
                    percentage: (firestoreReadsCount / QUOTA_LIMITS.FIRESTORE_READS) * 100,
                },
                writes: {
                    today: firestoreWritesCount,
                    limit: QUOTA_LIMITS.FIRESTORE_WRITES,
                    percentage: (firestoreWritesCount / QUOTA_LIMITS.FIRESTORE_WRITES) * 100,
                },
                deletes: {
                    today: firestoreDeletesCount,
                    limit: QUOTA_LIMITS.FIRESTORE_DELETES,
                    percentage: (firestoreDeletesCount / QUOTA_LIMITS.FIRESTORE_DELETES) * 100,
                },
                storage: {
                    current: parseFloat(firestoreStorageGB.toFixed(2)),
                    limit: QUOTA_LIMITS.FIRESTORE_STORAGE_GB,
                    percentage: (firestoreStorageGB / QUOTA_LIMITS.FIRESTORE_STORAGE_GB) * 100,
                    unit: 'GB',
                },
            },
            functions: {
                invocations: { monthly: functionsInvocationsCount },
                errors: { count: functionsErrorsCount, percentage: functionsErrorPercentage },
            },
            storage: {
                bandwidth: {
                    monthly: parseFloat(storageBandwidthGB.toFixed(2)),
                    limit: QUOTA_LIMITS.STORAGE_BANDWIDTH_GB,
                    percentage: (storageBandwidthGB / QUOTA_LIMITS.STORAGE_BANDWIDTH_GB) * 100,
                    unit: 'GB',
                },
                totalSize: { current: parseFloat(storageSizeGB.toFixed(2)), unit: 'GB' },
            },
            authentication: {
                totalUsers: 0, // This requires Firestore query, not Monitoring API
                activeUsers: { daily: 0, monthly: 0 }, // Would need Firebase Analytics
            },
            // User breakdown
            usage: {
                superAdmins: {
                    estimatedReads: estimatedSuperAdminReads,
                    percentage: (estimatedSuperAdminReads / firestoreReadsCount) * 100,
                },
                businessAdmins: {
                    estimatedReads: estimatedBusinessAdminReads,
                    percentage: (estimatedBusinessAdminReads / firestoreReadsCount) * 100,
                },
                endUsers: {
                    estimatedReads: estimatedEndUserReads,
                    percentage: (estimatedEndUserReads / firestoreReadsCount) * 100,
                },
            },
        };
    } catch (error) {
        console.error('Error fetching Firebase metrics:', error);
        throw new Error(`Failed to fetch metrics: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

/**
 * Helper function to fetch a specific metric from Cloud Monitoring
 */
async function getMetric(
    monitoring: any,
    metricType: string,
    startTime: Date,
    endTime: Date
): Promise<number> {
    try {
        const response = await monitoring.projects.timeSeries.list({
            name: `projects/${PROJECT_ID}`,
            filter: `metric.type="${metricType}"`,
            'interval.startTime': startTime.toISOString(),
            'interval.endTime': endTime.toISOString(),
            aggregation: {
                alignmentPeriod: '3600s', // 1 hour
                perSeriesAligner: 'ALIGN_SUM',
                crossSeriesReducer: 'REDUCE_SUM',
            },
        });

        if (!response.data.timeSeries || response.data.timeSeries.length === 0) {
            return 0;
        }

        // Sum all points across time series
        let total = 0;
        response.data.timeSeries.forEach((series: any) => {
            series.points?.forEach((point: any) => {
                const value = point.value?.int64Value || point.value?.doubleValue || 0;
                total += typeof value === 'string' ? parseInt(value, 10) : value;
            });
        });

        return total;
    } catch (error) {
        console.error(`Error fetching metric ${metricType}:`, error);
        return 0;
    }
}
