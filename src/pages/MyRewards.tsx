import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
	Star,
	Trophy,
	Crown,
	ArrowLeft,
	CheckCircle,
	Clock,
	MapPin,
	Coins,
	Zap,
	Gift,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "@/hooks/use-toast";

interface FidelidadeData {
	id: string;
	pontos: number;
	nivel: "bronze" | "prata" | "ouro" | "diamante";
	barbearia_id: string;
	barbearia_nome: string;
	barbearia_endereco: string;
}

interface Recompensa {
	id: string;
	nome: string;
	descricao: string | null;
	pontos_necessarios: number;
	barbearia_id: string;
	barbearia_nome: string;
	ativo: boolean;
}

interface ResgateRecompensa {
	id: string;
	recompensa_nome: string;
	recompensa_descricao: string;
	pontos_utilizados: number;
	barbearia_nome: string;
	status: string;
	created_at: string;
}

const nivelIcons = {
	bronze: Trophy,
	prata: Star,
	ouro: Crown,
	diamante: Zap,
};

const nivelColors = {
	bronze: "text-amber-600",
	prata: "text-gray-500",
	ouro: "text-yellow-500",
	diamante: "text-blue-500",
};

const nivelLabels = {
	bronze: "Bronze",
	prata: "Prata",
	ouro: "Ouro",
	diamante: "Diamante",
};

const pontosParaProximoNivel = {
	bronze: 100,
	prata: 250,
	ouro: 500,
	diamante: 1000,
};

