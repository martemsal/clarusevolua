// Helper Global de Formatação Monetária
window.formatBRL = (val) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
};

window.toggleTheme = () => {
    document.body.classList.toggle('light-theme');
    const isLight = document.body.classList.contains('light-theme');
    localStorage.setItem('clarusTheme', isLight ? 'light' : 'dark');
};

// Initial theme apply
const savedTheme = localStorage.getItem('clarusTheme');
if (savedTheme === 'light') {
    document.body.classList.add('light-theme');
}

// Global User ID Sync (Fix for F5 Zeroing)
window.currentUserId = localStorage.getItem('clarusAdminViewingId') || localStorage.getItem('clarusSessionId');

window.fillMonthSelectors = () => {
    const periodSelect = document.getElementById('period-select');
    const uploadSelect = document.getElementById('upload-month-ref');
    if (!periodSelect && !uploadSelect) return;

    const now = new Date();
    // THE USER SAID 2026 IN THE SCREENSHOT (Mês Atual Julho 2026)
    // Actually our system year was set to 2026 based on previous prompts?
    // Let's use real year from system clock but the user instructions say March.
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    const optsHtml = [];
    const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

    // Fill months from current month backwards (User wants 'até março' if it's March)
    for (let m = currentMonth; m >= 1; m--) {
        const val = `${currentYear}-${m.toString().padStart(2, '0')}`;
        let label = `${monthNames[m - 1]} ${currentYear}`;
        if (m === currentMonth) label = `Mês Atual (${monthNames[m - 1]} ${currentYear})`;
        if (m === currentMonth - 1) label = `Mês Anterior (${monthNames[m - 1]} ${currentYear})`;

        optsHtml.push(`<option value="${val}">${label}</option>`);
    }

    if (periodSelect) {
        periodSelect.innerHTML = optsHtml.join('');
        const active = localStorage.getItem('clarusActiveMonth');
        if (active && Array.from(periodSelect.options).some(o => o.value === active)) {
            periodSelect.value = active;
        } else {
            periodSelect.value = `${currentYear}-${currentMonth.toString().padStart(2, '0')}`;
            localStorage.setItem('clarusActiveMonth', periodSelect.value);
        }
    }

    if (uploadSelect) {
        uploadSelect.innerHTML = optsHtml.join('');
        uploadSelect.value = `${currentYear}-${currentMonth.toString().padStart(2, '0')}`;
    }
};

window.applyGlobalSettings = (settings) => {
    if (!settings) return;
    const { systemName, logoPath } = settings;

    // Update Page Title
    if (systemName) document.title = `${systemName} - Painel de Gestão`;

    // Update Brand Logos
    const logos = document.querySelectorAll('.app-logo');
    logos.forEach(img => {
        if (logoPath) img.src = logoPath;
        if (systemName) img.alt = systemName;
    });

    // Update Brand Text (H1/H4)
    if (systemName) {
        const brandH1 = document.querySelector('.login-brand h1');
        if (brandH1) {
            const words = systemName.split(' ');
            brandH1.innerHTML = words[0] + (words[1] ? ` <span>${words.slice(1).join(' ')}</span>` : '');
        }
        const adminBrand = document.querySelector('.sidebar-logo h4');
        if (adminBrand) adminBrand.textContent = systemName;
    }
};

