import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
	User,
	Calendar,
	Star,
	Gift,
	Clock,
	History,
	LogOut,
	MapPin,
	Settings,
	RefreshCw,
	Scissors,
} from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
	getUpcomingAppointments,
	getPastAppointments,
	getPendingFeedbacks,
	getUserFeedbacks,
} from "@/integrations/supabase/api";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { FeedbackModal } from "@/components/FeedbackModal";
import { useResponsive } from "@/hooks/use-mobile";
import { useRealtimeSubscription } from "@/hooks/useRealtimeSubscription";

interface PendingFeedback {
	id: string;
	created_at: string;
	barbearias: {
		nome: string;
		logo_url: string | null;
	} | null;
	agendamento_id: string;
	barbearia_id: string;
	comment: string | null;
	rating: number | null;
	responded_by: string | null;
	response: string | null;
	response_created_at: string | null;
	status?: string;
	user_id: string;
}

const ClientPanelSkeleton = () => {
	const { isMobile } = useResponsive();
	return (
		<div className="min-h-screen bg-gradient-bg">
			{/* Header Skeleton */}
			<div className="border-b border-border/50 bg-card/30 backdrop-blur-sm">
				<div className={`max-w-5xl mx-auto ${isMobile ? 'px-3 py-4' : 'px-4 sm:px-6 lg:px-8 py-6'}`}>
					<div className={`flex items-center ${isMobile ? 'flex-col gap-3' : 'justify-between'}`}>
						<div className={`flex items-center ${isMobile ? 'gap-3' : 'gap-4'}`}>
							<Skeleton className={`${isMobile ? 'w-12 h-12' : 'w-16 h-16'} rounded-full`} />
							<div className="space-y-2">
								<Skeleton className={`${isMobile ? 'h-6 w-32' : 'h-8 w-48'}`} />
								<Skeleton className={`${isMobile ? 'h-4 w-40' : 'h-5 w-64'}`} />
							</div>
						</div>
						<div className={`flex items-center ${isMobile ? 'gap-1 w-full' : 'gap-2'}`}>
							<Skeleton className={`${isMobile ? 'h-8 flex-1' : 'h-9 w-36'}`} />
							<Skeleton className={`${isMobile ? 'h-8 w-16' : 'h-9 w-24'}`} />
						</div>
					</div>
				</div>
			</div>

			<div className={`max-w-5xl mx-auto ${isMobile ? 'px-3 py-4' : 'px-4 sm:px-6 lg:px-8 py-8'}`}>
				<div className={`grid ${isMobile ? 'grid-cols-1 gap-4' : 'lg:grid-cols-3 gap-8'}`}>
					<div className={`${isMobile ? '' : 'lg:col-span-2'} space-y-6`}>
						{/* Upcoming Appointments Skeleton */}
						<Card className="border-border/50 bg-card/50 backdrop-blur-sm">
							<CardHeader className={isMobile ? 'p-4' : ''}>
								<Skeleton className={`${isMobile ? 'h-5 w-1/2' : 'h-6 w-1/2'}`} />
							</CardHeader>
							<CardContent className={`${isMobile ? 'space-y-3 p-4' : 'space-y-4'}`}>
								<div className={`${isMobile ? 'p-3' : 'p-4'} border rounded-lg bg-background/50 space-y-3`}>
									<div className="flex justify-between items-start">
										<Skeleton className={`${isMobile ? 'h-4 w-3/4' : 'h-5 w-3/4'}`} />
										<Skeleton className={`${isMobile ? 'h-4 w-16' : 'h-5 w-20'}`} />
									</div>
									<div className={`flex items-center ${isMobile ? 'gap-2' : 'gap-4'}`}>
										<Skeleton className={`${isMobile ? 'h-3 w-1/3' : 'h-4 w-1/3'}`} />
										<Skeleton className={`${isMobile ? 'h-3 w-1/3' : 'h-4 w-1/3'}`} />
									</div>
								</div>
								<div className={`${isMobile ? 'p-3' : 'p-4'} border rounded-lg bg-background/50 space-y-3`}>
									<div className="flex justify-between items-start">
										<Skeleton className={`${isMobile ? 'h-4 w-3/4' : 'h-5 w-3/4'}`} />
										<Skeleton className={`${isMobile ? 'h-4 w-16' : 'h-5 w-20'}`} />
									</div>
									<div className={`flex items-center ${isMobile ? 'gap-2' : 'gap-4'}`}>
										<Skeleton className={`${isMobile ? 'h-3 w-1/3' : 'h-4 w-1/3'}`} />
										<Skeleton className={`${isMobile ? 'h-3 w-1/3' : 'h-4 w-1/3'}`} />
									</div>
								</div>
							</CardContent>
						</Card>
					</div>

					<div className={`${isMobile ? '' : 'space-y-6'}`}>
						<Card className="border-border/50 bg-card/50 backdrop-blur-sm">
							<CardHeader className={isMobile ? 'p-4' : ''}>
								<Skeleton className={`${isMobile ? 'h-5 w-3/4' : 'h-6 w-3/4'}`} />
							</CardHeader>
							<CardContent className={`${isMobile ? 'space-y-2 p-4' : 'space-y-3'}`}>
								<Skeleton className={`${isMobile ? 'h-8 w-full' : 'h-10 w-full'}`} />
								<Skeleton className={`${isMobile ? 'h-8 w-full' : 'h-10 w-full'}`} />
							</CardContent>
						</Card>
					</div>
				</div>
			</div>
		</div>
	);
};

