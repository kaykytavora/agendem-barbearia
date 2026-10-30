import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { logger } from '@/lib/logger';

type UserRole = Database['public']['Enums']['user_role'];
type Profile = Database['public']['Tables']['profiles']['Row'];

interface AuthContextType {
  user: User | null;
  session: Session | null;
  role: UserRole | null;
  profile: Profile | null;
  barbeariaId: string | null;
  loading: boolean; // Continuará sendo a flag principal para os componentes
  /** true quando o perfil não pôde ser carregado (rede/servidor) e não há cópia local */
  profileError: boolean;
  signUp: (email: string, password: string, options?: { data?: Record<string, unknown> }) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<{ error: Error | null }>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
  verifyCodeAndUpdatePassword: (email: string, code: string, password: string) => Promise<{ error: Error | null }>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const PROFILE_TIMEOUT_MS = 10000;
const profileCacheKey = (userId: string) => `user_profile_${userId}`;

type ProfileResult =
  | { status: 'ok'; profile: Profile }
  | { status: 'not_found' }
  | { status: 'error'; error: unknown };

async function fetchProfile(userId: string): Promise<ProfileResult> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('Profile fetch timeout')), PROFILE_TIMEOUT_MS);
    });
    const { data, error } = await Promise.race([
      supabase.from('profiles').select('*').eq('user_id', userId).single(),
      timeout,
    ]);

    if (error) {
      return error.code === 'PGRST116' ? { status: 'not_found' } : { status: 'error', error };
    }
    return { status: 'ok', profile: data };
  } catch (error) {
    return { status: 'error', error };
  } finally {
    clearTimeout(timer);
  }
}

function readCachedProfile(userId: string): Profile | null {
  try {
    const cached = localStorage.getItem(profileCacheKey(userId));
    return cached ? (JSON.parse(cached) as Profile) : null;
  } catch (error) {
    logger.error('Error reading cached profile', error);
    return null;
  }
}

