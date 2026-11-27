import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { renovarLinkAgendamento } from "@/integrations/supabase/api";

export function LinkClienteAgendamento({ id, linkInicial }: { id: string; linkInicial?: string }) {
  const [link, setLink] = useState(() => linkInicial ? new URL(linkInicial, window.location.origin).href : undefined);
  const [carregando, setCarregando] = useState(false);
  const [mostrarGeracao, setMostrarGeracao] = useState(false);
  const { toast } = useToast();

  async function gerarLink() {
    setCarregando(true);
    try {
      setLink(await renovarLinkAgendamento(id));
      setMostrarGeracao(false);
    } catch (erro) {
      toast({ title: "Não foi possível gerar o link", description: erro instanceof Error ? erro.message : undefined, variant: "destructive" });
    } finally {
      setCarregando(false);
    }
  }

  async function copiar() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      toast({ title: "Link copiado para compartilhar com o cliente." });
    } catch {
      toast({ title: "Selecione e copie o link abaixo." });
    }
  }

  if (link) {
    return (
      <div className="space-y-2">
        <Button size="sm" variant="outline" onClick={copiar}>Copiar link do cliente</Button>
        <Input aria-label="Link do cliente" readOnly value={link} className="h-8 w-full max-w-56 text-xs"
          onFocus={(event) => event.currentTarget.select()} />
      </div>
    );
  }

  return mostrarGeracao ? (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">Gerar um link substitui o endereço anterior.</p>
      <Button size="sm" variant="outline" disabled={carregando} onClick={gerarLink}>
        {carregando ? "Gerando..." : "Gerar novo link"}
      </Button>
    </div>
  ) : <Button size="sm" variant="outline" onClick={() => setMostrarGeracao(true)}>Link do cliente</Button>;
}
