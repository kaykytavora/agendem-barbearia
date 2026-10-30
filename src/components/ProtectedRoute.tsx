import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import PageLoader from "./PageLoader";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: 'admin' | 'funcionario' | 'cliente';
}

export default function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const { user, role, loading, profileError } = useAuth(); // 'loading' espera pelo perfil

  if (loading) {
    return <PageLoader />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Perfil não carregou por falha de rede/servidor: não dá para saber o papel do usuário.
  if (profileError) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-6 text-center">
        <WifiOff className="h-10 w-10 text-muted-foreground" />
        <div className="space-y-1">
          <h1 className="text-lg font-semibold">Não foi possível carregar sua conta</h1>
          <p className="text-sm text-muted-foreground">Verifique sua conexão e tente novamente.</p>
        </div>
        <Button onClick={() => window.location.reload()}>Tentar novamente</Button>
      </div>
    );
  }

  // Se uma role específica é necessária, verifique-a.
  if (requiredRole) {
    if (role !== requiredRole) {
        // Caso especial: admin pode acessar rotas de funcionário
        if (requiredRole === 'funcionario' && role === 'admin') {
            return <>{children}</>;
        }
        // Se a role não corresponder, redireciona para não autorizado
        return <Navigate to="/unauthorized" replace />;
    }
  }

  // Se não houver 'requiredRole' ou se a role corresponder, renderiza o componente filho.
  return <>{children}</>;
}
