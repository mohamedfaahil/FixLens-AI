import { useState, useRef, useEffect, useMemo, useId } from "react";
import {
  Building2,
  Search,
  Check,
  ChevronsUpDown,
  X,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { BUILDINGS } from "@/lib/demo-data";

export interface BuildingComboboxProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  hasError?: boolean;
  className?: string;
}

// Search metadata mapping for smart abbreviation & partial term matching
const BUILDING_METADATA: Record<string, string[]> = {
  "Mechanical Science (MS) Block": ["ms", "ms block", "mechanical", "mech", "engineering"],
  "Electrical Science (ES) Block": ["es", "es block", "electrical", "electronics", "eee", "ece"],
  "Structural Engineering (SE) Block": ["se", "se block", "structural", "civil", "structure"],
  "Life Science (LS) Block": ["ls", "ls block", "life", "bio", "biotech"],
  "SM Block": ["sm", "sm block"],
  "CS Block": ["cs", "cs block", "cse", "computer", "it"],
  "Pharmacy Block": ["pharmacy", "pharma"],
  "Architecture Block": ["architecture", "arch", "barch"],
  "Basic Science Block": ["basic", "basic science", "physics", "chemistry", "maths"],
  "Annexure Block": ["annexure", "annex"],
  "Main Auditorium": ["auditorium", "audi", "stage", "hall"],
  "Main Canteen": ["canteen", "cafeteria", "food", "mess"],
  "Convention Centre Block": ["convention", "centre", "center", "auditorium"],
  "Main Library": ["library", "reading", "books"],
  "Admin Block": ["admin", "office", "registrar", "principal"],
  "Sports Complex": ["sports", "gym", "ground", "stadium", "indoor"],
};

