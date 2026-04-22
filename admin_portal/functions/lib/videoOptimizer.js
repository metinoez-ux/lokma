"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.optimizeLokmaVideos = void 0;
const storage_1 = require("firebase-functions/v2/storage");
const admin = __importStar(require("firebase-admin"));
const ffmpeg = require("fluent-ffmpeg");
const ffmpegInstaller = __importStar(require("@ffmpeg-installer/ffmpeg"));
const logger_1 = require("firebase-functions/logger");
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const fs = __importStar(require("fs"));
ffmpeg.setFfmpegPath(ffmpegInstaller.path);
exports.optimizeLokmaVideos = (0, storage_1.onObjectFinalized)({
    memory: "2GiB",
    timeoutSeconds: 300,
}, async (event) => {
    const fileBucket = event.data.bucket;
    const filePath = event.data.name;
    const contentType = event.data.contentType;
    // Terminate gracefully if it's not a video
    if (!contentType || !contentType.startsWith("video/")) {
        return;
    }
    (0, logger_1.info)(`[VideoOptimizer] Starting optimization for ${filePath}...`);
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
        (0, logger_1.info)(`[VideoOptimizer] Downloaded ${filePath} to temp dir.`);
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
                .on('error', (err) => reject(err));
        });
        (0, logger_1.info)(`[VideoOptimizer] Generated thumbnail for ${filePath}.`);
        // Get original token to assign to thumbnail
        const originalMetadata = event.data.metadata;
        const originalTokens = originalMetadata?.firebaseStorageDownloadTokens;
        let customMetadata = {
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
        (0, logger_1.info)(`[VideoOptimizer] Uploaded thumbnail to ${targetThumbPath} with tokens: ${originalTokens}`);
    }
    catch (err) {
        (0, logger_1.error)(`[VideoOptimizer] Failed to process ${filePath}`, err);
    }
    finally {
        // Cleanup temp files
        if (fs.existsSync(tempFilePath))
            fs.unlinkSync(tempFilePath);
        if (fs.existsSync(tempThumbPath))
            fs.unlinkSync(tempThumbPath);
    }
});
//# sourceMappingURL=videoOptimizer.js.map