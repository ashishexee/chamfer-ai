import { readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * Reads an image file and returns a base64 data URL.
 */
export function imageToBase64(filePath: string): string {
  const data = readFileSync(filePath);
  const ext = filePath.split('.').pop()?.toLowerCase() || 'png';
  const mimeType = ext === 'webp' ? 'image/webp' : ext === 'png' ? 'image/png' : ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 'image/png';
  return `data:${mimeType};base64,${data.toString('base64')}`;
}

/**
 * Validates a base64 data URL image string.
 */
export function validateImageDataUrl(dataUrl: string): { valid: boolean; error?: string } {
  if (!dataUrl.startsWith('data:image/')) {
    return { valid: false, error: 'Invalid image data URL format' };
  }
  const base64Part = dataUrl.split(',')[1];
  if (!base64Part || base64Part.length === 0) {
    return { valid: false, error: 'Empty image data' };
  }
  // Rough size check: base64 is ~4/3 of binary size
  const estimatedSize = base64Part.length * 0.75;
  if (estimatedSize > 10 * 1024 * 1024) {
    return { valid: false, error: 'Image too large (max 10MB)' };
  }
  return { valid: true };
}

/**
 * Builds OpenAI message content array with text and images.
 */
export function buildVisionContent(
  prompt: string,
  images: string[]
): Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string; detail?: 'low' | 'high' | 'auto' } }> {
  const content: Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string; detail?: 'low' | 'high' | 'auto' } }> = [];

  content.push({ type: 'text', text: prompt });

  for (const imageUrl of images) {
    content.push({
      type: 'image_url',
      image_url: { url: imageUrl, detail: 'high' },
    });
  }

  return content;
}

/**
 * Checks if images are present and the provider supports vision.
 */
export function checkVisionSupport(images: string[] | undefined, providerSupportsVision: boolean): { valid: boolean; error?: string } {
  if (!images || images.length === 0) {
    return { valid: true };
  }
  if (!providerSupportsVision) {
    return { valid: false, error: 'Selected provider does not support image analysis. Choose a vision-capable provider: mimo, 0g, groq-vision, qwen3p7-plus, kimi-k2p6, minimax-m3' };
  }
  for (const img of images) {
    const validation = validateImageDataUrl(img);
    if (!validation.valid) {
      return validation;
    }
  }
  return { valid: true };
}

/**
 * Loads test images from the workspace root for reference testing.
 * Returns an array of base64 data URLs.
 */
export function loadTestImages(imageNames: string[]): string[] {
  const images: string[] = [];
  for (const name of imageNames) {
    try {
      const path = resolve('/home/abhieren/Drive/Projects/CAD_AI', name);
      images.push(imageToBase64(path));
    } catch (e) {
      console.warn(`[VISION] Could not load test image: ${name}`);
    }
  }
  return images;
}
