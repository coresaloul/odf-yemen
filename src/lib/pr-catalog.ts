import type { GrantSector } from "./pr-crm";

export type ProjectPitchItem = {
  id: string;
  title: string;
  sector: GrantSector;
  estimatedAmount: number;
  currency: string;
  targetBeneficiaries: string;
  summary: string;
  keyOutcomes: string[];
  durationMonths: number;
};

export const PACKAGED_PROJECT_PITCHES: ProjectPitchItem[] = [
  {
    id: "vocational-carpentry",
    title: "تشغيل ورشة النجارة الحرفية وتدريب 40 يتيماً على مهن سوق العمل",
    sector: "vocational_training",
    estimatedAmount: 12000,
    currency: "USD",
    targetBeneficiaries: "40 شاباً من خريجي الثانوية من الأيتام",
    summary:
      "مشروع تدريبي وإنتاجي متكامل يهدف إلى تزويد الأيتام بالمهارات الحرفية المتقدمة في صناعة الأثاث والمشغولات الخشبية مع توفير حقيبة عِدد لكل خريج للبدء في مشروعه الخاص.",
    keyOutcomes: [
      "تدريب مكثف لمدة 6 أشهر بواقع 360 ساعة تدريبية",
      "تسليم حقائب عِدد إنتاجية متكاملة للخريجين المتميزين",
      "معرض لمنتجات الورشة لتسويق مخرجات المتدربين",
    ],
    durationMonths: 6,
  },
  {
    id: "tech-lab-programming",
    title: "تجهيز معمل حاسوب وبرمجة ورعاية 60 طالباً يتيماً في الذكاء الاصطناعي والتصميم",
    sector: "education",
    estimatedAmount: 9500,
    currency: "USD",
    targetBeneficiaries: "60 طالباً وطالبة من المتفوقين دراسياً",
    summary:
      "تأسيس معمل تقني حديث مزود بـ 20 جهاز حاسوب عالي الكفاءة وشاشة تفاعلية وتدريب الأيتام على البرمجة، التصميم الجرافيكي، وأساسيات الذكاء الاصطناعي للعمل عن بعد.",
    keyOutcomes: [
      "تجهيز معمل تقني مستدام لخدمة المؤسسة لأعوام قادمة",
      "دبلوم تدريبي معتمد في مهارات العمل الرقمي والحر (Freelancing)",
      "ربط الخريجين بمنصات العمل الحر الدولية",
    ],
    durationMonths: 4,
  },
  {
    id: "sewing-empowerment",
    title: "تمكين بنات الأيتام وأمهاتهن في فنون الخياطة والتطريز وتأسيس 25 مشروعاً منزلياً",
    sector: "vocational_training",
    estimatedAmount: 7500,
    currency: "USD",
    targetBeneficiaries: "30 فتاة وأم يتيم",
    summary:
      "تأهيل الفتيات وأمهات الأيتام على مهارات الخياطة والتفصيل وتصميم الأزياء، مع تمليك مكائن خياطة للمتميزات لضمان دخل كريم ومستدام للأسرة.",
    keyOutcomes: [
      "إتقان الخياطة الحديثة وإنتاج الزي المدرسي والملابس الجاهزة",
      "توزيع 25 ماكينة خياطة حديثة مع أدوات الإنتاج",
      "تحقيق الاستقلال المالي لـ 25 أسرة يتيم",
    ],
    durationMonths: 3,
  },
  {
    id: "orphan-sponsorship-50",
    title: "برنامج الرعاية الشاملة وكفالة التعليم والغذاء لـ 50 يتيماً لمدة عام",
    sector: "social_sponsorship",
    estimatedAmount: 18000,
    currency: "USD",
    targetBeneficiaries: "50 يتيماً ويتيمة من الأشد احتياجاً",
    summary:
      "توفير الكفالة المعيشية الشهرية، الحقيبة والزي المدرسي، والدروس التعويضية والرعاية النفسية والتربوية لضمان استمرار الأيتام في مقاعد الدراسة.",
    keyOutcomes: [
      "صرف كفالات نقدية منتظمة طوال 12 شهراً",
      "تأمين المستلزمات المدرسية الكاملة",
      "تقارير دورية ربعية للمانح توثق التحصيل الدراسي للأيتام",
    ],
    durationMonths: 12,
  },
  {
    id: "medical-care-orphans",
    title: "صندوق الرعاية الصحية والفحوصات الدورية لـ 200 يتيم",
    sector: "healthcare",
    estimatedAmount: 5000,
    currency: "USD",
    targetBeneficiaries: "200 يتيم ويتيمة",
    summary:
      "إجراء الفحوصات الطبية الدورية، توفير الأدوية لأصحاب الأمراض المزمنة، وتغطية العمليات الجراحية العاجلة والنظارات الطبية لطلاب مراكز المؤسسة.",
    keyOutcomes: [
      "إجراء فحص سريري ومخبري شامل لـ 200 يتيم",
      "توفير بطاقات تأمين صحي جزئي للأيتام الأشد مرضاً",
      "حقائب إسعافات أولية لمراكز ومساكن الأيتام",
    ],
    durationMonths: 12,
  },
  {
    id: "food-baskets-campaign",
    title: "مشروع السلال الغذائية الطارئة لـ 150 أسرة يتيم (موسم رمضان المبارك)",
    sector: "relief",
    estimatedAmount: 8500,
    currency: "USD",
    targetBeneficiaries: "150 أسرة يتيم (متوسط 900 فرد)",
    summary:
      "توفير سلال غذائية متكاملة تكفي احتياج أسرة اليتيم طوال شهر رمضان المبارك، للتخفيف من وطأة الظروف المعيشية الصعبة.",
    keyOutcomes: [
      "توزيع 150 سلة غذائية متكاملة بمواصفات جودة عالية",
      "توثيق التوزيع بشفافية وإرسال تقارير مصورة للمانح",
    ],
    durationMonths: 1,
  },
];
