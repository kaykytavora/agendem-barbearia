import { Link } from "react-router-dom";
import { Check, ExternalLink, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useSettings } from "./useBarbershopSettings";

/**
 * O que falta na página pública da barbearia. Fica no topo das configurações porque
 * cada item vazio some (ou aparece como "não informado") para o cliente.
 */
export function ProfileChecklist() {
  const { barbershop, phone, workingHours, totalServicos } = useSettings();

  const semServicos = totalServicos === 0;
  const itens = [
    { feito: !semServicos, texto: "Serviços cadastrados" },
    { feito: workingHours.some((h) => !h.fechado), texto: "Horários de funcionamento" },
    { feito: !!barbershop.logo_url, texto: "Logo" },
    { feito: !!barbershop.descricao.trim(), texto: "Descrição" },
    { feito: !!barbershop.endereco.trim() && !!barbershop.cidade.trim(), texto: "Endereço" },
    { feito: phone.replace(/\D/g, "").length >= 10, texto: "Telefone (botão do WhatsApp)" },
    { feito: barbershop.gallery_urls.length > 0, texto: "Fotos do ambiente" },
  ];
  const feitos = itens.filter((i) => i.feito).length;

  return (
    <section className="rounded-3xl border bg-card p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">Sua página para clientes</h2>
          <p className="text-sm text-muted-foreground">
            {feitos === itens.length ? "Tudo preenchido." : `${feitos} de ${itens.length} itens preenchidos.`}
          </p>
        </div>
        {barbershop.slug && (
          <Button asChild variant="outline" size="sm">
            <a href={`/barbearia/${barbershop.slug}`} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="mr-1.5 h-4 w-4" aria-hidden="true" />
              Ver minha página
            </a>
          </Button>
        )}
      </div>

      {semServicos && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-3">
          <p className="flex items-center gap-2 text-sm font-medium">
            <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" aria-hidden="true" />
            Sem serviços cadastrados, os clientes não conseguem agendar pela sua página.
          </p>
          <Button asChild size="sm">
            <Link to="/dashboard/servicos">Cadastrar serviços</Link>
          </Button>
        </div>
      )}

      <ul className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {itens.map((item) => (
          <li key={item.texto} className={cn("flex items-center gap-2 text-sm", item.feito ? "text-muted-foreground" : "font-medium")}>
            <span
              className={cn(
                "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border",
                item.feito ? "border-success bg-success text-white" : "border-muted-foreground/40"
              )}
              aria-hidden="true"
            >
              {item.feito && <Check className="h-3 w-3" />}
            </span>
            <span>
              {item.texto}
              <span className="sr-only">{item.feito ? ": preenchido" : ": falta preencher"}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
