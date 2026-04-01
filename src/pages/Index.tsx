import { NavBar } from "@/components/NavBar";
import { Hero } from "@/components/Hero";

const Index = () => {
  return (
    <div className="min-h-screen bg-gradient-bg">
      <NavBar />
      <Hero />
      
      {/* Footer */}
      <footer className="border-t border-border bg-card/30 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center">
            <div className="flex items-center justify-center gap-2 mb-4">
              <img src="/icon-agendem.svg" alt="agendem" className="w-8 h-8" />
              <span className="text-xl font-bold bg-gradient-primary bg-clip-text text-transparent">
                agendem
              </span>
            </div>
            <p className="text-muted-foreground mb-4">
              O sistema de agendamento mais moderno para barbearias
            </p>
            <p className="text-sm text-muted-foreground">
              © 2024 agendem. Todos os direitos reservados.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
