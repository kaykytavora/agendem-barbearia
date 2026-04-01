import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, User, Plus } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { createAppointment } from "@/integrations/supabase/api";
import { DashboardLayout } from "@/layouts/DashboardLayout";

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
  const [services, setServices] = useState<Service[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
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
      const [servicesResponse, employeesResponse] = await Promise.all([
        supabase.from('servicos').select('id, nome, valor, duracao_minutos').order('nome'),
        supabase.from('funcionarios').select('id, nome').order('nome')
      ]);

      if (servicesResponse.error) throw servicesResponse.error;
      if (employeesResponse.error) throw employeesResponse.error;

      setServices(servicesResponse.data || []);
      setEmployees(employeesResponse.data || []);
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
    
    if (!formData.cliente_nome || !formData.cliente_telefone || !formData.servico_id || !formData.data || !formData.hora) {
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

    setIsSubmitting(true);

    try {
      const dataHora = new Date(`${formData.data}T${formData.hora}:00`).toISOString();
      // O ID da barbearia é obtido pelo RLS ou função no backend, mas aqui vamos pegar via rpc para garantir
      const { data: barbeariaId } = await supabase.rpc('get_user_barbearia_id', { user_uuid: user!.id });

      if (!barbeariaId) {
        toast({
          title: "Erro",
          description: "Não foi possível identificar a barbearia. Verifique suas permissões.",
          variant: "destructive"
        });
        return;
      }

      // Se houver apenas um funcionário, usar ele automaticamente
      const funcionarioId = formData.funcionario_id || (employees.length === 1 ? employees[0].id : null);

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

      await createAppointment(appointmentData);

      toast({
        title: "Sucesso!",
        description: "Agendamento criado com sucesso"
      });

      // Limpar formulário
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
    } finally {
      setIsSubmitting(false);
    }
  };

  // Gerar horários disponíveis (9h às 19h, intervalos de 30min)
  const availableTimes = [];
  for (let hour = 9; hour < 19; hour++) {
    availableTimes.push(`${hour.toString().padStart(2, '0')}:00`);
    availableTimes.push(`${hour.toString().padStart(2, '0')}:30`);
  }

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
                            {service.nome} - R$ {service.valor.toFixed(2)} ({service.duracao_minutos}min)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {employees.length > 1 && (
                    <div>
                      <Label htmlFor="funcionario_id">Profissional (opcional)</Label>
                      <Select
                        value={formData.funcionario_id}
                        onValueChange={(value) => setFormData(prev => ({ ...prev, funcionario_id: value }))}
                      >
                        <SelectTrigger>
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
                      min={new Date().toISOString().split('T')[0]}
                      required
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="hora">Horário *</Label>
                    <Select
                      value={formData.hora}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, hora: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o horário" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableTimes.map((time) => (
                          <SelectItem key={time} value={time}>
                            {time}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <Button 
                type="submit" 
                className="w-full" 
                disabled={isSubmitting}
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