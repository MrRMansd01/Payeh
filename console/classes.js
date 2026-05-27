document.addEventListener('DOMContentLoaded', async () => {
    let supabase;
    try {
        const res = await fetch('/api/supabase-config');
        if (!res.ok) {
            console.error('Cannot load Supabase config for classes page.');
            return;
        }
        const { url, anonKey } = await res.json();
        supabase = window.supabase.createClient(url, anonKey);
    } catch (e) {
        console.error('Supabase init error in classes page:', e);
        return;
    }

    const addClassBtn = document.getElementById('add-class-btn');
    const modal = document.getElementById('class-modal');
    const modalTitle = document.getElementById('modal-title');
    const cancelBtn = document.getElementById('cancel-btn');
    const classForm = document.getElementById('class-form');
    const classIdInput = document.getElementById('class-id');
    const classNameInput = document.getElementById('class-name');
    const classGradeInput = document.getElementById('class-grade');
    const classesTableBody = document.querySelector('#classes-table tbody');
    const loadingMessage = document.getElementById('loading-message');

    const manageStudentsModal = document.getElementById('manage-students-modal');
    const modalClassNameDisplay = document.getElementById('modal-class-name-display');
    const modalClassIdInput = document.getElementById('modal-class-id');
    const unassignedStudentsTableBody = document.querySelector('#unassigned-students-table tbody');
    const assignedStudentsTableBody = document.querySelector('#assigned-students-table tbody');
    const unassignedLoading = document.getElementById('unassigned-loading');
    const assignedLoading = document.getElementById('assigned-loading');
    const addSelectedStudentsBtn = document.getElementById('add-selected-students-btn');
    const closeManageModalBtn = document.getElementById('close-manage-modal-btn');
    const selectAllCheckbox = document.getElementById('select-all-checkbox');

    let currentUserProfile = null;

    async function getCurrentUserProfile() {
        if (currentUserProfile) return currentUserProfile;
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            window.location.href = '/login.html';
            return null;
        }
        const { data: profile, error } = await supabase.from('profiles').select('id, role, manager_id').eq('id', user.id).single();
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

    async function fetchClasses() {
        loadingMessage.textContent = 'در حال بارگذاری کلاس‌ها...';
        classesTableBody.innerHTML = '';
        const profile = await getCurrentUserProfile();
        if (!profile) return;

        let query = supabase.from('classes').select('id, name, grade, manager_id, profiles!class_id(count)');
        let managerId = (profile.role === 'admin') ? profile.id : profile.manager_id;
        
        if (managerId) {
            query = query.eq('manager_id', managerId);
        } else if (profile.role !== 'super_admin') {
            loadingMessage.textContent = 'شما به هیچ مدرسه‌ای تخصیص داده نشده‌اید.';
            return;
        }

        const { data: classes, error } = await query.order('name', { ascending: true });
        if (error) {
            loadingMessage.textContent = 'خطا در بارگذاری کلاس‌ها.';
            console.error('Error fetching classes:', error);
            return;
        }

        loadingMessage.style.display = classes.length === 0 ? 'block' : 'none';
        loadingMessage.textContent = 'هیچ کلاسی یافت نشد.';
        classes.forEach(cls => {
            const studentCount = cls.profiles[0]?.count ?? 0;
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${cls.name}</td>
                <td>${cls.grade || '-'}</td>
                <td>${studentCount}</td>
                <td class="actions-cell">
                    <button class="btn-icon btn-manage-students" data-id="${cls.id}" data-name="${cls.name}" title="مدیریت دانش‌آموزان"><i class="fas fa-users"></i></button>
                    <button class="btn-icon btn-edit" data-id="${cls.id}" data-name="${cls.name}" data-grade="${cls.grade || ''}" title="ویرایش"><i class="fas fa-edit"></i></button>
                    <button class="btn-icon btn-delete" data-id="${cls.id}" title="حذف"><i class="fas fa-trash"></i></button>
                </td>
            `;
            classesTableBody.appendChild(row);
        });
    }

    const showModal = (modalElement, data = null) => {
        if (modalElement === modal) {
            modalTitle.textContent = data ? 'ویرایش کلاس' : 'افزودن کلاس جدید';
            classIdInput.value = data ? data.id : '';
            classNameInput.value = data ? data.name : '';
            classGradeInput.value = data ? data.grade : '';
        }
        modalElement.classList.add('is-open');
    };
    const hideModal = (modalElement) => modalElement.classList.remove('is-open');

    async function openManageStudentsModal(classId, className) {
        modalClassNameDisplay.textContent = className;
        modalClassIdInput.value = classId;
        showModal(manageStudentsModal);
        await populateStudentLists(classId);
    }

    async function populateStudentLists(classId) {
        unassignedLoading.style.display = 'block';
        assignedLoading.style.display = 'block';
        unassignedStudentsTableBody.innerHTML = '';
        assignedStudentsTableBody.innerHTML = '';

        const profile = await getCurrentUserProfile();
        if (!profile) return;
        
        const managerId = (profile.role === 'admin') ? profile.id : profile.manager_id;
        if (!managerId && profile.role !== 'super_admin') return;

        const { data: assigned, error: assignedError } = await supabase.from('profiles').select('id, name, email').eq('class_id', classId);
        if (assignedError) {
            assignedLoading.textContent = 'خطا در بارگذاری.';
        } else {
            assignedLoading.style.display = assigned.length === 0 ? 'block' : 'none';
            assignedLoading.textContent = 'دانش‌آموزی در این کلاس نیست.';
            assigned.forEach(s => {
                const row = assignedStudentsTableBody.insertRow();
                row.innerHTML = `<td>${s.name}</td><td>${s.email}</td><td class="actions-cell"><button class="btn-icon btn-remove-student" data-id="${s.id}"><i class="fas fa-times"></i></button></td>`;
            });
        }

        let unassignedQuery = supabase.from('profiles').select('id, name, email').is('class_id', null).eq('role', 'student');
        if (managerId) {
            unassignedQuery = unassignedQuery.eq('manager_id', managerId);
        }
        
        const { data: unassigned, error: unassignedError } = await unassignedQuery;
        
        if (unassignedError) {
            unassignedLoading.textContent = 'خطا در بارگذاری.';
        } else {
            unassignedLoading.style.display = unassigned.length === 0 ? 'block' : 'none';
            unassignedLoading.textContent = 'دانش‌آموز بدون کلاسی یافت نشد.';
            unassigned.forEach(s => {
                const row = unassignedStudentsTableBody.insertRow();
                row.innerHTML = `<td><input type="checkbox" class="student-select-checkbox" data-id="${s.id}"></td><td>${s.name}</td><td>${s.email}</td>`;
            });
        }
    }
    
    classesTableBody.addEventListener('click', async (e) => {
        const editButton = e.target.closest('.btn-edit');
        if (editButton) showModal(modal, editButton.dataset);

        const manageButton = e.target.closest('.btn-manage-students');
        if (manageButton) openManageStudentsModal(manageButton.dataset.id, manageButton.dataset.name);
        
        const deleteButton = e.target.closest('.btn-delete');
        if (deleteButton && confirm('آیا از حذف این کلاس مطمئن هستید؟ (دانش‌آموزان این کلاس بدون کلاس خواهند شد)')) {
            const classId = deleteButton.dataset.id;
            await supabase.from('profiles').update({ class_id: null }).eq('class_id', classId);
            await supabase.from('classes').delete().eq('id', classId);
            fetchClasses();
        }
    });

    classForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = classNameInput.value.trim();
        const grade = classGradeInput.value.trim();
        const id = classIdInput.value;
        if (!name || !grade) return alert('لطفاً نام کلاس و پایه تحصیلی را وارد کنید.');
        
        const profile = await getCurrentUserProfile();
        if (!profile) return;
        let managerId = (profile.role === 'admin') ? profile.id : profile.manager_id;
        if (!managerId && profile.role !== 'super_admin') return alert("شما مجوز لازم را ندارید.");
        if (profile.role === 'super_admin' && !id) return alert("ادمین کل نمی‌تواند کلاس جدید تعریف کند، فقط می‌تواند ویرایش کند.");
        
        const dataToUpsert = { name, grade };
        if (!id) {
            dataToUpsert.manager_id = managerId;
        }

        const { error } = id
            ? await supabase.from('classes').update(dataToUpsert).eq('id', id)
            : await supabase.from('classes').insert([dataToUpsert]);

        if (error) alert('خطا در ذخیره کلاس.');
        else {
            hideModal(modal);
            fetchClasses();
        }
    });
    
    addSelectedStudentsBtn.addEventListener('click', async () => {
        const classId = modalClassIdInput.value;
        const selectedCheckboxes = document.querySelectorAll('.student-select-checkbox:checked');
        if (selectedCheckboxes.length === 0) return alert('لطفا حداقل یک دانش‌آموز را انتخاب کنید.');
        
        const studentIds = Array.from(selectedCheckboxes).map(cb => cb.dataset.id);
        
        // --- START FIX ---
        const profile = await getCurrentUserProfile();
        if (!profile) return;
        const managerId = (profile.role === 'admin') ? profile.id : profile.manager_id;
        if (!managerId) {
            return alert("خطا: مدیر مدرسه مشخص نیست.");
        }

        const { data, error } = await supabase
            .from('profiles')
            .update({ class_id: classId })
            .in('id', studentIds)
            .eq('manager_id', managerId) // Explicitly check manager_id to satisfy RLS
            .select();
        // --- END FIX ---

        if (error) {
            alert('خطا در افزودن دانش‌آموزان. لطفا کنسول را برای جزئیات بررسی کنید.');
            console.error('>>> Supabase error while adding students:', error);
        } else if (data && data.length > 0) {
            alert(`${data.length} دانش‌آموز با موفقیت به کلاس اضافه شدند.`);
            selectAllCheckbox.checked = false;
            await populateStudentLists(classId);
            await fetchClasses();
        } else {
             alert('عملیات ناموفق بود. ممکن است دسترسی لازم برای ویرایش این دانش‌آموزان را نداشته باشید.');
        }
    });
    
    assignedStudentsTableBody.addEventListener('click', async (e) => {
        const removeButton = e.target.closest('.btn-remove-student');
        if (removeButton) {
            const studentId = removeButton.dataset.id;
            const classId = modalClassIdInput.value;

            // --- START FIX ---
            const profile = await getCurrentUserProfile();
            if (!profile) return;
            const managerId = (profile.role === 'admin') ? profile.id : profile.manager_id;
            if (!managerId) {
                return alert("خطا: مدیر مدرسه مشخص نیست.");
            }

            const { error } = await supabase
                .from('profiles')
                .update({ class_id: null })
                .eq('id', studentId)
                .eq('manager_id', managerId); // Explicitly check manager_id
            // --- END FIX ---

            if (error) {
                alert('خطا در حذف دانش‌آموز از کلاس. لطفا کنسول را برای جزئیات بررسی کنید.');
                console.error('>>> Supabase error while removing student:', error);
            } else {
                await populateStudentLists(classId);
                await fetchClasses();
            }
        }
    });
    
    selectAllCheckbox.addEventListener('change', (e) => {
        document.querySelectorAll('.student-select-checkbox').forEach(cb => cb.checked = e.target.checked);
    });

    addClassBtn.addEventListener('click', () => showModal(modal));
    cancelBtn.addEventListener('click', () => hideModal(modal));
    modal.addEventListener('click', (e) => { if (e.target === modal) hideModal(modal); });
    closeManageModalBtn.addEventListener('click', () => hideModal(manageStudentsModal));
    manageStudentsModal.addEventListener('click', (e) => { if (e.target === manageStudentsModal) hideModal(manageStudentsModal); });

    checkAccessRole().then(hasAccess => {
        if (hasAccess) fetchClasses();
    });
});