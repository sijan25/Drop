"use client";

import { useState, useCallback } from "react";
import { uploadImage, type UploadResult, type UploadOptions } from "@/lib/cloudinary/client";

interface UploadState {
  isUploading: boolean;
  progress: number;
  result: UploadResult | null;
  error: string | null;
}

interface UseUploadReturn extends UploadState {
  upload: (file: File, options?: UploadOptions) => Promise<UploadResult | null>;
  reset: () => void;
}

export function useUpload(): UseUploadReturn {
  const [state, setState] = useState<UploadState>({
    isUploading: false,
    progress: 0,
    result: null,
    error: null,
  });

  const upload = useCallback(
    async (file: File, options?: UploadOptions): Promise<UploadResult | null> => {
      setState({ isUploading: true, progress: 0, result: null, error: null });

      // Simular progreso mientras sube (Cloudinary no da progreso real en fetch simple)
      const progressInterval = setInterval(() => {
        setState((prev) => ({
          ...prev,
          progress: Math.min(prev.progress + 10, 85),
        }));
      }, 150);

      try {
        const result = await uploadImage(file, options);
        clearInterval(progressInterval);
        setState({ isUploading: false, progress: 100, result, error: null });
        return result;
      } catch (err) {
        clearInterval(progressInterval);
        const message = err instanceof Error ? err.message : "Error al subir la imagen";
        setState({ isUploading: false, progress: 0, result: null, error: message });
        return null;
      }
    },
    []
  );

  const reset = useCallback(() => {
    setState({ isUploading: false, progress: 0, result: null, error: null });
  }, []);

  return { ...state, upload, reset };
}
