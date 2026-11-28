import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useSettings } from "./useBarbershopSettings";

export function BarbershopActivation() {
  const { barbershop, setBarbershop, atualizarPaginaPublica, toast } = useSettings();
  const [aberto, setAberto] = useState(false);
  const desativada = barbershop.desativada_em !== null;
  const acao = desativada ? "Reativar barbearia" : "Desativar barbearia";

  const alterarPublicacao = useMutation({
    mutationFn: async ({ id, desativar }: { id: string; desativar: boolean }) => {
      const { data, error } = await supabase
        .from("barbearias")
        .update({ desativada_em: desativar ? new Date().toISOString() : null })
        .eq("id", id)
        .select("desativada_em")
        .single();
      if (error) throw error;
      return data.desativada_em;
    },
    onSuccess: (desativadaEm, { id }) => {
      setBarbershop((atual) => atual.id === id ? { ...atual, desativada_em: desativadaEm } : atual);
      atualizarPaginaPublica();
      setAberto(false);
      toast({ title: desativadaEm ? "Barbearia desativada." : "Barbearia reativada." });
    },
    onError: () => {
      toast({ title: "Não foi possível atualizar a barbearia.", description: "Tente novamente.", variant: "destructive" });
    },
  });

  if (!barbershop.id) return null;

  return (
    <div className="flex flex-wrap items-center justify-end gap-x-3 border-t border-border pt-3">
      {desativada && <p className="text-xs text-muted-foreground">Reservas online pausadas</p>}
      <AlertDialog open={aberto} onOpenChange={(open) => !alterarPublicacao.isPending && setAberto(open)}>
        <AlertDialogTrigger asChild>
          <Button type="button" variant="ghost" size="sm" className="text-sm font-medium text-muted-foreground">
            {acao}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>{acao}?</AlertDialogTitle>
            <AlertDialogDescription>
              {desativada
                ? "Sua barbearia volta à lista pública e pode receber novas reservas online."
                : "Sua barbearia sai da lista pública e pausa novas reservas online. Você pode reativá-la aqui a qualquer momento."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={alterarPublicacao.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={alterarPublicacao.isPending}
              onClick={(event) => {
                event.preventDefault();
                alterarPublicacao.mutate({ id: barbershop.id, desativar: !desativada });
              }}
            >
              {alterarPublicacao.isPending ? "Salvando..." : desativada ? "Reativar" : "Desativar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
