import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, QrCode } from "lucide-react";
import { format } from "date-fns";
import { generatePDFReceipt } from "./PDFGenerator";

interface AppointmentReceiptProps {
  appointment: {
    id: string;
    cliente_nome: string;
    cliente_telefone: string;
    cliente_email?: string;
    data_hora: string;
    status: string;
    servico?: {
      nome: string;
      valor: number;
      duracao_minutos: number;
    };
    funcionario?: {
      nome: string;
    };
    barbearia?: {
      nome: string;
      endereco?: string;
      telefone?: string;
    };
  };
}

export const AppointmentReceipt = ({ appointment }: AppointmentReceiptProps) => {
  const generatePDF = async () => {
    try {
      await generatePDFReceipt(appointment);
    } catch (error) {
      console.error('Error generating PDF receipt:', error);
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <QrCode className="h-5 w-5" />
          Comprovante de Agendamento
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex justify-between">
            <span className="text-sm font-medium">Código:</span>
            <span className="text-sm font-mono">{appointment.id.substring(0, 8).toUpperCase()}</span>
          </div>
          
          <div className="flex justify-between">
            <span className="text-sm font-medium">Cliente:</span>
            <span className="text-sm">{appointment.cliente_nome}</span>
          </div>
          
          <div className="flex justify-between">
            <span className="text-sm font-medium">Data/Hora:</span>
            <span className="text-sm">
              {format(new Date(appointment.data_hora), "dd/MM/yyyy HH:mm")}
            </span>
          </div>
          
          {appointment.servico && (
            <div className="flex justify-between">
              <span className="text-sm font-medium">Serviço:</span>
              <span className="text-sm">{appointment.servico.nome}</span>
            </div>
          )}
          
          {appointment.servico && (
            <div className="flex justify-between">
              <span className="text-sm font-medium">Valor:</span>
              <span className="text-sm">R$ {appointment.servico.valor.toFixed(2)}</span>
            </div>
          )}
          
          <div className="flex justify-between">
            <span className="text-sm font-medium">Status:</span>
            <span className="text-sm capitalize">{appointment.status}</span>
          </div>
        </div>
        
        <Button 
          onClick={generatePDF} 
          className="w-full"
          variant="outline"
        >
          <Download className="mr-2 h-4 w-4" />
          Baixar Comprovante
        </Button>
        
        <p className="text-xs text-muted-foreground text-center">
          Guarde este comprovante para apresentar no dia do agendamento.
        </p>
      </CardContent>
    </Card>
  );
};