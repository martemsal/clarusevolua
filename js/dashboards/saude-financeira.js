window.initSaudeFinanceira = function () {
    const container = document.getElementById('view-saude-financeira');
    if (!container) return;

    // 1. Carregamento Unificado (Scanner Inteligente de 360 Graus)
    // Buscamos dados de ambos os regimes (Emissão e Vencimento) para garantir que nada escape
    const dreData = window.clarusDataDRE || {};
    const fluxData = window.clarusDataFluxo || {};

    const listDRE = dreData.compromissos || [];
    const listFlux = fluxData.compromissos || [];

    // Unificação com Dedup (Evita duplicar se o mesmo arquivo foi subido nos dois)
    const unifiedMap = new Map();
    [...listDRE, ...listFlux].forEach(c => {
        const key = `${(c.titulo || "").toString().trim()}_${c.valor}_${c.data}`;
        if (!unifiedMap.has(key)) unifiedMap.set(key, c);
    });
    const list = Array.from(unifiedMap.values());

    // 2. BUSCA DE DADOS DO MÊS ANTERIOR PARA TENDÊNCIAS REAIS
    const pSelect = document.getElementById('period-select');
    const currentMonthStr = pSelect ? pSelect.value : '2026-01';

    // Standardized viewingId acquisition
    const viewingId = localStorage.getItem('clarusAdminViewingId') || window.currentUserId || localStorage.getItem('clarusSessionId');

    const getPrevMonth = (m) => {
        if (!m) return '';
        const [y, mm] = m.split('-').map(Number);
        const date = new Date(y, mm - 2, 1);
        return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
    };
    const prevMonthStr = getPrevMonth(currentMonthStr);
    const prevKey = `clarusData_${viewingId}_${prevMonthStr}`;
    const prevDataRaw = localStorage.getItem(prevKey);
    const prevData = prevDataRaw ? JSON.parse(prevDataRaw) : null;

    // 1. EXTRAÇÃO ROBUSTA COM AUTO-CURA DE DADOS
    // Faturamento e Contas a Pagar: Pegamos o maior valor detectado entre os dois regimes
    const rawReceita = Math.max(dreData.receita_total || 0, dreData.a_receber_mes || 0, fluxData.receita_total || 0, fluxData.a_receber_mes || 0);
    const rawPagar = Math.max(dreData.a_pagar_mes || 0, fluxData.a_pagar_mes || 0);

    // --- INTEGRAÇÃO COM ESTOQUE (Módulo Multi-Unidade) ---
    let custosTotal = Math.max(dreData.custos || 0, fluxData.custos || 0);
    let inventoryCMV = 0;
    if (dreData.estoque_unidades) {
        Object.values(dreData.estoque_unidades).forEach(u => inventoryCMV += (u.cmv_total || 0));
    }
    // Se houver dados de estoque processados, eles são a fonte da verdade para o CMV
    if (inventoryCMV > 0) {
        custosTotal = inventoryCMV;
        console.log("📊 [DRE] CMV sincronizado com o Módulo de Estoque:", inventoryCMV);
    }
    const normalizer = (s) => (s || "").toString().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

    // CATEGORIZAÇÃO AVANÇADA DE IMPOSTOS (Regex Aprimorado para evitar Falsos Positivos)
    const regexFederal = /\b(ICMS|PIS|COFINS|IRPJ|CSLL|IPI|DARF|DAS|SIMPLES NACIONAL|CBS|IBS|FEDERAL)\b/i;
    const regexTrabalhista = /\b(FGTS|INSS|GPS|FOLHA|PRO-LABORE|TRABALHISTA|SALARIO|GRRF)\b/i;
    const regexMunicipal = /\b(ISS|IPTU|LICENCIAMENTO|ALVARA|MUNICIPAL)\b/i;

    // Regra rígida: Deve conter um destes termos EXATOS, mas NÃO conter termos de empresas (Blacklist)
    const strictTaxRegex = /\b(ICMS|PIS|COFINS|DIFAL|IPI|DARF|DARE|SIMPLES NACIONAL|DAS|IBS|CBS|FGTS|INSS|GPS|ISS|IPTU|TRIBUTO|IMPOSTO)\b/i;
    const blacklistRegex = /\b(LTDA|S[.\/]A|SOCIEDADE|ASSESSORIA|CONTAB|CONSULT|ADVOGADO|SERVICO|CONDOMINIO|ALUGUEL)\b/i;

    let totalFed = 0, totalTrab = 0, totalMun = 0, totalOutrosTax = 0;

    list.forEach(c => {
        const titleNormalized = normalizer(c.titulo);

        // A BLACKLIST É ABSOLUTA: Limpa a flag se encontrar (Purge de dados antigos)
        const isMatch = strictTaxRegex.test(titleNormalized);
        const isBlacklisted = blacklistRegex.test(titleNormalized);

        if (isBlacklisted) {
            c.isActuallyTax = false; // Força limpeza de qualquer marcação anterior errada
        } else if (c.isActuallyTax || isMatch) {
            c.isActuallyTax = true;
            if (regexFederal.test(titleNormalized)) { c.taxGrp = 'Federal/Estadual'; totalFed += c.valor; }
            else if (regexTrabalhista.test(titleNormalized)) { c.taxGrp = 'Trabalhista'; totalTrab += c.valor; }
            else if (regexMunicipal.test(titleNormalized)) { c.taxGrp = 'Municipal'; totalMun += c.valor; }
            else { c.taxGrp = 'Outros Tributos'; totalOutrosTax += c.valor; }
        }
    });

    const impostosReal = totalFed + totalTrab + totalMun + totalOutrosTax;

    // REGRA RÍGIDA: Despesas Operacionais agora vêm SOMENTE do arquivo carregado via Admin
    // Se não houver arquivo, o valor será R$ 0,00 por padrão.
    let despesasOp = (dreData.despesas_operacionais || 0);
    const opDetails = (dreData.despesas_operacionais_detalhe || []);

    const receitaTotal = rawReceita;
    const despesasTotais = impostosReal + custosTotal + despesasOp;
    const lucroLiquido = receitaTotal - despesasTotais;
    const margemLucroPct = receitaTotal > 0 ? ((lucroLiquido / receitaTotal) * 100).toFixed(1) : "0.0";

    const formatBRL = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

    // Função de Tendência Real
    const getTrend = (current, previous) => {
        if (!previous || previous === 0) return { pct: '0.0%', class: 'stable', icon: 'fa-minus', label: 'Estável' };
        const diff = ((current - previous) / previous) * 100;
        if (Math.abs(diff) < 0.1) return { pct: '0.0%', class: 'stable', icon: 'fa-minus', label: 'Estável' };
        return {
            pct: Math.abs(diff).toFixed(1) + '%',
            class: diff > 0 ? 'up' : 'down',
            icon: diff > 0 ? 'fa-arrow-up' : 'fa-arrow-down',
            label: diff > 0 ? 'Em alta' : 'Em queda'
        };
    };

    const trends = {
        receita: getTrend(receitaTotal, prevData ? (prevData.receita_total || prevData.a_receber_mes) : 0),
        lucro: getTrend(lucroLiquido, prevData ? (prevData.receita_total - (prevData.impostos + prevData.custos + (prevData.a_pagar_mes - prevData.impostos - prevData.custos))) : 0),
        despesas: getTrend(despesasTotais, prevData ? (prevData.impostos + prevData.custos + (prevData.a_pagar_mes - prevData.impostos - prevData.custos)) : 0)
    };

    // 4. Estrutura HTML
    container.innerHTML = `
        <div class="grid-container grid-cols-4">
            <div class="card highlight-gold">
                <div class="metric-header"><span class="metric-title">Faturamento Mês</span><div class="metric-icon gold"><i class="fa-solid fa-brazilian-real-sign"></i></div></div>
                <div class="metric-value">${formatBRL(receitaTotal)}</div>
                <div class="metric-trend ${trends.receita.class}"><i class="fa-solid ${trends.receita.icon}"></i> <span>${trends.receita.pct}</span><span class="trend-text">${trends.receita.label}</span></div>
            </div>
            <div class="card highlight-green">
                <div class="metric-header"><span class="metric-title">Lucro Líquido</span><div class="metric-icon green"><i class="fa-solid fa-piggy-bank"></i></div></div>
                <div class="metric-value positive">${formatBRL(lucroLiquido)}</div>
                <div class="metric-trend ${trends.lucro.class}"><i class="fa-solid ${trends.lucro.icon}"></i> <span>${trends.lucro.pct}</span><span class="trend-text">${trends.lucro.label}</span></div>
            </div>
            <div class="card"><div class="metric-header"><span class="metric-title">Margem de Lucro</span><div class="metric-icon purple"><i class="fa-solid fa-percent"></i></div></div>
                <div class="metric-value">${margemLucroPct}%</div>
                <div class="metric-trend"><i class="fa-solid fa-minus" style="color:var(--text-secondary)"></i> <span>Real</span><span class="trend-text">Margem Ativa</span></div>
            </div>
            <div class="card"><div class="metric-header"><span class="metric-title">Despesas Totais</span><div class="metric-icon red"><i class="fa-solid fa-arrow-trend-down"></i></div></div>
                <div class="metric-value">${formatBRL(despesasTotais)}</div>
                <div class="metric-trend ${trends.despesas.class}"><i class="fa-solid ${trends.despesas.icon}"></i> <span>${trends.despesas.pct}</span><span class="trend-text">${trends.despesas.label}</span></div>
            </div>
        </div>

        <div class="grid-container grid-cols-2">
            <div class="card">
                <div class="chart-header"><span>Faturamento vs. Despesas (Ano)</span></div>
                <div class="chart-container"><canvas id="chart-receita-despesa"></canvas></div>
            </div>
            <div class="card">
                <div class="chart-header"><span>DRE Gerencial Resumido</span></div>
                <div class="dre-table" style="display:flex; flex-direction:column; gap:0.5rem; margin-top:1rem;">
                    <div style="display:flex; justify-content:space-between; border-bottom:1px dashed #334155; padding:5px 0;"><span>Receita Bruta</span><span>${formatBRL(receitaTotal)}</span></div>
                    <div style="display:flex; justify-content:space-between; border-bottom:1px dashed #334155; padding:5px 0; color:#94a3b8;">
                        <span id="tax-drill-down-trigger" style="cursor:pointer; text-decoration: underline dotted;">(-) Impostos</span>
                        <span style="color:var(--status-danger)">-${formatBRL(impostosReal)}</span>
                    </div>
                    <div style="display:flex; justify-content:space-between; border-bottom:1px dashed #334155; padding:5px 0;"><span>Receita Líquida</span><span>${formatBRL(receitaTotal - impostosReal)}</span></div>
                    <div style="display:flex; justify-content:space-between; border-bottom:1px dashed #334155; padding:5px 0; color:#94a3b8;"><span>(-) Custo (CMV)</span><span style="color:var(--status-danger)">-${formatBRL(custosTotal)}</span></div>
                    <div style="display:flex; justify-content:space-between; border-bottom:1px dashed #334155; padding:5px 0; color:var(--accent-gold); font-weight:700;"><span>Margem Bruta (Lucro Operacional)</span><span>${formatBRL(receitaTotal - impostosReal - custosTotal)}</span></div>
                    <div style="display:flex; justify-content:space-between; border-bottom:1px dashed #334155; padding:5px 0; color:#94a3b8;">
                        <span id="desp-op-drill-down-trigger" style="cursor:pointer; text-decoration: underline dotted;">(-) Desp. Operacionais</span>
                        <span style="color:var(--status-danger)">-${formatBRL(despesasOp)}</span>
                    </div>
                    <div style="display:flex; justify-content:space-between; padding:8px 0; margin-top:5px; border-top:2px solid #3b82f6; color:var(--status-success); font-weight:700; font-size:1.1rem;"><span>(=) LUCRO LÍQUIDO</span><span>${formatBRL(lucroLiquido)}</span></div>
                </div>
            </div>
        </div>
    `;


    // 5. Gráfico de Evolução Anual (Buscando dados de todo o ano)
    const year = currentMonthStr.split('-')[0];
    const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const histReceita = [], histImpostos = [], histCustos = [], histLucro = [];

    for (let m = 1; m <= 12; m++) {
        const mStr = m.toString().padStart(2, '0');
        const kEmi = `clarusData_${viewingId}_${year}-${mStr}`;
        const kVen = `clarusDataVenc_${viewingId}_${year}-${mStr}`;

        const mDataEmi = JSON.parse(localStorage.getItem(kEmi) || '{}');
        const mDataVen = JSON.parse(localStorage.getItem(kVen) || '{}');

        // Unificação Expressa para Gráfico
        const mRec = Math.max(mDataEmi.receita_total || 0, mDataEmi.a_receber_mes || 0, mDataVen.receita_total || 0, mDataVen.a_receber_mes || 0);
        const mPag = Math.max(mDataEmi.a_pagar_mes || 0, mDataVen.a_pagar_mes || 0);

        // Scanner de Impostos no Gráfico (Nivel 1)
        const mList = [...(mDataEmi.compromissos || []), ...(mDataVen.compromissos || [])];
        let mImp = 0;
        mList.forEach(c => {
            const tNorm = normalizer(c.titulo);
            const isM = strictTaxRegex.test(tNorm);
            const isB = blacklistRegex.test(tNorm);
            if (isB) {
                // No graph, we don't modify c.isActuallyTax, just ignore value
            } else if (c.isActuallyTax || isM) {
                mImp += c.valor;
            }
        });

        const mCus = Math.max(mDataEmi.custos || 0, mDataVen.custos || 0);
        const mDes = Math.max(0, mPag - mImp - mCus);
        const mLuc = mRec - (mImp + mCus + mDes);

        histReceita.push(mRec);
        histImpostos.push(mImp);
        histCustos.push(mCus);
        histLucro.push(mLuc);
    }

    const ctx = document.getElementById('chart-receita-despesa').getContext('2d');
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: monthNames,
            datasets: [
                { label: 'Faturamento', data: histReceita, backgroundColor: '#fbbf24' },
                { label: 'Impostos', data: histImpostos, backgroundColor: '#ef4444' },
                { label: 'Custos', data: histCustos, backgroundColor: '#3b82f6' },
                { label: 'Lucro Líquido', data: histLucro, backgroundColor: '#10b981' }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { stacked: false },
                y: { beginAtZero: true }
            }
        }
    });

    // 6. Modal de Impostos (CATEGORIZADO)
    document.getElementById('tax-drill-down-trigger').addEventListener('click', () => {
        const taxItems = list.filter(c => c.isActuallyTax);
        const fed = taxItems.filter(t => t.taxGrp === 'Federal/Estadual');
        const trab = taxItems.filter(t => t.taxGrp === 'Trabalhista');
        const mun = taxItems.filter(t => t.taxGrp === 'Municipal');
        const other = taxItems.filter(t => !t.taxGrp || t.taxGrp === 'Outros Tributos');

        const renderGrp = (title, items, color) => `
            <div style="margin-top:1.5rem;">
                <h4 style="color:${color}; border-bottom:1px solid ${color}; padding-bottom:5px; margin-bottom:10px;">${title}</h4>
                ${items.length > 0 ? items.map(t => `
                    <div style="display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid #334155; font-size:0.85rem;">
                        <span>${t.titulo}</span>
                        <span style="color:var(--status-danger); font-weight:700;">-${formatBRL(t.valor)}</span>
                    </div>
                `).join('') : '<p style="font-size:0.8rem; color:#64748b;">Nenhum item localizado nesta categoria.</p>'}
            </div>
        `;

        const modalHtml = `
        <div id="tax-modal" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.8); display:flex; justify-content:center; align-items:center; z-index:9999;">
            <div class="card" style="width:550px; padding:2rem; background:var(--bg-card); border: 1px solid var(--accent-gold); max-height:85vh; overflow-y:auto;">
                <h3 style="color:var(--accent-gold); margin-bottom:1rem; text-align:center;">Detalhamento de Tributos</h3>
                ${renderGrp('Trabalhistas (INSS/FGTS/GPS)', trab, '#10b981')}
                ${renderGrp('Federais/Estaduais (SIMPLES/DARF/ICMS)', fed, '#3b82f6')}
                ${renderGrp('Municipais (ISS/Taxas)', mun, '#f59e0b')}
                ${other.length > 0 ? renderGrp('Outros Tributos', other, '#94a3b8') : ''}
                <button onclick="document.getElementById('tax-modal').remove()" style="margin-top:2rem; width:100%; padding:15px; background:var(--accent-gold); color:black; border:none; border-radius:4px; font-weight:700; cursor:pointer;">Fechar Detalhamento</button>
            </div>
        </div>`;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
    });

    // 7. Modal de Despesas Operacionais (DRILL DOWN)
    const despTrigger = document.getElementById('desp-op-drill-down-trigger');
    if (despTrigger) {
        despTrigger.addEventListener('click', () => {
            if (opDetails.length === 0) {
                alert("Não há detalhamento importado para despesas operacionais deste mês.");
                return;
            }
            // Agrupamento para Otimizar Espaço (Nomes Iguais -> Soma Valores)
            const groupedMap = opDetails.reduce((acc, curr) => {
                const title = (curr.descricao || "Sem Descrição").toString().trim();
                if (!acc[title]) acc[title] = { descricao: title, valor: 0, count: 0 };
                acc[title].valor += curr.valor;
                acc[title].count++;
                return acc;
            }, {});

            const sortedItems = Object.values(groupedMap).sort((a, b) => b.valor - a.valor);

            const modalHtml = `
            <div id="desp-op-modal" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.85); display:flex; justify-content:center; align-items:center; z-index:10000; backdrop-filter: blur(4px);">
                <div class="card" style="width:600px; padding:2rem; background:linear-gradient(135deg, #1e293b, #0f172a); border: 2px solid #3b82f6; border-radius:15px; max-height:85vh; display:flex; flex-direction:column; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5);">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem; border-bottom:1px solid rgba(59,130,246,0.3); padding-bottom:1rem;">
                        <div>
                            <h3 style="color:#60a5fa; margin:0; font-size:1.4rem;"><i class="fa-solid fa-file-invoice-dollar"></i> Despesas Operacionais</h3>
                            <p style="color:#94a3b8; font-size:0.75rem; margin:5px 0 0 0;">Visualização unificada e detalhada por natureza</p>
                        </div>
                        <button onclick="document.getElementById('desp-op-modal').remove()" style="background:rgba(255,255,255,0.05); border:none; color:#94a3b8; font-size:1.2rem; cursor:pointer; width:35px; height:35px; border-radius:50%; display:flex; align-items:center; justify-content:center;"><i class="fa-solid fa-xmark"></i></button>
                    </div>
                    
                    <div style="flex:1; overflow-y:auto; padding-right:10px;" class="custom-scroll">
                        ${sortedItems.map((item, idx) => `
                            <div style="display:flex; justify-content:space-between; align-items:center; padding:15px; margin-bottom:10px; background:rgba(255,255,255,0.03); border-radius:10px; border-left:4px solid #3b82f6; transition: transform 0.2s;">
                                <div>
                                    <div style="font-weight:700; color:#f8fafc; font-size:0.95rem;">${item.descricao}</div>
                                    <div style="font-size:0.7rem; color:#60a5fa; margin-top:4px; font-weight:600; text-transform:uppercase; letter-spacing:0.5px;">
                                        <i class="fa-solid fa-layer-group"></i> ${item.count} registro(s) unificado(s)
                                    </div>
                                </div>
                                <div style="text-align:right;">
                                    <div style="color:#f1f5f9; font-weight:800; font-family:'Inter', sans-serif; font-size:1.05rem;">${formatBRL(item.valor)}</div>
                                    <div style="font-size:0.65rem; color:#94a3b8;">${((item.valor / despesasOp) * 100).toFixed(1)}% do total</div>
                                </div>
                            </div>
                        `).join('')}
                    </div>

                    <div style="margin-top:1.5rem; padding:1.5rem; background:rgba(59,130,246,0.1); border-radius:12px; display:flex; justify-content:space-between; align-items:center; border: 1px solid rgba(59,130,246,0.3);">
                        <div style="color:#94a3b8; font-size:0.8rem; font-weight:600;">TOTAL OPERACIONAL</div>
                        <div style="font-size:1.5rem; font-weight:900; color:#fff; text-shadow: 0 0 10px rgba(59,130,246,0.5);">${formatBRL(despesasOp)}</div>
                    </div>

                    <button onclick="document.getElementById('desp-op-modal').remove()" style="margin-top:1.5rem; width:100%; padding:15px; background:linear-gradient(135deg, #3b82f6, #2563eb); color:white; border:none; border-radius:8px; font-weight:700; cursor:pointer; text-transform:uppercase; letter-spacing:1.5px; box-shadow: 0 10px 15px -3px rgba(59,130,246,0.4);">Entendido</button>
                </div>
            </div>`;
            document.body.insertAdjacentHTML('beforeend', modalHtml);
        });
    }
};
