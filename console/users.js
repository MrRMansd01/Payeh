document.addEventListener('DOMContentLoaded', async () => {
    let supabase;
    try {
        const res = await fetch('/api/supabase-config');
        if (!res.ok) {
            console.error('Cannot load Supabase config for users page.');
            return;
        }
        const { url, anonKey } = await res.json();
        supabase = window.supabase.createClient(url, anonKey);
    } catch (e) {
        console.error('Supabase init error in users page:', e);
        return;
    }

    // --- DOM Elements for Editing ---
    const modal = document.getElementById('user-modal');
    const cancelBtn = document.getElementById('cancel-btn');
    const userForm = document.getElementById('user-form');
    const userIdInput = document.getElementById('user-id');
    const userNameInput = document.getElementById('user-name');
    const userEmailInput = document.getElementById('user-email');
    const userRoleSelect = document.getElementById('user-role');
    const usersTableBody = document.querySelector('#users-table tbody');
    const loadingMessage = document.getElementById('loading-message');
    const adminFields = document.getElementById('admin-fields');
    const schoolNameInput = document.getElementById('school-name');
    const studentLimitInput = document.getElementById('student-limit');
    const managerFields = document.getElementById('manager-fields');
    const managerSelect = document.getElementById('manager-select');
    
    // --- *** NEW: DOM Elements for Adding *** ---
    const addUserBtn = document.getElementById('add-user-btn');
    const addUserModal = document.getElementById('add-user-modal');
    const addUserForm = document.getElementById('add-user-form');
    const cancelAddBtn = document.getElementById('cancel-add-btn');
    // -----------------------------------------

    let currentUserProfile = null;

    async function getCurrentUserProfile() {
        if (currentUserProfile) return currentUserProfile;
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            window.location.href = '/login.html';
            return null;
        }
        const { data: profile, error } = await supabase.from('profiles').select('*').eq('id', user.id).single();
        if (error) {
             await supabase.auth.signOut();
             window.location.href = '/login.html';
             return null;
        }
        currentUserProfile = profile;
        return profile;
    }

    async function checkAccessRole() {
        const profile = await getCurrentUserProfile();
        if (!profile) return false;
        if (!['admin', 'teacher', 'consultant', 'super_admin'].includes(profile.role)) {
            alert('شما دسترسی لازم برای مشاهده این صفحه را ندارید.');
            window.location.href = '/home.html';
            return false;
        }
        return true;
    }

    async function fetchUsers() {
        loadingMessage.textContent = 'در حال بارگذاری کاربران...';
        usersTableBody.innerHTML = '';

        const profile = await getCurrentUserProfile();
        if (!profile) return;
        
        let query = supabase.from('profiles').select('*, school:manager_id(school_name), class:class_id(name)');
        const managerId = (profile.role === 'admin') ? profile.id : profile.manager_id;

        if (managerId) {
             query = query.or(`manager_id.eq.${managerId},id.eq.${managerId}`);
        } else if (profile.role !== 'super_admin') {
            loadingMessage.textContent = 'شما به مدرسه‌ای تخصیص داده نشده‌اید.';
            return;
        }

        const { data: users, error } = await query.order('created_at', { ascending: false });

        if (error) {
            loadingMessage.textContent = 'خطا در بارگذاری کاربران.';
            return;
        }

        loadingMessage.style.display = users.length === 0 ? 'block' : 'none';
        loadingMessage.textContent = 'هیچ کاربری یافت نشد.';
        users.forEach(user => {
            const school = user.role === 'admin' ? user.school_name : (user.school ? user.school.school_name : '-');
            const className = user.class ? user.class.name : '-';
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${user.name || 'نامشخص'}</td>
                <td>${user.email}</td>
                <td>${user.role || 'تعیین نشده'}</td>
                <td>${school || '-'}</td>
                <td>${className}</td>
                <td class="actions-cell">
                    <button class="btn-icon btn-edit" data-user='${JSON.stringify(user)}'><i class="fas fa-edit"></i></button>
                    ${profile.role === 'super_admin' ? `<button class="btn-icon btn-delete" data-id="${user.id}"><i class="fas fa-trash"></i></button>` : ''}
                </td>
            `;
            usersTableBody.appendChild(row);
        });
    }

    async function populateModalDropdowns(currentUserRole) {
        if (currentUserRole === 'super_admin') {
            const { data: admins, error } = await supabase.from('profiles').select('id, name, school_name').eq('role', 'admin');
            if (!error) {
                managerSelect.innerHTML = '<option value="">بدون مدیر (مستقل)</option>';
                admins.forEach(admin => managerSelect.add(new Option(`${admin.name} (${admin.school_name || 'بدون مدرسه'})`, admin.id)));
            }
        }
    }

    async function showModal(user) {
        const profile = await getCurrentUserProfile();
        await populateModalDropdowns(profile.role);
        
        userIdInput.value = user.id;
        userNameInput.value = user.name;
        userEmailInput.value = user.email;
        userRoleSelect.value = user.role || 'student';
        
        toggleModalFields(user.role, profile.role);

        // Hide admin and super_admin roles for admin users
        for (let option of userRoleSelect.options) {
            if (profile.role === 'admin' && (option.value === 'admin' || option.value === 'super_admin')) {
                option.style.display = 'none';
            } else {
                option.style.display = 'block';
            }
        }

        if (user.role === 'admin') {
            schoolNameInput.value = user.school_name || '';
            studentLimitInput.value = user.student_limit || '';
        } else if (['student', 'teacher', 'consultant'].includes(user.role)) {
            managerSelect.value = user.manager_id || '';
        }
        
        modal.classList.add('is-open');
    }

    function hideModal(modalElement) {
        modalElement.classList.remove('is-open');
    }

    function toggleModalFields(selectedRole, currentUserRole) {
        userRoleSelect.disabled = (currentUserRole !== 'super_admin' && currentUserRole !== 'admin');
        adminFields.style.display = (selectedRole === 'admin' && currentUserRole === 'super_admin') ? 'block' : 'none';
        managerFields.style.display = (['student', 'teacher', 'consultant'].includes(selectedRole) && currentUserRole === 'super_admin') ? 'block' : 'none';
    }

    userForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = userIdInput.value;
        const name = userNameInput.value.trim();
        const role = userRoleSelect.value;
        if (!id || !name) return alert('لطفاً نام کاربر را وارد کنید.');

        const updates = { name };
        const profile = await getCurrentUserProfile();

        if (profile.role === 'super_admin') {
            updates.role = role;
            if (role === 'admin') {
                updates.school_name = schoolNameInput.value.trim();
                updates.student_limit = parseInt(studentLimitInput.value, 10) || null;
                updates.manager_id = null;
            } else if (['student', 'teacher', 'consultant'].includes(role)) {
                updates.manager_id = managerSelect.value || null;
                updates.school_name = null;
                updates.student_limit = null;
            }
        } else if (profile.role === 'admin') {
            if (role === 'admin' || role === 'super_admin') {
                alert('شما اجازه تغییر نقش به مدیر یا ادمین کل را ندارید.');
                return;
            }
            updates.role = role;
        }

        const { error } = await supabase.from('profiles').update(updates).eq('id', id);

        if (error) {
            alert('خطا در به‌روزرسانی کاربر.');
            console.error("Error updating user:", error);
        } else {
            hideModal(modal);
            fetchUsers();
        }
    });
    
    userRoleSelect.addEventListener('change', async () => {
        const profile = await getCurrentUserProfile();
        toggleModalFields(userRoleSelect.value, profile.role);
    });

    usersTableBody.addEventListener('click', async (e) => {
        const editButton = e.target.closest('.btn-edit');
        if (editButton) {
            const user = JSON.parse(editButton.dataset.user);
            showModal(user);
        }

        const deleteButton = e.target.closest('.btn-delete');
        if (deleteButton) {
            const id = deleteButton.dataset.id;
            const profile = await getCurrentUserProfile();
            if (id === profile.id) return alert('شما نمی‌توانید حساب کاربری خودتان را حذف کنید.');

            if (confirm('آیا از حذف این کاربر مطمئن هستید؟ این عمل غیرقابل بازگشت است.')) {
                 const { error } = await supabase.rpc('delete_user_and_data', { user_id_to_delete: id });
                if (error) {
                    alert('خطا در حذف کاربر.');
                    console.error("Error deleting user:", error);
                } else {
                    alert('کاربر با موفقیت حذف شد.');
                    fetchUsers();
                }
            }
        }
    });

    cancelBtn.addEventListener('click', () => hideModal(modal));
    modal.addEventListener('click', (e) => { if (e.target === modal) hideModal(modal); });

    // --- *** NEW: Event Listeners for Adding User *** ---
    addUserBtn.addEventListener('click', () => {
        addUserForm.reset();
        addUserModal.classList.add('is-open');
    });

    cancelAddBtn.addEventListener('click', () => {
        addUserModal.classList.remove('is-open');
    });

    addUserModal.addEventListener('click', (e) => {
        if (e.target === addUserModal) {
            addUserModal.classList.remove('is-open');
        }
    });
    
    addUserForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const profile = await getCurrentUserProfile();
        if (!profile) return;

        const name = document.getElementById('new-user-name').value.trim();
        const email = document.getElementById('new-user-email').value.trim();
        const password = document.getElementById('new-user-password').value;
        const role = document.getElementById('new-user-role').value;

        if (!name || !email || !password || !role) {
            return alert('لطفاً تمام فیلدها را پر کنید.');
        }

        const { data: authData, error: authError } = await supabase.auth.signUp({
            email,
            password,
            options: { data: { name } }
        });

        if (authError) {
            return alert(`خطا در ایجاد کاربر: ${authError.message}`);
        }

        if (authData.user) {
            const managerId = (profile.role === 'admin') ? profile.id : profile.manager_id;
            const { error: profileError } = await supabase.from('profiles').update({
                role: role,
                manager_id: managerId,
                name: name
            }).eq('id', authData.user.id);
            
            if (profileError) {
                alert('کاربر ایجاد شد اما در تخصیص به مدرسه خطایی رخ داد.');
            } else {
                alert(`کاربر "${name}" با موفقیت ایجاد و به مدرسه شما اضافه شد.`);
                addUserModal.classList.remove('is-open');
                fetchUsers(); // Refresh the user list
            }
        }
    });
    // ----------------------------------------------------


    checkAccessRole().then(hasAccess => {
        if (hasAccess) fetchUsers();
    });
});