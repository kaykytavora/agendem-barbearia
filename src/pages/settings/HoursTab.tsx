import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { TabsContent } from "@/components/ui/tabs";
import { Clock, Save, RefreshCw, Copy, AlertTriangle } from "lucide-react";

import { DAYS_OF_WEEK } from "./types";
import { useSettings } from "./useBarbershopSettings";

/** Aba Horários: horário de funcionamento por dia da semana. */
export function HoursTab() {
  const { saving, workingHours, hoursError, loadWorkingHours, handleWorkingHoursSubmit, updateWorkingHour, copyHoursToOpenDays } = useSettings();

  return (
    <TabsContent value="hours">
      <Card>
        <CardHeader className="px-4 sm:px-6">
          <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
            <Clock className="h-5 w-5 text-primary" aria-hidden="true" />
            Horários de funcionamento
          </CardTitle>
          <CardDescription>
            Aparecem na sua página e definem os horários que os clientes podem agendar.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
          {hoursError ? (
            <div className="flex flex-col items-start gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-4">
              <p className="flex items-center gap-2 text-sm font-medium">
                <AlertTriangle className="h-4 w-4 text-destructive" aria-hidden="true" />
                Não foi possível carregar os horários.
              </p>
              <Button type="button" variant="outline" size="sm" onClick={() => loadWorkingHours()}>
                Tentar novamente
              </Button>
            </div>
          ) : (
            <form onSubmit={handleWorkingHoursSubmit} className="space-y-5">
              <ul className="divide-y rounded-2xl border">
                {DAYS_OF_WEEK.map((day, index) => {
                  const hour = workingHours[index];
                  if (!hour) return null;
                  const aberto = !hour.fechado;

                  return (
                    <li key={day.value} className="flex flex-wrap items-center gap-x-4 gap-y-2 p-3 sm:px-4">
                      <div className="flex w-40 items-center gap-3">
                        <Switch
                          id={`dia-${day.value}`}
                          checked={aberto}
                          onCheckedChange={(checked) => updateWorkingHour(index, { fechado: !checked })}
                          aria-label={`${day.label} aberto`}
                        />
                        <Label htmlFor={`dia-${day.value}`} className="font-medium">{day.label}</Label>
                      </div>

                      {aberto ? (
                        <div className="flex flex-1 flex-wrap items-center gap-2">
                          <Input
                            type="time"
                            value={hour.hora_abre ?? ""}
                            onChange={(e) => updateWorkingHour(index, { hora_abre: e.target.value })}
                            className="h-9 w-28"
                            aria-label={`${day.label}: abre às`}
                          />
                          <span className="text-sm text-muted-foreground">até</span>
                          <Input
                            type="time"
                            value={hour.hora_fecha ?? ""}
                            onChange={(e) => updateWorkingHour(index, { hora_fecha: e.target.value })}
                            className="h-9 w-28"
                            aria-label={`${day.label}: fecha às`}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="ml-auto text-muted-foreground"
                            onClick={() => copyHoursToOpenDays(index)}
                          >
                            <Copy className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                            Usar nos outros dias
                          </Button>
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">Fechado</span>
                      )}
                    </li>
                  );
                })}
              </ul>

              <Button type="submit" disabled={saving} className="w-full sm:w-auto">
                {saving ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                {saving ? "Salvando..." : "Salvar horários"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </TabsContent>
  );
}
