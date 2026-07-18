import { useState, useEffect } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  ShieldCheck, Search, Users, Bell, Bot, Crown, Menu, X, LogOut,
  BarChart3, MessageSquare, User, ChevronRight, Globe, Globe2, GraduationCap, LayoutGrid, Puzzle, Megaphone, Radar, Phone, Image as ImageIcon, MessageCircle, Layers,
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { useI18n } from "@/lib/i18n";
import ThemeToggle from "@/components/ThemeToggle";
import LanguageToggle from "@/components/LanguageToggle";
import NudigoPopup from "@/components/NudigoPopup";

const NAV_GROUPS = [
  {
    labelKey: "nav.tools",
    items: [
      { path: "/dashboard", labelKey: "nav.home", icon: ShieldCheck },
      { path: "/check", labelKey: "nav.check", icon: Search },
      { path: "/advanced-scanner", labelKey: "nav.advanced_scanner", icon: Layers },
      { path: "/url-scanner", labelKey: "nav.url_scan", icon: Globe },
      { path: "/phone-lookup", labelKey: "nav.phone_lookup", icon: Phone },
      { path: "/image-scanner", labelKey: "nav.image_scan", icon: ImageIcon },
      { path: "/ai-negotiator", labelKey: "nav.ai_negotiator", icon: MessageCircle },
      { path: "/agent", labelKey: "nav.ai_chat", icon: Bot },
      { path: "/extension", labelKey: "nav.extension", icon: Puzzle },
    ],
  },
  {
    labelKey: "nav.protection",
    items: [
      { path: "/alerts", labelKey: "nav.alerts", icon: Bell },
      { path: "/family", labelKey: "nav.family", icon: Users },
      { path: "/scam-feed", labelKey: "nav.scam_feed", icon: Megaphone },
      { path: "/local-intel", labelKey: "nav.local_intel", icon: Radar },
      { path: "/local-dashboard", labelKey: "nav.local_dashboard", icon: Globe2 },
    ],
  },
  {
    labelKey: "nav.more",
    items: [
      { path: "/analytics", labelKey: "nav.analytics", icon: BarChart3 },
      { path: "/lessons", labelKey: "nav.lessons", icon: GraduationCap },
      { path: "/projects", labelKey: "nav.more_projects", icon: LayoutGrid },
      { path: "/feedback", labelKey: "nav.feedback", icon: MessageSquare },
    ],
  },
];

