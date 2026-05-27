document.addEventListener('DOMContentLoaded', async () => {
  let supabaseClient = window.supabaseClient;

  try {
    if (!supabaseClient) {
      const res = await fetch('/api/supabase-config');
      if (!res.ok) return;
      const { url, anonKey } = await res.json();
      const lib = window.supabase || window.SupabaseClient || window.supabaseJs;
      if (!lib || !lib.createClient) return;
      supabaseClient = lib.createClient(url, anonKey);
      window.supabaseClient = supabaseClient;
    }

    const {
      data: { session },
    } = await supabaseClient.auth.getSession();
    if (!session) {
      window.location.href = '/login.html';
      return;
    }

    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single();

    if (!profile) return;

    const role = profile.role || 'student';

    // نمایش نام و نقش در سایدبار در صورت وجود المنت‌ها
    const nameEl = document.getElementById('sidebar-user-name');
    const roleEl = document.getElementById('sidebar-user-role');
    const avatarEl = document.getElementById('sidebar-avatar-initial');

    if (nameEl) nameEl.textContent = profile.name || session.user.email || 'کاربر';
    if (roleEl) roleEl.textContent = role === 'student' ? 'دانش‌آموز' :
      role === 'teacher' ? 'معلم' :
      role === 'admin' ? 'مدیر' :
      role === 'super_admin' ? 'مدیر کل' : role;
    if (avatarEl && (profile.name || session.user.email)) {
      avatarEl.textContent = (profile.name || session.user.email).trim().charAt(0);
    }

    // واگذاری کنترل نقش‌محور به initSidebar در صورت وجود
    if (window.initSidebar) {
      window.initSidebar(profile);
    }

    const logoutBtn = document.getElementById('sidebar-logout');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        await supabaseClient.auth.signOut();
        window.location.href = '/login.html';
      });
    }
  } catch (e) {
    console.error('auth-check error:', e);
  }
});

