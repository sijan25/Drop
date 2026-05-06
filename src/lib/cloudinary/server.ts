// Cloudinary server-side helper (solo usar en Server Components o API routes)
import crypto from "crypto";

const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME!;
const API_KEY = process.env.CLOUDINARY_API_KEY!;
const API_SECRET = process.env.CLOUDINARY_API_SECRET!;

export interface CloudinaryUploadResponse {
  public_id: string;
  secure_url: string;
  width: number;
  height: number;
  format: string;
  resource_type: string;
}

/**
 * Genera la firma necesaria para uploads autenticados
 */
function generateSignature(params: Record<string, string>): string {
  const sortedParams = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&");

  return crypto
    .createHash("sha256")
    .update(sortedParams + API_SECRET)
    .digest("hex");
}

/**
 * Sube un archivo a Cloudinary desde el servidor
 * @param file - Buffer o base64 del archivo
 * @param folder - Carpeta destino en Cloudinary (ej: "fardodrops/productos")
 */
export async function uploadToCloudinary(
  file: Buffer | string,
  folder = "fardodrops"
): Promise<CloudinaryUploadResponse> {
  const timestamp = Math.round(Date.now() / 1000).toString();

  // Transformaciones por carpeta: prendas/portadas → 1200px, logos → 400px, comprobantes sin resize
  const isComprobante = folder.includes("comprobantes");
  const isLogo = folder.includes("logos");
  const transformation = isComprobante
    ? "q_auto:good,f_auto"
    : isLogo
    ? "w_400,h_400,c_limit,q_auto:good,f_auto"
    : "w_1200,c_limit,q_auto:good,f_auto";

  const params: Record<string, string> = {
    folder,
    timestamp,
    transformation,
  };

  const signature = generateSignature(params);

  const formData = new FormData();

  if (Buffer.isBuffer(file)) {
    const arrayBuffer = new ArrayBuffer(file.byteLength);
    new Uint8Array(arrayBuffer).set(file);
    const blob = new Blob([arrayBuffer]);
    formData.append("file", blob);
  } else {
    formData.append("file", file);
  }

  formData.append("api_key", API_KEY);
  formData.append("timestamp", timestamp);
  formData.append("folder", folder);
  formData.append("transformation", transformation);
  formData.append("signature", signature);

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
    {
      method: "POST",
      body: formData,
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || "Error al subir a Cloudinary");
  }

  return response.json();
}

/**
 * Elimina una imagen de Cloudinary por su public_id
 */
export async function deleteFromCloudinary(publicId: string): Promise<void> {
  const timestamp = Math.round(Date.now() / 1000).toString();

  const params: Record<string, string> = {
    public_id: publicId,
    timestamp,
  };

  const signature = generateSignature(params);

  const formData = new FormData();
  formData.append("public_id", publicId);
  formData.append("api_key", API_KEY);
  formData.append("timestamp", timestamp);
  formData.append("signature", signature);

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/destroy`,
    {
      method: "POST",
      body: formData,
    }
  );

  if (!response.ok) {
    throw new Error("Error al eliminar la imagen de Cloudinary");
  }
}
