import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { hexToHslParts } from "@/lib/utils";
import imageCompression from 'browser-image-compression';
import { usePhoneMask } from "@/hooks/usePhoneMask";
import { useCepMask } from "@/hooks/useCepMask";
import { useNavigate } from "react-router-dom";

import { createContext, useContext } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { COR_PADRAO, DAYS_OF_WEEK, type Barbershop, type ThemeConfig, type WorkingHours } from "./types";

/** Estado e ações da tela de configurações (dados da barbearia, horários, tema e imagens). */
export function useBarbershopSettings() {
  const { user, signOut } = useAuth(); // Importar signOut
  const navigate = useNavigate(); // Importar useNavigate
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isFetchingCep, setIsFetchingCep] = useState(false);
  const [barbeariaId, setBarbeariaId] = useState<string | null>(null);
  const [deleteConfirmationText, setDeleteConfirmationText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  // Hooks para máscaras de input
  const { value: phone, handleChange: handlePhoneChange, setValue: setPhoneValue } = usePhoneMask();
  const { value: cep, handleChange: handleCepChange, setValue: setCepValue } = useCepMask();

  const [barbershop, setBarbershop] = useState<Barbershop>({
    id: '',
    slug: '',
    nome: '',
    descricao: '',
    telefone: '',
    email_contato: '',
    cep: '',
    endereco: '',
    bairro: '',
    cidade: '',
    logo_url: '',
    gallery_urls: [],
  });

  const [workingHours, setWorkingHours] = useState<WorkingHours[]>([]);
  const [themeConfig, setThemeConfig] = useState<ThemeConfig>({ primary: COR_PADRAO });
  const [totalServicos, setTotalServicos] = useState<number | null>(null);
  const [hoursError, setHoursError] = useState(false);
  const queryClient = useQueryClient();
  // A página pública guarda os dados em cache; depois de salvar, ela precisa buscar de novo
  const atualizarPaginaPublica = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['barbershop'] });
    queryClient.invalidateQueries({ queryKey: ['barbershops-list'] });
  }, [queryClient]);

  const [uploadingStates, setUploadingStates] = useState<{[key: string]: boolean}>({
    logo: false,
    gallery_1: false,
    gallery_2: false,
    gallery_3: false,
    gallery_4: false,
  });

  const loadBarbeariaId = useCallback(async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase.rpc('get_user_barbearia_id', {
        user_uuid: user.id
      });

      if (error) throw error;

      if (data) {
        setBarbeariaId(data);
      } else {
        toast({
          title: "Aviso",
          description: "Você precisa estar associado a uma barbearia para acessar as configurações.",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Erro ao carregar barbearia ID:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar informações do usuário",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }, [user, toast]);

  const loadBarbershopData = useCallback(async () => {
    if (!barbeariaId) return;

    try {
      const { data, error } = await supabase
        .from('barbearias')
        .select('*')
        .eq('id', barbeariaId)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setBarbershop({
          id: data.id,
          slug: data.slug || '',
          nome: data.nome,
          descricao: data.descricao || '',
          telefone: data.telefone || '',
          email_contato: data.email_contato || '',
          cep: data.cep || '',
          endereco: data.endereco || '',
          bairro: data.bairro || '',
          cidade: data.cidade === 'Não informado' ? '' : data.cidade,
          logo_url: data.logo_url || '',
          gallery_urls: (data.gallery_urls ?? []).filter(Boolean),
        });
        setPhoneValue(data.telefone || '');
        setCepValue(data.cep || '');
        const cores = data.cores_personalizadas as Record<string, string> | null;
        if (cores?.primary) setThemeConfig({ primary: cores.primary });
      }

      const { count } = await supabase
        .from('servicos')
        .select('id', { count: 'exact', head: true })
        .eq('barbearia_id', barbeariaId);
      setTotalServicos(count ?? 0);
    } catch (error) {
      console.error('Erro ao carregar dados da barbearia:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar dados da barbearia",
        variant: "destructive"
      });
    }
  }, [barbeariaId, toast, setCepValue, setPhoneValue, setBarbershop, setThemeConfig]);

  const loadWorkingHours = useCallback(async () => {
    if (!barbeariaId) return;

    try {
      const { data, error } = await supabase
        .from('horarios_funcionamento')
        .select('*')
        .eq('barbearia_id', barbeariaId)
        .order('dia_semana');

      if (error) throw error;

      // Um item por dia da semana; dias ainda não cadastrados entram com um padrão (domingo fechado).
      // O banco devolve "08:00:00"; o campo de hora e as comparações usam "08:00".
      const semana: WorkingHours[] = DAYS_OF_WEEK.map(day => {
        const existing = data?.find(h => h.dia_semana === day.value);
        if (!existing) {
          return { dia_semana: day.value, hora_abre: '09:00', hora_fecha: '18:00', fechado: day.value === 0 };
        }
        return {
          dia_semana: existing.dia_semana,
          hora_abre: existing.hora_abre?.slice(0, 5) ?? null,
          hora_fecha: existing.hora_fecha?.slice(0, 5) ?? null,
          fechado: !!existing.fechado,
        };
      });

      setWorkingHours(semana);
      setHoursError(false);
    } catch (error) {
      console.error('Erro ao carregar horários:', error);
      // Sem isso a aba Horários ficava em branco, sem explicar o porquê
      setHoursError(true);
    }
  }, [barbeariaId]);

  const handleBarbershopSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!barbeariaId) return;

    setSaving(true);

    try {
      // Só os campos desta aba: logo, galeria e cor são salvos pelas próprias ações e não podem ser sobrescritos aqui
      const { error } = await supabase
        .from('barbearias')
        .update({
          nome: barbershop.nome.trim(),
          descricao: barbershop.descricao.trim() || null,
          telefone: (phone || '').replace(/\D/g, '') || null,
          email_contato: barbershop.email_contato.trim() || null,
          cep: cep.replace(/\D/g, '') || null,
          endereco: barbershop.endereco.trim() || null,
          bairro: barbershop.bairro.trim() || null,
          cidade: barbershop.cidade.trim(),
        })
        .eq('id', barbeariaId);

      if (error) throw error;
      atualizarPaginaPublica();

      toast({
        title: "Sucesso",
        description: "Dados da barbearia atualizados com sucesso"
      });
    } catch (error) {
      console.error('Erro ao salvar:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erro ao salvar dados';
      toast({
        title: "Erro",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const handleImageUpload = useCallback(async (file: File, type: 'logo' | 'gallery', indexToUpdate?: number) => {
    if (!barbeariaId) {
      toast({
        title: "Erro",
        description: "ID da barbearia não encontrado.",
        variant: "destructive",
      });
      return;
    }

    if (!file.type.startsWith('image/')) {
      toast({
        title: "Arquivo inválido",
        description: "Por favor, selecione um arquivo de imagem.",
        variant: "destructive",
      });
      return;
    }

    if (file.size > 5 * 1024 * 1024) { // 5MB
       toast({
        title: "Arquivo muito grande",
        description: "A imagem não pode ter mais de 5MB.",
        variant: "destructive",
      });
      return;
    }

    const isLogo = type === 'logo';
    const uploadKey = isLogo ? 'logo' : `gallery_${indexToUpdate ?? barbershop.gallery_urls.length}`;
    setUploadingStates(prevState => ({ ...prevState, [uploadKey]: true }));

    try {
      const options = {
        maxSizeMB: 1,
        maxWidthOrHeight: isLogo ? 512 : 800,
        useWebWorker: true,
      };

      const compressedFile = await imageCompression(file, options);
      const filePath = `${barbeariaId}/${type}-${Date.now()}-${compressedFile.name}`;
      const bucket = isLogo ? 'logos' : 'gallery';

      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(filePath, compressedFile);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from(bucket)
        .getPublicUrl(filePath);

      const caminhoNoBucket = (url: string) => url.substring(url.indexOf(bucket) + bucket.length + 1);

      if (isLogo) {
        const { error } = await supabase
          .from('barbearias')
          .update({ logo_url: publicUrl })
          .eq('id', barbeariaId);
        if (error) throw error;
        if (barbershop.logo_url) await supabase.storage.from(bucket).remove([caminhoNoBucket(barbershop.logo_url)]);
        setBarbershop(prev => ({ ...prev, logo_url: publicUrl }));
      } else {
        const newGalleryUrls = [...barbershop.gallery_urls];
        const oldUrl = indexToUpdate !== undefined ? newGalleryUrls[indexToUpdate] : undefined;
        if (oldUrl) {
          newGalleryUrls[indexToUpdate!] = publicUrl;
        } else {
          // Espaço vazio: entra no fim da lista, sem deixar buracos (a página pública mostra as fotos em ordem)
          newGalleryUrls.push(publicUrl);
        }

        const { error } = await supabase
          .from('barbearias')
          .update({ gallery_urls: newGalleryUrls })
          .eq('id', barbeariaId);
        if (error) throw error;
        if (oldUrl) await supabase.storage.from(bucket).remove([caminhoNoBucket(oldUrl)]);
        setBarbershop(prev => ({ ...prev, gallery_urls: newGalleryUrls }));
      }
      atualizarPaginaPublica();

      toast({
        title: "Sucesso!",
        description: `${isLogo ? 'Logo' : 'Imagem da galeria'} atualizada com sucesso.`,
      });

    } catch (error) {
      console.error(`Erro no upload da imagem (${type}):`, error);
      const errorMessage = error instanceof Error ? error.message : 'Não foi possível enviar a imagem. Tente novamente.';
      toast({
        title: "Erro no Upload",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setUploadingStates(prevState => ({ ...prevState, [uploadKey]: false }));
    }
  }, [barbeariaId, toast, barbershop.gallery_urls, barbershop.logo_url, atualizarPaginaPublica]);

  const handleImageRemove = async (type: 'logo' | 'gallery', urlToRemove: string) => {
    if (!barbeariaId || !urlToRemove) return;

    const isLogo = type === 'logo';
    setSaving(true);
    try {
      // Primeiro o banco: se falhar, a imagem continua no ar em vez de virar um link quebrado
      const newGalleryUrls = barbershop.gallery_urls.filter(url => url !== urlToRemove);
      const { error } = await supabase
        .from('barbearias')
        .update(isLogo ? { logo_url: null } : { gallery_urls: newGalleryUrls })
        .eq('id', barbeariaId);
      if (error) throw error;

      setBarbershop(prev => (isLogo ? { ...prev, logo_url: '' } : { ...prev, gallery_urls: newGalleryUrls }));
      atualizarPaginaPublica();

      const bucket = isLogo ? 'logos' : 'gallery';
      const filePath = urlToRemove.substring(urlToRemove.indexOf(bucket) + bucket.length + 1);
      await supabase.storage.from(bucket).remove([filePath]);

      toast({
        title: "Sucesso!",
        description: "Imagem removida com sucesso.",
      });

    } catch (error) {
      console.error('Erro ao remover imagem:', error);
      const errorMessage = error instanceof Error ? error.message : 'Não foi possível remover a imagem.';
      toast({
        title: "Erro ao Remover",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteBarbershop = async () => {
    if (deleteConfirmationText !== "DELETAR") {
      toast({
        title: "Confirmação incorreta",
        description: "Você precisa digitar 'DELETAR' para confirmar a exclusão.",
        variant: "destructive",
      });
      return;
    }

    setIsDeleting(true);
    try {
      const { error } = await supabase.functions.invoke("delete-barbershop", {
        body: { barbearia_id: barbershop.id }
      });
      if (error) throw new Error(error.message);

      toast({
        title: "Sua barbearia foi excluída",
        description: "Você será desconectado e redirecionado.",
      });

      // Chama o signOut do contexto para limpar o estado e a sessão
      await signOut();

      // Navega para a home após o estado ser limpo
      navigate('/');

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Não foi possível completar a solicitação.';
      toast({
        title: "Erro ao excluir barbearia",
        description: errorMessage,
        variant: "destructive",
      });
      setIsDeleting(false); // Garante que o estado de loading seja resetado em caso de erro
    }
  };

  const handleCepBlur = async (cep: string) => {
    const cleanedCep = cep.replace(/\D/g, '');

    if (cleanedCep.length !== 8) {
      return;
    }

    setIsFetchingCep(true);
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cleanedCep}/json/`);
      if (!response.ok) {
        throw new Error('CEP não encontrado');
      }
      const data = await response.json();

      if (data.erro) {
        throw new Error('CEP inválido');
      }

      setBarbershop(prev => ({
        ...prev,
        endereco: data.logradouro,
        bairro: data.bairro,
        cidade: data.localidade,
      }));

      toast({
        title: "Endereço encontrado!",
        description: `${data.logradouro}, ${data.bairro}, ${data.localidade}`,
      });

    } catch (error) {
      console.error('Erro ao buscar CEP:', error);
      const errorMessage = error instanceof Error ? error.message : 'Não foi possível encontrar o endereço.';
      toast({
        title: "Erro ao buscar CEP",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsFetchingCep(false);
    }
  };

  const handleThemeSubmit = async () => {
    if (!barbeariaId) return;

    setSaving(true);

    try {
      if (!hexToHslParts(themeConfig.primary)) throw new Error("Use uma cor no formato #RRGGBB.");
      const { error } = await supabase
        .from('barbearias')
        .update({ cores_personalizadas: { primary: themeConfig.primary.toUpperCase() } })
        .eq('id', barbeariaId);
      if (error) throw error;
      atualizarPaginaPublica();

      toast({
        title: "Cor salva",
        description: "Sua página já aparece com a nova cor para os clientes."
      });
    } catch (error) {
      console.error('Erro ao salvar tema:', error);
      toast({
        title: "Erro",
        description: (error as Error)?.message || "Erro ao salvar tema",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const handleWorkingHoursSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!barbeariaId) return;

    const invalido = workingHours.find(h => !h.fechado && (!h.hora_abre || !h.hora_fecha || h.hora_abre.slice(0, 5) >= h.hora_fecha.slice(0, 5)));
    if (invalido) {
      const dia = DAYS_OF_WEEK.find(d => d.value === invalido.dia_semana)?.label;
      toast({ title: "Confira os horários", description: `${dia}: o horário de fechar precisa ser depois do de abrir.`, variant: "destructive" });
      return;
    }

    setSaving(true);

    try {
      // Upsert pelo par (barbearia, dia): antes era apagar tudo e inserir de novo, e uma falha no meio deixava a barbearia sem horários
      const { error } = await supabase
        .from('horarios_funcionamento')
        .upsert(
          workingHours.map(hour => ({
            barbearia_id: barbeariaId,
            dia_semana: hour.dia_semana,
            hora_abre: hour.fechado ? null : hour.hora_abre,
            hora_fecha: hour.fechado ? null : hour.hora_fecha,
            fechado: hour.fechado,
          })),
          { onConflict: 'barbearia_id,dia_semana' }
        );

      if (error) throw error;
      atualizarPaginaPublica();

      toast({
        title: "Horários salvos",
        description: "Sua página e a agenda já usam os novos horários."
      });
    } catch (error) {
      console.error('Erro ao salvar horários:', error);
      toast({
        title: "Erro",
        description: (error as Error)?.message || "Erro ao salvar horários",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const updateWorkingHour = (dayIndex: number, changes: Partial<WorkingHours>) => {
    setWorkingHours(prev => prev.map((hour, i) => {
      if (i !== dayIndex) return hour;
      const updated = { ...hour, ...changes };
      // Dia fechado não guarda horário; ao reabrir, começa com um horário comercial
      if (!updated.fechado) {
        updated.hora_abre = updated.hora_abre || '09:00';
        updated.hora_fecha = updated.hora_fecha || '18:00';
      }
      return updated;
    }));
  };

  /** Repete o horário de um dia em todos os outros dias abertos. */
  const copyHoursToOpenDays = (dayIndex: number) => {
    const origem = workingHours[dayIndex];
    if (!origem || origem.fechado) return;
    setWorkingHours(prev => prev.map(hour => (hour.fechado ? hour : { ...hour, hora_abre: origem.hora_abre, hora_fecha: origem.hora_fecha })));
  };

  const setPrimaryColor = (hex: string) => setThemeConfig({ primary: hex });

  // useEffects
  useEffect(() => {
    if (user) {
      loadBarbeariaId();
    }
  }, [user, loadBarbeariaId]);

  useEffect(() => {
    if (barbeariaId) {
      loadBarbershopData();
      loadWorkingHours();
    }
  }, [barbeariaId, loadBarbershopData, loadWorkingHours]);

  return { user, signOut, navigate, toast, loading, setLoading, saving, setSaving, isFetchingCep, setIsFetchingCep, barbeariaId, setBarbeariaId, deleteConfirmationText, setDeleteConfirmationText, isDeleting, setIsDeleting, phone, handlePhoneChange, setPhoneValue, cep, handleCepChange, setCepValue, barbershop, setBarbershop, workingHours, setWorkingHours, themeConfig, setThemeConfig, uploadingStates, setUploadingStates, loadBarbeariaId, loadBarbershopData, loadWorkingHours, handleBarbershopSubmit, handleImageUpload, handleImageRemove, handleDeleteBarbershop, handleCepBlur, handleThemeSubmit, handleWorkingHoursSubmit, updateWorkingHour, copyHoursToOpenDays, setPrimaryColor, totalServicos, hoursError };
}

export type BarbershopSettings = ReturnType<typeof useBarbershopSettings>;

export const SettingsContext = createContext<BarbershopSettings | null>(null);

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings deve ser usado dentro de SettingsContext");
  return ctx;
}
