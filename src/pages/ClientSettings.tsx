import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
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
import { ArrowLeft, Edit3, Loader2, Save, Trash2, User, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { usePhoneMask } from "@/hooks/usePhoneMask";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

const ClientSettings = () => {
	const navigate = useNavigate();
	const { user, profile, signOut, refreshProfile } = useAuth();
	const { toast } = useToast();
	const [isDeleting, setIsDeleting] = useState(false);
	const [deleteConfirmation, setDeleteConfirmation] = useState("");

	// Edição de perfil
	const [isEditing, setIsEditing] = useState(false);
	const [name, setName] = useState(profile?.name || "");
	const {
		value: phone,
		handleChange: handlePhoneChange,
		handleBlur: handlePhoneBlur,
		setValue: setPhoneValue,
	} = usePhoneMask(profile?.phone || "");

	// Preferências de Notificação
	const [prefs, setPrefs] = useState({
		receber_lembretes_email: profile?.receber_lembretes_email ?? true,
		receber_lembretes_sms: profile?.receber_lembretes_sms ?? false,
		consentimento_marketing: profile?.consentimento_marketing ?? false,
	});

	// Sincronizar estado com o perfil quando ele mudar
	useEffect(() => {
		if (profile) {
			setName(profile.name || "");
			setPhoneValue(profile.phone || "");
			setPrefs({
				receber_lembretes_email: profile.receber_lembretes_email ?? true,
				receber_lembretes_sms: profile.receber_lembretes_sms ?? false,
				consentimento_marketing: profile.consentimento_marketing ?? false,
			});
		}
	}, [profile, setPhoneValue]);

	const handlePreferenceChange = async (
		key: keyof typeof prefs,
		value: boolean
	) => {
		if (!profile) return;
		
		// Atualiza o estado local primeiro para uma UI responsiva
		const newPrefs = { ...prefs, [key]: value };
		setPrefs(newPrefs);

		try {
			const { error } = await supabase
				.from("profiles")
				.update({ [key]: value })
				.eq("user_id", profile.user_id);

			if (error) {
				// Reverte a UI em caso de erro
				setPrefs(prefs);
				throw error;
			}
			
			toast({
				title: "Preferência atualizada!",
			});
			await refreshProfile();

		} catch (error: unknown) {
			toast({
				title: "Erro ao atualizar preferência",
				description: error instanceof Error ? error.message : "Erro desconhecido",
				variant: "destructive",
			});
		}
	};

	const handleSaveChanges = async () => {
		if (!profile) return;

		// Validar telefone (10 ou 11 dígitos)
		const cleanPhone = (phone || '').replace(/\D/g, "");
		if (cleanPhone.length > 0 && (cleanPhone.length < 10 || cleanPhone.length > 11)) {
			toast({
				title: "Telefone inválido",
				description: "O telefone deve ter 10 ou 11 dígitos (com DDD).",
				variant: "destructive",
			});
			return;
		}

		try {
			const { error } = await supabase
				.from("profiles")
				.update({ name: name, phone: cleanPhone })
				.eq("user_id", profile.user_id);
			
			if (error) throw error;

			toast({
				title: "Sucesso!",
				description: "Seu perfil foi atualizado.",
			});

			await refreshProfile(); // Atualiza o perfil no AuthContext
			setIsEditing(false);

		} catch (error: unknown) {
			toast({
				title: "Erro ao atualizar perfil",
				description: error instanceof Error ? error.message : "Erro desconhecido",
				variant: "destructive",
			});
		}
	};

	const handleDeleteAccount = async () => {
		if (deleteConfirmation !== "CONFIRMAR") {
			toast({
				title: "Confirmação inválida",
				description: "Digite exatamente 'CONFIRMAR' para prosseguir.",
				variant: "destructive",
			});
			return;
		}

		if (!user) {
			toast({
				title: "Erro",
				description: "Usuário não está logado.",
				variant: "destructive",
			});
			return;
		}

		setIsDeleting(true);
		try {
			console.log("Initiating account deletion for user:", user.email);

			// Obtém a sessão atual para garantir que o token está válido
			const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
			if (sessionError || !sessionData.session) {
				throw new Error("Sessão inválida ou expirada. Faça login novamente.");
			}

			const { data, error } = await supabase.functions.invoke("delete-client-account");

			if (error) {
				console.error("Edge function error:", error);
				throw new Error(error.message);
			}

			console.log("Account deletion response:", data);

			toast({
				title: "Sucesso",
				description: "Sua conta foi excluída.",
			});

			await signOut();
			navigate("/");
		} catch (error: unknown) {
			console.error("Delete account error:", error);
			toast({
				title: "Erro ao excluir conta",
				description: error instanceof Error ? error.message : "Não foi possível completar a solicitação.",
				variant: "destructive",
			});
		} finally {
			setIsDeleting(false);
		}
	};

	return (
		<div className="min-h-screen bg-gradient-bg">
			{/* Header */}
			<div className="border-b border-border/50 bg-card/30 backdrop-blur-sm">
				<div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
					<div className="flex items-center gap-4">
						<Button 
							variant="ghost" 
							size="icon"
							onClick={() => navigate('/client-panel')}
						>
							<ArrowLeft className="w-4 h-4" />
						</Button>
						<div>
							<h1 className="text-2xl font-bold">Configurações da Conta</h1>
							<p className="text-muted-foreground">Gerencie suas informações e preferências.</p>
						</div>
					</div>
				</div>
			</div>

			{/* Content */}
			<div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
				<div className="space-y-8">
					{/* Seção de Perfil */}
					<Card className="border-border/50 bg-card/50 backdrop-blur-sm">
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<User className="w-5 h-5 text-primary"/>
								Meu Perfil
							</CardTitle>
							<CardDescription>
								Estas são as suas informações públicas.
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-6">
							<div className="flex items-center justify-between">
								<div>
									<p className="font-medium">Nome</p>
									{isEditing ? (
										<Input
											id="name"
											value={name}
											onChange={(e) => setName(e.target.value)}
											className="mt-1"
											maxLength={100}
										/>
									) : (
										<p className="text-muted-foreground">{profile?.name}</p>
									)}
								</div>
							</div>
							<div className="flex items-center justify-between">
								<div>
									<p className="font-medium">E-mail</p>
									<p className="text-muted-foreground">{user?.email}</p>
								</div>
								{/* Email não é editável */}
							</div>
							<div className="flex items-center justify-between">
								<div>
									<p className="font-medium">Telefone</p>
									{isEditing ? (
										<Input
											id="phone"
											type="tel"
											value={phone}
											onChange={handlePhoneChange}
											onBlur={handlePhoneBlur}
											placeholder="(99) 99999-9999"
											className="mt-1"
											maxLength={15}
										/>
									) : (
										<p className="text-muted-foreground">{profile?.phone || 'Não informado'}</p>
									)}
								</div>
							</div>
							<div className="flex justify-end gap-2 mt-4">
								{isEditing ? (
									<>
										<Button 
											variant="outline" 
											onClick={() => setIsEditing(false)}
										>
											<X className="w-4 h-4 mr-2" />
											Cancelar
										</Button>
										<Button onClick={handleSaveChanges}>
											<Save className="w-4 h-4 mr-2" />
											Salvar Alterações
										</Button>
									</>
								) : (
									<Button 
										variant="outline" 
										onClick={() => setIsEditing(true)}
									>
										<Edit3 className="w-4 h-4 mr-2" />
										Editar Perfil
									</Button>
								)}
							</div>
						</CardContent>
					</Card>

					{/* Seção de Preferências */}
					<Card className="border-border/50 bg-card/50 backdrop-blur-sm">
						<CardHeader>
							<CardTitle>Preferências de Notificação</CardTitle>
							<CardDescription>
								Escolha como você quer ser comunicado.
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-4">
							<div className="flex items-center justify-between">
								<Label htmlFor="email-reminders" className="flex flex-col gap-1">
									<span>Lembretes por E-mail</span>
									<span className="text-xs text-muted-foreground">
										Receba lembretes dos seus agendamentos no seu e-mail.
									</span>
								</Label>
								<Switch
									id="email-reminders"
									checked={prefs.receber_lembretes_email}
									onCheckedChange={(value) => handlePreferenceChange('receber_lembretes_email', value)}
								/>
							</div>
							<div className="flex items-center justify-between">
								<Label htmlFor="sms-reminders" className="flex flex-col gap-1">
									<span>Lembretes por SMS</span>
									<span className="text-xs text-muted-foreground">
										Receba lembretes por SMS (pode haver custos).
									</span>
								</Label>
								<Switch
									id="sms-reminders"
									checked={prefs.receber_lembretes_sms}
									onCheckedChange={(value) => handlePreferenceChange('receber_lembretes_sms', value)}
								/>
							</div>
							<div className="flex items-center justify-between">
								<Label htmlFor="marketing-consent" className="flex flex-col gap-1">
									<span>Novidades e Promoções</span>
									<span className="text-xs text-muted-foreground">
										Receba e-mails sobre novidades e ofertas especiais.
									</span>
								</Label>
								<Switch
									id="marketing-consent"
									checked={prefs.consentimento_marketing}
									onCheckedChange={(value) => handlePreferenceChange('consentimento_marketing', value)}
								/>
							</div>
						</CardContent>
					</Card>

					{/* Seção de Exclusão de Conta */}
					<Card className="border-destructive/50 bg-card/50 backdrop-blur-sm">
						<CardHeader>
							<CardTitle className="text-destructive">Zona de Perigo</CardTitle>
							 <CardDescription>
								Ações permanentes e destrutivas.
							</CardDescription>
						</CardHeader>
						<CardContent>
							<div className="flex items-center justify-between">
								<div>
									<p className="font-medium">Excluir sua conta</p>
									<p className="text-sm text-muted-foreground">
										Isso removerá permanentemente todos os seus dados.
									</p>
								</div>
								<AlertDialog onOpenChange={(open) => !open && setDeleteConfirmation("")}>
									<AlertDialogTrigger asChild>
										<Button variant="destructive">
											<Trash2 className="w-4 h-4 mr-2" />
											Excluir Conta
										</Button>
									</AlertDialogTrigger>
									<AlertDialogContent>
										<AlertDialogHeader>
											<AlertDialogTitle>⚠️ Confirmar Exclusão de Conta</AlertDialogTitle>
											<AlertDialogDescription>
												Esta ação não pode ser desfeita. Isso excluirá permanentemente sua conta e removerá todos os seus dados de nossos servidores, incluindo:
												<br />• Seu perfil e informações pessoais
												<br />• Histórico de agendamentos
												<br />• Todas as suas configurações
											</AlertDialogDescription>
										</AlertDialogHeader>
										<div className="py-4">
											<Label htmlFor="delete-confirmation" className="text-sm font-medium">
												Para confirmar, digite <span className="font-bold text-destructive">CONFIRMAR</span> no campo abaixo:
											</Label>
											<Input
												id="delete-confirmation"
												type="text"
												value={deleteConfirmation}
												onChange={(e) => setDeleteConfirmation(e.target.value)}
												placeholder="Digite CONFIRMAR"
												className="mt-2"
												disabled={isDeleting}
											/>
										</div>
										<AlertDialogFooter>
											<AlertDialogCancel onClick={() => setDeleteConfirmation("")}>
												Cancelar
											</AlertDialogCancel>
											<AlertDialogAction
												onClick={handleDeleteAccount}
												disabled={isDeleting || deleteConfirmation !== "CONFIRMAR"}
												className="bg-destructive hover:bg-destructive/90"
											>
												{isDeleting ? (
													<>
														<Loader2 className="w-4 h-4 animate-spin mr-2" />
														Excluindo...
													</>
												) : (
													<>
														<Trash2 className="w-4 h-4 mr-2" />
														Excluir Conta Permanentemente
													</>
												)}
											</AlertDialogAction>
										</AlertDialogFooter>
									</AlertDialogContent>
								</AlertDialog>
							</div>
						</CardContent>
					</Card>
				</div>
			</div>
		</div>
	);
};

export default ClientSettings;