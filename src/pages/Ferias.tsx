import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar, Trash2, Edit, Plus, Briefcase, Plane, MoreHorizontal } from 'lucide-react';
import { DashboardLayout } from '@/layouts/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useUserRole } from '@/hooks/useUserRole';
import { useFuncionarioAusencias, FuncionarioAusencia } from '@/hooks/useFuncionarioAusencias';
import { useResponsive } from '@/hooks/use-mobile';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import PageLoader from '@/components/PageLoader';

export default function Ferias() {
  const { barbeariaId, isAdmin } = useUserRole();
  const { isMobile } = useResponsive();
  const [open, setOpen] = useState(false);
  const [editingAusencia, setEditingAusencia] = useState<FuncionarioAusencia | null>(null);

  const [formData, setFormData] = useState<FuncionarioAusencia>({
    funcionario_id: '',
    barbearia_id: barbeariaId || '',
    tipo: 'ferias',
    data_inicio: '',
    data_fim: '',
    motivo: '',
  });

  const { ausencias, isLoading, createAusencia, updateAusencia, deleteAusencia } =
    useFuncionarioAusencias(barbeariaId || '');

  const { data: funcionarios } = useQuery({
    queryKey: ['funcionarios', barbeariaId],
    queryFn: async () => {
      if (!barbeariaId) return [];

      const { data, error } = await supabase
        .from('funcionarios')
        .select('id, nome')
        .eq('barbearia_id', barbeariaId)
        .order('nome');

      if (error) throw error;
      return data;
    },
    enabled: !!barbeariaId && isAdmin,
  });

  if (!isAdmin) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-[60vh]">
          <p className="text-muted-foreground">Acesso restrito a administradores</p>
        </div>
      </DashboardLayout>
    );
  }

  if (isLoading) {
    return <PageLoader />;
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (editingAusencia?.id) {
      updateAusencia.mutate(
        { ...formData, id: editingAusencia.id },
        {
          onSuccess: () => {
            setOpen(false);
            resetForm();
          },
        }
      );
    } else {
      createAusencia.mutate(formData, {
        onSuccess: () => {
          setOpen(false);
          resetForm();
        },
      });
    }
  };

  const resetForm = () => {
    setFormData({
      funcionario_id: '',
      barbearia_id: barbeariaId || '',
      tipo: 'ferias',
      data_inicio: '',
      data_fim: '',
      motivo: '',
    });
    setEditingAusencia(null);
  };

  const handleEdit = (ausencia: any) => {
    setEditingAusencia(ausencia);
    setFormData({
      funcionario_id: ausencia.funcionario_id,
      barbearia_id: ausencia.barbearia_id,
      tipo: ausencia.tipo,
      data_inicio: ausencia.data_inicio,
      data_fim: ausencia.data_fim,
      motivo: ausencia.motivo || '',
    });
    setOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm('Tem certeza que deseja excluir esta ausência?')) {
      deleteAusencia.mutate(id);
    }
  };

  const getTipoIcon = (tipo: string) => {
    switch (tipo) {
      case 'ferias':
        return <Plane className="h-4 w-4" />;
      case 'recesso':
        return <Briefcase className="h-4 w-4" />;
      default:
        return <MoreHorizontal className="h-4 w-4" />;
    }
  };

  const getTipoBadge = (tipo: string) => {
    const variants: any = {
      ferias: 'default',
      recesso: 'secondary',
      outro: 'outline',
    };
    return variants[tipo] || 'outline';
  };

  const isAusenciaAtiva = (dataInicio: string, dataFim: string) => {
    const hoje = new Date();
    const inicio = new Date(dataInicio);
    const fim = new Date(dataFim);
    return hoje >= inicio && hoje <= fim;
  };

  const diasAusencia = (dataInicio: string, dataFim: string) => {
    const inicio = new Date(dataInicio);
    const fim = new Date(dataFim);
    const diff = fim.getTime() - inicio.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24)) + 1;
  };

  return (
    <DashboardLayout>
      <div className="p-4 sm:p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Férias e Recessos</h1>
            <p className="text-sm sm:text-base text-muted-foreground">
              Gerencie períodos de ausência dos funcionários
            </p>
          </div>

          <Dialog open={open} onOpenChange={(isOpen) => {
            setOpen(isOpen);
            if (!isOpen) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button className="w-full sm:w-auto">
                <Plus className="h-4 w-4 mr-2" />
                Nova Ausência
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>
                  {editingAusencia ? 'Editar Ausência' : 'Nova Ausência'}
                </DialogTitle>
                <DialogDescription>
                  Cadastre períodos de férias, recessos ou outras ausências
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="funcionario">Funcionário</Label>
                  <Select
                    value={formData.funcionario_id}
                    onValueChange={(value) =>
                      setFormData({ ...formData, funcionario_id: value })
                    }
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o funcionário" />
                    </SelectTrigger>
                    <SelectContent>
                      {funcionarios?.map((func) => (
                        <SelectItem key={func.id} value={func.id}>
                          {func.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tipo">Tipo</Label>
                  <Select
                    value={formData.tipo}
                    onValueChange={(value: any) => setFormData({ ...formData, tipo: value })}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ferias">Férias</SelectItem>
                      <SelectItem value="recesso">Recesso</SelectItem>
                      <SelectItem value="outro">Outro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="data_inicio">Data Início</Label>
                    <Input
                      id="data_inicio"
                      type="date"
                      value={formData.data_inicio}
                      onChange={(e) =>
                        setFormData({ ...formData, data_inicio: e.target.value })
                      }
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="data_fim">Data Fim</Label>
                    <Input
                      id="data_fim"
                      type="date"
                      value={formData.data_fim}
                      onChange={(e) => setFormData({ ...formData, data_fim: e.target.value })}
                      min={formData.data_inicio}
                      required
                    />
                  </div>
                </div>

                {formData.data_inicio && formData.data_fim && (
                  <p className="text-sm text-muted-foreground">
                    {diasAusencia(formData.data_inicio, formData.data_fim)} dias
                  </p>
                )}

                <div className="space-y-2">
                  <Label htmlFor="motivo">Motivo (opcional)</Label>
                  <Textarea
                    id="motivo"
                    value={formData.motivo}
                    onChange={(e) => setFormData({ ...formData, motivo: e.target.value })}
                    placeholder="Descreva o motivo da ausência..."
                    rows={3}
                  />
                </div>

                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setOpen(false);
                      resetForm();
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={createAusencia.isPending || updateAusencia.isPending}>
                    {editingAusencia ? 'Atualizar' : 'Cadastrar'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Ausências Cadastradas</CardTitle>
            <CardDescription>
              Lista de todas as férias e recessos programados
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!ausencias || ausencias.length === 0 ? (
              <div className="text-center py-12">
                <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Nenhuma ausência cadastrada</p>
              </div>
            ) : isMobile ? (
              <div className="space-y-4">
                {ausencias.map((ausencia: any) => (
                  <div key={ausencia.id} className="border rounded-lg p-4 space-y-3 bg-card">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-medium">{ausencia.funcionarios?.nome}</h3>
                        <div className="mt-1">
                          <Badge variant={getTipoBadge(ausencia.tipo)}>
                            <span className="flex items-center gap-1">
                              {getTipoIcon(ausencia.tipo)}
                              {ausencia.tipo.charAt(0).toUpperCase() + ausencia.tipo.slice(1)}
                            </span>
                          </Badge>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => handleEdit(ausencia)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-destructive"
                          onClick={() => handleDelete(ausencia.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-muted-foreground block">Início</span>
                        {format(new Date(ausencia.data_inicio + 'T00:00:00'), 'dd/MM/yyyy', {
                          locale: ptBR,
                        })}
                      </div>
                      <div>
                        <span className="text-muted-foreground block">Fim</span>
                        {format(new Date(ausencia.data_fim + 'T00:00:00'), 'dd/MM/yyyy', {
                          locale: ptBR,
                        })}
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t">
                      <span className="text-sm text-muted-foreground">
                        {diasAusencia(ausencia.data_inicio, ausencia.data_fim)} dias
                      </span>
                      <div>
                        {isAusenciaAtiva(ausencia.data_inicio, ausencia.data_fim) ? (
                          <Badge variant="destructive">Ativo</Badge>
                        ) : new Date(ausencia.data_inicio) > new Date() ? (
                          <Badge variant="outline">Futuro</Badge>
                        ) : (
                          <Badge variant="secondary">Concluído</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Funcionário</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Período</TableHead>
                    <TableHead>Dias</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ausencias.map((ausencia: any) => (
                    <TableRow key={ausencia.id}>
                      <TableCell className="font-medium">
                        {ausencia.funcionarios?.nome}
                      </TableCell>
                      <TableCell>
                        <Badge variant={getTipoBadge(ausencia.tipo)}>
                          <span className="flex items-center gap-1">
                            {getTipoIcon(ausencia.tipo)}
                            {ausencia.tipo.charAt(0).toUpperCase() + ausencia.tipo.slice(1)}
                          </span>
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col text-sm">
                          <span>
                            {format(new Date(ausencia.data_inicio + 'T00:00:00'), 'dd/MM/yyyy', {
                              locale: ptBR,
                            })}
                          </span>
                          <span className="text-muted-foreground">até</span>
                          <span>
                            {format(new Date(ausencia.data_fim + 'T00:00:00'), 'dd/MM/yyyy', {
                              locale: ptBR,
                            })}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {diasAusencia(ausencia.data_inicio, ausencia.data_fim)} dias
                      </TableCell>
                      <TableCell>
                        {isAusenciaAtiva(ausencia.data_inicio, ausencia.data_fim) ? (
                          <Badge variant="destructive">Ativo</Badge>
                        ) : new Date(ausencia.data_inicio) > new Date() ? (
                          <Badge variant="outline">Futuro</Badge>
                        ) : (
                          <Badge variant="secondary">Concluído</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEdit(ausencia)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDelete(ausencia.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
