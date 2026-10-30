import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  UserPlus
} from "lucide-react";
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
  nivel_permissao: 'funcionario' | 'gerente' | 'dono';
  user_id: string;
  barbearia_id: string;
}

const SENHA_MINIMA = 8;

export default function Team() {
  const { user, role, refreshProfile } = useAuth();
  const { toast } = useToast();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [formData, setFormData] = useState({
    nome: "",
    email: "",
    especialidade: "",
    nivel_permissao: "funcionario" as 'funcionario' | 'gerente' | 'dono',
    senha: ""
  });

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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {employees.map((employee) => (
              <Card key={employee.id} className="border-border/50 bg-card/50 backdrop-blur-sm hover:shadow-brand-md transition-all duration-300">
                <CardHeader className="flex-row items-start justify-between space-y-0 p-4 sm:p-6">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 bg-primary/10 rounded-full flex items-center justify-center overflow-hidden">
                      <User className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-base sm:text-lg">{employee.nome}</CardTitle>
                      {getPermissionBadge(employee.nivel_permissao)}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 sm:h-8 sm:w-8"
                      onClick={() => handleEdit(employee)}
                    >
                      <Edit className="w-3 h-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 sm:h-8 sm:w-8 text-destructive hover:text-destructive"
                      onClick={() => handleDelete(employee)}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-4 sm:p-6 pt-0">
                  <div className="space-y-1 sm:space-y-2">
                    {employee.email && (
                      <p className="text-xs sm:text-sm text-muted-foreground">
                        📧 {employee.email}
                      </p>
                    )}
                    {employee.especialidade && (
                      <p className="text-xs sm:text-sm text-muted-foreground">
                        🎯 {employee.especialidade}
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}

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
    </DashboardLayout>
  );
}