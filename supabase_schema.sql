-- Script de Inicialização de Banco de Dados Supabase para CLARUS EVOLUA
-- Copie todo este conteúdo e cole no "SQL Editor" do painel do Supabase e clique em "Run"

-- 1. Tabela de Clientes (Companies)
CREATE TABLE public.companies (
    id text PRIMARY KEY,
    name text NOT NULL,
    password text,
    level integer DEFAULT 1,
    capital_social numeric DEFAULT 0,
    modules jsonb DEFAULT '[]'::jsonb,
    banks jsonb DEFAULT '[]'::jsonb,
    files jsonb DEFAULT '[]'::jsonb,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Tabela de Dados Financeiros (Armazenamento em Nuvem via JSONB)
CREATE TABLE public.financial_data (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id text REFERENCES public.companies(id) ON DELETE CASCADE,
    month text NOT NULL, -- Ex: '2026-07'
    data_type text NOT NULL, -- 'dre' (clarusData_) ou 'fluxo' (clarusDataVenc_)
    payload jsonb NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(company_id, month, data_type) -- Para podermos usar UPSERT (atualizar se existir)
);

-- 3. Tabela de Notificações / Histórico de Mensagens
CREATE TABLE public.notifications (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id text REFERENCES public.companies(id) ON DELETE CASCADE,
    text text NOT NULL,
    read boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Configurações de Segurança de Nível de Linha (RLS - Row Level Security)
-- Como estamos fazendo um MVP/Protótipo para apresentação, 
-- vamos permitir acesso total anonimamente para facilitar a integração via frontend Javascript.
-- Em produção real, você deverá restringir isso usando a autenticação do próprio Supabase.

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir acesso total publico companies" ON public.companies FOR ALL USING (true);
CREATE POLICY "Permitir acesso total publico financial" ON public.financial_data FOR ALL USING (true);
CREATE POLICY "Permitir acesso total publico notifications" ON public.notifications FOR ALL USING (true);
