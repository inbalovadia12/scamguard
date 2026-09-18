import React, { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { MessageCircle, Loader2 } from "lucide-react";
import IMessageThread from "@/components/family/IMessageThread";

function formatListTime(iso) {
  if (!iso) return "";
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

// A standalone iMessage-style family chat: pick a protected family member, then
// message them in a thread shared with their guardian/protected partner.
export default function FamilyChat() {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeMemberId, setActiveMemberId] = useState(null);

  const load = useCallback(async () => {
    try {
      const user = await base44.auth.me();
      const [seniors, membershipsRes, allThreads] = await Promise.all([
        base44.entities.ProtectedSenior.filter({ guardian_id: user.id }),
        base44.functions.invoke("getFamilyView", {}).catch(() => ({ data: { memberships: [] } })),
        base44.entities.FamilyChat.list("-last_message_at", 100),
      ]);
      const memberships = membershipsRes?.data?.memberships || [];
      const myThreads = allThreads.filter((t) => t.guardian_id === user.id || t.senior_user_id === user.id);

      const list = [];
      seniors.forEach((s) => {
        if (!s.consent_given || !s.senior_user_id) return;
        const thread = myThreads.find((t) => t.member_id === s.id);
        list.push({
          memberId: s.id,
          name: s.name,
          email: s.email,
          thread,
          unread: thread?.unread_by_guardian || 0,
        });
      });
      memberships.forEach((m) => {
        if (!m.consent_given) return;
        const thread = myThreads.find((t) => t.member_id === m.senior_record_id);
        list.push({
          memberId: m.senior_record_id,
          name: m.guardian_name,
          email: m.guardian_email,
          thread,
          unread: thread?.unread_by_senior || 0,
        });
      });
      // Most recent conversation first
      list.sort((a, b) => new Date(b.thread?.last_message_at || 0).getTime() - new Date(a.thread?.last_message_at || 0).getTime());
      setContacts(list);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    let unsub1, unsub2;
    try { unsub1 = base44.entities.FamilyChat.subscribe(load); } catch {}
    try { unsub2 = base44.entities.FamilyChatMessage.subscribe(load); } catch {}
    return () => { try { unsub1?.(); } catch {} try { unsub2?.(); } catch {} };
  }, [load]);

  const activeContact = contacts.find((c) => c.memberId === activeMemberId) || null;

  const renderContactList = (onSelect) => (
    <div className="flex flex-col h-full min-h-0">
      <div className="px-4 py-3 border-b border-border/50 bg-card/80 backdrop-blur-sm flex-shrink-0">
        <h2 className="font-semibold text-sm">Messages</h2>
      </div>
      <div className="flex-1 overflow-y-auto min-h-0">
        {contacts.length === 0 ? (
          <div className="text-center text-sm text-muted-foreground py-12 px-6">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center mb-3">
              <MessageCircle className="w-6 h-6 text-primary" />
            </div>
            <p className="font-medium text-foreground/80">No chats yet</p>
            <p className="mt-1">Once a protected family member is active, you can message them here.</p>
          </div>
        ) : (
          contacts.map((c) => {
            const initials = (c.name || "?").split(" ").map((p) => p[0]).slice(0, 2).join("");
            const isActive = c.memberId === activeMemberId;
            return (
              <button
                key={c.memberId}
                onClick={() => onSelect(c.memberId)}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors border-b border-border/30 ${
                  isActive ? "bg-primary/10" : "hover:bg-muted/60"
                }`}
              >
                <div className="w-11 h-11 rounded-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center text-primary-foreground font-semibold text-sm flex-shrink-0">
                  {initials}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-sm truncate">{c.name}</p>
                    <span className="text-[11px] text-muted-foreground flex-shrink-0">{formatListTime(c.thread?.last_message_at)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">
                    {c.thread?.last_message || "Start a conversation"}
                  </p>
                </div>
                {c.unread > 0 && (
                  <span className="text-[10px] font-bold bg-primary text-primary-foreground rounded-full min-w-5 h-5 px-1.5 flex items-center justify-center flex-shrink-0">
                    {c.unread}
                  </span>
                )}
              </button>
            );
          })
        )}
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight font-heading">Family Chat</h1>
        <p className="text-sm text-muted-foreground mt-1">Message your protected family members directly.</p>
      </div>

      {/* Desktop: two-pane */}
      <div className="hidden md:grid grid-cols-[300px_1fr] h-[calc(100dvh-15rem)] min-h-[480px] rounded-3xl border border-border/60 bg-card overflow-hidden shadow-sm">
        {renderContactList(setActiveMemberId)}
        <div className="border-l border-border/60 min-h-0">
          {activeContact ? (
            <IMessageThread
              memberId={activeContact.memberId}
              threadId={activeContact.thread?.id}
              contactName={activeContact.name}
              contactEmail={activeContact.email}
              onSent={load}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center px-6 text-muted-foreground">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-3">
                <MessageCircle className="w-7 h-7 text-primary" />
              </div>
              <p className="font-medium text-foreground/80">Select a conversation</p>
              <p className="text-sm mt-1">Choose a family member to start chatting.</p>
            </div>
          )}
        </div>
      </div>

      {/* Mobile: single pane */}
      <div className="md:hidden h-[calc(100dvh-12rem)] min-h-[440px] rounded-3xl border border-border/60 bg-card overflow-hidden shadow-sm">
        {activeContact ? (
          <IMessageThread
            memberId={activeContact.memberId}
            threadId={activeContact.thread?.id}
            contactName={activeContact.name}
            contactEmail={activeContact.email}
            onBack={() => setActiveMemberId(null)}
            onSent={load}
          />
        ) : (
          renderContactList(setActiveMemberId)
        )}
      </div>
    </div>
  );
}