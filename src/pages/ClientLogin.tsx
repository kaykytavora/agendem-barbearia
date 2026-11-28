import { Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { LoginForm } from "@/components/auth/LoginForm";
import { LoginLayout } from "@/components/auth/LoginLayout";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/contexts/AuthContext";
import { erroRetornoGoogle, googleDisponivel, mensagemLoginEquipe, sessaoSocial } from "@/lib/login-google";
import { supabase } from "@/integrations/supabase/client";

export default function ClientLogin() {
	const [entrandoComGoogle, setEntrandoComGoogle] = useState(false);
	const [erroGoogle, setErroGoogle] = useState<string | null>(null);

	const { user, session, role, loading: authLoading } = useAuth();
	const navigate = useNavigate();
	const { search, hash, state } = useLocation();
	const destino = typeof state?.voltarAoAgendamento === "string" &&
		/^\/acompanhar-agendamento\/[0-9a-f-]{36}#[0-9a-f]{128}$/i.test(state.voltarAoAgendamento)
		? state.voltarAoAgendamento
		: "/client-panel";
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
		if (entrandoComGoogle) return;
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

	return (
		<LoginLayout acesso="cliente">
			{mensagemGoogle && (
				<p role="alert" className="rounded-lg border border-destructive/25 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
					{mensagemGoogle}
					{mensagemGoogle === mensagemLoginEquipe && (
						<Link to="/login" className="ml-1 font-medium underline">Login da barbearia</Link>
					)}
				</p>
			)}
			<LoginForm
				disabled={authLoading || entrandoComGoogle}
				alternativa={mostrarGoogle ? (enviando) => (
					<div className="space-y-2">
						<div className="flex items-center gap-3">
							<Separator className="flex-1" />
							<span className="text-xs text-muted-foreground">ou</span>
							<Separator className="flex-1" />
						</div>
						<Button
							type="button"
							variant="outline"
							className="h-11 w-full rounded-lg border-[#747775] bg-white text-[#1f1f1f] hover:bg-[#f2f2f2] hover:text-[#1f1f1f]"
							onClick={() => void entrarComGoogle()}
							disabled={authLoading || enviando || entrandoComGoogle}
						>
							{entrandoComGoogle
								? <Loader2 aria-hidden="true" className="animate-spin" />
								: <img src="/google-login.png" alt="" width={18} height={18} className="shrink-0" />
							}
							{entrandoComGoogle ? "Abrindo Google..." : "Continuar com Google"}
						</Button>
					</div>
				) : undefined}
			/>
		</LoginLayout>
	);
}
