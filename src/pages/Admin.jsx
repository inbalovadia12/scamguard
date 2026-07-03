import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Lock, Loader2, MessageSquare, Users, ShieldCheck, BarChart3, Star, Trash2,
  Mail, AlertTriangle, CheckCircle2, Crown, TrendingUp, Activity,
} from "lucide-react";
import { toast } from "@/components/ui/use-toast";

const ADMIN_CODE = "12252012Io";

function StatCard({ icon: Icon, label, value, color }) {
  return (
    <div className="bg-card rounded-2xl border border-border/50 p-5">
      <div className={`w-10 h-10 rounded-lg ${color} flex items-center justify-center mb-3`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="text-2xl font-bold font-heading">{value}</div>
      <div className="text-sm text-muted-foreground mt-0.5">{label}</div>
    </div>
  );
}

function FeedbackTab() {
  const [feedback, setFeedback] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  const load = async () => {
    try {
      const data = await base44.entities.Feedback.list("-created_date", 100);
      setFeedback(data);
    } catch (e) {
      toast({ title: "Error loading feedback", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = filter === "all" ? feedback : feedback.filter((f) => f.status === filter);

  const updateStatus = async (id, status) => {
    await base44.entities.Feedback.update(id, { status });
    load();
  };

  const handleDelete = async (id) => {
    await base44.entities.Feedback.delete(id);
    load();
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;

  const categoryColors = {
    bug: "bg-destructive/10 text-destructive",
    feature_request: "bg-chart-5/10 text-chart-5",
    general: "bg-muted text-muted-foreground",
    praise: "bg-success/10 text-success",
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        {["all", "new", "reviewed", "resolved"].map((s) => (
          <Button
            key={s}
            size="sm"
            variant={filter === s ? "default" : "outline"}
            onClick={() => setFilter(s)}
          >
            {s.charAt(0).toUpperCase() + s.slice(1)}
            {s !== "all" && <Badge variant="secondary" className="ml-1.5">{feedback.filter((f) => f.status === s).length}</Badge>}
          </Button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="text-center text-muted-foreground py-12">No feedback found.</p>
      ) : (
        <div className="space-y-3">
          {filtered.map((item) => (
            <div key={item.id} className="bg-card rounded-2xl border border-border/50 p-5 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${categoryColors[item.category] || categoryColors.general}`}>
                      {item.category?.replace("_", " ")}
                    </span>
                    {item.rating > 0 && (
                      <span className="flex items-center gap-0.5 text-xs text-warning">
                        {Array.from({ length: item.rating }).map((_, i) => <Star key={i} className="w-3 h-3 fill-warning" />)}
                      </span>
                    )}
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      item.status === "new" ? "bg-warning/10 text-warning" :
                      item.status === "reviewed" ? "bg-chart-5/10 text-chart-5" :
                      "bg-success/10 text-success"
                    }`}>
                      {item.status}
                    </span>
                  </div>
                  <p className="text-sm leading-relaxed">{item.content}</p>
                  <p className="text-xs text-muted-foreground mt-2">
                    {item.user_name || "Unknown"} • {item.user_email || "No email"} • {new Date(item.created_date).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex flex-col gap-1">
                  <Button size="icon" variant="ghost" onClick={() => updateStatus(item.id, item.status === "new" ? "reviewed" : "resolved")} className="h-8 w-8">
                    {item.status === "resolved" ? <CheckCircle2 className="w-4 h-4 text-success" /> : <AlertTriangle className="w-4 h-4 text-muted-foreground" />}
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => handleDelete(item.id)} className="h-8 w-8 text-muted-foreground hover:text-destructive">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function UsersTab() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const data = await base44.entities.User.list();
      setUsers(data);
    } catch (e) {
      toast({ title: "Error loading users", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const changePlan = async (userId, plan) => {
    try {
      await base44.entities.User.update(userId, { subscription_plan: plan });
      load();
      toast({ title: "Plan updated", description: `User set to ${plan}` });
    } catch (e) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-3">
      {users.map((user) => (
        <div key={user.id} className="bg-card rounded-2xl border border-border/50 p-4 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-medium truncate">{user.full_name || "No name"}</p>
              {user.role === "admin" && <Badge variant="secondary" className="text-xs">Admin</Badge>}
            </div>
            <p className="text-xs text-muted-foreground">{user.email}</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {user.subscription_plan && (
              <Badge variant="outline" className="capitalize">{user.subscription_plan}</Badge>
            )}
            <select
              value={user.subscription_plan || "starter"}
              onChange={(e) => changePlan(user.id, e.target.value)}
              className="text-xs border border-border rounded-md px-2 py-1 bg-background"
            >
              <option value="starter">Starter</option>
              <option value="plus">Plus</option>
              <option value="premium">Premium</option>
            </select>
          </div>
        </div>
      ))}
    </div>
  );
}

function AnalysesTab() {
  const [analyses, setAnalyses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.entities.ScamAnalysis.list("-created_date", 100)
      .then(setAnalyses)
      .catch((e) => toast({ title: "Error", description: e.message, variant: "destructive" }))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;

  const stats = {
    high: analyses.filter((a) => a.risk_level === "high").length,
    medium: analyses.filter((a) => a.risk_level === "medium").length,
    low: analyses.filter((a) => a.risk_level === "low").length,
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-destructive/10 text-destructive rounded-xl p-3 text-center">
          <div className="text-xl font-bold">{stats.high}</div>
          <div className="text-xs">High Risk</div>
        </div>
        <div className="bg-warning/10 text-warning rounded-xl p-3 text-center">
          <div className="text-xl font-bold">{stats.medium}</div>
          <div className="text-xs">Medium Risk</div>
        </div>
        <div className="bg-success/10 text-success rounded-xl p-3 text-center">
          <div className="text-xl font-bold">{stats.low}</div>
          <div className="text-xs">Low Risk</div>
        </div>
      </div>
      <div className="space-y-2">
        {analyses.map((a) => (
          <div key={a.id} className="bg-card rounded-xl border border-border/50 p-4">
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                a.risk_level === "high" ? "bg-destructive/10 text-destructive" :
                a.risk_level === "medium" ? "bg-warning/10 text-warning" :
                "bg-success/10 text-success"
              }`}>{a.risk_level}</span>
              <span className="text-xs text-muted-foreground">{new Date(a.created_date).toLocaleDateString()}</span>
            </div>
            <p className="text-sm line-clamp-2 text-muted-foreground">{a.message_text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function SeniorsTab() {
  const [seniors, setSeniors] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.entities.ProtectedSenior.list()
      .then(setSeniors)
      .catch((e) => toast({ title: "Error", description: e.message, variant: "destructive" }))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-2">
      {seniors.length === 0 ? (
        <p className="text-center text-muted-foreground py-12">No protected seniors yet.</p>
      ) : (
        seniors.map((s) => (
          <div key={s.id} className="bg-card rounded-xl border border-border/50 p-4 flex items-center justify-between gap-3">
            <div>
              <p className="font-medium">{s.name}</p>
              {s.email && <p className="text-xs text-muted-foreground flex items-center gap-1"><Mail className="w-3 h-3" />{s.email}</p>}
            </div>
            <Badge variant={s.consent_given ? "default" : "outline"}>
              {s.consent_given ? "Consent given" : "Pending consent"}
            </Badge>
          </div>
        ))
      )}
    </div>
  );
}

function OverviewTab() {
  const [stats, setStats] = useState({ feedback: 0, users: 0, analyses: 0, seniors: 0, pendingFeedback: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      base44.entities.Feedback.list("-created_date", 100),
      base44.entities.User.list(),
      base44.entities.ScamAnalysis.list("-created_date", 100),
      base44.entities.ProtectedSenior.list(),
    ]).then(([fb, users, analyses, seniors]) => {
      setStats({
        feedback: fb.length,
        users: users.length,
        analyses: analyses.length,
        seniors: seniors.length,
        pendingFeedback: fb.filter((f) => f.status === "new").length,
      });
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
      <StatCard icon={MessageSquare} label="Total Feedback" value={stats.feedback} color="bg-primary/10 text-primary" />
      <StatCard icon={AlertTriangle} label="Pending Feedback" value={stats.pendingFeedback} color="bg-warning/10 text-warning" />
      <StatCard icon={Users} label="Total Users" value={stats.users} color="bg-chart-5/10 text-chart-5" />
      <StatCard icon={ShieldCheck} label="Scam Analyses" value={stats.analyses} color="bg-destructive/10 text-destructive" />
      <StatCard icon={Crown} label="Protected Seniors" value={stats.seniors} color="bg-success/10 text-success" />
      <StatCard icon={Activity} label="Active Users" value={stats.users} color="bg-chart-2/10 text-chart-2" />
    </div>
  );
}

export default function Admin() {
  const [unlocked, setUnlocked] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState(false);
  const [checking, setChecking] = useState(false);

  const handleUnlock = async (e) => {
    e?.preventDefault();
    setChecking(true);
    setError(false);
    try {
      const user = await base44.auth.me();
      if (!user) throw new Error("Not authenticated");
      if (code === ADMIN_CODE) {
        setUnlocked(true);
      } else {
        setError(true);
      }
    } catch {
      setError(true);
    } finally {
      setChecking(false);
    }
  };

  if (!unlocked) {
    return (
      <div className="max-w-md mx-auto py-16">
        <div className="text-center space-y-4 mb-8">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center">
            <Lock className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold font-heading">Admin Panel</h1>
          <p className="text-muted-foreground">Enter the admin access code to continue.</p>
        </div>
        <form onSubmit={handleUnlock} className="bg-card rounded-3xl border border-border/50 shadow-sm p-6 space-y-4">
          <div className="space-y-2">
            <Input
              type="password"
              value={code}
              onChange={(e) => { setCode(e.target.value); setError(false); }}
              placeholder="Admin access code"
              className="h-12 text-center text-lg tracking-wider"
              autoFocus
            />
            {error && <p className="text-sm text-destructive text-center">Invalid access code.</p>}
          </div>
          <Button type="submit" disabled={!code || checking} className="w-full h-11 bg-gradient-to-r from-primary to-primary/80">
            {checking ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Lock className="w-4 h-4 mr-2" />}
            Unlock Panel
          </Button>
        </form>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center">
          <ShieldCheck className="w-5 h-5 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-heading">Admin Panel</h1>
          <p className="text-sm text-muted-foreground">Manage feedback, users, and system overview.</p>
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="w-full justify-start flex-wrap h-auto">
          <TabsTrigger value="overview" className="gap-1.5"><TrendingUp className="w-4 h-4" />Overview</TabsTrigger>
          <TabsTrigger value="feedback" className="gap-1.5"><MessageSquare className="w-4 h-4" />Feedback</TabsTrigger>
          <TabsTrigger value="users" className="gap-1.5"><Users className="w-4 h-4" />Users</TabsTrigger>
          <TabsTrigger value="analyses" className="gap-1.5"><ShieldCheck className="w-4 h-4" />Analyses</TabsTrigger>
          <TabsTrigger value="seniors" className="gap-1.5"><Crown className="w-4 h-4" />Seniors</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4"><OverviewTab /></TabsContent>
        <TabsContent value="feedback" className="mt-4"><FeedbackTab /></TabsContent>
        <TabsContent value="users" className="mt-4"><UsersTab /></TabsContent>
        <TabsContent value="analyses" className="mt-4"><AnalysesTab /></TabsContent>
        <TabsContent value="seniors" className="mt-4"><SeniorsTab /></TabsContent>
      </Tabs>
    </div>
  );
}