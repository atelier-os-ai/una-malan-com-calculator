import { Calculator, Archive, Settings, SlidersHorizontal } from "lucide-react";
import { Link, useLocation } from "wouter";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";

const items = [
  { title: "COM Calculator", url: "/", icon: Calculator },
  { title: "Pieces Library", url: "/library", icon: Archive },
  { title: "Rules", url: "/rules", icon: SlidersHorizontal },
  { title: "Settings", url: "/settings", icon: Settings },
];

export function AppSidebar() {
  const [location] = useLocation();

  return (
    <Sidebar>
      <SidebarHeader className="px-6 py-6">
        <div className="flex flex-col gap-1.5">
          <h1
            className="font-display text-xl tracking-[0.25em] font-light"
            style={{ color: "hsl(40 45% 55%)" }}
            data-testid="text-brand-name"
          >
            UNA MALAN
          </h1>
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground font-medium">
              COM Calculator
            </span>
          </div>
          <div className="h-px bg-gradient-to-r from-primary/30 via-primary/10 to-transparent mt-1" />
        </div>
      </SidebarHeader>
      <SidebarContent className="px-3">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => {
                const isActive = location === item.url;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      className="h-10"
                    >
                      <Link href={item.url}>
                        <item.icon className="h-4 w-4" />
                        <span className="text-sm">{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="px-6 py-4">
        <div className="space-y-1.5">
          <p className="text-[10px] text-muted-foreground tracking-wider uppercase">
            Fabric Yardage Tool
          </p>
          <p className="text-[9px] text-muted-foreground/50">
            v4.4 — Per-piece-type rules system
          </p>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
