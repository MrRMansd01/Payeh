document.addEventListener('DOMContentLoaded', async () => {
    let supabase;
    try {
        const res = await fetch('/api/supabase-config');
        if (!res.ok) {
            console.error('Cannot load Supabase config for my-exams page.');
            return;
        }
        const { url, anonKey } = await res.json();
        supabase = window.supabase.createClient(url, anonKey);
    } catch (e) {
        console.error('Supabase init error in my-exams page:', e);
        return;
    }

    const examsTableBody = document.querySelector('#exams-table tbody');
    const loadingMessage = document.getElementById('loading-message');
    let currentUserProfile = null;

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

    async function fetchExams() {
        loadingMessage.textContent = 'در حال بارگذاری آزمون‌ها...';
        const profile = await getCurrentUserProfile();
        if (!profile || profile.role !== 'student' || !profile.class_id) {
            loadingMessage.textContent = 'شما در کلاسی ثبت‌نام نکرده‌اید یا دسترسی لازم را ندارید.';
            return;
        }

        const { data: exams, error } = await supabase
            .from('exams')
            .select('*, subjects(name)')
            .eq('class_id', profile.class_id);

        if (error) {
            loadingMessage.textContent = 'خطا در بارگذاری آزمون‌ها.';
            console.error("Error fetching exams:", error);
            return;
        }

        if (exams.length === 0) {
            loadingMessage.textContent = 'هیچ آزمونی برای کلاس شما تعریف نشده است.';
        } else {
            loadingMessage.style.display = 'none';
            examsTableBody.innerHTML = '';
            exams.forEach(exam => {
                const row = examsTableBody.insertRow();
                row.innerHTML = `
                    <td>${exam.name}</td>
                    <td>${exam.subjects.name}</td>
                    <td>${exam.duration_minutes} دقیقه</td>
                    <td>${new Date(exam.exam_date + 'T00:00:00').toLocaleDateString('fa-IR')}</td>
                    <td class="actions-cell">
                        <a href="/take-exam.html?examId=${exam.id}&examName=${encodeURIComponent(exam.name)}" class="btn btn-primary">شروع آزمون</a>
                    </td>
                `;
            });
        }
    }

    getCurrentUserProfile().then(profile => {
        if (profile) {
            fetchExams();
        }
    });
});
