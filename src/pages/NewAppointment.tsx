import { useState, useEffect, useCallback } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, User, Plus, Sparkles } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { createAppointment } from "@/integrations/supabase/api";
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
  const [comando, setComando] = useState(typeof state?.comando === "string" ? state.comando : "");
  const [interpretando, setInterpretando] = useState(false);
  const [avisoIA, setAvisoIA] = useState("");
  const [horaPedida, setHoraPedida] = useState("");
  const [profissionalPendente, setProfissionalPendente] = useState(false);

  const [formData, setFormData] = useState({
    cliente_nome: "",
    cliente_telefone: "",
    cliente_email: "",
    servico_id: "",
    funcionario_id: "",
    data: "",
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

      await createAppointment(appointmentData, { carregarDetalhes: false });

      toast({
        title: "Sucesso!",
        description: "Agendamento criado com sucesso"
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

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Novo Agendamento</h1>
          <p className="text-muted-foreground">Agende um horário para um cliente</p>
        </div>

        <Card className="max-w-2xl border-primary/25">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Agendar com IA
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={interpretarPedido} className="space-y-3">
              <Label htmlFor="comando-agendamento">Descreva o agendamento</Label>
              <Textarea
                id="comando-agendamento"
                value={comando}
                onChange={(e) => setComando(e.target.value)}
                placeholder="Agende um corte de cabelo amanhã às 13:00 para Kayky com Daniel."
                maxLength={500}
                autoFocus={searchParams.get("assistente") === "1"}
                disabled={interpretando || isSubmitting}
              />
              <Button type="submit" variant="secondary" disabled={!comando.trim() || interpretando || isSubmitting}>
                {interpretando ? "Interpretando pedido..." : "Preencher formulário"}
              </Button>
              {avisoIA && <p className="text-sm text-muted-foreground" role="status">{avisoIA}</p>}
            </form>
          </CardContent>
        </Card>

        <Card className="max-w-2xl border-border/50 bg-card/50 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5" />
              Dados do Agendamento
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Dados do Cliente */}
              <div className="space-y-4">
                <Label className="text-base font-medium">
                  <User className="w-4 h-4 inline mr-2" />
                  Dados do Cliente
                </Label>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
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

                  <div>
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
                </div>

                <div>
                  <Label htmlFor="cliente_email">E-mail (opcional)</Label>
                  <Input
                    id="cliente_email"
                    type="email"
                    value={formData.cliente_email}
                    onChange={(e) => setFormData(prev => ({ ...prev, cliente_email: e.target.value }))}
                    placeholder="email@exemplo.com"
                  />
                </div>
              </div>

              {/* Serviço e Profissional */}
              <div className="space-y-4">
                <Label className="text-base font-medium">Serviço e Profissional</Label>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="servico_id">Serviço *</Label>
                    <Select
                      value={formData.servico_id}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, servico_id: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o serviço" />
                      </SelectTrigger>
                      <SelectContent>
                        {services.map((service) => (
                          <SelectItem key={service.id} value={service.id}>
                            {service.nome} - R$ {Number(service.valor).toFixed(2)} ({service.duracao_minutos}min)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {(employees.length > 1 || profissionalPendente) && (
                    <div>
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
                            <SelectItem key={employee.id} value={employee.id}>
                              {employee.nome}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  {employees.length === 1 && !profissionalPendente && (
                    <div>
                      <Label htmlFor="profissional-unico">Profissional</Label>
                      <Input id="profissional-unico" value={employees[0].nome} readOnly />
                    </div>
                  )}
                </div>
              </div>

              {/* Data e Hora */}
              <div className="space-y-4">
                <Label className="text-base font-medium">
                  <Calendar className="w-4 h-4 inline mr-2" />
                  Data e Horário
                </Label>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
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

                  <div>
                    <Label htmlFor="hora">Horário *</Label>
                    <Select
                      value={formData.hora}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, hora: value }))}
                      disabled={loadingTimes || !temHorarioLivre}
                    >
                      <SelectTrigger id="hora">
                        <SelectValue placeholder={placeholderHorario} />
                      </SelectTrigger>
                      <SelectContent>
                        {availableTimes.map((horario) => (
                          <SelectItem key={horario.time} value={horario.time} disabled={!horario.isAvailable}>
                            {horario.time}{horario.isAvailable ? "" : " (ocupado)"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {horaPedida && formData.data && formData.servico_id && !profissionalPendente && !loadingTimes && !formData.hora && (
                      <p role="status" className="mt-1 text-sm text-muted-foreground">
                        {horaPedida} está indisponível. Escolha outro horário.
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={isSubmitting || interpretando || loadingTimes || profissionalPendente}
              >
                {isSubmitting ? "Criando agendamento..." : "Criar Agendamento"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
