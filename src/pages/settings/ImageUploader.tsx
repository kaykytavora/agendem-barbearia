import { Button } from "@/components/ui/button";
import { Upload, RefreshCw, Trash2 } from "lucide-react";
import { LazyImage } from "@/components/LazyImage";

// Helper component for image upload UI
export const ImageUploader = ({ type, imageUrl, isUploading, onUpload, onRemove }: {
  type: 'logo' | 'gallery';
  imageUrl: string | null;
  isUploading: boolean;
  onUpload: (file: File) => void;
  onRemove: () => void;
}) => {
  const isLogo = type === 'logo';
  const id = `upload-input-${type}`;

  return (
    <div className={`relative border-2 border-dashed border-border/50 rounded-xl flex items-center justify-center
      ${isLogo ? 'w-32 h-32' : 'aspect-video'}`}>
      {imageUrl && (
        <LazyImage
          src={imageUrl}
          alt={type}
          className="w-full h-full rounded-lg"
        />
      )}
      {!imageUrl && (
        <div className="text-center text-muted-foreground p-2">
          <Upload className="w-6 h-6 mx-auto mb-2" />
          <p className="text-xs">Clique ou arraste para enviar</p>
        </div>
      )}
      {imageUrl && !isUploading && (
        <Button
          type="button"
          variant="destructive"
          size="icon"
          className="absolute top-1 right-1 w-7 h-7 bg-red-600/80 hover:bg-red-600 z-10"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onRemove();
          }}
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      )}
      {isUploading && (
        <div className="absolute inset-0 bg-black/60 flex items-center justify-center rounded-xl">
          <RefreshCw className="w-6 h-6 text-white animate-spin" />
        </div>
      )}
      <input
        type="file"
        id={id}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        accept="image/png, image/jpeg, image/webp"
        onChange={(e) => {
          if (e.target.files && e.target.files[0]) {
            onUpload(e.target.files[0]);
          }
        }}
        disabled={isUploading}
      />
    </div>
  );
};