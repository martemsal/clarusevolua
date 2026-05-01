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

    const callGemini = async (userMessage, jsonData, month, instructions = "") => {
        const apiKey = localStorage.getItem('clarusGeminiKey');
        if (!apiKey) return null;

        const companyName = document.getElementById('display-company-name')?.textContent || 'Cliente';
        const systemPrompt = `Você é a LIA da CLARUS EVOLUA. Consultora Financeira de Elite. 
        Analise os dados de ${month} do cliente ${companyName} com base nestas diretrizes:
        1. Margem Líquida (>10%), EBITDA, Fluxo de Caixa, Ciclo Financeiro, NCG, Endividamento, Ticket Médio, CAC/LTV e Produtividade.
        Dados: ${JSON.stringify(jsonData)}.
        Instruções Adicionais: ${instructions}
        Responda de forma estratégica e sugira ações práticas.`;

        // Tenta vários modelos possíveis para garantir compatibilidade
        const models = ['gemini-flash-latest', 'gemini-1.5-flash', 'gemini-pro'];
        let lastError = null;

        for (const modelName of models) {
            try {
                for (const ver of ['v1beta', 'v1']) {
                    const response = await fetch(`https://generativelanguage.googleapis.com/${ver}/models/${modelName}:generateContent`, {
                        method: 'POST',
                        headers: { 
                            'Content-Type': 'application/json',
                            'X-goog-api-key': apiKey 
                        },
                        body: JSON.stringify({
                            contents: [{ parts: [{ text: `${systemPrompt}\n\nUsuário pergunta: ${userMessage}` }] }]
                        })
                    });

                    if (response.ok) {
                        const data = await response.json();
                        return data.candidates?.[0]?.content?.parts?.[0]?.text || "Não consegui processar agora.";
                    } else {
                        const errData = await response.json().catch(() => ({}));
                        lastError = `Google API (${ver}/${modelName}): ${errData.error?.message || response.statusText}`;
                        console.warn(`LIA: Tentativa com ${ver}/${modelName} falhou...`);
                    }
                }
            } catch (e) {
                lastError = e.message;
            }
        }
        throw new Error(lastError || "Todos os modelos falharam.");
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
            currentLIAMonthVal = localStorage.getItem('clarusActiveMonth') || new Date().toISOString().substring(0, 7);
            const [y, m] = currentLIAMonthVal.split('-');
            const months = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
            currentLIAMonthLabel = `${months[parseInt(m)-1]} ${y}`;
        }

        const userId = localStorage.getItem('clarusSessionId');
        
        // --- DEEP CONTEXT GATHERING ---
        // 1. DRE Data
        const dreRaw = localStorage.getItem(`clarusData_${userId}_${currentLIAMonthVal}`);
        const dreData = dreRaw ? JSON.parse(dreRaw) : {};
        
        // 2. Fluxo/Bank Data
        const fluxRaw = localStorage.getItem(`clarusDataVenc_${userId}_${currentLIAMonthVal}`);
        const fluxData = fluxRaw ? JSON.parse(fluxRaw) : {};

        // 3. User Info (Banks, Loans)
        const companies = JSON.parse(localStorage.getItem('clarusCompanies') || '[]');
        const userProfile = companies.find(c => c.id === userId) || {};

        const fullContext = {
            periodo: currentLIAMonthLabel,
            faturamento: dreData.receita_total || 0,
            lucro_liquido: dreData.lucro_liquido || 0,
            impostos: dreData.impostos || 0,
            custos: dreData.custos || 0,
            despesas_op: dreData.despesas_operacionais || 0,
            contas_bancarias: userProfile.banks || [],
            movimentacao_bancos: fluxData.bancos || {},
            emprestimos: userProfile.loans || [],
            estoque: dreData.estoque_unidades || {}
        };

        // Update system instructions for actions
        const actionPrompt = `
IMPORTANTE: Você pode realizar ações no sistema usando blocos especiais de comando no final da sua resposta:
[ACTION:OPEN_VIEW|target-name] - Trocar para uma tela (saude-financeira, fluxo-caixa, bancos, emprestimos, comercial, estoque, crescimento, indicadores, balanco-gerencial)
[ACTION:DOWNLOAD_PDF] - Gerar relatório PDF do mês atual
[ACTION:REFRESH_DATA] - Sincronizar dados com o Supabase/Nuvem
Exemplo: "Vou te levar para o módulo de Bancos. [ACTION:OPEN_VIEW|bancos]"`;

        // 1. Try Gemini with Detailed Error Catching
        let geminiError = null;
        const geminiRes = await callGemini(query, fullContext, currentLIAMonthLabel + "\n\n" + actionPrompt).catch(e => {
            geminiError = e.message;
            return null;
        });
        
        if (geminiRes && typeof geminiRes === 'string') {
            let res = geminiRes.replace(/\*\*/g, '<strong>').replace(/\*\*/g, '</strong>').replace(/\n/g, '<br>');
            
            // --- ACTION PARSER ---
            if (res.includes('[ACTION:OPEN_VIEW|')) {
                const match = res.match(/\[ACTION:OPEN_VIEW\|([^\]]+)\]/);
                if (match && match[1]) {
                    const viewId = match[1].trim();
                    const navLink = document.querySelector(`.nav-item[data-target="${viewId}"]`);
                    if (navLink) {
                        setTimeout(() => navLink.click(), 1000);
                        res = res.replace(match[0], '<span style="color:var(--accent-gold); font-size:0.75rem; display:block; margin-top:5px;"><i class="fa-solid fa-person-walking-arrow-right"></i> Navegando para ' + viewId + '...</span>');
                    } else {
                        res = res.replace(match[0], '');
                    }
                }
            }

            if (res.includes('[ACTION:DOWNLOAD_PDF]')) {
                const match = res.match(/\[ACTION:DOWNLOAD_PDF\]/);
                setTimeout(() => window.downloadLIAForPeriod(currentLIAMonthVal, currentLIAMonthLabel), 1500);
                res = res.replace(match[0], '<span style="color:var(--accent-gold); font-size:0.75rem; display:block; margin-top:5px;"><i class="fa-solid fa-spinner fa-spin"></i> Preparando Relatório PDF...</span>');
            }

            if (res.includes('[ACTION:REFRESH_DATA]')) {
                const match = res.match(/\[ACTION:REFRESH_DATA\]/);
                if (window.syncCloudToLocal) setTimeout(() => window.syncCloudToLocal(), 500);
                res = res.replace(match[0], '<span style="color:var(--accent-gold); font-size:0.75rem; display:block; margin-top:5px;"><i class="fa-solid fa-cloud-arrow-down"></i> Sincronizando com a Nuvem...</span>');
            }

            return res;
        }

        // 2. Fallback Local Logic with Error Context
        let res = `Para <strong>${currentLIAMonthLabel}</strong>, analisei seus dados localmente: <br><br>`;
        res += `Seu faturamento foi de <strong>${formatBRL(fullContext.faturamento)}</strong> e o lucro de <strong>${formatBRL(fullContext.lucro_liquido)}</strong>.`;
        
        const apiKey = localStorage.getItem('clarusGeminiKey');
        if (!apiKey) {
            res += `<br><br><div style="background:rgba(239,68,68,0.1); border:1px solid #ef4444; padding:10px; border-radius:8px; font-size:0.75rem; color:#fca5a5;">
                <i class="fa-solid fa-key"></i> <strong>Chave Gemini não detectada.</strong><br>
                Vá em Painel Admin > Configurações Globais e salve sua API Key para ativar a inteligência avançada.
            </div>`;
        } else if (geminiError || !geminiRes) {
            res += `<br><br><div style="background:rgba(239,68,68,0.1); border:1px solid #ef4444; padding:10px; border-radius:8px; font-size:0.75rem; color:#fca5a5;">
                <i class="fa-solid fa-circle-exclamation"></i> <strong>Erro de Conexão:</strong><br>
                ${geminiError || 'Não foi possível obter resposta da Google AI Studio. Verifique se sua chave é válida ou se o modelo Gemini 1.5 Flash está disponível na sua região.'}
            </div>`;
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
