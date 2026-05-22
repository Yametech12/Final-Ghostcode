/**
 * Client-side image compression utility.
 * Uses browser-image-compression to compress + convert to WebP before upload.
 * Reduces server load and improves upload speed.
 */

interface CompressionOptions {
  maxSizeMB?: number;
  maxWidthOrHeight?: number;
  useWebWorker?: boolean;
  preferWebP?: boolean;
}

/**
 * Compress an image file before upload.
 * Returns a base64 data URL.
 */
export async function compressImage(
  file: File | Blob,
  options: CompressionOptions = {}
): Promise<string> {
  const {
    maxSizeMB = 0.5, // Aim for 500KB
    maxWidthOrHeight = 1024,
    useWebWorker = true,
    preferWebP = true,
  } = options;

  // Lazy import keeps the bundle small until needed
  const { default: imageCompression } = await import('browser-image-compression');

  const compressed = await imageCompression(file as File, {
    maxSizeMB,
    maxWidthOrHeight,
    useWebWorker,
    fileType: preferWebP ? 'image/webp' : undefined,
  });

  return await imageCompression.getDataUrlFromFile(compressed);
}

/**
 * Compress a base64 data URL.
 * Useful when you already have base64 (e.g., from canvas).
 */
export async function compressDataUrl(
  dataUrl: string,
  options: CompressionOptions = {}
): Promise<string> {
  // Convert data URL to blob
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  return compressImage(blob, options);
}

/**
 * Get the size in KB of a base64 data URL.
 */
export function getDataUrlSizeKB(dataUrl: string): number {
  const base64 = dataUrl.split(',')[1] || '';
  const sizeBytes = (base64.length * 3) / 4;
  return Math.round(sizeBytes / 1024);
}