export default function MyRewards() {
	const { user } = useAuth();
	const navigate = useNavigate();
	const isMobile = useIsMobile();
	const queryClient = useQueryClient();

	// Buscar dados de fidelidade
	const { data: fidelidadeData = [], isLoading: loadingFidelidade } = useQuery({
		queryKey: ["fidelidade-data", user?.phone],
		queryFn: async () => {
			if (!user?.phone) return [];

			const { data, error } = await supabase
				.from("fidelidade")
				.select(`
					id,
					pontos,
					barbearia_id,
					barbearias!inner(
						nome,
						endereco
					)
				`)
				.eq("cliente_telefone", user.phone);

			if (error) {
				console.error("Erro ao buscar dados de fidelidade:", error);
				return [];
			}

			return data?.map(item => {
				// Calcular nível baseado nos pontos
				let nivel: "bronze" | "prata" | "ouro" | "diamante" = "bronze";
				if (item.pontos >= 1000) nivel = "diamante";
				else if (item.pontos >= 500) nivel = "ouro";
				else if (item.pontos >= 250) nivel = "prata";
				else nivel = "bronze";

				return {
					id: item.id,
					pontos: item.pontos,
					nivel,
					barbearia_id: item.barbearia_id,
					barbearia_nome: item.barbearias.nome,
					barbearia_endereco: item.barbearias.endereco,
				} as FidelidadeData;
			}) || [];
		},
		enabled: !!user?.phone,
		staleTime: 0, // Sempre buscar dados frescos
		refetchOnWindowFocus: true, // Atualizar quando a janela ganha foco
		refetchOnMount: true, // Sempre refetch ao montar o componente
	});

	// Buscar recompensas disponíveis
	const { data: recompensas = [], isLoading: loadingRecompensas } = useQuery({
		queryKey: ["recompensas-disponiveis"],
		queryFn: async () => {
			const { data, error } = await supabase
				.from("recompensas")
				.select(`
					id,
					nome,
					descricao,
					pontos_necessarios,
					barbearia_id,
					ativo,
					barbearias!inner(
						nome
					)
				`)
				.eq("ativo", true)
				.order("pontos_necessarios", { ascending: true });

			if (error) {
				console.error("Erro ao buscar recompensas:", error);
				return [];
			}

			return data?.map(item => ({
				id: item.id,
				nome: item.nome,
				descricao: item.descricao,
				pontos_necessarios: item.pontos_necessarios,
				barbearia_id: item.barbearia_id,
				barbearia_nome: item.barbearias.nome,
				ativo: item.ativo,
			})) || [];
		},
		staleTime: 0, // Sempre buscar dados frescos
		refetchOnWindowFocus: true, // Atualizar quando a janela ganha foco
		refetchOnMount: true, // Sempre refetch ao montar o componente
	});

	// Buscar histórico de resgates
	const { data: resgates = [], isLoading: loadingResgates } = useQuery({
		queryKey: ["resgates-historico", user?.phone],
		queryFn: async () => {
			if (!user?.phone) return [];

			const { data, error } = await supabase
				.from("resgates_recompensas")
				.select(`
					id,
					pontos_utilizados,
					status,
					data_resgate,
					recompensas!inner(
						nome,
						descricao
					),
					barbearias!inner(
						nome
					)
				`)
				.eq("cliente_telefone", user.phone)
				.order("data_resgate", { ascending: false });

			if (error) {
				console.error("Erro ao buscar resgates:", error);
				return [];
			}

			return data?.map(item => ({
				id: item.id,
				recompensa_nome: item.recompensas.nome,
				recompensa_descricao: item.recompensas.descricao,
				pontos_utilizados: item.pontos_utilizados,
				barbearia_nome: item.barbearias.nome,
				status: item.status,
				created_at: item.data_resgate,
			} as ResgateRecompensa)) || [];
		},
		enabled: !!user?.phone,
		staleTime: 0, // Sempre buscar dados frescos
		refetchOnWindowFocus: true, // Atualizar quando a janela ganha foco
		refetchOnMount: true, // Sempre refetch ao montar o componente
	});

	// Mutation para resgatar recompensa
	const resgateMutation = useMutation({
		mutationFn: async ({ recompensaId, barbeariaId }: { recompensaId: string; barbeariaId: string }) => {
			if (!user?.phone) throw new Error("Usuário não autenticado");

			const { data, error } = await supabase.rpc("resgatar_recompensa", {
				p_cliente_telefone: user.phone,
				p_recompensa_id: recompensaId,
				p_barbearia_id: barbeariaId,
			});

			if (error) throw error;
			return data;
		},
		onSuccess: () => {
			toast({
				title: "Recompensa resgatada!",
				description: "Sua recompensa foi resgatada com sucesso. Apresente este resgate na barbearia.",
			});
			// Invalidar todas as queries relacionadas para garantir atualização
			queryClient.invalidateQueries({ queryKey: ["fidelidade-data"] });
			queryClient.invalidateQueries({ queryKey: ["resgates-historico"] });
			queryClient.invalidateQueries({ queryKey: ["recompensas-disponiveis"] });
			// Forçar refetch imediato das queries principais
			queryClient.refetchQueries({ queryKey: ["fidelidade-data", user?.phone] });
			queryClient.refetchQueries({ queryKey: ["resgates-historico", user?.phone] });
		},
		onError: (error: unknown) => {
			const errorMessage = error instanceof Error ? error.message : "Ocorreu um erro inesperado. Tente novamente.";
			toast({
				title: "Erro ao resgatar recompensa",
				description: errorMessage,
				variant: "destructive",
			});
		},
	});

	const handleResgateRecompensa = (recompensa: Recompensa) => {
		// Verificar novamente se o cliente tem pontos suficientes antes de resgatar
		const fidelidadeBarbearia = fidelidadeData.find(f => f.barbearia_id === recompensa.barbearia_id);
		if (!fidelidadeBarbearia || fidelidadeBarbearia.pontos < recompensa.pontos_necessarios) {
			toast({
				title: "Pontos insuficientes",
				description: "Você não tem pontos suficientes para resgatar esta recompensa.",
				variant: "destructive",
			});
			return;
		}

		resgateMutation.mutate({
			recompensaId: recompensa.id,
			barbeariaId: recompensa.barbearia_id,
		});
	};

	const totalPontos = fidelidadeData.reduce((total, item) => total + item.pontos, 0);

	if (loadingFidelidade || loadingRecompensas || loadingResgates) {
		return (
			<div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 p-4">
				<div className="max-w-4xl mx-auto space-y-6">
					{/* Header */}
					<div className="flex items-center gap-4">
						<Button
							variant="ghost"
							size="sm"
							onClick={() => navigate(-1)}
							className="p-2"
						>
							<ArrowLeft className="w-4 h-4" />
						</Button>
						<h1 className="text-2xl font-bold">Minhas Recompensas</h1>
					</div>

					{/* Loading skeleton */}
					<div className="space-y-4">
						{[...Array(3)].map((_, i) => (
							<Card key={i} className="animate-pulse">
								<CardContent className="p-6">
									<div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
									<div className="h-3 bg-muted rounded w-1/2 mb-4"></div>
									<div className="h-3 bg-muted rounded w-1/4"></div>
								</CardContent>
							</Card>
						))}
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 p-4">
			<div className="max-w-4xl mx-auto space-y-6">
				{/* Header */}
				<div className="flex items-center gap-4">
					<Button
						variant="ghost"
						size="sm"
						onClick={() => navigate(-1)}
						className="p-2"
					>
						<ArrowLeft className="w-4 h-4" />
					</Button>
					<h1 className={`${isMobile ? 'text-xl' : 'text-2xl'} font-bold`}>
						Minhas Recompensas
					</h1>
				</div>

				{/* Summary Card */}
				<Card className="border-border/50 bg-gradient-to-r from-primary/10 via-primary/5 to-background backdrop-blur-sm">
					<CardContent className={`${isMobile ? 'p-4' : 'p-6'}`}>
						<div className={`flex ${isMobile ? 'flex-col space-y-4' : 'items-center justify-between'}`}>
							<div className="flex items-center gap-4">
								<div className="p-3 bg-primary/20 rounded-full">
									<Coins className="w-8 h-8 text-primary" />
								</div>
								<div>
									<h2 className="text-2xl font-bold">{totalPontos} pontos</h2>
									<p className="text-muted-foreground">Total acumulado</p>
								</div>
							</div>
							<div className="text-right">
								<p className="text-sm text-muted-foreground">
									{fidelidadeData.length} barbearia{fidelidadeData.length !== 1 ? 's' : ''} participante{fidelidadeData.length !== 1 ? 's' : ''}
								</p>
							</div>
						</div>
					</CardContent>
				</Card>

				{/* Tabs */}
				<Tabs defaultValue="fidelidade" className="w-full">
					<TabsList className="grid w-full grid-cols-3">
						<TabsTrigger value="fidelidade">Fidelidade</TabsTrigger>
						<TabsTrigger value="recompensas">Recompensas</TabsTrigger>
						<TabsTrigger value="historico">Histórico</TabsTrigger>
					</TabsList>

					{/* Fidelidade Tab */}
					<TabsContent value="fidelidade" className="space-y-4">
						{fidelidadeData.length === 0 ? (
							<Card className="border-border/50 bg-card/50 backdrop-blur-sm">
								<CardContent className="p-8 text-center">
									<Gift className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
									<h3 className="text-lg font-semibold mb-2">Nenhum programa de fidelidade</h3>
									<p className="text-muted-foreground mb-4">
										Você ainda não participa de nenhum programa de fidelidade.
									</p>
									<Button
										variant="premium"
										onClick={() => navigate("/barbearias")}
									>
										Encontrar Barbearias
									</Button>
								</CardContent>
							</Card>
						) : (
							fidelidadeData.map((fidelidade) => {
								const NivelIcon = nivelIcons[fidelidade.nivel as keyof typeof nivelIcons] || Trophy;
								const proximoNivel = pontosParaProximoNivel[fidelidade.nivel as keyof typeof pontosParaProximoNivel];
								const progresso = proximoNivel ? (fidelidade.pontos / proximoNivel) * 100 : 100;

								return (
									<Card key={fidelidade.id} className="border-border/50 bg-card/50 backdrop-blur-sm">
										<CardContent className={`${isMobile ? 'p-4' : 'p-6'}`}>
											<div className="space-y-4">
												{/* Header */}
												<div className="flex items-center justify-between">
													<div>
														<h3 className="font-semibold text-lg">{fidelidade.barbearia_nome}</h3>
														<div className="flex items-center text-sm text-muted-foreground">
															<MapPin className="w-4 h-4 mr-1" />
															{fidelidade.barbearia_endereco}
														</div>
													</div>
													<div className="text-right">
														<div className="flex items-center gap-2 justify-end">
															<NivelIcon className={`w-5 h-5 ${nivelColors[fidelidade.nivel as keyof typeof nivelColors]}`} />
															<Badge variant="secondary">
																{nivelLabels[fidelidade.nivel as keyof typeof nivelLabels]}
															</Badge>
														</div>
														<div className="text-2xl font-bold text-primary mt-1">
															{fidelidade.pontos} pontos
														</div>
													</div>
												</div>

												{/* Progress */}
												{proximoNivel && progresso < 100 && (
													<div className="space-y-2">
														<div className="flex justify-between text-sm">
															<span>Progresso para o próximo nível</span>
															<span>{proximoNivel - fidelidade.pontos} pontos restantes</span>
														</div>
														<Progress value={progresso} className="h-2" />
													</div>
												)}
											</div>
										</CardContent>
									</Card>
								);
							})
						)}
					</TabsContent>

					{/* Recompensas Tab */}
					<TabsContent value="recompensas" className="space-y-4">
						{recompensas.length === 0 ? (
							<Card className="border-border/50 bg-card/50 backdrop-blur-sm">
								<CardContent className="p-8 text-center">
									<Gift className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
									<h3 className="text-lg font-semibold mb-2">Nenhuma recompensa disponível</h3>
									<p className="text-muted-foreground">
										Não há recompensas disponíveis no momento.
									</p>
								</CardContent>
							</Card>
						) : (
							recompensas.map((recompensa) => {
								const fidelidadeBarbearia = fidelidadeData.find(f => f.barbearia_id === recompensa.barbearia_id);
								const podeResgatar = fidelidadeBarbearia && fidelidadeBarbearia.pontos >= recompensa.pontos_necessarios;

								return (
									<Card key={recompensa.id} className="border-border/50 bg-card/50 backdrop-blur-sm">
										<CardContent className={`${isMobile ? 'p-4' : 'p-6'}`}>
											<div className={`flex ${isMobile ? 'flex-col space-y-4' : 'items-center justify-between'}`}>
												<div className="flex-1">
													<div className="flex items-start gap-3">
														<div className="p-2 bg-primary/20 rounded-lg">
															<Gift className="w-6 h-6 text-primary" />
														</div>
														<div className="flex-1">
															<h3 className="font-semibold text-lg">{recompensa.nome}</h3>
															<p className="text-muted-foreground text-sm mb-2">{recompensa.descricao}</p>
															<div className="flex items-center gap-4 text-sm">
																<div className="flex items-center text-primary font-medium">
																	<Coins className="w-4 h-4 mr-1" />
																	{recompensa.pontos_necessarios} pontos
																</div>
																<div className="flex items-center text-muted-foreground">
																	<MapPin className="w-4 h-4 mr-1" />
																	{recompensa.barbearia_nome}
																</div>
															</div>
														</div>
													</div>
												</div>
												<div className={`${isMobile ? 'w-full' : 'ml-4'}`}>
													<Button
														variant={podeResgatar ? "premium" : "outline"}
														disabled={!podeResgatar || resgateMutation.isPending}
														onClick={() => handleResgateRecompensa(recompensa)}
														className={isMobile ? 'w-full' : ''}
													>
														{resgateMutation.isPending ? (
															<Clock className="w-4 h-4 mr-2 animate-spin" />
														) : (
															<Gift className="w-4 h-4 mr-2" />
														)}
														{podeResgatar ? "Resgatar" : "Pontos Insuficientes"}
													</Button>
													{fidelidadeBarbearia && (
														<p className="text-xs text-muted-foreground mt-1 text-center">
															Você tem {fidelidadeBarbearia.pontos} pontos
														</p>
													)}
												</div>
											</div>
										</CardContent>
									</Card>
								);
							})
						)}
					</TabsContent>

					{/* Histórico Tab */}
					<TabsContent value="historico" className="space-y-4">
						{resgates.length === 0 ? (
							<Card className="border-border/50 bg-card/50 backdrop-blur-sm">
								<CardContent className="p-8 text-center">
									<Clock className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
									<h3 className="text-lg font-semibold mb-2">Nenhum resgate realizado</h3>
									<p className="text-muted-foreground">
										Você ainda não resgatou nenhuma recompensa.
									</p>
								</CardContent>
							</Card>
						) : (
							resgates.map((resgate) => (
								<Card key={resgate.id} className="border-border/50 bg-card/50 backdrop-blur-sm">
									<CardContent className={`${isMobile ? 'p-4' : 'p-6'}`}>
										<div className={`flex ${isMobile ? 'flex-col space-y-3' : 'items-center justify-between'}`}>
											<div className="flex items-start gap-3">
												<div className="p-2 bg-green-100 rounded-lg">
													<CheckCircle className="w-6 h-6 text-green-600" />
												</div>
												<div className="flex-1">
													<h3 className="font-semibold text-lg">{resgate.recompensa_nome}</h3>
													<p className="text-muted-foreground text-sm mb-2">{resgate.recompensa_descricao}</p>
													<div className="flex items-center gap-4 text-sm">
														<div className="flex items-center text-muted-foreground">
															<MapPin className="w-4 h-4 mr-1" />
															{resgate.barbearia_nome}
														</div>
														<div className="flex items-center text-primary">
															<Coins className="w-4 h-4 mr-1" />
															{resgate.pontos_utilizados} pontos
														</div>
													</div>
												</div>
											</div>
											<div className={`${isMobile ? 'text-left' : 'text-right'}`}>
												<Badge variant={resgate.status === 'resgatado' ? 'default' : 'secondary'}>
													{resgate.status === 'resgatado' ? 'Resgatado' : 'Pendente'}
												</Badge>
												<p className="text-xs text-muted-foreground mt-1">
													{format(parseISO(resgate.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
												</p>
											</div>
										</div>
									</CardContent>
								</Card>
							))
						)}
					</TabsContent>
				</Tabs>
			</div>
		</div>
	);
}