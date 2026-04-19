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
import umLogoUrl from "@assets/um-logo.svg";

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
          <img
            src={umLogoUrl}
            alt="Una Malan"
            className="h-14 w-auto self-start"
            data-testid="img-brand-logo"
          />
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
            v4.5 — Logo, instructions & buffer
          </p>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
