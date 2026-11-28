import {
  Calendar, CalendarClock, CreditCard, Home, LayoutDashboard, Link,
  MessageSquare, Scissors, Settings, User, Users,
} from "lucide-react";

export const dashboardPrimaryLinks = [
  { title: "Início", url: "/dashboard", icon: LayoutDashboard },
  { title: "Minha Agenda", shortTitle: "Agenda", url: "/dashboard/agenda", icon: CalendarClock },
  { title: "Agendamentos", url: "/dashboard/agendamentos", icon: Calendar },
];

const dashboardSectionLinks = [
  { title: "Funcionários", url: "/dashboard/funcionarios", icon: Users, adminOnly: true },
  { title: "Serviços", url: "/dashboard/servicos", icon: Scissors, adminOnly: true },
  { title: "Férias & Recessos", url: "/dashboard/ferias", icon: Calendar, adminOnly: true },
  { title: "Feedbacks", url: "/dashboard/feedbacks", icon: MessageSquare },
  { title: "Compartilhar Perfil", url: "/dashboard/share-profile", icon: Link, adminOnly: true },
];

const dashboardQuickLinks = [
  { title: "Site Principal", url: "/barbearias", icon: Home },
  { title: "Configurações", url: "/dashboard/settings", icon: Settings, adminOnly: true },
];

export const personalSettingsLink = { title: "Configurações Pessoais", url: "/dashboard/personal-settings", icon: User };
export const subscriptionLink = { title: "Assinatura", url: "/dashboard/subscription", icon: CreditCard };

export function dashboardNavigation(isAdmin: boolean) {
  return {
    sections: dashboardSectionLinks.filter((link) => isAdmin || !link.adminOnly),
    quick: dashboardQuickLinks.filter((link) => isAdmin || !link.adminOnly),
    // Assinatura oculta por enquanto (a rota continua existindo)
    account: [personalSettingsLink],
  };
}
