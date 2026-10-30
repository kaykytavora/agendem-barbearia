import { SidebarProvider, SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import { Input } from "@/components/ui/input";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Search } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { useEffect } from "react";
import { cn } from "@/lib/utils";
import { Notifications } from "@/components/notifications/Notifications";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

function DashboardLayoutContent({ children }: DashboardLayoutProps) {
  const { theme, setTheme, isClientRoute } = useTheme();
  const { openMobile, setOpenMobile } = useSidebar();

  // Força tema escuro para dashboard se não estiver em rota de cliente
  useEffect(() => {
    if (!isClientRoute && theme === 'light') {
      const savedAdminTheme = localStorage.getItem('admin-theme') || 'dark';
      if (savedAdminTheme === 'dark') {
        setTheme('dark');
      }
    }
  }, [isClientRoute, theme, setTheme]);

  return (
    <div className="min-h-screen flex w-full bg-gradient-bg">
      {/* Sidebar - Hidden on mobile */}
      <div className="hidden md:block">
        <AppSidebar />
      </div>

      {/* Overlay for mobile - Removed since we don't show sidebar on mobile */}
      <div
        className={cn(
          "fixed inset-0 z-30 bg-black/50 transition-opacity duration-300 hidden",
          openMobile ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={() => setOpenMobile(false)}
      />

      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="h-16 border-b border-border/50 bg-card/30 backdrop-blur-sm flex items-center justify-between px-6 sticky top-0 z-40">
          <div className="flex items-center gap-4">
            {/* SidebarTrigger - Only show on desktop */}
            <div className="hidden md:block">
              <SidebarTrigger className="transition-all duration-200 hover:bg-muted/50" />
            </div>

            {/* Search */}
            <div className="relative hidden md:block">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Buscar..."
                className="pl-10 w-64 bg-background/50 border-border/50"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Notifications />
            <ThemeToggle />
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-auto pb-20 md:pb-0">
          {children}
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <MobileBottomNav />
    </div>
  );
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <SidebarProvider defaultOpen={true}>
      <DashboardLayoutContent>{children}</DashboardLayoutContent>
    </SidebarProvider>
  );
}