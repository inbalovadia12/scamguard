import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Search, Link2, Bot, Users, Bell, BarChart3, ArrowRight, ShieldCheck,
  TrendingUp, Loader2, Zap, Sparkles,
} from "lucide-react";
import { getCreditStatus, PLAN_NAMES } from "@/lib/credits";
import { useI18n } from "@/lib/i18n";
import { isWrappedSeason } from "@/lib/wrappedSeason";
import StreakBadges from "@/components/gamification/StreakBadges";

export default function Dashboard() {
  const { t } = useI18n();

  const quickActions = [
    { path: "/check", label: t("dash.check_message"), desc: t("dash.quick_check_desc"), icon: Search, color: "from-primary to-primary/80" },
    { path: "/check", label: t("dash.quick_scan_url"), desc: t("dash.quick_scan_desc"), icon: Link2, color: "from-chart-2 to-chart-2/80" },
    { path: "/agent", label: t("dash.quick_ask_ai"), desc: t("dash.quick_ask_desc"), icon: Bot, color: "from-chart-5 to-chart-5/80" },
    { path: "/family", label: t("dash.quick_family"), desc: t("dash.quick_family_desc"), icon: Users, color: "from-chart-3 to-chart-3/80" },
  ];
  const [credits, setCredits] = useState(null);
  const [recent, setRecent] = useState([]);
  const [familyCount, setFamilyCount] = useState(0);
  const [alertCount, setAlertCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const user = await base44.auth.me();
      const [status, seniors, analyses] = await Promise.all([
        getCreditStatus(),
        base44.entities.ProtectedSenior.filter({ guardian_id: user.id }),
        base44.entities.ScamAnalysis.list("-created_date", 5),
      ]);
      setCredits(status);
      setFamilyCount(seniors.length);
      setRecent(analyses);
      setAlertCount(analyses.filter((a) => a.guardian_status === "new").length);
      setLoading(false);
    };
    load();
  }, []);

  if (loading || !credits) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const creditPct = Math.round((credits.remaining / credits.limit) * 100);

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Welcome */}
      <div className="animate-slide-up">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight font-heading">
          {t("dash.welcome")}<span className="text-muted-foreground font-normal"> 👋</span>
        </h1>
        <p className="text-muted-foreground mt-1 text-sm sm:text-base">
          {t("dash.overview")}
        </p>
      </div>

      {/* Wrapped banner */}
      {isWrappedSeason() && (
        <Link to="/wrapped" className="block animate-slide-up">
          <div className="relative rounded-2xl overflow-hidden bg-gradient-to-r from-violet-500 via-primary to-cyan-500 p-5 text-white shadow-lg shadow-primary/30 luxury-card-hover">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <p className="font-bold text-base">Your 2026 Wrapped is Ready!</p>
                <p className="text-sm text-white/80">Available for one week only — see your year in scam protection</p>
              </div>
              <ArrowRight className="w-5 h-5 flex-shrink-0" />
            </div>
          </div>
        </Link>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          icon={Zap}
          label={t("dash.credits_left")}
          value={`${credits.remaining}/${credits.limit}`}
          sub={PLAN_NAMES[credits.plan]}
          pct={creditPct}
          animate="anim-delay-1"
        />
        <StatCard icon={Users} label={t("dash.family_protected")} value={familyCount} animate="anim-delay-1" />
        <StatCard icon={Bell} label={t("dash.new_alerts")} value={alertCount} animate="anim-delay-2" />
        <StatCard icon={BarChart3} label={t("dash.total_checks")} value={recent.length} animate="anim-delay-2" />
      </div>

      {/* Streaks & Badges */}
      <StreakBadges />

      {/* Quick actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 animate-slide-up anim-delay-2">
        {quickActions.map((action, i) => (
          <Link
            key={i}
            to={action.path}
            className="group flex items-center gap-4 p-4 sm:p-5 rounded-2xl border border-border/50 bg-card hover:border-primary/40 hover:shadow-md transition-all"
          >
            <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${action.color} flex items-center justify-center flex-shrink-0 shadow-sm`}>
              <action.icon className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm">{action.label}</div>
              <div className="text-xs text-muted-foreground">{action.desc}</div>
            </div>
            <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
          </Link>
        ))}
      </div>

      {/* Recent activity + Tip */}
      <div className="grid lg:grid-cols-3 gap-4 animate-slide-up anim-delay-3">
        <div className="lg:col-span-2 rounded-2xl border border-border/50 bg-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-sm font-heading">{t("dash.recent_activity")}</h2>
            <Link to="/alerts" className="text-xs text-primary hover:underline">{t("dash.view_all")}</Link>
          </div>
          {recent.length === 0 ? (
            <div className="text-center py-8 space-y-2">
              <ShieldCheck className="w-8 h-8 text-muted-foreground/40 mx-auto" />
              <p className="text-sm text-muted-foreground">{t("dash.no_checks")}</p>
              <Link to="/check">
                <Button size="sm" className="mt-2 gap-2 bg-gradient-to-r from-primary to-primary/80">
                  <Search className="w-3.5 h-3.5" />
                  {t("dash.check_message")}
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {recent.map((a) => (
                <div key={a.id} className="flex items-center gap-3 p-3 rounded-xl bg-muted/50">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    a.risk_level === "high" ? "bg-destructive" : a.risk_level === "medium" ? "bg-warning" : "bg-success"
                  }`} />
                  <p className="text-sm flex-1 truncate">{a.message_text}</p>
                  <span className="text-xs font-bold text-muted-foreground flex-shrink-0">{a.risk_score}/100</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 to-transparent p-5">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            <h2 className="font-semibold text-sm font-heading text-primary">{t("dash.trend_title")}</h2>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed mb-4">
            {t("dash.trend_desc")}
          </p>
          <Link to="/check">
            <Button size="sm" variant="outline" className="w-full gap-2">
              <Search className="w-3.5 h-3.5" />
              {t("dash.check_message")}
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, sub, pct, animate = "" }) {
  return (
    <div className={`p-4 rounded-2xl border border-border/50 bg-card animate-slide-up ${animate}`}>
      <div className="flex items-center justify-between mb-2">
        <Icon className="w-4 h-4 text-muted-foreground" />
        {sub && <span className="text-xs text-muted-foreground">{sub}</span>}
      </div>
      <div className="text-xl sm:text-2xl font-bold font-heading">{value}</div>
      <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
      {pct !== undefined && (
        <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-primary to-primary/60 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
        </div>
      )}
    </div>
  );
}