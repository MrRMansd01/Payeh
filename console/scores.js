document.addEventListener('DOMContentLoaded', async () => {
    let supabase;
    try {
        const res = await fetch('/api/supabase-config');
        if (!res.ok) {
            console.error('Cannot load Supabase config for scores page.');
            return;
        }
        const { url, anonKey } = await res.json();
        supabase = window.supabase.createClient(url, anonKey);
    } catch (e) {
        console.error('Supabase init error in scores page:', e);
        return;
    }

    const subjectSelect = document.getElementById('subject-select');
    const examSelect = document.getElementById('exam-select');
    const studentsTableContainer = document.getElementById('students-table-container');
    const studentsTableBody = document.querySelector('#students-table tbody');
    const loadingMessage = document.getElementById('loading-message');
    const scoresForm = document.getElementById('scores-form');

    let currentUserProfile = null;

    // Choices.js instances برای سرچ داخل کشوها
    let subjectChoices = null;
    let examChoices = null;

    async function getCurrentUserProfile() {
        if (currentUserProfile) return currentUserProfile;
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error || !user) {
            window.location.href = '/login.html';
            return null;
        }
        const { data: profile, error: profileError } = await supabase.from('profiles').select('id, role, manager_id').eq('id', user.id).single();
        if (profileError) {
            console.error('Error fetching current user profile:', profileError);
            return null;
        }
        currentUserProfile = profile;
        return profile;
    }

    async function checkAccessRole() {
        const profile = await getCurrentUserProfile();
        if (!profile) return false;
        // Corrected: Added 'super_admin' to the list of allowed roles
        const allowedRoles = ['admin', 'teacher', 'consultant', 'super_admin'];
        if (!allowedRoles.includes(profile.role)) {
            alert('شما دسترسی لازم برای مشاهده این صفحه را ندارید.');
            window.location.href = '/home.html';
            return false;
        }
        return true;
    }

    async function populateSubjectsDropdown() {
        const profile = await getCurrentUserProfile();
        if (!profile) return;
        
        let query = supabase.from('subjects').select('id, name');
        let managerId = (profile.role === 'admin') ? profile.id : profile.manager_id;
        
        if (managerId) {
            query = query.eq('manager_id', managerId);
        } else if (profile.role !== 'super_admin') {
            subjectSelect.disabled = true;
            return;
        }

        const { data: subjects, error } = await query;
        if (error) return console.error('Error fetching subjects:', error);

        const subjectOptions = (subjects || []).map(s => ({
            value: s.id,
            label: s.name
        }));

        if (!subjectChoices) {
            subjectChoices = new Choices(subjectSelect, {
                searchEnabled: true,
                itemSelectText: '',
                noResultsText: 'موردی یافت نشد'
            });
            subjectChoices.setChoices(subjectOptions, 'value', 'label', true);
        } else {
            subjectChoices.clearStore();
            subjectChoices.setChoices(subjectOptions, 'value', 'label', true);
        }
    }

    subjectSelect.addEventListener('change', async () => {
        const subjectId = subjectSelect.value;

        // ریست لیست آزمون‌ها
        examSelect.innerHTML = '<option value="">انتخاب آزمون...</option>';
        examSelect.disabled = true;
        if (examChoices) {
            examChoices.clearStore();
            examChoices.disable();
        }
        studentsTableContainer.style.display = 'none';
        
        if (!subjectId) return;

        const { data: exams, error } = await supabase.from('exams').select('id, name').eq('subject_id', subjectId);
        if (error) return console.error('Error fetching exams:', error);

        const examOptions = (exams || []).map(e => ({
            value: e.id,
            label: e.name
        }));

        if (!examChoices) {
            examChoices = new Choices(examSelect, {
                searchEnabled: true,
                itemSelectText: '',
                noResultsText: 'موردی یافت نشد'
            });
        } else {
            examChoices.clearStore();
        }
        examChoices.setChoices(examOptions, 'value', 'label', true);

        examSelect.disabled = false;
        examChoices.enable();
    });

    examSelect.addEventListener('change', async () => {
        const examId = examSelect.value;
        if (!examId) {
            studentsTableContainer.style.display = 'none';
            return;
        }

        loadingMessage.textContent = 'در حال بارگذاری لیست دانش‌آموزان...';
        studentsTableContainer.style.display = 'block';
        studentsTableBody.innerHTML = '';
        
        const profile = await getCurrentUserProfile();
        if (!profile) return;
        
        let managerId = (profile.role === 'admin') ? profile.id : profile.manager_id;
        let studentsQuery = supabase.from('profiles').select('id, name, username').eq('role', 'student');

        if (managerId) {
            studentsQuery = studentsQuery.eq('manager_id', managerId);
        } else if (profile.role !== 'super_admin') {
             loadingMessage.textContent = 'هیچ مدیری برای شما تعریف نشده است.';
             return;
        }

        const [studentsResponse, scoresResponse] = await Promise.all([
            studentsQuery,
            supabase.from('scores').select('student_id, score').eq('exam_id', examId)
        ]);

        if (studentsResponse.error || scoresResponse.error) {
            loadingMessage.textContent = 'خطا در بارگذاری اطلاعات.';
            return;
        }
        
        const students = studentsResponse.data;
        const scoresMap = new Map(scoresResponse.data.map(s => [s.student_id, s.score]));

        if (students.length === 0) {
            loadingMessage.textContent = 'هیچ دانش‌آموزی در این مدرسه یافت نشد.';
        } else {
            loadingMessage.style.display = 'none';
            students.forEach(student => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${student.name}</td>
                    <td>${student.username || 'N/A'}</td>
                    <td><input type="number" class="score-input" data-student-id="${student.id}" value="${scoresMap.get(student.id) || ''}" min="0" max="100" step="0.25" placeholder="وارد کنید"></td>
                `;
                studentsTableBody.appendChild(row);
            });
        }
    });

    scoresForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const examId = examSelect.value;
        if (!examId) return alert('لطفا یک آزمون را انتخاب کنید.');

        const scoresToUpsert = Array.from(document.querySelectorAll('.score-input'))
            .filter(input => input.value !== null && input.value !== '')
            .map(input => ({
                exam_id: examId,
                student_id: input.dataset.studentId,
                score: parseFloat(input.value)
            }));

        if (scoresToUpsert.length === 0) return alert('هیچ نمره‌ای برای ذخیره وارد نشده است.');

        const { error } = await supabase.from('scores').upsert(scoresToUpsert, { onConflict: 'exam_id, student_id' });

        if (error) {
            console.error('Error saving scores:', error);
            alert('خطا در ذخیره نمرات.');
        } else {
            alert('نمرات با موفقیت ذخیره شدند.');
        }
    });

    checkAccessRole().then(hasAccess => {
        if (hasAccess) populateSubjectsDropdown();
    });
});

