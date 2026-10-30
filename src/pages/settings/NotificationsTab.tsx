import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TabsContent } from "@/components/ui/tabs";
import { Volume2 } from "lucide-react";
import { NotificationSound } from "@/components/NotificationSound";

/** Aba Notificações: sons de novos agendamentos. */
export function NotificationsTab() {
  return (
    <TabsContent value="notifications">
      <Card className="border-border/50 bg-card/50 backdrop-blur-sm shadow-md">
        <CardHeader className="bg-muted/50 rounded-t-lg px-4 sm:px-6">
          <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
            <Volume2 className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
            Configurações de Notificações
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 sm:p-6">
          <div className="space-y-4">
            <div>
              <h3 className="text-base font-medium mb-2">Notificações Sonoras</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Configure as notificações sonoras para novos agendamentos. Você será notificado sempre que um cliente fizer um agendamento.
              </p>
            </div>

            <NotificationSound />
          </div>
        </CardContent>
      </Card>
    </TabsContent>
  );
}
