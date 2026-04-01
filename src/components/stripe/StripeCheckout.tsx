import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Check, Loader2, Crown, Zap, Star,
  Shield, Sparkles, TrendingUp, Award
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Plan {
  id: string;
  name: string;
  price: string;
  interval: string;
  priceId: string;
  features: string[];
  recommended?: boolean;
}

const plans: Plan[] = [
  {
    id: "basic",
    name: "Básico",
    price: "R$ 29",
    interval: "mês",
    priceId: "price_basic_monthly",
    features: [
      "Até 100 agendamentos/mês",
      "1 usuário administrador",
      "Dashboard essencial",
      "Suporte por email",
      "Backup diário"
    ]
  },
  {
    id: "pro",
    name: "Profissional",
    price: "R$ 79",
    interval: "mês",
    priceId: "price_pro_monthly",
    features: [
      "Agendamentos ilimitados",
      "Até 5 funcionários",
      "Relatórios avançados",
      "Programa de fidelidade",
      "Suporte prioritário",
      "Integrações avançadas",
      "WhatsApp Business API"
    ],
    recommended: true
  },
  {
    id: "enterprise",
    name: "Empresarial",
    price: "R$ 149",
    interval: "mês",
    priceId: "price_enterprise_monthly",
    features: [
      "Tudo do Profissional",
      "Funcionários ilimitados",
      "Múltiplas filiais",
      "API personalizada",
      "Suporte 24/7",
      "Consultoria dedicada",
      "White label disponível"
    ]
  }
];

const planIcons = {
  basic: Star,
  pro: Crown,
  enterprise: Award
};

const planColors = {
  basic: "from-blue-500 to-blue-600",
  pro: "from-primary to-accent",
  enterprise: "from-purple-500 to-purple-600"
};

export function StripeCheckout() {
  const [loading, setLoading] = useState<string | null>(null);

  const handleCheckout = async (priceId: string, planName: string) => {
    setLoading(priceId);

    try {
      const { data, error } = await supabase.functions.invoke('create-stripe-checkout', {
        body: {
          priceId,
          mode: 'subscription'
        }
      });

      if (error) {
        console.error('Error creating checkout session:', error);
        toast.error('Erro ao criar sessão de pagamento');
        return;
      }

      if (data?.url) {
        // Open Stripe checkout in a new tab
        window.open(data.url, '_blank');
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Erro inesperado');
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="space-y-8">
      <div className="text-center space-y-4">
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-accent/20 rounded-full blur-xl mx-auto w-32 h-32"></div>
          <div className="relative bg-gradient-to-r from-primary to-accent p-4 rounded-full w-fit mx-auto">
            <Crown className="w-12 h-12 text-white" />
          </div>
        </div>
        <div>
          <h2 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Escolha seu Plano
          </h2>
          <p className="text-muted-foreground mt-3 text-base sm:text-lg">
            Transforme sua barbearia com recursos profissionais
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20">
            <Shield className="w-3 h-3 mr-1" />
            14 dias grátis
          </Badge>
          <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/20">
            <Zap className="w-3 h-3 mr-1" />
            Cancele quando quiser
          </Badge>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
        {plans.map((plan, index) => {
          const IconComponent = planIcons[plan.id as keyof typeof planIcons];
          const colorClass = planColors[plan.id as keyof typeof planColors];

          return (
            <Card
              key={plan.id}
              className={`group relative border-0 bg-gradient-to-br from-card to-card/80 backdrop-blur-xl shadow-lg hover:shadow-2xl transition-all duration-500 hover:scale-105 overflow-hidden ${
                plan.recommended ? 'ring-2 ring-primary/20' : ''
              }`}
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <div className={`absolute inset-0 bg-gradient-to-r ${plan.recommended ? 'from-primary/5 to-accent/5' : 'from-background/50 to-background/30'} opacity-0 group-hover:opacity-100 transition-opacity duration-500`}></div>

              {plan.recommended && (
                <>
                  <div className="absolute -top-1 -right-1 w-24 h-24 bg-gradient-to-br from-primary to-accent rounded-full opacity-10"></div>
                  <Badge className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-primary to-accent text-white border-0 shadow-lg">
                    <Sparkles className="w-3 h-3 mr-1" />
                    Mais Popular
                  </Badge>
                </>
              )}

              <CardHeader className="text-center relative z-10 space-y-4">
                <div className="relative mx-auto w-fit">
                  <div className={`absolute inset-0 bg-gradient-to-r ${colorClass} rounded-full blur-lg opacity-50`}></div>
                  <div className={`relative bg-gradient-to-r ${colorClass} p-3 rounded-full`}>
                    <IconComponent className="w-8 h-8 text-white" />
                  </div>
                </div>

                <div>
                  <CardTitle className="text-2xl font-bold">{plan.name}</CardTitle>
                  <CardDescription className="mt-2">
                    <span className="text-4xl font-bold text-foreground">
                      {plan.price}
                    </span>
                    <span className="text-muted-foreground text-base">/{plan.interval}</span>
                  </CardDescription>
                </div>
              </CardHeader>

              <CardContent className="space-y-6 relative z-10">
                <ul className="space-y-3">
                  {plan.features.map((feature, featureIndex) => (
                    <li key={featureIndex} className="flex items-start gap-3">
                      <div className="relative mt-0.5">
                        <div className="absolute inset-0 bg-primary/20 rounded-full blur-sm"></div>
                        <Check className="relative w-4 h-4 text-primary flex-shrink-0" />
                      </div>
                      <span className="text-sm leading-relaxed">{feature}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  onClick={() => handleCheckout(plan.priceId, plan.name)}
                  disabled={loading === plan.priceId}
                  className={`w-full h-12 font-medium transition-all duration-300 group-hover:shadow-xl ${
                    plan.recommended
                      ? 'bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 text-white border-0'
                      : 'border-2 hover:border-primary hover:bg-primary/5'
                  }`}
                  variant={plan.recommended ? "default" : "outline"}
                >
                  {loading === plan.priceId ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Processando...
                    </>
                  ) : (
                    <>
                      <Sparkles className={`w-4 h-4 mr-2 ${plan.recommended ? 'animate-pulse' : ''}`} />
                      Assinar {plan.name}
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Trust Signals */}
      <div className="space-y-6">
        <div className="text-center space-y-3">
          <div className="flex justify-center items-center gap-2 text-sm text-muted-foreground">
            <Shield className="w-4 h-4 text-green-500" />
            <span>Todos os planos incluem <strong>14 dias grátis</strong></span>
          </div>
          <p className="text-xs text-muted-foreground">
            Pagamento seguro via Stripe • Cancele quando quiser • Sem taxa de cancelamento
          </p>
        </div>

        {/* Social Proof */}
        <Card className="border-0 bg-gradient-to-r from-muted/30 to-muted/50 backdrop-blur-sm">
          <CardContent className="p-6">
            <div className="text-center space-y-4">
              <div className="flex justify-center items-center gap-2">
                <TrendingUp className="w-5 h-5 text-primary" />
                <span className="font-semibold">Mais de 1.000 barbearias confiam no Agendem</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-2xl font-bold text-primary">50k+</p>
                  <p className="text-xs text-muted-foreground">Agendamentos mensais</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-accent">99.9%</p>
                  <p className="text-xs text-muted-foreground">Uptime garantido</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-green-500">4.9/5</p>
                  <p className="text-xs text-muted-foreground">Satisfação dos clientes</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}