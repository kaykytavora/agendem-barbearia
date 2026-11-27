import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Sparkles } from "lucide-react";
import { AIAssistantChat } from "./AIAssistantChat";

export function AIAssistantButton() {
  const [aberto, setAberto] = useState(false);

  return (
    <>
      {/* Botão flutuante */}
      <Button
        onClick={() => setAberto(true)}
        className="fixed bottom-6 right-6 z-50 h-14 pl-4 pr-5 rounded-full shadow-lg shadow-primary/30 gap-2 font-semibold text-sm"
        size="lg"
      >
        <Sparkles className="w-4 h-4" />
        Encontrar minha barbearia
      </Button>

      {/* Painel lateral (Sheet) */}
      <Sheet open={aberto} onOpenChange={setAberto}>
        <SheetContent
          side="right"
          className="w-full sm:w-[420px] p-0 flex flex-col"
        >
          <AIAssistantChat onClose={() => setAberto(false)} />
        </SheetContent>
      </Sheet>
    </>
  );
}
