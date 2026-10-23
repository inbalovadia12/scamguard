import React, { useRef, useState } from "react";
import { Upload, X, FileCheck2, Loader2, ScanLine, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { DOCUMENT_TYPES } from "@/components/fineprint/riskLevels";
import { cn } from "@/lib/utils";

const MAX_SIZE = 15 * 1024 * 1024;

export default function DocumentInput({
  text,
  onTextChange,
  file,
  onFileChange,
  documentType,
  onDocumentTypeChange,
  onScan,
  scanning,
}) {
  const inputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);
  const [fileError, setFileError] = useState("");

  const pickFile = (selected) => {
    if (!selected) return;
    if (selected.size > MAX_SIZE) {
      setFileError("That file is too large. Please keep it under 15MB.");
      return;
    }
    setFileError("");
    onFileChange(selected);
  };

  return (
    <div className="bg-card rounded-3xl border border-border/50 shadow-sm p-4 sm:p-6 space-y-5">
      <div>
        <label className="text-sm font-medium mb-2 block">Paste the document text</label>
        <Textarea
          value={text}
          onChange={(e) => onTextChange(e.target.value)}
          placeholder="Paste your contract, lease, subscription terms, gym agreement or bill here…"
          className="text-base rounded-xl min-h-[140px] resize-y"
        />
      </div>

      <div className="flex items-center gap-3">
        <div className="h-px bg-border flex-1" />
        <span className="text-xs text-muted-foreground">or</span>
        <div className="h-px bg-border flex-1" />
      </div>

      <div>
        <label className="text-sm font-medium mb-2 block">Upload the document</label>
        {!file ? (
          <div
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); pickFile(e.dataTransfer.files?.[0]); }}
            className={cn(
              "border-2 border-dashed rounded-2xl p-6 sm:p-8 text-center cursor-pointer transition-all",
              dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/50"
            )}
          >
            <Upload className="w-7 h-7 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm font-medium">Drag &amp; drop, or click to upload</p>
            <p className="text-xs text-muted-foreground mt-1">PDF, photo of a document, or a text file (max 15MB)</p>
            <input
              ref={inputRef}
              type="file"
              accept=".pdf,.txt,.md,application/pdf,text/plain,image/*"
              className="hidden"
              onChange={(e) => pickFile(e.target.files?.[0])}
            />
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3 p-3 bg-primary/5 border border-primary/20 rounded-xl">
            <div className="flex items-center gap-2 min-w-0">
              <FileCheck2 className="w-4 h-4 text-primary flex-shrink-0" />
              <span className="text-sm font-medium truncate">{file.name}</span>
            </div>
            <button
              type="button"
              onClick={() => { onFileChange(null); setFileError(""); if (inputRef.current) inputRef.current.value = ""; }}
              className="text-muted-foreground hover:text-destructive flex-shrink-0"
              aria-label="Remove file"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        {fileError && <p className="text-xs text-destructive mt-2">{fileError}</p>}
      </div>

      <div>
        <label className="text-sm font-medium mb-2 block" htmlFor="document-type">
          What type of document is this? <span className="text-muted-foreground font-normal">(optional)</span>
        </label>
        <select
          id="document-type"
          value={documentType}
          onChange={(e) => onDocumentTypeChange(e.target.value)}
          className="w-full h-11 rounded-xl border border-input bg-card px-3 text-base focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {DOCUMENT_TYPES.map((type) => (
            <option key={type.value} value={type.value}>{type.label}</option>
          ))}
        </select>
      </div>

      <Button
        onClick={onScan}
        disabled={scanning}
        className="w-full h-12 text-base font-semibold rounded-xl bg-gradient-to-r from-primary to-primary/80 shadow-md shadow-primary/20 gap-2"
      >
        {scanning ? <Loader2 className="w-5 h-5 animate-spin" /> : <ScanLine className="w-5 h-5" />}
        {scanning ? "Reading the fine print…" : "Scan Document"}
      </Button>

      <p className="text-xs text-muted-foreground flex items-start gap-1.5">
        <Lock className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
        Your documents are only used to generate your report.
      </p>
    </div>
  );
}