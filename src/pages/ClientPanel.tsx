import { useEffect, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
	User,
	Calendar,
	Star,
	Clock,
	History,
	MapPin,
	Plus,
	RefreshCw,
	Scissors,
	type LucideIcon,
} from "lucide-react";
import { TourCliente } from "@/components/onboarding/TourCliente";
import { useAuth } from "@/contexts/AuthContext";
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
import { useRealtimeSubscription } from "@/hooks/useRealtimeSubscription";
import { AcoesAgendamento } from "@/components/AcoesAgendamento";
import { CartoesSelos } from "@/components/CartoesSelos";
import { ClientLayout } from "@/layouts/ClientLayout";

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

const ClientPanelSkeleton = () => (
	<div className="mx-auto max-w-5xl space-y-6 px-4 py-6 lg:px-8 lg:py-10" aria-busy="true">
		<div className="flex items-end justify-between gap-4">
			<div className="space-y-2">
				<Skeleton className="h-4 w-40" />
				<Skeleton className="h-8 w-56" />
			</div>
			<Skeleton className="h-10 w-44 rounded-full" />
		</div>
		<Skeleton className="h-36 w-full rounded-3xl" />
		<div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
			<Skeleton className="h-72 rounded-3xl" />
			<Skeleton className="h-40 rounded-3xl" />
		</div>
	</div>
);

