import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Copy, Check, Link, Share2, RefreshCw } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { DashboardLayout } from "@/layouts/DashboardLayout";

export default function ShareProfile() {
	const { user } = useAuth();
	const { toast } = useToast();
	const [profileLink, setProfileLink] = useState("");
	const [loading, setLoading] = useState(true);
	const [copied, setCopied] = useState(false);

	useEffect(() => {
		const fetchBarbershopSlug = async () => {
			if (!user) return;

			try {
				setLoading(true);
				// Primeiro buscar o barbearia_id do profile
				const { data: profileData, error: profileError } = await supabase
					.from("profiles")
					.select("barbearia_id")
					.eq("user_id", user.id)
					.single();

				if (profileError) {
					throw profileError;
				}

				if (!profileData?.barbearia_id) {
					throw new Error("Barbearia não encontrada no seu perfil");
				}

				// Depois buscar o slug da barbearia
				const { data, error } = await supabase
					.from("barbearias")
					.select("slug")
					.eq("id", profileData.barbearia_id)
					.maybeSingle();

				if (error) {
					throw error;
				}

				if (data && data.slug) {
					setProfileLink(`https://www.agendem.com/barbearia/${data.slug}`);
				} else {
					toast({
						title: "Perfil não encontrado",
						description: "Você não possui uma barbearia vinculada ao seu perfil. Entre em contato com o administrador.",
						variant: "destructive",
					});
				}
			} catch (error: unknown) {
				console.error("Erro ao buscar slug da barbearia:", error);

				let errorMessage = "Não foi possível gerar seu link de perfil. Tente novamente mais tarde.";

				if (error instanceof Error) {
					// Tratar erros específicos do Supabase
					if (error.message.includes("JSON object requested, multiple (or no) rows returned")) {
						errorMessage = "Múltiplas barbearias encontradas para seu perfil. Entre em contato com o suporte.";
					} else if (error.message.includes("syntax error") || error.message.includes("column")) {
						errorMessage = "Erro de configuração do sistema. Entre em contato com o suporte técnico.";
					} else if (error.message.includes("permission") || error.message.includes("policy")) {
						errorMessage = "Você não tem permissão para acessar essas informações.";
					} else {
						errorMessage = error.message;
					}
				}

				toast({
					title: "Erro ao buscar link",
					description: errorMessage,
					variant: "destructive",
				});
			} finally {
				setLoading(false);
			}
		};

		fetchBarbershopSlug();
	}, [user, toast]);

	const handleCopy = () => {
		navigator.clipboard.writeText(profileLink);
		setCopied(true);
		toast({
			title: "Link copiado!",
			description: "Você já pode compartilhar o perfil da sua barbearia.",
		});
		setTimeout(() => setCopied(false), 2000);
	};

	const handleShare = async () => {
		if (navigator.share) {
			try {
				await navigator.share({
					title: "Conheça nossa Barbearia",
					text: "Confira nossos serviços e agende seu horário!",
					url: profileLink,
				});
				toast({
					title: "Compartilhado com sucesso!",
				});
			} catch (error) {
				toast({
					title: "Erro ao compartilhar",
					description: "Não foi possível compartilhar o link.",
					variant: "destructive",
				});
			}
		} else {
			handleCopy(); // Fallback for browsers that don't support Web Share API
		}
	};

	if (loading) {
		return (
			<DashboardLayout>
				<div className="flex items-center justify-center min-h-96">
					<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
				</div>
			</DashboardLayout>
		);
	}

	return (
		<DashboardLayout>
			<div className="p-6 space-y-6">
				<div>
					<h1 className="text-3xl font-bold">Compartilhar Perfil</h1>
					<p className="text-muted-foreground">
						Compartilhe este link com seus clientes para que eles visitem a
						página da sua barbearia.
					</p>
				</div>

				<Card className="max-w-2xl border-border/50 bg-card/50 backdrop-blur-sm">
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<Link className="w-5 h-5" />
							Link do seu Perfil
						</CardTitle>
					</CardHeader>
					<CardContent className="space-y-4">
						<p className="text-sm text-muted-foreground">
							Este é o link direto para a página da sua barbearia. Seus
							clientes podem usá-lo para ver seus serviços e agendar um
							horário.
						</p>

						{profileLink ? (
							<>
								<div className="flex items-center gap-2">
									<Input value={profileLink} readOnly className="flex-1" />
									<Button variant="outline" size="icon" onClick={handleCopy}>
										{copied ? (
											<Check className="w-4 h-4 text-green-500" />
										) : (
											<Copy className="w-4 h-4" />
										)}
									</Button>
								</div>
								<Button className="w-full" onClick={handleShare}>
									<Share2 className="w-4 h-4 mr-2" />
									Compartilhar Link
								</Button>
							</>
						) : (
							<div className="text-center py-8">
								<div className="text-muted-foreground mb-4">
									<Link className="w-12 h-12 mx-auto mb-2 opacity-50" />
									<p className="text-sm">
										Link não disponível
									</p>
									<p className="text-xs mt-1">
										Verifique se sua barbearia está configurada corretamente
									</p>
								</div>
								<Button variant="outline" onClick={() => window.location.reload()}>
									<RefreshCw className="w-4 h-4 mr-2" />
									Tentar Novamente
								</Button>
							</div>
						)}
					</CardContent>
				</Card>
			</div>
		</DashboardLayout>
	);
}