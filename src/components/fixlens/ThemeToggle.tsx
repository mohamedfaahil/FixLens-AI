import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

export function ThemeToggle({
  className,
  variant = "ghost",
  size = "icon",
  showLabel = false,
}: {
  className?: string;
  variant?: "ghost" | "outline" | "secondary" | "default";
  size?: "default" | "sm" | "lg" | "icon";
  showLabel?: boolean;
}) {
  const { resolvedTheme, toggleTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      onClick={toggleTheme}
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      title={isDark ? "Switch to light theme" : "Switch to dark theme"}
      className={cn(
        "relative rounded-lg text-muted-foreground transition-colors hover:text-foreground",
        showLabel && "flex items-center gap-2 px-3",
        className,
      )}
    >
      <div className="relative flex items-center justify-center">
        <Sun
          className={cn(
            "size-4.5 transition-all duration-300",
            isDark ? "rotate-0 scale-100 text-amber-400" : "-rotate-90 scale-0",
          )}
        />
        <Moon
          className={cn(
            "absolute size-4.5 transition-all duration-300",
            isDark ? "rotate-90 scale-0" : "rotate-0 scale-100 text-indigo-500",
          )}
        />
      </div>
      {showLabel && (
        <span className="text-xs font-medium">
          {isDark ? "Light Mode" : "Dark Mode"}
        </span>
      )}
      <span className="sr-only">Toggle theme</span>
    </Button>
  );
}
