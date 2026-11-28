import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  X,
  Send,
  Loader2,
  Sparkles,
  Star,
  MapPin,
  Calendar,
  Clock,
  Scissors,
  Bot,
  User,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";

// ─── Tipos ───────────────────────────────────────────────────────────────────
interface Mensagem {
  role: "user" | "model";
  content: string;
  barbearias?: BarbeariaCard[];
}

interface BarbeariaCard {
  id: string;
  nome: string;
  slug: string;
  cidade: string;
  bairro?: string;
  logo_url?: string;
  nota_media: number;
  total_avaliacoes: number;
  servicos_encontrados: string[];
  preco_estimado?: number;
  endereco?: string;
  funcionamento_hoje?: string;
  proximos_horarios?: { dia: string; horas: string[] }[];
  no_seu_bairro?: boolean;
}

// ─── Sugestões rápidas ───────────────────────────────────────────────────────
const SUGESTOES = [
  "Corte com barba até R$ 60",
  "Tem horário amanhã de manhã?",
  "A mais bem avaliada perto de mim",
  "Corte infantil hoje à tarde",
];

// ─── Card de barbearia no chat ───────────────────────────────────────────────
function BarbeariaResultCard({
  barbearia,
  onAgendar,
}: {
  barbearia: BarbeariaCard;
  onAgendar: (slug: string) => void;
}) {
  const proximo = barbearia.proximos_horarios?.[0];
  return (
    <div className="mt-2 rounded-2xl border border-border/70 bg-card p-3 shadow-brand-sm transition-colors hover:border-primary/50">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">{barbearia.nome}</p>
          <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-muted-foreground">
            {barbearia.total_avaliacoes > 0 ? (
              <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                <Star className="h-3 w-3 fill-current" aria-hidden="true" />
                {barbearia.nota_media.toFixed(1).replace(".", ",")}
                <span className="text-muted-foreground">({barbearia.total_avaliacoes})</span>
              </span>
            ) : (
              <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium">Nova</span>
            )}
            <span className="flex items-center gap-1">
              <MapPin className="h-3 w-3" aria-hidden="true" />
              {barbearia.bairro ?? barbearia.cidade}
              {barbearia.no_seu_bairro && <span className="font-medium text-primary">· seu bairro</span>}
            </span>
            {barbearia.funcionamento_hoje && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" aria-hidden="true" />
                {barbearia.funcionamento_hoje}
              </span>
            )}
          </div>
        </div>
        {barbearia.preco_estimado !== undefined && barbearia.preco_estimado > 0 && (
          <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
            {barbearia.preco_estimado.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
          </span>
        )}
      </div>

      {barbearia.servicos_encontrados.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {barbearia.servicos_encontrados.map((servico) => (
            <Badge key={servico} variant="outline" className="h-5 gap-1 text-[11px] font-normal">
              <Scissors className="h-2.5 w-2.5" aria-hidden="true" /> {servico}
            </Badge>
          ))}
        </div>
      )}

      {proximo && (
        <div className="mt-2.5">
          <p className="mb-1 text-[11px] text-muted-foreground">Horários livres {proximo.dia}</p>
          <div className="flex flex-wrap gap-1">
            {proximo.horas.map((hora) => (
              <button
                key={hora}
                type="button"
                onClick={() => onAgendar(barbearia.slug)}
                className="rounded-lg border border-primary/30 bg-primary/5 px-2 py-0.5 text-xs font-medium text-primary hover:bg-primary/10"
              >
                {hora}
              </button>
            ))}
          </div>
        </div>
      )}

      <Button size="sm" className="mt-3 h-8 w-full text-xs" onClick={() => onAgendar(barbearia.slug)}>
        <Calendar className="mr-1 h-3 w-3" aria-hidden="true" />
        Ver horários e agendar
      </Button>
    </div>
  );
}

