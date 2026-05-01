/**
 * Dashboard de Controle de Estoque
 */
window.initEstoque = () => {
    try {
        const viewingId = localStorage.getItem('clarusAdminViewingId') || localStorage.getItem('clarusSessionId') || '123';
        const activeMonth = localStorage.getItem('clarusActiveMonth') || '2026-03';

        const rawData = localStorage.getItem(`clarusDataVenc_${viewingId}_${activeMonth}`);
        const data = rawData ? JSON.parse(rawData) : null;

        const rawDRE = localStorage.getItem(`clarusData_${viewingId}_${activeMonth}`);
        const dre = rawDRE ? JSON.parse(rawDRE) : null;

        const unidades = (dre && dre.estoque_unidades) ? dre.estoque_unidades : {};
        const unitKeys = Object.keys(unidades);

        // Reset de Estado se a unidade atual sumiu
        if (window.currentEstoqueUnit && window.currentEstoqueUnit !== "consolidado" && !unidades[window.currentEstoqueUnit]) {
            window.currentEstoqueUnit = "consolidado";
        }

        // Seletor de Unidade Ativa (Estado local)
        if (!window.currentEstoqueUnit || (window.currentEstoqueUnit === "consolidado" && unitKeys.length === 0)) {
            window.currentEstoqueUnit = unitKeys.length > 0 ? "consolidado" : null;
        }

        let inventorySource = null;

        if (window.currentEstoqueUnit === "consolidado" && unitKeys.length > 0) {
            // Lógica de Consolidação
            inventorySource = {
                estoque_inicial: 0,
                estoque_final: 0,
                cmv_total: 0,
                estoque_medio: 0,
                criticalItems: [],
                giro_estoque: 0,
                cobertura: 0,
                pontoPedido: 0,
                curvaABC: { A: 20, B: 30, C: 50 },
                nivelServico: 0
            };

            unitKeys.forEach(k => {
                const u = unidades[k];
                inventorySource.estoque_inicial += (u.estoque_inicial || 0);
                inventorySource.estoque_final += (u.estoque_final || 0);
                inventorySource.cmv_total += (u.cmv_total || 0);
                inventorySource.criticalItems.push(...(u.criticalItems || []));
                inventorySource.nivelServico += (u.nivelServico || 0);
            });

            inventorySource.estoque_medio = (inventorySource.estoque_inicial + inventorySource.estoque_final) / 2;
            inventorySource.giro_estoque = inventorySource.cmv_total / (inventorySource.estoque_medio || 1);
            inventorySource.cobertura = inventorySource.giro_estoque > 0 ? (30 / inventorySource.giro_estoque) : 0;
            inventorySource.nivelServico = inventorySource.nivelServico / (unitKeys.length || 1);
            inventorySource.pontoPedido = inventorySource.estoque_final / 10;
            inventorySource.criticalItems = inventorySource.criticalItems.sort((a, b) => b.cmvUnd - a.cmvUnd).slice(0, 8);
        } else if (window.currentEstoqueUnit && unidades[window.currentEstoqueUnit]) {
            inventorySource = unidades[window.currentEstoqueUnit];
        } else {
            // Fallback para legado ou vazio (Importante para compatibilidade)
            inventorySource = (dre && dre.estoque_data) ? dre.estoque_data :
                ((data && data.estoque_data) ? data.estoque_data : (unitKeys.length > 0 ? unidades[unitKeys[0]] : null));
        }

        const hasRealData = !!inventorySource;

        const finalData = {
            giro_estoque: 0,
            cobertura: 0,
            nivelServico: 98,
            pontoPedido: 0,
            curvaABC: { A: 0, B: 0, C: 0 },
            estoque_medio: 0,
            estoque_inicial: 0,
            estoque_final: 0,
            cmv_total: 0,
            criticalItems: [],
            ...inventorySource
        };

        // Deep merge protection for objects
        if (inventorySource && inventorySource.curvaABC) {
            finalData.curvaABC = { ...finalData.curvaABC, ...inventorySource.curvaABC };
        }

        const container = document.getElementById('view-estoque');
        if (!container) return;

        const fmtBRL = (v) => Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const fmtNum = (v) => Number(v || 0).toLocaleString('pt-BR');

        // Renderização do Seletor de Unidades
        let selectorHtml = '';
        if (unitKeys.length > 1) {
            selectorHtml = `
                <div class="unit-selector-container" style="display: flex; gap: 10px; margin-bottom: 1.5rem; background: rgba(0,0,0,0.2); padding: 8px; border-radius: 12px; border: 1px solid var(--border-color);">
                    <button onclick="window.currentEstoqueUnit='consolidado'; initEstoque()" 
                            style="padding: 8px 16px; border-radius: 8px; border: none; font-size: 0.85rem; font-weight: 600; cursor: pointer; transition: all 0.3s;
                            ${window.currentEstoqueUnit === 'consolidado' ? 'background: var(--accent-blue); color: white;' : 'background: transparent; color: var(--text-secondary);'}">
                        <i class="fa-solid fa-layer-group"></i> Todas as Unidades
                    </button>
                    ${unitKeys.map(k => `
                        <button onclick="window.currentEstoqueUnit='${k}'; initEstoque()" 
                                style="padding: 8px 16px; border-radius: 8px; border: none; font-size: 0.85rem; font-weight: 600; cursor: pointer; transition: all 0.3s;
                                ${window.currentEstoqueUnit === k ? 'background: var(--accent-purple); color: white;' : 'background: transparent; color: var(--text-secondary);'}">
                            <i class="fa-solid fa-warehouse"></i> ${k.split('.')[0]}
                        </button>
                    `).join('')}
                </div>
            `;
        }

        container.innerHTML = `
            <div class="dashboard-container animate__animated animate__fadeIn">
                <div class="dashboard-header" style="margin-bottom: 1.5rem; display: flex; justify-content: space-between; align-items: start;">
                    <div>
                        <h2 class="dashboard-title text-3xl font-bold">Controle de Estoque <span style="font-size: 0.8rem; background: #2563eb; padding: 2px 8px; border-radius: 10px; vertical-align: middle; margin-left: 10px; color: white;">v1.5.4 - FUSÃO DE UNIDADES ATIVA</span></h2>
                        <p class="dashboard-subtitle text-gray-400">Giro, cobertura e valor investido</p>
                    </div>
                    ${!hasRealData ? `
                        <div class="badge badge-warning" style="padding: 10px 20px; font-size: 0.9rem; background: rgba(251,191,36,0.1); border: 1px solid #fbbf24; color: #fbbf24; border-radius: 8px;">
                            <i class="fa-solid fa-triangle-exclamation"></i> Aguardando Importação de Arquivo Excel (.xlsm)
                        </div>
                    ` : ''}
                </div>

                ${selectorHtml}

                <div class="grid-container grid-cols-3 gap-6">
                    <div class="card highlight-purple p-6" style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 12px;">
                        <div class="metric-header" style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 1rem;">
                            <span class="metric-title" style="color: var(--text-secondary); font-size: 0.9rem;">Giro de Estoque</span>
                            <div class="metric-icon purple"><i class="fa-solid fa-rotate"></i></div>
                        </div>
                        <div class="metric-value" style="font-size: 2.2rem; font-weight: 800; color: #fff;">${Number(finalData.giro_estoque || 0).toFixed(2)}x</div>
                        <div class="metric-trend" style="color: var(--text-secondary); font-size: 0.8rem;">CMV / Est. Médio</div>
                    </div>

                    <div class="card highlight-blue p-6" style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 12px;">
                        <div class="metric-header" style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 1rem;">
                            <span class="metric-title" style="color: var(--text-secondary); font-size: 0.9rem;">Estoque Médio</span>
                            <div class="metric-icon blue"><i class="fa-solid fa-boxes-stacked"></i></div>
                        </div>
                        <div class="metric-value" style="font-size: 2.2rem; font-weight: 800; color: #fff;">R$ ${fmtBRL(finalData.estoque_medio)}</div>
                        <div class="metric-trend" style="color: var(--text-secondary); font-size: 0.8rem;">(R$ ${fmtBRL(finalData.estoque_inicial)} + R$ ${fmtBRL(finalData.estoque_final)}) / 2</div>
                    </div>

                    <div class="card highlight-green p-6" style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 12px;">
                        <div class="metric-header" style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 1rem;">
                            <span class="metric-title" style="color: var(--text-secondary); font-size: 0.9rem;">CMV Total</span>
                            <div class="metric-icon green"><i class="fa-solid fa-hand-holding-dollar"></i></div>
                        </div>
                        <div class="metric-value" style="font-size: 2.2rem; font-weight: 800; color: #fff;">R$ ${fmtBRL(finalData.cmv_total)}</div>
                        <div class="metric-trend" style="color: var(--text-secondary); font-size: 0.8rem;">Custo Mercadoria</div>
                    </div>
                </div>

                <div class="grid-container grid-cols-3 gap-6" style="margin-top: 1.5rem;">
                    <div class="card p-5" style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 12px;">
                        <span style="color: var(--text-secondary); font-size: 0.8rem;"><i class="fa-solid fa-calendar-check" style="color: #3b82f6;"></i> Cobertura</span>
                        <div style="font-size: 1.5rem; font-weight: 700;">${Number(finalData.cobertura || 0).toFixed(0)} dias</div>
                    </div>
                    <div class="card p-5" style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 12px;">
                        <span style="color: var(--text-secondary); font-size: 0.8rem;"><i class="fa-solid fa-user-check" style="color: #22c55e;"></i> Nível de Serviço</span>
                        <div style="font-size: 1.5rem; font-weight: 700;">${Number(finalData.nivelServico || 0).toFixed(1)}%</div>
                    </div>
                    <div class="card p-5" style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 12px;">
                        <span style="color: var(--text-secondary); font-size: 0.8rem;"><i class="fa-solid fa-truck-fast" style="color: #f97316;"></i> Ponto de Pedido</span>
                        <div style="font-size: 1.5rem; font-weight: 700;">${fmtNum(finalData.pontoPedido)} un.</div>
                    </div>
                </div>

                <div class="grid-container grid-cols-2 gap-6" style="margin-top: 2rem;">
                    <div class="card p-6" style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 12px;">
                        <div class="card-header" style="display:flex; justify-content: space-between; margin-bottom: 1.5rem;">
                            <span class="card-title font-bold">Composição Curva ABC</span>
                            <i class="fa-solid fa-chart-pie" style="color: var(--accent-purple);"></i>
                        </div>
                        <div style="height: 40px; background: rgba(255,255,255,0.05); border-radius: 20px; display: flex; overflow: hidden; margin-bottom: 1rem;">
                            <div style="width: ${finalData.curvaABC.A}%; background: #a855f7; height: 100%; display: flex; align-items: center; justify-content: center; font-size: 0.7rem; font-weight: bold;">A: ${finalData.curvaABC.A || 20}%</div>
                            <div style="width: ${finalData.curvaABC.B}%; background: #3b82f6; height: 100%; display: flex; align-items: center; justify-content: center; font-size: 0.7rem; font-weight: bold;">B: ${finalData.curvaABC.B || 30}%</div>
                            <div style="width: ${finalData.curvaABC.C}%; background: #94a3b8; height: 100%; display: flex; align-items: center; justify-content: center; font-size: 0.7rem; font-weight: bold;">C: ${finalData.curvaABC.C || 50}%</div>
                        </div>
                    </div>

                    <div class="card p-0" style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 12px; overflow: hidden;">
                        <div class="card-header p-6" style="display: flex; justify-content: space-between; border-bottom: 1px solid var(--border-color);">
                            <span class="card-title font-bold">Monitoramento de Ruptura</span>
                        </div>
                        <table style="width: 100%; border-collapse: collapse;">
                            <thead style="background: rgba(255,255,255,0.02);">
                                <tr>
                                    <th style="text-align: left; padding: 12px 24px;">Produto</th>
                                    <th style="text-align: center; padding: 12px;">Classe</th>
                                    <th style="text-align: right; padding: 12px 24px;">Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${(finalData.criticalItems || []).map(it => `
                                    <tr style="border-bottom: 1px solid var(--border-color);">
                                        <td style="padding: 12px 24px; font-size: 0.8rem;">${it.name || 'Sem Nome'}</td>
                                        <td style="padding: 12px; text-align: center;"><span style="background: rgba(255,255,255,0.1); padding: 2px 8px; border-radius: 4px;">${it.classe || 'C'}</span></td>
                                        <td style="padding: 12px 24px; text-align: right;"><span class="${it.status === 'Saudável' ? 'text-green-500' : 'text-red-500'}">${it.status}</span></td>
                                    </tr>
                                `).join('')}
                                ${finalData.criticalItems.length === 0 ? '<tr><td colspan="3" style="padding: 2rem; text-align: center; opacity: 0.5;">Sem itens críticos.</td></tr>' : ''}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;
    } catch (err) {
        console.error("🚨 [Critical Error] Dashboard Estoque:", err);
        document.getElementById('view-estoque').innerHTML = `
            <div style="padding: 3rem; text-align: center; color: #ef4444; background: rgba(239,68,68,0.05); border-radius: 12px; border: 1px dashed #ef4444; margin: 2rem;">
                <i class="fa-solid fa-bug" style="font-size: 3rem; margin-bottom: 1rem;"></i>
                <h2 style="margin-bottom: 0.5rem;">Erro de Renderização</h2>
                <p style="color: var(--text-secondary); margin-bottom: 1.5rem;">Ocorreu um problema ao processar os dados de estoque.</p>
                <code style="display: block; padding: 1rem; background: #000; border-radius: 6px; font-size: 0.8rem; color: #fff; text-align: left;">${err.message}</code>
                <button onclick="location.reload()" style="margin-top: 1.5rem; padding: 10px 20px; background: #ef4444; color: #fff; border: none; border-radius: 6px; cursor: pointer;">Recarregar Sistema</button>
            </div>
        `;
    }
};
