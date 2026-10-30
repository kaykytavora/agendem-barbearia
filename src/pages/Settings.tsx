import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Store, Palette, Clock, Volume2 } from "lucide-react";
import { DashboardLayout } from "@/layouts/DashboardLayout";
import { SettingsContext, useBarbershopSettings } from "./settings/useBarbershopSettings";
import { ProfileChecklist } from "./settings/ProfileChecklist";
import { ProfileTab } from "./settings/ProfileTab";
import { ThemeTab } from "./settings/ThemeTab";
import { HoursTab } from "./settings/HoursTab";
import { NotificationsTab } from "./settings/NotificationsTab";
import { DangerZoneCard } from "./settings/DangerZoneCard";

const ABAS = [
  { value: "profile", label: "Perfil", icon: Store },
  { value: "theme", label: "Cor", icon: Palette },
  { value: "hours", label: "Horários", icon: Clock },
  { value: "notifications", label: "Avisos", icon: Volume2 },
];

export default function Settings() {
  const settings = useBarbershopSettings();
  const { loading, barbeariaId } = settings;

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

          <Tabs defaultValue="profile" className="space-y-4 sm:space-y-6">
            <TabsList className="grid h-auto w-full grid-cols-4 rounded-full p-1">
              {ABAS.map(({ value, label, icon: Icon }) => (
                <TabsTrigger key={value} value={value} className="flex items-center gap-1.5 rounded-full py-2 text-xs sm:text-sm">
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  {label}
                </TabsTrigger>
              ))}
            </TabsList>

            <ProfileTab />
            <ThemeTab />
            <HoursTab />
            <NotificationsTab />
          </Tabs>

          <DangerZoneCard />
        </div>
      </SettingsContext.Provider>
    </DashboardLayout>
  );
}
