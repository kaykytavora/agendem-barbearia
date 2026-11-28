// Tipos e constantes da tela de configurações da barbearia
export interface Barbershop {
  id: string;
  slug: string;
  nome: string;
  descricao: string;
  desativada_em: string | null;
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

export const DAYS_OF_WEEK = [
  { value: 0, label: 'Domingo' },
  { value: 1, label: 'Segunda-feira' },
  { value: 2, label: 'Terça-feira' },
  { value: 3, label: 'Quarta-feira' },
  { value: 4, label: 'Quinta-feira' },
  { value: 5, label: 'Sexta-feira' },
  { value: 6, label: 'Sábado' }
];
