import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { useThemeContext } from '@/providers/ThemeProvider';

// Rotas que são consideradas de cliente
const CLIENT_ROUTES = ['/', '/barbearias', '/barbearia', '/agendamento', '/agendamento-confirmado', '/meu-painel'];

export function useTheme() {
  const { theme, setTheme } = useThemeContext();
  const { user } = useAuth();
  const { role, barbeariaId } = useUserRole();
  const location = useLocation();

  // Verifica se está em uma rota de cliente
  const isClientRoute = CLIENT_ROUTES.some(route => 
    location.pathname === route || location.pathname.startsWith(route)
  );

  // Carregar tema do banco de dados quando o usuário fizer login (apenas para admin)
  useEffect(() => {
    const loadThemeFromDB = async () => {
      if (!user || !barbeariaId || isClientRoute) return;

      try {
        const { data: barbearia } = await supabase
          .from('barbearias')
          .select('modo_tema')
          .eq('id', barbeariaId)
          .maybeSingle();

        if (barbearia?.modo_tema && (barbearia.modo_tema === 'light' || barbearia.modo_tema === 'dark')) {
          setTheme(barbearia.modo_tema);
        }
      } catch (error) {
        console.error('Erro ao carregar tema:', error);
      }
    };

    loadThemeFromDB();
  }, [user, barbeariaId, setTheme, isClientRoute]);

  // Força tema claro para clientes na primeira visita
  useEffect(() => {
    if (isClientRoute && !user) {
      const savedTheme = localStorage.getItem('agendem-theme');
      if (!savedTheme) {
        setTheme('light');
      }
    }
  }, [isClientRoute, user, setTheme]);

  const toggleTheme = async () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);

    // Salvar no banco apenas se for admin em rota não-cliente
    if (user && barbeariaId && role === 'admin' && !isClientRoute) {
      try {
        await supabase
          .from('barbearias')
          .update({ modo_tema: newTheme })
          .eq('id', barbeariaId);
      } catch (error) {
        console.error('Erro ao salvar tema:', error);
      }
    }
  };

  return { theme, setTheme, toggleTheme, isClientRoute };
}