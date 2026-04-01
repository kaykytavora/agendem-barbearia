# Database Scripts

## 📁 Estrutura

```
database/
├── policies/           # Políticas RLS ativas
│   └── profiles_rls_active.sql
└── README.md          # Este arquivo
```

## 🚀 Como Usar

### Aplicar Políticas RLS dos Profiles
Execute o arquivo completo no Supabase SQL Editor:
```sql
-- Execute todo o conteúdo de:
database/policies/profiles_rls_active.sql
```

## ✅ Status das Políticas

- **profiles_rls_active.sql** - ✅ FUNCIONANDO
- **Testado em:** 2025-09-25
- **Erro 500:** ❌ Resolvido

## 🔧 Funcionalidades

### Permissões por Tipo de Usuário:

**🟢 CLIENTES**
- ✅ Visualizar próprio perfil
- ✅ Editar próprio perfil

**🟡 FUNCIONÁRIOS**
- ✅ Visualizar próprio perfil
- ✅ Editar próprio perfil
- ✅ Visualizar perfis da mesma barbearia

**🔴 ADMINS**
- ✅ Visualizar próprio perfil
- ✅ Editar próprio perfil
- ✅ Visualizar perfis da mesma barbearia
- ✅ Editar perfis da mesma barbearia

**⚙️ SYSTEM (Service Role)**
- ✅ Acesso completo

## 🛡️ Segurança

- Funções PL/pgSQL evitam subqueries recursivas
- Validação de `barbearia_id` não nulo
- Índices otimizados para performance
- Políticas testadas individualmente