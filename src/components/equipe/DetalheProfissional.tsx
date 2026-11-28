import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import imageCompression from "browser-image-compression";
import { Camera, CheckCircle2, Loader2, Mail, Scissors, TrendingUp, UserX, Wallet } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn, formatBRL } from "@/lib/utils";

export interface ProfissionalResumo {
  id: string;
  nome: string;
  email?: string | null;
  foto_url?: string | null;
  barbearia_id: string;
}

type TipoRemuneracao = "fixo" | "comissao" | "fixo_comissao";

interface Remuneracao {
  tipo: TipoRemuneracao;
  salario_fixo: number;
  comissao_percentual: number;
}

const ROTULO_TIPO: Record<TipoRemuneracao, string> = {
  fixo: "Salário fixo",
  comissao: "Porcentagem dos serviços",
  fixo_comissao: "Fixo + porcentagem",
};

/** Mês selecionado: 0 = mês atual, 1 = mês passado... */
function intervaloDoMes(deslocamento: number) {
  const hoje = new Date();
  const inicio = new Date(hoje.getFullYear(), hoje.getMonth() - deslocamento, 1);
  const fim = new Date(hoje.getFullYear(), hoje.getMonth() - deslocamento + 1, 1);
  return { inicio, fim };
}

export const iniciais = (nome: string) =>
  nome.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("") || "?";

/** Calcula o pagamento do período a partir da regra de remuneração. */
export function calcularPagamento(regra: Remuneracao | null, faturamento: number) {
  if (!regra) return null;
  const fixo = regra.tipo === "comissao" ? 0 : Number(regra.salario_fixo);
  const comissao = regra.tipo === "fixo" ? 0 : (faturamento * Number(regra.comissao_percentual)) / 100;
  return { fixo, comissao, total: fixo + comissao };
}

interface DetalheProfissionalProps {
  profissional: ProfissionalResumo | null;
  podeEditar: boolean;
  onFechar: () => void;
  onFotoAtualizada: () => void;
}

