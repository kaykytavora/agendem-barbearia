import { useEffect, useRef, useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, MessageCircle, Send, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { dataLocalISO } from "@/lib/agenda";
import { extrairDataHora, extrairTelefone, interpretarAgendamentoSimples, interpretarCancelamentoSimples, mensagemErroAssistente, pediuParaAgendar, pediuParaCancelar, type PedidoCancelamentoChat, type RascunhoAgendamento } from "@/lib/agendamento-assistido";
import { agendarPeloChat, type CampoAgendamento } from "@/lib/agendamento-equipe";
import { LinkClienteAgendamento } from "@/components/LinkClienteAgendamento";
import { CancelamentoNoChat } from "@/components/dashboard/CancelamentoNoChat";

interface Mensagem {
  pergunta: string;
  resposta?: string;
  linkCliente?: { id: string; caminho: string };
  cancelamento?: PedidoCancelamentoChat;
}

function completarAgendamento(rascunho: RascunhoAgendamento, campo: CampoAgendamento, texto: string) {
  if (campo === "telefone") {
    const { telefone } = extrairTelefone(texto);
    return { ...rascunho, telefone };
  }
  if (campo === "data" || campo === "hora") {
    const { data, hora } = extrairDataHora(texto);
    return { ...rascunho, data: data ?? rascunho.data, hora: hora ?? rascunho.hora };
  }
  return { ...rascunho, [campo]: texto };
}

function RegistrarDespesa({ barbeariaId }: { barbeariaId: string }) {
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState("");
  const [data, setData] = useState(() => dataLocalISO(new Date()));
  const [salvando, setSalvando] = useState(false);
  const [aviso, setAviso] = useState("");

  async function salvar(e: FormEvent) {
    e.preventDefault();
    if (salvando) return;
    const texto = valor.trim();
    const valorNumerico = Number(texto.replace(",", "."));
    if (!descricao.trim() || !data || !/^\d{1,10}([.,]\d{1,2})?$/.test(texto) || valorNumerico <= 0) {
      setAviso("Preencha a descrição, a data e um valor maior que zero.");
      return;
    }

    setSalvando(true);
    setAviso("");
    try {
      const { error } = await supabase.from("despesas_barbearia").insert({
        barbearia_id: barbeariaId, descricao: descricao.trim(), data, valor: valorNumerico,
      });
      if (error) throw error;
      setDescricao("");
      setValor("");
      setAviso("Gasto registrado. Ele já entra nas consultas do período.");
    } catch {
      setAviso("Não foi possível registrar o gasto. Tente novamente.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <form className="space-y-4 p-5" onSubmit={salvar}>
      <div className="space-y-2">
        <Label htmlFor="despesa-descricao">Descrição</Label>
        <Input id="despesa-descricao" placeholder="Ex.: Produtos para atendimento" value={descricao} maxLength={120}
          onChange={(event) => setDescricao(event.target.value)} disabled={salvando} required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="despesa-valor">Valor em R$</Label>
          <Input id="despesa-valor" inputMode="decimal" placeholder="120,00" value={valor}
            onChange={(event) => setValor(event.target.value)} disabled={salvando} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="despesa-data">Data</Label>
          <Input id="despesa-data" type="date" value={data} max={dataLocalISO(new Date())}
            onChange={(event) => setData(event.target.value)} disabled={salvando} required />
        </div>
      </div>
      <Button type="submit" disabled={salvando}>{salvando ? "Registrando..." : "Registrar gasto"}</Button>
      {aviso && <p className="text-sm text-muted-foreground" role="status">{aviso}</p>}
    </form>
  );
}

export function AssistenteBarbearia({ barbeariaId, admin }: { barbeariaId: string; admin: boolean }) {
  const queryClient = useQueryClient();
  const fimDaConversa = useRef<HTMLDivElement>(null);
  const enviando = useRef(false);
  const [aberto, setAberto] = useState(false);
  const [comando, setComando] = useState("");
  const [conversa, setConversa] = useState<Mensagem[]>([]);
  const [consultando, setConsultando] = useState(false);
  const [pendente, setPendente] = useState<{ rascunho: RascunhoAgendamento; campo: CampoAgendamento } | null>(null);
  const sugestoes = admin
    ? ["Quantos cortes tivemos esta semana?", "Como está o lucro e os gastos este mês?"]
    : ["Quantos cortes fiz esta semana?", "Quantos atendimentos fiz hoje?"];

  useEffect(() => {
    fimDaConversa.current?.scrollIntoView({ block: "end" });
  }, [conversa, aberto]);

  async function perguntar(pergunta: string) {
    const texto = pergunta.trim();
    if (!texto || enviando.current) return;

    enviando.current = true;
    setComando("");
    setConsultando(true);
    const contato = extrairTelefone(texto);
    const perguntaVisivel = contato.telefone ? contato.comando || "Telefone informado" : texto;
    setConversa((prev) => [...prev, { pergunta: perguntaVisivel }]);
    let resposta: string | undefined = "Não consegui consultar a barbearia agora. Tente novamente.";
    let linkCliente: Mensagem["linkCliente"];
    let cancelamento = interpretarCancelamentoSimples(texto) ?? undefined;
    let consultandoAgenda = false;
    try {
      const novoAgendamento = pediuParaAgendar(texto);
      const novoCancelamento = pediuParaCancelar(texto);
      let rascunho = interpretarAgendamentoSimples(texto);
      if (novoAgendamento || novoCancelamento || rascunho) setPendente(null);
      if (!rascunho && !novoAgendamento && !novoCancelamento && pendente) {
        rascunho = completarAgendamento(pendente.rascunho, pendente.campo, texto);
      }
      if (!rascunho && novoAgendamento) {
        const { data, error } = await supabase.functions.invoke<RascunhoAgendamento>("ai-appointment-draft", {
          body: { comando: contato.comando, hoje: dataLocalISO(new Date()) },
        });
        if (error) throw error;
        if (data) rascunho = { ...data, telefone: contato.telefone };
      }
      if (cancelamento) {
        resposta = undefined;
      } else if (rascunho) {
        consultandoAgenda = true;
        const resultado = await agendarPeloChat(barbeariaId, rascunho);
        setPendente(resultado.falta ? { rascunho, campo: resultado.falta } : null);
        resposta = resultado.texto;
        linkCliente = resultado.linkCliente;
        if (resultado.criado) {
          void queryClient.invalidateQueries({ queryKey: ["inicio"] });
          void queryClient.invalidateQueries({ queryKey: ["agendamentos-agenda"] });
          void queryClient.invalidateQueries({ queryKey: ["appointments"] });
        }
      } else if (novoAgendamento) {
        resposta = "Descreva o serviço e para quem quer agendar.";
      } else {
        const { data, error } = await supabase.functions.invoke<{
          texto?: string;
          acao?: "agendamento" | "cancelamento";
          pedido?: PedidoCancelamentoChat;
        }>(
          "ai-appointment-draft",
          { body: { modo: "gestao", comando: contato.comando } },
        );
        if (error) throw error;
        if (data?.acao === "cancelamento" && data.pedido) {
          cancelamento = data.pedido;
          setPendente(null);
          resposta = undefined;
        } else {
          resposta = data?.acao === "agendamento" ? "Escreva “Agende” seguido do serviço, cliente e horário." : data?.texto || resposta;
        }
      }
    } catch (erro) {
      resposta = consultandoAgenda
        ? "Não consegui confirmar o agendamento na agenda. Confira se ele já aparece antes de reenviar."
        : await mensagemErroAssistente(erro);
    } finally {
      enviando.current = false;
      setConsultando(false);
    }
    setConversa((prev) => prev.map((item, index) => index === prev.length - 1 ? { ...item, resposta, linkCliente, cancelamento } : item));
  }

  return (
    <Sheet open={aberto} onOpenChange={setAberto}>
      <SheetTrigger asChild>
        <Button size="icon" className="fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom))] right-4 z-40 h-12 w-12 rounded-full shadow-lg shadow-primary/25 md:bottom-6 md:right-6 md:h-14 md:w-14"
          aria-label="Abrir assistente da barbearia" title="Assistente da barbearia">
          <MessageCircle className="!h-6 !w-6" />
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="flex h-[85dvh] w-full flex-col gap-0 rounded-t-2xl p-0 pb-[env(safe-area-inset-bottom)] md:inset-x-auto md:bottom-24 md:right-6 md:h-[min(36rem,calc(100dvh_-_7rem))] md:w-[26rem] md:rounded-2xl md:border md:pb-0 md:shadow-xl">
        <SheetHeader className="border-b p-5 pr-12 text-left">
          <SheetTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" /> Assistente da barbearia</SheetTitle>
          <SheetDescription>
            {admin ? "Consulte atendimentos e finanças, agende ou peça cancelamentos." : "Consulte seus atendimentos, agende ou peça cancelamentos."}
          </SheetDescription>
        </SheetHeader>
        <Tabs defaultValue="conversa" className="flex min-h-0 flex-1 flex-col">
          {admin && (
            <TabsList className="mx-5 mt-3 self-start">
              <TabsTrigger value="conversa">Perguntar</TabsTrigger>
              <TabsTrigger value="gastos">Registrar gasto</TabsTrigger>
            </TabsList>
          )}
          <TabsContent value="conversa" className="flex min-h-0 flex-1 flex-col data-[state=inactive]:hidden">
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-5" role="log" aria-live="polite">
              {conversa.length === 0 && [...sugestoes, "Agende um corte para Ana às 15h", "Cancele o horário da Ana hoje às 15h"].map((sugestao) => (
                <Button key={sugestao} type="button" variant="outline" className="h-auto whitespace-normal text-left"
                  onClick={() => /^(?:Agende|Cancele)\b/.test(sugestao) ? setComando(sugestao) : void perguntar(sugestao)}>{sugestao}</Button>
              ))}
              {conversa.map(({ pergunta, resposta, linkCliente, cancelamento }, index) => (
                <div key={index} className="space-y-2">
                  <p className="ml-auto w-fit max-w-[90%] rounded-xl bg-primary px-3 py-2 text-sm text-primary-foreground [overflow-wrap:anywhere]">{pergunta}</p>
                  {resposta && <p className="w-fit max-w-[95%] whitespace-pre-line rounded-xl bg-muted px-3 py-2 text-sm [overflow-wrap:anywhere]">{resposta}</p>}
                  {linkCliente && <LinkClienteAgendamento id={linkCliente.id} linkInicial={linkCliente.caminho} />}
                  {cancelamento && <CancelamentoNoChat pedido={cancelamento} barbeariaId={barbeariaId} admin={admin} />}
                </div>
              ))}
              {consultando && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Consultando...</p>}
              <div ref={fimDaConversa} />
            </div>
            {pendente && (
              <Button type="button" variant="ghost" size="sm" className="mx-4 mb-2 self-start" disabled={consultando}
                onClick={() => { setPendente(null); setComando(""); }}>
                Descartar pedido de agendamento
              </Button>
            )}
            <form className="flex gap-2 border-t p-4" onSubmit={(event) => { event.preventDefault(); void perguntar(comando); }}>
              <Input aria-label="Mensagem para o assistente" placeholder={pendente ? "Responda aqui para continuar" : "Escreva sua mensagem"} value={comando}
                onChange={(event) => setComando(event.target.value)} maxLength={500} />
              <Button type="submit" size="icon" aria-label="Enviar mensagem" disabled={!comando.trim() || consultando}>
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </TabsContent>
          {admin && <TabsContent value="gastos" className="overflow-y-auto"><RegistrarDespesa barbeariaId={barbeariaId} /></TabsContent>}
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
