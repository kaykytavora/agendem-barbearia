import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Eye, EyeOff, Lock, User, CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

interface InviteData {
  id: string;
  email: string;
  barbearia_id: string;
  funcionario_data: any; // Using any to avoid JSON type conflicts
  usado: boolean;
  expires_at: string;
}

export default function AcceptInvite() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { signUp } = useAuth();
  
  const [inviteData, setInviteData] = useState<InviteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [formData, setFormData] = useState({
    password: "",
    confirmPassword: ""
  });

  const token = searchParams.get("token");

  useEffect(() => {
    if (token) {
      loadInviteData();
    } else {
      toast({
        title: "Token inválido",
        description: "Link de convite inválido ou expirado",
        variant: "destructive"
      });
      navigate("/");
    }
  }, [token]);

  const loadInviteData = async () => {
    if (!token) {
      toast({
        title: "Token inválido",
        description: "O link de convite é inválido ou não foi fornecido.",
        variant: "destructive"
      });
      navigate("/");
      return;
    }

    console.log("Loading invite data for token:", token);

    try {
      // Primeiro, vamos buscar todos os convites para debug
      const { data: allInvites, error: debugError } = await supabase
        .from('funcionario_convites')
        .select('id, email, token, usado, expires_at')
        .order('created_at', { ascending: false })
        .limit(10);

      console.log("Recent invites (debug):", allInvites);
      console.log("Debug query error:", debugError);

      const { data, error } = await supabase
        .from('funcionario_convites')
        .select('*')
        .eq('token', token)
        .eq('usado', false)
        .single();

      console.log("Invite query result:", { data, error });

      if (error || !data) {
        console.error("Query error details:", error);
        throw new Error("Convite não encontrado ou já utilizado");
      }

      // Verificar se não expirou
      if (data.expires_at && new Date(data.expires_at) < new Date()) {
        console.log("Invite expired:", data.expires_at, "vs", new Date().toISOString());
        throw new Error("Convite expirado");
      }

      console.log("Invite data loaded successfully:", data);
      setInviteData(data as InviteData);
    } catch (error: any) {
      console.error("Erro ao carregar convite:", error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao carregar dados do convite",
        variant: "destructive"
      });
      navigate("/");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!inviteData) return;

    if (formData.password !== formData.confirmPassword) {
      toast({
        title: "Erro",
        description: "As senhas não coincidem",
        variant: "destructive"
      });
      return;
    }

    if (formData.password.length < 6) {
      toast({
        title: "Erro",
        description: "A senha deve ter pelo menos 6 caracteres",
        variant: "destructive"
      });
      return;
    }

    setProcessing(true);

    try {
      // Validar dados antes de tentar criar conta
      if (!inviteData.funcionario_data?.nome) {
        throw new Error("Dados do funcionário incompletos: nome não encontrado");
      }

      if (!inviteData.email || !formData.password) {
        throw new Error("Email ou senha não fornecidos");
      }

      console.log("Criando conta de autenticação via signUp...");

      // MÉTODO CORRETO: Criar conta de usuário via signUp
      // O trigger handle_new_user criará automaticamente o perfil e registro de funcionário
      const { error: signUpError } = await signUp(
        inviteData.email,
        formData.password,
        {
          data: {
            name: inviteData.funcionario_data.nome.trim(),
            role: "funcionario"
          }
        }
      );

      if (signUpError) {
        console.error("SignUp error:", signUpError);
        throw new Error(signUpError.message || "Erro ao criar conta");
      }

      console.log("Conta criada com sucesso");

      // Marcar convite como usado
      if (token) {
        const { error: updateError } = await supabase
          .from('funcionario_convites')
          .update({ usado: true })
          .eq('token', token);

        if (updateError) {
          console.warn("Erro ao marcar convite como usado:", updateError);
          // Não bloqueia o fluxo, apenas avisa
        }
      }

      toast({
        title: "Sucesso!",
        description: "Conta criada com sucesso! Você já pode fazer login.",
        variant: "default",
        duration: 5000
      });

      // Aguardar um momento para o trigger processar
      setTimeout(() => {
        navigate("/login");
      }, 1000);

    } catch (error: any) {
      console.error("Erro ao aceitar convite:", error);
      
      const isUserExists = error.message.includes("already registered") || 
                          error.message.includes("User already registered") ||
                          error.message.includes("already been registered");
      
      toast({
        title: "Erro",
        description: isUserExists
          ? "Este e-mail já possui uma conta. Faça login para continuar."
          : error.message || "Erro ao processar convite. Tente novamente.",
        variant: "destructive"
      });
      
      if (isUserExists) {
        setTimeout(() => navigate("/login"), 2000);
      }
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!inviteData) {
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-8 bg-gradient-bg">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-6">
            <img src="/icon-agendem.svg" alt="agendem" className="w-12 h-12" />
            <span className="text-2xl font-bold bg-gradient-primary bg-clip-text text-transparent">
              agendem
            </span>
          </div>
          
          <div className="flex items-center justify-center gap-2 mb-4">
            <CheckCircle className="w-6 h-6 text-green-500" />
            <h1 className="text-2xl font-bold">Convite Válido!</h1>
          </div>
          
          <p className="text-muted-foreground">
            Complete seu cadastro para fazer parte da equipe
          </p>
        </div>

        <Card className="border-border/50 shadow-brand-lg">
          <CardHeader className="text-center">
            <CardTitle className="text-xl">Dados do Convite</CardTitle>
            <CardDescription>
              <div className="space-y-2 mt-4">
                <div className="flex items-center gap-2 justify-center">
                  <User className="w-4 h-4" />
                  <span className="font-medium">{inviteData.funcionario_data.nome}</span>
                </div>
                <div className="text-sm text-muted-foreground">
                  {inviteData.email}
                </div>
                {inviteData.funcionario_data.especialidade && (
                  <div className="text-sm">
                    <strong>Especialidade:</strong> {inviteData.funcionario_data.especialidade}
                  </div>
                )}
              </div>
            </CardDescription>
          </CardHeader>
          
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">Criar senha</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    className="pl-10 pr-10"
                    value={formData.password}
                    onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                    required
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1 h-8 w-8"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>
                </div>
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
                    onChange={(e) => setFormData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                    required
                  />
                </div>
              </div>

              <Button 
                type="submit" 
                variant="premium" 
                className="w-full" 
                disabled={processing}
              >
                {processing ? "Criando conta..." : "Aceitar Convite e Criar Conta"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="text-center text-sm text-muted-foreground mt-6">
          <p>Após criar sua conta, você poderá acessar o sistema</p>
        </div>
      </div>
    </div>
  );
}