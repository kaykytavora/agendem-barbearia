import { Button } from "@/components/ui/button";
import { User, LogIn } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";

const UserTypeSelection = () => {
	const navigate = useNavigate();
	const { user, loading: authLoading } = useAuth();
	const { role, loading: roleLoading } = useUserRole();
	const [isDialogOpen, setIsDialogOpen] = useState(false);

	useEffect(() => {
		if (!authLoading && !roleLoading && user) {
			if (role === "cliente") {
				navigate("/client-panel");
			} else if (role === "admin" || role === "funcionario") {
				navigate("/dashboard");
			}
		}
	}, [user, role, authLoading, roleLoading, navigate]);

	if (authLoading || roleLoading) {
		return (
			<div className="min-h-screen w-full bg-gradient-to-br from-background to-blue-950/20 flex items-center justify-center">
				<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
			</div>
		);
	}

	return (
		<div className="min-h-screen w-full bg-gradient-to-br from-background to-blue-950/20 flex flex-col items-center justify-between p-4 relative overflow-hidden">
			{/* Floating Shapes */}
			<div className="absolute top-20 left-20 w-48 h-48 bg-primary/10 rounded-full filter blur-3xl animate-blob"></div>
			<div className="absolute bottom-20 right-20 w-48 h-48 bg-secondary/10 rounded-full filter blur-3xl animate-blob animation-delay-4000"></div>

			{/* Theme Toggle */}
			<div className="absolute top-6 right-6 z-50">
				<ThemeToggle />
			</div>

			<main className="z-10 flex flex-col items-center text-center mt-20 sm:mt-0">
				{/* Header */}
				<div className="mb-12">
					<div className="flex items-center justify-center gap-2 mb-4">
						<img src="/icon-agendem.svg" alt="agendem" className="w-10 h-10" />
						<span className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">
							agendem
						</span>
					</div>
					<h1 className="text-5xl font-bold tracking-tight mb-3">
						Bem-vindo à sua barbearia digital
					</h1>
					<p className="text-xl text-muted-foreground max-w-2xl">
						Agende um horário ou gerencie seu negócio com facilidade.
					</p>
				</div>

				{/* Selection Card - Main Client Action */}
				<div className="w-full max-w-md">
				<div 
						onClick={() => setIsDialogOpen(true)}
						className="bg-card/50 border border-border/20 rounded-xl p-8 flex flex-col items-center text-center backdrop-blur-sm transition-all duration-300 hover:border-primary/50 hover:shadow-brand-md cursor-pointer group"
					>
						<div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mb-6 ring-8 ring-primary/5 transition-all group-hover:scale-105">
							<User className="w-10 h-10 text-primary" />
						</div>
						<h2 className="text-2xl font-semibold mb-2">Sou Cliente</h2>
						<p className="text-muted-foreground mb-6">
							Encontre as melhores barbearias e agende seu próximo corte com
							apenas alguns cliques.
						</p>
						<Button className="w-full mt-auto" variant="premium">
							Encontrar Barbearias
						</Button>
					</div>

					<Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
						<DialogContent>
							<DialogHeader>
								<DialogTitle>Como deseja continuar?</DialogTitle>
								<DialogDescription>
									Faça login para salvar suas barbearias favoritas e ver seu histórico. Você também pode continuar sem uma conta.
								</DialogDescription>
							</DialogHeader>
							<DialogFooter className="flex flex-col-reverse sm:flex-row gap-2">
								<Button variant="outline" onClick={() => navigate("/barbearias")}>
									Continuar sem conta
								</Button>
								<Button onClick={() => navigate("/client-login")}>
									Fazer Login ou Criar Conta
								</Button>
							</DialogFooter>
						</DialogContent>
					</Dialog>
				</div>

				{/* Professional Login Section */}
				<div className="mt-12 text-center">
					<p className="text-muted-foreground">
						É um profissional ou dono de barbearia?
					</p>
					<Button
						variant="ghost"
						className="mt-2"
						onClick={() => navigate("/login")}
					>
						<LogIn className="mr-2 h-4 w-4" />
						Acesse o painel
					</Button>
					<span className="text-muted-foreground mx-2">ou</span>
					<Button
						variant="outline"
						className="mt-2"
						onClick={() => navigate("/register-barbershop")}
					>
						Crie sua conta
					</Button>
				</div>
			</main>

			<footer className="text-sm text-muted-foreground/50 pb-6">
				<p>&copy; {new Date().getFullYear()} agendem. Todos os direitos reservados.</p>
			</footer>
		</div>
	);
};

export default UserTypeSelection;