import { NextRequest, NextResponse } from "next/server";
import { uploadToCloudinary } from "@/lib/cloudinary/server";
import { checkRequestRateLimit, requireTrustedRequestOrigin } from "@/lib/security/request";
import { createClient } from "@/lib/supabase/server";

// Tipos de imagen permitidos
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_SIZE_MB = 5;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;
const PUBLIC_FOLDERS = new Set(["fardodrops/comprobantes"]);
const AUTH_FOLDERS = new Set([
  "fardodrops",
  "fardodrops/covers",
  "fardodrops/logos",
  "fardodrops/portadas",
  "fardodrops/prendas",
]);

function fileSignatureMatches(buffer: Buffer, type: string) {
  if (type === "image/jpeg") {
    return buffer.length > 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }

  if (type === "image/png") {
    return buffer.length > 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  }

  if (type === "image/webp") {
    return buffer.length > 12 && buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP";
  }

  if (type === "image/gif") {
    const signature = buffer.subarray(0, 6).toString("ascii");
    return signature === "GIF87a" || signature === "GIF89a";
  }

  return false;
}

export async function POST(request: NextRequest) {
  try {
    const originError = requireTrustedRequestOrigin(request);
    if (originError) {
      return NextResponse.json({ message: originError }, { status: 403 });
    }

    const rateLimitError = await checkRequestRateLimit(request, "upload:image", 40, 10 * 60);
    if (rateLimitError) {
      return NextResponse.json({ message: rateLimitError }, { status: 429 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const folder = (formData.get("folder") as string) || "fardodrops";
    const isPublicFolder = PUBLIC_FOLDERS.has(folder);
    const isAuthFolder = AUTH_FOLDERS.has(folder);

    if (!isPublicFolder && !isAuthFolder) {
      return NextResponse.json(
        { message: "Carpeta de subida no permitida" },
        { status: 400 }
      );
    }

    if (isAuthFolder) {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return NextResponse.json(
          { message: "No autorizado" },
          { status: 401 }
        );
      }
    }

    // Validaciones
    if (!file) {
      return NextResponse.json(
        { message: "No se proporcionó ningún archivo" },
        { status: 400 }
      );
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        {
          message: `Tipo de archivo no permitido. Solo se aceptan: ${ALLOWED_TYPES.join(", ")}`,
        },
        { status: 400 }
      );
    }

    if (file.size > MAX_SIZE_BYTES) {
      return NextResponse.json(
        { message: `El archivo no puede superar los ${MAX_SIZE_MB}MB` },
        { status: 400 }
      );
    }

    // Convertir a Buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    if (!fileSignatureMatches(buffer, file.type)) {
      return NextResponse.json(
        { message: "El archivo no parece ser una imagen válida" },
        { status: 400 }
      );
    }

    // Subir a Cloudinary
    const result = await uploadToCloudinary(buffer, folder);

    return NextResponse.json({
      url: result.secure_url,
      publicId: result.public_id,
      width: result.width,
      height: result.height,
      format: result.format,
    });
  } catch (error) {
    console.error("[API/UPLOAD] Error:", error);
    return NextResponse.json(
      { message: "Error interno al procesar la imagen" },
      { status: 500 }
    );
  }
}
