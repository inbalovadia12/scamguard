import React, { useState } from "react";
import { Plus, MessageSquare, Trash2, Loader2, Pencil, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ConversationSidebar({ conversations, activeId, onSelect, onNew, onDelete, onRename, loading }) {
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState("");

  const startEdit = (e, conv) => {
    e.stopPropagation();
    setEditingId(conv.id);
    setEditValue(conv.metadata?.name || "New Chat");
  };

  const confirmEdit = (e) => {
    e?.stopPropagation();
    if (editValue.trim() && onRename) {
      onRename(editingId, editValue.trim());
    }
    setEditingId(null);
  };

  const cancelEdit = (e) => {
    e?.stopPropagation();
    setEditingId(null);
  };

  return (
    <div className="w-64 flex-shrink-0 border-r border-border/50 bg-card flex flex-col h-full">
      <div className="p-3">
        <Button onClick={onNew} className="w-full gap-2 bg-gradient-to-r from-primary to-primary/80" size="sm">
          <Plus className="w-4 h-4" />
          New Chat
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-1">
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : conversations.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-8 px-2">No conversations yet</p>
        ) : (
          conversations.map((conv) => (
            <div
              key={conv.id}
              onClick={() => editingId !== conv.id && onSelect(conv.id)}
              className={`group flex items-center gap-2 px-3 py-2.5 rounded-lg cursor-pointer text-sm transition-all ${
                activeId === conv.id
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <MessageSquare className="w-4 h-4 flex-shrink-0" />
              {editingId === conv.id ? (
                <>
                  <input
                    autoFocus
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") confirmEdit(e);
                      if (e.key === "Escape") cancelEdit(e);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="flex-1 min-w-0 bg-background border border-primary/30 rounded px-1.5 py-0.5 text-sm focus:outline-none focus:border-primary"
                  />
                  <button onClick={confirmEdit} className="text-success hover:opacity-80 flex-shrink-0">
                    <Check className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={cancelEdit} className="text-muted-foreground hover:text-destructive flex-shrink-0">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </>
              ) : (
                <>
                  <span className="flex-1 truncate">
                    {conv.metadata?.name || "New Chat"}
                  </span>
                  <button
                    onClick={(e) => startEdit(e, conv)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-primary"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); onDelete(conv.id); }}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}