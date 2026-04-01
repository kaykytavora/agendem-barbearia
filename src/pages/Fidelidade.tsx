import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
    Award, Users, TrendingUp, Search, Crown, Star,
    Gift, Plus, Edit, Trash2, CheckCircle, Loader2
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { DashboardLayout } from "@/layouts/DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { usePhoneMask } from "@/hooks/usePhoneMask";
import { Helmet } from "react-helmet-async";

interface FidelidadeClient {
    id: string;
    cliente_telefone: string | null;
    pontos: number;
    updated_at: string;
    user_id: string;
    barbearia_id: string;
    profiles?: {
        name: string;
    } | null;
}

interface Recompensa {
    id: string;
    nome: string;
    descricao: string | null;
    pontos_necessarios: number;
    ativo: boolean;
    barbearia_id: string;
    created_at: string;
    updated_at: string;
}

interface ConfiguracaoFidelidade {
    id?: string;
    pontos_por_servico: number;
    pontos_minimos_recompensa?: number;
    dias_expiracao?: number;
    ativo?: boolean;
    barbearia_id: string;
}

// Função para buscar os dados de fidelidade
const fetchFidelidadeData = async (userId: string, barbeariaId: string) => {
    if (!userId || !barbeariaId) {
        throw new Error("Usuário ou barbearia não identificados.");
    }

    const { data, error } = await supabase
        .from('fidelidade')
        .select(`
      *,
      profiles!fidelidade_user_id_fkey (
        name
      )
    `)
        .eq('barbearia_id', barbeariaId)
        .order('pontos', { ascending: false });

    if (error) throw new Error(error.message);
    return data || [];
};

// Função para buscar o ID da barbearia do usuário
const fetchUserBarbeariaId = async (userId: string) => {
    const { data, error } = await supabase.rpc('get_user_barbearia_id', { user_uuid: userId });
    if (error || !data) {
        throw new Error(error?.message || "Usuário não está associado a uma barbearia.");
    }
    return data;
}

// Função para buscar recompensas da barbearia
const fetchRecompensas = async (barbeariaId: string) => {
    const { data, error } = await supabase
        .from('recompensas')
        .select('*')
        .eq('barbearia_id', barbeariaId)
        .order('pontos_necessarios', { ascending: true });

    if (error) throw new Error(error.message);
    return data || [];
};

// Função para buscar configurações de fidelidade
const fetchConfiguracaoFidelidade = async (barbeariaId: string) => {
    // Buscar configurações da tabela fidelidade_configuracoes
    const { data: configData, error: configError } = await supabase
        .from('fidelidade_configuracoes')
        .select('*')
        .eq('barbearia_id', barbeariaId)
        .maybeSingle();

    if (configError) throw new Error(configError.message);

    // Buscar status ativo da tabela barbearias
    const { data: barbeariaData, error: barbeariaError } = await supabase
        .from('barbearias')
        .select('fidelidade_ativa')
        .eq('id', barbeariaId)
        .maybeSingle();

    if (barbeariaError) throw new Error(barbeariaError.message);

    return {
        ...configData,
        ativo: barbeariaData?.fidelidade_ativa ?? true
    };
};

