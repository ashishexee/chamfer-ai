/**
 * Converts a File object to a base64 data URL.
 */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Validates an image file before upload.
 */
export function validateImage(file: File): { valid: boolean; error?: string } {
  if (!file.type.startsWith('image/')) {
    return { valid: false, error: 'File must be an image' };
  }
  if (file.size > 10 * 1024 * 1024) {
    return { valid: false, error: 'Image must be under 10MB' };
  }
  return { valid: true };
}

/**
 * Compresses an image if needed to reduce size for API upload.
 */
export function compressImage(dataUrl: string, maxWidth: number = 1024): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;
      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = reject;
    img.src = dataUrl;
  });
}

/**
 * Extracts base64 data from a data URL.
 */
export function extractBase64FromDataUrl(dataUrl: string): string {
  return dataUrl.split(',')[1] || '';
}

/**
 * Gets the MIME type from a data URL.
 */
export function getMimeTypeFromDataUrl(dataUrl: string): string {
  const match = dataUrl.match(/^data:([^;]+);base64,/);
  return match?.[1] || 'image/png';
}
