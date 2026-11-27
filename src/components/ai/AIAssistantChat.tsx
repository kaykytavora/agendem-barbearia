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
  Bot,
  User,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

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
}

// ─── Sugestões rápidas ───────────────────────────────────────────────────────
const SUGESTOES = [
  "Degradê com barba até R$ 60",
  "Corte infantil perto de mim",
  "Quem faz tranças?",
  "Melhor avaliada da cidade",
];

// ─── Card de barbearia no chat ───────────────────────────────────────────────
function BarbeariaResultCard({
  barbearia,
  onAgendar,
}: {
  barbearia: BarbeariaCard;
  onAgendar: (slug: string) => void;
}) {
  return (
    <div className="rounded-xl border border-border bg-card/80 backdrop-blur-sm p-3 mt-2 hover:border-primary/50 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm text-foreground truncate">
            {barbearia.nome}
          </p>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {barbearia.nota_media > 0 && (
              <span className="flex items-center gap-1 text-xs text-amber-500">
                <Star className="w-3 h-3 fill-amber-500" />
                {barbearia.nota_media.toFixed(1)}
                <span className="text-muted-foreground">
                  ({barbearia.total_avaliacoes})
                </span>
              </span>
            )}
            {barbearia.cidade && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="w-3 h-3" />
                {barbearia.bairro ?? barbearia.cidade}
              </span>
            )}
            {barbearia.preco_estimado && barbearia.preco_estimado > 0 && (
              <Badge variant="secondary" className="text-xs h-5">
                R$ {barbearia.preco_estimado.toFixed(0)}
              </Badge>
            )}
          </div>
          {barbearia.servicos_encontrados.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {barbearia.servicos_encontrados.map((s) => (
                <Badge
                  key={s}
                  variant="outline"
                  className="text-xs h-5 capitalize"
                >
                  ✂️ {s}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </div>
      <Button
        size="sm"
        className="w-full mt-3 h-8 text-xs"
        onClick={() => onAgendar(barbearia.slug)}
      >
        <Calendar className="w-3 h-3 mr-1" />
        Ver horários
      </Button>
    </div>
  );
}

// ─── Componente principal ────────────────────────────────────────────────────
export function AIAssistantChat({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const [mensagens, setMensagens] = useState<Mensagem[]>([
    {
      role: "model",
      content:
        "Olá! 👋 Me conte o que você quer fazer e te indico a barbearia ideal. Pode descrever o corte, orçamento ou cidade!",
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
            "Desculpe, tive um problema ao buscar as barbearias. Tente novamente em instantes! 🙏",
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
            <p className="font-semibold text-sm">Assistente agendem</p>
            <p className="text-xs text-muted-foreground">
              Encontre a barbearia ideal ✂️
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
                    Buscando barbearias...
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Sugestões rápidas (só na primeira mensagem) */}
          {mensagens.length === 1 && !carregando && (
            <div className="ml-9 mt-2">
              <p className="text-xs text-muted-foreground mb-2">
                💡 Exemplos rápidos:
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
        <p className="text-xs text-muted-foreground text-center mt-2">
          Powered by Gemini AI ✨
        </p>
      </div>
    </div>
  );
}
