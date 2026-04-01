import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import PageLoader from "./PageLoader"; // Importar o novo loader

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: 'admin' | 'funcionario' | 'cliente';
}

export default function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const { user, role, loading } = useAuth(); // Agora 'loading' espera pelo perfil

  if (loading) {
    return <PageLoader />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
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