// Main Application Logic
document.addEventListener('DOMContentLoaded', async () => {
    // Apply Global Settings
    const savedGlobal = JSON.parse(localStorage.getItem('clarusGlobalSettings') || '{}');
    if (savedGlobal.systemName || savedGlobal.logoPath) window.applyGlobalSettings(savedGlobal);

    // SUPABASE SYNC DOWN: Fetch latest companies and data before routing
    if (window.db && window.db.getCompanies) {
        try {
            console.log("🔄 Iniciando sincronização com o Supabase...");
            const cloudCompanies = await window.db.getCompanies() || [];
            
            // Mapear dados do banco para o formato esperado pelo front
            const formattedCompanies = cloudCompanies.map(c => ({
                id: c.id,
                name: c.name,
                password: c.password,
                level: c.level,
                capitalSocial: c.capital_social,
                modules: c.modules || [],
                banks: c.banks || [],
                files: c.files || []
            }));
            
            localStorage.setItem('clarusCompanies', JSON.stringify(formattedCompanies));
            console.log(`✅ Sincronização de Clientes concluída. (${formattedCompanies.length} empresas)`);
        } catch (e) {
            console.error("❌ Falha ao sincronizar com Supabase (operando offline):", e);
        }
    }

    // Login Handling
    const loginForm = document.getElementById('login-form');
    const loginScreen = document.getElementById('login-screen');
    const appScreen = document.getElementById('app-screen');
    const adminScreen = document.getElementById('admin-screen');
    const logoutBtn = document.getElementById('logout-btn');
    const companyIdInput = document.getElementById('company-id');
    const displayCompanyName = document.getElementById('display-company-name');

    // Auto-Re-Login Persistence (Move this to the start to avoid flicker)
    const savedSession = localStorage.getItem('clarusSessionId');
    const isAdminViewingApp = localStorage.getItem('clarusAdminIsViewingApp') === 'true';

    if (savedSession === 'admin') {
        if (isAdminViewingApp) {
            // Admin was viewing a client's dashboard
            const viewingId = localStorage.getItem('clarusAdminViewingId');
            const companies = JSON.parse(localStorage.getItem('clarusCompanies') || '[]');
            const client = companies.find(c => c.id === viewingId);
            if (client) {
                displayCompanyName.textContent = client.name;
                loginScreen.classList.add('hidden');
                appScreen.classList.remove('hidden');
                appScreen.classList.add('view-active');
                if (window.refreshDashboardsWithData) window.refreshDashboardsWithData();
            } else {
                loginScreen.classList.add('hidden');
                adminScreen.classList.remove('hidden');
                adminScreen.classList.add('view-active');
                if (window.initAdminPanel) window.initAdminPanel();
            }
        } else {
            loginScreen.classList.add('hidden');
            adminScreen.classList.remove('hidden');
            adminScreen.classList.add('view-active');
            if (window.initAdminPanel) {
                window.initAdminPanel();
                const viewingId = localStorage.getItem('clarusAdminViewingId');
                if (viewingId && window.openAdminModal) {
                    setTimeout(() => window.openAdminModal(viewingId), 100);
                }
            }
        }
    } else if (savedSession) {
        // Client session
        const companies = JSON.parse(localStorage.getItem('clarusCompanies') || '[]');
        const client = companies.find(c => c.id === savedSession);
        if (client) {
            window.currentUserId = savedSession;
            window.currentUserModules = client.modules || [];
            displayCompanyName.textContent = client.name;
            loginScreen.classList.add('hidden');
            appScreen.classList.remove('hidden');
            appScreen.classList.add('view-active');
            if (window.refreshDashboardsWithData) window.refreshDashboardsWithData();
            if (window.initNotifications) window.initNotifications();
        } else {
            loginScreen.classList.remove('hidden');
            loginScreen.classList.add('view-active');
        }
    } else {
        loginScreen.classList.remove('hidden');
        loginScreen.classList.add('view-active');
    }

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Mock authentication
        const id = companyIdInput.value;
        const pwd = document.getElementById('password').value;
        const submitBtn = loginForm.querySelector('button');

        // Add loading state
        submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Conectando...';
        submitBtn.style.opacity = '0.8';
        submitBtn.disabled = true;

        await new Promise(r => setTimeout(r, 500));

        if (id === "admin") {
            if (pwd !== "admin" && pwd !== "123456") {
                submitBtn.innerHTML = 'Acessar Painel';
                submitBtn.style.opacity = '1';
                submitBtn.disabled = false;
                alert("Senha de administrador incorreta.");
                return;
            }
            window.currentUserId = "admin";
            localStorage.setItem('clarusSessionId', 'admin');
            // Route to Admin Panel
            loginScreen.classList.remove('view-active');
            setTimeout(() => {
                loginScreen.classList.add('hidden');
                const adScreen = document.getElementById('admin-screen');
                adScreen.classList.remove('hidden');
                void adScreen.offsetWidth;
                adScreen.classList.add('view-active');
                if (window.initAdminPanel) window.initAdminPanel();
            }, 500);
        } else {
            let companies = JSON.parse(localStorage.getItem('clarusCompanies') || '[]');
            const client = companies.find(c => c.id === id);

            if (client) {
                // Check password if it's set in the client object, otherwise allow (fallback for old accounts)
                if (client.password && client.password !== pwd) {
                    submitBtn.innerHTML = 'Acessar Painel';
                    submitBtn.style.opacity = '1';
                    submitBtn.disabled = false;
                    alert("Senha incorreta. Tente novamente.");
                    return;
                }

                window.currentUserId = id;
                window.currentUserModules = client.modules || [];
                localStorage.setItem('clarusSessionId', id);

                // SUPABASE SYNC DOWN: Financial Data
                if (window.db && window.db.getAllFinancialData) {
                    try {
                        const allData = await window.db.getAllFinancialData(id);
                        allData.forEach(record => {
                            const prefix = record.data_type === 'dre' ? 'clarusData_' : 'clarusDataVenc_';
                            const key = `${prefix}${id}_${record.month}`;
                            localStorage.setItem(key, JSON.stringify(record.payload));
                        });
                        console.log("✅ Dados financeiros sincronizados.");
                    } catch (e) {
                        console.error("Cloud Sync Data Error:", e);
                    }
                }

                // Route to Normal Dashboard
                displayCompanyName.textContent = client.name;
                if (window.currentUserId === 'admin' || localStorage.getItem('clarusSessionId') === 'admin') {
                    localStorage.setItem('clarusAdminViewingId', id);
                    localStorage.setItem('clarusAdminIsViewingApp', 'true');
                }
                loginScreen.classList.remove('view-active');
                setTimeout(() => {
                    loginScreen.classList.add('hidden');
                    appScreen.classList.remove('hidden');
                    void appScreen.offsetWidth;
                    appScreen.classList.add('view-active');
                    if (window.refreshDashboardsWithData) window.refreshDashboardsWithData();
                    if (window.initNotifications) window.initNotifications();
                }, 500);
            } else {
                submitBtn.innerHTML = 'Acessar Painel';
                submitBtn.style.opacity = '1';
                submitBtn.disabled = false;
                alert("Cliente não encontrado. Verifique o ID digitado. (Para painel gerencial use: admin)");
            }
        }

        // Reset button for fail state (success routes away)
        submitBtn.innerHTML = 'Acessar Painel';
        submitBtn.style.opacity = '1';
        submitBtn.disabled = false;
    });

    const forgotPwdLink = document.getElementById('forgot-password-link');
    if (forgotPwdLink) {
        forgotPwdLink.addEventListener('click', (e) => {
            e.preventDefault();
            const id = companyIdInput.value;
            if (!id) {
                alert("Por favor, preencha o campo 'ID do Cliente' primeiro para que possamos localizar seu e-mail.");
                return;
            }
            alert(`Um e-mail com as instruções para redefinição de senha foi enviado para o contato cadastrado do cliente ID: ${id}.`);
        });
    }


    // Logout Handling
    const handleLogout = () => {
        localStorage.removeItem('clarusSessionId');
        localStorage.removeItem('clarusAdminViewingId');
        localStorage.removeItem('clarusAdminLocked');
        localStorage.removeItem('clarusAdminIsViewingApp');

        appScreen.classList.remove('view-active');
        document.getElementById('admin-screen').classList.remove('view-active');

        setTimeout(() => {
            appScreen.classList.add('hidden');
            document.getElementById('admin-screen').classList.add('hidden');
            loginScreen.classList.remove('hidden');
            companyIdInput.value = '';
            document.getElementById('password').value = '';

            void loginScreen.offsetWidth;
            loginScreen.classList.add('view-active');
        }, 500);
    };

    if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);
    const adminLogoutBtn = document.getElementById('admin-logout-btn');
    if (adminLogoutBtn) adminLogoutBtn.addEventListener('click', handleLogout);

    // Dynamic Months
    window.fillMonthSelectors();

    // Navigation Handling
    const navItems = document.querySelectorAll('.nav-item');
    const dashboardViews = document.querySelectorAll('.dashboard-view');
    const viewTitle = document.getElementById('current-view-title');
    const viewSubtitle = document.getElementById('current-view-subtitle');

    const viewMeta = {
        'saude-financeira': { title: 'Saúde Financeira', subtitle: 'Visão geral do negócio e DRE Gerencial' },
        'fluxo-caixa': { title: 'Fluxo de Caixa', subtitle: 'Entradas, saídas e projeção futura' },
        'bancos': { title: 'Contas Bancárias', subtitle: 'Saldos, entradas e saídas consolidadas' },
        'rentabilidade': { title: 'Rentabilidade', subtitle: 'Margens por produto e cliente' },
        'comercial': { title: 'Comercial', subtitle: 'Desempenho de vendas e equipe' },
        'estoque': { title: 'Controle de Estoque', subtitle: 'Giro, cobertura e valor investido' },
        'crescimento': { title: 'Crescimento Empresarial', subtitle: 'Evolução e eficiência operacional' },
        'balanco-gerencial': { title: 'Balanço Gerencial', subtitle: 'Patrimônio, Ativos e Passivos' },
        'emprestimos': { title: 'Empréstimos e Financiamentos', subtitle: 'Gestão de passivos e fluxos de amortização' },
        'indicadores': { title: 'Indicadores de Gestão', subtitle: 'Principais KPIs para monitoramento estratégico' }
    };

    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();

            // Update active state on nav
            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');

            const targetId = item.getAttribute('data-target');

            // Update Headers
            viewTitle.textContent = viewMeta[targetId].title;
            viewSubtitle.textContent = viewMeta[targetId].subtitle;

            // Switch views
            dashboardViews.forEach(view => {
                if (view.id === `view-${targetId}`) {
                    view.classList.remove('hidden');
                    // Initialize specific dashboard dynamically on every click to prevent stale data
                    const initFnName = 'init' + targetId.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join('');
                    if (window[initFnName]) {
                        window[initFnName]();
                    }

                    // Apply Dynamic Locks based on Admin Settings
                    const moduleMap = {
                        'rentabilidade': 'Rentabilidade e Curva ABC',
                        'comercial': 'Gestão Comercial',
                        'crescimento': 'Crescimento Empresarial',
                        'estoque': 'Controle de Estoque'
                    };

                    const requiredModule = moduleMap[targetId];
                    if (window.currentUserId !== "admin" && requiredModule && window.currentUserModules && !window.currentUserModules.includes(requiredModule)) {
                        if (!view.querySelector('.locked-module-overlay')) {
                            const overlay = document.createElement('div');
                            overlay.className = 'locked-module-overlay';
                            overlay.innerHTML = `
                                <div class="locked-module-content">
                                    <h3><i class="fa-solid fa-lock"></i> Módulo Bloqueado</h3>
                                    <p>Acesse indicadores profundos de ${viewMeta[targetId].title} ativando este pacote de expansão com a CLARUS.</p>
                                    <button class="btn-primary" onclick="alert('Redirecionar para WhatsApp do consultor para fechar UPGRADE')">Fazer Upgrade</button>
                                </div>
                            `;
                            view.style.position = 'relative';

                            // Blur specific content inside grid-containers
                            Array.from(view.querySelectorAll('.grid-container')).forEach(child => {
                                child.style.filter = 'blur(8px)';
                                child.style.pointerEvents = 'none';
                                child.style.userSelect = 'none';
                                child.style.opacity = '0.6';
                            });

                            view.appendChild(overlay);
                        }
                    } else {
                        // Se o cliente tem acesso, mas o lock antigo ficou no HTML injetado, tira
                        const lOverlay = view.querySelector('.locked-module-overlay');
                        if (lOverlay) {
                            lOverlay.remove();
                            Array.from(view.querySelectorAll('.grid-container')).forEach(child => {
                                child.style.filter = 'none';
                                child.style.pointerEvents = 'auto';
                                child.style.userSelect = 'auto';
                                child.style.opacity = '1';
                            });
                        }
                    }
                } else {
                    view.classList.add('hidden');
                }
            });
        });
    });

    // Handle Period Selection globally
    document.getElementById('period-select').addEventListener('change', (e) => {
        const newMonth = e.target.value;
        localStorage.setItem('clarusActiveMonth', newMonth);
        if (window.refreshDashboardsWithData) {
            window.refreshDashboardsWithData();
        }
    });

    // Listen to localStorage changes
    window.addEventListener('storage', (e) => {
        if (e.key === 'clarusDashboardData' || e.key === 'clarusCompanies' || e.key === 'clarusActiveMonth' || (e.key && e.key.startsWith('clarusData_'))) {
            if (window.refreshDashboardsWithData) window.refreshDashboardsWithData();
        }
    });

    // (Removed duplicate persistence logic from here as it was moved up)
});

