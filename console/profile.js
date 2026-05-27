document.addEventListener('DOMContentLoaded', async () => {
    let supabase;
    try {
        const res = await fetch('/api/supabase-config');
        if (!res.ok) {
            console.error('Cannot load Supabase config for profile page.');
            return;
        }
        const { url, anonKey } = await res.json();
        supabase = window.supabase.createClient(url, anonKey);
    } catch (e) {
        console.error('Supabase init error in profile page:', e);
        return;
    }

    // DOM Elements
    const profileForm = document.getElementById('profile-form');
    const loadingMessage = document.getElementById('loading-message');
    const editProfileBtn = document.getElementById('edit-profile-btn');
    const saveProfileBtn = document.getElementById('save-profile-btn');
    
    const fullNameInput = document.getElementById('profile-fullname');
    const fatherNameInput = document.getElementById('profile-father-name');
    const motherNameInput = document.getElementById('profile-mother-name');
    const fatherPhoneInput = document.getElementById('profile-father-phone');
    const motherPhoneInput = document.getElementById('profile-mother-phone');
    const homePhoneInput = document.getElementById('profile-home-phone');
    
    const allInputs = document.querySelectorAll('.summary-input');

    let currentUser = null;

    // Fetch current user's profile data
    async function loadProfile() {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            window.location.href = '/login.html';
            return;
        }
        currentUser = user;

        const { data: profile, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', currentUser.id)
            .single();

        if (error) {
            loadingMessage.textContent = 'خطا در بارگذاری پروفایل.';
            console.error('Error loading profile:', error);
            return;
        }

        // Populate the form with existing data
        fullNameInput.value = profile.full_name || '';
        fatherNameInput.value = profile.father_name || '';
        motherNameInput.value = profile.mother_name || '';
        fatherPhoneInput.value = profile.father_phone || '';
        motherPhoneInput.value = profile.mother_phone || '';
        homePhoneInput.value = profile.home_phone || '';

        loadingMessage.style.display = 'none';
        profileForm.style.display = 'block';
    }

    // Enable editing mode
    editProfileBtn.addEventListener('click', () => {
        allInputs.forEach(input => {
            input.readOnly = false;
            input.classList.add('editable');
        });
        saveProfileBtn.style.display = 'inline-block';
        editProfileBtn.style.display = 'none';
    });


    // Handle form submission to update profile
    profileForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const updates = {
            full_name: fullNameInput.value.trim(),
            father_name: fatherNameInput.value.trim(),
            mother_name: motherNameInput.value.trim(),
            father_phone: fatherPhoneInput.value.trim(),
            mother_phone: motherPhoneInput.value.trim(),
            home_phone: homePhoneInput.value.trim(),
            updated_at: new Date().toISOString()
        };

        const { error } = await supabase
            .from('profiles')
            .update(updates)
            .eq('id', currentUser.id);

        if (error) {
            alert('خطا در به‌روزرسانی پروفایل.');
            console.error('Error updating profile:', error);
        } else {
            alert('پروفایل شما با موفقیت به‌روزرسانی شد.');
            // Revert to read-only mode
            allInputs.forEach(input => {
                input.readOnly = true;
                input.classList.remove('editable');
            });
            saveProfileBtn.style.display = 'none';
            editProfileBtn.style.display = 'inline-block';
        }
    });

    // Initial load
    loadProfile();
});
