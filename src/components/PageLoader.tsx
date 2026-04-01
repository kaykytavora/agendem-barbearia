import { Calendar } from "lucide-react";

export default function PageLoader() {
  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-background gap-4">
      <div className="relative flex items-center justify-center">
        <Calendar className="w-16 h-16 text-primary animate-pulse" />
        <div className="absolute w-16 h-16 border-2 border-primary/20 rounded-full animate-spin-slow"></div>
        <div className="absolute w-24 h-24 border-2 border-primary/10 rounded-full animate-spin-slower"></div>
      </div>
      <p className="text-muted-foreground animate-pulse">Carregando...</p>
    </div>
  );
} 