// Notifications Logic - Client Side
window.initNotifications = () => {
    const trigger = document.getElementById('notification-trigger');
    const dropdown = document.getElementById('notification-dropdown');
    const badge = document.getElementById('notification-badge');
    const list = document.getElementById('notification-list');

    if (!trigger) return;

    const clientId = localStorage.getItem('clarusSessionId');
    if (!clientId || clientId === 'admin') {
        trigger.style.display = 'none';
        return;
    } else {
        trigger.style.display = 'block';
    }

    const refreshNotifs = () => {
        const messages = JSON.parse(localStorage.getItem('clarusNotifications') || '[]');
        const filtered = messages.filter(m => m.clientId === clientId && !m.hiddenForUser);
        const unreadCount = filtered.filter(m => !m.read).length;

        if (unreadCount > 0) {
            badge.textContent = unreadCount;
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }

        if (filtered.length === 0) {
            list.innerHTML = '<p style="padding: 1.5rem; color: var(--text-secondary); font-size: 0.8rem; text-align: center; font-style: italic;">Nenhuma notificação por aqui.</p>';
            return;
        }

        list.innerHTML = filtered.reverse().map(m => `
            <div class="notif-item ${m.read ? '' : 'unread'}" data-id="${m.id}" style="cursor:pointer; position:relative;">
                <button class="btn-notif-delete" onclick="event.stopPropagation(); window.deleteNotification(${m.id})"><i class="fa-solid fa-trash-can"></i></button>
                <span class="notif-title"><i class="fa-solid fa-circle-info" style="color:var(--accent-gold); margin-right:5px;"></i> Comunicado Oficial</span>
                <span class="notif-text">${m.text.length > 50 ? m.text.substring(0, 50) + '...' : m.text}</span>
                <span class="notif-time">${new Date(m.timestamp).toLocaleString()}</span>
            </div>
        `).join('');

        // Attach read and push click
        document.querySelectorAll('.notif-item').forEach(item => {
            item.onclick = (e) => {
                e.stopPropagation();
                const id = parseInt(item.getAttribute('data-id'));
                const msg = messages.find(m => m.id === id);
                if (msg) window.openNotificationPush(msg);
            };
        });
    };

    trigger.onclick = (e) => {
        e.stopPropagation();
        if (dropdown) dropdown.classList.toggle('hidden');
        if (dropdown && !dropdown.classList.contains('hidden')) refreshNotifs();
    };

    document.addEventListener('click', () => {
        const dd = document.getElementById('notification-dropdown');
        if (dd) dd.classList.add('hidden');
    });

    // Initial check
    refreshNotifs();
};

