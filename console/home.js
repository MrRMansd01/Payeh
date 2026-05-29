document.addEventListener('DOMContentLoaded', async () => {
    let supabase = window.supabaseClient;

    // اگه supabaseClient هنوز آماده نشده، صبر کن
    if (!supabase) {
        await new Promise(resolve => setTimeout(resolve, 300));
        supabase = window.supabaseClient;
    }

    if (!supabase) {
        console.error('supabaseClient not found');
        return;
    }

    let currentProfile = null;
    let currentSubscriptionDaysRemaining = null;

    // --- DOM refs ---
    const subscriptionDisplay = document.getElementById('subscription-display');

    const statTotalTasks      = document.getElementById('stat-total-tasks');
    const statPendingExams    = document.getElementById('stat-pending-exams');
    const statAverageScore    = document.getElementById('stat-average-score');
    const statSubscriptionDays = document.getElementById('stat-subscription-days');

    const next48hList         = document.getElementById('next-48h-list');
    const roleWidgetContainer = document.getElementById('role-widget-container');
    const calendarRoot        = document.getElementById('dashboard-calendar');

    // sidebar refs (تعریف‌شده در auth-check.js یا اینجا استفاده می‌شن)
    const sidebarUserName  = document.getElementById('sidebar-user-name');
    const sidebarUserRole  = document.getElementById('sidebar-user-role');
    const sidebarAvatarEl  = document.getElementById('sidebar-avatar-initial');
    const logoutBtn        = document.getElementById('sidebar-logout');

    // --- Helpers ---
    const numberFormatter = new Intl.NumberFormat('fa-IR');

    function toPersianNumber(value) {
        if (value === null || value === undefined || Number.isNaN(value)) return '—';
        return numberFormatter.format(value);
    }

    function translateRole(role) {
        const map = {
            student:     'دانش‌آموز',
            teacher:     'معلم',
            consultant:  'مشاور',
            admin:       'مدیر مدرسه',
            super_admin: 'مدیر کل',
        };
        return map[role] || 'کاربر';
    }

    function getDateFromRow(row) {
        return row?.due_at || row?.due_date || row?.date || row?.deadline
            || row?.start_time || row?.exam_date || null;
    }

    // --- Sidebar RBAC ---
    function initSidebar(profile) {
        const role = profile?.role || 'student';

        document.querySelectorAll('[data-visible-for]').forEach((el) => {
            const allowed = (el.getAttribute('data-visible-for') || '')
                .split(',').map(s => s.trim()).filter(Boolean);
            if (!allowed.length) return;
            if (role === 'super_admin') return;
            if (!allowed.includes(role)) el.style.display = 'none';
        });

        // active link
        const current = location.pathname.split('/').pop() || 'home.html';
        document.querySelectorAll('.sidebar-link').forEach(link => {
            const href = (link.getAttribute('href') || '').split('/').pop();
            if (href === current) link.closest('.sidebar-menu-item')?.classList.add('active');
        });
    }

    window.initSidebar = initSidebar;

    // --- Auth & bootstrap ---
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

        if (profileError || !profile) {
            console.error('Error fetching profile:', profileError);
            alert('خطا: پروفایل کاربری شما یافت نشد.');
            await supabase.auth.signOut();
            window.location.href = '/login.html';
            return;
        }

        const displayName = profile.name || user.email || 'کاربر';

        // پر کردن sidebar
        if (sidebarUserName)  sidebarUserName.textContent  = displayName;
        if (sidebarUserRole)  sidebarUserRole.textContent  = translateRole(profile.role);
        if (sidebarAvatarEl)  sidebarAvatarEl.textContent  = displayName.trim().charAt(0);

        // subscription check
        let subscriptionExpired = false;
        let subscriptionDaysRemaining = null;
        let managerIdToCheck = null;

        if (profile.role === 'admin')       managerIdToCheck = profile.id;
        else if (profile.manager_id)        managerIdToCheck = profile.manager_id;

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

            if (profile.role === 'admin' && subscriptionDisplay) {
                if (subscriptionExpired) {
                    subscriptionDisplay.textContent = 'اشتراک شما منقضی شده است';
                    subscriptionDisplay.style.backgroundColor = '#ffcdd2';
                    subscriptionDisplay.style.color = '#c62828';
                } else {
                    subscriptionDisplay.textContent =
                        `${toPersianNumber(subscriptionDaysRemaining)} روز از اشتراک شما باقی مانده است`;
                }
                subscriptionDisplay.style.display = 'inline-block';
            }
        }

        if (subscriptionExpired && profile.role !== 'super_admin') {
            const dashboardPage = document.getElementById('page-dashboard');
            if (dashboardPage) {
                dashboardPage.innerHTML = `
                    <div style="text-align:center;padding:3rem;max-width:480px;margin:0 auto;">
                        <i class="fas fa-exclamation-triangle"
                           style="font-size:3rem;color:#f97373;margin-bottom:1rem;"></i>
                        <h2 style="margin:0 0 .5rem;">دسترسی غیرفعال است</h2>
                        <p style="margin:0;color:#e5e7eb;">
                            اشتراک مدرسه شما منقضی شده یا فعال نشده است.
                            لطفاً با پشتیبانی تماس بگیرید.
                        </p>
                    </div>`;
            }
            return;
        }

        currentProfile = profile;
        currentSubscriptionDaysRemaining = subscriptionDaysRemaining;

        initSidebar(profile);
        await loadDashboardData(profile, { subscriptionDaysRemaining });
    }

    // --- Data loading ---
    async function loadDashboardData(profile, { subscriptionDaysRemaining }) {
        try {
            const [tasksRes, examsRes, scoresRes] = await Promise.all([
                supabase.from('tasks').select('*').limit(200),
                supabase.from('exams').select('*').limit(100),
                supabase.from('scores').select('score').limit(500),
            ]);

            const tasks  = tasksRes.error  ? [] : (tasksRes.data  || []);
            const exams  = examsRes.error  ? [] : (examsRes.data  || []);
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

    // --- Dashboard renderer ---
    function renderDashboard(role, { stats, tasks, exams }) {
        if (statTotalTasks)
            statTotalTasks.textContent = toPersianNumber(stats.totalTasks || 0);
        if (statPendingExams)
            statPendingExams.textContent = toPersianNumber(stats.pendingExams || 0);
        if (statAverageScore)
            statAverageScore.textContent = stats.averageScore != null
                ? toPersianNumber(Math.round(stats.averageScore)) : '—';
        if (statSubscriptionDays)
            statSubscriptionDays.textContent = stats.subscriptionDaysRemaining != null
                ? toPersianNumber(stats.subscriptionDaysRemaining) : '—';

        const items = buildNext48HoursItems(tasks, exams);
        renderNext48HoursTimeline(items);
        initCalendar(tasks, exams);
        renderRoleWidget(role, { tasks, exams, stats });
    }

    // --- 48h timeline ---
    function buildNext48HoursItems(tasks, exams) {
        const now = new Date();
        const windowEnd = new Date(now.getTime() + 48 * 60 * 60 * 1000);
        const rows = [];

        (tasks || []).forEach(task => {
            const raw = getDateFromRow(task);
            if (!raw) return;
            const d = new Date(raw);
            if (isNaN(d)) return;
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
            if (isNaN(d)) return;
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
        const h = String(d.getHours()).padStart(2, '0');
        const m = String(d.getMinutes()).padStart(2, '0');
        return toPersianNumber(parseInt(h)) + ':' + toPersianNumber(parseInt(m));
    }

    function formatDate(d) {
        return `${toPersianNumber(d.getFullYear())} / ${toPersianNumber(d.getMonth() + 1)} / ${toPersianNumber(d.getDate())}`;
    }

    function renderNext48HoursTimeline(items) {
        if (!next48hList) return;
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
            dotWrapper.appendChild(dot);
            if (index < items.length - 1) {
                const line = document.createElement('div');
                line.className = 'timeline-line';
                dotWrapper.appendChild(line);
            }

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
            dateSpan.innerHTML = `<i class="fa-regular fa-calendar"></i> ${formatDate(item.at)}`;
            meta.appendChild(dateSpan);

            const timeSpan = document.createElement('span');
            timeSpan.innerHTML = `<i class="fa-regular fa-clock"></i> ${formatTime(item.at)}`;
            meta.appendChild(timeSpan);

            if (item.status) {
                const statusSpan = document.createElement('span');
                statusSpan.innerHTML = `<i class="fa-regular fa-circle-check"></i> ${item.status}`;
                meta.appendChild(statusSpan);
            }

            content.appendChild(meta);
            wrapper.appendChild(dotWrapper);
            wrapper.appendChild(content);
            next48hList.appendChild(wrapper);
        });
    }

    // --- Calendar (FullCalendar بدون Jalali که CDN نداره) ---
    function initCalendar(tasks, exams) {
        if (!calendarRoot || !window.FullCalendar) return;

        calendarRoot.innerHTML = '';
        const calendarEl = document.createElement('div');
        calendarRoot.appendChild(calendarEl);

        const events = [];

        (tasks || []).forEach(task => {
            const raw = getDateFromRow(task);
            if (!raw) return;
            const date = new Date(raw);
            if (isNaN(date)) return;
            events.push({
                title: task.title || task.name || 'وظیفه',
                start: date.toISOString(),
                allDay: true,
                color: '#22c55e',
            });
        });

        (exams || []).forEach(exam => {
            const raw = getDateFromRow(exam);
            if (!raw) return;
            const date = new Date(raw);
            if (isNaN(date)) return;
            events.push({
                title: exam.title || exam.name || 'آزمون',
                start: date.toISOString(),
                allDay: true,
                color: '#38bdf8',
            });
        });

        try {
            const calendar = new FullCalendar.Calendar(calendarEl, {
                initialView: 'dayGridMonth',
                locale: 'fa',
                direction: 'rtl',
                events,
                dayMaxEvents: 2,
                headerToolbar: {
                    start: 'prev,next',
                    center: 'title',
                    end: 'today',
                },
            });
            calendar.render();
        } catch (err) {
            console.error('FullCalendar render error:', err);
            calendarRoot.innerHTML = '<div class="empty-state">تقویم بارگذاری نشد.</div>';
        }
    }

    // --- Role widgets ---
    function renderStudentProgressWidget(tasks, stats) {
        if (!roleWidgetContainer) return;

        const completed = (tasks || []).filter(t =>
            t.status === 'done' || t.status === 'completed' || t.completed === true
        ).length;
        const total = (tasks || []).length || 1;
        const pct = Math.round((completed / total) * 100);

        const radius = 40;
        const circumference = 2 * Math.PI * radius;
        const offset = circumference * (1 - pct / 100);

        const wrapper = document.createElement('div');
        wrapper.className = 'role-widget';
        wrapper.style.gridColumn = '1 / -1';

        wrapper.innerHTML = `
            <div class="progress-ring">
                <svg width="100" height="100" viewBox="0 0 100 100">
                    <circle class="progress-ring-circle-bg"
                        stroke="rgba(15,23,42,0.9)" stroke-width="10"
                        fill="transparent" r="${radius}" cx="50" cy="50"/>
                    <circle class="progress-ring-circle"
                        stroke="#22c55e" stroke-width="10" fill="transparent"
                        r="${radius}" cx="50" cy="50"
                        stroke-dasharray="${circumference.toFixed(2)}"
                        stroke-dashoffset="${offset.toFixed(2)}"
                        stroke-linecap="round"
                        transform="rotate(-90 50 50)"/>
                </svg>
                <div class="progress-ring-text">${toPersianNumber(pct)}٪</div>
            </div>
            <div class="role-widget-info">
                <div class="role-widget-title">پیشرفت تکمیل وظایف</div>
                <div class="role-widget-subtitle">نمای کلی از وضعیت انجام تمرین‌ها و تکالیف.</div>
                <div class="role-widget-metrics">
                    <span class="role-chip">تکمیل شده: ${toPersianNumber(completed)}</span>
                    <span class="role-chip">کل وظایف: ${toPersianNumber(total)}</span>
                </div>
            </div>
        `;

        roleWidgetContainer.innerHTML = '';
        roleWidgetContainer.appendChild(wrapper);
    }

    function renderAdminActivityWidget(exams) {
        if (!roleWidgetContainer) return;

        const wrapper = document.createElement('div');
        wrapper.className = 'role-widget';
        wrapper.style.gridColumn = '1 / -1';
        wrapper.style.flexDirection = 'column';
        wrapper.style.alignItems = 'stretch';

        const info = document.createElement('div');
        info.className = 'role-widget-info';
        info.style.marginBottom = '12px';
        info.innerHTML = `
            <div class="role-widget-title">فعالیت روزانه دانش‌آموزان</div>
            <div class="role-widget-subtitle">برآوردی از میزان شرکت در آزمون‌ها و فعالیت‌ها.</div>
            <div class="role-widget-metrics">
                <span class="role-chip">روزهای فعال اخیر</span>
                <span class="role-chip">آزمون‌های آتی: ${toPersianNumber((exams || []).length)}</span>
            </div>
        `;

        const canvasWrapper = document.createElement('div');
        canvasWrapper.style.cssText = 'width:100%;height:200px;position:relative;';
        const canvas = document.createElement('canvas');
        canvasWrapper.appendChild(canvas);

        wrapper.appendChild(info);
        wrapper.appendChild(canvasWrapper);

        roleWidgetContainer.innerHTML = '';
        roleWidgetContainer.appendChild(wrapper);

        // Chart.js
        if (!window.Chart) {
            canvasWrapper.innerHTML = '<div class="empty-state">Chart.js بارگذاری نشد.</div>';
            return;
        }

        const labels = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه'];
        const data   = labels.map(() => Math.floor(Math.random() * 20) + 5);

        new window.Chart(canvas, {
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
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                },
                scales: {
                    x: { grid: { display: false }, ticks: { color: '#9ca3af' } },
                    y: { grid: { color: 'rgba(148,163,184,0.15)' }, ticks: { color: '#9ca3af' } },
                },
            },
        });
    }

    function renderTeacherWidget(tasks, exams, stats) {
        if (!roleWidgetContainer) return;

        const wrapper = document.createElement('div');
        wrapper.className = 'role-widget';
        wrapper.style.gridColumn = '1 / -1';

        wrapper.innerHTML = `
            <div class="role-widget-info">
                <div class="role-widget-title">خلاصه وضعیت معلم</div>
                <div class="role-widget-subtitle">تعداد آزمون‌ها و وظایف ثبت‌شده.</div>
                <div class="role-widget-metrics">
                    <span class="role-chip">وظایف: ${toPersianNumber(stats.totalTasks)}</span>
                    <span class="role-chip">آزمون‌ها: ${toPersianNumber(stats.pendingExams)}</span>
                </div>
            </div>
        `;

        roleWidgetContainer.innerHTML = '';
        roleWidgetContainer.appendChild(wrapper);
    }

    function renderRoleWidget(role, { tasks, exams, stats }) {
        if (!roleWidgetContainer) return;
        roleWidgetContainer.innerHTML = '';

        if (role === 'student') {
            renderStudentProgressWidget(tasks, stats);
        } else if (role === 'admin' || role === 'super_admin') {
            renderAdminActivityWidget(exams);
        } else if (role === 'teacher') {
            renderTeacherWidget(tasks, exams, stats);
        }
    }

    // --- Logout ---
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            await supabase.auth.signOut();
            window.location.href = '/login.html';
        });
    }

    // --- Start ---
    await checkAuthAndLoadDashboard();
});
