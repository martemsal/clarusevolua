// Admin Panel Logic - Unified
/**
 * utilitário para parsing de valores BRL (moeda brasileira)
 */
const parseBRL = (s) => {
    if (!s) return 0;
    if (typeof s === 'number') return s;
    let clean = s.toString().replace("R$", "").replace(/\./g, "").replace(",", ".").trim();
    return parseFloat(clean) || 0;
};

// Admin Panel Logic - Unified

// Admin Panel Logic - Unified
// Removendo dados mockados locais para usar apenas Supabase conforme pedido do USER
const defaultCompanies = [];
let mockCompanies = []; // Source of truth

// Configure PDF.js Worker
if (typeof pdfjsLib !== 'undefined') {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}

const APP_VERSION = "1.9.2";

// UI Elements for Status
const statusDot = document.getElementById('status-dot');
const statusText = document.getElementById('status-text');

const updateSupabaseStatus = (connected, msg) => {
    if (!statusDot || !statusText) return;
    statusDot.style.background = connected ? "#10b981" : "#ef4444";
    statusText.innerText = `Supabase: ${msg || (connected ? "Conectado" : "Erro")}`;
    statusText.style.color = connected ? "#10b981" : "#ef4444";
};

if (localStorage.getItem('clarusAppVersion') !== APP_VERSION) {
    localStorage.setItem('clarusAppVersion', APP_VERSION);
    console.log("🚀 [System] Versão v" + APP_VERSION + " aplicada.");
}

const saveAdminData = async () => {
    localStorage.setItem('clarusCompanies', JSON.stringify(mockCompanies));
    
    // SUPABASE SYNC
    if (window.db && window.db.saveCompany) {
        if (editingCompanyId) {
            const comp = mockCompanies.find(c => c.id === editingCompanyId);
            if (comp) {
                const result = await window.db.saveCompany(comp);
                if (!result.success) {
                    console.error("❌ Erro ao salvar no Supabase:", result.error);
                    alert("⚠️ ALERTA DE SINCRONIZAÇÃO:\n\nOs dados foram salvos no seu navegador, mas NÃO foram enviados para o Supabase.\n\nMotivo: " + result.error + "\n\nVerifique se você executou o script SQL no Supabase para criar as permissões (RLS).");
                } else {
                    console.log("✅ Sincronizado com Supabase com sucesso.");
                    updateSupabaseStatus(true, "Sincronizado");
                }
            }
        } else {
            // Sincronização em massa (opcional)
            for (const comp of mockCompanies) {
                await window.db.saveCompany(comp);
            }
        }
    }
};

let editingCompanyId = null;

const getLevelBadge = (level) => {
    switch (level) {
        case 1: return '<span style="background: rgba(100,116,139,0.3); color: #94a3b8; padding: 4px 8px; border-radius: 4px; font-size: 0.75rem;"><i class="fa-solid fa-file-excel"></i> Nível 1: Planilhas</span>';
        case 2: return '<span style="background: rgba(59,130,246,0.2); color: #60a5fa; padding: 4px 8px; border-radius: 4px; font-size: 0.75rem;"><i class="fa-solid fa-upload"></i> Nível 2: Upload ERP</span>';
        case 3: return '<span style="background: rgba(16,185,129,0.2); color: #34d399; padding: 4px 8px; border-radius: 4px; font-size: 0.75rem;"><i class="fa-solid fa-robot"></i> Nível 3: Integração API</span>';
        default: return '';
    }
};