window.openNotificationPush = (notif) => {
    const modal = document.getElementById('notification-push-modal');
    const content = document.getElementById('notif-push-content');
    if (!modal || !content) return;

    content.innerHTML = `
        <div style="margin-bottom:1rem; color:var(--text-secondary); font-size:0.75rem;">
            <i class="fa-solid fa-calendar-alt"></i> Recebido em: ${new Date(notif.timestamp).toLocaleString()}
        </div>
        <div style="font-size:1.05rem; line-height:1.6; color:var(--text-primary);">
            ${notif.text}
        </div>
    `;

    modal.classList.remove('hidden');

    // Close and Mark as Read
    const closeBtn = document.getElementById('close-notif-modal');
    const okBtn = document.getElementById('btn-notif-modal-ok');

    const closePush = () => {
        modal.classList.add('hidden');
        window.markAsRead(notif.id);
    };

    closeBtn.onclick = closePush;
    okBtn.onclick = closePush;
};

window.markAsRead = (id) => {
    const messages = JSON.parse(localStorage.getItem('clarusNotifications') || '[]');
    const msg = messages.find(m => m.id === id);
    if (msg && !msg.read) {
        msg.read = true;
        localStorage.setItem('clarusNotifications', JSON.stringify(messages));
        window.initNotifications();
    }
};

window.deleteNotification = (id) => {
    // Only Exclude for Customer View (Soft Delete)
    const messages = JSON.parse(localStorage.getItem('clarusNotifications') || '[]');
    const msg = messages.find(m => m.id === id);
    if (msg) {
        msg.hiddenForUser = true;
        localStorage.setItem('clarusNotifications', JSON.stringify(messages));
        window.initNotifications();
    }
};
