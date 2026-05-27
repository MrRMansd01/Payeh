document.addEventListener('DOMContentLoaded', async () => {
    let supabase;
    try {
        const res = await fetch('/api/supabase-config');
        if (!res.ok) {
            console.error('Cannot load Supabase config for exams page.');
            return;
        }
        const { url, anonKey } = await res.json();
        supabase = window.supabase.createClient(url, anonKey);
    } catch (e) {
        console.error('Supabase init error in exams page:', e);
        return;
    }

    // DOM Elements
    const addExamBtn = document.getElementById('add-exam-btn');
    const modal = document.getElementById('exam-modal');
    const modalTitle = document.getElementById('modal-title');
    const cancelBtn = document.getElementById('cancel-btn');
    const examForm = document.getElementById('exam-form');
    const examIdInput = document.getElementById('exam-id');
    const examNameInput = document.getElementById('exam-name');
    const subjectSelect = document.getElementById('subject-select');
    const examClassSelect = document.getElementById('exam-class-select');
    const examDateInput = document.getElementById('exam-date');
    const examsTableBody = document.querySelector('#exams-table tbody');
    const loadingMessage = document.getElementById('loading-message');
    const durationInput = document.getElementById('exam-duration');
    
    let currentUserProfile = null;
    flatpickr(examDateInput, { locale: "fa", dateFormat: "Y-m-d" });

    // Fetches the profile of the currently logged-in user
    async function getCurrentUserProfile() {
        if (currentUserProfile) return currentUserProfile;
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            window.location.href = '/login.html';
            return null;
        }
        const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
        currentUserProfile = profile;
        return profile;
    }

    // Populate dropdowns for subjects and classes
    async function populateDropdowns() {
        const profile = await getCurrentUserProfile();
        const managerId = profile.role === 'admin' ? profile.id : profile.manager_id;
        if (!managerId && profile.role !== 'super_admin') return;

        let subjectQuery = supabase.from('subjects').select('id, name');
        let classQuery = supabase.from('classes').select('id, name');

        if (managerId) {
            subjectQuery = subjectQuery.eq('manager_id', managerId);
            classQuery = classQuery.eq('manager_id', managerId);
        }

        const [{ data: subjects }, { data: classes }] = await Promise.all([subjectQuery, classQuery]);

        subjectSelect.innerHTML = '<option value="">انتخاب کنید...</option>';
        if (subjects) subjects.forEach(s => subjectSelect.add(new Option(s.name, s.id)));

        examClassSelect.innerHTML = '<option value="">انتخاب کنید...</option>';
        if (classes) classes.forEach(c => examClassSelect.add(new Option(c.name, c.id)));
    }

    // Fetch and display all exams
// کد کامل و جدید برای جایگزینی کل تابع fetchExams
    async function fetchExams() {
        loadingMessage.textContent = 'در حال بارگذاری آزمون‌ها...';
        const profile = await getCurrentUserProfile();
        if (!profile) return;

        const managerId = profile.role === 'admin' ? profile.id : profile.manager_id;

        // کوئری نهایی و صریح برای دریافت اطلاعات
        let query = supabase.from('exams').select(`
            id, 
            name, 
            exam_date, 
            duration_minutes,
            subject_id,
            class_id,
            subjects ( name ),
            classes ( name )
        `);
        
        if (managerId) {
            query = query.eq('manager_id', managerId);
        } else if (profile.role !== 'super_admin') {
            examsTableBody.innerHTML = '<tr><td colspan="6">شما به مدرسه‌ای تخصیص داده نشده‌اید.</td></tr>';
            return;
        }
        
        const { data: exams, error } = await query.order('exam_date', { ascending: false });
        
        examsTableBody.innerHTML = '';
        if (error) {
            console.error("Error fetching exams:", error);
            examsTableBody.innerHTML = `<tr><td colspan="6">خطا در بارگذاری آزمون‌ها: ${error.message}</td></tr>`;
            return;
        }
        
        if (exams.length === 0) {
            examsTableBody.innerHTML = '<tr><td colspan="6">هیچ آزمونی یافت نشد.</td></tr>';
            loadingMessage.style.display = 'none';
        } else {
            loadingMessage.style.display = 'none';
            exams.forEach(exam => {
                const row = examsTableBody.insertRow();

                // منطق نمایش اطلاعات با بررسی دقیق وجود کلاس و درس
                const subjectName = exam.subjects ? exam.subjects.name : '<span style="color: #f44336;">درس یافت نشد</span>';
                const className = exam.classes ? exam.classes.name : '<span style="color: #f44336;">کلاس یافت نشد</span>';

                row.innerHTML = `
                    <td>${exam.name}</td>
                    <td>${subjectName}</td>
                    <td>${className}</td>
                    <td>${exam.duration_minutes || '-'}</td>
                    <td>${new Date(exam.exam_date + 'T00:00:00').toLocaleDateString('fa-IR')}</td>
                    <td class="actions-cell">
                        <button class="btn-icon btn-design-questions" data-id="${exam.id}" data-name="${encodeURIComponent(exam.name)}" title="طراحی سوالات"><i class="fas fa-file-alt"></i></button>
                        <button class="btn-icon btn-edit" data-exam='${JSON.stringify(exam)}' title="ویرایش"><i class="fas fa-edit"></i></button>
                        <button class="btn-icon btn-delete" data-id="${exam.id}" title="حذف"><i class="fas fa-trash"></i></button>
                    </td>
                `;
            });
        }
    }

    // Show the modal for adding or editing an exam
    function showModal(exam = null) {
        modalTitle.textContent = exam ? 'ویرایش آزمون' : 'افزودن آزمون جدید';
        examIdInput.value = exam ? exam.id : '';
        examNameInput.value = exam ? exam.name : '';
        subjectSelect.value = exam ? exam.subject_id : '';
        examClassSelect.value = exam ? exam.class_id : '';
        durationInput.value = exam ? exam.duration_minutes : '';
        flatpickr(examDateInput, { defaultDate: exam ? exam.exam_date : new Date(), locale: 'fa' });
        modal.classList.add('is-open');
    }

    // Handle form submission
    examForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const profile = await getCurrentUserProfile();
        if (!profile) return;
        const managerId = profile.role === 'admin' ? profile.id : profile.manager_id;
        
        const examData = {
            name: examNameInput.value.trim(),
            subject_id: subjectSelect.value,
            class_id: examClassSelect.value,
            exam_date: examDateInput.value,
            duration_minutes: parseInt(durationInput.value, 10) || null,
            manager_id: managerId
        };
        
        if (!examData.name || !examData.subject_id || !examData.exam_date || !examData.class_id) {
            return alert('تمام فیلدهای ستاره‌دار الزامی هستند.');
        }

        const id = examIdInput.value;
        const { error } = id
            ? await supabase.from('exams').update(examData).eq('id', id)
            : await supabase.from('exams').insert([examData]);

        if (error) {
            alert('خطا در ذخیره آزمون.');
            console.error("Error saving exam:", error);
        } else {
            alert('آزمون با موفقیت ذخیره شد.');
            modal.classList.remove('is-open');
            fetchExams();
        }
    });
    
    // Event delegation for table buttons
    examsTableBody.addEventListener('click', async e => {
        const designBtn = e.target.closest('.btn-design-questions');
        if (designBtn) {
            window.location.href = `/create-exam.html?examId=${designBtn.dataset.id}&examName=${encodeURIComponent(designBtn.dataset.name)}`;
        }
        
        const editBtn = e.target.closest('.btn-edit');
        if (editBtn) {
            showModal(JSON.parse(editBtn.dataset.exam));
        }

        const deleteBtn = e.target.closest('.btn-delete');
        if (deleteBtn && confirm('آیا از حذف این آزمون مطمئن هستید؟')) {
            const { error } = await supabase.from('exams').delete().eq('id', deleteBtn.dataset.id);
            if (error) alert('خطا در حذف آزمون.');
            else fetchExams();
        }
    });

    // --- Initial Load & Event Listeners ---
    addExamBtn.addEventListener('click', () => showModal());
    cancelBtn.addEventListener('click', () => modal.classList.remove('is-open'));
    modal.addEventListener('click', (e) => { if(e.target === modal) modal.classList.remove('is-open'); });
    
    getCurrentUserProfile().then(profile => {
        if (profile) {
            populateDropdowns();
            fetchExams();
        }
    });
});
