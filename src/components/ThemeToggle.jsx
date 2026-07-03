import React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";
import { Button } from "@/components/ui/button";

export default function ThemeToggle({ className = "" }) {
  const { theme, toggleTheme } = useTheme();

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      className={className}
      aria-label="Toggle theme"
    >
      {theme === "dark" ? (
        <Sun className="w-[1.15rem] h-[1.15rem]" />
      ) : (
        <Moon className="w-[1.15rem] h-[1.15rem]" />
      )}
    </Button>
  );
}