import { NavLink, useLocation } from "react-router-dom";
import { BarChart3, Calendar, CalendarClock, Link as LinkIcon, Menu, Users, Scissors, Award, MessageSquare, Settings, LogOut, Clock, User, Home, CreditCard } from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const adminMenuItems = [
  {
    title: "Minha Agenda",
    url: "/dashboard/agenda",
    icon: CalendarClock,
  },
  {
    title: "Funcionários",
    url: "/dashboard/funcionarios",
    icon: Users,
  },
  {
    title: "Serviços",
    url: "/dashboard/servicos",
    icon: Scissors,
  },
  {
    title: "Férias",
    url: "/dashboard/ferias",
    icon: Calendar,
  },
  {
    title: "Fidelidade",
    url: "/dashboard/fidelidade",
    icon: Award,
  },
  {
    title: "Feedbacks",
    url: "/dashboard/feedbacks",
    icon: MessageSquare,
  },
  {
    title: "Site Principal",
    url: "/barbearias",
    icon: Home,
  },
  {
    title: "Configurações",
    url: "/dashboard/settings",
    icon: Settings,
  },
  {
    title: "Configurações Pessoais",
    url: "/dashboard/personal-settings",
    icon: User,
  },
  {
    title: "Assinatura",
    url: "/dashboard/subscription",
    icon: CreditCard,
  },
];

const funcionarioMenuItems = [
  {
    title: "Minha Agenda",
    url: "/dashboard/agenda",
    icon: CalendarClock,
  },
  {
    title: "Meus Horários",
    url: "/dashboard/horarios",
    icon: Clock,
  },
  {
    title: "Férias",
    url: "/dashboard/ferias",
    icon: Calendar,
  },
  {
    title: "Perfil",
    url: "/dashboard/perfil",
    icon: User,
  },
  {
    title: "Site Principal",
    url: "/barbearias",
    icon: Home,
  },
  {
    title: "Configurações",
    url: "/dashboard/settings",
    icon: Settings,
  },
  {
    title: "Configurações Pessoais",
    url: "/dashboard/personal-settings",
    icon: Settings,
  },
];

export function MobileBottomNav() {
  const { role } = useUserRole();
  const { signOut } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const isAdmin = role === 'admin';
  const menuItems = isAdmin ? adminMenuItems : funcionarioMenuItems;

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

  const isActive = (path: string) => {
    if (path === '/dashboard') {
      return location.pathname === '/dashboard';
    }
    return location.pathname.startsWith(path);
  };

  const getNavButtonClass = (path: string) => {
    const active = isActive(path);
    return cn(
      "flex flex-col items-center justify-center p-2 rounded-lg transition-all duration-200 min-h-[60px] flex-1",
      active
        ? "bg-primary/10 text-primary"
        : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
    );
  };

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-sm border-t border-border/50 px-2 py-1 safe-area-pb">
      <div className="flex items-center justify-around max-w-md mx-auto">
        {/* Dashboard */}
        <NavLink to="/dashboard" className={getNavButtonClass('/dashboard')} aria-label="Dashboard" title="Dashboard">
          <BarChart3 className="w-5 h-5 mb-1" />
          <span className="text-xs font-medium">Dashboard</span>
        </NavLink>

        {/* Agendamentos */}
        <NavLink to="/dashboard/agendamentos" className={getNavButtonClass('/dashboard/agendamentos')} aria-label="Agendamentos" title="Agendamentos">
          <Calendar className="w-5 h-5 mb-1" />
          <span className="text-xs font-medium">Agendamentos</span>
        </NavLink>

        {/* Compartilhar Perfil */}
        <NavLink to="/dashboard/share-profile" className={getNavButtonClass('/dashboard/share-profile')} aria-label="Compartilhar" title="Compartilhar">
          <LinkIcon className="w-5 h-5 mb-1" />
          <span className="text-xs font-medium">Compartilhar</span>
        </NavLink>

        {/* Menu Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="flex flex-col items-center justify-center p-2 rounded-lg transition-all duration-200 min-h-[60px] flex-1 text-muted-foreground hover:text-foreground hover:bg-muted/50"
            >
              <Menu className="w-5 h-5 mb-1" />
              <span className="text-xs font-medium">Menu</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 mb-2 max-h-80 overflow-y-auto">
            <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground border-b">
              Menu Principal
            </div>
            {menuItems.map((item) => {
              const Icon = item.icon;
              return (
                <DropdownMenuItem key={item.url} asChild>
                  <NavLink
                    to={item.url}
                    className="flex items-center gap-3 w-full px-3 py-2.5 text-sm cursor-pointer hover:bg-muted/50 transition-colors"
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
              onClick={handleLogout}
              className="flex items-center gap-3 px-3 py-2.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 cursor-pointer transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span>Sair</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}