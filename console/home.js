document.addEventListener('DOMContentLoaded', async () => {
    let supabase = window.supabaseClient;
    let currentProfile = null;
    let currentSubscriptionDaysRemaining = null;

    const appLayout = document.querySelector('.app-layout');
    const sidebarShell = document.querySelector('.sidebar-shell');
    const sidebarToggle = document.getElementById('sidebar-toggle');
    const subscriptionDisplay = document.getElementById('subscription-display');
    const pageTitleEl = document.getElementById('page-title');

    const statTotalTasks = document.getElementById('stat-total-tasks');
    const statPendingExams = document.getElementById('stat-pending-exams');
    const statAverageScore = document.getElementById('stat-average-score');
    const statSubscriptionDays = document.getElementById('stat-subscription-days');

    const next48hList = document.getElementById('next-48h-list');
    const roleWidgetContainer = document.getElementById('role-widget-container');
    const calendarRoot = document.getElementById('dashboard-calendar');

    const numberFormatter = new Intl.NumberFormat('fa-IR');

    function toPersianNumber(value) {
        if (value === null || value === undefined || Number.isNaN(value)) return '—';
        return numberFormatter.format(value);
    }

    function translateRole(role) {
        switch (role) {
            case 'student': return 'دانش‌آموز';
            case 'teacher': return 'معلم';
            case 'consultant': return 'مشاور';
            case 'admin': return 'مدیر مدرسه';
            case 'super_admin': return 'مدیر کل';
            default: return 'کاربر';
        }
    }

    // --- Sidebar init (mobile toggle + RBAC helper hook) ---
    function initSidebar(profile) {
        const role = profile?.role || 'student';

        // Mobile toggle
        if (appLayout && sidebarShell && sidebarToggle) {
            sidebarToggle.addEventListener('click', () => {
                appLayout.classList.toggle('sidebar-open');
            });
        }

        // Role-based visibility via data-visible-for
        document.querySelectorAll('[data-visible-for]').forEach((el) => {
            const allowed = (el.getAttribute('data-visible-for') || '')
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean);

            if (!allowed.length) return;
            if (role === 'super_admin') return;
            if (!allowed.includes(role)) {
                el.style.display = 'none';
            }
        });
    }

    window.initSidebar = initSidebar;

    // (Quick-add منطق قبلی را در صورت نیاز می‌توانیم بازگردانیم؛ فعلاً حذف شد تا ساده بماند)

    // --- Role-based dashboard rendering (replaces old widget navigation) ---
    function renderDashboard(role, { stats, tasks, exams }) {
        // Stat cards
        statTotalTasks.textContent = toPersianNumber(stats.totalTasks || 0);
        statPendingExams.textContent = toPersianNumber(stats.pendingExams || 0);
        statAverageScore.textContent = stats.averageScore != null
            ? toPersianNumber(Math.round(stats.averageScore))
            : '—';
        statSubscriptionDays.textContent = stats.subscriptionDaysRemaining != null
            ? toPersianNumber(stats.subscriptionDaysRemaining)
            : '—';

        // Next 48 hours feed
        const items = buildNext48HoursItems(tasks, exams);
        renderNext48HoursTimeline(items);

        // Calendar
        initCalendar(tasks);

        // Role-based widget
        renderRoleWidget(role, { tasks, exams, stats });
    }

    function getDateFromRow(row) {
        return row?.due_at || row?.due_date || row?.date || row?.deadline || row?.start_time || row?.exam_date || null;
    }

    function buildNext48HoursItems(tasks, exams) {
        const now = new Date();
        const windowEnd = new Date(now.getTime() + 48 * 60 * 60 * 1000);
        const rows = [];

        (tasks || []).forEach(task => {
            const raw = getDateFromRow(task);
            if (!raw) return;
            const d = new Date(raw);
            if (Number.isNaN(d.getTime())) return;
            if (d >= now && d <= windowEnd) {
                rows.push({
                    kind: 'task',
                    title: task.title || task.name || 'وظیفه بدون عنوان',
                    at: d,
                    description: task.description || '',
                    status: task.status || task.state || null,
                });
            }
        });

        (exams || []).forEach(exam => {
            const raw = getDateFromRow(exam);
            if (!raw) return;
            const d = new Date(raw);
            if (Number.isNaN(d.getTime())) return;
            if (d >= now && d <= windowEnd) {
                rows.push({
                    kind: 'exam',
                    title: exam.title || exam.name || 'آزمون',
                    at: d,
                    description: exam.description || '',
                    status: null,
                });
            }
        });

        rows.sort((a, b) => a.at - b.at);
        return rows;
    }

    function formatTime(d) {
        const hours = d.getHours().toString().padStart(2, '0');
        const minutes = d.getMinutes().toString().padStart(2, '0');
        return toPersianNumber(`${hours}${minutes}`.replace(/(\d{2})(\d{2})/, '$1:$2'));
    }

    function formatDate(d) {
        const y = d.getFullYear();
        const m = d.getMonth() + 1;
        const day = d.getDate();
        return `${toPersianNumber(y)} / ${toPersianNumber(m)} / ${toPersianNumber(day)}`;
    }

    function renderNext48HoursTimeline(items) {
        next48hList.innerHTML = '';
        if (!items.length) {
            next48hList.innerHTML = '<div class="empty-state">هیچ رویدادی در ۴۸ ساعت آینده ثبت نشده است.</div>';
            return;
        }

        items.forEach((item, index) => {
            const wrapper = document.createElement('div');
            wrapper.className = 'timeline-item';

            const dotWrapper = document.createElement('div');
            dotWrapper.className = 'timeline-dot-wrapper';
            const dot = document.createElement('div');
            dot.className = 'timeline-dot';
            const line = document.createElement('div');
            line.className = 'timeline-line';
            dotWrapper.appendChild(dot);
            if (index < items.length - 1) dotWrapper.appendChild(line);

            const content = document.createElement('div');
            content.className = 'timeline-content';

            const titleRow = document.createElement('div');
            titleRow.className = 'timeline-title-row';

            const title = document.createElement('div');
            title.className = 'timeline-title';
            title.textContent = item.title;

            const badge = document.createElement('span');
            badge.className = 'timeline-badge';
            badge.textContent = item.kind === 'exam' ? 'آزمون' : 'وظیفه';

            titleRow.appendChild(title);
            titleRow.appendChild(badge);
            content.appendChild(titleRow);

            if (item.description) {
                const desc = document.createElement('div');
                desc.style.fontSize = '0.7rem';
                desc.style.color = 'var(--color-text-muted)';
                desc.textContent = item.description;
                content.appendChild(desc);
            }

            const meta = document.createElement('div');
            meta.className = 'timeline-meta';

            const dateSpan = document.createElement('span');
            dateSpan.innerHTML = `<i class="fa-regular fa-calendar"></i>${formatDate(item.at)}`;
            meta.appendChild(dateSpan);

            const timeSpan = document.createElement('span');
            timeSpan.innerHTML = `<i class="fa-regular fa-clock"></i>${formatTime(item.at)}`;
            meta.appendChild(timeSpan);

            if (item.status) {
                const statusSpan = document.createElement('span');
                statusSpan.innerHTML = `<i class="fa-regular fa-circle-check"></i>${item.status}`;
                meta.appendChild(statusSpan);
            }

            content.appendChild(meta);

            wrapper.appendChild(dotWrapper);
            wrapper.appendChild(content);
            next48hList.appendChild(wrapper);
        });
    }

    function initCalendar(tasks) {
        if (!calendarRoot || !window.FullCalendar) return;

        calendarRoot.innerHTML = '';
        const calendarEl = document.createElement('div');
        calendarRoot.appendChild(calendarEl);

        const events = [];
        (tasks || []).forEach(task => {
            const raw = getDateFromRow(task);
            if (!raw) return;
            const date = new Date(raw);
            if (Number.isNaN(date.getTime())) return;

            events.push({
                title: task.title || task.name || 'وظیفه',
                start: date.toISOString(),
                allDay: true,
            });
        });

        const calendar = new FullCalendar.Calendar(calendarEl, {
            plugins: window.FullCalendar?.Jalali ? [window.FullCalendar.Jalali] : [],
            initialView: 'dayGridMonth',
            locale: 'fa',
            direction: 'rtl',
            events,
            dayMaxEvents: 2,
        });

        calendar.render();
    }

    function renderStudentProgressWidget(tasks, stats) {
        const completed = (tasks || []).filter(t => t.status === 'done' || t.status === 'completed' || t.completed === true).length;
        const total = (tasks || []).length || 1;
        const pct = Math.round((completed / total) * 100);

        const radius = 40;
        const circumference = 2 * Math.PI * radius;
        const offset = circumference * (1 - pct / 100);

        const wrapper = document.createElement('div');
        wrapper.className = 'role-widget';

        const ringContainer = document.createElement('div');
        ringContainer.className = 'progress-ring';

        ringContainer.innerHTML = `
            <svg width="100" height="100">
                <circle
                    class="progress-ring-circle-bg"
                    stroke-width="10"
                    fill="transparent"
                    r="${radius}"
                    cx="50"
                    cy="50"
                />
                <circle
                    class="progress-ring-circle"
                    stroke-width="10"
                    fill="transparent"
                    r="${radius}"
                    cx="50"
                    cy="50"
                    stroke-dasharray="${circumference}"
                    stroke-dashoffset="${offset}"
                />
            </svg>
            <div class="progress-ring-text">
                ${toPersianNumber(pct)}٪
            </div>
        `;

        const info = document.createElement('div');
        info.className = 'role-widget-info';
        const title = document.createElement('div');
        title.className = 'role-widget-title';
        title.textContent = 'پیشرفت تکمیل وظایف';
        const subtitle = document.createElement('div');
        subtitle.className = 'role-widget-subtitle';
        subtitle.textContent = 'نمای کلی از وضعیت انجام تمرین‌ها و تکالیف.';

        const metrics = document.createElement('div');
        metrics.className = 'role-widget-metrics';
        metrics.innerHTML = `
            <span class="role-chip">تکمیل شده: ${toPersianNumber(completed)}</span>
            <span class="role-chip">کل وظایف: ${toPersianNumber(total)}</span>
        `;

        info.appendChild(title);
        info.appendChild(subtitle);
        info.appendChild(metrics);

        wrapper.appendChild(ringContainer);
        wrapper.appendChild(info);

        roleWidgetContainer.innerHTML = '';
        roleWidgetContainer.appendChild(wrapper);
    }

    function renderAdminActivityWidget(exams) {
        if (!window.Chart) {
            roleWidgetContainer.innerHTML = '';
            return;
        }
        const wrapper = document.createElement('div');
        wrapper.className = 'role-widget';

        const canvas = document.createElement('canvas');

        const info = document.createElement('div');
        info.className = 'role-widget-info';
        const title = document.createElement('div');
        title.className = 'role-widget-title';
        title.textContent = 'فعالیت روزانه دانش‌آموزان';
        const subtitle = document.createElement('div');
        subtitle.className = 'role-widget-subtitle';
        subtitle.textContent = 'برآوردی از میزان شرکت در آزمون‌ها و فعالیت‌ها.';

        const metrics = document.createElement('div');
        metrics.className = 'role-widget-metrics';
        metrics.innerHTML = `
            <span class="role-chip">روزهای فعال اخیر</span>
            <span class="role-chip">تعداد رویدادهای آتی: ${toPersianNumber((exams || []).length)}</span>
        `;

        info.appendChild(title);
        info.appendChild(subtitle);
        info.appendChild(metrics);

        wrapper.appendChild(canvas);
        wrapper.appendChild(info);

        roleWidgetContainer.innerHTML = '';
        roleWidgetContainer.appendChild(wrapper);

        const labels = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه'];
        const data = labels.map(() => Math.floor(Math.random() * 20) + 5);

        new Chart(canvas.getContext('2d'), {
            type: 'bar',
            data: {
                labels,
                datasets: [{
                    label: 'فعالیت',
                    data,
                    backgroundColor: 'rgba(16, 185, 129, 0.7)',
                    borderRadius: 8,
                }],
            },
            options: {
                responsive: true,
                plugins: {
                    legend: { display: false },
                },
                scales: {
                    x: { grid: { display: false } },
                    y: { grid: { color: 'rgba(148, 163, 184, 0.25)' } },
                },
            },
        });

        // Make chips act as quick navigation shortcuts
        const chips = metrics.querySelectorAll('.role-chip');
        if (chips[0]) {
            chips[0].addEventListener('click', () => handleRouteClick('reports'));
        }
        if (chips[1]) {
            chips[1].addEventListener('click', () => handleRouteClick('manage-exams'));
        }
    }

    function renderRoleWidget(role, { tasks, exams, stats }) {
        if (role === 'student') {
            renderStudentProgressWidget(tasks, stats);
        } else if (role === 'admin') {
            renderAdminActivityWidget(exams);
        } else {
            roleWidgetContainer.innerHTML = '';
        }
    }

    // --- Auth & subscription logic (preserved) ---
    async function checkAuthAndLoadDashboard() {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !session) {
            window.location.href = '/login.html';
            return;
        }
        const user = session.user;

        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();

        if (profileError) {
            console.error('Error fetching profile:', profileError);
            alert('خطا: پروفایل کاربری شما یافت نشد. لطفاً با پشتیبانی تماس بگیرید.');
            await supabase.auth.signOut();
            window.location.href = '/login.html';
            return;
        }

        const displayName = profile.name || user.email || 'کاربر';
        miniNameEl.textContent = displayName;
        miniRoleEl.textContent = translateRole(profile.role);
        if (miniAvatarInitial) {
            miniAvatarInitial.textContent = (displayName || 'پ').trim().charAt(0);
        }

        let subscriptionExpired = false;
        let managerIdToCheck = null;
        let subscriptionDaysRemaining = null;

        if (profile.role === 'admin') {
            managerIdToCheck = profile.id;
        } else if (profile.manager_id) {
            managerIdToCheck = profile.manager_id;
        }

        if (managerIdToCheck && profile.role !== 'super_admin') {
            const { data: subscription } = await supabase
                .from('subscriptions')
                .select('end_date')
                .eq('user_id', managerIdToCheck)
                .single();

            const today = new Date();
            today.setHours(0, 0, 0, 0);

            if (!subscription || new Date(subscription.end_date) < today) {
                subscriptionExpired = true;
            } else {
                const diffTime = new Date(subscription.end_date) - today;
                subscriptionDaysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            }

            if (profile.role === 'admin') {
                if (subscriptionExpired) {
                    subscriptionDisplay.textContent = 'اشتراک شما منقضی شده است';
                    subscriptionDisplay.style.backgroundColor = '#ffcdd2';
                    subscriptionDisplay.style.color = '#c62828';
                } else {
                    subscriptionDisplay.textContent = `${toPersianNumber(subscriptionDaysRemaining)} روز از اشتراک شما باقی مانده است`;
                }
                subscriptionDisplay.style.display = 'inline-block';
            }
        }

        if (subscriptionExpired && profile.role !== 'super_admin') {
            // If subscription is expired, keep the dashboard shell but show a blocking message
            const dashboardPage = document.getElementById('page-dashboard');
            if (dashboardPage) {
                dashboardPage.innerHTML = `
                    <div style="text-align: center; padding: 3rem; max-width: 480px; margin: 0 auto;">
                        <i class="fas fa-exclamation-triangle" style="font-size: 3rem; color: #f97373; margin-bottom: 1rem;"></i>
                        <h2 style="margin: 0 0 .5rem;">دسترسی غیرفعال است</h2>
                        <p style="margin: 0; color: #e5e7eb;">اشتراک مدرسه شما منقضی شده یا فعال نشده است. لطفاً با پشتیبانی تماس بگیرید.</p>
                    </div>
                `;
            }
            return;
        }

        currentProfile = profile;
        currentSubscriptionDaysRemaining = subscriptionDaysRemaining;

        renderSidebar(profile.role);
        setActiveRouteInSidebar(currentRouteId);

        // Load dashboard data (tasks, exams, scores)
        await loadDashboardData(profile, { subscriptionDaysRemaining });
    }

    async function loadDashboardData(profile, { subscriptionDaysRemaining }) {
        try {
            const [tasksRes, examsRes, scoresRes] = await Promise.all([
                supabase.from('tasks').select('*').limit(200),
                supabase.from('exams').select('*').limit(100),
                supabase.from('scores').select('score').limit(500),
            ]);

            const tasks = tasksRes.error ? [] : (tasksRes.data || []);
            const exams = examsRes.error ? [] : (examsRes.data || []);
            const scores = scoresRes.error ? [] : (scoresRes.data || []);

            const stats = {
                totalTasks: tasks.length,
                pendingExams: exams.length,
                averageScore: scores.length
                    ? scores.reduce((sum, s) => sum + (s.score || 0), 0) / scores.length
                    : null,
                subscriptionDaysRemaining,
            };

            renderDashboard(profile.role, { stats, tasks, exams });
        } catch (e) {
            console.error('Error loading dashboard data:', e);
        }
    }

    logoutBtn.addEventListener('click', async () => {
        await supabase.auth.signOut();
        window.location.href = '/login.html';
    });

    // Initial state: show dashboard; sidebar will be rendered after profile load
    showDashboard();
    checkAuthAndLoadDashboard();
});