function writeCachedProfile(profile: Profile) {
  try {
    localStorage.setItem(profileCacheKey(profile.user_id), JSON.stringify(profile));
  } catch (error) {
    logger.error('Error caching profile data', error);
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [barbeariaId, setBarbeariaId] = useState<string | null>(null);
  const [profileError, setProfileError] = useState(false);
  const [authLoading, setAuthLoading] = useState(true); // Carregamento da autenticação
  const [profileLoading, setProfileLoading] = useState(true); // Carregamento inicial do perfil

  // Usuário atual acessível dentro do listener de auth sem recriar a inscrição
  const userIdRef = useRef<string | null>(null);
  useEffect(() => {
    userIdRef.current = user?.id ?? null;
  }, [user]);

  const applyProfile = useCallback((nextProfile: Profile | null) => {
    setProfile(nextProfile);
    setRole(nextProfile?.role ?? null);
    setBarbeariaId(nextProfile?.barbearia_id ?? null);
  }, []);

  const loadProfile = useCallback(async (currentUser: User | null) => {
    if (!currentUser) {
      applyProfile(null);
      setProfileError(false);
      return;
    }

    const result = await fetchProfile(currentUser.id);

    if (result.status === 'ok') {
      applyProfile(result.profile);
      writeCachedProfile(result.profile);
      setProfileError(false);
    } else if (result.status === 'not_found') {
      applyProfile(null);
      setProfileError(false);
    } else {
      // Falha temporária (rede, timeout, erro 500): usa o último perfil conhecido.
      // Nunca presumimos um papel padrão, para não rebaixar um admin a cliente.
      logger.error('Error fetching profile', { userId: currentUser.id, error: result.error });
      const cached = readCachedProfile(currentUser.id);
      applyProfile(cached);
      setProfileError(!cached);
    }
  }, [applyProfile]);

  const fetchSessionAndProfile = useCallback(async () => {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) {
        logger.error('Error fetching session', error);
      }

      const currentUser = session?.user ?? null;
      setSession(session ?? null);
      setUser(currentUser);
      setAuthLoading(false);

      await loadProfile(currentUser);
    } catch (error) {
      logger.error('Error in fetchSessionAndProfile', error);
      setUser(null);
      setSession(null);
      applyProfile(null);
      setAuthLoading(false);
    } finally {
      setProfileLoading(false);
    }
  }, [loadProfile, applyProfile]);

  useEffect(() => {
    fetchSessionAndProfile();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (event === 'SIGNED_OUT') {
        // Garantir limpeza imediata no logout
        setUser(null);
        setSession(null);
        applyProfile(null);
        setProfileError(false);
        setAuthLoading(false);
        setProfileLoading(false);
      } else if (event === 'SIGNED_IN' && newSession?.user.id !== userIdRef.current) {
        // O Supabase reemite SIGNED_IN sempre que a aba volta ao foco; só recarrega se o usuário mudou
        fetchSessionAndProfile();
      }
      // Ignorar TOKEN_REFRESHED e INITIAL_SESSION para evitar calls desnecessários
    });

    return () => subscription.unsubscribe();
  }, [fetchSessionAndProfile, applyProfile]);

  // Recarrega o perfil em segundo plano, sem mostrar o loader de página inteira.
  const refreshProfile = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    await loadProfile(session?.user ?? null);
  }, [loadProfile]);

  const signUp = async (email: string, password: string, options?: { data?: Record<string, unknown> }) => {
    try {
      // Limpar tokens corrompidos do localStorage antes do signup
      try {
        localStorage.removeItem('sb-agendem-auth-token');
        localStorage.removeItem('supabase.auth.token');
        // Limpar outras chaves relacionadas ao supabase
        Object.keys(localStorage).forEach(key => {
          if (key.includes('supabase') || key.includes('sb-')) {
            localStorage.removeItem(key);
          }
        });
      } catch (storageError) {
        logger.error("Error clearing localStorage:", storageError);
      }

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: options?.data
        }
      });
      
      if (error) {
        logger.error("SignUp error:", error);
        return { error };
      }
      
      // Com confirmação desabilitada, o usuário já fica logado imediatamente
      // Aguardar o trigger handle_new_user processar
      if (data.user) {
        await new Promise(resolve => setTimeout(resolve, 1500));
        await fetchSessionAndProfile();
      }
      
      return { error: null };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error("SignUp unexpected error:", error);
      return { error };
    }
  };

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    // Se o login for bem-sucedido, o onAuthStateChange será acionado.
    // A chamada a seguir garante que o perfil seja buscado imediatamente,
    // o que pode ajudar em alguns cenários de tempo.
    if (!error && data.user) {
      await refreshProfile();
    }

    return { error };
  };

  const signOut = async () => {
    try {
      // Forçar logout completo com escopo 'global'
      const { error } = await supabase.auth.signOut({ scope: 'global' });
      
      // Limpeza manual e imediata do estado
      setUser(null);
      setSession(null);
      setProfile(null);
      setRole(null);
      setBarbeariaId(null);
      setAuthLoading(false);
      setProfileLoading(false);
      
      // Preservar tema antes de limpar
      const currentTheme = localStorage.getItem('agendem-theme');
      
      // Limpar localStorage e sessionStorage, mas preservar dados não relacionados ao usuário
      Object.keys(localStorage).forEach(key => {
        if (key.includes('supabase') || key.includes('sb-') || key.startsWith('user_profile_')) {
          localStorage.removeItem(key);
        }
      });
      sessionStorage.clear();
      
      // Restaurar tema
      if (currentTheme) {
        localStorage.setItem('agendem-theme', currentTheme);
      }
      
      // Limpar cookies relacionados ao Supabase
      document.cookie.split(";").forEach((c) => {
        const eqPos = c.indexOf("=");
        const name = eqPos > -1 ? c.substr(0, eqPos) : c;
        if (name.trim().includes('supabase') || name.trim().includes('sb-')) {
          document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
        }
      });
      
      // Forçar reload da página após um pequeno delay para garantir limpeza
      setTimeout(() => {
        window.location.href = '/';
      }, 100);
      
      return { error };
    } catch (err) {
      logger.error('Erro durante logout', err);
      // Preservar tema antes de limpar
      const currentTheme = localStorage.getItem('agendem-theme');
      
      // Mesmo se houver erro, limpar o estado e redirecionar
      setUser(null);
      setSession(null);
      setProfile(null);
      setRole(null);
      setBarbeariaId(null);
      
      // Restaurar tema
      if (currentTheme) {
        localStorage.setItem('agendem-theme', currentTheme);
      }
      
      window.location.href = '/';
      return { error: err instanceof Error ? err : new Error(String(err)) };
    }
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    return { error };
  };

  const verifyCodeAndUpdatePassword = async (email: string, code: string, password: string) => {
    const { error } = await supabase.auth.verifyOtp({
      email,
      token: code,
      type: 'recovery'
    });

    if (error) {
      return { error };
    }

    const { error: updateError } = await supabase.auth.updateUser({
      password
    });

    return { error: updateError };
  };

  const value = {
    user,
    session,
    role,
    profile,
    barbeariaId,
    loading: authLoading || profileLoading, // Combina os dois loadings
    profileError,
    signUp,
    signIn,
    signOut,
    resetPassword,
    verifyCodeAndUpdatePassword,
    refreshProfile,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};