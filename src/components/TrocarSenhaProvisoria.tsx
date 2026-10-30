import { useState } from "react";
import { Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const SENHA_MINIMA = 8;

/**
 * Aparece no lugar do painel enquanto o funcionário usa a senha definida pelo dono.
 * Só libera o acesso depois que a pessoa cria a própria senha.
 */
export default function TrocarSenhaProvisoria() {
  const { user, refreshProfile, signOut } = useAuth();
  const { toast } = useToast();
  const [senha, setSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [salvando, setSalvando] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (senha.length < SENHA_MINIMA) {
      toast({ title: "Senha curta", description: `Use pelo menos ${SENHA_MINIMA} caracteres.`, variant: "destructive" });
      return;
    }
    if (senha !== confirmacao) {
      toast({ title: "Senhas diferentes", description: "As duas senhas precisam ser iguais.", variant: "destructive" });
      return;
    }

    setSalvando(true);
    try {
      const { error: senhaError } = await supabase.auth.updateUser({ password: senha });
      if (senhaError) {
        throw new Error(
          senhaError.code === "same_password"
            ? "Escolha uma senha diferente da senha inicial."
            : senhaError.message
        );
      }

      const { error: perfilError } = await supabase
        .from("profiles")
        .update({ senha_provisoria: false })
        .eq("user_id", user!.id);
      if (perfilError) throw perfilError;

      await refreshProfile();
      toast({ title: "Senha criada", description: "Use a nova senha nos próximos acessos." });
    } catch (error) {
      toast({
        title: "Não foi possível trocar a senha",
        description: error instanceof Error ? error.message : "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <Card className="w-full max-w-md border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl">
            <Shield className="h-5 w-5" aria-hidden="true" />
            Crie sua senha
          </CardTitle>
          <CardDescription>
            Você entrou com a senha inicial definida pelo dono da barbearia. Crie uma senha só sua para continuar.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nova-senha">Nova senha</Label>
              <Input
                id="nova-senha"
                type="password"
                autoComplete="new-password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmar-senha">Confirmar nova senha</Label>
              <Input
                id="confirmar-senha"
                type="password"
                autoComplete="new-password"
                value={confirmacao}
                onChange={(e) => setConfirmacao(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={salvando}>
              {salvando ? "Salvando..." : "Salvar senha"}
            </Button>
            <Button type="button" variant="ghost" className="w-full" onClick={() => signOut()}>
              Sair
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
