import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "executive_director" | "manager" | "hr" | "secretariat" | "employee";

export type EmployeeLite = {
  id: string;
  full_name: string;
  employee_no: string;
  job_title: string | null;
  department_id: string | null;
  section_id: string | null;
  manager_id: string | null;
} | null;

type AuthState = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  roles: AppRole[];
  employee: EmployeeLite;
  isDirector: boolean;
  isManager: boolean;
  isHR: boolean;
  isSecretariat: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [employee, setEmployee] = useState<EmployeeLite>(null);

  const loadProfileData = async (uid: string | undefined) => {
    if (!uid) {
      setRoles([]);
      setEmployee(null);
      return;
    }
    const [{ data: roleRows }, { data: employeeRow }] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", uid),
      supabase
        .from("employees")
        .select("id, full_name, employee_no, job_title, department_id, section_id, manager_id")
        .eq("user_id", uid)
        .maybeSingle(),
    ]);
    setRoles(((roleRows ?? []) as { role: AppRole }[]).map((r) => r.role));
    setEmployee((employeeRow as EmployeeLite) ?? null);
  };

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
      setTimeout(() => {
        void loadProfileData(newSession?.user?.id);
      }, 0);
    });

    void supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      await loadProfileData(data.session?.user?.id);
      setLoading(false);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const value = useMemo<AuthState>(() => {
    const isDirector = roles.includes("executive_director");
    const isSecretariat = roles.includes("secretariat");
    return {
      user,
      session,
      loading,
      roles,
      employee,
      isDirector,
      isManager: isDirector || roles.includes("manager"),
      isHR: roles.includes("hr"),
      isSecretariat,
      refresh: async () => {
        await loadProfileData(user?.id);
      },
      signOut: async () => {
        await supabase.auth.signOut();
        setRoles([]);
        setEmployee(null);
      },
    };
  }, [user, session, loading, roles, employee]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
