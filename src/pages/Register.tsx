import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Eye, EyeOff, Lock, Mail, ArrowLeft, User, Phone, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { usePhoneMask } from "@/hooks/usePhoneMask";
import { supabase } from "@/integrations/supabase/client";
import { usePasswordStrength } from "@/hooks/usePasswordStrength";
import { PasswordStrengthBar } from "@/components/ui/password-strength";

export default function Register() {
	const [showPassword, setShowPassword] = useState(false);
	const [isLoading, setIsLoading] = useState(false);
	const { value: phoneValue, handleChange: handlePhoneChange } = usePhoneMask();
	const [formData, setFormData] = useState({
		name: "",
		email: "",
		password: "",
		confirmPassword: "",
	});

	const { signUp, user, role, loading: authLoading } = useAuth();
	const navigate = useNavigate();
	const { toast } = useToast();
	const passwordStrength = usePasswordStrength(formData.password);

	// Redireciona se já estiver logado (após o carregamento)
	useEffect(() => {
		if (!authLoading && user) {
			// Redirecionar para client-panel se for cliente, caso contrário dashboard
			if (role === 'cliente') {
				navigate("/client-panel");
			} else {
				navigate("/dashboard");
			}
		}
	}, [user, authLoading, role, navigate]);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setIsLoading(true);

		try {
			if (formData.password !== formData.confirmPassword) {
				toast({
					title: "Erro no cadastro",
					description: "As senhas não coincidem.",
					variant: "destructive",
				});
				return;
			}

			if (formData.password.length < 8) {
				toast({
					title: "Senha muito curta",
					description: "Sua senha deve ter pelo menos 8 caracteres.",
					variant: "destructive",
				});
				return;
			}

			if (passwordStrength.score < 2) {
				toast({
					title: "Senha muito fraca",
					description: "Sua senha deve atender mais requisitos de segurança.",
					variant: "destructive",
				});
				return;
			}

			// Validação do telefone (obrigatório)
			const unmaskedPhone = (phoneValue || '').replace(/\D/g, '');
			if (!unmaskedPhone || unmaskedPhone.length < 10) {
				toast({
					title: "Telefone obrigatório",
					description: "Por favor, insira um telefone válido com DDD.",
					variant: "destructive",
				});
				return;
			}

			// Verificar se email ou telefone já existem
			const { data: checkData, error: checkError } = await supabase.rpc('check_if_user_exists', {
				p_email: formData.email,
				p_phone: unmaskedPhone || '' // Usar string vazia em vez de null
			});

			if (checkError) {
				toast({
					title: "Erro ao verificar usuário",
					description: "Não foi possível validar suas informações. Tente novamente.",
					variant: "destructive",
				});
				return;
			}

			if (checkData && typeof checkData === 'object' && 'email_exists' in checkData && (checkData as any).email_exists) {
				toast({
					title: "E-mail já cadastrado",
					description: "Este e-mail já está em uso. Tente fazer login.",
					variant: "destructive",
				});
				return;
			}
			if (checkData && typeof checkData === 'object' && 'phone_exists' in checkData && (checkData as any).phone_exists) {
				toast({
					title: "Telefone já cadastrado",
					description: "Este telefone já está associado a outra conta.",
					variant: "destructive",
				});
				return;
			}

			const { error } = await signUp(formData.email, formData.password, {
				data: {
					name: formData.name,
					phone: unmaskedPhone || null, // Usar unmaskedPhone consistentemente
					role: "cliente", // Default role for new users
				},
			});

			if (error) {
				toast({
					title: "Erro ao criar conta",
					description:
						error.message === "User already registered"
							? "Este e-mail já está em uso."
							: "Não foi possível criar sua conta. Tente novamente.",
					variant: "destructive",
				});
			} else {
				toast({
					title: "Conta criada com sucesso!",
					description: "Você já pode fazer login.",
					variant: "default",
				});
				navigate("/client-login"); // Redirect to the new client login page
			}
		} catch (error) {
			console.error('Erro inesperado durante o cadastro:', error);
			toast({
				title: "Erro inesperado",
				description: "Ocorreu um erro inesperado. Tente novamente.",
				variant: "destructive",
			});
		} finally {
			setIsLoading(false);
		}
	};

	const handleInputChange = (field: string, value: string) => {
		setFormData((prev) => ({ ...prev, [field]: value }));
	};

	if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

	return (
		<div className="min-h-screen w-full bg-gradient-to-br from-background to-blue-950/20 flex flex-col items-center justify-center p-4 pt-20 relative">
			<Link
				to="/"
				className="fixed top-6 left-6 inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors z-20"
			>
				<ArrowLeft className="w-4 h-4" />
				Voltar ao início
			</Link>

			<main className="z-10 flex flex-col items-center text-center w-full max-w-md">
				<div className="flex items-center justify-center gap-2 mb-6">
					<img src="/icon-agendem.svg" alt="agendem" className="w-12 h-12" />
					<span className="text-2xl font-bold bg-gradient-primary bg-clip-text text-transparent">
						agendem Cliente
					</span>
				</div>

				<h1 className="text-3xl font-bold mb-2">Crie sua conta</h1>
				<p className="text-muted-foreground mb-8">
					É rápido e fácil. Preencha os campos abaixo para começar.
				</p>

				<Card className="w-full border-border/50 shadow-brand-lg">
					<CardHeader>
						<CardTitle className="text-2xl">Cadastro de Cliente</CardTitle>
						<CardDescription>
							Seus dados estão seguros conosco.
						</CardDescription>
					</CardHeader>
					<CardContent>
						<form onSubmit={handleSubmit} className="space-y-4">
							<div className="space-y-2">
								<Label htmlFor="name">Nome completo</Label>
								<div className="relative">
									<User className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
									<Input
										id="name"
										type="text"
										placeholder="Seu nome completo"
										className="pl-10"
										value={formData.name}
										onChange={(e) => handleInputChange("name", e.target.value)}
										required
									/>
								</div>
							</div>

							<div className="space-y-2">
								<Label htmlFor="email">E-mail</Label>
								<div className="relative">
									<Mail className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
									<Input
										id="email"
										type="email"
										placeholder="seu@email.com"
										className="pl-10"
										value={formData.email}
										onChange={(e) => handleInputChange("email", e.target.value)}
										required
									/>
								</div>
							</div>

						<div className="space-y-2">
							<Label htmlFor="phone">Telefone</Label>
							<div className="relative">
								<Phone className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
								<Input
									id="phone"
									type="tel"
									placeholder="(11) 99999-9999"
									className="pl-10"
									value={phoneValue}
									onChange={handlePhoneChange}
									required
								/>
							</div>
						</div>

							<div className="space-y-4">
								<div className="space-y-2">
									<Label htmlFor="password">Senha</Label>
									<div className="relative">
										<Lock className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
										<Input
											id="password"
											type={showPassword ? "text" : "password"}
											placeholder="••••••••"
											className="pl-10 pr-10"
											value={formData.password}
											onChange={(e) =>
												handleInputChange("password", e.target.value)
											}
											required
										/>
										<Button
											type="button"
											variant="ghost"
											size="icon"
											className="absolute right-1 top-1 h-8 w-8"
											onClick={() => setShowPassword(!showPassword)}
										>
											{showPassword ? (
												<EyeOff className="w-4 h-4" />
											) : (
												<Eye className="w-4 h-4" />
											)}
										</Button>
									</div>
									{formData.password && (
										<PasswordStrengthBar 
											strength={passwordStrength} 
											showRequirements={true}
											className="mt-3"
										/>
									)}
								</div>

								<div className="space-y-2">
									<Label htmlFor="confirmPassword">Confirmar senha</Label>
									<div className="relative">
										<Lock className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
										<Input
											id="confirmPassword"
											type={showPassword ? "text" : "password"}
											placeholder="••••••••"
											className="pl-10"
											value={formData.confirmPassword}
											onChange={(e) =>
												handleInputChange("confirmPassword", e.target.value)
											}
											required
										/>
									</div>
								</div>
							</div>

							<Button
								type="submit"
								variant="premium"
								className="w-full"
								disabled={isLoading}
							>
								{isLoading ? "Criando conta..." : "Finalizar Cadastro"}
							</Button>
						</form>

						<div className="mt-6 text-center">
							<span className="text-sm text-muted-foreground">
								Já tem uma conta?{" "}
								<Link
									to="/client-login"
									className="text-primary hover:underline font-medium"
								>
									Faça login
								</Link>
							</span>
						</div>
					</CardContent>
				</Card>
			</main>
		</div>
	);
}