import { useState, useEffect, useRef, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AcoesAgendamento } from "@/components/AcoesAgendamento";
import { LinkClienteAgendamento } from "@/components/LinkClienteAgendamento";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
	Calendar as CalendarIcon,
	Filter,
	User,
	Phone,
	Mail,
	CheckCircle,
	Loader2,
} from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { DashboardLayout } from "@/layouts/DashboardLayout";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useSearchParams } from "react-router-dom";
import { gerenciarAgendamento, type AcompanhamentoAgendamento } from "@/integrations/supabase/api";
import { useRealtimeSubscription } from "@/hooks/useRealtimeSubscription";
import { useIsMobile } from "@/hooks/use-mobile";
import { whatsAppUrl } from "@/lib/utils";
import { telefoneLocal } from "@/lib/agendamento-assistido";

interface Appointment extends AcompanhamentoAgendamento {
	cliente_nome: string;
	cliente_telefone: string;
	cliente_email: string | null;
	user_id?: string | null;
	servicos: {
		nome: string;
		valor: number;
		duracao_minutos: number;
	};
	funcionarios: {
		nome: string;
	} | null;
}

// --- Função de API ---
const fetchAppointments = async (barbeariaId: string, dateRange: { from: Date; to?: Date }, statusFilter: string, funcionarioId?: string): Promise<Appointment[]> => {
	let query = supabase
		.from("agendamentos")
		.select(`
			id,
			cliente_nome,
			cliente_telefone,
			cliente_email,
			data_hora,
			status,
			cliente_confirmou_em,
			equipe_confirmou_em,
			cancelamento_solicitado_por,
			cancelamento_confirmado_em,
			user_id,
			funcionario_id,
			servicos!inner(nome, valor, duracao_minutos),
			funcionarios(id, nome)
		`).eq("barbearia_id", barbeariaId);

	if (statusFilter === 'pendente') {
		query = query.eq('status', 'pendente');
	} else if (statusFilter === "pedido_cancelamento") {
		query = query.in("status", ["pendente", "confirmado"]).not("cancelamento_solicitado_por", "is", null);
	} else {
		// Para outros filtros, usar o range de datas
		const startDate = new Date(dateRange.from);
		startDate.setHours(0, 0, 0, 0);

		const endDate = new Date(dateRange.to || dateRange.from);
		endDate.setHours(23, 59, 59, 999);

		query = query
			.gte("data_hora", startDate.toISOString())
			.lte("data_hora", endDate.toISOString());
	}

	if (funcionarioId) query = query.or(`funcionario_id.is.null,funcionario_id.eq.${funcionarioId}`);
	const { data, error } = await query.order("data_hora");

	if (error) throw error;

	return data || [];
};

