import { onObjectFinalized } from "firebase-functions/v2/storage";
import * as admin from "firebase-admin";
const ffmpeg = require("fluent-ffmpeg");
import * as ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import { info, error as logError } from "firebase-functions/logger";
import * as path from "path";
import * as os from "os";
import * as fs from "fs";

ffmpeg.setFfmpegPath(ffmpegInstaller.path);

export const optimizeLokmaVideos = onObjectFinalized(
    {
        memory: "2GiB",
        timeoutSeconds: 300,
    },
    async (event) => {
        const fileBucket = event.data.bucket;
        const filePath = event.data.name;
        const contentType = event.data.contentType;

        // Terminate gracefully if it's not a video
        if (!contentType || !contentType.startsWith("video/")) {
            return;
        }

        info(`[VideoOptimizer] Starting optimization for ${filePath}...`);

        const bucket = admin.storage().bucket(fileBucket);
        const file = bucket.file(filePath);

        // We use a unique string for temp files to prevent collisions in cloud functions
        const tempId = Math.random().toString(36).substring(7);
        const tempFilePath = path.join(os.tmpdir(), `vid_${tempId}_${path.basename(filePath)}`);
        const thumbFileName = `thumb_${tempId}.jpg`;
        const tempThumbPath = path.join(os.tmpdir(), thumbFileName);
        const targetThumbPath = `${filePath}_thumb.jpg`; // Keep original path and append _thumb.jpg
        
        try {
            // Download the video
            await file.download({ destination: tempFilePath });
            info(`[VideoOptimizer] Downloaded ${filePath} to temp dir.`);

            // Extract frame
            await new Promise((resolve, reject) => {
                ffmpeg(tempFilePath)
                    .screenshots({
                        timestamps: [1], // capture at 1 second
                        filename: thumbFileName,
                        folder: os.tmpdir(),
                        size: '1024x?' // scale width to 1024px, maintain aspect ratio
                    })
                    .on('end', () => resolve(null))
                    .on('error', (err: any) => reject(err));
            });
            info(`[VideoOptimizer] Generated thumbnail for ${filePath}.`);

            // Get original token to assign to thumbnail
            const originalMetadata = event.data.metadata;
            const originalTokens = originalMetadata?.firebaseStorageDownloadTokens;

            let customMetadata: any = {
                isOptimized: "true",
            };
            if (originalTokens) {
                customMetadata.firebaseStorageDownloadTokens = originalTokens;
            }

            // Upload the thumbnail
            await bucket.upload(tempThumbPath, {
                destination: targetThumbPath,
                metadata: {
                    contentType: "image/jpeg",
                    metadata: customMetadata,
                },
            });
            info(`[VideoOptimizer] Uploaded thumbnail to ${targetThumbPath} with tokens: ${originalTokens}`);

        } catch (err) {
            logError(`[VideoOptimizer] Failed to process ${filePath}`, err);
        } finally {
            // Cleanup temp files
            if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
            if (fs.existsSync(tempThumbPath)) fs.unlinkSync(tempThumbPath);
        }
    }
);
