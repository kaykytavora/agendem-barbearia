// Tipos e constantes da tela de configurações da barbearia
export interface Barbershop {
  id: string;
  slug: string;
  nome: string;
  descricao: string;
  telefone: string;
  email_contato: string;
  cep: string;
  endereco: string;
  bairro: string;
  cidade: string;
  logo_url: string;
  gallery_urls: string[];
}

export interface WorkingHours {
  dia_semana: number;
  hora_abre: string | null; // "HH:MM"; null em dia fechado
  hora_fecha: string | null;
  fechado: boolean;
}

/**
 * Personalização visível para o cliente. A página pública usa só a cor principal
 * (cabeçalho, botões, horário escolhido); claro/escuro fica a critério de quem visita.
 */
export interface ThemeConfig {
  primary: string;
}

export const COR_PADRAO = '#4E42FF';

export const CORES_SUGERIDAS: { name: string; hex: string }[] = [
  { name: "Agendem", hex: COR_PADRAO },
  { name: "Azul", hex: '#2563EB' },
  { name: "Petróleo", hex: '#0F766E' },
  { name: "Verde", hex: '#15803D' },
  { name: "Vinho", hex: '#9F1239' },
  { name: "Rosa", hex: '#DB2777' },
  { name: "Laranja", hex: '#EA580C' },
  { name: "Café", hex: '#7C4A1E' },
];

export const DAYS_OF_WEEK = [
  { value: 0, label: 'Domingo' },
  { value: 1, label: 'Segunda-feira' },
  { value: 2, label: 'Terça-feira' },
  { value: 3, label: 'Quarta-feira' },
  { value: 4, label: 'Quinta-feira' },
  { value: 5, label: 'Sexta-feira' },
  { value: 6, label: 'Sábado' }
];