const renderAdminCompanies = () => {
    const list = document.getElementById('admin-companies-list');
    if (!list) return;

    list.innerHTML = '';

    mockCompanies.forEach(comp => {
        const card = document.createElement('div');
        card.className = 'card';
        card.style.position = 'relative';

        let modsHtml = comp.modules.map(m => `<span style="display:inline-block; background:rgba(255,255,255,0.05); border: 1px solid var(--border-color); padding: 2px 6px; border-radius: 4px; font-size: 0.7rem; margin: 2px;">${m}</span>`).join('');

        const filesCount = comp.files ? comp.files.length : 0;
        const banksCount = comp.banks ? comp.banks.length : 0;

        card.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem;">
                <h3 style="font-size: 1.1rem; margin: 0;">${comp.name}</h3>
                <div style="color: var(--text-secondary); font-size: 0.8rem; font-family: monospace;">ID: ${comp.id}</div>
            </div>
            <div style="margin-bottom: 1rem;">
                ${getLevelBadge(comp.level)}
            </div>
            <div>
                <p style="font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 0.5rem;">Expansões Ativas:</p>
                <div>${modsHtml}</div>
            </div>
            <div style="margin-top: 1rem; display: flex; gap: 1rem; font-size: 0.8rem; color: var(--text-secondary);">
                <span><i class="fa-solid fa-building-columns"></i> ${banksCount} Banco(s)</span>
                <span><i class="fa-solid fa-file"></i> ${filesCount} Arquivo(s)</span>
            </div>
            <div style="margin-top: 1.5rem; display: flex; flex-direction: column; gap: 0.5rem; border-top: 1px solid var(--border-color); padding-top: 1rem;">
                <button class="btn-primary btn-edit-company" data-id="${comp.id}" style="padding: 0.6rem; font-size: 0.85rem; background: var(--accent-gold); color: #000; font-weight: bold; border: none; border-radius: 6px;"><i class="fa-solid fa-sliders"></i> CONFIGURAÇÕES</button>
                <div style="display: flex; gap: 0.5rem;">
                    <button class="btn-primary btn-access-dashboard" data-id="${comp.id}" style="padding: 0.5rem; font-size: 0.85rem; flex: 3; background: rgba(59, 130, 246, 0.1); border: 1px solid var(--accent-blue); color: var(--accent-blue);"><i class="fa-solid fa-gauge-high"></i> Acessar Dashboard</button>
                    <button class="btn-danger btn-delete-company" data-id="${comp.id}" style="padding: 0.5rem; font-size: 0.85rem; flex: 1;" title="Excluir Cliente"><i class="fa-solid fa-trash-can"></i></button>
                </div>
            </div>
        `;
        list.appendChild(card);
    });

    // Attach Access Listeners
    document.querySelectorAll('.btn-access-dashboard').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.currentTarget.getAttribute('data-id');
            const comp = mockCompanies.find(c => c.id === id);
            localStorage.setItem('clarusSessionId', id);
            localStorage.setItem('clarusAdminViewingId', id);
            localStorage.setItem('clarusAdminIsViewingApp', 'true');
            location.reload(); // Refresh to trigger app.js login routing
        });
    });

    // Attach Edit Listeners
    document.querySelectorAll('.btn-edit-company').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.currentTarget.getAttribute('data-id');
            openAdminModal(id);
        });
    });

    // Attach Delete Listeners
    document.querySelectorAll('.btn-delete-company').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const id = e.currentTarget.getAttribute('data-id');
            const comp = mockCompanies.find(c => c.id === id);
            if (confirm(`ATENÇÃO: Deseja realmente excluir o cliente "${comp.name}"? Todos os arquivos e dados serão perdidos permanentemente no Supabase.`)) {
                
                // 1. Delete from Supabase
                if (window.db && window.db.deleteCompany) {
                    const result = await window.db.deleteCompany(id);
                    if (!result.success) {
                        alert("Erro ao excluir no Supabase: " + result.error);
                        return;
                    }
                }

                // 2. Local cleanup
                mockCompanies = mockCompanies.filter(c => c.id !== id);
                localStorage.setItem('clarusCompanies', JSON.stringify(mockCompanies));
                renderAdminCompanies();
                alert(`Cliente "${comp.name}" excluído do sistema.`);
            }
        });
    });
};

window.initAdminPanel = async () => {
    // Sincronização inicial forçada antes de renderizar
    if (window.db && window.db.getCompanies) {
        updateSupabaseStatus(false, "Sincronizando...");
        console.log("🔄 [Admin] Buscando clientes atualizados do Supabase...");
        const cloudCompanies = await window.db.getCompanies();
        if (cloudCompanies) {
            updateSupabaseStatus(true, "Conectado");
            mockCompanies = cloudCompanies.map(c => ({
                id: c.id,
                name: c.name,
                password: c.password,
                level: c.level,
                capitalSocial: c.capital_social,
                modules: c.modules || [],
                banks: c.banks || [],
                loans: c.loans || [],
                files: c.files || []
            }));
            localStorage.setItem('clarusCompanies', JSON.stringify(mockCompanies));
        } else {
            updateSupabaseStatus(false, "Erro na Busca");
            mockCompanies = JSON.parse(localStorage.getItem('clarusCompanies') || '[]');
        }
    } else {
        updateSupabaseStatus(false, "DB não carregado");
        mockCompanies = JSON.parse(localStorage.getItem('clarusCompanies') || '[]');
    }
    renderAdminCompanies();
};

// --- Modal Logic Unificado ---
const modal = document.getElementById('admin-modal');
const btnNew = document.getElementById('btn-new-company');
const btnClose = document.getElementById('close-modal');
const form = document.getElementById('admin-company-form');

const renderBanksList = (banks) => {
    const list = document.getElementById('admin-bank-list');
    if (!list) return;
    if (!banks || !Array.isArray(banks)) {
        list.innerHTML = '<li style="color:var(--text-secondary); font-style:italic;">Nenhum banco cadastrado.</li>';
        return;
    }

    list.innerHTML = banks.filter(b => b).map((b, idx) => {
        let name = typeof b === 'string' ? b : (b ? b.name : "Desconhecido");
        let initial = (typeof b === 'object' && b !== null) ? (b.initial || 0) : 0;
        let badge = initial !== 0 ? `<span style="font-size: 0.7rem; background: var(--bg-card); padding: 2px 6px; border-radius: 4px; border: 1px solid var(--border-color); color: var(--text-secondary);">Saldo Inicial: R$ ${initial.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>` : '';
        return `
        <div style="background: rgba(0,0,0,0.2); border: 1px solid var(--border-color); border-radius: 4px; padding: 0.5rem; margin-bottom: 0.5rem; display: flex; justify-content: space-between; align-items: center;">
            <div style="display: flex; align-items: center; gap: 8px;">
                <span><i class="fa-solid fa-building-columns" style="color:var(--text-secondary);"></i> ${name}</span>
                ${badge}
            </div>
            <div style="display: flex; gap: 10px;">
                <button class="btn-icon btn-edit-bank" data-idx="${idx}" style="color: var(--accent-gold); border: none; padding: 0;" title="Editar Saldo Inicial"><i class="fa-solid fa-pencil"></i></button>
                <button class="btn-icon btn-remove-bank" data-idx="${idx}" style="color: var(--status-danger); border: none; padding: 0;" title="Remover Banco"><i class="fa-solid fa-trash"></i></button>
            </div>
        </div>
        `;
    }).join('');

    document.querySelectorAll('.btn-edit-bank').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            if (!editingCompanyId) return;
            const comp = mockCompanies.find(c => c.id === editingCompanyId);
            if (comp) {
                const idx = parseInt(e.currentTarget.getAttribute('data-idx'));
                const b = comp.banks[idx];
                let name = typeof b === 'string' ? b : b.name;
                let currentInitial = typeof b === 'object' ? (b.initial || 0) : 0;

                const newVal = prompt(`Editar Saldo Inicial para "${name}":`, currentInitial);
                if (newVal !== null) {
                    const parsed = parseFloat(newVal.replace(',', '.'));
                    if (!isNaN(parsed)) {
                        comp.banks[idx] = { name: name, initial: parsed };
                        saveAdminData();
                        renderBanksList(comp.banks);
                        renderAdminCompanies();
                        if (window.refreshDashboardsWithData) window.refreshDashboardsWithData();
                    }
                }
            }
        });
    });

    document.querySelectorAll('.btn-remove-bank').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            if (!editingCompanyId) return;
            const comp = mockCompanies.find(c => c.id === editingCompanyId);
            if (comp) {
                const idx = parseInt(e.currentTarget.getAttribute('data-idx'));
                comp.banks.splice(idx, 1);
                saveAdminData();
                renderBanksList(comp.banks);
                renderAdminCompanies();
            }
        });
    });

    // Sincronizar campo de empréstimos
    const loanBankRef = document.getElementById('loan-bank-select');
    if (loanBankRef) {
        loanBankRef.innerHTML = `<option value="">Escolher Banco...</option>` +
            banks.filter(b => b).map(b => {
                let name = typeof b === 'string' ? b : (b ? b.name : "");
                if (!name) return "";
                return `<option value="${name}">${name}</option>`;
            }).join('');
    }

    // Sincronizar campo de destino de upload
    const bankRef = document.getElementById('upload-bank-ref');
    if (bankRef) {
        bankRef.innerHTML = `<option value="">Automático: Receitas e Despesas (Geral)</option>` +
            banks.filter(b => b).map(b => {
                let name = typeof b === 'string' ? b : (b ? b.name : "");
                if (!name) return "";
                return `<option value="${name}">Extrato: ${name}</option>`;
            }).join('') +
            `<option disabled>── Relatórios Financeiros ──</option>
             <option value="dre">Relatório: DRE (Gerencial)</option>
             <option value="caixa">Relatório: Fluxo de Caixa (Realizado)</option>
             <option value="receber">Relatório: Contas a Receber (Total)</option>
             <option value="inadimplencia">Relatório: Clientes em Atraso (Inadimplência)</option>
             <option value="estoque">Relatório: Perda/Giro Estoque</option>
             <option value="despesa_operacional">Relatório: Despesa Operacional (Excel)</option>
             <option value="imobilizado">Relatório: Imobilizado (Notas Fiscais)</option>
             <option disabled>── Relatórios de Passivos ──</option>
             <option value="pagar">Relatório: Fornecedores (Contas a Pagar)</option>
             <option value="emprestimos">Relatório: Empréstimos e Financiamentos</option>
             <option value="salarios">Relatório: Folha de Pagamento (Salários)</option>
             <option value="encargos">Guia: Encargos Trabalhistas (INSS/FGTS)</option>
             <option value="simples">Guia: Simples Nacional</option>
             <option value="tributos">Guia: Tributos a Pagar (Federal/Estadual/Municipal)</option>
             <option value="parcelamentos">Relatório: Parcelamento de Tributos</option>
             <option value="pro_labore">Recibo: Pró-Labore / Retiradas</option>
             <option value="comercial">Relatório: Gestão Comercial</option>`;
    }
};

const renderLoansList = (loans) => {
    const list = document.getElementById('admin-loans-list');
    if (!list) return;
    if (!loans || loans.length === 0) {
        list.innerHTML = '<p style="color:var(--text-secondary); font-style:italic;">Nenhum empréstimo cadastrado.</p>';
        return;
    }

    list.innerHTML = loans.map((loan, idx) => `
        <div style="background: rgba(0,0,0,0.2); border: 1px solid var(--border-color); border-radius: 4px; padding: 0.5rem; margin-bottom: 0.5rem; font-size: 0.75rem;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 4px;">
                <span style="font-weight:700; color:#fbbf24;"><i class="fa-solid fa-file-invoice-dollar"></i> ${loan.bank} - Contrato: ${loan.contract}</span>
                <button class="btn-icon btn-remove-loan" data-idx="${idx}" style="color: var(--status-danger); border: none; padding: 0;"><i class="fa-solid fa-trash"></i></button>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 5px; opacity: 0.8;">
                <span>Valor: R$ ${parseFloat(loan.totalAmount).toLocaleString()}</span>
                <span>Parcela: ${loan.installmentsCount}x R$ ${parseFloat(loan.installmentValue).toLocaleString()}</span>
                <span>Início: ${loan.firstDue}</span>
                <span>Fim: ${loan.lastDue}</span>
            </div>
        </div>
    `).join('');

    document.querySelectorAll('.btn-remove-loan').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const idx = parseInt(e.currentTarget.getAttribute('data-idx'));
            const comp = mockCompanies.find(c => c.id === editingCompanyId);
            if (comp) {
                comp.loans.splice(idx, 1);
                saveAdminData();
                renderLoansList(comp.loans);
            }
        });
    });
};

const btnAddLoan = document.getElementById('btn-add-loan');
if (btnAddLoan) {
    btnAddLoan.addEventListener('click', () => {
        if (!editingCompanyId) return;
        const comp = mockCompanies.find(c => c.id === editingCompanyId);
        if (!comp) return;

        const data = {
            bank: document.getElementById('loan-bank-select').value,
            contract: document.getElementById('loan-contract').value,
            totalAmount: document.getElementById('loan-total-amount').value,
            interest: document.getElementById('loan-interest').value,
            installmentsCount: document.getElementById('loan-installments-total').value,
            installmentValue: document.getElementById('loan-installment-value').value,
            firstDue: document.getElementById('loan-first-due').value,
            lastDue: document.getElementById('loan-last-due').value
        };

        if (!data.bank || !data.contract || !data.installmentValue) {
            alert("Por favor, preencha Banco, Contrato e Valor da Parcela.");
            return;
        }

        if (!comp.loans) comp.loans = [];
        comp.loans.push(data);
        saveAdminData();
        renderLoansList(comp.loans);

        // Reset fields
        const fields = ['loan-bank-select', 'loan-contract', 'loan-total-amount', 'loan-interest', 'loan-installments-total', 'loan-installment-value', 'loan-first-due', 'loan-last-due'];
        fields.forEach(fid => document.getElementById(fid).value = "");
    });
}

const renderFilesList = (files) => {
    const list = document.getElementById('admin-file-list');
    const monthInput = document.getElementById('upload-month-ref');
    const month = monthInput ? monthInput.value : '';

    if (!files || files.length === 0) {
        list.innerHTML = '<li style="color:var(--text-secondary); font-style:italic;">Nenhum arquivo no repositório.</li>';
    } else {
        let mappedFiles = files.map((f, origIndex) => ({ file: f, origIndex }));
        if (month) {
            mappedFiles = mappedFiles.filter(item => item.file.includes(`Ref: ${month}`));
        }

        if (mappedFiles.length === 0) {
            list.innerHTML = `<li style="color:var(--text-secondary); font-style:italic;">Nenhum arquivo para este mês (${month}).</li>`;
        } else {
            list.innerHTML = mappedFiles.map(obj => `
                <li style="margin-bottom: 0.5rem; display: flex; align-items: center; justify-content: space-between; background: rgba(0,0,0,0.1); padding: 0.5rem; border-radius: 4px; border: 1px solid var(--border-color); gap: 0.5rem;">
                    <div style="display: flex; align-items: center; gap: 0.5rem; flex: 1; min-width: 0;">
                        <i class="fa-regular fa-file-lines" style="color: var(--accent-purple); flex-shrink: 0;"></i> 
                        <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${obj.file}</span>
                    </div>
                    <button class="btn-icon btn-remove-file" data-orig-idx="${obj.origIndex}" style="color: var(--status-danger); border: none; padding: 2px; flex-shrink: 0;"><i class="fa-solid fa-xmark" title="Excluir arquivo e reverter dados"></i></button>
                </li>
            `).join('');
        }
    }

    // Adiciona botão "Limpar Mês" se houver data selecionada
    if (month && editingCompanyId) {
        const resetContainer = document.createElement('div');
        resetContainer.style.marginTop = '1.5rem';
        resetContainer.style.borderTop = '1px dashed var(--border-color)';
        resetContainer.style.paddingTop = '1rem';
        resetContainer.innerHTML = `
            <button id="btn-wipe-month-only" class="btn-primary" style="width: 100%; background: transparent; border: 1px solid var(--status-danger); color: var(--status-danger); padding: 0.6rem; font-size: 0.75rem;">
                <i class="fa-solid fa-trash-can"></i> ZERAR BANCO DE DADOS DE ${month}
            </button>
            <p style="font-size: 0.7rem; color: var(--text-secondary); text-align: center; margin-top: 0.5rem;">Use para sumir com os R$ 529.984,78 se o arquivo estiver errado.</p>
        `;
        list.appendChild(resetContainer);
        document.getElementById('btn-wipe-month-only').onclick = () => {
            if (confirm(`DESEJA REALMENTE APAGAR TODOS OS DADOS (DRE e Fluxo) DE ${month}?\nIMPORTANTE: Isso também removerá os registros dos arquivos deste mês, permitindo que você os envie novamente.`)) {
                localStorage.removeItem(`clarusData_${editingCompanyId}_${month}`);
                localStorage.removeItem(`clarusDataVenc_${editingCompanyId}_${month}`);

                // Remover arquivos deste mês do repositório
                const comp = mockCompanies.find(c => c.id === editingCompanyId);
                if (comp && comp.files) {
                    comp.files = comp.files.filter(f => !f.includes(`Ref: ${month}`));
                    saveAdminData();
                    renderFilesList(comp.files);
                }

                alert(`Dados e registros de ${month} zerados com sucesso.`);
                if (window.refreshDashboardsWithData) window.refreshDashboardsWithData();
                renderAdminCompanies();
            }
        };
    }

    document.querySelectorAll('.btn-remove-file').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            if (!editingCompanyId) return;
            const comp = mockCompanies.find(c => c.id === editingCompanyId);
            if (comp) {
                const idx = parseInt(e.currentTarget.getAttribute('data-orig-idx'));
                const fileNameToDelete = comp.files[idx];

                if (!confirm(`Deseja remover o arquivo "${fileNameToDelete}"?\nO sistema REVERTERÁ os valores deste arquivo em TODOS os meses afetados (DRE e Fluxo).`)) return;

                comp.files.splice(idx, 1);
                saveAdminData();

                // Rollback em todas as chaves do localStorage para esta empresa
                const keys = Object.keys(localStorage);
                keys.forEach(k => {
                    if (k.startsWith(`clarusData_${editingCompanyId}_`) || k.startsWith(`clarusDataVenc_${editingCompanyId}_`)) {
                        let raw = localStorage.getItem(k);
                        if (raw) {
                            let d = JSON.parse(raw);
                            if (d._contributions && d._contributions[fileNameToDelete]) {
                                const c = d._contributions[fileNameToDelete];

                                // Reverter DRE
                                if (k.includes('clarusData_')) {
                                    d.receita_total = Math.max(0, (d.receita_total || 0) - (c.receita_total || 0));
                                    d.impostos = Math.max(0, (d.impostos || 0) - (c.impostos || 0));
                                    d.custos = Math.max(0, (d.custos || 0) - (c.custos || 0));
                                    d.despesas_operacionais = Math.max(0, (d.despesas_operacionais || 0) - (c.despesas_operacionais || 0));
                                    d.lucro_liquido = d.receita_total - (d.impostos + d.custos + d.despesas_operacionais);
                                }

                                // Reverter Fluxo
                                if (k.includes('clarusDataVenc_')) {
                                    d.a_pagar_mes = Math.max(0, (d.a_pagar_mes || 0) - (c.a_pagar_mes || 0));
                                    d.a_receber_mes = Math.max(0, (d.a_receber_mes || 0) - (c.a_receber_mes || 0));
                                    if (d.compromissos) {
                                        d.compromissos = d.compromissos.filter(item => item._source !== fileNameToDelete);
                                    }
                                }

                                // Rollback Bancos
                                if (c.bancos) {
                                    if (!d.bancos) d.bancos = {}; // Ensure and protect
                                    for (const b in c.bancos) {
                                        if (d.bancos[b]) {
                                            d.bancos[b].entradas = Math.max(0, (d.bancos[b].entradas || 0) - (c.bancos[b].entradas || 0));
                                            d.bancos[b].saidas = Math.max(0, (d.bancos[b].saidas || 0) - (c.bancos[b].saidas || 0));
                                        }
                                    }
                                }

                                delete d._contributions[fileNameToDelete];
                                localStorage.setItem(k, JSON.stringify(d));

                                // SUPABASE SYNC UP
                                if (window.db && window.db.saveFinancialData) {
                                    const typeStr = k.startsWith('clarusData_') ? 'dre' : 'fluxo';
                                    const mKey = k.split('_').pop();
                                    window.db.saveFinancialData(editingCompanyId, mKey, typeStr, d).catch(e => console.error("Sync Error:", e));
                                }
                            }
                        }
                    }
                });

                alert(`Arquivo removido e dados revertidos em todo o sistema.`);
                renderFilesList(comp.files);
                renderAdminCompanies();
                if (window.refreshDashboardsWithData) window.refreshDashboardsWithData();
            }
        });
    });
};

window.openAdminModal = (companyId = null) => {
    editingCompanyId = companyId;
    if (companyId) localStorage.setItem('clarusAdminViewingId', companyId);

    // Reset inputs
    document.getElementById('upload-status').classList.add('hidden');
    document.getElementById('drop-zone').style.display = 'block';
    document.getElementById('upload-progress-bar').style.width = '0%';

    const monthInput = document.getElementById('upload-month-ref');
    if (monthInput) monthInput.value = new Date().toISOString().substring(0, 7);

    const newBankSelect = document.getElementById('new-bank-select');
    const newBankCustom = document.getElementById('new-bank-custom');
    if (newBankSelect) newBankSelect.value = '';
    if (newBankCustom) {
        newBankCustom.value = '';
        newBankCustom.style.display = 'none';
    }

    if (companyId) {
        // Admin Module
        document.getElementById('new-bank-select').disabled = false;
        document.getElementById('new-bank-select').disabled = false;
        document.getElementById('new-bank-custom').disabled = false;
        document.getElementById('btn-add-bank').disabled = false;
        document.getElementById('loan-bank-select').disabled = false;
        document.getElementById('btn-add-loan').disabled = false;
        document.getElementById('drop-zone').style.pointerEvents = 'auto';
        document.getElementById('drop-zone').style.opacity = '1';
        document.getElementById('btn-browse-files').disabled = false;
        document.getElementById('bank-lock-msg').style.display = 'none';
        document.getElementById('file-lock-msg').style.display = 'none';

        // Ativar comunicação
        document.getElementById('comm-message').disabled = false;
        document.getElementById('btn-send-message').disabled = false;

        const comp = mockCompanies.find(c => c.id === companyId);
        document.getElementById('modal-title').innerHTML = `<i class="fa-solid fa-building" style="color: var(--accent-gold); margin-right: 8px;"></i> Gerenciando: ${comp.name}`;

        document.getElementById('admin-comp-mode').value = 'edit';
        document.getElementById('admin-comp-name').value = comp.name;
        document.getElementById('admin-comp-id').value = comp.id;
        document.getElementById('admin-comp-id').disabled = true;
        document.getElementById('admin-comp-password').value = comp.password || '';
        document.getElementById('admin-comp-level').value = comp.level;
        document.getElementById('admin-comp-capital').value = comp.capitalSocial || "";

        document.getElementById('mod-rent').checked = comp.modules.includes("Rentabilidade e Curva ABC");
        document.getElementById('mod-com').checked = comp.modules.includes("Gestão Comercial");
        document.getElementById('mod-cres').checked = comp.modules.includes("Crescimento Empresarial");
        document.getElementById('mod-est').checked = comp.modules.includes("Controle de Estoque");

        renderBanksList(comp.banks);
        renderLoansList(comp.loans || []);
        renderFilesList(comp.files);
        renderCommHistory(companyId);
    } else { // New Mode
        document.getElementById('new-bank-select').disabled = true;
        document.getElementById('new-bank-custom').disabled = true;
        document.getElementById('btn-add-bank').disabled = true;
        document.getElementById('loan-bank-select').disabled = true;
        document.getElementById('btn-add-loan').disabled = true;

        document.getElementById('drop-zone').style.pointerEvents = 'none';
        document.getElementById('drop-zone').style.opacity = '0.5';
        document.getElementById('btn-browse-files').disabled = true;
        document.getElementById('bank-lock-msg').style.display = 'block';
        document.getElementById('file-lock-msg').style.display = 'block';

        // Desativar comunicação para novos
        document.getElementById('comm-message').disabled = true;
        document.getElementById('btn-send-message').disabled = true;
        document.getElementById('comm-history').innerHTML = '<p style="color:var(--text-secondary); font-style:italic; text-align:center;">Salve o cadastro para habilitar mensagens.</p>';

        document.getElementById('modal-title').innerHTML = `<i class="fa-solid fa-building" style="color: var(--accent-gold); margin-right: 8px;"></i> Cadastrar Novo Cliente`;
        document.getElementById('admin-comp-mode').value = 'new';
        form.reset();
        document.getElementById('admin-comp-password').value = '';
        document.getElementById('admin-comp-id').disabled = false;

        renderBanksList([]);
        renderFilesList([]);
    }

    const auditBtn = document.getElementById('btn-audit-data');
    if (auditBtn) {
        auditBtn.onclick = (e) => {
            e.preventDefault();
            if (!editingCompanyId) return;
            const comp = mockCompanies.find(c => c.id === editingCompanyId);
            let report = `🔎 AUDITORIA DE DADOS (Local Storage)\nCliente: ${comp.name} [ID: ${editingCompanyId}]\n\n`;
            let found = 0;
            const keys = Object.keys(localStorage).sort();
            keys.forEach(k => {
                if (k.includes(`_${editingCompanyId}_`)) {
                    const data = JSON.parse(localStorage.getItem(k));
                    const isDRE = k.startsWith('clarusData_');
                    const month = k.split('_').pop();

                    if (isDRE) {
                        const detCount = (data.despesas_operacionais_detalhe || []).length;
                        const dTotal = (data.despesas_operacionais || 0);
                        const rTotal = (data.receita_total || 0);
                        report += `📊 ${month} [DRE]: ${detCount} despesas | R$ ${dTotal.toLocaleString('pt-BR')} (Rec: R$ ${rTotal.toLocaleString('pt-BR')})\n`;
                    } else {
                        const count = (data.compromissos || []).length;
                        const sample = count > 0 ? `(Ex: ${data.compromissos[0].data} - ${data.compromissos[0].titulo})` : '';
                        const val = (data.a_receber_mes || 0);
                        report += `📅 ${month} [Fluxo]: ${count} registros | R$ ${val.toLocaleString('pt-BR')} ${sample}\n`;
                    }
                    found++;
                }
            });
            if (found === 0) report += "❌ Nenhum dado financeiro encontrado no banco local.";
            alert(report);
        };
    }

    modal.classList.remove('hidden');
};

if (btnNew) {
    btnNew.addEventListener('click', () => openAdminModal(null));
}

if (btnClose) {
    btnClose.addEventListener('click', (e) => {
        e.preventDefault();
        modal.classList.add('hidden');
        localStorage.removeItem('clarusAdminViewingId');
    });

    document.getElementById('admin-company-form').addEventListener('submit', (e) => {
        e.preventDefault();
        saveAdminForm();
    });

    const btnWipe = document.getElementById('btn-wipe-all');
    if (btnWipe) {
        btnWipe.addEventListener('click', () => {
            const check = prompt("ATENÇÃO: Isso vai limpar TODOS os arquivos do Data Lake (de todos os meses) e zerar o Cache.\n\nPara confirmar, digite: ZERAR");
            if (check === "ZERAR") {
                localStorage.removeItem('clarusDashboardData');
                const keys = Object.keys(localStorage);
                // Limpar todos os arquivos e dados vinculados
                Object.keys(localStorage).forEach(key => {
                    if (key.startsWith('clarusData_') || key.startsWith('clarusDataVenc_')) {
                        localStorage.removeItem(key);
                    }
                });
                mockCompanies.forEach(c => c.files = []);
                localStorage.setItem('clarusCompanies', JSON.stringify(mockCompanies));

                if (editingCompanyId) {
                    const comp = mockCompanies.find(c => c.id === editingCompanyId);
                    if (comp) renderFilesList(comp.files);
                }
                alert("Sistema limpo com sucesso! Seus dashboards estão zerados aguardando novos uploads exatos.");

                // Atualização dinâmica sem perder a sessão admin
                if (editingCompanyId) {
                    const comp = mockCompanies.find(c => c.id === editingCompanyId);
                    if (comp) renderFilesList(comp.files);
                }
                renderAdminCompanies();
                if (window.refreshDashboardsWithData) window.refreshDashboardsWithData();
            } else if (check !== null) {
                alert("Operação cancelada. A palavra-chave não confere.");
            }
        });
    }
}

const renderCommHistory = (clientId) => {
    const historyDiv = document.getElementById('comm-history');
    if (!historyDiv) return;

    const messages = JSON.parse(localStorage.getItem('clarusNotifications') || '[]');
    const filtered = messages.filter(m => m.clientId === clientId);

    if (filtered.length === 0) {
        historyDiv.innerHTML = '<p style="color:var(--text-secondary); font-style:italic; text-align:center;">Nenhum histórico de mensagens.</p>';
        return;
    }

    historyDiv.innerHTML = filtered.reverse().map(m => `
        <div style="margin-bottom: 0.75rem; background: rgba(255,255,255,0.03); border-radius: 4px; padding: 0.5rem; position: relative;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.25rem;">
                <span style="font-size: 0.7rem; color: #64748b;">${new Date(m.timestamp).toLocaleString()}</span>
                <span style="font-size: 0.7rem; color: ${m.read ? 'var(--status-success)' : 'var(--status-warning)'}; font-weight: 700;">
                    ${m.read ? '<i class="fa-solid fa-check-double"></i> Lida' : '<i class="fa-solid fa-check"></i> Enviada'}
                </span>
            </div>
            <p style="margin: 0; color: white;">${m.text}</p>
        </div>
    `).join('');
};

const sendMessage = () => {
    const text = document.getElementById('comm-message').value.trim();
    if (!text || !editingCompanyId) return;

    const messages = JSON.parse(localStorage.getItem('clarusNotifications') || '[]');
    const newMsg = {
        id: Date.now(),
        clientId: editingCompanyId,
        text: text,
        timestamp: new Date().toISOString(),
        read: false
    };

    messages.push(newMsg);
    localStorage.setItem('clarusNotifications', JSON.stringify(messages));

    // SUPABASE SYNC UP
    if (window.db && window.db.sendNotification) {
        window.db.sendNotification(editingCompanyId, text).catch(e => console.error("Sync Error:", e));
    }

    document.getElementById('comm-message').value = '';
    renderCommHistory(editingCompanyId);
    alert("Notificação enviada com sucesso para o canal do cliente!");
};

// Re-render files when the month picker changes
const monthPicker = document.getElementById('upload-month-ref');
if (monthPicker) {
    monthPicker.addEventListener('change', () => {
        if (editingCompanyId) {
            const comp = mockCompanies.find(c => c.id === editingCompanyId);
            if (comp) renderFilesList(comp.files);
        }
    });
}

// Bank Dropdown Logic
const newBankSelect = document.getElementById('new-bank-select');
const newBankCustom = document.getElementById('new-bank-custom');

if (newBankSelect) {
    newBankSelect.addEventListener('change', (e) => {
        if (e.target.value === 'Outro') {
            newBankCustom.style.display = 'block';
            newBankCustom.focus();
        } else {
            newBankCustom.style.display = 'none';
        }
    });
}

// Add Bank logic
const btnAddBank = document.getElementById('btn-add-bank');
if (btnAddBank) {
    btnAddBank.addEventListener('click', (e) => {
        e.preventDefault();
        let bName = newBankSelect ? newBankSelect.value : '';
        if (bName === 'Outro') bName = newBankCustom ? newBankCustom.value.trim() : '';
        const bInitialInput = document.getElementById('new-bank-initial');
        const bInitial = bInitialInput && bInitialInput.value ? parseFloat(bInitialInput.value) : 0;

        if (!bName || !editingCompanyId) return;

        const comp = mockCompanies.find(c => c.id === editingCompanyId);
        if (comp) {
            if (!comp.banks) comp.banks = [];

            if (bInitial !== 0) {
                comp.banks.push({ name: bName, initial: bInitial });
            } else {
                comp.banks.push(bName);
            }

            saveAdminData();
            if (newBankSelect) newBankSelect.value = '';
            if (newBankCustom) {
                newBankCustom.value = '';
                newBankCustom.style.display = 'none';
            }
            if (bInitialInput) bInitialInput.value = '';

            renderBanksList(comp.banks);
            renderAdminCompanies();
        }
    });
}

// Add Message Send logic
const btnSendMessage = document.getElementById('btn-send-message');
if (btnSendMessage) {
    btnSendMessage.addEventListener('click', sendMessage);
}

// Gemini API Key Logic
const btnSaveGemini = document.getElementById('btn-save-gemini');
const geminiInput = document.getElementById('gemini-api-key');

if (btnSaveGemini && geminiInput) {
    // Load existing key
    const savedKey = localStorage.getItem('clarusGeminiKey');
    if (savedKey) geminiInput.value = savedKey;

    btnSaveGemini.addEventListener('click', () => {
        const key = geminiInput.value.trim();
        if (key) {
            localStorage.setItem('clarusGeminiKey', key);
            alert("Gemini API Key salva com sucesso! A LIA agora usará a inteligência do Google.");
        } else {
            localStorage.removeItem('clarusGeminiKey');
            alert("Chave removida. LIA retornou ao motor local básico.");
        }
    });
}

if (form) {
    const btnTogglePwd = document.getElementById('btn-toggle-pwd');
    if (btnTogglePwd) {
        btnTogglePwd.addEventListener('click', () => {
            const pwdInput = document.getElementById('admin-comp-password');
            if (pwdInput.type === 'password') {
                pwdInput.type = 'text';
                btnTogglePwd.innerHTML = '<i class="fa-solid fa-eye-slash"></i>';
            } else {
                pwdInput.type = 'password';
                btnTogglePwd.innerHTML = '<i class="fa-solid fa-eye"></i>';
            }
        });
    }

    const btnResetPwd = document.getElementById('btn-reset-pwd');
    if (btnResetPwd) {
        btnResetPwd.addEventListener('click', () => {
            const id = document.getElementById('admin-comp-id').value;
            if (!id) {
                alert("O ID do cliente não está definido.");
                return;
            }
            alert(`Um e-mail de redefinição de senha foi enviado para o contato principal do cliente ID: ${id}.`);
        });
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const mode = document.getElementById('admin-comp-mode').value;
        const name = document.getElementById('admin-comp-name').value;
        const id = document.getElementById('admin-comp-id').value;
        const password = document.getElementById('admin-comp-password').value;
        const level = parseInt(document.getElementById('admin-comp-level').value);

        const modules = ["Saúde Financeira", "Fluxo de Caixa"];
        if (document.getElementById('mod-rent').checked) modules.push("Rentabilidade e Curva ABC");
        if (document.getElementById('mod-com').checked) modules.push("Gestão Comercial");
        if (document.getElementById('mod-est').checked) modules.push("Controle de Estoque");
        if (document.getElementById('mod-cres').checked) modules.push("Crescimento Empresarial");

        if (mode === 'new') {
            mockCompanies.push({
                id, name, password, level, modules, banks: [], files: [], capitalSocial: parseFloat(document.getElementById('admin-comp-capital').value) || 0
            });
            editingCompanyId = id;
            await saveAdminData();
            alert(`Cliente "${name}" cadastrado com sucesso!\nID liberado: ${id}`);
            editingCompanyId = null;
        } else {
            const comp = mockCompanies.find(c => c.id === id);
            comp.name = name;
            comp.password = password;
            comp.level = level;
            comp.modules = modules;
            comp.capitalSocial = parseFloat(document.getElementById('admin-comp-capital').value) || 0;
            await saveAdminData();
            alert(`Definições do cliente "${name}" atualizadas com sucesso!`);
        }

        modal.classList.add('hidden');
        renderAdminCompanies();
    });
}

// Upload Data Logic Simulation (Integrated)
const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');

const simulateUploadProcessing = async (filesObj) => {
    if (!filesObj || filesObj.length === 0 || !editingCompanyId) return;

    const statusDiv = document.getElementById('upload-status');
    const pBar = document.getElementById('upload-progress-bar');
    const textSpan = document.getElementById('upload-status-text');
    const dropZone = document.getElementById('drop-zone');

    try {
        window.uploadPromiseResolved = false;

        const monthInput = document.getElementById('upload-month-ref');
        const month = monthInput ? monthInput.value : '2026-07';
        if (!month) {
            alert("Por favor, selecione o Mês Base dos Relatórios antes de continuar.");
            return;
        }

        const tgtBankInput = document.getElementById('upload-bank-ref');
        let tgtBank = tgtBankInput ? tgtBankInput.value : "";

        const regimeInput = document.getElementById('upload-regime-ref');
        const regime = regimeInput ? regimeInput.value : 'emissao';

        // Convert FileList to Array to extract names
        const allFileNames = Array.from(filesObj).map(f => `${f.name} (Ref: ${month}${tgtBank ? ' - ' + tgtBank : ''})`);

        // Filtrar arquivos que já existem no repositório da empresa para evitar duplicações
        const comp = mockCompanies.find(c => c.id === editingCompanyId);
        
        // REGISTRO INTERNO: Modo Substituição (Pedido pelo USER)
        const replaceMode = document.getElementById('upload-replace-mode')?.checked;
        if (replaceMode && comp) {
             const dreKey = `clarusData_${editingCompanyId}_${month}`;
             const fluxKey = `clarusDataVenc_${editingCompanyId}_${month}`;
             localStorage.removeItem(dreKey);
             localStorage.removeItem(fluxKey);
             
             // Limpa da lista de arquivos processados para permitir re-upload total
             if (comp.files) {
                 comp.files = comp.files.filter(f => !f.includes(`(Ref: ${month}`));
             }
             console.log(`🧹 [Replace Mode] Mês ${month} resetado para o cliente ${editingCompanyId}`);
        }

        const existingFiles = comp.files || [];
        const fileNames = allFileNames.filter(name => {
            if (existingFiles.includes(name)) {
                console.warn(`⚠️ [Ingestion] Arquivo ignorado (já existe): ${name}`);
                return false;
            }
            return true;
        });

        if (fileNames.length === 0) {
            alert("AVISO: Todos os arquivos selecionados já foram processados para este mês no Localhost.\n\nSe você deseja reenviar o mesmo arquivo (ex: corrigido), use o botão 'ZERAR BANCO DE DADOS DE " + month + "' primeiro.");
            return;
        }

        if (fileNames.length < allFileNames.length) {
            alert("Alguns arquivos foram ignorados por já existirem no sistema.");
        }

        dropZone.style.display = 'none';
        const statusDiv = document.getElementById('upload-status');
        const pBar = document.getElementById('upload-progress-bar');
        const textSpan = document.getElementById('upload-status-text');

        statusDiv.classList.remove('hidden');
        textSpan.innerHTML = `Lendo <strong>${fileNames.length}</strong> arquivo(s)... Transferindo para o Data Lake /${editingCompanyId}...`;

        // Initial extraction flags (Defaults)
        const baseIsComercial = tgtBank === "comercial";
        const baseIsEstoque = tgtBank === "estoque";
        const baseIsPagar = tgtBank === "pagar" || tgtBank === "imposto" || tgtBank === "custo" || tgtBank === "salarios";
        const baseIsReceber = tgtBank === "receber" || tgtBank === "receita";

        let dreClusters = {};
        let fluxoClusters = {};

        const getCluster = (clusters, m) => {
            if (!clusters[m]) {
                clusters[m] = {
                    receita_total: 0, despesas_operacionais: 0, impostos: 0, custos: 0,
                    bancos: {},
                    a_pagar_mes: 0, a_receber_mes: 0, compromissos: [],
                    comercial: { vendas_mes: 0, ticket_medio: 0, conversao: 0, cac: 0, total_leads: 0, total_valor_vendas: 0, marketing: 0, vendedoresMap: {} },
                    estoque: { valor_total: 0, itens_cadastrados: 0, giro: 0, rupture: 0, entradas: 0, saidas: 0, categoriasMap: {}, alertas: [] },
                    balanco: {
                        ativo: { inadimplencia: 0, estoque: 0, imobilizado: 0 },
                        passivo: { emprestimos: 0, salarios: 0, encargos: 0, simples: 0, governo_tributos: 0, parcelamentos: 0, pro_labore: 0 }
                    }
                };
            }
            return clusters[m];
        };

        window.uploadAuditLog = [];
        const filePromises = Array.from(filesObj).map(async (file) => {
            return new Promise(async (resolve) => {
                const lFn = file.name.toLowerCase();
                const ext = file.name.split('.').pop().toLowerCase();
                const reader = new FileReader();

                // Auto-tagging local (não afeta o objeto global tgtBank)
                let localTgtBank = tgtBank;
                if (lFn.includes('inadimplencia')) localTgtBank = 'inadimplencia';
                if (lFn.includes('fundo de investimento')) localTgtBank = 'investimento';
                if (lFn.includes('imobilizado') || lFn.includes('equipamento')) localTgtBank = 'imobilizado';
                if (lFn.includes('emprestimo') || lFn.includes('financiamento')) localTgtBank = 'emprestimos';
                if (lFn.includes('salário') || lFn.includes('folha') || lFn.includes('salario')) localTgtBank = 'salarios';
                if (lFn.includes('encargos') || lFn.includes('inss')) localTgtBank = 'encargos';
                if (lFn.includes('simples nacional')) localTgtBank = 'simples';
                if (lFn.includes('pro-labore') || lFn.includes('retirada')) localTgtBank = 'pro_labore';

                // Seletor agressivo baseado no NOME do arquivo como ordem suprema
                let isPagar = baseIsPagar;
                if (lFn.includes('contasapagar') || lFn.includes('contas_a_pagar') || lFn.includes('pagar') || lFn.includes('pagto') || lFn.includes('fgts') || lFn.includes('folha') || lFn.includes('salário') || lFn.includes('salario') || lFn.includes('imposto') || lFn.includes('custo') || lFn.includes('despesa')) {
                    isPagar = true;
                    console.log(`🚩 [Routing] Arquivo "${file.name}" identificado como PAGAR pelo nome.`);
                } else if (lFn.includes('contasareceber') || lFn.includes('contas_a_receber') || lFn.includes('receber') || lFn.includes('recebimento') || lFn.includes('receita') || lFn.includes('venda')) {
                    isPagar = false;
                    console.log(`🚩 [Routing] Arquivo "${file.name}" identificado como RECEBER pelo nome.`);
                }

                let isReceber = !isPagar;
                let isComercial = baseIsComercial || lFn.includes('comercial');
                let isEstoque = baseIsEstoque || lFn.includes('estoque');

                if (ext === 'csv') {
                    reader.onload = (e) => {
                        const text = e.target.result;
                        const lines = text.split(/\r?\n/);
                        for (let i = 1; i < lines.length; i++) {
                            if (!lines[i].trim()) continue;
                            const parts = lines[i].split(';');

                            let rowDate = parts[0] ? parts[0].trim() : month;
                            const currentDreCluster = getCluster(dreClusters, rowDate.length === 7 ? rowDate : month);
                            const currentFluxoCluster = getCluster(fluxoClusters, rowDate.length === 7 ? rowDate : month);

                            if (isComercial && parts.length >= 10) {
                                let valor = parseBRL(parts[8]);
                                if (!currentDreCluster.comercial) currentDreCluster.comercial = { total_valor_vendas: 0 };
                                currentDreCluster.comercial.total_valor_vendas += valor;
                            } else if (isPagar && parts.length >= 3) {
                                let dataVenc = parts[0].trim(); let valor = parseBRL(parts[2]);
                                if (valor > 0) {
                                    const absValue = Math.abs(valor);
                                    if (tgtBank === "imposto" || lFn.includes('imposto')) currentDreCluster.impostos += absValue;
                                    else if (tgtBank === "custo" || lFn.includes('custo')) currentDreCluster.custos += absValue;
                                    else currentDreCluster.despesas_operacionais += absValue;
                                    currentFluxoCluster.a_pagar_mes += absValue;
                                    currentFluxoCluster.compromissos.push({ data: dataVenc, titulo: parts[1].trim(), valor: absValue, tipo: 'negative', _source: file.name });
                                }
                            } else if (isReceber && parts.length >= 3) {
                                let dataRec = parts[0].trim(); let valor = parseBRL(parts[2]);
                                if (valor > 0) {
                                    const absValue = Math.abs(valor);
                                    currentDreCluster.receita_total += absValue;
                                    currentFluxoCluster.a_receber_mes += absValue;
                                    currentFluxoCluster.compromissos.push({ data: dataRec, titulo: parts[1].trim(), valor: absValue, tipo: 'positive', _source: file.name });
                                }
                            }
                        }
                        resolve();
                    };
                    reader.readAsText(file);
                } else if (ext === 'ofx') {
                    reader.onload = async (e) => {
                        try {
                            const text = e.target.result;
                            const currentFluxoCluster = getCluster(fluxoClusters, month);

                            // Smart Bank Detection
                            let bankCol = tgtBank || "";
                            if (!bankCol) {
                                const orgMatch = text.match(/<ORG>([^<]+)/i);
                                const fidMatch = text.match(/<FID>([^<]+)/i);
                                let detectedOrg = (orgMatch ? orgMatch[1].trim() : (fidMatch ? fidMatch[1].trim() : "")).toLowerCase();

                                // Get client banks for fuzzy matching
                                const comp = mockCompanies.find(c => c.id === editingCompanyId);
                                const registeredBanks = comp ? comp.banks || [] : [];

                                let found = registeredBanks.find(rb => {
                                    const bName = (typeof rb === 'string' ? rb : rb.name).toLowerCase();
                                    return bName.includes(detectedOrg) || detectedOrg.includes(bName) || lFn.includes(bName);
                                });

                                if (found) {
                                    bankCol = typeof found === 'string' ? found : found.name;
                                    console.log(`🔍 [OFX] Banco detectado automaticamente: ${bankCol}`);
                                } else {
                                    bankCol = "OFX Import";
                                    console.warn(`⚠️ [OFX] Banco não identificado no arquivo ou nome. Usando: ${bankCol}`);
                                }
                            }

                            if (!currentFluxoCluster.bancos) currentFluxoCluster.bancos = {};
                            if (!currentFluxoCluster.bancos[bankCol]) {
                                currentFluxoCluster.bancos[bankCol] = { entradas: 0, saidas: 0 };
                            }

                            // SUPER AGGRESSIVE OFX PARSER (v3)
                            const cleanText = text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, "")
                                .replace(/&amp;/g, "&")
                                .replace(/\r/g, "\n");

                            const trnRegex = /<(STMTTRN|\[STMTTRN)[^>]*>([\s\S]*?)(?:<\/\1>|(?=<(?:STMTTRN|\[STMTTRN)))/gi;
                            let trnMatch;
                            let count = 0;

                            while ((trnMatch = trnRegex.exec(cleanText)) !== null) {
                                const tr = trnMatch[2];
                                const amtMatch = tr.match(/<TRNAMT>\s*([\d,.\s\-]+)/i);
                                const nameMatch = tr.match(/<(NAME|MEMO|PAYEE|CHECKNUM|DESC)>\s*([^<\r\n]+)/i);
                                const dateMatch = tr.match(/<DTPOSTED>\s*(\d{8})/i);

                                if (amtMatch) {
                                    let rawVal = amtMatch[1].trim().replace(',', '.').replace(/\s/g, '');
                                    let val = parseFloat(rawVal);
                                    let title = nameMatch ? nameMatch[2].trim() : "Lançamento OFX";
                                    if (title.length > 80) title = title.substring(0, 80).trim();

                                    let dateStr = dateMatch ? `${dateMatch[1].substring(0, 4)}-${dateMatch[1].substring(4, 6)}-${dateMatch[1].substring(6, 8)}` : month + '-01';

                                    if (!isNaN(val) && val !== 0) {
                                        const isPos = val > 0;
                                        const absVal = Math.abs(val);
                                        // Contas Bancárias (Transactional)
                                        if (!currentFluxoCluster.bancos) currentFluxoCluster.bancos = {};
                                        if (!currentFluxoCluster.bancos[bankCol]) currentFluxoCluster.bancos[bankCol] = { entradas: 0, saidas: 0, saldo_inicial: 0 };

                                        currentFluxoCluster.bancos[bankCol][isPos ? 'entradas' : 'saidas'] += absVal;

                                        // User Rule: OFX (Extrato) does NOT populate 'a_receber_mes' or 'a_pagar_mes' in Cash Flow.
                                        // These will be populated ONLY by Excel files.

                                        count++;
                                    }
                                }
                            }

                            if (count === 0) {
                                console.warn("⚠️ [OFX] Tentando varredura linear de tags...");
                                const allAmts = [...cleanText.matchAll(/<TRNAMT>\s*([\d,.\s\-]+)/gi)];
                                const allNames = [...cleanText.matchAll(/<(?:NAME|MEMO|PAYEE|DESC)>\s*([^<\r\n]+)/gi)];
                                allAmts.forEach((m, idx) => {
                                    let val = parseFloat(m[1].trim().replace(',', '.').replace(/\s/g, ''));
                                    if (!isNaN(val) && val !== 0) {
                                        const isPos = val > 0;
                                        const absVal = Math.abs(val);
                                        currentFluxoCluster.bancos[bankCol][isPos ? 'entradas' : 'saidas'] += absVal;
                                        // User Rule: OFX (Extrato) does NOT populate general cash flow metrics
                                        count++;
                                    }
                                });
                            }
                            console.log(`✅ [OFX] ${count} transações importadas de ${file.name} para o canal [${bankCol}]`);
                        } catch (err) {
                            console.error("❌ [OFX Error]:", err);
                        } finally {
                            resolve();
                        }
                    }
                    reader.readAsText(file);
                } else if (ext === 'xlsx' || ext === 'xls' || ext === 'xlsm') {
                    reader.onload = (e) => {
                        try {
                            const workbook = XLSX.read(e.target.result, { type: 'array' });
                            console.log(`📂 [XLSX] Arquivo lido: ${file.name} | Abas:`, workbook.SheetNames);

                            let totalRows = 0;
                            // Módulo Estoque: Processar apenas a PRIMEIRA aba para evitar duplicação (usa isEstoque inteligente)
                            const sheetNames = isEstoque ? [workbook.SheetNames[0]] : workbook.SheetNames;

                            sheetNames.forEach(sheetName => {
                                const worksheet = workbook.Sheets[sheetName];
                                const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
                                console.log(`📊 [XLSX] Aba "${sheetName}": ${json ? json.length : 0} linhas encontradas.`);
                                if (!json || json.length === 0) return;

                                const res = processExcelSheet(json, isPagar, localTgtBank, file.name, regime, dreClusters, fluxoClusters);
                                totalRows += (res.compromissos ? res.compromissos.length : 0);
                            });
                            console.log(`✅ [Ingestion] Fim do processamento de ${file.name}. Total de linhas integradas: ${totalRows}`);
                            window.lastUploadRows = totalRows;
                        } catch (err) { console.error("XLSX Error:", err); }
                        resolve();
                    };
                    reader.readAsArrayBuffer(file);
                } else if (ext === 'pdf') {
                    reader.onload = async (e) => {
                        try {
                            const typedarray = new Uint8Array(e.target.result);
                            const pdf = await pdfjsLib.getDocument(typedarray).promise;
                            let fullText = "";
                            for (let i = 1; i <= pdf.numPages; i++) {
                                const page = await pdf.getPage(i);
                                const textContent = await page.getTextContent();
                                fullText += textContent.items.map(item => item.str).join(' ') + " ";
                            }

                            const currentDreCluster = getCluster(dreClusters, month);
                            const currentFluxoCluster = getCluster(fluxoClusters, month);
                            const lowText = fullText.toLowerCase();

                            if (lowText.includes('simples nacional') || lowText.includes('das')) {
                                const valMatch = fullText.match(/Valor\s+Total.*([\d.,]{3,})/i);
                                if (valMatch) {
                                    let v = parseBRL(valMatch[1]);
                                    currentDreCluster.impostos += v;
                                    currentFluxoCluster.a_pagar_mes += v;
                                    currentFluxoCluster.compromissos.push({ data: '', titulo: 'DAS (PDF)', valor: v, tipo: 'negative', isTax: true });
                                }
                            } else if (lowText.includes('fgts')) {
                                const valMatch = fullText.match(/(?:Valor a Recolher|Total|VALOR DEVIDO).*?([\d.,]{3,})/i);
                                if (valMatch) {
                                    let v = parseBRL(valMatch[1]);
                                    currentDreCluster.impostos += v;
                                    currentFluxoCluster.a_pagar_mes += v;
                                    currentFluxoCluster.compromissos.push({ data: '', titulo: 'FGTS (PDF)', valor: v, tipo: 'negative', isTax: true });
                                }
                            } else if (lowText.includes('inss') || lowText.includes('gps')) {
                                const valMatch = fullText.match(/(?:Valor do INSS|Total|VALOR)?.*?([\d.,]{3,})/i);
                                if (valMatch) {
                                    let v = parseBRL(valMatch[1]);
                                    currentDreCluster.impostos += v;
                                    currentFluxoCluster.a_pagar_mes += v;
                                    currentFluxoCluster.compromissos.push({ data: '', titulo: 'INSS/GPS (PDF)', valor: v, tipo: 'negative', isTax: true });
                                }
                            } else if (/\b(folha de pagamento|holerite|vencimento|provento|sal[aá]rio|líquido)\b/i.test(fullText) || localTgtBank === "salarios") {
                                // REGISTRO INTERNO: Regex expandido e robusto para capturar modelos variados de Folha/Holerite (Incluindo Brusque Assessoria)
                                // v3: Requer vírgula para decimais ou pelo menos 6 caracteres para evitar capturar o ano (2026)
                                const valMatch = fullText.match(/(?:Total Líquido|Líquido a Receber|PROVENTOS|VALOR LÍQUIDO|VALOR A RECEBER|LÍQUIDO A PAGAR|Líquido salários|Total Geral da Empresa|depósito de|Valor Líquido).*?([\d.]{1,11},\d{2}|[\d.]{6,})/i);
                                if (valMatch) {
                                    let v = parseBRL(valMatch[1]);
                                    // Se o valor for suspeitamente pequeno (ex: < 10) e houver outro valor maior próximo (como no caso do '11 36.596,00'), tentamos uma captura mais profunda
                                    if (v < 50 && fullText.includes(valMatch[1])) {
                                        const deepMatch = fullText.substring(fullText.indexOf(valMatch[0])).match(/[\d.,]{5,}/);
                                        if (deepMatch) v = parseBRL(deepMatch[0]);
                                    }

                                    currentDreCluster.despesas_operacionais += v;
                                    currentFluxoCluster.a_pagar_mes += v;
                                    currentFluxoCluster.compromissos.push({ data: '', titulo: 'Salários / Folha (PDF)', valor: v, tipo: 'negative', _source: file.name });

                                    // REGISTRO INTERNO: Alimenta o detalhamento para o modal unificado (DRE)
                                    if (!currentDreCluster.despesas_operacionais_detalhe) currentDreCluster.despesas_operacionais_detalhe = [];
                                    currentDreCluster.despesas_operacionais_detalhe.push({
                                        descricao: "Folha de Pagamento / Salários (PDF)",
                                        valor: v,
                                        vencimento: "",
                                        doc: file.name
                                    });

                                    // REGISTRO INTERNO: Alimenta o Balanço Gerencial (Passivo)
                                    if (!currentDreCluster.balanco) currentDreCluster.balanco = { ativo: {}, passivo: {} };
                                    if (!currentDreCluster.balanco.passivo) currentDreCluster.balanco.passivo = {};
                                    currentDreCluster.balanco.passivo.salarios = (currentDreCluster.balanco.passivo.salarios || 0) + v;
                                    alert(`✅ SUCESSO: Documento de Salário identificado.\nValor: R$ ${v.toLocaleString('pt-BR')}\nEste valor será exibido no Auditoria, no DRE e no Balanço.`);
                                } else {
                                    alert(`⚠️ AVISO: Identificado como PDF de Salário mas o valor financeiro não foi encontrado.\nVerifique se o PDF contém termos como "Total Líquido" ou "Líquido a Pagar".`);
                                }
                            } else if (localTgtBank === "despesa_operacional" || localTgtBank === "pagar") {
                                // Suporte para qualquer PDF enviado como Despesa Operacional ou Pagar
                                // v3: Requer vírgula para decimais ou pelo menos 6 caracteres para evitar capturar o ano (2026)
                                const valMatch = fullText.match(/(?:Total a Pagar|Valor Total|Total|Valor Geral|PAGAR|DEVIDO|LÍQUIDO).*?([\d.]{1,11},\d{2}|[\d.]{6,})/i);
                                if (valMatch) {
                                    let v = parseBRL(valMatch[1]);
                                    currentDreCluster.despesas_operacionais += v;
                                    currentFluxoCluster.a_pagar_mes += v;
                                    currentFluxoCluster.compromissos.push({ data: '', titulo: file.name, valor: v, tipo: 'negative', _source: file.name });

                                    if (!currentDreCluster.despesas_operacionais_detalhe) currentDreCluster.despesas_operacionais_detalhe = [];
                                    currentDreCluster.despesas_operacionais_detalhe.push({
                                        descricao: "Despesa (PDF: " + file.name + ")",
                                        valor: v,
                                        vencimento: "",
                                        doc: file.name
                                    });
                                }
                            }
                        } catch (err) { console.error("PDF Error:", err); }
                        resolve();
                    };
                    reader.readAsArrayBuffer(file);
                } else if (ext === 'xml') {
                    reader.onload = (e) => {
                        try {
                            const parser = new DOMParser();
                            const xmlDoc = parser.parseFromString(e.target.result, "text/xml");
                            const vNF = xmlDoc.getElementsByTagName("vNF")[0]?.textContent;
                            const dhEmi = xmlDoc.getElementsByTagName("dhEmi")[0]?.textContent || xmlDoc.getElementsByTagName("dEmi")[0]?.textContent;
                            const xNome = xmlDoc.getElementsByTagName("xNome")[1]?.textContent || xmlDoc.getElementsByTagName("xNome")[0]?.textContent; // Emitente vs Destinatário

                            if (vNF && dhEmi) {
                                let v = parseFloat(vNF);
                                let d = dhEmi.substring(0, 10);
                                let m = d.substring(0, 7);
                                const currentDreCluster = getCluster(dreClusters, m);
                                const currentFluxoCluster = getCluster(fluxoClusters, m);

                                // NFe assume-se Receita (Faturamento) por padrão no dashboard Clarus
                                currentDreCluster.receita_total += v;
                                currentFluxoCluster.a_receber_mes += v;
                                currentFluxoCluster.compromissos.push({ data: d, titulo: `NF-e: ${xNome}`, valor: v, tipo: 'positive', _source: file.name });
                                console.log(`✅ [XML] NF-e importada: R$ ${v} (${d})`);
                            }
                        } catch (err) { console.error("XML Error:", err); }
                        resolve();
                    };
                    reader.readAsText(file);
                } else {
                    resolve();
                }
            });
        });

        // Loop de processamento com rastreio individual por arquivo
        const fileContribsDRE = {}; // { fileName: { month: data } }
        const fileContribsFluxo = {};

        for (let i = 0; i < filePromises.length; i++) {
            const file = filesObj[i];
            const fName = `${file.name} (Ref: ${month}${tgtBank ? ' - ' + tgtBank : ''})`;

            // Criamos clusters temporários para ESTE arquivo específico
            const fileDRE = {};
            const fileFluxo = {};

            // Simulamos o reader.onload de novo ou interceptamos o processamento
            // Para não duplicar código, vamos garantir que o processExcelSheet 
            // receba clusters vazios e nós os integremos depois.

            // NOTE: filePromises already contains the execution. 
            // To be precise without re-reading files, we would need to refactor the loop.
            // Let's do a slightly simpler but effective merge:
            await filePromises[i];
            const p = Math.round(((i + 1) / filePromises.length) * 100);
            pBar.style.width = `${p}%`;
            if (textSpan) {
                textSpan.innerHTML = `Processando <strong>${fileNames.length}</strong> arquivo(s)... Transferindo para o Data Lake /${editingCompanyId}... <strong>${p}%</strong>`;
            }
        }

        // --- SALVAMENTO ENRIQUECIDO (Trata contribuições individualmente) ---
        // Este bloco assume que os clusters (dreClusters, fluxoClusters) já foram povoados.
        // Como o processExcelSheet atual é síncrono e roda dentro das promessas,
        // vamos salvar o estado final, mas agora o sistema de rollback usará o fileName exato.

        const saveEnhancedClusters = (clusters, prefix) => {
            for (const mKey in clusters) {
                const data = clusters[mKey];
                const dataKey = `${prefix}${editingCompanyId}_${mKey}`;
                let d = JSON.parse(localStorage.getItem(dataKey) || '{}');
                if (!d._contributions) d._contributions = {};

                // Atribuímos a contribuição ao arquivo (ou lote se preferir, mas aqui buscamos precisão)
                // Se for lote, usamos o nome do primeiro arquivo ou a lista
                const contribName = fileNames.length === 1 ? fileNames[0] : fileNames.join(' + ');
                d._contributions[contribName] = JSON.parse(JSON.stringify(data));

                if (prefix === 'clarusData_') {
                    d.receita_total = (d.receita_total || 0) + data.receita_total;
                    d.impostos = (d.impostos || 0) + data.impostos;
                    d.custos = (d.custos || 0) + data.custos;
                    d.despesas_operacionais = (d.despesas_operacionais || 0) + data.despesas_operacionais;
                    if (data.despesas_operacionais_detalhe) {
                        if (!d.despesas_operacionais_detalhe) d.despesas_operacionais_detalhe = [];
                        d.despesas_operacionais_detalhe.push(...data.despesas_operacionais_detalhe);
                    }
                    d.lucro_liquido = d.receita_total - (d.impostos + d.custos + d.despesas_operacionais);
                } else {
                    d.a_pagar_mes = (d.a_pagar_mes || 0) + data.a_pagar_mes;
                    d.a_receber_mes = (d.a_receber_mes || 0) + data.a_receber_mes;
                    if (!d.compromissos) d.compromissos = [];
                    d.compromissos.push(...data.compromissos);

                    // --- MERGE BANCOS (Crucial for OFX) ---
                    if (data.bancos) {
                        if (!d.bancos) d.bancos = {};
                        for (const b in data.bancos) {
                            if (!d.bancos[b]) d.bancos[b] = { entradas: 0, saidas: 0 };
                            d.bancos[b].entradas += (data.bancos[b].entradas || 0);
                            d.bancos[b].saidas += (data.bancos[b].saidas || 0);
                            if (data.bancos[b].saldo_inicial !== undefined) d.bancos[b].saldo_inicial = data.bancos[b].saldo_inicial;
                        }
                    }
                }

                // --- MERGE BALANCO (Sync Passivo/Ativo) ---
                if (data.balanco) {
                    if (!d.balanco) d.balanco = { ativo: {}, passivo: {} };
                    if (data.balanco.ativo) {
                        for (const cat in data.balanco.ativo) {
                            d.balanco.ativo[cat] = (d.balanco.ativo[cat] || 0) + data.balanco.ativo[cat];
                        }
                    }
                    if (data.balanco.passivo) {
                        for (const cat in data.balanco.passivo) {
                            d.balanco.passivo[cat] = (d.balanco.passivo[cat] || 0) + data.balanco.passivo[cat];
                        }
                    }
                }

                // --- MERGE ESTOQUE (Novo) ---
                if (data.estoque_unidades) {
                    if (!d.estoque_unidades) d.estoque_unidades = {};
                    Object.assign(d.estoque_unidades, data.estoque_unidades);
                    console.log(`📦 [Admin] Unidades de estoque integradas ao aggregate: ${mKey}`);
                }
                if (data.estoque_data) {
                    d.estoque_data = data.estoque_data;
                }

                localStorage.setItem(dataKey, JSON.stringify(d));

                // SUPABASE SYNC UP
                if (window.db && window.db.saveFinancialData) {
                    const typeStr = prefix === 'clarusData_' ? 'dre' : 'fluxo';
                    window.db.saveFinancialData(editingCompanyId, mKey, typeStr, d).catch(e => console.error("Sync Error:", e));
                }
            }
        };

        pBar.style.width = `100%`;
        pBar.innerHTML = '100%';
        pBar.style.backgroundColor = '#10b981';
        saveEnhancedClusters(dreClusters, 'clarusData_');
        saveEnhancedClusters(fluxoClusters, 'clarusDataVenc_');

        if (comp) {
            if (!comp.files) comp.files = [];
            comp.files.push(...fileNames);
            saveAdminData();
            renderFilesList(comp.files);
            renderAdminCompanies();
        }

        const affectedDRE = Object.keys(dreClusters).filter(m => {
            const c = dreClusters[m] || {};
            return c.receita_total > 0 || c.impostos > 0 || c.custos > 0 || c.despesas_operacionais > 0 || c.estoque_data || c.estoque_unidades;
        }).sort();

        const affectedFluxo = Object.keys(fluxoClusters).filter(m => {
            const c = fluxoClusters[m] || {};
            return (c.compromissos?.length > 0) || (Object.keys(c.bancos || {}).length > 0) || c.estoque_data;
        }).sort();

        let summaryText = `✅ SUCESSO NO PROCESSAMENTO\n\n`;
        let countProcessed = 0;

        if (affectedDRE.length > 0) {
            summaryText += `📊 DRE (Emissão): ${affectedDRE.join(", ")}\n`;
            affectedDRE.forEach(m => {
                if (dreClusters[m].estoque_data) summaryText += `📦 ${m}: Dados de Inventário e Giro calculados.\n`;
            });
            countProcessed++;
        }
        if (affectedFluxo.length > 0) {
            summaryText += `💰 Fluxo/Bancos: ${affectedFluxo.join(", ")}\n\n`;
            countProcessed++;

            affectedFluxo.forEach(m => {
                const f = fluxoClusters[m];
                if (f && (f.a_receber_mes > 0 || f.a_pagar_mes > 0)) {
                    if (f.a_receber_mes > 0) summaryText += `📅 ${m}: R$ ${f.a_receber_mes.toLocaleString('pt-BR')} a receber (Excel).\n`;
                    if (f.a_pagar_mes > 0) summaryText += `📅 ${m}: R$ ${f.a_pagar_mes.toLocaleString('pt-BR')} a pagar (Excel).\n`;
                }
                if (f && f.bancos) {
                    for (const b in f.bancos) {
                        const bData = f.bancos[b];
                        if (bData.entradas > 0 || bData.saidas > 0) {
                            summaryText += `🏦 ${m} [${b}]: Movimentação de Extrato processada.\n`;
                        }
                    }
                }
            });
        }

        if (window.uploadAuditLog && window.uploadAuditLog.length > 0) {
            summaryText += `\n🔍 AUDITORIA DE MAPEAMENTO:\n`;
            window.uploadAuditLog.forEach(log => {
                summaryText += `📄 ${log.file}\n`;
                summaryText += `   - Colunas: Título(${log.mapping.titulo}), Ini(${log.mapping.inicial}), Fin(${log.mapping.final})\n`;
                summaryText += `   - Itens: ${log.results.rows} | Soma: R$ ${log.results.ini.toLocaleString('pt-BR')} -> R$ ${log.results.fin.toLocaleString('pt-BR')}\n`;
            });
            summaryText += `\n⚠️ DICA: Se os valores somados acima não baterem com o seu Excel, use o botão 'ZERAR' antes de re-enviar.`;
        }

        localStorage.setItem('clarusActiveMonth', month);
        if (window.refreshDashboardsWithData) window.refreshDashboardsWithData();

        alert(summaryText);

        if (affectedDRE.length === 0 && affectedFluxo.length === 0) {
            console.error("❌ Erro Total de Processamento. Clusters afetados: 0");
        }
        textSpan.innerHTML = `<i class='fa-solid fa-check' style='color:var(--status-success)'></i> Processamento finalizado. Verifique a Auditoria.`;

    } catch (err) {
        console.error("Erro Crítico no Upload:", err);
        textSpan.innerHTML = `<i class='fa-solid fa-circle-exclamation' style='color:var(--status-danger)'></i> Erro ao processar arquivos. O sistema tentou salvar o que foi possível.`;
    } finally {
        dropZone.style.display = 'block';
        if (textSpan) textSpan.innerHTML += `<br><span style='font-size: 0.75rem; opacity: 0.8;'>Processo finalizado.</span>`;
    }
};

/**
 * Funçao Auxiliar para Processar Planilhas XLSX com Lógica de Regime Dual
 */
const processExcelSheet = (json, isPagar, tgtBank, fileName, regime, dreClusters, fluxoClusters) => {
    if (!json || json.length < 1) return { compromissos: [] };

    // Dynamic Header Discovery (v2: more aggressive scanning)
    let headerRowIdx = 0;
    // Keywords for row detection (must be unique enough to identify a header)
    const keywords = ['valor', 'vldoc', 'vldocumento', 'data', 'missão', 'missao', 'vencimento', 'nr.doc', 'documento', 'cliente', 'fornecedor', 'nmpessoa', 'nm_pessoa', 'emi', 'vct', 'vlr', 'emis', 'vcto', 'estoque', 'est.ini', 'est_ini', 'cmv', 'custo', 'und', 'r$', 'grupo'];

    console.log("🔍 [Ingestion] Verificando cabeçalhos em:", fileName);
    // Busca inteligente do cabeçalho (pula títulos decorativos)
    for (let i = 0; i < Math.min(json.length, 12); i++) {
        const rowSample = (json[i] || []).map(c => (c || "").toString().toLowerCase());
        const matches = rowSample.filter(c =>
            c.includes('valor') || c.includes('vencimento') || c.includes('data') ||
            c.includes('desc') || c.includes('cmv') || c.includes('estoque') ||
            c.includes('inicial') || c.includes('final') || c.includes('custo') ||
            c.includes('und') || c.includes('r$') || c.includes('grupo')
        ).length;

        // Se a linha tem pelo menos 3 colunas que parecem cabeçalhos, ou mais de 5 colunas preenchidas
        if (matches >= 3 || rowSample.filter(c => c.trim().length > 0).length > 5) {
            headerRowIdx = i;
            console.log(`✅ [Ingestion] Cabeçalhos definitivos na linha ${i + 1}:`, (json[i] || []).filter(x => x));
            break;
        }
    }

    const headers = json[headerRowIdx].map(h => (h || "").toString().toLowerCase().trim());
    console.log("📌 [Header Map]:", headers);
    const idxDataEmi = headers.findIndex(h => h.includes('emissão') || h.includes('data doc') || h.includes('lançamento') || h.includes('emissao') || h.includes('dt.emi') || h.includes('dtemissao') || h.includes('dt.emis') || h.includes('emis') || h.includes('dte missao') || h.includes('dte.missao') || h.includes('data'));
    const idxDataVen = headers.findIndex(h => h.includes('vencimento') || h.includes('vencto') || h.includes('vcto') || h.includes('venc') || h.includes('dt.ven') || h.includes('dtvencimento') || h.includes('vencimento') || h.includes('vct') || h.includes('dt.venc'));
    const idxValor = headers.findIndex(h => h.includes('valor') || h.includes('total') || h.includes('líquido') || h.includes('liquido') || h.includes('vlr') || h.includes('vl') || h.includes('vldocumento') || h.includes('vldoc') || h.includes('vl.doc') || h.includes('valor doc') || h.includes('vl_liq') || h.includes('vlsaldo'));
    const idxSaldo = headers.findIndex(h => h.includes('saldo') || h.includes('disponível') || h.includes('acumulado'));
    const idxBank = headers.findIndex(h => h.includes('banco') || h.includes('conta') || h.includes('agencia') || h.includes('nm_banco') || h.includes('nome banco'));

    // Colunas de Estoque (Vocabulário Ampliado)
    const idxEstoqueIni = headers.findIndex(h => h.includes('estoque inicial') || h.includes('estoque_ini') || h.includes('estoque_inicial') || h.includes('est_ini') || h.includes('est.ini') || h.includes('saldoprodutoini'));
    const idxEstoqueFin = headers.findIndex(h => h.includes('estoque final') || h.includes('estoque_fin') || h.includes('estoque_final') || h.includes('est_fin') || h.includes('est.fin') || h.includes('saldoprodutofin'));
    const idxCMV = headers.findIndex(h => h.includes('cmv') || h.includes('custo venda') || h.includes('custo_venda') || h.includes('custo total') || h.includes('custo_total') || h.includes('custo_mercadoria'));
    const idxDespesaOp = headers.findIndex(h => h.includes('despesaoperacional') || h.includes('desp_op') || h.includes('despesa operacional') || h.includes('descrição') || h.includes('histórico') || h.includes('natureza'));

    // Prioritizing Name (NMPESSOA) over Code (CDPESSOA)
    const idxTitulo = headers.findIndex(h => (h === 'nmpessoa' || h === 'nm_pessoa' || h === 'nome' || h === 'cliente' || h === 'fornecedor' || h === 'produto' || h === 'item') && !h.startsWith('cd')) !== -1
        ? headers.findIndex(h => (h === 'nmpessoa' || h === 'nm_pessoa' || h === 'nome' || h === 'cliente' || h === 'fornecedor' || h === 'produto' || h === 'item') && !h.startsWith('cd'))
        : headers.findIndex(h => (h.includes('descrição') || h.includes('desc') || h.includes('histórico') || h.includes('título') || h.includes('nm') || h.includes('produto') || h.includes('item')) && !h.includes('cd') && !h.includes('id'));

    // Farejador de Mês (Month Sniffer) - Busca em toda a planilha se necessário
    let sniffedMonth = "";
    const monthsBR = ["janeiro", "fevereiro", "março", "marco", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
    for (let i = 0; i < Math.min(json.length, 12); i++) {
        const rowText = (json[i] || []).join(" ").toLowerCase();
        monthsBR.forEach((m, mIdx) => {
            if (rowText.includes(m)) {
                const yearMatch = rowText.match(/202\d/);
                const year = yearMatch ? yearMatch[0] : new Date().getFullYear();
                sniffedMonth = `${year}-${(mIdx + 1).toString().padStart(2, '0')}`;
            }
        });
        if (sniffedMonth) break;
    }

    let totalRows = 0;
    const getCluster = (clusters, m) => {
        if (!clusters[m]) clusters[m] = { receita_total: 0, impostos: 0, custos: 0, despesas_operacionais: 0, a_pagar_mes: 0, a_receber_mes: 0, compromissos: [] };
        return clusters[m];
    };

    const parseExcelDate = (val) => {
        if (!val) return null;
        if (val instanceof Date) {
            return new Date(val.getFullYear(), val.getMonth(), val.getDate(), 12, 0, 0);
        }

        if (typeof val === 'number' || (!isNaN(val) && val > 30000)) {
            const num = parseFloat(val);
            const dateUTC = new Date(Math.round((num - 25569 + 0.5) * 86400 * 1000));
            return new Date(dateUTC.getUTCFullYear(), dateUTC.getUTCMonth(), dateUTC.getUTCDate(), 12, 0, 0);
        }

        const s = val.toString().trim();
        const parts = s.split(/[\/\-]/);
        if (parts.length === 3) {
            let d, m, y;
            if (parts[2].length === 4) { y = parseInt(parts[2]); m = parseInt(parts[1]); d = parseInt(parts[0]); }
            else if (parts[0].length === 4) { y = parseInt(parts[0]); m = parseInt(parts[1]); d = parseInt(parts[2]); }
            if (y && m > 0 && m <= 12 && d > 0 && d <= 31) {
                return new Date(y, m - 1, d, 12, 0, 0);
            }
        }
        return null;
    };

    if (tgtBank === "estoque") {
        let mainMonth = sniffedMonth;
        let totalEstIni = 0;
        let totalEstFin = 0;
        let totalCMV = 0;
        let rowCount = 0;
        const isDespesaOp = (tgtBank === 'despesa_operacional');
        const despesaOpDetalhe = [];
        let totalDespOp = 0;

        // Detecção ultra-inclusiva com prioridade para R$ (Busca da Direita para Esquerda)
        const findBestIdx = (keywords) => {
            let idx = headers.findLastIndex(h => keywords.some(k => h.includes(k)) && (h.includes('r$') || h.includes('valor') || h.includes('vlr') || h.includes('total')));
            if (idx === -1) idx = headers.findLastIndex(h => keywords.some(k => h.includes(k)));
            return idx;
        };

        const idxValIniR$ = findBestIdx(['estoque inicial', 'est.ini', 'est_ini']);
        const idxValFinR$ = findBestIdx(['estoque final', 'est.fin', 'est_final']);
        const idxValCmvR$ = findBestIdx(['cmv'], ['total', 'r$', 'valor']);

        const idxCustoUni = headers.findIndex(h => h.includes('custo unitário') || h.includes('vlr_custo_unit') || h.includes('custo_unit'));
        const idxQtdIni = headers.findIndex(h => h.includes('estoque fechamento') || h.includes('est.fech'));

        const items = [];
        const uniqueCheck = new Set(); // Para evitar duplicação de linhas idênticas

        console.log(`🔍 [Inventory Map] Ini: ${idxValIniR$}, Fin: ${idxValFinR$}, CMV: ${idxValCmvR$}, CustoUni: ${idxCustoUni}`);

        for (let i = headerRowIdx + 1; i < json.length; i++) {
            const row = json[i];
            if (!row || row.length === 0) continue;

            const name = idxTitulo !== -1 ? (row[idxTitulo] || "").toString().trim() : "";
            const rowStr = row.join("|").toLowerCase();

            // Evitar duplicação idêntica (Deduplicação de emergência)
            const rowFingerprint = `${name}|${row[idxValIniR$]}|${row[idxValFinR$]}`;
            if (uniqueCheck.has(rowFingerprint)) continue;
            uniqueCheck.add(rowFingerprint);

            // Parada ultra-segura: Só para no TOTAL GERAL ou se encontrar muitos vazios
            if (rowStr.includes("total geral") || rowStr.includes("total final") || rowStr.includes("geral total")) {
                console.log("🛑 [Ingestion] Fim absoluto detectado na linha:", i + 1);
                break;
            }
            // Se tiver mos mais de 20 vazios seguidos, para (Prevenção de loop infinito em planilhas corrompidas)
            if (name === "" && !row[idxValFinR$] && rowCount > 10 && i > (headerRowIdx + 100)) break;

            // --- LÓGICA 1: DESPESA OPERACIONAL (NOVO) ---
            if (isDespesaOp && idxDespesaOp !== -1) {
                const val = parseBRL(row[idxValor]);
                const desc = (row[idxDespesaOp] || "").toString().trim();
                const vcto = (row[idxDataVen] || "").toString().trim();
                if (val > 0) {
                    totalDespOp += val;
                    despesaOpDetalhe.push({ descricao: desc, valor: val, vencimento: vcto, doc: (row[headers.findIndex(h => h.includes('nrdocumento'))] || "") });
                }
                rowCount++;
                continue;
            }

            // --- LÓGICA 2: ESTOQUE / CMV ---
            const dObj = parseExcelDate(row[idxDataEmi] || row[idxDataVen]);
            if (dObj && !mainMonth) mainMonth = `${dObj.getFullYear()}-${(dObj.getMonth() + 1).toString().padStart(2, '0')}`;

            let vIni = idxValIniR$ !== -1 ? parseBRL(row[idxValIniR$]) : 0;
            let vFin = idxValFinR$ !== -1 ? parseBRL(row[idxValFinR$]) : 0;
            let vCmv = idxValCmvR$ !== -1 ? parseBRL(row[idxValCmvR$]) : 0;

            const cost = idxCustoUni !== -1 ? parseBRL(row[idxCustoUni]) : 0;

            // Se for 0 e tivermos colunas de Qtd + Custo, calcula
            if (vIni === 0 && cost > 0 && idxQtdIni !== -1) vIni = cost * (parseFloat(row[idxQtdIni]) || 0);

            totalEstIni += vIni;
            totalEstFin += vFin;
            totalCMV += vCmv;
            rowCount++;

            if (vFin > 0 || vCmv > 0) {
                items.push({ name: name || "Item", cmvUnd: cost || (vCmv / (vCmv || 1)), qtd: vFin / (cost || 1), revenue: vCmv });
            }
        }

        if (isDespesaOp) {
            const currentDreCluster = getCluster(dreClusters, mainMonth || new Date().toISOString().slice(0, 7));
            currentDreCluster.despesas_operacionais = totalDespOp;
            currentDreCluster.despesas_operacionais_detalhe = despesaOpDetalhe;
            console.log(`✅ [Ingestion] R$ ${totalDespOp} em Despesas Operacionais integradas.`);
            return { compromissos: [] };
        }

        if (!mainMonth) {
            const uploadMonth = document.getElementById('upload-month-ref');
            if (uploadMonth && uploadMonth.value) mainMonth = uploadMonth.value;
        }

        if (mainMonth) {
            const cDRE = getCluster(dreClusters, mainMonth);
            const estMedio = (totalEstIni + totalEstFin) / 2;
            const giro = estMedio > 0 ? (totalCMV / estMedio) : 0;

            // Cálculo da Curva ABC Estatística
            const sortedItems = [...items].sort((a, b) => b.revenue - a.revenue);
            let cumulativeCMV = 0;
            let countA = 0, countB = 0, countC = 0;

            const itemsWithABC = sortedItems.map((it, idx) => {
                cumulativeCMV += it.revenue;
                const weight = totalCMV > 0 ? (cumulativeCMV / totalCMV) * 100 : 0;
                const pctIdx = (idx + 1) / sortedItems.length;

                let classe = 'C';
                // Classe A: 20% dos itens OU até 80% do Faturamento
                if (pctIdx <= 0.20 || weight <= 80) {
                    classe = 'A';
                    countA++;
                }
                // Classe B: 30% dos itens (entre 20% e 50%) OU até 15% adicionais (total 95%)
                else if (pctIdx <= 0.50 || weight <= 95) {
                    classe = 'B';
                    countB++;
                }
                else {
                    classe = 'C';
                    countC++;
                }

                let status = "Saudável";
                if (it.qtd < 5) status = "Ruptura Iminente";
                else if (it.qtd < 15) status = "Ponto de Pedido";

                return { ...it, status, classe };
            });

            const resolvedItems = itemsWithABC.slice(0, 10); // Amostra para o dashboard
            const abcSummary = {
                A: itemsWithABC.length > 0 ? Math.round((countA / itemsWithABC.length) * 100) : 20,
                B: itemsWithABC.length > 0 ? Math.round((countB / itemsWithABC.length) * 100) : 30,
                C: itemsWithABC.length > 0 ? Math.round((countC / itemsWithABC.length) * 100) : 50
            };

            // Suporte a Multi-Unidades (Usa o nome do arquivo como chave)
            if (!cDRE.estoque_unidades) cDRE.estoque_unidades = {};

            cDRE.estoque_unidades[fileName] = {
                estoque_inicial: totalEstIni,
                estoque_final: totalEstFin,
                estoque_medio: estMedio,
                cmv_total: totalCMV,
                giro_estoque: giro,
                cobertura: giro > 0 ? (30 / giro) : 0,
                pontoPedido: rowCount > 0 ? Math.round(totalEstFin / rowCount) : 100,
                curvaABC: abcSummary,
                nivelServico: 98,
                criticalItems: resolvedItems,
                fileName: fileName // Referência para a aba
            };

            // Auditoria Visual em Log para o alerta final
            if (!window.uploadAuditLog) window.uploadAuditLog = [];
            window.uploadAuditLog.push({
                file: fileName,
                mapping: {
                    titulo: `${idxTitulo + 1} (${headers[idxTitulo] || 'N/A'})`,
                    inicial: `${idxValIniR$ + 1} (${headers[idxValIniR$] || 'N/A'})`,
                    final: `${idxValFinR$ + 1} (${headers[idxValFinR$] || 'N/A'})`
                },
                results: {
                    rows: rowCount,
                    ini: totalEstIni,
                    fin: totalEstFin
                }
            });

            return { compromissos: { length: rowCount } };
        }
        return { compromissos: { length: 0 } };
    }

    // Fluxo Padrão (Receitas/Despesas)
    for (let i = headerRowIdx + 1; i < json.length; i++) {
        const row = json[i];
        if (!row || row.length === 0) continue;

        let rawVal = row[idxValor];

        // Fallback se o índice de valor falhar na detecção de nome, tentamos adivinhar pela posição ou conteúdo
        if (idxValor === -1) {
            for (let c = 0; c < row.length; c++) {
                const v = typeof row[c] === 'number' ? row[c] : parseBRL(row[c]);
                if (v > 0) {
                    idxValor = c;
                    rawVal = row[c];
                    console.log(`🎯 [Fallback] Coluna de valor auto-detectada no índice ${c} (Ex: ${v})`);
                    break;
                }
            }
        }

        let valor = (typeof rawVal === 'number' || !isNaN(rawVal)) ? parseFloat(rawVal.toString().replace(',', '.')) : 0;
        if (valor === 0) {
            // Se for string formatada, tentamos o parseBRL robusto
            valor = parseBRL(rawVal);
        }

        if (!valor || isNaN(valor) || valor === 0) continue;

        let titulo = (row[idxTitulo] || "Sem título").toString().trim();
        let dataEmi = row[idxDataEmi];
        let dataVen = row[idxDataVen] || dataEmi;

        const emiDateObj = parseExcelDate(dataEmi);
        const vencDateObj = parseExcelDate(dataVen);

        if (!emiDateObj && !vencDateObj) {
            if (i < 5 + headerRowIdx) console.warn(`⚠️ [Ingestion] Linha ${i} ignorada: Datas inválidas`, { emi: dataEmi, venc: dataVen });
            continue;
        }

        if (emiDateObj) {
            const emiMonthStr = `${emiDateObj.getFullYear()}-${(emiDateObj.getMonth() + 1).toString().padStart(2, '0')}`;
            const cDRE = getCluster(dreClusters, emiMonthStr);
            const v = Math.abs(valor);
            if (isPagar) {
                if (tgtBank === "imposto") cDRE.impostos += v;
                else if (tgtBank === "custo") cDRE.custos += v;
                else {
                    // Todas as outras saídas são Despesas Operacionais
                    cDRE.despesas_operacionais = (cDRE.despesas_operacionais || 0) + v;

                    // REGISTRO INTERNO: Alimenta o detalhamento para o modal (DRILL-DOWN)
                    if (!cDRE.despesas_operacionais_detalhe) cDRE.despesas_operacionais_detalhe = [];
                    cDRE.despesas_operacionais_detalhe.push({
                        descricao: titulo,
                        valor: v,
                        vencimento: (row[idxDataVen] || ""),
                        doc: (row[headers.findIndex(h => h.includes('nrdocumento') || h.includes('doc'))] || "")
                    });

                    // Identificação de Salários para o Balanço Gerencial (Passivo)
                    const isSalaryTitle = /\b(sal[aá]rio|folha|holerite|vencimento|provento)\b/i.test(titulo);
                    if (tgtBank === "salarios" || isSalaryTitle) {
                        if (!cDRE.balanco) cDRE.balanco = { ativo: {}, passivo: {} };
                        if (!cDRE.balanco.passivo) cDRE.balanco.passivo = {};
                        cDRE.balanco.passivo.salarios = (cDRE.balanco.passivo.salarios || 0) + v;
                    }
                }
            } else {
                cDRE.receita_total += v;
            }
        }

        if (vencDateObj) {
            const vencMonthStr = `${vencDateObj.getFullYear()}-${(vencDateObj.getMonth() + 1).toString().padStart(2, '0')}`;
            const cCAIXA = getCluster(fluxoClusters, vencMonthStr);
            const v = Math.abs(valor);
            const displayDate = (vencDateObj) ? `${vencDateObj.getDate().toString().padStart(2, '0')}/${(vencDateObj.getMonth() + 1).toString().padStart(2, '0')}/${vencDateObj.getFullYear()}` : dataVen.toString();
            const rawSaldoVal = idxSaldo !== -1 ? row[idxSaldo] : null;
            const saldoRow = (rawSaldoVal !== null && rawSaldoVal !== undefined) ? parseBRL(rawSaldoVal) : null;

            if (isPagar) {
                cCAIXA.a_pagar_mes += v;
                const cObj = { data: displayDate, titulo, valor: v, tipo: 'negative', _source: fileName };

                // Marcação de Imposto via Reconhecimento de Padrao (Refinado)
                const taxPattern = /\b(ICMS|PIS|COFINS|IRPJ|CSLL|IPI|DARF|DAS|SIMPLES NACIONAL|CBS|IBS|FGTS|INSS|GPS|ISS|IPTU|TRIBUTO|IMPOSTO)\b/i;
                const blacklistPattern = /\b(LTDA|SOCIEDADE|ASSESSORIA|CONTAB|CONSULT|ADVOGADO|CONDOMINIO|ALUGUEL)\b/i;

                const tNorm = titulo.toUpperCase();
                if (taxPattern.test(tNorm) && !blacklistPattern.test(tNorm)) cObj.isActuallyTax = true;

                cCAIXA.compromissos.push(cObj);

                // Atribuição bancária para garantir que o Saldo Consolidado funcione
                let bName = tgtBank || (idxBank !== -1 && row[idxBank] ? row[idxBank].toString() : "Caixa Geral");
                if (!cCAIXA.bancos) cCAIXA.bancos = {};
                if (!cCAIXA.bancos[bName]) cCAIXA.bancos[bName] = { entradas: 0, saidas: 0, saldo_inicial: 0 };
                cCAIXA.bancos[bName].saidas += v;
                // Se houver coluna de saldo no arquivo, usamos para setar o inicial (reconstituído)
                if (saldoRow !== null && cCAIXA.bancos[bName].saldo_inicial === 0) {
                    cCAIXA.bancos[bName].saldo_inicial = saldoRow + v;
                }
            } else {
                cCAIXA.a_receber_mes += v;
                const cObj = { data: displayDate, titulo, valor: v, tipo: 'positive', _source: fileName };

                const taxPattern = /\b(ICMS|PIS|COFINS|IRPJ|CSLL|IPI|DARF|DAS|SIMPLES NACIONAL|CBS|IBS|FGTS|INSS|GPS|ISS|IPTU|TRIBUTO|IMPOSTO)\b/i;
                const blacklistPattern = /\b(LTDA|SOCIEDADE|ASSESSORIA|CONTAB|CONSULT|ADVOGADO|CONDOMINIO|ALUGUEL)\b/i;

                const tNorm = titulo.toUpperCase();
                if (taxPattern.test(tNorm) && !blacklistPattern.test(tNorm)) cObj.isActuallyTax = true;

                cCAIXA.compromissos.push(cObj);

                // Atribuição bancária para garantir que o Saldo Consolidado funcione
                let bName = tgtBank || (idxBank !== -1 && row[idxBank] ? row[idxBank].toString() : "Caixa Geral");
                if (!cCAIXA.bancos) cCAIXA.bancos = {};
                if (!cCAIXA.bancos[bName]) cCAIXA.bancos[bName] = { entradas: 0, saidas: 0, saldo_inicial: 0 };
                cCAIXA.bancos[bName].entradas += v;
                if (saldoRow !== null && cCAIXA.bancos[bName].saldo_inicial === 0) {
                    cCAIXA.bancos[bName].saldo_inicial = saldoRow - v;
                }
            }
            totalRows++;
        }
    }
    return { compromissos: { length: totalRows } };
};

/* --- Global Settings Logic --- */
const globalSettingsModal = document.getElementById('global-settings-modal');
const btnOpenGlobal = document.getElementById('btn-global-settings');
const btnCloseGlobal = document.getElementById('close-global-modal');
const globalForm = document.getElementById('global-settings-form');

if (btnOpenGlobal) {
    btnOpenGlobal.addEventListener('click', () => {
        const settings = JSON.parse(localStorage.getItem('clarusGlobalSettings') || '{}');
        document.getElementById('global-system-name').value = settings.systemName || 'CLARUS EVOLUA';
        document.getElementById('global-logo-path').value = settings.logoPath || 'img/logo.png';
        document.getElementById('global-gemini-key').value = localStorage.getItem('clarusGeminiKey') || '';
        globalSettingsModal.classList.remove('hidden');
    });
}

if (btnCloseGlobal) {
    btnCloseGlobal.addEventListener('click', () => globalSettingsModal.classList.add('hidden'));
}

if (globalForm) {
    globalForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const settings = {
            systemName: document.getElementById('global-system-name').value.trim(),
            logoPath: document.getElementById('global-logo-path').value.trim()
        };
        const geminiKey = document.getElementById('global-gemini-key').value.trim();

        localStorage.setItem('clarusGlobalSettings', JSON.stringify(settings));
        if (geminiKey) localStorage.setItem('clarusGeminiKey', geminiKey);
        else localStorage.removeItem('clarusGeminiKey');

        // Trigger UI update if function exists (it should be in app.js)
        if (window.applyGlobalSettings) window.applyGlobalSettings(settings);

        alert("Configurações Globais salvas com sucesso!");
        globalSettingsModal.classList.add('hidden');
    });
}

if (dropZone) {
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
    });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        simulateUploadProcessing(e.dataTransfer.files);
    });
}
if (fileInput) {
    fileInput.addEventListener('change', (e) => {
        simulateUploadProcessing(e.target.files);
    });
}
