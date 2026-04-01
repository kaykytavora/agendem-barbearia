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
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

function DashboardLayoutContent({ children }: DashboardLayoutProps) {
  const { theme, setTheme, isClientRoute } = useTheme();
  const { openMobile, setOpenMobile } = useSidebar();
  const { user, profile, refreshProfile } = useAuth();
  const { toast } = useToast();

  // Força tema escuro para dashboard se não estiver em rota de cliente
  useEffect(() => {
    if (!isClientRoute && theme === 'light') {
      const savedAdminTheme = localStorage.getItem('admin-theme') || 'dark';
      if (savedAdminTheme === 'dark') {
        setTheme('dark');
      }
    }
  }, [isClientRoute, theme, setTheme]);

  // Auto-fix: Check for role mismatch and fix it
  useEffect(() => {
    const checkAndFixRole = async () => {
      if (!user) return;

      try {
        // Check actual role in funcionarios table
        const { data: funcionario, error } = await supabase
          .from('funcionarios')
          .select('nivel')
          .eq('user_id', user.id)
          .maybeSingle();

        if (error) {
          console.error("Error fetching funcionario:", error);
        }

        if (funcionario) {
          const dbRole = funcionario.nivel;
          const shouldBeAdmin = dbRole === 'dono' || dbRole === 'gerente';
          const currentIsAdmin = profile?.role === 'admin';

          if (shouldBeAdmin && !currentIsAdmin) {
            console.log("Fixing role mismatch: User is", dbRole, "but profile is", profile?.role);

            const { error: updateError } = await supabase
              .from('profiles')
              .update({ role: 'admin' })
              .eq('user_id', user.id);

            if (!updateError) {
              console.log("Role fixed successfully");
              await refreshProfile();
              toast({
                title: "Permissões atualizadas",
                description: "Suas permissões de acesso foram corrigidas. O sistema foi atualizado.",
              });
            }
          }
        }
      } catch (err) {
        console.error("Error in auto-fix role:", err);
      }
    };

    checkAndFixRole();
  }, [user, profile, refreshProfile, toast]);

  // Emergency Fix: Headless Recovery
  // If user has a barbershop but is not admin, AND there are NO admins for this barbershop, promote user.
  useEffect(() => {
    const checkHeadlessState = async () => {
      if (!user || !profile?.barbearia_id || profile.role === 'admin') return;

      try {
        // Count how many admins exist for this barbershop
        const { count, error } = await supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true })
          .eq('barbearia_id', profile.barbearia_id)
          .eq('role', 'admin');

        if (error) {
          console.error("Error checking admin count:", error);
          return;
        }

        // If NO admins exist, this is a headless state. Promote current user.
        if (count === 0) {
          console.log("Headless state detected! Promoting current user to admin.");

          const { error: updateError } = await supabase
            .from('profiles')
            .update({ role: 'admin' })
            .eq('user_id', user.id);

          if (!updateError) {
            await refreshProfile();
            toast({
              title: "Acesso de Dono Restaurado",
              description: "Detectamos que não havia administradores na barbearia. Seu acesso foi restaurado.",
              variant: "default"
            });
          }
        }
      } catch (err) {
        console.error("Error in headless recovery:", err);
      }
    };

    checkHeadlessState();
  }, [user, profile, refreshProfile, toast]);

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