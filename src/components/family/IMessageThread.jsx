import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { ArrowLeft, Send, Loader2, Image as ImageIcon } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import ImageLightbox from "@/components/family/ImageLightbox";

// iMessage-style conversation thread between a guardian and a protected member.
// Either memberId (find-or-create thread) or threadId (existing thread) is required.
function formatTime(iso) {
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

export default function IMessageThread({ memberId, threadId, contactName, contactEmail, onBack, onSent }) {
  const [me, setMe] = useState(null);
  const [thread, setThread] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [zoomImage, setZoomImage] = useState(null);
  const threadRef = useRef(null);
  const endRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const user = await base44.auth.me();
        if (!active) return;
        setMe(user);

        let t = null;
        if (threadId) {
          try { t = await base44.entities.FamilyChat.get(threadId); } catch {}
        } else if (memberId) {
          const existing = await base44.entities.FamilyChat.filter({ member_id: memberId });
          t = existing[0];
        }
        if (!active) return;
        threadRef.current = t;
        setThread(t);

        if (t) {
          const msgs = await base44.entities.FamilyChatMessage.filter({ thread_id: t.id }, "created_date", 200);
          if (active) setMessages(msgs);
          const unreadField = t.guardian_id === user.id ? "unread_by_guardian" : "unread_by_senior";
          if (t[unreadField] > 0) {
            base44.entities.FamilyChat.update(t.id, { [unreadField]: 0 }).catch(() => {});
          }
        }
      } catch {}
      if (active) setLoading(false);
    };
    load();

    const unsub = base44.entities.FamilyChatMessage.subscribe((event) => {
      const t = threadRef.current;
      if (!t || event.type !== "create") return;
      if (event.data?.thread_id !== t.id) return;
      setMessages((prev) => (prev.some((m) => m.id === event.data.id) ? prev : [...prev, event.data]));
    });

    return () => { active = false; try { unsub?.(); } catch {} };
  }, [memberId, threadId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendImage = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const up = await base44.integrations.Core.UploadPublicFile({ file });
      const file_url = up?.file_url || up?.data?.file_url;
      if (!file_url) throw new Error("Upload failed");
      const res = await base44.functions.invoke("sendFamilyChatMessage", {
        member_id: memberId,
        thread_id: thread?.id,
        text: "",
        image_url: file_url,
        kind: "message",
      });
      const data = res?.data || res;
      if (data?.message) {
        setMessages((prev) => (prev.some((m) => m.id === data.message.id) ? prev : [...prev, data.message]));
      }
      if (data?.thread_id && !thread) {
        try {
          const t = await base44.entities.FamilyChat.get(data.thread_id);
          threadRef.current = t;
          setThread(t);
        } catch {}
      }
      onSent?.();
    } catch (e) {
      toast({ title: "Couldn't send image", description: e.message || "Please try again.", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const send = async () => {
    const msg = text.trim();
    if (!msg) return;
    setSending(true);
    try {
      const res = await base44.functions.invoke("sendFamilyChatMessage", {
        member_id: memberId,
        thread_id: thread?.id,
        text: msg,
        kind: "message",
      });
      const data = res?.data || res;
      if (data?.message) {
        setMessages((prev) => (prev.some((m) => m.id === data.message.id) ? prev : [...prev, data.message]));
      }
      if (data?.thread_id && !thread) {
        try {
          const t = await base44.entities.FamilyChat.get(data.thread_id);
          threadRef.current = t;
          setThread(t);
        } catch {}
      }
      setText("");
      onSent?.();
    } catch (e) {
      toast({ title: "Couldn't send", description: e.message || "Please try again.", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const initials = (contactName || "?").split(" ").map((p) => p[0]).slice(0, 2).join("");

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border/50 bg-card/80 backdrop-blur-sm flex-shrink-0">
        {onBack && (
          <button onClick={onBack} className="md:hidden p-1 -ml-1 text-primary hover:opacity-70" aria-label="Back">
            <ArrowLeft className="w-5 h-5" />
          </button>
        )}
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center text-primary-foreground font-semibold text-sm flex-shrink-0">
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-sm truncate">{contactName || "Family member"}</p>
          {contactEmail && <p className="text-xs text-muted-foreground truncate">{contactEmail}</p>}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 bg-secondary/40 min-h-0">
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center text-sm text-muted-foreground py-12">
            <p className="font-medium text-foreground/80">No messages yet</p>
            <p className="mt-1">Say hello 👋</p>
          </div>
        ) : (
          <div className="space-y-0.5">
            {messages.map((m, i) => {
              const mine = m.sender_id === me?.id;
              const prev = messages[i - 1];
              const gap = !prev || new Date(m.created_date).getTime() - new Date(prev.created_date).getTime() > 5 * 60 * 1000;
              const sameSender = prev && prev.sender_id === m.sender_id && !gap;
              return (
                <React.Fragment key={m.id}>
                  {gap && (
                    <div className="text-center text-[11px] font-medium text-muted-foreground/70 my-3">
                      {formatTime(m.created_date)}
                    </div>
                  )}
                  <div className={`flex ${mine ? "justify-end" : "justify-start"} ${sameSender ? "mt-0.5" : "mt-2"}`}>
                    <div
                      className={`max-w-[78%] overflow-hidden shadow-sm ${
                        m.kind === "warning"
                          ? "bg-destructive/10 text-foreground rounded-2xl border border-destructive/20"
                          : m.kind === "assurance"
                          ? "bg-success/10 text-foreground rounded-2xl border border-success/20"
                          : mine
                          ? "bg-primary text-primary-foreground rounded-2xl rounded-br-md"
                          : "bg-card text-foreground rounded-2xl rounded-bl-md border border-border/60"
                      } ${m.image_url ? "p-1" : "px-3.5 py-2"} text-[15px] leading-snug whitespace-pre-wrap break-words`}
                    >
                      {m.image_url && (
                        <img
                          src={m.image_url}
                          alt="Shared image"
                          className="rounded-xl max-w-full max-h-72 object-cover w-auto block cursor-zoom-in"
                          loading="lazy"
                          onDoubleClick={() => setZoomImage(m.image_url)}
                        />
                      )}
                      {m.text && <div className={m.image_url ? "px-2.5 py-1.5" : ""}>{m.text}</div>}
                    </div>
                  </div>
                </React.Fragment>
              );
            })}
            <div ref={endRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <div className="px-3 py-3 border-t border-border/50 bg-card/80 backdrop-blur-sm flex-shrink-0">
        <div className="flex items-end gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) sendImage(f);
              e.target.value = "";
            }}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading || sending}
            className="w-10 h-10 rounded-full bg-muted text-foreground flex items-center justify-center disabled:opacity-40 flex-shrink-0 transition-opacity hover:bg-muted/70"
            aria-label="Send image"
          >
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-5 h-5" />}
          </button>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Message"
            rows={1}
            maxLength={2000}
            className="flex-1 resize-none rounded-full border border-border bg-background px-4 py-2.5 text-[15px] focus:outline-none focus:ring-2 focus:ring-primary/30 max-h-32"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
          />
          <button
            onClick={send}
            disabled={sending || !text.trim()}
            className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-40 flex-shrink-0 transition-opacity hover:opacity-90"
            aria-label="Send"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
      </div>

      <ImageLightbox src={zoomImage} alt="Shared image" onClose={() => setZoomImage(null)} />
    </div>
  );
}