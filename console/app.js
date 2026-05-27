document.addEventListener('DOMContentLoaded', function() {
    // --- Global Variables & Supabase Client ---
    let supabase = null;

    let selectedUserId = null;
    let currentUserProfile = null;
    let editingTaskId = null;

    // --- DOM Element References ---
    const usersContainer = document.getElementById('users-container');
    const tasksContainer = document.querySelector('.tasks-container');
    const classFilterSelect = document.getElementById('class-filter');
    const taskModal = document.getElementById('taskModal');
    const submitTaskBtn = taskModal.querySelector('.submit-task-btn');
    const taskTitleInput = document.getElementById('task-title');
    const taskClassSelect = document.getElementById('task-class-select');
    const taskDateInput = document.getElementById('task-date');
    const timeStartInput = document.getElementById('time-start');
    const timeEndInput = document.getElementById('time-end');
    const categoryButtons = document.querySelectorAll('.category-btn');
    const reportModal = document.getElementById('reportModal');
    const generateReportBtn = document.getElementById('generate-report-btn');
    const taskReportModal = document.getElementById('task-report-modal');
    const closeTaskReportModalBtn = document.getElementById('close-task-report-modal-btn');
    const reportForm = document.getElementById('report-form');
    const closeReportModalBtn = document.getElementById('closeReportModalBtn');

    // --- Helper Functions ---
    function showModal(modalElement) { if(modalElement) modalElement.classList.add('is-open'); }
    function hideModal(modalElement) { if(modalElement) modalElement.classList.remove('is-open'); }

    async function getCurrentUserProfile() {
        if (currentUserProfile) return currentUserProfile;
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { window.location.href = '/login.html'; return null; }
        const { data: profile, error } = await supabase.from('profiles').select('*').eq('id', user.id).single();
        if (error) {
            console.error("Could not fetch profile, logging out.", error);
            await supabase.auth.signOut();
            window.location.href = '/login.html';
            return null;
        }
        currentUserProfile = profile;
        return profile;
    }

    async function populateClassDropdowns() {
        const profile = await getCurrentUserProfile();
        if (!profile) return;
        const managerId = profile.role === 'admin' ? profile.id : profile.manager_id;
        if (!managerId && profile.role !== 'super_admin') return;

        let query = supabase.from('classes').select('id, name');
        if (managerId) query = query.eq('manager_id', managerId);

        const { data: classes } = await query;
        if (!classes) return;

        classFilterSelect.innerHTML = '<option value="all">همه کلاس‌ها</option>';
        taskClassSelect.innerHTML = '<option value="">فقط برای دانش‌آموز انتخاب شده</option>';
        classes.forEach(cls => {
            classFilterSelect.add(new Option(cls.name, cls.id));
            taskClassSelect.add(new Option(cls.name, cls.id));
        });
    }

    async function loadUsers(filterClassId = 'all') {
        const profile = await getCurrentUserProfile();
        if (!profile) return;
        const managerId = profile.role === 'admin' ? profile.id : profile.manager_id;
        if (!managerId && profile.role !== 'super_admin') {
            usersContainer.innerHTML = '<li>شما به مدرسه‌ای تخصیص داده نشده‌اید.</li>';
            return;
        }

        let query = supabase.from('profiles').select('*').in('role', ['student']);
        if (managerId) query = query.eq('manager_id', managerId);
        if (filterClassId !== 'all') query = query.eq('class_id', filterClassId);
        
        const { data: users } = await query;
        usersContainer.innerHTML = '';
        if (!users || users.length === 0) {
            usersContainer.innerHTML = '<li>دانش‌آموزی یافت نشد.</li>';
            tasksContainer.innerHTML = '<p class="no-tasks">دانش‌آموزی برای نمایش وظایف انتخاب نشده است.</p>';
            return;
        }
        
        users.forEach(user => {
            const userElement = document.createElement('li');
            userElement.className = 'user-item';
            userElement.dataset.userId = user.id;
            userElement.innerHTML = `<span class="user-name">${user.name}</span>`;
            userElement.addEventListener('click', () => {
                document.querySelectorAll('.user-item.selected').forEach(el => el.classList.remove('selected'));
                userElement.classList.add('selected');
                selectedUserId = user.id;
                loadTasksForUser(user.id);
            });
            usersContainer.appendChild(userElement);
        });
        
        if (users.length > 0) {
            usersContainer.querySelector('.user-item').click();
        }
    }

    async function loadTasksForUser(userId) {
        tasksContainer.innerHTML = '';
        const { data: tasks, error } = await supabase
            .from('tasks')
            .select('*, class:class_id(name)')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (error || !tasks || tasks.length === 0) {
            tasksContainer.innerHTML = '<p class="no-tasks">هیچ تسکی برای این کاربر وجود ندارد.</p>';
            if (error) {
                console.error("Error loading tasks:", error);
            }
            return;
        }

        tasks.forEach(task => {
            const taskElement = document.createElement('div');
            taskElement.className = `task-item score${task.color || 1}`;
            taskElement.dataset.task = JSON.stringify(task);
            const taskDate = new Date(task.date + 'T00:00:00').toLocaleDateString('fa-IR');
            taskElement.innerHTML = `
                <div class="task-content">
                    <span class="task-title">${task.title}</span>
                    <div class="task-info">
                        <span><i class="fas fa-calendar"></i> ${taskDate}</span>
                        ${task.class ? `<span><i class="fas fa-chalkboard"></i> ${task.class.name}</span>` : ''}
                    </div>
                </div>
                <div class="task-actions">
                    <button class="btn-icon btn-edit"><i class="fas fa-edit"></i></button>
                    <button class="btn-icon btn-delete"><i class="fas fa-trash"></i></button>
                </div>
            `;
            taskElement.addEventListener('click', (e) => {
                if (!e.target.closest('.btn-edit, .btn-delete')) {
                    openTaskCompletionReport(task);
                }
            });
            tasksContainer.appendChild(taskElement);
        });
    }

    function openTaskModal(task = null) {
        editingTaskId = task ? task.id : null;
        taskModal.querySelector('h2').textContent = task ? 'ویرایش تسک' : 'تسک جدید';
        submitTaskBtn.textContent = task ? 'ذخیره تغییرات' : 'افزودن تسک';
        
        taskTitleInput.value = task ? task.title : '';
        taskClassSelect.value = task ? task.class_id || '' : ''; 
        flatpickr(taskDateInput, { defaultDate: task ? task.date : new Date(), locale: 'fa' });
        timeStartInput.value = task ? task.time_start || '' : '';
        timeEndInput.value = task ? task.time_end || '' : '';
        const score = task ? task.color : 1;
        categoryButtons.forEach(btn => btn.classList.toggle('active', btn.dataset.score == score));
        showModal(taskModal);
    }
    
    async function handleTaskSubmit() {
        const title = taskTitleInput.value.trim();
        const selectedClassId = taskClassSelect.value;
        const date = taskDateInput.value;
        const time_start = timeStartInput.value || null;
        const time_end = timeEndInput.value || null;
        const color = document.querySelector('.category-btn.active').dataset.score;
        if (!title || !date) return alert('عنوان و تاریخ تسک الزامی است.');

        const taskData = { title, date, time_start, time_end, color, class_id: selectedClassId || null };

        if (editingTaskId) {
            const { error } = await supabase.from('tasks').update(taskData).eq('id', editingTaskId);
            if (error) return alert('خطا در ویرایش تسک.');
        } else if (selectedClassId) {
            const { data: students, error } = await supabase.from('profiles').select('id').eq('class_id', selectedClassId);
            if (error || !students || students.length === 0) return alert('دانش‌آموزی در این کلاس یافت نشد.');
            
            const newTasks = students.map(s => ({ ...taskData, user_id: s.id }));
            const { error: insertError } = await supabase.from('tasks').insert(newTasks);
            if (insertError) return alert('خطا در ایجاد تسک برای کلاس.');
            alert(`تسک برای ${students.length} دانش‌آموز ایجاد شد.`);
        } else if (selectedUserId) {
            const { error } = await supabase.from('tasks').insert([{ ...taskData, user_id: selectedUserId }]);
            if (error) return alert('خطا در ایجاد تسک.');
        } else {
            return alert('لطفا یک دانش‌آموز یا یک کلاس را برای تخصیص تسک انتخاب کنید.');
        }
        hideModal(taskModal);
        if (selectedUserId) loadTasksForUser(selectedUserId);
    }
    
    async function openTaskCompletionReport(originalTask) {
        if (!originalTask.class_id) {
            alert('این تکلیف به کلاس خاصی تعلق ندارد و گزارش آن در دسترس نیست.');
            return;
        }
        document.getElementById('task-report-title').textContent = `گزارش تکلیف: ${originalTask.title}`;
        const tableBody = document.querySelector('#task-completion-table tbody');
        const loadingEl = document.getElementById('task-report-loading');
        tableBody.innerHTML = '';
        loadingEl.style.display = 'block';
        showModal(taskReportModal);

        const { data: students, error: studentError } = await supabase.from('profiles')
            .select('id, name')
            .eq('class_id', originalTask.class_id);

        if (studentError || !students) {
            loadingEl.textContent = 'خطا در دریافت لیست دانش‌آموزان.';
            return;
        }
        
        const { data: tasks, error: taskError } = await supabase.from('tasks')
            .select('user_id, is_completed, updated_at')
            .eq('title', originalTask.title)
            .eq('date', originalTask.date)
            .eq('class_id', originalTask.class_id);
            
        if (taskError) {
             loadingEl.textContent = 'خطا در دریافت وضعیت تکالیف.';
             return;
        }
        
        const taskStatusMap = new Map(tasks.map(t => [t.user_id, { completed: t.is_completed, date: t.updated_at }]));

        loadingEl.style.display = 'none';
        students.forEach(student => {
            const status = taskStatusMap.get(student.id);
            const isCompleted = status ? status.completed : false;
            const completionDate = (isCompleted && status.date) ? new Date(status.date).toLocaleDateString('fa-IR') : '-';
            const row = tableBody.insertRow();
            row.innerHTML = `
                <td>${student.name}</td>
                <td>${isCompleted ? '✅ انجام شده' : '❌ انجام نشده'}</td>
                <td>${completionDate}</td>
            `;
        });
    }

    async function handleReportGeneration(e) {
        e.preventDefault();
        const days = parseInt(document.getElementById('report-days').value);
        if (!days || days < 1) return alert('لطفا تعداد روز معتبری را وارد کنید.');
        if (!selectedUserId) return alert('دانش‌آموز انتخاب نشده است.');

        const reportContentEl = document.getElementById('report-content');
        reportContentEl.textContent = 'در حال تولید گزارش...';

        const fromDate = new Date();
        fromDate.setDate(fromDate.getDate() - days);

        const { data: tasks, error } = await supabase
            .from('tasks')
            .select('*')
            .eq('user_id', selectedUserId)
            .gte('created_at', fromDate.toISOString());

        if (error || tasks.length === 0) {
            reportContentEl.textContent = 'هیچ تسکی در این بازه زمانی یافت نشد.';
            return;
        }

        let reportText = `گزارش عملکرد ${days} روز گذشته:\n================================\n\n`;
        tasks.forEach(task => {
            const status = task.is_completed ? '✅ تکمیل شده' : '⏳ در انتظار';
            const taskDate = new Date(task.created_at).toLocaleDateString('fa-IR');
            reportText += `- ${task.title} (تاریخ: ${taskDate}) - وضعیت: ${status}\n`;
        });
        reportContentEl.textContent = reportText;
    }

    // --- Main Initialization Function ---
    async function initializeApp() {
        const profile = await getCurrentUserProfile();
        if(!profile) return;

        // --- Attach Event Listeners ---
        document.getElementById('username').textContent = profile.name;
        classFilterSelect.addEventListener('change', () => loadUsers(classFilterSelect.value));
        
        // --- START: کد جدید برای رفع باگ دکمه‌ها ---
        categoryButtons.forEach(button => {
            button.addEventListener('click', () => {
                // ابتدا کلاس 'active' را از همه دکمه‌ها حذف کن
                categoryButtons.forEach(btn => btn.classList.remove('active'));
                // سپس کلاس 'active' را به دکمه کلیک شده اضافه کن
                button.classList.add('active');
            });
        });
        // --- END: کد جدید ---

        tasksContainer.addEventListener('click', e => {
            const taskItem = e.target.closest('.task-item');
            if (!taskItem) return;

            const editButton = e.target.closest('.btn-edit');
            const deleteButton = e.target.closest('.btn-delete');
            
            if (editButton) {
                e.stopPropagation();
                openTaskModal(JSON.parse(taskItem.dataset.task));
            } else if (deleteButton) {
                e.stopPropagation();
                if (confirm('آیا از حذف این تسک مطمئن هستید؟')) {
                    supabase.from('tasks').delete().eq('id', JSON.parse(taskItem.dataset.task).id).then(() => {
                        if(selectedUserId) loadTasksForUser(selectedUserId);
                    });
                }
            } else {
                 openTaskCompletionReport(JSON.parse(taskItem.dataset.task));
            }
        });
        
        submitTaskBtn.addEventListener('click', handleTaskSubmit);
        document.getElementById('open-task-modal-btn').addEventListener('click', () => openTaskModal());
        generateReportBtn.addEventListener('click', () => showModal(reportModal));
        closeReportModalBtn.addEventListener('click', () => hideModal(reportModal));
        reportForm.addEventListener('submit', handleReportGeneration);
        closeTaskReportModalBtn.addEventListener('click', () => hideModal(taskReportModal));
        
        window.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                hideModal(e.target);
            }
        });

        // --- Initial Data Load ---
        await populateClassDropdowns();
        await loadUsers();
    }

    // ابتدا کانفیگ سوپربیس را از سرور می‌گیریم و بعد اپ را راه‌اندازی می‌کنیم
    (async function initSupabaseAndStart() {
        try {
            const res = await fetch('/api/supabase-config');
            if (!res.ok) {
                console.error('Cannot load Supabase config for console app.');
                return;
            }
            const { url, anonKey } = await res.json();
            supabase = window.supabase.createClient(url, anonKey);
            await initializeApp();
        } catch (e) {
            console.error('Supabase init error in console app:', e);
        }
    })();
});