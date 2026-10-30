import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Check, Loader2, Crown, Zap, Star,
  Shield, Sparkles, Award
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
  basic: "bg-primary/70",
  pro: "bg-primary",
  enterprise: "bg-foreground"
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
          <div className="relative bg-primary p-4 rounded-full w-fit mx-auto">
            <Crown className="w-12 h-12 text-white" />
          </div>
        </div>
        <div>
          <h2 className="text-3xl sm:text-4xl font-bold text-primary">
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
              className={`group relative bg-card transition-shadow duration-300 hover:shadow-brand-md overflow-hidden ${
                plan.recommended ? 'border-2 border-primary' : ''
              }`}
              style={{ animationDelay: `${index * 100}ms` }}
            >
              {plan.recommended && (
                <>
                  <Badge className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-primary text-white border-0 shadow-lg">
                    <Sparkles className="w-3 h-3 mr-1" />
                    Mais Popular
                  </Badge>
                </>
              )}

              <CardHeader className="text-center relative z-10 space-y-4">
                <div className="relative mx-auto w-fit">
                  <div className={`relative ${colorClass} p-3 rounded-full`}>
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
                      ? 'bg-primary hover:bg-primary/90 text-white border-0'
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
      </div>
    </div>
  );
}