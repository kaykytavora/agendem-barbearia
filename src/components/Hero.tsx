import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Calendar, Clock, Users, Star, Smartphone, CheckCircle, Download } from "lucide-react";
import { useResponsive, useResponsiveClasses } from "@/hooks/use-mobile";
import heroImage from "@/assets/hero-barbershop.jpg";

export function Hero() {
  const { isMobile, isTablet } = useResponsive();
  const responsive = useResponsiveClasses();
  
  const features = [
    { icon: Calendar, title: "Agendamento Online", description: "Agenda online 24h com horários livres em tempo real" },
    { icon: Users, title: "Gestão de Clientes", description: "Perfil completo com histórico e preferências" },
    { icon: Star, title: "Avaliações", description: "Feedback dos clientes depois de cada atendimento" },
  ];

  const benefits = [
    "Interface moderna e responsiva",
    "Contato direto pelo WhatsApp",
    "Dashboard com estatísticas em tempo real",
    "Sistema de avaliações e feedback",
    "Controle de férias e ausências da equipe",
    "Sem necessidade de baixar apps"
  ];

  return (
    <div className="relative overflow-hidden bg-gradient-bg">
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
              Agendamento online, gestão da equipe e avaliações para barbearias e salões de beleza.
              {!isMobile && (
                <span className="text-foreground font-medium"> Tudo em um só lugar, direto do navegador.</span>
              )}
            </p>
          </div>

          {/* CTA Buttons */}
          <div className={`flex flex-col ${isMobile ? 'gap-3' : 'sm:flex-row gap-4'} justify-center mb-12 lg:mb-16`}>
            <Button
              asChild
              variant="premium"
              size={isMobile ? "lg" : "xl"}
              className={`shadow-glow ${responsive.button.size} ${responsive.button.text} min-h-[48px]`}
            >
              <Link to="/register-barbershop">
                <Calendar className={`${isMobile ? 'w-4 h-4' : 'w-5 h-5'} mr-2`} />
                Começar Gratuitamente
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              size={isMobile ? "lg" : "xl"}
              className={`${responsive.button.size} ${responsive.button.text} min-h-[48px]`}
            >
              <Link to="/barbearias">
                <Clock className={`${isMobile ? 'w-4 h-4' : 'w-5 h-5'} mr-2`} />
                Ver barbearias
              </Link>
            </Button>
          </div>

          {/* Destaques */}
          <div className={`flex flex-col ${isMobile ? 'gap-3' : 'md:flex-row gap-8'} items-center justify-center mb-12 lg:mb-20`}>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-primary" />
              <span className={`${isMobile ? 'text-xs' : 'text-sm'} text-muted-foreground`}>14 dias grátis em todos os planos</span>
            </div>
            <div className="flex items-center gap-2">
              <Download className="w-4 h-4 text-primary" />
              <span className={`${isMobile ? 'text-xs' : 'text-sm'} text-muted-foreground`}>Instale no celular como um app</span>
            </div>
          </div>
        </div>

        {/* Hero Image */}
        <div className={`${isMobile ? 'mb-12' : 'mb-20'}`}>
          <div className="relative max-w-5xl mx-auto">
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
              asChild
              variant="premium"
              size={isMobile ? "default" : "lg"}
              className={`${responsive.button.size} ${responsive.button.text} min-h-[48px]`}
            >
              <Link to="/register-barbershop">
                <Calendar className={`${isMobile ? 'w-4 h-4' : 'w-5 h-5'} mr-2`} />
                Teste Grátis por 14 Dias
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}