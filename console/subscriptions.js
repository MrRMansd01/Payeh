document.addEventListener('DOMContentLoaded', async () => {
    let supabase;
    try {
        const res = await fetch('/api/supabase-config');
        if (!res.ok) {
            console.error('Cannot load Supabase config for subscriptions page.');
            return;
        }
        const { url, anonKey } = await res.json();
        supabase = window.supabase.createClient(url, anonKey);
    } catch (e) {
        console.error('Supabase init error in subscriptions page:', e);
        return;
    }

    const adminSelect = document.getElementById('admin-select');
    const subscriptionDetails = document.getElementById('subscription-details');
    const currentExpiryEl = document.getElementById('current-expiry');
    const expiryDateInput = document.getElementById('expiry-date');
    const subscriptionForm = document.getElementById('subscription-form');
    const loadingMessage = document.getElementById('loading-message');

    const datePicker = flatpickr(expiryDateInput, {
        locale: "fa",
        dateFormat: "Y-m-d",
        altInput: true,
        altFormat: "l، j F Y",
    });

    async function checkSuperAdminRole() {
        // تغییر: استفاده از getSession برای اطمینان از بارگذاری اطلاعات ورود
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !session) {
            window.location.href = '/login.html';
            return false;
        }
        const user = session.user;

        const { data: profile, error } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();

        if (error || !profile || profile.role !== 'super_admin') {
            alert('شما دسترسی لازم برای مشاهده این صفحه را ندارید.');
            window.location.href = '/home.html';
            return false;
        }
        return true;
    }

    async function populateAdminsDropdown() {
        const { data: admins, error } = await supabase
            .from('profiles')
            .select('id, name, school_name')
            .eq('role', 'admin');
            
        if (error) return console.error('Error fetching admins:', error);

        admins.forEach(admin => {
            const option = new Option(`${admin.name} (${admin.school_name || 'بدون مدرسه'})`, admin.id);
            adminSelect.appendChild(option);
        });
    }

    adminSelect.addEventListener('change', async () => {
        const adminId = adminSelect.value;
        if (!adminId) {
            subscriptionDetails.style.display = 'none';
            loadingMessage.textContent = 'لطفا یک مدیر را انتخاب کنید.';
            loadingMessage.style.display = 'block';
            return;
        }

        loadingMessage.textContent = 'در حال بارگذاری اطلاعات اشتراک...';
        
        const { data: subscription, error } = await supabase
            .from('subscriptions')
            .select('end_date')
            .eq('user_id', adminId)
            .single();

        if (error && error.code !== 'PGRST116') {
            console.error('Error fetching subscription:', error);
            currentExpiryEl.textContent = 'خطا در دریافت اطلاعات';
        } else if (subscription) {
            currentExpiryEl.textContent = new Date(subscription.end_date).toLocaleDateString('fa-IR');
        } else {
            currentExpiryEl.textContent = 'اشتراک فعال نشده است';
        }

        loadingMessage.style.display = 'none';
        subscriptionDetails.style.display = 'block';
    });

    subscriptionForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const adminId = adminSelect.value;
        const newEndDate = expiryDateInput.value;

        if (!adminId || !newEndDate) {
            alert('لطفا مدیر و تاریخ انقضای جدید را مشخص کنید.');
            return;
        }

        const { error } = await supabase.from('subscriptions').upsert({
            user_id: adminId,
            end_date: newEndDate,
        }, {
            onConflict: 'user_id'
        });

        if (error) {
            console.error('Error saving subscription:', error);
            alert('خطا در ذخیره اطلاعات اشتراک.');
        } else {
            alert('اطلاعات اشتراک با موفقیت به‌روزرسانی شد.');
            currentExpiryEl.textContent = new Date(newEndDate).toLocaleDateString('fa-IR');
        }
    });

    checkSuperAdminRole().then((hasAccess) => {
        if (hasAccess) {
            populateAdminsDropdown();
        }
    });
});
