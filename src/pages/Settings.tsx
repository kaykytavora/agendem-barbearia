import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Store, 
  Upload, 
  Palette, 
  Clock, 
  Sun,
  Moon,
  Save,
  Eye,
  RefreshCw,
  Check,
  Info,
  Trash2,
  Volume2
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useTheme } from "@/hooks/useTheme";
import { DashboardLayout } from "@/layouts/DashboardLayout";
import imageCompression from 'browser-image-compression';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { usePhoneMask } from "@/hooks/usePhoneMask";
import { useCepMask } from "@/hooks/useCepMask";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useNavigate } from "react-router-dom";
import { NotificationSound } from "@/components/NotificationSound";
import { LazyImage } from "@/components/LazyImage";

interface Barbershop {
  id: string;
  nome: string;
  descricao: string; // Adicionando o campo
  telefone: string;
  email_contato: string;
  cep: string;
  endereco: string;
  bairro: string;
  cidade: string;
  logo_url: string;
  gallery_urls: string[]; // Alterado de image_url_x para um array
  modo_tema: string;
  cores_personalizadas: Record<string, string> | null;
}

interface WorkingHours {
  dia_semana: number;
  hora_abre: string;
  hora_fecha: string;
  fechado: boolean;
}

interface ThemeConfig {
  [key: string]: string;
  primary: string;
  secondary: string;
  accent: string;
  background: string;
}

const PREDEFINED_PALETTES: { name: string; colors: ThemeConfig }[] = [
  {
    name: "Padrão",
    colors: { primary: '#8b5cf6', secondary: '#6b7280', accent: '#f59e0b', background: '#111827' }
  },
  {
    name: "Oceano",
    colors: { primary: '#3b82f6', secondary: '#64748b', accent: '#14b8a6', background: '#0f172a' }
  },
  {
    name: "Vibrante",
    colors: { primary: '#ec4899', secondary: '#78716c', accent: '#84cc16', background: '#1c1917' }
  },
  {
    name: "Café",
    colors: { primary: '#a16207', secondary: '#57534e', accent: '#facc15', background: '#292524' }
  },
  {
    name: "Clássico",
    colors: { primary: '#2563eb', secondary: '#475569', accent: '#db2777', background: '#020617' }
  },
];

const DAYS_OF_WEEK = [
  { value: 0, label: 'Domingo' },
  { value: 1, label: 'Segunda-feira' },
  { value: 2, label: 'Terça-feira' },
  { value: 3, label: 'Quarta-feira' },
  { value: 4, label: 'Quinta-feira' },
  { value: 5, label: 'Sexta-feira' },
  { value: 6, label: 'Sábado' }
];

