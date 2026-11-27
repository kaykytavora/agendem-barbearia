import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { gerenciarAgendamento, type AcaoAgendamento, type AcompanhamentoAgendamento } from "@/integrations/supabase/api";

const dialogos = {
  pedir_cancelamento: {
    titulo: "Pedir cancelamento?",
    texto: "O horário continua reservado até a outra parte aprovar.",
    botao: "Enviar pedido",
  },
  aprovar_cancelamento: {
    titulo: "Aprovar cancelamento?",
    texto: "O agendamento será cancelado e o horário ficará disponível.",
    botao: "Aprovar cancelamento",
  },
  recusar_cancelamento: {
    titulo: "Recusar cancelamento?",
    texto: "O pedido será encerrado e o agendamento continuará ativo.",
    botao: "Recusar pedido",
  },
  retirar_cancelamento: {
    titulo: "Retirar pedido de cancelamento?",
    texto: "O pedido será retirado e o agendamento continuará ativo.",
    botao: "Retirar pedido",
  },
};

const retorno: Record<AcaoAgendamento, string> = {
  confirmar: "Confirmação registrada.",
  pedir_cancelamento: "Pedido de cancelamento enviado.",
  aprovar_cancelamento: "Agendamento cancelado.",
  recusar_cancelamento: "Pedido recusado. Agendamento mantido.",
  retirar_cancelamento: "Pedido retirado. Agendamento mantido.",
  finalizar: "Atendimento finalizado.",
};

export function AcoesAgendamento({ agendamento, lado, token, onAtualizar, somenteCancelamento = false }: {
  agendamento: AcompanhamentoAgendamento;
  lado: "cliente" | "equipe";
  token?: string;
  onAtualizar?: () => void;
  somenteCancelamento?: boolean;
}) {
  const [dialogo, setDialogo] = useState<keyof typeof dialogos | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { mutate, isPending } = useMutation({
    mutationFn: (acao: AcaoAgendamento) => gerenciarAgendamento(agendamento.id, acao, token),
    onSuccess: (_, acao) => {
      setDialogo(null);
      void queryClient.invalidateQueries({ queryKey: ["appointments"] });
      void queryClient.invalidateQueries({ queryKey: ["all-appointments"] });
      void queryClient.invalidateQueries({ queryKey: ["inicio"] });
      void queryClient.invalidateQueries({ queryKey: ["agendamentos-agenda"] });
      onAtualizar?.();
      toast({ title: retorno[acao] });
    },
    onError: (erro: Error) => {
      setDialogo(null);
      void queryClient.invalidateQueries({ queryKey: ["appointments"] });
      void queryClient.invalidateQueries({ queryKey: ["all-appointments"] });
      onAtualizar?.();
      toast({ title: "Não foi possível atualizar o agendamento", description: erro.message, variant: "destructive" });
    },
  });

  if (agendamento.status === "cancelado") {
    return agendamento.cancelamento_confirmado_em
      ? <p className="text-sm text-muted-foreground">Cancelamento aprovado por ambas as partes.</p>
      : null;
  }
  if (agendamento.status === "finalizado") return null;

  const solicitante = agendamento.cancelamento_solicitado_por;
  const solicitou = solicitante === lado;
  const confirmou = lado === "cliente" ? agendamento.cliente_confirmou_em : agendamento.equipe_confirmou_em;
  const podeConfirmar = !somenteCancelamento && agendamento.status === "pendente" && !confirmou && Date.parse(agendamento.data_hora) > Date.now();
  const detalhe = solicitante
    ? solicitou
      ? "Pedido de cancelamento aguardando a outra parte. O horário continua reservado."
      : `${solicitante === "cliente" ? "O cliente" : "A barbearia"} pediu o cancelamento. O horário continua reservado até sua decisão.`
    : !somenteCancelamento && agendamento.status === "pendente" && confirmou
      ? `Aguardando a confirmação ${lado === "cliente" ? "da barbearia" : "do cliente"}.`
      : null;
  const confirmacao = dialogo && dialogos[dialogo];

  return (
    <div className="space-y-2">
      {detalhe && <p className="text-sm text-muted-foreground">{detalhe}</p>}
      <div className="flex flex-wrap gap-2">
        {!solicitante && podeConfirmar && (
          <Button size="sm" onClick={() => mutate("confirmar")} disabled={isPending}>Confirmar horário</Button>
        )}
        {!solicitante && (
          <Button size="sm" variant="outline" onClick={() => setDialogo("pedir_cancelamento")} disabled={isPending}>Pedir cancelamento</Button>
        )}
        {solicitante && solicitou && (
          <Button size="sm" variant="outline" onClick={() => setDialogo("retirar_cancelamento")} disabled={isPending}>Retirar pedido</Button>
        )}
        {solicitante && !solicitou && (
          <>
            <Button size="sm" variant="destructive" onClick={() => setDialogo("aprovar_cancelamento")} disabled={isPending}>Aprovar cancelamento</Button>
            <Button size="sm" variant="outline" onClick={() => setDialogo("recusar_cancelamento")} disabled={isPending}>Manter horário</Button>
          </>
        )}
      </div>
      {dialogo && confirmacao && (
        <AlertDialog open onOpenChange={(open) => { if (!open && !isPending) setDialogo(null); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{confirmacao.titulo}</AlertDialogTitle>
              <AlertDialogDescription>{confirmacao.texto}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isPending}>Voltar</AlertDialogCancel>
              <AlertDialogAction disabled={isPending} onClick={(event) => { event.preventDefault(); mutate(dialogo); }}>
                {isPending ? "Atualizando..." : confirmacao.botao}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
