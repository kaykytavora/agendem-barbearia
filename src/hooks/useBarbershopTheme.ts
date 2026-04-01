import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

interface BarbershopTheme {
  modo_tema: string;
  cores_personalizadas: {
    primary?: string;
    secondary?: string;
    accent?: string;
    background?: string;
  } | null;
  nome: string;
  logo_url: string;
}

export function useBarbershopTheme(barbeariaId?: string) {
  const [themeConfig, setThemeConfig] = useState<BarbershopTheme | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (barbeariaId) {
      loadBarbershopTheme();
    }
  }, [barbeariaId]);

  const loadBarbershopTheme = async () => {
    if (!barbeariaId) return;

    try {
      const { data, error } = await supabase
        .from('barbearias')
        .select('modo_tema, cores_personalizadas, nome, logo_url')
        .eq('id', barbeariaId)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        const themeData: BarbershopTheme = {
          modo_tema: data.modo_tema || 'light',
          cores_personalizadas: data.cores_personalizadas as BarbershopTheme['cores_personalizadas'],
          nome: data.nome,
          logo_url: data.logo_url || ''
        };
        setThemeConfig(themeData);
        applyTheme(themeData);
      }
    } catch (error) {
      logger.error('Erro ao carregar tema da barbearia', error);
    } finally {
      setLoading(false);
    }
  };

  const applyTheme = (theme: BarbershopTheme) => {
    const root = document.documentElement;
    
    // Aplicar modo de tema
    if (theme.modo_tema) {
      if (theme.modo_tema === 'light') {
        root.classList.add('light');
        root.classList.remove('dark');
      } else {
        root.classList.add('dark');
        root.classList.remove('light');
      }
    }

    // Aplicar cores personalizadas
    if (theme.cores_personalizadas) {
      const colors = theme.cores_personalizadas;
      
      if (colors.primary) {
        root.style.setProperty('--primary-custom', hexToHsl(colors.primary));
      }
      if (colors.secondary) {
        root.style.setProperty('--secondary-custom', hexToHsl(colors.secondary));
      }
      if (colors.accent) {
        root.style.setProperty('--accent-custom', hexToHsl(colors.accent));
      }
      if (colors.background) {
        root.style.setProperty('--background-custom', hexToHsl(colors.background));
      }
    }
  };

  const hexToHsl = (hex: string): string => {
    // Remove # se presente
    hex = hex.replace('#', '');
    
    // Converte hex para RGB
    const r = parseInt(hex.substr(0, 2), 16) / 255;
    const g = parseInt(hex.substr(2, 2), 16) / 255;
    const b = parseInt(hex.substr(4, 2), 16) / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0;
    let s = 0;
    const l = (max + min) / 2;

    if (max === min) {
      h = s = 0; // acromático
    } else {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h /= 6;
    }

    return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
  };

  return {
    themeConfig,
    loading,
    applyTheme,
    refreshTheme: loadBarbershopTheme
  };
}