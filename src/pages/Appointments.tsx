import { useState, useEffect, useRef, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { FEATURES } from "@/config/features";
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
	X,
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

interface Appointment {
	id: string;
	cliente_nome: string;
	cliente_telefone: string;
	cliente_email: string | null;
	data_hora: string;
	status: "pendente" | "confirmado" | "cancelado" | "finalizado";
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
const fetchAppointments = async (userId: string, dateRange: { from: Date; to?: Date }, statusFilter?: string, userRole?: string, funcionarioId?: string): Promise<Appointment[]> => {
	if (!userId) return [];

	// Remover o filtro manual de barbearia_id e deixar a política RLS fazer o trabalho
	// A política RLS já garante que apenas agendamentos da barbearia do usuário sejam retornados
	let query = supabase
		.from("agendamentos")
		.select(`
			id,
			cliente_nome,
			cliente_telefone,
			cliente_email,
			data_hora,
			status,
			user_id,
			funcionario_id,
			servicos!inner(nome, valor, duracao_minutos),
			funcionarios(id, nome)
		`);

	// SISTEMA DE CONFIRMAÇÃO PAUSADO - Agendamentos já são criados como 'confirmado'
	if (statusFilter === 'pendente') {
		// Para agendamentos pendentes, buscar todos independente da data
		// NOTA: Como agendamentos agora são auto-confirmados, este filtro retornará vazio
		query = query.eq('status', 'pendente');
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

	const { data, error } = await query.order("data_hora");

	if (error) throw error;

	// Filtrar agendamentos para funcionários (não admin)
	// Funcionários veem apenas seus próprios agendamentos OU agendamentos sem funcionário específico
	if (userRole === 'funcionario' && funcionarioId && data) {
		return data.filter(appointment =>
			!appointment.funcionario_id || // Agendamentos sem funcionário específico
			appointment.funcionario_id === funcionarioId // Ou agendamentos deste funcionário
		);
	}

	return data || [];
};

export default function Appointments() {
	const { user, role } = useAuth();
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
		queryKey: ['appointments', user?.id, dateRange, statusFilter, role, funcionarioId],
		queryFn: () => {
			// Se não houver range selecionado ou não tiver data de início, usa HOJE como padrão
			const effectiveRange = (dateRange && dateRange.from) ? dateRange : { from: new Date(), to: new Date() };

			return fetchAppointments(
				user!.id,
				effectiveRange as { from: Date; to?: Date },
				statusFilter === 'pendente' ? 'pendente' : undefined,
				role || undefined,
				funcionarioId || undefined
			);
		},
		enabled: !!user
	});

	const updateStatusMutation = useMutation({
		mutationFn: async ({ id, status, appointment }: {
			id: string,
			status: "pendente" | "confirmado" | "cancelado" | "finalizado",
			appointment?: Appointment
		}) => {
			// Ao finalizar, o banco cria a avaliação pendente sozinho
			const updateData: any = { status };

			if (appointment && !appointment.user_id && appointment.cliente_telefone) {
				updateData.cliente_telefone = appointment.cliente_telefone;
			}

			const { error } = await supabase.from("agendamentos").update(updateData).eq("id", id);
			if (error) throw error;

			return status;
		},
		onSuccess: (status) => {
			queryClient.invalidateQueries({ queryKey: ['appointments'] }); // Invalida todas as queries de appointments
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
			.filter(appointment => statusFilter === "all" || appointment.status === statusFilter)
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


	const updateAppointmentStatus = (
		id: string,
		status: "pendente" | "confirmado" | "cancelado" | "finalizado",
		appointment?: Appointment
	) => {
		updateStatusMutation.mutate({ id, status, appointment });
	};

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
				<div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
					<div>
						<h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
							<CalendarIcon className="w-6 h-6 sm:w-8 sm:h-8 text-primary" />
							Agendamentos
						</h1>
						<p className="text-sm sm:text-base text-muted-foreground">
							Visualize e gerencie os agendamentos da sua barbearia.
						</p>
					</div>

					<div className="flex flex-col sm:flex-row gap-3 sm:gap-4 w-full sm:w-auto">
						<Select value={statusFilter} onValueChange={setStatusFilter}>
							<SelectTrigger className="w-full sm:w-48 h-10 sm:h-auto">
								<Filter className="w-4 h-4 mr-2" />
								<SelectValue placeholder="Filtrar por status" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">Todos</SelectItem>
								<SelectItem value="pendente">Pendente</SelectItem>
								<SelectItem value="confirmado">Confirmado</SelectItem>
								<SelectItem value="finalizado">Finalizado</SelectItem>
								<SelectItem value="cancelado">Cancelado</SelectItem>
							</SelectContent>
						</Select>
						<Popover>
							<PopoverTrigger asChild>
								<Button
									variant={"outline"}
									className="w-full sm:w-64 justify-start text-left font-normal h-10 sm:h-auto text-sm sm:text-base"
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
							<PopoverContent className="w-auto p-0" align="end">
								<Calendar
									mode="range"
									selected={dateRange}
									onSelect={setDateRange}
									locale={ptBR}
									numberOfMonths={2}
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
									<div className="grid gap-3 sm:gap-4">
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
													<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
														<div className="flex items-center gap-3 sm:gap-4 flex-1">
															<div className="text-center flex-shrink-0">
																<div className="text-lg sm:text-2xl font-bold text-primary">
																	{formatTime(appointment.data_hora)}
																</div>
																<div className="text-xs text-muted-foreground">
																	{appointment.servicos.duracao_minutos}min
																</div>
															</div>
															<div className="flex-1 min-w-0">
																<div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-1">
																	<h3 className="font-semibold text-base sm:text-lg truncate">
																		{appointment.cliente_nome}
																	</h3>
																	<Badge
																		variant="outline"
																		className={`${getStatusColor(appointment.status)} text-xs self-start sm:self-auto`}
																	>
																		{getStatusLabel(appointment.status)}
																	</Badge>
																</div>
																<div className="text-xs sm:text-sm text-muted-foreground space-y-1">
																	<div className="flex items-center gap-2">
																		<User className="w-3 h-3 flex-shrink-0" />
																		<span className="truncate">{appointment.servicos.nome}</span>
																		<span>•</span>
																		<span className="flex-shrink-0">
																			R${" "}
																			{appointment.servicos.valor.toFixed(2)}
																		</span>
																	</div>
																	<div className="flex items-center gap-2">
																		<Phone className="w-3 h-3 flex-shrink-0" />
																		<span className="truncate">{appointment.cliente_telefone}</span>
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
																			<span className="truncate">{appointment.cliente_email}</span>
																		</div>
																	)}
																</div>
															</div>
														</div>
														<div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
															{/* SISTEMA DE CONFIRMAÇÃO PAUSADO - Agendamentos já são criados como 'confirmado'
															    Para reativar: mudar status inicial para 'pendente' em api.ts e ativar FEATURES.confirmacaoAgendamento */}
															{FEATURES.confirmacaoAgendamento && appointment.status === "pendente" && (
																<>
																	<AlertDialog>
																		<AlertDialogTrigger asChild>
																			<Button
																				variant="outline"
																				size="sm"
																				className="text-green-600 border-green-500/50 hover:bg-green-500/10 text-xs sm:text-sm h-8 sm:h-auto"
																				disabled={updateStatusMutation.isPending}
																			>
																				{updateStatusMutation.isPending ? (
																					<Loader2 className="w-3 h-3 sm:w-4 sm:h-4 mr-1 animate-spin" />
																				) : (
																					<CheckCircle className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
																				)}
																				Confirmar
																			</Button>
																		</AlertDialogTrigger>
																		<AlertDialogContent>
																			<AlertDialogHeader>
																				<AlertDialogTitle>
																					Confirmar Agendamento?
																				</AlertDialogTitle>
																				<AlertDialogDescription>
																					O cliente será notificado sobre a
																					confirmação.
																				</AlertDialogDescription>
																			</AlertDialogHeader>
																			<AlertDialogFooter>
																				<AlertDialogCancel>
																					Voltar
																				</AlertDialogCancel>
																				<AlertDialogAction
																					onClick={() =>
																						updateAppointmentStatus(
																							appointment.id,
																							"confirmado",
																							appointment
																						)
																					}
																				>
																					Sim, confirmar
																				</AlertDialogAction>
																			</AlertDialogFooter>
																		</AlertDialogContent>
																	</AlertDialog>
																	<AlertDialog>
																		<AlertDialogTrigger asChild>
																			<Button
																				variant="outline"
																				size="sm"
																				className="text-red-600 border-red-500/50 hover:bg-red-500/10 text-xs sm:text-sm h-8 sm:h-auto"
																				disabled={updateStatusMutation.isPending}
																			>
																				{updateStatusMutation.isPending ? (
																					<Loader2 className="w-3 h-3 sm:w-4 sm:h-4 mr-1 animate-spin" />
																				) : (
																					<X className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
																				)}
																				Cancelar
																			</Button>
																		</AlertDialogTrigger>
																		<AlertDialogContent>
																			<AlertDialogHeader>
																				<AlertDialogTitle>
																					Cancelar Agendamento?
																				</AlertDialogTitle>
																				<AlertDialogDescription>
																					Esta ação não pode ser desfeita e
																					o cliente será notificado.
																				</AlertDialogDescription>
																			</AlertDialogHeader>
																			<AlertDialogFooter>
																				<AlertDialogCancel>
																					Voltar
																				</AlertDialogCancel>
																				<AlertDialogAction
																					className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
																					onClick={() =>
																						updateAppointmentStatus(
																							appointment.id,
																							"cancelado",
																							appointment
																						)
																					}
																				>
																					Sim, cancelar
																				</AlertDialogAction>
																			</AlertDialogFooter>
																		</AlertDialogContent>
																	</AlertDialog>
																</>
															)}
															{appointment.status === "confirmado" && (
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
																				onClick={() =>
																					updateAppointmentStatus(
																						appointment.id,
																						"finalizado",
																						appointment
																					)
																				}
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