import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { PIECE_TYPE_GROUPS, getDefaultValue, type EngineRule } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { useState, useCallback, useMemo, useEffect } from "react";
import {
  RotateCcw, Info, Armchair, Sofa, LayoutGrid,
  RectangleHorizontal, UtensilsCrossed, Square,
  BedDouble, PanelTop, Archive, PanelBottom,
  Heart, TreePalm, ChevronDown, ChevronUp, BookOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

// ─── Group icons ─────────────────────────────────────────────────
const GROUP_ICONS: Record<string, any> = {
  sofa_loveseat: Sofa,
  sectional: LayoutGrid,
  chaise: RectangleHorizontal,
  daybed: BedDouble,
  chair: Armchair,
  dining_chair: UtensilsCrossed,
  ottoman: Square,
  bench: Archive,
  upholstered_bed: BedDouble,
  headboard: PanelTop,
  drawer_fronts: PanelBottom,
  outdoor_cushions: TreePalm,
};

// ─── Category metadata ───────────────────────────────────────────
const CATEGORY_META: Record<string, { label: string; description: string }> = {
  allowances: {
    label: "Allowances",
    description: "Seam, tuck, and wrap allowances applied to every cut piece",
  },
  skirt: {
    label: "Skirt",
    description: "Drop, hem, and pleat multiplier for skirted pieces",
  },
  welting: {
    label: "Welting / Piping",
    description: "Bias-cut yield and minimums for welted seams",
  },
  utilization: {
    label: "Fabric Utilization",
    description:
      "How efficiently fabric is used — lower = more waste from cutting layout, seaming, selvedge",
  },
  tight_construction: {
    label: "Tight Construction",
    description:
      "Extra fabric for 3D profile wrapping on tight seat/back pieces",
  },
  buffer: {
    label: "Yardage Buffer",
    description:
      "Extra yardage added on top of the calculated amount. Use this to add a cushion for pieces that need more than the formula produces.",
  },
  piece_defaults: {
    label: "Piece Defaults",
    description:
      "Default arm count, arm length, and back style for this piece type. Calculator pre-fills these values.",
  },
};

const CATEGORY_ORDER = [
  "allowances",
  "skirt",
  "welting",
  "utilization",
  "tight_construction",
  "buffer",
  "piece_defaults",
];

function formatValue(rule: EngineRule, val: number): string {
  if (rule.unit === "%") {
    return `${Math.round(val * 100)}%`;
  }
  if (rule.unit === "×") {
    return `${val.toFixed(1)}×`;
  }
  let numStr: string;
  if (Number.isInteger(val)) numStr = `${val}`;
  else if (rule.step >= 1) numStr = `${Math.round(val)}`;
  else numStr = `${val}`;

  // Append unit suffix
  if (rule.unit === "in") return `${numStr}"`;
  if (rule.unit === "yds") return `${numStr} yds`;
  if (rule.unit === "ft/yd") return `${numStr} ft/yd`;
  return numStr;
}

function formatWaste(val: number): string {
  return `${Math.round((1 - val) * 100)}% waste`;
}

// ─── Back Style display ──────────────────────────────────────────
function formatBackStyle(val: number): string {
  if (val >= 1) return "Full";
  if (val >= 0.5) return "Partial";
  return "None";
}

// ─── Rule Row ────────────────────────────────────────────────────
function RuleRow({
  rule,
  groupId,
}: {
  rule: EngineRule;
  groupId: string;
}) {
  const { toast } = useToast();
  const [localValue, setLocalValue] = useState(rule.value);
  const [editingInput, setEditingInput] = useState(false);
  const [inputText, setInputText] = useState("");
  const defaultVal = getDefaultValue(rule.key, groupId);
  const isModified = defaultVal !== undefined && rule.value !== defaultVal;

  // Sync local value when rule changes from server
  useEffect(() => {
    setLocalValue(rule.value);
  }, [rule.value]);

  const mutation = useMutation({
    mutationFn: async (value: number) => {
      const res = await apiRequest("PATCH", `/api/rules/group/${groupId}/${rule.key}`, {
        value,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rules/group", groupId] });
      queryClient.invalidateQueries({ queryKey: ["/api/rules"] });
      toast({
        description: `${rule.label} updated`,
        duration: 1500,
      });
    },
    onError: () => {
      setLocalValue(rule.value);
      toast({ description: "Failed to update", variant: "destructive" });
    },
  });

  const commitValue = useCallback(
    (val: number) => {
      const clamped = Math.max(
        rule.min ?? -Infinity,
        Math.min(rule.max ?? Infinity, val)
      );
      setLocalValue(clamped);
      mutation.mutate(clamped);
    },
    [rule, mutation]
  );

  const handleSliderChange = useCallback(
    (vals: number[]) => {
      setLocalValue(vals[0]);
    },
    []
  );

  const handleSliderCommit = useCallback(
    (vals: number[]) => {
      commitValue(vals[0]);
    },
    [commitValue]
  );

  const handleInputSubmit = useCallback(() => {
    const parsed = parseFloat(inputText);
    if (!isNaN(parsed)) {
      commitValue(parsed);
    }
    setEditingInput(false);
  }, [inputText, commitValue]);

  // Special display for back style
  const isBackStyle = rule.key === "DEFAULT_BACK_STYLE";

  return (
    <div className="group grid grid-cols-[1fr_auto_auto] items-center gap-4 py-3 px-4 rounded-lg hover:bg-muted/30 transition-colors">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground">
            {rule.label}
          </span>
          {isModified && (
            <span className="inline-flex items-center px-1.5 py-0.5 text-[9px] uppercase tracking-wider font-medium rounded bg-primary/15 text-primary">
              Modified
            </span>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="h-3.5 w-3.5 text-muted-foreground/50 cursor-help shrink-0" />
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-[280px]">
              <p className="text-xs">{rule.description}</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>

      <div className="w-[180px]">
        <Slider
          value={[localValue]}
          min={rule.min ?? 0}
          max={rule.max ?? 100}
          step={rule.step}
          onValueChange={handleSliderChange}
          onValueCommit={handleSliderCommit}
          data-testid={`slider-${rule.key}`}
        />
      </div>

      <div className="w-[80px] text-right">
        {editingInput ? (
          <Input
            autoFocus
            className="h-7 w-[72px] text-xs text-right px-2"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onBlur={handleInputSubmit}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleInputSubmit();
              if (e.key === "Escape") setEditingInput(false);
            }}
            data-testid={`input-${rule.key}`}
          />
        ) : (
          <button
            className="inline-flex items-center justify-end text-sm font-mono tabular-nums cursor-pointer hover:text-primary transition-colors w-full"
            onClick={() => {
              setInputText(String(localValue));
              setEditingInput(true);
            }}
            data-testid={`value-${rule.key}`}
          >
            {isBackStyle ? (
              <span>{formatBackStyle(localValue)}</span>
            ) : (
              <>
                {formatValue(rule, localValue)}
                {rule.unit === "%" && (
                  <span className="text-[10px] text-muted-foreground/60 ml-1.5">
                    {formatWaste(localValue)}
                  </span>
                )}
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Instructions Panel ──────────────────────────────────────────
function InstructionsPanel() {
  const [open, setOpen] = useState(false);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button
          className="w-full flex items-center gap-2.5 px-4 py-3 rounded-lg border border-border/50 bg-muted/30 hover:bg-muted/50 transition-colors text-left group"
          data-testid="button-toggle-instructions"
        >
          <BookOpen className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="text-xs font-medium text-muted-foreground flex-1">
            How to Use the Rules Editor
          </span>
          {open ? (
            <ChevronUp className="h-3.5 w-3.5 text-muted-foreground/60" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground/60" />
          )}
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-2 px-4 py-4 rounded-lg border border-border/40 bg-background space-y-4 text-xs text-muted-foreground leading-relaxed">
          <div>
            <h4 className="font-medium text-foreground mb-1">Overview</h4>
            <p>
              Each piece type group has its own independent set of rules that control how the COM engine calculates yardage.
              Select a piece type on the left, then adjust any values below. Changes apply immediately to the calculator.
            </p>
          </div>
          <div>
            <h4 className="font-medium text-foreground mb-1">Adjusting Values</h4>
            <ul className="list-disc list-inside space-y-0.5 pl-1">
              <li>Drag the slider to change a value, or click the number on the right to type directly.</li>
              <li>Rules marked <span className="inline-flex items-center px-1 py-0 text-[9px] uppercase tracking-wider font-medium rounded bg-primary/15 text-primary">Modified</span> have been changed from the industry-standard default.</li>
              <li>Use the <strong>Reset</strong> button to revert all rules for the current group back to defaults.</li>
            </ul>
          </div>
          <div>
            <h4 className="font-medium text-foreground mb-1">Rule Categories</h4>
            <ul className="list-disc list-inside space-y-0.5 pl-1">
              <li><strong>Allowances</strong> — Seam, tuck-in, and wrap-around margins on every cut piece.</li>
              <li><strong>Skirt</strong> — Drop height, hem, and pleat style for skirted pieces.</li>
              <li><strong>Welting / Piping</strong> — Bias-cut yield and minimum yardage for welted seams.</li>
              <li><strong>Fabric Utilization</strong> — Efficiency factor (lower % = more cutting waste). Sofa-family groups also have separate rates for Tight/Tight, Loose/Tight, and Loose/Loose configurations.</li>
              <li><strong>Tight Construction</strong> — Extra fabric for 3D profile wrapping on tight seat/back pieces.</li>
              <li><strong>Yardage Buffer</strong> — Extra yards added to the final total. Use this to pad pieces that need more than the formula produces based on your knowledge of the piece.</li>
              <li><strong>Piece Defaults</strong> — Default arm count, arm length, and back style (chaise/daybed groups only). These pre-fill the calculator form.</li>
            </ul>
          </div>
          <div>
            <h4 className="font-medium text-foreground mb-1">Tips</h4>
            <ul className="list-disc list-inside space-y-0.5 pl-1">
              <li>Start with the Yardage Buffer if a piece type consistently needs more yardage — it's the simplest adjustment.</li>
              <li>Only change Allowances or Utilization if you understand how they affect the surface-area calculation.</li>
              <li>Each group is fully independent — changing sofa rules does not affect dining chairs or any other group.</li>
            </ul>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

// ─── Main Rules Page ─────────────────────────────────────────────
export default function RulesPage() {
  const { toast } = useToast();
  const [activeGroup, setActiveGroup] = useState<string>("sofa_loveseat");

  const { data: rules = [], isLoading } = useQuery<EngineRule[]>({
    queryKey: ["/api/rules/group", activeGroup],
    staleTime: 0,
    refetchOnMount: "always",
  });

  const resetMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/rules/reset/${activeGroup}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rules/group", activeGroup] });
      queryClient.invalidateQueries({ queryKey: ["/api/rules"] });
      toast({ description: `Rules reset to defaults for ${PIECE_TYPE_GROUPS.find(g => g.id === activeGroup)?.label}` });
    },
  });

  const grouped = useMemo(() => {
    return CATEGORY_ORDER.map((cat) => ({
      key: cat,
      ...(CATEGORY_META[cat] || { label: cat, description: "" }),
      rules: rules.filter((r) => r.category === cat),
    })).filter((g) => g.rules.length > 0);
  }, [rules]);

  const hasModified = useMemo(() => {
    return rules.some((r) => {
      const def = getDefaultValue(r.key, activeGroup);
      return def !== undefined && r.value !== def;
    });
  }, [rules, activeGroup]);

  const activeGroupMeta = PIECE_TYPE_GROUPS.find(g => g.id === activeGroup);

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-6 w-48 bg-muted rounded" />
          <div className="h-4 w-80 bg-muted/50 rounded" />
          <div className="space-y-3 mt-8">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-12 bg-muted/30 rounded" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      {/* Group selector sidebar */}
      <div className="w-[200px] border-r flex flex-col py-4 shrink-0 overflow-y-auto">
        <div className="px-4 mb-3">
          <h3 className="text-[10px] uppercase tracking-[0.2em] font-medium text-muted-foreground">
            Piece Types
          </h3>
        </div>
        <nav className="space-y-0.5 px-2">
          {PIECE_TYPE_GROUPS.map((group) => {
            const Icon = GROUP_ICONS[group.id] || Square;
            const isActive = activeGroup === group.id;
            return (
              <button
                key={group.id}
                onClick={() => setActiveGroup(group.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-left text-sm transition-colors ${
                  isActive
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                }`}
                data-testid={`group-${group.id}`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="truncate text-xs">{group.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Rules content */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 max-w-3xl mx-auto space-y-8">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div>
              <h1 className="font-display text-lg tracking-wide" data-testid="text-rules-title">
                {activeGroupMeta?.label || "Rules"}
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Adjust calculation constants for{" "}
                <span className="text-foreground font-medium">
                  {activeGroupMeta?.label?.toLowerCase()}
                </span>{" "}
                pieces. Changes apply immediately to the calculator.
              </p>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!hasModified}
                  className="gap-1.5"
                  data-testid="button-reset-rules"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Reset
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    Reset {activeGroupMeta?.label} rules to defaults?
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    This will revert all rules for{" "}
                    {activeGroupMeta?.label?.toLowerCase()} to their original
                    industry-standard values. Any adjustments will be lost.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => resetMutation.mutate()}
                    data-testid="button-confirm-reset"
                  >
                    Reset
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>

          {/* Inline Instructions */}
          <InstructionsPanel />

          {/* Rule sections */}
          {grouped.map((group) => (
            <section key={group.key} data-testid={`section-${group.key}`}>
              <div className="mb-3">
                <h2 className="text-xs uppercase tracking-[0.2em] font-medium text-muted-foreground">
                  {group.label}
                </h2>
                <p className="text-[11px] text-muted-foreground/60 mt-0.5">
                  {group.description}
                </p>
              </div>
              <div className="border rounded-lg divide-y divide-border/50">
                {group.rules.map((rule) => (
                  <RuleRow
                    key={`${activeGroup}-${rule.key}`}
                    rule={rule}
                    groupId={activeGroup}
                  />
                ))}
              </div>
            </section>
          ))}

          {rules.length === 0 && !isLoading && (
            <p className="text-sm text-muted-foreground text-center py-8">
              No rules configured for this group.
            </p>
          )}

          {/* Footer note */}
          <p className="text-[10px] text-muted-foreground/40 text-center pt-4">
            Each piece type has its own independent rule set. Click a value to
            type directly, or drag the slider.
          </p>
        </div>
      </div>
    </div>
  );
}
