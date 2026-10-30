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
import { Eye, EyeOff, Lock, Mail, ArrowLeft, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { mensagemErroLogin } from "@/lib/auth-errors";
import { useResponsive, useResponsiveClasses } from "@/hooks/use-mobile";

export default function Login() {
	const [showPassword, setShowPassword] = useState(false);
	const [isLoading, setIsLoading] = useState(false);
	const [formData, setFormData] = useState({
		email: "",
		password: "",
	});

	const { signIn, user, role, loading: authLoading } = useAuth(); // Pega o estado de loading
	const { isMobile } = useResponsive();
	const responsive = useResponsiveClasses();
	const navigate = useNavigate();
	const { toast } = useToast();

	// Redireciona baseado na role do usuário
	useEffect(() => {
		if (!authLoading && user && role) {
			if (role === 'cliente') {
				navigate("/client-panel");
			} else if (role === 'funcionario' || role === 'admin') {
				navigate("/dashboard");
			}
		}
	}, [user, authLoading, role, navigate]);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setIsLoading(true);

		const { error } = await signIn(formData.email, formData.password);

		if (error) {
			toast({
				title: "Erro no login",
				description: mensagemErroLogin(error),
				variant: "destructive"
			});
		} else {
			toast({
				title: "Login realizado!",
				description: "Bem-vindo de volta",
				variant: "default"
			});
			// O useEffect cuidará do redirecionamento
		}

		setIsLoading(false);
	};

	const handleInputChange = (field: string, value: string) => {
		setFormData(prev => ({ ...prev, [field]: value }));
	};

	// Enquanto o AuthContext estiver carregando, exibe uma tela de espera
	if (authLoading) {
		return (
			<div className="min-h-screen flex items-center justify-center">
				<Loader2 className="w-8 h-8 animate-spin" />
			</div>
		);
	}

	return (
		<div className={`min-h-screen ${isMobile ? 'flex flex-col' : 'flex'}`}>
			{/* Left Side - Form */}
			<div className={`${isMobile ? 'flex-1' : 'flex-1'} flex items-center justify-center ${responsive.containerPadding} bg-background`}>
				<div className={`w-full ${isMobile ? 'max-w-sm' : 'max-w-md'} space-y-8`}>
					{/* Header */}
					<div className="text-center">
						<Link to="/" className={`inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-8 touch-target ${isMobile ? 'text-sm' : ''}`}>
							<ArrowLeft className={`${isMobile ? 'w-3 h-3' : 'w-4 h-4'}`} />
							Voltar ao início
						</Link>

						<div className="flex items-center justify-center gap-2 mb-6">
							<img src="/icon-agendem.svg" alt="agendem" className={`${isMobile ? 'w-8 h-8' : 'w-12 h-12'}`} />
							<span className={`${isMobile ? 'text-lg' : 'text-2xl'} font-bold bg-gradient-primary bg-clip-text text-transparent`}>
								agendem para Barbearias
							</span>
						</div>

						<h1 className={`${isMobile ? 'text-2xl' : 'text-3xl'} font-bold mb-2`}>Acesse seu Painel</h1>
						<p className={`text-muted-foreground ${isMobile ? 'text-sm' : ''}`}>
							Faça login para acessar seu painel administrativo
						</p>
					</div>

					{/* Form */}
					<Card>
						<CardHeader className={`space-y-1 ${isMobile ? 'pb-4' : ''}`}>
							<CardTitle className={`${isMobile ? 'text-xl' : 'text-2xl'}`}>Login</CardTitle>
							<CardDescription className={isMobile ? 'text-sm' : ''}>
								Insira seu e-mail e senha para continuar
							</CardDescription>
						</CardHeader>
						<CardContent className={isMobile ? 'px-4 pb-4' : ''}>
							<form onSubmit={handleSubmit} className="space-y-4">
								<div className="space-y-2">
									<Label htmlFor="email" className={isMobile ? 'text-sm' : ''}>E-mail</Label>
									<div className="relative">
										<Mail className={`absolute left-3 top-3 ${isMobile ? 'w-5 h-5' : 'w-4 h-4'} text-muted-foreground`} />
										<Input
											id="email"
											type="email"
											placeholder="seu@email.com"
											className={`${isMobile ? 'pl-12 h-12 text-base' : 'pl-10'} touch-target`}
											value={formData.email}
											onChange={(e) => handleInputChange("email", e.target.value)}
											autoComplete="email"
											required
										/>
									</div>
								</div>

								<div className="space-y-2">
									<Label htmlFor="password" className={isMobile ? 'text-sm' : ''}>Senha</Label>
									<div className="relative">
										<Lock className={`absolute left-3 top-3 ${isMobile ? 'w-5 h-5' : 'w-4 h-4'} text-muted-foreground`} />
										<Input
											id="password"
											type={showPassword ? "text" : "password"}
											placeholder="••••••••"
											className={`${isMobile ? 'pl-12 pr-12 h-12 text-base' : 'pl-10 pr-10'} touch-target`}
											value={formData.password}
											onChange={(e) =>
												handleInputChange("password", e.target.value)
											}
											autoComplete="current-password"
											required
										/>
										<Button
											type="button"
											variant="ghost"
											size="icon"
											className={`absolute right-1 top-1 ${isMobile ? 'h-10 w-10' : 'h-8 w-8'} touch-target`}
											onClick={() => setShowPassword(!showPassword)}
										>
											{showPassword ? (
												<EyeOff className={`${isMobile ? 'w-5 h-5' : 'w-4 h-4'}`} />
											) : (
												<Eye className={`${isMobile ? 'w-5 h-5' : 'w-4 h-4'}`} />
											)}
										</Button>
									</div>
								</div>

								<div className="flex items-center justify-between">
									<div className="flex items-center space-x-2">
										<input
											type="checkbox"
											id="remember"
											className="rounded border-border"
										/>
										<Label htmlFor="remember" className="text-sm">Lembrar de mim</Label>
									</div>
									<Link to="/forgot-password" className="text-sm text-primary hover:underline">
										Esqueceu a senha?
									</Link>
								</div>

								<Button
									type="submit"
									variant="premium"
									className={`w-full ${isMobile ? 'h-12 text-base' : ''} touch-target`}
									disabled={isLoading}
								>
									{isLoading ? (
										<>
											<Loader2 className={`mr-2 ${isMobile ? 'h-5 w-5' : 'h-4 w-4'} animate-spin`} />
											Entrando...
										</>
									) : (
										"Entrar"
									)}
								</Button>
							</form>

							<Separator className="my-6" />

							<div className={`text-center ${isMobile ? 'pt-2' : ''}`}>
								<span className={`${isMobile ? 'text-xs' : 'text-sm'} text-muted-foreground`}>
									Não tem uma conta?{" "}
									<Link
										to="/register-barbershop"
										className="text-primary hover:underline font-medium touch-target"
									>
										Cadastre-se
									</Link>
								</span>
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
			{!isMobile && (
				<div className="hidden lg:flex flex-1 bg-gradient-bg items-center justify-center p-8">
					<div className="max-w-md text-center space-y-6">
						<img src="/icon-agendem.svg" alt="agendem" className="w-20 h-20 mx-auto mb-8" />

						<h2 className="text-3xl font-bold">
							A plataforma completa para sua barbearia
						</h2>
						<p className="text-muted-foreground">
							Gerencie agendamentos, clientes e fidelidade em um só lugar.
						</p>
					</div>
				</div>
			)}
		</div>
	);
}