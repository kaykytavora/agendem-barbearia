import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle, Crown, Clock, Users, Calendar, BarChart3, Info
} from "lucide-react";
// import { StripeCheckout } from "@/components/stripe/StripeCheckout"; // Stand by
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { DashboardLayout } from "@/layouts/DashboardLayout";
import { Helmet } from "react-helmet-async";

interface SubscriptionStatus {
  hasActiveSubscription: boolean;
  subscription?: {
    id: string;
    status: string;
    current_period_end: number;
    price_id: string;
  };
}

export default function Subscription() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus | null>(null);

  useEffect(() => {
    if (user) {
      checkSubscriptionStatus();
    }
  }, [user]);

  const checkSubscriptionStatus = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('check-stripe-status');

      if (error) {
        console.error('Error checking subscription:', error);
        toast.error('Erro ao verificar assinatura');
        return;
      }

      setSubscriptionStatus(data);
    } catch (error) {
      console.error('Error:', error);
      toast.error('Erro inesperado');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-[60vh]">
          <div className="flex flex-col items-center gap-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <p className="text-muted-foreground">Carregando informações...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <Helmet>
        <title>Assinatura | Agendem</title>
      </Helmet>

      <div className="p-4 sm:p-6 space-y-6">
        {/* Header Standard */}
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Assinatura</h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Gerencie seu plano e faturas
          </p>
        </div>

        {subscriptionStatus?.hasActiveSubscription ? (
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  Assinatura Ativa
                </CardTitle>
                <CardDescription>
                  Detalhes do seu plano atual
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                  <span className="text-sm font-medium">Status</span>
                  <Badge variant="default" className="bg-green-500 hover:bg-green-600">
                    {subscriptionStatus.subscription?.status}
                  </Badge>
                </div>

                <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                  <span className="text-sm font-medium">Renovação</span>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="w-4 h-4" />
                    {subscriptionStatus.subscription?.current_period_end &&
                      new Date(subscriptionStatus.subscription.current_period_end * 1000).toLocaleDateString('pt-BR')
                    }
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Benefícios do Plano</CardTitle>
                <CardDescription>Recursos disponíveis na sua conta</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  <li className="flex items-center gap-2 text-sm">
                    <Users className="w-4 h-4 text-primary" />
                    <span>Funcionários ilimitados</span>
                  </li>
                  <li className="flex items-center gap-2 text-sm">
                    <Calendar className="w-4 h-4 text-primary" />
                    <span>Agendamentos ilimitados</span>
                  </li>
                  <li className="flex items-center gap-2 text-sm">
                    <BarChart3 className="w-4 h-4 text-primary" />
                    <span>Relatórios avançados</span>
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="space-y-6">
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="pt-6">
                <div className="flex flex-col items-center text-center space-y-4">
                  <div className="p-3 bg-primary/10 rounded-full">
                    <Crown className="w-8 h-8 text-primary" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-xl font-semibold">Período Beta</h3>
                    <p className="text-muted-foreground max-w-md mx-auto">
                      Estamos em fase de testes! Durante este período, todos os recursos premium estão liberados gratuitamente para você aproveitar e nos dar feedback.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-primary font-medium bg-primary/10 px-4 py-2 rounded-full">
                    <Info className="w-4 h-4" />
                    Não é necessário cadastrar cartão de crédito
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 
            <div className="opacity-50 pointer-events-none grayscale filter">
              <p className="text-center mb-4 text-muted-foreground font-medium">
                Planos disponíveis em breve
              </p>
              <StripeCheckout /> 
            </div> 
            */}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}