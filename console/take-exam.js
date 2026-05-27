document.addEventListener('DOMContentLoaded', async () => {
    let supabase;
    try {
        const res = await fetch('/api/supabase-config');
        if (!res.ok) {
            console.error('Cannot load Supabase config for take-exam page.');
            return;
        }
        const { url, anonKey } = await res.json();
        supabase = window.supabase.createClient(url, anonKey);
    } catch (e) {
        console.error('Supabase init error in take-exam page:', e);
        return;
    }

    const examTitleEl = document.getElementById('exam-title');
    const examNameDisplay = document.getElementById('exam-name-display');
    const timerEl = document.getElementById('timer');
    const questionsContainer = document.getElementById('questions-container');
    const submitExamBtn = document.getElementById('submit-exam-btn');
    const loadingMessage = document.getElementById('loading-message');

    const urlParams = new URLSearchParams(window.location.search);
    const examId = urlParams.get('examId');
    const examName = decodeURIComponent(urlParams.get('examName'));

    let currentUser = null;
    let timerInterval = null;
    let totalQuestions = 0;
    let cheatTimer = null;
    let isExamSubmitted = false;

    async function initializeExam() {
        if (!examId) {
            loadingMessage.textContent = 'خطا: آزمون مشخص نشده است.';
            return;
        }
        examTitleEl.textContent = `شرکت در آزمون: ${examName}`;
        examNameDisplay.textContent = examName;

        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            window.location.href = '/login.html';
            return;
        }
        currentUser = user;

        const { data: attempts, error: attemptError } = await supabase
            .from('exam_attempts')
            .select('id, finished_at')
            .eq('student_id', currentUser.id)
            .eq('exam_id', examId);

        if (attemptError) {
             loadingMessage.textContent = 'خطا در بررسی سابقه آزمون.';
             return;
        }

        if (attempts && attempts.length > 0 && attempts.some(a => a.finished_at !== null)) {
            questionsContainer.innerHTML = '<p>شما قبلاً این آزمون را به پایان رسانده‌اید.</p>';
            loadingMessage.style.display = 'none';
            submitExamBtn.style.display = 'none';
            if(timerEl) timerEl.style.display = 'none';
            isExamSubmitted = true;
            return;
        }
        
        if (!attempts || attempts.length === 0) {
           await supabase.from('exam_attempts').insert([{ student_id: currentUser.id, exam_id: examId, started_at: new Date() }]);
        }

        const { data: examDetails, error: examError } = await supabase.from('exams').select('duration_minutes').eq('id', examId).single();
        if (examError || !examDetails) {
            loadingMessage.textContent = 'خطا در بارگذاری اطلاعات آزمون.';
            return;
        }

        const { data: questions, error: questionsError } = await supabase.from('questions').select('id, question_text, options, image_url').eq('exam_id', examId);
        if (questionsError || !questions || questions.length === 0) {
            loadingMessage.textContent = 'سوالی برای این آزمون یافت نشد. لطفاً با مدیر تماس بگیرید.';
            return;
        }
        
        totalQuestions = questions.length;
        renderQuestions(questions);
        startTimer(examDetails.duration_minutes);
        setupVisibilityChecks(); 

        loadingMessage.style.display = 'none';
        submitExamBtn.style.display = 'block';
    }
    
    function setupVisibilityChecks() {
        document.addEventListener('visibilitychange', () => {
            if (isExamSubmitted) return;
            if (document.hidden) {
                cheatTimer = setTimeout(() => {
                    alert('شما بیش از ۱۰ ثانیه از صفحه آزمون خارج شدید. به دلیل احتمال تقلب، آزمون شما به صورت خودکار ثبت می‌شود.');
                    submitExam();
                }, 10000);
            } else {
                clearTimeout(cheatTimer);
            }
        });
    }

    function renderQuestions(questions) {
        questionsContainer.innerHTML = '';
        questions.forEach((q, index) => {
            const questionEl = document.createElement('div');
            questionEl.className = 'question-block';
            questionEl.dataset.questionId = q.id;
            
            const optionsHtml = Object.entries(q.options).map(([key, value]) => `
                <label class="option" for="q${q.id}-${key}">
                    <input type="radio" id="q${q.id}-${key}" name="question-${q.id}" value="${key}">
                    <span class="option-text">${value.text || ''}</span>
                    ${value.imageUrl ? `<img src="${value.imageUrl}" alt="Option Image" class="option-image">` : ''}
                </label>
            `).join('');

            questionEl.innerHTML = `
                <p class="question-text">${index + 1}. ${q.question_text}</p>
                ${q.image_url ? `<img src="${q.image_url}" alt="Question Image" class="question-image">` : ''}
                <div class="options">${optionsHtml}</div>
            `;
            questionsContainer.appendChild(questionEl);
        });
    }

    function startTimer(durationMinutes) {
        if (!durationMinutes) {
            timerEl.textContent = "بدون محدودیت زمان";
            return;
        }
        let timeRemaining = durationMinutes * 60;
        timerInterval = setInterval(() => {
            const minutes = Math.floor(timeRemaining / 60);
            const seconds = timeRemaining % 60;
            timerEl.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            if (timeRemaining <= 0) {
                clearInterval(timerInterval);
                alert('زمان آزمون به پایان رسید! پاسخ‌های شما ثبت می‌شود.');
                submitExam();
            }
            timeRemaining--;
        }, 1000);
    }

    async function submitExam() {
        if (isExamSubmitted) return; 
        isExamSubmitted = true;
        
        clearTimeout(cheatTimer);
        clearInterval(timerInterval);
        submitExamBtn.disabled = true;
        submitExamBtn.textContent = 'در حال ثبت...';
        
        const { data: correctAnswers, error: correctAnswersError } = await supabase.from('questions').select('id, correct_option').eq('exam_id', examId);
        if (correctAnswersError) {
            alert('خطا در دریافت پاسخ‌های صحیح. ثبت متوقف شد.');
            isExamSubmitted = false;
            submitExamBtn.disabled = false;
            submitExamBtn.textContent = 'ثبت نهایی و مشاهده نتیجه';
            return;
        }
        
        const correctMap = new Map(correctAnswers.map(ans => [ans.id.toString(), ans.correct_option]));
        let correctCount = 0;

        const answersToInsert = [];
        document.querySelectorAll('.question-block').forEach(block => {
            const selectedOption = block.querySelector('input[type="radio"]:checked');
            if (selectedOption) {
                const questionId = block.dataset.questionId;
                const isCorrect = correctMap.get(questionId) === selectedOption.value;
                if (isCorrect) correctCount++;

                answersToInsert.push({
                    student_id: currentUser.id,
                    question_id: parseInt(questionId),
                    chosen_option: selectedOption.value,
                    is_correct: isCorrect,
                    exam_id: examId
                });
            }
        });

        console.log("Data to be inserted:", answersToInsert); // لاگ برای دیباگ

        if (answersToInsert.length > 0) {
            const { error: insertError } = await supabase.from('student_answers').insert(answersToInsert);
            if (insertError) {
                alert('خطا در ثبت پاسخ‌ها. لطفاً دوباره تلاش کنید.');
                console.error('Answer insert error:', insertError);
                isExamSubmitted = false;
                submitExamBtn.disabled = false;
                submitExamBtn.textContent = 'ثبت نهایی و مشاهده نتیجه';
                return;
            }
        }
        
        const finalScore = totalQuestions > 0 ? (correctCount / totalQuestions) * 100 : 0;
        
        const { error: updateError } = await supabase
            .from('exam_attempts')
            .update({ finished_at: new Date(), score: finalScore.toFixed(2) })
            .eq('student_id', currentUser.id)
            .eq('exam_id', examId);
            
        if (updateError) console.error("Error finalizing exam attempt:", updateError);

        alert(`آزمون شما با موفقیت ثبت شد.\nنمره شما: ${finalScore.toFixed(2)} از 100`);
        window.location.href = '/report-card.html';
    }

    submitExamBtn.addEventListener('click', () => {
        if (confirm('آیا از ثبت نهایی آزمون و پایان دادن به آن مطمئن هستید؟')) {
            submitExam();
        }
    });

    initializeExam();
});