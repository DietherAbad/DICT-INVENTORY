import { useCallback, useRef, useState } from "react";

const DEFAULT_TYPES = ["image/jpeg", "image/png", "image/webp"];

export const useThumbnailUpload = (options = {}) => {
  const {
    allowedTypes = DEFAULT_TYPES,
    maxOriginalBytes = 5 * 1024 * 1024,
    maxUploadBytes = 600 * 1024,
    maxDimension = 1200,
    quality = 0.75,
  } = options;

  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState("");
  const [error, setError] = useState("");

  const clear = useCallback(
    ({ keepError = false } = {}) => {
      if (preview) {
        URL.revokeObjectURL(preview);
      }
      setPreview("");
      setFile(null);
      if (!keepError) setError("");
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    },
    [preview]
  );

  const compressImage = useCallback(
    (inputFile) =>
      new Promise((resolve, reject) => {
        const img = new Image();
        const src = URL.createObjectURL(inputFile);
        img.onload = () => {
          let { width, height } = img;
          if (width > maxDimension || height > maxDimension) {
            const ratio = Math.min(maxDimension / width, maxDimension / height);
            width = Math.round(width * ratio);
            height = Math.round(height * ratio);
          }
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, width, height);
          canvas.toBlob(
            (blob) => {
              URL.revokeObjectURL(src);
              if (!blob) {
                reject(new Error("Failed to compress image."));
                return;
              }
              resolve(blob);
            },
            "image/jpeg",
            quality
          );
        };
        img.onerror = () => {
          URL.revokeObjectURL(src);
          reject(new Error("Invalid image file."));
        };
        img.src = src;
      }),
    [maxDimension, quality]
  );

  const handleChange = useCallback(
    async (event) => {
      const picked = event.target.files?.[0];
      if (!picked) {
        clear({ keepError: true });
        return;
      }

      if (!allowedTypes.includes(picked.type)) {
        clear();
        setError("Only JPG, PNG, or WebP images are allowed.");
        return;
      }

      if (picked.size > maxOriginalBytes) {
        clear();
        setError("File is too large. Max 5MB.");
        return;
      }

      try {
        const compressedBlob = await compressImage(picked);
        if (compressedBlob.size > maxUploadBytes) {
          clear();
          setError("Compressed image is still too large. Try a smaller photo.");
          return;
        }

        const baseName = picked.name.replace(/\.[^/.]+$/, "") || "thumbnail";
        const compressedFile = new File([compressedBlob], `${baseName}.jpg`, {
          type: compressedBlob.type,
          lastModified: Date.now(),
        });

        if (preview) {
          URL.revokeObjectURL(preview);
        }
        setFile(compressedFile);
        setPreview(URL.createObjectURL(compressedBlob));
        setError("");
      } catch (err) {
        clear();
        setError(err?.message || "Failed to process image.");
      }
    },
    [allowedTypes, clear, compressImage, maxOriginalBytes, maxUploadBytes, preview]
  );

  return {
    file,
    preview,
    error,
    setError,
    inputRef,
    handleChange,
    clear,
  };
};
