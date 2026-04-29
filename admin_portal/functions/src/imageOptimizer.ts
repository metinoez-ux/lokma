import { onObjectFinalized } from "firebase-functions/v2/storage";
import * as admin from "firebase-admin";
import sharp from "sharp";
import { info, warn, error as logError } from "firebase-functions/logger";

export const optimizeLokmaImages = onObjectFinalized(
    {
        memory: "1GiB",
        timeoutSeconds: 120,
    },
    async (event) => {
        const fileBucket = event.data.bucket;
        const filePath = event.data.name;
        const contentType = event.data.contentType;
        const sizeString = event.data.size;
        const metadata = event.data.metadata || {};

        // 1. Terminate gracefully if it's not an image
        if (!contentType || !contentType.startsWith("image/")) {
            return;
        }

        // 2. Terminate gracefully if this image is already optimized to prevent infinite loops!
        if (metadata.isOptimized === "true") {
            info(`[ImageOptimizer] Skipping ${filePath} - already optimized.`);
            return;
        }

        // 3. Skip if image is already small (under 300KB)
        const sizeBytes = typeof sizeString === 'number' ? sizeString : parseInt((sizeString as string) || "0", 10);
        if (sizeBytes < 300 * 1024) {
            info(`[ImageOptimizer] Skipping ${filePath} - size is only ${(sizeBytes / 1024).toFixed(2)} KB.`);
            return;
        }

        // Only process specific directories if necessary, or process all images.
        // For LOKMA, Kermes events and business headers are usually in 'events/', 'businesses/', or 'products/'.
        // We will process all images globally to keep the app highly performant.
        info(`[ImageOptimizer] Starting optimization for ${filePath} (${(sizeBytes / 1024 / 1024).toFixed(2)} MB)...`);

        const bucket = admin.storage().bucket(fileBucket);
        const file = bucket.file(filePath);

        try {
            // Download the image into memory
            const [buffer] = await file.download();

            // Compress the image using sharp
            // We use webp format, scaled down to max width 1024px while keeping aspect ratio
            const optimizedBuffer = await sharp(buffer)
                .resize({ width: 1024, withoutEnlargement: true })
                .webp({ quality: 75, effort: 4 }) // 75 quality is a great balance for <200KB WebP
                .toBuffer();

            // Overwrite the original file with the optimized one
            // We explicitely set 'isOptimized' to "true" to break the onFinalize chain.
            // MUST PRESERVE the firebaseStorageDownloadTokens so client URLs don't break!
            const existingTokens = metadata.firebaseStorageDownloadTokens;
            
            await file.save(optimizedBuffer, {
                metadata: {
                    contentType: "image/webp",
                    metadata: {
                        isOptimized: "true",
                        ...(existingTokens ? { firebaseStorageDownloadTokens: existingTokens } : {}),
                    },
                },
                // Allow overwriting
                resumable: false,
            });

            info(`[ImageOptimizer] Successfully optimized ${filePath} -> from ${(sizeBytes / 1024).toFixed(2)}KB to ${(optimizedBuffer.length / 1024).toFixed(2)}KB!`);
        } catch (err) {
            logError(`[ImageOptimizer] Failed to optimize ${filePath}`, err);
        }
    }
);
