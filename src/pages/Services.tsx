import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
  Scissors, 
  Clock, 
  DollarSign
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { DashboardLayout } from "@/layouts/DashboardLayout";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// --- Tipos ---
interface Service {
  id: string;
  nome: string;
  descricao: string;
  valor: number;
  duracao_minutos: number;
  barbearia_id: string;
  categoria_id: string | null;
  categoria_id_2?: string | null;
  categoria_principal?: { nome: string } | null;
  categoria_secundaria?: { nome: string } | null;
}

interface Category {
  id: string;
  nome: string;
}

interface ServiceFormData {
  nome: string;
  descricao: string;
  valor: string;
  duracao_minutos: string;
  categoria_id: string;
  categoria_id_2: string; // "none" quando não selecionada
}

interface ServicePayload {
  nome: string;
  descricao: string;
  valor: number;
  duracao_minutos: number;
  categoria_id: string | null;
  categoria_id_2: string | null;
}

// --- Funções de API ---
const fetchCategories = async (): Promise<Category[]> => {
  const { data, error } = await supabase.from('categorias_servicos').select('id, nome').order('nome');
  if (error) throw new Error(error.message);
  return data || [];
};

const fetchServices = async (userId: string): Promise<Service[]> => {
  if (!userId) return [];
  const { data: barbeariaId, error: rpcError } = await supabase.rpc('get_user_barbearia_id', { user_uuid: userId });
  if (rpcError || !barbeariaId) throw new Error(rpcError?.message || "Usuário não associado a uma barbearia.");
  
  // Buscar serviços sem joins primeiro
  const { data: servicos, error } = await supabase
    .from('servicos')
    .select('*')
    .eq('barbearia_id', barbeariaId)
    .order('nome');
  
  if (error) throw new Error(error.message);
  if (!servicos) return [];

  // Buscar categorias separadamente para evitar ambiguidade
  const categoriaIds = [...new Set([
    ...servicos.filter(s => s.categoria_id).map(s => s.categoria_id),
    ...servicos.filter(s => s.categoria_id_2).map(s => s.categoria_id_2)
  ].filter(Boolean) as string[])];

  let categorias: { id: string; nome: string; }[] = [];
  if (categoriaIds.length > 0) {
    const { data } = await supabase
      .from('categorias_servicos')
      .select('id, nome')
      .in('id', categoriaIds);
    categorias = data || [];
  }

  // Combinar dados
  return servicos.map(servico => ({
    ...servico,
    descricao: servico.descricao || '',
    categoria_principal: servico.categoria_id 
      ? categorias.find(c => c.id === servico.categoria_id) || null 
      : null,
    categoria_secundaria: servico.categoria_id_2 
      ? categorias.find(c => c.id === servico.categoria_id_2) || null 
      : null
  })) as Service[];
};

