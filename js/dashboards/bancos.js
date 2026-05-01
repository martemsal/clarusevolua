window.initBancos = function () {
    const container = document.getElementById('view-bancos');

    const formatBRL = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

    const pSelect = document.getElementById('period-select');
    const month = pSelect ? pSelect.value : '2026-07';

    // OFX and bank transactions are transactional (Cash Basis), so we MUST prioritize the Fluxo/Vencimento cluster
    const clusterFluxo = window.clarusDataFluxo || {};
    const clusterDRE = window.clarusDataDRE || window.clarusDataLevel1 || {};

    // Merge both, with Fluxo data (real bank movements) taking priority
    const bankData = { ...(clusterDRE.bancos || {}), ...(clusterFluxo.bancos || {}) };

    let registeredBanks = [];
    if (window.currentUserId && window.currentUserId !== "admin") {
        let companies = JSON.parse(localStorage.getItem('clarusCompanies') || '[]');
        const client = companies.find(c => c.id === window.currentUserId);
        if (client && client.banks) registeredBanks = client.banks;
    } else {
        // Fallback admin view
        registeredBanks = ['Itaú Unibanco', 'Caixa Econômica'];
    }

    // Combine registered banks with any unmapped banks found in the CSV data
    let banksToRender = [];
    const colorPalette = ['#f97316', '#ef4444', '#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#6366f1'];

    const getHistoricalBalance = (bankName, targetMonthStr) => {
        const viewingId = localStorage.getItem('clarusAdminViewingId') || window.currentUserId || localStorage.getItem('clarusSessionId');
        if (!viewingId || viewingId === "admin") return { balance: 0, hasHistory: false };

        let availableMonths = new Set();
        for (let i = 0; i < localStorage.length; i++) {
            let key = localStorage.key(i);
            const prefixFluxo = `clarusDataVenc_${viewingId}_`;
            const prefixDRE = `clarusData_${viewingId}_`;
            if (key && (key.startsWith(prefixFluxo) || key.startsWith(prefixDRE))) {
                let m = key.replace(prefixFluxo, '').replace(prefixDRE, '');
                if (m.length === 7 && m < targetMonthStr) {
                    availableMonths.add(m);
                }
            }
        }

        let initialSetupBalance = 0;
        let companies = JSON.parse(localStorage.getItem('clarusCompanies') || '[]');
        const client = companies.find(c => c.id === viewingId);
        if (client && client.banks) {
            const bSetup = client.banks.find(bk => (typeof bk === 'object' ? bk.name : bk).toLowerCase() === bankName.toLowerCase());
            if (bSetup && typeof bSetup === 'object') initialSetupBalance = bSetup.initial || 0;
        }

        const sortedMonths = Array.from(availableMonths).sort();
        if (sortedMonths.length === 0) return { balance: initialSetupBalance, hasHistory: initialSetupBalance !== 0 };

        let rollingBalance = initialSetupBalance;
        let hasData = false;

        for (let m of sortedMonths) {
            // Priority: Fluxo (Transactional/OFX) then DRE (Accounting)
            let raw = localStorage.getItem(`clarusDataVenc_${viewingId}_${m}`);
            let dVenc = raw ? JSON.parse(raw) : null;
            let dDRE = JSON.parse(localStorage.getItem(`clarusData_${viewingId}_${m}`) || '{}');

            const bVenc = (dVenc && dVenc.bancos) ? dVenc.bancos : {};
            const bDRE = dDRE.bancos || {};

            const bKeyVenc = Object.keys(bVenc).find(k => k.toLowerCase() === bankName.toLowerCase());
            const bKeyDRE = Object.keys(bDRE).find(k => k.toLowerCase() === bankName.toLowerCase());

            if (bKeyVenc || bKeyDRE) {
                hasData = true;
                const ent = (bVenc[bKeyVenc]?.entradas || bDRE[bKeyDRE]?.entradas || 0);
                const sai = (bVenc[bKeyVenc]?.saidas || bDRE[bKeyDRE]?.saidas || 0);
                rollingBalance += (ent - sai);
            }
        }
        return { balance: rollingBalance, hasHistory: hasData || initialSetupBalance !== 0 };
    };

    // Add all registered banks first
    registeredBanks.forEach((bItem, idx) => {
        let bName = typeof bItem === 'string' ? bItem : bItem.name;
        let baseInitial = typeof bItem === 'string' ? null : (bItem.initial !== undefined ? bItem.initial : null);

        let credit = 0; let debit = 0; let initial = baseInitial !== null ? baseInitial : 0;
        // Search in CSV bankData (Fuzzy Match: se um contém o outro)
        const csvKey = Object.keys(bankData).find(k => {
            const kLow = k.toLowerCase();
            const bLow = bName.toLowerCase();
            return kLow === bLow || kLow.includes(bLow) || bLow.includes(kLow);
        });
        if (csvKey) {
            credit = bankData[csvKey].entradas || 0;
            debit = bankData[csvKey].saidas || 0;
            if (bankData[csvKey].saldo_inicial !== undefined && baseInitial === null) {
                initial = bankData[csvKey].saldo_inicial;
            }
        }

        const hist = getHistoricalBalance(bName, month);
        if (hist.hasHistory) {
            initial = hist.balance;
        } else if (baseInitial !== null) {
            initial = baseInitial; // Força no mês 0
        }

        banksToRender.push({
            name: bName,
            type: 'Conta Mapeada',
            initial: initial,
            credit,
            debit,
            color: colorPalette[idx % colorPalette.length]
        });
    });

    // Se estiver tudo vazio, coloca um placeholder
    if (banksToRender.length === 0) {
        banksToRender.push({
            name: 'Sem Contas Cadastradas',
            type: '-',
            initial: 0, credit: 0, debit: 0, color: '#64748b'
        });
    }

    const banksHtml = banksToRender.map(b => {
        const final = b.initial + b.credit - b.debit;
        return `
            <div class="card bank-card" data-bank="${b.name}" style="display: flex; flex-direction: column; justify-content: space-between; cursor: pointer; transition: all 0.3s ease;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 2rem; padding-bottom: 1rem; border-bottom: 1px solid var(--border-color);">
                    <div style="display: flex; gap: 1rem; align-items: center;">
                        <div style="width: 50px; height: 50px; border-radius: 12px; background: rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; font-size: 1.5rem; color: ${b.color}; border: 1px solid rgba(255,255,255,0.05);">
                            <i class="fa-solid fa-building-columns"></i>
                        </div>
                        <div>
                            <h4 style="margin: 0; font-size: 1.1rem; color: white;">${b.name}</h4>
                            <span style="font-size: 0.8rem; color: var(--text-secondary);">${b.type}</span>
                        </div>
                    </div>
                </div>
                
                <div style="margin-bottom: 2rem;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 1rem;">
                        <span style="font-size: 0.85rem; color: var(--text-secondary);">Saldo Inicial</span>
                        <span style="font-size: 1rem; font-weight: 500; color: white;">${formatBRL(b.initial)}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                        <span style="font-size: 0.85rem; color: var(--text-secondary);">Entradas (C)</span>
                        <span style="font-size: 1rem; font-weight: 600; color: var(--status-success);"><i class="fa-solid fa-arrow-up" style="font-size: 0.8rem;"></i> ${formatBRL(b.credit)}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between;">
                        <span style="font-size: 0.85rem; color: var(--text-secondary);">Saídas (D)</span>
                        <span style="font-size: 1rem; font-weight: 600; color: var(--status-danger);"><i class="fa-solid fa-arrow-down" style="font-size: 0.8rem;"></i> ${formatBRL(b.debit)}</span>
                    </div>
                </div>
                
                <div style="background: rgba(0,0,0,0.2); padding: 1.25rem; border-radius: 8px; display: flex; justify-content: space-between; align-items: center; border-left: 4px solid ${b.color}; margin-top: auto;">
                    <span style="font-weight: 500; font-size: 0.9rem; color: var(--text-secondary);">Saldo Final</span>
                    <span style="font-size: 1.5rem; font-weight: 700; color: white;">${formatBRL(final)}</span>
                </div>
            </div>
        `;
    }).join('');

    container.innerHTML = `
        <div class="grid-container grid-cols-4" id="bancos-top-metrics" style="margin-bottom: 2.5rem;">
            <!-- Rendered dynamically -->
        </div>

        <h3 style="margin-bottom: 1.5rem; color: var(--text-primary); display: flex; align-items: center; gap: 0.5rem;">
            <i class="fa-solid fa-building-columns" style="color: var(--accent-purple);"></i> Detalhamento por Conta Bancária
            <span id="btn-clear-bank-filter" style="display: none; font-size: 0.75rem; font-weight: normal; background: rgba(255,255,255,0.1); padding: 4px 8px; border-radius: 4px; cursor: pointer; border: 1px solid var(--accent-purple); color: var(--accent-purple); margin-left: 1rem;"><i class="fa-solid fa-xmark"></i> Remover Filtro</span>
        </h3>
        <div class="grid-container grid-cols-2">
            ${banksHtml}
        </div>
    `;

    const renderTopMetrics = (selectedBank = null) => {
        let tInit = 0; let tCred = 0; let tDeb = 0; let tFin = 0;
        const filtered = selectedBank ? banksToRender.filter(b => b.name === selectedBank) : banksToRender;
        filtered.forEach(b => {
            tInit += b.initial; tCred += b.credit; tDeb += b.debit;
            tFin += (b.initial + b.credit - b.debit);
        });

        const metricsContainer = document.getElementById('bancos-top-metrics');
        if (metricsContainer) {
            metricsContainer.innerHTML = `
                <div class="card">
                    <div class="metric-header">
                        <span class="metric-title">${selectedBank ? 'Saldo Inicial (' + selectedBank + ')' : 'Saldo Inicial Total'}</span>
                        <div class="metric-icon blue"><i class="fa-solid fa-piggy-bank"></i></div>
                    </div>
                    <div class="metric-value">${formatBRL(tInit)}</div>
                    <div class="metric-trend">
                        <span class="trend-text">Consolidado bancário início do mês</span>
                    </div>
                </div>
                <div class="card highlight-green">
                    <div class="metric-header">
                        <span class="metric-title">${selectedBank ? 'Entradas (' + selectedBank + ')' : 'Total de Entradas (C)'}</span>
                        <div class="metric-icon green"><i class="fa-solid fa-arrow-turn-down fa-rotate-90"></i></div>
                    </div>
                    <div class="metric-value positive">+ ${formatBRL(tCred)}</div>
                    <div class="metric-trend">
                        <span class="trend-text">Receitas e aportes do mês</span>
                    </div>
                </div>
                <div class="card">
                    <div class="metric-header">
                        <span class="metric-title">${selectedBank ? 'Saídas (' + selectedBank + ')' : 'Total de Saídas (D)'}</span>
                        <div class="metric-icon red"><i class="fa-solid fa-arrow-turn-up fa-rotate-90"></i></div>
                    </div>
                    <div class="metric-value negative">- ${formatBRL(tDeb)}</div>
                    <div class="metric-trend">
                        <span class="trend-text">Pagamentos e retiradas</span>
                    </div>
                </div>
                <div class="card highlight-gold" style="border: 1px solid var(--accent-gold);">
                    <div class="metric-header">
                        <span class="metric-title" style="color: var(--accent-gold);">${selectedBank ? 'Saldo Final (' + selectedBank + ')' : 'Saldo Final Consolidado'}</span>
                        <div class="metric-icon gold"><i class="fa-solid fa-wallet"></i></div>
                    </div>
                    <div class="metric-value" style="color: var(--accent-gold);">${formatBRL(tFin)}</div>
                    <div class="metric-trend">
                        <i class="fa-solid fa-check" style="color: var(--accent-gold)"></i>
                        <span class="trend-up" style="color: var(--accent-gold)">Caixa equilibrado</span>
                    </div>
                </div>
             `;
        }
    };

    renderTopMetrics(); // Initial render

    let currentFilter = null;
    const bankCards = document.querySelectorAll('.bank-card');
    const btnClear = document.getElementById('btn-clear-bank-filter');

    bankCards.forEach(card => {
        card.addEventListener('click', () => {
            const bName = card.getAttribute('data-bank');
            if (currentFilter === bName) {
                currentFilter = null;
                renderTopMetrics();
                bankCards.forEach(c => { c.style.opacity = '1'; c.style.border = ''; });
                if (btnClear) btnClear.style.display = 'none';
            } else {
                currentFilter = bName;
                renderTopMetrics(bName);
                bankCards.forEach(c => {
                    if (c.getAttribute('data-bank') === bName) {
                        c.style.opacity = '1';
                        c.style.border = '1px solid var(--accent-purple)';
                    } else {
                        c.style.opacity = '0.4';
                        c.style.border = '';
                    }
                });
                if (btnClear) btnClear.style.display = 'inline-block';
            }
        });
    });

    if (btnClear) {
        btnClear.addEventListener('click', () => {
            currentFilter = null;
            renderTopMetrics();
            bankCards.forEach(c => { c.style.opacity = '1'; c.style.border = ''; });
            btnClear.style.display = 'none';
        });
    }
};
