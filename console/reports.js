document.addEventListener('DOMContentLoaded', async () => {
    let supabase;
    try {
        const res = await fetch('/api/supabase-config');
        if (!res.ok) {
            console.error('Cannot load Supabase config for reports page.');
            return;
        }
        const { url, anonKey } = await res.json();
        supabase = window.supabase.createClient(url, anonKey);
    } catch (e) {
        console.error('Supabase init error in reports page:', e);
        return;
    }

    // DOM Elements
    const studentFilter = document.getElementById('student-filter');
    const subjectFilter = document.getElementById('subject-filter');
    const examFilter = document.getElementById('exam-filter');
    const classFilter = document.getElementById('class-filter');
    const applyFilterBtn = document.getElementById('apply-filter-btn');
    const scoresTableBody = document.querySelector('#scores-table tbody');
    const loadingMessage = document.getElementById('loading-message');
    const chartCanvas = document.getElementById('scores-chart');
    const exportAllBtn = document.getElementById('export-all-btn');

    // Choices.js instances for searchable dropdowns (search inside the opened list)
    let classChoices, studentChoices, subjectChoices, examChoices;

    let scoresChart;
    let currentReportData = [];
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

    async function populateInitialFilters() {
        const profile = await getCurrentUserProfile();
        if (!profile) return;
        
        const managerId = (profile.role === 'admin') ? profile.id : profile.manager_id;

        let baseQuery = (table) => {
            let query = supabase.from(table).select('id, name');
            if (managerId) {
                query = query.eq('manager_id', managerId);
            } else if (profile.role !== 'super_admin') {
                return null; // Don't fetch if not associated
            }
            return query;
        };
        
        const classQuery = baseQuery('classes');
        const subjectQuery = baseQuery('subjects');
        const examQuery = baseQuery('exams');

        const [
            { data: classes }, 
            { data: subjects }, 
            { data: exams }
        ] = await Promise.all([classQuery, subjectQuery, examQuery]);
        
        // Initialize Choices.js for each select (search bar inside dropdown)
        if (!classChoices) {
            classChoices = new Choices(classFilter, {
                searchEnabled: true,
                shouldSort: false,
                itemSelectText: '',
                noResultsText: 'موردی یافت نشد',
            });
        }
        if (!subjectChoices) {
            subjectChoices = new Choices(subjectFilter, {
                searchEnabled: true,
                shouldSort: false,
                itemSelectText: '',
                noResultsText: 'موردی یافت نشد',
            });
        }
        if (!examChoices) {
            examChoices = new Choices(examFilter, {
                searchEnabled: true,
                shouldSort: false,
                itemSelectText: '',
                noResultsText: 'موردی یافت نشد',
            });
        }

        // Set options for each dropdown (including the "all" option)
        const classOptions = [
            { value: 'all', label: 'همه کلاس‌ها', selected: true },
            ...(classes || []).map(c => ({ value: c.id, label: c.name }))
        ];
        const subjectOptions = [
            { value: 'all', label: 'همه درس‌ها', selected: true },
            ...(subjects || []).map(s => ({ value: s.id, label: s.name }))
        ];
        const examOptions = [
            { value: 'all', label: 'همه آزمون‌ها', selected: true },
            ...(exams || []).map(e => ({ value: e.id, label: e.name }))
        ];

        classChoices.clearStore();
        subjectChoices.clearStore();
        examChoices.clearStore();

        classChoices.setChoices(classOptions, 'value', 'label', true);
        subjectChoices.setChoices(subjectOptions, 'value', 'label', true);
        examChoices.setChoices(examOptions, 'value', 'label', true);

        await updateStudentFilter();
    }
    
    async function updateStudentFilter() {
        const selectedClassId = classFilter.value;
        const profile = await getCurrentUserProfile();
        if (!profile) return;
        
        const managerId = (profile.role === 'admin') ? profile.id : profile.manager_id;
        
        let studentQuery = supabase.from('profiles').select('id, name').eq('role', 'student');
        if (managerId) {
            studentQuery = studentQuery.eq('manager_id', managerId);
        }
        if (selectedClassId !== 'all') {
            studentQuery = studentQuery.eq('class_id', selectedClassId);
        }
        
        const { data: students, error } = await studentQuery;
        
        if (!studentChoices) {
            studentChoices = new Choices(studentFilter, {
                searchEnabled: true,
                shouldSort: false,
                itemSelectText: '',
                noResultsText: 'موردی یافت نشد',
            });
        }

        const studentOptions = [
            { value: 'all', label: 'همه دانش‌آموزان', selected: true },
            ...(students || []).map(s => ({ value: s.id, label: s.name }))
        ];

        studentChoices.clearStore();
        studentChoices.setChoices(studentOptions, 'value', 'label', true);
    }


    // *** تابع اصلی گزارش، با محدودیت مدرسه/مدیر ***
    async function renderReport() {
        loadingMessage.style.display = 'block';
        loadingMessage.innerHTML = `
            <i class="fas fa-spinner fa-spin"></i>
            <span>در حال بارگذاری داده‌ها...</span>
        `;
        scoresTableBody.innerHTML = '';
        if (scoresChart) scoresChart.destroy();

        const profile = await getCurrentUserProfile();
        if (!profile) {
            loadingMessage.innerHTML = `
                <i class="fas fa-triangle-exclamation"></i>
                <span>خطا در دریافت اطلاعات کاربر.</span>
            `;
            return;
        }

        const managerId = (profile.role === 'admin') ? profile.id : profile.manager_id;

        // 1. کوئری برای نمرات دستی
        let scoresQuery = supabase.from('scores').select(`
            score,
            profiles!inner(id, name, class_id),
            exams!inner(id, name, exam_date, subjects!inner(id, name))
        `);
        
        // 2. کوئری برای نتایج آزمون آنلاین
        let attemptsQuery = supabase.from('exam_attempts').select(`
            score,
            profiles!inner(id, name, class_id),
            exams!inner(id, name, exam_date, subjects!inner(id, name))
        `).not('finished_at', 'is', null); // فقط آزمون‌های تمام شده

        // محدود کردن داده‌ها به مدرسه/مدیر فعلی (برای جلوگیری از مشاهده مدارس دیگر)
        if (managerId) {
            scoresQuery = scoresQuery.eq('profiles.manager_id', managerId);
            attemptsQuery = attemptsQuery.eq('profiles.manager_id', managerId);
        } else if (profile.role !== 'super_admin') {
            loadingMessage.textContent = 'شناسه مدیر برای شما تنظیم نشده است.';
            return;
        }

        // اعمال فیلترها به هر دو کوئری
        if (studentFilter.value !== 'all') {
            scoresQuery = scoresQuery.eq('profiles.id', studentFilter.value);
            attemptsQuery = attemptsQuery.eq('profiles.id', studentFilter.value);
        }
        if (examFilter.value !== 'all') {
             scoresQuery = scoresQuery.eq('exams.id', examFilter.value);
             attemptsQuery = attemptsQuery.eq('exams.id', examFilter.value);
        }
        if (subjectFilter.value !== 'all') {
             scoresQuery = scoresQuery.eq('exams.subjects.id', subjectFilter.value);
             attemptsQuery = attemptsQuery.eq('exams.subjects.id', subjectFilter.value);
        }
        if (classFilter.value !== 'all') {
             scoresQuery = scoresQuery.eq('profiles.class_id', classFilter.value);
             attemptsQuery = attemptsQuery.eq('profiles.class_id', classFilter.value);
        }
        
        // 3. اجرای هر دو کوئری به صورت همزمان
        const [scoresResponse, attemptsResponse] = await Promise.all([scoresQuery, attemptsQuery]);
        
        if (scoresResponse.error || attemptsResponse.error) {
            loadingMessage.innerHTML = `
                <i class="fas fa-triangle-exclamation"></i>
                <span>خطا در دریافت داده‌ها.</span>
            `;
            console.error("Error fetching report data:", scoresResponse.error || attemptsResponse.error);
            return;
        }
        
        // 4. تبدیل داده‌ها به یک فرمت یکسان
        const manualScores = scoresResponse.data.map(item => ({
            studentName: item.profiles?.name || 'دانش‌آموز حذف شده',
            subjectName: item.exams?.subjects?.name || 'درس حذف شده',
            examName: item.exams?.name || 'آزمون حذف شده',
            score: item.score
        }));

        const onlineScores = attemptsResponse.data.map(item => ({
            studentName: item.profiles?.name || 'دانش‌آموز حذف شده',
            subjectName: item.exams?.subjects?.name || 'درس حذف شده',
            examName: `${item.exams?.name || 'آزمون حذف شده'} (آنلاین)`,
            score: item.score
        }));

        // 5. ترکیب نتایج
        currentReportData = [...manualScores, ...onlineScores];

        if (currentReportData.length === 0) {
            loadingMessage.style.display = 'block';
            loadingMessage.innerHTML = `
                <i class="fas fa-circle-info"></i>
                <span>هیچ آماری برای نمایش در این فیلترها یافت نشد.</span>
            `;
            return;
        }

        loadingMessage.style.display = 'none';
        currentReportData.forEach(item => {
            const row = scoresTableBody.insertRow();
            row.innerHTML = `
                <td>${item.studentName}</td>
                <td>${item.subjectName}</td>
                <td>${item.examName}</td>
                <td>${item.score}</td>
            `;
        });

        renderChart(currentReportData);
    }

    function renderChart(data) {
        if (scoresChart) scoresChart.destroy();
        
        // اگر یک دانش‌آموز فیلتر شده باشد، بر اساس آزمون‌ها نمودار می‌کشیم
        // در غیر این صورت، بر اساس میانگین نمرات دانش‌آموزان
        let labels, scores;
        if (studentFilter.value !== 'all') {
             labels = data.map(item => `${item.subjectName} - ${item.examName}`);
             scores = data.map(item => item.score);
        } else {
            const studentScores = data.reduce((acc, item) => {
                if (!acc[item.studentName]) {
                    acc[item.studentName] = { total: 0, count: 0 };
                }
                acc[item.studentName].total += parseFloat(item.score);
                acc[item.studentName].count++;
                return acc;
            }, {});
            labels = Object.keys(studentScores);
            scores = labels.map(name => (studentScores[name].total / studentScores[name].count).toFixed(2));
        }
        
        scoresChart = new Chart(chartCanvas, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'نمرات',
                    data: scores,
                    backgroundColor: 'rgba(38, 166, 154, 0.6)',
                    borderColor: 'rgba(38, 166, 154, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: { y: { beginAtZero: true, max: 100 } }
            }
        });
    }

    function exportToExcel(data, filename) {
        if (!data || data.length === 0) return alert("هیچ داده‌ای برای خروجی گرفتن وجود ندارد.");
        // داده‌ها از قبل فرمت شده‌اند
        const worksheet = XLSX.utils.json_to_sheet(data);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "گزارش نمرات");
        XLSX.writeFile(workbook, `${filename}.xlsx`);
    }

    applyFilterBtn.addEventListener('click', renderReport);
    exportAllBtn.addEventListener('click', () => exportToExcel(currentReportData, "گزارش_فیلتر_شده"));
    classFilter.addEventListener('change', updateStudentFilter);
    
    checkAccessRole().then(hasAccess => {
        if (hasAccess) {
            populateInitialFilters();
        }
    });
});