export default function Settings() {
  const { user, signOut } = useAuth(); // Importar signOut
  const navigate = useNavigate(); // Importar useNavigate
  const { toast } = useToast();
  const { theme, toggleTheme } = useTheme();
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
    nome: '',
    descricao: '', // Adicionando o campo
    telefone: '',
    email_contato: '',
    cep: '',
    endereco: '',
    bairro: '',
    cidade: '',
    logo_url: '',
    gallery_urls: [], // Alterado aqui
    modo_tema: 'dark',
    cores_personalizadas: {}
  });
  
  const [workingHours, setWorkingHours] = useState<WorkingHours[]>([]);
  const [themeConfig, setThemeConfig] = useState<ThemeConfig>({
    primary: '#8b5cf6',
    secondary: '#6b7280',
    accent: '#f59e0b',
    background: '#ffffff'
  });

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
        setBarbershop({...data, descricao: '', telefone: data.telefone || '', email_contato: data.email_contato || '', cep: data.cep || '', endereco: data.endereco || '', bairro: data.bairro || '', logo_url: data.logo_url || ''} as any); // Set all data with fallbacks
        setPhoneValue(data.telefone || '');
        setCepValue(data.cep || '');
        if (data.cores_personalizadas && typeof data.cores_personalizadas === 'object') {
          const customColors = data.cores_personalizadas as Record<string, string>;
          if (customColors.primary && customColors.secondary && customColors.accent && customColors.background) {
            setThemeConfig(customColors as ThemeConfig);
          }
        }
      }
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
      
      // Inicializar com valores padrão se não existir
      const defaultHours = DAYS_OF_WEEK.map(day => {
        const existing = data?.find(h => h.dia_semana === day.value);
        return existing || {
          dia_semana: day.value,
          hora_abre: '09:00',
          hora_fecha: '18:00',
          fechado: day.value === 0 // Domingo fechado por padrão
        };
      });
      
      setWorkingHours(defaultHours as any);
    } catch (error) {
      console.error('Erro ao carregar horários:', error);
    }
  }, [barbeariaId]);

  const handleBarbershopSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!barbeariaId) return;
    
    setSaving(true);

    try {
      const { error } = await supabase
        .from('barbearias')
        .update({
          ...barbershop,
          telefone: (phone || '').replace(/\D/g, ''),
          cep: cep.replace(/\D/g, ''),
        })
        .eq('id', barbeariaId);

      if (error) throw error;

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

      if (isLogo) {
        // Lógica para o Logo (atualiza uma única coluna)
        setBarbershop(prev => ({ ...prev, logo_url: publicUrl }));
        await supabase
          .from('barbearias')
          .update({ logo_url: publicUrl })
          .eq('id', barbeariaId);
      } else {
        // Lógica para a Galeria (atualiza o array)
        const newGalleryUrls = [...barbershop.gallery_urls];
        if (indexToUpdate !== undefined) {
          // Substitui uma imagem existente
          const oldUrl = newGalleryUrls[indexToUpdate];
          if (oldUrl) {
            const oldFilePath = oldUrl.substring(oldUrl.indexOf(bucket) + bucket.length + 1);
            await supabase.storage.from(bucket).remove([oldFilePath]);
          }
          newGalleryUrls[indexToUpdate] = publicUrl;
        } else {
          // Adiciona uma nova imagem
          newGalleryUrls.push(publicUrl);
        }

        setBarbershop(prev => ({ ...prev, gallery_urls: newGalleryUrls }));
        await supabase
          .from('barbearias')
          .update({ gallery_urls: newGalleryUrls })
          .eq('id', barbeariaId);
      }

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
  }, [barbeariaId, toast, barbershop.gallery_urls]);

  const handleImageRemove = async (type: 'logo' | 'gallery', urlToRemove: string) => {
    if (!barbeariaId || !urlToRemove) return;

    const isLogo = type === 'logo';
    setSaving(true);
    try {
      // 1. Remover o arquivo do Supabase Storage
      const bucket = isLogo ? 'logos' : 'gallery';
      const filePath = urlToRemove.substring(urlToRemove.indexOf(bucket) + bucket.length + 1);
      await supabase.storage.from(bucket).remove([filePath]);
      
      // 2. Atualizar o banco de dados
      if (isLogo) {
        setBarbershop(prev => ({ ...prev, logo_url: '' }));
        await supabase
          .from('barbearias')
          .update({ logo_url: null })
          .eq('id', barbeariaId);
      } else {
        const newGalleryUrls = barbershop.gallery_urls.filter(url => url !== urlToRemove);
        setBarbershop(prev => ({ ...prev, gallery_urls: newGalleryUrls }));
        await supabase
          .from('barbearias')
          .update({ gallery_urls: newGalleryUrls })
          .eq('id', barbeariaId);
      }

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
      await supabase
        .from('barbearias')
        .update({ 
          modo_tema: theme || 'dark',
          cores_personalizadas: themeConfig || {}
        })
        .eq('id', barbeariaId);

      toast({
        title: "Sucesso",
        description: "Configurações de tema salvas com sucesso"
      });
    } catch (error) {
      console.error('Erro ao salvar tema:', error);
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
    
    setSaving(true);

    try {
      // Deletar horários existentes e inserir novos
      await supabase
        .from('horarios_funcionamento')
        .delete()
        .eq('barbearia_id', barbeariaId);

      const hoursToInsert = workingHours.map(hour => ({
        barbearia_id: barbeariaId,
        dia_semana: hour.dia_semana,
        hora_abre: hour.fechado ? null : hour.hora_abre,
        hora_fecha: hour.fechado ? null : hour.hora_fecha,
        fechado: hour.fechado
      }));

      const { error } = await supabase
        .from('horarios_funcionamento')
        .insert(hoursToInsert);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Horários de funcionamento atualizados com sucesso"
      });
    } catch (error) {
      console.error('Erro ao salvar horários:', error);
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

  const updateWorkingHour = (dayIndex: number, field: keyof WorkingHours, value: string | number) => {
    const updated = [...workingHours];
    updated[dayIndex] = { ...updated[dayIndex], [field]: value };
    setWorkingHours(updated);
  };

  const updateThemeColor = (colorKey: keyof ThemeConfig, value: string) => {
    setThemeConfig(prev => ({
      ...prev,
      [colorKey]: value
    }));
  };

  const applyPalette = (palette: ThemeConfig) => {
    setThemeConfig(palette);
  };

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

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-96">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </DashboardLayout>
    );
  }

  if (!barbeariaId) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-96">
          <Card className="text-center p-8">
            <CardContent>
              <h2 className="text-xl font-semibold mb-2">Acesso Restrito</h2>
              <p className="text-muted-foreground">
                Você precisa estar associado a uma barbearia para acessar as configurações.
              </p>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-3 sm:p-6 space-y-4 sm:space-y-6">
        <div className="bg-gradient-to-r from-primary/10 to-accent/10 rounded-xl p-4 sm:p-6 border border-border/50">
          <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">
            Configurações
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-2">
            Gerencie as configurações da sua barbearia e personalize a experiência dos clientes
          </p>
        </div>

        <Tabs defaultValue="profile" className="space-y-4 sm:space-y-6">
          <TabsList className="grid w-full grid-cols-4 bg-muted/50 backdrop-blur-sm h-auto">
            <TabsTrigger value="profile" className="flex items-center gap-1 sm:gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm text-xs sm:text-sm p-2 sm:p-3">
              <Store className="w-3 h-3 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Perfil</span>
              <span className="sm:hidden">Info</span>
            </TabsTrigger>
            <TabsTrigger value="theme" className="flex items-center gap-1 sm:gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm text-xs sm:text-sm p-2 sm:p-3">
              <Palette className="w-3 h-3 sm:w-4 sm:h-4" />
              Tema
            </TabsTrigger>
            <TabsTrigger value="hours" className="flex items-center gap-1 sm:gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm text-xs sm:text-sm p-2 sm:p-3">
              <Clock className="w-3 h-3 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Horários</span>
              <span className="sm:hidden">Horas</span>
            </TabsTrigger>
            <TabsTrigger value="notifications" className="flex items-center gap-1 sm:gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm text-xs sm:text-sm p-2 sm:p-3">
              <Volume2 className="w-3 h-3 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Notificações</span>
              <span className="sm:hidden">Audio</span>
            </TabsTrigger>
          </TabsList>

          {/* Perfil da Barbearia */}
          <TabsContent value="profile">
            <Card className="border-border/50 bg-card/50 backdrop-blur-sm shadow-md">
              <CardHeader className="bg-gradient-to-r from-primary/5 to-accent/5 rounded-t-lg px-4 sm:px-6">
                <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                  <Store className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                  Perfil da Barbearia
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 sm:p-6">
                <form onSubmit={handleBarbershopSubmit} className="space-y-6 sm:space-y-8">

                  {/* Seção de Logo e Galeria */}
                  <div>
                    <h3 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4 border-b pb-2">Identidade Visual</h3>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
                      {/* Logo */}
                      <div>
                        <Label className="text-sm sm:text-base font-medium">Logo da Barbearia</Label>
                        <p className="text-xs text-muted-foreground mb-3">Esta é a imagem principal que representa sua barbearia.</p>
                        <ImageUploader 
                          type="logo"
                          imageUrl={barbershop.logo_url}
                          isUploading={uploadingStates['logo']}
                          onUpload={(file) => handleImageUpload(file, 'logo')}
                          onRemove={() => handleImageRemove('logo', barbershop.logo_url || '')}
                        />
                      </div>
                      
                      {/* Galeria */}
                      <div>
                        <Label className="text-sm sm:text-base font-medium">Galeria de Imagens</Label>
                        <p className="text-xs text-muted-foreground mb-3">Mostre o ambiente da sua barbearia (até 4 fotos).</p>
                        <div className="grid grid-cols-2 gap-3 sm:gap-4">
                          {[...Array(4)].map((_, index) => {
                            const imageUrl = barbershop.gallery_urls[index] || null;
                            return (
                              <ImageUploader 
                                key={index}
                                type="gallery"
                                imageUrl={imageUrl}
                                isUploading={uploadingStates[`gallery_${index}`]}
                                onUpload={(file) => handleImageUpload(file, "gallery", index)}
                                onRemove={() => handleImageRemove("gallery", imageUrl || '')}
                              />
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Seção de Informações */}
                  <div>
                    <h3 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4 border-b pb-2">Informações Gerais</h3>
                     <div className="space-y-4 sm:space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                          <div>
                            <Label htmlFor="nome" className="text-sm sm:text-base font-medium">Nome da Barbearia *</Label>
                            <Input
                              id="nome"
                              value={barbershop.nome}
                              onChange={(e) => setBarbershop(prev => ({ ...prev, nome: e.target.value }))}
                              placeholder="Nome da barbearia"
                              required
                              maxLength={100}
                              className="h-10 sm:h-11 mt-2"
                            />
                          </div>
                          
                          <div>
                            <Label htmlFor="telefone" className="text-sm sm:text-base font-medium">Telefone</Label>
                            <Input
                              id="telefone"
                              value={phone}
                              onChange={handlePhoneChange}
                              placeholder="(11) 99999-9999"
                              className="h-10 sm:h-11 mt-2"
                            />
                          </div>
                        </div>

                        <div>
                          <Label htmlFor="descricao" className="text-sm sm:text-base font-medium">Descrição da Barbearia</Label>
                          <Textarea
                            id="descricao"
                            value={barbershop.descricao || ''}
                            onChange={(e) => setBarbershop(prev => ({ ...prev, descricao: e.target.value }))}
                            placeholder="Descreva sua barbearia: o ambiente, sua especialidade, etc."
                            className="mt-2 min-h-[80px] sm:min-h-[100px]"
                            maxLength={500}
                          />
                          <p className="text-xs text-muted-foreground mt-1 text-right">{barbershop.descricao?.length || 0}/500</p>
                        </div>

                        <div>
                          <Label htmlFor="email_contato" className="text-sm sm:text-base font-medium">E-mail de Contato</Label>
                          <Input
                            id="email_contato"
                            type="email"
                            value={barbershop.email_contato}
                            onChange={(e) => setBarbershop(prev => ({ ...prev, email_contato: e.target.value }))}
                            placeholder="contato@barbearia.com"
                            className="h-10 sm:h-11 mt-2"
                          />
                        </div>
                      </div>
                  </div>
                 
                  {/* Seção de Endereço */}
                  <div>
                     <h3 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4 border-b pb-2">Endereço</h3>
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
                          <div className="md:col-span-1">
                            <Label htmlFor="cep" className="text-sm sm:text-base font-medium">CEP</Label>
                            <div className="relative mt-2">
                              <Input
                                id="cep"
                                value={cep}
                                onChange={handleCepChange}
                                onBlur={(e) => handleCepBlur(e.target.value)}
                                placeholder="Apenas números"
                                className="h-10 sm:h-11"
                                disabled={isFetchingCep}
                              />
                              {isFetchingCep && (
                                <RefreshCw className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground animate-spin" />
                              )}
                            </div>
                          </div>
                          <div className="md:col-span-2">
                            <Label htmlFor="endereco" className="text-sm sm:text-base font-medium">Endereço</Label>
                            <Input
                              id="endereco"
                              value={barbershop.endereco}
                              onChange={(e) => setBarbershop(prev => ({ ...prev, endereco: e.target.value }))}
                              placeholder="Rua, número"
                              className="h-10 sm:h-11 mt-2"
                            />
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                          <div>
                            <Label htmlFor="bairro" className="text-sm sm:text-base font-medium">Bairro</Label>
                            <Input
                              id="bairro"
                              value={barbershop.bairro}
                              onChange={(e) => setBarbershop(prev => ({ ...prev, bairro: e.target.value }))}
                              placeholder="Nome do bairro"
                              className="h-10 sm:h-11 mt-2"
                            />
                          </div>
                          
                          <div>
                            <Label htmlFor="cidade" className="text-sm sm:text-base font-medium">Cidade *</Label>
                            <Input
                              id="cidade"
                              value={barbershop.cidade}
                              onChange={(e) => setBarbershop(prev => ({ ...prev, cidade: e.target.value }))}
                              placeholder="Nome da cidade"
                              required
                              className="h-10 sm:h-11 mt-2"
                            />
                          </div>
                        </div>
                      </div>
                  </div>

                  <Button type="submit" disabled={saving} className="h-10 sm:h-11 min-w-28 sm:min-w-32 w-full sm:w-auto">
                    {saving ? (
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4 mr-2" />
                    )}
                    <span className="text-sm sm:text-base">{saving ? "Salvando..." : "Salvar Alterações"}</span>
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Configurações de Tema */}
          <TabsContent value="theme">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
              <Card className="border-border/50 bg-card/50 backdrop-blur-sm shadow-md">
                <CardHeader className="bg-gradient-to-r from-primary/5 to-accent/5 rounded-t-lg px-4 sm:px-6">
                  <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                    <Palette className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                    Configurações de Tema
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 sm:p-6 space-y-4 sm:space-y-6">
                  <div>
                    <Label className="text-sm sm:text-base font-medium mb-3 sm:mb-4 block">Modo de Tema</Label>
                    <div className="flex items-center gap-2 sm:gap-3 p-3 rounded-lg bg-muted/30">
                      <Button
                        type="button"
                        variant={theme === 'light' ? 'default' : 'outline'}
                        onClick={() => theme === 'dark' && toggleTheme()}
                        className="flex items-center gap-1 sm:gap-2 h-9 sm:h-10 text-xs sm:text-sm px-3 sm:px-4"
                      >
                        <Sun className="w-4 h-4" />
                        Claro
                      </Button>
                      <Button
                        type="button"
                        variant={theme === 'dark' ? 'default' : 'outline'}
                        onClick={() => theme === 'light' && toggleTheme()}
                        className="flex items-center gap-1 sm:gap-2 h-9 sm:h-10 text-xs sm:text-sm px-3 sm:px-4"
                      >
                        <Moon className="w-4 h-4" />
                        Escuro
                      </Button>
                    </div>
                  </div>

                  <div>
                    <Label className="text-sm sm:text-base font-medium mb-3 sm:mb-4 block">Paletas Pré-definidas</Label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 sm:gap-3">
                      {PREDEFINED_PALETTES.map((palette) => (
                        <div key={palette.name} className="space-y-1 sm:space-y-2 text-center">
                          <button
                            type="button"
                            onClick={() => applyPalette(palette.colors)}
                            className="w-full h-10 sm:h-12 rounded-lg flex items-center justify-center border-2 hover:border-primary transition-all"
                            style={{ 
                              background: `linear-gradient(45deg, ${palette.colors.primary}, ${palette.colors.accent})`
                            }}
                          >
                           {themeConfig.primary === palette.colors.primary && (
                              <Check className="w-4 h-4 sm:w-6 sm:h-6 text-white" />
                            )}
                          </button>
                          <p className="text-xs font-medium">{palette.name}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <Label className="text-sm sm:text-base font-medium mb-3 sm:mb-4 block">Cores Personalizadas</Label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                      <div>
                        <Label htmlFor="primary-color" className="text-xs sm:text-sm font-medium">Cor Principal</Label>
                        <div className="flex items-center gap-2 mt-2">
                          <Input
                            id="primary-color"
                            type="color"
                            value={themeConfig.primary}
                            onChange={(e) => updateThemeColor('primary', e.target.value)}
                            className="w-12 sm:w-16 h-9 sm:h-10 p-0 border-0 rounded-md"
                          />
                          <Input
                            value={themeConfig.primary}
                            onChange={(e) => updateThemeColor('primary', e.target.value)}
                            placeholder="#8b5cf6"
                            className="flex-1 h-9 sm:h-10 text-xs sm:text-sm"
                          />
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="secondary-color" className="text-xs sm:text-sm font-medium">Cor Secundária</Label>
                        <div className="flex items-center gap-2 mt-2">
                          <Input
                            id="secondary-color"
                            type="color"
                            value={themeConfig.secondary}
                            onChange={(e) => updateThemeColor('secondary', e.target.value)}
                            className="w-12 sm:w-16 h-9 sm:h-10 p-0 border-0 rounded-md"
                          />
                          <Input
                            value={themeConfig.secondary}
                            onChange={(e) => updateThemeColor('secondary', e.target.value)}
                            placeholder="#6b7280"
                            className="flex-1 h-9 sm:h-10 text-xs sm:text-sm"
                          />
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="accent-color" className="text-xs sm:text-sm font-medium">Cor de Destaque</Label>
                        <div className="flex items-center gap-2 mt-2">
                          <Input
                            id="accent-color"
                            type="color"
                            value={themeConfig.accent}
                            onChange={(e) => updateThemeColor('accent', e.target.value)}
                            className="w-12 sm:w-16 h-9 sm:h-10 p-0 border-0 rounded-md"
                          />
                          <Input
                            value={themeConfig.accent}
                            onChange={(e) => updateThemeColor('accent', e.target.value)}
                            placeholder="#f59e0b"
                            className="flex-1 h-9 sm:h-10 text-xs sm:text-sm"
                          />
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="background-color" className="text-xs sm:text-sm font-medium">Fundo</Label>
                        <div className="flex items-center gap-2 mt-2">
                          <Input
                            id="background-color"
                            type="color"
                            value={themeConfig.background}
                            onChange={(e) => updateThemeColor('background', e.target.value)}
                            className="w-12 sm:w-16 h-9 sm:h-10 p-0 border-0 rounded-md"
                          />
                          <Input
                            value={themeConfig.background}
                            onChange={(e) => updateThemeColor('background', e.target.value)}
                            placeholder="#ffffff"
                            className="flex-1 h-9 sm:h-10 text-xs sm:text-sm"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <Button onClick={handleThemeSubmit} disabled={saving} className="h-9 sm:h-11 min-w-28 sm:min-w-32 text-xs sm:text-sm">
                    {saving ? (
                      <RefreshCw className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2 animate-spin" />
                    ) : (
                      <Save className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                    )}
                    Salvar Tema
                  </Button>
                </CardContent>
              </Card>

              {/* Preview Card */}
              <Card className="border-border/50 bg-card/50 backdrop-blur-sm shadow-md lg:col-span-1">
                <CardHeader className="bg-gradient-to-r from-primary/5 to-accent/5 rounded-t-lg px-4 sm:px-6">
                  <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                    <Eye className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                    Preview do Tema
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 sm:p-6">
                  <div
                    className="p-4 rounded-xl border"
                    style={{
                      background: `linear-gradient(145deg, ${themeConfig.background}, ${themeConfig.primary}10)`,
                      borderColor: `${themeConfig.primary}30`
                    }}
                  >
                    {/* Header */}
                    <div className="flex items-center gap-3 mb-4">
                      {barbershop.logo_url ? (
                        <LazyImage
                          src={barbershop.logo_url}
                          alt="Preview"
                          className="w-10 h-10 rounded-lg shadow-md"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold shadow-md" style={{ background: themeConfig.primary }}>
                          {barbershop.nome.charAt(0) || "B"}
                        </div>
                      )}
                      <div>
                        <h3 className="font-semibold text-lg" style={{ color: themeConfig.primary }}>
                          {barbershop.nome || "Sua Barbearia"}
                        </h3>
                        <p className="text-xs text-muted-foreground">
                           Preview Interativo
                        </p>
                      </div>
                    </div>

                    {/* Componentes */}
                    <div className="space-y-4">
                      <Button
                        variant="default"
                        size="sm"
                        className="w-full h-9"
                        style={{ backgroundColor: themeConfig.primary, color: themeConfig.background }}
                      >
                        Botão Principal
                      </Button>

                      <div className="flex gap-2">
                         <Button
                          variant="outline"
                          size="sm"
                          className="w-full h-9"
                          style={{ borderColor: themeConfig.primary, color: themeConfig.primary }}
                        >
                          Secundário
                        </Button>
                         <Badge
                          style={{
                            backgroundColor: themeConfig.accent + '20',
                            color: themeConfig.accent,
                            borderColor: themeConfig.accent + '40',
                          }}
                        >
                          Destaque
                        </Badge>
                      </div>
                      
                      <Alert
                        className="p-3"
                        style={{
                          borderColor: `${themeConfig.secondary}50`,
                          backgroundColor: `${themeConfig.secondary}15`
                        }}
                      >
                        <Info className="h-4 w-4" style={{ color: themeConfig.secondary }} />
                        <AlertTitle className="text-sm font-semibold" style={{ color: themeConfig.secondary }}>
                          Aviso Importante
                        </AlertTitle>
                        <AlertDescription className="text-xs" style={{ color: `${themeConfig.secondary}cc` }}>
                          Isso é apenas um exemplo.
                        </AlertDescription>
                      </Alert>
                      
                      <div>
                        <Label className="text-xs font-medium" style={{color: themeConfig.secondary}}>Seu nome</Label>
                        <Input
                          className="mt-1 h-9 text-sm"
                          placeholder="Digite aqui..."
                           style={{
                            borderColor: `${themeConfig.primary}50`,
                            backgroundColor: `${themeConfig.background}80`
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Horários de Funcionamento */}
          <TabsContent value="hours">
            <Card className="border-border/50 bg-card/50 backdrop-blur-sm shadow-md">
              <CardHeader className="bg-gradient-to-r from-primary/5 to-accent/5 rounded-t-lg px-4 sm:px-6">
                <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                  <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                  Horários de Funcionamento
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 sm:p-6">
                <form onSubmit={handleWorkingHoursSubmit} className="space-y-4 sm:space-y-6">
                  <div className="space-y-3 sm:space-y-4">
                    {DAYS_OF_WEEK.map((day, index) => {
                      const hour = workingHours[index];
                      if (!hour) return null;
                      
                      return (
                        <div key={day.value} className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-lg bg-muted/30 border border-border/50">
                          <div className="w-full sm:w-32">
                            <Label className="font-medium text-sm sm:text-base">{day.label}</Label>
                          </div>
                          
                          <div className="flex items-center gap-2 sm:gap-3">
                            <Switch
                              checked={!hour.fechado}
                              onCheckedChange={(checked) => updateWorkingHour(index, 'fechado', checked ? 0 : 1)}
                            />
                            <span className="text-xs sm:text-sm text-muted-foreground w-14 sm:w-16">
                              {hour.fechado ? 'Fechado' : 'Aberto'}
                            </span>
                          </div>
                          
                          {!hour.fechado && (
                            <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 w-full sm:w-auto">
                              <div className="flex items-center gap-2">
                                <Label className="text-xs sm:text-sm w-12 sm:w-auto">Abre:</Label>
                                <Input
                                  type="time"
                                  value={hour.hora_abre}
                                  onChange={(e) => updateWorkingHour(index, 'hora_abre', e.target.value)}
                                  className="w-28 sm:w-32 h-8 sm:h-9 text-xs sm:text-sm"
                                />
                              </div>
                              
                              <div className="flex items-center gap-2">
                                <Label className="text-xs sm:text-sm w-12 sm:w-auto">Fecha:</Label>
                                <Input
                                  type="time"
                                  value={hour.hora_fecha}
                                  onChange={(e) => updateWorkingHour(index, 'hora_fecha', e.target.value)}
                                  className="w-28 sm:w-32 h-8 sm:h-9 text-xs sm:text-sm"
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <Button type="submit" disabled={saving} className="h-9 sm:h-11 min-w-28 sm:min-w-32 text-xs sm:text-sm">
                    {saving ? (
                      <RefreshCw className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2 animate-spin" />
                    ) : (
                      <Save className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                    )}
                    {saving ? "Salvando..." : "Salvar Horários"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Configurações de Notificações */}
          <TabsContent value="notifications">
            <Card className="border-border/50 bg-card/50 backdrop-blur-sm shadow-md">
              <CardHeader className="bg-gradient-to-r from-primary/5 to-accent/5 rounded-t-lg px-4 sm:px-6">
                <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                  <Volume2 className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                  Configurações de Notificações
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 sm:p-6">
                <div className="space-y-4">
                  <div>
                    <h3 className="text-base font-medium mb-2">Notificações Sonoras</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Configure as notificações sonoras para novos agendamentos. Você será notificado sempre que um cliente fizer um agendamento.
                    </p>
                  </div>
                  
                  <NotificationSound />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
        
        {/* Zona de Perigo - Excluir Barbearia */}
        <Card className="border-destructive/50 bg-destructive/5 backdrop-blur-sm shadow-md mt-4 sm:mt-6">
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="flex items-center gap-2 text-destructive text-base sm:text-lg">
              <Trash2 className="w-4 h-4 sm:w-5 sm:h-5" />
              Zona de Perigo
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex-1">
                <p className="font-semibold text-sm sm:text-base">Excluir esta barbearia</p>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                  Esta ação é irreversível. Todos os dados, incluindo agendamentos, clientes e funcionários, serão perdidos.
                </p>
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" className="h-9 sm:h-10 text-xs sm:text-sm px-3 sm:px-4 w-full sm:w-auto">Excluir Barbearia</Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="max-w-sm sm:max-w-lg">
                  <AlertDialogHeader>
                    <AlertDialogTitle className="text-base sm:text-lg">Você tem certeza absoluta?</AlertDialogTitle>
                    <AlertDialogDescription className="text-xs sm:text-sm">
                      Esta ação não pode ser desfeita. Para confirmar, digite{" "}
                      <strong className="text-destructive">DELETAR</strong> no campo abaixo.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <div className="my-3 sm:my-4">
                    <Input 
                      value={deleteConfirmationText}
                      onChange={(e) => setDeleteConfirmationText(e.target.value)}
                      placeholder="DELETAR"
                      className="border-destructive/50 focus:border-destructive h-8 sm:h-9 text-xs sm:text-sm"
                    />
                  </div>
                  <AlertDialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
                    <AlertDialogCancel className="h-8 sm:h-9 text-xs sm:text-sm w-full sm:w-auto">Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDeleteBarbershop}
                      disabled={deleteConfirmationText !== 'DELETAR' || isDeleting}
                      className="bg-destructive hover:bg-destructive/90 h-8 sm:h-9 text-xs sm:text-sm w-full sm:w-auto"
                    >
                      {isDeleting ? "Excluindo..." : "Eu entendo, excluir esta barbearia"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

// Helper component for image upload UI
const ImageUploader = ({ type, imageUrl, isUploading, onUpload, onRemove }: {
  type: 'logo' | 'gallery';
  imageUrl: string | null;
  isUploading: boolean;
  onUpload: (file: File) => void;
  onRemove: () => void;
}) => {
  const isLogo = type === 'logo';
  const id = `upload-input-${type}`;

  return (
    <div className={`relative border-2 border-dashed border-border/50 rounded-xl flex items-center justify-center 
      ${isLogo ? 'w-32 h-32' : 'aspect-video'}`}>
      {imageUrl && (
        <LazyImage
          src={imageUrl}
          alt={type}
          className="w-full h-full rounded-lg"
        />
      )}
      {!imageUrl && (
        <div className="text-center text-muted-foreground p-2">
          <Upload className="w-6 h-6 mx-auto mb-2" />
          <p className="text-xs">Clique ou arraste para enviar</p>
        </div>
      )}
      {imageUrl && !isUploading && (
        <Button
          type="button"
          variant="destructive"
          size="icon"
          className="absolute top-1 right-1 w-7 h-7 bg-red-600/80 hover:bg-red-600 z-10"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onRemove();
          }}
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      )}
      {isUploading && (
        <div className="absolute inset-0 bg-black/60 flex items-center justify-center rounded-xl">
          <RefreshCw className="w-6 h-6 text-white animate-spin" />
        </div>
      )}
      <input
        type="file"
        id={id}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        accept="image/png, image/jpeg, image/webp"
        onChange={(e) => {
          if (e.target.files && e.target.files[0]) {
            onUpload(e.target.files[0]);
          }
        }}
        disabled={isUploading}
      />
    </div>
  );
};