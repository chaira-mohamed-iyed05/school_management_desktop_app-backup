const fs = require('fs');
const path = require('path');

const localesDir = path.join(__dirname, '..', 'src', 'renderer', 'i18n', 'locales');

const arPath = path.join(localesDir, 'ar.json');
const frPath = path.join(localesDir, 'fr.json');
const enPath = path.join(localesDir, 'en.json');

const ar = JSON.parse(fs.readFileSync(arPath, 'utf8'));
const fr = JSON.parse(fs.readFileSync(frPath, 'utf8'));
const en = JSON.parse(fs.readFileSync(enPath, 'utf8'));

// Helper to deep merge
function merge(target, source) {
  for (const key of Object.keys(source)) {
    if (source[key] instanceof Object && !Array.isArray(source[key])) {
      if (!target[key]) Object.assign(target, { [key]: {} });
      merge(target[key], source[key]);
    } else {
      target[key] = source[key];
    }
  }
}

const arAdditions = {
  students: {
    paidNoDebt: "خالص (بدون ديون)",
    inDebt: "عليه ديون",
    inDebtWithAmount: "عليه ديون ({{amount}})",
    paidZeroDebt: "خالص (0 دج ديون)",
    moduleFilter: "المادة",
    teacherFilter: "الأستاذ",
    groupFilter: "الفوج",
    filterModulePlaceholder: "فلترة حسب المادة...",
    filterTeacherPlaceholder: "فلترة حسب الأستاذ...",
    filterGroupPlaceholder: "فلترة حسب الفوج...",
    resetFilters: "إعادة ضبط",
    resetFiltersTitle: "إعادة ضبط الفلاتر",
    enrolledGroups: "الأفواج المسجل فيها",
    paymentStatusHeader: "حالة الدفع / الديون",
    suspendConfirm: "هل تريد تعليق تسجيل الطالب في هذه المادة (غير نشط)؟ لن يتم اقتطاع الرصيد عند تسجيل غيابه أو حضوره.",
    reactivateConfirm: "هل تريد إعادة تفعيل تسجيل الطالب في هذه المادة؟",
    selectGroupFirst: "يرجى اختيار الفوج أولاً",
    transferSuccess: "تم تحويل الرصيد وتسجيل الدفعة بنجاح!",
    overview: "نظرة عامة",
    courseHistory: "سجل الحضور والدروس",
    changePhoto: "تغيير الصورة",
    guardianLabel: "ولي الأمر",
    restoreStudent: "استعادة الطالب",
    archivedNotice: "هذا الطالب مؤرشف حالياً. يمكنك استعادته لتفعيل بطاقته واستئناف التسجيلات.",
    restoreAndActivate: "استعادة وتفعيل",
    archiveDangerZone: "منطقة الحظر / الأرشفة",
    activeGroupsCount: "{{count}} فوج نشط",
    monthlyTotal: "المجموع الشهري",
    enrollmentsAndBalances: "التسجيلات ورصيد المواد",
    noEnrollmentsYet: "لا توجد تسجيلات بعد",
    perMonth: "شهر",
    transferCredit: "تحويل الرصيد",
    transferCreditSubtitle: "تحويل الرصيد المالي المتبقي من مادة إلى أخرى",
    closeSourceEnrollment: "غلق التسجيل المصدر بعد التحويل",
    sourceGroup: "الفوج المصدر",
    targetGroup: "الفوج المستهدف",
    transferAmount: "المبلغ المراد تحويله (دج)",
    confirmCreditTransfer: "تأكيد تحويل الرصيد",
    sessionAuditHistory: "سجل الدروس والحضور",
    manualStatusOverride: "تعديل حالة الجلسة يدوياً",
    notActiveRefunded: "غير نشط (معوض)"
  },
  teachers: {
    selectModuleRequired: "يرجى اختيار المادة التي يدرّسها الأستاذ",
    restoreConfirm: "هل تريد استعادة وتفعيل هذا الأستاذ؟",
    allModules: "جميع المواد",
    unspecified: "غير محدد",
    moduleLabel: "المادة: {{name}}",
    restore: "استعادة",
    assignedModule: "المادة التي يدرّسها الأستاذ *",
    selectModulePlaceholder: "-- اختر المادة --",
    singleModuleNotice: "كل أستاذ مرتبط بمادة واحدة محددة. إذا كان الأستاذ يدرّس أكثر من مادة، أنشئ ملفاً مستقلاً لكل مادة.",
    archivedTeachers: "الأساتذة المؤرشفون"
  },
  dashboard: {
    timetableSpreadsheet: "جدول التوقيت الأسبوعي",
    resetFilters: "إعادة ضبط الفلاتر",
    filterByModule: "فلترة حسب المادة",
    filterByTeacher: "فلترة حسب الأستاذ",
    filterByGroup: "فلترة حسب الفوج",
    searchPlaceholder: "بحث...",
    startLiveScanner: "تشغيل الماسح الضوئي اللحظي",
    viewGroupRoster: "عرض قائمة الفوج",
    unscheduledSession: "حصة إضافية غير مجدولة"
  }
};

