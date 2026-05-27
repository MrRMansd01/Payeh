#!/usr/bin/env node
/**
 * کپی متغیرهای سوپربیس از .env ریشه به wed app/client/.env
 * قبل از npm start از ریشه اجرا می‌شود.
 */
const path = require('path');
const fs = require('fs');

const rootDir = path.join(__dirname, '..');
const envPath = path.join(rootDir, '.env');
const envExamplePath = path.join(rootDir, '.env.example');

if (!fs.existsSync(envPath) && fs.existsSync(envExamplePath)) {
  fs.copyFileSync(envExamplePath, envPath);
  console.log('✓ فایل .env از .env.example ساخته شد. مقادیر را پر کنید (مخصوصاً SUPABASE_ANON_KEY از خروجی supabase start).');
}

require('dotenv').config({ path: envPath });

const clientEnvPath = path.join(__dirname, '..', 'wed app', 'client', '.env');
const url = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
const key = process.env.SUPABASE_ANON_KEY || '';

const content = `# Auto-generated from root .env - do not commit secrets
REACT_APP_SUPABASE_URL=${url}
REACT_APP_SUPABASE_ANON_KEY=${key}
`;

fs.writeFileSync(clientEnvPath, content, 'utf8');
console.log('✓ Supabase env copied to wed app/client/.env');
