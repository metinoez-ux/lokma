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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.optimizeLokmaImages = void 0;
const storage_1 = require("firebase-functions/v2/storage");
const admin = __importStar(require("firebase-admin"));
const sharp_1 = __importDefault(require("sharp"));
const logger_1 = require("firebase-functions/logger");
exports.optimizeLokmaImages = (0, storage_1.onObjectFinalized)({
    memory: "1GiB",
    timeoutSeconds: 120,
}, async (event) => {
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
        (0, logger_1.info)(`[ImageOptimizer] Skipping ${filePath} - already optimized.`);
        return;
    }
    // 3. Skip if image is already small (under 300KB)
    const sizeBytes = typeof sizeString === 'number' ? sizeString : parseInt(sizeString || "0", 10);
    if (sizeBytes < 300 * 1024) {
        (0, logger_1.info)(`[ImageOptimizer] Skipping ${filePath} - size is only ${(sizeBytes / 1024).toFixed(2)} KB.`);
        return;
    }
    // Only process specific directories if necessary, or process all images.
    // For LOKMA, Kermes events and business headers are usually in 'events/', 'businesses/', or 'products/'.
    // We will process all images globally to keep the app highly performant.
    (0, logger_1.info)(`[ImageOptimizer] Starting optimization for ${filePath} (${(sizeBytes / 1024 / 1024).toFixed(2)} MB)...`);
    const bucket = admin.storage().bucket(fileBucket);
    const file = bucket.file(filePath);
    try {
        // Download the image into memory
        const [buffer] = await file.download();
        // Compress the image using sharp
        // We use webp format, scaled down to max width 1024px while keeping aspect ratio
        const optimizedBuffer = await (0, sharp_1.default)(buffer)
            .resize({ width: 1024, withoutEnlargement: true })
            .webp({ quality: 75, effort: 4 }) // 75 quality is a great balance for <200KB WebP
            .toBuffer();
        // Overwrite the original file with the optimized one
        // We explicitely set 'isOptimized' to "true" to break the onFinalize chain.
        await file.save(optimizedBuffer, {
            metadata: {
                contentType: "image/webp",
                metadata: {
                    isOptimized: "true",
                },
            },
            // Allow overwriting
            resumable: false,
        });
        (0, logger_1.info)(`[ImageOptimizer] Successfully optimized ${filePath} -> from ${(sizeBytes / 1024).toFixed(2)}KB to ${(optimizedBuffer.length / 1024).toFixed(2)}KB!`);
    }
    catch (err) {
        (0, logger_1.error)(`[ImageOptimizer] Failed to optimize ${filePath}`, err);
    }
});
//# sourceMappingURL=imageOptimizer.js.map