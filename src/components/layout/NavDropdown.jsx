import { ChevronDown } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { useI18n } from "@/lib/i18n";

export default function NavDropdown({ labelKey, items, isOpen, onToggle, variant = "desktop", onNavigate }) {
  const { t } = useI18n();
  const location = useLocation();
  const hasActive = items.some((item) => location.pathname === item.path);
  const isMobile = variant === "mobile";

  const buttonClass = isMobile
    ? `flex items-center justify-between w-full px-3 py-3 rounded-xl text-sm font-medium transition-all ${hasActive ? "text-primary" : "text-muted-foreground hover:bg-muted"}`
    : `flex items-center justify-between w-full px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${hasActive ? "text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted/60"}`;

  const iconClass = isMobile ? "w-4 h-4" : "w-3.5 h-3.5";

  return (
    <div>
      <button onClick={onToggle} className={buttonClass}>
        <span>{t(labelKey)}</span>
        <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>
      {isOpen && (
        <div className="mt-1 ml-3 pl-2 space-y-0.5 border-l border-border/50">
          {items.map((item) => {
            const active = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={onNavigate}
                className={`flex items-center gap-2.5 px-3 ${isMobile ? "py-2.5" : "py-2"} rounded-lg text-sm transition-all ${
                  active
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                }`}
              >
                <item.icon className={iconClass} />
                {t(item.labelKey)}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}