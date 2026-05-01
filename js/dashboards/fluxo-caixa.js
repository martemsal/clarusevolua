window.initFluxoCaixa = function () {
    const container = document.getElementById('view-fluxo-caixa');

    const pSelect = document.getElementById('period-select');
    const month = pSelect ? pSelect.value : (localStorage.getItem('clarusActiveMonth') || '2026-01');
    const baseData = window.clarusDataFluxo || {};
    const bankData = baseData.bancos || {};

    const viewingId = localStorage.getItem('clarusAdminViewingId') || window.currentUserId || localStorage.getItem('clarusSessionId');
    let registeredBanks = [];
    if (viewingId) {
        let companies = JSON.parse(localStorage.getItem('clarusCompanies') || '[]');
        const client = companies.find(c => c.id === viewingId);
        if (client && client.banks) registeredBanks = client.banks;
    }

    if (registeredBanks.length === 0) {
        registeredBanks = ['Itaú Unibanco', 'Caixa Econômica'];
    }

    const getHistoricalBalance = (bankName, targetMonthStr) => {
        if (!viewingId) return { balance: 0, hasHistory: false };

        let availableMonths = [];
        for (let i = 0; i < localStorage.length; i++) {
            let key = localStorage.key(i);
            const prefix = `clarusDataVenc_${viewingId}_`;
            const fallbackPrefix = `clarusData_${viewingId}_`;

            if (key && (key.startsWith(prefix) || key.startsWith(fallbackPrefix))) {
                let m = key.replace(prefix, '').replace(fallbackPrefix, '');
                if (m.length === 7 && m < targetMonthStr) availableMonths.push(m);
            }
        }

        let initialSetupBalance = 0;
        let companies = JSON.parse(localStorage.getItem('clarusCompanies') || '[]');
        const client = companies.find(c => c.id === viewingId);
        if (client && client.banks) {
            const bSetup = client.banks.find(bk => (typeof bk === 'object' ? bk.name : bk).toLowerCase() === bankName.toLowerCase());
            if (bSetup && typeof bSetup === 'object') initialSetupBalance = bSetup.initial || 0;
        }

        if (availableMonths.length === 0) return { balance: initialSetupBalance, hasHistory: initialSetupBalance !== 0 };

        availableMonths.sort();
        let rollingBalance = initialSetupBalance;
        let hasData = false;
        for (let m of availableMonths) {
            let raw = localStorage.getItem(`clarusDataVenc_${viewingId}_${m}`);
            if (!raw) raw = localStorage.getItem(`clarusData_${viewingId}_${m}`); // Fallback

            if (raw) {
                const d = JSON.parse(raw);
                const bData = d.bancos || {};
                const bKey = Object.keys(bData).find(k => k.toLowerCase() === bankName.toLowerCase());
                if (bKey) {
                    hasData = true;
                    // d.bancos[bKey].saldo_inicial is only used IF provided in the specific month's file.
                    // For Level 1, we usually just roll the initialSetupBalance.
                    rollingBalance += (bData[bKey].entradas || 0) - (bData[bKey].saidas || 0);
                }
            }
        }
        return { balance: rollingBalance, hasHistory: hasData || initialSetupBalance !== 0 };
    };

    // Consolidar todos os bancos conhecidos + bancos com dados nos arquivos
    const allBankKeys = new Set([...registeredBanks.map(b => (typeof b === 'string' ? b : b.name).toLowerCase()), ...Object.keys(bankData).map(k => k.toLowerCase())]);

    let totalConsolidado = 0;
    allBankKeys.forEach(bLower => {
        // Encontrar os dados originais do banco (Fuzzy Match: se um nome contém o outro)
        const bItem = registeredBanks.find(rb => {
            const rbName = (typeof rb === 'string' ? rb : rb.name).toLowerCase();
            return rbName === bLower || rbName.includes(bLower) || bLower.includes(rbName);
        });
        const bName = bItem ? (typeof bItem === 'string' ? bItem : bItem.name) : bLower;

        let initial = 0;
        let baseInitial = bItem ? (typeof bItem === 'string' ? null : (bItem.initial !== undefined ? bItem.initial : null)) : null;

        let credit = 0;
        let debit = 0;
        const csvKey = Object.keys(bankData).find(k => k.toLowerCase() === bLower);
        if (csvKey) {
            credit = bankData[csvKey].entradas || 0;
            debit = bankData[csvKey].saidas || 0;
            if (bankData[csvKey].saldo_inicial !== undefined && baseInitial === null) initial = bankData[csvKey].saldo_inicial;
        }

        const hist = getHistoricalBalance(bName, month);
        if (hist.hasHistory) {
            initial = hist.balance;
        } else if (csvKey && bankData[csvKey].saldo_inicial !== undefined) {
            initial = bankData[csvKey].saldo_inicial;
        } else if (baseInitial !== null) {
            initial = baseInitial;
        }

        totalConsolidado += (initial + credit - debit);
        console.log(`💰 [Balance] ${bName}: Initial=${initial}, (+)=${credit}, (-)=${debit} => Subtotal=${initial + credit - debit}`);
    });

    // --- CÁLCULO DE HISTÓRICO ANUAL (ENTRADAS X SAÍDAS) ---
    const getFluxoHistory = () => {
        const now = new Date();
        const year = month.split('-')[0];
        const entradasHist = [], saidasHist = [];
        const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

        const lastM = 12; // Mostrar sempre o ano completo para projeções
        const labels = monthNames;

        for (let m = 1; m <= 12; m++) {
            const mStr = m.toString().padStart(2, '0');
            const key = `clarusDataVenc_${viewingId}_${year}-${mStr}`;
            const fallbackKey = `clarusData_${viewingId}_${year}-${mStr}`;

            let raw = localStorage.getItem(key);
            if (!raw) raw = localStorage.getItem(fallbackKey);

            const mData = JSON.parse(raw || '{}');

            // Somar compromissos se as flags de resumo não estiverem lá
            let rec = mData.a_receber_mes || 0;
            let pag = mData.a_pagar_mes || 0;

            if (rec === 0 && pag === 0 && mData.compromissos) {
                mData.compromissos.forEach(c => {
                    if (c.tipo === 'positive') rec += c.valor;
                    else pag += c.valor;
                });
            }

            entradasHist.push(rec);
            saidasHist.push(pag);
        }
        return { labels, entradasHist, saidasHist };
    };

    const hist = getFluxoHistory();

    // Calculate 6-month projection dynamically
    const projectionData = [];
    const projectionLabels = [];
    const shortMonths = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

    let rollingBalance = totalConsolidado;
    const [currY, currM] = month.split('-').map(Number);

    for (let i = 1; i <= 6; i++) {
        const nextDate = new Date(currY, currM + i - 1, 1);
        const yStr = nextDate.getFullYear();
        const mStr = (nextDate.getMonth() + 1).toString().padStart(2, '0');
        const nextMonthKey = `clarusDataVenc_${viewingId}_${yStr}-${mStr}`;
        let nextDataRaw = localStorage.getItem(nextMonthKey);
        if (!nextDataRaw) nextDataRaw = localStorage.getItem(`clarusData_${viewingId}_${yStr}-${mStr}`); // Fallback

        const nextData = JSON.parse(nextDataRaw || '{}');
        let rec = nextData.a_receber_mes || 0;
        let pag = nextData.a_pagar_mes || 0;

        rollingBalance += (rec - pag);
        projectionData.push(rollingBalance);
        projectionLabels.push(shortMonths[nextDate.getMonth()]);
    }

    // --- INJEÇÃO DE EMPRÉSTIMOS E FINANCIAMENTOS ---
    let extraCompromissos = [];
    let extraAPagar = 0;

    if (viewingId) {
        let companies = JSON.parse(localStorage.getItem('clarusCompanies') || '[]');
        const client = companies.find(c => c.id === viewingId);
        if (client && client.loans) {
            client.loans.forEach(loan => {
                const firstDue = new Date(loan.firstDue + 'T12:00:00');
                const selectedMonthDate = new Date(month + '-01T12:00:00');
                let monthsDiff = (selectedMonthDate.getFullYear() - firstDue.getFullYear()) * 12 + (selectedMonthDate.getMonth() - firstDue.getMonth());
                let currentInstallment = monthsDiff + 1;

                if (currentInstallment >= 1 && currentInstallment <= parseInt(loan.installmentsCount)) {
                    // Parcela vence neste mês
                    const day = loan.firstDue.split('-')[2];
                    const val = parseFloat(loan.installmentValue);
                    extraCompromissos.push({
                        data: `${day}/${month.split('-')[1]}`,
                        titulo: `Empréstimo: ${loan.bank} (${currentInstallment.toString().padStart(3, '0')}/${parseInt(loan.installmentsCount).toString().padStart(3, '0')})`,
                        valor: val,
                        tipo: 'negative',
                        _source: 'Loans Module'
                    });
                    extraAPagar += val;
                }
            });
        }
    }

    const data = {
        saldo_atual: totalConsolidado,
        a_receber_mes: baseData.a_receber_mes || 0,
        a_pagar_mes: (baseData.a_pagar_mes || 0) + extraAPagar,
        projecao_final: totalConsolidado + (baseData.a_receber_mes || 0) - ((baseData.a_pagar_mes || 0) + extraAPagar),
        projecao_mensal: projectionData,
        projecao_labels: projectionLabels,
        compromissos: [...(baseData.compromissos || []), ...extraCompromissos]
    };

    const formatBRL = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

    const getDailyData = () => {
        const daysInMonth = new Date(currY, currM, 0).getDate();
        const labels = Array.from({ length: daysInMonth }, (_, i) => (i + 1).toString());
        const entradas = new Array(daysInMonth).fill(0);
        const saidas = new Array(daysInMonth).fill(0);

        (data.compromissos || []).forEach(c => {
            if (!c.data) return;
            let day = 0;
            const dStr = c.data.toString();
            if (dStr.includes('/')) {
                day = parseInt(dStr.split('/')[0]);
            } else if (dStr.includes('-')) {
                // Assume YYYY-MM-DD
                day = parseInt(dStr.split('-')[2]);
            }

            if (day >= 1 && day <= daysInMonth) {
                if (c.tipo === 'positive') entradas[day - 1] += c.valor;
                else saidas[day - 1] += c.valor;
            }
        });
        return { labels, entradas, saidas };
    };

    const getWeeklyData = () => {
        const labels = ['Semana 1', 'Semana 2', 'Semana 3', 'Semana 4', 'Semana 5'];
        const entradas = new Array(5).fill(0);
        const saidas = new Array(5).fill(0);

        (data.compromissos || []).forEach(c => {
            if (!c.data) return;
            let day = 0;
            const dStr = c.data.toString();
            if (dStr.includes('/')) day = parseInt(dStr.split('/')[0]);
            else if (dStr.includes('-')) day = parseInt(dStr.split('-')[2]);
            const weekIdx = Math.min(Math.floor((day - 1) / 7), 4);
            if (c.tipo === 'positive') entradas[weekIdx] += c.valor;
            else saidas[weekIdx] += c.valor;
        });
        return { labels, entradas, saidas };
    };

    let chartInstance = null;

    const renderMainChart = (filter = 'monthly') => {
        const canvas = document.getElementById('chart-fluxo-caixa');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (chartInstance) chartInstance.destroy();

        let labels, entradas, saidas;

        if (filter === 'daily') {
            const d = getDailyData();
            labels = d.labels; entradas = d.entradas; saidas = d.saidas;
        } else if (filter === 'weekly') {
            const w = getWeeklyData();
            labels = w.labels; entradas = w.entradas; saidas = w.saidas;
        } else {
            labels = hist.labels; entradas = hist.entradasHist; saidas = hist.saidasHist;
        }

        const datasets = [];
        if (tlTypeFilter === 'all' || tlTypeFilter === 'receive') {
            datasets.push({
                label: 'Entradas',
                data: entradas,
                borderColor: '#3b82f6',
                backgroundColor: filter === 'daily' ? 'rgba(59, 130, 246, 0.5)' : 'transparent',
                borderWidth: 3,
                tension: 0.4
            });
        }
        if (tlTypeFilter === 'all' || tlTypeFilter === 'pay') {
            datasets.push({
                label: 'Saídas',
                data: saidas,
                borderColor: '#f97316',
                backgroundColor: filter === 'daily' ? 'rgba(249, 115, 22, 0.5)' : 'transparent',
                borderWidth: 3,
                tension: 0.4
            });
        }

        chartInstance = new Chart(ctx, {
            type: filter === 'daily' ? 'bar' : 'line',
            data: {
                labels: labels,
                datasets: datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: true, position: 'bottom' } },
                scales: {
                    y: { ticks: { callback: (v) => formatBRL(v).replace(',00', '') } },
                    x: { ticks: { rotation: filter === 'daily' ? 90 : 0 } }
                }
            }
        });
    };

    let tlTypeFilter = 'all';
    let tlTimeFilter = 'month';

    const getWeekNumber = (dateStr) => {
        const dStr = dateStr.toString();
        let day = 0;
        if (dStr.includes('/')) day = parseInt(dStr.split('/')[0]);
        else if (dStr.includes('-')) day = parseInt(dStr.split('-')[2]);
        return Math.min(Math.floor((day - 1) / 7), 4);
    };

    const isCurrentMonth = () => {
        const now = new Date();
        const nowStr = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
        return month === nowStr;
    };

    const renderTimeline = () => {
        const timeline = container.querySelector('.timeline');
        if (!timeline) return;

        let filtered = data.compromissos || [];

        // 1. Filter by Type
        if (tlTypeFilter === 'pay') filtered = filtered.filter(c => c.tipo === 'negative');
        if (tlTypeFilter === 'receive') filtered = filtered.filter(c => c.tipo === 'positive');

        // 2. Filter by Time
        const now = new Date();
        const currentDay = now.getDate();
        const currentWeekPos = Math.min(Math.floor((currentDay - 1) / 7), 4);

        if (tlTimeFilter === 'day') {
            filtered = filtered.filter(c => {
                if (!c.data) return false;
                let d = 0;
                const dStr = c.data.toString();
                if (dStr.includes('/')) d = parseInt(dStr.split('/')[0]);
                else if (dStr.includes('-')) d = parseInt(dStr.split('-')[2]);
                // If viewing current month, show today. Otherwise show first day as placeholder or filter accurately.
                // Logic: always filter by the day matching 'now' if in same month, else just first day?
                // Better: filter by current day if month is current, else show nothing or show all (User said "only what I have to pay TODAY")
                return isCurrentMonth() ? d === currentDay : d === 1;
            });
        } else if (tlTimeFilter === 'week') {
            filtered = filtered.filter(c => {
                if (!c.data) return false;
                const w = getWeekNumber(c.data);
                return isCurrentMonth() ? w === currentWeekPos : w === 0;
            });
        }

        if (filtered.length === 0) {
            timeline.innerHTML = '<p style="padding:1.5rem; color:#64748b; text-align:center; font-size:0.85rem; font-style:italic;">Nenhum item localizado com estes filtros.</p>';
            return;
        }

        timeline.innerHTML = filtered.map(c => {
            let label = '--';
            const dStr = c.data ? c.data.toString() : '';
            if (dStr.includes('/')) label = dStr.split('/')[0] + '/' + (dStr.split('/')[1] || '').substring(0, 2);
            else if (dStr.includes('-')) label = dStr.split('-')[2] + '/' + dStr.split('-')[1];

            return `
            <div class="timeline-item">
                <div class="tl-date">${label}</div>
                <div class="tl-content">
                    <span class="tl-title ${c.tipo === 'negative' ? 'negative' : 'positive'}">${c.titulo}</span>
                    <span class="tl-value" style="color:${c.tipo === 'negative' ? 'var(--status-danger)' : 'var(--status-success)'}">${formatBRL(c.valor)}</span>
                </div>
            </div>
            `;
        }).join('');
    };

    const renderDetailedFlow = () => {
        const detailContainer = container.querySelector('#detailed-flow-container');
        if (!detailContainer) return;

        // 1. Calculate Monthly Initial Balance
        // We know totalConsolidado = initial + mCredit - mDebit
        // So Initial = totalConsolidado - (mCredit - mDebit)
        const mCredit = baseData.a_receber_mes || 0;
        const mDebit = baseData.a_pagar_mes || 0;
        let runningBalance = data.saldo_atual - (mCredit - mDebit);
        const monthlyInitial = runningBalance;

        let html = `
            <div class="excel-table">
                <div class="excel-row header-main">
                    <div class="excel-cell">SALDO INICIAL MENSAL</div>
                    <div class="excel-cell value">${formatBRL(monthlyInitial)}</div>
                </div>
        `;

        const compromissos = [...(data.compromissos || [])].sort((a, b) => {
            let dA = 0, dB = 0;
            const sa = a.data.toString(), sb = b.data.toString();
            if (sa.includes('/')) dA = parseInt(sa.split('/')[0]);
            else if (sa.includes('-')) dA = parseInt(sa.split('-')[2]);
            if (sb.includes('/')) dB = parseInt(sb.split('/')[0]);
            else if (sb.includes('-')) dB = parseInt(sb.split('-')[2]);
            return dA - dB;
        });

        // Group by Week
        for (let w = 0; w < 5; w++) {
            const weekItems = compromissos.filter(c => getWeekNumber(c.data) === w);
            if (weekItems.length === 0) continue;

            html += `
                <div class="excel-week-group">
                    <div class="excel-week-label">SEMANA ${w + 1}</div>
                    <div class="excel-week-content">
                        <div class="excel-row header-cols">
                            <div class="excel-cell">DATA</div>
                            <div class="excel-cell flex-2">CONTAS</div>
                            <div class="excel-cell">RECEBER</div>
                            <div class="excel-cell">PAGAR</div>
                        </div>
            `;

            // Group by Day
            const daysInWeek = [...new Set(weekItems.map(c => c.data))];
            daysInWeek.forEach(dayStr => {
                const dayItems = weekItems.filter(c => c.data === dayStr);
                dayItems.forEach(item => {
                    const isRec = item.tipo === 'positive';
                    if (isRec) runningBalance += item.valor;
                    else runningBalance -= item.valor;

                    html += `
                        <div class="excel-row item-row">
                            <div class="excel-cell">${dayStr}</div>
                            <div class="excel-cell flex-2">${item.titulo}</div>
                            <div class="excel-cell ${isRec ? 'positive' : ''}">${isRec ? formatBRL(item.valor) : ''}</div>
                            <div class="excel-cell ${!isRec ? 'negative' : ''}">${!isRec ? formatBRL(item.valor) : ''}</div>
                        </div>
                    `;
                });

                html += `
                    <div class="excel-row daily-balance">
                        <div class="excel-cell flex-3">SALDO FINAL DIÁRIO</div>
                        <div class="excel-cell value">${formatBRL(runningBalance)}</div>
                    </div>
                `;
            });

            html += `
                        <div class="excel-row weekly-balance">
                            <div class="excel-cell flex-3">SALDO FINAL SEMANAL</div>
                            <div class="excel-cell value">${formatBRL(runningBalance)}</div>
                        </div>
                    </div>
                </div>
            `;
        }

        html += `
                <div class="excel-footer">
                    <div class="excel-row footer-row">
                        <div class="excel-cell flex-3">TOTAL MENSAL</div>
                        <div class="excel-cell positive">${formatBRL(mCredit)}</div>
                        <div class="excel-cell negative">${formatBRL(mDebit)}</div>
                    </div>
                    <div class="excel-row footer-row main-result">
                        <div class="excel-cell flex-3">SALDO FINAL MENSAL</div>
                        <div class="excel-cell value highlight">${formatBRL(runningBalance)}</div>
                    </div>
                </div>
            </div>
        `;

        detailContainer.innerHTML = html;
    };

    container.innerHTML = `
        <div class="grid-container grid-cols-4">
            <!-- Metrics -->
            <div class="card highlight-blue">
                <div class="metric-header">
                    <span class="metric-title">Saldo Inicial</span>
                    <div class="metric-icon blue"><i class="fa-solid fa-wallet"></i></div>
                </div>
                <div class="metric-value">${formatBRL(data.saldo_atual)}</div>
                <div class="metric-trend"><span class="trend-text">Saldo disponível no início do período</span></div>
            </div>
            <div class="card highlight-green">
                <div class="metric-header">
                    <span class="metric-title">A Receber (Mês)</span>
                    <div class="metric-icon green"><i class="fa-solid fa-hand-holding-dollar"></i></div>
                </div>
                <div class="metric-value">${formatBRL(data.a_receber_mes)}</div>
                <div class="metric-trend"><span class="trend-text">Entradas previstas</span></div>
            </div>
            <div class="card highlight-red">
                <div class="metric-header">
                    <span class="metric-title">A Pagar (Mês)</span>
                    <div class="metric-icon red"><i class="fa-solid fa-money-bill-transfer"></i></div>
                </div>
                <div class="metric-value">${formatBRL(data.a_pagar_mes)}</div>
                <div class="metric-trend"><span class="trend-text">Saídas previstas</span></div>
            </div>
            <div class="card">
                <div class="metric-header">
                    <span class="metric-title">Projeção Final</span>
                    <div class="metric-icon ${data.projecao_final >= 0 ? 'blue' : 'red'}"><i class="fa-solid fa-scale-balanced"></i></div>
                </div>
                <div class="metric-value">${formatBRL(data.projecao_final)}</div>
                <div class="metric-trend">
                    <i class="fa-solid ${data.projecao_final >= 0 ? 'fa-arrow-up trend-up' : 'fa-arrow-down trend-down'}"></i>
                    <span class="${data.projecao_final >= 0 ? 'trend-up' : 'trend-down'}">${data.projecao_final >= 0 ? 'Fluxo Positivo' : 'Fluxo Negativo'}</span>
                </div>
            </div>
        </div>

        <div class="grid-container grid-cols-3">
            <div class="card" style="grid-column: span 2;">
                <div class="chart-header" style="justify-content: space-between;">
                    <span class="chart-title" style="color:var(--accent-gold); font-size:1.2rem; font-weight:700;">Entradas x Saídas</span>
                    <div class="time-filters" style="display:flex; gap:8px;">
                        <button class="btn-time-filter active" data-time="monthly">Mensal</button>
                        <button class="btn-time-filter" data-time="weekly">Semanal</button>
                        <button class="btn-time-filter" data-time="daily">Diário</button>
                    </div>
                </div>
                <div class="chart-container">
                    <canvas id="chart-fluxo-caixa"></canvas>
                </div>
            </div>
            
            <div class="card">
                <div class="chart-header" style="flex-direction:column; align-items:flex-start; gap:10px;">
                    <span class="chart-title">Compromissos</span>
                    
                    <div style="width:100%; display:flex; flex-direction:column; gap:8px;">
                        <div class="tl-filters" style="display:flex; gap:5px; border-bottom: 1px solid var(--border-color); padding-bottom: 8px;">
                            <button class="btn-tl-filter active" data-filter="all">Tudo</button>
                            <button class="btn-tl-filter" data-filter="receive" style="color:var(--status-success);">Rec.</button>
                            <button class="btn-tl-filter" data-filter="pay" style="color:var(--status-danger);">Pag.</button>
                        </div>
                        <div class="tl-time-filters" style="display:flex; gap:5px;">
                            <button class="btn-tl-time-filter" data-time="day">Hoje</button>
                            <button class="btn-tl-time-filter" data-time="week">Semana</button>
                            <button class="btn-tl-time-filter active" data-time="month">Mês</button>
                        </div>
                    </div>
                </div>
                <div class="timeline">
                    <!-- Dynamic Rendering -->
                </div>
            </div>
        </div>

        <!-- DETAILED FLOW STATEMENT AREA -->
        <div class="grid-container">
            <div class="card" style="grid-column: span 4;">
                <div class="chart-header">
                    <span class="chart-title" style="color:var(--accent-gold);">Demonstrativo de Fluxo de Caixa Detalhado</span>
                </div>
                <div id="detailed-flow-container">
                    <!-- Dynamic Excel-style content -->
                </div>
            </div>
        </div>
    `;

    // Initialize
    let currentChartTime = 'monthly';
    renderMainChart(currentChartTime);
    renderTimeline();
    renderDetailedFlow();

    const syncTimeFilters = (time) => {
        // Map list filters to chart filters
        const mapToChart = { 'day': 'daily', 'week': 'weekly', 'month': 'monthly' };
        const mapToList = { 'daily': 'day', 'weekly': 'week', 'monthly': 'month' };

        // 1. Sync Chart Buttons
        const chartTime = mapToChart[time] || time;
        container.querySelectorAll('.btn-time-filter').forEach(b => {
            b.classList.toggle('active', b.getAttribute('data-time') === chartTime);
        });

        // 2. Sync List Buttons
        const listTime = mapToList[time] || time;
        container.querySelectorAll('.btn-tl-time-filter').forEach(b => {
            b.classList.toggle('active', b.getAttribute('data-time') === listTime);
        });

        tlTimeFilter = listTime;
        currentChartTime = chartTime;

        renderMainChart(currentChartTime);
        renderTimeline();
    };

    // Listeners for Chart Time
    container.querySelectorAll('.btn-time-filter').forEach(btn => {
        btn.onclick = () => syncTimeFilters(btn.getAttribute('data-time'));
    });

    // Listeners for Timeline (Type)
    container.querySelectorAll('.btn-tl-filter').forEach(btn => {
        btn.onclick = () => {
            container.querySelectorAll('.btn-tl-filter').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            tlTypeFilter = btn.getAttribute('data-filter');
            renderTimeline();
            renderMainChart(currentChartTime);
        };
    });

    // Listeners for Timeline (Time)
    container.querySelectorAll('.btn-tl-time-filter').forEach(btn => {
        btn.onclick = () => syncTimeFilters(btn.getAttribute('data-time'));
    });

    // Styles
    if (!document.getElementById('fluxo-caixa-refined-css')) {
        const style = document.createElement('style');
        style.id = 'fluxo-caixa-refined-css';
        style.innerHTML = `
            .btn-time-filter, .btn-tl-filter, .btn-tl-time-filter {
                padding: 5px 12px;
                font-size: 0.72rem;
                font-weight: 600;
                background: var(--bg-dark);
                border: 1px solid var(--border-color);
                color: var(--text-secondary);
                border-radius: 4px;
                cursor: pointer;
                transition: all 0.2s ease;
                flex: 1;
                text-align: center;
            }
            .btn-time-filter:hover, .btn-tl-filter:hover, .btn-tl-time-filter:hover { border-color: var(--accent-gold); color: white; }
            .btn-time-filter.active, .btn-tl-filter.active, .btn-tl-time-filter.active { background: var(--accent-gold); color: black; border-color: var(--accent-gold); }
            
            .timeline { margin-top: 1rem; max-height: 300px; overflow-y: auto; padding-right: 5px; }
            .timeline-item { display: flex; gap: 1rem; margin-bottom: 0.8rem; align-items: center; padding-bottom: 0.8rem; border-bottom: 1px solid var(--border-color); }
            .tl-date { width: 45px; font-weight: 600; font-size: 0.8rem; color: var(--text-secondary); text-align: center; }
            .tl-content { flex: 1; display: flex; justify-content: space-between; align-items: center; }
            .tl-title { font-size: 0.85rem; font-weight: 500; }
            .tl-value { font-weight: 700; font-family: 'JetBrains Mono', monospace; font-size: 0.9rem; }

            /* EXCEL TABLE STYLES */
            .excel-table { background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 8px; overflow: hidden; margin-top: 1rem; font-family: 'Inter', sans-serif; }
            .excel-row { display: flex; border-bottom: 1px solid var(--border-color); align-items: center; }
            .excel-cell { padding: 12px 15px; flex: 1; border-right: 1px solid var(--border-color); font-size: 0.85rem; }
            .excel-cell:last-child { border-right: none; }
            .excel-cell.value { font-family: 'JetBrains Mono', monospace; font-weight: 700; text-align: right; }
            .excel-cell.flex-2 { flex: 2; }
            .excel-cell.flex-3 { flex: 3; }
            
            .header-main { background: #1e293b; color: white; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; }
            .header-main .excel-cell { color: var(--accent-gold); }

            .excel-week-group { border-bottom: 3px solid var(--border-color); }
            .excel-week-label { background: #0f172a; padding: 10px 15px; font-weight: 800; font-size: 0.9rem; color: var(--accent-gold); border-bottom: 1px solid var(--border-color); }
            
            .header-cols { background: rgba(255,255,255,0.03); font-weight: 700; font-size: 0.75rem; text-transform: uppercase; color: var(--text-secondary); }
            
            .item-row:hover { background: rgba(255,255,255,0.02); }
            .item-row .excel-cell.positive { color: #4ade80; font-weight: 600; text-align: right; }
            .item-row .excel-cell.negative { color: #f87171; font-weight: 600; text-align: right; }
            
            .daily-balance { background: rgba(59, 130, 246, 0.05); }
            .daily-balance .excel-cell:first-child { text-align: right; font-weight: 700; color: #60a5fa; font-size: 0.75rem; }
            .daily-balance .excel-cell.value { color: #60a5fa; }

            .weekly-balance { background: rgba(251, 191, 36, 0.1); border-bottom: none; }
            .weekly-balance .excel-cell:first-child { text-align: right; font-weight: 800; color: var(--accent-gold); text-transform: uppercase; }
            .weekly-balance .excel-cell.value { color: var(--accent-gold); font-size: 1rem; }

            .excel-footer { background: #0f172a; border-top: 2px solid var(--accent-gold); }
            .footer-row { background: transparent; }
            .footer-row .excel-cell.positive { color: #4ade80; text-align: right; font-weight: 700; }
            .footer-row .excel-cell.negative { color: #f87171; text-align: right; font-weight: 700; }
            
            .main-result { background: #1e293b; }
            .main-result .excel-cell:first-child { text-align: right; font-weight: 900; color: white; font-size: 1rem; }
            .main-result .excel-cell.value.highlight { color: white; background: #3b82f6; font-size: 1.1rem; }
        `;
        document.head.appendChild(style);
    }
};
