import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { LoginForm } from "@/components/auth/LoginForm";
import { LoginLayout } from "@/components/auth/LoginLayout";
import { useAuth } from "@/contexts/AuthContext";

export default function Login() {
  const { user, role, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading || !user) return;
    if (role === "cliente") navigate("/client-panel");
    if (role === "admin" || role === "funcionario") navigate("/dashboard");
  }, [user, role, loading, navigate]);

  return (
    <LoginLayout acesso="barbearia">
      <LoginForm profissional disabled={loading} />
    </LoginLayout>
  );
}
