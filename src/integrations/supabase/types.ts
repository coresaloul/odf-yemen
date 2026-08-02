export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      attendance_correction_approvals: {
        Row: {
          action: string
          actor_id: string
          actor_name: string | null
          created_at: string
          id: string
          note: string | null
          request_id: string
          stage: Database["public"]["Enums"]["approval_stage"]
        }
        Insert: {
          action: string
          actor_id: string
          actor_name?: string | null
          created_at?: string
          id?: string
          note?: string | null
          request_id: string
          stage: Database["public"]["Enums"]["approval_stage"]
        }
        Update: {
          action?: string
          actor_id?: string
          actor_name?: string | null
          created_at?: string
          id?: string
          note?: string | null
          request_id?: string
          stage?: Database["public"]["Enums"]["approval_stage"]
        }
        Relationships: [
          {
            foreignKeyName: "attendance_correction_approvals_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "attendance_correction_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_correction_requests: {
        Row: {
          attachment_url: string | null
          correction_type: string
          created_at: string
          created_by: string | null
          employee_id: string
          hr_approved_at: string | null
          hr_approved_by: string | null
          id: string
          manager_approved_at: string | null
          manager_approved_by: string | null
          reason: string | null
          requested_check_in: string | null
          requested_check_out: string | null
          return_reason: string | null
          stage: Database["public"]["Enums"]["approval_stage"]
          submitted_at: string | null
          updated_at: string
          work_date: string
        }
        Insert: {
          attachment_url?: string | null
          correction_type?: string
          created_at?: string
          created_by?: string | null
          employee_id: string
          hr_approved_at?: string | null
          hr_approved_by?: string | null
          id?: string
          manager_approved_at?: string | null
          manager_approved_by?: string | null
          reason?: string | null
          requested_check_in?: string | null
          requested_check_out?: string | null
          return_reason?: string | null
          stage?: Database["public"]["Enums"]["approval_stage"]
          submitted_at?: string | null
          updated_at?: string
          work_date: string
        }
        Update: {
          attachment_url?: string | null
          correction_type?: string
          created_at?: string
          created_by?: string | null
          employee_id?: string
          hr_approved_at?: string | null
          hr_approved_by?: string | null
          id?: string
          manager_approved_at?: string | null
          manager_approved_by?: string | null
          reason?: string | null
          requested_check_in?: string | null
          requested_check_out?: string | null
          return_reason?: string | null
          stage?: Database["public"]["Enums"]["approval_stage"]
          submitted_at?: string | null
          updated_at?: string
          work_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_correction_requests_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_records: {
        Row: {
          check_in: string | null
          check_out: string | null
          created_at: string
          early_leave_minutes: number
          employee_id: string
          id: string
          late_minutes: number
          notes: string | null
          permission_minutes: number
          source: string
          status: Database["public"]["Enums"]["attendance_status"]
          updated_at: string
          work_date: string
          worked_minutes: number
        }
        Insert: {
          check_in?: string | null
          check_out?: string | null
          created_at?: string
          early_leave_minutes?: number
          employee_id: string
          id?: string
          late_minutes?: number
          notes?: string | null
          permission_minutes?: number
          source?: string
          status?: Database["public"]["Enums"]["attendance_status"]
          updated_at?: string
          work_date: string
          worked_minutes?: number
        }
        Update: {
          check_in?: string | null
          check_out?: string | null
          created_at?: string
          early_leave_minutes?: number
          employee_id?: string
          id?: string
          late_minutes?: number
          notes?: string | null
          permission_minutes?: number
          source?: string
          status?: Database["public"]["Enums"]["attendance_status"]
          updated_at?: string
          work_date?: string
          worked_minutes?: number
        }
        Relationships: [
          {
            foreignKeyName: "attendance_records_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          actor_name: string | null
          created_at: string
          details: Json | null
          entity: string
          entity_id: string | null
          entity_label: string | null
          id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_name?: string | null
          created_at?: string
          details?: Json | null
          entity: string
          entity_id?: string | null
          entity_label?: string | null
          id?: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_name?: string | null
          created_at?: string
          details?: Json | null
          entity?: string
          entity_id?: string | null
          entity_label?: string | null
          id?: string
        }
        Relationships: []
      }
      departments: {
        Row: {
          created_at: string
          description: string | null
          id: string
          manager_id: string | null
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          manager_id?: string | null
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          manager_id?: string | null
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "departments_manager_fk"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_documents: {
        Row: {
          created_at: string
          doc_number: string | null
          doc_type: string
          employee_id: string
          expiry_date: string | null
          file_url: string | null
          id: string
          issue_date: string | null
          issuer: string | null
          notes: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          doc_number?: string | null
          doc_type?: string
          employee_id: string
          expiry_date?: string | null
          file_url?: string | null
          id?: string
          issue_date?: string | null
          issuer?: string | null
          notes?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          doc_number?: string | null
          doc_type?: string
          employee_id?: string
          expiry_date?: string | null
          file_url?: string | null
          id?: string
          issue_date?: string | null
          issuer?: string | null
          notes?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_documents_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          address: string | null
          allergies: string | null
          basic_salary: number | null
          birth_date: string | null
          blood_type: string | null
          chronic_diseases: string | null
          contract_end_date: string | null
          contract_type: string | null
          created_at: string
          department_id: string | null
          education_level: string | null
          email: string | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          emergency_contact_relation: string | null
          employee_no: string
          full_name: string
          gender: string | null
          hire_date: string | null
          iban: string | null
          id: string
          job_title: string | null
          manager_id: string | null
          marital_status: string | null
          national_id: string | null
          national_id_expiry: string | null
          nationality: string | null
          notes: string | null
          passport_expiry: string | null
          passport_no: string | null
          phone: string | null
          section_id: string | null
          specialization: string | null
          status: Database["public"]["Enums"]["employee_status"]
          updated_at: string
          user_id: string | null
        }
        Insert: {
          address?: string | null
          allergies?: string | null
          basic_salary?: number | null
          birth_date?: string | null
          blood_type?: string | null
          chronic_diseases?: string | null
          contract_end_date?: string | null
          contract_type?: string | null
          created_at?: string
          department_id?: string | null
          education_level?: string | null
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          emergency_contact_relation?: string | null
          employee_no: string
          full_name: string
          gender?: string | null
          hire_date?: string | null
          iban?: string | null
          id?: string
          job_title?: string | null
          manager_id?: string | null
          marital_status?: string | null
          national_id?: string | null
          national_id_expiry?: string | null
          nationality?: string | null
          notes?: string | null
          passport_expiry?: string | null
          passport_no?: string | null
          phone?: string | null
          section_id?: string | null
          specialization?: string | null
          status?: Database["public"]["Enums"]["employee_status"]
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          address?: string | null
          allergies?: string | null
          basic_salary?: number | null
          birth_date?: string | null
          blood_type?: string | null
          chronic_diseases?: string | null
          contract_end_date?: string | null
          contract_type?: string | null
          created_at?: string
          department_id?: string | null
          education_level?: string | null
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          emergency_contact_relation?: string | null
          employee_no?: string
          full_name?: string
          gender?: string | null
          hire_date?: string | null
          iban?: string | null
          id?: string
          job_title?: string | null
          manager_id?: string | null
          marital_status?: string | null
          national_id?: string | null
          national_id_expiry?: string | null
          nationality?: string | null
          notes?: string | null
          passport_expiry?: string | null
          passport_no?: string | null
          phone?: string | null
          section_id?: string | null
          specialization?: string | null
          status?: Database["public"]["Enums"]["employee_status"]
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employees_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "sections"
            referencedColumns: ["id"]
          },
        ]
      }
      evaluation_approvals: {
        Row: {
          action: string
          actor_id: string
          created_at: string
          evaluation_id: string
          id: string
          note: string | null
          stage: Database["public"]["Enums"]["approval_stage"]
        }
        Insert: {
          action: string
          actor_id?: string
          created_at?: string
          evaluation_id: string
          id?: string
          note?: string | null
          stage: Database["public"]["Enums"]["approval_stage"]
        }
        Update: {
          action?: string
          actor_id?: string
          created_at?: string
          evaluation_id?: string
          id?: string
          note?: string | null
          stage?: Database["public"]["Enums"]["approval_stage"]
        }
        Relationships: [
          {
            foreignKeyName: "evaluation_approvals_evaluation_id_fkey"
            columns: ["evaluation_id"]
            isOneToOne: false
            referencedRelation: "evaluations"
            referencedColumns: ["id"]
          },
        ]
      }
      evaluation_criteria: {
        Row: {
          created_at: string
          details: Json | null
          evaluation_id: string
          id: string
          kind: string
          max_score: number
          name: string
          note: string | null
          score: number
          template_id: string | null
          weight: number
        }
        Insert: {
          created_at?: string
          details?: Json | null
          evaluation_id: string
          id?: string
          kind?: string
          max_score?: number
          name: string
          note?: string | null
          score?: number
          template_id?: string | null
          weight?: number
        }
        Update: {
          created_at?: string
          details?: Json | null
          evaluation_id?: string
          id?: string
          kind?: string
          max_score?: number
          name?: string
          note?: string | null
          score?: number
          template_id?: string | null
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "evaluation_criteria_evaluation_id_fkey"
            columns: ["evaluation_id"]
            isOneToOne: false
            referencedRelation: "evaluations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evaluation_criteria_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "evaluation_criteria_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      evaluation_criteria_templates: {
        Row: {
          active: boolean
          applies_periods: string[]
          created_at: string
          description: string | null
          id: string
          kind: string
          max_score: number
          name: string
          sort_order: number
          updated_at: string
          weight: number
        }
        Insert: {
          active?: boolean
          applies_periods?: string[]
          created_at?: string
          description?: string | null
          id?: string
          kind?: string
          max_score?: number
          name: string
          sort_order?: number
          updated_at?: string
          weight?: number
        }
        Update: {
          active?: boolean
          applies_periods?: string[]
          created_at?: string
          description?: string | null
          id?: string
          kind?: string
          max_score?: number
          name?: string
          sort_order?: number
          updated_at?: string
          weight?: number
        }
        Relationships: []
      }
      evaluation_goals: {
        Row: {
          achievement_note: string | null
          created_at: string
          evaluation_id: string
          id: string
          metric: string | null
          status: string
          target_date: string | null
          title: string
          updated_at: string
        }
        Insert: {
          achievement_note?: string | null
          created_at?: string
          evaluation_id: string
          id?: string
          metric?: string | null
          status?: string
          target_date?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          achievement_note?: string | null
          created_at?: string
          evaluation_id?: string
          id?: string
          metric?: string | null
          status?: string
          target_date?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "evaluation_goals_evaluation_id_fkey"
            columns: ["evaluation_id"]
            isOneToOne: false
            referencedRelation: "evaluations"
            referencedColumns: ["id"]
          },
        ]
      }
      evaluation_self_assessments: {
        Row: {
          achievements: string | null
          challenges: string | null
          created_at: string
          employee_id: string
          id: string
          period: Database["public"]["Enums"]["period_type"]
          period_end: string
          period_start: string
          scores: Json
          submitted_at: string | null
          updated_at: string
        }
        Insert: {
          achievements?: string | null
          challenges?: string | null
          created_at?: string
          employee_id: string
          id?: string
          period: Database["public"]["Enums"]["period_type"]
          period_end: string
          period_start: string
          scores?: Json
          submitted_at?: string | null
          updated_at?: string
        }
        Update: {
          achievements?: string | null
          challenges?: string | null
          created_at?: string
          employee_id?: string
          id?: string
          period?: Database["public"]["Enums"]["period_type"]
          period_end?: string
          period_start?: string
          scores?: Json
          submitted_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "evaluation_self_assessments_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      evaluations: {
        Row: {
          acknowledged_at: string | null
          acknowledgement_note: string | null
          acknowledgement_status: string
          approval_stage: Database["public"]["Enums"]["approval_stage"]
          approved: boolean
          attendance_score: number
          created_at: string
          criteria_score: number
          director_approved_at: string | null
          director_approved_by: string | null
          employee_id: string
          evaluator_id: string | null
          grade: string | null
          hr_approved_at: string | null
          hr_approved_by: string | null
          id: string
          improvements: string | null
          manager_approved_at: string | null
          manager_approved_by: string | null
          notes: string | null
          period: Database["public"]["Enums"]["period_type"]
          period_end: string
          period_start: string
          return_reason: string | null
          strengths: string | null
          submitted_at: string | null
          tasks_score: number
          total_score: number
          updated_at: string
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledgement_note?: string | null
          acknowledgement_status?: string
          approval_stage?: Database["public"]["Enums"]["approval_stage"]
          approved?: boolean
          attendance_score?: number
          created_at?: string
          criteria_score?: number
          director_approved_at?: string | null
          director_approved_by?: string | null
          employee_id: string
          evaluator_id?: string | null
          grade?: string | null
          hr_approved_at?: string | null
          hr_approved_by?: string | null
          id?: string
          improvements?: string | null
          manager_approved_at?: string | null
          manager_approved_by?: string | null
          notes?: string | null
          period?: Database["public"]["Enums"]["period_type"]
          period_end: string
          period_start: string
          return_reason?: string | null
          strengths?: string | null
          submitted_at?: string | null
          tasks_score?: number
          total_score?: number
          updated_at?: string
        }
        Update: {
          acknowledged_at?: string | null
          acknowledgement_note?: string | null
          acknowledgement_status?: string
          approval_stage?: Database["public"]["Enums"]["approval_stage"]
          approved?: boolean
          attendance_score?: number
          created_at?: string
          criteria_score?: number
          director_approved_at?: string | null
          director_approved_by?: string | null
          employee_id?: string
          evaluator_id?: string | null
          grade?: string | null
          hr_approved_at?: string | null
          hr_approved_by?: string | null
          id?: string
          improvements?: string | null
          manager_approved_at?: string | null
          manager_approved_by?: string | null
          notes?: string | null
          period?: Database["public"]["Enums"]["period_type"]
          period_end?: string
          period_start?: string
          return_reason?: string | null
          strengths?: string | null
          submitted_at?: string | null
          tasks_score?: number
          total_score?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "evaluations_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      holidays: {
        Row: {
          created_at: string
          end_date: string
          id: string
          name: string
          recurring_annually: boolean
          start_date: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          end_date: string
          id?: string
          name: string
          recurring_annually?: boolean
          start_date: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          end_date?: string
          id?: string
          name?: string
          recurring_annually?: boolean
          start_date?: string
          updated_at?: string
        }
        Relationships: []
      }
      leave_approvals: {
        Row: {
          action: string
          actor_id: string
          actor_name: string | null
          created_at: string
          id: string
          note: string | null
          request_id: string
          stage: Database["public"]["Enums"]["approval_stage"]
        }
        Insert: {
          action: string
          actor_id: string
          actor_name?: string | null
          created_at?: string
          id?: string
          note?: string | null
          request_id: string
          stage: Database["public"]["Enums"]["approval_stage"]
        }
        Update: {
          action?: string
          actor_id?: string
          actor_name?: string | null
          created_at?: string
          id?: string
          note?: string | null
          request_id?: string
          stage?: Database["public"]["Enums"]["approval_stage"]
        }
        Relationships: [
          {
            foreignKeyName: "leave_approvals_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "leave_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_balances: {
        Row: {
          carried: number
          created_at: string
          employee_id: string
          entitled: number
          id: string
          leave_type_id: string
          updated_at: string
          used: number
          year: number
        }
        Insert: {
          carried?: number
          created_at?: string
          employee_id: string
          entitled?: number
          id?: string
          leave_type_id: string
          updated_at?: string
          used?: number
          year: number
        }
        Update: {
          carried?: number
          created_at?: string
          employee_id?: string
          entitled?: number
          id?: string
          leave_type_id?: string
          updated_at?: string
          used?: number
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "leave_balances_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_balances_leave_type_id_fkey"
            columns: ["leave_type_id"]
            isOneToOne: false
            referencedRelation: "leave_types"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_requests: {
        Row: {
          attachment_url: string | null
          created_at: string
          created_by: string | null
          days: number
          director_approved_at: string | null
          director_approved_by: string | null
          employee_id: string
          end_date: string
          end_time: string | null
          hours: number
          hr_approved_at: string | null
          hr_approved_by: string | null
          id: string
          kind: string
          leave_type_id: string
          manager_approved_at: string | null
          manager_approved_by: string | null
          reason: string | null
          return_reason: string | null
          stage: Database["public"]["Enums"]["approval_stage"]
          start_date: string
          start_time: string | null
          submitted_at: string | null
          updated_at: string
        }
        Insert: {
          attachment_url?: string | null
          created_at?: string
          created_by?: string | null
          days?: number
          director_approved_at?: string | null
          director_approved_by?: string | null
          employee_id: string
          end_date: string
          end_time?: string | null
          hours?: number
          hr_approved_at?: string | null
          hr_approved_by?: string | null
          id?: string
          kind?: string
          leave_type_id: string
          manager_approved_at?: string | null
          manager_approved_by?: string | null
          reason?: string | null
          return_reason?: string | null
          stage?: Database["public"]["Enums"]["approval_stage"]
          start_date: string
          start_time?: string | null
          submitted_at?: string | null
          updated_at?: string
        }
        Update: {
          attachment_url?: string | null
          created_at?: string
          created_by?: string | null
          days?: number
          director_approved_at?: string | null
          director_approved_by?: string | null
          employee_id?: string
          end_date?: string
          end_time?: string | null
          hours?: number
          hr_approved_at?: string | null
          hr_approved_by?: string | null
          id?: string
          kind?: string
          leave_type_id?: string
          manager_approved_at?: string | null
          manager_approved_by?: string | null
          reason?: string | null
          return_reason?: string | null
          stage?: Database["public"]["Enums"]["approval_stage"]
          start_date?: string
          start_time?: string | null
          submitted_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leave_requests_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_requests_leave_type_id_fkey"
            columns: ["leave_type_id"]
            isOneToOne: false
            referencedRelation: "leave_types"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_types: {
        Row: {
          active: boolean
          annual_days: number
          code: string
          created_at: string
          id: string
          is_hourly: boolean
          is_paid: boolean
          name: string
          position: number
          requires_attachment: boolean
          updated_at: string
        }
        Insert: {
          active?: boolean
          annual_days?: number
          code: string
          created_at?: string
          id?: string
          is_hourly?: boolean
          is_paid?: boolean
          name: string
          position?: number
          requires_attachment?: boolean
          updated_at?: string
        }
        Update: {
          active?: boolean
          annual_days?: number
          code?: string
          created_at?: string
          id?: string
          is_hourly?: boolean
          is_paid?: boolean
          name?: string
          position?: number
          requires_attachment?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      notification_preferences: {
        Row: {
          created_at: string
          email_enabled: boolean
          email_evaluation: boolean
          email_task_assigned: boolean
          email_task_progress: boolean
          email_task_status: boolean
          inapp_enabled: boolean
          inapp_evaluation: boolean
          inapp_task_assigned: boolean
          inapp_task_progress: boolean
          inapp_task_status: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email_enabled?: boolean
          email_evaluation?: boolean
          email_task_assigned?: boolean
          email_task_progress?: boolean
          email_task_status?: boolean
          inapp_enabled?: boolean
          inapp_evaluation?: boolean
          inapp_task_assigned?: boolean
          inapp_task_progress?: boolean
          inapp_task_status?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email_enabled?: boolean
          email_evaluation?: boolean
          email_task_assigned?: boolean
          email_task_progress?: boolean
          email_task_status?: boolean
          inapp_enabled?: boolean
          inapp_evaluation?: boolean
          inapp_task_assigned?: boolean
          inapp_task_progress?: boolean
          inapp_task_status?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          is_read: boolean
          task_id: string | null
          title: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          task_id?: string | null
          title: string
          type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          task_id?: string | null
          title?: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      sections: {
        Row: {
          created_at: string
          department_id: string
          description: string | null
          id: string
          manager_id: string | null
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          department_id: string
          description?: string | null
          id?: string
          manager_id?: string | null
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          department_id?: string
          description?: string | null
          id?: string
          manager_id?: string | null
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sections_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sections_manager_fk"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      task_attachments: {
        Row: {
          created_at: string
          file_name: string
          file_path: string
          file_size: number | null
          id: string
          mime_type: string | null
          task_id: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          file_name: string
          file_path: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          task_id: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          file_name?: string
          file_path?: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          task_id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "task_attachments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_subtasks: {
        Row: {
          created_at: string
          id: string
          is_done: boolean
          position: number
          task_id: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_done?: boolean
          position?: number
          task_id: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_done?: boolean
          position?: number
          task_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_subtasks_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_updates: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          note: string | null
          progress: number | null
          task_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          progress?: number | null
          task_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          progress?: number | null
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_updates_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          approval_note: string | null
          approved_at: string | null
          approved_by: string | null
          assigned_by: string | null
          assignee_id: string
          completed_at: string | null
          created_at: string
          created_via_voice: boolean
          description: string | null
          due_date: string | null
          id: string
          parent_task_id: string | null
          priority: Database["public"]["Enums"]["task_priority"]
          progress: number
          recurrence: string | null
          start_date: string
          status: Database["public"]["Enums"]["task_status"]
          submitted_for_approval_at: string | null
          title: string
          updated_at: string
          weight: number
        }
        Insert: {
          approval_note?: string | null
          approved_at?: string | null
          approved_by?: string | null
          assigned_by?: string | null
          assignee_id: string
          completed_at?: string | null
          created_at?: string
          created_via_voice?: boolean
          description?: string | null
          due_date?: string | null
          id?: string
          parent_task_id?: string | null
          priority?: Database["public"]["Enums"]["task_priority"]
          progress?: number
          recurrence?: string | null
          start_date?: string
          status?: Database["public"]["Enums"]["task_status"]
          submitted_for_approval_at?: string | null
          title: string
          updated_at?: string
          weight?: number
        }
        Update: {
          approval_note?: string | null
          approved_at?: string | null
          approved_by?: string | null
          assigned_by?: string | null
          assignee_id?: string
          completed_at?: string | null
          created_at?: string
          created_via_voice?: boolean
          description?: string | null
          due_date?: string | null
          id?: string
          parent_task_id?: string | null
          priority?: Database["public"]["Enums"]["task_priority"]
          progress?: number
          recurrence?: string | null
          start_date?: string
          status?: Database["public"]["Enums"]["task_status"]
          submitted_for_approval_at?: string | null
          title?: string
          updated_at?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "tasks_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_parent_task_id_fkey"
            columns: ["parent_task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      work_settings: {
        Row: {
          created_at: string
          end_time: string
          grace_minutes: number
          id: boolean
          start_time: string
          updated_at: string
          work_days: number[]
        }
        Insert: {
          created_at?: string
          end_time?: string
          grace_minutes?: number
          id?: boolean
          start_time?: string
          updated_at?: string
          work_days?: number[]
        }
        Update: {
          created_at?: string
          end_time?: string
          grace_minutes?: number
          id?: boolean
          start_time?: string
          updated_at?: string
          work_days?: number[]
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      app_role: "executive_director" | "manager" | "employee" | "hr"
      approval_stage:
        | "draft"
        | "pending_manager"
        | "pending_hr"
        | "pending_director"
        | "approved"
        | "returned"
      attendance_status:
        | "present"
        | "absent"
        | "leave"
        | "holiday"
        | "permission"
      employee_status: "active" | "on_leave" | "terminated"
      period_type:
        | "daily"
        | "weekly"
        | "monthly"
        | "quarterly"
        | "semiannual"
        | "annual"
      task_priority: "low" | "medium" | "high" | "urgent"
      task_status:
        | "new"
        | "in_progress"
        | "completed"
        | "cancelled"
        | "pending_approval"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["executive_director", "manager", "employee", "hr"],
      approval_stage: [
        "draft",
        "pending_manager",
        "pending_hr",
        "pending_director",
        "approved",
        "returned",
      ],
      attendance_status: [
        "present",
        "absent",
        "leave",
        "holiday",
        "permission",
      ],
      employee_status: ["active", "on_leave", "terminated"],
      period_type: [
        "daily",
        "weekly",
        "monthly",
        "quarterly",
        "semiannual",
        "annual",
      ],
      task_priority: ["low", "medium", "high", "urgent"],
      task_status: [
        "new",
        "in_progress",
        "completed",
        "cancelled",
        "pending_approval",
      ],
    },
  },
} as const