/** Painel lateral com desempenho do profissional no mês, remuneração e foto. */
export function DetalheProfissional({ profissional, podeEditar, onFechar, onFotoAtualizada }: DetalheProfissionalProps) {
  const [mes, setMes] = useState("0");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const inputFoto = useRef<HTMLInputElement>(null);
  const [enviandoFoto, setEnviandoFoto] = useState(false);
  const [foto, setFoto] = useState<string | null>(null);

  useEffect(() => { setFoto(profissional?.foto_url ?? null); setMes("0"); }, [profissional]);

  const { inicio, fim } = intervaloDoMes(Number(mes));
  const nomeMes = inicio.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  const desempenho = useQuery({
    queryKey: ["desempenho-profissional", profissional?.id, mes],
    enabled: !!profissional,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agendamentos")
        .select("status, cancelamento_solicitado_por, servicos(nome, valor)")
        .eq("funcionario_id", profissional!.id)
        .gte("data_hora", inicio.toISOString())
        .lt("data_hora", fim.toISOString());
      if (error) throw error;
      const linhas = (data ?? []) as unknown as { status: string; cancelamento_solicitado_por: string | null; servicos: { nome: string; valor: number } | null }[];
      const finalizados = linhas.filter((l) => l.status === "finalizado");
      const faturamento = finalizados.reduce((t, l) => t + Number(l.servicos?.valor ?? 0), 0);
      const porServico = new Map<string, number>();
      for (const l of finalizados) if (l.servicos) porServico.set(l.servicos.nome, (porServico.get(l.servicos.nome) ?? 0) + 1);
      return {
        atendimentos: finalizados.length,
        faturamento,
        ticketMedio: finalizados.length ? faturamento / finalizados.length : 0,
        cancelados: linhas.filter((l) => l.status === "cancelado").length,
        agendados: linhas.filter((l) => l.status === "pendente" || l.status === "confirmado").length,
        servicos: [...porServico.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4),
      };
    },
  });

  const remuneracao = useQuery({
    queryKey: ["remuneracao", profissional?.id],
    enabled: !!profissional,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("funcionarios_remuneracao")
        .select("tipo, salario_fixo, comissao_percentual")
        .eq("funcionario_id", profissional!.id)
        .maybeSingle();
      if (error) throw error;
      return data as Remuneracao | null;
    },
  });

  const [form, setForm] = useState<{ tipo: TipoRemuneracao; fixo: string; percentual: string }>({ tipo: "comissao", fixo: "", percentual: "" });
  useEffect(() => {
    const r = remuneracao.data;
    setForm(r
      ? { tipo: r.tipo, fixo: String(r.salario_fixo ?? ""), percentual: String(r.comissao_percentual ?? "") }
      : { tipo: "comissao", fixo: "", percentual: "" });
  }, [remuneracao.data]);

  const salvar = useMutation({
    mutationFn: async () => {
      const fixo = form.tipo === "comissao" ? 0 : Number(form.fixo.replace(",", "."));
      const percentual = form.tipo === "fixo" ? 0 : Number(form.percentual.replace(",", "."));
      if (!Number.isFinite(fixo) || fixo < 0) throw new Error("Informe um salário fixo válido.");
      if (!Number.isFinite(percentual) || percentual < 0 || percentual > 100) throw new Error("A porcentagem deve ficar entre 0 e 100.");
      const { error } = await supabase.from("funcionarios_remuneracao").upsert({
        funcionario_id: profissional!.id,
        barbearia_id: profissional!.barbearia_id,
        tipo: form.tipo,
        salario_fixo: fixo,
        comissao_percentual: percentual,
        updated_at: new Date().toISOString(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["remuneracao", profissional?.id] });
      toast({ title: "Remuneração salva." });
    },
    onError: (erro: Error) => toast({ title: "Não foi possível salvar", description: erro.message, variant: "destructive" }),
  });

  async function trocarFoto(arquivo: File) {
    if (!profissional) return;
    if (!arquivo.type.startsWith("image/")) {
      toast({ title: "Escolha uma imagem.", variant: "destructive" });
      return;
    }
    setEnviandoFoto(true);
    try {
      const comprimida = await imageCompression(arquivo, { maxSizeMB: 0.5, maxWidthOrHeight: 400, useWebWorker: true });
      const caminho = `${profissional.barbearia_id}/equipe/${profissional.id}-${Date.now()}.${comprimida.type.split("/")[1] ?? "jpg"}`;
      const { error: erroUpload } = await supabase.storage.from("gallery").upload(caminho, comprimida, { contentType: comprimida.type });
      if (erroUpload) throw erroUpload;
      const { data: { publicUrl } } = supabase.storage.from("gallery").getPublicUrl(caminho);
      const { error } = await supabase.from("funcionarios").update({ foto_url: publicUrl }).eq("id", profissional.id);
      if (error) throw error;
      // Remove a foto anterior para não acumular arquivos
      if (foto?.includes("/gallery/")) {
        await supabase.storage.from("gallery").remove([foto.substring(foto.indexOf("/gallery/") + "/gallery/".length)]);
      }
      setFoto(publicUrl);
      onFotoAtualizada();
      toast({ title: "Foto atualizada." });
    } catch (erro) {
      toast({ title: "Não foi possível enviar a foto", description: erro instanceof Error ? erro.message : undefined, variant: "destructive" });
    } finally {
      setEnviandoFoto(false);
    }
  }

  const d = desempenho.data;
  const pagamento = calcularPagamento(remuneracao.data ?? null, d?.faturamento ?? 0);

  return (
    <Sheet open={!!profissional} onOpenChange={(aberto) => !aberto && onFechar()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        {profissional && (
          <>
            <SheetHeader className="items-center space-y-3 pb-2 text-center">
              <div className="relative">
                <Avatar className="h-24 w-24 border-4 border-background shadow-brand-md">
                  <AvatarImage src={foto ?? undefined} alt="" className="object-cover" />
                  <AvatarFallback className="bg-primary/10 text-2xl font-bold text-primary">{iniciais(profissional.nome)}</AvatarFallback>
                </Avatar>
                {podeEditar && (
                  <>
                    <button
                      type="button"
                      onClick={() => inputFoto.current?.click()}
                      disabled={enviandoFoto}
                      aria-label="Trocar foto"
                      className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-brand-md hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {enviandoFoto ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                    </button>
                    <input ref={inputFoto} type="file" accept="image/*" className="hidden"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) void trocarFoto(f); e.target.value = ""; }} />
                  </>
                )}
              </div>
              <div>
                <SheetTitle className="text-xl">{profissional.nome}</SheetTitle>
                <SheetDescription className="flex items-center justify-center gap-1.5">
                  {profissional.email && <><Mail className="h-3.5 w-3.5" aria-hidden="true" />{profissional.email}</>}
                </SheetDescription>
              </div>
            </SheetHeader>

            <div className="mt-4 space-y-6">
              {/* Período */}
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-semibold">Desempenho</h3>
                <Select value={mes} onValueChange={setMes}>
                  <SelectTrigger className="h-9 w-44" aria-label="Mês">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[0, 1, 2, 3, 4, 5].map((n) => (
                      <SelectItem key={n} value={String(n)} className="capitalize">
                        {n === 0 ? "Este mês" : n === 1 ? "Mês passado" : intervaloDoMes(n).inicio.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {desempenho.isLoading ? (
                <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando...</p>
              ) : desempenho.isError ? (
                <p role="alert" className="text-sm text-destructive">Não foi possível carregar o desempenho.</p>
              ) : d && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <Numero icone={CheckCircle2} rotulo="Atendimentos" valor={String(d.atendimentos)} detalhe={`${d.agendados} ainda marcados`} />
                    <Numero icone={TrendingUp} rotulo="Faturamento" valor={formatBRL(d.faturamento)} detalhe="serviços finalizados" />
                    <Numero icone={Scissors} rotulo="Ticket médio" valor={formatBRL(d.ticketMedio)} detalhe="por atendimento" />
                    <Numero icone={UserX} rotulo="Cancelados" valor={String(d.cancelados)} detalhe="inclui faltas" />
                  </div>

                  {d.servicos.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Serviços mais feitos</p>
                      <ul className="space-y-1.5">
                        {d.servicos.map(([nome, vezes]) => (
                          <li key={nome} className="flex items-center gap-3 text-sm">
                            <span className="min-w-0 flex-1 truncate">{nome}</span>
                            <span className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
                              <span className="block h-full rounded-full bg-primary" style={{ width: `${(vezes / d.servicos[0][1]) * 100}%` }} />
                            </span>
                            <span className="w-8 text-right tabular-nums text-muted-foreground">{vezes}×</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              )}

              {/* Pagamento do período */}
              <section className="rounded-2xl border border-primary/25 bg-primary/5 p-4">
                <h3 className="mb-1 flex items-center gap-2 font-semibold">
                  <Wallet className="h-4 w-4 text-primary" aria-hidden="true" />
                  A pagar em <span className="capitalize">{nomeMes}</span>
                </h3>
                {remuneracao.isLoading ? (
                  <p className="text-sm text-muted-foreground">Carregando...</p>
                ) : !pagamento ? (
                  <p className="text-sm text-muted-foreground">
                    {podeEditar ? "Defina a remuneração abaixo para calcular o pagamento." : "A remuneração ainda não foi definida."}
                  </p>
                ) : (
                  <dl className="space-y-1 text-sm">
                    {remuneracao.data!.tipo !== "comissao" && (
                      <div className="flex justify-between"><dt className="text-muted-foreground">Fixo</dt><dd>{formatBRL(pagamento.fixo)}</dd></div>
                    )}
                    {remuneracao.data!.tipo !== "fixo" && (
                      <div className="flex justify-between">
                        <dt className="text-muted-foreground">{Number(remuneracao.data!.comissao_percentual)}% de {formatBRL(d?.faturamento ?? 0)}</dt>
                        <dd>{formatBRL(pagamento.comissao)}</dd>
                      </div>
                    )}
                    <div className="flex justify-between border-t border-primary/20 pt-2">
                      <dt className="font-semibold">Total</dt>
                      <dd className="font-display text-lg font-bold">{formatBRL(pagamento.total)}</dd>
                    </div>
                  </dl>
                )}
              </section>

              {/* Regra de remuneração (só o dono edita) */}
              {podeEditar && (
                <form
                  className="space-y-4 rounded-2xl border border-border/60 p-4"
                  onSubmit={(e) => { e.preventDefault(); salvar.mutate(); }}
                >
                  <h3 className="font-semibold">Remuneração</h3>
                  <div className="grid grid-cols-3 gap-1 rounded-xl bg-muted p-1" role="radiogroup" aria-label="Tipo de remuneração">
                    {(Object.keys(ROTULO_TIPO) as TipoRemuneracao[]).map((tipo) => (
                      <button
                        key={tipo}
                        type="button"
                        role="radio"
                        aria-checked={form.tipo === tipo}
                        onClick={() => setForm((f) => ({ ...f, tipo }))}
                        className={cn(
                          "rounded-lg px-2 py-1.5 text-xs font-medium transition-colors",
                          form.tipo === tipo ? "bg-card text-foreground shadow-brand-sm" : "text-muted-foreground hover:text-foreground",
                        )}
                      >
                        {tipo === "fixo" ? "Fixo" : tipo === "comissao" ? "Porcentagem" : "Fixo + %"}
                      </button>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {form.tipo !== "comissao" && (
                      <div className="space-y-1.5">
                        <Label htmlFor="salario-fixo">Fixo mensal (R$)</Label>
                        <Input id="salario-fixo" inputMode="decimal" placeholder="1500" value={form.fixo}
                          onChange={(e) => setForm((f) => ({ ...f, fixo: e.target.value }))} />
                      </div>
                    )}
                    {form.tipo !== "fixo" && (
                      <div className="space-y-1.5">
                        <Label htmlFor="comissao">Porcentagem (%)</Label>
                        <Input id="comissao" inputMode="decimal" placeholder="40" value={form.percentual}
                          onChange={(e) => setForm((f) => ({ ...f, percentual: e.target.value }))} />
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    A porcentagem é calculada sobre o valor dos serviços finalizados por este profissional no mês. Só você e o próprio profissional veem esses valores.
                  </p>
                  <Button type="submit" className="w-full" disabled={salvar.isPending}>
                    {salvar.isPending ? "Salvando..." : "Salvar remuneração"}
                  </Button>
                </form>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Numero({ icone: Icone, rotulo, valor, detalhe }: {
  icone: typeof Wallet;
  rotulo: string;
  valor: string;
  detalhe: string;
}) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card p-3.5">
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icone className="h-3.5 w-3.5 text-primary" aria-hidden="true" /> {rotulo}
      </p>
      <p className="mt-1 truncate font-display text-xl font-bold">{valor}</p>
      <p className="text-xs text-muted-foreground">{detalhe}</p>
    </div>
  );
}
