import { useState, useEffect, useCallback, type ReactNode } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, CalendarCheck, CheckCircle2, Loader2, Scissors, Sparkles, User, type LucideIcon } from "lucide-react";
import { TimeSlotGrid } from "@/components/booking/TimeSlotGrid";
import { formatBRL } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { caminhoAgendamento, createAppointment } from "@/integrations/supabase/api";
import { LinkClienteAgendamento } from "@/components/LinkClienteAgendamento";
import { DashboardLayout } from "@/layouts/DashboardLayout";
import { dataLocalISO, type Horario } from "@/lib/agenda";
import type { HorarioDia } from "@/lib/horarios";
import { encontrarPorNome, encontrarServico, extrairTelefone, interpretarAgendamentoSimples, mensagemErroAssistente, type RascunhoAgendamento } from "@/lib/agendamento-assistido";
import { horariosDaEquipe } from "@/lib/agendamento-equipe";

interface Service {
  id: string;
  nome: string;
  valor: number;
  duracao_minutos: number;
}

interface Employee {
  id: string;
  nome: string;
}

export default function NewAppointment() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const { state } = useLocation();
  const [barbeariaId, setBarbeariaId] = useState<string | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [workingHours, setWorkingHours] = useState<HorarioDia[]>([]);
  const [availableTimes, setAvailableTimes] = useState<Horario[]>([]);
  const [loadingTimes, setLoadingTimes] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [linkCliente, setLinkCliente] = useState<{ id: string; caminho: string } | null>(null);
  const [comando, setComando] = useState(typeof state?.comando === "string" ? state.comando : "");
  const [interpretando, setInterpretando] = useState(false);
  const [avisoIA, setAvisoIA] = useState("");
  const [horaPedida, setHoraPedida] = useState(typeof state?.hora === "string" ? state.hora : "");
  const [profissionalPendente, setProfissionalPendente] = useState(false);

  const [formData, setFormData] = useState({
    cliente_nome: "",
    cliente_telefone: "",
    cliente_email: "",
    servico_id: "",
    funcionario_id: typeof state?.funcionarioId === "string" ? state.funcionarioId : "",
    data: typeof state?.data === "string" ? state.data : "",
    hora: ""
  });

  const loadData = useCallback(async () => {
    if (!user) return;

    try {
      const { data: idDaBarbearia, error: rpcError } = await supabase.rpc('get_user_barbearia_id', { user_uuid: user.id });
      if (rpcError) throw rpcError;
      if (!idDaBarbearia) throw new Error("Usuário sem barbearia");

      // Serviços, equipe e horários são públicos: sem o filtro viriam os de todas as barbearias
      const [servicesResponse, employeesResponse, hoursResponse] = await Promise.all([
        supabase.from('servicos').select('id, nome, valor, duracao_minutos').eq('barbearia_id', idDaBarbearia).order('nome'),
        supabase.from('funcionarios').select('id, nome').eq('barbearia_id', idDaBarbearia).order('nome'),
        supabase.from('horarios_funcionamento').select('dia_semana, fechado, hora_abre, hora_fecha').eq('barbearia_id', idDaBarbearia)
      ]);

      if (servicesResponse.error) throw servicesResponse.error;
      if (employeesResponse.error) throw employeesResponse.error;
      if (hoursResponse.error) throw hoursResponse.error;

      setBarbeariaId(idDaBarbearia);
      setServices(servicesResponse.data || []);
      setEmployees(employeesResponse.data || []);
      setWorkingHours(hoursResponse.data || []);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar dados",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }, [user, toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Com um único profissional na equipe, o agendamento é sempre dele
  const funcionarioId = formData.funcionario_id || (employees.length === 1 && !profissionalPendente ? employees[0].id : null);
  const servicoEscolhido = services.find((s) => s.id === formData.servico_id);
  const horarioDoDia = formData.data
    ? workingHours.find((h) => h.dia_semana === new Date(`${formData.data}T00:00:00`).getDay())
    : undefined;
  const fechadoNoDia = !!formData.data && (!horarioDoDia || horarioDoDia.fechado || !horarioDoDia.hora_abre || !horarioDoDia.hora_fecha);

  const carregarHorarios = useCallback(async () => {
    if (profissionalPendente || !barbeariaId || !formData.data || !servicoEscolhido || !horarioDoDia?.hora_abre || !horarioDoDia.hora_fecha || horarioDoDia.fechado) {
      return [];
    }

    return horariosDaEquipe(barbeariaId, formData.data, servicoEscolhido.duracao_minutos, horarioDoDia, funcionarioId, employees.length);
  }, [barbeariaId, formData.data, servicoEscolhido, horarioDoDia, funcionarioId, employees.length, profissionalPendente]);

  useEffect(() => {
    let cancelado = false;
    setLoadingTimes(true);

    carregarHorarios()
      .then((horarios) => {
        if (cancelado) return;
        setAvailableTimes(horarios);
        // O horário escolhido pode ter deixado de valer ao trocar data, serviço ou profissional
        setFormData((prev) => {
          const candidata = prev.hora || horaPedida;
          const hora = horarios.some((h) => h.time === candidata && h.isAvailable) ? candidata : "";
          return hora === prev.hora ? prev : { ...prev, hora };
        });
      })
      .catch((error) => {
        if (cancelado) return;
        console.error('Erro ao carregar horários:', error);
        setAvailableTimes([]);
        toast({
          title: "Erro",
          description: "Não foi possível carregar os horários",
          variant: "destructive"
        });
      })
      .finally(() => {
        if (!cancelado) setLoadingTimes(false);
      });

    return () => {
      cancelado = true;
    };
  }, [carregarHorarios, horaPedida, toast]);

  const interpretarPedido = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!comando.trim() || interpretando || isSubmitting) return;

    setInterpretando(true);
    setAvisoIA("");
    try {
      const hoje = dataLocalISO(new Date());
      const { telefone, comando: comandoSemTelefone } = extrairTelefone(comando.trim());
      let rascunho = interpretarAgendamentoSimples(comando);
      if (!rascunho) {
        const { data, error } = await supabase.functions.invoke<RascunhoAgendamento>(
          "ai-appointment-draft",
          { body: { comando: comandoSemTelefone, hoje } },
        );
        if (error) throw error;
        rascunho = data;
      }
      if (!rascunho || !Object.values(rascunho).some(Boolean)) {
        setAvisoIA("Descreva o agendamento com o nome do cliente, o serviço e o horário.");
        return;
      }

      const servico = encontrarServico(services, rascunho.servico);
      const profissional = encontrarPorNome(employees, rascunho.profissional);
      const dataPedida = rascunho.data ?? hoje;
      const dia = new Date(`${dataPedida}T00:00:00`);
      const data = /^\d{4}-\d{2}-\d{2}$/.test(dataPedida) && dataLocalISO(dia) === dataPedida && dataPedida >= hoje
        ? dataPedida
        : "";
      const hora = /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(rascunho.hora ?? "") ? rascunho.hora ?? "" : "";
      const profissionalNaoEncontrado = Boolean(rascunho.profissional && !profissional);
      const revisarProfissional = profissionalNaoEncontrado && employees.length > 0;
      const cliente = rascunho.cliente ?? "";
      const mesmoHorarioConsultado = !loadingTimes && !revisarProfissional && !profissionalPendente &&
        formData.data === data && formData.servico_id === servico?.id &&
        formData.funcionario_id === (profissional?.id ?? "");
      const horaJaVerificada = mesmoHorarioConsultado &&
        availableTimes.some((slot) => slot.time === hora && slot.isAvailable);

      setProfissionalPendente(revisarProfissional);
      setHoraPedida(hora);
      setFormData((prev) => ({
        cliente_nome: cliente,
        cliente_telefone: telefone ?? (cliente && cliente === prev.cliente_nome ? prev.cliente_telefone : ""),
        cliente_email: cliente && cliente === prev.cliente_nome ? prev.cliente_email : "",
        servico_id: servico?.id ?? "",
        funcionario_id: profissional?.id ?? "",
        data,
        hora: horaJaVerificada ? hora : "",
      }));
      const avisos = [
        !rascunho.data && "Usei a data de hoje.",
        !data && "Escolha uma data válida.",
        rascunho.servico && !servico && `Confira qual serviço corresponde a “${rascunho.servico}”.`,
        revisarProfissional && `Selecione o profissional correspondente a “${rascunho.profissional}”.`,
        profissionalNaoEncontrado && !employees.length && "Nenhum profissional cadastrado para este agendamento.",
        "Revise o formulário e informe o telefone do cliente.",
      ];
      setAvisoIA(avisos.filter(Boolean).join(" "));
    } catch (erro) {
      setAvisoIA(await mensagemErroAssistente(erro));
    } finally {
      setInterpretando(false);
    }
  };

  const formatPhoneNumber = (phone: string) => {
    const cleaned = (phone || '').replace(/\D/g, '');
    const match = cleaned.match(/^(\d{2})(\d{1})(\d{4})(\d{4})$/);
    if (match) {
      return `(${match[1]}) ${match[2]} ${match[3]}-${match[4]}`;
    }
    return phone;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneNumber(e.target.value);
    setFormData(prev => ({ ...prev, cliente_telefone: formatted }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isSubmitting || interpretando) return;

    if (profissionalPendente || !formData.cliente_nome || !formData.cliente_telefone || !formData.servico_id || !formData.data || !formData.hora) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha todos os campos obrigatórios",
        variant: "destructive"
      });
      return;
    }

    // Validar formato do telefone
    const phoneClean = (formData.cliente_telefone || '').replace(/\D/g, '');
    if (phoneClean.length !== 11) {
      toast({
        title: "Telefone inválido",
        description: "Digite um telefone válido com DDD",
        variant: "destructive"
      });
      return;
    }

    if (!barbeariaId) {
      toast({
        title: "Erro",
        description: "Não foi possível identificar a barbearia. Verifique suas permissões.",
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const horarios = await carregarHorarios();
      setAvailableTimes(horarios);
      if (!horarios.some((horario) => horario.time === formData.hora && horario.isAvailable)) {
        setFormData((prev) => ({ ...prev, hora: "" }));
        throw new Error("Esse horário está indisponível. Escolha outro.");
      }

      const dataHora = new Date(`${formData.data}T${formData.hora}:00`).toISOString();

      const appointmentData = {
        barbearia_id: barbeariaId,
        servico_id: formData.servico_id,
        funcionario_id: funcionarioId,
        data_hora: dataHora,
        cliente_nome: formData.cliente_nome,
        cliente_telefone: formData.cliente_telefone,
        cliente_email: formData.cliente_email || null,
        user_id: null,
        avaliado: false,
      };

      const agendamento = await createAppointment(appointmentData, { carregarDetalhes: false });
      setLinkCliente({ id: agendamento.id, caminho: caminhoAgendamento(agendamento.id, agendamento.booking_token) });

      toast({
        title: "Sucesso!",
        description: "Horário confirmado."
      });

      // Limpar formulário
      setHoraPedida("");
      setAvisoIA("");
      setComando("");
      setFormData({
        cliente_nome: "",
        cliente_telefone: "",
        cliente_email: "",
        servico_id: "",
        funcionario_id: "",
        data: "",
        hora: ""
      });

    } catch (error) {
      console.error('Erro ao criar agendamento:', error);
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Erro ao criar agendamento",
        variant: "destructive"
      });
      // Outra pessoa pode ter reservado o horário enquanto o formulário estava aberto
      carregarHorarios().then(setAvailableTimes).catch(() => setAvailableTimes([]));
    } finally {
      setIsSubmitting(false);
    }
  };

  const temHorarioLivre = availableTimes.some((h) => h.isAvailable);
  const placeholderHorario = !formData.servico_id || !formData.data
    ? "Escolha o serviço e a data"
    : fechadoNoDia
      ? "Fechado neste dia"
      : loadingTimes
        ? "Carregando horários..."
        : temHorarioLivre
          ? "Selecione o horário"
          : "Sem horários livres";

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-96">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </DashboardLayout>
    );
  }

  const profissionalEscolhido = employees.length === 1
    ? employees[0]
    : employees.find((e) => e.id === formData.funcionario_id);

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
        <header>
          <h1 className="text-2xl font-bold sm:text-3xl">Novo agendamento</h1>
          <p className="text-muted-foreground">Marque um horário para um cliente. Ele já fica confirmado.</p>
        </header>

        {linkCliente && (
          <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary/25 bg-primary/5 p-4">
            <p className="flex items-center gap-2 text-sm font-medium">
              <CheckCircle2 className="h-4 w-4 text-primary" aria-hidden="true" />
              Agendamento criado. Envie o link para o cliente acompanhar.
            </p>
            <LinkClienteAgendamento key={linkCliente.id} id={linkCliente.id} linkInicial={linkCliente.caminho} />
          </section>
        )}

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
          {/* Formulário */}
          <form onSubmit={handleSubmit} className="space-y-6 rounded-3xl border border-border/60 bg-card p-4 shadow-brand-sm sm:p-6">
            <Etapa numero={1} titulo="Cliente" icone={User}>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="cliente_nome">Nome completo *</Label>
                  <Input
                    id="cliente_nome"
                    value={formData.cliente_nome}
                    onChange={(e) => setFormData(prev => ({ ...prev, cliente_nome: e.target.value }))}
                    placeholder="Nome do cliente"
                    pattern="[a-zA-ZÀ-ÿ\s'-]{2,}"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cliente_telefone">Telefone/WhatsApp *</Label>
                  <Input
                    id="cliente_telefone"
                    type="tel"
                    value={formData.cliente_telefone}
                    onChange={handlePhoneChange}
                    placeholder="(17) 9 9999-9999"
                    maxLength={16}
                    required
                  />
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <Label htmlFor="cliente_email">E-mail <span className="font-normal text-muted-foreground">(opcional)</span></Label>
                  <Input
                    id="cliente_email"
                    type="email"
                    value={formData.cliente_email}
                    onChange={(e) => setFormData(prev => ({ ...prev, cliente_email: e.target.value }))}
                    placeholder="email@exemplo.com"
                  />
                </div>
              </div>
            </Etapa>

            <Etapa numero={2} titulo="Serviço e profissional" icone={Scissors}>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="servico_id">Serviço *</Label>
                  <Select
                    value={formData.servico_id}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, servico_id: value }))}
                  >
                    <SelectTrigger id="servico_id">
                      <SelectValue placeholder="Selecione o serviço" />
                    </SelectTrigger>
                    <SelectContent>
                      {services.map((service) => (
                        <SelectItem key={service.id} value={service.id}>
                          {service.nome} · {formatBRL(Number(service.valor))} · {service.duracao_minutos} min
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {(employees.length > 1 || profissionalPendente) && (
                  <div className="space-y-1.5">
                    <Label htmlFor="funcionario_id">{profissionalPendente ? "Profissional *" : "Profissional (opcional)"}</Label>
                    <Select
                      value={formData.funcionario_id}
                      onValueChange={(value) => {
                        setProfissionalPendente(false);
                        setFormData(prev => ({ ...prev, funcionario_id: value }));
                      }}
                    >
                      <SelectTrigger id="funcionario_id">
                        <SelectValue placeholder="Qualquer profissional" />
                      </SelectTrigger>
                      <SelectContent>
                        {employees.map((employee) => (
                          <SelectItem key={employee.id} value={employee.id}>{employee.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {employees.length === 1 && !profissionalPendente && (
                  <div className="space-y-1.5">
                    <Label htmlFor="profissional-unico">Profissional</Label>
                    <Input id="profissional-unico" value={employees[0].nome} readOnly />
                  </div>
                )}
              </div>
            </Etapa>

            <Etapa numero={3} titulo="Data e horário" icone={Calendar}>
              <div className="space-y-4">
                <div className="space-y-1.5 sm:max-w-xs">
                  <Label htmlFor="data">Data *</Label>
                  <Input
                    id="data"
                    type="date"
                    value={formData.data}
                    onChange={(e) => setFormData(prev => ({ ...prev, data: e.target.value }))}
                    min={dataLocalISO(new Date())}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium">Horário *</p>
                  {loadingTimes ? (
                    <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Consultando horários...
                    </p>
                  ) : !formData.data || !formData.servico_id || profissionalPendente ? (
                    <p className="rounded-2xl border border-dashed border-input p-4 text-center text-sm text-muted-foreground">
                      {placeholderHorario}
                    </p>
                  ) : (
                    <TimeSlotGrid
                      slots={availableTimes}
                      selected={formData.hora || null}
                      onSelect={(hora) => setFormData(prev => ({ ...prev, hora }))}
                    />
                  )}
                  {horaPedida && formData.data && formData.servico_id && !profissionalPendente && !loadingTimes && !formData.hora && (
                    <p role="status" className="text-sm text-muted-foreground">
                      {horaPedida} está indisponível. Escolha outro horário.
                    </p>
                  )}
                </div>
              </div>
            </Etapa>

            <Button
              type="submit"
              size="lg"
              className="w-full"
              disabled={isSubmitting || interpretando || loadingTimes || profissionalPendente || !formData.hora}
            >
              {isSubmitting ? <Loader2 className="animate-spin" /> : <CalendarCheck />}
              {isSubmitting ? "Criando agendamento..." : "Criar agendamento"}
            </Button>
          </form>

          {/* Lateral: IA e resumo */}
          <aside className="space-y-4 lg:sticky lg:top-20">
            <section className="rounded-3xl border border-primary/25 bg-primary/5 p-5">
              <h2 className="mb-1 flex items-center gap-2 font-semibold">
                <Sparkles className="h-4 w-4 text-primary" aria-hidden="true" />
                Agendar com IA
              </h2>
              <p className="mb-3 text-sm text-muted-foreground">Escreva o pedido e o formulário é preenchido para você.</p>
              <form onSubmit={interpretarPedido} className="space-y-3">
                <Label htmlFor="comando-agendamento" className="sr-only">Descreva o agendamento</Label>
                <Textarea
                  id="comando-agendamento"
                  value={comando}
                  onChange={(e) => setComando(e.target.value)}
                  placeholder="Corte amanhã às 13:00 para Kayky com Daniel."
                  maxLength={500}
                  rows={3}
                  autoFocus={searchParams.get("assistente") === "1"}
                  disabled={interpretando || isSubmitting}
                  className="bg-background"
                />
                <Button type="submit" variant="secondary" className="w-full" disabled={!comando.trim() || interpretando || isSubmitting}>
                  {interpretando ? "Interpretando pedido..." : "Preencher formulário"}
                </Button>
                {avisoIA && <p className="text-sm text-muted-foreground" role="status">{avisoIA}</p>}
              </form>
            </section>

            <section aria-label="Resumo do agendamento" className="rounded-3xl border border-border/60 bg-card p-5 shadow-brand-sm">
              <h2 className="mb-3 font-semibold">Resumo</h2>
              <dl className="space-y-2 text-sm">
                {[
                  ["Cliente", formData.cliente_nome || "—"],
                  ["Serviço", servicoEscolhido ? `${servicoEscolhido.nome} · ${servicoEscolhido.duracao_minutos} min` : "—"],
                  ["Profissional", profissionalEscolhido?.nome ?? "Qualquer profissional"],
                  ["Data", formData.data ? new Date(`${formData.data}T12:00:00`).toLocaleDateString("pt-BR", { weekday: "short", day: "numeric", month: "short" }) : "—"],
                  ["Horário", formData.hora || "—"],
                ].map(([rotulo, valor]) => (
                  <div key={rotulo} className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">{rotulo}</dt>
                    <dd className="truncate text-right font-medium">{valor}</dd>
                  </div>
                ))}
                {servicoEscolhido && (
                  <div className="flex justify-between gap-3 border-t border-border/60 pt-2">
                    <dt className="text-muted-foreground">Valor</dt>
                    <dd className="font-display text-base font-bold">{formatBRL(Number(servicoEscolhido.valor))}</dd>
                  </div>
                )}
              </dl>
            </section>
          </aside>
        </div>
      </div>
    </DashboardLayout>
  );
}

/** Seção numerada do formulário */
function Etapa({ numero, titulo, icone: Icone, children }: {
  numero: number;
  titulo: string;
  icone: LucideIcon;
  children: ReactNode;
}) {
  return (
    <fieldset className="space-y-4 border-b border-border/60 pb-6 last-of-type:border-0 last-of-type:pb-0">
      <legend className="flex items-center gap-2.5 font-semibold">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">{numero}</span>
        <Icone className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        {titulo}
      </legend>
      {children}
    </fieldset>
  );
}
