import { Link } from "react-router-dom";
import { Check, Scissors, Store, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function ConfiguracaoInicial({ temProfissional }: { temProfissional: boolean }) {
  return (
    <div className="mx-auto max-w-3xl space-y-5 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-bold sm:text-3xl">Configure sua barbearia</h1>
        <p className="mt-2 text-muted-foreground">
          Para aparecer em Barbearias Disponíveis, cadastre pelo menos um serviço e indique quem é responsável por ele.
        </p>
      </div>
      <Card variant="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg"><Users className="size-5 text-primary" aria-hidden="true" /> Profissional</CardTitle>
          <CardDescription>{temProfissional ? "Sua equipe já tem pelo menos um profissional cadastrado." : "Cadastre quem vai atender os clientes. Você também pode cadastrar a si mesmo."}</CardDescription>
        </CardHeader>
        <CardContent>
          {temProfissional ? (
            <p className="flex items-center gap-2 text-sm font-medium text-success"><Check className="size-4" aria-hidden="true" /> Profissional cadastrado</p>
          ) : (
            <Button asChild><Link to="/dashboard/funcionarios">Cadastrar profissional</Link></Button>
          )}
        </CardContent>
      </Card>
      <Card variant="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg"><Scissors className="size-5 text-primary" aria-hidden="true" /> Serviço e responsável</CardTitle>
          <CardDescription>Defina o preço, a duração e o profissional responsável pelo serviço.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {temProfissional ? (
            <Button asChild><Link to="/dashboard/servicos?configuracao=1&novo=1">Cadastrar serviço</Link></Button>
          ) : (
            <Button disabled>Cadastrar serviço</Button>
          )}
          <Button asChild variant="ghost"><Link to="/dashboard/servicos?configuracao=1">Ver serviços cadastrados</Link></Button>
        </CardContent>
      </Card>
      <Button asChild variant="outline">
        <Link to="/dashboard/settings"><Store aria-hidden="true" /> Completar dados da barbearia</Link>
      </Button>
    </div>
  );
}
