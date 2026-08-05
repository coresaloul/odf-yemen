# خطة: إلغاء جميع النوافذ المنبثقة (Dialog) وتحويلها إلى صفحات مستقلة

## الهدف
استبدال كل نافذة منبثقة تحتوي نموذج إدخال (إضافة/تعديل/عرض) بصفحة مستقلة بنفس مسار الوظيفة. أزرار «إضافة/تعديل/عرض» تنتقل إلى الصفحة بدل فتح نافذة. تُحذف مكوّنات الـ Dialog القديمة.

## ما يُستثنى (يبقى كما هو)
- نوافذ التأكيد البحتة (AlertDialog بـ نعم/لا مثل تأكيد الحذف) — ليست نماذج.
- Popovers الرأس (ApprovalsPopover، NotificationsBell) — أدوات رأس الصفحة لا نماذج.
- Sheet القائمة الجانبية للموبايل — جزء من التخطيط.
- تبويبات الرواتب والتقييم — هي أصلاً نماذج مدمجة (inline) بدون نوافذ.

## المخزون الكامل للنوافذ المراد تحويلها

### 1) المهام (Tasks)
| النافذة الحالية | الصفحة الجديدة |
|---|---|
| TaskFormDialog (إنشاء) | `/tasks/new` |
| TaskFormDialog (تعديل) | `/tasks/$id/edit` |
| TaskDetailsDialog (عرض) | `/tasks/$id` |

- نقل جسم النموذج من `TaskFormDialog` إلى `src/routes/_authenticated/tasks/new.tsx` و `tasks.$id.edit.tsx`.
- نقل جسم العرض من `TaskDetailsDialog` إلى `src/routes/_authenticated/tasks.$id.tsx` (مع منطق تحديث الإنجاز/الحالة).
- أزرار «مهمة جديدة» و«تعديل» تستبدل `setFormOpen(true)` بـ `navigate({ to: "/tasks/new" })` / `navigate({ to: "/tasks/$id/edit", params })`.
- النقر على بطاقة المهمة ينتقل إلى `/tasks/$id`.
- حذف `TaskFormDialog.tsx` و `TaskDetailsDialog.tsx`.

### 2) الموظفون (Employees)
| النافذة الحالية | الصفحة الجديدة |
|---|---|
| EmployeeDialog (إنشاء) | `/employees/new` |
| EmployeeDialog (تعديل) | `/employees/$id/edit` |
| EmployeeProfileDialog (عرض + إضافة وثيقة) | `/employees/$id` |
| EmployeeAccountsDialog (ربط/إنشاء حسابات) | `/employees/accounts` |
| MoveEmployeesDialog (نقل موظفين) | `/employees/move` |

- نقل `EmployeeDialog` (المعرّف داخل `employees.tsx`) إلى ملفات صفحات منفصلة.
- نقل `EmployeeProfileDialog` إلى `employees.$id.tsx` مع نموذج إضافة/حذف الوثائق.
- `EmployeeAccountsDialog` → صفحة `/employees/accounts` (تقبل `employeeIds` عبر search params أو تعمل على الجميع).
- `MoveEmployeesDialog` → صفحة `/employees/move`.
- حذف المكوّنات المنبثقة بعد التحويل.

### 3) المخطط التنظيمي (Org)
| النافذة الحالية | الصفحة الجديدة |
|---|---|
| UnitDialog — إدارة (إنشاء) | `/org/departments/new` |
| UnitDialog — إدارة (تعديل) | `/org/departments/$id/edit` |
| UnitDialog — قسم (إنشاء) | `/org/sections/new` |
| UnitDialog — قسم (تعديل) | `/org/sections/$id/edit` |
| MoveEmployeesDialog | `/org/move` (يعيد استخدام صفحة النقل المشتركة) |

- يلزم إنشاء ملفات تخطيط `org.tsx` (layout يُخرج `<Outlet />`) ونقل محتوى `org.tsx` الحالي إلى `org.index.tsx`.
- حذف `UnitDialog.tsx`.

### 4) المستخدمون (Users)
| النافذة الحالية | الصفحة الجديدة |
|---|---|
| إنشاء مستخدم جديد | `/users/new` |
| ربط الحساب بموظف | `/users/$id/link` |
| أدوار وصلاحيات | `/users/$id/roles` |
| تعيين كلمة مرور | `/users/$id/password` |
| UserEmployeeMatchDialog (مطابقة تلقائية) | `/users/match` |
| EmployeeAccountsDialog | يعيد استخدام `/employees/accounts` |

- يلزم تحويل `users.tsx` إلى layout + `users.index.tsx`.
- حذف `UserEmployeeMatchDialog.tsx` و `EmployeeAccountsDialog.tsx` (بعد نقل المنطق للصفحات).

### 5) الإجازات (Leaves)
| النافذة الحالية | الصفحة الجديدة |
|---|---|
| LeaveRequestForm (طلب إجازة/إذن) | `/leaves/new` |

- يلزم تحويل `leaves.tsx` إلى layout + `leaves.index.tsx`.
- نقل جسم النموذج (المعرّف داخل `leaves.tsx`) إلى `leaves.new.tsx`.

### 6) الموافقات (Approvals)
| النافذة الحالية | الصفحة الجديدة |
|---|---|
| ApprovalDecisionDialog (قرار اعتماد) | `/approvals/$id` |
| CorrectionRequestDialog (طلب تصحيح دوام) | `/approvals/correction/new` |

- يلزم تحويل `approvals.tsx` إلى layout + `approvals.index.tsx`.
- حذف `ApprovalDecisionDialog.tsx` و `CorrectionRequestDialog.tsx`.

## المنهجية العامة (تُطبَّق على كل وحدة)
1. لكل صفحة تحتاج صفحات فرعية: تحويل الملف الحالي إلى **route layout** يُرجع `<Outlet />`، ونقل محتواه إلى `*.index.tsx` (القاعدة في `tanstack-route-architecture`).
2. إنشاء ملف صفحة جديد لكل عملية: `new.tsx`، `$id.tsx`، `$id/edit.tsx` بحسب الحاجة، مع `createFileRoute` المطابق و `head()` بمetadata خاص.
3. نقل جسم النموذج/العرض من الـ Dialog إلى الصفحة، مع إبارة «رجوع» وزر حفظ/تنفيذ، و`navigate` للعودة بعد النجاح.
4. استبدال كل `setOpen(true)`/`DialogTrigger` بـ `useNavigate` أو `<Link to=... params=...>`.
5. تمرير البيانات المطلوبة (قوائم الإدارات/الموظفين) عبر loader أو `useQuery` داخل الصفحة الجديدة بدل props.
6. حذف ملفات الـ Dialog المحوّلة بعد التأكد من عدم وجود مراجع.
7. التحقق من البناء بعد كل وحدة.

## الترتيب التنفيذي (لتقليل المخاطر)
1. المهام (الأكثر استعمالاً ومعزولة).
2. الموظفون.
3. المخطط التنظيمي.
4. المستخدمون.
5. الإجازات.
6. الموافقات.

## ملاحظات تقنية
- لا تعديل لملف `routeTree.gen.ts` (يُولّد تلقائياً).
- كل مسار جديد يحتاج `createFileRoute` يطابق اسم الملف بدقة.
- زر الرجوع في كل صفحة جديدة يستخدم `useNavigate` للعودة للقائمة.
- صفحات العرض (`$id`) تحمّل بياناتها عبر `useQuery` ولا تعتمد على state الأب.
- البيانات الحساسة (password) تُمرّر عبر `search` param أو تُجلب داخل الصفحة.
