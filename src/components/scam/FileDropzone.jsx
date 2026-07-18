import React, { useState, useRef } from "react";
import { Upload, X, FileCheck2 } from "lucide-react";
import { cn } from "@/lib/utils";

const MAX_SIZE = 10 * 1024 * 1024;

export default function FileDropzone({ onFileSelect, accept = "image/*", label, sublabel }) {
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef(null);

  const processFile = (file) => {
    if (!file) return;
    if (file.size > MAX_SIZE) { setError("File too large (max 10MB)"); return; }
    const reader = new FileReader();
    reader.onload = (e) => { onFileSelect(e.target.result, file.name); setFileName(file.name); setError(""); };
    reader.onerror = () => setError("Could not read file");
    reader.readAsDataURL(file);
  };

  const clear = () => {
    setFileName(""); setError(""); onFileSelect(null, "");
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className="space-y-2">
      {!fileName ? (
        <div
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files[0]) processFile(e.dataTransfer.files[0]); }}
          className={cn(
            "border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all",
            dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/50"
          )}
        >
          <Upload className="w-7 h-7 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm font-medium">{label || "Drag & drop or click to upload"}</p>
          {sublabel && <p className="text-xs text-muted-foreground mt-1">{sublabel}</p>}
          <input ref={inputRef} type="file" accept={accept} className="hidden" onChange={(e) => e.target.files[0] && processFile(e.target.files[0])} />
        </div>
      ) : (
        <div className="flex items-center justify-between gap-3 p-3 bg-primary/5 border border-primary/20 rounded-xl">
          <div className="flex items-center gap-2 min-w-0">
            <FileCheck2 className="w-4 h-4 text-primary flex-shrink-0" />
            <span className="text-sm font-medium truncate">{fileName}</span>
          </div>
          <button onClick={clear} className="text-muted-foreground hover:text-destructive flex-shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}