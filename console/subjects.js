document.addEventListener('DOMContentLoaded', async () => {
    let supabase;
    try {
        const res = await fetch('/api/supabase-config');
        if (!res.ok) {
            console.error('Cannot load Supabase config for subjects page.');
            return;
        }
        const { url, anonKey } = await res.json();
        supabase = window.supabase.createClient(url, anonKey);
    } catch (e) {
        console.error('Supabase init error in subjects page:', e);
        return;
    }

    const addSubjectBtn = document.getElementById('add-subject-btn');
    const modal = document.getElementById('subject-modal');
    const modalTitle = document.getElementById('modal-title');
    const cancelBtn = document.getElementById('cancel-btn');
    const subjectForm = document.getElementById('subject-form');
    const subjectIdInput = document.getElementById('subject-id');
    const subjectNameInput = document.getElementById('subject-name');
    const subjectsTableBody = document.querySelector('#subjects-table tbody');
    const loadingMessage = document.getElementById('loading-message');

    let currentUserProfile = null;

    async function checkAccessRole() {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            window.location.href = '/login.html';
            return false;
        }
        const { data: profile, error } = await supabase.from('profiles').select('id, role, manager_id').eq('id', session.user.id).single();
        if (error || !['admin', 'teacher', 'consultant', 'super_admin'].includes(profile.role)) {
            alert('شما دسترسی لازم برای مشاهده این صفحه را ندارید.');
            window.location.href = '/home.html';
            return false;
        }
        currentUserProfile = profile;
        return true;
    }

    async function fetchSubjects() {
        loadingMessage.textContent = 'در حال بارگذاری درس‌ها...';
        subjectsTableBody.innerHTML = '';

        let query = supabase.from('subjects').select('*');
        let managerId = null;

        if (currentUserProfile.role === 'admin') {
            managerId = currentUserProfile.id;
        } else if (['teacher', 'consultant'].includes(currentUserProfile.role)) {
            managerId = currentUserProfile.manager_id;
        }

        if (managerId) {
            query = query.eq('manager_id', managerId);
        } else if (currentUserProfile.role !== 'super_admin') {
            loadingMessage.textContent = 'شما به هیچ مدرسه‌ای متصل نیستید.';
            return;
        }

        const { data: subjects, error } = await query.order('created_at', { ascending: false });

        if (error) {
            loadingMessage.textContent = 'خطا در بارگذاری درس‌ها.';
            console.error('Error fetching subjects:', error);
            return;
        }
        if (subjects.length === 0) {
            loadingMessage.textContent = 'هیچ درسی یافت نشد.';
        } else {
            loadingMessage.style.display = 'none';
            subjects.forEach(subject => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${subject.name}</td>
                    <td>${new Date(subject.created_at).toLocaleDateString('fa-IR')}</td>
                    <td class="actions-cell">
                        <button class="btn-icon btn-edit" data-id="${subject.id}" data-name="${subject.name}" title="ویرایش"><i class="fas fa-edit"></i></button>
                        <button class="btn-icon btn-delete" data-id="${subject.id}" title="حذف"><i class="fas fa-trash"></i></button>
                    </td>
                `;
                subjectsTableBody.appendChild(row);
            });
        }
    }

    function showModal(subject = null) {
        if (subject) {
            modalTitle.textContent = 'ویرایش درس';
            subjectIdInput.value = subject.id;
            subjectNameInput.value = subject.name;
        } else {
            modalTitle.textContent = 'افزودن درس جدید';
            subjectForm.reset();
            subjectIdInput.value = '';
        }
        modal.classList.add('is-open');
    }

    function hideModal() {
        modal.classList.remove('is-open');
    }

    subjectForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = subjectNameInput.value.trim();
        const id = subjectIdInput.value;

        if (!name) return alert('لطفاً نام درس را وارد کنید.');

        let managerIdForSubject = null;
        if (currentUserProfile.role === 'admin') {
            managerIdForSubject = currentUserProfile.id;
        } else if (['teacher', 'consultant'].includes(currentUserProfile.role)) {
            managerIdForSubject = currentUserProfile.manager_id;
        } else if (currentUserProfile.role === 'super_admin') {
             alert("ادمین کل نمی‌تواند مستقیماً درس تعریف کند. این کار باید توسط مدیر مدرسه انجام شود.");
             return;
        }
        if(!managerIdForSubject) {
             alert("شما به مدرسه‌ای متصل نیستید و نمی‌توانید درس اضافه کنید.");
             return;
        }

        const subjectData = { name, manager_id: managerIdForSubject };
        const { error } = id
            ? await supabase.from('subjects').update({ name }).eq('id', id)
            : await supabase.from('subjects').insert([subjectData]);

        if (error) {
            console.error('Error saving subject:', error);
            if (error.code === '23505') { // کد خطای مربوط به unique constraint violation
                alert('خطا: درسی با این نام برای این مدرسه قبلاً ثبت شده است. لطفاً نام دیگری انتخاب کنید.');
            } else {
                alert('خطا در ذخیره درس.');
            }
        } else {
            hideModal();
            fetchSubjects();
        }
    });

    subjectsTableBody.addEventListener('click', async (e) => {
        const editButton = e.target.closest('.btn-edit');
        if (editButton) {
            showModal({ id: editButton.dataset.id, name: editButton.dataset.name });
        }
        const deleteButton = e.target.closest('.btn-delete');
        if (deleteButton) {
            const id = deleteButton.dataset.id;
            if (confirm('آیا از حذف این درس مطمئن هستید؟ (تمام آزمون‌های مرتبط نیز حذف خواهند شد)')) {
                const { error } = await supabase.from('subjects').delete().eq('id', id);
                if (error) {
                    alert('خطا در حذف درس.');
                } else {
                    fetchSubjects();
                }
            }
        }
    });

    addSubjectBtn.addEventListener('click', () => showModal());
    cancelBtn.addEventListener('click', hideModal);
    modal.addEventListener('click', (e) => { if (e.target === modal) hideModal(); });

    checkAccessRole().then((hasAccess) => {
        if (hasAccess) fetchSubjects();
    });
});