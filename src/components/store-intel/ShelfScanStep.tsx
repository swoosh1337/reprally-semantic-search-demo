import { useCallback, useRef } from "react";
import { Camera, Upload, X, ImageIcon } from "lucide-react";

const MAX_IMAGES = 10;
const MAX_DIMENSION = 1024;

interface ShelfScanStepProps {
  images: string[]; // base64 data URIs
  onChange: (images: string[]) => void;
}

/** Resize image to max dimension and compress as JPEG */
function resizeImage(dataUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
        const scale = MAX_DIMENSION / Math.max(width, height);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL("image/jpeg", 0.7));
    };
    img.src = dataUrl;
  });
}

export function ShelfScanStep({ images, onChange }: ShelfScanStepProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!files) return;
      const remaining = MAX_IMAGES - images.length;
      const toProcess = Array.from(files).slice(0, remaining);

      const newImages: string[] = [];
      for (const file of toProcess) {
        const dataUrl = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });
        const resized = await resizeImage(dataUrl);
        newImages.push(resized);
      }

      onChange([...images, ...newImages]);
    },
    [images, onChange],
  );

  const removeImage = useCallback(
    (index: number) => {
      onChange(images.filter((_, i) => i !== index));
    },
    [images, onChange],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles],
  );

  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--text-muted)]">
        Upload photos of the store shelves. Our AI will analyze what&apos;s in
        stock and recommend products to fill the gaps.
      </p>

      {/* Upload zone */}
      {images.length < MAX_IMAGES && (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          className="border-2 border-dashed border-[var(--border)] rounded-xl p-8 text-center hover:border-[var(--accent)] transition-colors cursor-pointer"
          onClick={() => fileInputRef.current?.click()}
        >
          <div className="flex flex-col items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-[var(--accent-soft)] flex items-center justify-center">
              <Upload className="w-5 h-5 text-[var(--accent)]" />
            </div>
            <div>
              <p className="text-sm font-medium text-[var(--text)]">
                Drop shelf photos here
              </p>
              <p className="text-xs text-[var(--text-muted)] mt-1">
                or click to browse &middot; up to {MAX_IMAGES - images.length}{" "}
                more
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  fileInputRef.current?.click();
                }}
                className="px-3 py-1.5 rounded-lg bg-[var(--accent)] text-white text-xs font-medium hover:bg-[var(--accent-hover)] transition-colors inline-flex items-center gap-1.5"
              >
                <Camera className="w-3.5 h-3.5" />
                Take Photo
              </button>
            </div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
        </div>
      )}

      {/* Image count */}
      {images.length > 0 && (
        <p className="text-xs text-[var(--text-muted)]">
          {images.length} of {MAX_IMAGES} photos added
        </p>
      )}

      {/* Thumbnails */}
      {images.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
          {images.map((img, i) => (
            <div key={i} className="relative group aspect-square">
              <img
                src={img}
                alt={`Shelf photo ${i + 1}`}
                className="w-full h-full object-cover rounded-lg border border-[var(--border)]"
              />
              <button
                onClick={() => removeImage(i)}
                className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="w-3 h-3" />
              </button>
              <span className="absolute bottom-1 left-1 text-[10px] font-medium bg-black/50 text-white px-1.5 py-0.5 rounded">
                {i + 1}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {images.length === 0 && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-[var(--bg)] border border-[var(--border-subtle)]">
          <ImageIcon className="w-4 h-4 text-[var(--text-muted)]" />
          <p className="text-xs text-[var(--text-muted)]">
            No photos yet. You can skip this step and get recommendations based
            on your store profile, or add photos for shelf-aware suggestions.
          </p>
        </div>
      )}
    </div>
  );
}
