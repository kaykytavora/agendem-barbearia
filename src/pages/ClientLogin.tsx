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
import { Eye, EyeOff, Lock, Mail, ArrowLeft, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

export default function ClientLogin() {
	const [showPassword, setShowPassword] = useState(false);
	const [isLoading, setIsLoading] = useState(false);
	const [formData, setFormData] = useState({ email: "", password: "" });

	const { signIn, user, role, loading: authLoading } = useAuth();
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
				description:
					"Credenciais inválidas. Verifique seu e-mail e senha.",
				variant: "destructive",
			});
		} else {
			toast({
				title: "Login bem-sucedido!",
				description: "Bem-vindo(a) de volta!",
				variant: "default",
			});
			// O useEffect cuidará do redirecionamento
		}

		setIsLoading(false);
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
		<div className="min-h-screen w-full bg-gradient-to-br from-background to-blue-950/20 flex flex-col items-center justify-center p-4 relative">
			<main className="z-10 flex flex-col items-center text-center w-full max-w-md">
				<Link
					to="/"
					className="absolute top-6 left-6 inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
				>
					<ArrowLeft className="w-4 h-4" />
					Voltar ao início
				</Link>

				<div className="flex items-center justify-center gap-2 mb-6">
					<img src="/icon-agendem.svg" alt="agendem" className="w-12 h-12" />
					<span className="text-2xl font-bold bg-gradient-primary bg-clip-text text-transparent">
						agendem Cliente
					</span>
				</div>

				<h1 className="text-3xl font-bold mb-2">Acesse sua conta</h1>
				<p className="text-muted-foreground mb-8">
					Veja seus agendamentos e barbearias favoritas.
				</p>

				<Card className="w-full border-border/50 shadow-brand-lg">
					<CardHeader>
						<CardTitle className="text-2xl">Login do Cliente</CardTitle>
						<CardDescription>
							Use seu e-mail e senha para entrar.
						</CardDescription>
					</CardHeader>
					<CardContent>
						<form onSubmit={handleSubmit} className="space-y-4">
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
							</div>

							<div className="flex items-center justify-end">
								<Link
									to="/reset-password"
									className="text-sm text-primary hover:underline"
								>
									Esqueceu a senha?
								</Link>
							</div>

							<Button
								type="submit"
								variant="premium"
								className="w-full"
								disabled={isLoading}
							>
								{isLoading ? "Entrando..." : "Entrar"}
							</Button>
						</form>

						<div className="mt-6 text-center">
							<span className="text-sm text-muted-foreground">
								Não tem uma conta?{" "}
								<Link
									to="/register"
									className="text-primary hover:underline font-medium"
								>
									Crie uma agora
								</Link>
							</span>
						</div>
					</CardContent>
				</Card>
			</main>
		</div>
	);
}