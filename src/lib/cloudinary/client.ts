// Cloudinary client-side helper
// Usa la API route /api/upload para subir imágenes de forma segura

/**
 * Inyecta transformaciones en una URL de Cloudinary para servir imágenes optimizadas.
 * Cloudinary procesa on-demand y cachea en CDN → cero storage extra.
 *
 * Presets: 'thumb' (400px), 'card' (600px), 'detail' (900px), 'cover' (1200px), 'logo' (96px), 'mini' (120px)
 */
export function cld(
  url: string | null | undefined,
  preset: 'thumb' | 'card' | 'detail' | 'cover' | 'logo' | 'mini'
): string {
  if (!url) return '';
  if (!url.includes('res.cloudinary.com')) return url;

  const widths = { thumb: 400, card: 600, detail: 900, cover: 1200, logo: 96, mini: 120 };
  const w = widths[preset];
  const transforms = `w_${w},q_auto,f_auto`;

  // Evitar aplicar doble transformación
  if (url.includes('/upload/w_')) return url;
  return url.replace('/upload/', `/upload/${transforms}/`);
}

export interface UploadResult {
  url: string;
  publicId: string;
  width: number;
  height: number;
  format: string;
}

export interface UploadOptions {
  folder?: string;
}

/**
 * Sube una imagen a Cloudinary a través de la API route segura
 */
export async function uploadImage(
  file: File,
  options: UploadOptions = {}
): Promise<UploadResult> {
  const formData = new FormData();
  formData.append("file", file);

  if (options.folder) {
    formData.append("folder", options.folder);
  }

  const response = await fetch("/api/upload", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Error al subir la imagen");
  }

  return response.json();
}

/**
 * Genera una URL optimizada de Cloudinary con transformaciones
 */
export function getOptimizedUrl(
  publicId: string,
  options: {
    width?: number;
    height?: number;
    quality?: "auto" | number;
    format?: "auto" | "webp" | "jpg" | "png";
    crop?: "fill" | "fit" | "scale" | "thumb";
  } = {}
): string {
  const {
    width,
    height,
    quality = "auto",
    format = "auto",
    crop = "fill",
  } = options;

  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const transforms: string[] = [`q_${quality}`, `f_${format}`];

  if (width) transforms.push(`w_${width}`);
  if (height) transforms.push(`h_${height}`);
  if ((width || height) && crop) transforms.push(`c_${crop}`);

  return `https://res.cloudinary.com/${cloudName}/image/upload/${transforms.join(",")}/${publicId}`;
}
