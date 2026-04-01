import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Shield } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

export default function ResetPassword() {
  const [isLoading, setIsLoading] = useState(false);
  const location = useLocation();
  const [formData, setFormData] = useState({
    email: location.state?.email || "",
    code: "",
    password: "",
    confirmPassword: ""
  });

  const { verifyCodeAndUpdatePassword } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.password !== formData.confirmPassword) {
      toast({
        title: "Erro",
        description: "As senhas não coincidem.",
        variant: "destructive"
      });
      return;
    }

    if (formData.password.length < 6) {
      toast({
        title: "Erro",
        description: "A senha deve ter pelo menos 6 caracteres.",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);

    const { error } = await verifyCodeAndUpdatePassword(formData.email, formData.code, formData.password);

    if (error) {
      toast({
        title: "Erro",
        description: error.message || "Código inválido ou expirado.",
        variant: "destructive"
      });
    } else {
      toast({
        title: "Sucesso!",
        description: "Senha redefinida com sucesso. Faça login com sua nova senha.",
        variant: "default"
      });
      navigate("/login");
    }

    setIsLoading(false);
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Side - Form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-background">
        <div className="w-full max-w-md space-y-8">
          {/* Header */}
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

            <h1 className="text-3xl font-bold mb-2">
              Redefinir senha
            </h1>
            <p className="text-muted-foreground">
              Digite seu e-mail, o código enviado e sua nova senha
            </p>
          </div>

          {/* Form */}
          <Card className="border-border/50 shadow-brand-lg">
            <CardHeader className="space-y-1">
              <CardTitle className="text-2xl flex items-center gap-2">
                <Shield className="w-5 h-5" />
                Redefinir senha
              </CardTitle>
              <CardDescription>
                O código é válido por 15 minutos
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">E-mail</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="seu@email.com"
                    value={formData.email}
                    onChange={(e) => handleInputChange("email", e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="code">Código de verificação</Label>
                  <Input
                    id="code"
                    type="text"
                    placeholder="000000"
                    maxLength={6}
                    value={formData.code}
                    onChange={(e) => handleInputChange("code", e.target.value.replace(/\D/g, ''))}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Nova senha</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={formData.password}
                    onChange={(e) => handleInputChange("password", e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirmar senha</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="••••••••"
                    value={formData.confirmPassword}
                    onChange={(e) => handleInputChange("confirmPassword", e.target.value)}
                    required
                  />
                </div>

                <div className="flex gap-2">
                  <Button
                    type="submit"
                    variant="premium"
                    className="w-full"
                    disabled={isLoading}
                  >
                    {isLoading ? "Redefinindo..." : "Redefinir senha"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Footer */}
          <div className="text-center text-sm text-muted-foreground">
            <p>Não recebeu o código? Verifique sua caixa de spam ou <Link to="/forgot-password" replace className="text-primary hover:underline">solicite um novo</Link>.</p>
          </div>
        </div>
      </div>

      {/* Right Side - Visual */}
      <div className="hidden lg:flex flex-1 bg-gradient-bg items-center justify-center p-8">
        <div className="max-w-md text-center space-y-6">
          <div className="w-20 h-20 bg-gradient-primary rounded-2xl mx-auto flex items-center justify-center mb-8">
            <Shield className="w-10 h-10 text-white" />
          </div>

          <h2 className="text-3xl font-bold">
            Segurança em
            <span className="bg-gradient-primary bg-clip-text text-transparent"> primeiro lugar</span>
          </h2>

          <p className="text-lg text-muted-foreground">
            Utilizamos códigos temporários para garantir a segurança da sua conta.
            Seus dados estão sempre protegidos.
          </p>

          <div className="space-y-4 pt-4">
            {[
              "Código de segurança por e-mail",
              "Criptografia de ponta a ponta",
              "Sessões seguras autenticadas",
              "Monitoramento de atividades"
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