const frAdditions = {
  students: {
    paidNoDebt: "Payé (Sans dette)",
    inDebt: "En dette",
    inDebtWithAmount: "En dette ({{amount}})",
    paidZeroDebt: "Payé (0 DA dette)",
    moduleFilter: "Module",
    teacherFilter: "Enseignant",
    groupFilter: "Groupe",
    filterModulePlaceholder: "Filtrer par module...",
    filterTeacherPlaceholder: "Filtrer par enseignant...",
    filterGroupPlaceholder: "Filtrer par groupe...",
    resetFilters: "Réinitialiser",
    resetFiltersTitle: "Réinitialiser les filtres",
    enrolledGroups: "Groupes inscrits",
    paymentStatusHeader: "Statut Paiement / Dette",
    suspendConfirm: "Désactiver cette inscription ? Le solde ne sera pas déduit lors des présences.",
    reactivateConfirm: "Réactiver cette inscription ?",
    selectGroupFirst: "Veuillez sélectionner un groupe",
    transferSuccess: "Transfert de crédit enregistré avec succès !",
    overview: "Vue d'ensemble",
    courseHistory: "Historique des cours",
    changePhoto: "Changer la photo",
    guardianLabel: "Tuteur / Parent",
    restoreStudent: "Restaurer l'étudiant",
    archivedNotice: "Cet étudiant est archivé. Restaurez-le pour réactiver sa carte QR et ses inscriptions.",
    restoreAndActivate: "Restaurer et réactiver",
    archiveDangerZone: "Zone d'archivage",
    activeGroupsCount: "{{count}} groupe(s) actif(s)",
    monthlyTotal: "Total mensuel",
    enrollmentsAndBalances: "Inscriptions & Solde par cours",
    noEnrollmentsYet: "Aucune inscription active",
    perMonth: "mois",
    transferCredit: "Transfert de crédit",
    transferCreditSubtitle: "Transférer le solde financier vers un autre cours",
    closeSourceEnrollment: "Fermer l'inscription source après transfert",
    sourceGroup: "Groupe source",
    targetGroup: "Groupe cible",
    transferAmount: "Montant à transférer (DA)",
    confirmCreditTransfer: "Confirmer le transfert",
    sessionAuditHistory: "Historique des séances et présences",
    manualStatusOverride: "Modifier manuellement le statut de la séance",
    notActiveRefunded: "Non actif (Remboursé)"
  },
  teachers: {
    selectModuleRequired: "Veuillez sélectionner le module enseigné",
    restoreConfirm: "Voulez-vous restaurer et réactiver cet enseignant ?",
    allModules: "Tous les modules",
    unspecified: "Non spécifié",
    moduleLabel: "Module : {{name}}",
    restore: "Restaurer",
    assignedModule: "Module enseigné *",
    selectModulePlaceholder: "-- Sélectionnez un module --",
    singleModuleNotice: "Chaque profil est lié à un seul module. Si un enseignant enseigne plusieurs modules, créez un profil pour chaque module.",
    archivedTeachers: "Enseignants archivés"
  },
  dashboard: {
    timetableSpreadsheet: "Emploi du temps hebdomadaire",
    resetFilters: "Réinitialiser les filtres",
    filterByModule: "Filtrer par module",
    filterByTeacher: "Filtrer par enseignant",
    filterByGroup: "Filtrer par groupe",
    searchPlaceholder: "Rechercher...",
    startLiveScanner: "Lancer le scanner QR en direct",
    viewGroupRoster: "Consulter la liste du groupe",
    unscheduledSession: "Séance supplémentaire"
  }
};

