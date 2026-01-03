import axios from 'axios';
import { supabase } from './supabaseClient';

// یک نمونه axios با آدرس پایه می‌سازیم.
const api = axios.create({
  baseURL: '/api',
});

// با استفاده از یک رهگیر (interceptor)، توکن را به صورت خودکار به هدر تمام درخواست‌ها اضافه می‌کنیم.
api.interceptors.request.use(
  async (config) => {
    // گرفتن سشن معتبر از کلاینت سوپربیس
    // این متد در صورت نیاز توکن را رفرش می‌کند
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (session?.access_token) {
      config.headers.Authorization = `Bearer ${session.access_token}`;
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// با استفاده از رهگیر پاسخ، خطاهای 401 را به صورت سراسری مدیریت می‌کنیم.
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response && error.response.status === 401) {
      // اگر خطای 401 گرفتیم، لاگ‌اوت می‌کنیم
      await supabase.auth.signOut();
      window.location.href = '/join';
    }
    return Promise.reject(error);
  }
);

export default api;