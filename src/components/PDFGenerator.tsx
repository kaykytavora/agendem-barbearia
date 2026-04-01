import { jsPDF } from 'jspdf';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';

interface AppointmentData {
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
    logo_url?: string;
  };
}

export const generatePDFReceipt = async (appointment: AppointmentData) => {
  console.log('Gerando PDF com dados:', appointment);

  try {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    let yPosition = 20;

  // Função auxiliar para adicionar logo da barbearia
  const addBarbershopLogo = async () => {
    if (appointment.barbearia?.logo_url) {
      try {
        const img = new Image();
        img.crossOrigin = 'anonymous';

        await new Promise((resolve, reject) => {
          img.onload = () => {
            // Adicionar logo da barbearia no canto superior esquerdo
            doc.addImage(img, 'PNG', 20, yPosition, 30, 30);
            resolve(void 0);
          };
          img.onerror = reject;
          img.src = appointment.barbearia?.logo_url || '';
        });
      } catch (error) {
        console.log('Erro ao carregar logo da barbearia:', error);
      }
    }
  };

  // Adicionar logo da barbearia
  await addBarbershopLogo();

  // Header com design melhorado
  yPosition = 25;
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(41, 37, 36); // Cor escura elegante
  const title = 'COMPROVANTE DE AGENDAMENTO';
  const titleWidth = doc.getStringUnitWidth(title) * doc.getFontSize() / doc.internal.scaleFactor;
  doc.text(title, (pageWidth - titleWidth) / 2, yPosition);

  // Código do agendamento com destaque
  yPosition += 15;
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(99, 102, 241); // Cor azul moderna
  const code = `ID: ${appointment.id.substring(0, 8).toUpperCase()}`;
  const codeWidth = doc.getStringUnitWidth(code) * doc.getFontSize() / doc.internal.scaleFactor;
  doc.text(code, (pageWidth - codeWidth) / 2, yPosition);

  // Linha decorativa com gradiente visual
  yPosition += 10;
  doc.setDrawColor(99, 102, 241);
  doc.setLineWidth(1);
  doc.line(20, yPosition, 190, yPosition);

  // Linha secundária mais fina
  doc.setDrawColor(229, 231, 235);
  doc.setLineWidth(0.5);
  doc.line(20, yPosition + 2, 190, yPosition + 2);

  // Função auxiliar para criar seções com fundo
  const createSection = (title: string, yPos: number) => {
    // Fundo da seção
    doc.setFillColor(248, 249, 250);
    doc.rect(15, yPos - 5, 180, 8, 'F');

    // Título da seção
    doc.setTextColor(75, 85, 99);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(title, 20, yPos);

    return yPos + 15;
  };

  // Seção do Cliente
  yPosition += 15;
  yPosition = createSection('DADOS DO CLIENTE', yPosition);

  doc.setTextColor(41, 37, 36);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);

  doc.text(`Nome: ${appointment.cliente_nome}`, 25, yPosition);
  yPosition += 8;
  doc.text(`Telefone: ${appointment.cliente_telefone}`, 25, yPosition);
  yPosition += 8;

  if (appointment.cliente_email) {
    doc.text(`Email: ${appointment.cliente_email}`, 25, yPosition);
    yPosition += 8;
  }

  // Seção da Barbearia
  yPosition += 10;
  yPosition = createSection('DADOS DA BARBEARIA', yPosition);

  doc.text(`Nome: ${appointment.barbearia?.nome || 'Barbearia'}`, 25, yPosition);
  yPosition += 8;

  if (appointment.barbearia?.endereco) {
    doc.text(`Endereco: ${appointment.barbearia.endereco}`, 25, yPosition);
    yPosition += 8;
  }

  if (appointment.barbearia?.telefone) {
    doc.text(`Telefone: ${appointment.barbearia.telefone}`, 25, yPosition);
    yPosition += 8;
  }
  // Seção do Serviço
  yPosition += 10;
  yPosition = createSection('SERVICO AGENDADO', yPosition);

  doc.text(`Servico: ${appointment.servico?.nome || 'Servico'}`, 25, yPosition);
  yPosition += 8;

  // Valor com destaque
  doc.setTextColor(34, 197, 94); // Verde para valor
  doc.setFont('helvetica', 'bold');
  doc.text(`Valor: R$ ${appointment.servico?.valor?.toFixed(2).replace('.', ',') || '0,00'}`, 25, yPosition);
  yPosition += 8;

  doc.setTextColor(41, 37, 36);
  doc.setFont('helvetica', 'normal');
  doc.text(`Duracao: ${appointment.servico?.duracao_minutos || 0} minutos`, 25, yPosition);
  yPosition += 8;

  // Seção do Profissional
  yPosition += 10;
  yPosition = createSection('PROFISSIONAL', yPosition);

  doc.text(`Nome: ${appointment.funcionario?.nome || 'A definir'}`, 25, yPosition);
  yPosition += 8;

  // Seção de Data e Horário (destacada)
  yPosition += 10;
  yPosition = createSection('DATA E HORARIO', yPosition);

  doc.setTextColor(99, 102, 241); // Azul para destaque
  doc.setFont('helvetica', 'bold');
  doc.text(format(new Date(appointment.data_hora), "PPP 'às' HH:mm", { locale: pt }), 25, yPosition);
  yPosition += 8;

  // Status com cor condicional
  yPosition += 10;
  yPosition = createSection('STATUS', yPosition);

  const statusColor = appointment.status.toLowerCase() === 'confirmado' ? [34, 197, 94] : [239, 68, 68];
  doc.setTextColor(statusColor[0], statusColor[1], statusColor[2]);
  doc.setFont('helvetica', 'bold');
  doc.text(appointment.status.toUpperCase(), 25, yPosition);
  yPosition += 8;

  // Políticas
  yPosition += 15;
  yPosition = createSection('POLITICAS DE ATENDIMENTO', yPosition);

  doc.setTextColor(41, 37, 36);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);

  const policies = [
    '• Chegue com 10 minutos de antecedencia',
    '• Cancelamentos devem ser feitos com ate 2h de antecedencia',
    '• Em caso de atraso superior a 15 minutos, o horario podera ser reagendado'
  ];

  policies.forEach(policy => {
    doc.text(policy, 25, yPosition);
    yPosition += 7;
  });

  // Rodapé com nossa marca
  yPosition += 20;

  // Linha separadora do rodapé
  doc.setDrawColor(229, 231, 235);
  doc.setLineWidth(0.5);
  doc.line(20, yPosition, 190, yPosition);

  yPosition += 10;

  // Nossa logo e marca
  doc.setTextColor(99, 102, 241);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  const brandText = 'Powered by Agendem';
  const brandWidth = doc.getStringUnitWidth(brandText) * doc.getFontSize() / doc.internal.scaleFactor;
  doc.text(brandText, (pageWidth - brandWidth) / 2, yPosition);

  yPosition += 8;
  doc.setTextColor(107, 114, 128);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const websiteText = 'Sistema de Agendamento Profissional - agendem.com';
  const websiteWidth = doc.getStringUnitWidth(websiteText) * doc.getFontSize() / doc.internal.scaleFactor;
  doc.text(websiteText, (pageWidth - websiteWidth) / 2, yPosition);

  yPosition += 10;
  doc.setTextColor(156, 163, 175);
  doc.setFontSize(8);
  const generatedText = `Gerado em: ${format(new Date(), "PPP 'às' HH:mm", { locale: pt })}`;
  const generatedWidth = doc.getStringUnitWidth(generatedText) * doc.getFontSize() / doc.internal.scaleFactor;
  doc.text(generatedText, (pageWidth - generatedWidth) / 2, yPosition);

    // Save the PDF
    const fileName = `comprovante-agendamento-${appointment.id ? appointment.id.substring(0, 8) : 'agendamento'}.pdf`;
    console.log('Salvando PDF:', fileName);
    doc.save(fileName);
  } catch (error) {
    console.error('Erro ao gerar PDF:', error);
    throw error;
  }
};