/**
 * Módulo de Empréstimos e Financiamentos
 */
window.initEmprestimos = () => {
    const container = document.getElementById('view-emprestimos');
    if (!container) return;

    const companyData = JSON.parse(localStorage.getItem('clarusCompanies') || '[]');
    const viewingId = localStorage.getItem('clarusAdminViewingId') || localStorage.getItem('clarusCompanyId');
    const comp = companyData.find(c => c.id === viewingId);

    if (!comp) {
        container.innerHTML = '<div class="card"><h3>Acesso negado ou empresa não encontrada.</h3></div>';
        return;
    }

    const currentMonth = localStorage.getItem('clarusActiveMonth') || new Date().toISOString().substring(0, 7);
    const loans = comp.loans || [];

    let html = `
        <div class="dashboard-header">
            <div>
                <h2>Empréstimos e Financiamentos</h2>
                <p class="subtitle">Gestão de passivos financeiros e parcelamentos</p>
            </div>
            <div class="header-stats">
                <div class="stat-item">
                    <span class="label">Contratos Ativos</span>
                    <span class="value">${loans.length}</span>
                </div>
            </div>
        </div>

        <div class="grid-container grid-cols-3" id="loans-grid">
    `;

    if (loans.length === 0) {
        html += `
            <div class="card" style="grid-column: span 3; text-align: center; padding: 3rem;">
                <i class="fa-solid fa-file-invoice-dollar" style="font-size: 3rem; color: var(--text-secondary); margin-bottom: 1rem; opacity: 0.3;"></i>
                <h3 style="color: var(--text-secondary);">Nenhum contrato de empréstimo ou financiamento cadastrado.</h3>
                <p style="color: var(--text-tertiary); font-size: 0.9rem;">Consulte seu consultor para registrar os passivos da empresa.</p>
            </div>
        `;
    } else {
        loans.forEach(loan => {
            // Calcular qual a parcela atual com base no mês selecionado
            const firstDue = new Date(loan.firstDue + 'T12:00:00');
            const selectedMonthDate = new Date(currentMonth + '-01T12:00:00');

            // Diferença em meses
            let monthsDiff = (selectedMonthDate.getFullYear() - firstDue.getFullYear()) * 12 + (selectedMonthDate.getMonth() - firstDue.getMonth());
            let currentInstallment = monthsDiff + 1;

            let statusBadge = '';
            if (currentInstallment < 1) {
                statusBadge = '<span class="badge" style="background: var(--bg-dark); color: var(--text-secondary);">Carencia / Futuro</span>';
                currentInstallment = 0;
            } else if (currentInstallment > parseInt(loan.installmentsCount)) {
                statusBadge = '<span class="badge" style="background: var(--status-success); color: white;">Finalizado</span>';
                currentInstallment = loan.installmentsCount;
            } else {
                statusBadge = `<span class="badge" style="background: rgba(251, 191, 36, 0.2); color: #fbbf24;">Em Aberto</span>`;
            }

            html += `
                <div class="card bank-card">
                    <div class="card-header">
                        <div style="display: flex; flex-direction: column;">
                            <span class="bank-name">${loan.bank}</span>
                            <span style="font-size: 0.7rem; color: var(--text-secondary);">Contrato: ${loan.contract}</span>
                        </div>
                        <i class="fa-solid fa-file-invoice-dollar accent"></i>
                    </div>
                    <div class="bank-balance">
                        <span class="label">Parcela Atual</span>
                        <span class="value">${currentInstallment.toString().padStart(3, '0')} / ${parseInt(loan.installmentsCount).toString().padStart(3, '0')}</span>
                    </div>
                    <div class="bank-info" style="margin-top: 1rem; border-top: 1px solid var(--border-color); padding-top: 1rem;">
                        <div class="info-row">
                            <span>Valor da Parcela</span>
                            <span style="color: var(--status-danger); font-weight: 700;">R$ ${parseFloat(loan.installmentValue).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                        </div>
                        <div class="info-row">
                            <span>Total Contraído</span>
                            <span>R$ ${parseFloat(loan.totalAmount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                        </div>
                        <div style="margin-top: 10px;">
                            ${statusBadge}
                        </div>
                    </div>
                </div>
            `;
        });
    }

    html += `</div>`;
    container.innerHTML = html;
};