export default function AppLayout() {
  const { t } = useI18n();

  // Apply accessibility settings from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem("vardin_accessibility");
      if (raw) {
        const s = JSON.parse(raw);
        const root = document.documentElement;
        root.classList.remove("text-size-normal", "text-size-large", "text-size-xlarge");
        root.classList.add(`text-size-${s.text_size || "normal"}`);
        root.classList.toggle("high-contrast", !!s.high_contrast);
        root.classList.toggle("reduced-motion", !!s.reduced_motion);
      }
    } catch {}
  }, []);

  const location = useLocation();
  const { user } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = () => {
    base44.auth.logout("/login");
  };

  const isActive = (path) => location.pathname === path;
  const initials = (user?.full_name || user?.email || "U")
    .split(" ")
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const plan = user?.subscription_plan || "starter";

  return (
    <div className="min-h-screen bg-background luxury-mesh flex">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 border-r border-border/50 luxury-sidebar backdrop-blur-sm fixed inset-y-0 left-0 z-30">
        <div className="px-6 py-6">
          <Link to="/dashboard" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-xl luxury-gradient-btn flex items-center justify-center shadow-md shadow-primary/20 transition-transform group-hover:scale-105">
              <ShieldCheck className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="font-bold text-lg tracking-tight font-heading">Vardin</span>
          </Link>
        </div>

        <nav className="flex-1 px-4 space-y-6 overflow-y-auto">
          {NAV_GROUPS.map((group) => (
            <div key={group.labelKey}>
              <p className="px-3 mb-2 text-xs font-semibold text-muted-foreground/60 uppercase tracking-wider">
                {t(group.labelKey)}
              </p>
              <div className="space-y-1">
                {group.items.map((item) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                      isActive(item.path)
                        ? "luxury-active-nav text-primary font-semibold"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                    }`}
                  >
                    <item.icon className="w-4 h-4" />
                    {t(item.labelKey)}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="px-4 pb-4 pt-2 space-y-3">
          {plan !== "premium" && plan !== "plus" && (
            <Link
              to="/pricing"
              className="block rounded-2xl bg-gradient-to-br from-primary/10 to-transparent border border-primary/20 p-4 hover:border-primary/40 transition-all"
            >
              <div className="flex items-center gap-2 mb-2">
                <Crown className="w-4 h-4 text-primary flex-shrink-0" />
                <span className="text-sm font-semibold text-primary">{t("nav.upgrade_plan")}</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">{t("nav.upgrade_desc")}</p>
            </Link>
          )}

          <div className="border-t border-border/50 pt-3 space-y-1">
            <Link
              to="/profile"
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                isActive("/profile")
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
              }`}
            >
              <div className="w-7 h-7 rounded-full luxury-gradient-btn flex items-center justify-center text-xs font-bold text-primary-foreground">
                {initials}
              </div>
              {t("nav.profile")}
            </Link>
            <div className="flex items-center gap-1 px-1">
              <LanguageToggle className="rounded-xl" dropUp />
              <ThemeToggle className="rounded-xl" />
              <Button variant="ghost" size="sm" onClick={handleLogout} className="text-muted-foreground hover:text-destructive flex-1 justify-start">
                <LogOut className="w-4 h-4 mr-2" />
                {t("nav.log_out")}
              </Button>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 inset-x-0 z-30 glass border-b border-border/50">
        <div className="px-4 h-16 flex items-center justify-between">
          <Link to="/dashboard" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg luxury-gradient-btn flex items-center justify-center">
              <ShieldCheck className="w-4.5 h-4.5 text-primary-foreground" />
            </div>
            <span className="font-bold text-lg tracking-tight font-heading">Vardin</span>
          </Link>
          <div className="flex items-center gap-1">
            <LanguageToggle className="rounded-lg" />
            <ThemeToggle className="rounded-lg" />
            <Button variant="ghost" size="icon" onClick={() => setMobileOpen(!mobileOpen)}>
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 top-16 z-20 bg-background animate-fade-in" onClick={() => setMobileOpen(false)}>
          <div className="px-4 py-4 space-y-6 overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            {NAV_GROUPS.map((group) => (
              <div key={group.labelKey}>
                <p className="px-3 mb-2 text-xs font-semibold text-muted-foreground/60 uppercase tracking-wider">
                  {t(group.labelKey)}
                </p>
                <div className="space-y-1">
                  {group.items.map((item) => (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={() => setMobileOpen(false)}
                      className={`flex items-center justify-between px-3 py-3 rounded-xl text-sm font-medium transition-all ${
                        isActive(item.path)
                          ? "bg-primary/10 text-primary"
                          : "text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <item.icon className="w-4 h-4" />
                        {t(item.labelKey)}
                      </div>
                      <ChevronRight className="w-4 h-4 opacity-40" />
                    </Link>
                  ))}
                </div>
              </div>
            ))}

            <div className="border-t border-border/50 pt-4 space-y-1">
              <Link
                to="/profile"
                onClick={() => setMobileOpen(false)}
                className={`flex items-center justify-between px-3 py-3 rounded-xl text-sm font-medium transition-all ${
                  isActive("/profile") ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-full luxury-gradient-btn flex items-center justify-center text-xs font-bold text-primary-foreground">
                    {initials}
                  </div>
                  {t("nav.profile")}
                </div>
                <ChevronRight className="w-4 h-4 opacity-40" />
              </Link>
              {plan !== "premium" && plan !== "plus" && (
                <Link
                  to="/pricing"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium bg-gradient-to-r from-primary to-primary/80 text-primary-foreground"
                >
                  <div className="flex items-center gap-2.5">
                    <Crown className="w-4 h-4 flex-shrink-0" />
                    {t("nav.upgrade_plan")}
                  </div>
                  <ChevronRight className="w-4 h-4 flex-shrink-0" />
                </Link>
              )}
              <button
                onClick={handleLogout}
                className="flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium text-muted-foreground hover:bg-muted w-full"
              >
                <LogOut className="w-4 h-4" />
                {t("nav.log_out")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 md:ml-64 flex flex-col min-h-screen overflow-x-hidden">
        <main className="flex-1 max-w-4xl mx-auto w-full px-4 sm:px-8 pt-20 pb-6 md:py-12">
          <Outlet />
        </main>

        <NudigoPopup />

        <footer className="border-t border-border/50 py-6 px-4 mt-auto">
          <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-muted-foreground">
            <p>{t("footer.copyright")}</p>
            <div className="flex items-center gap-4">
              <Link to="/" className="hover:text-foreground transition-colors">{t("footer.about")}</Link>
              <Link to="/privacy" className="hover:text-foreground transition-colors">{t("footer.privacy")}</Link>
              <Link to="/pricing" className="hover:text-foreground transition-colors">{t("footer.pricing")}</Link>
              <Link to="/admin" className="hover:text-muted-foreground text-xs opacity-40 hover:opacity-100 transition-opacity">{t("footer.admin")}</Link>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}