export default function Services() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [formData, setFormData] = useState<ServiceFormData>({
    nome: "",
    descricao: "",
    valor: "",
    duracao_minutos: "",
    categoria_id: "",
    categoria_id_2: "none"
  });

  // Função para contar palavras
  const countWords = (text: string): number => {
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
  };

  const MAX_DESCRIPTION_WORDS = 50;

  // --- Queries ---
  const { data: categories = [], isLoading: isLoadingCategories, error: categoriesError } = useQuery<Category[]>({
    queryKey: ['categories'],
    queryFn: fetchCategories
  });

  const { data: services = [], isLoading: isLoadingServices, error: servicesError } = useQuery<Service[]>({
    queryKey: ['services', user?.id],
    queryFn: () => fetchServices(user!.id),
    enabled: !!user
  });

  // --- Mutações ---
  const serviceMutation = useMutation({
    mutationFn: async (serviceData: ServicePayload) => {
      const { data: barbeariaId, error: rpcError } = await supabase.rpc('get_user_barbearia_id', { user_uuid: user!.id });
      if (rpcError || !barbeariaId) {
        console.error('Erro ao obter barbearia ID:', rpcError);
        throw new Error("Barbearia não encontrada.");
      }

      const payload = { ...serviceData, barbearia_id: barbeariaId };

      if (editingService) {
        const { error } = await supabase.from('servicos').update(payload).eq('id', editingService.id);
        if (error) {
          console.error('Erro ao atualizar serviço:', error);
          throw error;
        }
        return "Serviço atualizado com sucesso";
      } else {
        const { error } = await supabase.from('servicos').insert(payload);
        if (error) {
          console.error('Erro ao criar serviço:', error);
          throw error;
        }
        return "Serviço criado com sucesso";
      }
    },
    onSuccess: (message) => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
      toast({ title: "Sucesso", description: message });
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('servicos').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
      toast({ title: "Sucesso", description: "Serviço excluído com sucesso" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nome || !formData.valor || !formData.duracao_minutos || !formData.categoria_id) {
        toast({ title: "Campos obrigatórios", description: "Preencha todos os campos obrigatórios.", variant: "destructive"});
        return;
    }
    
    // Validar se as categorias são diferentes (se ambas foram selecionadas)
    if (formData.categoria_id && formData.categoria_id_2 && formData.categoria_id_2 !== "none" && formData.categoria_id === formData.categoria_id_2) {
        toast({ title: "Categorias inválidas", description: "As duas categorias devem ser diferentes.", variant: "destructive"});
        return;
    }
    
    // Validar limite de palavras na descrição
    if (countWords(formData.descricao) > MAX_DESCRIPTION_WORDS) {
        toast({ 
          title: "Descrição muito longa", 
          description: `A descrição deve ter no máximo ${MAX_DESCRIPTION_WORDS} palavras.`, 
          variant: "destructive"
        });
        return;
    }
    
    const serviceData: ServicePayload = {
      nome: formData.nome,
      descricao: formData.descricao,
      valor: parseFloat(formData.valor),
      duracao_minutos: parseInt(formData.duracao_minutos),  
      categoria_id: formData.categoria_id || null,
      categoria_id_2: formData.categoria_id_2 === "none" ? null : (formData.categoria_id_2 || null),
    };

    serviceMutation.mutate(serviceData);
  };

  const handleDelete = (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este serviço?')) return;
    deleteMutation.mutate(id);
  };

  const handleEdit = (service: Service) => {
    setEditingService(service);
    setFormData({
      nome: service.nome,
      descricao: service.descricao || "",
      valor: service.valor.toString(),
      duracao_minutos: service.duracao_minutos.toString(),
      categoria_id: service.categoria_id || "",
      categoria_id_2: service.categoria_id_2 ? service.categoria_id_2 : "none"
    });
    setIsDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({ nome: "", descricao: "", valor: "", duracao_minutos: "", categoria_id: "", categoria_id_2: "none" });
    setEditingService(null);
  };
  
  const isLoading = isLoadingCategories || isLoadingServices;
  const queryError = categoriesError || servicesError;

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-96">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </DashboardLayout>
    );
  }
  
  if (queryError) {
      return (
          <DashboardLayout>
              <div className="p-6 text-center text-red-500">
                  Erro ao carregar dados: {queryError.message}
              </div>
          </DashboardLayout>
      )
  }

  return (
    <DashboardLayout>
      <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Gerenciar Serviços</h1>
            <p className="text-sm sm:text-base text-muted-foreground">Gerencie os serviços oferecidos pela sua barbearia</p>
          </div>
          
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button className="w-full sm:w-auto">
                <Plus className="w-4 h-4 mr-2" />
                Novo Serviço
              </Button>
            </DialogTrigger>
            <DialogContent className="w-[95vw] max-w-md mx-auto">
              <DialogHeader>
                <DialogTitle className="text-lg sm:text-xl">
                  {editingService ? "Editar Serviço" : "Novo Serviço"}
                </DialogTitle>
                <DialogDescription className="text-sm sm:text-base">
                  {editingService ? "Edite as informações do serviço" : "Preencha os dados para criar um novo serviço"}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
                <div>
                  <Label htmlFor="nome" className="text-sm sm:text-base">Nome do serviço *</Label>
                  <Input
                    id="nome"
                    value={formData.nome}
                    onChange={(e) => setFormData(prev => ({ ...prev, nome: e.target.value }))}
                    placeholder="Ex: Corte + Barba"
                    className="text-sm sm:text-base"
                    required
                  />
                </div>
                
                <div className="space-y-3 sm:space-y-4">
                  <div>
                    <Label htmlFor="categoria" className="text-sm sm:text-base">Categoria Principal *</Label>
                    <Select
                      value={formData.categoria_id}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, categoria_id: value }))}
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a categoria principal" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map(category => (
                          <SelectItem key={category.id} value={category.id}>
                            {category.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="categoria_2" className="text-sm sm:text-base">Categoria Secundária (opcional)</Label>
                    <Select
                      value={formData.categoria_id_2 || "none"}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, categoria_id_2: value === "none" ? "none" : value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione uma segunda categoria" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Nenhuma</SelectItem>
                        {categories
                          .filter(category => category.id !== formData.categoria_id)
                          .map(category => (
                            <SelectItem key={category.id} value={category.id}>
                              {category.nome}
                            </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground mt-1">
                      Máximo de 2 categorias por serviço
                    </p>
                  </div>
                </div>

                <div>
                  <Label htmlFor="descricao" className="text-sm sm:text-base">Descrição</Label>
                  <Textarea
                    id="descricao"
                    value={formData.descricao}
                    onChange={(e) => {
                      const text = e.target.value;
                      const wordCount = countWords(text);
                      
                      if (wordCount <= MAX_DESCRIPTION_WORDS || text.length < formData.descricao.length) {
                        setFormData(prev => ({ ...prev, descricao: text }));
                      }
                    }}
                    placeholder="Descreva o serviço..."
                    rows={3}
                    className={`text-sm sm:text-base ${countWords(formData.descricao) > MAX_DESCRIPTION_WORDS ? "border-red-500" : ""}`}
                  />
                  <div className="flex justify-between items-center mt-1">
                    <p className="text-xs text-muted-foreground">
                      Descreva brevemente o serviço oferecido
                    </p>
                    <p className={`text-xs ${
                      countWords(formData.descricao) > MAX_DESCRIPTION_WORDS 
                        ? "text-red-500" 
                        : countWords(formData.descricao) > MAX_DESCRIPTION_WORDS * 0.8 
                          ? "text-orange-500" 
                          : "text-muted-foreground"
                    }`}>
                      {countWords(formData.descricao)}/{MAX_DESCRIPTION_WORDS} palavras
                    </p>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div>
                    <Label htmlFor="valor" className="text-sm sm:text-base">Valor (R$) *</Label>
                    <Input
                      id="valor"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.valor}
                      onChange={(e) => setFormData(prev => ({ ...prev, valor: e.target.value }))}
                      placeholder="0,00"
                      className="text-sm sm:text-base"
                      required
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="duracao_minutos" className="text-sm sm:text-base">Duração (min) *</Label>
                    <Input
                      id="duracao_minutos"
                      type="number"
                      min="1"
                      value={formData.duracao_minutos}
                      onChange={(e) => setFormData(prev => ({ ...prev, duracao_minutos: e.target.value }))}
                      placeholder="30"
                      className="text-sm sm:text-base"
                      required
                    />
                  </div>
                </div>
                
                <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} className="w-full sm:w-auto text-sm sm:text-base">
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={serviceMutation.isPending} className="w-full sm:w-auto text-sm sm:text-base">
                    {serviceMutation.isPending ? "Salvando..." : (editingService ? "Atualizar" : "Criar")}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {services.map((service) => (
            <Card key={service.id} className="border-border/50 bg-card/50 backdrop-blur-sm hover:shadow-brand-md transition-all duration-300">
              <CardHeader className="flex-row items-start justify-between space-y-0 pb-2 sm:pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                    <Scissors className="w-3 h-3 sm:w-4 sm:h-4 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-base sm:text-lg">{service.nome}</CardTitle>
                    <div className="flex gap-1 mt-1 flex-wrap">
                      {service.categoria_principal?.nome && (
                        <Badge variant="outline" className="text-xs">{service.categoria_principal.nome}</Badge>
                      )}
                      {service.categoria_secundaria?.nome && (
                        <Badge variant="secondary" className="text-xs">{service.categoria_secundaria.nome}</Badge>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 sm:h-8 sm:w-8"
                    onClick={() => handleEdit(service)}
                  >
                    <Edit className="w-3 h-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 sm:h-8 sm:w-8 text-destructive hover:text-destructive"
                    onClick={() => handleDelete(service.id)}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 sm:space-y-4">
                {service.descricao && (
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    {service.descricao}
                  </p>
                )}
                
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-0">
                  <div className="flex items-center gap-1 text-xs sm:text-sm text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    {service.duracao_minutos} min
                  </div>
                  <Badge variant="secondary" className="bg-primary/10 text-primary text-xs sm:text-sm">
                    <DollarSign className="w-3 h-3 mr-1" />
                    R$ {service.valor.toFixed(2)}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
          
          {services.length === 0 && (
            <div className="col-span-full text-center py-8 sm:py-12 px-4">
              <Scissors className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-3 sm:mb-4 text-muted-foreground/50" />
              <h3 className="text-base sm:text-lg font-medium mb-2">Nenhum serviço cadastrado</h3>
              <p className="text-sm sm:text-base text-muted-foreground mb-3 sm:mb-4">
                Cadastre o primeiro serviço da sua barbearia
              </p>
              <Button onClick={() => setIsDialogOpen(true)} className="w-full sm:w-auto">
                <Plus className="w-4 h-4 mr-2" />
                Adicionar Serviço
              </Button>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}