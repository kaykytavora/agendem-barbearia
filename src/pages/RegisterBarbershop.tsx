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
import { Separator } from "@/components/ui/separator";
import {
	Eye,
	EyeOff,
	Lock,
	Mail,
	ArrowLeft,
	Scissors,
	User,
	Phone,
} from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { usePhoneMask } from "@/hooks/usePhoneMask";
import { supabase } from "@/integrations/supabase/client";

import { usePasswordStrength } from "@/hooks/usePasswordStrength";
import { PasswordStrengthBar } from "@/components/ui/password-strength";



export default function RegisterBarbershop() {
	const [showPassword, setShowPassword] = useState(false);
	const [isLoading, setIsLoading] = useState(false);
	const { value: phone, handleChange: handlePhoneChange } = usePhoneMask();
	const [formData, setFormData] = useState({
		name: "",
		email: "",
		password: "",
		confirmPassword: "",
		barbershopName: "",
	});

	const { signUp } = useAuth();
	const navigate = useNavigate();
	const { toast } = useToast();
	const passwordStrength = usePasswordStrength(formData.password);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setIsLoading(true);

		if (formData.password !== formData.confirmPassword) {
			toast({
				title: "Erro",
				description: "As senhas não coincidem",
				variant: "destructive",
			});
			setIsLoading(false);
			return;
		}

		if (formData.password.length < 8) {
			toast({
				title: "Senha muito curta",
				description: "A senha deve ter pelo menos 8 caracteres",
				variant: "destructive",
			});
			setIsLoading(false);
			return;
		}

		if (passwordStrength.score < 2) {
			toast({
				title: "Senha muito fraca",
				description: "Sua senha deve atender mais requisitos de segurança.",
				variant: "destructive",
			});
			setIsLoading(false);
			return;
		}

		const unmaskedPhone = (phone || '').replace(/\D/g, "");
		if (unmaskedPhone.length > 0 && (unmaskedPhone.length < 10 || unmaskedPhone.length > 11)) {
			toast({
				title: "Telefone inválido",
				description: "O telefone deve ter 10 ou 11 dígitos, com DDD.",
				variant: "destructive",
			});
			setIsLoading(false);
			return;
		}

		// Verificar se email ou telefone já existem
		const { data: checkData, error: checkError } = await supabase.rpc('check_if_user_exists', {
			p_email: formData.email,
			p_phone: phone
		});

		if (checkError) {
			toast({
				title: "Erro ao verificar usuário",
				description: "Não foi possível validar suas informações. Tente novamente.",
				variant: "destructive",
			});
			setIsLoading(false);
			return;
		}

		if (checkData && typeof checkData === 'object' && 'email_exists' in checkData && (checkData as any).email_exists) {
			toast({
				title: "E-mail já cadastrado",
				description: "Este e-mail já está em uso. Tente fazer login.",
				variant: "destructive",
			});
			setIsLoading(false);
			return;
		}
		if (checkData && typeof checkData === 'object' && 'phone_exists' in checkData && (checkData as any).phone_exists) {
			toast({
				title: "Telefone já cadastrado",
				description: "Este telefone já está associado a outra conta.",
				variant: "destructive",
			});
			setIsLoading(false);
			return;
		}

		const { error } = await signUp(formData.email, formData.password, {
			data: {
				name: formData.name,
				phone: phone,
				role: "admin",
				barbershop_name: formData.barbershopName,
			},
		});

		if (error) {
			toast({
				title: "Erro no cadastro",
				description:
					error.message === "User already registered"
						? "Este e-mail já está cadastrado"
						: "Erro ao criar conta. Tente novamente.",
				variant: "destructive",
			});
		} else {
			toast({
				title: "Conta criada!",
				description: "Verifique seu e-mail para confirmar a conta.",
				variant: "default",
			});
			navigate("/login");
		}

		setIsLoading(false);
	};

	const handleInputChange = (field: string, value: string) => {
		setFormData((prev) => ({ ...prev, [field]: value }));
	};

	return (
		<div className="min-h-screen flex">
			{/* Left Side - Form */}
			<div className="flex-1 flex items-center justify-center p-8 bg-background">
				<div className="w-full max-w-md space-y-8">
					{/* Header */}
					<div className="text-center">
						<Link
							to="/login"
							className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-8"
						>
							<ArrowLeft className="w-4 h-4" />
							Voltar para o login
						</Link>

						<div className="flex items-center justify-center gap-2 mb-6">
							<img src="/icon-agendem.svg" alt="agendem" className="w-12 h-12" />
							<span className="text-2xl font-bold bg-gradient-primary bg-clip-text text-transparent">
								agendem
							</span>
						</div>

						<h1 className="text-3xl font-bold mb-2">
							Crie a sua conta de gestor
						</h1>
						<p className="text-muted-foreground">
							Cadastre-se como dono e comece a gerenciar sua barbearia.
						</p>
					</div>

					{/* Form */}
					<Card className="border-border/50 shadow-brand-lg">
						<CardHeader className="space-y-1">
							<CardTitle className="text-2xl">Criar conta de gestor</CardTitle>
							<CardDescription>
								Preencha os dados para criar sua conta de administrador.
							</CardDescription>
						</CardHeader>
						<CardContent>
							<form onSubmit={handleSubmit} className="space-y-4">
								<div className="space-y-2">
									<Label htmlFor="barbershopName">Nome da Barbearia</Label>
									<div className="relative">
										<Scissors className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
										<Input
											id="barbershopName"
											type="text"
											placeholder="Nome da sua barbearia"
											className="pl-10"
											value={formData.barbershopName}
											onChange={(e) =>
												handleInputChange("barbershopName", e.target.value)
											}
											required
										/>
									</div>
								</div>

								<div className="space-y-2">
									<Label htmlFor="name">Seu nome completo</Label>
									<div className="relative">
										<User className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
										<Input
											id="name"
											type="text"
											placeholder="Seu nome como administrador"
											className="pl-10"
											value={formData.name}
											onChange={(e) => handleInputChange("name", e.target.value)}
											required
										/>
									</div>
								</div>

								<div className="space-y-2">
									<Label htmlFor="email">Seu melhor e-mail</Label>
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
											value={phone}
											onChange={handlePhoneChange}
											required
										/>
									</div>
								</div>

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

								<Button
									type="submit"
									variant="premium"
									className="w-full"
									disabled={isLoading}
								>
									{isLoading ? "Criando conta..." : "Criar conta"}
								</Button>
							</form>

							<div className="mt-6">
								<Separator className="my-4" />

								<div className="text-center">
									<span className="text-sm text-muted-foreground">
										Já tem uma conta?{" "}
										<Link
											to="/login"
											className="text-primary hover:underline font-medium"
										>
											Fazer login
										</Link>
									</span>
								</div>
							</div>
						</CardContent>
					</Card>

					{/* Footer */}
					<div className="text-center text-sm text-muted-foreground">
						<p>Acesso seguro protegido por criptografia SSL</p>
					</div>
				</div>
			</div>

			{/* Right Side - Visual */}
			<div className="hidden lg:flex flex-1 bg-gradient-bg items-center justify-center p-8">
				<div className="max-w-md text-center space-y-6">
					<img src="/icon-agendem.svg" alt="agendem" className="w-20 h-20 mx-auto mb-8" />

					<h2 className="text-3xl font-bold">
						Transforme sua barbearia com
						<span className="bg-gradient-primary bg-clip-text text-transparent">
							{" "}
							tecnologia
						</span>
					</h2>

					<p className="text-lg text-muted-foreground">
						Junte-se a centenas de barbeiros que já utilizam nossa plataforma
						para gerenciar seus negócios de forma inteligente.
					</p>

					<div className="space-y-4 pt-4">
						{[
							"Setup rápido em menos de 5 minutos",
							"Interface intuitiva e fácil de usar",
							"Suporte técnico especializado",
							"Atualizações automáticas gratuitas",
						].map((feature, index) => (
							<div key={index} className="flex items-center gap-3 text-left">
								<div className="w-6 h-6 bg-primary/20 rounded-full flex items-center justify-center">
									<div className="w-2 h-2 bg-primary rounded-full"></div>
								</div>
								<span className="text-foreground">{feature}</span>
							</div>
						))}
					</div>
				</div>
			</div>
		</div>
	);
}