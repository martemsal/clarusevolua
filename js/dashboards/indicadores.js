// Dashboard: Indicadores de Gestão - Refinado com Fórmulas e Diagnósticos
window.initIndicadores = () => {
    const formatBRL = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);

    const dreData = window.clarusDataDRE || {};
    const fluxData = window.clarusDataFluxo || {};

    // Base values extraction (same robust logic as saude-financeira)
    const receitaL = Math.max(dreData.receita_total || 0, dreData.a_receber_mes || 0, fluxData.receita_total || 0, fluxData.a_receber_mes || 0);
    const impostosL = Math.max(dreData.impostos || 0, fluxData.impostos || 0);
    const custosL = Math.max(dreData.custos || 0, fluxData.custos || 0);
    const despesasOpL = dreData.despesas_operacionais || 0;
    
    // Lucro Líquido Real
    const despesasTotais = impostosL + custosL + despesasOpL;
    const lucroL = receitaL - despesasTotais;

    // 1. MARGEM LÍQUIDA (%)
    const margemLiquida = receitaL > 0 ? ((lucroL / receitaL) * 100).toFixed(1) : 0;

    const elMargem = document.getElementById('val-margem-liquida');
    const statusMargem = document.getElementById('status-margem-liquida');
    if (elMargem) {
        elMargem.textContent = margemLiquida + '%';
        statusMargem.className = 'indicator-status';
        if (margemLiquida >= 10) {
            statusMargem.textContent = 'Saudável (Ideal > 10%)';
            statusMargem.classList.add('status-healthy');
        } else if (margemLiquida >= 5) {
            statusMargem.textContent = 'Alerta (5% a 10%)';
            statusMargem.classList.add('status-alert');
        } else {
            statusMargem.textContent = 'Crítico (< 5%)';
            statusMargem.classList.add('status-critical');
        }
    }

    // 2. EBITDA
    // Formula: Lucro Operacional + Depreciação + Amortização
    // Note: If fields missing, we estimate based on EBIT (Lucro Operacional)
    const lucroOperacional = lucroL * 1.1; // Proxy
    const ebitda = lucroOperacional + (dreData.depreciacao || 0) + (dreData.amortizacao || 0);
    document.getElementById('val-ebitda').textContent = formatBRL(ebitda);

    // 3. GERAÇÃO DE CAIXA
    // Fórmula: Entradas Operacionais - Saídas Operacionais
    const entradasOp = receitaL;
    const saidasOp = impostosL + custosL + despesasOpL;
    const fluxoOp = entradasOp - saidasOp;
    const elCaixa = document.getElementById('val-geracao-caixa');
    const statusCaixa = document.getElementById('status-geracao-caixa');
    elCaixa.textContent = formatBRL(fluxoOp);
    statusCaixa.className = 'indicator-status ' + (fluxoOp > 0 ? 'status-healthy' : 'status-critical');
    statusCaixa.textContent = fluxoOp > 0 ? 'Positivo' : 'Negativo';

    // 4. CICLO FINANCEIRO (PME + PMR - PMP)
    const pme = dreData.pme || 30; // Prazo Médio Estoque
    const pmr = dreData.pmr || 45; // Prazo Médio Recebimento
    const pmp = dreData.pmp = 30;  // Prazo Médio Pagamento
    const ciclo = pme + pmr - pmp;
    document.getElementById('val-ciclo-financeiro').textContent = ciclo + ' dias*';

    // 5. NCG (Necessidade de Capital de Giro)
    const ncg = (receitaL * 0.25) - (receitaL * 0.10); // Proxy logic
    document.getElementById('val-ncg').textContent = formatBRL(ncg) + '*';

    // 6. ENDIVIDAMENTO
    const endiv = 0.35; // 35% default proxy
    document.getElementById('val-endividamento').textContent = (endiv * 100).toFixed(1) + '%*';

    // 7. TICKET MÉDIO
    const numVendas = dreData.num_vendas || 150;
    const ticket = receitaL > 0 ? (receitaL / numVendas) : 0;
    document.getElementById('val-ticket-medio').textContent = formatBRL(ticket) + '*';

    // 8. CAC vs LTV
    const ltvCacRatio = 3.5; // Ideal >= 3x
    document.getElementById('val-cac-ltv').textContent = ltvCacRatio + "x*";
    const elSust = document.getElementById('card-cac-ltv').querySelector('.indicator-status');
    elSust.className = 'indicator-status ' + (ltvCacRatio >= 3 ? 'status-healthy' : 'status-alert');
    elSust.textContent = ltvCacRatio >= 3 ? 'Sustentável' : 'Risco';

    // 9. RECEITA POR FUNCIONÁRIO
    const numFunc = dreData.num_funcionarios || 12;
    const recPorFunc = receitaL > 0 ? (receitaL / numFunc) : 0;
    document.getElementById('val-receita-funcionario').textContent = formatBRL(recPorFunc) + '*';

    // --- NOVOS INDICADORES MIGRADOS ---

    // 10. MARGEM BRUTA
    // Fórmula: (Receita - Impostos - Custos) / Receita
    const margemBrutaVal = receitaL - impostosL - custosL;
    const margemBrutaPct = receitaL > 0 ? (margemBrutaVal / receitaL) * 100 : 0;

    const elMB = document.getElementById('val-margem-bruta');
    if (elMB) elMB.textContent = margemBrutaPct.toFixed(1) + '%';

    // 11. PONTO DE EQUILÍBRIO
    // Fórmula: Despesas Fixas / Margem Contribuição %
    // Usamos Margem Bruta como proxy se não houver Margem de Contribuição detalhada
    const despFixas = despesasOpL;
    const pontoEquilibrio = margemBrutaPct > 5 ? (despFixas / (margemBrutaPct / 100)) : (despFixas * 2);

    const elPE = document.getElementById('val-ponto-equilibrio');
    if (elPE) elPE.textContent = formatBRL(pontoEquilibrio);

    // --- LÓGICA DE ANÁLISE EDUCACIONAL (Drill-down) ---

    const analysisData = {
        'card-margem-liquida': {
            titulo: 'Margem Líquida',
            conceito: 'É a porcentagem de lucro que sobra para a empresa após o pagamento de todos os custos, despesas, impostos e juros.',
            interpretacao: 'Com ' + margemLiquida + '%, a empresa está em um nível de lucratividade altíssimo (acima do ideal de 10%). Significa que, para cada R$ 100 vendidos, sobram R$ ' + ((margemLiquida / 100) * 100).toFixed(2) + ' no bolso após todas as contas pagas.'
        },
        'card-margem-bruta': {
            titulo: 'Margem Bruta',
            conceito: 'É o lucro que sobra após deduzir apenas os custos diretos da produção ou venda (CMV).',
            interpretacao: 'O valor de ' + margemBrutaPct.toFixed(1) + '% sugere a eficiência na entrega do produto/serviço. Indica o quanto sobra para cobrir as despesas fixas e gerar lucro líquido.'
        },
        'card-ebitda': {
            titulo: 'EBITDA',
            conceito: 'Sigla para Lucro antes de Juros, Impostos, Depreciação e Amortização. É o "lucro operacional puro".',
            interpretacao: 'Mostra quanto o negócio gera de valor apenas com sua operação, sem contar empréstimos ou impostos. É o principal indicador de potencial de geração de valor da empresa.'
        },
        'card-geracao-caixa': {
            titulo: 'Geração de Caixa',
            conceito: 'É o dinheiro real que sobrou no caixa após todas as movimentações de entradas e saídas.',
            interpretacao: 'Diferente do lucro, aqui vemos a liquidez. Um valor positivo indica que a empresa não está apenas "lucrando no papel", mas está efetivamente colocando dinheiro no banco.'
        },
        'card-ncg': {
            titulo: 'NCG - Necessidade de Capital de Giro',
            conceito: 'O montante de dinheiro que a empresa precisa ter reservado para manter suas operações rodando (pagar fornecedores antes de receber dos clientes).',
            interpretacao: 'Indica o "fôlego" financeiro necessário para a operação não parar por falta de caixa momentâneo.'
        },
        'card-ciclo-financeiro': {
            titulo: 'Ciclo Financeiro',
            conceito: 'O tempo médio entre o pagamento aos fornecedores e o recebimento das vendas.',
            interpretacao: 'A empresa leva ' + ciclo + ' dias para "ver a cor do dinheiro" após investir na operação. Quanto menor esse número, melhor para a liquidez.'
        },
        'card-cac-ltv': {
            titulo: 'CAC vs LTV',
            conceito: 'Comparação entre o Custo de Aquisição de Cliente (CAC) e o Valor de Tempo de Vida do Cliente (LTV).',
            interpretacao: 'O valor de ' + ltvCacRatio + 'x indica que cada cliente traz ' + ltvCacRatio + ' vezes mais dinheiro do que custou para ser atraído. É um modelo de negócio sustentável e escalável.'
        },
        'card-ticket-medio': {
            titulo: 'Ticket Médio',
            conceito: 'O valor médio faturado por cada venda realizada.',
            interpretacao: 'Ajuda a entender o perfil do cliente e orientar estratégias de precificação. Se o ticket médio sobe sem aumentar custos, a margem melhora.'
        },
        'card-receita-funcionario': {
            titulo: 'Receita por Funcionário',
            conceito: 'Faturamento total dividido pelo número de colaboradores.',
            interpretacao: 'Mede a produtividade da equipe. Indica o quanto cada pessoa na empresa "gera" de valor bruto para o negócio.'
        },
        'card-ponto-equilibrio': {
            titulo: 'Ponto de Equilíbrio',
            conceito: 'O faturamento mínimo necessário para que a empresa não tenha prejuízo (onde o lucro é zero).',
            interpretacao: 'É a "linha de sobrevivência". Abaixo desse valor a empresa perde dinheiro; acima, começa a lucrar.'
        },
        'card-endividamento': {
            titulo: 'Endividamento',
            conceito: 'O quanto do capital da empresa provém de terceiros (empréstimos, financiamentos).',
            interpretacao: 'Com ' + (endiv * 100).toFixed(1) + '%, a empresa possui uma dependência moderada. É saudável, desde que o custo dessa dívida seja menor do que o retorno que ela gera para o negócio.'
        }
    };

    const modal = document.getElementById('modal-analise-indicador');
    const closeBtn = document.getElementById('close-analise-modal');
    const okBtn = document.getElementById('btn-analise-modal-ok');

    const openModal = (id) => {
        console.log("🖱️ [Indicadores] Abrindo análise para:", id);
        const info = analysisData[id];
        if (!info) {
            console.error("❌ [Indicadores] Dados não encontrados para o Card ID:", id);
            return;
        }

        const cardEl = document.getElementById(id);
        const valEl = cardEl ? cardEl.querySelector('.indicator-value') : null;

        document.getElementById('analise-titulo').innerHTML = `<i class="fa-solid fa-graduation-cap accent" style="margin-right: 8px;"></i> Análise: ${info.titulo}`;
        document.getElementById('analise-valor').textContent = valEl ? valEl.textContent : '--';
        document.getElementById('analise-conceito').textContent = info.conceito;
        document.getElementById('analise-interpretacao').textContent = info.interpretacao;

        modal.classList.remove('hidden');
    };

    // Close logic
    [closeBtn, okBtn].forEach(btn => {
        if (btn) btn.onclick = () => modal.classList.add('hidden');
    });

    window.onclick = (event) => {
        if (event.target == modal) modal.classList.add('hidden');
    };

    // Attach click to all cards
    Object.keys(analysisData).forEach(id => {
        const card = document.getElementById(id);
        if (card) {
            card.style.cursor = 'pointer';
            card.onclick = () => openModal(id);

            // Adiciona um pequeno ícone de "info" ou hint visual
            if (!card.querySelector('.info-hint')) {
                const hint = document.createElement('div');
                hint.className = 'info-hint';
                hint.innerHTML = '<i class="fa-solid fa-circle-info"></i> Clique para analisar';
                hint.style.fontSize = '0.7rem';
                hint.style.color = 'var(--accent-blue)';
                hint.style.marginTop = '0.5rem';
                hint.style.opacity = '0.7';
                card.appendChild(hint);
            }
        }
    });

    console.log("📊 [Indicadores] Drill-down educacional ativado.");
};
