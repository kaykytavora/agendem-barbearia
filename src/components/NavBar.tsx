import { Button } from "@/components/ui/button";
import { Calendar, Users, Settings, Menu, X } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useResponsive, useResponsiveClasses } from "@/hooks/use-mobile";

interface NavBarProps {
  className?: string;
}

export function NavBar({ className }: NavBarProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { isMobile } = useResponsive();
  const responsive = useResponsiveClasses();

  const navigation = [
    { name: "Agendamentos", href: "/dashboard", icon: Calendar },
    { name: "Clientes", href: "/clients", icon: Users },
    { name: "Configurações", href: "/settings", icon: Settings },
  ];

  return (
    <nav className={cn("border-b border-border bg-card/50 backdrop-blur-md", className)}>
      <div className={`max-w-7xl mx-auto ${responsive.containerPadding}`}>
        <div className={`flex justify-between ${isMobile ? 'h-14' : 'h-16'}`}>
          {/* Logo */}
          <div className="flex items-center">
            <div className="flex-shrink-0 flex items-center">
              <img src="/icon-agendem.svg" alt="agendem" className={`${isMobile ? 'w-6 h-6 mr-2' : 'w-8 h-8 mr-2'}`} />
              <span className={`${isMobile ? 'text-lg' : 'text-xl'} font-bold bg-gradient-primary bg-clip-text text-transparent`}>
                agendem
              </span>
            </div>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-8">
            {navigation.map((item) => (
              <Link
                key={item.name}
                to={item.href}
                className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <item.icon className="w-4 h-4" />
                {item.name}
              </Link>
            ))}
            <Button variant="premium" size="sm" asChild>
              <Link to="/login">Fazer Login</Link>
            </Button>
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden flex items-center">
            <Button
              variant="ghost"
              size={isMobile ? "sm" : "icon"}
              className="touch-target"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
              {isMenuOpen ? <X className={`${isMobile ? 'w-5 h-5' : 'w-5 h-5'}`} /> : <Menu className={`${isMobile ? 'w-5 h-5' : 'w-5 h-5'}`} />}
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile Navigation */}
      {isMenuOpen && (
        <div className="md:hidden border-t border-border bg-card">
          <div className={`${isMobile ? 'px-2 pt-2 pb-3 space-y-1' : 'px-2 pt-2 pb-3 space-y-1'}`}>
            {navigation.map((item) => (
              <Link
                key={item.name}
                to={item.href}
                className={`flex items-center gap-2 ${isMobile ? 'px-3 py-3' : 'px-3 py-2'} text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors touch-target`}
                onClick={() => setIsMenuOpen(false)}
              >
                <item.icon className={`${isMobile ? 'w-5 h-5' : 'w-4 h-4'}`} />
                <span className={`${isMobile ? 'text-base' : 'text-sm'}`}>{item.name}</span>
              </Link>
            ))}
            <div className={`${isMobile ? 'px-3 py-2' : 'px-3 py-2'}`}>
              <Button variant="premium" className={`w-full ${responsive.button.size} touch-target`} asChild>
                <Link to="/login">Fazer Login</Link>
              </Button>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}