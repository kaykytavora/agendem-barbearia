import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Edit, Trash2, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DashboardLayout } from '@/layouts/DashboardLayout';

interface FidelidadeConfig {
  id: string;
  barbearia_id: string;
  pontos_por_servico: number;
}

interface Recompensa {
  id: string;
  nome: string;
  descricao: string | null;
  pontos_necessarios: number;
  ativo: boolean;
  barbearia_id: string;
}

const FidelidadeConfiguracoes = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<FidelidadeConfig | null>(null);
  const [recompensas, setRecompensas] = useState<Recompensa[]>([]);
  const [pontosServico, setPontosServico] = useState(1);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRecompensa, setEditingRecompensa] = useState<Recompensa | null>(null);
  const [formData, setFormData] = useState({
    nome: '',
    descricao: '',
    pontos_necessarios: 0
  });

  useEffect(() => {
    if (user) {
      fetchConfiguracoes();
      fetchRecompensas();
    }
  }, [user]);

  const fetchConfiguracoes = async () => {
    try {
      const { data, error } = await supabase
        .from('fidelidade_configuracoes')
        .select('*')
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data) {
        setConfig(data);
        setPontosServico(data.pontos_por_servico);
      }
    } catch (error) {
      console.error('Erro ao buscar configurações:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar as configurações.',
        variant: 'destructive',
      });
    }
  };

  const fetchRecompensas = async () => {
    try {
      const { data, error } = await supabase
        .from('recompensas')
        .select('*')
        .order('pontos_necessarios', { ascending: true });

      if (error) throw error;

      setRecompensas(data || []);
    } catch (error) {
      console.error('Erro ao buscar recompensas:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar as recompensas.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const salvarConfiguracoes = async () => {
    if (!user?.id) return;
    
    setSaving(true);
    try {
      if (config) {
        // Atualizar configuração existente
        const { error } = await supabase
          .from('fidelidade_configuracoes')
          .update({ pontos_por_servico: pontosServico })
          .eq('id', config.id);

        if (error) throw error;
      } else {
        // Criar nova configuração
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('barbearia_id')
          .eq('user_id', user.id)
          .single();

        if (profileError || !profileData?.barbearia_id) {
          throw new Error('Barbearia não encontrada');
        }

        const { error } = await supabase
          .from('fidelidade_configuracoes')
          .insert({
            barbearia_id: profileData.barbearia_id,
            pontos_por_servico: pontosServico
          });

        if (error) throw error;
      }

      toast({
        title: 'Sucesso',
        description: 'Configurações salvas com sucesso!',
      });

      fetchConfiguracoes();
    } catch (error) {
      console.error('Erro ao salvar configurações:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível salvar as configurações.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const salvarRecompensa = async () => {
    if (!user?.id) return;
    
    setSaving(true);
    try {
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('barbearia_id')
        .eq('user_id', user.id)
        .single();

      if (profileError || !profileData?.barbearia_id) {
        throw new Error('Barbearia não encontrada');
      }

      if (editingRecompensa) {
        // Atualizar recompensa existente
        const { error } = await supabase
          .from('recompensas')
          .update({
            nome: formData.nome,
            descricao: formData.descricao || null,
            pontos_necessarios: formData.pontos_necessarios
          })
          .eq('id', editingRecompensa.id);

        if (error) throw error;
      } else {
        // Criar nova recompensa
        const { error } = await supabase
          .from('recompensas')
          .insert({
            nome: formData.nome,
            descricao: formData.descricao || null,
            pontos_necessarios: formData.pontos_necessarios,
            barbearia_id: profileData.barbearia_id
          });

        if (error) throw error;
      }

      toast({
        title: 'Sucesso',
        description: `Recompensa ${editingRecompensa ? 'atualizada' : 'criada'} com sucesso!`,
      });

      setIsDialogOpen(false);
      setEditingRecompensa(null);
      setFormData({ nome: '', descricao: '', pontos_necessarios: 0 });
      fetchRecompensas();
    } catch (error) {
      console.error('Erro ao salvar recompensa:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível salvar a recompensa.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const excluirRecompensa = async (id: string) => {
    try {
      const { error } = await supabase
        .from('recompensas')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Sucesso',
        description: 'Recompensa excluída com sucesso!',
      });

      fetchRecompensas();
    } catch (error) {
      console.error('Erro ao excluir recompensa:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível excluir a recompensa.',
        variant: 'destructive',
      });
    }
  };

  const abrirDialogEdicao = (recompensa: Recompensa) => {
    setEditingRecompensa(recompensa);
    setFormData({
      nome: recompensa.nome,
      descricao: recompensa.descricao || '',
      pontos_necessarios: recompensa.pontos_necessarios
    });
    setIsDialogOpen(true);
  };

  const abrirDialogCriacao = () => {
    setEditingRecompensa(null);
    setFormData({ nome: '', descricao: '', pontos_necessarios: 0 });
    setIsDialogOpen(true);
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="mt-2 text-muted-foreground">Carregando configurações...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 p-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Configurações de Fidelidade</h1>
          <p className="text-muted-foreground">
            Configure pontos por serviço e gerencie as recompensas da sua barbearia.
          </p>
        </div>

        {/* Configurações Gerais */}
        <Card>
          <CardHeader>
            <CardTitle>Configurações Gerais</CardTitle>
            <CardDescription>
              Defina quantos pontos os clientes ganham por serviço finalizado.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="pontos-servico">Pontos por Serviço</Label>
              <Input
                id="pontos-servico"
                type="number"
                min="1"
                value={pontosServico}
                onChange={(e) => setPontosServico(parseInt(e.target.value) || 1)}
                className="w-32"
              />
              <p className="text-sm text-muted-foreground">
                Número de pontos que cada cliente ganha ao finalizar um serviço.
              </p>
            </div>
            <Button onClick={salvarConfiguracoes} disabled={saving}>
              <Save className="w-4 h-4 mr-2" />
              {saving ? 'Salvando...' : 'Salvar Configurações'}
            </Button>
          </CardContent>
        </Card>

        {/* Recompensas */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div>
              <CardTitle>Recompensas</CardTitle>
              <CardDescription>
                Gerencie as recompensas disponíveis para seus clientes.
              </CardDescription>
            </div>
            <Button onClick={abrirDialogCriacao}>
              <Plus className="w-4 h-4 mr-2" />
              Nova Recompensa
            </Button>
          </CardHeader>
          <CardContent>
            {recompensas.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-muted-foreground">Nenhuma recompensa cadastrada.</p>
                <Button onClick={abrirDialogCriacao} variant="outline" className="mt-2">
                  <Plus className="w-4 h-4 mr-2" />
                  Criar primeira recompensa
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {recompensas.map((recompensa) => (
                  <div
                    key={recompensa.id}
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div className="flex-1">
                      <h3 className="font-medium">{recompensa.nome}</h3>
                      <p className="text-sm text-muted-foreground">{recompensa.descricao}</p>
                      <p className="text-sm font-medium text-primary">
                        {recompensa.pontos_necessarios} pontos
                      </p>
                    </div>
                    <div className="flex space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => abrirDialogEdicao(recompensa)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => excluirRecompensa(recompensa.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Dialog para criar/editar recompensa */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingRecompensa ? 'Editar Recompensa' : 'Nova Recompensa'}
              </DialogTitle>
              <DialogDescription>
                {editingRecompensa 
                  ? 'Atualize as informações da recompensa.'
                  : 'Crie uma nova recompensa para seus clientes.'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="nome">Nome da Recompensa</Label>
                <Input
                  id="nome"
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  placeholder="Ex: Corte Grátis"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="descricao">Descrição</Label>
                <Textarea
                  id="descricao"
                  value={formData.descricao}
                  onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                  placeholder="Descreva a recompensa..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pontos">Pontos Necessários</Label>
                <Input
                  id="pontos"
                  type="number"
                  min="1"
                  value={formData.pontos_necessarios}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    pontos_necessarios: parseInt(e.target.value) || 0 
                  })}
                />
              </div>
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={salvarRecompensa} disabled={saving || !formData.nome}>
                  {saving ? 'Salvando...' : (editingRecompensa ? 'Atualizar' : 'Criar')}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default FidelidadeConfiguracoes;