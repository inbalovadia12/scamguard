import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Send, Image as ImageIcon } from "lucide-react";
import { toast } from "@/components/ui/use-toast";

// A conversation thread between a guardian and a protected senior.
// Either memberId (find-or-create thread) or threadId (existing thread) is required.
export default function ChatThread({ memberId, threadId, onSent }) {
  const [me, setMe] = useState(null);
  const [thread, setThread] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const threadRef = useRef(null);
  const endRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
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
      if (active) setLoading(false);
    };
    load();

    const unsub = base44.entities.FamilyChatMessage.subscribe((event) => {
      const t = threadRef.current;
      if (!t || event.type !== "create") return;
      if (event.data?.thread_id !== t.id) return;
      setMessages((prev) => (prev.some((m) => m.id === event.data.id) ? prev : [...prev, event.data]));
    });

    return () => { active = false; unsub(); };
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[55vh] min-h-[380px]">
      <div className="flex-1 overflow-y-auto space-y-3 pr-1">
        {messages.length === 0 ? (
          <div className="text-center text-sm text-muted-foreground py-10">
            No messages yet. Say hello 👋
          </div>
        ) : (
          messages.map((m) => {
            const mine = m.sender_id === me?.id;
            return (
              <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[80%] overflow-hidden rounded-2xl ${m.image_url ? "p-1" : "px-3.5 py-2.5"} text-sm whitespace-pre-wrap break-words ${
                    m.kind === "warning"
                      ? "bg-destructive/10 border border-destructive/30 text-foreground"
                      : m.kind === "assurance"
                      ? "bg-success/10 border border-success/30 text-foreground"
                      : mine
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-foreground"
                  }`}
                >
                  {m.image_url && (
                    <img src={m.image_url} alt="Shared image" className="rounded-xl max-w-full max-h-72 object-cover w-auto block" loading="lazy" />
                  )}
                  {m.text && <div className={m.image_url ? "px-2.5 py-1.5" : ""}>{m.text}</div>}
                </div>
              </div>
            );
          })
        )}
        <div ref={endRef} />
      </div>
      <div className="flex gap-2 pt-3 border-t border-border/40 mt-2 items-end">
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
        <Button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading || sending}
          size="icon"
          variant="outline"
          className="h-11 w-11 flex-shrink-0"
          aria-label="Send image"
        >
          {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
        </Button>
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type a message..."
          rows={1}
          maxLength={2000}
          className="resize-none min-h-[44px] flex-1"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
        />
        <Button onClick={send} disabled={sending || !text.trim()} size="icon" className="h-11 w-11 flex-shrink-0">
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </Button>
      </div>
    </div>
  );
}