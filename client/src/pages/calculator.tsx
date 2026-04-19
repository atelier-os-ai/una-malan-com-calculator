import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { calculateCOM, buildRulesMap, type COMConfig, type COMResult } from "@/lib/comEngine";
import { getSettings } from "@/pages/settings";
import { pieceTypeToGroupId, type Piece, type EngineRule } from "@shared/schema";

// Shared load-piece signal: set by Library, consumed by Calculator
let _pendingLoadId: number | null = null;
export function setPendingLoadId(id: number) { _pendingLoadId = id; }
function consumePendingLoadId(): number | null {
  const id = _pendingLoadId;
  _pendingLoadId = null;
  return id;
}
import {
  Save,
  ChevronRight,
  ChevronLeft,
  Armchair,
  Sofa,
  LayoutGrid,
  RectangleHorizontal,
  Ruler,
  Wrench,
  Layers,
  Scissors,
  Check,
  ChevronDown,
  ChevronUp,
  Square,
  Heart,
  BedDouble,
  PanelTop,
  Archive,
  UtensilsCrossed,
  PanelBottom,
  Sun,
  TreePalm,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";

// ─── Piece Types (grouped by category) ─────────────────────────
const PIECE_TYPE_GROUPS = [
  {
    label: "Seating",
    types: [
      { value: "chair", label: "Chair", icon: Armchair, hint: "Accent / arm chair" },
      { value: "dining_chair", label: "Dining Chair", icon: UtensilsCrossed, hint: "Side / armless" },
      { value: "loveseat", label: "Loveseat", icon: Heart, hint: "50–65\" wide" },
      { value: "sofa", label: "Sofa", icon: Sofa, hint: "70–96\" wide" },
      { value: "daybed", label: "Daybed", icon: BedDouble, hint: "Deep seat, 3-sided" },
      { value: "sectional", label: "Sectional", icon: LayoutGrid, hint: "L-shape" },
      { value: "chaise_end", label: "Chaise End", icon: RectangleHorizontal, hint: "Extended chaise" },
    ],
  },
  {
    label: "Beds & Headboards",
    types: [
      { value: "upholstered_bed", label: "Upholstered Bed", icon: BedDouble, hint: "HB + FB + rails" },
      { value: "headboard", label: "Headboard", icon: PanelTop, hint: "Standalone" },
    ],
  },
  {
    label: "Benches & Ottomans",
    types: [
      { value: "ottoman", label: "Ottoman", icon: Square, hint: "No arms/back" },
      { value: "bench", label: "Bench", icon: RectangleHorizontal, hint: "Optional arms" },
      { value: "storage_bench", label: "Storage Bench", icon: Archive, hint: "Lift-top trunk" },
    ],
  },
  {
    label: "Specialty",
    types: [
      { value: "drawer_fronts", label: "Drawer Fronts", icon: PanelBottom, hint: "Nightstand / dresser" },
      { value: "outdoor_cushions", label: "Outdoor Cushions", icon: TreePalm, hint: "Removable covers" },
    ],
  },
];

// Flat list for lookups
const ALL_PIECE_TYPES = PIECE_TYPE_GROUPS.flatMap((g) => g.types);

// Map UI piece types to engine piece types.
// Most types pass through directly — the engine's calculateCOM routes
// to the correct calculation method (single piece vs sectional vs chaise).
// We preserve the original type name so the engine can apply
// type-specific rounding (e.g. 0.25-yard for dining chairs, 0.5 for sofas).
function getEnginePieceType(type: string): string {
  // Only sectional and chaise_end need special routing;
  // all other types use calculateSinglePiece via the default path.
  return type;
}

// ─── Steps ─────────────────────────────────────────────────────
const STEPS = [
  { id: 1, label: "Basics", icon: Armchair },
  { id: 2, label: "Dimensions", icon: Ruler },
  { id: 3, label: "Configuration", icon: Wrench },
  { id: 4, label: "Cushions", icon: Layers },
  { id: 5, label: "Fabric", icon: Scissors },
];

// ─── Form State ────────────────────────────────────────────────
interface FormState {
  name: string;
  type: string;
  width: number;
  depth: number;
  height: number;
  seatHeight: number;
  seatType: "loose" | "tight";
  backType: "loose" | "tight";
  base: "upholstered" | "wood_legs";
  skirt: boolean;
  arms: boolean;
  welting: boolean;
  nSeatCush: number;
  nBackCush: number;
  cushThick: number;
  fabricWidth: number;
  patternRepeat: number;
  returnLength: number;
  chaiseLength: number;
}

function getDefaultForm(type: string): FormState {
  // Pull current settings to use as defaults for fabric/cushion values
  const settings = getSettings();
  const base: FormState = {
    name: "",
    type,
    width: 84,
    depth: 38,
    height: 34,
    seatHeight: 18,
    seatType: "loose",
    backType: "loose",
    base: "upholstered",
    skirt: false,
    arms: true,
    welting: true,
    nSeatCush: 2,
    nBackCush: 2,
    cushThick: settings.defaultCushionThickness,
    fabricWidth: settings.defaultFabricWidth,
    patternRepeat: settings.defaultPatternRepeat,
    returnLength: 96,
    chaiseLength: 66,
  };

  switch (type) {
    case "chair":
      return { ...base, width: 34, nSeatCush: 1, nBackCush: 1 };
    case "dining_chair":
      return { ...base, width: 22, depth: 22, height: 34, seatHeight: 18, arms: false, base: "wood_legs", backType: "tight", welting: false, nSeatCush: 1, nBackCush: 0 };
    case "loveseat":
      return { ...base, width: 58, nSeatCush: 2, nBackCush: 2 };
    case "daybed":
      return { ...base, width: 80, depth: 44 };
    case "ottoman":
      return { ...base, width: 30, depth: 24, height: 18, seatHeight: 18, arms: false, backType: "tight", seatType: "tight", nSeatCush: 0, nBackCush: 0 };
    case "bench":
      return { ...base, width: 52, depth: 20, height: 20, seatHeight: 20, backType: "tight", nSeatCush: 1, nBackCush: 0 };
    case "storage_bench":
      return { ...base, width: 48, depth: 20, height: 20, seatHeight: 20, arms: false, backType: "tight", seatType: "tight", nSeatCush: 0, nBackCush: 0 };
    case "upholstered_bed":
      // Bed: W=width of bed, D=length is represented as side rail length,
      // H=headboard height, seatHeight=footboard height (for side rail height calc)
      return { ...base, width: 66, depth: 85, height: 56, seatHeight: 24, arms: false, backType: "tight", seatType: "tight", base: "wood_legs", nSeatCush: 0, nBackCush: 0, welting: false };
    case "headboard":
      // Just a flat panel: W=width, H=height. Depth is minimal (thickness + mounting).
      return { ...base, width: 66, depth: 6, height: 56, seatHeight: 0, arms: false, backType: "tight", seatType: "tight", base: "wood_legs", nSeatCush: 0, nBackCush: 0, skirt: false, welting: false };
    case "drawer_fronts":
      // Each drawer front: W=total width of all fronts, D=single front height,
      // H=D (minimal — essentially flat panels)
      return { ...base, width: 24, depth: 8, height: 8, seatHeight: 0, arms: false, backType: "tight", seatType: "tight", base: "wood_legs", nSeatCush: 0, nBackCush: 0, skirt: false, welting: false };
    case "outdoor_cushions":
      // Just cushion covers — no frame upholstery
      return { ...base, width: 60, depth: 24, height: 20, seatHeight: 6, arms: false, seatType: "loose", backType: "loose", base: "wood_legs", nSeatCush: 1, nBackCush: 1, skirt: false, welting: true };
    case "sectional":
      return { ...base, width: 120, depth: 42, height: 30, seatHeight: 17, seatType: "tight", backType: "tight", returnLength: 108, nSeatCush: 0, nBackCush: 0 };
    case "chaise_end":
      return { ...base, width: 108, depth: 42, height: 30, seatHeight: 17, seatType: "tight", backType: "tight", chaiseLength: 78, nSeatCush: 0, nBackCush: 0 };
    default:
      return base;
  }
}

// NOTE: this is a fallback initial value only — the component re-computes
// on mount via useEffect to pick up current settings.
const defaultForm = getDefaultForm("sofa");

// ─── Per-component breakdown helper ──────────────────────────
// Uses the panel list from the engine to compute per-component yardage.
// The engine returns panels with names, cut dimensions, and quantities.
// We group panels by their name prefix and convert area → yards using
// the same utilization factor as the engine.
interface ComponentBreakdown {
  outsideBack: number;
  insideBack: number;
  insideArms: number;
  outsideArms: number;
  deck: number;
  frontRail: number;
  seatCushions: number;
  backCushions: number;
  skirt: number;
  welting: number;
}

function computeComponentBreakdown(form: FormState, result: COMResult): ComponentBreakdown {
  const fabricWidth = form.fabricWidth || 54;
  const UTILIZATION = 0.78;
  const toYards = (area: number) => area / (fabricWidth * 36) / UTILIZATION;

  // Sum panel areas by name pattern
  const panelArea = (namePattern: string | string[]) => {
    const patterns = Array.isArray(namePattern) ? namePattern : [namePattern];
    return result.panels.reduce((sum, p) => {
      const matches = patterns.some(pat => p.name.toLowerCase().includes(pat.toLowerCase()));
      return matches ? sum + p.cutW * p.cutH * p.qty : sum;
    }, 0);
  };

  // Welting: scale by width
  const weltScale = Math.max(form.width, 20) / 84;
  const weltingYards = form.welting ? 1.0 * weltScale : 0;

  return {
    outsideBack: Math.round(toYards(panelArea('Outside Back')) * 100) / 100,
    insideBack: Math.round(toYards(panelArea('Inside Back')) * 100) / 100,
    insideArms: Math.round(toYards(panelArea('Inside Arm')) * 100) / 100,
    outsideArms: Math.round(toYards(panelArea(['Outside Arm', 'Arm Front'])) * 100) / 100,
    deck: Math.round(toYards(panelArea('Deck')) * 100) / 100,
    frontRail: Math.round(toYards(panelArea(['Front Rail', 'Front Apron'])) * 100) / 100,
    seatCushions: Math.round(toYards(panelArea('Seat Cush')) * 100) / 100,
    backCushions: Math.round(toYards(panelArea('Back Cush')) * 100) / 100,
    skirt: Math.round(toYards(panelArea('Skirt')) * 100) / 100,
    welting: Math.round(weltingYards * 100) / 100,
  };
}

// ─── SVG Diagrams for piece configurations ──────────────────
function PieceDiagram({ form }: { form: FormState }) {
  const hasArms = form.arms;
  const isLooseSeat = form.seatType === "loose";
  const isLooseBack = form.backType === "loose";
  const hasSkirt = form.skirt;

  return (
    <svg viewBox="0 0 120 80" className="w-full h-auto max-w-[180px] opacity-60" fill="none" stroke="currentColor" strokeWidth="1.5">
      {/* Back */}
      <rect x="20" y="5" width="80" height="25" rx="3" className="stroke-current" strokeDasharray={isLooseBack ? "3 2" : undefined} />
      {isLooseBack && (
        <>
          <rect x="25" y="8" width="34" height="19" rx="2" className="stroke-primary/60" strokeWidth="1" />
          <rect x="61" y="8" width="34" height="19" rx="2" className="stroke-primary/60" strokeWidth="1" />
        </>
      )}

      {/* Seat / Deck */}
      <rect x="20" y="30" width="80" height="28" rx="2" className="stroke-current" />
      {isLooseSeat && (
        <>
          <rect x="24" y="33" width="35" height="22" rx="2" className="stroke-primary/60" strokeWidth="1" strokeDasharray="3 2" />
          <rect x="61" y="33" width="35" height="22" rx="2" className="stroke-primary/60" strokeWidth="1" strokeDasharray="3 2" />
        </>
      )}

      {/* Arms */}
      {hasArms && (
        <>
          <rect x="8" y="5" width="12" height="53" rx="3" className="stroke-current" />
          <rect x="100" y="5" width="12" height="53" rx="3" className="stroke-current" />
        </>
      )}

      {/* Skirt */}
      {hasSkirt && (
        <rect x="8" y="58" width="104" height="8" rx="1" className="stroke-muted-foreground/50" strokeDasharray="2 2" />
      )}

      {/* Base line */}
      <line x1="8" y1={hasSkirt ? 66 : 58} x2="112" y2={hasSkirt ? 66 : 58} className="stroke-muted-foreground/30" />
    </svg>
  );
}

// ─── Piece → Form mapping ──────────────────────────────────────
function pieceToForm(piece: Piece): FormState {
  return {
    name: piece.name,
    type: piece.type,
    width: piece.width,
    depth: piece.depth,
    height: piece.height,
    seatHeight: piece.seatHeight,
    seatType: piece.seatType as "loose" | "tight",
    backType: piece.backType as "loose" | "tight",
    base: piece.base as "upholstered" | "wood_legs",
    skirt: piece.skirt,
    arms: piece.arms,
    welting: piece.welting,
    nSeatCush: piece.nSeatCush,
    nBackCush: piece.nBackCush,
    cushThick: piece.cushThick,
    fabricWidth: piece.fabricWidth,
    patternRepeat: piece.patternRepeat,
    returnLength: piece.returnLength ?? 96,
    chaiseLength: piece.chaiseLength ?? 66,
  };
}

// ─── Main Component ────────────────────────────────────────────
export default function CalculatorPage() {
  const [step, setStep] = useState(1);
  // Initialize with fresh settings on mount (defaultForm may be stale from module load)
  const [form, setForm] = useState<FormState>(() => getDefaultForm("sofa"));
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [excludedSections, setExcludedSections] = useState<Set<string>>(new Set());
  const [prevTotal, setPrevTotal] = useState(0);
  const [animateYardage, setAnimateYardage] = useState(false);
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const yardageRef = useRef<HTMLSpanElement>(null);

  // Load a saved piece when navigating from Library
  useEffect(() => {
    const id = consumePendingLoadId();
    if (!id) return;

    (async () => {
      try {
        const res = await apiRequest("GET", `/api/pieces/${id}`);
        const piece: Piece = await res.json();
        setForm(pieceToForm(piece));
        setStep(1);
        setExcludedSections(new Set());
        setShowAdvanced(false);
        toast({
          title: "Piece Loaded",
          description: `${piece.name} — ${piece.totalYards.toFixed(2)} yds`,
        });
      } catch {
        toast({
          title: "Error",
          description: "Failed to load piece",
          variant: "destructive",
        });
      }
    })();
  }); // runs every render — consumePendingLoadId is idempotent (returns null after first call)

  const hasLooseCushions = form.seatType === "loose" || form.backType === "loose";

  // Determine which config options are relevant for this piece type
  const showSeatType = !["headboard", "drawer_fronts", "upholstered_bed"].includes(form.type);
  const showBackType = !["ottoman", "bench", "storage_bench", "headboard", "drawer_fronts", "upholstered_bed", "outdoor_cushions"].includes(form.type);
  const showBase = !["headboard", "drawer_fronts", "outdoor_cushions"].includes(form.type);
  const showArms = !["ottoman", "storage_bench", "headboard", "upholstered_bed", "drawer_fronts", "outdoor_cushions"].includes(form.type);
  const showSkirt = !["headboard", "drawer_fronts", "outdoor_cushions", "upholstered_bed"].includes(form.type);
  const showWelting = !["headboard", "drawer_fronts"].includes(form.type);
  // Skip config step entirely for types with no configurable options
  const skipConfigStep = ["headboard", "drawer_fronts"].includes(form.type);

  // Visible steps (skip config for flat panels, skip cushions if no loose cushions)
  const visibleSteps = useMemo(() => {
    let steps = STEPS;
    if (skipConfigStep) {
      steps = steps.filter((s) => s.id !== 3);
    }
    if (!hasLooseCushions) {
      steps = steps.filter((s) => s.id !== 4);
    }
    return steps;
  }, [hasLooseCushions, skipConfigStep]);

  const currentStepIndex = visibleSteps.findIndex((s) => s.id === step);
  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === visibleSteps.length - 1;

  const goNext = useCallback(() => {
    if (!isLastStep) {
      setStep(visibleSteps[currentStepIndex + 1].id);
    }
  }, [currentStepIndex, visibleSteps, isLastStep]);

  const goPrev = useCallback(() => {
    if (!isFirstStep) {
      setStep(visibleSteps[currentStepIndex - 1].id);
    }
  }, [currentStepIndex, visibleSteps, isFirstStep]);

  // Build engine config — handle new types by mapping
  const engineConfig: COMConfig = useMemo(() => {
    const cfg: COMConfig = {
      W: form.width,
      D: form.depth,
      H: form.height,
      seatHeight: form.seatHeight,
      seatType: form.seatType,
      backType: form.backType,
      base: form.base,
      skirt: form.skirt,
      arms: form.arms,
      welting: form.welting,
      nSeatCush: form.seatType === "loose" ? form.nSeatCush : 0,
      nBackCush: form.backType === "loose" ? form.nBackCush : 0,
      cushThick: form.cushThick,
      fabricWidth: form.fabricWidth,
      patternRepeat: form.patternRepeat,
    };

    // Type-specific overrides
    if (form.type === "ottoman" || form.type === "storage_bench") {
      cfg.arms = false;
      cfg.backType = "tight";
      cfg.seatType = "tight";
    }
    // dining_chair: arms default to false (side chair) but can be
    // toggled on for arm chairs — engine uses compact arm-pad model
    if (form.type === "headboard") {
      // Headboard is just a flat panel: outside back face + return wrap
      cfg.arms = false;
      cfg.backType = "tight";
      cfg.seatType = "tight";
      cfg.skirt = false;
    }
    if (form.type === "upholstered_bed") {
      // Bed: headboard panel + footboard panel + 2 side rails
      cfg.arms = false;
      cfg.backType = "tight";
      cfg.seatType = "tight";
    }
    if (form.type === "drawer_fronts") {
      // Flat panels only
      cfg.arms = false;
      cfg.backType = "tight";
      cfg.seatType = "tight";
      cfg.skirt = false;
      cfg.welting = false;
    }
    if (form.type === "outdoor_cushions") {
      // Outdoor: just cushion covers, minimal frame
      cfg.base = "wood_legs"; // no front rail
    }

    return cfg;
  }, [form]);

  // Fetch live rules for the active piece type group
  const activeGroupId = pieceTypeToGroupId(form.type);
  const { data: rulesData } = useQuery<EngineRule[]>({
    queryKey: ["/api/rules/group", activeGroupId],
    staleTime: 0,
    refetchOnMount: "always",
  });
  const rulesMap = useMemo(() => buildRulesMap(rulesData ?? []), [rulesData]);

  // Calculate result
  const result: COMResult = useMemo(() => {
    const engineType = getEnginePieceType(form.type);
    return calculateCOM(
      engineConfig,
      engineType,
      form.returnLength,
      form.chaiseLength,
      rulesMap
    );
  }, [engineConfig, form.type, form.returnLength, form.chaiseLength, rulesMap]);

  // Per-component breakdown
  const breakdown = useMemo(() => computeComponentBreakdown(form, result), [form, result]);

  // Toggle a section on/off for multi-fabric mode
  const toggleSection = (key: string) => {
    setExcludedSections(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Adjusted total: subtract excluded sections
  const adjustedTotal = useMemo(() => {
    if (excludedSections.size === 0) return result.total;
    const sectionMap: Record<string, number> = {
      outsideBack: breakdown.outsideBack,
      insideBack: breakdown.insideBack,
      insideArms: breakdown.insideArms,
      outsideArms: breakdown.outsideArms,
      deck: breakdown.deck,
      frontRail: breakdown.frontRail,
      seatCushions: breakdown.seatCushions,
      backCushions: breakdown.backCushions,
      skirt: breakdown.skirt,
      welting: breakdown.welting,
    };
    let excluded = 0;
    for (const key of excludedSections) {
      excluded += sectionMap[key] || 0;
    }
    return Math.ceil((result.total - excluded) * 4) / 4;
  }, [result.total, breakdown, excludedSections]);

  const hasExclusions = excludedSections.size > 0;

  // Animate yardage on change
  useEffect(() => {
    if (result.total !== prevTotal) {
      setPrevTotal(result.total);
      setAnimateYardage(true);
      const timer = setTimeout(() => setAnimateYardage(false), 400);
      return () => clearTimeout(timer);
    }
  }, [result.total, prevTotal]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/pieces", {
        name: form.name || `Untitled ${form.type}`,
        type: form.type,
        width: form.width,
        depth: form.depth,
        height: form.height,
        seatHeight: form.seatHeight,
        seatType: form.seatType,
        backType: form.backType,
        base: form.base,
        skirt: form.skirt,
        arms: form.arms,
        welting: form.welting,
        nSeatCush: form.nSeatCush,
        nBackCush: form.nBackCush,
        cushThick: form.cushThick,
        fabricWidth: form.fabricWidth,
        patternRepeat: form.patternRepeat,
        returnLength: form.type === "sectional" ? form.returnLength : null,
        chaiseLength: form.type === "chaise_end" ? form.chaiseLength : null,
        totalYards: result.total,
        bodyYards: result.bodyYards,
        armsYards: result.armsYards,
        cushionYards: result.cushionYards,
        createdAt: new Date().toISOString(),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pieces"] });
      toast({
        title: "Piece Saved",
        description: `${form.name || "Untitled"} — ${hasExclusions ? adjustedTotal.toFixed(2) : result.total.toFixed(2)} yds${hasExclusions ? " (partial)" : ""}`,
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save piece",
        variant: "destructive",
      });
    },
  });

  const updateField = useCallback(
    <K extends keyof FormState>(key: K, value: FormState[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  // When type changes, reset to full defaults for that type (preserve name + fabric)
  // Also clear multi-fabric exclusions and collapse advanced panel
  const handleTypeChange = useCallback((newType: string) => {
    setForm((prev) => {
      const defaults = getDefaultForm(newType);
      return {
        ...defaults,
        name: prev.name,
        // Use settings defaults for fabric, not previous form values
        fabricWidth: defaults.fabricWidth,
        patternRepeat: defaults.patternRepeat,
        returnLength: defaults.returnLength,
        chaiseLength: defaults.chaiseLength,
      };
    });
    setExcludedSections(new Set());
    setShowAdvanced(false);
  }, []);

  const numericInput = (
    key: keyof FormState,
    label: string,
    suffix?: string,
    helpText?: string
  ) => (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground uppercase tracking-wider">
        {label}
      </Label>
      <div className="relative">
        <Input
          type="number"
          value={form[key] as number}
          onChange={(e) => updateField(key, parseFloat(e.target.value) || 0)}
          className="bg-background border-border/60 h-10 pr-10 text-sm font-mono"
          data-testid={`input-${key}`}
        />
        {suffix && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
            {suffix}
          </span>
        )}
      </div>
      {helpText && (
        <p className="text-[10px] text-muted-foreground/70">{helpText}</p>
      )}
    </div>
  );

  // ─── Mobile Sticky Bar ─────────────────────────────────────
  const mobileBar = isMobile && (
    <div className="mobile-sticky-bar sticky top-0 z-50 flex items-center justify-between px-4 py-3 shadow-md">
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-display font-light tabular-nums">
          {hasExclusions ? adjustedTotal.toFixed(2) : result.total.toFixed(2)}
        </span>
        <span className="text-sm opacity-70">yards</span>
        {hasExclusions && (
          <span className="text-[10px] text-primary/80 font-medium">(partial)</span>
        )}
      </div>
      <Button
        onClick={() => saveMutation.mutate()}
        disabled={saveMutation.isPending}
        size="sm"
        className="bg-white/20 hover:bg-white/30 text-current border-0"
        data-testid="button-save-mobile"
      >
        <Save className="h-4 w-4 mr-1.5" />
        {saveMutation.isPending ? "Saving..." : "Save"}
      </Button>
    </div>
  );

  // ─── Results Panel (shared between mobile & desktop) ───────
  const resultsContent = (
    <>
      {/* Total Yardage */}
      <div className="px-6 pt-6 pb-4">
        <p className="text-[10px] text-muted-foreground uppercase tracking-[0.2em] mb-3">
          {hasExclusions ? "COM for This Fabric" : "Estimated Yardage"}
        </p>
        <div className="flex items-baseline gap-2">
          <span
            ref={yardageRef}
            className={`text-4xl font-display font-light tabular-nums transition-all ${animateYardage ? "yardage-animate" : ""}`}
            style={{ color: hasExclusions ? "hsl(var(--primary))" : "hsl(40 45% 55%)" }}
            data-testid="text-total-yards"
          >
            {hasExclusions ? adjustedTotal.toFixed(2) : result.total.toFixed(2)}
          </span>
          <span className="text-sm text-muted-foreground">yards</span>
        </div>
        {hasExclusions && (
          <p className="text-[10px] text-muted-foreground mt-1">
            {excludedSections.size} section{excludedSections.size > 1 ? "s" : ""} excluded · Full piece: {result.total.toFixed(2)} yds
          </p>
        )}
      </div>

      {/* Per-Component Breakdown */}
      <div className="px-6 space-y-2 flex-1 overflow-auto">
        <p className="text-[10px] text-muted-foreground uppercase tracking-[0.2em] mb-1">
          Per-Component Breakdown
        </p>

        <ComponentRow label="Outside Back" value={breakdown.outsideBack} total={result.total} color="hsl(40 45% 55%)" />
        <ComponentRow label="Inside Back" value={breakdown.insideBack} total={result.total} color="hsl(38 40% 52%)" />
        {form.arms && (
          <>
            <ComponentRow label="Inside Arms (pair)" value={breakdown.insideArms} total={result.total} color="hsl(35 35% 48%)" />
            <ComponentRow label="Outside Arms (pair)" value={breakdown.outsideArms} total={result.total} color="hsl(33 30% 45%)" />
          </>
        )}
        <ComponentRow label="Deck / Seat Platform" value={breakdown.deck} total={result.total} color="hsl(30 28% 42%)" />
        {breakdown.frontRail > 0 && (
          <ComponentRow label="Front Rail" value={breakdown.frontRail} total={result.total} color="hsl(28 25% 40%)" />
        )}
        {breakdown.seatCushions > 0 && (
          <ComponentRow label={`Seat Cushions (×${form.nSeatCush})`} value={breakdown.seatCushions} total={result.total} color="hsl(45 50% 55%)" />
        )}
        {breakdown.backCushions > 0 && (
          <ComponentRow label={`Back Cushions (×${form.nBackCush})`} value={breakdown.backCushions} total={result.total} color="hsl(42 45% 50%)" />
        )}
        {breakdown.skirt > 0 && (
          <ComponentRow label="Skirt" value={breakdown.skirt} total={result.total} color="hsl(25 20% 38%)" />
        )}
        <ComponentRow label="Welting / Piping" value={breakdown.welting} total={result.total} color="hsl(20 15% 35%)" />
        {result.bufferYards > 0 && (
          <ComponentRow label="Yardage Buffer" value={result.bufferYards} total={result.total} color="hsl(200 30% 50%)" />
        )}

        {/* Total row */}
        <div className="pt-3 border-t border-border/30">
          <div className="flex justify-between items-center">
            <span className="text-xs text-muted-foreground">{hasExclusions ? "Full Piece Total" : "Total"}</span>
            <span className={`text-sm font-mono font-medium ${hasExclusions ? "line-through text-muted-foreground" : ""}`} data-testid="text-breakdown-total">
              {result.total.toFixed(2)} yds
            </span>
          </div>
          {hasExclusions && (
            <div className="flex justify-between items-center mt-1">
              <span className="text-xs font-medium text-primary">COM for This Fabric</span>
              <span className="text-sm font-mono font-semibold text-primary" data-testid="text-adjusted-total">
                {adjustedTotal.toFixed(2)} yds
              </span>
            </div>
          )}
        </div>

        {/* Category Summary */}
        <div className="pt-3 border-t border-border/20 space-y-1">
          <p className="text-[10px] text-muted-foreground uppercase tracking-[0.2em]">
            By Category
          </p>
          <div className="flex justify-between text-xs">
            <span className="text-foreground/60">Body (Width-Spanning)</span>
            <span className="font-mono text-foreground/70">{result.bodyYards.toFixed(2)} yds</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-foreground/60">Arms &amp; Fixed</span>
            <span className="font-mono text-foreground/70">{result.armsYards.toFixed(2)} yds</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-foreground/60">Cushions</span>
            <span className="font-mono text-foreground/70">{result.cushionYards.toFixed(2)} yds</span>
          </div>
        </div>

        {/* Config Summary Badges */}
        <div className="pt-4 space-y-2">
          <p className="text-[10px] text-muted-foreground uppercase tracking-[0.2em]">
            Configuration
          </p>
          <div className="flex flex-wrap gap-1.5">
            <Badge className="text-[10px] font-normal bg-gold-subtle border-gold text-gold">
              {ALL_PIECE_TYPES.find(p => p.value === form.type)?.label || form.type}
            </Badge>
            <Badge variant="secondary" className="text-[10px] font-normal border border-border/40">
              {form.width}×{form.depth}×{form.height}"
            </Badge>
            <Badge variant="secondary" className="text-[10px] font-normal border border-border/40">
              {form.seatType === "loose" ? "Loose Seat" : "Tight Seat"}
            </Badge>
            <Badge variant="secondary" className="text-[10px] font-normal border border-border/40">
              {form.backType === "loose" ? "Loose Back" : "Tight Back"}
            </Badge>
            {form.arms && (
              <Badge variant="secondary" className="text-[10px] font-normal border border-border/40">
                Arms
              </Badge>
            )}
            {form.skirt && (
              <Badge variant="secondary" className="text-[10px] font-normal border border-border/40">
                Skirt
              </Badge>
            )}
            <Badge variant="secondary" className="text-[10px] font-normal border border-border/40">
              {form.base === "upholstered" ? "Upholstered Base" : "Wood Legs"}
            </Badge>
            <Badge variant="secondary" className="text-[10px] font-normal border border-border/40">
              {form.fabricWidth}" fabric
            </Badge>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="px-6 py-5 border-t border-border/30 shrink-0">
        <Button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
          className="w-full gap-2"
          style={{
            backgroundColor: "hsl(40 45% 55%)",
            color: "hsl(30 10% 7%)",
          }}
          data-testid="button-save-piece"
        >
          <Save className="h-4 w-4" />
          {saveMutation.isPending ? "Saving..." : "Save Piece"}
        </Button>
      </div>
    </>
  );

  // ─── Form Steps ──────────────────────────────────────────────
  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <div className="space-y-5 animate-fade-in-up" data-testid="step-basics" key="step-1">
            <div>
              <h2 className="text-lg font-display font-light tracking-wide mb-1">
                Piece Basics
              </h2>
              <p className="text-xs text-muted-foreground">
                Name your piece and select the type
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                Piece Name
              </Label>
              <Input
                value={form.name}
                onChange={(e) => updateField("name", e.target.value)}
                placeholder="e.g. Living Room Sofa"
                className="bg-background border-border/60 h-10 text-sm"
                data-testid="input-name"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                Piece Type
              </Label>
              <div className="space-y-4">
                {PIECE_TYPE_GROUPS.map((group) => (
                  <div key={group.label}>
                    <p className="text-[10px] text-muted-foreground/60 uppercase tracking-widest mb-1.5">{group.label}</p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {group.types.map((pt) => {
                        const Icon = pt.icon;
                        const isSelected = form.type === pt.value;
                        return (
                          <button
                            key={pt.value}
                            onClick={() => handleTypeChange(pt.value)}
                            className={`flex flex-col items-center gap-1.5 p-2.5 rounded-md border transition-all text-center ${
                              isSelected
                                ? "border-primary/50 bg-primary/8"
                                : "border-border/40 hover:border-border/80 bg-card"
                            }`}
                            data-testid={`button-type-${pt.value}`}
                          >
                            <Icon
                              className={`h-4 w-4 ${
                                isSelected
                                  ? "text-primary"
                                  : "text-muted-foreground"
                              }`}
                            />
                            <span
                              className={`text-[11px] font-medium leading-tight ${
                                isSelected ? "text-foreground" : "text-foreground/80"
                              }`}
                            >
                              {pt.label}
                            </span>
                            <span className="text-[9px] text-muted-foreground/60 leading-tight">
                              {pt.hint}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-5 animate-fade-in-up" data-testid="step-dimensions" key="step-2">
            <div>
              <h2 className="text-lg font-display font-light tracking-wide mb-1">
                Overall Dimensions
              </h2>
              <p className="text-xs text-muted-foreground">
                All measurements in inches
              </p>
            </div>

            {/* Contextual dimension labels by piece type */}
            {form.type === "headboard" ? (
              <div className="grid grid-cols-2 gap-4">
                {numericInput("width", "Width", "in", "Panel width")}
                {numericInput("height", "Height", "in", "Total panel height")}
                {numericInput("depth", "Depth / Thickness", "in", "Including padding")}
              </div>
            ) : form.type === "upholstered_bed" ? (
              <div className="grid grid-cols-2 gap-4">
                {numericInput("width", "Bed Width", "in", "Frame width (e.g. 66\" for Queen)")}
                {numericInput("depth", "Side Rail Length", "in", "Headboard to footboard")}
                {numericInput("height", "Headboard Height", "in", "Floor to top")}
                {numericInput("seatHeight", "Footboard Height", "in", "Floor to top of footboard")}
              </div>
            ) : form.type === "drawer_fronts" ? (
              <div className="grid grid-cols-2 gap-4">
                {numericInput("width", "Drawer Width", "in", "Width of each front")}
                {numericInput("depth", "Drawer Height", "in", "Height of each front")}
                {numericInput("nSeatCush", "Number of Drawers", "", "Total drawer fronts to cover")}
              </div>
            ) : form.type === "outdoor_cushions" ? (
              <div className="grid grid-cols-2 gap-4">
                {numericInput("width", "Seat Width", "in")}
                {numericInput("depth", "Seat Depth", "in")}
                {numericInput("height", "Back Height", "in", "If back cushions needed")}
                {numericInput("cushThick", "Cushion Thickness", "in")}
              </div>
            ) : (form.type === "sectional" || form.type === "chaise_end") ? (
              <div className="grid grid-cols-2 gap-4">
                {numericInput("depth", "Depth (D)", "in", "Front to back")}
                {numericInput("height", "Overall Height (H)", "in", "Floor to top of frame")}
                {numericInput("seatHeight", "Seat Height", "in")}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                {numericInput("width", "Width (W)", "in")}
                {numericInput("depth", "Depth (D)", "in")}
                {numericInput("height", "Overall Height (H)", "in", "Floor to top of frame")}
                {numericInput("seatHeight", "Seat Height", "in")}
              </div>
            )}

            {form.type === "sectional" && (
              <div className="pt-4 border-t border-border/30 space-y-4">
                <div>
                  <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wider">
                    L-Shape Sectional Layout
                  </p>
                  <p className="text-[11px] text-muted-foreground/70 mb-3">
                    An L-shape sectional has two arms — one at each end. Enter the full length of each side of the L.
                  </p>
                </div>

                {/* L-shape SVG diagram */}
                <div className="flex justify-center py-2">
                  <svg viewBox="0 0 200 140" className="w-full max-w-[260px] h-auto" fill="none" stroke="currentColor" strokeWidth="1.5">
                    {/* Main sofa section (horizontal) */}
                    <rect x="10" y="10" width="130" height="40" rx="3" className="stroke-current" />
                    <text x="75" y="34" textAnchor="middle" className="fill-primary text-[10px] font-mono" stroke="none">
                      Main Width (W)
                    </text>
                    {/* Left arm */}
                    <rect x="10" y="10" width="12" height="40" rx="2" className="stroke-muted-foreground/50" strokeDasharray="2 2" />
                    <text x="16" y="55" textAnchor="middle" className="fill-muted-foreground text-[7px]" stroke="none">ARM</text>

                    {/* Return section (vertical) */}
                    <rect x="100" y="10" width="40" height="120" rx="3" className="stroke-current" />
                    <text x="120" y="82" textAnchor="middle" className="fill-primary text-[10px] font-mono" stroke="none" transform="rotate(-90 120 82)">
                      Return Length
                    </text>
                    {/* Right arm at bottom of return */}
                    <rect x="100" y="118" width="40" height="12" rx="2" className="stroke-muted-foreground/50" strokeDasharray="2 2" />
                    <text x="120" y="127" textAnchor="middle" className="fill-muted-foreground text-[7px]" stroke="none">ARM</text>

                    {/* Corner zone indicator */}
                    <rect x="100" y="10" width="40" height="40" rx="0" className="stroke-primary/30" strokeDasharray="3 2" />
                    <text x="120" y="34" textAnchor="middle" className="fill-primary/40 text-[7px]" stroke="none">CORNER</text>

                    {/* Dimension arrows */}
                    <line x1="10" y1="65" x2="140" y2="65" className="stroke-muted-foreground/40" strokeWidth="0.5" />
                    <line x1="155" y1="10" x2="155" y2="130" className="stroke-muted-foreground/40" strokeWidth="0.5" />
                  </svg>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {numericInput("width", "Main Width (W)", "in", "Long side — arm to corner")}
                  {numericInput("returnLength", "Return Length", "in", "Short side — corner to arm")}
                </div>
              </div>
            )}

            {form.type === "chaise_end" && (
              <div className="pt-4 border-t border-border/30 space-y-4">
                <div>
                  <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wider">
                    Chaise End Layout
                  </p>
                  <p className="text-[11px] text-muted-foreground/70 mb-3">
                    A chaise end has one arm on the sofa side and an open extended lounging section on the other end.
                  </p>
                </div>

                {/* Chaise SVG diagram */}
                <div className="flex justify-center py-2">
                  <svg viewBox="0 0 200 140" className="w-full max-w-[260px] h-auto" fill="none" stroke="currentColor" strokeWidth="1.5">
                    {/* Main sofa section (horizontal) */}
                    <rect x="10" y="10" width="120" height="40" rx="3" className="stroke-current" />
                    <text x="70" y="34" textAnchor="middle" className="fill-primary text-[10px] font-mono" stroke="none">
                      Main Width (W)
                    </text>
                    {/* Left arm */}
                    <rect x="10" y="10" width="12" height="40" rx="2" className="stroke-muted-foreground/50" strokeDasharray="2 2" />
                    <text x="16" y="55" textAnchor="middle" className="fill-muted-foreground text-[7px]" stroke="none">ARM</text>

                    {/* Chaise extension (vertical, no arm at bottom) */}
                    <rect x="90" y="10" width="40" height="100" rx="3" className="stroke-current" />
                    <text x="110" y="68" textAnchor="middle" className="fill-primary text-[10px] font-mono" stroke="none" transform="rotate(-90 110 68)">
                      Chaise Length
                    </text>
                    {/* Open end label */}
                    <text x="110" y="120" textAnchor="middle" className="fill-muted-foreground/50 text-[7px]" stroke="none">OPEN END</text>

                    {/* Dimension arrows */}
                    <line x1="10" y1="58" x2="130" y2="58" className="stroke-muted-foreground/40" strokeWidth="0.5" />
                    <line x1="145" y1="10" x2="145" y2="110" className="stroke-muted-foreground/40" strokeWidth="0.5" />
                  </svg>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {numericInput("width", "Main Width (W)", "in", "Sofa side — arm to corner")}
                  {numericInput("chaiseLength", "Chaise Length", "in", "Extension — corner to open end")}
                </div>
              </div>
            )}
          </div>
        );

      case 3:
        return (
          <div className="space-y-5 animate-fade-in-up" data-testid="step-configuration" key="step-3">
            <div>
              <h2 className="text-lg font-display font-light tracking-wide mb-1">
                Configuration
              </h2>
              <p className="text-xs text-muted-foreground">
                Construction details
              </p>
            </div>

            <div className="space-y-5">
              {/* Seat Type - Visual Toggle Cards */}
              {showSeatType && (
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                  Seat Type
                </Label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => updateField("seatType", "loose")}
                    className={`flex flex-col items-center gap-2 p-3.5 rounded-md border transition-all ${
                      form.seatType === "loose"
                        ? "border-primary/50 bg-primary/8"
                        : "border-border/40 hover:border-border/80 bg-card"
                    }`}
                    data-testid="button-seat-loose"
                  >
                    <svg viewBox="0 0 40 24" className="w-8 h-auto" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <rect x="2" y="2" width="36" height="20" rx="2" />
                      <rect x="5" y="5" width="14" height="14" rx="1.5" strokeDasharray="2 1.5" className="stroke-primary/60" />
                      <rect x="21" y="5" width="14" height="14" rx="1.5" strokeDasharray="2 1.5" className="stroke-primary/60" />
                    </svg>
                    <span className={`text-xs ${form.seatType === "loose" ? "text-foreground" : "text-foreground/70"}`}>
                      Loose Cushion
                    </span>
                  </button>
                  <button
                    onClick={() => updateField("seatType", "tight")}
                    className={`flex flex-col items-center gap-2 p-3.5 rounded-md border transition-all ${
                      form.seatType === "tight"
                        ? "border-primary/50 bg-primary/8"
                        : "border-border/40 hover:border-border/80 bg-card"
                    }`}
                    data-testid="button-seat-tight"
                  >
                    <svg viewBox="0 0 40 24" className="w-8 h-auto" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <rect x="2" y="2" width="36" height="20" rx="2" />
                      <line x1="6" y1="8" x2="34" y2="8" className="stroke-muted-foreground/50" />
                      <line x1="6" y1="14" x2="34" y2="14" className="stroke-muted-foreground/50" />
                    </svg>
                    <span className={`text-xs ${form.seatType === "tight" ? "text-foreground" : "text-foreground/70"}`}>
                      Tight Seat
                    </span>
                  </button>
                </div>
              </div>
              )}

              {/* Back Type - Visual Toggle Cards */}
              {showBackType && (
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                  Back Type
                </Label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => updateField("backType", "loose")}
                    className={`flex flex-col items-center gap-2 p-3.5 rounded-md border transition-all ${
                      form.backType === "loose"
                        ? "border-primary/50 bg-primary/8"
                        : "border-border/40 hover:border-border/80 bg-card"
                    }`}
                    data-testid="button-back-loose"
                  >
                    <svg viewBox="0 0 40 28" className="w-8 h-auto" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <rect x="2" y="2" width="36" height="24" rx="2" />
                      <rect x="5" y="5" width="14" height="18" rx="1.5" strokeDasharray="2 1.5" className="stroke-primary/60" />
                      <rect x="21" y="5" width="14" height="18" rx="1.5" strokeDasharray="2 1.5" className="stroke-primary/60" />
                    </svg>
                    <span className={`text-xs ${form.backType === "loose" ? "text-foreground" : "text-foreground/70"}`}>
                      Loose Cushion
                    </span>
                  </button>
                  <button
                    onClick={() => updateField("backType", "tight")}
                    className={`flex flex-col items-center gap-2 p-3.5 rounded-md border transition-all ${
                      form.backType === "tight"
                        ? "border-primary/50 bg-primary/8"
                        : "border-border/40 hover:border-border/80 bg-card"
                    }`}
                    data-testid="button-back-tight"
                  >
                    <svg viewBox="0 0 40 28" className="w-8 h-auto" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <rect x="2" y="2" width="36" height="24" rx="2" />
                      <path d="M8 8 Q20 16 32 8" className="stroke-muted-foreground/50" strokeWidth="1" />
                      <path d="M8 16 Q20 24 32 16" className="stroke-muted-foreground/50" strokeWidth="1" />
                    </svg>
                    <span className={`text-xs ${form.backType === "tight" ? "text-foreground" : "text-foreground/70"}`}>
                      Tight Back
                    </span>
                  </button>
                </div>
              </div>
              )}

              {/* Base Type - Visual Toggle Cards */}
              {showBase && (
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                  Base
                </Label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => updateField("base", "upholstered")}
                    className={`flex flex-col items-center gap-2 p-3.5 rounded-md border transition-all ${
                      form.base === "upholstered"
                        ? "border-primary/50 bg-primary/8"
                        : "border-border/40 hover:border-border/80 bg-card"
                    }`}
                    data-testid="button-base-upholstered"
                  >
                    <svg viewBox="0 0 40 20" className="w-8 h-auto" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <rect x="2" y="2" width="36" height="16" rx="2" />
                    </svg>
                    <span className={`text-xs ${form.base === "upholstered" ? "text-foreground" : "text-foreground/70"}`}>
                      Upholstered
                    </span>
                  </button>
                  <button
                    onClick={() => updateField("base", "wood_legs")}
                    className={`flex flex-col items-center gap-2 p-3.5 rounded-md border transition-all ${
                      form.base === "wood_legs"
                        ? "border-primary/50 bg-primary/8"
                        : "border-border/40 hover:border-border/80 bg-card"
                    }`}
                    data-testid="button-base-wood"
                  >
                    <svg viewBox="0 0 40 24" className="w-8 h-auto" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <rect x="4" y="2" width="32" height="12" rx="2" />
                      <line x1="8" y1="14" x2="6" y2="22" />
                      <line x1="32" y1="14" x2="34" y2="22" />
                    </svg>
                    <span className={`text-xs ${form.base === "wood_legs" ? "text-foreground" : "text-foreground/70"}`}>
                      Wood Legs
                    </span>
                  </button>
                </div>
              </div>
              )}

              {/* Toggles */}
              <div className="space-y-3 pt-2">
                {showArms && (
                  <div className="flex items-center justify-between py-1">
                    <Label className="text-sm">Arms</Label>
                    <Switch
                      checked={form.arms}
                      onCheckedChange={(v) => updateField("arms", v)}
                      data-testid="switch-arms"
                    />
                  </div>
                )}
                {showSkirt && (
                <div className="flex items-center justify-between py-1">
                  <Label className="text-sm">Skirt</Label>
                  <Switch
                    checked={form.skirt}
                    onCheckedChange={(v) => updateField("skirt", v)}
                    data-testid="switch-skirt"
                  />
                </div>
                )}
                {showWelting && (
                <div className="flex items-center justify-between py-1">
                  <Label className="text-sm">Welting / Piping</Label>
                  <Switch
                    checked={form.welting}
                    onCheckedChange={(v) => updateField("welting", v)}
                    data-testid="switch-welting"
                  />
                </div>
                )}
              </div>

              {/* Diagram Preview */}
              <div className="pt-3 border-t border-border/20 flex justify-center">
                <PieceDiagram form={form} />
              </div>
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-5 animate-fade-in-up" data-testid="step-cushions" key="step-4">
            <div>
              <h2 className="text-lg font-display font-light tracking-wide mb-1">
                Cushion Details
              </h2>
              <p className="text-xs text-muted-foreground">
                Configure loose cushion quantities
              </p>
            </div>

            <div className="space-y-4">
              {form.seatType === "loose" &&
                numericInput("nSeatCush", "Seat Cushions", "", "Number of seat cushions")}
              {form.backType === "loose" &&
                numericInput("nBackCush", "Back Cushions", "", "Number of back cushions")}
              {numericInput("cushThick", "Cushion Thickness", "in")}
            </div>
          </div>
        );

      case 5:
        return (
          <div className="space-y-5 animate-fade-in-up" data-testid="step-fabric" key="step-5">
            <div>
              <h2 className="text-lg font-display font-light tracking-wide mb-1">
                Fabric Settings
              </h2>
              <p className="text-xs text-muted-foreground">
                Fabric width and pattern repeat
              </p>
            </div>

            <div className="space-y-4">
              {numericInput("fabricWidth", "Fabric Width", "in", 'Standard is 54"')}
              {numericInput(
                "patternRepeat",
                "Pattern Repeat",
                "in",
                "Set to 0 for no pattern"
              )}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  // ─── Advanced Component Override Mode ─────────────────────
  const componentItems = [
    { key: "outsideBack", label: "Outside Back", value: breakdown.outsideBack },
    { key: "insideBack", label: "Inside Back", value: breakdown.insideBack },
    { key: "insideArms", label: "Inside Arms", value: breakdown.insideArms, show: form.arms },
    { key: "outsideArms", label: "Outside Arms", value: breakdown.outsideArms, show: form.arms },
    { key: "deck", label: "Deck / Seat Platform", value: breakdown.deck },
    { key: "frontRail", label: "Front Rail", value: breakdown.frontRail, show: form.base === "upholstered" },
    { key: "seatCushions", label: "Seat Cushions", value: breakdown.seatCushions, show: form.seatType === "loose" },
    { key: "backCushions", label: "Back Cushions", value: breakdown.backCushions, show: form.backType === "loose" },
    { key: "skirt", label: "Skirt", value: breakdown.skirt, show: form.skirt },
    { key: "welting", label: "Welting / Piping", value: breakdown.welting },
  ].filter((c) => c.show !== false);

  const advancedSection = (
    <div className="mt-6 border-t border-border/30 pt-4">
      <button
        className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors w-full"
        onClick={() => setShowAdvanced(!showAdvanced)}
        data-testid="button-toggle-advanced"
      >
        {showAdvanced ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        <span className="uppercase tracking-wider">Advanced / Component Mode</span>
      </button>

      {showAdvanced && (
        <div className="mt-4 space-y-3 animate-fade-in-up">
          <p className="text-[10px] text-muted-foreground">
            Toggle sections off to exclude them from the COM total — use when different areas of the piece use different fabrics or leathers. Run the calculator once per material.
          </p>
          <div className="space-y-1.5">
            {componentItems.map((c) => {
              const isExcluded = excludedSections.has(c.key);
              return (
                <div
                  key={c.key}
                  className={`flex items-center gap-3 py-2 px-3 rounded border transition-colors ${
                    isExcluded
                      ? "bg-muted/30 border-border/10 opacity-50"
                      : "bg-card/50 border-border/20"
                  }`}
                >
                  <Switch
                    checked={!isExcluded}
                    onCheckedChange={() => toggleSection(c.key)}
                    data-testid={`switch-section-${c.key}`}
                    className="scale-75"
                  />
                  <span className={`text-xs flex-1 ${isExcluded ? "line-through text-muted-foreground" : "text-foreground/70"}`}>
                    {c.label}
                  </span>
                  <span className={`text-xs font-mono ${isExcluded ? "line-through text-muted-foreground" : "text-foreground/90"}`}>
                    {c.value.toFixed(2)} yds
                  </span>
                </div>
              );
            })}
          </div>
          {hasExclusions && (
            <div className="mt-3 p-3 rounded bg-primary/5 border border-primary/20">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-wider text-primary/70">COM for this fabric</span>
                <span className="text-sm font-mono font-semibold text-primary">{adjustedTotal.toFixed(2)} yds</span>
              </div>
              <p className="text-[9px] text-muted-foreground mt-1">
                {excludedSections.size} section{excludedSections.size > 1 ? "s" : ""} excluded — using a different material
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );

  // ─── Render ────────────────────────────────────────────────
  return (
    <div className="flex flex-col lg:flex-row h-full" data-testid="page-calculator">
      {/* Mobile sticky bar */}
      {mobileBar}

      {/* LEFT: Form Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Step Indicators */}
        <div className="flex items-center gap-1 px-4 sm:px-6 pt-5 pb-3 overflow-x-auto">
          {visibleSteps.map((s, i) => {
            const StepIcon = s.icon;
            const isCurrent = s.id === step;
            const isPast = i < currentStepIndex;
            return (
              <button
                key={s.id}
                onClick={() => setStep(s.id)}
                className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full text-xs transition-colors shrink-0 ${
                  isCurrent
                    ? "bg-primary/15 text-primary"
                    : isPast
                    ? "text-foreground/70 hover:text-foreground"
                    : "text-muted-foreground hover:text-muted-foreground/80"
                }`}
                data-testid={`button-step-${s.id}`}
              >
                {isPast ? (
                  <Check className="h-3.5 w-3.5 text-primary/70" />
                ) : (
                  <StepIcon className="h-3.5 w-3.5" />
                )}
                <span className="hidden sm:inline">{s.label}</span>
                {i < visibleSteps.length - 1 && (
                  <ChevronRight className="h-3 w-3 text-muted-foreground/40 ml-1" />
                )}
              </button>
            );
          })}
        </div>

        {/* Form Content */}
        <div className="flex-1 overflow-auto px-4 sm:px-6 pb-6">
          <div className="max-w-lg space-y-6">
            {renderStep()}
          </div>

          {/* Navigation Buttons */}
          <div className="flex items-center gap-3 mt-8 max-w-lg">
            {!isFirstStep && (
              <Button
                variant="outline"
                onClick={goPrev}
                className="gap-1.5"
                data-testid="button-prev"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Back
              </Button>
            )}
            {!isLastStep && (
              <Button
                onClick={goNext}
                className="gap-1.5 ml-auto"
                data-testid="button-next"
              >
                Next
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>

          {/* Advanced Component Mode - collapsible */}
          <div className="max-w-lg">
            {advancedSection}
          </div>
        </div>
      </div>

      {/* RIGHT: Results Panel (desktop) */}
      <div className="hidden lg:flex w-[360px] shrink-0 border-l border-border/50 bg-card/50 flex-col sticky top-0 h-full">
        {resultsContent}
      </div>

      {/* Bottom Results Panel (mobile) - shows below form */}
      {isMobile && (
        <div className="lg:hidden border-t border-border/50 bg-card/50 flex flex-col">
          {resultsContent}
        </div>
      )}
    </div>
  );
}

// ─── Component Row ──────────────────────────────────────────
function ComponentRow({
  label,
  value,
  total,
  color,
}: {
  label: string;
  value: number;
  total: number;
  color: string;
}) {
  const pct = total > 0 ? (value / total) * 100 : 0;
  if (value === 0) return null;
  return (
    <div className="space-y-0.5">
      <div className="flex justify-between items-center">
        <span className="text-[11px] text-foreground/70">{label}</span>
        <span className="text-[11px] font-mono text-foreground/60">
          {value.toFixed(2)} yds
        </span>
      </div>
      <div className="h-1 bg-border/20 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500 ease-out"
          style={{ width: `${Math.max(pct, 2)}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}