export default function Appointments() {
	const isMobile = useIsMobile();
	const { user, role, barbeariaId } = useAuth();
	const { toast } = useToast();
	const queryClient = useQueryClient();
	const [searchParams] = useSearchParams();
	const [funcionarioId, setFuncionarioId] = useState<string | null>(null);

	// Buscar ID do funcionário se for role funcionario
	useEffect(() => {
		if (role === 'funcionario' && user?.id) {
			supabase
				.from('funcionarios')
				.select('id')
				.eq('user_id', user.id)
				.single()
				.then(({ data, error }) => {
					if (data && !error) {
						setFuncionarioId(data.id);
					}
				});
		}
	}, [role, user?.id]);

	const highlightedAppointmentId = searchParams.get("highlight");
	const appointmentDateStr = searchParams.get("date");
	const statusParam = searchParams.get("status");

	const [statusFilter, setStatusFilter] = useState<string>(statusParam || "all");
	useEffect(() => { setStatusFilter(statusParam || "all"); }, [statusParam]);
	// Estado inicial pode ser undefined para não ter seleção prévia
	const [dateRange, setDateRange] = useState<{ from: Date | undefined; to?: Date } | undefined>(() => {
		if (appointmentDateStr) {
			const parsedDate = new Date(appointmentDateStr);
			if (!isNaN(parsedDate.getTime())) {
				return {
					from: parsedDate,
					to: parsedDate,
				};
			}
		}
		// Retorna undefined por padrão para o calendário iniciar "limpo"
		return undefined;
	});

	const highlightedAppointmentRef = useRef<HTMLDivElement>(null);
	const [isHighlighting, setIsHighlighting] = useState(false);

	// --- Query e Mutações ---
	const { data: appointments = [], isLoading, error } = useQuery<Appointment[]>({
		queryKey: ['appointments', user?.id, barbeariaId, dateRange, statusFilter, role, funcionarioId],
		queryFn: () => {
			// Se não houver range selecionado ou não tiver data de início, usa HOJE como padrão
			const effectiveRange = (dateRange && dateRange.from) ? dateRange : { from: new Date(), to: new Date() };

			return fetchAppointments(
				barbeariaId!,
				effectiveRange as { from: Date; to?: Date },
				statusFilter,
				funcionarioId || undefined
			);
		},
		enabled: !!barbeariaId && (role === "admin" || (role === "funcionario" && !!funcionarioId)),
	});

	useRealtimeSubscription({
		channelName: "rotina-agendamentos-equipe",
		table: "agendamentos",
		filter: `barbearia_id=eq.${barbeariaId}`,
		enabled: !!barbeariaId,
		onUpdate: () => { void queryClient.invalidateQueries({ queryKey: ["appointments"] }); },
	});

	const updateStatusMutation = useMutation({
		mutationFn: (id: string) => gerenciarAgendamento(id, "finalizar"),
		onSuccess: (status) => {
			queryClient.invalidateQueries({ queryKey: ['appointments'] }); // Invalida todas as queries de appointments
			void queryClient.invalidateQueries({ queryKey: ["inicio"] });
			void queryClient.invalidateQueries({ queryKey: ["agendamentos-agenda"] });
			toast({ title: "Sucesso", description: `Agendamento ${status} com sucesso` });
		},
		onError: (error: Error) => {
			toast({ title: "Erro", description: error.message || "Erro ao atualizar status", variant: "destructive" });
		}
	});

	useEffect(() => {
		if (highlightedAppointmentId && highlightedAppointmentRef.current && appointments.length > 0) {
			setTimeout(() => {
				highlightedAppointmentRef.current?.scrollIntoView({
					behavior: "smooth",
					block: "center",
				});
				setIsHighlighting(true);

				// Remove a classe de destaque após a animação
				setTimeout(() => {
					setIsHighlighting(false);
				}, 2000); // Duração da animação
			}, 100); // Pequeno atraso para garantir que a renderização esteja concluída
		}
	}, [highlightedAppointmentId, appointments]);

	// --- Lógica de Agrupamento e Filtragem ---
	const groupedAppointments = useMemo(() => {
		const statusOrder: { [key: string]: number } = {
			pendente: 1,
			confirmado: 2,
			finalizado: 3,
			cancelado: 4,
		};

		const filtered = appointments
			.filter(appointment => statusFilter === "all" || statusFilter === "pedido_cancelamento" || appointment.status === statusFilter)
			.sort((a, b) => {
				const dateA = new Date(a.data_hora);
				const dateB = new Date(b.data_hora);
				if (dateA.toDateString() !== dateB.toDateString()) {
					return dateA.getTime() - dateB.getTime();
				}
				const orderA = statusOrder[a.status] || 99;
				const orderB = statusOrder[b.status] || 99;
				if (orderA !== orderB) {
					return orderA - orderB;
				}
				return dateA.getTime() - dateB.getTime();
			});

		return filtered.reduce((acc, appointment) => {
			const date = format(new Date(appointment.data_hora), "PPP", { locale: ptBR });
			if (!acc[date]) {
				acc[date] = [];
			}
			acc[date].push(appointment);
			return acc;
		}, {} as Record<string, Appointment[]>);

	}, [appointments, statusFilter]);


	const getStatusColor = (status: string) => {
		switch (status) {
			case "confirmado":
				return "text-green-600 border-green-500/50 bg-green-500/10";
			case "pendente":
				return "text-yellow-600 border-yellow-500/50 bg-yellow-500/10";
			case "cancelado":
				return "text-red-600 border-red-500/50 bg-red-500/10";
			case "finalizado":
				return "text-blue-600 border-blue-500/50 bg-blue-500/10";
			default:
				return "text-gray-600 border-gray-500/50 bg-gray-500/10";
		}
	};

	const getStatusLabel = (status: string) => {
		switch (status) {
			case "confirmado":
				return "Confirmado";
			case "pendente":
				return "Pendente";
			case "cancelado":
				return "Cancelado";
			case "finalizado":
				return "Finalizado";
			default:
				return status;
		}
	};

	const formatTime = (dateString: string) => {
		return new Date(dateString).toLocaleTimeString("pt-BR", {
			hour: "2-digit",
			minute: "2-digit",
		});
	};

	if (isLoading) {
		return (
			<DashboardLayout>
				<div className="flex items-center justify-center min-h-96">
					<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
				</div>
			</DashboardLayout>
		);
	}

	if (error) {
		return (
			<DashboardLayout>
				<div className="p-6 text-center text-red-500">
					Erro ao carregar agendamentos: {error.message}
				</div>
			</DashboardLayout>
		);
	}

	return (
		<DashboardLayout>
			<div className="p-3 sm:p-6 space-y-4 sm:space-y-6">
				<div className="flex flex-col items-start justify-between gap-4 xl:flex-row xl:items-center">
					<div>
						<h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
							<CalendarIcon className="w-6 h-6 sm:w-8 sm:h-8 text-primary" />
							Agendamentos
						</h1>
						<p className="text-sm sm:text-base text-muted-foreground">
							Visualize e gerencie os agendamentos da sua barbearia.
						</p>
					</div>

					<div className="flex w-full flex-wrap gap-3 sm:gap-4 xl:w-auto">
						<Select value={statusFilter} onValueChange={setStatusFilter}>
							<SelectTrigger aria-label="Filtrar por status" className="h-10 w-full sm:w-48">
								<Filter className="w-4 h-4 mr-2" />
								<SelectValue placeholder="Filtrar por status" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">Todos</SelectItem>
								<SelectItem value="pendente">Pendente</SelectItem>
								<SelectItem value="confirmado">Confirmado</SelectItem>
								<SelectItem value="finalizado">Finalizado</SelectItem>
								<SelectItem value="cancelado">Cancelado</SelectItem>
								<SelectItem value="pedido_cancelamento">Pedidos de cancelamento</SelectItem>
							</SelectContent>
						</Select>
						<Popover>
							<PopoverTrigger asChild>
								<Button
									variant={"outline"}
									className="h-10 w-full justify-start text-left text-sm font-normal sm:w-64 sm:text-base"
								>
									<CalendarIcon className="mr-2 h-4 w-4" />
									{dateRange?.from ? (
										dateRange.to ? (
											<>
												{format(dateRange.from, "dd/MM/yyyy", { locale: ptBR })} -{" "}
												{format(dateRange.to, "dd/MM/yyyy", { locale: ptBR })}
											</>
										) : (
											format(dateRange.from, "dd/MM/yyyy", { locale: ptBR })
										)
									) : (
										<span>Selecionar período</span>
									)}
								</Button>
							</PopoverTrigger>
							<PopoverContent className="max-h-[var(--radix-popover-content-available-height)] w-auto overflow-y-auto p-0" align="end">
								<Calendar
									mode="range"
									selected={dateRange}
									onSelect={setDateRange}
									locale={ptBR}
									numberOfMonths={isMobile ? 1 : 2}
								/>
							</PopoverContent>
						</Popover>
					</div>
				</div>

				<div className="space-y-6">
					{Object.keys(groupedAppointments).length === 0 ? (
						<Card className="border-border/50 bg-card/50 backdrop-blur-sm">
							<CardContent className="text-center py-8 sm:py-12 px-4">
								<CalendarIcon className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-4 text-muted-foreground/50" />
								<h3 className="text-base sm:text-lg font-medium mb-2">
									Nenhum agendamento encontrado
								</h3>
								<p className="text-sm sm:text-base text-muted-foreground">
									Tente alterar o período ou o filtro de status.
								</p>
							</CardContent>
						</Card>
					) : (
						Object.entries(groupedAppointments).map(
							([date, appointmentsOnDate]) => (
								<div key={date}>
									<h2 className="text-lg sm:text-xl font-semibold mb-3">{date}</h2>
									<div className="grid grid-cols-1 gap-3 sm:gap-4">
										{appointmentsOnDate.map((appointment) => (
											<Card
												key={appointment.id}
												ref={
													appointment.id === highlightedAppointmentId
														? highlightedAppointmentRef
														: null
												}
												className={`border-border/50 bg-card/50 backdrop-blur-sm hover:shadow-brand-md transition-all duration-300 ${isHighlighting &&
													appointment.id === highlightedAppointmentId
													? "animate-pulse-bg"
													: ""
													}`}
											>
												<CardContent className="p-4 sm:p-6">
													<div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-center">
														<div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-4">
															<div className="text-center flex-shrink-0">
																<div className="text-lg sm:text-2xl font-bold text-primary">
																	{formatTime(appointment.data_hora)}
																</div>
																<div className="text-xs text-muted-foreground">
																	{appointment.servicos.duracao_minutos}min
																</div>
															</div>
															<div className="min-w-0 flex-1">
																<div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-1">
																			<h3 className="text-base font-semibold [overflow-wrap:anywhere] sm:text-lg">
																		{appointment.cliente_nome}
																	</h3>
																	<Badge
																		variant="outline"
																		className={`${getStatusColor(appointment.status)} shrink-0 self-start text-xs sm:self-auto`}
																	>
																		{getStatusLabel(appointment.status)}
																	</Badge>
																</div>
																<div className="text-xs sm:text-sm text-muted-foreground space-y-1">
																	<div className="flex items-center gap-2">
																		<User className="w-3 h-3 flex-shrink-0" />
																		<span className="min-w-0 [overflow-wrap:anywhere]">{appointment.servicos.nome}</span>
																		<span>•</span>
																		<span className="flex-shrink-0">
																			R${" "}
																			{appointment.servicos.valor.toFixed(2)}
																		</span>
																	</div>
																	<div className="flex items-center gap-2">
																		<Phone className="w-3 h-3 flex-shrink-0" />
																		<span className="shrink-0">{appointment.cliente_telefone}</span>
																		{appointment.funcionarios && (
																			<>
																				<span>•</span>
																				<span className="truncate">
																					{appointment.funcionarios.nome}
																				</span>
																			</>
																		)}
																	</div>
																	{appointment.cliente_email && (
																		<div className="flex items-center gap-2">
																			<Mail className="w-3 h-3 flex-shrink-0" />
																			<span className="min-w-0 [overflow-wrap:anywhere]">{appointment.cliente_email}</span>
																		</div>
																	)}
																</div>
															</div>
														</div>
														<div className="flex w-full flex-wrap items-start gap-2 xl:w-auto xl:max-w-[55%] xl:justify-end">
															{telefoneLocal(appointment.cliente_telefone ?? "") && (
																<Button asChild variant="outline" size="sm">
																	<a href={whatsAppUrl(appointment.cliente_telefone)}
																		target="_blank" rel="noopener noreferrer"
																		aria-label={`Entrar em contato com ${appointment.cliente_nome} pelo WhatsApp`}>
																		<Phone aria-hidden="true" /> Entrar em contato
																	</a>
																</Button>
															)}
															<AcoesAgendamento agendamento={appointment} lado="equipe" />
															{!appointment.user_id && (
																<LinkClienteAgendamento id={appointment.id} />
															)}
															{appointment.status === "confirmado" && !appointment.cancelamento_solicitado_por && (
																<AlertDialog>
																	<AlertDialogTrigger asChild>
																		<Button
																			variant="outline"
																			size="sm"
																			className="text-blue-600 border-blue-500/50 hover:bg-blue-500/10 text-xs sm:text-sm h-8 sm:h-auto"
																			disabled={updateStatusMutation.isPending}
																		>
																			{updateStatusMutation.isPending ? (
																				<Loader2 className="w-3 h-3 sm:w-4 sm:h-4 mr-1 animate-spin" />
																			) : (
																				<CheckCircle className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
																			)}
																			Finalizar
																		</Button>
																	</AlertDialogTrigger>
																	<AlertDialogContent>
																		<AlertDialogHeader>
																			<AlertDialogTitle>
																				Finalizar Atendimento?
																			</AlertDialogTitle>
																			<AlertDialogDescription>
																				Marcar este agendamento como
																				finalizado irá adicioná-lo ao
																				histórico e liberar a avaliação
																				para o cliente.
																			</AlertDialogDescription>
																		</AlertDialogHeader>
																		<AlertDialogFooter>
																			<AlertDialogCancel>Voltar</AlertDialogCancel>
																			<AlertDialogAction
															onClick={() => updateStatusMutation.mutate(appointment.id)}
																			>
																				Sim, finalizar
																			</AlertDialogAction>
																		</AlertDialogFooter>
																	</AlertDialogContent>
																</AlertDialog>
															)}
														</div>
													</div>
												</CardContent>
											</Card>
										))}
									</div>
								</div>
							)
						)
					)}
				</div>
			</div>
		</DashboardLayout>
	);
}
