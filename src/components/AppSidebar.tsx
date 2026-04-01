import { NavLink } from "react-router-dom";
import {
  BarChart3,
  Calendar,
  CalendarClock,
  Users,
  Scissors,
  MessageSquare,
  Settings,
  LogOut,
  Home,
  Award,
  User,
  Link as LinkIcon,
  CreditCard,
  ChevronUp
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useNavigate } from "react-router-dom";
import { useUserRole } from "@/hooks/useUserRole";
import { Skeleton } from "@/components/ui/skeleton";
import { motion, AnimatePresence } from "framer-motion";

const adminMenuItems = [
  {
    title: "Dashboard",
    url: "/dashboard",
    icon: BarChart3,
  },
  {
    title: "Minha Agenda",
    url: "/dashboard/agenda",
    icon: CalendarClock,
  },
  {
    title: "Agendamentos",
    url: "/dashboard/agendamentos",
    icon: Calendar,
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
    title: "Férias & Recessos",
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
    title: "Compartilhar Perfil",
    url: "/dashboard/share-profile",
    icon: LinkIcon,
  },
];

const funcionarioMenuItems = [
  {
    title: "Minha Agenda",
    url: "/dashboard/agenda",
    icon: CalendarClock,
  },
  {
    title: "Agendamentos",
    url: "/dashboard/agendamentos",
    icon: Calendar,
  },
  {
    title: "Serviços",
    url: "/dashboard/servicos",
    icon: Scissors,
  },
  {
    title: "Feedbacks",
    url: "/dashboard/feedbacks",
    icon: MessageSquare,
  },
  {
    title: "Férias & Recessos",
    url: "/dashboard/ferias",
    icon: Calendar,
  },
];

