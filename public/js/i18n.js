/**
 * Central internationalisation (i18n) helper.
 *
 * Supports Arabic and English only. Every page includes this file, loads the
 * saved language preference and translates any element carrying a
 * `data-i18n*` attribute. Page scripts can register their own strings with
 * `i18n.add({ en: {...}, ar: {...} })` and read them with `i18n.t('key')`.
 *
 * The layout stays left-to-right (LTR) for both languages by design.
 */
(function () {
  const STORAGE_KEY = 'learnera-lang';
  const SUPPORTED = ['ar', 'en'];
  const DEFAULT_LANG = 'ar';

  /** Shared strings used by the top bar, notifications and account settings. */
  const DICT = {
    en: {
      common: {
        dashboard: 'Dashboard',
        certificates: 'Certificates',
        settings: 'Settings',
        signOut: 'Sign out',
        accountMenu: 'Account menu',
        notifications: 'Notifications',
        markAllRead: 'Mark all read',
        noAnnouncements: 'No announcements yet.',
        language: 'Language',
        english: 'English',
        arabic: 'العربية',
        save: 'Save',
        cancel: 'Cancel',
        saving: 'Saving…',
        apply: 'Apply',
        edit: 'Edit',
        delete: 'Delete',
        view: 'View',
        open: 'Open',
        close: 'Close',
        add: 'Add',
        confirm: 'Confirm',
        yes: 'Yes',
        no: 'No',
        accountSettings: 'Account settings',
        profilePhoto: 'Profile photo',
        photoHint: 'Choose an image, then drag and zoom to frame it.',
        currentPassword: 'Current password',
        newPassword: 'New password',
        confirmNewPassword: 'Confirm new password',
        passwordHint: 'Leave the password fields blank to keep your current password. Minimum 8 characters.',
        adjustPhoto: 'Adjust photo',
        cropHint: 'Drag the photo to reposition it, and use the slider to zoom.',
        errChoosePhotoOrPassword: 'Choose a new photo or enter a new password first.',
        errPasswordLength: 'The new password must be at least 8 characters.',
        errPasswordMatch: 'The two new passwords do not match.',
        errCurrentPassword: 'Enter your current password to change it.',
        settingsSaved: 'Settings saved',
        errSaveSettings: 'Unable to save your settings.',
        errChooseImage: 'Please choose an image file.',
        roleStudent: 'Student',
        roleInstructor: 'Instructor',
        roleCoordinator: 'Coordinator',
        roleAdmin: 'Administrator',
        locationOnline: 'Online',
        locationOffline: 'Offline',
        locationType: 'Location type',
        courseLocation: 'Course location',
        day: 'day',
        days: 'days',
        student: 'student',
        students: 'students',
        switchToDark: 'Switch to dark mode',
        switchToLight: 'Switch to light mode',
      },
      login: {
        title: 'Sign in',
        subtitle: 'Welcome back! Sign in to continue',
        tagline: 'Smart education platform',
        email: 'Email address',
        password: 'Password',
        signIn: 'Sign in',
        signingIn: 'Signing in…',
        forgot: 'Forgot password?',
        terms: 'Terms & conditions and privacy policy',
        supportPre: 'Having trouble? Contact us at',
        copyright: '© 2026 LearnEra. All rights reserved',
        hintAccount: 'Accounts are created by an administrator.',
        hintNoSignup: 'There is no public sign-up.',
        errEnterBoth: 'Please enter both your email and password.',
        errSignIn: 'Unable to sign in.',
      },
    },
    ar: {
      common: {
        dashboard: 'لوحة التحكم',
        certificates: 'الشهادات',
        settings: 'الإعدادات',
        signOut: 'تسجيل الخروج',
        accountMenu: 'قائمة الحساب',
        notifications: 'الإشعارات',
        markAllRead: 'تعليم الكل كمقروء',
        noAnnouncements: 'لا توجد إعلانات بعد.',
        language: 'اللغة',
        english: 'English',
        arabic: 'العربية',
        save: 'حفظ',
        cancel: 'إلغاء',
        saving: 'جارٍ الحفظ…',
        apply: 'تطبيق',
        edit: 'تعديل',
        delete: 'حذف',
        view: 'عرض',
        open: 'فتح',
        close: 'إغلاق',
        add: 'إضافة',
        confirm: 'تأكيد',
        yes: 'نعم',
        no: 'لا',
        accountSettings: 'إعدادات الحساب',
        profilePhoto: 'الصورة الشخصية',
        photoHint: 'اختر صورة، ثم اسحب وقرّب لتأطيرها.',
        currentPassword: 'كلمة المرور الحالية',
        newPassword: 'كلمة المرور الجديدة',
        confirmNewPassword: 'تأكيد كلمة المرور الجديدة',
        passwordHint: 'اترك حقول كلمة المرور فارغة للإبقاء على كلمة المرور الحالية. 8 أحرف على الأقل.',
        adjustPhoto: 'ضبط الصورة',
        cropHint: 'اسحب الصورة لإعادة وضعها، واستخدم المنزلق للتكبير.',
        errChoosePhotoOrPassword: 'اختر صورة جديدة أو أدخل كلمة مرور جديدة أولاً.',
        errPasswordLength: 'يجب أن تتكون كلمة المرور الجديدة من 8 أحرف على الأقل.',
        errPasswordMatch: 'كلمتا المرور الجديدتان غير متطابقتين.',
        errCurrentPassword: 'أدخل كلمة المرور الحالية لتغييرها.',
        settingsSaved: 'تم حفظ الإعدادات',
        errSaveSettings: 'تعذّر حفظ إعداداتك.',
        errChooseImage: 'الرجاء اختيار ملف صورة.',
        roleStudent: 'طالب',
        roleInstructor: 'مدرس',
        roleCoordinator: 'كوردنيتور',
        roleAdmin: 'مدير النظام',
        locationOnline: 'أونلاين',
        locationOffline: 'أوفلاين',
        locationType: 'نوع الموقع',
        courseLocation: 'موقع الدورة',
        day: 'يوم',
        days: 'أيام',
        student: 'طالب',
        students: 'طلاب',
        switchToDark: 'التبديل إلى الوضع الداكن',
        switchToLight: 'التبديل إلى الوضع الفاتح',
      },
      login: {
        title: 'تسجيل الدخول',
        subtitle: 'مرحباً بعودتك! سجل الدخول للمتابعة',
        tagline: 'منصة التعليم الذكي',
        email: 'البريد الإلكتروني',
        password: 'كلمة المرور',
        signIn: 'تسجيل الدخول',
        signingIn: 'جارٍ تسجيل الدخول…',
        forgot: 'نسيت كلمة المرور؟',
        terms: 'الشروط والأحكام وسياسة الخصوصية',
        supportPre: 'هل تواجه مشكلة؟ تواصل معنا عبر',
        copyright: '© 2026 LearnEra. جميع الحقوق محفوظة',
        hintAccount: 'يتم إنشاء الحسابات من قِبل المدير.',
        hintNoSignup: 'لا يوجد تسجيل عام.',
        errEnterBoth: 'الرجاء إدخال البريد الإلكتروني وكلمة المرور.',
        errSignIn: 'تعذّر تسجيل الدخول.',
      },
    },
  };

  /** Reads the saved language, falling back to the default. */
  function storedLang() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (SUPPORTED.includes(saved)) return saved;
    } catch (e) {
      /* localStorage may be unavailable - use the default. */
    }
    return DEFAULT_LANG;
  }

  let current = storedLang();

  /** Resolves a dotted key inside a dictionary. */
  function lookup(dict, key) {
    return String(key)
      .split('.')
      .reduce((acc, part) => (acc == null ? undefined : acc[part]), dict);
  }

  /** Deep-merges `source` into `target`. */
  function merge(target, source) {
    for (const key of Object.keys(source || {})) {
      const value = source[key];
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        target[key] = target[key] && typeof target[key] === 'object' ? target[key] : {};
        merge(target[key], value);
      } else {
        target[key] = value;
      }
    }
    return target;
  }

  /** Translates a key for the current language (with {placeholder} support). */
  function t(key, vars) {
    let value = lookup(DICT[current], key);
    if (value == null) value = lookup(DICT[DEFAULT_LANG], key);
    if (value == null) return key;
    return String(value).replace(/\{(\w+)\}/g, (m, name) =>
      vars && vars[name] != null ? vars[name] : m
    );
  }

  /** Applies translations to every annotated element inside `root`. */
  function apply(root) {
    const scope = root || document;
    const each = (selector, fn) => scope.querySelectorAll(selector).forEach(fn);
    each('[data-i18n]', (el) => { el.textContent = t(el.getAttribute('data-i18n')); });
    each('[data-i18n-html]', (el) => { el.innerHTML = t(el.getAttribute('data-i18n-html')); });
    each('[data-i18n-placeholder]', (el) => {
      el.setAttribute('placeholder', t(el.getAttribute('data-i18n-placeholder')));
    });
    each('[data-i18n-title]', (el) => { el.setAttribute('title', t(el.getAttribute('data-i18n-title'))); });
    each('[data-i18n-aria]', (el) => { el.setAttribute('aria-label', t(el.getAttribute('data-i18n-aria'))); });
  }

  /** Registers additional (page specific) strings and re-applies them. */
  function add(dict) {
    for (const lang of Object.keys(dict || {})) {
      if (!DICT[lang]) DICT[lang] = {};
      merge(DICT[lang], dict[lang]);
    }
    if (document.readyState !== 'loading') apply();
  }

  /** Notifies listeners that the language changed. */
  function notify() {
    document.dispatchEvent(new CustomEvent('i18n:change', { detail: { lang: current } }));
  }

  /** Switches the interface language and applies it immediately. */
  function setLanguage(lang, opts) {
    const options = opts || {};
    current = SUPPORTED.includes(lang) ? lang : DEFAULT_LANG;
    try {
      localStorage.setItem(STORAGE_KEY, current);
    } catch (e) {
      /* Ignore storage failures - the change still applies for this page. */
    }
    document.documentElement.setAttribute('lang', current);
    apply();
    if (!options.silent) notify();
  }

  document.documentElement.setAttribute('lang', current);
  // The layout intentionally stays left-to-right for both languages.
  document.documentElement.setAttribute('dir', 'ltr');

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => apply());
  } else {
    apply();
  }

  window.i18n = {
    t,
    apply,
    add,
    setLanguage,
    getLang: () => current,
    onChange: (cb) => document.addEventListener('i18n:change', cb),
    SUPPORTED,
  };
  window.t = t;
})();
