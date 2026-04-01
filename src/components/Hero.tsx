import { Button } from "@/components/ui/button";
import { Calendar, Clock, Users, Star, Smartphone, CheckCircle } from "lucide-react";
import { useResponsive, useResponsiveClasses } from "@/hooks/use-mobile";
import heroImage from "@/assets/hero-barbershop.jpg";

export function Hero() {
  const { isMobile, isTablet } = useResponsive();
  const responsive = useResponsiveClasses();
  
  const features = [
    { icon: Calendar, title: "Agendamento Inteligente", description: "Sistema completo de agendamentos com IA" },
    { icon: Users, title: "Gestão de Clientes", description: "Perfil completo com histórico e preferências" },
    { icon: Star, title: "Programa Fidelidade", description: "Cartão digital automático para seus clientes" },
  ];

  const benefits = [
    "Interface moderna e responsiva",
    "Confirmação automática por WhatsApp",
    "Dashboard com estatísticas em tempo real",
    "Sistema de avaliações e feedback",
    "Sugestões inteligentes de horários",
    "Sem necessidade de baixar apps"
  ];

  return (
    <div className="relative overflow-hidden bg-gradient-bg">
      {/* Background Effects */}
      <div className="absolute inset-0">
        <div className="absolute top-20 left-1/4 w-72 h-72 bg-primary/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-20 right-1/4 w-96 h-96 bg-accent/5 rounded-full blur-3xl"></div>
      </div>

      <div className={`relative max-w-7xl mx-auto ${responsive.containerPadding} ${responsive.sectionPadding}`}>
        <div className="text-center">
          {/* Main Heading */}
          <div className="mb-8">
            <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-full px-4 py-2 mb-6">
              <Smartphone className="w-4 h-4 text-primary" />
              <span className="text-sm text-primary font-medium">100% Web - Sem Downloads</span>
            </div>
            
            <h1 className={`${responsive.heading.h1} font-bold mb-6 leading-tight`}>
              <span className="bg-gradient-primary bg-clip-text text-transparent">
                Revolucione
              </span>
              {!isMobile && <br />}
              {isMobile ? ' ' : ''}sua Barbearia
            </h1>
            
            <p className={`${isMobile ? 'text-lg' : isTablet ? 'text-xl' : 'text-xl md:text-2xl'} text-muted-foreground max-w-3xl mx-auto mb-8 leading-relaxed`}>
              O sistema de agendamento mais moderno e inteligente para barbearias e salões de beleza.
              {!isMobile && (
                <span className="text-foreground font-medium"> Interface profissional, IA integrada e resultados garantidos.</span>
              )}
            </p>
          </div>

          {/* CTA Buttons */}
          <div className={`flex flex-col ${isMobile ? 'gap-3' : 'sm:flex-row gap-4'} justify-center mb-12 lg:mb-16`}>
            <Button 
              variant="premium" 
              size={isMobile ? "lg" : "xl"} 
              className={`shadow-glow ${responsive.button.size} ${responsive.button.text} min-h-[48px]`}
            >
              <Calendar className={`${isMobile ? 'w-4 h-4' : 'w-5 h-5'} mr-2`} />
              Começar Gratuitamente
            </Button>
            <Button 
              variant="outline" 
              size={isMobile ? "lg" : "xl"}
              className={`${responsive.button.size} ${responsive.button.text} min-h-[48px]`}
            >
              <Clock className={`${isMobile ? 'w-4 h-4' : 'w-5 h-5'} mr-2`} />
              Ver Demonstração
            </Button>
          </div>

          {/* Social Proof */}
          <div className={`flex flex-col ${isMobile ? 'gap-4' : 'md:flex-row gap-8'} items-center justify-center mb-12 lg:mb-20`}>
            <div className="flex items-center gap-2">
              <div className="flex -space-x-2">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className={`${isMobile ? 'w-6 h-6' : 'w-8 h-8'} bg-gradient-primary rounded-full border-2 border-background`}></div>
                ))}
              </div>
              <span className={`${isMobile ? 'text-xs' : 'text-sm'} text-muted-foreground`}>+500 barbearias confiam</span>
            </div>
            
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((i) => (
                <Star key={i} className={`${isMobile ? 'w-3 h-3' : 'w-4 h-4'} fill-primary text-primary`} />
              ))}
              <span className={`${isMobile ? 'text-xs' : 'text-sm'} text-muted-foreground ml-2`}>4.9/5 de satisfação</span>
            </div>
          </div>
        </div>

        {/* Hero Image */}
        <div className={`${isMobile ? 'mb-12' : 'mb-20'}`}>
          <div className="relative max-w-5xl mx-auto">
            <div className="absolute inset-0 bg-gradient-primary/20 rounded-2xl blur-2xl"></div>
            <img 
              src={heroImage} 
              alt="Barbershop moderno com sistema de agendamento" 
              className={`relative w-full ${isMobile ? 'h-[250px]' : isTablet ? 'h-[350px]' : 'h-[400px] md:h-[500px]'} object-cover rounded-2xl border border-border/50 shadow-2xl`}
              loading="lazy"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background/50 to-transparent rounded-2xl"></div>
          </div>
        </div>

        {/* Features Grid */}
        <div className={`${responsive.gridCols.auto} ${responsive.card.gap} ${isMobile ? 'mb-12' : 'mb-20'}`}>
          {features.map((feature, index) => (
            <div key={index} className={`bg-card/50 backdrop-blur-sm border border-border rounded-xl ${responsive.card.padding} hover:shadow-brand-md transition-all duration-300 ${!isMobile ? 'hover:scale-105' : ''}`}>
              <div className={`${isMobile ? 'w-10 h-10' : 'w-12 h-12'} bg-gradient-primary rounded-lg flex items-center justify-center mb-4`}>
                <feature.icon className={`${isMobile ? 'w-5 h-5' : 'w-6 h-6'} text-white`} />
              </div>
              <h3 className={`${responsive.heading.h3} font-bold mb-2`}>{feature.title}</h3>
              <p className={`text-muted-foreground ${isMobile ? 'text-sm' : ''}`}>{feature.description}</p>
            </div>
          ))}
        </div>

        {/* Benefits Section */}
        <div className={`bg-card/30 backdrop-blur-sm border border-border rounded-2xl ${isMobile ? 'p-6' : 'p-8 md:p-12'}`}>
          <h2 className={`${responsive.heading.h2} font-bold text-center mb-8`}>
            Tudo que você precisa em <span className="bg-gradient-primary bg-clip-text text-transparent">uma plataforma</span>
          </h2>
          
          <div className={`grid ${isMobile ? 'grid-cols-1 gap-3' : 'md:grid-cols-2 gap-4'}`}>
            {benefits.map((benefit, index) => (
              <div key={index} className="flex items-center gap-3">
                <CheckCircle className={`${isMobile ? 'w-4 h-4' : 'w-5 h-5'} text-primary flex-shrink-0`} />
                <span className={`text-foreground ${isMobile ? 'text-sm' : ''}`}>{benefit}</span>
              </div>
            ))}
          </div>

          <div className="text-center mt-8">
            <Button 
              variant="premium" 
              size={isMobile ? "default" : "lg"}
              className={`${responsive.button.size} ${responsive.button.text} min-h-[48px]`}
            >
              <Calendar className={`${isMobile ? 'w-4 h-4' : 'w-5 h-5'} mr-2`} />
              Teste Grátis por 14 Dias
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}