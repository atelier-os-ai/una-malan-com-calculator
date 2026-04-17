import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { setPendingLoadId } from "@/pages/calculator";
import type { Piece } from "@shared/schema";
import {
  Trash2,
  Archive,
  Armchair,
  Sofa,
  LayoutGrid,
  RectangleHorizontal,
  Heart,
  Square,
  BedDouble,
  PanelTop,
  PanelBottom,
  UtensilsCrossed,
  TreePalm,
  Pencil,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const typeIcons: Record<string, typeof Armchair> = {
  chair: Armchair,
  dining_chair: UtensilsCrossed,
  loveseat: Heart,
  sofa: Sofa,
  daybed: BedDouble,
  ottoman: Square,
  bench: RectangleHorizontal,
  storage_bench: Archive,
  sectional: LayoutGrid,
  chaise_end: RectangleHorizontal,
  upholstered_bed: BedDouble,
  headboard: PanelTop,
  drawer_fronts: PanelBottom,
  outdoor_cushions: TreePalm,
};

const typeLabels: Record<string, string> = {
  chair: "Chair",
  dining_chair: "Dining Chair",
  loveseat: "Loveseat",
  sofa: "Sofa",
  daybed: "Daybed",
  ottoman: "Ottoman",
  bench: "Bench",
  storage_bench: "Storage Bench",
  sectional: "Sectional",
  chaise_end: "Chaise End",
  upholstered_bed: "Upholstered Bed",
  headboard: "Headboard",
  drawer_fronts: "Drawer Fronts",
  outdoor_cushions: "Outdoor Cushions",
};

const typeColors: Record<string, string> = {
  chair: "bg-amber-900/20 text-amber-400/80 border-amber-400/20",
  dining_chair: "bg-orange-900/20 text-orange-400/80 border-orange-400/20",
  loveseat: "bg-rose-900/20 text-rose-400/80 border-rose-400/20",
  sofa: "bg-blue-900/20 text-blue-400/80 border-blue-400/20",
  daybed: "bg-indigo-900/20 text-indigo-400/80 border-indigo-400/20",
  ottoman: "bg-emerald-900/20 text-emerald-400/80 border-emerald-400/20",
  bench: "bg-teal-900/20 text-teal-400/80 border-teal-400/20",
  storage_bench: "bg-teal-900/20 text-teal-400/80 border-teal-400/20",
  sectional: "bg-purple-900/20 text-purple-400/80 border-purple-400/20",
  chaise_end: "bg-cyan-900/20 text-cyan-400/80 border-cyan-400/20",
  upholstered_bed: "bg-violet-900/20 text-violet-400/80 border-violet-400/20",
  headboard: "bg-fuchsia-900/20 text-fuchsia-400/80 border-fuchsia-400/20",
  drawer_fronts: "bg-stone-900/20 text-stone-400/80 border-stone-400/20",
  outdoor_cushions: "bg-lime-900/20 text-lime-400/80 border-lime-400/20",
};

export default function LibraryPage() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [deleteTarget, setDeleteTarget] = useState<Piece | null>(null);

  const { data: pieces, isLoading } = useQuery<Piece[]>({
    queryKey: ["/api/pieces"],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/pieces/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pieces"] });
      toast({ title: "Piece deleted" });
      setDeleteTarget(null);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete piece",
        variant: "destructive",
      });
      setDeleteTarget(null);
    },
  });

  const handleLoadPiece = (piece: Piece) => {
    setPendingLoadId(piece.id);
    setLocation("/");
  };

  // Compute total yardage across all pieces
  const totalAllYards = pieces
    ? pieces.reduce((sum, p) => sum + (p.totalYards || 0), 0)
    : 0;

  return (
    <div className="p-4 sm:p-6 max-w-5xl" data-testid="page-library">
      <div className="mb-6">
        <h2 className="text-lg font-display font-light tracking-wide mb-1">
          Pieces Library
        </h2>
        <p className="text-xs text-muted-foreground">
          Your saved COM calculations
        </p>
      </div>

      {/* Summary bar */}
      {pieces && pieces.length > 0 && (
        <div className="flex items-center gap-6 mb-6 px-4 py-3 rounded-md bg-card border border-border/30">
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total Pieces</p>
            <p className="text-lg font-display font-light tabular-nums text-foreground">
              {pieces.length}
            </p>
          </div>
          <div className="h-8 w-px bg-border/30" />
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total COM</p>
            <p className="text-lg font-display font-light tabular-nums text-gold">
              {totalAllYards.toFixed(2)} <span className="text-xs text-muted-foreground font-sans">yards</span>
            </p>
          </div>
        </div>
      )}

      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-40 rounded-md" />
          ))}
        </div>
      )}

      {!isLoading && (!pieces || pieces.length === 0) && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Archive className="h-10 w-10 text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">No saved pieces yet</p>
          <p className="text-xs text-muted-foreground/60 mt-1">
            Use the calculator to create and save pieces
          </p>
        </div>
      )}

      {pieces && pieces.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {pieces.map((piece) => {
            const Icon = typeIcons[piece.type] || Sofa;
            const colorClass = typeColors[piece.type] || typeColors.sofa;
            return (
              <div
                key={piece.id}
                className="group relative border border-border/40 rounded-lg bg-card p-4 hover:border-border/70 transition-all hover:shadow-md"
                data-testid={`card-piece-${piece.id}`}
              >
                {/* Action buttons */}
                <div className="absolute top-3 right-3 z-10 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => handleLoadPiece(piece)}
                    title="Edit in Calculator"
                    data-testid={`button-load-${piece.id}`}
                  >
                    <Pencil className="h-3.5 w-3.5 text-primary/70" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setDeleteTarget(piece)}
                    disabled={deleteMutation.isPending}
                    data-testid={`button-delete-${piece.id}`}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>

                {/* Type badge + Icon */}
                <div className="flex items-center gap-2.5 mb-3">
                  <div className="h-9 w-9 rounded-md bg-primary/8 flex items-center justify-center shrink-0">
                    <Icon className="h-4.5 w-4.5 text-primary/70" />
                  </div>
                  <Badge
                    className={`text-[9px] uppercase tracking-wider font-medium border ${colorClass}`}
                  >
                    {typeLabels[piece.type] || piece.type}
                  </Badge>
                </div>

                {/* Name */}
                <h3
                  className="text-sm font-medium truncate mb-2"
                  data-testid={`text-piece-name-${piece.id}`}
                >
                  {piece.name}
                </h3>

                {/* Yardage */}
                <div className="flex items-baseline gap-1.5 mb-3">
                  <span
                    className="text-2xl font-display font-light tabular-nums"
                    style={{ color: "hsl(40 45% 55%)" }}
                    data-testid={`text-piece-yards-${piece.id}`}
                  >
                    {piece.totalYards.toFixed(2)}
                  </span>
                  <span className="text-xs text-muted-foreground">yards</span>
                </div>

                {/* Meta info */}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
                  <span className="font-mono">
                    {piece.width}×{piece.depth}×{piece.height}"
                  </span>
                  <span>•</span>
                  <span>{piece.fabricWidth}" fabric</span>
                </div>

                {/* Breakdown mini-bars */}
                <div className="mt-3 flex gap-1 h-1.5">
                  {piece.bodyYards > 0 && (
                    <div
                      className="rounded-full"
                      style={{
                        backgroundColor: "hsl(40 45% 55%)",
                        flex: piece.bodyYards,
                      }}
                      title={`Body: ${piece.bodyYards.toFixed(2)} yds`}
                    />
                  )}
                  {piece.armsYards > 0 && (
                    <div
                      className="rounded-full"
                      style={{
                        backgroundColor: "hsl(35 30% 45%)",
                        flex: piece.armsYards,
                      }}
                      title={`Arms: ${piece.armsYards.toFixed(2)} yds`}
                    />
                  )}
                  {piece.cushionYards > 0 && (
                    <div
                      className="rounded-full"
                      style={{
                        backgroundColor: "hsl(45 50% 55%)",
                        flex: piece.cushionYards,
                      }}
                      title={`Cushions: ${piece.cushionYards.toFixed(2)} yds`}
                    />
                  )}
                </div>

                {/* Date */}
                {piece.createdAt && (
                  <p className="text-[9px] text-muted-foreground/50 mt-2">
                    {new Date(piece.createdAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </p>
                )}

                {/* Clickable card overlay */}
                <button
                  className="absolute inset-0 z-0 cursor-pointer"
                  onClick={() => handleLoadPiece(piece)}
                  aria-label={`Edit ${piece.name}`}
                  data-testid={`button-card-load-${piece.id}`}
                />
              </div>
            );
          })}
        </div>
      )}

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent className="bg-card border-border/60">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Piece</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete{" "}
              <span className="font-medium text-foreground">{deleteTarget?.name}</span>?
              This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
