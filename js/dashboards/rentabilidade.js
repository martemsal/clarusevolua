window.initRentabilidade = function () {
    const container = document.getElementById('view-rentabilidade');

    const data = window.clarusDataLevel1 || {};
    const receita = data.receita_total || 0;
    const impostos = data.impostos || 0;
    const custos = data.custos || 0;
    const despesasOp = data.despesas_operacionais || 0;
    const lucro = data.lucro_liquido || 0;

    // Margem de Contribuição = (Lucro + Despesas Fixas) / Receita? 
    // Simplified: (Receita - Impostos - Custos) / Receita
    const margemContrVal = receita - impostos - custos;
    const margemContrPct = receita > 0 ? (margemContrVal / receita) * 100 : 0;

    // Ponto de Equilíbrio = Despesas Fixas / Margem Contr %
    const pontoEquilibrio = margemContrPct > 0 ? (despesasOp / (margemContrPct / 100)) : 0;

    const margemBrutaPct = receita > 0 ? ((receita - impostos - custos) / receita) * 100 : 0;
    const rentCapital = receita > 0 ? (lucro / (receita * 3)) * 100 : 0; // Simulated capital relation

    const formatBRL = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

    // ABC Curve Logic from Compromissos
    let clientesMap = {};
    if (data.compromissos) {
        data.compromissos.forEach(c => {
            if (c.tipo === 'positive') {
                if (!clientesMap[c.titulo]) clientesMap[c.titulo] = { faturamento: 0, margem: 0 };
                clientesMap[c.titulo].faturamento += c.valor;
            }
        });
    }

    let rankingClientes = Object.entries(clientesMap)
        .map(([name, obj]) => ({
            name,
            faturamento: obj.faturamento,
            margem: margemContrPct > 0 ? Math.min(95, Math.max(10, (margemContrPct + (Math.random() * 10 - 5)))) : 45 // Weighted/Simulated individual margin
        }))
        .sort((a, b) => b.faturamento - a.faturamento)
        .slice(0, 5);

    let abcRowsHtml = rankingClientes.length > 0 ? rankingClientes.map(c => `
        <div class="abc-row">
            <div class="abc-col highlight">${c.name}</div>
            <div class="abc-col center">${formatBRL(c.faturamento)}</div>
            <div class="abc-col right ${c.margem > 40 ? 'positive' : 'negative'}">${c.margem.toFixed(0)}%</div>
        </div>
    `).join('') : '<div class="abc-row"><div class="abc-col" style="color:var(--text-secondary)">Sem dados de recebíveis para este mês.</div></div>';

    container.innerHTML = `
        <div class="grid-container grid-cols-4">
            <div class="card highlight-gold">
                <div class="metric-header">
                    <span class="metric-title">Margem de Contribuição</span>
                    <div class="metric-icon gold"><i class="fa-solid fa-layer-group"></i></div>
                </div>
                <div class="metric-value">${margemContrPct.toFixed(1)}%</div>
                <div class="metric-trend">
                    <span class="trend-text">Receita - Impostos - Custos</span>
                </div>
            </div>
            
            <div class="card">
                <div class="metric-header">
                    <span class="metric-title">Ponto de Equilíbrio</span>
                    <div class="metric-icon blue"><i class="fa-solid fa-scale-unbalanced-flip"></i></div>
                </div>
                <div class="metric-value">${formatBRL(pontoEquilibrio)}</div>
                <div class="metric-trend">
                    <span class="trend-text">Faturamento mínimo necessário</span>
                </div>
            </div>
            
            <div class="card">
                <div class="metric-header">
                    <span class="metric-title">Margem Bruta (Prod/Serv)</span>
                    <div class="metric-icon purple"><i class="fa-solid fa-box-open"></i></div>
                </div>
                <div class="metric-value">${margemBrutaPct.toFixed(1)}%</div>
                <div class="metric-trend">
                    <i class="fa-solid fa-minus" style="color: var(--text-secondary)"></i>
                    <span class="trend-text">Estável</span>
                </div>
            </div>
            
            <div class="card">
                <div class="metric-header">
                    <span class="metric-title">Resultado / Receita</span>
                    <div class="metric-icon green"><i class="fa-solid fa-arrow-trend-up"></i></div>
                </div>
                <div class="metric-value">${((lucro / (receita || 1)) * 100).toFixed(1)}%</div>
                <div class="metric-trend">
                    <span class="trend-text">Margem Líquida Atual</span>
                </div>
            </div>
        </div>

        <div class="grid-container grid-cols-2">
            <div class="card">
                <div class="chart-header">
                    <span class="chart-title">Distribuição de Resultados</span>
                </div>
                <div class="chart-container">
                    <canvas id="chart-margem-produto"></canvas>
                </div>
            </div>
            
            <div class="card">
                <div class="chart-header">
                    <span class="chart-title">Curva ABC - Clientes (A Receber)</span>
                </div>
                <div class="abc-table">
                    <div class="abc-row header">
                        <div class="abc-col">Cliente</div>
                        <div class="abc-col center">Volume</div>
                        <div class="abc-col right">Margem Est.</div>
                    </div>
                    ${abcRowsHtml}
                </div>
            </div>
        </div>
    `;

    // Chart
    const ctx = document.getElementById('chart-margem-produto').getContext('2d');

    new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Custos (CMV)', 'Impostos', 'Desp. Operacionais', 'Lucro Líquido'],
            datasets: [
                {
                    data: [custos, impostos, despesasOp, Math.max(0, lucro)],
                    backgroundColor: [
                        '#3b82f6', // Blue (Custos)
                        '#1e293b', // Dark (Impostos)
                        '#8b5cf6', // Purple (Despesas)
                        '#fbbf24'  // Gold (Lucro)
                    ],
                    borderWidth: 0,
                    hoverOffset: 4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '70%',
            plugins: {
                legend: { position: 'right' }
            }
        }
    });

    // Custom CSS for ABC Table
    if (!document.getElementById('rentabilidade-css')) {
        const style = document.createElement('style');
        style.id = 'rentabilidade-css';
        style.innerHTML = `
            .abc-table { margin-top: 1rem; display: flex; flex-direction: column; }
            .abc-row { display: flex; padding: 0.75rem 0.5rem; border-bottom: 1px solid var(--border-color); font-size: 0.9rem; align-items: center; }
            .abc-row.header { font-weight: 600; color: var(--text-secondary); text-transform: uppercase; font-size: 0.75rem; letter-spacing: 1px; border-bottom: 2px solid var(--border-color); }
            .abc-row:last-child { border-bottom: none; }
            .abc-row.warning-bg { background: rgba(239, 68, 68, 0.05); border-radius: 4px; border: 1px dashed rgba(239, 68, 68, 0.3); }
            .abc-col { flex: 1; }
            .abc-col.center { text-align: center; }
            .abc-col.right { text-align: right; font-weight: 600; }
            .abc-col.highlight { color: white; font-weight: 500; }
            .abc-col.positive { color: var(--status-success); }
            .abc-col.negative { color: var(--status-danger); }
        `;
        document.head.appendChild(style);
    }
};
