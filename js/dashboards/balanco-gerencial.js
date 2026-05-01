// Balanço Gerencial Module
window.initBalancoGerencial = (month) => {
    const container = document.getElementById('view-balanco-gerencial');
    if (!container) return;

    if (!month) {
        const pSelect = document.getElementById('period-select');
        month = pSelect ? pSelect.value : (localStorage.getItem('clarusActiveMonth') || '2026-07');
    }

    const dataKeyEmi = `clarusData_${window.currentUserId}_${month}`;
    const dataKeyVen = `clarusDataVenc_${window.currentUserId}_${month}`;

    const dreData = JSON.parse(localStorage.getItem(dataKeyEmi) || '{}');
    const fluxData = JSON.parse(localStorage.getItem(dataKeyVen) || '{}');
    const baseData = dreData; // Para compatibilidade com chaves de estoque

    // --- SCANNER 360 (UNIFICAÇÃO PARA CATEGORIZAÇÃO) ---
    const unifiedMap = new Map();
    [...(dreData.compromissos || []), ...(fluxData.compromissos || [])].forEach(c => {
        const key = `${(c.titulo || "").toString().trim()}_${c.valor}_${c.data}`;
        if (!unifiedMap.has(key)) unifiedMap.set(key, c);
    });
    const list = Array.from(unifiedMap.values());

    const companies = JSON.parse(localStorage.getItem('clarusCompanies') || '[]');
    const currentComp = companies.find(c => c.id === window.currentUserId) || {};

    const currentMode = localStorage.getItem('balancoViewMode') || 'mensal';

    // Helper: Cumulative Profit calculation
    const getAccumulatedNumbers = (targetMonth, mode) => {
        let profit = 0;
        let [yy, mm] = targetMonth.split('-').map(Number);
        let startMonth = 1;
        if (mode === 'trimestre') startMonth = Math.floor((mm - 1) / 3) * 3 + 1;
        else if (mode === 'semestre') startMonth = mm <= 6 ? 1 : 7;
        else if (mode === 'anual') startMonth = 1;

        for (let i = startMonth; i <= mm; i++) {
            const mStr = i.toString().padStart(2, '0');
            const kE = `clarusData_${window.currentUserId}_${yy}-${mStr}`;
            const kV = `clarusDataVenc_${window.currentUserId}_${yy}-${mStr}`;
            const dE = JSON.parse(localStorage.getItem(kE) || '{}');
            const dV = JSON.parse(localStorage.getItem(kV) || '{}');
            // Lucro calculado de forma unificada
            const mRec = Math.max(dE.receita_total || 0, dV.receita_total || 0, dE.a_receber_mes || 0, dV.a_receber_mes || 0);
            const mPag = Math.max(dE.a_pagar_mes || 0, dV.a_pagar_mes || 0);
            profit += (mRec - mPag);
        }
        return { profit };
    };

    // Helper: Get Consolidated Bank balances
    const getConsolidatedBanks = (targetMonth) => {
        let total = 0, apps = 0;
        let allBanks = (currentComp.banks || []).map(b => (typeof b === 'object' ? b.name : b));

        allBanks.forEach(bName => {
            let rolling = 0;
            const bSetup = currentComp.banks.find(bk => (typeof bk === 'object' ? bk.name : bk).toLowerCase() === bName.toLowerCase());
            if (bSetup && typeof bSetup === 'object') rolling = bSetup.initial || 0;

            const yy = targetMonth.split('-')[0];
            const targetMM = parseInt(targetMonth.split('-')[1]);

            for (let m = 1; m <= targetMM; m++) {
                const mStr = m.toString().padStart(2, '0');
                const kE = `clarusData_${window.currentUserId}_${yy}-${mStr}`;
                const kV = `clarusDataVenc_${window.currentUserId}_${yy}-${mStr}`;
                const mDE = JSON.parse(localStorage.getItem(kE) || '{}');
                const mDV = JSON.parse(localStorage.getItem(kV) || '{}');

                const bDataE = mDE.bancos || {};
                const bDataV = mDV.bancos || {};
                const bSum = { ...bDataE, ...bDataV }; // Merge banks records

                const bKey = Object.keys(bSum).find(k => k.toLowerCase() === bName.toLowerCase());
                if (bKey) rolling += (bSum[bKey].entradas || 0) - (bSum[bKey].saidas || 0);
            }
            total += rolling;
            if (bName.toLowerCase().includes('investimento') || bName.toLowerCase().includes('fundo')) apps += rolling;
        });
        return { total, apps };
    };

    const bankConsolidated = getConsolidatedBanks(month);
    const totalCaixaBancos = bankConsolidated.total;
    const totalAplicacoes = bankConsolidated.apps;

    // --- INTEGRAÇÃO COM MÓDULOS REAIS ---
    const adminData = JSON.parse(localStorage.getItem('clarusAdminData') || '{}');
    const aReceberUnified = Math.max(dreData.a_receber_mes || 0, fluxData.a_receber_mes || 0);

    let estoqueTotal = 0;
    if (dreData.estoque_unidades) {
        estoqueTotal = Object.values(dreData.estoque_unidades).reduce((acc, u) => acc + (u.estoque_final || 0), 0);
    }

    let totalLoansVal = 0;
    if (adminData.loans) {
        totalLoansVal = Object.values(adminData.loans).reduce((acc, l) => acc + (parseFloat(l.total) || 0), 0);
    }

    const bMetrics = dreData.balanco || { ativo: {}, passivo: {} };
    const mAtivo = bMetrics.ativo || {};
    const mPassivo = bMetrics.passivo || {};

    const ativoData = {
        caixa_bancos: totalCaixaBancos,
        aplicacoes: totalAplicacoes,
        receber: aReceberUnified,
        inadimplencia: mAtivo.inadimplencia || 0,
        estoque: estoqueTotal,
        imobilizado: mAtivo.imobilizado || 0
    };

    const calculatedTotalAtivo = (ativoData.caixa_bancos + ativoData.receber + ativoData.estoque + ativoData.imobilizado) - ativoData.inadimplencia;

    // --- MOTOR DE CATEGORIZAÇÃO SINCRONIZADO (COMPLETO) ---
    const normalizer = (s) => (s || "").toString().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    const regexSimples = /\b(SIMPLES NACIONAL|DAS|DAS SIMPLES)\b/i;
    const regexEncargos = /\b(FGTS|INSS|GPS|LABORE)\b/i;
    const regexTributos = /\b(ICMS|PIS|COFINS|IRPJ|CSLL|IPI|DARF|DARE|IBS|CBS|ISS|IPTU|TRIBUTO|IMPOSTO)\b/i;
    const regexProLabore = /\b(PRO-LABORE|PROLABORE)\b/i;
    const regexFolha = /\b(FOLHA|SALARIO|PAGAMENTO DE FUNCIONARIO)\b/i;

    let valSimples = 0, valEncargos = 0, valTributos = 0, valProLabore = 0, valSalarios = 0;
    let identifiedTaxesTotal = 0;

    list.forEach(c => {
        const titleNormalized = normalizer(c.titulo);
        let identified = false;

        if (regexSimples.test(titleNormalized)) { valSimples += c.valor; identified = true; }
        else if (regexProLabore.test(titleNormalized)) { valProLabore += c.valor; identified = true; }
        else if (regexEncargos.test(titleNormalized) && !regexProLabore.test(titleNormalized)) { valEncargos += c.valor; identified = true; }
        else if (regexTributos.test(titleNormalized)) { valTributos += c.valor; identified = true; }
        else if (regexFolha.test(titleNormalized)) { valSalarios += c.valor; identified = true; }

        if (identified) identifiedTaxesTotal += c.valor;
    });

    const totalAPagarUnified = Math.max(dreData.a_pagar_mes || 0, fluxData.a_pagar_mes || 0);
    const valFornecedores = Math.max(0, totalAPagarUnified - identifiedTaxesTotal);

    const passivoData = {
        fornecedores: valFornecedores,
        emprestimos: totalLoansVal, // Sincronizado com Módulo de Empréstimos
        salarios: Math.max(valSalarios, (mPassivo.salarios || 0)), // Evita duplicidade scanner + explícito
        encargos: Math.max(valEncargos, (mPassivo.encargos || 0)),
        simples: Math.max(valSimples, (mPassivo.simples || 0)),
        governo_tributos: valTributos, // Sincronizado com DRE/DARF-DARE
        parcelamentos: mPassivo.parcelamentos || 0,
        pro_labore: valProLabore // Sincronizado com DRE/Pró-labore
    };

    const totalPassivo = Object.values(passivoData).reduce((a, b) => a + (b || 0), 0);

    // Patrimônio Líquido = Ativo - Passivo per USER instruction
    const totalPatrimonio = calculatedTotalAtivo - totalPassivo;

    const patrimonioData = {
        capital: currentComp.capitalSocial || 0,
        lucros: getAccumulatedNumbers(month, currentMode).profit
    };

    const formatBRL = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

    container.innerHTML = `
        <div class="period-selector-bar" style="display: flex; gap: 1rem; margin-bottom: 2rem; background: var(--card-bg); padding: 10px; border-radius: 8px; border: 1px solid var(--border-color);">
            <button class="btn-period ${currentMode === 'mensal' ? 'active' : ''}" onclick="setBalancoLevel('mensal')">Mensal</button>
            <button class="btn-period ${currentMode === 'trimestre' ? 'active' : ''}" onclick="setBalancoLevel('trimestre')">Trimestre</button>
            <button class="btn-period ${currentMode === 'semestre' ? 'active' : ''}" onclick="setBalancoLevel('semestre')">Semestre</button>
            <button class="btn-period ${currentMode === 'anual' ? 'active' : ''}" onclick="setBalancoLevel('anual')">Anual</button>
        </div>
        <div class="grid-container grid-cols-3" style="margin-bottom: 2rem;">
            <div class="card highlight-gold">
                <div class="metric-header">
                    <span class="metric-title">TOTAL ATIVO</span>
                    <div class="metric-icon gold"><i class="fa-solid fa-plus"></i></div>
                </div>
                <div class="metric-value">${formatBRL(calculatedTotalAtivo)}</div>
                <div class="metric-trend"><span class="trend-text">Bens e Direitos</span></div>
            </div>
            <div class="card highlight-red">
                <div class="metric-header">
                    <span class="metric-title">TOTAL PASSIVO</span>
                    <div class="metric-icon red"><i class="fa-solid fa-minus"></i></div>
                </div>
                <div class="metric-value">${formatBRL(totalPassivo)}</div>
                <div class="metric-trend"><span class="trend-text">Obrigações e Dívidas</span></div>
            </div>
            <div class="card highlight-purple">
                <div class="metric-header">
                    <span class="metric-title">PATRIMÔNIO LÍQUIDO</span>
                    <div class="metric-icon purple"><i class="fa-solid fa-scale-balanced"></i></div>
                </div>
                <div class="metric-value">${formatBRL(totalPatrimonio)}</div>
                <div class="metric-trend"><span class="trend-text">Recursos Próprios</span></div>
            </div>
        </div>

        <div class="grid-container grid-cols-2" style="gap: 2rem; align-items: start; margin-top:2rem;">
            <div class="card">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                    <h3 style="color: var(--accent-gold); margin: 0;">Composição do Balanço</h3>
                    <div class="chart-toggles" style="display: flex; gap: 5px;">
                        <button class="btn-toggle active" onclick="updateBalancoChart('bar', this)"><i class="fa-solid fa-chart-bar"></i></button>
                        <button class="btn-toggle" onclick="updateBalancoChart('line', this)"><i class="fa-solid fa-chart-line"></i></button>
                    </div>
                </div>
                <canvas id="chart-balanco" style="max-height: 350px;"></canvas>
            </div>
            
            <div class="card">
                <h3 style="margin-bottom: 1.5rem; color: var(--accent-purple);">Detalhamento</h3>
                <div class="detalhamento-scroller" style="max-height: 400px; overflow-y: auto; padding-right: 10px;">
                    <div class="detalhe-section">
                        <h4 style="color: var(--status-success); border-bottom: 1px solid var(--border-color); padding-bottom: 5px; margin-bottom: 10px;">ATIVOS</h4>
                        <div class="detalhe-row"><span>Caixa e Bancos</span> <strong>${formatBRL(ativoData.caixa_bancos)}</strong></div>
                        <div class="detalhe-row"><span>Aplicações Financeiras</span> <strong>${formatBRL(ativoData.aplicacoes)}</strong></div>
                        <div class="detalhe-row" style="cursor: pointer; color: var(--accent-gold);" onclick="document.querySelector('.nav-item[data-target=\'fluxo-caixa\']').click()"><span>Contas a Receber</span> <strong>${formatBRL(ativoData.receber)}</strong></div>
                        <div class="detalhe-row" style="color: var(--status-danger);"><span>(-) Clientes em Atraso</span> <strong>${formatBRL(ativoData.inadimplencia)}</strong></div>
                        <div class="detalhe-row"><span>Estoque</span> <strong>${formatBRL(ativoData.estoque)}</strong></div>
                        <div class="detalhe-row"><span>Imobilizado</span> <strong>${formatBRL(ativoData.imobilizado)}</strong></div>
                    </div>

                    <div class="detalhe-section" style="margin-top: 20px;">
                        <h4 style="color: var(--status-danger); border-bottom: 1px solid var(--border-color); padding-bottom: 5px; margin-bottom: 10px;">PASSIVOS</h4>
                        <div class="detalhe-row" style="cursor: pointer; color: var(--accent-gold);" onclick="document.querySelector('.nav-item[data-target=\'fluxo-caixa\']').click()"><span>Fornecedores</span> <strong>${formatBRL(passivoData.fornecedores)}</strong></div>
                        <div class="detalhe-row"><span>Empréstimos e Financiamentos</span> <strong>${formatBRL(passivoData.emprestimos)}</strong></div>
                        <div class="detalhe-row"><span>Salários a Pagar</span> <strong>${formatBRL(passivoData.salarios)}</strong></div>
                        <div class="detalhe-row"><span>Encargos Trabalhistas</span> <strong>${formatBRL(passivoData.encargos)}</strong></div>
                        <div class="detalhe-row"><span>Simples Nacional</span> <strong>${formatBRL(passivoData.simples)}</strong></div>
                        <div class="detalhe-row"><span>Tributos (Guia Darf/Dare)</span> <strong>${formatBRL(passivoData.governo_tributos)}</strong></div>
                        <div class="detalhe-row"><span>Parcelamentos</span> <strong>${formatBRL(passivoData.parcelamentos)}</strong></div>
                        <div class="detalhe-row"><span>Pró-Labore</span> <strong>${formatBRL(passivoData.pro_labore)}</strong></div>
                    </div>

                    <div class="detalhe-section" style="margin-top: 20px;">
                        <h4 style="color: var(--accent-purple); border-bottom: 1px solid var(--border-color); padding-bottom: 5px; margin-bottom: 10px;">PATRIMÔNIO</h4>
                        <div class="detalhe-row"><span>Capital Social</span> <strong>${formatBRL(patrimonioData.capital)}</strong></div>
                        <div class="detalhe-row"><span>Lucros/Prejuízos Acumulados</span> <strong>${formatBRL(patrimonioData.lucros)}</strong></div>
                    </div>
                </div>
            </div>
        </div>
    `;

    // --- LÓGICA DE HISTÓRICO ANUAL (SCANNER 360) ---
    const getYearlyHistory = () => {
        const year = month.split('-')[0];
        const ativoHist = [], passivoHist = [], plHist = [];
        const labels = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

        for (let m = 1; m <= 12; m++) {
            const mStr = m.toString().padStart(2, '0');
            const kE = `clarusData_${window.currentUserId}_${year}-${mStr}`;
            const kV = `clarusDataVenc_${window.currentUserId}_${year}-${mStr}`;

            const dE = JSON.parse(localStorage.getItem(kE) || '{}');
            const dV = JSON.parse(localStorage.getItem(kV) || '{}');

            // Unificação expressa para o gráfico
            const mRec = Math.max(dE.receita_total || 0, dV.receita_total || 0, dE.a_receber_mes || 0, dV.a_receber_mes || 0);
            const mAtv = (mRec) + (dE.balanco?.ativo?.estoque || 0) + (dE.balanco?.ativo?.imobilizado || 0);

            const mPag = Math.max(dE.a_pagar_mes || 0, dV.a_pagar_mes || 0);
            const mPas = (mPag) + (dE.balanco?.passivo?.emprestimos || 0) + (dE.balanco?.passivo?.parcelamentos || 0);

            ativoHist.push(mAtv || 0);
            passivoHist.push(mPas || 0);
            plHist.push(mAtv - mPas || 0);
        }
        return { labels, ativoHist, passivoHist, plHist };
    };

    // Render Chart Logic
    let balancoChart = null;
    window.updateBalancoChart = (type, btn) => {
        const canvas = document.getElementById('chart-balanco');
        if (!canvas) return;
        if (balancoChart) balancoChart.destroy();

        // Update toggle UI
        if (btn) {
            btn.parentElement.querySelectorAll('.btn-toggle').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        }

        const history = getYearlyHistory();
        const ctx = canvas.getContext('2d');

        const datasets = type === 'line' ? [
            { label: 'Ativo', data: history.ativoHist, borderColor: '#d4af37', backgroundColor: 'transparent', borderWidth: 3, tension: 0.4, pointRadius: 4 },
            { label: 'Passivo', data: history.passivoHist, borderColor: '#e11d48', backgroundColor: 'transparent', borderWidth: 3, tension: 0.4, pointRadius: 4 },
            { label: 'Patrimônio Líquido', data: history.plHist, borderColor: '#8b5cf6', backgroundColor: 'transparent', borderWidth: 3, tension: 0.4, pointRadius: 4 }
        ] : [{
            label: 'Valores Atuais',
            data: [calculatedTotalAtivo, totalPassivo, totalPatrimonio],
            backgroundColor: ['#d4af37', '#e11d48', '#8b5cf6'],
            borderRadius: 8
        }];

        balancoChart = new Chart(ctx, {
            type: type,
            data: {
                labels: type === 'line' ? history.labels : ['Ativo', 'Passivo', 'P.L.'],
                datasets: datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: type === 'line', position: 'bottom', labels: { color: '#94a3b8', boxWidth: 12, padding: 20 } }
                },
                scales: {
                    y: {
                        grid: { color: 'rgba(255,255,255,0.05)' },
                        ticks: { color: '#64748b', callback: (v) => formatBRL(v).replace(',00', '') }
                    },
                    x: {
                        grid: { display: false },
                        ticks: { color: '#64748b', rotation: type === 'line' ? 45 : 0 }
                    }
                }
            }
        });
    };

    // Initial render
    window.updateBalancoChart('bar');

    window.setBalancoLevel = (lvl) => {
        localStorage.setItem('balancoViewMode', lvl);
        window.initBalancoGerencial(month);
    };
};
