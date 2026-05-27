document.addEventListener('DOMContentLoaded', async () => {
    let supabase;
    try {
        const res = await fetch('/api/supabase-config');
        if (!res.ok) {
            console.error('Cannot load Supabase config for create-exam page.');
            return;
        }
        const { url, anonKey } = await res.json();
        supabase = window.supabase.createClient(url, anonKey);
    } catch (e) {
        console.error('Supabase init error in create-exam page:', e);
        return;
    }

    const examTitleHeader = document.getElementById('exam-title-header');
    const questionsList = document.getElementById('questions-list');
    const addQuestionBtn = document.getElementById('add-question-btn');
    const modal = document.getElementById('question-modal');
    const cancelBtn = document.getElementById('cancel-btn');
    const questionForm = document.getElementById('question-form');
    const loadingMessage = document.getElementById('loading-questions');
    const uploadImageBtn = document.getElementById('upload-image-btn');
    const imageUploadInput = document.getElementById('question-image-upload');
    const imagePreview = document.getElementById('image-preview');

    let uploadedImageUrl = null;
    let optionImageUrls = { A: null, B: null, C: null, D: null };
    let editingQuestionId = null;

    const urlParams = new URLSearchParams(window.location.search);
    const examId = urlParams.get('examId');
    const examName = decodeURIComponent(urlParams.get('examName'));

    if (!examId || !examName) {
        alert('اطلاعات آزمون نامعتبر است.');
        window.location.href = '/exams.html';
        return;
    }
    examTitleHeader.textContent += ` ${examName}`;

    async function fetchQuestions() {
        loadingMessage.textContent = 'در حال بارگذاری سوالات...';
        const { data, error } = await supabase.from('questions').select('*').eq('exam_id', examId);
        if (error) {
            loadingMessage.textContent = 'خطا در بارگذاری سوالات.';
            return;
        }
        questionsList.innerHTML = '';
        if (data.length === 0) {
            loadingMessage.style.display = 'block';
            loadingMessage.textContent = 'هنوز سوالی برای این آزمون طراحی نشده است.';
        } else {
            loadingMessage.style.display = 'none';
            data.forEach(q => {
                const card = document.createElement('div');
                card.className = 'question-card';
                card.innerHTML = `
                    <p><strong>سوال:</strong> ${q.question_text}</p>
                    ${q.image_url ? `<img src="${q.image_url}" alt="تصویر سوال" class="question-image">` : ''}
                    <ul>
                        ${Object.entries(q.options).map(([key, value]) => `
                            <li>${key}) ${value.text || ''}
                                ${value.imageUrl ? `<img src="${value.imageUrl}" class="option-image" style="max-width:100px;">` : ''}
                            </li>`).join('')}
                    </ul>
                    <p><strong>پاسخ صحیح:</strong> گزینه ${q.correct_option}</p>
                    <div class="actions-cell">
                        <button class="btn-icon btn-edit" data-question='${JSON.stringify(q)}'><i class="fas fa-edit"></i></button>
                        <button class="btn-icon btn-delete" data-id="${q.id}"><i class="fas fa-trash"></i></button>
                    </div>
                `;
                questionsList.appendChild(card);
            });
        }
    }

    function showModal(question = null) {
        questionForm.reset();
        editingQuestionId = question ? question.id : null;
        document.getElementById('modal-title').textContent = question ? 'ویرایش سوال' : 'سوال جدید';
        
        uploadedImageUrl = question ? question.image_url : null;
        imagePreview.style.display = question && question.image_url ? 'block' : 'none';
        imagePreview.src = question ? question.image_url : '';

        ['A', 'B', 'C', 'D'].forEach(opt => {
            const optionData = question ? question.options[opt] : null;
            document.getElementById(`option-${opt.toLowerCase()}-text`).value = optionData?.text || '';
            optionImageUrls[opt] = optionData?.imageUrl || null;
            const previewContainer = document.getElementById(`option-${opt.toLowerCase()}-preview-container`);
            previewContainer.innerHTML = optionData?.imageUrl ? `<img src="${optionData.imageUrl}" class="option-preview">` : '';
        });

        if(question) document.getElementById('correct-option').value = question.correct_option;

        modal.classList.add('is-open');
    }

    function hideModal() {
        modal.classList.remove('is-open');
    }

    async function handleImageUpload(file, isOption = false, optionKey = null) {
        if (!file) return null;
        try {
            const fileName = `public/${Date.now()}-${file.name}`;
            const { error } = await supabase.storage.from('question_images').upload(fileName, file);
            if (error) throw error;
            const { data } = supabase.storage.from('question_images').getPublicUrl(fileName);
            return data.publicUrl;
        } catch (error) {
            alert('خطا در آپلود عکس.');
            console.error(error);
            return null;
        }
    }
    
    uploadImageBtn.addEventListener('click', () => imageUploadInput.click());
    imageUploadInput.addEventListener('change', async (e) => {
        uploadedImageUrl = await handleImageUpload(e.target.files[0]);
        if(uploadedImageUrl) {
            imagePreview.src = uploadedImageUrl;
            imagePreview.style.display = 'block';
        }
    });

    document.querySelectorAll('.upload-option-image-btn').forEach(btn => {
        btn.addEventListener('click', () => document.getElementById(`option-${btn.dataset.option.toLowerCase()}-image-upload`).click());
    });
    
    document.querySelectorAll('.option-image-upload').forEach(input => {
        input.addEventListener('change', async (e) => {
            const optionKey = e.target.dataset.option;
            const url = await handleImageUpload(e.target.files[0], true, optionKey);
            if(url) {
                optionImageUrls[optionKey] = url;
                document.getElementById(`option-${optionKey.toLowerCase()}-preview-container`).innerHTML = `<img src="${url}" class="option-preview">`;
            }
        });
    });

    questionForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const questionData = {
            exam_id: examId,
            question_text: document.getElementById('question-text').value,
            options: {
                A: { text: document.getElementById('option-a-text').value, imageUrl: optionImageUrls.A },
                B: { text: document.getElementById('option-b-text').value, imageUrl: optionImageUrls.B },
                C: { text: document.getElementById('option-c-text').value, imageUrl: optionImageUrls.C },
                D: { text: document.getElementById('option-d-text').value, imageUrl: optionImageUrls.D },
            },
            correct_option: document.getElementById('correct-option').value,
            image_url: uploadedImageUrl
        };
        
        const { error } = editingQuestionId 
            ? await supabase.from('questions').update(questionData).eq('id', editingQuestionId)
            : await supabase.from('questions').insert([questionData]);

        if (error) {
            alert('خطا در ذخیره سوال.');
            console.error(error);
        } else {
            hideModal();
            fetchQuestions();
        }
    });

    questionsList.addEventListener('click', async (e) => {
        const editButton = e.target.closest('.btn-edit');
        if (editButton) {
            showModal(JSON.parse(editButton.dataset.question));
        }

        const deleteButton = e.target.closest('.btn-delete');
        if (deleteButton && confirm('آیا از حذف این سوال مطمئن هستید؟')) {
            const { error } = await supabase.from('questions').delete().eq('id', deleteButton.dataset.id);
            if (error) alert('خطا در حذف سوال.');
            else fetchQuestions();
        }
    });

    addQuestionBtn.addEventListener('click', () => showModal());
    cancelBtn.addEventListener('click', hideModal);
    modal.addEventListener('click', e => { if (e.target === modal) hideModal(); });

    fetchQuestions();
});

