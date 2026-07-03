import { useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  ShieldCheck, Search, Users, Bell, Bot, Puzzle, Crown, Menu, X, LogOut, ChevronRight,
  BarChart3, MessageSquare,
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import ThemeToggle from "@/components/ThemeToggle";

const navItems = [
  { path: "/dashboard", label: "Check", icon: Search },
  { path: "/feedback", label: "Feedback", icon: MessageSquare },
  { path: "/agent", label: "AI Chat", icon: Bot },
  { path: "/alerts", label: "Alerts", icon: Bell },
  { path: "/family", label: "Family", icon: Users },
  { path: "/analytics", label: "Analytics", icon: BarChart3 },
  { path: "/extension", label: "Extension", icon: Puzzle },
];

export default function AppLayout() {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = () => {
    base44.auth.logout("/login");
  };

  const isActive = (path) => location.pathname === path;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-50 glass border-b border-border/50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link to="/dashboard" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-md shadow-primary/20 transition-transform group-hover:scale-105">
              <ShieldCheck className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="font-bold text-lg tracking-tight font-heading">Vardin</span>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  isActive(item.path)
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </Link>
            ))}
            <Link
              to="/pricing"
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium ml-1 transition-all ${
                isActive("/pricing")
                  ? "bg-primary text-primary-foreground"
                  : "bg-gradient-to-r from-primary to-primary/80 text-primary-foreground hover:opacity-90"
              }`}
            >
              <Crown className="w-4 h-4" />
              Upgrade
            </Link>
            <div className="ml-1 pl-1 border-l border-border flex items-center">
              <ThemeToggle />
              <Button variant="ghost" size="sm" onClick={handleLogout} className="text-muted-foreground">
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </nav>

          <div className="md:hidden flex items-center gap-1">
            <ThemeToggle />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMobileOpen(!mobileOpen)}
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </Button>
          </div>
        </div>

        {mobileOpen && (
          <div className="md:hidden border-t border-border bg-card px-4 py-3 space-y-1 animate-fade-in">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center justify-between px-3 py-3 rounded-lg text-sm font-medium transition-all ${
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
            <Link
              to="/pricing"
              onClick={() => setMobileOpen(false)}
              className="flex items-center justify-between px-3 py-3 rounded-lg text-sm font-medium bg-gradient-to-r from-primary to-primary/80 text-primary-foreground"
            >
              <div className="flex items-center gap-3">
                <Crown className="w-4 h-4" />
                Upgrade to Premium
              </div>
              <ChevronRight className="w-4 h-4" />
            </Link>
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted w-full"
            >
              <LogOut className="w-4 h-4" />
              Log out
            </button>
          </div>
        )}
      </header>

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 py-8">
        <Outlet />
      </main>

      <footer className="border-t border-border/50 py-6 px-4">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-muted-foreground">
          <p>© 2026 Vardin. Stay safe out there.</p>
          <div className="flex items-center gap-4">
            <Link to="/" className="hover:text-foreground transition-colors">About</Link>
            <Link to="/pricing" className="hover:text-foreground transition-colors">Pricing</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}