// LIA - Leitura Inteligente Avançada - Chat Widget Logic with Gemini & Smart Local Fallback
document.addEventListener('DOMContentLoaded', () => {
    const fab = document.getElementById('ai-chat-btn');
    const panel = document.getElementById('ai-chat-window');
    const closeBtn = document.getElementById('ai-chat-close');
    const inputField = document.getElementById('ai-chat-input');
    const sendBtn = document.getElementById('ai-send-btn');
    const micBtn = document.getElementById('ai-mic-btn');
    const messagesBox = document.getElementById('ai-chat-messages');

    let currentLIAData = null;
    let currentLIAMonthLabel = null;
    let currentLIAMonthVal = null;

    const observer = new MutationObserver(() => {
        const appScreen = document.getElementById('app-screen');
        if (!appScreen.classList.contains('hidden')) { fab.classList.remove('hidden'); }
        else { fab.classList.add('hidden'); panel.classList.add('hidden'); }
    });
    observer.observe(document.getElementById('app-screen'), { attributes: true, attributeFilter: ['class'] });

    fab.addEventListener('click', () => {
        panel.classList.toggle('hidden');
        if (!panel.classList.contains('hidden')) inputField.focus();
    });
    closeBtn.addEventListener('click', () => panel.classList.add('hidden'));

    const formatBRL = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);

    const extractMonthsFromQuery = (text) => {
        const monthsMap = {
            'janeiro': '01', 'fevereiro': '02', 'março': '03', 'marco': '03', 'abril': '04',
            'maio': '05', 'junho': '06', 'julho': '07', 'agosto': '08', 'setembro': '09',
            'outubro': '10', 'novembro': '11', 'dezembro': '12'
        };
        let found = [];
        for (let m in monthsMap) { if (text.includes(m)) found.push({ label: m.charAt(0).toUpperCase() + m.slice(1) + " 2026", value: `2026-${monthsMap[m]}` }); }
        return found;
    };

    const callGemini = async (userMessage, jsonData, month) => {
        const apiKey = localStorage.getItem('clarusGeminiKey');
        if (!apiKey) {
            console.log("LIA: Gemini API Key não encontrada no localStorage.");
            return null;
        }

        const companyName = document.getElementById('display-company-name')?.textContent || 'Cliente';
        const systemPrompt = `Você é a LIA da CLARUS EVOLUA. Personalidade: Consultora Financeira de Elite, Amigável e Estratégica.
Sua missão é analisar os dados de ${month} do cliente ${companyName} usando estas 9 diretrizes estritas:

1. MARGEM LÍQUIDA: (Lucro Líquido / Receita Líquida) * 100. Saudável > 10%, Alerta 5-10%, Crítico < 5%. Se baixo: revisar custos, cortar despesas, reavaliar preços.
2. EBITDA: Lucro Operacional + Depreciação + Amortização. Mostra geração de resultado puro. Melhore reduzindo despesas operacionais.
3. GERAÇÃO DE CAIXA: Entradas Op - Saídas Op. Deve ser positivo. Se negativo: melhorar cobrança e rever prazos.
4. CICLO FINANCEIRO: PME + PMR - PMP. Quanto menor, melhor. Se alto: reduzir estoque, receber rápido, negociar fornecedores.
5. NCG (Capital de Giro): Ativo Circulante Op - Passivo Circulante Op. Quanto menor, melhor.
6. ENDIVIDAMENTO: Passivo Total / Ativo Total. Quanto menor, melhor.
7. TICKET MÉDIO: Receita Total / Nº de Vendas. Busque estratégias de Upsell/Cross-sell se estiver baixo.
8. CAC vs LTV: LTV deve ser >= 3x o CAC. Se ruim: reduzir custo aquisição ou aumentar retenção.
9. RECEITA POR FUNCIONÁRIO: Receita Total / Nº Funcionários. Mede eficiência operacional.

Dados atuais do cliente em JSON: ${JSON.stringify(jsonData)}.
Responda sempre com base nestas fórmulas e sugira ações práticas de melhoria.`;

        try {
            console.log("LIA: Tentando conexão com Gemini API...");
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: `${systemPrompt}\n\nUsuário pergunta: ${userMessage}` }] }]
                })
            });

            if (!response.ok) {
                const errData = await response.json();
                console.error("LIA: Erro Gemini API Status:", response.status, errData);
                return null;
            }

            const data = await response.json();
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (text) console.log("LIA: Resposta recebida do Gemini com sucesso.");
            return text || null;
        } catch (error) {
            console.error("LIA: Erro de Rede ou Conexão com Gemini:", error);
            return null;
        }
    };

    const generatePDFReport = async (data, monthLabel) => {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        try {
            const logo = new Image(); logo.src = 'img/logo.png';
            await new Promise((r) => logo.onload = r);
            doc.setFillColor(15, 23, 42); doc.rect(0, 0, 210, 40, 'F');
            doc.addImage(logo, 'PNG', 20, 5, 60, 25);
        } catch (e) { doc.setFillColor(15, 23, 42); doc.rect(0, 0, 210, 40, 'F'); }
        doc.setTextColor(0, 0, 0); doc.setFontSize(18);
        doc.text(`Relatório DRE ${monthLabel}`, 20, 55);
        doc.setFontSize(12); let y = 75;
        const addR = (l, v, b = false) => {
            if (b) doc.setFont("helvetica", "bold");
            doc.text(l, 20, y); doc.text(formatBRL(v), 190, y, { align: "right" });
            y += 8; doc.setFont("helvetica", "normal");
        };
        addR("Receita Total", data.receita_total, true);
        addR("(=) Margem Contribuição", data.receita_total - data.custos - data.impostos, true);
        addR("LUCRO LÍQUIDO", data.lucro_liquido, true);
        doc.save(`Relatorio_LIA_${monthLabel.replace(' ', '_')}.pdf`);
    };

    window.downloadLIAForPeriod = (mVal, mLabel) => {
        const userId = localStorage.getItem('clarusSessionId');
        const raw = localStorage.getItem(`clarusData_${userId}_${mVal}`);
        if (raw) generatePDFReport(JSON.parse(raw), mLabel);
    };

    const generateResponse = async (query) => {
        const text = query.toLowerCase();
        const found = extractMonthsFromQuery(text);
        if (found.length > 0) { currentLIAMonthLabel = found[0].label; currentLIAMonthVal = found[0].value; }
        if (!currentLIAMonthVal) {
            const active = localStorage.getItem('clarusActiveMonth') || '2026-07';
            currentLIAMonthVal = active; currentLIAMonthLabel = active.includes('07') ? 'Julho 2026' : 'Período Atual';
        }
        const userId = localStorage.getItem('clarusSessionId');
        const raw = localStorage.getItem(`clarusData_${userId}_${currentLIAMonthVal}`);
        const data = raw ? JSON.parse(raw) : (window.clarusDataLevel1 || {});

        // 1. Try Gemini
        const geminiRes = await callGemini(query, data, currentLIAMonthLabel);
        if (geminiRes) {
            let res = geminiRes.replace(/\*\*/g, '<strong>').replace(/\*\*/g, '</strong>').replace(/\n/g, '<br>');
            if (text.match(/relatório|baixar|pdf|exportar|dre/)) {
                res += `<br><br><button onclick="window.downloadLIAForPeriod('${currentLIAMonthVal}', '${currentLIAMonthLabel}')" class="btn-primary" style="padding:10px; font-size:0.8rem; width:100%; cursor:pointer; background:var(--accent-gold); color:#000; border:none; border-radius:8px; font-weight:700;"><i class="fa-solid fa-file-pdf"></i> Download PDF de ${currentLIAMonthLabel}</button>`;
            }
            return res;
        }

        // 2. Fallback Local Logic 
        let res = `Para <strong>${currentLIAMonthLabel}</strong>, analisei seus dados: <br><br>`;
        const margemPct = ((data.lucro_liquido / (data.receita_total || 1)) * 100).toFixed(1);

        if (text.includes('%') || text.includes('porcentagem') || text.includes('margem')) {
            res += `O seu lucro de <strong>${formatBRL(data.lucro_liquido)}</strong> representa uma margem líquida de <strong>${margemPct}%</strong> sobre o faturamento total.`;
        } else if (text.includes('despesa') || text.includes('gasto') || text.includes('custo')) {
            const totalD = (data.despesas_operacionais || 0) + (data.custos || 0) + (data.impostos || 0);
            res += `Suas despesas totais somaram <strong>${formatBRL(totalD)}</strong>. <br>Sendo: <br>• Custos: ${formatBRL(data.custos)} <br>• Despesas: ${formatBRL(data.despesas_operacionais)}`;
        } else {
            res += `Seu faturamento foi de <strong>${formatBRL(data.receita_total)}</strong> e o lucro de <strong>${formatBRL(data.lucro_liquido)}</strong>. (Atenção: Houve um problema na conexão com o Gemini, operando em modo local).`;
        }

        res += `<br><br><button onclick="window.downloadLIAForPeriod('${currentLIAMonthVal}', '${currentLIAMonthLabel}')" class="btn-primary" style="padding:10px; font-size:0.8rem; width:100%; cursor:pointer; background:var(--accent-gold); color:#000; border:none; border-radius:8px; font-weight:700;"><i class="fa-solid fa-file-pdf"></i> Download PDF de ${currentLIAMonthLabel}</button>`;
        return res;
    };

    const addMessage = (text, sender) => {
        const msgDiv = document.createElement('div');
        msgDiv.className = `chat-message ${sender}`;
        msgDiv.innerHTML = text;
        messagesBox.appendChild(msgDiv);
        messagesBox.scrollTop = messagesBox.scrollHeight;
    };

    const processUserInput = async (text) => {
        if (!text.trim()) return;
        addMessage(text, 'user');
        inputField.value = ''; inputField.disabled = true; sendBtn.disabled = true;

        const th = document.createElement('div');
        th.className = 'chat-message bot chat-message-thinking';
        th.id = 'ai-thinking'; th.innerHTML = `<div class="dot"></div><div class="dot"></div><div class="dot"></div>`;
        messagesBox.appendChild(th);
        messagesBox.scrollTop = messagesBox.scrollHeight;

        const response = await generateResponse(text);
        const thEl = document.getElementById('ai-thinking');
        if (thEl) thEl.remove();
        addMessage(response, 'bot');
        inputField.disabled = false; sendBtn.disabled = false; inputField.focus();
    };

    sendBtn.addEventListener('click', () => processUserInput(inputField.value));
    inputField.addEventListener('keypress', (e) => { if (e.key === 'Enter') processUserInput(inputField.value); });
});
