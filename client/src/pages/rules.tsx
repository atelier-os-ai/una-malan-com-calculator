import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { EngineRule } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { useState, useCallback } from "react";
import { RotateCcw, Info, Check } from "lucide-react";
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
};

const CATEGORY_ORDER = [
  "allowances",
  "skirt",
  "welting",
  "utilization",
  "tight_construction",
];

function formatValue(rule: EngineRule, val: number): string {
  if (rule.unit === "%") {
    return `${Math.round(val * 100)}%`;
  }
  if (rule.unit === "×") {
    return `${val.toFixed(1)}×`;
  }
  // For regular numbers, show appropriate precision
  if (Number.isInteger(val)) return `${val}`;
  if (rule.step >= 1) return `${Math.round(val)}`;
  return `${val}`;
}

function formatWaste(val: number): string {
  return `${Math.round((1 - val) * 100)}% waste`;
}

function RuleRow({
  rule,
  defaultValue,
}: {
  rule: EngineRule;
  defaultValue: number | undefined;
}) {
  const { toast } = useToast();
  const [localValue, setLocalValue] = useState(rule.value);
  const [editingInput, setEditingInput] = useState(false);
  const [inputText, setInputText] = useState("");
  const isModified = defaultValue !== undefined && rule.value !== defaultValue;

  const mutation = useMutation({
    mutationFn: async (value: number) => {
      const res = await apiRequest("PATCH", `/api/rules/${rule.key}`, {
        value,
      });
      return res.json();
    },
    onSuccess: () => {
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

  return (
    <div className="group grid grid-cols-[1fr_auto_auto] items-center gap-4 py-3 px-4 rounded-lg hover:bg-muted/30 transition-colors">
      {/* Label + description */}
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

      {/* Slider */}
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

      {/* Value display */}
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
            {formatValue(rule, localValue)}
            {rule.unit === "%" && (
              <span className="text-[10px] text-muted-foreground/60 ml-1.5">
                {formatWaste(localValue)}
              </span>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

export default function RulesPage() {
  const { toast } = useToast();

  const { data: rules = [], isLoading } = useQuery<EngineRule[]>({
    queryKey: ["/api/rules"],
  });

  const resetMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/rules/reset");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rules"] });
      toast({ description: "All rules reset to defaults" });
    },
  });

  // Build a default value lookup from DEFAULT_RULES (imported in schema)
  // We'll match by key from the rules data itself — initial load has the defaults
  const defaultMap = new Map<string, number>();
  // We need DEFAULT_RULES from schema — let's import statically
  // For now we'll track defaults from the first load
  const DEFAULTS: Record<string, number> = {
    SEAM: 1,
    TUCK: 6,
    WRAP: 2,
    ARM_WIDTH: 8,
    SKIRT_DROP: 8,
    SKIRT_HEM: 2,
    SKIRT_PLEAT_MULTIPLIER: 1.5,
    WELT_BIAS_YIELD_FT_PER_YD: 78,
    WELT_MIN_YARDS: 0.5,
    CHAIR_UTILIZATION: 0.78,
    DINING_CHAIR_UTILIZATION: 0.7,
    SOFA_UTIL_TT: 0.55,
    SOFA_UTIL_LT: 0.74,
    SOFA_UTIL_LL: 0.62,
    TIGHT_BACK_PROFILE_PCT: 0.17,
    TIGHT_SEAT_PROFILE_MUL: 1.0,
    TIGHT_CROWN_WRAP: 4,
  };

  const grouped = CATEGORY_ORDER.map((cat) => ({
    key: cat,
    ...CATEGORY_META[cat],
    rules: rules.filter((r) => r.category === cat),
  })).filter((g) => g.rules.length > 0);

  const hasModified = rules.some((r) => DEFAULTS[r.key] !== undefined && r.value !== DEFAULTS[r.key]);

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
    <div className="p-6 max-w-3xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display text-lg tracking-wide" data-testid="text-rules-title">
            Engine Rules
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Adjust calculation constants live. Changes apply immediately to the
            calculator.
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
              Reset All
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Reset all rules to defaults?</AlertDialogTitle>
              <AlertDialogDescription>
                This will revert every rule to its original industry-standard
                value. Any adjustments will be lost.
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
                key={rule.key}
                rule={rule}
                defaultValue={DEFAULTS[rule.key]}
              />
            ))}
          </div>
        </section>
      ))}

      {/* Footer note */}
      <p className="text-[10px] text-muted-foreground/40 text-center pt-4">
        Values persist in the database. Click a value to type directly, or drag
        the slider.
      </p>
    </div>
  );
}
