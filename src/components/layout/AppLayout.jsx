import { useState, useEffect } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  ShieldCheck, Search, Users, Bell, Bot, Crown, Menu, X, LogOut,
  BarChart3, MessageSquare, User, ChevronRight, Globe, GraduationCap, LayoutGrid, Puzzle,
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import ThemeToggle from "@/components/ThemeToggle";
import NudigoPopup from "@/components/NudigoPopup";

const navGroups = [
  {
    label: "Tools",
    items: [
      { path: "/dashboard", label: "Home", icon: ShieldCheck },
      { path: "/check", label: "Check", icon: Search },
      { path: "/url-scanner", label: "URL Scan", icon: Globe },
      { path: "/agent", label: "AI Chat", icon: Bot },
      { path: "/extension", label: "Extension", icon: Puzzle },
    ],
  },
  {
    label: "Protection",
    items: [
      { path: "/alerts", label: "Alerts", icon: Bell },
      { path: "/family", label: "Family", icon: Users },
    ],
  },
  {
    label: "More",
    items: [
      { path: "/analytics", label: "Analytics", icon: BarChart3 },
      { path: "/lessons", label: "Lessons", icon: GraduationCap },
      { path: "/projects", label: "More Projects", icon: LayoutGrid },
      { path: "/feedback", label: "Feedback", icon: MessageSquare },
    ],
  },
];

export default function AppLayout() {
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
    <div className="min-h-screen bg-background flex">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 border-r border-border/50 bg-card/50 backdrop-blur-sm fixed inset-y-0 left-0 z-30">
        <div className="px-6 py-6">
          <Link to="/dashboard" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-md shadow-primary/20 transition-transform group-hover:scale-105">
              <ShieldCheck className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="font-bold text-lg tracking-tight font-heading">Vardin</span>
          </Link>
        </div>

        <nav className="flex-1 px-4 space-y-6 overflow-y-auto">
          {navGroups.map((group) => (
            <div key={group.label}>
              <p className="px-3 mb-2 text-xs font-semibold text-muted-foreground/60 uppercase tracking-wider">
                {group.label}
              </p>
              <div className="space-y-1">
                {group.items.map((item) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                      isActive(item.path)
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                    }`}
                  >
                    <item.icon className="w-4 h-4" />
                    {item.label}
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
                <span className="text-sm font-semibold text-primary">Upgrade Plan</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">Unlock more credits & family protection features.</p>
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
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center text-xs font-bold text-primary-foreground">
                {initials}
              </div>
              Profile
            </Link>
            <div className="flex items-center gap-1 px-1">
              <ThemeToggle className="rounded-xl" />
              <Button variant="ghost" size="sm" onClick={handleLogout} className="text-muted-foreground hover:text-destructive flex-1 justify-start">
                <LogOut className="w-4 h-4 mr-2" />
                Log out
              </Button>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 inset-x-0 z-30 glass border-b border-border/50">
        <div className="px-4 h-16 flex items-center justify-between">
          <Link to="/dashboard" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center">
              <ShieldCheck className="w-4.5 h-4.5 text-primary-foreground" />
            </div>
            <span className="font-bold text-lg tracking-tight font-heading">Vardin</span>
          </Link>
          <div className="flex items-center gap-1">
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
            {navGroups.map((group) => (
              <div key={group.label}>
                <p className="px-3 mb-2 text-xs font-semibold text-muted-foreground/60 uppercase tracking-wider">
                  {group.label}
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
                        {item.label}
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
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center text-xs font-bold text-primary-foreground">
                    {initials}
                  </div>
                  Profile
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
                    Upgrade Plan
                  </div>
                  <ChevronRight className="w-4 h-4 flex-shrink-0" />
                </Link>
              )}
              <button
                onClick={handleLogout}
                className="flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium text-muted-foreground hover:bg-muted w-full"
              >
                <LogOut className="w-4 h-4" />
                Log out
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
            <p>© 2026 Vardin. Stay safe out there.</p>
            <div className="flex items-center gap-4">
              <Link to="/" className="hover:text-foreground transition-colors">About</Link>
              <Link to="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
              <Link to="/pricing" className="hover:text-foreground transition-colors">Pricing</Link>
              <Link to="/admin" className="hover:text-muted-foreground text-xs opacity-40 hover:opacity-100 transition-opacity">Admin</Link>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}