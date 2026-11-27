import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarCheck, MapPin, Scissors, Star, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { usePrimeirosPassos } from "@/hooks/usePrimeirosPassos";
import { concluir } from "@/lib/primeiros-passos";
import { cn } from "@/lib/utils";

interface Passo {
  icone: LucideIcon;
  titulo: string;
  texto: string;
}

const PASSOS_CLIENTE: Passo[] = [
  {
    icone: MapPin,
    titulo: "Encontre uma barbearia",
    texto: "Busque pelo nome ou pelo seu CEP e veja as barbearias mais perto de você.",
  },
  {
    icone: Scissors,
    titulo: "Escolha serviço, profissional e horário",
    texto: "Veja preços e duração de cada serviço e só os horários que estão livres de verdade.",
  },
  {
    icone: CalendarCheck,
    titulo: "Acompanhe seus agendamentos",
    texto: "Em Meus agendamentos você confere os próximos horários e pode cancelar se precisar.",
  },
  {
    icone: Star,
    titulo: "Avalie o atendimento",
    texto: "Depois do corte, conte como foi. Sua avaliação ajuda outros clientes a escolher.",
  },
];

/**
 * Tour de boas-vindas do cliente. Abre sozinho no primeiro acesso ao painel e pode
 * ser reaberto com `aberto` (botão "Como funciona").
 */
export function TourCliente({ aberto, onFechar }: { aberto: boolean; onFechar: () => void }) {
  const navigate = useNavigate();
  const { estado, salvar } = usePrimeirosPassos();
  const [passo, setPasso] = useState(0);

  const primeiroAcesso = !!estado && !estado.concluido_em;
  const visivel = aberto || primeiroAcesso;

  useEffect(() => {
    if (visivel) setPasso(0);
  }, [visivel]);

  const fechar = () => {
    if (primeiroAcesso && estado) void salvar(concluir(estado));
    onFechar();
  };

  const ultimo = passo === PASSOS_CLIENTE.length - 1;
  const { icone: Icone, titulo, texto } = PASSOS_CLIENTE[passo];

  return (
    <Dialog open={visivel} onOpenChange={(abrir) => !abrir && fechar()}>
      <DialogContent className="max-w-sm rounded-3xl text-center">
        <span className="mx-auto mt-2 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Icone className="h-8 w-8" aria-hidden="true" />
        </span>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Passo {passo + 1} de {PASSOS_CLIENTE.length}
        </p>
        <DialogTitle className="text-xl">{titulo}</DialogTitle>
        <DialogDescription className="text-base">{texto}</DialogDescription>

        <div className="flex justify-center gap-1.5" aria-hidden="true">
          {PASSOS_CLIENTE.map((p, i) => (
            <span
              key={p.titulo}
              className={cn("h-2 rounded-full transition-all", i === passo ? "w-6 bg-primary" : "w-2 bg-muted-foreground/30")}
            />
          ))}
        </div>

        <div className="mt-2 flex gap-2">
          {passo === 0 ? (
            <Button variant="ghost" className="flex-1" onClick={fechar}>
              Pular
            </Button>
          ) : (
            <Button variant="outline" className="flex-1" onClick={() => setPasso(passo - 1)}>
              Voltar
            </Button>
          )}
          {ultimo ? (
            <Button
              className="flex-1"
              onClick={() => {
                fechar();
                navigate("/barbearias");
              }}
            >
              Agendar agora
            </Button>
          ) : (
            <Button className="flex-1" onClick={() => setPasso(passo + 1)}>
              Próximo
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
