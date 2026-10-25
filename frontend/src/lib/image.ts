/** Recadre une image au centre en carré et la compresse en JPEG (data URL). */
export async function squareImage(file: File, size = 600): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('Image illisible'));
      i.src = url;
    });
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = Math.min(size, side);
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.85);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Recadre au centre au format bannière (3:1) et compresse en JPEG (data URL). */
export async function bannerImage(file: File, width = 1500): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('Image illisible'));
      i.src = url;
    });
    const ratio = 3;
    const sw = Math.min(img.naturalWidth, img.naturalHeight * ratio);
    const sh = sw / ratio;
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(ratio, Math.min(width, Math.round(sw)));
    canvas.height = Math.max(1, Math.round(canvas.width / ratio));
    canvas
      .getContext('2d')!
      .drawImage(img, (img.naturalWidth - sw) / 2, (img.naturalHeight - sh) / 2, sw, sh, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.85);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Version sans bandes noires d'une vignette, utilisable comme miniature carrée. */
export function coverFromArtwork(url: string) {
  return url.replace(/\/hqdefault\.jpg$/, '/mqdefault.jpg');
}
