import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { MessageCircle, Loader2, ArrowLeft } from "lucide-react";
import ChatThread from "@/components/family/ChatThread";

// Lists a guardian's seniors (or a senior's guardians) as chat contacts and
// opens a conversation thread for the selected one.
export default function FamilyChatsPanel({ seniors, memberships }) {
  const [threads, setThreads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState(null);

  const reload = async () => {
    try {
      const user = await base44.auth.me();
      const all = await base44.entities.FamilyChat.list("-last_message_at", 100);
      setThreads(all.filter((t) => t.guardian_id === user.id || t.senior_user_id === user.id));
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    reload();
    const unsub = base44.entities.FamilyChat.subscribe(() => reload());
    return unsub;
  }, []);

  const contacts = [];
  if (seniors && seniors.length > 0) {
    seniors.forEach((s) => {
      if (!s.consent_given || !s.senior_user_id) return;
      const thread = threads.find((t) => t.member_id === s.id);
      contacts.push({
        memberId: s.id,
        name: s.name,
        email: s.email,
        thread,
        unread: thread?.unread_by_guardian || 0,
      });
    });
  }
  if (memberships && memberships.length > 0) {
    memberships.forEach((m) => {
      if (!m.consent_given) return;
      const thread = threads.find((t) => t.member_id === m.senior_record_id);
      contacts.push({
        memberId: m.senior_record_id,
        name: m.guardian_name,
        email: m.guardian_email,
        thread,
        unread: thread?.unread_by_senior || 0,
      });
    });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (active) {
    return (
      <div className="space-y-3">
        <button
          onClick={() => setActive(null)}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-4 h-4" /> Back to chats
        </button>
        <div className="flex items-center gap-3 pb-2 border-b border-border/40">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm flex-shrink-0">
            {(active.name || "?").split(" ").map((p) => p[0]).slice(0, 2).join("")}
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-sm truncate">{active.name}</p>
            {active.email && <p className="text-xs text-muted-foreground truncate">{active.email}</p>}
          </div>
        </div>
        <ChatThread memberId={active.memberId} threadId={active.thread?.id} onSent={reload} />
      </div>
    );
  }

  if (contacts.length === 0) {
    return (
      <div className="text-center py-12 space-y-3">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center">
          <MessageCircle className="w-7 h-7 text-primary" />
        </div>
        <h2 className="text-lg font-semibold">No chats yet</h2>
        <p className="text-muted-foreground text-sm max-w-sm mx-auto">
          Once a protected family member is active, you can chat with them here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {contacts.map((c) => (
        <button
          key={c.memberId}
          onClick={() => setActive(c)}
          className="w-full flex items-center gap-3 p-3.5 rounded-2xl border border-border/50 bg-card hover:border-primary/30 transition-colors text-left"
        >
          <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm flex-shrink-0">
            {(c.name || "?").split(" ").map((p) => p[0]).slice(0, 2).join("")}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm truncate">{c.name}</p>
            <p className="text-xs text-muted-foreground truncate">
              {c.thread?.last_message || "Start a conversation"}
            </p>
          </div>
          {c.unread > 0 && (
            <span className="text-xs font-semibold bg-primary text-primary-foreground rounded-full px-2 py-0.5 flex-shrink-0">
              {c.unread}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}