const ClientPanel = () => {
	const { user, signOut, profile } = useAuth();
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const { toast } = useToast();
	const { isMobile } = useResponsive();
	const [selectedFeedback, setSelectedFeedback] = useState<PendingFeedback | null>(null);

	// Usa o user_id do perfil como a chave para as queries.
	// O perfil é a nossa "fonte da verdade" para o ID que vincula os dados.
	const profileUserId = profile?.user_id;

	const appointmentsQueryKey = (type: 'upcoming' | 'past') => ['appointments', type, profileUserId];
	const fidelidadeQueryKey = ['fidelidade', profileUserId];
	const pendingFeedbacksQueryKey = ['pendingFeedbacks', profileUserId];

	// Fetch de agendamentos futuros com React Query
	const {
		data: upcomingAppointments,
		isLoading: isLoadingUpcoming,
		isError: isErrorUpcoming,
		error: errorUpcoming,
	} = useQuery({
		queryKey: appointmentsQueryKey("upcoming"),
		queryFn: () => getUpcomingAppointments(profileUserId!),
		enabled: !!profileUserId,
		refetchOnWindowFocus: false,
	});

	// Fetch do histórico de agendamentos com React Query
	const {
		data: pastAppointments,
		isLoading: isLoadingPast,
		isError: isErrorPast,
		error: errorPast,
	} = useQuery({
		queryKey: appointmentsQueryKey("past"),
		queryFn: () => getPastAppointments(profileUserId!),
		enabled: !!profileUserId,
		refetchOnWindowFocus: false,
	});

	// Fetch de fidelidade com React Query
	const {
		data: fidelidade,
		isLoading: isLoadingFidelidade,
		isError: isErrorFidelidade,
		error: errorFidelidade,
	} = useQuery({
		queryKey: fidelidadeQueryKey,
		queryFn: async () => {
			if (!profile?.phone) return [];
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
				.eq("cliente_telefone", profile.phone);
			if (error) {
				console.error("Erro ao buscar dados de fidelidade:", error);
				return [];
			}
			return data || [];
		},
		enabled: !!profile?.phone,
		staleTime: 0, // Sempre buscar dados frescos
		refetchOnWindowFocus: true, // Atualizar quando a janela ganha foco
		refetchOnMount: true, // Sempre refetch ao montar o componente
	});

	// Fetch de feedbacks pendentes
	const {data: pendingFeedbacks, isLoading: isLoadingFeedbacks, isError: isErrorFeedbacks, error: errorFeedbacks} = useQuery({
		queryKey: pendingFeedbacksQueryKey,
		queryFn: () => getPendingFeedbacks(profileUserId!),
		enabled: !!profileUserId,
	});

	// Fetch de feedbacks do usuário (com respostas da barbearia)
	const userFeedbacksQueryKey = ['userFeedbacks', profileUserId];
	const {data: userFeedbacks, isLoading: isLoadingUserFeedbacks, isError: isErrorUserFeedbacks, error: errorUserFeedbacks} = useQuery({
		queryKey: userFeedbacksQueryKey,
		queryFn: () => getUserFeedbacks(profileUserId!),
		enabled: !!profileUserId,
	});

	// Efeito para tratar erros das queries
	useEffect(() => {
		if (isErrorUpcoming) {
			toast({
				title: "Erro ao buscar agendamentos",
				description:
					(errorUpcoming as Error)?.message ||
					"Não foi possível carregar seus próximos agendamentos.",
				variant: "destructive",
			});
		}
		if (isErrorPast) {
			toast({
				title: "Erro ao buscar histórico",
				description:
					(errorPast as Error)?.message ||
					"Não foi possível carregar seu histórico.",
				variant: "destructive",
			});
		}
		if (isErrorFidelidade) {
			toast({
				title: "Erro ao buscar fidelidade",
				description:
					(errorFidelidade as Error)?.message ||
					"Não foi possível carregar seus pontos.",
				variant: "destructive",
			});
		}
		if (isErrorFeedbacks) {
			toast({
				title: "Erro ao buscar avaliações",
				description:
					(errorFeedbacks as Error)?.message ||
					"Não foi possível carregar suas avaliações pendentes.",
				variant: "destructive",
			});
		}
		if (isErrorUserFeedbacks) {
			toast({
				title: "Erro ao buscar suas avaliações",
				description:
					(errorUserFeedbacks as Error)?.message ||
					"Não foi possível carregar suas avaliações.",
				variant: "destructive",
			});
		}
	}, [
		isErrorUpcoming,
		isErrorPast,
		isErrorFidelidade,
		isErrorFeedbacks,
		isErrorUserFeedbacks,
		errorUpcoming,
		errorPast,
		errorFidelidade,
		errorFeedbacks,
		errorUserFeedbacks,
		toast,
	]);

	// Realtime subscriptions usando hook personalizado
	useRealtimeSubscription({
		channelName: 'agendamentos-client-channel',
		table: 'agendamentos',
		filter: profileUserId ? `user_id=eq.${profileUserId}` : undefined,
		onUpdate: () => {
			queryClient.invalidateQueries({ queryKey: ['appointments', 'upcoming', profileUserId] });
			queryClient.invalidateQueries({ queryKey: ['appointments', 'past', profileUserId] });
			queryClient.invalidateQueries({ queryKey: ['fidelidade', profileUserId] });
		},
		enabled: !!profileUserId,
		delay: 1500
	});

	useRealtimeSubscription({
		channelName: 'feedbacks-client-channel',
		table: 'feedbacks',
		filter: profileUserId ? `user_id=eq.${profileUserId}` : undefined,
		onUpdate: () => {
			queryClient.invalidateQueries({ queryKey: pendingFeedbacksQueryKey });
		},
		enabled: !!profileUserId,
		delay: 2000
	});

	const loading = isLoadingUpcoming || isLoadingPast || isLoadingFidelidade || isLoadingFeedbacks || isLoadingUserFeedbacks;

	const handleLogout = async () => {
		await signOut();
		navigate("/");
	};

	// A lógica de filtro agora é feita na API, então podemos remover
	// const upcomingAppointments = agendamentos.filter(...)
	// const pastAppointments = agendamentos.filter(...)

	const getStatusBadge = (
		status: "pendente" | "confirmado" | "cancelado" | "finalizado"
	) => {
		switch (status) {
			case "finalizado":
				return (
					<Badge
						variant="outline"
						className="text-green-500 border-green-500/50 bg-green-500/10"
					>
						Concluído
					</Badge>
				);
			case "confirmado":
				return (
					<Badge
						variant="outline"
						className="text-blue-500 border-blue-500/50 bg-blue-500/10"
					>
						Confirmado
					</Badge>
				);
			case "cancelado":
				return (
					<Badge
						variant="outline"
						className="text-red-500 border-red-500/50 bg-red-500/10"
					>
						Cancelado
					</Badge>
				);
			case "pendente":
			default:
				return (
					<Badge
						variant="outline"
						className="text-yellow-500 border-yellow-500/50 bg-yellow-500/10"
					>
						Pendente
					</Badge>
				);
		}
	};

	if (loading) {
		return <ClientPanelSkeleton />;
	}

	return (
		<div className="min-h-screen bg-gradient-bg">
		{/* Header */}
			<div className="border-b border-border/50 bg-card/30 backdrop-blur-sm">
				<div className={`max-w-5xl mx-auto ${isMobile ? 'px-4 py-3' : 'px-4 sm:px-6 lg:px-8 py-6'}`}>
					{/* Mobile Layout */}
					{isMobile ? (
						<div className="space-y-3">
							{/* Top row: Avatar + Name + Theme Toggle */}
							<div className="flex items-center justify-between">
								<div className="flex items-center gap-3 flex-1 min-w-0">
									<Avatar className="w-10 h-10 shrink-0">
										<AvatarFallback className="bg-primary/10">
											<User className="w-5 h-5 text-primary" />
										</AvatarFallback>
									</Avatar>
									<div className="min-w-0 flex-1">
										<h1 className="text-base font-semibold truncate">
											Olá, {profile?.name?.split(' ')[0] || "Cliente"}!
										</h1>
										<p className="text-xs text-muted-foreground truncate">{user?.email}</p>
									</div>
								</div>
								<ThemeToggle />
							</div>
							{/* Bottom row: Action buttons */}
							<div className="flex items-center gap-2">
								<Button
									variant="outline"
									size="sm"
									className="flex-1 h-9"
									onClick={() => navigate("/client-settings")}
								>
									<Settings className="w-4 h-4 mr-1.5" />
									Configurações
								</Button>
								<Button 
									variant="ghost" 
									size="sm"
									className="h-9 px-3"
									onClick={handleLogout}
								>
									<LogOut className="w-4 h-4 mr-1.5" />
									Sair
								</Button>
							</div>
						</div>
					) : (
						/* Desktop Layout */
						<div className="flex items-center justify-between">
							<div className="flex items-center gap-4">
								<Avatar className="w-16 h-16">
									<AvatarFallback className="bg-primary/10">
										<User className="w-8 h-8 text-primary" />
									</AvatarFallback>
								</Avatar>
								<div>
									<h1 className="text-2xl font-bold">
										Olá, {profile?.name || "Cliente"}!
									</h1>
									<p className="text-muted-foreground">{user?.email}</p>
								</div>
							</div>
							<div className="flex items-center gap-2">
								<ThemeToggle />
								<Button
									variant="outline"
									size="sm"
									onClick={() => navigate("/client-settings")}
								>
									<Settings className="w-4 h-4 mr-2" />
									Configurações
								</Button>
								<Button 
									variant="ghost" 
									size="sm"
									onClick={handleLogout}
								>
									<LogOut className="w-4 h-4 mr-2" />
									Sair
								</Button>
							</div>
						</div>
					)}
				</div>
			</div>

			<div className={`max-w-5xl mx-auto ${isMobile ? 'px-3 py-4' : 'px-4 sm:px-6 lg:px-8 py-8'}`}>
				<div className={`grid ${isMobile ? 'grid-cols-1 gap-4' : 'lg:grid-cols-3 gap-8'}`}>
					{/* Main Content */}
					<div className={`${isMobile ? '' : 'lg:col-span-2'} ${isMobile ? 'space-y-4' : 'space-y-6'}`}>
						{/* Último Local Agendado */}
						{(() => {
							// Combina todos os agendamentos para encontrar o mais recente
							const allAppointments = [
								...(upcomingAppointments || []),
								...(pastAppointments || []),
							];
							
							// Ordena por data mais recente e pega o primeiro
							const lastAppointment = allAppointments.length > 0
								? allAppointments.sort((a, b) => 
									new Date(b.data_hora).getTime() - new Date(a.data_hora).getTime()
								)[0]
								: null;

							if (!lastAppointment?.barbearias) return null;

							return (
								<Card className="border-primary/30 bg-primary/5">
									<CardHeader className={isMobile ? 'p-4 pb-2' : 'pb-2'}>
										<CardTitle className={`flex items-center gap-2 ${isMobile ? 'text-base' : 'text-lg'}`}>
											<Scissors className={`${isMobile ? 'w-4 h-4' : 'w-5 h-5'} text-primary`} />
											Último Local Agendado
										</CardTitle>
									</CardHeader>
									<CardContent className={isMobile ? 'p-4 pt-2' : 'pt-2'}>
										<div className={`flex ${isMobile ? 'flex-col gap-3' : 'items-center justify-between'}`}>
											<div className="flex items-center gap-3">
												<div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
													<Scissors className="w-5 h-5 text-primary" />
												</div>
												<div>
													<h4 className={`font-semibold ${isMobile ? 'text-sm' : ''}`}>
														{lastAppointment.barbearias.nome}
													</h4>
													<p className={`text-muted-foreground ${isMobile ? 'text-xs' : 'text-sm'}`}>
														Último agendamento: {format(new Date(lastAppointment.data_hora), "dd/MM/yyyy", { locale: ptBR })}
													</p>
												</div>
											</div>
											<Button
												variant="default"
												size={isMobile ? 'sm' : 'default'}
												className={`${isMobile ? 'w-full' : ''} gap-2`}
												onClick={() => navigate(`/barbearia/${lastAppointment.barbearias?.slug}`)}
											>
												<RefreshCw className={`${isMobile ? 'w-3 h-3' : 'w-4 h-4'}`} />
												Agendar Novamente
											</Button>
										</div>
									</CardContent>
								</Card>
							);
						})()}

						{/* Avaliações Pendentes */}
						{pendingFeedbacks && pendingFeedbacks.length > 0 && (
							<Card className="border-yellow-500/50 bg-yellow-500/10">
								<CardHeader className={isMobile ? 'p-4' : ''}>
									<CardTitle className={`flex items-center gap-2 text-yellow-600 ${isMobile ? 'text-lg' : ''}`}>
										<Star className={`${isMobile ? 'w-4 h-4' : 'w-5 h-5'}`} />
										Avaliações Pendentes
									</CardTitle>
								</CardHeader>
								<CardContent className={isMobile ? 'p-4' : ''}>
									<div className={`${isMobile ? 'space-y-3' : 'space-y-4'}`}>
										{pendingFeedbacks.map((feedback) => (
											<div
												key={feedback.id}
												className={`${isMobile ? 'p-3' : 'p-4'} border border-yellow-500/20 rounded-lg bg-background/50 flex ${isMobile ? 'flex-col gap-3' : 'justify-between items-center'}`}
											>
												<div className={isMobile ? 'flex-1' : ''}>
													<h4 className={`font-medium ${isMobile ? 'text-sm' : ''}`}>
														{feedback.barbearias?.nome || "Barbearia"}
													</h4>
													<p className={`${isMobile ? 'text-xs' : 'text-sm'} text-muted-foreground`}>
														Serviço concluído em{" "}
														{format(new Date(feedback.created_at), isMobile ? "dd/MM/yyyy" : "PPP", {
															locale: ptBR,
														})}
													</p>
												</div>
												<Button
													variant="outline"
													size="sm"
													className={isMobile ? 'w-full text-xs' : ''}
													onClick={() => setSelectedFeedback(feedback)}
												>
													Avaliar Agora
												</Button>
											</div>
										))}
									</div>
								</CardContent>
							</Card>
						)}

						{/* Próximos Agendamentos */}
						<Card className="border-border/50 bg-card/50 backdrop-blur-sm">
							<CardHeader className={isMobile ? 'p-4' : ''}>
								<CardTitle className={`flex items-center gap-2 ${isMobile ? 'text-lg' : ''}`}>
									<Calendar className={`${isMobile ? 'w-4 h-4' : 'w-5 h-5'} text-primary`} />
									Próximos Agendamentos
								</CardTitle>
							</CardHeader>
							<CardContent className={isMobile ? 'p-4' : ''}>
								{(upcomingAppointments?.length ?? 0) > 0 ? (
								<div className={`${isMobile ? 'space-y-3' : 'space-y-4'}`}>
									{upcomingAppointments?.slice(0, 3).map((ag) => (
											<div
												key={ag.id}
												className={`${isMobile ? 'p-3' : 'p-4'} border rounded-lg bg-background/50`}
											>
												<div className={`flex ${isMobile ? 'flex-col gap-2' : 'justify-between items-start'} mb-2`}>
													<div className={isMobile ? 'flex-1' : ''}>
														<h4 className={`font-medium ${isMobile ? 'text-sm' : ''}`}>
															{ag.barbearias?.nome || "Barbearia"}
														</h4>
														<p className={`${isMobile ? 'text-xs' : 'text-sm'} text-muted-foreground`}>
															{ag.servicos?.nome || "Serviço"}
														</p>
													</div>
													{getStatusBadge(ag.status)}
												</div>
												<div className={`flex ${isMobile ? 'flex-col gap-2' : 'items-center gap-4'} ${isMobile ? 'text-xs' : 'text-sm'} text-muted-foreground`}>
													<div className="flex items-center gap-1">
														<Calendar className={`${isMobile ? 'w-3 h-3' : 'w-4 h-4'}`} />
														{format(new Date(ag.data_hora), "dd/MM/yyyy", {
															locale: ptBR,
														})}
													</div>
													<div className="flex items-center gap-1">
														<Clock className={`${isMobile ? 'w-3 h-3' : 'w-4 h-4'}`} />
														{format(new Date(ag.data_hora), "HH:mm", {
															locale: ptBR,
														})}
													</div>
													{ag.funcionarios && (
														<div className="flex items-center gap-1">
															<User className={`${isMobile ? 'w-3 h-3' : 'w-4 h-4'}`} />
															{ag.funcionarios.nome}
														</div>
													)}
												</div>
											</div>
										))}
										{(upcomingAppointments?.length ?? 0) > 3 && (
											<Button
												variant="link"
												className={`w-full text-primary ${isMobile ? 'text-xs' : ''}`}
												onClick={() => navigate("/meus-agendamentos")}
											>
												Ver todos os próximos agendamentos
											</Button>
										)}
									</div>
								) : (
									<p className={`text-muted-foreground ${isMobile ? 'text-sm' : ''}`}>
										Você não tem agendamentos futuros.
									</p>
								)}
							</CardContent>
						</Card>

						{/* Histórico */}
						<Card className="border-border/50 bg-card/50 backdrop-blur-sm">
							<CardHeader className={isMobile ? 'p-4' : ''}>
								<CardTitle className={`flex items-center gap-2 ${isMobile ? 'text-lg' : ''}`}>
									<History className={`${isMobile ? 'w-4 h-4' : 'w-5 h-5'}`} />
									Histórico de Agendamentos
								</CardTitle>
							</CardHeader>
							<CardContent className={isMobile ? 'p-4' : ''}>
								{(pastAppointments?.length ?? 0) > 0 ? (
								<div className={`${isMobile ? 'space-y-3' : 'space-y-4'}`}>
									{pastAppointments?.slice(0, 4).map((ag) => (
											<div
												key={ag.id}
												className={`${isMobile ? 'p-3' : 'p-4'} border rounded-lg bg-background/50`}
											>
												<div className={`flex ${isMobile ? 'flex-col gap-2' : 'justify-between items-start'}`}>
													<div className={isMobile ? 'flex-1' : ''}>
														<h4 className={`font-medium ${isMobile ? 'text-sm' : ''}`}>
															{ag.barbearias?.nome || "Barbearia"}
														</h4>
														<p className={`${isMobile ? 'text-xs' : 'text-sm'} text-muted-foreground`}>
															{ag.servicos?.nome || "Serviço"}
														</p>
													</div>
													<div className="flex items-center gap-2">
														{/* Star rating could be added here later */}
														{getStatusBadge(ag.status)}
													</div>
												</div>
											</div>
										))}
										{(pastAppointments?.length ?? 0) > 4 && (
											<Button
												variant="link"
												className={`w-full text-primary ${isMobile ? 'text-xs' : ''}`}
												onClick={() => navigate("/meus-agendamentos")}
											>
												Ver todo o histórico
											</Button>
										)}
									</div>
								) : (
									<p className={`text-muted-foreground ${isMobile ? 'text-sm' : ''}`}>
										Nenhum agendamento no seu histórico.
									</p>
								)}
							</CardContent>
						</Card>

						{/* Minhas Avaliações (com respostas da barbearia) */}
						{userFeedbacks && userFeedbacks.length > 0 && (
							<Card className="border-border/50 bg-card/50 backdrop-blur-sm">
								<CardHeader className={isMobile ? 'p-4' : ''}>
									<CardTitle className={`flex items-center gap-2 ${isMobile ? 'text-lg' : ''}`}>
										<Star className={`${isMobile ? 'w-4 h-4' : 'w-5 h-5'}`} />
										Minhas Avaliações
									</CardTitle>
								</CardHeader>
								<CardContent className={isMobile ? 'p-4' : ''}>
									<div className={`${isMobile ? 'space-y-3' : 'space-y-4'}`}>
										{userFeedbacks.slice(0, 3).map((feedback) => (
											<div
												key={feedback.id}
												className={`${isMobile ? 'p-3' : 'p-4'} border rounded-lg bg-background/50`}
											>
												<div className="mb-2">
													<h4 className={`font-medium ${isMobile ? 'text-sm' : ''}`}>
														{feedback.barbearias?.nome || "Barbearia"}
													</h4>
													<div className="flex items-center gap-1 mt-1">
														{[1, 2, 3, 4, 5].map((star) => (
															<Star
																key={star}
																className={`${isMobile ? 'w-3 h-3' : 'w-4 h-4'} ${
																	(feedback.rating || 0) >= star
																		? 'text-yellow-400 fill-yellow-400'
																		: 'text-gray-300'
																}`}
															/>
														))}
														<span className={`ml-2 ${isMobile ? 'text-xs' : 'text-sm'} text-muted-foreground`}>
															{format(new Date(feedback.created_at), "dd/MM/yyyy", { locale: ptBR })}
														</span>
													</div>
												</div>
												{feedback.comment && (
													<p className={`${isMobile ? 'text-xs' : 'text-sm'} text-muted-foreground mb-2`}>
														{feedback.comment}
													</p>
												)}
												{feedback.response && (
													<div className="mt-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded border-l-4 border-blue-500">
														<p className={`${isMobile ? 'text-xs' : 'text-sm'} font-medium text-blue-700 dark:text-blue-400`}>
															Resposta da barbearia:
														</p>
														<p className={`${isMobile ? 'text-xs' : 'text-sm'} text-blue-600 dark:text-blue-300 mt-1`}>
															{feedback.response}
														</p>
														{feedback.responded_by_profile?.name && (
															<p className={`${isMobile ? 'text-xs' : 'text-xs'} text-blue-500 dark:text-blue-400 mt-1`}>
																- {feedback.responded_by_profile.name}
															</p>
														)}
													</div>
												)}
											</div>
										))}
										{userFeedbacks.length > 3 && (
											<Button
												variant="link"
												className={`w-full text-primary ${isMobile ? 'text-xs' : ''}`}
												onClick={() => navigate("/minhas-avaliacoes")}
											>
												Ver todas as minhas avaliações
											</Button>
										)}
									</div>
								</CardContent>
							</Card>
						)}
					</div>

					{/* Sidebar */}
					<div className={`${isMobile ? 'space-y-4' : 'space-y-6'}`}>
						{/* Pontos de Fidelidade */}
						<Card className="border-border/50 bg-card/50 backdrop-blur-sm">
							<CardHeader className={isMobile ? 'p-4' : ''}>
								<CardTitle className={`flex items-center gap-2 ${isMobile ? 'text-lg' : ''}`}>
									<Gift className={`${isMobile ? 'w-4 h-4' : 'w-5 h-5'} text-primary`} />
									Meus Pontos de Fidelidade
								</CardTitle>
							</CardHeader>
							<CardContent className={isMobile ? 'p-4' : ''}>
								{(fidelidade || []).length > 0 ? (
									<div className={`${isMobile ? 'space-y-2' : 'space-y-3'}`}>
										{(fidelidade || []).map((f, index) => (
											<div key={index}>
												<p className={`font-medium ${isMobile ? 'text-sm' : ''}`}>
													{f.barbearias?.nome || "Barbearia"}
												</p>
												<div className="flex items-center gap-2">
													<Star className={`${isMobile ? 'w-3 h-3' : 'w-4 h-4'} text-yellow-400 fill-yellow-400`} />
													<span className={`${isMobile ? 'text-base' : 'text-lg'} font-bold`}>{f.pontos}</span>
													<span className={`${isMobile ? 'text-xs' : 'text-sm'} text-muted-foreground`}>
														pontos
													</span>
												</div>
											</div>
										))}
									</div>
								) : (
									<p className={`text-muted-foreground ${isMobile ? 'text-sm' : ''}`}>
										Você ainda não acumulou pontos de fidelidade.
									</p>
								)}
							</CardContent>
						</Card>

						{/* Quick Actions */}
						<Card className="border-border/50 bg-card/50 backdrop-blur-sm">
							<CardHeader className={isMobile ? 'p-4' : ''}>
								<CardTitle className={isMobile ? 'text-lg' : ''}>Ações Rápidas</CardTitle>
							</CardHeader>
							<CardContent className={`${isMobile ? 'space-y-2 p-4' : 'space-y-3'}`}>
								<Button
									variant="premium"
									className={`w-full ${isMobile ? 'text-sm py-2' : ''}`}
									onClick={() => navigate("/barbearias")}
								>
									<Calendar className={`${isMobile ? 'w-3 h-3 mr-2' : 'w-4 h-4 mr-2'}`} />
									Novo Agendamento
								</Button>
								<Button
									variant="outline"
									className={`w-full ${isMobile ? 'text-sm py-2' : ''}`}
									onClick={() => navigate("/meus-agendamentos")}
								>
									<History className={`${isMobile ? 'w-3 h-3 mr-2' : 'w-4 h-4 mr-2'}`} />
									Histórico Completo
								</Button>
								<Button
									variant="outline"
									className={`w-full ${isMobile ? 'text-sm py-2' : ''}`}
									onClick={() => navigate("/minhas-recompensas")}
								>
									<Gift className={`${isMobile ? 'w-3 h-3 mr-2' : 'w-4 h-4 mr-2'}`} />
									Minhas Recompensas
								</Button>
								<Button
									variant="outline"
									className={`w-full ${isMobile ? 'text-sm py-2' : ''}`}
									onClick={() => navigate("/barbearias")}
								>
									<MapPin className={`${isMobile ? 'w-3 h-3 mr-2' : 'w-4 h-4 mr-2'}`} />
									Encontrar Barbearias
								</Button>
							</CardContent>
						</Card>
					</div>
				</div>
			</div>
			{selectedFeedback && (
				<FeedbackModal
					isOpen={!!selectedFeedback}
					onOpenChange={(isOpen) => !isOpen && setSelectedFeedback(null)}
					feedbackId={selectedFeedback.id}
					barbeariaNome={selectedFeedback.barbearias?.nome || "a barbearia"}
					onFeedbackSubmitted={() => {
						queryClient.invalidateQueries({ queryKey: pendingFeedbacksQueryKey });
					}}
				/>
			)}
		</div>
	);
};

export default ClientPanel;