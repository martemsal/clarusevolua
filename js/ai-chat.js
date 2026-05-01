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

    const generatePDFReport = async (data, monthLabel, analysisText = "") => {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        const primaryColor = [15, 23, 42]; // Slate 900
        const accentColor = [251, 191, 36]; // Gold

        const companyName = document.getElementById('display-company-name')?.textContent || 'Cliente';

        // 1. Header with Logo & Client Name
        try {
            const logo = new Image();
            const globalSettings = JSON.parse(localStorage.getItem('clarusGlobalSettings') || '{}');
            logo.src = globalSettings.logoPath || 'img/logo.png';
            await new Promise((r) => logo.onload = r);
            doc.setFillColor(...primaryColor);
            doc.rect(0, 0, 210, 40, 'F');
            doc.addImage(logo, 'PNG', 15, 7, 50, 25);
        } catch (e) {
            doc.setFillColor(...primaryColor);
            doc.rect(0, 0, 210, 40, 'F');
        }

        doc.setTextColor(255, 255, 255);
        doc.setFontSize(10);
        doc.text(companyName, 195, 18, { align: "right" });
        doc.text("LIA - Inteligência Estratégica", 195, 24, { align: "right" });
        doc.text(monthLabel, 195, 30, { align: "right" });

        // 2. Report Title
        doc.setTextColor(...primaryColor);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(22);
        doc.text("Diagnóstico de Performance", 15, 55);
        
        doc.setDrawColor(...accentColor);
        doc.setLineWidth(1);
        doc.line(15, 60, 100, 60);

        // 3. AI Analysis Section (The "Chat" content)
        let y = 70;
        if (analysisText) {
            doc.setFontSize(12);
            doc.setTextColor(...primaryColor);
            doc.text("Parecer da Consultoria", 15, y);
            y += 7;
            doc.setFont("helvetica", "normal");
            doc.setFontSize(9);
            doc.setTextColor(51, 65, 85);
            
            // Clean markdown and split text
            const cleanAnalysis = analysisText.replace(/<br>/g, '\n').replace(/<strong>/g, '').replace(/<\/strong>/g, '');
            const lines = doc.splitTextToSize(cleanAnalysis, 180);
            doc.text(lines, 15, y);
            y += (lines.length * 4) + 15;
        }

        if (y > 200) { doc.addPage(); y = 20; }

        // 4. Key Metrics Section
        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.setTextColor(...primaryColor);
        doc.text("Principais Indicadores", 15, y);
        y += 8;

        const ebitda = data.ebitda || (data.lucro_liquido + (data.impostos || 0) * 0.2); // Fallback calculation
        const margem = data.margem_lucro || ((data.lucro_liquido / data.receita_total) * 100).toFixed(1);

        const metrics = [
            { label: "Faturamento", value: formatBRL(data.receita_total || 0) },
            { label: "Lucro Líquido", value: formatBRL(data.lucro_liquido || 0) },
            { label: "Margem Líquida", value: `${margem}%` },
            { label: "EBITDA Estimado", value: formatBRL(ebitda || 0) }
        ];

        metrics.forEach((m, i) => {
            const posX = 15 + (i % 2) * 92;
            doc.setFillColor(248, 250, 252);
            doc.rect(posX, y, 88, 18, 'F');
            doc.setFontSize(8);
            doc.setTextColor(100, 116, 139);
            doc.text(m.label, posX + 5, y + 6);
            doc.setFontSize(10);
            doc.setTextColor(...primaryColor);
            doc.text(m.value, posX + 5, y + 13);
            if (i === 1) y += 22;
        });

        // 5. DRE Table
        y += 15;
        if (y > 220) { doc.addPage(); y = 20; }
        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.text("Resumo Gerencial (DRE)", 15, y);
        y += 8;

        doc.setFillColor(...primaryColor);
        doc.rect(15, y, 180, 8, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(9);
        doc.text("Categoria", 20, y + 5.5);
        doc.text("Valor", 190, y + 5.5, { align: "right" });
        y += 8;

        const rows = [
            { l: "Receita Bruta", v: data.receita_total || 0 },
            { l: "(-) Impostos", v: data.impostos || 0 },
            { l: "Receita Líquida", v: (data.receita_total || 0) - (data.impostos || 0), b: true },
            { l: "(-) Custos", v: data.custos || 0 },
            { l: "Margem de Contribuição", v: (data.receita_total || 0) - (data.impostos || 0) - (data.custos || 0), b: true },
            { l: "(-) Despesas Operacionais", v: data.despesas_operacionais || 0 },
            { l: "LUCRO LÍQUIDO", v: data.lucro_liquido || 0, b: true, highlight: true }
        ];

        rows.forEach((r, i) => {
            if (r.highlight) doc.setFillColor(254, 243, 199);
            else if (i % 2 === 0) doc.setFillColor(241, 245, 249);
            else doc.setFillColor(255, 255, 255);
            
            doc.rect(15, y, 180, 7, 'F');
            doc.setTextColor(0, 0, 0);
            if (r.b) doc.setFont("helvetica", "bold");
            else doc.setFont("helvetica", "normal");
            
            doc.text(r.l, 20, y + 4.5);
            doc.text(formatBRL(r.v), 190, y + 4.5, { align: "right" });
            y += 7;
        });

        // 6. Bank Accounts
        if (data.contas_bancarias && data.contas_bancarias.length > 0) {
            y += 10;
            if (y > 240) { doc.addPage(); y = 20; }
            doc.setFont("helvetica", "bold");
            doc.setFontSize(12);
            doc.text("Saldos Bancários", 15, y);
            y += 8;

            data.contas_bancarias.forEach(c => {
                doc.setFillColor(248, 250, 252);
                doc.rect(15, y, 180, 10, 'F');
                doc.setFontSize(9);
                doc.setTextColor(...primaryColor);
                doc.text(c.banco || "Banco", 20, y + 6);
                doc.text(formatBRL(c.saldo_atual || 0), 190, y + 6, { align: "right" });
                y += 11;
            });
        }

        // Footer
        doc.setFontSize(7);
        doc.setTextColor(148, 163, 184);
        doc.text(`Este documento é uma análise gerencial gerada por Inteligência Artificial e não substitui a contabilidade oficial.`, 105, 285, { align: "center" });

        doc.save(`Relatorio_LIA_${monthLabel.replace(' ', '_')}.pdf`);
    };

    window.downloadLIAForPeriod = (val, label, analysisText = "") => {
        const userId = localStorage.getItem('clarusSessionId');
        const raw = localStorage.getItem(`clarusData_${userId}_${val}`);
        if (raw) generatePDFReport(JSON.parse(raw), label, analysisText);
        else alert("Dados não encontrados para este período.");
    };

    const addMessage = (text, sender) => {
        const msgDiv = document.createElement('div');
        msgDiv.className = `chat-message ${sender}`;
        
        // Remove action placeholders if they exist
        let cleanText = text.replace(/\[ACTION:.*?\]/g, '');
        cleanText = cleanText.replace(/Preparando Relatório PDF\.\.\./g, '');
        
        msgDiv.innerHTML = cleanText;
        
        // Add Download PDF button to all BOT messages
        if (sender === 'bot') {
            const btn = document.createElement('button');
            btn.className = 'btn-primary';
            btn.style.cssText = 'padding:10px 14px; font-size:0.8rem; width:100%; margin-top:15px; cursor:pointer; background:var(--accent-gold); color:#000; border:none; border-radius:8px; font-weight:700; box-shadow: 0 4px 15px rgba(0,0,0,0.2); transition: all 0.3s ease;';
            btn.innerHTML = `<i class="fa-solid fa-file-pdf"></i> BAIXAR RELATÓRIO PDF COMPLETO`;
            btn.onmouseover = () => btn.style.transform = 'translateY(-2px)';
            btn.onmouseout = () => btn.style.transform = 'translateY(0)';
            
            // PASS THE CURRENT TEXT TO THE DOWNLOAD FUNCTION
            btn.onclick = () => window.downloadLIAForPeriod(currentLIAMonthVal, currentLIAMonthLabel, cleanText);
            
            msgDiv.appendChild(btn);
        }

        messagesBox.appendChild(msgDiv);
        messagesBox.scrollTop = messagesBox.scrollHeight;
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
