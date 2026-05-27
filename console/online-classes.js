document.addEventListener('DOMContentLoaded', async () => {
    let supabase;
    try {
        const res = await fetch('/api/supabase-config');
        if (!res.ok) {
            console.error('Cannot load Supabase config for online-classes page.');
            return;
        }
        const { url, anonKey } = await res.json();
        supabase = window.supabase.createClient(url, anonKey);
    } catch (e) {
        console.error('Supabase init error in online-classes page:', e);
        return;
    }

    // DOM Elements
    const addSessionBtn = document.getElementById('add-session-btn');
    const modal = document.getElementById('session-modal');
    const modalTitle = document.getElementById('modal-title');
    const cancelBtn = document.getElementById('cancel-btn');
    const sessionForm = document.getElementById('session-form');
    const sessionIdInput = document.getElementById('session-id');
    const loadingMessage = document.getElementById('loading-message');
    const teacherToolbar = document.getElementById('teacher-toolbar');
    const calendarBody = document.getElementById('calendar-body');
    const attendanceModal = document.getElementById('attendance-modal');
    const randomCheckBtn = document.getElementById('random-check-btn');

    let currentUserProfile = null;
    let realtimeChannel = null;
    let sessionStateChannel = null;

    const dayMap = { "saturday": 6, "sunday": 0, "monday": 1, "tuesday": 2, "wednesday": 3, "thursday": 4, "friday": 5 };
    const dayNames = ["شنبه", "یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه"];

    async function getCurrentUserProfile() {
        if (currentUserProfile) return currentUserProfile;
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !session) {
            window.location.href = '/login.html';
            return null;
        }
        const { data: profile, error: profileError } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
        if (profileError) {
            console.error('Error fetching profile:', profileError);
            await supabase.auth.signOut();
            window.location.href = '/login.html';
            return null;
        }
        currentUserProfile = profile;
        return profile;
    }
    
    function renderCalendarShell() {
        document.getElementById('calendar-days-header').innerHTML = dayNames.map(name => `<div class="day-header">${name}</div>`).join('');
        calendarBody.innerHTML = dayNames.map(name => `<div class="day-cell" id="day-${name}"></div>`).join('');
    }

    function renderSessionsInCalendar(sessions) {
        document.querySelectorAll('.day-cell').forEach(cell => cell.innerHTML = '');
        if (sessions && sessions.length > 0) {
            sessions.forEach(session => {
                if (session.session_days) {
                    session.session_days.forEach(dayName => {
                        const dayIndex = Object.keys(dayMap).indexOf(dayName);
                        if (dayIndex === -1) return;
                        const dayCell = document.getElementById(`day-${dayNames[dayIndex]}`);
                        if (dayCell) {
                            const card = document.createElement('div');
                            card.className = 'session-card-mini';
                            card.dataset.session = JSON.stringify(session);
                            const statusIndicator = session.is_active ? '<span class="status-dot active"></span>' : '<span class="status-dot"></span>';
                            card.innerHTML = `${statusIndicator}<h4>${session.title}</h4><p><strong>کلاس:</strong> ${session.class.name}</p><p><strong>ساعت:</strong> ${session.session_time.substring(0, 5)}</p>`;
                            dayCell.appendChild(card);
                        }
                    });
                }
            });
        }
    }

    async function fetchAndRender() {
        loadingMessage.style.display = 'block';
        const profile = await getCurrentUserProfile();
        if (!profile) return;

        let query = supabase.from('online_sessions').select('*, class:classes(id, name)');
        
        if (profile.role === 'student') {
            if (profile.class_id) {
                query = query.eq('class_id', profile.class_id);
            } else {
                loadingMessage.textContent = 'شما در حال حاضر در هیچ کلاسی ثبت‌نام نشده‌اید.';
                calendarBody.innerHTML = '';
                return;
            }
        } 
        else if (['admin', 'teacher', 'consultant'].includes(profile.role)) {
            const managerId = profile.role === 'admin' ? profile.id : profile.manager_id;
            if (managerId) {
                query = query.eq('manager_id', managerId);
            } else {
                loadingMessage.textContent = 'شما به مدرسه‌ای تخصیص داده نشده‌اید.';
                calendarBody.innerHTML = '';
                return;
            }
        }

        const { data, error } = await query;
        if (error) { 
            loadingMessage.textContent = 'خطا در بارگذاری برنامه.'; 
            console.error("Fetch sessions error:", error);
            return; 
        }
        
        if (!data || data.length === 0) {
             loadingMessage.textContent = 'هیچ کلاسی برای نمایش وجود ندارد.';
        } else {
            loadingMessage.style.display = 'none';
        }
        renderSessionsInCalendar(data);
    }
    
    function showSessionModal(session = null) {
        sessionForm.reset();
        document.querySelectorAll('input[name="session_days"]').forEach(cb => cb.checked = false);
        if (session) {
            modalTitle.textContent = "ویرایش کلاس تکرارشونده";
            sessionIdInput.value = session.id;
            document.getElementById('session-title').value = session.title;
            document.getElementById('session-class-select').value = session.class_id;
            document.getElementById('session-time').value = session.session_time;
            if (session.session_days) {
                session.session_days.forEach(day => {
                    const checkbox = document.querySelector(`input[name="session_days"][value="${day}"]`);
                    if (checkbox) checkbox.checked = true;
                });
            }
        } else {
            modalTitle.textContent = "تعریف کلاس تکرارشونده";
            sessionIdInput.value = '';
        }
        modal.classList.add('is-open');
    }

    const AttendanceManager = {
        timer: null,
        session: null,
        classDuration: 60 * 60 * 1000,
        endTime: null,

        start(session) {
            if (this.timer) this.stop();
            this.session = session;
            this.endTime = Date.now() + this.classDuration;
            this.scheduleNextCheck();
        },

        stop() {
            clearTimeout(this.timer);
            this.timer = null;
        },

        async sendCheckRequest() {
            const profile = await getCurrentUserProfile();
            if (profile && this.session) {
                const expires_at = new Date(Date.now() + 30000).toISOString();
                await supabase.from('presence_checks').insert([{
                    session_id: this.session.id,
                    student_id: profile.id,
                    expires_at: expires_at,
                    responded: false
                }]);
            }
        },

        scheduleNextCheck() {
            if (Date.now() >= this.endTime) {
                this.stop();
                return;
            }
            const minDelay = 2 * 60 * 1000;
            const maxDelay = 8 * 60 * 1000;
            const randomDelay = Math.random() * (maxDelay - minDelay) + minDelay;

            this.timer = setTimeout(async () => {
                await this.sendCheckRequest();
                this.scheduleNextCheck();
            }, randomDelay);
        }
    };
    
    async function openAttendanceModal(session) {
        attendanceModal.dataset.sessionId = session.id;
        attendanceModal.dataset.classId = session.class.id; // ذخیره آیدی کلاس
        document.getElementById('attendance-modal-title').textContent = `حضور و غیاب کلاس: ${session.title}`;
        const studentListContainer = document.getElementById('student-list-container');
        studentListContainer.innerHTML = 'در حال بارگذاری دانشجویان...';
        
        const { data: students, error } = await supabase.from('profiles').select('id, name').eq('class_id', session.class.id);
        if (error || !students) {
            studentListContainer.innerHTML = 'خطا در دریافت لیست دانشجویان.';
            return;
        }
        await updateAttendanceStatus(session.id, students);
        attendanceModal.classList.add('is-open');
    }

    async function updateAttendanceStatus(sessionId, students) {
        const studentListContainer = document.getElementById('student-list-container');
        const absenteeListContainer = document.getElementById('absentee-list-container');
        studentListContainer.innerHTML = '';
        absenteeListContainer.innerHTML = '';

        const { data: checks, error } = await supabase.from('presence_checks').select('*').eq('session_id', sessionId);
        if(error) {
            console.error("Error fetching presence checks:", error);
            studentListContainer.innerHTML = 'خطا در دریافت اطلاعات حضور و غیاب.';
            return;
        }
        
        const missedCounts = {};
        const activeStudentIds = new Set();
        if (checks) {
            checks.forEach(check => {
                activeStudentIds.add(check.student_id);
                if (check.expires_at && !check.responded) {
                    missedCounts[check.student_id] = (missedCounts[check.student_id] || 0) + 1;
                }
            });
        }

        const studentListUl = document.createElement('ul');
        students.forEach(s => {
            const li = document.createElement('li');
            li.innerHTML = `${s.name} <span class="missed-count">${missedCounts[s.id] || 0} غیبت</span>`;
            studentListUl.appendChild(li);
        });
        studentListContainer.appendChild(studentListUl);


        const absentees = [];
        const absenteeReasons = {};
        students.forEach(student => {
            if (!activeStudentIds.has(student.id)) {
                absentees.push(student);
                absenteeReasons[student.id] = 'عدم ورود به کلاس';
            } 
            else if ((missedCounts[student.id] || 0) >= 3) {
                absentees.push(student);
                absenteeReasons[student.id] = 'عدم پاسخ به حضور و غیاب';
            }
        });

        if (absentees.length > 0) {
            const absenteeListUl = document.createElement('ul');
            absentees.forEach(s => {
                 const li = document.createElement('li');
                 li.innerHTML = `${s.name} <small>(${absenteeReasons[s.id]})</small>`;
                 absenteeListUl.appendChild(li);
            });
            absenteeListContainer.appendChild(absenteeListUl);
        } else {
            absenteeListContainer.innerHTML = '<p>در حال حاضر غایبی ثبت نشده است.</p>';
        }
    }

    async function listenForPresenceChecks() {
        const profile = await getCurrentUserProfile();
        if (!profile || profile.role !== 'student') return;
        realtimeChannel = supabase.channel(`presence-checks-${profile.id}`)
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'presence_checks', filter: `student_id=eq.${profile.id}` }, payload => {
                const check = payload.new;
                const expiresAt = new Date(check.expires_at);
                if (expiresAt > new Date() && !check.responded) {
                    showPresencePopup(check);
                }
            })
            .subscribe();
    }

    async function monitorSessionState(session) {
        if (sessionStateChannel) supabase.removeChannel(sessionStateChannel);
        sessionStateChannel = supabase.channel(`session-state-${session.id}`)
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'online_sessions', filter: `id=eq.${session.id}` }, payload => {
                if (payload.new.is_active === false) {
                    AttendanceManager.stop();
                    alert("کلاس توسط معلم به پایان رسید.");
                }
            })
            .subscribe();
    }

    function showPresencePopup(check) {
        const popup = document.getElementById('presence-popup');
        const timerEl = document.getElementById('presence-timer');
        const confirmBtn = document.getElementById('confirm-presence-btn');
        popup.style.display = 'block';
        let timeLeft = 30;
        timerEl.textContent = `زمان باقی‌مانده: ${timeLeft} ثانیه`;
        const timerInterval = setInterval(() => {
            timeLeft--;
            timerEl.textContent = `زمان باقی‌مانده: ${timeLeft} ثانیه`;
            if (timeLeft <= 0) {
                clearInterval(timerInterval);
                popup.style.display = 'none';
            }
        }, 1000);
        confirmBtn.onclick = async () => {
            await supabase.from('presence_checks').update({ responded: true }).eq('id', check.id);
            clearInterval(timerInterval);
            popup.style.display = 'none';
        };
    }

    function showCustomContextMenu(x, y, actions) {
        closeCustomContextMenu();
        const menu = document.createElement('div');
        menu.id = 'custom-context-menu';
        menu.style.cssText = `position: absolute; top: ${y}px; left: ${x}px; background: white; border: 1px solid #ccc; box-shadow: 2px 2px 5px rgba(0,0,0,0.2); z-index: 1000; border-radius: 8px; overflow: hidden;`;
        actions.forEach(action => {
            const item = document.createElement('button');
            item.textContent = action.text;
            item.style.cssText = `display: block; width: 100%; padding: 10px 15px; border: none; background: none; text-align: right; cursor: ${action.disabled ? 'not-allowed' : 'pointer'};`;
            item.disabled = action.disabled || false;
            if (!action.disabled) {
                item.onmouseenter = () => item.style.backgroundColor = '#f0f0f0';
                item.onmouseleave = () => item.style.backgroundColor = 'white';
            }
            if (action.handler) item.onclick = () => {
                action.handler();
                closeCustomContextMenu();
            };
            menu.appendChild(item);
        });
        document.body.appendChild(menu);
    }

    function closeCustomContextMenu() {
        const menu = document.getElementById('custom-context-menu');
        if (menu) menu.remove();
    }
    
    calendarBody.addEventListener('click', async (e) => {
        const card = e.target.closest('.session-card-mini');
        if (!card) return;
        const session = JSON.parse(card.dataset.session);
        const profile = await getCurrentUserProfile();
        const isTeacherOrAdmin = ['admin', 'teacher', 'consultant'].includes(profile.role);
        const actions = [];
        
        const now = new Date();
        const todayName = Object.keys(dayMap).find(key => dayMap[key] === now.getDay());
        const isClassToday = session.session_days && session.session_days.includes(todayName);

        if (isTeacherOrAdmin) {
            if (session.is_active) {
                 actions.push({ text: 'پایان دادن به کلاس', handler: async () => {
                     await supabase.from('online_sessions').update({ is_active: false }).eq('id', session.id);
                 }});
            }
            actions.push({ text: 'مشاهده حضور و غیاب', handler: () => openAttendanceModal(session) });
            actions.push({ text: 'ویرایش', handler: () => showSessionModal(session) });
            actions.push({ text: 'حذف', handler: async () => {
                if (confirm(`آیا از حذف کلاس "${session.title}" مطمئن هستید؟`)) {
                    await supabase.from('online_sessions').delete().eq('id', session.id);
                }
            }});
        }

        if (isClassToday) {
            actions.unshift({ text: 'ورود به کلاس', handler: async () => {
                if (isTeacherOrAdmin && !session.is_active) {
                    await supabase.from('online_sessions').update({ is_active: true }).eq('id', session.id);
                }
                const userName = encodeURIComponent(profile.name);
                const joinURL = `https://meet.jit.si/${session.meeting_id}#userInfo.displayName="${userName}"`;
                
                if (profile.role === 'student') {
                    const { error: logError } = await supabase.from('presence_checks').insert([{
                        session_id: session.id,
                        student_id: profile.id,
                        responded: true, // This is an entry log, not a response to a check
                        expires_at: null 
                    }]);

                    if (logError && logError.code !== '23505') { // Ignore unique violation error
                         console.error("خطا در ثبت ورود به کلاس:", logError);
                         alert("مشکلی در ثبت ورود شما به کلاس رخ داد. لطفاً دوباره تلاش کنید.");
                         return;
                    }
                    
                    const { data: currentSession } = await supabase.from('online_sessions').select('is_active').eq('id', session.id).single();
                    if(currentSession && currentSession.is_active) {
                        AttendanceManager.start(session);
                    }
                    monitorSessionState(session);
                }

                window.open(joinURL, '_blank');
            }});
        } else {
            actions.unshift({ text: 'امروز این کلاس برگزار نمی‌شود', disabled: true });
        }
        showCustomContextMenu(e.pageX, e.pageY, actions);
    });

    sessionForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const profile = await getCurrentUserProfile();
        if (!profile) return alert("خطا: اطلاعات کاربر یافت نشد.");
        
        const managerId = profile.role === 'admin' ? profile.id : profile.manager_id;
        const selectedDays = Array.from(document.querySelectorAll('input[name="session_days"]:checked')).map(cb => cb.value);
        if (selectedDays.length === 0) return alert('حداقل یک روز از هفته را انتخاب کنید.');

        const sessionData = {
            title: document.getElementById('session-title').value,
            class_id: document.getElementById('session-class-select').value,
            session_time: document.getElementById('session-time').value,
            session_days: selectedDays,
            created_by: profile.id,
            manager_id: managerId,
        };

        const id = sessionIdInput.value;
        const { error } = id
            ? await supabase.from('online_sessions').update(sessionData).eq('id', id)
            : await supabase.from('online_sessions').insert([{ ...sessionData, meeting_id: `spooder-console-${Date.now()}` }]);

        if (error) {
            console.error('Error saving session:', error);
            alert(`خطا در ذخیره کلاس: ${error.message}`);
        } else {
            modal.classList.remove('is-open');
            fetchAndRender();
        }
    });

    // ========== START: کد اصلاح شده برای Real-time ==========
    async function initializePage() {
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.session-card-mini') && !e.target.closest('#custom-context-menu')) {
                closeCustomContextMenu();
            }
        });
        renderCalendarShell();
        const profile = await getCurrentUserProfile();
        if (!profile) return;
        if (['admin', 'teacher', 'consultant'].includes(profile.role)) {
            teacherToolbar.style.display = 'block';
            randomCheckBtn.style.display = 'none';
            const classSelect = document.getElementById('session-class-select');
            const { data: classes } = await supabase.from('classes').select('id, name').eq('manager_id', profile.role === 'admin' ? profile.id : profile.manager_id);
            classSelect.innerHTML = '<option value="">انتخاب کنید...</option>';
            if (classes) classes.forEach(c => classSelect.add(new Option(c.name, c.id)));
        }
        addSessionBtn.addEventListener('click', () => showSessionModal(null));
        cancelBtn.addEventListener('click', () => modal.classList.remove('is-open'));
        modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.remove('is-open'); });
        document.getElementById('close-attendance-btn').addEventListener('click', () => attendanceModal.classList.remove('is-open'));
        
        await fetchAndRender();
        await listenForPresenceChecks();
        
        // Listen for all session changes
        supabase.channel('public:online_sessions')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'online_sessions' }, fetchAndRender)
            .subscribe();
            
        // Listen for all presence check changes and update the modal if it's open
        supabase.channel('public:presence_checks')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'presence_checks' }, async (payload) => {
                const attendanceModalEl = document.getElementById('attendance-modal');
                if (attendanceModalEl.classList.contains('is-open')) {
                    console.log('Realtime update received for presence_checks. Refreshing attendance modal.');
                    const activeSessionId = attendanceModalEl.dataset.sessionId;
                    const classId = attendanceModalEl.dataset.classId;
                    
                    if (activeSessionId && classId) {
                        const { data: students } = await supabase.from('profiles').select('id, name').eq('class_id', classId);
                        if(students) {
                            await updateAttendanceStatus(activeSessionId, students);
                        }
                    }
                }
            })
            .subscribe();
    }
    // ========== END: کد اصلاح شده برای Real-time ==========

    initializePage();
});