const ClientPanel = () => {
	const { profile } = useAuth();
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const { toast } = useToast();
	const [selectedFeedback, setSelectedFeedback] = useState<PendingFeedback | null>(null);
	const [tourAberto, setTourAberto] = useState(false);

	// Usa o user_id do perfil como a chave para as queries.
	// O perfil é a nossa "fonte da verdade" para o ID que vincula os dados.
	const profileUserId = profile?.user_id;

	const appointmentsQueryKey = (type: 'upcoming' | 'past') => ['appointments', type, profileUserId];
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
		isErrorFeedbacks,
		isErrorUserFeedbacks,
		errorUpcoming,
		errorPast,
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
			void queryClient.invalidateQueries({ queryKey: ["cartoes-selos", profileUserId] });
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

	const loading = isLoadingUpcoming || isLoadingPast || isLoadingFeedbacks || isLoadingUserFeedbacks;

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
		return (
			<ClientLayout>
				<ClientPanelSkeleton />
			</ClientLayout>
		);
	}

	const proximos = upcomingAppointments ?? [];
	const historico = pastAppointments ?? [];
	const proximo = proximos[0];
	const outrosProximos = proximos.slice(1, 4);
	const ultimo = [...proximos, ...historico]
		.sort((a, b) => new Date(b.data_hora).getTime() - new Date(a.data_hora).getTime())[0];
	const primeiroNome = profile?.name?.split(" ")[0] || "Cliente";

	return (
		<ClientLayout onAjuda={() => setTourAberto(true)}>
			<div className="page-enter mx-auto max-w-5xl space-y-6 px-4 py-6 lg:px-8 lg:py-10">
				{/* Saudação */}
				<header className="flex flex-wrap items-end justify-between gap-4">
					<div>
						<p className="text-sm text-muted-foreground capitalize">
							{format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR })}
						</p>
						<h1 className="text-2xl font-bold sm:text-3xl">Olá, {primeiroNome}!</h1>
					</div>
					<Button onClick={() => navigate("/barbearias")} className="gap-2">
						<Plus className="h-4 w-4" aria-hidden="true" />
						Novo agendamento
					</Button>
				</header>

				{/* Destaque: próximo horário, ou atalho para agendar de novo */}
				{proximo ? (
					<section aria-labelledby="proximo-titulo" className="overflow-hidden rounded-3xl bg-primary text-primary-foreground shadow-brand-lg">
						<div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:p-6">
							<div className="flex h-20 w-20 shrink-0 flex-col items-center justify-center rounded-2xl bg-primary-foreground/10">
								<span className="text-xs font-medium uppercase opacity-80">
									{format(new Date(proximo.data_hora), "MMM", { locale: ptBR }).replace(".", "")}
								</span>
								<span className="font-display text-3xl font-bold leading-none">
									{format(new Date(proximo.data_hora), "dd")}
								</span>
							</div>
							<div className="min-w-0 flex-1 space-y-1">
								<p id="proximo-titulo" className="text-sm font-medium opacity-80">Seu próximo horário</p>
								<h2 className="truncate text-xl font-bold">{proximo.barbearias?.nome || "Barbearia"}</h2>
								<p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm opacity-90">
									<span className="flex items-center gap-1.5">
										<Clock className="h-4 w-4" aria-hidden="true" />
										{format(new Date(proximo.data_hora), "EEEE, HH:mm", { locale: ptBR })}
									</span>
									<span className="flex items-center gap-1.5">
										<Scissors className="h-4 w-4" aria-hidden="true" />
										{proximo.servicos?.nome || "Serviço"}
									</span>
									{proximo.funcionarios && (
										<span className="flex items-center gap-1.5">
											<User className="h-4 w-4" aria-hidden="true" />
											{proximo.funcionarios.nome}
										</span>
									)}
								</p>
							</div>
							<div className="shrink-0 self-start sm:self-center">{getStatusBadge(proximo.status)}</div>
						</div>
						<div className="border-t border-primary-foreground/15 bg-card px-5 py-3 text-foreground sm:px-6">
							<AcoesAgendamento agendamento={proximo} lado="cliente" />
						</div>
					</section>
				) : (
					<section className="flex flex-col gap-4 rounded-3xl border border-border/60 bg-card p-5 shadow-brand-md sm:flex-row sm:items-center sm:p-6">
						<div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10">
							<Calendar className="h-6 w-6 text-primary" aria-hidden="true" />
						</div>
						<div className="min-w-0 flex-1">
							<h2 className="text-lg font-bold">Nenhum horário marcado</h2>
							<p className="text-sm text-muted-foreground">
								{ultimo?.barbearias
									? <>Seu último corte foi na <strong className="text-foreground">{ultimo.barbearias.nome}</strong> em {format(new Date(ultimo.data_hora), "dd/MM/yyyy")}.</>
									: "Encontre uma barbearia e marque seu primeiro horário."}
							</p>
						</div>
						{ultimo?.barbearias?.slug ? (
							<Button onClick={() => navigate(`/barbearia/${ultimo.barbearias?.slug}`)} className="gap-2">
								<RefreshCw className="h-4 w-4" aria-hidden="true" />
								Agendar novamente
							</Button>
						) : (
							<Button onClick={() => navigate("/barbearias")} className="gap-2">
								<MapPin className="h-4 w-4" aria-hidden="true" />
								Encontrar barbearias
							</Button>
						)}
					</section>
				)}

				{/* Avaliações pendentes */}
				{pendingFeedbacks && pendingFeedbacks.length > 0 && (
					<section aria-labelledby="avaliar-titulo" className="rounded-3xl border border-amber-500/30 bg-amber-500/10 p-4 sm:p-5">
						<h2 id="avaliar-titulo" className="mb-3 flex items-center gap-2 font-semibold text-amber-800 dark:text-amber-300">
							<Star className="h-4 w-4" aria-hidden="true" />
							Como foi seu atendimento?
						</h2>
						<ul className="space-y-2">
							{pendingFeedbacks.map((feedback) => (
								<li key={feedback.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-background/70 p-3">
									<div className="min-w-0">
										<p className="truncate text-sm font-medium">{feedback.barbearias?.nome || "Barbearia"}</p>
										<p className="text-xs text-muted-foreground">
											Concluído em {format(new Date(feedback.created_at), "d 'de' MMMM", { locale: ptBR })}
										</p>
									</div>
									<Button size="sm" variant="outline" onClick={() => setSelectedFeedback(feedback)}>Avaliar</Button>
								</li>
							))}
						</ul>
					</section>
				)}

				<div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start">
					<div className="min-w-0 space-y-6">
						{/* Outros próximos horários */}
						{outrosProximos.length > 0 && (
							<Secao titulo="Também marcados" icone={Calendar}
								acao={proximos.length > 4 ? { label: "Ver todos", onClick: () => navigate("/meus-agendamentos") } : undefined}>
								<ul className="divide-y divide-border/60">
									{outrosProximos.map((ag) => (
										<li key={ag.id} className="space-y-2 py-3 first:pt-0 last:pb-0">
											<LinhaAgendamento
												data={ag.data_hora}
												titulo={ag.barbearias?.nome || "Barbearia"}
												subtitulo={[ag.servicos?.nome, ag.funcionarios?.nome].filter(Boolean).join(" · ")}
												badge={getStatusBadge(ag.status)}
												comHora
											/>
											<AcoesAgendamento agendamento={ag} lado="cliente" />
										</li>
									))}
								</ul>
							</Secao>
						)}

						{/* Histórico */}
						<Secao titulo="Histórico" icone={History}
							acao={historico.length > 0 ? { label: "Ver tudo", onClick: () => navigate("/meus-agendamentos") } : undefined}>
							{historico.length > 0 ? (
								<ul className="divide-y divide-border/60">
									{historico.slice(0, 5).map((ag) => (
										<li key={ag.id} className="py-3 first:pt-0 last:pb-0">
											<LinhaAgendamento
												data={ag.data_hora}
												titulo={ag.barbearias?.nome || "Barbearia"}
												subtitulo={ag.servicos?.nome || "Serviço"}
												badge={getStatusBadge(ag.status)}
											/>
											{ag.status === "cancelado" && (
												<div className="mt-2"><AcoesAgendamento agendamento={ag} lado="cliente" /></div>
											)}
										</li>
									))}
								</ul>
							) : (
								<p className="text-sm text-muted-foreground">Nenhum agendamento no seu histórico ainda.</p>
							)}
						</Secao>

						{/* Minhas avaliações */}
						{userFeedbacks && userFeedbacks.length > 0 && (
							<Secao titulo="Minhas avaliações" icone={Star}>
								<ul className="space-y-4">
									{userFeedbacks.slice(0, 3).map((feedback) => (
										<li key={feedback.id} className="space-y-1.5">
											<div className="flex flex-wrap items-center justify-between gap-2">
												<p className="text-sm font-medium">{feedback.barbearias?.nome || "Barbearia"}</p>
												<span className="text-xs text-muted-foreground">
													{format(new Date(feedback.created_at), "dd/MM/yyyy", { locale: ptBR })}
												</span>
											</div>
											<div className="flex" role="img" aria-label={`${feedback.rating || 0} de 5 estrelas`}>
												{[1, 2, 3, 4, 5].map((star) => (
													<Star key={star} aria-hidden="true"
														className={`h-3.5 w-3.5 ${(feedback.rating || 0) >= star ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/40"}`} />
												))}
											</div>
											{feedback.comment && <p className="text-sm text-muted-foreground">{feedback.comment}</p>}
											{feedback.response && (
												<div className="rounded-xl border-l-2 border-primary bg-primary/5 p-2.5 text-sm">
													<p className="font-medium text-primary">Resposta da barbearia</p>
													<p className="mt-0.5 text-muted-foreground">{feedback.response}</p>
												</div>
											)}
										</li>
									))}
								</ul>
							</Secao>
						)}
					</div>

					{/* Coluna lateral */}
					<div className="space-y-6">
						{profileUserId && <CartoesSelos userId={profileUserId} />}
						{proximo && ultimo?.barbearias?.slug && (
							<section className="rounded-3xl border border-border/60 bg-card p-5 shadow-brand-sm">
								<p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Agendar de novo</p>
								<p className="mt-1 font-semibold">{ultimo.barbearias.nome}</p>
								<Button variant="outline" size="sm" className="mt-3 w-full gap-2"
									onClick={() => navigate(`/barbearia/${ultimo.barbearias?.slug}`)}>
									<RefreshCw className="h-4 w-4" aria-hidden="true" />
									Ver horários
								</Button>
							</section>
						)}
					</div>
				</div>
			</div>

			<TourCliente aberto={tourAberto} onFechar={() => setTourAberto(false)} />
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
		</ClientLayout>
	);
};

