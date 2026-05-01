const defaultLevel1Data = {
    // Saúde Financeira (Baseado no CSV Level 1)
    "receita_total": 0.0,
    "impostos": 0.0,
    "custos": 0.0,
    "despesas_operacionais": 0.0,
    "lucro_liquido": 0.0,

    // Fluxo de Caixa (Derivado/Simulado com base no CSV)
    "saldo_atual": 0.0,
    "a_receber_mes": 0.0,
    "a_pagar_mes": 0.0,
    "projecao_final": 0.0,
    "projecao_mensal": [0, 0, 0, 0, 0, 0],
    "compromissos": [],

    // Crescimento Empresarial (Proporcional ao atual)
    "evolucao_receita_ytd": 0,
    "evolucao_lucro_ytd": 0,
    "produtividade_func": 0.0,
    "custo_operacional_pct": 0.0,
    "receita_historico": [0, 0, 0, 0, 0, 0],
    "custo_historico": [0, 0, 0, 0, 0, 0],

    // Contas e Bancos
    "bancos": {}
};

const loadClarusData = (regime = 'emissao') => {
    const pSelect = document.getElementById('period-select');
    // Standardized month resolution: activeMonth from storage > period-select > Jan 2026
    const month = pSelect ? pSelect.value : (localStorage.getItem('clarusActiveMonth') || '2026-01');

    // Standardized viewingId acquisition
    const viewingId = localStorage.getItem('clarusAdminViewingId') || window.currentUserId || localStorage.getItem('clarusSessionId');

    const prefix = regime === 'vencimento' ? 'clarusDataVenc_' : 'clarusData_';
    const dataKey = `${prefix}${viewingId}_${month}`;
    let stored = localStorage.getItem(dataKey);

    if (viewingId && viewingId !== 'admin' && stored) {
        return JSON.parse(stored);
    } else {
        // Se for admin puro sem cliente, ou não houver dados, retorna estrutura zerada
        // Fallback: If Vencimento requested but not found, check Emissao (Optional benefit)
        if (regime === 'vencimento') {
            const fallbackKey = `clarusData_${viewingId}_${month}`;
            const fallbackStr = localStorage.getItem(fallbackKey);
            if (fallbackStr) return JSON.parse(fallbackStr);
        }

        // Return zeroed structure
        let zeroed = JSON.parse(JSON.stringify(defaultLevel1Data));
        zeroed.receita_total = 0;
        zeroed.despesas_operacionais = 0;
        zeroed.impostos = 0;
        zeroed.custos = 0;
        zeroed.saldo_atual = 0;
        zeroed.bancos = {};
        return zeroed;
    }
};

// Initial Data Load for both regimes
window.clarusDataDRE = loadClarusData('emissao');
window.clarusDataFluxo = loadClarusData('vencimento');
window.clarusDataLevel1 = window.clarusDataDRE; // Legacy compatibility

window.populateMonthSelector = () => {
    const pSelect = document.getElementById('period-select');
    if (!pSelect) return;

    const viewingId = localStorage.getItem('clarusAdminViewingId') || window.currentUserId || localStorage.getItem('clarusSessionId');
    if (!viewingId || viewingId === 'admin') return;

    const months = new Set();
    // Default months if empty
    months.add('2026-01');
    months.add('2026-02');
    months.add('2026-03');
    months.add('2026-04');
    months.add('2026-05');
    months.add('2026-06');
    months.add('2026-07');

    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key.includes(`_${viewingId}_`)) {
            const parts = key.split('_');
            const m = parts[parts.length - 1];
            if (m.match(/^\d{4}-\d{2}$/)) months.add(m);
        }
    }

    const sortedMonths = Array.from(months).sort().reverse();
    const currentVal = pSelect.value || localStorage.getItem('clarusActiveMonth');

    pSelect.innerHTML = '';
    const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

    sortedMonths.forEach(m => {
        const opt = document.createElement('option');
        opt.value = m;
        const [y, mm] = m.split('-');
        opt.textContent = `${monthNames[parseInt(mm) - 1]} ${y}`;
        pSelect.appendChild(opt);
    });

    if (currentVal && months.has(currentVal)) {
        pSelect.value = currentVal;
    }
};

window.refreshDashboardsWithData = () => {
    window.populateMonthSelector(); // Update selector first
    window.clarusDataDRE = loadClarusData('emissao');
    window.clarusDataFluxo = loadClarusData('vencimento');
    window.clarusDataLevel1 = window.clarusDataDRE;

    if (!document.getElementById('app-screen').classList.contains('hidden')) {
        const activeItem = document.querySelector('.nav-item.active');
        if (activeItem) {
            const target = activeItem.getAttribute('data-target');
            const initFnName = 'init' + target.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('');
            if (typeof window[initFnName] === 'function') {
                window[initFnName]();
            } else if (target === 'saude-financeira' && typeof window.initSaudeFinanceira === 'function') {
                window.initSaudeFinanceira();
            } else if (target === 'fluxo-caixa' && typeof window.initFluxoCaixa === 'function') {
                window.initFluxoCaixa();
            }
        }
    }
};

window.addEventListener('clarusDataUpdated', () => {
    window.refreshDashboardsWithData();
});

// Run once on load
document.addEventListener('DOMContentLoaded', () => {
    // Sincroniza ID do usuário imediatamente se houver sessão
    if (!window.currentUserId) {
        window.currentUserId = localStorage.getItem('clarusAdminViewingId') || localStorage.getItem('clarusSessionId');
    }
    window.populateMonthSelector();
    window.refreshDashboardsWithData(); // Garante carga inicial no F5
});
