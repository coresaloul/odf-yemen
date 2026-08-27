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
    PostgrestVersion: "14.17"
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
          overtime_minutes: number
          permission_minutes: number
          shift_id: string | null
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
          overtime_minutes?: number
          permission_minutes?: number
          shift_id?: string | null
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
          overtime_minutes?: number
          permission_minutes?: number
          shift_id?: string | null
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
          {
            foreignKeyName: "attendance_records_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "work_shifts"
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
      biometric_devices: {
        Row: {
          active: boolean
          auth_key: string
          auto_generate: boolean
          created_at: string
          day_start_time: string
          id: string
          last_seen_at: string | null
          location: string | null
          name: string
          punches_count: number
          serial_number: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          auth_key: string
          auto_generate?: boolean
          created_at?: string
          day_start_time?: string
          id?: string
          last_seen_at?: string | null
          location?: string | null
          name: string
          punches_count?: number
          serial_number: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          auth_key?: string
          auto_generate?: boolean
          created_at?: string
          day_start_time?: string
          id?: string
          last_seen_at?: string | null
          location?: string | null
          name?: string
          punches_count?: number
          serial_number?: string
          updated_at?: string
        }
        Relationships: []
      }
      biometric_punches: {
        Row: {
          created_at: string
          device_id: string | null
          device_serial: string | null
          device_user_id: string
          employee_id: string | null
          id: string
          processed: boolean
          punch_type: string | null
          punched_at: string
          raw: string | null
        }
        Insert: {
          created_at?: string
          device_id?: string | null
          device_serial?: string | null
          device_user_id: string
          employee_id?: string | null
          id?: string
          processed?: boolean
          punch_type?: string | null
          punched_at: string
          raw?: string | null
        }
        Update: {
          created_at?: string
          device_id?: string | null
          device_serial?: string | null
          device_user_id?: string
          employee_id?: string | null
          id?: string
          processed?: boolean
          punch_type?: string | null
          punched_at?: string
          raw?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "biometric_punches_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "biometric_devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "biometric_punches_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      consultant_contracts: {
        Row: {
          created_at: string
          employee_id: string
          end_date: string | null
          id: string
          notes: string | null
          start_date: string | null
          status: string
          title: string
          total_amount: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          employee_id: string
          end_date?: string | null
          id?: string
          notes?: string | null
          start_date?: string | null
          status?: string
          title: string
          total_amount?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          employee_id?: string
          end_date?: string | null
          id?: string
          notes?: string | null
          start_date?: string | null
          status?: string
          title?: string
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "consultant_contracts_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_installments: {
        Row: {
          amount: number
          contract_id: string
          created_at: string
          due_date: string | null
          id: string
          note: string | null
          paid_run_id: string | null
          seq: number
          status: string
          updated_at: string
        }
        Insert: {
          amount?: number
          contract_id: string
          created_at?: string
          due_date?: string | null
          id?: string
          note?: string | null
          paid_run_id?: string | null
          seq?: number
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          contract_id?: string
          created_at?: string
          due_date?: string | null
          id?: string
          note?: string | null
          paid_run_id?: string | null
          seq?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contract_installments_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "consultant_contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_installments_paid_run_id_fkey"
            columns: ["paid_run_id"]
            isOneToOne: false
            referencedRelation: "payroll_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      correspondence: {
        Row: {
          approval_stage: string
          assigned_to: string | null
          body: string | null
          completed_at: string | null
          confidentiality: string
          correspondence_date: string
          created_at: string
          created_by: string
          direction: string
          director_approved_at: string | null
          director_approved_by: string | null
          due_date: string | null
          external_reference: string | null
          hr_approved_at: string | null
          hr_approved_by: string | null
          id: string
          manager_approved_at: string | null
          manager_approved_by: string | null
          notes: string | null
          priority: string
          recipient_name: string | null
          reference_no: string | null
          return_reason: string | null
          secretariat_approved_at: string | null
          secretariat_approved_by: string | null
          sender_name: string | null
          status: string
          subject: string
          submitted_at: string | null
          updated_at: string
        }
        Insert: {
          approval_stage?: string
          assigned_to?: string | null
          body?: string | null
          completed_at?: string | null
          confidentiality?: string
          correspondence_date?: string
          created_at?: string
          created_by?: string
          direction: string
          director_approved_at?: string | null
          director_approved_by?: string | null
          due_date?: string | null
          external_reference?: string | null
          hr_approved_at?: string | null
          hr_approved_by?: string | null
          id?: string
          manager_approved_at?: string | null
          manager_approved_by?: string | null
          notes?: string | null
          priority?: string
          recipient_name?: string | null
          reference_no?: string | null
          return_reason?: string | null
          secretariat_approved_at?: string | null
          secretariat_approved_by?: string | null
          sender_name?: string | null
          status?: string
          subject: string
          submitted_at?: string | null
          updated_at?: string
        }
        Update: {
          approval_stage?: string
          assigned_to?: string | null
          body?: string | null
          completed_at?: string | null
          confidentiality?: string
          correspondence_date?: string
          created_at?: string
          created_by?: string
          direction?: string
          director_approved_at?: string | null
          director_approved_by?: string | null
          due_date?: string | null
          external_reference?: string | null
          hr_approved_at?: string | null
          hr_approved_by?: string | null
          id?: string
          manager_approved_at?: string | null
          manager_approved_by?: string | null
          notes?: string | null
          priority?: string
          recipient_name?: string | null
          reference_no?: string | null
          return_reason?: string | null
          secretariat_approved_at?: string | null
          secretariat_approved_by?: string | null
          sender_name?: string | null
          status?: string
          subject?: string
          submitted_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "correspondence_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      correspondence_actions: {
        Row: {
          action: string
          actor_id: string
          assignee_id: string | null
          correspondence_id: string
          created_at: string
          id: string
          note: string | null
        }
        Insert: {
          action: string
          actor_id?: string
          assignee_id?: string | null
          correspondence_id: string
          created_at?: string
          id?: string
          note?: string | null
        }
        Update: {
          action?: string
          actor_id?: string
          assignee_id?: string | null
          correspondence_id?: string
          created_at?: string
          id?: string
          note?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "correspondence_actions_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "correspondence_actions_correspondence_id_fkey"
            columns: ["correspondence_id"]
            isOneToOne: false
            referencedRelation: "correspondence"
            referencedColumns: ["id"]
          },
        ]
      }
      correspondence_approvals: {
        Row: {
          action: string
          actor_id: string
          correspondence_id: string
          created_at: string
          id: string
          note: string | null
          stage: string
        }
        Insert: {
          action: string
          actor_id?: string
          correspondence_id: string
          created_at?: string
          id?: string
          note?: string | null
          stage: string
        }
        Update: {
          action?: string
          actor_id?: string
          correspondence_id?: string
          created_at?: string
          id?: string
          note?: string | null
          stage?: string
        }
        Relationships: [
          {
            foreignKeyName: "correspondence_approvals_correspondence_id_fkey"
            columns: ["correspondence_id"]
            isOneToOne: false
            referencedRelation: "correspondence"
            referencedColumns: ["id"]
          },
        ]
      }
      correspondence_attachments: {
        Row: {
          correspondence_id: string
          created_at: string
          file_name: string
          file_path: string
          file_size: number
          id: string
          mime_type: string | null
          uploaded_by: string
        }
        Insert: {
          correspondence_id: string
          created_at?: string
          file_name: string
          file_path: string
          file_size?: number
          id?: string
          mime_type?: string | null
          uploaded_by?: string
        }
        Update: {
          correspondence_id?: string
          created_at?: string
          file_name?: string
          file_path?: string
          file_size?: number
          id?: string
          mime_type?: string | null
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "correspondence_attachments_correspondence_id_fkey"
            columns: ["correspondence_id"]
            isOneToOne: false
            referencedRelation: "correspondence"
            referencedColumns: ["id"]
          },
        ]
      }
      custody_approvals: {
        Row: {
          actor_id: string | null
          assignment_id: string
          created_at: string
          decision: string
          id: string
          note: string | null
          stage: string
        }
        Insert: {
          actor_id?: string | null
          assignment_id: string
          created_at?: string
          decision: string
          id?: string
          note?: string | null
          stage: string
        }
        Update: {
          actor_id?: string | null
          assignment_id?: string
          created_at?: string
          decision?: string
          id?: string
          note?: string | null
          stage?: string
        }
        Relationships: [
          {
            foreignKeyName: "custody_approvals_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "custody_assignments"
            referencedColumns: ["id"]
          },
        ]
      }
      custody_assets: {
        Row: {
          brand: string | null
          category_id: string | null
          code: string
          created_at: string
          created_by: string | null
          department_id: string | null
          document_expiry: string | null
          document_no: string | null
          id: string
          insurance_expiry: string | null
          kind: Database["public"]["Enums"]["custody_kind"]
          license_expiry: string | null
          location: string | null
          manufacture_year: number | null
          model: string | null
          name: string
          notes: string | null
          odometer: number | null
          photo_path: string | null
          plate_no: string | null
          purchase_date: string | null
          serial_no: string | null
          status: Database["public"]["Enums"]["custody_asset_status"]
          updated_at: string
          value: number
        }
        Insert: {
          brand?: string | null
          category_id?: string | null
          code: string
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          document_expiry?: string | null
          document_no?: string | null
          id?: string
          insurance_expiry?: string | null
          kind?: Database["public"]["Enums"]["custody_kind"]
          license_expiry?: string | null
          location?: string | null
          manufacture_year?: number | null
          model?: string | null
          name: string
          notes?: string | null
          odometer?: number | null
          photo_path?: string | null
          plate_no?: string | null
          purchase_date?: string | null
          serial_no?: string | null
          status?: Database["public"]["Enums"]["custody_asset_status"]
          updated_at?: string
          value?: number
        }
        Update: {
          brand?: string | null
          category_id?: string | null
          code?: string
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          document_expiry?: string | null
          document_no?: string | null
          id?: string
          insurance_expiry?: string | null
          kind?: Database["public"]["Enums"]["custody_kind"]
          license_expiry?: string | null
          location?: string | null
          manufacture_year?: number | null
          model?: string | null
          name?: string
          notes?: string | null
          odometer?: number | null
          photo_path?: string | null
          plate_no?: string | null
          purchase_date?: string | null
          serial_no?: string | null
          status?: Database["public"]["Enums"]["custody_asset_status"]
          updated_at?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "custody_assets_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "custody_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custody_assets_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      custody_assignment_items: {
        Row: {
          asset_id: string | null
          assignment_id: string
          condition_in: string | null
          condition_out: string | null
          created_at: string
          id: string
          notes: string | null
          odometer_in: number | null
          odometer_out: number | null
          quantity: number
          return_state: string | null
          returned_at: string | null
          title: string
          updated_at: string
        }
        Insert: {
          asset_id?: string | null
          assignment_id: string
          condition_in?: string | null
          condition_out?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          odometer_in?: number | null
          odometer_out?: number | null
          quantity?: number
          return_state?: string | null
          returned_at?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          asset_id?: string | null
          assignment_id?: string
          condition_in?: string | null
          condition_out?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          odometer_in?: number | null
          odometer_out?: number | null
          quantity?: number
          return_state?: string | null
          returned_at?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "custody_assignment_items_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "custody_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custody_assignment_items_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "custody_assignments"
            referencedColumns: ["id"]
          },
        ]
      }
      custody_assignments: {
        Row: {
          acknowledged_at: string | null
          cash_amount: number
          cash_settled: number
          created_at: string
          created_by: string | null
          employee_id: string
          expected_return_date: string | null
          handed_over_at: string | null
          id: string
          kind: Database["public"]["Enums"]["custody_kind"]
          notes: string | null
          purpose: string | null
          receipt_path: string | null
          requested_at: string
          returned_at: string | null
          status: Database["public"]["Enums"]["custody_assignment_status"]
          updated_at: string
        }
        Insert: {
          acknowledged_at?: string | null
          cash_amount?: number
          cash_settled?: number
          created_at?: string
          created_by?: string | null
          employee_id: string
          expected_return_date?: string | null
          handed_over_at?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["custody_kind"]
          notes?: string | null
          purpose?: string | null
          receipt_path?: string | null
          requested_at?: string
          returned_at?: string | null
          status?: Database["public"]["Enums"]["custody_assignment_status"]
          updated_at?: string
        }
        Update: {
          acknowledged_at?: string | null
          cash_amount?: number
          cash_settled?: number
          created_at?: string
          created_by?: string | null
          employee_id?: string
          expected_return_date?: string | null
          handed_over_at?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["custody_kind"]
          notes?: string | null
          purpose?: string | null
          receipt_path?: string | null
          requested_at?: string
          returned_at?: string | null
          status?: Database["public"]["Enums"]["custody_assignment_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "custody_assignments_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      custody_categories: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          kind: Database["public"]["Enums"]["custody_kind"]
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          kind: Database["public"]["Enums"]["custody_kind"]
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          kind?: Database["public"]["Enums"]["custody_kind"]
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      custody_transactions: {
        Row: {
          amount: number
          assignment_id: string
          attachment_path: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          tx_date: string
          tx_type: string
          updated_at: string
        }
        Insert: {
          amount?: number
          assignment_id: string
          attachment_path?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          tx_date?: string
          tx_type?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          assignment_id?: string
          attachment_path?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          tx_date?: string
          tx_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "custody_transactions_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "custody_assignments"
            referencedColumns: ["id"]
          },
        ]
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
      disciplinary_actions: {
        Row: {
          amount: number
          appeal_at: string | null
          appeal_decided_at: string | null
          appeal_decided_by: string | null
          appeal_decision_note: string | null
          appeal_note: string | null
          appeal_status: string
          attachment_url: string | null
          created_at: string
          created_by: string | null
          director_approved_at: string | null
          director_approved_by: string | null
          discovered_date: string
          employee_id: string
          employee_statement: string | null
          erase_at: string | null
          erased: boolean
          hr_approved_at: string | null
          hr_approved_by: string | null
          id: string
          manager_approved_at: string | null
          manager_approved_by: string | null
          payroll_adjustment_id: string | null
          penalty_days: number
          return_reason: string | null
          stage: Database["public"]["Enums"]["approval_stage"]
          statement_date: string | null
          submitted_at: string | null
          target_month: string | null
          type_id: string
          updated_at: string
          violation_date: string
          violation_description: string
        }
        Insert: {
          amount?: number
          appeal_at?: string | null
          appeal_decided_at?: string | null
          appeal_decided_by?: string | null
          appeal_decision_note?: string | null
          appeal_note?: string | null
          appeal_status?: string
          attachment_url?: string | null
          created_at?: string
          created_by?: string | null
          director_approved_at?: string | null
          director_approved_by?: string | null
          discovered_date?: string
          employee_id: string
          employee_statement?: string | null
          erase_at?: string | null
          erased?: boolean
          hr_approved_at?: string | null
          hr_approved_by?: string | null
          id?: string
          manager_approved_at?: string | null
          manager_approved_by?: string | null
          payroll_adjustment_id?: string | null
          penalty_days?: number
          return_reason?: string | null
          stage?: Database["public"]["Enums"]["approval_stage"]
          statement_date?: string | null
          submitted_at?: string | null
          target_month?: string | null
          type_id: string
          updated_at?: string
          violation_date: string
          violation_description: string
        }
        Update: {
          amount?: number
          appeal_at?: string | null
          appeal_decided_at?: string | null
          appeal_decided_by?: string | null
          appeal_decision_note?: string | null
          appeal_note?: string | null
          appeal_status?: string
          attachment_url?: string | null
          created_at?: string
          created_by?: string | null
          director_approved_at?: string | null
          director_approved_by?: string | null
          discovered_date?: string
          employee_id?: string
          employee_statement?: string | null
          erase_at?: string | null
          erased?: boolean
          hr_approved_at?: string | null
          hr_approved_by?: string | null
          id?: string
          manager_approved_at?: string | null
          manager_approved_by?: string | null
          payroll_adjustment_id?: string | null
          penalty_days?: number
          return_reason?: string | null
          stage?: Database["public"]["Enums"]["approval_stage"]
          statement_date?: string | null
          submitted_at?: string | null
          target_month?: string | null
          type_id?: string
          updated_at?: string
          violation_date?: string
          violation_description?: string
        }
        Relationships: [
          {
            foreignKeyName: "disciplinary_actions_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disciplinary_actions_type_id_fkey"
            columns: ["type_id"]
            isOneToOne: false
            referencedRelation: "disciplinary_types"
            referencedColumns: ["id"]
          },
        ]
      }
      disciplinary_types: {
        Row: {
          active: boolean
          approval_flow: string[]
          code: string
          created_at: string
          degree: number
          description: string | null
          erase_months: number
          id: string
          kind: string
          max_days: number
          name: string
          requires_amount: boolean
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          approval_flow?: string[]
          code: string
          created_at?: string
          degree?: number
          description?: string | null
          erase_months?: number
          id?: string
          kind: string
          max_days?: number
          name: string
          requires_amount?: boolean
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          approval_flow?: string[]
          code?: string
          created_at?: string
          degree?: number
          description?: string | null
          erase_months?: number
          id?: string
          kind?: string
          max_days?: number
          name?: string
          requires_amount?: boolean
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      discipline_approvals: {
        Row: {
          action: string
          actor_id: string
          actor_name: string | null
          created_at: string
          id: string
          note: string | null
          record_id: string
          record_kind: string
          stage: Database["public"]["Enums"]["approval_stage"]
        }
        Insert: {
          action: string
          actor_id: string
          actor_name?: string | null
          created_at?: string
          id?: string
          note?: string | null
          record_id: string
          record_kind: string
          stage: Database["public"]["Enums"]["approval_stage"]
        }
        Update: {
          action?: string
          actor_id?: string
          actor_name?: string | null
          created_at?: string
          id?: string
          note?: string | null
          record_id?: string
          record_kind?: string
          stage?: Database["public"]["Enums"]["approval_stage"]
        }
        Relationships: []
      }
      employee_advances: {
        Row: {
          created_at: string
          created_by: string | null
          employee_id: string
          id: string
          installment_amount: number
          installments_count: number
          notes: string | null
          paid_amount: number
          start_month: string
          status: string
          total_amount: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          employee_id: string
          id?: string
          installment_amount?: number
          installments_count?: number
          notes?: string | null
          paid_amount?: number
          start_month: string
          status?: string
          total_amount?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          employee_id?: string
          id?: string
          installment_amount?: number
          installments_count?: number
          notes?: string | null
          paid_amount?: number
          start_month?: string
          status?: string
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_advances_employee_id_fkey"
            columns: ["employee_id"]
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
      employee_lifecycle_events: {
        Row: {
          created_at: string
          created_by: string | null
          details: string | null
          employee_id: string
          event_date: string
          event_type: string
          id: string
          ref_id: string | null
          ref_table: string | null
          title: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          details?: string | null
          employee_id: string
          event_date?: string
          event_type: string
          id?: string
          ref_id?: string | null
          ref_table?: string | null
          title: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          details?: string | null
          employee_id?: string
          event_date?: string
          event_type?: string
          id?: string
          ref_id?: string | null
          ref_table?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_lifecycle_events_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_offboarding: {
        Row: {
          completed_at: string | null
          created_at: string
          created_by: string | null
          employee_id: string
          id: string
          last_working_day: string
          notice_date: string | null
          reason: string | null
          settlement_amount: number
          status: string
          termination_type: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          employee_id: string
          id?: string
          last_working_day: string
          notice_date?: string | null
          reason?: string | null
          settlement_amount?: number
          status?: string
          termination_type: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          employee_id?: string
          id?: string
          last_working_day?: string
          notice_date?: string | null
          reason?: string | null
          settlement_amount?: number
          status?: string
          termination_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_offboarding_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: true
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_payroll_components: {
        Row: {
          active: boolean
          amount: number
          component_id: string
          created_at: string
          employee_id: string
          end_date: string | null
          id: string
          start_date: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          amount?: number
          component_id: string
          created_at?: string
          employee_id: string
          end_date?: string | null
          id?: string
          start_date?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          amount?: number
          component_id?: string
          created_at?: string
          employee_id?: string
          end_date?: string | null
          id?: string
          start_date?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_payroll_components_component_id_fkey"
            columns: ["component_id"]
            isOneToOne: false
            referencedRelation: "payroll_components"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_payroll_components_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_payroll_profiles: {
        Row: {
          account_no: string | null
          active: boolean
          bank_name: string | null
          basic_salary: number
          created_at: string
          daily_rate: number
          employee_id: string
          hourly_rate: number
          iban: string | null
          id: string
          notes: string | null
          payment_method: string
          stipend: number
          updated_at: string
          worker_type: string
        }
        Insert: {
          account_no?: string | null
          active?: boolean
          bank_name?: string | null
          basic_salary?: number
          created_at?: string
          daily_rate?: number
          employee_id: string
          hourly_rate?: number
          iban?: string | null
          id?: string
          notes?: string | null
          payment_method?: string
          stipend?: number
          updated_at?: string
          worker_type?: string
        }
        Update: {
          account_no?: string | null
          active?: boolean
          bank_name?: string | null
          basic_salary?: number
          created_at?: string
          daily_rate?: number
          employee_id?: string
          hourly_rate?: number
          iban?: string | null
          id?: string
          notes?: string | null
          payment_method?: string
          stipend?: number
          updated_at?: string
          worker_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_payroll_profiles_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: true
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_recognitions: {
        Row: {
          amount: number
          attachment_url: string | null
          award_date: string
          created_at: string
          created_by: string | null
          director_approved_at: string | null
          director_approved_by: string | null
          employee_id: string
          hr_approved_at: string | null
          hr_approved_by: string | null
          id: string
          manager_approved_at: string | null
          manager_approved_by: string | null
          payroll_adjustment_id: string | null
          reason: string | null
          return_reason: string | null
          stage: Database["public"]["Enums"]["approval_stage"]
          submitted_at: string | null
          target_month: string | null
          title: string
          type_id: string
          updated_at: string
        }
        Insert: {
          amount?: number
          attachment_url?: string | null
          award_date?: string
          created_at?: string
          created_by?: string | null
          director_approved_at?: string | null
          director_approved_by?: string | null
          employee_id: string
          hr_approved_at?: string | null
          hr_approved_by?: string | null
          id?: string
          manager_approved_at?: string | null
          manager_approved_by?: string | null
          payroll_adjustment_id?: string | null
          reason?: string | null
          return_reason?: string | null
          stage?: Database["public"]["Enums"]["approval_stage"]
          submitted_at?: string | null
          target_month?: string | null
          title: string
          type_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          attachment_url?: string | null
          award_date?: string
          created_at?: string
          created_by?: string | null
          director_approved_at?: string | null
          director_approved_by?: string | null
          employee_id?: string
          hr_approved_at?: string | null
          hr_approved_by?: string | null
          id?: string
          manager_approved_at?: string | null
          manager_approved_by?: string | null
          payroll_adjustment_id?: string | null
          reason?: string | null
          return_reason?: string | null
          stage?: Database["public"]["Enums"]["approval_stage"]
          submitted_at?: string | null
          target_month?: string | null
          title?: string
          type_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_recognitions_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_recognitions_type_id_fkey"
            columns: ["type_id"]
            isOneToOne: false
            referencedRelation: "disciplinary_types"
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
          device_user_id: string | null
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
          probation_end: string | null
          probation_start: string | null
          probation_status: string
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
          device_user_id?: string | null
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
          probation_end?: string | null
          probation_start?: string | null
          probation_status?: string
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
          device_user_id?: string | null
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
          probation_end?: string | null
          probation_start?: string | null
          probation_status?: string
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
      employment_movements: {
        Row: {
          applied: boolean
          attachment_url: string | null
          created_at: string
          created_by: string | null
          effective_date: string
          employee_id: string
          from_value: string | null
          id: string
          movement_type: string
          note: string | null
          to_value: string | null
          updated_at: string
        }
        Insert: {
          applied?: boolean
          attachment_url?: string | null
          created_at?: string
          created_by?: string | null
          effective_date: string
          employee_id: string
          from_value?: string | null
          id?: string
          movement_type: string
          note?: string | null
          to_value?: string | null
          updated_at?: string
        }
        Update: {
          applied?: boolean
          attachment_url?: string | null
          created_at?: string
          created_by?: string | null
          effective_date?: string
          employee_id?: string
          from_value?: string | null
          id?: string
          movement_type?: string
          note?: string | null
          to_value?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employment_movements_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
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
      hr_request_approvals: {
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
            foreignKeyName: "hr_request_approvals_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "hr_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      hr_request_types: {
        Row: {
          active: boolean
          approval_flow: string[]
          category: string
          code: string
          created_at: string
          description: string | null
          fields: Json
          id: string
          is_confidential: boolean
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          approval_flow?: string[]
          category: string
          code: string
          created_at?: string
          description?: string | null
          fields?: Json
          id?: string
          is_confidential?: boolean
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          approval_flow?: string[]
          category?: string
          code?: string
          created_at?: string
          description?: string | null
          fields?: Json
          id?: string
          is_confidential?: boolean
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      hr_requests: {
        Row: {
          attachment_url: string | null
          created_at: string
          created_by: string | null
          director_approved_at: string | null
          director_approved_by: string | null
          employee_id: string
          hr_approved_at: string | null
          hr_approved_by: string | null
          id: string
          manager_approved_at: string | null
          manager_approved_by: string | null
          return_reason: string | null
          stage: Database["public"]["Enums"]["approval_stage"]
          submitted_at: string | null
          title: string
          type_id: string
          updated_at: string
          values: Json
        }
        Insert: {
          attachment_url?: string | null
          created_at?: string
          created_by?: string | null
          director_approved_at?: string | null
          director_approved_by?: string | null
          employee_id: string
          hr_approved_at?: string | null
          hr_approved_by?: string | null
          id?: string
          manager_approved_at?: string | null
          manager_approved_by?: string | null
          return_reason?: string | null
          stage?: Database["public"]["Enums"]["approval_stage"]
          submitted_at?: string | null
          title: string
          type_id: string
          updated_at?: string
          values?: Json
        }
        Update: {
          attachment_url?: string | null
          created_at?: string
          created_by?: string | null
          director_approved_at?: string | null
          director_approved_by?: string | null
          employee_id?: string
          hr_approved_at?: string | null
          hr_approved_by?: string | null
          id?: string
          manager_approved_at?: string | null
          manager_approved_by?: string | null
          return_reason?: string | null
          stage?: Database["public"]["Enums"]["approval_stage"]
          submitted_at?: string | null
          title?: string
          type_id?: string
          updated_at?: string
          values?: Json
        }
        Relationships: [
          {
            foreignKeyName: "hr_requests_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_requests_type_id_fkey"
            columns: ["type_id"]
            isOneToOne: false
            referencedRelation: "hr_request_types"
            referencedColumns: ["id"]
          },
        ]
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
      lifecycle_checklist_items: {
        Row: {
          created_at: string
          done_at: string | null
          done_by: string | null
          due_date: string | null
          employee_id: string
          id: string
          is_done: boolean
          kind: string
          note: string | null
          owner_role: string
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          done_at?: string | null
          done_by?: string | null
          due_date?: string | null
          employee_id: string
          id?: string
          is_done?: boolean
          kind: string
          note?: string | null
          owner_role?: string
          sort_order?: number
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          done_at?: string | null
          done_by?: string | null
          due_date?: string | null
          employee_id?: string
          id?: string
          is_done?: boolean
          kind?: string
          note?: string | null
          owner_role?: string
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lifecycle_checklist_items_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      lifecycle_checklist_templates: {
        Row: {
          active: boolean
          created_at: string
          id: string
          kind: string
          offset_days: number
          owner_role: string
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          kind: string
          offset_days?: number
          owner_role?: string
          sort_order?: number
          title: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          kind?: string
          offset_days?: number
          owner_role?: string
          sort_order?: number
          title?: string
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
      payroll_adjustments: {
        Row: {
          amount: number
          attachment_url: string | null
          created_at: string
          created_by: string | null
          employee_id: string
          id: string
          kind: string
          original_month: string | null
          reason: string | null
          reason_type: string
          run_id: string | null
          status: string
          target_month: string
          updated_at: string
        }
        Insert: {
          amount?: number
          attachment_url?: string | null
          created_at?: string
          created_by?: string | null
          employee_id: string
          id?: string
          kind: string
          original_month?: string | null
          reason?: string | null
          reason_type?: string
          run_id?: string | null
          status?: string
          target_month: string
          updated_at?: string
        }
        Update: {
          amount?: number
          attachment_url?: string | null
          created_at?: string
          created_by?: string | null
          employee_id?: string
          id?: string
          kind?: string
          original_month?: string | null
          reason?: string | null
          reason_type?: string
          run_id?: string | null
          status?: string
          target_month?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payroll_adjustments_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_adjustments_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "payroll_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_approvals: {
        Row: {
          action: string
          actor_id: string | null
          actor_name: string | null
          created_at: string
          id: string
          note: string | null
          run_id: string
          stage: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_name?: string | null
          created_at?: string
          id?: string
          note?: string | null
          run_id: string
          stage: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_name?: string | null
          created_at?: string
          id?: string
          note?: string | null
          run_id?: string
          stage?: string
        }
        Relationships: [
          {
            foreignKeyName: "payroll_approvals_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "payroll_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_components: {
        Row: {
          active: boolean
          calc_method: string
          created_at: string
          default_amount: number
          id: string
          kind: string
          name: string
          sort_order: number
          taxable: boolean
          updated_at: string
        }
        Insert: {
          active?: boolean
          calc_method?: string
          created_at?: string
          default_amount?: number
          id?: string
          kind: string
          name: string
          sort_order?: number
          taxable?: boolean
          updated_at?: string
        }
        Update: {
          active?: boolean
          calc_method?: string
          created_at?: string
          default_amount?: number
          id?: string
          kind?: string
          name?: string
          sort_order?: number
          taxable?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      payroll_item_lines: {
        Row: {
          amount: number
          created_at: string
          id: string
          item_id: string
          label: string
          line_type: string
          note: string | null
          ref_id: string | null
          source: string
        }
        Insert: {
          amount?: number
          created_at?: string
          id?: string
          item_id: string
          label: string
          line_type: string
          note?: string | null
          ref_id?: string | null
          source: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          item_id?: string
          label?: string
          line_type?: string
          note?: string | null
          ref_id?: string | null
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "payroll_item_lines_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "payroll_items"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_items: {
        Row: {
          basic_amount: number
          created_at: string
          days_absent: number
          days_present: number
          department_name: string | null
          employee_id: string
          employee_name: string
          gross_earnings: number
          iban: string | null
          id: string
          late_minutes: number
          net_amount: number
          notes: string | null
          paid_leave_days: number
          payment_method: string | null
          run_id: string
          total_deductions: number
          unpaid_leave_days: number
          updated_at: string
          worked_hours: number
          worker_type: string
        }
        Insert: {
          basic_amount?: number
          created_at?: string
          days_absent?: number
          days_present?: number
          department_name?: string | null
          employee_id: string
          employee_name: string
          gross_earnings?: number
          iban?: string | null
          id?: string
          late_minutes?: number
          net_amount?: number
          notes?: string | null
          paid_leave_days?: number
          payment_method?: string | null
          run_id: string
          total_deductions?: number
          unpaid_leave_days?: number
          updated_at?: string
          worked_hours?: number
          worker_type?: string
        }
        Update: {
          basic_amount?: number
          created_at?: string
          days_absent?: number
          days_present?: number
          department_name?: string | null
          employee_id?: string
          employee_name?: string
          gross_earnings?: number
          iban?: string | null
          id?: string
          late_minutes?: number
          net_amount?: number
          notes?: string | null
          paid_leave_days?: number
          payment_method?: string | null
          run_id?: string
          total_deductions?: number
          unpaid_leave_days?: number
          updated_at?: string
          worked_hours?: number
          worker_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "payroll_items_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_items_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "payroll_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_runs: {
        Row: {
          categories: string[]
          created_at: string
          created_by: string | null
          director_approved_at: string | null
          director_approved_by: string | null
          hr_approved_at: string | null
          hr_approved_by: string | null
          id: string
          month: string
          paid_at: string | null
          return_reason: string | null
          status: string
          title: string | null
          total_deductions: number
          total_earnings: number
          total_net: number
          updated_at: string
        }
        Insert: {
          categories?: string[]
          created_at?: string
          created_by?: string | null
          director_approved_at?: string | null
          director_approved_by?: string | null
          hr_approved_at?: string | null
          hr_approved_by?: string | null
          id?: string
          month: string
          paid_at?: string | null
          return_reason?: string | null
          status?: string
          title?: string | null
          total_deductions?: number
          total_earnings?: number
          total_net?: number
          updated_at?: string
        }
        Update: {
          categories?: string[]
          created_at?: string
          created_by?: string | null
          director_approved_at?: string | null
          director_approved_by?: string | null
          hr_approved_at?: string | null
          hr_approved_by?: string | null
          id?: string
          month?: string
          paid_at?: string | null
          return_reason?: string | null
          status?: string
          title?: string | null
          total_deductions?: number
          total_earnings?: number
          total_net?: number
          updated_at?: string
        }
        Relationships: []
      }
      payroll_settings: {
        Row: {
          created_at: string
          currency: string
          day_hours: number
          deduct_absence: boolean
          deduct_late: boolean
          deduct_unpaid_leave: boolean
          id: string
          incentive_tiers: Json
          late_grace_minutes: number
          manager_can_view: boolean
          month_days: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          currency?: string
          day_hours?: number
          deduct_absence?: boolean
          deduct_late?: boolean
          deduct_unpaid_leave?: boolean
          id?: string
          incentive_tiers?: Json
          late_grace_minutes?: number
          manager_can_view?: boolean
          month_days?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          currency?: string
          day_hours?: number
          deduct_absence?: boolean
          deduct_late?: boolean
          deduct_unpaid_leave?: boolean
          id?: string
          incentive_tiers?: Json
          late_grace_minutes?: number
          manager_can_view?: boolean
          month_days?: number
          updated_at?: string
        }
        Relationships: []
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
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          last_success_at: string | null
          p256dh: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          last_success_at?: string | null
          p256dh: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          last_success_at?: string | null
          p256dh?: string
          user_agent?: string | null
          user_id?: string
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
      shift_assignments: {
        Row: {
          created_at: string
          department_id: string | null
          employee_id: string | null
          end_date: string | null
          id: string
          notes: string | null
          section_id: string | null
          shift_id: string
          start_date: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          department_id?: string | null
          employee_id?: string | null
          end_date?: string | null
          id?: string
          notes?: string | null
          section_id?: string | null
          shift_id: string
          start_date: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          department_id?: string | null
          employee_id?: string | null
          end_date?: string | null
          id?: string
          notes?: string | null
          section_id?: string | null
          shift_id?: string
          start_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shift_assignments_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_assignments_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_assignments_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_assignments_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "work_shifts"
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
          created_by: string | null
          id: string
          is_done: boolean
          position: number
          task_id: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_done?: boolean
          position?: number
          task_id: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
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
          supervisor_id: string | null
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
          supervisor_id?: string | null
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
          supervisor_id?: string | null
          title?: string
          updated_at?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "tasks_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
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
          {
            foreignKeyName: "tasks_supervisor_id_fkey"
            columns: ["supervisor_id"]
            isOneToOne: false
            referencedRelation: "employees"
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
      work_shifts: {
        Row: {
          active: boolean
          code: string
          color: string
          created_at: string
          end_time: string
          grace_minutes: number
          id: string
          is_default: boolean
          is_night_shift: boolean
          min_overtime_minutes: number
          name: string
          notes: string | null
          overtime_enabled: boolean
          start_time: string
          updated_at: string
          work_days: number[]
        }
        Insert: {
          active?: boolean
          code: string
          color?: string
          created_at?: string
          end_time?: string
          grace_minutes?: number
          id?: string
          is_default?: boolean
          is_night_shift?: boolean
          min_overtime_minutes?: number
          name: string
          notes?: string | null
          overtime_enabled?: boolean
          start_time?: string
          updated_at?: string
          work_days?: number[]
        }
        Update: {
          active?: boolean
          code?: string
          color?: string
          created_at?: string
          end_time?: string
          grace_minutes?: number
          id?: string
          is_default?: boolean
          is_night_shift?: boolean
          min_overtime_minutes?: number
          name?: string
          notes?: string | null
          overtime_enabled?: boolean
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
      get_dashboard_analytics: {
        Args: {
          p_end_date: string
          p_is_org_wide?: boolean
          p_scope_dept_id?: string
          p_scope_emp_id?: string
          p_start_date: string
        }
        Returns: Json
      }
    }
    Enums: {
      app_role:
        | "executive_director"
        | "manager"
        | "employee"
        | "hr"
        | "secretariat"
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
      custody_asset_status:
        | "available"
        | "assigned"
        | "maintenance"
        | "damaged"
        | "written_off"
        | "lost"
      custody_assignment_status:
        | "draft"
        | "pending_manager"
        | "pending_hr"
        | "pending_director"
        | "approved"
        | "handed_over"
        | "returned"
        | "rejected"
        | "cancelled"
      custody_kind: "asset" | "vehicle" | "document" | "cash"
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
      app_role: [
        "executive_director",
        "manager",
        "employee",
        "hr",
        "secretariat",
      ],
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
      custody_asset_status: [
        "available",
        "assigned",
        "maintenance",
        "damaged",
        "written_off",
        "lost",
      ],
      custody_assignment_status: [
        "draft",
        "pending_manager",
        "pending_hr",
        "pending_director",
        "approved",
        "handed_over",
        "returned",
        "rejected",
        "cancelled",
      ],
      custody_kind: ["asset", "vehicle", "document", "cash"],
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
