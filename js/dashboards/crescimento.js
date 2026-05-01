window.initCrescimento = function () {
    const container = document.getElementById('view-crescimento');

    const pSelect = document.getElementById('period-select');
    const monthStr = pSelect ? pSelect.value : '2026-07';
    const baseData = window.clarusDataLevel1 || {};

    const getHistoricalData = (targetMonthStr) => {
        if (!window.currentUserId || window.currentUserId === "admin") return [];
        let months = [];
        let date = new Date(targetMonthStr + '-01');
        for (let i = 0; i < 6; i++) {
            let m = date.toISOString().substring(0, 7);
            months.push(m);
            date.setMonth(date.getMonth() - 1);
        }
        months.reverse();

        let history = [];
        months.forEach(m => {
            const raw = localStorage.getItem(`clarusData_${window.currentUserId}_${m}`);
            if (raw) history.push({ month: m, data: JSON.parse(raw) });
            else history.push({ month: m, data: { receita_total: 0, lucro_liquido: 0, custos: 0, despesas_operacionais: 0, impostos: 0 } });
        });
        return history;
    };

    const history = getHistoricalData(monthStr);
    const current = history[history.length - 1].data;
    const previous = history.length > 1 ? history[history.length - 2].data : { receita_total: 0, lucro_liquido: 0 };

    const calcGrowth = (curr, prev) => prev > 0 ? ((curr - prev) / prev * 100).toFixed(1) : (curr > 0 ? 100 : 0);
    const receitaGrowth = calcGrowth(current.receita_total || 0, previous.receita_total || 0);
    const lucroGrowth = calcGrowth(current.lucro_liquido || 0, previous.lucro_liquido || 0);

    const labels = history.map(h => {
        const parts = h.month.split('-');
        const monthsNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
        return monthsNames[parseInt(parts[1]) - 1];
    });

    const data = {
        evolucao_receita_ytd: receitaGrowth,
        evolucao_lucro_ytd: lucroGrowth,
        produtividade_func: (current.receita_total || 0) / 12, // Simulated per employee average
        custo_operacional_pct: current.receita_total > 0 ? (((current.despesas_operacionais || 0) / current.receita_total) * 100).toFixed(1) : 0,
        receita_historico: history.map(h => h.data.receita_total || 0),
        custo_historico: history.map(h => (h.data.custos || 0) + (h.data.despesas_operacionais || 0) + (h.data.impostos || 0))
    };

    const formatBRL = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

    container.innerHTML = `
        <div class="grid-container grid-cols-4">
            <div class="card highlight-gold">
                <div class="metric-header">
                    <span class="metric-title">Crescimento Receita</span>
                    <div class="metric-icon gold"><i class="fa-solid fa-chart-line"></i></div>
                </div>
                <div class="metric-value">MoM</div>
                <div class="metric-trend">
                    <i class="fa-solid ${data.evolucao_receita_ytd >= 0 ? 'fa-arrow-up trend-up' : 'fa-arrow-down trend-down'}"></i>
                    <span class="${data.evolucao_receita_ytd >= 0 ? 'trend-up' : 'trend-down'}">${data.evolucao_receita_ytd}%</span><span class="trend-text">vs. mês anterior</span>
                </div>
            </div>
            
            <div class="card">
                <div class="metric-header">
                    <span class="metric-title">Evolução de Lucro</span>
                    <div class="metric-icon green"><i class="fa-solid fa-piggy-bank"></i></div>
                </div>
                <div class="metric-value positive">MoM</div>
                <div class="metric-trend">
                    <i class="fa-solid ${data.evolucao_lucro_ytd >= 0 ? 'fa-arrow-up trend-up' : 'fa-arrow-down trend-down'}"></i>
                    <span class="${data.evolucao_lucro_ytd >= 0 ? 'trend-up' : 'trend-down'}">${data.evolucao_lucro_ytd}%</span><span class="trend-text">vs. mês anterior</span>
                </div>
            </div>
            
            <div class="card">
                <div class="metric-header">
                    <span class="metric-title">Eficiência Operacional</span>
                    <div class="metric-icon purple"><i class="fa-solid fa-users-gear"></i></div>
                </div>
                <div class="metric-value">${(100 - data.custo_operacional_pct).toFixed(1)}%</div>
                <div class="metric-trend">
                    <span class="trend-up">Margem Bruta</span><span class="trend-text">Pós Custos + Desp</span>
                </div>
            </div>
            
            <div class="card">
                <div class="metric-header">
                    <span class="metric-title">Custo Operacional</span>
                    <div class="metric-icon blue"><i class="fa-solid fa-gears"></i></div>
                </div>
                <div class="metric-value">${data.custo_operacional_pct}%</div>
                <div class="metric-trend">
                    <i class="fa-solid fa-bolt trend-up"></i>
                    <span class="trend-text">Peso dos custos na receita</span>
                </div>
            </div>
        </div>

        <div class="grid-container grid-cols-2">
            <div class="card">
                <div class="chart-header">
                    <span class="chart-title">Receita vs. Despesas Totais (Histórico 6 meses)</span>
                </div>
                <div class="chart-container">
                    <canvas id="chart-crescimento-historico"></canvas>
                </div>
            </div>
            
            <div class="card">
                <div class="chart-header">
                    <span class="chart-title">Indicadores de Escala</span>
                </div>
                <div class="scale-indicators">
                    <div class="scale-item">
                        <div class="scale-info">
                            <span class="scale-label">Alavancagem Operacional</span>
                            <span class="scale-desc">Lucro crescendo mais rápido que receitas</span>
                        </div>
                        <div class="scale-status ${data.evolucao_lucro_ytd > data.evolucao_receita_ytd ? 'positive' : ''}"><i class="fa-solid fa-circle-check"></i> ${data.evolucao_lucro_ytd > data.evolucao_receita_ytd ? 'Saudável' : 'Atenção'}</div>
                    </div>
                    
                    <div class="scale-item">
                        <div class="scale-info">
                            <span class="scale-label">Estabilidade de Receita</span>
                            <span class="scale-desc">Variação dos últimos meses</span>
                        </div>
                        <div class="scale-bar-bg">
                            <div class="scale-bar" style="width: 85%; background: var(--status-success);"></div>
                        </div>
                        <div class="scale-value">Baixo risco de volatilidade</div>
                    </div>

                    <div class="scale-item">
                        <div class="scale-info">
                            <span class="scale-label">Payback Est. (Base LTV)</span>
                        </div>
                        <div class="scale-bar-bg">
                            <div class="scale-bar" style="width: 70%; background: var(--accent-gold);"></div>
                        </div>
                        <div class="scale-value">Retorno em ~4.2 meses</div>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Chart
    const ctx = document.getElementById('chart-crescimento-historico').getContext('2d');

    new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Receita Operacional',
                    data: data.receita_historico,
                    borderColor: '#fbbf24',
                    backgroundColor: 'rgba(251, 191, 36, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.3
                },
                {
                    label: 'Despesas Totais',
                    data: data.custo_historico,
                    borderColor: '#3b82f6',
                    backgroundColor: 'transparent',
                    borderWidth: 2,
                    borderDash: [5, 5],
                    tension: 0.3
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'top' }
            },
            scales: {
                y: { beginAtZero: true, grid: { color: '#334155' } },
                x: { grid: { display: false } }
            }
        }
    });

    // Custom CSS for Scale Indicators
    if (!document.getElementById('crescimento-css')) {
        const style = document.createElement('style');
        style.id = 'crescimento-css';
        style.innerHTML = `
            .scale-indicators { display: flex; flex-direction: column; gap: 1.5rem; margin-top: 1.5rem; }
            .scale-item { display: flex; flex-direction: column; gap: 0.5rem; }
            .scale-info { display: flex; flex-direction: column; }
            .scale-label { font-weight: 500; font-size: 0.95rem; }
            .scale-desc { font-size: 0.8rem; color: var(--text-secondary); }
            .scale-status { font-weight: 600; display: flex; align-items: center; gap: 0.5rem; font-size: 0.9rem; margin-top: 0.25rem; }
            .scale-status.positive { color: var(--status-success); }
            .scale-bar-bg { width: 100%; height: 8px; background: var(--bg-dark); border-radius: 4px; overflow: hidden; margin-top: 0.25rem; }
            .scale-bar { height: 100%; border-radius: 4px; }
            .scale-value { font-size: 0.85rem; color: var(--text-secondary); text-align: right; }
        `;
        document.head.appendChild(style);
    }
};
