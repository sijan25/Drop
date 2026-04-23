"use client";

import React, { useCallback, useRef, useState } from "react";
import Image from "next/image";
import { Upload, X, ImageIcon, AlertCircle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useUpload } from "@/hooks/use-upload";
import type { UploadResult } from "@/lib/cloudinary/client";

interface ImageUploadProps {
  /** Carpeta en Cloudinary donde se guardará (ej: "fardodrops/productos") */
  folder?: string;
  /** URL o publicId de imagen existente para mostrar como preview inicial */
  defaultImage?: string;
  /** Callback cuando la imagen se sube exitosamente */
  onUpload?: (result: UploadResult) => void;
  /** Callback cuando se quita la imagen */
  onRemove?: () => void;
  /** Clases adicionales para el contenedor */
  className?: string;
  /** Texto del label */
  label?: string;
  /** Texto de ayuda */
  hint?: string;
}

export function ImageUpload({
  folder = "fardodrops",
  defaultImage,
  onUpload,
  onRemove,
  className,
  label = "Imagen del producto",
  hint = "PNG, JPG o WEBP · Máx. 5MB",
}: ImageUploadProps) {
  const { isUploading, progress, result, error, upload, reset } = useUpload();
  const [preview, setPreview] = useState<string | null>(defaultImage ?? null);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const currentImage = result?.url ?? preview;

  const handleFile = useCallback(
    async (file: File) => {
      // Preview inmediato antes de subir
      const objectUrl = URL.createObjectURL(file);
      setPreview(objectUrl);

      const uploadResult = await upload(file, { folder });
      if (uploadResult) {
        URL.revokeObjectURL(objectUrl);
        onUpload?.(uploadResult);
      }
    },
    [upload, folder, onUpload]
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("image/")) handleFile(file);
  };

  const handleRemove = () => {
    reset();
    setPreview(null);
    if (inputRef.current) inputRef.current.value = "";
    onRemove?.();
  };

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {label && (
        <p className="text-sm font-medium text-foreground">{label}</p>
      )}

      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={cn(
          "relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed transition-all duration-200 overflow-hidden",
          "min-h-[180px] w-full",
          isDragging
            ? "border-primary bg-primary/5 scale-[1.01]"
            : "border-border bg-muted/30 hover:border-primary/50 hover:bg-muted/50",
          currentImage && "border-solid border-border"
        )}
      >
        {/* Preview de imagen */}
        {currentImage && (
          <div className="relative w-full h-full min-h-[180px]">
            <Image
              src={currentImage}
              alt="Preview"
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 400px"
            />
            {/* Overlay oscuro al hacer hover */}
            <div className="absolute inset-0 bg-black/0 hover:bg-black/30 transition-colors duration-200 flex items-center justify-center group">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => inputRef.current?.click()}
              >
                <Upload className="size-3.5" />
                Cambiar
              </Button>
            </div>
            {/* Botón eliminar */}
            <button
              type="button"
              onClick={handleRemove}
              className="absolute top-2 right-2 size-7 rounded-full bg-background/80 backdrop-blur-sm flex items-center justify-center hover:bg-destructive hover:text-white transition-colors shadow-sm"
            >
              <X className="size-3.5" />
            </button>
          </div>
        )}

        {/* Estado vacío */}
        {!currentImage && !isUploading && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex flex-col items-center gap-3 p-8 w-full h-full cursor-pointer"
          >
            <div className="size-12 rounded-full bg-muted flex items-center justify-center">
              <ImageIcon className="size-5 text-muted-foreground" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-foreground">
                Arrastra una imagen o{" "}
                <span className="text-primary underline-offset-2 hover:underline">
                  selecciona archivo
                </span>
              </p>
              {hint && (
                <p className="text-xs text-muted-foreground mt-1">{hint}</p>
              )}
            </div>
          </button>
        )}

        {/* Estado subiendo */}
        {isUploading && (
          <div className="flex flex-col items-center gap-4 p-8 w-full">
            <div className="size-12 rounded-full bg-primary/10 flex items-center justify-center animate-pulse">
              <Upload className="size-5 text-primary" />
            </div>
            <div className="w-full max-w-[200px] flex flex-col gap-2">
              <Progress value={progress} className="h-1.5" />
              <p className="text-xs text-muted-foreground text-center">
                Subiendo... {progress}%
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Mensajes de estado */}
      {error && (
        <div className="flex items-center gap-2 text-destructive text-xs">
          <AlertCircle className="size-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {result && !isUploading && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <CheckCircle2 className="size-3.5 shrink-0 text-green-500" />
          <span>Imagen subida correctamente</span>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={handleInputChange}
      />
    </div>
  );
}
