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
import { useState, useEffect, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { mensagemErroLogin } from "@/lib/auth-errors";
import { erroRetornoGoogle, googleDisponivel, mensagemLoginEquipe, sessaoSocial } from "@/lib/login-google";
import { supabase } from "@/integrations/supabase/client";

export default function ClientLogin() {
	const [showPassword, setShowPassword] = useState(false);
	const [isLoading, setIsLoading] = useState(false);
	const [entrandoComGoogle, setEntrandoComGoogle] = useState(false);
	const [erroGoogle, setErroGoogle] = useState<string | null>(null);
	const [formData, setFormData] = useState({ email: "", password: "" });

	const { signIn, user, session, role, loading: authLoading } = useAuth();
	const navigate = useNavigate();
	const { search, hash, state } = useLocation();
	const destino = typeof state?.voltarAoAgendamento === "string" &&
		/^\/acompanhar-agendamento\/[0-9a-f-]{36}#[0-9a-f]{128}$/i.test(state.voltarAoAgendamento)
		? state.voltarAoAgendamento
		: "/client-panel";
	const { toast } = useToast();
	const bloqueioEmAndamento = useRef(false);
	const bloqueadoPorGoogle = (role === "admin" || role === "funcionario") && sessaoSocial(session);
	const mensagemGoogle = erroGoogle ?? erroRetornoGoogle(search, hash);
	const { data: mostrarGoogle } = useQuery({
		queryKey: ["login-google-disponivel"],
		queryFn: ({ signal }) => googleDisponivel(signal),
		staleTime: 60_000,
		retry: false,
		enabled: !user,
	});

	// Redireciona baseado na role do usuário
	useEffect(() => {
		if (!authLoading && user && role) {
			if (bloqueadoPorGoogle) {
				setErroGoogle(mensagemLoginEquipe);
				if (!bloqueioEmAndamento.current) {
					bloqueioEmAndamento.current = true;
					void supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
				}
				return;
			}
			if (role === 'cliente') {
				navigate(destino, { replace: true });
			} else if (role === 'funcionario' || role === 'admin') {
				navigate("/dashboard");
			}
		}
	}, [user, authLoading, role, navigate, destino, bloqueadoPorGoogle]);

	async function entrarComGoogle() {
		if (isLoading || entrandoComGoogle) return;
		setEntrandoComGoogle(true);
		setErroGoogle(null);

		try {
			const { error } = await supabase.auth.signInWithOAuth({
				provider: "google",
				options: {
					redirectTo: new URL("/client-login", window.location.origin).href,
					queryParams: { prompt: "select_account" },
				},
			});
			if (!error) return;
		} catch {
			// O erro também pode ocorrer antes do redirecionamento.
		}
		setErroGoogle("Não foi possível abrir o login com Google. Tente novamente.");
		setEntrandoComGoogle(false);
	}

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (isLoading || entrandoComGoogle) return;
		setIsLoading(true);

		const { error } = await signIn(formData.email, formData.password);

		if (error) {
			toast({
				title: "Erro no login",
				description: mensagemErroLogin(error),
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
		<div className="min-h-screen w-full bg-background flex flex-col items-center justify-center p-4 relative">
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
								{mostrarGoogle ? "Entre com Google ou use seu e-mail e senha." : "Use seu e-mail e senha para entrar."}
						</CardDescription>
					</CardHeader>
					<CardContent>
						{mensagemGoogle && (
							<p role="alert" className="mb-4 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
								{mensagemGoogle}
								{mensagemGoogle === mensagemLoginEquipe && (
									<Link to="/login" className="ml-1 font-medium underline">Login da barbearia</Link>
								)}
							</p>
						)}
						{mostrarGoogle && (
							<div className="mb-5 space-y-4">
								<Button
									type="button"
									variant="outline"
									className="w-full border-[#747775] bg-white text-[#1f1f1f] hover:bg-[#f2f2f2] hover:text-[#1f1f1f]"
									onClick={() => void entrarComGoogle()}
									disabled={isLoading || entrandoComGoogle}
								>
									{entrandoComGoogle ? <Loader2 className="h-4 w-4 animate-spin" /> : (
										<img src="/google-login.png" alt="" width={18} height={18} className="shrink-0" />
									)}
									{entrandoComGoogle ? "Abrindo Google..." : "Continuar com Google"}
								</Button>
								<div className="flex items-center gap-3 text-xs text-muted-foreground">
									<span className="h-px flex-1 bg-border" aria-hidden="true" /> ou com e-mail <span className="h-px flex-1 bg-border" aria-hidden="true" />
								</div>
							</div>
						)}
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
								disabled={isLoading || entrandoComGoogle}
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
