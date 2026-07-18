import React from "react";
import { FileText, Globe, Camera, QrCode, Mail, MessageSquare, ShoppingCart, File as FileIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export const SCAN_TYPES = [
  { value: "page", label: "Page Text", icon: FileText, cost: 8, inputType: "textarea" },
  { value: "url", label: "URL", icon: Globe, cost: 12, inputType: "url" },
  { value: "screenshot", label: "Screenshot", icon: Camera, cost: 8, inputType: "image" },
  { value: "qr", label: "QR Code", icon: QrCode, cost: 10, inputType: "image" },
  { value: "email", label: "Email", icon: Mail, cost: 8, inputType: "textarea" },
  { value: "chat", label: "Chat / SMS", icon: MessageSquare, cost: 8, inputType: "textarea" },
  { value: "marketplace", label: "Marketplace", icon: ShoppingCart, cost: 8, inputType: "textarea" },
  { value: "file", label: "File", icon: FileIcon, cost: 12, inputType: "file" },
];

export const ANSWER_TYPES = [
  { value: "quick", label: "Quick Verdict" },
  { value: "detailed", label: "Detailed Report" },
  { value: "risk_score", label: "Risk Score" },
  { value: "red_flags", label: "Red Flags" },
];

export default function ScanTypeGrid({ value, onChange }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
      {SCAN_TYPES.map((type) => (
        <button
          key={type.value}
          onClick={() => onChange(type.value)}
          className={cn(
            "flex flex-col items-center gap-1.5 p-3 rounded-2xl border transition-all text-center",
            value === type.value
              ? "border-primary bg-primary/10 text-primary"
              : "border-border bg-card hover:border-primary/30 hover:bg-muted/50"
          )}
        >
          <type.icon className="w-5 h-5" />
          <span className="text-xs font-medium">{type.label}</span>
          <span className="text-[10px] text-muted-foreground">{type.cost} cr</span>
        </button>
      ))}
    </div>
  );
}