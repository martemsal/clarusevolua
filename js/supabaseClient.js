/**
 * CLARUS EVOLUA - Supabase Data Layer
 * Este arquivo fará a ponte entre o seu Front-end e o Banco de Dados em nuvem.
 */

// Cole suas credenciais do Supabase aqui (Menu Project Settings > API)
const SUPABASE_URL = 'https://lfnnxuoqmzvxzlzesvkk.supabase.co'; 
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxmbm54dW9xbXp2eHpsemVzdmtrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc2MjYzNDQsImV4cCI6MjA5MzIwMjM0NH0.BwYMSA9h6faAMW3hmo50ta5Ev9dwGBY0Y_7z-dkDFCY';

// Inicializa a interface global imediatamente para evitar erros de "undefined" em outros scripts
window.db = {};

// Inicializa o cliente do Supabase
let _supabaseClient;
try {
    if (window.supabase) {
        _supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        console.log("✅ [Supabase] Cliente inicializado.");
    } else {
        console.error("❌ [Supabase] CDN não foi carregada no index.html!");
    }
} catch (e) {
    console.error("❌ [Supabase] Erro crítico na inicialização:", e);
}

Object.assign(window.db, {
    // --- GESTÃO DE CLIENTES (COMPANIES) ---
    async getCompanies() {
        if (!_supabaseClient) return [];
        const { data, error } = await _supabaseClient
            .from('companies')
            .select('*');
        if (error) {
            console.error("❌ [Supabase] Erro ao buscar empresas:", error);
            return [];
        }
        return data || [];
    },

    async saveCompany(comp) {
        if (!_supabaseClient) return { success: false, error: "Supabase client not initialized" };
        console.log("📤 [Supabase] Tentando salvar empresa:", comp.id);
        
        // Sanitização e Preparação
        const payload = {
            id: String(comp.id),
            name: String(comp.name),
            password: String(comp.password || ""),
            level: parseInt(comp.level) || 1,
            capital_social: parseFloat(comp.capitalSocial) || 0,
            modules: Array.isArray(comp.modules) ? comp.modules : [],
            banks: Array.isArray(comp.banks) ? comp.banks : [],
            files: Array.isArray(comp.files) ? comp.files : []
        };

        const { data, error } = await _supabaseClient
            .from('companies')
            .upsert(payload, { onConflict: 'id' });
            
        if (error) {
            console.error("❌ [Supabase] Erro detalhado no upsert:", error);
            return { success: false, error: error.message || JSON.stringify(error) };
        }
        console.log("✅ [Supabase] Empresa sincronizada com sucesso.");
        return { success: true };
    },

    async deleteCompany(id) {
        const { error } = await _supabaseClient
            .from('companies')
            .delete()
            .eq('id', id);
            
        if (error) {
            console.error("❌ [Supabase] Erro ao deletar empresa:", error);
            return { success: false, error: error.message };
        }
        return { success: true };
    },

    // --- DADOS FINANCEIROS (DRE e FLUXO) ---
    async getFinancialData(companyId, month, dataType) {
        const { data, error } = await _supabaseClient
            .from('financial_data')
            .select('payload')
            .eq('company_id', companyId)
            .eq('month', month)
            .eq('data_type', dataType)
            .single();
            
        if (error && error.code !== 'PGRST116') { // PGRST116 = Nenhum registro encontrado
            console.error("Erro ao buscar dados financeiros:", error);
            return null;
        }
        return data ? data.payload : null;
    },

    async getAllFinancialData(companyId) {
        const { data, error } = await _supabaseClient
            .from('financial_data')
            .select('*')
            .eq('company_id', companyId);
            
        if (error) {
            console.error("Erro ao buscar todos dados financeiros:", error);
            return [];
        }
        return data || [];
    },

    async saveFinancialData(companyId, month, dataType, payload) {
        const { error } = await _supabaseClient
            .from('financial_data')
            .upsert({
                company_id: companyId,
                month: month,
                data_type: dataType,
                payload: payload
            }, { onConflict: 'company_id, month, data_type' });
            
        if (error) console.error("Erro ao salvar dados financeiros:", error);
        return !error;
    },

    async deleteFinancialData(companyId, month) {
        const { error } = await _supabaseClient
            .from('financial_data')
            .delete()
            .eq('company_id', companyId)
            .eq('month', month);
        if (error) console.error("Erro ao deletar dados:", error);
        return !error;
    },

    // --- NOTIFICAÇÕES ---
    async getNotifications(companyId) {
        const { data, error } = await _supabaseClient
            .from('notifications')
            .select('*')
            .eq('company_id', companyId)
            .order('created_at', { ascending: false });
            
        if (error) {
            console.error("Erro ao buscar notificações:", error);
            return [];
        }
        return data || [];
    },

    async sendNotification(companyId, text) {
        const { error } = await _supabaseClient
            .from('notifications')
            .insert({
                company_id: companyId,
                text: text,
                read: false
            });
            
        if (error) console.error("Erro ao enviar notificação:", error);
        return !error;
    },

    // --- CONFIGURAÇÕES GLOBAIS (API KEYS, BRANDING) ---
    async getSettings(id) {
        if (!_supabaseClient) return null;
        const { data, error } = await _supabaseClient
            .from('system_config')
            .select('value')
            .eq('id', id)
            .single();
        if (error && error.code !== 'PGRST116') {
            console.error("Erro ao buscar config:", error);
            return null;
        }
        return data ? data.value : null;
    },

    async saveSettings(id, value) {
        if (!_supabaseClient) return false;
        const { error } = await _supabaseClient
            .from('system_config')
            .upsert({ id, value }, { onConflict: 'id' });
        if (error) console.error("Erro ao salvar config:", error);
        return !error;
    }
});
