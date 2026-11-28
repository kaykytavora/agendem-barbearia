import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Store, Clock, Volume2, Gift } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { DashboardLayout } from "@/layouts/DashboardLayout";
import { SettingsContext, useBarbershopSettings } from "./settings/useBarbershopSettings";
import { ProfileChecklist } from "./settings/ProfileChecklist";
import { ProfileTab } from "./settings/ProfileTab";
import { HoursTab } from "./settings/HoursTab";
import { NotificationsTab } from "./settings/NotificationsTab";
import { BarbershopActivation } from "./settings/BarbershopActivation";
import { SelosTab } from "./settings/SelosTab";

const ABAS = [
  { value: "profile", label: "Perfil", icon: Store },
  { value: "hours", label: "Horários", icon: Clock },
  { value: "notifications", label: "Avisos", icon: Volume2 },
  { value: "selos", label: "Selos", icon: Gift },
];

export default function Settings() {
  const settings = useBarbershopSettings();
  const { loading, barbeariaId } = settings;
  // ?aba=hours abre direto na aba de horários (link dos primeiros passos)
  const [params] = useSearchParams();
  const aba = params.get("aba");
  const abaInicial = ABAS.some((a) => a.value === aba) ? aba! : "profile";

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-96">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </DashboardLayout>
    );
  }

  if (!barbeariaId) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-96">
          <Card className="text-center p-8">
            <CardContent>
              <h2 className="text-xl font-semibold mb-2">Acesso Restrito</h2>
              <p className="text-muted-foreground">
                Você precisa estar associado a uma barbearia para acessar as configurações.
              </p>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <SettingsContext.Provider value={settings}>
        <div className="mx-auto max-w-6xl space-y-4 p-3 sm:space-y-6 sm:p-6">
          <div>
            <h1 className="text-2xl font-extrabold sm:text-3xl">Configurações</h1>
            <p className="mt-1 text-sm text-muted-foreground sm:text-base">
              O que você preencher aqui aparece na página que seus clientes usam para agendar.
            </p>
          </div>

          <ProfileChecklist />

          <Tabs defaultValue={abaInicial} className="space-y-4 sm:space-y-6">
            <TabsList className="grid h-auto w-full grid-cols-2 rounded-2xl p-1 sm:grid-cols-4 sm:rounded-full">
              {ABAS.map(({ value, label, icon: Icon }) => (
                <TabsTrigger key={value} value={value} className="flex items-center gap-1.5 rounded-full py-2 text-xs sm:text-sm">
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  {label}
                </TabsTrigger>
              ))}
            </TabsList>

            <ProfileTab />
            <HoursTab />
            <NotificationsTab />
            <SelosTab barbeariaId={barbeariaId} />
          </Tabs>

          <BarbershopActivation />
        </div>
      </SettingsContext.Provider>
    </DashboardLayout>
  );
}