export default function Fidelidade() {
    const { user } = useAuth();
    const { toast } = useToast();
    const queryClient = useQueryClient();

    // Estados da interface
    const [searchTerm, setSearchTerm] = useState("");
    const [activeTab, setActiveTab] = useState("clientes");

    // Estados para formulários
    const [isClientFormOpen, setIsClientFormOpen] = useState(false);
    const [isRewardFormOpen, setIsRewardFormOpen] = useState(false);
    const [selectedClient, setSelectedClient] = useState<FidelidadeClient | null>(null);
    const [editingReward, setEditingReward] = useState<Recompensa | null>(null);

    // Dados dos formulários
    const [clientFormData, setClientFormData] = useState({
        nome: "",
        pontos: ""
    });
    const [rewardFormData, setRewardFormData] = useState({
        nome: "",
        descricao: "",
        pontos_necessarios: ""
    });
    const [configFormData, setConfigFormData] = useState<ConfiguracaoFidelidade>({
        pontos_por_servico: 10,
        pontos_minimos_recompensa: 100,
        dias_expiracao: 365,
        ativo: true,
        barbearia_id: ""
    });

    const phoneMask = usePhoneMask();

    // Queries
    const { data: barbeariaId, isLoading: isLoadingBarbeariaId } = useQuery({
        queryKey: ['userBarbeariaId', user?.id],
        queryFn: () => fetchUserBarbeariaId(user!.id),
        enabled: !!user,
        staleTime: Infinity,
    });

    const { data: clientes = [], isLoading: isLoadingClientes } = useQuery({
        queryKey: ['fidelidadeClientes', barbeariaId],
        queryFn: () => fetchFidelidadeData(user!.id, barbeariaId!),
        enabled: !!user && !!barbeariaId,
    });

    const { data: recompensas = [], isLoading: isLoadingRecompensas } = useQuery({
        queryKey: ['recompensas', barbeariaId],
        queryFn: () => fetchRecompensas(barbeariaId!),
        enabled: !!barbeariaId,
    });

    const { data: configuracao, isLoading: isLoadingConfig } = useQuery({
        queryKey: ['configuracaoFidelidade', barbeariaId],
        queryFn: () => fetchConfiguracaoFidelidade(barbeariaId!),
        enabled: !!barbeariaId,
    });

    // Atualizar form data quando configuração carrega
    useEffect(() => {
        if (configuracao && barbeariaId) {
            setConfigFormData({
                ...configuracao,
                pontos_por_servico: configuracao.pontos_por_servico || 1,
                pontos_minimos_recompensa: configuracao.pontos_minimos_recompensa ?? undefined,
                dias_expiracao: configuracao.dias_expiracao ?? undefined,
                barbearia_id: barbeariaId
            });
        } else if (barbeariaId) {
            setConfigFormData(prev => ({
                ...prev,
                barbearia_id: barbeariaId
            }));
        }
    }, [configuracao, barbeariaId]);

    // Mutations
    const { mutate: pontuarCliente, isPending: isSubmittingClient } = useMutation({
        mutationFn: async ({ nome, pontos, telefone }: { nome?: string, pontos: string, telefone: string }) => {
            const cleanedPhone = (telefone || '').replace(/\D/g, '');
            if (cleanedPhone.length < 10) throw new Error("Telefone inválido.");
            if (!barbeariaId) throw new Error("ID da barbearia não encontrado.");

            const { data: existingClient } = await supabase
                .from('fidelidade')
                .select('*')
                .eq('cliente_telefone', cleanedPhone)
                .eq('barbearia_id', barbeariaId)
                .maybeSingle();

            if (existingClient) {
                const novosPontos = existingClient.pontos + parseInt(pontos, 10);
                const { error } = await supabase
                    .from('fidelidade')
                    .update({ pontos: novosPontos, updated_at: new Date().toISOString() })
                    .eq('id', existingClient.id);
                if (error) throw new Error(error.message);
                return { nome: (existingClient as any).profiles?.name || 'Cliente', acao: 'update' };
            } else {
                if (!nome) throw new Error("O nome é obrigatório para novos clientes.");
                const { error } = await supabase
                    .from('fidelidade')
                    .insert({
                        cliente_telefone: cleanedPhone,
                        pontos: parseInt(pontos, 10),
                        barbearia_id: barbeariaId,
                        user_id: user!.id
                    });
                if (error) throw new Error(error.message);
                return { nome, acao: 'create' };
            }
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['fidelidadeClientes'] });
            setIsClientFormOpen(false);
            phoneMask.setValue('');
            setClientFormData({ nome: "", pontos: "" });
            toast({
                title: "Sucesso!",
                description: data.acao === 'update'
                    ? `Pontos adicionados para ${data.nome}.`
                    : `Novo cliente ${data.nome} cadastrado.`
            });
        },
        onError: (error: Error) => {
            toast({ title: "Erro", description: error.message, variant: "destructive" });
        }
    });

    const { mutate: salvarRecompensa, isPending: isSavingReward } = useMutation({
        mutationFn: async (recompensaData: { nome: string, descricao: string, pontos_necessarios: number, id?: string }) => {
            if (!barbeariaId) throw new Error("ID da barbearia não encontrado.");

            if (recompensaData.id) {
                const { error } = await supabase
                    .from('recompensas')
                    .update({
                        nome: recompensaData.nome,
                        descricao: recompensaData.descricao,
                        pontos_necessarios: recompensaData.pontos_necessarios
                    })
                    .eq('id', recompensaData.id);
                if (error) throw new Error(error.message);
                return { acao: 'update' };
            } else {
                const { error } = await supabase
                    .from('recompensas')
                    .insert({
                        nome: recompensaData.nome,
                        descricao: recompensaData.descricao,
                        pontos_necessarios: recompensaData.pontos_necessarios,
                        barbearia_id: barbeariaId,
                        ativo: true
                    });
                if (error) throw new Error(error.message);
                return { acao: 'create' };
            }
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['recompensas'] });
            setIsRewardFormOpen(false);
            toast({
                title: "Sucesso!",
                description: data.acao === 'update' ? "Recompensa atualizada." : "Nova recompensa criada."
            });
        },
        onError: (error: Error) => {
            toast({ title: "Erro", description: error.message, variant: "destructive" });
        }
    });

    const { mutate: deletarRecompensa } = useMutation({
        mutationFn: async (recompensaId: string) => {
            const { error } = await supabase
                .from('recompensas')
                .delete()
                .eq('id', recompensaId);
            if (error) throw new Error(error.message);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['recompensas'] });
            toast({ title: "Sucesso!", description: "Recompensa removida." });
        },
        onError: (error: Error) => {
            toast({ title: "Erro", description: error.message, variant: "destructive" });
        }
    });

    const { mutate: toggleRecompensa } = useMutation({
        mutationFn: async ({ id, ativo }: { id: string, ativo: boolean }) => {
            const { error } = await supabase
                .from('recompensas')
                .update({ ativo })
                .eq('id', id);
            if (error) throw new Error(error.message);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['recompensas'] });
            toast({ title: "Sucesso!", description: "Status da recompensa atualizado." });
        },
        onError: (error: Error) => {
            toast({ title: "Erro", description: error.message, variant: "destructive" });
        }
    });

    const { mutate: resgatarRecompensa, isPending: isRedeeming } = useMutation({
        mutationFn: async ({ cliente, pontosCusto }: { cliente: FidelidadeClient, pontosCusto: number }) => {
            const novoPontos = cliente.pontos - pontosCusto;
            if (novoPontos < 0) throw new Error("Pontos insuficientes");

            const { error } = await supabase
                .from('fidelidade')
                .update({ pontos: novoPontos })
                .eq('id', cliente.id);
            if (error) throw new Error(error.message);
            return { clienteNome: cliente.profiles?.name || 'Cliente' };
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['fidelidadeClientes'] });
            setSelectedClient(null);
            toast({
                title: "Recompensa resgatada!",
                description: `Recompensa resgatada para ${data.clienteNome}.`
            });
        },
        onError: (error: Error) => {
            toast({ title: "Erro", description: error.message, variant: "destructive" });
        }
    });

    const { mutate: salvarConfiguracao, isPending: isSavingConfig } = useMutation({
        mutationFn: async (configData: ConfiguracaoFidelidade) => {
            if (!barbeariaId) throw new Error("ID da barbearia não encontrado.");

            // Salvar/atualizar configurações na tabela fidelidade_configuracoes
            const dataToSave = {
                pontos_por_servico: configData.pontos_por_servico,
                pontos_minimos_recompensa: configData.pontos_minimos_recompensa,
                dias_expiracao: configData.dias_expiracao,
                barbearia_id: barbeariaId
            };

            if (configuracao?.id) {
                const { error } = await supabase
                    .from('fidelidade_configuracoes')
                    .update(dataToSave)
                    .eq('id', configuracao.id);
                if (error) throw new Error(error.message);
            } else {
                const { error } = await supabase
                    .from('fidelidade_configuracoes')
                    .insert(dataToSave);
                if (error) throw new Error(error.message);
            }

            // Atualizar status ativo na tabela barbearias
            const { error: barbeariaError } = await supabase
                .from('barbearias')
                .update({ fidelidade_ativa: configData.ativo })
                .eq('id', barbeariaId);

            if (barbeariaError) throw new Error(barbeariaError.message);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['configuracaoFidelidade'] });
            toast({
                title: "Configurações salvas!",
                description: "As configurações do programa de fidelidade foram atualizadas."
            });
        },
        onError: (error: Error) => {
            toast({ title: "Erro", description: error.message, variant: "destructive" });
        }
    });

    // Estatísticas
    const [stats, setStats] = useState({
        totalClientes: 0,
        totalPontos: 0,
        clientesAtivos: 0,
        mediaPerClient: 0
    });

    useEffect(() => {
        if (clientes) {
            calculateStats(clientes);
        }
    }, [clientes]);

    const calculateStats = (clientesData: FidelidadeClient[]) => {
        const totalClientes = clientesData.length;
        const totalPontos = clientesData.reduce((acc, c) => acc + c.pontos, 0);
        const clientesAtivos = clientesData.filter(c => c.updated_at &&
            new Date(c.updated_at) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        ).length;
        const mediaPerClient = totalClientes > 0 ? totalPontos / totalClientes : 0;

        setStats({ totalClientes, totalPontos, clientesAtivos, mediaPerClient });
    };

    // Handlers
    const handleClientSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!phoneMask.value || !clientFormData.pontos) return;
        pontuarCliente({
            telefone: phoneMask.value,
            nome: clientFormData.nome,
            pontos: clientFormData.pontos,
        });
    };

    const handleRewardSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!rewardFormData.nome || !rewardFormData.descricao || !rewardFormData.pontos_necessarios) return;

        salvarRecompensa({
            nome: rewardFormData.nome,
            descricao: rewardFormData.descricao,
            pontos_necessarios: parseInt(rewardFormData.pontos_necessarios, 10),
            id: editingReward?.id
        });
    };

    const handleConfigSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        salvarConfiguracao(configFormData);
    };

    const handleEditReward = (recompensa: Recompensa) => {
        setEditingReward(recompensa);
        setRewardFormData({
            nome: recompensa.nome,
            descricao: recompensa.descricao || "",
            pontos_necessarios: recompensa.pontos_necessarios.toString()
        });
        setIsRewardFormOpen(true);
    };

    const handleDeleteReward = (recompensaId: string, nome: string) => {
        if (!confirm(`Tem certeza que deseja excluir a recompensa "${nome}"?`)) return;
        deletarRecompensa(recompensaId);
    };

    const resetRewardForm = () => {
        setEditingReward(null);
        setRewardFormData({ nome: "", descricao: "", pontos_necessarios: "" });
    };

    const handleRewardFormClose = (open: boolean) => {
        setIsRewardFormOpen(open);
        if (!open) {
            resetRewardForm();
        }
    };

    const handleRedeemReward = (cliente: FidelidadeClient, recompensa: Recompensa) => {
        if (!confirm(`Confirmar resgate de "${recompensa.nome}" por ${recompensa.pontos_necessarios} pontos para o cliente ${cliente.profiles?.name || 'Cliente'}?`)) {
            return;
        }
        resgatarRecompensa({ cliente, pontosCusto: recompensa.pontos_necessarios });
    };

    // Utility functions
    const formatPhone = (phone: string) => {
        if (!phone) return "";
        const cleaned = (phone || '').replace(/\D/g, '');
        if (cleaned.length === 11) {
            return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 3)} ${cleaned.slice(3, 7)}-${cleaned.slice(7)}`;
        }
        return phone;
    };


    const getLoyaltyLevel = (pontos: number) => {
        if (pontos >= 500) return { name: "VIP", color: "text-purple-500", icon: Crown };
        if (pontos >= 200) return { name: "Ouro", color: "text-yellow-500", icon: Award };
        if (pontos >= 100) return { name: "Prata", color: "text-gray-500", icon: Star };
        return { name: "Bronze", color: "text-orange-500", icon: Award };
    };

    const filteredClientes = clientes.filter(cliente => {
        const search = searchTerm.toLowerCase();
        const nome = (cliente.profiles?.name || 'Cliente').toLowerCase();
        const telefone = cliente.cliente_telefone || '';
        return nome.includes(search) || telefone.includes(search.replace(/\D/g, ''));
    });

    const isLoading = isLoadingBarbeariaId || isLoadingClientes || isLoadingRecompensas || isLoadingConfig;

    if (isLoading) {
        return (
            <DashboardLayout>
                <Helmet>
                    <title>Carregando Programa de Fidelidade | Agendem</title>
                    <meta name="description" content="Carregando dados do programa de fidelidade..." />
                </Helmet>
                <div className="flex flex-col items-center justify-center min-h-96 space-y-4">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="text-muted-foreground">Carregando...</p>
                </div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout>
            <Helmet>
                <title>Programa de Fidelidade | Agendem</title>
                <meta name="description" content="Gerencie o programa de fidelidade da sua barbearia." />
            </Helmet>

            <div className="container mx-auto p-6 space-y-8 max-w-7xl">
                {/* Header */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Programa de Fidelidade</h1>
                        <p className="text-muted-foreground mt-1">
                            Gerencie pontos, recompensas e fidelize seus clientes.
                        </p>
                    </div>
                    <div className="flex gap-2">
                        {configuracao?.ativo && (
                            <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">
                                <CheckCircle className="w-3 h-3 mr-1" />
                                Sistema Ativo
                            </Badge>
                        )}
                        <Dialog open={isClientFormOpen} onOpenChange={setIsClientFormOpen}>
                            <DialogTrigger asChild>
                                <Button>
                                    <Plus className="w-4 h-4 mr-2" />
                                    Pontuar Cliente
                                </Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>Pontuar Cliente</DialogTitle>
                                    <DialogDescription>
                                        Adicione pontos para um cliente existente ou cadastre um novo.
                                    </DialogDescription>
                                </DialogHeader>
                                <form onSubmit={handleClientSubmit} className="space-y-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="phone">Telefone do Cliente</Label>
                                        <Input
                                            id="phone"
                                            placeholder="(XX) XXXXX-XXXX"
                                            value={phoneMask.value}
                                            onChange={phoneMask.handleChange}
                                            onBlur={phoneMask.handleBlur}
                                            required
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="nome">Nome (apenas novos clientes)</Label>
                                        <Input
                                            id="nome"
                                            placeholder="Nome completo"
                                            value={clientFormData.nome}
                                            onChange={(e) => setClientFormData(prev => ({ ...prev, nome: e.target.value }))}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="pontos">Pontos</Label>
                                        <Input
                                            id="pontos"
                                            type="number"
                                            placeholder="Quantidade de pontos"
                                            value={clientFormData.pontos}
                                            onChange={(e) => setClientFormData(prev => ({ ...prev, pontos: e.target.value }))}
                                            required
                                            min="1"
                                        />
                                    </div>
                                    <Button type="submit" className="w-full" disabled={isSubmittingClient}>
                                        {isSubmittingClient ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirmar"}
                                    </Button>
                                </form>
                            </DialogContent>
                        </Dialog>
                    </div>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Total Clientes</CardTitle>
                            <Users className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{stats.totalClientes}</div>
                            <p className="text-xs text-muted-foreground">Cadastrados no programa</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Total Pontos</CardTitle>
                            <Award className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{stats.totalPontos.toLocaleString()}</div>
                            <p className="text-xs text-muted-foreground">Pontos distribuídos</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Clientes Ativos</CardTitle>
                            <TrendingUp className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{stats.clientesAtivos}</div>
                            <p className="text-xs text-muted-foreground">Nos últimos 30 dias</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Média por Cliente</CardTitle>
                            <Star className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{Math.round(stats.mediaPerClient)}</div>
                            <p className="text-xs text-muted-foreground">Pontos por cliente</p>
                        </CardContent>
                    </Card>
                </div>

                {/* Tabs */}
                <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
                    <TabsList>
                        <TabsTrigger value="clientes">Clientes</TabsTrigger>
                        <TabsTrigger value="recompensas">Recompensas</TabsTrigger>
                        <TabsTrigger value="configuracoes">Configurações</TabsTrigger>
                    </TabsList>

                    {/* Clientes Tab */}
                    <TabsContent value="clientes" className="space-y-4">
                        <div className="flex items-center gap-2">
                            <div className="relative flex-1 max-w-sm">
                                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Buscar por nome ou telefone..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="pl-8"
                                />
                            </div>
                        </div>

                        {filteredClientes.length === 0 ? (
                            <Card className="text-center py-12">
                                <CardContent>
                                    <Users className="mx-auto h-12 w-12 text-muted-foreground/50" />
                                    <h3 className="mt-4 text-lg font-semibold">Nenhum cliente encontrado</h3>
                                    <p className="text-muted-foreground">
                                        {searchTerm ? "Tente buscar por outro termo." : "Comece pontuando seu primeiro cliente."}
                                    </p>
                                </CardContent>
                            </Card>
                        ) : (
                            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                                {filteredClientes.map((cliente) => {
                                    const level = getLoyaltyLevel(cliente.pontos);
                                    const LevelIcon = level.icon;
                                    return (
                                        <Card key={cliente.id}>
                                            <CardHeader className="pb-2">
                                                <div className="flex justify-between items-start">
                                                    <div>
                                                        <CardTitle className="text-base">{cliente.profiles?.name || 'Cliente'}</CardTitle>
                                                        <CardDescription>{formatPhone(cliente.cliente_telefone || '')}</CardDescription>
                                                    </div>
                                                    <Badge variant="secondary" className={`${level.color} bg-opacity-10`}>
                                                        <LevelIcon className="w-3 h-3 mr-1" />
                                                        {level.name}
                                                    </Badge>
                                                </div>
                                            </CardHeader>
                                            <CardContent>
                                                <div className="flex justify-between items-end">
                                                    <div>
                                                        <div className="text-2xl font-bold">{cliente.pontos}</div>
                                                        <p className="text-xs text-muted-foreground">pontos acumulados</p>
                                                    </div>
                                                    <Dialog open={selectedClient?.id === cliente.id} onOpenChange={(isOpen) => !isOpen && setSelectedClient(null)}>
                                                        <DialogTrigger asChild>
                                                            <Button variant="outline" size="sm" onClick={() => setSelectedClient(cliente)}>
                                                                <Gift className="w-4 h-4 mr-2" />
                                                                Resgatar
                                                            </Button>
                                                        </DialogTrigger>
                                                        <DialogContent>
                                                            <DialogHeader>
                                                                <DialogTitle>Resgatar Recompensa</DialogTitle>
                                                                <DialogDescription>
                                                                    Escolha uma recompensa para {selectedClient?.profiles?.name}.
                                                                    Saldo atual: {selectedClient?.pontos} pontos.
                                                                </DialogDescription>
                                                            </DialogHeader>
                                                            <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                                                                {recompensas.filter(r => r.ativo).length === 0 ? (
                                                                    <p className="text-center text-muted-foreground py-4">Nenhuma recompensa ativa.</p>
                                                                ) : (
                                                                    recompensas.filter(r => r.ativo).map((recompensa) => (
                                                                        <div key={recompensa.id} className="flex items-center justify-between p-3 border rounded-lg">
                                                                            <div className="flex-1 mr-4">
                                                                                <p className="font-medium">{recompensa.nome}</p>
                                                                                <p className="text-sm text-muted-foreground">{recompensa.pontos_necessarios} pontos</p>
                                                                            </div>
                                                                            <Button
                                                                                size="sm"
                                                                                disabled={selectedClient!.pontos < recompensa.pontos_necessarios || isRedeeming}
                                                                                onClick={() => handleRedeemReward(selectedClient!, recompensa)}
                                                                            >
                                                                                Resgatar
                                                                            </Button>
                                                                        </div>
                                                                    ))
                                                                )}
                                                            </div>
                                                        </DialogContent>
                                                    </Dialog>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    );
                                })}
                            </div>
                        )}
                    </TabsContent>

                    {/* Recompensas Tab */}
                    <TabsContent value="recompensas" className="space-y-4">
                        <div className="flex justify-between items-center">
                            <div>
                                <h2 className="text-lg font-semibold">Recompensas Disponíveis</h2>
                                <p className="text-sm text-muted-foreground">Gerencie o catálogo de prêmios.</p>
                            </div>
                            <Dialog open={isRewardFormOpen} onOpenChange={handleRewardFormClose}>
                                <DialogTrigger asChild>
                                    <Button>
                                        <Plus className="w-4 h-4 mr-2" />
                                        Nova Recompensa
                                    </Button>
                                </DialogTrigger>
                                <DialogContent>
                                    <DialogHeader>
                                        <DialogTitle>{editingReward ? 'Editar Recompensa' : 'Nova Recompensa'}</DialogTitle>
                                        <DialogDescription>
                                            Configure os detalhes da recompensa.
                                        </DialogDescription>
                                    </DialogHeader>
                                    <form onSubmit={handleRewardSubmit} className="space-y-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="reward-name">Nome</Label>
                                            <Input
                                                id="reward-name"
                                                value={rewardFormData.nome}
                                                onChange={(e) => setRewardFormData(prev => ({ ...prev, nome: e.target.value }))}
                                                required
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="reward-desc">Descrição</Label>
                                            <Textarea
                                                id="reward-desc"
                                                value={rewardFormData.descricao}
                                                onChange={(e) => setRewardFormData(prev => ({ ...prev, descricao: e.target.value }))}
                                                required
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="reward-points">Pontos Necessários</Label>
                                            <Input
                                                id="reward-points"
                                                type="number"
                                                value={rewardFormData.pontos_necessarios}
                                                onChange={(e) => setRewardFormData(prev => ({ ...prev, pontos_necessarios: e.target.value }))}
                                                required
                                                min="1"
                                            />
                                        </div>
                                        <Button type="submit" className="w-full" disabled={isSavingReward}>
                                            {isSavingReward ? <Loader2 className="w-4 h-4 animate-spin" /> : "Salvar"}
                                        </Button>
                                    </form>
                                </DialogContent>
                            </Dialog>
                        </div>

                        {recompensas.length === 0 ? (
                            <Card className="text-center py-12">
                                <CardContent>
                                    <Gift className="mx-auto h-12 w-12 text-muted-foreground/50" />
                                    <h3 className="mt-4 text-lg font-semibold">Nenhuma recompensa cadastrada</h3>
                                    <p className="text-muted-foreground">Crie opções para seus clientes trocarem pontos.</p>
                                </CardContent>
                            </Card>
                        ) : (
                            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                                {recompensas.map((recompensa) => (
                                    <Card key={recompensa.id} className={!recompensa.ativo ? "opacity-60" : ""}>
                                        <CardHeader>
                                            <div className="flex justify-between items-start">
                                                <CardTitle className="text-base">{recompensa.nome}</CardTitle>
                                                <Badge variant={recompensa.ativo ? "default" : "secondary"}>
                                                    {recompensa.ativo ? "Ativa" : "Inativa"}
                                                </Badge>
                                            </div>
                                            <CardDescription>{recompensa.pontos_necessarios} pontos</CardDescription>
                                        </CardHeader>
                                        <CardContent className="space-y-4">
                                            <p className="text-sm text-muted-foreground">{recompensa.descricao}</p>
                                            <div className="flex gap-2">
                                                <Button variant="outline" size="sm" className="flex-1" onClick={() => handleEditReward(recompensa)}>
                                                    <Edit className="w-4 h-4 mr-2" />
                                                    Editar
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="text-destructive hover:text-destructive"
                                                    onClick={() => handleDeleteReward(recompensa.id, recompensa.nome)}
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </div>
                                            <Button
                                                variant="secondary"
                                                size="sm"
                                                className="w-full"
                                                onClick={() => toggleRecompensa({ id: recompensa.id, ativo: !recompensa.ativo })}
                                            >
                                                {recompensa.ativo ? "Desativar" : "Ativar"}
                                            </Button>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        )}
                    </TabsContent>

                    {/* Configurações Tab */}
                    <TabsContent value="configuracoes" className="space-y-4">
                        <Card>
                            <CardHeader>
                                <CardTitle>Configurações Gerais</CardTitle>
                                <CardDescription>Defina as regras do programa de fidelidade.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <form onSubmit={handleConfigSubmit} className="space-y-6">
                                    <div className="grid gap-4 md:grid-cols-2">
                                        <div className="space-y-2">
                                            <Label htmlFor="pontos-servico">Pontos por Serviço</Label>
                                            <Input
                                                id="pontos-servico"
                                                type="number"
                                                value={configFormData.pontos_por_servico}
                                                onChange={(e) => setConfigFormData(prev => ({ ...prev, pontos_por_servico: parseInt(e.target.value) || 0 }))}
                                                required={configFormData.ativo}
                                            />
                                            <p className="text-xs text-muted-foreground">Pontos ganhos a cada serviço.</p>
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="pontos-minimos">Pontos Mínimos para Resgate</Label>
                                            <Input
                                                id="pontos-minimos"
                                                type="number"
                                                value={configFormData.pontos_minimos_recompensa}
                                                onChange={(e) => setConfigFormData(prev => ({ ...prev, pontos_minimos_recompensa: parseInt(e.target.value) || 0 }))}
                                                required={configFormData.ativo}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="dias-expiracao">Expiração (dias)</Label>
                                            <Input
                                                id="dias-expiracao"
                                                type="number"
                                                value={configFormData.dias_expiracao}
                                                onChange={(e) => setConfigFormData(prev => ({ ...prev, dias_expiracao: parseInt(e.target.value) || 0 }))}
                                                required={configFormData.ativo}
                                            />
                                            <p className="text-xs text-muted-foreground">0 para nunca expirar.</p>
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Status do Sistema</Label>
                                            <div className="flex items-center space-x-2">
                                                <Switch
                                                    checked={configFormData.ativo}
                                                    onCheckedChange={(checked) => setConfigFormData(prev => ({ ...prev, ativo: checked }))}
                                                />
                                                <span className="text-sm text-muted-foreground">
                                                    {configFormData.ativo ? "Ativado" : "Desativado"}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <Button type="submit" disabled={isSavingConfig}>
                                        {isSavingConfig ? <Loader2 className="w-4 h-4 animate-spin" /> : "Salvar Configurações"}
                                    </Button>
                                </form>
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </div>
        </DashboardLayout>
    );
}
