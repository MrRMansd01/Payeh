# پلتفرم یکپارچه آموزشی پایه (Payeh)
 
یک اکوسیستم کامل مدیریت مدرسه شامل کنسول مدیریت وب و اپلیکیشن موبایل/وب برای دانش‌آموزان و معلمان.
 
---
 
## ساختار پروژه
 
```
payeh/
├── index.html              # لندینگ پیج اصلی
├── demo.html               # صفحه انتخاب نقش برای دمو
├── package.json            # اسکریپت‌های اجرای همزمان همه سرویس‌ها
├── console/                # کنسول مدیریت (Node.js + Vanilla JS)
│   ├── server.js           # سرور Express
│   ├── home.html/js        # داشبورد
│   ├── users.html/js       # مدیریت کاربران
│   ├── classes.html/js     # مدیریت کلاس‌ها
│   ├── exams.html/js       # مدیریت آزمون‌ها
│   ├── scores.html/js      # ثبت نمرات
│   ├── reports.html/js     # گزارش‌ها
│   ├── tasks.html/js       # مدیریت تکالیف
│   └── ...
└── wed app/                # اپلیکیشن دانش‌آموز/معلم
    ├── api/                # بک‌اند Express
    │   ├── index.js
    │   └── routes/         # auth, tasks, room, profile, channels, messages
    ├── client/             # فرانت‌اند React
    │   └── src/
    │       ├── pages/      # Home, Calendar, Room, Chat, Accent, ...
    │       └── components/ # Footer
    └── supabase/           # تنظیمات Supabase محلی
```
 
---
 
## پشته فناوری
 
| بخش | فناوری |
|-----|--------|
| لندینگ پیج | HTML + Tailwind CSS |
| کنسول مدیریت | Node.js + Express + Vanilla JS |
| اپلیکیشن کاربر | React 18 + React Router |
| بک‌اند اپ | Node.js + Express |
| پایگاه داده | Supabase (PostgreSQL) |
| احراز هویت | Supabase Auth |
| فضای ذخیره‌سازی | Supabase Storage |
| ریل‌تایم | Supabase Realtime |
 
---
 
## امکانات
 
### کنسول مدیریت
- داشبورد با آمار و تقویم جلالی
- مدیریت کاربران (دانش‌آموز، معلم، مشاور، مدیر)
- مدیریت کلاس‌ها و دانش‌آموزان
- طراحی و مدیریت آزمون‌های آنلاین
- ثبت نمرات و گزارش‌گیری تحلیلی
- مدیریت تکالیف و وظایف
- برنامه هفتگی و کلاس‌های آنلاین با Jitsi
- حضور و غیاب ریل‌تایم
- مدیریت مدارس و اشتراک‌ها (سوپر ادمین)
- سیستم نقش‌محور (student / teacher / admin / super_admin)
### اپلیکیشن کاربر (React)
- مدیریت تسک روزانه با کشیدن انگشت برای تکمیل
- تقویم شمسی (جلالی) اختصاصی
- تایمر پومودورو با لیدربورد
- چت گروهی ریل‌تایم با قابلیت ارسال تصویر
- پروفایل کاربری با آپلود آواتار
- صفحه جوایز و امتیازات
---
 
## راه‌اندازی محلی
 
### پیش‌نیازها
- Node.js نسخه ۱۸ یا بالاتر
- npm
- حساب Supabase (یا نصب محلی Supabase CLI)
### ۱. کلون پروژه
```bash
git clone https://github.com/MrRMansd01/spooder_console.git
cd spooder_console
```
 
### ۲. ساخت فایل `.env` در ریشه پروژه
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
REACT_APP_SUPABASE_URL=https://your-project.supabase.co
REACT_APP_SUPABASE_ANON_KEY=your-anon-key
```
 
### ۳. نصب وابستگی‌ها
```bash
# وابستگی‌های ریشه
npm install
 
# وابستگی‌های کنسول
cd console && npm install && cd ..
 
# وابستگی‌های بک‌اند اپ
cd "wed app/api" && npm install && cd ../..
 
# وابستگی‌های فرانت‌اند اپ
cd "wed app/client" && npm install && cd ../..
```
 
### ۴. اجرای همه سرویس‌ها
```bash
npm start
```
 
این دستور همزمان اجرا می‌کند:
| سرویس | آدرس |
|--------|-------|
| لندینگ پیج | http://localhost:5173 |
| کنسول مدیریت | http://localhost:4001 |
| بک‌اند اپ | http://localhost:3001 |
| اپلیکیشن React | http://localhost:3000 |
 
---
