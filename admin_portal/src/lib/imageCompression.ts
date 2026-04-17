import imageCompression from 'browser-image-compression';

/**
 * Standard LOKMA Image Compression Options
 * Reduces heavy images (4-10MB) to highly optimized webp/jpeg (~150KB)
 * without sacrificing noticeable visual quality on mobile devices.
 */
export async function compressLokmaImage(imageFile: File, isLogoOrIcon: boolean = false): Promise<File> {
  const options = {
    // For logos, we might want slightly smaller max-width but logos are usually already small.
    // Standard hero cards / banners in app use max 1024px width efficiently.
    maxWidthOrHeight: isLogoOrIcon ? 512 : 1024,
    // Reduce file size significantly, target < 200KB for bandwidth optimization
    maxSizeMB: 0.25, 
    useWebWorker: true,
    fileType: 'image/webp' // modern efficient format for mobile
  };

  try {
    // Only compress if the file is larger than 300KB (no need to compress tiny icons)
    if (imageFile.size / 1024 / 1024 <= 0.3) {
      return imageFile;
    }
    
    // Add logging to monitor the compression ratio in browser console
    console.log(`Original image size: ${(imageFile.size / 1024 / 1024).toFixed(2)} MB`);
    const compressedFile = await imageCompression(imageFile, options);
    console.log(`Compressed image size: ${(compressedFile.size / 1024 / 1024).toFixed(2)} MB`);
    
    return compressedFile;
  } catch (error) {
    console.warn("Image compression failed, falling back to original upload", error);
    return imageFile;
  }
}
