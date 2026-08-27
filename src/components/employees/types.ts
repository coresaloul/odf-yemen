import { EMPLOYEE_STATUS_LABELS } from "@/lib/hr";

export type Employee = {
  id: string;
  full_name: string;
  employee_no: string;
  status: keyof typeof EMPLOYEE_STATUS_LABELS;
  job_title?: string | null;
  email?: string | null;
  user_id?: string | null;
  phone?: string | null;
  hire_date?: string | null;
  department_id?: string | null;
  section_id?: string | null;
  manager_id?: string | null;
  birth_date?: string | null;
  gender?: string | null;
  marital_status?: string | null;
  blood_type?: string | null;
  chronic_diseases?: string | null;
  allergies?: string | null;
  nationality?: string | null;
  national_id?: string | null;
  national_id_expiry?: string | null;
  passport_no?: string | null;
  passport_expiry?: string | null;
  address?: string | null;
  education_level?: string | null;
  specialization?: string | null;
  contract_type?: string | null;
  contract_end_date?: string | null;
  basic_salary?: number | null;
  iban?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  emergency_contact_relation?: string | null;
  notes?: string | null;
};

export type Department = {
  id: string;
  name: string;
};

export type Section = {
  id: string;
  name: string;
  department_id: string;
};

export const GENDERS = ["ذكر", "أنثى"];
export const MARITAL = ["أعزب", "متزوج", "مطلق", "أرمل"];
export const BLOOD_TYPES = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
export const EDUCATION = ["ثانوية", "دبلوم", "بكالوريوس", "ماجستير", "دكتوراه"];
export const CONTRACTS = ["دوام كامل", "دوام جزئي", "مؤقت", "متعاون", "تحت التجربة"];
