import { useEffect, useRef, useState, useCallback } from "react";
import { Camera, X, RefreshCw, Check, AlertCircle, FlipHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { compressImage } from "@/lib/image-utils";

interface CameraCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (file: File, dataUrl: string) => void;
}

export function CameraCaptureModal({
  isOpen,
  onClose,
  onCapture,
}: CameraCaptureModalProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [capturedDataUrl, setCapturedDataUrl] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false);
  const fileFallbackInputRef = useRef<HTMLInputElement | null>(null);

  // Stop video stream cleanly
  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  // Check available cameras
  useEffect(() => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    navigator.mediaDevices.enumerateDevices().then((devices) => {
      const videoDevices = devices.filter((d) => d.kind === "videoinput");
      setHasMultipleCameras(videoDevices.length > 1);
    }).catch(() => {});
  }, []);

  // Start webcam stream
  const startCamera = useCallback(async (mode: "environment" | "user") => {
    setErrorMsg(null);
    stopStream();

    if (!navigator.mediaDevices?.getUserMedia) {
      setErrorMsg("Camera access is not supported on this browser. You can still upload photos from your device.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: mode },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error && err.name === "NotAllowedError"
          ? "Camera permission was denied. Please allow camera permissions in your browser or select an image file."
          : "Could not open camera stream. You can upload an image from your files instead.";
      setErrorMsg(message);
    }
  }, [stopStream]);

  // Handle open / close lifecycle
  useEffect(() => {
    if (isOpen) {
      setCapturedDataUrl(null);
      setErrorMsg(null);
      startCamera(facingMode);
    } else {
      stopStream();
      setCapturedDataUrl(null);
    }
    return () => {
      stopStream();
    };
  }, [isOpen, facingMode, startCamera, stopStream]);

  // Capture current video frame to canvas
  const handleSnap = () => {
    const video = videoRef.current;
    if (!video) return;

    const width = video.videoWidth || 1280;
    const height = video.videoHeight || 720;

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, width, height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
    setCapturedDataUrl(dataUrl);
    stopStream();
  };

  // Retake photo
  const handleRetake = () => {
    setCapturedDataUrl(null);
    startCamera(facingMode);
  };

  // Confirm photo and compress
  const handleConfirm = async () => {
    if (!capturedDataUrl) return;
    setIsProcessing(true);
    try {
      const result = await compressImage(
        dataUrlToFile(capturedDataUrl, `campus_photo_${Date.now()}.jpg`),
        1280,
        0.78,
      );
      onCapture(result.file, result.dataUrl);
      onClose();
    } catch {
      // Fallback
      const fallbackFile = dataUrlToFile(capturedDataUrl, `campus_photo_${Date.now()}.jpg`);
      onCapture(fallbackFile, capturedDataUrl);
      onClose();
    } finally {
      setIsProcessing(false);
    }
  };

  const toggleCamera = () => {
    const nextMode = facingMode === "environment" ? "user" : "environment";
    setFacingMode(nextMode);
  };

  // Native camera fallback (e.g. mobile system camera picker)
  const handleFallbackFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsProcessing(true);
    try {
      const result = await compressImage(file, 1280, 0.78);
      onCapture(result.file, result.dataUrl);
      onClose();
    } catch {
      onCapture(file, URL.createObjectURL(file));
      onClose();
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-border/80 bg-card shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/60 px-4 py-3 bg-muted/30">
          <div className="flex items-center gap-2">
            <Camera className="size-4.5 text-primary" />
            <h3 className="text-sm font-bold text-foreground">
              {capturedDataUrl ? "Review Captured Photo" : "Take Photo of Campus Issue"}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close camera"
            className="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Viewfinder / Preview Body */}
        <div className="relative aspect-4/3 w-full bg-black flex items-center justify-center overflow-hidden">
          {errorMsg ? (
            <div className="p-6 text-center text-sm space-y-3">
              <AlertCircle className="mx-auto size-8 text-destructive" />
              <p className="text-muted-foreground">{errorMsg}</p>
              <div className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileFallbackInputRef.current?.click()}
                  className="gap-2"
                >
                  <Camera className="size-4" />
                  Use Native Device Camera
                </Button>
                <input
                  ref={fileFallbackInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={handleFallbackFile}
                />
              </div>
            </div>
          ) : capturedDataUrl ? (
            <img
              src={capturedDataUrl}
              alt="Captured frame"
              className="h-full w-full object-contain"
            />
          ) : (
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="h-full w-full object-cover"
              />
              {/* Viewfinder Target Overlay */}
              <div className="pointer-events-none absolute inset-6 rounded-xl border border-dashed border-white/40" />

              {hasMultipleCameras && (
                <button
                  type="button"
                  onClick={toggleCamera}
                  aria-label="Flip camera"
                  className="absolute top-3 right-3 rounded-full bg-black/60 backdrop-blur-md p-2 text-white hover:bg-black/80 transition-colors shadow-lg"
                >
                  <FlipHorizontal className="size-4" />
                </button>
              )}
            </>
          )}
        </div>

        {/* Action Controls */}
        <div className="flex items-center justify-between gap-3 border-t border-border/60 bg-muted/20 px-4 py-3">
          {capturedDataUrl ? (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleRetake}
                disabled={isProcessing}
                className="gap-1.5"
              >
                <RefreshCw className="size-3.5" />
                Retake
              </Button>
              <Button
                type="button"
                variant="default"
                size="sm"
                onClick={handleConfirm}
                disabled={isProcessing}
                className="gap-1.5 font-semibold"
              >
                <Check className="size-3.5" />
                {isProcessing ? "Processing..." : "Use This Photo"}
              </Button>
            </>
          ) : !errorMsg ? (
            <div className="flex w-full items-center justify-center">
              <button
                type="button"
                onClick={handleSnap}
                aria-label="Capture photo"
                className="group relative flex size-14 items-center justify-center rounded-full bg-white text-primary shadow-lg transition-transform active:scale-95 hover:scale-105"
              >
                <span className="size-11 rounded-full border-2 border-primary group-hover:bg-primary/10 transition-colors" />
              </button>
            </div>
          ) : (
            <div className="flex w-full justify-end">
              <Button type="button" variant="outline" size="sm" onClick={onClose}>
                Cancel
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function dataUrlToFile(dataUrl: string, filename: string): File {
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
