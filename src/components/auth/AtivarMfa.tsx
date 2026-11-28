import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Loader2, ShieldCheck, ShieldOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { fatoresAtivos, verificarCodigoMfa } from "@/lib/mfa";
import { CodigoMfa } from "./CodigoMfa";

interface Cadastro {
  fatorId: string;
  qr: string;
  segredo: string;
}

/** Cartão das configurações pessoais para ativar/desativar a verificação em duas etapas. */
export function AtivarMfa() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [cadastro, setCadastro] = useState<Cadastro | null>(null);
  const [iniciando, setIniciando] = useState(false);
  const [removendo, setRemovendo] = useState(false);

  const fatores = useQuery({ queryKey: ["mfa-fatores"], queryFn: fatoresAtivos });
  const ativo = (fatores.data?.length ?? 0) > 0;

  async function iniciar() {
    setIniciando(true);
    try {
      // Cadastros antigos não confirmados bloqueiam um novo com o mesmo nome
      const { data: lista } = await supabase.auth.mfa.listFactors();
      for (const f of lista?.all ?? []) {
        if (f.status !== "verified") await supabase.auth.mfa.unenroll({ factorId: f.id });
      }
      const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: `Agendem ${Date.now()}` });
      if (error) throw error;
      setCadastro({ fatorId: data.id, qr: data.totp.qr_code, segredo: data.totp.secret });
    } catch (erro) {
      toast({ title: "Não foi possível iniciar", description: erro instanceof Error ? erro.message : undefined, variant: "destructive" });
    } finally {
      setIniciando(false);
    }
  }

  async function cancelar() {
    if (cadastro) await supabase.auth.mfa.unenroll({ factorId: cadastro.fatorId }).catch(() => undefined);
    setCadastro(null);
  }

  async function desativar() {
    setRemovendo(true);
    try {
      for (const f of fatores.data ?? []) {
        const { error } = await supabase.auth.mfa.unenroll({ factorId: f.id });
        if (error) throw error;
      }
      await queryClient.invalidateQueries({ queryKey: ["mfa-fatores"] });
      await queryClient.invalidateQueries({ queryKey: ["mfa-nivel"] });
      toast({ title: "Verificação em duas etapas desativada." });
    } catch (erro) {
      toast({ title: "Não foi possível desativar", description: erro instanceof Error ? erro.message : undefined, variant: "destructive" });
    } finally {
      setRemovendo(false);
    }
  }

  return (
    <Card>
      <CardHeader className="p-4 sm:p-6">
        <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
          <ShieldCheck className="h-5 w-5 text-primary" />
          Verificação em duas etapas
        </CardTitle>
        <CardDescription>
          Além da senha, o login do painel pede um código do seu celular (Google Authenticator, Authy ou outro app autenticador).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 p-4 pt-0 sm:p-6 sm:pt-0">
        {fatores.isLoading ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando...</p>
        ) : ativo ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary/25 bg-primary/5 p-4">
            <p className="flex items-center gap-2 text-sm font-medium">
              <ShieldCheck className="h-4 w-4 text-primary" /> Ativada nesta conta
            </p>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive" disabled={removendo}>
                  <ShieldOff /> Desativar
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="max-w-sm">
                <AlertDialogHeader>
                  <AlertDialogTitle>Desativar a verificação?</AlertDialogTitle>
                  <AlertDialogDescription>O login do painel volta a pedir só a senha.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Voltar</AlertDialogCancel>
                  <AlertDialogAction onClick={() => void desativar()}>Desativar</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        ) : cadastro ? (
          <div className="space-y-5">
            <ol className="space-y-4 text-sm">
              <li>
                <p className="font-medium">1. Escaneie o QR code com o app autenticador</p>
                <div className="mt-3 flex flex-col items-center gap-3 sm:flex-row sm:items-start">
                  <img src={cadastro.qr} alt="QR code para o app autenticador" className="h-40 w-40 rounded-xl border bg-white p-2" />
                  <div className="min-w-0 space-y-1.5 text-muted-foreground">
                    <p>Não consegue escanear? Digite esta chave no app:</p>
                    <div className="flex items-center gap-2">
                      <code className="min-w-0 break-all rounded-lg bg-muted px-2 py-1 font-mono text-xs text-foreground">{cadastro.segredo}</code>
                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" aria-label="Copiar chave"
                        onClick={() => void navigator.clipboard.writeText(cadastro.segredo).then(() => toast({ title: "Chave copiada." }))}>
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </li>
              <li>
                <p className="mb-3 font-medium">2. Digite o código que aparece no app</p>
                <CodigoMfa
                  onVerificar={(codigo) => verificarCodigoMfa(codigo, cadastro.fatorId)}
                  onSucesso={() => {
                    setCadastro(null);
                    void queryClient.invalidateQueries({ queryKey: ["mfa-fatores"] });
                    void queryClient.invalidateQueries({ queryKey: ["mfa-nivel"] });
                    toast({ title: "Verificação em duas etapas ativada." });
                  }}
                />
              </li>
            </ol>
            <Button variant="ghost" size="sm" onClick={() => void cancelar()}>Cancelar</Button>
          </div>
        ) : (
          <Button onClick={() => void iniciar()} disabled={iniciando}>
            {iniciando ? <Loader2 className="animate-spin" /> : <ShieldCheck />}
            Ativar verificação em duas etapas
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
