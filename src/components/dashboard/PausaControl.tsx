import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Coffee, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { dataLocalISO, formatarHora, horaNoDia } from "@/lib/agenda";

interface Pausa {
  id: string;
  hora_inicio: string;
  hora_fim: string;
  motivo: string | null;
}

/** Horários de 30 em 30 min de agora (arredondado) até 30 min antes de fechar. */
function horariosDaPausa(abre: string, fecha: string, agora: Date): string[] {
  const inicio = horaNoDia(agora, abre);
  const fim = horaNoDia(agora, fecha);
  fim.setMinutes(fim.getMinutes() - 30);
  const desde = new Date(agora);
  desde.setMinutes(desde.getMinutes() < 30 ? 0 : 30, 0, 0);

  const horarios: string[] = [];
  for (let t = new Date(Math.max(inicio.getTime(), desde.getTime())); t <= fim; t = new Date(t.getTime() + 30 * 60_000)) {
    horarios.push(formatarHora(t));
  }
  return horarios;
}

async function carregarPausa(userId: string) {
  const { data: funcionario } = await supabase
    .from("funcionarios")
    .select("id, barbearia_id")
    .eq("user_id", userId)
    .maybeSingle();
  // Dono que não atende (não está na equipe) não marca pausa
  if (!funcionario) return null;

  const agora = new Date();
  const [{ data: pausa }, { data: horario }] = await Promise.all([
    supabase
      .from("funcionario_pausas")
      .select("id, hora_inicio, hora_fim, motivo")
      .eq("funcionario_id", funcionario.id)
      .eq("data", dataLocalISO(agora)) // data local: toISOString() gravava o dia seguinte à noite
      .gte("hora_fim", formatarHora(agora))
      .order("hora_inicio")
      .limit(1)
      .maybeSingle(),
    supabase
      .from("horarios_funcionamento")
      .select("fechado, hora_abre, hora_fecha")
      .eq("barbearia_id", funcionario.barbearia_id)
      .eq("dia_semana", agora.getDay())
      .maybeSingle(),
  ]);

  return { funcionario, pausa: (pausa as Pausa | null) ?? null, horario };
}

/**
 * Pausa do profissional logado (almoço, intervalo). Durante a pausa os clientes não conseguem
 * agendar com ele. Só aparece para quem está na equipe.
 */
export function PausaControl() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [aberto, setAberto] = useState(false);
  const [form, setForm] = useState({ inicio: "", fim: "", motivo: "" });

  const { data } = useQuery({
    queryKey: ["pausa", user?.id],
    queryFn: () => carregarPausa(user!.id),
    enabled: !!user,
    refetchInterval: 60_000,
  });

  const horarios = useMemo(() => {
    const h = data?.horario;
    if (!h || h.fechado || !h.hora_abre || !h.hora_fecha) return [];
    return horariosDaPausa(h.hora_abre, h.hora_fecha, new Date());
  }, [data?.horario]);

  const atualizar = () => queryClient.invalidateQueries({ queryKey: ["pausa"] });

  const marcar = useMutation({
    mutationFn: async () => {
      if (!data?.funcionario) throw new Error("Você não está cadastrado na equipe.");
      const { error } = await supabase.from("funcionario_pausas").insert({
        funcionario_id: data.funcionario.id,
        barbearia_id: data.funcionario.barbearia_id,
        data: dataLocalISO(new Date()),
        hora_inicio: form.inicio,
        hora_fim: form.fim,
        motivo: form.motivo.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Pausa marcada", description: `Das ${form.inicio} às ${form.fim}.` });
      setAberto(false);
      setForm({ inicio: "", fim: "", motivo: "" });
      atualizar();
    },
    onError: (error) => toast({ title: "Não foi possível marcar a pausa", description: (error as Error).message, variant: "destructive" }),
  });

  const encerrar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("funcionario_pausas").delete().eq("id", data!.pausa!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Pausa encerrada", description: "Você está disponível para agendamentos de novo." });
      atualizar();
    },
    onError: (error) => toast({ title: "Não foi possível encerrar a pausa", description: (error as Error).message, variant: "destructive" }),
  });

  if (!data) return null;

  if (data.pausa) {
    const emAndamento = data.pausa.hora_inicio.slice(0, 5) <= formatarHora(new Date());
    return (
      <Button variant="outline" size="lg" onClick={() => encerrar.mutate()} disabled={encerrar.isPending}>
        {encerrar.isPending ? <Loader2 className="animate-spin" /> : <Coffee />}
        {emAndamento
          ? `Em pausa até ${data.pausa.hora_fim.slice(0, 5)} · Encerrar`
          : `Pausa às ${data.pausa.hora_inicio.slice(0, 5)} · Cancelar`}
      </Button>
    );
  }

  return (
    <>
      <Button variant="outline" size="lg" onClick={() => setAberto(true)}>
        <Coffee />
        Marcar pausa
      </Button>
      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Marcar pausa</DialogTitle>
            <DialogDescription>Durante a pausa, os clientes não conseguem agendar com você.</DialogDescription>
          </DialogHeader>

          {horarios.length < 2 ? (
            <p className="py-4 text-sm text-muted-foreground">Não há mais horários para pausa hoje.</p>
          ) : (
            <div className="grid gap-4 py-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Início</Label>
                  <Select value={form.inicio} onValueChange={(inicio) => setForm((f) => ({ ...f, inicio, fim: f.fim > inicio ? f.fim : "" }))}>
                    <SelectTrigger><SelectValue placeholder="Horário" /></SelectTrigger>
                    <SelectContent>
                      {horarios.slice(0, -1).map((h) => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Fim</Label>
                  <Select value={form.fim} onValueChange={(fim) => setForm((f) => ({ ...f, fim }))} disabled={!form.inicio}>
                    <SelectTrigger><SelectValue placeholder="Horário" /></SelectTrigger>
                    <SelectContent>
                      {horarios.filter((h) => h > form.inicio).map((h) => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="pausa-motivo">Motivo (opcional)</Label>
                <Input
                  id="pausa-motivo"
                  value={form.motivo}
                  onChange={(e) => setForm((f) => ({ ...f, motivo: e.target.value }))}
                  placeholder="Almoço, intervalo..."
                  maxLength={100}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button onClick={() => marcar.mutate()} disabled={marcar.isPending || !form.inicio || !form.fim}>
              {marcar.isPending && <Loader2 className="animate-spin" />}
              Marcar pausa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
