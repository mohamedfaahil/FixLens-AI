/**
 * FixLens AI — Client-Side Image Processing & Compression Utilities
 *
 * Ensures campus defect photos are properly resized and compressed before
 * storage or transmission, guaranteeing sharp visual detail while keeping payload
 * sizes small (~80-150KB) and eliminating dead blob URL errors.
 */

export interface ProcessedImageResult {
  file: File;
  dataUrl: string;
  sizeBytes: number;
  width: number;
  height: number;
}

/**
 * Checks if a string is a self-contained Base64 Data URL.
 */
export function isDataUrl(url?: string | null): boolean {
  if (!url) return false;
  return url.startsWith("data:image/");
}

/**
 * Checks if a string is a transient browser Blob URL (valid only in origin session).
 */
export function isBlobUrl(url?: string | null): boolean {
  if (!url) return false;
  return url.startsWith("blob:");
}

/**
 * Compresses an image file or blob to a high-quality JPEG Data URL and File.
 * Resizes large camera photos (e.g. 4000x3000 from mobile phones) to max 1280px dimension,
 * producing a sharp, lightweight image (~70KB - 160KB) that renders instantly on all devices.
 */
export async function compressImage(
  fileOrBlob: File | Blob,
  maxDimension = 1280,
  quality = 0.78,
): Promise<ProcessedImageResult> {
  return new Promise((resolve, reject) => {
    // Check if in SSR / headless environment without DOM Image
    if (typeof window === "undefined" || typeof Image === "undefined") {
      const defaultName = fileOrBlob instanceof File ? fileOrBlob.name : "captured_photo.jpg";
      const file = fileOrBlob instanceof File ? fileOrBlob : new File([fileOrBlob], defaultName, { type: "image/jpeg" });
      resolve({
        file,
        dataUrl: "",
        sizeBytes: file.size,
        width: 800,
        height: 600,
      });
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Unable to read image file."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Failed to decode image data."));
      img.onload = () => {
        let width = img.naturalWidth || img.width;
        let height = img.naturalHeight || img.height;

        // Downscale proportionally if larger than maximum dimension
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");

        if (!ctx) {
          const rawData = reader.result as string;
          const fileName = fileOrBlob instanceof File ? fileOrBlob.name : "photo.jpg";
          resolve({
            file: fileOrBlob instanceof File ? fileOrBlob : dataUrlToFile(rawData, fileName),
            dataUrl: rawData,
            sizeBytes: fileOrBlob.size,
            width,
            height,
          });
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL("image/jpeg", quality);

        const originalName = fileOrBlob instanceof File ? fileOrBlob.name : "camera_capture.jpg";
        const sanitizedBase = originalName.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9_-]/g, "_");
        const finalName = `${sanitizedBase || "defect_photo"}.jpg`;

        const compressedFile = dataUrlToFile(dataUrl, finalName);

        resolve({
          file: compressedFile,
          dataUrl,
          sizeBytes: compressedFile.size,
          width,
          height,
        });
      };

      img.src = reader.result as string;
    };

    reader.readAsDataURL(fileOrBlob);
  });
}

/**
 * Reconstructs a standard File object from a base64 Data URL.
 */
export function dataUrlToFile(dataUrl: string, filename = "captured_photo.jpg"): File {
  const parts = dataUrl.split(",");
  const mime = parts[0]?.match(/:(.*?);/)?.[1] || "image/jpeg";
  const bstr = atob(parts[1] || "");
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new File([u8arr], filename, { type: mime });
}

/**
 * Formats byte size into human readable string (e.g. "124 KB").
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
