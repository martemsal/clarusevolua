window.initComercial = function () {
    const container = document.getElementById('view-comercial');

    const data = window.clarusDataLevel1?.comercial || {
        vendas_mes: 0,
        ticket_medio: 0,
        conversao: 0,
        cac: 0,
        vendedores: []
    };

    const formatBRL = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

    // Churn Detection Logic (Mock/Logic)
    const getChurnAlerts = () => {
        // In a real app with database, we'd compare historical sales.
        // For now, we look for a 'recorrentes' key or simulate.
        const churnList = data.churn || [];
        if (churnList.length === 0 && data.vendas_mes > 0) {
            // Simulation for demo: if sales are high, maybe 1 customer is 'late'
            // return [{ nome: 'Cliente Exemplo S/A', motivo: 'Sem compra há 35 dias' }];
        }
        return churnList;
    };

    const churnAlerts = getChurnAlerts();

    container.innerHTML = `
        ${churnAlerts.length > 0 ? `
            <div class="card status-critical-bg" style="margin-bottom:1.5rem; border-left: 5px solid var(--status-danger); animation: fadeIn 0.5s ease;">
                <div style="display:flex; align-items:center; gap:10px; color:var(--status-danger);">
                    <i class="fa-solid fa-triangle-exclamation" style="font-size:1.5rem;"></i>
                    <div>
                        <h4 style="margin:0;">Alerta de Churn Detectado</h4>
                        <p style="margin:0; font-size:0.85rem; opacity:0.9;">${churnAlerts.length} cliente(s) recorrente(s) não compraram neste período.</p>
                    </div>
                </div>
                <div style="margin-top:10px; display:flex; flex-wrap:wrap; gap:10px;">
                    ${churnAlerts.map(c => `
                        <div style="background:rgba(239, 68, 68, 0.1); padding:5px 12px; border-radius:15px; font-size:0.8rem; border:1px solid rgba(239, 68, 68, 0.2);">
                            <strong>${c.nome}</strong> - ${c.motivo}
                        </div>
                    `).join('')}
                </div>
            </div>
        ` : ''}

        <div class="grid-container grid-cols-4">
            <div class="card highlight-blue">
                <div class="metric-header">
                    <span class="metric-title">Vendas (Mês)</span>
                    <div class="metric-icon blue"><i class="fa-solid fa-cart-shopping"></i></div>
                </div>
                <div class="metric-value">${data.vendas_mes} <small style="font-size:1rem;color:var(--text-secondary);font-weight:400;margin-left:5px;">negócios</small></div>
                <div class="metric-trend">
                    <span class="trend-text">Leituras processadas do mês focado</span>
                </div>
            </div>
            
            <div class="card">
                <div class="metric-header">
                    <span class="metric-title">Ticket Médio</span>
                    <div class="metric-icon gold"><i class="fa-solid fa-receipt"></i></div>
                </div>
                <div class="metric-value">${formatBRL(data.ticket_medio)}</div>
                <div class="metric-trend">
                    <span class="trend-text">Receita total / Volume</span>
                </div>
            </div>
            
            <div class="card">
                <div class="metric-header">
                    <span class="metric-title">Conversão Global</span>
                    <div class="metric-icon purple"><i class="fa-solid fa-filter"></i></div>
                </div>
                <div class="metric-value">${data.conversao.toFixed(1)}%</div>
                <div class="metric-trend">
                    <span class="trend-text">Leads que compraram</span>
                </div>
            </div>
            
            <div class="card">
                <div class="metric-header">
                    <span class="metric-title">Custo Aquisição (CAC)</span>
                    <div class="metric-icon red"><i class="fa-solid fa-bullseye"></i></div>
                </div>
                <div class="metric-value">${formatBRL(data.cac)}</div>
                <div class="metric-trend">
                    <span class="trend-text">Marketing + Vendas / Clientes</span>
                </div>
            </div>
        </div>

        <div class="grid-container grid-cols-2">
            <div class="card">
                <div class="chart-header">
                    <span class="chart-title">Evolução de Vendas (Diário)</span>
                </div>
                <div class="chart-container">
                    <canvas id="chart-vendas-diario"></canvas>
                </div>
            </div>
            
            <div class="card">
                <div class="chart-header">
                    <span class="chart-title">Ranking de Vendedores (Faturamento)</span>
                </div>
                <div class="ranking-list">
                    ${data.vendedores.length > 0 ? data.vendedores.map((v, i) => {
        let rankClass = i === 0 ? 'gold-medal' : i === 1 ? 'silver-medal' : i === 2 ? 'bronze-medal' : '';
        let widthPct = data.vendedores[0].valor > 0 ? (v.valor / data.vendedores[0].valor) * 100 : 0;
        let color = i === 0 ? 'var(--accent-gold)' : i === 1 ? '#94a3b8' : i === 2 ? '#b45309' : '#334155';
        return `
                        <div class="ranking-item">
                            <div class="rank-pos ${rankClass}">${i + 1}</div>
                            <div class="rank-name">${v.nome}</div>
                            <div class="rank-bar-container">
                                <div class="rank-bar" style="width: ${widthPct}%; background: ${color};"></div>
                            </div>
                            <div class="rank-value">${formatBRL(v.valor)}</div>
                        </div>`;
    }).join('') : '<p style="color:var(--text-secondary);font-size:0.9rem;">Nenhuma venda registrada no arquivo para este mês.</p>'}
                </div>
            </div>
        </div>
    `;

    // Chart
    const ctx = document.getElementById('chart-vendas-diario').getContext('2d');

    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['1', '5', '10', '15', '20', '25', '30'],
            datasets: [
                {
                    label: 'Vendas/Dia',
                    data: [4, 8, 12, 10, 18, 15, 22],
                    backgroundColor: '#3b82f6',
                    borderRadius: 4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: { grid: { color: '#334155' } },
                x: { grid: { display: false } }
            }
        }
    });

    // Custom CSS for Ranking
    if (!document.getElementById('comercial-css')) {
        const style = document.createElement('style');
        style.id = 'comercial-css';
        style.innerHTML = `
            .ranking-list { margin-top: 1.5rem; display: flex; flex-direction: column; gap: 1.25rem; }
            .ranking-item { display: flex; align-items: center; gap: 1rem; }
            .rank-pos { width: 30px; height: 30px; border-radius: 50%; background: var(--bg-dark); border: 1px solid var(--border-color); display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 0.85rem; }
            .rank-pos.gold-medal { background: rgba(251, 191, 36, 0.2); border-color: var(--accent-gold); color: var(--accent-gold); }
            .rank-pos.silver-medal { background: rgba(148, 163, 184, 0.2); border-color: #94a3b8; color: #cbd5e1; }
            .rank-pos.bronze-medal { background: rgba(180, 83, 9, 0.2); border-color: #b45309; color: #f59e0b; }
            .rank-name { width: 120px; font-weight: 500; font-size: 0.95rem; }
            .rank-bar-container { flex: 1; height: 8px; background: var(--bg-dark); border-radius: 4px; overflow: hidden; }
            .rank-bar { height: 100%; border-radius: 4px; }
            .rank-value { width: 60px; text-align: right; font-weight: 600; font-size: 0.95rem; }
        `;
        document.head.appendChild(style);
    }
};
