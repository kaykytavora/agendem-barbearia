import { useState, useEffect, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription
} from "@/components/ui/dialog";
import {
  Plus,
  Edit,
  Trash2,
  User,
  Crown,
  Shield,
  Users,
  Info,
  UserPlus,
  Mail,
  ChevronRight,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DetalheProfissional, iniciais } from "@/components/equipe/DetalheProfissional";
import { formatBRL } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { DashboardLayout } from "@/layouts/DashboardLayout";
import { motion, AnimatePresence } from "framer-motion";

interface Employee {
  id: string;
  nome: string;
  email?: string | null;
  especialidade: string | null;
  foto_url?: string | null;
  nivel_permissao: 'funcionario' | 'gerente' | 'dono';
  user_id: string;
  barbearia_id: string;
}

const SENHA_MINIMA = 8;

export default function Team() {
  const { user, role, refreshProfile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [detalhe, setDetalhe] = useState<Employee | null>(null);
  const [formData, setFormData] = useState({
    nome: "",
    email: "",
    especialidade: "",
    nivel_permissao: "funcionario" as 'funcionario' | 'gerente' | 'dono',
    senha: ""
  });

  function atualizarPublicacao() {
    void queryClient.invalidateQueries({ queryKey: ["configuracao-publicacao"] });
    void queryClient.invalidateQueries({ queryKey: ["profissionais-servico"] });
    void queryClient.invalidateQueries({ queryKey: ["services"] });
    void queryClient.invalidateQueries({ queryKey: ["barbershops-list"] });
    void queryClient.invalidateQueries({ queryKey: ["barbershop"] });
  }

  // Helper functions (moved up to be accessible)
  const dbToUiPermission = (dbPermission: 'funcionario' | 'gerente' | 'dono'): 'funcionario' | 'gerente' | 'dono' => {
    return dbPermission;
  };

  const uiToDbPermission = (uiPermission: 'funcionario' | 'gerente' | 'dono'): 'funcionario' | 'gerente' | 'dono' => {
    return uiPermission;
  };

  const getPermissionBadge = (nivel: 'funcionario' | 'gerente' | 'dono') => {
    const uiLevel = dbToUiPermission(nivel);
    switch (uiLevel) {
      case 'dono':
        return (
          <Badge variant="secondary" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">
            <Crown className="w-3 h-3 mr-1" />
            Dono
          </Badge>
        );
      case 'gerente':
        return (
          <Badge variant="secondary" className="bg-blue-500/10 text-blue-600 border-blue-500/20">
            <Shield className="w-3 h-3 mr-1" />
            Gerente
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary" className="bg-green-500/10 text-green-600 border-green-500/20">
            <User className="w-3 h-3 mr-1" />
            Funcionário
          </Badge>
        );
    }
  };

  const getPermissionDescription = (permission: 'funcionario' | 'gerente' | 'dono'): string => {
    switch (permission) {
      case 'funcionario':
        return "Pode gerenciar seus próprios agendamentos.";
      case 'gerente':
        return "Pode gerenciar serviços, funcionários e ver relatórios.";
      case 'dono':
        return "Acesso total à barbearia, incluindo exclusão de membros.";
      default:
        return "";
    }
  };

  const resetForm = () => {
    setFormData({ nome: "", email: "", especialidade: "", nivel_permissao: "funcionario", senha: "" });
    setEditingEmployee(null);
  };

  const loadEmployees = useCallback(async () => {
    if (!user) return;

    try {
      const { data: barbeariaId, error: rpcError } = await supabase.rpc('get_user_barbearia_id', { user_uuid: user.id });

      if (rpcError || !barbeariaId) {
        throw new Error(rpcError?.message || "Usuário não está associado a uma barbearia.");
      }

      // Buscar funcionários ativos
      const { data: employeesData, error: employeesError } = await supabase
        .from('funcionarios')
        .select('*')
        .eq('barbearia_id', barbeariaId);

      if (employeesError) {
        throw employeesError;
      }

      // Map database fields to UI model
      const mappedEmployees = (employeesData || []).map((emp: any) => ({
        ...emp,
        // Map 'nivel' from DB to 'nivel_permissao' for UI if needed
        nivel_permissao: emp.nivel_permissao || emp.nivel,
      }));

      setEmployees(mappedEmployees as any);
    } catch (error) {
      console.error('Erro ao carregar funcionários:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os funcionários.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [user, toast]);

  useEffect(() => {
    loadEmployees();
  }, [loadEmployees]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.nome || !formData.email) {
      toast({
        title: "Campos obrigatórios",
        description: "Nome e e-mail são obrigatórios",
        variant: "destructive"
      });
      return;
    }

    // Validação básica de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      toast({
        title: "E-mail inválido",
        description: "Por favor, insira um e-mail válido",
        variant: "destructive"
      });
      return;
    }

    if (editingEmployee) {
      // --- MODO EDIÇÃO ---
      try {
        // 1. Atualizar dados na tabela funcionarios
        const { error: updateError } = await supabase
          .from('funcionarios')
          .update({
            nome: formData.nome,
            email: formData.email,
            especialidade: formData.especialidade,
            nivel: uiToDbPermission(formData.nivel_permissao) // Coluna correta é 'nivel', não 'nivel_permissao'
          })
          .eq('id', editingEmployee.id);

        if (updateError) throw updateError;

        // 2. Se tiver user_id, atualizar role na tabela profiles
        if (editingEmployee.user_id) {
          const newProfileRole = (formData.nivel_permissao === 'gerente' || formData.nivel_permissao === 'dono')
            ? 'admin'
            : 'funcionario';

          const { error: updateProfileError } = await supabase
            .from('profiles')
            .update({ role: newProfileRole })
            .eq('user_id', editingEmployee.user_id);

          if (updateProfileError) {
            console.error("Falha ao sincronizar a permissão no perfil:", updateProfileError);
            toast({
              title: "Aviso",
              description: "Dados atualizados, mas houve erro ao sincronizar permissões de acesso.",
              variant: "destructive"
            });
          } else {
            // Se o usuário editado for o próprio usuário logado, atualizar o perfil local
            if (editingEmployee.user_id === user?.id) {
              refreshProfile();
            }
          }
        }

        toast({
          title: "Sucesso",
          description: "Funcionário atualizado com sucesso"
        });

        setIsDialogOpen(false);
        resetForm();
        loadEmployees();

      } catch (error: unknown) {
        console.error('Erro ao atualizar funcionário:', error);
        toast({
          title: "Erro",
          description: error instanceof Error ? error.message : "Erro ao atualizar funcionário",
          variant: "destructive"
        });
      }
    } else {
      // --- MODO CRIAÇÃO ---
      if (formData.senha.length < SENHA_MINIMA) {
        toast({
          title: "Senha inicial muito curta",
          description: `Use pelo menos ${SENHA_MINIMA} caracteres.`,
          variant: "destructive"
        });
        return;
      }

      try {
        const { data, error } = await supabase.functions.invoke('create-employee-account', {
          body: {
            email: formData.email,
            password: formData.senha,
            nome: formData.nome,
            especialidade: formData.especialidade,
            nivel_permissao: uiToDbPermission(formData.nivel_permissao),
          }
        });

        if (error) {
          // Em respostas de erro, a mensagem da função vem no corpo da resposta
          const corpo = await (error as { context?: Response }).context?.json?.().catch(() => null);
          throw new Error(corpo?.error || 'Não foi possível cadastrar o funcionário');
        }
        if (!data?.success) {
          throw new Error(data?.error || 'Não foi possível cadastrar o funcionário');
        }

        toast({
          title: "Funcionário cadastrado",
          description: `Passe o e-mail e a senha inicial para ${formData.nome}. No primeiro acesso será pedida uma senha nova.`,
        });

        atualizarPublicacao();
        setIsDialogOpen(false);
        resetForm();
        loadEmployees();

      } catch (error: unknown) {
        console.error('Erro ao cadastrar funcionário:', error);
        toast({
          title: "Erro ao cadastrar funcionário",
          description: error instanceof Error ? error.message : "Tente novamente.",
          variant: "destructive"
        });
      }
    }
  };

  const handleEdit = (employee: Employee) => {
    setEditingEmployee(employee);
    setFormData({
      nome: employee.nome,
      email: employee.email || "",
      especialidade: employee.especialidade || "",
      nivel_permissao: dbToUiPermission(employee.nivel_permissao),
      senha: ""
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (employee: Employee) => {
    if (!employee.user_id) {
      toast({
        title: "Erro",
        description: "Este funcionário não possui um usuário associado para exclusão.",
        variant: "destructive"
      });
      return;
    }

    const isSelf = user?.id === employee.user_id;
    const confirmMessage = isSelf
      ? "Tem certeza que deseja se remover da lista de funcionários? Seu acesso administrativo será mantido."
      : `Tem certeza que deseja remover ${employee.nome}? Esta ação é irreversível e excluirá a conta do usuário.`;

    if (!confirm(confirmMessage)) return;

    try {
      if (isSelf) {
        // Se for o próprio usuário (dono), apenas remove da tabela de funcionários
        // NÃO chama a edge function pois ela deleta o usuário da autenticação
        const { error } = await supabase
          .from('funcionarios')
          .delete()
          .eq('id', employee.id);

        if (error) throw error;

        toast({
          title: "Sucesso",
          description: "Você foi removido da lista de funcionários. Seu acesso administrativo permanece ativo."
        });
      } else {
        // Se for outro funcionário, usa a edge function para limpar tudo (auth + dados)
        const { error } = await supabase.functions.invoke('delete-employee', {
          body: { employee_user_id: employee.user_id }
        });

        if (error) throw error;

        toast({
          title: "Sucesso",
          description: "Funcionário removido com sucesso de todo o sistema."
        });
      }

      atualizarPublicacao();
      loadEmployees();
    } catch (error: unknown) {
      console.error('Erro ao remover funcionário:', error);
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Erro ao remover funcionário",
        variant: "destructive"
      });
    }
  };

  const handleAddSelf = async () => {
    if (!user) return;

    try {
      const { data: barbeariaId, error: rpcError } = await supabase.rpc('get_user_barbearia_id', { user_uuid: user.id });

      if (rpcError || !barbeariaId) {
        throw new Error("Usuário não está associado a uma barbearia.");
      }

      // Check if already exists (double check)
      const isAlreadyEmployee = employees.some(e => e.user_id === user.id);
      if (isAlreadyEmployee) {
        toast({
          title: "Aviso",
          description: "Você já está cadastrado como funcionário.",
        });
        return;
      }

      // Insert into funcionarios table
      // Note: We don't need to create a user account because the user already exists
      const { error } = await supabase
        .from('funcionarios')
        .insert({
          barbearia_id: barbeariaId,
          user_id: user.id,
          nome: user.user_metadata.full_name || user.email?.split('@')[0] || "Dono",
          email: user.email,
          especialidade: "Dono / Gerente",
          nivel: 'dono', // Using 'dono' as per enum
        });

      if (error) throw error;

      // Update profiles table to set role to 'admin'
      const { error: updateProfileError } = await supabase
        .from('profiles')
        .update({ role: 'admin' })
        .eq('user_id', user.id);

      if (updateProfileError) {
        console.error("Falha ao atualizar role no perfil:", updateProfileError);
        toast({
          title: "Aviso",
          description: "Funcionário adicionado, mas houve um erro ao atualizar suas permissões de acesso. Tente recarregar a página.",
          variant: "destructive"
        });
      } else {
        // Refresh profile to update UI immediately
        await refreshProfile();
      }

      toast({
        title: "Sucesso",
        description: "Você foi adicionado à lista de funcionários e suas permissões foram atualizadas.",
      });

      loadEmployees();
    } catch (error: any) {
      console.error('Erro ao se adicionar como funcionário:', error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao se adicionar como funcionário.",
        variant: "destructive"
      });
    }
  };

  // Atendimentos finalizados e faturamento do mês, por profissional (para os cards)
  const idsEquipe = employees.map((e) => e.id);
  const resumoMes = useQuery({
    queryKey: ["equipe-resumo-mes", idsEquipe],
    enabled: idsEquipe.length > 0,
    queryFn: async () => {
      const hoje = new Date();
      const inicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
      const fim = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 1);
      const { data, error } = await supabase
        .from("agendamentos")
        .select("funcionario_id, servicos(valor)")
        .in("funcionario_id", idsEquipe)
        .eq("status", "finalizado")
        .gte("data_hora", inicio.toISOString())
        .lt("data_hora", fim.toISOString());
      if (error) throw error;
      const mapa = new Map<string, { atendimentos: number; faturamento: number }>();
      for (const linha of (data ?? []) as unknown as { funcionario_id: string | null; servicos: { valor: number } | null }[]) {
        if (!linha.funcionario_id) continue;
        const atual = mapa.get(linha.funcionario_id) ?? { atendimentos: 0, faturamento: 0 };
        mapa.set(linha.funcionario_id, {
          atendimentos: atual.atendimentos + 1,
          faturamento: atual.faturamento + Number(linha.servicos?.valor ?? 0),
        });
      }
      return mapa;
    },
  });

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-96">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </DashboardLayout>
    );
  }

  const isCurrentUserEmployee = user ? employees.some(e => e.user_id === user.id) : false;

  return (
    <DashboardLayout>
      <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Equipe</h1>
            <p className="text-sm sm:text-base text-muted-foreground">Gerencie os funcionários da sua barbearia</p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            {!isCurrentUserEmployee && role === 'admin' && (
              <Button onClick={handleAddSelf} variant="outline" className="w-full sm:w-auto border-dashed border-primary/50 hover:border-primary hover:bg-primary/5">
                <UserPlus className="w-4 h-4 mr-2" />
                Incluir-me como funcionário
              </Button>
            )}

            <Dialog open={isDialogOpen} onOpenChange={(open) => {
              setIsDialogOpen(open);
              if (!open) resetForm();
            }}>
              <DialogTrigger asChild>
                <Button className="w-full sm:w-auto">
                  <Plus className="w-4 h-4 mr-2" />
                  {editingEmployee ? "Editar Funcionário" : "Adicionar Funcionário"}
                </Button>
              </DialogTrigger>
              <DialogContent className="w-[95vw] max-w-md mx-auto">
                <DialogHeader>
                  <DialogTitle className="text-lg sm:text-xl">
                    {editingEmployee ? "Editar Funcionário" : "Adicionar Funcionário"}
                  </DialogTitle>
                  <DialogDescription className="text-sm sm:text-base">
                    {editingEmployee ? "Edite as informações do funcionário" : "Defina uma senha inicial. O funcionário cria a própria senha no primeiro acesso."}
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
                  <div>
                    <Label htmlFor="nome" className="text-sm sm:text-base">Nome completo *</Label>
                    <Input
                      id="nome"
                      value={formData.nome}
                      onChange={(e) => setFormData(prev => ({ ...prev, nome: e.target.value }))}
                      placeholder="Nome do funcionário"
                      className="text-sm sm:text-base"
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="email" className="text-sm sm:text-base">E-mail *</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                      placeholder="email@exemplo.com"
                      className="text-sm sm:text-base"
                      required
                    />
                  </div>

                  {!editingEmployee && (
                    <div>
                      <Label htmlFor="senha" className="text-sm sm:text-base">Senha inicial *</Label>
                      <Input
                        id="senha"
                        type="text"
                        autoComplete="off"
                        value={formData.senha}
                        onChange={(e) => setFormData(prev => ({ ...prev, senha: e.target.value }))}
                        placeholder={`Mínimo de ${SENHA_MINIMA} caracteres`}
                        minLength={SENHA_MINIMA}
                        className="text-sm sm:text-base"
                        required
                      />
                    </div>
                  )}

                  <div>
                    <Label htmlFor="especialidade" className="text-sm sm:text-base">Especialidade</Label>
                    <Input
                      id="especialidade"
                      value={formData.especialidade}
                      onChange={(e) => setFormData(prev => ({ ...prev, especialidade: e.target.value }))}
                      placeholder="Ex: Cortes clássicos, Barbas, etc."
                      className="text-sm sm:text-base"
                    />
                  </div>

                  <div>
                    <Label htmlFor="nivel_permissao" className="text-sm sm:text-base">Nível de permissão</Label>
                    <Select
                      value={formData.nivel_permissao}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, nivel_permissao: value as 'funcionario' | 'gerente' | 'dono' }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o nível" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="funcionario">1 - Funcionário</SelectItem>
                        <SelectItem value="gerente">2 - Gerente</SelectItem>
                        <SelectItem value="dono">3 - Dono</SelectItem>
                      </SelectContent>
                    </Select>
                    <AnimatePresence>
                      {formData.nivel_permissao && (
                        <motion.div
                          initial={{ opacity: 0, y: -10, height: 0 }}
                          animate={{ opacity: 1, y: 0, height: "auto" }}
                          exit={{ opacity: 0, y: -10, height: 0 }}
                          transition={{ duration: 0.2, ease: "easeOut" }}
                          className="flex items-start gap-2 mt-2 p-2 bg-muted/50 rounded-md"
                        >
                          <Info className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                          <p className="text-sm text-muted-foreground">
                            {getPermissionDescription(formData.nivel_permissao)}
                          </p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
                    <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} className="w-full sm:w-auto text-sm sm:text-base">
                      Cancelar
                    </Button>
                    <Button type="submit" className="w-full sm:w-auto text-sm sm:text-base">
                      {editingEmployee ? "Atualizar" : "Cadastrar Funcionário"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Funcionários Ativos */}
        <div className="mb-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            Equipe Ativa ({employees.length})
          </h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {employees.map((employee) => {
              const doMes = resumoMes.data?.get(employee.id);
              return (
              <article
                key={employee.id}
                className="group relative flex flex-col rounded-3xl border border-border/60 bg-card p-5 shadow-brand-sm transition-shadow hover:shadow-brand-md"
              >
                <button
                  type="button"
                  onClick={() => setDetalhe(employee)}
                  className="absolute inset-0 rounded-3xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label={`Ver detalhes de ${employee.nome}`}
                />
                <div className="flex items-start gap-3">
                  <Avatar className="h-14 w-14 border-2 border-background shadow-brand-sm">
                    <AvatarImage src={employee.foto_url ?? undefined} alt="" className="object-cover" />
                    <AvatarFallback className="bg-primary/10 font-semibold text-primary">{iniciais(employee.nome)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-base font-semibold">{employee.nome}</h3>
                    <div className="mt-1">{getPermissionBadge(employee.nivel_permissao)}</div>
                  </div>
                  <div className="relative z-10 flex gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Editar ${employee.nome}`}
                      onClick={() => handleEdit(employee)}>
                      <Edit className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"
                      aria-label={`Remover ${employee.nome}`} onClick={() => handleDelete(employee)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                {employee.email && (
                  <p className="mt-3 flex items-center gap-1.5 truncate text-sm text-muted-foreground">
                    <Mail className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    <span className="truncate">{employee.email}</span>
                  </p>
                )}

                <div className="mt-4 grid grid-cols-2 gap-2 border-t border-border/60 pt-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Atendimentos no mês</p>
                    <p className="font-display text-lg font-bold">{doMes?.atendimentos ?? 0}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Faturamento no mês</p>
                    <p className="font-display text-lg font-bold">{formatBRL(doMes?.faturamento ?? 0)}</p>
                  </div>
                </div>
                <p className="mt-3 flex items-center gap-1 text-xs font-medium text-primary">
                  Ver desempenho e pagamento <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                </p>
              </article>
              );
            })}

            {employees.length === 0 && (
              <div className="col-span-full text-center py-8 sm:py-12 px-4">
                <Users className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-3 sm:mb-4 text-muted-foreground/50" />
                <h3 className="text-base sm:text-lg font-medium mb-2">Nenhum funcionário cadastrado</h3>
                <p className="text-sm sm:text-base text-muted-foreground mb-3 sm:mb-4">
                  Adicione funcionários à sua equipe
                </p>
                <Button onClick={() => setIsDialogOpen(true)} className="w-full sm:w-auto">
                  <Plus className="w-4 h-4 mr-2" />
                  Adicionar Funcionário
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
      <DetalheProfissional
        profissional={detalhe}
        podeEditar={role === "admin"}
        onFechar={() => setDetalhe(null)}
        onFotoAtualizada={() => { void loadEmployees(); }}
      />
    </DashboardLayout>
  );
}
