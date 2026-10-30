import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2 } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

import { useSettings } from "./useBarbershopSettings";

/** Zona de perigo: exclusão da barbearia. */
export function DangerZoneCard() {
  const { deleteConfirmationText, setDeleteConfirmationText, isDeleting, handleDeleteBarbershop } = useSettings();

  return (
    <Card className="border-destructive/50 bg-destructive/5 backdrop-blur-sm shadow-md mt-4 sm:mt-6">
      <CardHeader className="p-4 sm:p-6">
        <CardTitle className="flex items-center gap-2 text-destructive text-base sm:text-lg">
          <Trash2 className="w-4 h-4 sm:w-5 sm:h-5" />
          Zona de Perigo
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex-1">
            <p className="font-semibold text-sm sm:text-base">Excluir esta barbearia</p>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              Esta ação é irreversível. Todos os dados, incluindo agendamentos, clientes e funcionários, serão perdidos.
            </p>
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" className="h-9 sm:h-10 text-xs sm:text-sm px-3 sm:px-4 w-full sm:w-auto">Excluir Barbearia</Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="max-w-sm sm:max-w-lg">
              <AlertDialogHeader>
                <AlertDialogTitle className="text-base sm:text-lg">Você tem certeza absoluta?</AlertDialogTitle>
                <AlertDialogDescription className="text-xs sm:text-sm">
                  Esta ação não pode ser desfeita. Para confirmar, digite{" "}
                  <strong className="text-destructive">DELETAR</strong> no campo abaixo.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="my-3 sm:my-4">
                <Input
                  value={deleteConfirmationText}
                  onChange={(e) => setDeleteConfirmationText(e.target.value)}
                  placeholder="DELETAR"
                  className="border-destructive/50 focus:border-destructive h-8 sm:h-9 text-xs sm:text-sm"
                />
              </div>
              <AlertDialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
                <AlertDialogCancel className="h-8 sm:h-9 text-xs sm:text-sm w-full sm:w-auto">Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDeleteBarbershop}
                  disabled={deleteConfirmationText !== 'DELETAR' || isDeleting}
                  className="bg-destructive hover:bg-destructive/90 h-8 sm:h-9 text-xs sm:text-sm w-full sm:w-auto"
                >
                  {isDeleting ? "Excluindo..." : "Eu entendo, excluir esta barbearia"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardContent>
    </Card>
  );
}
