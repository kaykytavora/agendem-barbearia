import { useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import "./mfa.css";

type Estado = "digitando" | "verificando" | "erro" | "sucesso";

interface CodigoMfaProps {
  /** Valida o código; deve lançar erro com a mensagem a mostrar quando for inválido */
  onVerificar: (codigo: string) => Promise<void>;
  onSucesso?: () => void;
  disabled?: boolean;
}

const TAMANHO = 6;

/**
 * Campo de 6 dígitos com animação: ao completar, as caixas se recolhem num anel que gira
 * enquanto o código é conferido; erro faz as caixas tremerem, sucesso mostra o check.
 */
export function CodigoMfa({ onVerificar, onSucesso, disabled = false }: CodigoMfaProps) {
  const [codigo, setCodigo] = useState("");
  const [estado, setEstado] = useState<Estado>("digitando");
  const [mensagem, setMensagem] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => { input.current?.focus(); }, []);

  async function conferir(valor: string) {
    setEstado("verificando");
    setMensagem(null);
    try {
      await onVerificar(valor);
      setEstado("sucesso");
      window.setTimeout(() => onSucesso?.(), 650);
    } catch (erro) {
      setEstado("erro");
      setMensagem(erro instanceof Error ? erro.message : "Código inválido.");
      window.setTimeout(() => {
        setCodigo("");
        setEstado("digitando");
        input.current?.focus();
      }, 520);
    }
  }

  function alterar(valor: string) {
    const digitos = valor.replace(/\D/g, "").slice(0, TAMANHO);
    setCodigo(digitos);
    if (digitos.length === TAMANHO && estado === "digitando") void conferir(digitos);
  }

  const recolhido = estado === "verificando" || estado === "sucesso";

  return (
    <div className="space-y-3">
      <label
        className={cn("mfa-codigo relative mx-auto flex h-16 w-full max-w-xs cursor-text items-center justify-center", estado === "erro" && "mfa-tremer")}
        data-estado={estado}
        onClick={() => input.current?.focus()}
      >
        <span className="sr-only">Código de 6 dígitos do app autenticador</span>
        <input
          ref={input}
          value={codigo}
          onChange={(e) => alterar(e.target.value)}
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={TAMANHO}
          disabled={disabled || estado !== "digitando"}
          aria-invalid={estado === "erro"}
          aria-describedby="mfa-mensagem"
          className="absolute inset-0 h-full w-full cursor-text opacity-0"
        />

        {/* Caixas dos dígitos: recolhem para o centro ao verificar */}
        <div className="flex gap-2" aria-hidden="true">
          {Array.from({ length: TAMANHO }, (_, i) => {
            const ativo = estado === "digitando" && i === Math.min(codigo.length, TAMANHO - 1);
            const deslocamento = (TAMANHO - 1) / 2 - i;
            return (
              <span
                key={i}
                className={cn(
                  "mfa-caixa flex h-12 w-10 items-center justify-center rounded-xl border-2 bg-background font-display text-xl font-bold tabular-nums sm:h-14 sm:w-11",
                  ativo ? "border-primary shadow-[0_0_0_4px_hsl(var(--primary)/0.15)]" : codigo[i] ? "border-primary/40" : "border-input",
                  estado === "erro" && "border-destructive text-destructive",
                )}
                style={{
                  transform: recolhido ? `translateX(${deslocamento * 48}px) scale(0.25)` : undefined,
                  opacity: recolhido ? 0 : 1,
                  transitionDelay: recolhido ? `${Math.abs(deslocamento) * 30}ms` : "0ms",
                }}
              >
                {codigo[i] ?? ""}
              </span>
            );
          })}
        </div>

        {/* Anel pontilhado enquanto confere; vira check no sucesso */}
        {recolhido && (
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden="true">
            {estado === "verificando" ? (
              <svg className="mfa-anel h-12 w-12 text-primary" viewBox="0 0 48 48">
                <circle cx="24" cy="24" r="20" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeDasharray="2 8" vectorEffect="non-scaling-stroke" />
              </svg>
            ) : (
              <span className="mfa-sucesso flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Check className="h-6 w-6" strokeWidth={3} />
              </span>
            )}
          </span>
        )}
      </label>

      <p id="mfa-mensagem" role="status" aria-live="polite" className={cn("min-h-5 text-center text-sm", estado === "erro" ? "text-destructive" : "text-muted-foreground")}>
        {estado === "verificando" ? "Conferindo código..." : estado === "sucesso" ? "Código confirmado." : mensagem ?? "Abra o app autenticador e digite o código."}
      </p>
    </div>
  );
}
