# إعداد Supabase

يستخدم الخادم Supabase Postgres باستخدام مفتاح `service_role` من جهة الخادم فقط. لا تضع هذا المفتاح في ملفات `public/` أو في JavaScript المتصفح.

## التشغيل لأول مرة

1. إذا لم يكن لديك ملف `.env`، انسخ `.env.example` إليه. إذا كان موجوداً بالفعل، احتفظ بإعداداته وأضف إليه القيم المطلوبة.
2. ضع `SUPABASE_SERVICE_ROLE_KEY` من إعدادات مشروع Supabase، وتأكد من وجود `SUPABASE_URL`.
3. طبّق المخطط الموجود في `supabase/migrations/001_learnera_schema.sql` على المشروع. إذا كان المشروع هو المرتبط بأدوات مساحة العمل، فالمخطط مطبّق بالفعل.
4. قبل تشغيل الخادم لأول مرة، انقل بيانات SQLite الحالية من مجلد `data`:

   ```text
   npm run migrate:sqlite
   ```

   تتوقف الأداة إذا وجدت بيانات في جداول Supabase، لتجنب الكتابة فوق بيانات موجودة.
5. شغّل التطبيق:

   ```text
   npm start
   ```

إذا لم تُنقل قاعدة SQLite قبل أول تشغيل، سينشئ الخادم حساب مسؤول افتراضياً وفق قيم `ADMIN_*` في `.env`.

أداة الترحيل تنقل سجلات قاعدة البيانات ومعرّفاتها، ولا تنقل الملفات الثنائية الموجودة في `data/uploads` أو الصور الموجودة في `public/uploads`. يجب نقل هذه الملفات إلى تخزين دائم منفصل عند نشر التطبيق على استضافة أخرى.

## تغييرات طبقة قاعدة البيانات (من SQLite إلى Supabase)

### الملفات المتأثرة

- حُذف `src/db.js` (كان مبنياً على `better-sqlite3`) واستُبدل بـ `src/data.js` المبني على `@supabase/supabase-js`.
- حُذف `test/live-log.test.js` (اختبار SQLite) واستُبدل بـ `test/supabase.test.js`.
- نُقلت اختبارات SQLite القديمة إلى `scripts/legacy-tests/`.
- أضيف `src/async-router.js` لتغليف معالجات المسارات غير المتزامنة.
- حُدّثت كل ملفات `src/routes/*.js` و`server.js` و`src/auth.js` لتستورد من `./data` بدل `./db`.
- أضيف `scripts/migrate-sqlite-to-supabase.js` لنقل البيانات القائمة.

### الاتصال

- `src/data.js` ينشئ عميلاً واحداً مشتركاً عبر `createClient` باستخدام مفتاح `service_role`، مع `auth: { autoRefreshToken: false, persistSession: false }`.
- يرفض الخادم البدء إذا غاب `SUPABASE_URL` أو `SUPABASE_SERVICE_ROLE_KEY`.
- الدالتان `unwrap()` و`one()` توحّدان شكل النتائج وترميان أي خطأ من Supabase مباشرةً إلى معالج الأخطاء المركزي.

### الجداول والقيود

- الجداول: `courses`, `course_days`, `users`, `staff_courses`, `attendance`, `assignments`, `assignment_files`, `submissions`, `submission_files`, `activity_logs`, `announcements`, `announcement_reads`, `course_files`, `live_sessions`, `live_session_participants`, `live_session_events`, `certificates`.
- قيود فريدة على `lower(email)` و`lower(student_id)`، وعلى `(course_id, day_date)`، `(course_day_id, user_id)`، `(assignment_id, user_id)`، `(session_id, user_id)`، و`(announcement_id, user_id)`.
- قيد فريد جزئي يضمن جلسة بث حية واحدة لكل دورة: `idx_live_sessions_one_live_per_course`.
- قيود `check` على `role` و`location_type` و`language` وعلى الحقول الثنائية `present`/`is_late`/`is_host`/`publisher` (0 أو 1).
- مفاتيح أجنبية مع `on delete cascade` أو `on delete set null` حسب العلاقة.

### العروض (Views)

`app_users_with_stats`, `app_courses_with_stats`, `app_staff_courses`, `app_assignments_with_stats`, `app_submissions`, `app_announcements`, `app_course_files`, `app_live_sessions`, `app_live_session_logs`, `app_live_participants`, `app_certificates`.

### دوال RPC

`replace_staff_courses`, `sync_course_days`, `create_assignment_with_files`, `create_live_session`, `reset_identity_sequences` — كلها `security invoker`، ومحجوبة عن `anon` و`authenticated`، وممنوحة لـ `service_role` فقط.

### الأمان

- تفعيل RLS على كل الجداول، فلا وصول من المتصفح إلا عبر الخادم باستخدام مفتاح `service_role`.
- صلاحيات كاملة لـ `service_role` على الجداول والتسلسلات.

### الطوابع الزمنية

- `normalizeTimestamps` في `src/data.js` يحوّل حقول `*_at` القادمة من Postgres إلى الصيغة `YYYY-MM-DD HH:MM:SS` (UTC) حفاظاً على شكل البيانات الذي تتوقعه الواجهة.
- `toDate` في `src/routes/live.js` يعالج الصيغتين: ISO مع إزاحة زمنية، والصيغة السابقة (يفسّرها كـ UTC).

### الاختبار

```text
npm test
```

يشمل `test/supabase.test.js` التحقق من رفض العميل عند غياب المفاتيح، واستمرار تشفير كلمات المرور بـ bcrypt (12 جولة)، وتشكيل المستخدم العام، وحساب مدة جلسات البث.
