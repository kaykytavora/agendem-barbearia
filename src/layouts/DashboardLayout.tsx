import { SidebarProvider, SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Search } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { useEffect, useState } from "react";
import { Notifications } from "@/components/notifications/Notifications";
import { AssistenteBarbearia } from "@/components/dashboard/AssistenteBarbearia";
import { useAuth } from "@/contexts/AuthContext";
import { dashboardNavigation, dashboardPrimaryLinks } from "@/lib/dashboard-navigation";
import { useNavigate } from "react-router-dom";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

function DashboardPageSearch({ admin }: { admin: boolean }) {
  const navigate = useNavigate();
  const { sections, quick, account } = dashboardNavigation(admin);
  const links = [...dashboardPrimaryLinks, ...sections, ...quick, ...account];
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="hidden w-64 justify-start bg-background/50 font-normal text-muted-foreground md:inline-flex">
          <Search aria-hidden="true" />
          Buscar páginas
        </Button>
      </DialogTrigger>
      <DialogContent className="gap-0 p-0 sm:p-0">
        <DialogTitle className="sr-only">Buscar páginas</DialogTitle>
        <DialogDescription className="sr-only">Escolha uma página do painel para abrir.</DialogDescription>
        <Command label="Buscar pelo nome da página">
          <CommandInput placeholder="Buscar páginas..." className="pr-12" />
          <CommandList>
            <CommandEmpty>Nenhuma página encontrada.</CommandEmpty>
            {links.map(({ title, url, icon: Icon }) => (
              <CommandItem
                key={url}
                value={title}
                keywords={[title.normalize("NFD").replace(/\p{Diacritic}/gu, "")]}
                onSelect={() => {
                  setOpen(false);
                  navigate(url);
                }}
              >
                <Icon className="mr-2 h-4 w-4" aria-hidden="true" />
                {title}
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}

function DashboardLayoutContent({ children }: DashboardLayoutProps) {
  const { theme, setTheme, isClientRoute } = useTheme();
  const { open } = useSidebar();
  const { user, role, barbeariaId } = useAuth();

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

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Header */}
        <header className="glass-surface sticky top-0 z-40 flex h-14 items-center justify-between border-b border-border/50 px-3 sm:px-6 md:h-16">
          <div className="flex items-center gap-4">
            {/* SidebarTrigger - Only show on desktop */}
            <div className="hidden md:block">
              <SidebarTrigger aria-label={open ? "Recolher menu" : "Expandir menu"} aria-expanded={open} className="transition-all duration-200 hover:bg-muted/50" />
            </div>

            <DashboardPageSearch admin={role === "admin"} />
          </div>

          <div className="flex items-center gap-3">
            <Notifications />
            <ThemeToggle />
          </div>
        </header>

        {/* Main Content */}
        <main className="min-w-0 flex-1 pb-[calc(8.5rem+env(safe-area-inset-bottom))] md:pb-20">
          {children}
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <MobileBottomNav />
      {barbeariaId && (role === "admin" || role === "funcionario") && (
        <AssistenteBarbearia key={`${user?.id}:${barbeariaId}:${role}`} barbeariaId={barbeariaId} admin={role === "admin"} />
      )}
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