/** Bloco com título usado nas seções do painel */
function Secao({ titulo, icone: Icone, acao, children }: {
	titulo: string;
	icone: LucideIcon;
	acao?: { label: string; onClick: () => void };
	children: ReactNode;
}) {
	return (
		<section className="rounded-3xl border border-border/60 bg-card p-5 shadow-brand-sm">
			<div className="mb-4 flex items-center justify-between gap-3">
				<h2 className="flex items-center gap-2 text-lg font-bold">
					<Icone className="h-4 w-4 text-primary" aria-hidden="true" />
					{titulo}
				</h2>
				{acao && (
					<Button variant="link" size="sm" className="h-auto p-0" onClick={acao.onClick}>{acao.label}</Button>
				)}
			</div>
			{children}
		</section>
	);
}

/** Linha compacta de agendamento: data em bloco, título, detalhes e status */
function LinhaAgendamento({ data, titulo, subtitulo, badge, comHora = false }: {
	data: string;
	titulo: string;
	subtitulo: string;
	badge: ReactNode;
	comHora?: boolean;
}) {
	const dia = new Date(data);
	return (
		<div className="flex items-center gap-3">
			<div className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl bg-muted text-center">
				<span className="text-[10px] font-medium uppercase leading-none text-muted-foreground">
					{format(dia, "MMM", { locale: ptBR }).replace(".", "")}
				</span>
				<span className="text-base font-bold leading-tight">{format(dia, "dd")}</span>
			</div>
			<div className="min-w-0 flex-1">
				<p className="truncate text-sm font-semibold">{titulo}</p>
				<p className="truncate text-xs text-muted-foreground">
					{comHora ? `${format(dia, "HH:mm")} · ${subtitulo}` : subtitulo}
				</p>
			</div>
			<div className="shrink-0">{badge}</div>
		</div>
	);
}

export default ClientPanel;
