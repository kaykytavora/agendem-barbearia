import type { AppointmentData } from "@/components/PDFGenerator";

/**
 * Gera o comprovante em PDF. A biblioteca (jsPDF) é grande, então só é baixada
 * quando o usuário pede o comprovante, e não junto com a página.
 */
export async function generatePDFReceipt(appointment: AppointmentData) {
  const { generatePDFReceipt: gerar } = await import("@/components/PDFGenerator");
  return gerar(appointment);
}