export function AppSidebar() {
  const { state, isMobile, setOpenMobile } = useSidebar();
  const { user, signOut, loading: authLoading } = useAuth(); // Use authLoading
  const { toast } = useToast();
  const navigate = useNavigate();
  const { role } = useUserRole();

  const collapsed = state === 'collapsed';

  const isAdmin = role === 'admin';

  const menuItems = isAdmin ? adminMenuItems : funcionarioMenuItems;

  const handleItemClick = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  const getNavCls = ({ isActive }: { isActive: boolean }) =>
    isActive
      ? "bg-primary/10 text-primary font-medium border-l-2 border-primary"
      : "hover:bg-muted/50 text-gray-900 dark:text-white hover:text-gray-900 dark:hover:text-white";

  const handleLogout = async () => {
    try {
      const { error } = await signOut();

      // Se o erro for "Auth session missing", isso significa que já estamos deslogados
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
      // Em caso de erro, forçar limpeza do estado e redirecionar
      toast({
        title: "Logout realizado",
        description: "Sessão finalizada!",
      });
      navigate("/");
    }
  };

  const userName = user?.user_metadata?.name || user?.email?.split('@')[0] || "Usuário";
  const userInitials = userName.slice(0, 2).toUpperCase();

  return (
    <Sidebar
      className={`${collapsed ? "w-16" : "w-64"} transition-all duration-300`}
      collapsible="icon"
    >
      <SidebarHeader className="p-4 border-b border-border/50">
        {!collapsed ? (
          <div className="flex items-center gap-3">
            <img src="/icon-agendem.svg" alt="agendem" className="w-8 h-8" />
            <div>
              <h2 className="font-semibold text-sm text-gray-900 dark:text-white">agendem</h2>
              <p className="text-xs text-muted-foreground">Sistema de Gestão</p>
            </div>
          </div>
        ) : (
          <img src="/icon-agendem.svg" alt="agendem" className="w-8 h-8 mx-auto" />
        )}
      </SidebarHeader>

      <SidebarContent className="flex-1">
        <SidebarGroup>
          <SidebarGroupLabel className={collapsed ? "sr-only" : ""}>
            {authLoading ? <Skeleton className="h-4 w-24" /> : (isAdmin ? "Administração" : "Funcionário")}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <AnimatePresence mode="wait">
              <motion.div
                key={authLoading ? 'loading' : 'loaded'}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <SidebarMenu>
                  {authLoading ? (
                    <>
                      {[...Array(5)].map((_, i) => (
                        <SidebarMenuItem key={i}>
                          <div className="flex items-center gap-3 px-3 py-2">
                            <Skeleton className="w-4 h-4" />
                            {!collapsed && <Skeleton className="h-4 w-32" />}
                          </div>
                        </SidebarMenuItem>
                      ))}
                    </>
                  ) : (
                    menuItems.map((item) => (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton asChild className="w-full">
                          <NavLink
                            to={item.url}
                            className={({ isActive }) => `flex items-center gap-3 px-3 py-2 rounded-md transition-all ${getNavCls({ isActive })}`}
                            onClick={handleItemClick} // Close sidebar on mobile
                            aria-label={item.title}
                            title={item.title}
                          >
                            <item.icon className="w-4 h-4 flex-shrink-0" />
                            {!collapsed && <span className="text-sm">{item.title}</span>}
                          </NavLink>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))
                  )}
                </SidebarMenu>
              </motion.div>
            </AnimatePresence>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Quick Actions */}
        {!collapsed && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-gray-900 dark:text-white">Ações Rápidas</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <NavLink to="/barbearias" className="flex items-center gap-3 px-3 py-2 text-gray-900 dark:text-white hover:text-gray-900 dark:hover:text-white hover:bg-muted/50 rounded-md transition-all"
                      onClick={handleItemClick} // Close sidebar on mobile
                      aria-label="Site Principal"
                      title="Site Principal"
                    >
                      <Home className="w-4 h-4" />
                      <span className="text-sm">Site Principal</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <NavLink to="/dashboard/settings" className="flex items-center gap-3 px-3 py-2 text-gray-900 dark:text-white hover:text-gray-900 dark:hover:text-white hover:bg-muted/50 rounded-md transition-all w-full"
                      onClick={handleItemClick} // Close sidebar on mobile
                      aria-label="Configurações"
                      title="Configurações"
                    >
                      <Settings className="w-4 h-4" />
                      <span className="text-sm">Configurações</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      {/* User Profile & Logout */}
      <div className="p-4 border-t border-border/50 mt-auto">
        {!collapsed ? (
          <div className="space-y-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="w-full p-2 h-auto justify-between hover:bg-muted/50 min-w-0">
                  <div className="flex items-center gap-3">
                    <Avatar className="w-8 h-8">
                      <AvatarFallback className="bg-gradient-primary text-white text-xs">
                        {authLoading ? '...' : userInitials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0 text-left max-w-[140px]">
                      <p className="text-sm font-medium truncate" title={userName}>{authLoading ? <Skeleton className="h-4 w-20" /> : userName}</p>
                      <div className="flex items-center gap-1">
                        <Badge variant={isAdmin ? "default" : "secondary"} className="text-xs">
                          {authLoading ? <Skeleton className="h-4 w-12" /> : (isAdmin ? "Admin" : "Funcionário")}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <ChevronUp className="w-4 h-4 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="end" className="w-56">
                <DropdownMenuItem asChild>
                  <NavLink to="/dashboard/personal-settings" className="flex items-center gap-2 w-full" aria-label="Configurações Pessoais" title="Configurações Pessoais">
                    <User className="w-4 h-4" />
                    Configurações Pessoais
                  </NavLink>
                </DropdownMenuItem>
                {isAdmin && (
                  <DropdownMenuItem asChild>
                    <NavLink to="/dashboard/subscription" className="flex items-center gap-2 w-full" aria-label="Assinatura" title="Assinatura">
                      <CreditCard className="w-4 h-4" />
                      Assinatura
                    </NavLink>
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-gray-900 dark:text-white">
                  <LogOut className="w-4 h-4 mr-2" />
                  Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="w-8 h-8">
                  <Avatar className="w-8 h-8">
                    <AvatarFallback className="bg-gradient-primary text-white text-xs">
                      {authLoading ? '...' : userInitials}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="right" align="end" className="w-56">
                <div className="px-2 py-1.5 text-sm font-medium truncate" title={userName}>
                  {authLoading ? <Skeleton className="h-4 w-20" /> : userName}
                </div>
                <div className="px-2 pb-2">
                  <Badge variant={isAdmin ? "default" : "secondary"} className="text-xs">
                    {authLoading ? <Skeleton className="h-4 w-12" /> : (isAdmin ? "Admin" : "Funcionário")}
                  </Badge>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <NavLink to="/dashboard/personal-settings" className="flex items-center gap-2 w-full" aria-label="Configurações Pessoais" title="Configurações Pessoais">
                    <User className="w-4 h-4" />
                    Configurações Pessoais
                  </NavLink>
                </DropdownMenuItem>
                {isAdmin && (
                  <DropdownMenuItem asChild>
                    <NavLink to="/dashboard/subscription" className="flex items-center gap-2 w-full" aria-label="Assinatura" title="Assinatura">
                      <CreditCard className="w-4 h-4" />
                      Assinatura
                    </NavLink>
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-gray-900 dark:text-white">
                  <LogOut className="w-4 h-4 mr-2" />
                  Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>
    </Sidebar>
  );
}