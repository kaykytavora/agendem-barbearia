import { AgendemIcon } from "@/components/AgendemIcon";
import { NavLink } from "react-router-dom";
import { ChevronUp, LogOut } from "lucide-react";
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

import { dashboardNavigation, dashboardPrimaryLinks } from "@/lib/dashboard-navigation";

export function AppSidebar() {
  const { state, isMobile, setOpenMobile } = useSidebar();
  const { user, signOut, loading: authLoading } = useAuth(); // Use authLoading
  const { toast } = useToast();
  const navigate = useNavigate();
  const { role } = useUserRole();

  const collapsed = state === 'collapsed';

  const isAdmin = role === 'admin';

  const { sections, quick, account } = dashboardNavigation(isAdmin);
  const menuItems = [...dashboardPrimaryLinks, ...sections];

  const handleItemClick = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  const getNavCls = ({ isActive }: { isActive: boolean }) =>
    isActive
      ? "bg-primary text-primary-foreground font-medium shadow-brand-sm hover:bg-primary hover:text-primary-foreground"
      : "text-muted-foreground hover:bg-muted hover:text-foreground";

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
      collapsible="icon"
    >
      <SidebarHeader className={collapsed ? "p-2 py-4" : "px-5 py-5"}>
        {!collapsed ? (
          <div className="flex items-center gap-3">
            <AgendemIcon className="w-8 h-8 text-primary" />
            <div>
              <h2 className="font-display text-lg font-bold leading-tight tracking-tight">Agendem</h2>
              <p className="text-xs text-muted-foreground">Painel da barbearia</p>
            </div>
          </div>
        ) : (
          <AgendemIcon className="w-8 h-8 mx-auto text-primary" />
        )}
      </SidebarHeader>

      <SidebarContent role="navigation" aria-label="Navegação do painel" className="flex-1">
        <SidebarGroup>
          <SidebarGroupLabel className={collapsed ? "sr-only" : ""}>
            {authLoading ? <Skeleton className="h-4 w-24" /> : "Menu"}
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
                <SidebarMenu className="gap-1">
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
                            end
                            className={({ isActive }) => `flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors ${getNavCls({ isActive })}`}
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

        <SidebarGroup>
          <SidebarGroupLabel className={collapsed ? "sr-only" : ""}>Atalhos</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {quick.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end
                      className={({ isActive }) => `flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors ${getNavCls({ isActive })}`}
                      onClick={handleItemClick}
                      aria-label={item.title}
                      title={item.title}
                    >
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* User Profile & Logout */}
      <div className={collapsed ? "mt-auto border-t border-border/50 p-2" : "mt-auto border-t border-border/50 p-4"}>
        {!collapsed ? (
          <div className="space-y-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" aria-label="Menu da conta" className="h-auto w-full min-w-0 justify-between p-2 hover:bg-muted/50">
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar className="w-8 h-8">
                      <AvatarFallback className="bg-gradient-primary text-primary-foreground text-xs">
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
                  <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="end" className="w-56">
                {account.map((item) => (
                  <DropdownMenuItem key={item.url} asChild>
                    <NavLink to={item.url} end className="flex w-full items-center gap-2">
                      <item.icon className="h-4 w-4" />
                      {item.title}
                    </NavLink>
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => void handleLogout()} className="text-gray-900 dark:text-white">
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
                <Button variant="ghost" size="icon" className="w-8 h-8" aria-label="Menu da conta">
                  <Avatar className="w-8 h-8">
                    <AvatarFallback className="bg-gradient-primary text-primary-foreground text-xs">
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
                {account.map((item) => (
                  <DropdownMenuItem key={item.url} asChild>
                    <NavLink to={item.url} end className="flex w-full items-center gap-2">
                      <item.icon className="h-4 w-4" />
                      {item.title}
                    </NavLink>
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => void handleLogout()} className="text-gray-900 dark:text-white">
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
