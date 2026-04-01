import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Mail, ArrowLeft } from "lucide-react";
import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const navigate = useNavigate();

  const { resetPassword } = useAuth();
  const { toast } = useToast();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setShowConfirmation(true);
  };

  const handleConfirmedSubmit = async () => {
    setShowConfirmation(false);
    setIsLoading(true);

    const { error } = await resetPassword(email);

    if (error) {
      toast({
        title: "Erro",
        description: error.message === "User not found"
          ? "E-mail não encontrado em nossa base de dados"
          : "Erro ao enviar e-mail de recuperação. Tente novamente.",
        variant: "destructive"
      });
    } else {
      toast({
        title: "E-mail enviado!",
        description: "Verifique sua caixa de entrada para obter o código de recuperação.",
        variant: "default"
      });
      // Redirect to reset password page with email state
      navigate("/reset-password", { state: { email } });
    }

    setIsLoading(false);
  };



  return (
    <div className="min-h-screen flex items-center justify-center p-8 bg-background">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <Link to="/login" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-8">
            <ArrowLeft className="w-4 h-4" />
            Voltar ao login
          </Link>

          <div className="flex items-center justify-center gap-2 mb-6">
            <img src="/icon-agendem.svg" alt="agendem" className="w-12 h-12" />
            <span className="text-2xl font-bold bg-gradient-primary bg-clip-text text-transparent">
              agendem
            </span>
          </div>

          <h1 className="text-3xl font-bold mb-2">Esqueci a senha</h1>
          <p className="text-muted-foreground">
            Digite seu e-mail para receber as instruções de recuperação
          </p>
        </div>

        <Card className="border-border/50 shadow-brand-lg">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl">Recuperar senha</CardTitle>
            <CardDescription>
              Enviaremos um código de 6 dígitos para o seu e-mail de recuperação
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
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
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
                {isLoading ? "Enviando..." : "Enviar instruções"}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <span className="text-sm text-muted-foreground">
                Lembrou da senha?{" "}
                <Link to="/login" className="text-primary hover:underline font-medium">
                  Fazer login
                </Link>
              </span>
            </div>
          </CardContent>
        </Card>

        <div className="text-center text-sm text-muted-foreground">
          <p>Acesso seguro protegido por criptografia SSL</p>
        </div>
      </div>

      <AlertDialog open={showConfirmation} onOpenChange={setShowConfirmation}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirme seu e-mail</AlertDialogTitle>
            <AlertDialogDescription>
              O código de recuperação será enviado para:
              <br />
              <span className="font-semibold text-foreground mt-2 block">{email}</span>
              <br />
              O e-mail está correto?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmedSubmit}>
              Sim, enviar código
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}