// ─── Componente principal ────────────────────────────────────────────────────
export function AIAssistantChat({ onClose }: { onClose: () => void }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [mensagens, setMensagens] = useState<Mensagem[]>([
    {
      role: "model",
      content:
        "Olá! Me conte o serviço, o orçamento ou quando você quer ir, e eu indico as melhores barbearias com horários livres.",
    },
  ]);
  const [input, setInput] = useState("");
  const [carregando, setCarregando] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll para a última mensagem
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [mensagens, carregando]);

  // Foco no input ao abrir
  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  async function enviarMensagem(texto?: string) {
    const mensagemTexto = (texto ?? input).trim();
    if (!mensagemTexto || carregando) return;

    setInput("");

    // Adiciona mensagem do usuário
    const novasMensagens: Mensagem[] = [
      ...mensagens,
      { role: "user", content: mensagemTexto },
    ];
    setMensagens(novasMensagens);
    setCarregando(true);

    try {
      // Histórico para multi-turno (últimas 6 mensagens, sem as barbearias)
      const historico = novasMensagens.slice(-7, -1).map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const { data, error } = await supabase.functions.invoke(
        "ai-barbershop-advisor",
        {
          body: {
            mensagem: mensagemTexto,
            historico,
            regiao: user?.user_metadata?.cidade
              ? { bairro: user.user_metadata.bairro ?? null, cidade: user.user_metadata.cidade }
              : null,
          },
        }
      );

      if (error) throw error;

      setMensagens((prev) => [
        ...prev,
        {
          role: "model",
          content: data.texto ?? "Não consegui processar sua solicitação.",
          barbearias: data.barbearias ?? [],
        },
      ]);
    } catch (err) {
      console.error(err);
      setMensagens((prev) => [
        ...prev,
        {
          role: "model",
          content:
            "Desculpe, tive um problema ao buscar as barbearias. Tente novamente em instantes.",
        },
      ]);
    } finally {
      setCarregando(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      enviarMensagem();
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-primary" />
          </div>
          <div>
            <p className="font-semibold text-sm">Assistente Agendem</p>
            <p className="text-xs text-muted-foreground">
              Tire dúvidas e encontre barbearias
            </p>
          </div>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Mensagens */}
      <ScrollArea className="flex-1 p-4" ref={scrollRef as any}>
        <div className="space-y-4">
          {mensagens.map((msg, i) => (
            <div key={i}>
              <div
                className={cn(
                  "flex gap-2",
                  msg.role === "user" ? "flex-row-reverse" : "flex-row"
                )}
              >
                {/* Avatar */}
                <Avatar className="h-7 w-7 shrink-0 mt-0.5">
                  <AvatarFallback
                    className={cn(
                      "text-xs",
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    )}
                  >
                    {msg.role === "user" ? (
                      <User className="w-3.5 h-3.5" />
                    ) : (
                      <Bot className="w-3.5 h-3.5" />
                    )}
                  </AvatarFallback>
                </Avatar>

                {/* Bolha */}
                <div
                  className={cn(
                    "max-w-[80%] rounded-2xl px-3 py-2 text-sm",
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground rounded-tr-sm"
                      : "bg-muted text-foreground rounded-tl-sm"
                  )}
                >
                  <p className="whitespace-pre-wrap leading-relaxed">
                    {msg.content}
                  </p>
                </div>
              </div>

              {/* Cards de barbearia abaixo da resposta da IA */}
              {msg.role === "model" &&
                msg.barbearias &&
                msg.barbearias.length > 0 && (
                  <div className="ml-9 space-y-2 mt-1">
                    {msg.barbearias.map((b) => (
                      <BarbeariaResultCard
                        key={b.id}
                        barbearia={b}
                        onAgendar={(slug) =>
                          navigate(`/barbearia/${slug}`)
                        }
                      />
                    ))}
                  </div>
                )}
            </div>
          ))}

          {/* Indicador de digitando */}
          {carregando && (
            <div className="flex gap-2">
              <Avatar className="h-7 w-7 shrink-0">
                <AvatarFallback className="bg-muted text-xs">
                  <Bot className="w-3.5 h-3.5" />
                </AvatarFallback>
              </Avatar>
              <div className="bg-muted rounded-2xl rounded-tl-sm px-3 py-2">
                <div className="flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">
                    Procurando barbearias e horários...
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Sugestões rápidas (só na primeira mensagem) */}
          {mensagens.length === 1 && !carregando && (
            <div className="ml-9 mt-2">
              <p className="text-xs text-muted-foreground mb-2">
                Experimente perguntar:
              </p>
              <div className="flex flex-wrap gap-2">
                {SUGESTOES.map((s) => (
                  <button
                    key={s}
                    onClick={() => enviarMensagem(s)}
                    className="text-xs border border-border rounded-full px-3 py-1.5 hover:bg-primary/10 hover:border-primary/50 transition-colors text-left"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="p-4 border-t border-border shrink-0">
        <div className="flex gap-2">
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ex: quero um degradê com barba..."
            className="flex-1 h-10 text-sm"
            disabled={carregando}
          />
          <Button
            size="icon"
            className="h-10 w-10 shrink-0"
            onClick={() => enviarMensagem()}
            disabled={!input.trim() || carregando}
          >
            {carregando ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
