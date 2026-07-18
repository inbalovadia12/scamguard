import React from "react";
import { FileText, Globe, Camera, QrCode, Mail, MessageSquare, ShoppingCart, File as FileIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export const SCAN_TYPES = [
  { value: "page", label: "Page Text", icon: FileText, inputType: "textarea" },
  { value: "url", label: "URL", icon: Globe, inputType: "url" },
  { value: "screenshot", label: "Screenshot", icon: Camera, inputType: "image" },
  { value: "qr", label: "QR Code", icon: QrCode, inputType: "image" },
  { value: "email", label: "Email", icon: Mail, inputType: "textarea" },
  { value: "chat", label: "Chat / SMS", icon: MessageSquare, inputType: "textarea" },
  { value: "marketplace", label: "Marketplace", icon: ShoppingCart, inputType: "textarea" },
  { value: "file", label: "File", icon: FileIcon, inputType: "file" },
];

export const ANSWER_TYPES = [
  { value: "quick", label: "Quick Verdict", cost: 3 },
  { value: "detailed", label: "Detailed Report", cost: 8 },
  { value: "risk_score", label: "Risk Score", cost: 4 },
  { value: "red_flags", label: "Red Flags", cost: 5 },
];

export const SCAN_TYPE_MODIFIERS = {
  page: 0, url: 2, screenshot: 2, qr: 2,
  email: 0, chat: 0, marketplace: 0, file: 4,
  text: 0, both: 2,
};

export function getScanCost(scanType, answerType) {
  const answerTypeCost = ANSWER_TYPES.find((a) => a.value === answerType)?.cost || 8;
  const modifier = SCAN_TYPE_MODIFIERS[scanType] || 0;
  return answerTypeCost + modifier;
}

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
        </button>
      ))}
    </div>
  );
}