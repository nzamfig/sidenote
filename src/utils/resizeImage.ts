/**
 * Maximum pixel dimension (width or height) before resizing kicks in.
 * At JPEG quality 0.82, a 1200px image is typically 200–400KB as base64,
 * allowing 10+ images within a 5MB localStorage budget.
 */
const MAX_DIMENSION = 1200;
const JPEG_QUALITY = 0.82;

/**
 * Resizes an image file using a canvas element if either dimension exceeds MAX_DIMENSION,
 * then encodes it as a JPEG data URL.
 *
 * Images already within MAX_DIMENSION are returned as-is (original format preserved).
 * Images exceeding MAX_DIMENSION are downscaled proportionally and output as JPEG.
 */
export function resizeImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      const { naturalWidth: w, naturalHeight: h } = img;

      if (w <= MAX_DIMENSION && h <= MAX_DIMENSION) {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.onerror = () => reject(new Error('Failed to read image file'));
        reader.readAsDataURL(file);
        return;
      }

      const scale = MAX_DIMENSION / Math.max(w, h);
      const targetW = Math.round(w * scale);
      const targetH = Math.round(h * scale);

      const canvas = document.createElement('canvas');
      canvas.width = targetW;
      canvas.height = targetH;

      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('Canvas 2D context unavailable')); return; }

      ctx.drawImage(img, 0, 0, targetW, targetH);
      resolve(canvas.toDataURL('image/jpeg', JPEG_QUALITY));
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Failed to load image'));
    };

    img.src = objectUrl;
  });
}
