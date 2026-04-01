import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Download, X, Smartphone } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export const PWAInstallPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Detectar iOS
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent);
    setIsIOS(isIOSDevice);

    // Detectar se já está rodando como PWA
    const isInStandaloneMode = window.matchMedia('(display-mode: standalone)').matches ||
                              (window.navigator as any).standalone ||
                              document.referrer.includes('android-app://');
    setIsStandalone(isInStandaloneMode);

    // Verificar se já foi instalado antes
    const hasBeenInstalled = localStorage.getItem('pwa-installed') === 'true';
    const hasBeenDismissed = localStorage.getItem('pwa-dismissed') === 'true';
    setIsInstalled(hasBeenInstalled);

    // Mostrar prompt apenas se não foi instalado, não foi dispensado, e não está em standalone
    if (!hasBeenInstalled && !hasBeenDismissed && !isInStandaloneMode) {
      // Para iOS, mostrar após 3 segundos
      if (isIOSDevice) {
        setTimeout(() => setIsVisible(true), 3000);
      }

      // Para Android/Desktop, aguardar evento beforeinstallprompt
      const handleBeforeInstallPrompt = (e: Event) => {
        e.preventDefault();
        setDeferredPrompt(e as BeforeInstallPromptEvent);
        setIsVisible(true);
      };

      window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

      // Detectar se foi instalado
      const handleAppInstalled = () => {
        setIsInstalled(true);
        setIsVisible(false);
        localStorage.setItem('pwa-installed', 'true');
      };

      window.addEventListener('appinstalled', handleAppInstalled);

      return () => {
        window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        window.removeEventListener('appinstalled', handleAppInstalled);
      };
    }
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      
      if (outcome === 'accepted') {
        setIsInstalled(true);
        localStorage.setItem('pwa-installed', 'true');
      }
      
      setDeferredPrompt(null);
      setIsVisible(false);
    }
  };

  const handleDismiss = () => {
    setIsVisible(false);
    localStorage.setItem('pwa-dismissed', 'true');
  };

  // Não mostrar se já está instalado, é standalone, ou não deve ser visível
  if (isInstalled || isStandalone || !isVisible) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 md:left-auto md:right-4 md:w-96">
      <Card className="border-primary/20 bg-card/95 backdrop-blur-lg shadow-lg">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Smartphone className="w-5 h-5 text-primary" />
              Instalar App
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDismiss}
              className="h-6 w-6 p-0"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <p className="text-sm text-muted-foreground mb-4">
            {isIOS 
              ? 'Adicione o Fiden Agency à sua tela inicial para acesso rápido e experiência completa de app.'
              : 'Instale o Fiden Agency no seu dispositivo para acesso rápido e offline.'
            }
          </p>
          
          <div className="space-y-2">
            {isIOS ? (
              <div className="text-xs text-muted-foreground space-y-1">
                <p>Para instalar:</p>
                <ol className="list-decimal list-inside space-y-1 ml-2">
                  <li>Toque no botão "Compartilhar" (□↗)</li>
                  <li>Selecione "Adicionar à Tela Inicial"</li>
                  <li>Toque em "Adicionar"</li>
                </ol>
              </div>
            ) : (
              <Button 
                onClick={handleInstall} 
                className="w-full"
                disabled={!deferredPrompt}
              >
                <Download className="w-4 h-4 mr-2" />
                Instalar App
              </Button>
            )}
          </div>
          
          <div className="flex items-center justify-center mt-3 space-x-4 text-xs text-muted-foreground">
            <span>✓ Acesso offline</span>
            <span>✓ Notificações</span>
            <span>✓ Mais rápido</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};