export function BuildingCombobox({
  id = "b",
  value,
  onChange,
  placeholder = "Select campus block or building...",
  disabled = false,
  hasError = false,
  className,
}: BuildingComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listboxRef = useRef<HTMLUListElement>(null);
  const listboxId = useId();

  // Filter options with case-insensitive and abbreviation/partial matching
  const filteredBuildings = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return Array.from(BUILDINGS);

    return BUILDINGS.filter((building) => {
      const bLower = building.toLowerCase();
      if (bLower.includes(q)) return true;

      // Check known aliases and abbreviations
      const aliases = BUILDING_METADATA[building] || [];
      return aliases.some((alias) => {
        const aLower = alias.toLowerCase();
        return aLower.includes(q) || (q.length <= 4 && aLower === q);
      });
    });
  }, [searchQuery]);

  // Keep highlighted index in bounds
  useEffect(() => {
    setHighlightedIndex(0);
  }, [searchQuery]);

  // Auto-focus search input when opening
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    } else {
      setSearchQuery("");
    }
  }, [isOpen]);

  // Click outside detection
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [isOpen]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (!isOpen || !listboxRef.current) return;
    const activeItem = listboxRef.current.children[highlightedIndex] as HTMLElement | undefined;
    if (activeItem && typeof activeItem.scrollIntoView === "function") {
      activeItem.scrollIntoView({ block: "nearest" });
    }
  }, [highlightedIndex, isOpen]);

  const selectOption = (selectedBuilding: string) => {
    onChange(selectedBuilding);
    setIsOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;

    if (!isOpen) {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev < filteredBuildings.length - 1 ? prev + 1 : 0,
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev > 0 ? prev - 1 : Math.max(0, filteredBuildings.length - 1),
        );
        break;
      case "Enter":
        e.preventDefault();
        if (filteredBuildings[highlightedIndex]) {
          selectOption(filteredBuildings[highlightedIndex]);
        }
        break;
      case "Escape":
        e.preventDefault();
        setIsOpen(false);
        break;
      case "Tab":
        setIsOpen(false);
        break;
    }
  };

  return (
    <div ref={containerRef} className={cn("relative w-full", className)}>
      {/* Trigger Button */}
      <button
        type="button"
        id={id}
        role="combobox"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-controls={listboxId}
        aria-invalid={hasError}
        disabled={disabled}
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        onKeyDown={handleKeyDown}
        className={cn(
          "group flex h-10 w-full items-center justify-between gap-2 rounded-xl border bg-card px-3.5 text-left text-sm text-foreground shadow-2xs transition-all duration-150 outline-hidden",
          hasError
            ? "border-destructive ring-1 ring-destructive/20"
            : "border-input hover:border-primary/50 focus:border-primary focus:ring-2 focus:ring-primary/20",
          disabled && "cursor-not-allowed opacity-50",
          isOpen && "border-primary ring-2 ring-primary/20",
        )}
      >
        <span className="flex items-center gap-2.5 truncate">
          <Building2
            className={cn(
              "size-4 shrink-0 transition-colors",
              value ? "text-primary" : "text-muted-foreground group-hover:text-foreground",
            )}
          />
          <span className={cn("truncate", !value && "text-muted-foreground")}>
            {value || placeholder}
          </span>
        </span>

        <span className="flex items-center gap-1 shrink-0 text-muted-foreground">
          {value && (
            <span
              role="button"
              aria-label="Clear selected building"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                onChange("");
                setSearchQuery("");
              }}
              className="rounded-md p-0.5 hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
            >
              <X className="size-3.5" />
            </span>
          )}
          <ChevronsUpDown className="size-4 opacity-75" />
        </span>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          className="absolute left-0 top-full mt-1.5 w-full z-50 rounded-xl border border-border bg-card shadow-float overflow-hidden animate-in fade-in-0 zoom-in-95 duration-150"
          style={{ minWidth: "260px" }}
        >
          {/* Search Input Bar */}
          <div className="flex items-center border-b border-border/70 px-3 py-2 bg-card/95 backdrop-blur-xs">
            <Search className="size-4 shrink-0 text-muted-foreground mr-2" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search campus block or building..."
              aria-label="Search campus block or building"
              className="flex-1 bg-transparent text-xs sm:text-sm text-foreground placeholder:text-muted-foreground focus:outline-hidden"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                aria-label="Clear search text"
                className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>

          {/* Buildings List */}
          <ul
            id={listboxId}
            ref={listboxRef}
            role="listbox"
            className="max-h-60 overflow-y-auto p-1.5 space-y-0.5 text-xs sm:text-sm no-scrollbar"
          >
            {filteredBuildings.length === 0 ? (
              <li
                role="presentation"
                className="py-6 px-4 text-center text-xs text-muted-foreground space-y-1"
              >
                <AlertCircle className="size-5 mx-auto text-muted-foreground/60 mb-1.5" />
                <p className="font-medium text-foreground">No buildings found</p>
                <p className="text-[11px] text-muted-foreground">
                  Try searching by block name or abbreviation (e.g., MS, ES, Library, Canteen)
                </p>
              </li>
            ) : (
              filteredBuildings.map((building, index) => {
                const isSelected = value === building;
                const isHighlighted = highlightedIndex === index;

                return (
                  <li
                    key={building}
                    role="option"
                    aria-selected={isSelected}
                    data-highlighted={isHighlighted}
                    onClick={() => selectOption(building)}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    className={cn(
                      "flex items-center justify-between rounded-lg px-2.5 py-2 cursor-pointer transition-colors select-none",
                      isSelected
                        ? "bg-primary/10 text-primary font-medium"
                        : isHighlighted
                          ? "bg-muted text-foreground"
                          : "text-foreground/90 hover:bg-muted/70",
                    )}
                  >
                    <span className="flex items-center gap-2.5 truncate">
                      <Building2
                        className={cn(
                          "size-4 shrink-0 transition-colors",
                          isSelected
                            ? "text-primary"
                            : isHighlighted
                              ? "text-foreground"
                              : "text-muted-foreground",
                        )}
                      />
                      <span className="truncate">{building}</span>
                    </span>

                    {isSelected && (
                      <Check className="size-4 shrink-0 text-primary ml-2 animate-in zoom-in-75 duration-100" />
                    )}
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
