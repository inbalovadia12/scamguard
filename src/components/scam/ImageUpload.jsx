import React, { useRef } from "react";
import { ImagePlus } from "lucide-react";

export default function ImageUpload({ onImageSelected, disabled }) {
  const inputRef = useRef(null);

  return (
    <>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={disabled}
        className="flex items-center justify-center w-9 h-9 rounded-xl text-muted-foreground hover:bg-muted transition-colors disabled:opacity-50 flex-shrink-0"
      >
        <ImagePlus className="w-4 h-4" />
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          onImageSelected?.(e.target.files?.[0] || null);
          e.target.value = "";
        }}
      />
    </>
  );
}