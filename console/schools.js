document.addEventListener('DOMContentLoaded', async () => {
    let supabase;
    try {
        const res = await fetch('/api/supabase-config');
        if (!res.ok) {
            console.error('Cannot load Supabase config for schools page.');
            return;
        }
        const { url, anonKey } = await res.json();
        supabase = window.supabase.createClient(url, anonKey);
    } catch (e) {
        console.error('Supabase init error in schools page:', e);
        return;
    }

    const modal = document.getElementById('school-modal');
    const cancelBtn = document.getElementById('cancel-btn');
    const schoolForm = document.getElementById('school-form');
    const adminIdInput = document.getElementById('admin-id');
    const adminNameDisplay = document.getElementById('admin-name-display');
    const schoolNameInput = document.getElementById('school-name');
    const studentLimitInput = document.getElementById('student-limit');
    const schoolsTableBody = document.querySelector('#schools-table tbody');
    const loadingMessage = document.getElementById('loading-message');

    const addAdminBtn = document.getElementById('add-admin-btn');
    const addAdminModal = document.getElementById('add-admin-modal');
    const addAdminForm = document.getElementById('add-admin-form');
    const cancelAddBtn = document.getElementById('cancel-add-btn');

    const manageUsersModal = document.getElementById('manage-users-modal');
    const modalSchoolName = document.getElementById('modal-school-name');
    const modalAdminId = document.getElementById('modal-admin-id');
    const schoolUsersTableBody = document.querySelector('#school-users-table tbody');
    const schoolUsersLoading = document.getElementById('school-users-loading');
    const closeManageUsersBtn = document.getElementById('close-manage-users-btn');
    const unassignedUsersTableBody = document.querySelector('#unassigned-users-table tbody');
    const unassignedUsersLoading = document.getElementById('unassigned-users-loading');
    const addSelectedUsersBtn = document.getElementById('add-selected-users-btn');

    async function checkSuperAdminRole() {
        // تغییر: استفاده از getSession برای اطمینان از بارگذاری اطلاعات ورود
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !session) {
            window.location.href = '/login.html';
            return false;
        }
        const user = session.user;

        const { data: profile, error } = await supabase.from('profiles').select('role').eq('id', user.id).single();
        if (error || !profile || profile.role !== 'super_admin') {
            alert('شما دسترسی لازم برای مشاهده این صفحه را ندارید.');
            window.location.href = '/home.html';
            return false;
        }
        return true;
    }

    async function fetchAdmins() {
        loadingMessage.textContent = 'در حال بارگذاری لیست مدیران...';
        schoolsTableBody.innerHTML = '';
        const { data: admins, error } = await supabase.from('profiles').select('*').eq('role', 'admin').order('created_at', { ascending: false });

        if (error) {
            loadingMessage.textContent = 'خطا در بارگذاری مدیران.';
            return;
        }
        if (admins.length === 0) {
            loadingMessage.textContent = 'هیچ مدیری یافت نشد. برای افزودن، از دکمه بالا استفاده کنید.';
        } else {
            loadingMessage.style.display = 'none';
            admins.forEach(admin => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${admin.name || 'نامشخص'}</td>
                    <td>${admin.email}</td>
                    <td>${admin.school_name || 'تعیین نشده'}</td>
                    <td>${admin.student_limit || 'نامحدود'}</td>
                    <td class="actions-cell">
                        <button class="btn-icon btn-edit" data-admin='${JSON.stringify(admin)}' title="ویرایش مدرسه"><i class="fas fa-edit"></i></button>
                        <button class="btn-icon btn-manage-users" data-admin-id="${admin.id}" data-school-name="${admin.school_name || 'بدون نام'}" title="مدیریت کاربران مدرسه"><i class="fas fa-users"></i></button>
                    </td>
                `;
                schoolsTableBody.appendChild(row);
            });
        }
    }
    
    function showModal(admin) {
        adminIdInput.value = admin.id;
        adminNameDisplay.textContent = admin.name;
        schoolNameInput.value = admin.school_name || '';
        studentLimitInput.value = admin.student_limit || '';
        modal.classList.add('is-open');
    }
    function hideModal() {
        modal.classList.remove('is-open');
    }
    schoolForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = adminIdInput.value;
        const school_name = schoolNameInput.value.trim();
        const student_limit = parseInt(studentLimitInput.value, 10) || null;
        if (!id || !school_name) {
            alert('لطفاً نام مدرسه را وارد کنید.');
            return;
        }
        const { error } = await supabase.from('profiles').update({ school_name, student_limit }).eq('id', id);
        if (error) {
            alert('خطا در به‌روزرسانی اطلاعات مدرسه.');
        } else {
            hideModal();
            fetchAdmins();
        }
    });
    addAdminForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('new-admin-name').value.trim();
        const email = document.getElementById('new-admin-email').value.trim();
        const password = document.getElementById('new-admin-password').value;
        const school_name = document.getElementById('new-admin-school-name').value.trim();
        const student_limit = parseInt(document.getElementById('new-admin-student-limit').value, 10);

        if (!name || !email || !password || !school_name || isNaN(student_limit)) {
            alert('لطفاً تمام فیلدها را به درستی پر کنید.');
            return;
        }
        const { data: authData, error: authError } = await supabase.auth.signUp({ email, password, options: { data: { name } } });
        if (authError) {
            alert(`خطا در ایجاد کاربر: ${authError.message}`);
            return;
        }
        if (authData.user) {
            const { error: profileError } = await supabase.from('profiles').update({ role: 'admin', school_name, student_limit, name }).eq('id', authData.user.id);
            if (profileError) {
                alert('کاربر ایجاد شد اما در به‌روزرسانی پروفایل خطایی رخ داد.');
            } else {
                alert(`مدیر "${name}" برای مدرسه "${school_name}" با موفقیت ایجاد شد.`);
                addAdminModal.classList.remove('is-open');
                fetchAdmins();
            }
        }
    });

    async function openManageUsersModal(adminId, schoolName) {
        modalSchoolName.textContent = schoolName;
        modalAdminId.value = adminId;
        manageUsersModal.classList.add('is-open');
        await fetchSchoolUsers(adminId);
        await fetchUnassignedUsers();
    }
    async function fetchSchoolUsers(adminId) {
        schoolUsersLoading.style.display = 'block';
        schoolUsersTableBody.innerHTML = '';
        const { data: users, error } = await supabase.from('profiles').select('*').eq('manager_id', adminId);
        if (error) {
            schoolUsersLoading.textContent = 'خطا در بارگذاری کاربران.';
            return;
        }
        if (users.length === 0) {
            schoolUsersLoading.textContent = 'هیچ کاربری برای این مدرسه یافت نشد.';
        } else {
            schoolUsersLoading.style.display = 'none';
            users.forEach(user => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${user.name}</td>
                    <td>${user.email}</td>
                    <td>${user.role}</td>
                    <td class="actions-cell">
                        <button class="btn-icon btn-remove-user" data-id="${user.id}" title="حذف کاربر از مدرسه"><i class="fas fa-times"></i></button>
                    </td>
                `;
                schoolUsersTableBody.appendChild(row);
            });
        }
    }
    async function fetchUnassignedUsers() {
        unassignedUsersLoading.style.display = 'block';
        unassignedUsersTableBody.innerHTML = '';
        const { data: users, error } = await supabase.from('profiles').select('*').is('manager_id', null).not('role', 'in', '("super_admin", "admin")');
        if (error) {
            unassignedUsersLoading.textContent = 'خطا در بارگذاری کاربران آزاد.';
            return;
        }
        if (users.length === 0) {
            unassignedUsersLoading.textContent = 'هیچ کاربر آزادی برای افزودن یافت نشد.';
        } else {
            unassignedUsersLoading.style.display = 'none';
            users.forEach(user => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td><input type="checkbox" class="user-select-checkbox" data-id="${user.id}"></td>
                    <td>${user.name}</td>
                    <td>${user.email}</td>
                    <td>${user.role}</td>
                `;
                unassignedUsersTableBody.appendChild(row);
            });
        }
    }
    addSelectedUsersBtn.addEventListener('click', async () => {
        const adminId = modalAdminId.value;
        const selectedCheckboxes = document.querySelectorAll('.user-select-checkbox:checked');
        if (selectedCheckboxes.length === 0) {
            alert('لطفا حداقل یک کاربر را برای افزودن انتخاب کنید.');
            return;
        }
        const userIdsToUpdate = Array.from(selectedCheckboxes).map(cb => cb.dataset.id);
        const { error } = await supabase.from('profiles').update({ manager_id: adminId }).in('id', userIdsToUpdate);
        if (error) {
            alert('خطا در افزودن کاربران به مدرسه.');
        } else {
            alert(`${userIdsToUpdate.length} کاربر با موفقیت به مدرسه اضافه شدند.`);
            await fetchSchoolUsers(adminId);
            await fetchUnassignedUsers();
        }
    });
    schoolUsersTableBody.addEventListener('click', async (e) => {
        const removeButton = e.target.closest('.btn-remove-user');
        if (removeButton) {
            const userId = removeButton.dataset.id;
            if (confirm('آیا از حذف این کاربر از مدرسه مطمئن هستید؟')) {
                const { error } = await supabase.from('profiles').update({ manager_id: null }).eq('id', userId);
                if (error) {
                    alert('خطا در حذف کاربر از مدرسه.');
                } else {
                    await fetchSchoolUsers(modalAdminId.value);
                    await fetchUnassignedUsers();
                }
            }
        }
    });

    schoolsTableBody.addEventListener('click', (e) => {
        const editButton = e.target.closest('.btn-edit');
        if (editButton) {
            const admin = JSON.parse(editButton.dataset.admin);
            showModal(admin);
        }
        const manageButton = e.target.closest('.btn-manage-users');
        if (manageButton) {
            const adminId = manageButton.dataset.adminId;
            const schoolName = manageButton.dataset.schoolName;
            openManageUsersModal(adminId, schoolName);
        }
    });
    cancelBtn.addEventListener('click', hideModal);
    modal.addEventListener('click', (e) => { if (e.target === modal) hideModal(); });
    addAdminBtn.addEventListener('click', () => { addAdminForm.reset(); addAdminModal.classList.add('is-open'); });
    cancelAddBtn.addEventListener('click', () => { addAdminModal.classList.remove('is-open'); });
    addAdminModal.addEventListener('click', (e) => { if (e.target === addAdminModal) addAdminModal.classList.remove('is-open'); });
    closeManageUsersBtn.addEventListener('click', () => { manageUsersModal.classList.remove('is-open'); });
    manageUsersModal.addEventListener('click', (e) => { if (e.target === manageUsersModal) manageUsersModal.classList.remove('is-open'); });

    checkSuperAdminRole().then((hasAccess) => {
        if (hasAccess) {
            fetchAdmins();
        }
    });
});
