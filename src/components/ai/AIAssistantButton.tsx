import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { MessageCircle, X } from "lucide-react";
import { AIAssistantChat } from "./AIAssistantChat";
import { cn } from "@/lib/utils";

/** Botão flutuante que abre o assistente como uma janelinha de chat no canto da tela. */
export function AIAssistantButton({ className }: { className?: string }) {
  const [aberto, setAberto] = useState(false);

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
          aria-label="Encontrar barbearia"
          className="flex h-[min(560px,calc(100dvh-8rem))] w-[calc(100vw-2rem)] origin-bottom-right flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-2xl ring-1 ring-primary/10 animate-in fade-in-0 zoom-in-95 slide-in-from-bottom-4 duration-200 sm:w-[380px]"
        >
          <AIAssistantChat onClose={() => setAberto(false)} />
        </div>
      )}

      <Button
        onClick={() => setAberto((v) => !v)}
        aria-expanded={aberto}
        className="h-12 gap-2 rounded-full pl-4 pr-5 text-sm font-semibold shadow-lg shadow-primary/30"
        size="lg"
      >
        {aberto ? <X className="h-4 w-4" /> : <MessageCircle className="h-4 w-4" />}
        {aberto ? "Fechar" : "Encontrar barbearia"}
      </Button>
    </div>
  );
}
