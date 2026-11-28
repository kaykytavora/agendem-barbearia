import { useEffect, useState } from "react";
import { Loader2, MapPin } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCepMask } from "@/hooks/useCepMask";
import { consultarCep } from "@/services/cep";

export interface RegiaoCep {
  cep: string;
  bairro: string;
  cidade: string;
  uf: string;
}

/** Converte a região em campos de user_metadata (vazio limpa a região salva). */
export function metadadosRegiao(regiao: RegiaoCep | null) {
  return regiao
    ? { cep: regiao.cep, bairro: regiao.bairro || null, cidade: regiao.cidade, uf: regiao.uf }
    : { cep: null, bairro: null, cidade: null, uf: null };
}

interface CampoCepProps {
  /** CEP já salvo (apenas dígitos ou com máscara) */
  valorInicial?: string;
  /** Recebe a região encontrada, ou null enquanto o CEP estiver incompleto/inválido */
  onRegiaoChange: (regiao: RegiaoCep | null) => void;
  /** Informa se o campo está vazio (permite limpar a região salva) */
  onVazioChange?: (vazio: boolean) => void;
}

/** Campo de CEP que busca bairro e cidade no ViaCEP para ordenar as barbearias próximas. */
export function CampoCep({ valorInicial = "", onRegiaoChange, onVazioChange }: CampoCepProps) {
  const { value, handleChange } = useCepMask(valorInicial);
  const [regiao, setRegiao] = useState<RegiaoCep | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [invalido, setInvalido] = useState(false);

  useEffect(() => {
    const digitos = value.replace(/\D/g, "");
    onVazioChange?.(digitos.length === 0);
    setRegiao(null);
    onRegiaoChange(null);
    setInvalido(false);
    if (digitos.length !== 8) return;

    let ativo = true;
    setBuscando(true);
    consultarCep(digitos)
      .then((endereco) => {
        if (!ativo) return;
        if (!endereco) return setInvalido(true);
        const encontrada = { cep: digitos, bairro: endereco.bairro, cidade: endereco.localidade, uf: endereco.uf };
        setRegiao(encontrada);
        onRegiaoChange(encontrada);
      })
      .catch(() => ativo && setInvalido(true))
      .finally(() => ativo && setBuscando(false));
    return () => { ativo = false; };
    // Os callbacks vêm do pai e podem mudar a cada render; a busca depende só do CEP
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <div className="space-y-2">
      <Label htmlFor="cep">CEP <span className="font-normal text-muted-foreground">(opcional)</span></Label>
      <div className="relative">
        <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" aria-hidden="true" />
        <Input
          id="cep"
          inputMode="numeric"
          autoComplete="postal-code"
          placeholder="00000-000"
          className="pl-10"
          value={value}
          onChange={handleChange}
          aria-describedby="cep-ajuda"
          aria-invalid={invalido}
        />
        {buscando && <Loader2 className="absolute right-3 top-3 h-4 w-4 animate-spin text-muted-foreground" aria-hidden="true" />}
      </div>
      <p id="cep-ajuda" aria-live="polite" className={invalido ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>
        {invalido
          ? "CEP não encontrado. Confira os números ou deixe em branco."
          : regiao
            ? <>Sua região: <strong className="text-foreground">{[regiao.bairro, regiao.cidade].filter(Boolean).join(" - ")}</strong></>
            : "Usamos seu bairro para mostrar primeiro as barbearias mais próximas."}
      </p>
    </div>
  );
}
