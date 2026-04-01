import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
	Calendar,
	Clock,
	MapPin,
	User,
	Search,
	Filter,
	ArrowLeft,
	CheckCircle,
	XCircle,
	Clock3,
	Download,
} from "lucide-react";
import { generatePDFReceipt } from "@/components/PDFGenerator";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";
import { format, parseISO, isAfter, isBefore, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";



const statusColors = {
	pendente: "bg-yellow-100 text-yellow-800 border-yellow-200",
	confirmado: "bg-green-100 text-green-800 border-green-200",
	cancelado: "bg-red-100 text-red-800 border-red-200",
	finalizado: "bg-gray-100 text-gray-800 border-gray-200",
};

const statusIcons = {
	pendente: Clock3,
	confirmado: CheckCircle,
	cancelado: XCircle,
	finalizado: CheckCircle,
};

const statusLabels = {
	pendente: "Pendente",
	confirmado: "Confirmado",
	cancelado: "Cancelado",
	finalizado: "Concluído",
};

export default function MyAppointments() {
	const { user } = useAuth();
	const navigate = useNavigate();
	const isMobile = useIsMobile();
	const [searchTerm, setSearchTerm] = useState("");
	const [statusFilter, setStatusFilter] = useState("all");
	const [dateFilter, setDateFilter] = useState("all");

	const { data: appointments = [], isLoading } = useQuery({
		queryKey: ["all-appointments", user?.id],
		queryFn: async () => {
			if (!user?.id) return [];

			const { data, error } = await supabase
				.from("agendamentos")
				.select(`
				id,
				data_hora,
				status,
				created_at,
				servicos!inner (
				nome,
				valor
			),
					barbearias!inner (
						nome,
						endereco
					),
					funcionarios (
					nome
				)
				`)
				.eq("user_id", user.id)
				.order("data_hora", { ascending: false });

			if (error) {
				console.error("Erro ao buscar agendamentos:", error);
				return [];
			}

			return data || [];
		},
		enabled: !!user?.id,
	});

	// Filtrar agendamentos
	const filteredAppointments = appointments.filter((appointment) => {
		const matchesSearch = 
			(appointment.barbearias?.nome || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
			(appointment.servicos?.nome || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
			(appointment.funcionarios?.nome || '').toLowerCase().includes(searchTerm.toLowerCase());

		const matchesStatus = statusFilter === "all" || appointment.status === statusFilter;

		let matchesDate = true;
		if (dateFilter !== "all" && appointment.data_hora) {
			try {
				const appointmentDate = parseISO(appointment.data_hora);
				const today = new Date();
				
				switch (dateFilter) {
					case "future":
						matchesDate = isAfter(appointmentDate, startOfDay(today));
						break;
					case "past":
						matchesDate = isBefore(appointmentDate, startOfDay(today));
						break;
					case "today":
						matchesDate = 
							isAfter(appointmentDate, startOfDay(today)) && 
							isBefore(appointmentDate, endOfDay(today));
						break;
				}
			} catch (error) {
				console.error('Erro ao processar data do agendamento:', error);
				matchesDate = false;
			}
		}

		return matchesSearch && matchesStatus && matchesDate;
	});

	if (isLoading) {
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
						<h1 className="text-2xl font-bold">Meus Agendamentos</h1>
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
						Meus Agendamentos
					</h1>
				</div>

				{/* Filters */}
				<Card className="border-border/50 bg-card/50 backdrop-blur-sm">
					<CardContent className={`${isMobile ? 'p-4' : 'p-6'} space-y-4`}>
						{/* Search */}
						<div className="relative">
							<Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
							<Input
								placeholder="Buscar por barbearia, serviço ou barbeiro..."
								value={searchTerm}
								onChange={(e) => setSearchTerm(e.target.value)}
								className="pl-10"
							/>
						</div>

						{/* Filter buttons */}
						<div className={`flex ${isMobile ? 'flex-col space-y-2' : 'flex-row space-x-4'}`}>
							<div className="flex-1">
								<Select value={statusFilter} onValueChange={setStatusFilter}>
									<SelectTrigger>
										<Filter className="w-4 h-4 mr-2" />
										<SelectValue placeholder="Status" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="all">Todos os Status</SelectItem>
										<SelectItem value="pendente">Pendente</SelectItem>
										<SelectItem value="confirmado">Confirmado</SelectItem>
										<SelectItem value="finalizado">Concluído</SelectItem>
										<SelectItem value="cancelado">Cancelado</SelectItem>
									</SelectContent>
								</Select>
							</div>

							<div className="flex-1">
								<Select value={dateFilter} onValueChange={setDateFilter}>
									<SelectTrigger>
										<Calendar className="w-4 h-4 mr-2" />
										<SelectValue placeholder="Período" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="all">Todos os Períodos</SelectItem>
										<SelectItem value="future">Futuros</SelectItem>
										<SelectItem value="today">Hoje</SelectItem>
										<SelectItem value="past">Passados</SelectItem>
									</SelectContent>
								</Select>
							</div>
						</div>
					</CardContent>
				</Card>

				{/* Results count */}
				<div className="text-sm text-muted-foreground">
					{filteredAppointments.length} agendamento{filteredAppointments.length !== 1 ? 's' : ''} encontrado{filteredAppointments.length !== 1 ? 's' : ''}
				</div>

				{/* Appointments list */}
				<div className="space-y-4">
					{filteredAppointments.length === 0 ? (
						<Card className="border-border/50 bg-card/50 backdrop-blur-sm">
							<CardContent className="p-8 text-center">
								<Calendar className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
								<h3 className="text-lg font-semibold mb-2">Nenhum agendamento encontrado</h3>
								<p className="text-muted-foreground mb-4">
									{searchTerm || statusFilter !== "all" || dateFilter !== "all"
										? "Tente ajustar os filtros para encontrar seus agendamentos."
										: "Você ainda não possui agendamentos."}
								</p>
								<Button
									variant="premium"
									onClick={() => navigate("/barbearias")}
								>
									Fazer Primeiro Agendamento
								</Button>
							</CardContent>
						</Card>
					) : (
						filteredAppointments.map((appointment) => {
							const StatusIcon = statusIcons[appointment.status as keyof typeof statusIcons] || Clock3;
							
							return (
								<Card key={appointment.id} className="border-border/50 bg-card/50 backdrop-blur-sm hover:shadow-lg transition-shadow">
									<CardContent className={`${isMobile ? 'p-4' : 'p-6'}`}>
										<div className={`flex ${isMobile ? 'flex-col space-y-3' : 'items-start justify-between'}`}>
											<div className="flex-1 space-y-2">
												{/* Status and Date */}
												<div className="flex items-center gap-3 flex-wrap">
													<Badge className={statusColors[appointment.status as keyof typeof statusColors] || statusColors.pendente}>
														<StatusIcon className="w-3 h-3 mr-1" />
														{statusLabels[appointment.status as keyof typeof statusLabels] || 'Status Desconhecido'}
													</Badge>
													<div className="flex items-center text-sm text-muted-foreground">
															<Calendar className="w-4 h-4 mr-1" />
															{appointment.data_hora ? format(parseISO(appointment.data_hora), "dd 'de' MMMM 'de' yyyy", { locale: ptBR }) : 'Data não informada'}
														</div>
														<div className="flex items-center text-sm text-muted-foreground">
															<Clock className="w-4 h-4 mr-1" />
															{appointment.data_hora ? format(parseISO(appointment.data_hora), "HH:mm", { locale: ptBR }) : 'Hora não informada'}
														</div>
												</div>

												{/* Service and Barbershop */}
												<div className="space-y-1">
													<h3 className="font-semibold text-lg">{appointment.servicos?.nome || 'Serviço não informado'}</h3>
													<p className="text-muted-foreground">{appointment.barbearias?.nome || 'Barbearia não informada'}</p>
													{appointment.funcionarios?.nome && (
														<div className="flex items-center text-sm text-muted-foreground">
															<User className="w-4 h-4 mr-1" />
															{appointment.funcionarios.nome}
														</div>
													)}
													<div className="flex items-center text-sm text-muted-foreground">
														<MapPin className="w-4 h-4 mr-1" />
														{appointment.barbearias?.endereco || 'Endereço não informado'}
													</div>
												</div>
											</div>

											{/* Price and Actions */}
												<div className={`${isMobile ? 'space-y-2' : 'text-right space-y-2'}`}>
													<div className="text-2xl font-bold text-primary">
														R$ {(appointment.servicos?.valor || 0).toFixed(2)}
													</div>
													<div className="text-xs text-muted-foreground">
														Agendado em {appointment.created_at ? format(parseISO(appointment.created_at), "dd/MM/yyyy", { locale: ptBR }) : 'Data não informada'}
													</div>
													{/* Download Receipt Button */}
													<Button
														variant="outline"
														size="sm"
														onClick={async () => {
															try {
																const appointmentData = {
																	id: appointment.id,
																	cliente_nome: user?.user_metadata?.name || 'Cliente',
																	cliente_telefone: user?.phone || '',
																	cliente_email: user?.email || '',
																	data_hora: appointment.data_hora,
																	status: appointment.status,
															servico: {
																nome: appointment.servicos?.nome || '',
																valor: appointment.servicos?.valor || 0,
																duracao_minutos: 30
															},
															funcionario: appointment.funcionarios ? {
																nome: appointment.funcionarios.nome
															} : undefined,
															barbearia: {
																nome: appointment.barbearias?.nome || '',
																endereco: appointment.barbearias?.endereco || '',
																telefone: '',
																logo_url: undefined
															}
																};
																await generatePDFReceipt(appointmentData);
															} catch (error) {
																console.error('Erro ao gerar comprovante:', error);
															}
														}}
														className={`w-full ${isMobile ? 'text-xs' : 'text-sm'}`}
													>
														<Download className="w-3 h-3 mr-1" />
														Comprovante
													</Button>
												</div>
										</div>
									</CardContent>
								</Card>
							);
						})
					)}
				</div>

				{/* Quick action button */}
				{filteredAppointments.length > 0 && (
					<div className="text-center pt-6">
						<Button
							variant="premium"
							onClick={() => navigate("/barbearias")}
							className="w-full max-w-md"
						>
							<Calendar className="w-4 h-4 mr-2" />
							Agendar Novo Serviço
						</Button>
					</div>
				)}
			</div>
		</div>
	);
}