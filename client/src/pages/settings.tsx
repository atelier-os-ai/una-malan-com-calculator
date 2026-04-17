import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Save, RotateCcw, Info } from "lucide-react";

// Settings are stored in-memory (no localStorage in sandboxed iframe)
// Defaults are the standard industry values
let savedSettings = {
  defaultFabricWidth: 54,
  defaultWasteFactor: 15,
  defaultCushionThickness: 5,
  defaultPatternRepeat: 0,
  measurementUnit: "inches" as "inches" | "cm",
};

export function getSettings() {
  return savedSettings;
}

const FABRIC_WIDTH_PRESETS = [
  { label: '48"', value: 48 },
  { label: '54"', value: 54 },
  { label: '60"', value: 60 },
];

export default function SettingsPage() {
  const { toast } = useToast();
  const [settings, setSettings] = useState({ ...savedSettings });

  const handleSave = () => {
    savedSettings = { ...settings };
    toast({
      title: "Settings Saved",
      description: "Default values have been updated",
    });
  };

  const handleReset = () => {
    const defaults = {
      defaultFabricWidth: 54,
      defaultWasteFactor: 15,
      defaultCushionThickness: 5,
      defaultPatternRepeat: 0,
      measurementUnit: "inches" as "inches" | "cm",
    };
    setSettings(defaults);
    savedSettings = { ...defaults };
    toast({
      title: "Settings Reset",
      description: "All values restored to factory defaults",
    });
  };

  const isDirty =
    settings.defaultFabricWidth !== savedSettings.defaultFabricWidth ||
    settings.defaultWasteFactor !== savedSettings.defaultWasteFactor ||
    settings.defaultCushionThickness !== savedSettings.defaultCushionThickness ||
    settings.defaultPatternRepeat !== savedSettings.defaultPatternRepeat;

  return (
    <div className="p-4 sm:p-6 max-w-lg" data-testid="page-settings">
      <div className="mb-6">
        <h2 className="text-lg font-display font-light tracking-wide mb-1">
          Settings
        </h2>
        <p className="text-xs text-muted-foreground">
          Configure default values for new calculations
        </p>
      </div>

      <div className="space-y-6">
        {/* Fabric Width */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground uppercase tracking-wider">
            Default Fabric Width
          </Label>
          <div className="flex gap-2 mb-2">
            {FABRIC_WIDTH_PRESETS.map((preset) => (
              <button
                key={preset.value}
                onClick={() =>
                  setSettings((s) => ({ ...s, defaultFabricWidth: preset.value }))
                }
                className={`px-3 py-1.5 rounded text-xs border transition-colors ${
                  settings.defaultFabricWidth === preset.value
                    ? "border-primary/50 bg-primary/10 text-primary"
                    : "border-border/40 bg-card text-foreground/70 hover:border-border/80"
                }`}
                data-testid={`button-preset-width-${preset.value}`}
              >
                {preset.label}
              </button>
            ))}
          </div>
          <div className="relative">
            <Input
              type="number"
              value={settings.defaultFabricWidth}
              onChange={(e) =>
                setSettings((s) => ({
                  ...s,
                  defaultFabricWidth: parseFloat(e.target.value) || 54,
                }))
              }
              className="bg-background border-border/60 h-10 pr-10 text-sm font-mono"
              data-testid="input-default-fabric-width"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
              in
            </span>
          </div>
          <p className="text-[10px] text-muted-foreground/70">
            Standard is 54 inches. Used as the default when starting a new calculation.
          </p>
        </div>

        {/* Waste Factor */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground uppercase tracking-wider">
            Default Waste Factor
          </Label>
          <div className="relative">
            <Input
              type="number"
              value={settings.defaultWasteFactor}
              onChange={(e) =>
                setSettings((s) => ({
                  ...s,
                  defaultWasteFactor: parseFloat(e.target.value) || 15,
                }))
              }
              className="bg-background border-border/60 h-10 pr-10 text-sm font-mono"
              data-testid="input-default-waste-factor"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
              %
            </span>
          </div>
          <div className="flex items-start gap-1.5 text-[10px] text-muted-foreground/70">
            <Info className="h-3 w-3 shrink-0 mt-0.5" />
            <span>Additional fabric for pattern matching and cutting waste. Industry standard is 10–15%.</span>
          </div>
        </div>

        {/* Cushion Thickness */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground uppercase tracking-wider">
            Default Cushion Thickness
          </Label>
          <div className="relative">
            <Input
              type="number"
              value={settings.defaultCushionThickness}
              onChange={(e) =>
                setSettings((s) => ({
                  ...s,
                  defaultCushionThickness: parseFloat(e.target.value) || 5,
                }))
              }
              className="bg-background border-border/60 h-10 pr-10 text-sm font-mono"
              data-testid="input-default-cushion-thickness"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
              in
            </span>
          </div>
          <p className="text-[10px] text-muted-foreground/70">
            Standard cushion thickness for loose seat and back cushions
          </p>
        </div>

        {/* Pattern Repeat */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground uppercase tracking-wider">
            Default Pattern Repeat
          </Label>
          <div className="relative">
            <Input
              type="number"
              value={settings.defaultPatternRepeat}
              onChange={(e) =>
                setSettings((s) => ({
                  ...s,
                  defaultPatternRepeat: parseFloat(e.target.value) || 0,
                }))
              }
              className="bg-background border-border/60 h-10 pr-10 text-sm font-mono"
              data-testid="input-default-pattern-repeat"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
              in
            </span>
          </div>
          <p className="text-[10px] text-muted-foreground/70">
            Set to 0 for solid fabrics with no pattern. Common repeats: 14", 18", 27"
          </p>
        </div>

        {/* Info note */}
        <div className="rounded-md bg-card border border-border/30 p-3">
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Settings are saved in memory for this session. When you start a new calculation or switch piece types in the Calculator, these defaults will be applied automatically.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3 pt-2">
          <Button
            onClick={handleSave}
            className="gap-2"
            style={{
              backgroundColor: "hsl(40 45% 55%)",
              color: "hsl(30 10% 7%)",
            }}
            data-testid="button-save-settings"
          >
            <Save className="h-4 w-4" />
            Save Settings
          </Button>
          <Button
            variant="outline"
            onClick={handleReset}
            className="gap-2"
            data-testid="button-reset-settings"
          >
            <RotateCcw className="h-4 w-4" />
            Reset to Defaults
          </Button>
          {isDirty && (
            <Badge variant="secondary" className="text-[10px] ml-auto">
              Unsaved changes
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
}
