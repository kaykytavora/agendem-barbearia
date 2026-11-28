import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Sparkles, X } from "lucide-react";
import { AIAssistantChat } from "./AIAssistantChat";
import { cn } from "@/lib/utils";
import { EVENTO_ABRIR_ASSISTENTE_CLIENTE } from "@/lib/eventos";

/** Botão flutuante que abre o assistente como uma janelinha de chat no canto da tela. */
export function AIAssistantButton({ className, classeBotao }: { className?: string; classeBotao?: string }) {
  const [aberto, setAberto] = useState(false);

  // Também pode ser aberto de fora (ex.: botão do dock no celular)
  useEffect(() => {
    const abrir = () => setAberto(true);
    window.addEventListener(EVENTO_ABRIR_ASSISTENTE_CLIENTE, abrir);
    return () => window.removeEventListener(EVENTO_ABRIR_ASSISTENTE_CLIENTE, abrir);
  }, []);

  useEffect(() => {
    if (!aberto) return;
    const fecharComEsc = (e: KeyboardEvent) => e.key === "Escape" && setAberto(false);
    window.addEventListener("keydown", fecharComEsc);
    return () => window.removeEventListener("keydown", fecharComEsc);
  }, [aberto]);

  return (
    <div className={cn("fixed bottom-6 right-4 z-50 flex flex-col items-end gap-3 sm:right-6", className)}>
      {aberto && (
        <div
          role="dialog"
          aria-label="Assistente Agendem"
          className="flex h-[min(560px,calc(100dvh-8rem))] w-[calc(100vw-2rem)] origin-bottom-right flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-2xl ring-1 ring-primary/10 animate-in fade-in-0 zoom-in-95 slide-in-from-bottom-4 duration-200 sm:w-[380px]"
        >
          <AIAssistantChat onClose={() => setAberto(false)} />
        </div>
      )}

      {/* No celular só o ícone (não cobre o conteúdo); no desktop ícone + nome */}
      <Button
        onClick={() => setAberto((v) => !v)}
        aria-expanded={aberto}
        aria-label={aberto ? "Fechar assistente" : "Abrir assistente"}
        className={cn("h-12 w-12 gap-2 rounded-full p-0 text-sm font-semibold shadow-lg shadow-primary/30 sm:w-auto sm:pl-4 sm:pr-5", classeBotao)}
        size="lg"
      >
        {aberto ? <X className="h-5 w-5 sm:h-4 sm:w-4" /> : <Sparkles className="h-5 w-5 sm:h-4 sm:w-4" />}
        <span className="hidden sm:inline">{aberto ? "Fechar" : "Assistente"}</span>
      </Button>
    </div>
  );
}
