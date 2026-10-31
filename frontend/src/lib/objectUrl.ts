/** Decode a base64 payload from the API into a browser object URL. */
export function base64ToObjectUrl(
  base64: string,
  mime = 'application/octet-stream',
): string {
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const blob = new Blob([bytes], { type: mime });
  return URL.createObjectURL(blob);
}
