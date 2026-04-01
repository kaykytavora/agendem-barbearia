// src/components/FeedbackModal.tsx
import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';

import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Star, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface FeedbackModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  feedbackId: string;
  barbeariaNome: string;
  onFeedbackSubmitted: () => void;
}

export const FeedbackModal = ({
  isOpen,
  onOpenChange,
  feedbackId,
  barbeariaNome,
  onFeedbackSubmitted,
}: FeedbackModalProps) => {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async () => {
    if (rating === 0) {
      toast({
        title: 'Avaliação incompleta',
        description: 'Por favor, selecione pelo menos uma estrela.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      // Verificar se o usuário está autenticado
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session) {
        toast({
          title: 'Erro de autenticação',
          description: 'Você precisa estar logado para enviar uma avaliação.',
          variant: 'destructive',
        });
        return;
      }

      // Primeiro, buscar os dados do feedback para obter o agendamento_id
      const { data: feedbackData, error: feedbackError } = await supabase
        .from('feedbacks')
        .select('agendamento_id')
        .eq('id', feedbackId)
        .single();

      if (feedbackError) {
        console.error('Erro ao buscar dados do feedback:', feedbackError);
        throw new Error('Não foi possível encontrar os dados da avaliação.');
      }

      // Atualizar o feedback com a avaliação
      const { error: updateError } = await supabase
        .from('feedbacks')
        .update({
          rating: rating,
          comment: comment,
          anonimo: isAnonymous,
          status: 'concluido',
        })
        .eq('id', feedbackId);

      if (updateError) {
        console.error('Erro ao atualizar feedback:', updateError);
        throw updateError;
      }

      // Tentar atualizar o agendamento para marcar como avaliado
      // (se a coluna 'avaliado' existir no banco)
      try {
        const { error: appointmentError } = await supabase
          .from('agendamentos')
          .update({
            avaliado: true
          })
          .eq('id', feedbackData.agendamento_id);

        if (appointmentError) {
          console.warn('Aviso: Não foi possível marcar agendamento como avaliado (coluna pode não existir ainda):', appointmentError);
          // Não falha aqui pois o feedback já foi salvo
        }
      } catch (error) {
        console.warn('Aviso: Coluna avaliado pode não existir ainda na tabela agendamentos:', error);
        // Não falha a operação principal
      }

      toast({
        title: 'Avaliação enviada!',
        description: `Obrigado por avaliar a ${barbeariaNome}.`,
      });
      onFeedbackSubmitted(); // Callback para atualizar a lista
      onOpenChange(false); // Fecha o modal
    } catch (error: unknown) {
      console.error('Erro no processo de avaliação:', error);
      toast({
        title: 'Erro ao enviar avaliação',
        description: error instanceof Error ? error.message : 'Tente novamente mais tarde.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Avalie sua experiência</AlertDialogTitle>
          <AlertDialogDescription>
            Sua opinião é muito importante para a barbearia {barbeariaNome}.
          </AlertDialogDescription>
        </AlertDialogHeader>
        
        <div className="py-4 space-y-4">
          <div className="flex justify-center items-center gap-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <Star
                key={star}
                className={`w-8 h-8 cursor-pointer transition-all ${
                  rating >= star
                    ? 'text-yellow-400 fill-yellow-400'
                    : 'text-muted-foreground hover:text-yellow-300'
                }`}
                onClick={() => setRating(star)}
              />
            ))}
          </div>
          <Textarea
            placeholder="Deixe um comentário (opcional)..."
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={4}
          />

          <div className="flex items-center space-x-2">
            <Checkbox
              id="anonymous"
              checked={isAnonymous}
              onCheckedChange={(checked) => setIsAnonymous(checked as boolean)}
            />
            <label
              htmlFor="anonymous"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Enviar avaliação anonimamente
            </label>
          </div>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Enviar Avaliação
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};