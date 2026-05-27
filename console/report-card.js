document.addEventListener('DOMContentLoaded', async () => {
    let supabase;
    try {
        const res = await fetch('/api/supabase-config');
        if (!res.ok) {
            console.error('Cannot load Supabase config for report-card page.');
            return;
        }
        const { url, anonKey } = await res.json();
        supabase = window.supabase.createClient(url, anonKey);
    } catch (e) {
        console.error('Supabase init error in report-card page:', e);
        return;
    }

    // DOM Elements
    const avgScoreEl = document.getElementById('avg-score');
    const examCountEl = document.getElementById('exam-count');
    const maxScoreEl = document.getElementById('max-score');
    const minScoreEl = document.getElementById('min-score');
    const chartCanvas = document.getElementById('progress-chart');
    const scoresTableBody = document.querySelector('#scores-table tbody');
    const loadingMessage = document.getElementById('loading-message');
    
    let progressChart;

    // Fetch and display student's report card
    async function loadReportCard() {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            window.location.href = '/login.html';
            return;
        }

        loadingMessage.textContent = 'در حال بارگذاری کارنامه...';
        
        // Fetch both manually entered scores and online exam results in parallel
        const [scoresResponse, examAttemptsResponse] = await Promise.all([
            supabase
                .from('scores')
                .select('score, exams!inner(name, exam_date, subjects!inner(name))')
                .eq('student_id', user.id),
            // تغییر ۲: کد به اشتباه از جدولی به نام exam_results می‌خواند که وجود ندارد.
            // این مورد به exam_attempts تغییر کرد تا نتایج آزمون‌های آنلاین را بخواند.
            supabase
                .from('exam_attempts')
                .select('score, exams!inner(name, exam_date, subjects!inner(name))')
                .eq('student_id', user.id)
                .not('finished_at', 'is', null) // فقط آزمون‌های تمام شده را نشان بده
        ]);

        if (scoresResponse.error || examAttemptsResponse.error) {
            loadingMessage.textContent = 'خطا در بارگذاری اطلاعات.';
            console.error('Error fetching scores:', scoresResponse.error || examAttemptsResponse.error);
            return;
        }

        // Map data from 'scores' table to a consistent format
        const manualScores = scoresResponse.data.map(item => ({
            subjectName: item.exams.subjects.name,
            examName: item.exams.name,
            date: item.exams.exam_date,
            score: item.score
        }));

        // Map data from 'exam_attempts' table to a consistent format
        const onlineResults = examAttemptsResponse.data.map(item => ({
            subjectName: item.exams.subjects.name,
            examName: `${item.exams.name} (آنلاین)`,
            date: item.exams.exam_date,
            score: item.score
        }));

        // Combine and sort all results by date
        const allResults = [...manualScores, ...onlineResults]
            .filter(item => item.score !== null) // فقط نتایجی که نمره دارند را در نظر بگیر
            .sort((a, b) => new Date(a.date) - new Date(b.date));

        if (allResults.length === 0) {
            loadingMessage.textContent = 'شما هنوز در هیچ آزمونی شرکت نکرده‌اید یا نمره‌ای برای شما ثبت نشده است.';
            // مقادیر کارت‌های خلاصه را صفر یا خط تیره قرار می‌دهیم
            examCountEl.textContent = '0';
            avgScoreEl.textContent = '-';
            maxScoreEl.textContent = '-';
            minScoreEl.textContent = '-';
            return;
        }

        loadingMessage.style.display = 'none';
        scoresTableBody.innerHTML = '';
        
        // Populate table with combined data
        allResults.forEach(item => {
            const row = scoresTableBody.insertRow();
            row.innerHTML = `
                <td>${item.subjectName}</td>
                <td>${item.examName}</td>
                <td>${new Date(item.date + 'T00:00:00').toLocaleDateString('fa-IR')}</td>
                <td>${item.score}</td>
            `;
        });
        
        // Calculate and display summary stats from combined data
        const scoreValues = allResults.map(s => parseFloat(s.score));
        const totalExams = scoreValues.length;
        const sumOfScores = scoreValues.reduce((acc, score) => acc + score, 0);
        const avgScore = totalExams > 0 ? (sumOfScores / totalExams).toFixed(2) : 0;
        const maxScore = totalExams > 0 ? Math.max(...scoreValues) : 0;
        const minScore = totalExams > 0 ? Math.min(...scoreValues) : 0;

        examCountEl.textContent = totalExams;
        avgScoreEl.textContent = avgScore;
        maxScoreEl.textContent = maxScore;
        minScoreEl.textContent = minScore;
        
        // Render progress chart with combined data
        renderProgressChart(allResults);
    }

    // Render the line chart for progress
    function renderProgressChart(data) {
        if (progressChart) {
            progressChart.destroy();
        }

        const labels = data.map(item => `${item.subjectName} - ${item.examName.replace(' (آنلاین)', '')}`);
        const scores = data.map(item => item.score);

        progressChart = new Chart(chartCanvas, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'روند نمرات',
                    data: scores,
                    fill: true,
                    backgroundColor: 'rgba(38, 166, 154, 0.2)',
                    borderColor: 'rgba(38, 166, 154, 1)',
                    tension: 0.1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100
                    }
                }
            }
        });
    }

    // Initial Load
    loadReportCard();
});