const enAdditions = {
  students: {
    paidNoDebt: "Paid (No debt)",
    inDebt: "In debt",
    inDebtWithAmount: "In debt ({{amount}})",
    paidZeroDebt: "Paid (0 DA debt)",
    moduleFilter: "Module",
    teacherFilter: "Teacher",
    groupFilter: "Group",
    filterModulePlaceholder: "Filter by module...",
    filterTeacherPlaceholder: "Filter by teacher...",
    filterGroupPlaceholder: "Filter by group...",
    resetFilters: "Reset",
    resetFiltersTitle: "Reset filters",
    enrolledGroups: "Enrolled Groups",
    paymentStatusHeader: "Payment / Debt Status",
    suspendConfirm: "Suspend student enrollment in this module (inactive)? Balance will not be deducted for attendance.",
    reactivateConfirm: "Reactivate student enrollment in this module?",
    selectGroupFirst: "Please select a group first",
    transferSuccess: "Credit balance transferred successfully!",
    overview: "Overview",
    courseHistory: "Course & Attendance History",
    changePhoto: "Change Photo",
    guardianLabel: "Guardian / Parent",
    restoreStudent: "Restore Student",
    archivedNotice: "This student is currently archived. Restore them to reactivate their QR card and enrollments.",
    restoreAndActivate: "Restore & Activate",
    archiveDangerZone: "Archive / Block Zone",
    activeGroupsCount: "{{count}} active group(s)",
    monthlyTotal: "Monthly Total",
    enrollmentsAndBalances: "Enrollments & Course Balances",
    noEnrollmentsYet: "No active enrollments yet",
    perMonth: "month",
    transferCredit: "Credit Transfer",
    transferCreditSubtitle: "Transfer remaining credit balance to another course",
    closeSourceEnrollment: "Close source enrollment after transfer",
    sourceGroup: "Source Group",
    targetGroup: "Target Group",
    transferAmount: "Transfer Amount (DA)",
    confirmCreditTransfer: "Confirm Credit Transfer",
    sessionAuditHistory: "Sessions & Attendance Audit Log",
    manualStatusOverride: "Manually override session attendance status",
    notActiveRefunded: "Not Active (Refunded)"
  },
  teachers: {
    selectModuleRequired: "Please select the module taught by the teacher",
    restoreConfirm: "Do you want to restore and reactivate this teacher?",
    allModules: "All Modules",
    unspecified: "Unspecified",
    moduleLabel: "Module: {{name}}",
    restore: "Restore",
    assignedModule: "Module taught *",
    selectModulePlaceholder: "-- Select a module --",
    singleModuleNotice: "Each teacher profile is bound to a single module. If a teacher teaches multiple modules, create a separate profile for each module.",
    archivedTeachers: "Archived Teachers"
  },
  dashboard: {
    timetableSpreadsheet: "Weekly Timetable Schedule",
    resetFilters: "Reset Filters",
    filterByModule: "Filter by Module",
    filterByTeacher: "Filter by Teacher",
    filterByGroup: "Filter by Group",
    searchPlaceholder: "Search...",
    startLiveScanner: "Launch Live QR Scanner",
    viewGroupRoster: "View Group Roster",
    unscheduledSession: "Unscheduled Extra Session"
  }
};

merge(ar, arAdditions);
merge(fr, frAdditions);
merge(en, enAdditions);

fs.writeFileSync(arPath, JSON.stringify(ar, null, 2), 'utf8');
fs.writeFileSync(frPath, JSON.stringify(fr, null, 2), 'utf8');
fs.writeFileSync(enPath, JSON.stringify(en, null, 2), 'utf8');

console.log('Successfully updated locales ar.json, fr.json, and en.json');
