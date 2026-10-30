import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TabsContent } from "@/components/ui/tabs";
import { Palette, Save, Eye, RefreshCw, Check } from "lucide-react";
import { ShopHeroCard } from "@/components/barbershop/ShopHeroCard";
import { cn, enderecoCompleto, hexToHslParts, shopThemeStyle } from "@/lib/utils";
import { estaAberto, resumirHorarios } from "@/lib/horarios";

import { CORES_SUGERIDAS } from "./types";
import { useSettings } from "./useBarbershopSettings";

/** Aba Tema: a cor da barbearia, com prévia feita com os mesmos componentes da página pública. */
export function ThemeTab() {
  const { saving, barbershop, workingHours, themeConfig, phone, handleThemeSubmit, setPrimaryColor } = useSettings();
  const corValida = !!hexToHslParts(themeConfig.primary);
  const resumo = resumirHorarios(workingHours);

  return (
    <TabsContent value="theme">
      <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="px-4 sm:px-6">
            <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
              <Palette className="h-5 w-5 text-primary" aria-hidden="true" />
              Cor da sua página
            </CardTitle>
            <CardDescription>
              Usada no topo da página, nos botões e no horário escolhido. O modo claro ou escuro é escolhido por cada cliente no aparelho dele.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 p-4 pt-0 sm:p-6 sm:pt-0">
            <div>
              <Label className="mb-3 block">Sugestões</Label>
              <div className="flex flex-wrap gap-3">
                {CORES_SUGERIDAS.map((cor) => {
                  const ativa = themeConfig.primary.toUpperCase() === cor.hex.toUpperCase();
                  return (
                    <button
                      key={cor.hex}
                      type="button"
                      onClick={() => setPrimaryColor(cor.hex)}
                      className={cn(
                        "flex h-11 w-11 items-center justify-center rounded-full ring-offset-2 ring-offset-background transition",
                        ativa ? "ring-2 ring-foreground" : "hover:scale-105"
                      )}
                      style={{ backgroundColor: cor.hex }}
                      aria-label={cor.name}
                      aria-pressed={ativa}
                      title={cor.name}
                    >
                      {ativa && <Check className="h-5 w-5 text-white" aria-hidden="true" />}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <Label htmlFor="primary-color-hex" className="mb-2 block">Outra cor</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="color"
                  value={corValida ? themeConfig.primary : "#4E42FF"}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="h-10 w-14 cursor-pointer rounded-xl p-1"
                  aria-label="Escolher cor"
                />
                <Input
                  id="primary-color-hex"
                  value={themeConfig.primary}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  placeholder="#4E42FF"
                  maxLength={7}
                  className="h-10 w-32 font-mono uppercase"
                  aria-invalid={!corValida}
                />
              </div>
              {!corValida && <p className="mt-2 text-xs text-destructive">Use o formato #RRGGBB, por exemplo #4E42FF.</p>}
            </div>

            <Button onClick={handleThemeSubmit} disabled={saving || !corValida} className="w-full sm:w-auto">
              {saving ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Salvar cor
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="px-4 sm:px-6">
            <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
              <Eye className="h-5 w-5 text-primary" aria-hidden="true" />
              Como o cliente vê
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
            <div
              className={cn("pointer-events-none select-none space-y-3 rounded-3xl border bg-background p-3", corValida && "shop-theme")}
              style={shopThemeStyle(themeConfig.primary)}
              aria-hidden="true"
            >
              <ShopHeroCard
                nome={barbershop.nome || "Sua barbearia"}
                logoUrl={barbershop.logo_url}
                endereco={enderecoCompleto(barbershop)}
                stats={{
                  totalFuncionarios: 0,
                  mediaAvaliacoes: 0,
                  totalAvaliacoes: 0,
                  isOpen: estaAberto(workingHours),
                  horarioFormatado: resumo?.horas ?? "",
                  diasFormatado: resumo?.dias ?? "",
                }}
                whatsAppHref={phone ? "#" : undefined}
              />
              <div className="flex items-center justify-between rounded-2xl border border-primary bg-accent p-3">
                <div>
                  <p className="text-sm font-semibold text-accent-foreground">Corte + barba</p>
                  <p className="text-xs text-muted-foreground">50 min</p>
                </div>
                <span className="text-sm font-bold text-accent-foreground">R$ 60,00</span>
              </div>
              <div className="flex gap-2">
                {["09:00", "09:30", "10:00"].map((hora, i) => (
                  <span
                    key={hora}
                    className={cn(
                      "flex h-9 flex-1 items-center justify-center rounded-xl border text-sm font-semibold",
                      i === 1 ? "border-primary bg-primary text-primary-foreground" : "bg-card"
                    )}
                  >
                    {hora}
                  </span>
                ))}
              </div>
              <span className="flex h-10 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                Continuar
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </TabsContent>
  );
}
