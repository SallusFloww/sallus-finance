import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// Types
interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  status: string;
  last_login: string | null;
}

interface Company {
  id: string;
  name: string;
  cnpj: string | null;
  status: string;
  is_demo?: boolean;
}

interface Role {
  id: string;
  name: string;
  description: string | null;
}

interface UserCompanyRole {
  company: Company;
  role: Role;
  is_primary: boolean;
}

interface Permission {
  permission_code: string;
  permission_name: string;
  module: string;
}

interface AuthState {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  companies: UserCompanyRole[];
  currentCompany: Company | null;
  currentRole: Role | null;
  permissions: Permission[];
  isLoading: boolean;
  isAuthenticated: boolean;
  dataLoaded: boolean;
}

interface AuthContextType extends AuthState {
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
  updatePassword: (newPassword: string) => Promise<{ error: Error | null }>;
  switchCompany: (companyId: string) => Promise<void>;
  hasPermission: (permissionCode: string) => boolean;
  isAdmin: () => boolean;
  isDemo: () => boolean;
  resetDemoCompany: (confirmText: string) => Promise<{ ok: boolean; error?: string; deleted?: Record<string, number>; seeded?: Record<string, number> }>;
  refreshPermissions: () => Promise<void>;
  reloadUserData: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    profile: null,
    companies: [],
    currentCompany: null,
    currentRole: null,
    permissions: [],
    isLoading: true,
    isAuthenticated: false,
    dataLoaded: false,
  });

  const loadingRef = useRef(false);

  // Fetch user profile
  const fetchProfile = useCallback(async (userId: string): Promise<Profile | null> => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle();

      if (error) {
        return null;
      }
      return data;
    } catch (err) {
      return null;
    }
  }, []);

  // Fetch user companies and roles (only active ones)
  const fetchUserCompanies = useCallback(async (userId: string): Promise<UserCompanyRole[]> => {
    try {
      const { data, error } = await supabase
        .from("user_company_roles")
        .select(`
          is_primary,
          is_active,
          company:companies(id, name, cnpj, status, is_demo),
          role:roles(id, name, description)
        `)
        .eq("user_id", userId)
        .eq("is_active", true); // Only fetch active company roles

      if (error) {
        return [];
      }

      return (data || [])
        .filter((item: any) => item.company && item.role)
        .map((item: any) => ({
          company: item.company,
          role: item.role,
          is_primary: item.is_primary,
        }));
    } catch (err) {
      return [];
    }
  }, []);

  // Fetch permissions for current company
  const fetchPermissions = useCallback(async (userId: string, companyId: string): Promise<Permission[]> => {
    try {
      // A RPC get_user_permissions só aceita _user_id (busca todas permissões do usuário)
      const { data, error } = await supabase.rpc("get_user_permissions", {
        _user_id: userId,
      });

      if (error) {
        return [];
      }

      return data || [];
    } catch (err) {
      return [];
    }
  }, []);

  // Update last login
  const updateLastLogin = useCallback(async (userId: string) => {
    try {
      await supabase
        .from("profiles")
        .update({ last_login: new Date().toISOString() })
        .eq("id", userId);
    } catch (err) {
      // Silent fail for last login update
    }
  }, []);

  // Load full user data
  const loadUserData = useCallback(async (user: User, skipLoadingState = false) => {
    if (loadingRef.current) return;
    loadingRef.current = true;

    try {
      const profile = await fetchProfile(user.id);
      let companies = await fetchUserCompanies(user.id);

      // Auto-provision company for new users with no companies
      if (companies.length === 0) {
        try {
          const { data: provisionResult } = await (supabase as any).rpc("create_default_company_for_user", {
            _user_id: user.id,
            _user_email: user.email || "",
            _user_name: profile?.full_name || user.email || "",
          });
          if (provisionResult?.success) {
            // Re-fetch companies after provisioning
            companies = await fetchUserCompanies(user.id);
          }
        } catch {
          // Silent - user may not have the RPC yet
        }
      }

      // Find primary company or first one with active status
      const activeCompanies = companies.filter(c => c.company?.status === 'active');
      const primaryCompanyRole = activeCompanies.find((c) => c.is_primary) || activeCompanies[0];
      const currentCompany = primaryCompanyRole?.company || null;
      const currentRole = primaryCompanyRole?.role || null;

      let permissions: Permission[] = [];
      if (currentCompany) {
        permissions = await fetchPermissions(user.id, currentCompany.id);
      }

      setState((prev) => ({
        ...prev,
        profile,
        companies,
        currentCompany,
        currentRole,
        permissions,
        isLoading: false,
        dataLoaded: true,
      }));

      // Update last login in background
      if (currentCompany) {
        updateLastLogin(user.id);
      }
    } catch (err) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        dataLoaded: true,
      }));
    } finally {
      loadingRef.current = false;
    }
  }, [fetchProfile, fetchUserCompanies, fetchPermissions, updateLastLogin]);

  // Public function to reload user data (after onboarding)
  const reloadUserData = useCallback(async () => {
    if (state.user) {
      loadingRef.current = false; // Reset loading lock
      await loadUserData(state.user, true);
    }
  }, [state.user, loadUserData]);

  // Initialize auth state
  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        // Auth state change handled silently in production
        
        setState((prev) => ({
          ...prev,
          session,
          user: session?.user ?? null,
          isAuthenticated: !!session?.user,
        }));

        // Load user data after auth change (deferred to avoid deadlock)
        if (session?.user) {
          setTimeout(() => {
            loadUserData(session.user);
          }, 0);
        } else {
          setState((prev) => ({
            ...prev,
            profile: null,
            companies: [],
            currentCompany: null,
            currentRole: null,
            permissions: [],
            isLoading: false,
            dataLoaded: true,
          }));
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setState((prev) => ({
        ...prev,
        session,
        user: session?.user ?? null,
        isAuthenticated: !!session?.user,
      }));

      if (session?.user) {
        loadUserData(session.user);
      } else {
        setState((prev) => ({ ...prev, isLoading: false, dataLoaded: true }));
      }
    });

    return () => subscription.unsubscribe();
  }, [loadUserData]);

  // Sign in
  const signIn = useCallback(async (email: string, password: string) => {
    setState((prev) => ({ ...prev, isLoading: true }));

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });

    if (error) {
      setState((prev) => ({ ...prev, isLoading: false }));
      return { error };
    }

    return { error: null };
  }, []);

  // Sign up
  const signUp = useCallback(async (email: string, password: string, fullName: string) => {
    setState((prev) => ({ ...prev, isLoading: true }));

    const redirectUrl = `${window.location.origin}/`;

    const { error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: fullName.trim(),
        },
      },
    });

    if (error) {
      setState((prev) => ({ ...prev, isLoading: false }));
      return { error };
    }

    return { error: null };
  }, []);

  // Sign out
  const signOut = useCallback(async () => {
    setState((prev) => ({
      ...prev,
      isLoading: true,
    }));
    
    await supabase.auth.signOut();
    
    // Clear all state
    setState({
      user: null,
      session: null,
      profile: null,
      companies: [],
      currentCompany: null,
      currentRole: null,
      permissions: [],
      isLoading: false,
      isAuthenticated: false,
      dataLoaded: true,
    });
    
    toast.success("Você saiu do sistema");
  }, []);

  // Reset password (send email)
  const resetPassword = useCallback(async (email: string) => {
    const redirectUrl = `${window.location.origin}/auth?mode=reset`;
    
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: redirectUrl,
    });

    if (error) {
      return { error };
    }

    return { error: null };
  }, []);

  // Update password (after reset)
  const updatePassword = useCallback(async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) {
      return { error };
    }

    return { error: null };
  }, []);

  // Switch company
  const switchCompany = useCallback(async (companyId: string) => {
    const companyRole = state.companies.find((c) => c.company.id === companyId);
    if (!companyRole || !state.user) return;

    const permissions = await fetchPermissions(state.user.id, companyId);

    setState((prev) => ({
      ...prev,
      currentCompany: companyRole.company,
      currentRole: companyRole.role,
      permissions,
    }));

    toast.success(`Empresa alterada para ${companyRole.company.name}`);
  }, [state.companies, state.user, fetchPermissions]);

  // Check permission
  const hasPermission = useCallback((permissionCode: string): boolean => {
    // Admin has all permissions
    if (state.currentRole?.name === "Admin") return true;
    return state.permissions.some((p) => p.permission_code === permissionCode);
  }, [state.permissions, state.currentRole]);

  // Check if current user is Admin
  const isAdmin = useCallback((): boolean => {
    return state.currentRole?.name === "Admin";
  }, [state.currentRole]);

  // Check if current company is DEMO
  const isDemo = useCallback((): boolean => {
    return state.currentCompany?.is_demo === true;
  }, [state.currentCompany]);

  // Reset DEMO company (Admin only)
  const resetDemoCompany = useCallback(async (confirmText: string) => {
    if (!state.user || !isAdmin()) {
      return { ok: false, error: "Apenas Admin pode resetar a empresa DEMO" };
    }

    if (!isDemo() || !state.currentCompany) {
      return { ok: false, error: "Esta função só pode ser usada na empresa DEMO" };
    }

    try {
      // A RPC reset_demo_company aceita _company_id e retorna boolean
      const { data, error } = await supabase.rpc("reset_demo_company", {
        _company_id: state.currentCompany.id,
      });

      if (error) {
        return { ok: false, error: error.message };
      }

      // A função retorna boolean diretamente
      if (!data) {
        return { ok: false, error: "Erro ao resetar DEMO" };
      }

      return { ok: true };
    } catch (err) {
      return { ok: false, error: "Erro inesperado ao resetar DEMO" };
    }
  }, [state.user, state.currentCompany, isAdmin, isDemo]);

  // Refresh permissions
  const refreshPermissions = useCallback(async () => {
    if (!state.user) return;
    
    // Reload all user data to get new company/role
    await reloadUserData();
  }, [state.user, reloadUserData]);

  const value: AuthContextType = {
    ...state,
    signIn,
    signUp,
    signOut,
    resetPassword,
    updatePassword,
    switchCompany,
    hasPermission,
    isAdmin,
    isDemo,
    resetDemoCompany,
    refreshPermissions,
    reloadUserData,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
