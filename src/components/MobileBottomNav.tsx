import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarPlus } from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";
import { useAuth } from "@/contexts/AuthContext";
import { dashboardNavigation, dashboardPrimaryLinks } from "@/lib/dashboard-navigation";
import { DockNavegacao, type GrupoDock } from "@/components/DockNavegacao";
import { EVENTO_ABRIR_ASSISTENTE } from "@/lib/eventos";

/** Navegação do painel da barbearia no celular. */
export function MobileBottomNav() {
  const { role } = useUserRole();
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const { sections, quick, account } = dashboardNavigation(role === "admin");

  const grupos: GrupoDock[] = useMemo(() => [
    { titulo: "Agenda", itens: [...dashboardPrimaryLinks, { title: "Novo agendamento", url: "/dashboard/new-appointment", icon: CalendarPlus }] },
    { titulo: "Gestão", itens: sections },
    { titulo: "Conta", itens: [...quick, ...account] },
  ].filter((g) => g.itens.length > 0), [sections, quick, account]);

  return (
    <DockNavegacao
      rotulo="Navegação do painel"
      id="painel"
      principais={dashboardPrimaryLinks}
      grupos={grupos}
      onAssistente={() => window.dispatchEvent(new Event(EVENTO_ABRIR_ASSISTENTE))}
      onSair={async () => { await signOut(); navigate("/"); }}
    />
  );
}
