/** Landing (welcome) page: bilingual copy plus the shared animated backdrop. */
(function () {
  if (window.i18n) {
    i18n.add({
      en: {
        landing: {
          brandTag: 'Professional learning and training platform',
          signIn: 'Sign in',
          eyebrow: 'All-in-one learning platform',
          heroTitle: 'Welcome to LearnEra',
          heroLead:
            'Organize your courses, follow attendance and progress, receive assignments and earn completion certificates — all in one place.',
          cta: 'Enter the platform',
          explore: 'Explore features',
          featuresTitle: 'Everything you need to learn',
          featuresLead: 'Complete tools for students, instructors, coordinators and administrators.',
          fCoursesTitle: 'Structured courses',
          fCoursesText: 'Courses split into days with clear tracks and schedules.',
          fAttendanceTitle: 'Attendance & absence',
          fAttendanceText: 'Accurate daily attendance tracking for every student.',
          fAssignmentsTitle: 'Assignments & submissions',
          fAssignmentsText: 'Post assignments, receive solutions and grade them easily.',
          fCertificatesTitle: 'Completion certificates',
          fCertificatesText: 'Issue and print certificates once a course is completed.',
          fLiveTitle: 'Live sessions',
          fLiveText: 'Live streaming rooms for lessons and reviews.',
          fProgressTitle: 'Progress tracking',
          fProgressText: 'See the course completion percentage at a glance.',
          signInHint: 'Sign in with the account created for you by the administration.',
          copyright: '\u00a9 2026 LearnEra. All rights reserved',
          supportPre: 'Need help? Contact us at',
        },
      },
      ar: {
        landing: {
          brandTag: 'منصة التعلم والتدريب الاحترافي',
          signIn: 'تسجيل الدخول',
          eyebrow: 'منصة تعليمية متكاملة',
          heroTitle: 'مرحبًا بك في LearnEra',
          heroLead:
            'نظّم دوراتك، وتابع الحضور والتقدّم، واستقبل التمارين، واحصل على شهادات الإتمام — في مكان واحد.',
          cta: 'الدخول إلى المنصة',
          explore: 'تعرّف على المزايا',
          featuresTitle: 'كل ما تحتاجه للتعلّم',
          featuresLead: 'أدوات متكاملة للطلاب والمدرّسين والمنسّقين والمسؤولين.',
          fCoursesTitle: 'دورات منظّمة',
          fCoursesText: 'دورات مقسّمة إلى أيام مع مسارات وجداول واضحة.',
          fAttendanceTitle: 'الحضور والغياب',
          fAttendanceText: 'تتبّع دقيق للحضور اليومي لكل طالب.',
          fAssignmentsTitle: 'التمارين والتسليم',
          fAssignmentsText: 'نشر التمارين واستقبال الحلول وتقييمها بسهولة.',
          fCertificatesTitle: 'شهادات الإتمام',
          fCertificatesText: 'إصدار وطباعة الشهادات عند إتمام الدورة.',
          fLiveTitle: 'الجلسات المباشرة',
          fLiveText: 'غرف بث مباشر للدروس والمراجعات.',
          fProgressTitle: 'متابعة التقدّم',
          fProgressText: 'عرض نسبة إكمال الدورة بنظرة واحدة.',
          signInHint: 'سجّل الدخول بالحساب الذي أنشأته لك الإدارة.',
          copyright: '\u00a9 2026 LearnEra. جميع الحقوق محفوظة',
          supportPre: 'هل تواجه مشكلة؟ تواصل معنا عبر',
        },
      },
    });
  }

  mountPageBackground();
})();
