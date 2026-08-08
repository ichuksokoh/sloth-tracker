export function sampleRegionLuminance(
  img: HTMLImageElement,
  region: { xFrac: number; yFrac: number; wFrac: number; hFrac: number }
): number {
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  const ctx = canvas.getContext("2d");
  if (!ctx) return 1; // fallback: assume light bg -> darker icon

  const sx = img.naturalWidth * region.xFrac;
  const sy = img.naturalHeight * region.yFrac;
  const sw = img.naturalWidth * region.wFrac;
  const sh = img.naturalHeight * region.hFrac;

  try {
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, 1, 1);
    const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  } catch (err) {
    // canvas tainted -> non-CORS-safe image source
    console.warn("Could not sample cover brightness:", err);
    return 1;
  }
}