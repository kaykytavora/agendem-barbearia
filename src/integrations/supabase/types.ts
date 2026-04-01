export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      agendamentos: {
        Row: {
          avaliado: boolean
          barbearia_id: string
          cliente_email: string | null
          cliente_nome: string
          cliente_telefone: string
          created_at: string
          data_hora: string
          funcionario_id: string | null
          id: string
          origem: string | null
          servico_id: string
          status: Database["public"]["Enums"]["agendamento_status"]
          updated_at: string
          user_id: string | null
        }
        Insert: {
          avaliado?: boolean
          barbearia_id: string
          cliente_email?: string | null
          cliente_nome: string
          cliente_telefone: string
          created_at?: string
          data_hora: string
          funcionario_id?: string | null
          id?: string
          origem?: string | null
          servico_id: string
          status?: Database["public"]["Enums"]["agendamento_status"]
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          avaliado?: boolean
          barbearia_id?: string
          cliente_email?: string | null
          cliente_nome?: string
          cliente_telefone?: string
          created_at?: string
          data_hora?: string
          funcionario_id?: string | null
          id?: string
          origem?: string | null
          servico_id?: string
          status?: Database["public"]["Enums"]["agendamento_status"]
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agendamentos_barbearia_id_fkey"
            columns: ["barbearia_id"]
            isOneToOne: false
            referencedRelation: "barbearias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agendamentos_barbearia_id_fkey"
            columns: ["barbearia_id"]
            isOneToOne: false
            referencedRelation: "barbearias_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agendamentos_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agendamentos_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agendamentos_servico_id_fkey"
            columns: ["servico_id"]
            isOneToOne: false
            referencedRelation: "servicos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agendamentos_servico_id_fkey"
            columns: ["servico_id"]
            isOneToOne: false
            referencedRelation: "servicos_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agendamentos_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      assinaturas: {
        Row: {
          barbearia_id: string
          created_at: string
          data_cancelamento: string | null
          data_fim: string | null
          data_inicio: string
          id: string
          metodo_pagamento:
            | Database["public"]["Enums"]["metodo_pagamento"]
            | null
          moeda: string
          observacoes: string | null
          status: Database["public"]["Enums"]["status_assinatura"]
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          tipo_plano: Database["public"]["Enums"]["tipo_plano"]
          updated_at: string
          valor_mensal: number
        }
        Insert: {
          barbearia_id: string
          created_at?: string
          data_cancelamento?: string | null
          data_fim?: string | null
          data_inicio?: string
          id?: string
          metodo_pagamento?:
            | Database["public"]["Enums"]["metodo_pagamento"]
            | null
          moeda?: string
          observacoes?: string | null
          status?: Database["public"]["Enums"]["status_assinatura"]
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          tipo_plano?: Database["public"]["Enums"]["tipo_plano"]
          updated_at?: string
          valor_mensal?: number
        }
        Update: {
          barbearia_id?: string
          created_at?: string
          data_cancelamento?: string | null
          data_fim?: string | null
          data_inicio?: string
          id?: string
          metodo_pagamento?:
            | Database["public"]["Enums"]["metodo_pagamento"]
            | null
          moeda?: string
          observacoes?: string | null
          status?: Database["public"]["Enums"]["status_assinatura"]
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          tipo_plano?: Database["public"]["Enums"]["tipo_plano"]
          updated_at?: string
          valor_mensal?: number
        }
        Relationships: [
          {
            foreignKeyName: "assinaturas_barbearia_id_fkey"
            columns: ["barbearia_id"]
            isOneToOne: true
            referencedRelation: "barbearias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assinaturas_barbearia_id_fkey"
            columns: ["barbearia_id"]
            isOneToOne: true
            referencedRelation: "barbearias_public"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          created_at: string | null
          id: string
          ip_address: unknown
          new_values: Json | null
          old_values: Json | null
          operation: string
          record_id: string | null
          table_name: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          ip_address?: unknown
          new_values?: Json | null
          old_values?: Json | null
          operation: string
          record_id?: string | null
          table_name: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          ip_address?: unknown
          new_values?: Json | null
          old_values?: Json | null
          operation?: string
          record_id?: string | null
          table_name?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      barbearias: {
        Row: {
          bairro: string | null
          cep: string | null
          cidade: string
          cores_personalizadas: Json | null
          created_at: string
          descricao: string | null
          email_contato: string | null
          endereco: string | null
          fidelidade_ativa: boolean
          gallery_urls: string[] | null
          id: string
          logo_url: string | null
          modo_tema: string | null
          nome: string
          notificacoes_ativa: boolean | null
          slug: string | null
          telefone: string | null
          updated_at: string
        }
        Insert: {
          bairro?: string | null
          cep?: string | null
          cidade: string
          cores_personalizadas?: Json | null
          created_at?: string
          descricao?: string | null
          email_contato?: string | null
          endereco?: string | null
          fidelidade_ativa?: boolean
          gallery_urls?: string[] | null
          id?: string
          logo_url?: string | null
          modo_tema?: string | null
          nome: string
          notificacoes_ativa?: boolean | null
          slug?: string | null
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          bairro?: string | null
          cep?: string | null
          cidade?: string
          cores_personalizadas?: Json | null
          created_at?: string
          descricao?: string | null
          email_contato?: string | null
          endereco?: string | null
          fidelidade_ativa?: boolean
          gallery_urls?: string[] | null
          id?: string
          logo_url?: string | null
          modo_tema?: string | null
          nome?: string
          notificacoes_ativa?: boolean | null
          slug?: string | null
          telefone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      categorias_servicos: {
        Row: {
          descricao: string | null
          id: string
          nome: string
        }
        Insert: {
          descricao?: string | null
          id?: string
          nome: string
        }
        Update: {
          descricao?: string | null
          id?: string
          nome?: string
        }
        Relationships: []
      }
      feedbacks: {
        Row: {
          agendamento_id: string
          anonimo: boolean | null
          barbearia_id: string
          comment: string | null
          created_at: string
          id: string
          rating: number | null
          responded_by: string | null
          response: string | null
          response_created_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          agendamento_id: string
          anonimo?: boolean | null
          barbearia_id: string
          comment?: string | null
          created_at?: string
          id?: string
          rating?: number | null
          responded_by?: string | null
          response?: string | null
          response_created_at?: string | null
          status?: string
          user_id: string
        }
        Update: {
          agendamento_id?: string
          anonimo?: boolean | null
          barbearia_id?: string
          comment?: string | null
          created_at?: string
          id?: string
          rating?: number | null
          responded_by?: string | null
          response?: string | null
          response_created_at?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "feedbacks_agendamento_id_fkey"
            columns: ["agendamento_id"]
            isOneToOne: true
            referencedRelation: "agendamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feedbacks_barbearia_id_fkey"
            columns: ["barbearia_id"]
            isOneToOne: false
            referencedRelation: "barbearias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feedbacks_barbearia_id_fkey"
            columns: ["barbearia_id"]
            isOneToOne: false
            referencedRelation: "barbearias_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feedbacks_responded_by_fkey"
            columns: ["responded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "feedbacks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      fidelidade: {
        Row: {
          barbearia_id: string
          cliente_telefone: string | null
          id: string
          pontos: number
          updated_at: string
          user_id: string
        }
        Insert: {
          barbearia_id: string
          cliente_telefone?: string | null
          id?: string
          pontos?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          barbearia_id?: string
          cliente_telefone?: string | null
          id?: string
          pontos?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fidelidade_barbearia_id_fkey"
            columns: ["barbearia_id"]
            isOneToOne: false
            referencedRelation: "barbearias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fidelidade_barbearia_id_fkey"
            columns: ["barbearia_id"]
            isOneToOne: false
            referencedRelation: "barbearias_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fidelidade_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      fidelidade_configuracoes: {
        Row: {
          barbearia_id: string
          created_at: string
          dias_expiracao: number | null
          id: string
          pontos_minimos_recompensa: number | null
          pontos_por_servico: number
          updated_at: string
        }
        Insert: {
          barbearia_id: string
          created_at?: string
          dias_expiracao?: number | null
          id?: string
          pontos_minimos_recompensa?: number | null
          pontos_por_servico?: number
          updated_at?: string
        }
        Update: {
          barbearia_id?: string
          created_at?: string
          dias_expiracao?: number | null
          id?: string
          pontos_minimos_recompensa?: number | null
          pontos_por_servico?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fidelidade_configuracoes_barbearia_id_fkey"
            columns: ["barbearia_id"]
            isOneToOne: true
            referencedRelation: "barbearias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fidelidade_configuracoes_barbearia_id_fkey"
            columns: ["barbearia_id"]
            isOneToOne: true
            referencedRelation: "barbearias_public"
            referencedColumns: ["id"]
          },
        ]
      }
      funcionario_ausencias: {
        Row: {
          barbearia_id: string
          created_at: string
          data_fim: string
          data_inicio: string
          funcionario_id: string
          id: string
          motivo: string | null
          tipo: string
          updated_at: string
        }
        Insert: {
          barbearia_id: string
          created_at?: string
          data_fim: string
          data_inicio: string
          funcionario_id: string
          id?: string
          motivo?: string | null
          tipo: string
          updated_at?: string
        }
        Update: {
          barbearia_id?: string
          created_at?: string
          data_fim?: string
          data_inicio?: string
          funcionario_id?: string
          id?: string
          motivo?: string | null
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "funcionario_ausencias_barbearia_id_fkey"
            columns: ["barbearia_id"]
            isOneToOne: false
            referencedRelation: "barbearias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funcionario_ausencias_barbearia_id_fkey"
            columns: ["barbearia_id"]
            isOneToOne: false
            referencedRelation: "barbearias_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funcionario_ausencias_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funcionario_ausencias_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios_public"
            referencedColumns: ["id"]
          },
        ]
      }
      funcionario_convites: {
        Row: {
          barbearia_id: string
          created_at: string
          created_by: string | null
          email: string
          expires_at: string
          funcionario_data: Json
          id: string
          token: string | null
          updated_at: string
          usado: boolean
        }
        Insert: {
          barbearia_id: string
          created_at?: string
          created_by?: string | null
          email: string
          expires_at: string
          funcionario_data: Json
          id?: string
          token?: string | null
          updated_at?: string
          usado?: boolean
        }
        Update: {
          barbearia_id?: string
          created_at?: string
          created_by?: string | null
          email?: string
          expires_at?: string
          funcionario_data?: Json
          id?: string
          token?: string | null
          updated_at?: string
          usado?: boolean
        }
        Relationships: []
      }
      funcionario_pausas: {
        Row: {
          barbearia_id: string
          created_at: string
          data: string
          funcionario_id: string
          hora_fim: string
          hora_inicio: string
          id: string
          motivo: string | null
          updated_at: string
        }
        Insert: {
          barbearia_id: string
          created_at?: string
          data?: string
          funcionario_id: string
          hora_fim: string
          hora_inicio: string
          id?: string
          motivo?: string | null
          updated_at?: string
        }
        Update: {
          barbearia_id?: string
          created_at?: string
          data?: string
          funcionario_id?: string
          hora_fim?: string
          hora_inicio?: string
          id?: string
          motivo?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "funcionario_pausas_barbearia_id_fkey"
            columns: ["barbearia_id"]
            isOneToOne: false
            referencedRelation: "barbearias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funcionario_pausas_barbearia_id_fkey"
            columns: ["barbearia_id"]
            isOneToOne: false
            referencedRelation: "barbearias_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funcionario_pausas_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funcionario_pausas_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios_public"
            referencedColumns: ["id"]
          },
        ]
      }
      funcionarios: {
        Row: {
          barbearia_id: string
          created_at: string
          email: string | null
          especialidade: string | null
          id: string
          is_owner: boolean | null
          nivel: Database["public"]["Enums"]["nivel_permissao"]
          nome: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          barbearia_id: string
          created_at?: string
          email?: string | null
          especialidade?: string | null
          id?: string
          is_owner?: boolean | null
          nivel?: Database["public"]["Enums"]["nivel_permissao"]
          nome: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          barbearia_id?: string
          created_at?: string
          email?: string | null
          especialidade?: string | null
          id?: string
          is_owner?: boolean | null
          nivel?: Database["public"]["Enums"]["nivel_permissao"]
          nome?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "funcionarios_barbearia_id_fkey"
            columns: ["barbearia_id"]
            isOneToOne: false
            referencedRelation: "barbearias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funcionarios_barbearia_id_fkey"
            columns: ["barbearia_id"]
            isOneToOne: false
            referencedRelation: "barbearias_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funcionarios_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      horarios_funcionamento: {
        Row: {
          barbearia_id: string
          created_at: string
          dia_semana: number
          fechado: boolean
          hora_abre: string | null
          hora_fecha: string | null
          id: string
          updated_at: string
        }
        Insert: {
          barbearia_id: string
          created_at?: string
          dia_semana: number
          fechado?: boolean
          hora_abre?: string | null
          hora_fecha?: string | null
          id?: string
          updated_at?: string
        }
        Update: {
          barbearia_id?: string
          created_at?: string
          dia_semana?: number
          fechado?: boolean
          hora_abre?: string | null
          hora_fecha?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          barbearia_id: string | null
          consentimento_marketing: boolean | null
          created_at: string
          id: string
          name: string
          phone: string | null
          receber_lembretes_email: boolean | null
          receber_lembretes_sms: boolean | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          barbearia_id?: string | null
          consentimento_marketing?: boolean | null
          created_at?: string
          id?: string
          name: string
          phone?: string | null
          receber_lembretes_email?: boolean | null
          receber_lembretes_sms?: boolean | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          barbearia_id?: string | null
          consentimento_marketing?: boolean | null
          created_at?: string
          id?: string
          name?: string
          phone?: string | null
          receber_lembretes_email?: boolean | null
          receber_lembretes_sms?: boolean | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      recompensas: {
        Row: {
          ativo: boolean
          barbearia_id: string
          created_at: string
          descricao: string | null
          id: string
          nome: string
          pontos_necessarios: number
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          barbearia_id: string
          created_at?: string
          descricao?: string | null
          id?: string
          nome: string
          pontos_necessarios: number
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          barbearia_id?: string
          created_at?: string
          descricao?: string | null
          id?: string
          nome?: string
          pontos_necessarios?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recompensas_barbearia_id_fkey"
            columns: ["barbearia_id"]
            isOneToOne: false
            referencedRelation: "barbearias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recompensas_barbearia_id_fkey"
            columns: ["barbearia_id"]
            isOneToOne: false
            referencedRelation: "barbearias_public"
            referencedColumns: ["id"]
          },
        ]
      }
      resgates_recompensas: {
        Row: {
          barbearia_id: string
          cliente_telefone: string
          data_resgate: string
          id: string
          pontos_utilizados: number
          recompensa_id: string
          status: string
        }
        Insert: {
          barbearia_id: string
          cliente_telefone: string
          data_resgate?: string
          id?: string
          pontos_utilizados: number
          recompensa_id: string
          status?: string
        }
        Update: {
          barbearia_id?: string
          cliente_telefone?: string
          data_resgate?: string
          id?: string
          pontos_utilizados?: number
          recompensa_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "resgates_recompensas_barbearia_id_fkey"
            columns: ["barbearia_id"]
            isOneToOne: false
            referencedRelation: "barbearias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resgates_recompensas_barbearia_id_fkey"
            columns: ["barbearia_id"]
            isOneToOne: false
            referencedRelation: "barbearias_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resgates_recompensas_recompensa_id_fkey"
            columns: ["recompensa_id"]
            isOneToOne: false
            referencedRelation: "recompensas"
            referencedColumns: ["id"]
          },
        ]
      }
      servicos: {
        Row: {
          barbearia_id: string
          categoria_id: string | null
          categoria_id_2: string | null
          created_at: string
          descricao: string | null
          duracao_minutos: number
          id: string
          nome: string
          updated_at: string
          valor: number
        }
        Insert: {
          barbearia_id: string
          categoria_id?: string | null
          categoria_id_2?: string | null
          created_at?: string
          descricao?: string | null
          duracao_minutos: number
          id?: string
          nome: string
          updated_at?: string
          valor: number
        }
        Update: {
          barbearia_id?: string
          categoria_id?: string | null
          categoria_id_2?: string | null
          created_at?: string
          descricao?: string | null
          duracao_minutos?: number
          id?: string
          nome?: string
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "fk_servicos_categoria_id"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias_servicos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_servicos_categoria_id_2"
            columns: ["categoria_id_2"]
            isOneToOne: false
            referencedRelation: "categorias_servicos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "servicos_barbearia_id_fkey"
            columns: ["barbearia_id"]
            isOneToOne: false
            referencedRelation: "barbearias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "servicos_barbearia_id_fkey"
            columns: ["barbearia_id"]
            isOneToOne: false
            referencedRelation: "barbearias_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "servicos_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias_servicos"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      barbearias_public: {
        Row: {
          cidade: string | null
          cores_personalizadas: Json | null
          endereco: string | null
          gallery_urls: string[] | null
          id: string | null
          logo_url: string | null
          modo_tema: string | null
          nome: string | null
          slug: string | null
          telefone: string | null
        }
        Insert: {
          cidade?: string | null
          cores_personalizadas?: Json | null
          endereco?: string | null
          gallery_urls?: string[] | null
          id?: string | null
          logo_url?: string | null
          modo_tema?: string | null
          nome?: string | null
          slug?: string | null
          telefone?: string | null
        }
        Update: {
          cidade?: string | null
          cores_personalizadas?: Json | null
          endereco?: string | null
          gallery_urls?: string[] | null
          id?: string | null
          logo_url?: string | null
          modo_tema?: string | null
          nome?: string | null
          slug?: string | null
          telefone?: string | null
        }
        Relationships: []
      }
      funcionarios_public: {
        Row: {
          barbearia_id: string | null
          id: string | null
          nome: string | null
        }
        Insert: {
          barbearia_id?: string | null
          id?: string | null
          nome?: string | null
        }
        Update: {
          barbearia_id?: string | null
          id?: string | null
          nome?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "funcionarios_barbearia_id_fkey"
            columns: ["barbearia_id"]
            isOneToOne: false
            referencedRelation: "barbearias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funcionarios_barbearia_id_fkey"
            columns: ["barbearia_id"]
            isOneToOne: false
            referencedRelation: "barbearias_public"
            referencedColumns: ["id"]
          },
        ]
      }
      servicos_public: {
        Row: {
          barbearia_id: string | null
          descricao: string | null
          duracao_minutos: number | null
          id: string | null
          nome: string | null
          valor: number | null
        }
        Insert: {
          barbearia_id?: string | null
          descricao?: string | null
          duracao_minutos?: number | null
          id?: string | null
          nome?: string | null
          valor?: number | null
        }
        Update: {
          barbearia_id?: string | null
          descricao?: string | null
          duracao_minutos?: number | null
          id?: string | null
          nome?: string | null
          valor?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "servicos_barbearia_id_fkey"
            columns: ["barbearia_id"]
            isOneToOne: false
            referencedRelation: "barbearias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "servicos_barbearia_id_fkey"
            columns: ["barbearia_id"]
            isOneToOne: false
            referencedRelation: "barbearias_public"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      accept_employee_invite: {
        Args: { employee_password: string; invite_token: string }
        Returns: Json
      }
      barbearia_tem_assinatura_ativa: {
        Args: { p_barbearia_id: string }
        Returns: boolean
      }
      check_anonymous_appointment_limit: {
        Args: { telefone_cliente: string; user_id_param?: string }
        Returns: boolean
      }
      check_funcionario_disponibilidade: {
        Args: { p_data_hora: string; p_funcionario_id: string }
        Returns: boolean
      }
      check_if_user_exists: {
        Args: { p_email: string; p_phone: string }
        Returns: Json
      }
      check_rate_limit: {
        Args: { operation_type: string; user_identifier: string }
        Returns: boolean
      }
      delete_user_complete: { Args: { user_email: string }; Returns: Json }
      generate_slug: { Args: { "": string }; Returns: string }
      get_anonymous_appointment_limit: { Args: never; Returns: number }
      get_assinatura_ativa: { Args: { p_barbearia_id: string }; Returns: Json }
      get_current_user_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      get_default_funcionario: {
        Args: { barbearia_uuid: string }
        Returns: string
      }
      get_public_profile_info: {
        Args: { profile_user_ids: string[] }
        Returns: {
          name: string
          role: Database["public"]["Enums"]["user_role"]
          user_id: string
        }[]
      }
      get_recompensas_disponiveis: {
        Args: { p_barbearia_id: string; p_cliente_telefone: string }
        Returns: Json
      }
      get_user_barbearia_id:
        | { Args: never; Returns: string }
        | { Args: { user_uuid: string }; Returns: string }
      get_user_profile_cached: {
        Args: never
        Returns: {
          barbearia_id: string
          role: Database["public"]["Enums"]["user_role"]
          user_id: string
        }[]
      }
      get_user_role: {
        Args: { user_uuid: string }
        Returns: Database["public"]["Enums"]["user_role"]
      }
      resgatar_recompensa: {
        Args: {
          p_barbearia_id: string
          p_cliente_telefone: string
          p_recompensa_id: string
        }
        Returns: Json
      }
      user_can_access_barbearia: {
        Args: {
          required_roles: Database["public"]["Enums"]["user_role"][]
          target_barbearia_id: string
        }
        Returns: boolean
      }
      user_is_admin_of_barbearia: {
        Args: { check_barbearia_id: string }
        Returns: boolean
      }
      user_is_staff_of_barbearia: {
        Args: { check_barbearia_id: string }
        Returns: boolean
      }
    }
    Enums: {
      agendamento_status: "pendente" | "confirmado" | "cancelado" | "finalizado"
      metodo_pagamento:
        | "cartao_credito"
        | "cartao_debito"
        | "pix"
        | "boleto"
        | "transferencia"
      nivel_permissao: "funcionario" | "gerente" | "dono"
      status_assinatura:
        | "ativa"
        | "cancelada"
        | "suspensa"
        | "vencida"
        | "teste"
      tipo_plano: "basico" | "premium" | "empresarial"
      user_role: "cliente" | "admin" | "funcionario"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      agendamento_status: ["pendente", "confirmado", "cancelado", "finalizado"],
      metodo_pagamento: [
        "cartao_credito",
        "cartao_debito",
        "pix",
        "boleto",
        "transferencia",
      ],
      nivel_permissao: ["funcionario", "gerente", "dono"],
      status_assinatura: ["ativa", "cancelada", "suspensa", "vencida", "teste"],
      tipo_plano: ["basico", "premium", "empresarial"],
      user_role: ["cliente", "admin", "funcionario"],
    },
  },
} as const
