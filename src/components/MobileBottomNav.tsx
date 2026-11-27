import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { LogOut, Menu } from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { dashboardNavigation, dashboardPrimaryLinks } from "@/lib/dashboard-navigation";

function navClass(active: boolean) {
  return cn(
    "flex h-auto min-h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-lg px-0.5 py-1 transition-colors",
    active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
  );
}

export function MobileBottomNav() {
  const { role } = useUserRole();
  const { signOut } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const { sections, quick, account } = dashboardNavigation(role === "admin");
  const menuItems = [...sections, ...quick, ...account];
  const menuActive = menuItems.some(({ url }) => url === location.pathname);

  const handleLogout = async () => {
    try {
      const { error } = await signOut();

      if (error?.message === "Auth session missing!") {
        toast({
          title: "Logout realizado",
          description: "Sessão finalizada com sucesso!",
        });
        navigate("/");
        return;
      }

      if (error) {
        console.error("Erro no logout:", error);
        toast({
          title: "Erro",
          description: "Erro ao fazer logout",
          variant: "destructive"
        });
      } else {
        toast({
          title: "Logout realizado",
          description: "Até logo!",
        });
        navigate("/");
      }
    } catch (err) {
      console.error("Erro inesperado no logout:", err);
      toast({
        title: "Logout realizado",
        description: "Sessão finalizada!",
      });
      navigate("/");
    }
  };

  return (
    <nav aria-label="Navegação do painel" className="fixed inset-x-0 bottom-0 z-50 border-t border-border/50 bg-card/95 px-2 pt-1 pb-[max(0.25rem,env(safe-area-inset-bottom))] backdrop-blur-sm md:hidden">
      <div className="mx-auto grid max-w-md grid-cols-4 gap-1">
        {dashboardPrimaryLinks.map(({ title, shortTitle, url, icon: Icon }) => (
          <NavLink key={url} to={url} end aria-label={title} className={({ isActive }) => navClass(isActive)}>
            <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
            <span className="max-w-full break-words text-center text-[10px] font-medium leading-tight min-[360px]:text-[11px] min-[390px]:text-xs">
              {shortTitle ?? title}
            </span>
          </NavLink>
        ))}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className={navClass(menuActive)}
            >
              <Menu className="h-5 w-5" aria-hidden="true" />
              <span className="text-xs font-medium">Menu</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="end" sideOffset={8} className="w-56 max-h-[var(--radix-dropdown-menu-content-available-height)] overflow-y-auto overscroll-contain">
            {menuItems.map((item) => {
              const Icon = item.icon;
              return (
                <DropdownMenuItem key={item.url} asChild>
                  <NavLink
                    to={item.url}
                    end
                    className="flex items-center gap-3 w-full px-3 py-2.5 text-sm cursor-pointer hover:bg-muted/50 transition-colors aria-[current=page]:bg-primary/10 aria-[current=page]:text-primary"
                    aria-label={item.title}
                    title={item.title}
                  >
                    <Icon className="w-4 h-4 text-muted-foreground" />
                    <span>{item.title}</span>
                  </NavLink>
                </DropdownMenuItem>
              );
            })}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() => void handleLogout()}
              className="flex items-center gap-3 px-3 py-2.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 cursor-pointer transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span>Sair</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </nav>
  );
}
