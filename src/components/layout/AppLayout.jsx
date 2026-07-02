import React, { useState } from "react";
import { Outlet, Link, useLocation } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Shield, Search, Users, Bell, Menu, X, LogOut, ChevronRight, Bot, Puzzle, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";

const navItems = [
  { path: "/", label: "Check", icon: Search },
  { path: "/agent", label: "AI Chat", icon: Bot },
  { path: "/alerts", label: "Alerts", icon: Bell },
  { path: "/family", label: "Family", icon: Users },
  { path: "/extension", label: "Extension", icon: Puzzle },
];

export default function AppLayout() {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = () => {
    base44.auth.logout("/login");
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-border/50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-md shadow-blue-500/20">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-lg tracking-tight">ScamGuard</span>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? "bg-blue-50 text-blue-600"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                >
                  <item.icon className="w-4 h-4" />
                  {item.label}
                </Link>
              );
            })}
            <Link
              to="/pricing"
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium ml-1 transition-all ${
                location.pathname === "/pricing"
                  ? "bg-blue-500 text-white"
                  : "bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700"
              }`}
            >
              <Crown className="w-4 h-4" />
              Upgrade
            </Link>
            <div className="ml-1 pl-1 border-l border-border">
              <Button variant="ghost" size="sm" onClick={handleLogout} className="text-muted-foreground">
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </nav>

          {/* Mobile menu button */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </Button>
        </div>

        {/* Mobile Nav */}
        {mobileOpen && (
          <div className="md:hidden border-t border-border bg-white px-4 py-3 space-y-1">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center justify-between px-3 py-3 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? "bg-blue-50 text-blue-600"
                      : "text-muted-foreground hover:bg-muted"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <item.icon className="w-4 h-4" />
                    {item.label}
                  </div>
                  <ChevronRight className="w-4 h-4 opacity-40" />
                </Link>
              );
            })}
            <Link
              to="/pricing"
              onClick={() => setMobileOpen(false)}
              className="flex items-center justify-between px-3 py-3 rounded-lg text-sm font-medium bg-gradient-to-r from-blue-500 to-blue-600 text-white"
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

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}