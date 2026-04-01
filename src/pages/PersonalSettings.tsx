import { useState, useEffect } from "react";
import { DashboardLayout } from "@/layouts/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { 
  User, 
  Bell, 
  Shield, 
  Eye, 
  EyeOff, 
  Camera,
  Save,
  AlertTriangle
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { usePhoneMask } from "@/hooks/usePhoneMask";
import { supabase } from "@/integrations/supabase/client";

export default function PersonalSettings() {
  const { user, profile, refreshProfile } = useAuth();
  const { toast } = useToast();
  
  const [formData, setFormData] = useState({
    name: "",
    email: "",
  });

  const {
    value: phone,
    handleChange: handlePhoneChange,
    handleBlur: handlePhoneBlur,
    setValue: setPhoneValue,
  } = usePhoneMask("");

  // Sincronizar com perfil do usuário
  useEffect(() => {
    if (profile) {
      setFormData({
        name: profile.name || "",
        email: user?.email || "",
      });
      setPhoneValue(profile.phone || "");
    }
  }, [profile, user, setPhoneValue]);

  const [notifications, setNotifications] = useState({
    emailNotifications: true,
    smsNotifications: false,
    pushNotifications: true,
    appointmentReminders: true,
    marketingEmails: false,
  });

  const [privacy, setPrivacy] = useState({
    profileVisible: true,
    showEmail: false,
    showPhone: true,
  });

  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleNotificationChange = (field: string, value: boolean) => {
    setNotifications(prev => ({ ...prev, [field]: value }));
  };

  const handlePrivacyChange = (field: string, value: boolean) => {
    setPrivacy(prev => ({ ...prev, [field]: value }));
  };

  const handlePasswordChange = (field: string, value: string) => {
    setPasswordData(prev => ({ ...prev, [field]: value }));
  };

  const handleSaveProfile = async () => {
    if (!profile) return;

    // Validar telefone
    const cleanPhone = phone.replace(/\D/g, "");
    if (cleanPhone.length > 0 && (cleanPhone.length < 10 || cleanPhone.length > 11)) {
      toast({
        title: "Telefone inválido",
        description: "O telefone deve ter 10 ou 11 dígitos (com DDD).",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from("profiles")
        .update({ 
          name: formData.name, 
          phone: cleanPhone,
        })
        .eq("user_id", profile.user_id);
      
      if (error) throw error;

      toast({
        title: "Perfil atualizado",
        description: "Suas informações foram salvas com sucesso!",
      });

      await refreshProfile();
    } catch (error: unknown) {
      toast({
        title: "Erro ao atualizar perfil",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    }
  };

  const handleSaveNotifications = () => {
    toast({
      title: "Notificações atualizadas",
      description: "Suas preferências de notificação foram salvas!",
    });
  };

  const handleChangePassword = () => {
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast({
        title: "Erro",
        description: "As senhas não coincidem!",
        variant: "destructive",
      });
      return;
    }
    
    toast({
      title: "Senha alterada",
      description: "Sua senha foi alterada com sucesso!",
    });
    
    setPasswordData({
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    });
    setShowPasswordForm(false);
  };

  const userName = user?.user_metadata?.name || user?.email?.split('@')[0] || "Usuário";
  const userInitials = userName.slice(0, 2).toUpperCase();

  return (
    <DashboardLayout>
      <div className="space-y-4 sm:space-y-6 p-4 sm:p-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Configurações Pessoais</h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Gerencie suas informações pessoais e preferências
          </p>
        </div>

        {/* Profile Information */}
        <Card>
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
              <User className="w-4 h-4 sm:w-5 sm:h-5" />
              Informações do Perfil
            </CardTitle>
            <CardDescription className="text-sm sm:text-base">
              Atualize suas informações pessoais
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 sm:space-y-6 p-4 sm:p-6">
            {/* Avatar Section */}
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-6">
              <div className="relative">
                <Avatar className="w-16 h-16 sm:w-20 sm:h-20">
                  <AvatarImage src={user?.user_metadata?.avatar_url} />
                  <AvatarFallback className="bg-gradient-primary text-white text-base sm:text-lg">
                    {userInitials}
                  </AvatarFallback>
                </Avatar>
                <Button
                  size="icon"
                  variant="outline"
                  className="absolute -bottom-1 -right-1 sm:-bottom-2 sm:-right-2 w-6 h-6 sm:w-8 sm:h-8 rounded-full"
                >
                  <Camera className="w-3 h-3 sm:w-4 sm:h-4" />
                </Button>
              </div>
              <div className="text-center sm:text-left">
                <h3 className="text-base sm:text-lg font-semibold">{userName}</h3>
                <p className="text-xs sm:text-sm text-muted-foreground">{user?.email}</p>
                <Badge variant="outline" className="mt-2 text-xs">
                  Administrador
                </Badge>
              </div>
            </div>

            <Separator />

            {/* Form Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-sm sm:text-base">Nome Completo</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => handleInputChange("name", e.target.value)}
                  placeholder="Seu nome completo"
                  className="text-sm sm:text-base"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm sm:text-base">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange("email", e.target.value)}
                  placeholder="seu@email.com"
                  className="text-sm sm:text-base"
                />
              </div>
              
              <div className="space-y-2 md:col-span-1">
                <Label htmlFor="phone" className="text-sm sm:text-base">Telefone</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={handlePhoneChange}
                  onBlur={handlePhoneBlur}
                  placeholder="(11) 99999-9999"
                  maxLength={15}
                  className="text-sm sm:text-base"
                />
              </div>
            </div>


            <Button onClick={handleSaveProfile} className="w-full md:w-auto text-sm sm:text-base">
              <Save className="w-4 h-4 mr-2" />
              Salvar Alterações
            </Button>
          </CardContent>
        </Card>

        {/* Security */}
        <Card>
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
              <Shield className="w-4 h-4 sm:w-5 sm:h-5" />
              Segurança
            </CardTitle>
            <CardDescription className="text-sm sm:text-base">
              Gerencie sua senha e configurações de segurança
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h4 className="text-sm sm:text-base font-medium">Alterar Senha</h4>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  Última alteração há 30 dias
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => setShowPasswordForm(!showPasswordForm)}
                className="w-full sm:w-auto text-sm sm:text-base"
              >
                {showPasswordForm ? <EyeOff className="w-4 h-4 mr-2" /> : <Eye className="w-4 h-4 mr-2" />}
                {showPasswordForm ? "Cancelar" : "Alterar Senha"}
              </Button>
            </div>

            {showPasswordForm && (
              <div className="space-y-4 p-3 sm:p-4 border rounded-lg bg-muted/30">
                <div className="space-y-2">
                  <Label htmlFor="currentPassword" className="text-sm sm:text-base">Senha Atual</Label>
                  <Input
                    id="currentPassword"
                    type="password"
                    value={passwordData.currentPassword}
                    onChange={(e) => handlePasswordChange("currentPassword", e.target.value)}
                    placeholder="Digite sua senha atual"
                    className="text-sm sm:text-base"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="newPassword" className="text-sm sm:text-base">Nova Senha</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    value={passwordData.newPassword}
                    onChange={(e) => handlePasswordChange("newPassword", e.target.value)}
                    placeholder="Digite sua nova senha"
                    className="text-sm sm:text-base"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" className="text-sm sm:text-base">Confirmar Nova Senha</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={passwordData.confirmPassword}
                    onChange={(e) => handlePasswordChange("confirmPassword", e.target.value)}
                    placeholder="Confirme sua nova senha"
                    className="text-sm sm:text-base"
                  />
                </div>

                <Button onClick={handleChangePassword} className="w-full text-sm sm:text-base">
                  Alterar Senha
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card>
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
              <Bell className="w-4 h-4 sm:w-5 sm:h-5" />
              Notificações
            </CardTitle>
            <CardDescription className="text-sm sm:text-base">
              Configure como você deseja receber notificações
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 sm:space-y-6 p-4 sm:p-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1">
                  <h4 className="text-sm sm:text-base font-medium">Notificações por Email</h4>
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    Receba atualizações importantes por email
                  </p>
                </div>
                <Switch
                  checked={notifications.emailNotifications}
                  onCheckedChange={(value) => handleNotificationChange("emailNotifications", value)}
                />
              </div>

              <div className="flex items-center justify-between gap-4">
                <div className="flex-1">
                  <h4 className="text-sm sm:text-base font-medium">Notificações SMS</h4>
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    Receba lembretes por mensagem de texto
                  </p>
                </div>
                <Switch
                  checked={notifications.smsNotifications}
                  onCheckedChange={(value) => handleNotificationChange("smsNotifications", value)}
                />
              </div>

              <div className="flex items-center justify-between gap-4">
                <div className="flex-1">
                  <h4 className="text-sm sm:text-base font-medium">Notificações Push</h4>
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    Receba notificações no navegador
                  </p>
                </div>
                <Switch
                  checked={notifications.pushNotifications}
                  onCheckedChange={(value) => handleNotificationChange("pushNotifications", value)}
                />
              </div>

              <div className="flex items-center justify-between gap-4">
                <div className="flex-1">
                  <h4 className="text-sm sm:text-base font-medium">Lembretes de Agendamento</h4>
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    Receba lembretes sobre próximos agendamentos
                  </p>
                </div>
                <Switch
                  checked={notifications.appointmentReminders}
                  onCheckedChange={(value) => handleNotificationChange("appointmentReminders", value)}
                />
              </div>

              <div className="flex items-center justify-between gap-4">
                <div className="flex-1">
                  <h4 className="text-sm sm:text-base font-medium">Emails de Marketing</h4>
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    Receba dicas e novidades sobre o sistema
                  </p>
                </div>
                <Switch
                  checked={notifications.marketingEmails}
                  onCheckedChange={(value) => handleNotificationChange("marketingEmails", value)}
                />
              </div>
            </div>

            <Button onClick={handleSaveNotifications} className="w-full md:w-auto text-sm sm:text-base">
              <Save className="w-4 h-4 mr-2" />
              Salvar Preferências
            </Button>
          </CardContent>
        </Card>

        {/* Privacy */}
        <Card>
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
              <Eye className="w-4 h-4 sm:w-5 sm:h-5" />
              Privacidade
            </CardTitle>
            <CardDescription className="text-sm sm:text-base">
              Controle a visibilidade das suas informações
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 p-4 sm:p-6">
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1">
                <h4 className="text-sm sm:text-base font-medium">Perfil Público</h4>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  Permitir que outros vejam seu perfil
                </p>
              </div>
              <Switch
                checked={privacy.profileVisible}
                onCheckedChange={(value) => handlePrivacyChange("profileVisible", value)}
              />
            </div>

            <div className="flex items-center justify-between gap-4">
              <div className="flex-1">
                <h4 className="text-sm sm:text-base font-medium">Mostrar Email</h4>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  Exibir seu email no perfil público
                </p>
              </div>
              <Switch
                checked={privacy.showEmail}
                onCheckedChange={(value) => handlePrivacyChange("showEmail", value)}
              />
            </div>

            <div className="flex items-center justify-between gap-4">
              <div className="flex-1">
                <h4 className="text-sm sm:text-base font-medium">Mostrar Telefone</h4>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  Exibir seu telefone no perfil público
                </p>
              </div>
              <Switch
                checked={privacy.showPhone}
                onCheckedChange={(value) => handlePrivacyChange("showPhone", value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Danger Zone */}
        <Card className="border-red-200">
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="flex items-center gap-2 text-red-600 text-lg sm:text-xl">
              <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5" />
              Zona de Perigo
            </CardTitle>
            <CardDescription className="text-sm sm:text-base">
              Ações irreversíveis relacionadas à sua conta
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 sm:p-6">
            <div className="space-y-4">
              <div className="p-3 sm:p-4 border border-red-200 rounded-lg bg-red-50">
                <h4 className="text-sm sm:text-base font-medium text-red-800 mb-2">Excluir Conta</h4>
                <p className="text-xs sm:text-sm text-red-600 mb-4">
                  Esta ação é irreversível. Todos os seus dados serão permanentemente removidos.
                </p>
                <Button variant="destructive" size="sm" className="text-xs sm:text-sm">
                  Excluir Minha Conta
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}