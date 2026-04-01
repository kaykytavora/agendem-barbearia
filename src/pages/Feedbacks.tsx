import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Star, Calendar, User, TrendingUp, BarChart3, Reply, Send } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { DashboardLayout } from "@/layouts/DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

interface Feedback {
  id: string;
  rating: number | null;
  comment: string | null;
  created_at: string;
  response?: string | null;
  response_created_at?: string | null;
  responded_by?: string | null;
  profiles: {
    name: string;
  } | null;
  responder?: {
    name: string;
  } | null;
}

export default function Feedbacks() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("todos");
  const [stats, setStats] = useState({
    total: 0,
    media: 0,
    excelentes: 0,
    bons: 0,
    regulares: 0,
    ruins: 0
  });
  const [responseText, setResponseText] = useState<string>("");
  const [respondingTo, setRespondingTo] = useState<string | null>(null);
  const [submittingResponse, setSubmittingResponse] = useState(false);

  const loadFeedbacks = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);

      // 1. Obter o ID da barbearia do funcionário
      const { data: barbeariaId, error: rpcError } = await supabase.rpc(
        "get_user_barbearia_id",
        { user_uuid: user.id }
      );

      if (rpcError || !barbeariaId) {
        toast({
          title: "Aviso",
          description: "Você não está associado a uma barbearia.",
          variant: "destructive",
        });
        setFeedbacks([]);
        setLoading(false);
        return;
      }

      // 2. Buscar feedbacks da barbearia específica
      const { data, error } = await supabase
        .from('feedbacks')
        .select(`
          *,
          profiles!feedbacks_user_id_fkey (
            id,
            name
          ),
          responder:profiles!feedbacks_responded_by_fkey (
            name
          )
        `)
        .eq('barbearia_id', barbeariaId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setFeedbacks(data || []);
      calculateStats(data || []);

    } catch (error: unknown) {
      console.error('Erro ao carregar feedbacks:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar feedbacks",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }, [user, toast]);

  useEffect(() => {
    loadFeedbacks();
  }, [user, loadFeedbacks]);

  const calculateStats = (feedbacksData: Feedback[]) => {
    const total = feedbacksData.length;
    const validRatings = feedbacksData.filter(f => f.rating !== null).map(f => f.rating!);
    const soma = validRatings.reduce((acc, rating) => acc + rating, 0);
    const media = validRatings.length > 0 ? soma / validRatings.length : 0;
    
    const excelentes = feedbacksData.filter(f => f.rating !== null && f.rating >= 4.5).length;
    const bons = feedbacksData.filter(f => f.rating !== null && f.rating >= 3.5 && f.rating < 4.5).length;
    const regulares = feedbacksData.filter(f => f.rating !== null && f.rating >= 2.5 && f.rating < 3.5).length;
    const ruins = feedbacksData.filter(f => f.rating !== null && f.rating < 2.5).length;

    setStats({ total, media, excelentes, bons, regulares, ruins });
  };

  const filteredFeedbacks = feedbacks.filter(feedback => {
    if (feedback.rating === null) return filter === "todos";
    
    switch (filter) {
      case "excelentes":
        return feedback.rating >= 4.5;
      case "bons":
        return feedback.rating >= 3.5 && feedback.rating < 4.5;
      case "regulares":
        return feedback.rating >= 2.5 && feedback.rating < 3.5;
      case "ruins":
        return feedback.rating < 2.5;
      default:
        return true;
    }
  });

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        className={`w-4 h-4 ${
          i < Math.floor(rating)
            ? "fill-yellow-400 text-yellow-400"
            : i < rating
            ? "fill-yellow-200 text-yellow-200"
            : "text-gray-300"
        }`}
      />
    ));
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getScoreColor = (score: number) => {
    if (score >= 4.5) return "text-green-500";
    if (score >= 3.5) return "text-blue-500";
    if (score >= 2.5) return "text-yellow-500";
    return "text-red-500";
  };

  const handleSubmitResponse = async (feedbackId: string) => {
    if (!responseText.trim() || !user) return;

    try {
      setSubmittingResponse(true);

      // Verificar se o usuário está autenticado
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session) {
        toast({
          title: "Erro de autenticação",
          description: "Você precisa estar logado para responder feedbacks.",
          variant: "destructive",
        });
        return;
      }

      const { error } = await supabase
        .from('feedbacks')
        .update({
          response: responseText.trim(),
          response_created_at: new Date().toISOString(),
          responded_by: user.id
        })
        .eq('id', feedbackId);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Resposta enviada com sucesso!",
      });

      // Recarregar feedbacks para mostrar a resposta
      await loadFeedbacks();
      
      // Limpar estado
      setResponseText("");
      setRespondingTo(null);

    } catch (error: unknown) {
      console.error('Erro ao enviar resposta:', error);
      toast({
        title: "Erro",
        description: "Erro ao enviar resposta. Tente novamente.",
        variant: "destructive"
      });
    } finally {
      setSubmittingResponse(false);
    }
  };

  const openResponseDialog = (feedbackId: string) => {
    setRespondingTo(feedbackId);
    setResponseText("");
  };

  const closeResponseDialog = () => {
    setRespondingTo(null);
    setResponseText("");
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-96">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-4 sm:space-y-6 p-4 sm:p-6 max-w-full overflow-x-hidden">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
              <MessageSquare className="w-6 h-6 sm:w-8 sm:h-8 text-primary" />
              Feedbacks dos Clientes
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground">
              Acompanhe a satisfação dos seus clientes
            </p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 xs:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 w-full">
          <Card className="border-border/50 bg-card/50 backdrop-blur-sm min-w-0">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-xs sm:text-sm text-muted-foreground truncate">Total</p>
                  <p className="text-lg sm:text-2xl font-bold">{stats.total}</p>
                </div>
                <MessageSquare className="w-6 h-6 sm:w-8 sm:h-8 text-primary flex-shrink-0" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50 bg-card/50 backdrop-blur-sm min-w-0 col-span-1 xs:col-span-2 md:col-span-1">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-xs sm:text-sm text-muted-foreground truncate">Média</p>
                  <div className="flex items-center gap-1 sm:gap-2 flex-wrap">
                    <p className={`text-lg sm:text-2xl font-bold ${getScoreColor(stats.media)}`}>
                      {stats.media.toFixed(1)}
                    </p>
                    <div className="flex flex-shrink-0">
                      {renderStars(stats.media)}
                    </div>
                  </div>
                </div>
                <TrendingUp className="w-6 h-6 sm:w-8 sm:h-8 text-green-500 flex-shrink-0" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50 bg-card/50 backdrop-blur-sm min-w-0">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-xs sm:text-sm text-muted-foreground truncate">Excelentes</p>
                  <p className="text-lg sm:text-2xl font-bold text-green-500">{stats.excelentes}</p>
                </div>
                <div className="flex flex-shrink-0">
                  {renderStars(5)}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50 bg-card/50 backdrop-blur-sm min-w-0">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-xs sm:text-sm text-muted-foreground truncate">Bons</p>
                  <p className="text-lg sm:text-2xl font-bold text-blue-500">{stats.bons}</p>
                </div>
                <div className="flex flex-shrink-0">
                  {renderStars(4)}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50 bg-card/50 backdrop-blur-sm min-w-0">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-xs sm:text-sm text-muted-foreground truncate">A melhorar</p>
                  <p className="text-lg sm:text-2xl font-bold text-yellow-500">{stats.regulares + stats.ruins}</p>
                </div>
                <BarChart3 className="w-6 h-6 sm:w-8 sm:h-8 text-yellow-500 flex-shrink-0" />
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="lista" className="space-y-4 sm:space-y-6 w-full">
          <div className="flex flex-col gap-4">
            <div className="overflow-x-auto">
              <TabsList className="w-full sm:w-auto">
                <TabsTrigger value="lista" className="text-sm sm:text-base flex-1 sm:flex-none whitespace-nowrap">Lista de Feedbacks</TabsTrigger>
                <TabsTrigger value="analytics" className="text-sm sm:text-base flex-1 sm:flex-none whitespace-nowrap">Analytics</TabsTrigger>
              </TabsList>
            </div>

            <div className="w-full">
              <Select value={filter} onValueChange={setFilter}>
                <SelectTrigger className="w-full sm:max-w-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="excelentes">Excelentes (4.5+)</SelectItem>
                  <SelectItem value="bons">Bons (3.5-4.4)</SelectItem>
                  <SelectItem value="regulares">Regulares (2.5-3.4)</SelectItem>
                  <SelectItem value="ruins">Ruins (&lt;2.5)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <TabsContent value="lista" className="space-y-3 sm:space-y-4">
            {filteredFeedbacks.length === 0 ? (
              <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
                <CardContent className="flex flex-col items-center justify-center py-12 sm:py-16 px-4">
                  <MessageSquare className="w-12 h-12 sm:w-16 sm:h-16 text-muted-foreground mb-4" />
                  <h3 className="text-base sm:text-lg font-semibold mb-2 text-center">Nenhum feedback encontrado</h3>
                  <p className="text-sm sm:text-base text-muted-foreground text-center max-w-md">
                    {filter === "todos" 
                      ? "Ainda não há feedbacks dos clientes. Quando os clientes avaliarem os serviços, aparecerão aqui."
                      : "Nenhum feedback encontrado com o filtro selecionado."
                    }
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-3 sm:gap-4 w-full">
                {filteredFeedbacks.map((feedback) => (
                  <Card key={feedback.id} className="border-border/50 bg-card/50 backdrop-blur-sm hover:shadow-brand-md transition-all min-w-0">
                    <CardContent className="p-4 sm:p-6">
                      <div className="flex flex-col gap-3 mb-4">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-primary rounded-full flex items-center justify-center flex-shrink-0">
                            <User className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <h4 className="text-sm sm:text-base font-semibold truncate">{feedback.profiles?.name || 'Cliente Anônimo'}</h4>
                            <p className="text-xs sm:text-sm text-muted-foreground flex items-center gap-1">
                              <Calendar className="w-3 h-3 flex-shrink-0" />
                              <span className="truncate">{formatDate(feedback.created_at)}</span>
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1">
                            {renderStars(feedback.rating || 0)}
                          </div>
                          <Badge
                            variant={feedback.rating && feedback.rating >= 4.5 ? "default" :
                                   feedback.rating && feedback.rating >= 3.5 ? "secondary" :
                                   feedback.rating && feedback.rating >= 2.5 ? "outline" : "destructive"}
                            className="text-xs whitespace-nowrap"
                          >
                            {feedback.rating ? feedback.rating.toFixed(1) : '0.0'} estrelas
                          </Badge>
                        </div>
                      </div>
                      
                      {feedback.comment && (
                        <div className="bg-muted/30 rounded-lg p-3 sm:p-4 mb-4 w-full overflow-hidden">
                          <p className="text-xs sm:text-sm leading-relaxed break-words">"{feedback.comment}"</p>
                        </div>
                      )}

                      {/* Seção de Resposta */}
                      {feedback.response ? (
                        <div className="bg-blue-50 dark:bg-blue-950/20 rounded-lg p-3 sm:p-4 border-l-4 border-blue-500 w-full overflow-hidden">
                          <div className="flex flex-col gap-2 mb-2">
                            <div className="flex items-center gap-2">
                              <Reply className="w-4 h-4 text-blue-500 flex-shrink-0" />
                              <span className="text-xs sm:text-sm font-medium text-blue-700 dark:text-blue-300">
                                Resposta da Barbearia
                              </span>
                            </div>
                            {feedback.responder?.name && (
                              <span className="text-xs text-muted-foreground truncate">
                                por {feedback.responder.name}
                              </span>
                            )}
                          </div>
                          <p className="text-xs sm:text-sm text-blue-800 dark:text-blue-200 leading-relaxed break-words">
                            {feedback.response}
                          </p>
                          {feedback.response_created_at && (
                            <p className="text-xs text-blue-600 dark:text-blue-400 mt-2">
                              {formatDate(feedback.response_created_at)}
                            </p>
                          )}
                        </div>
                      ) : (
                        <div className="flex justify-end pt-2">
                          <Dialog open={respondingTo === feedback.id} onOpenChange={(open) => !open && closeResponseDialog()}>
                            <DialogTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openResponseDialog(feedback.id)}
                                className="flex items-center gap-2 text-xs sm:text-sm"
                              >
                                <Reply className="w-4 h-4 flex-shrink-0" />
                                <span className="whitespace-nowrap">Responder</span>
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="w-[calc(100vw-2rem)] max-w-md mx-auto">
                              <DialogHeader>
                                <DialogTitle className="text-base sm:text-lg pr-6">Responder Feedback</DialogTitle>
                                <DialogDescription className="text-xs sm:text-sm pr-6">
                                  Responda ao feedback de {feedback.profiles?.name || 'Cliente Anônimo'}.
                                  Esta resposta será visível para o cliente.
                                </DialogDescription>
                              </DialogHeader>
                              <div className="space-y-4">
                                <div className="bg-muted/50 rounded-lg p-3 overflow-hidden">
                                  <div className="flex items-center gap-1 mb-1 flex-wrap">
                                    {renderStars(feedback.rating || 0)}
                                  </div>
                                  <p className="text-xs sm:text-sm break-words">"{feedback.comment}"</p>
                                </div>
                                <Textarea
                                  placeholder="Digite sua resposta..."
                                  value={responseText}
                                  onChange={(e) => setResponseText(e.target.value)}
                                  className="min-h-[80px] sm:min-h-[100px] text-sm resize-none"
                                />
                              </div>
                              <DialogFooter className="flex flex-col sm:flex-row gap-2">
                                <Button variant="outline" onClick={closeResponseDialog} className="w-full sm:w-auto text-sm">
                                  Cancelar
                                </Button>
                                <Button
                                  onClick={() => handleSubmitResponse(feedback.id)}
                                  disabled={!responseText.trim() || submittingResponse}
                                  className="flex items-center gap-2 w-full sm:w-auto text-sm"
                                >
                                  {submittingResponse ? (
                                    <>
                                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin flex-shrink-0" />
                                      <span>Enviando...</span>
                                    </>
                                  ) : (
                                    <>
                                      <Send className="w-4 h-4 flex-shrink-0" />
                                      <span>Enviar Resposta</span>
                                    </>
                                  )}
                                </Button>
                              </DialogFooter>
                            </DialogContent>
                          </Dialog>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="analytics" className="w-full">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full">
              <Card className="border-border/50 bg-card/50 backdrop-blur-sm min-w-0">
                <CardHeader>
                  <CardTitle className="text-base sm:text-lg">Distribuição das Avaliações</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <div className="flex flex-shrink-0">{renderStars(5)}</div>
                        <span className="text-sm truncate">Excelente</span>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <div className="w-16 sm:w-24 bg-muted rounded-full h-2">
                          <div
                            className="bg-green-500 h-2 rounded-full"
                            style={{ width: `${stats.total > 0 ? (stats.excelentes / stats.total) * 100 : 0}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium w-6 sm:w-8 text-right">{stats.excelentes}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <div className="flex flex-shrink-0">{renderStars(4)}</div>
                        <span className="text-sm truncate">Bom</span>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <div className="w-16 sm:w-24 bg-muted rounded-full h-2">
                          <div
                            className="bg-blue-500 h-2 rounded-full"
                            style={{ width: `${stats.total > 0 ? (stats.bons / stats.total) * 100 : 0}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium w-6 sm:w-8 text-right">{stats.bons}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <div className="flex flex-shrink-0">{renderStars(3)}</div>
                        <span className="text-sm truncate">Regular</span>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <div className="w-16 sm:w-24 bg-muted rounded-full h-2">
                          <div
                            className="bg-yellow-500 h-2 rounded-full"
                            style={{ width: `${stats.total > 0 ? (stats.regulares / stats.total) * 100 : 0}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium w-6 sm:w-8 text-right">{stats.regulares}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <div className="flex flex-shrink-0">{renderStars(2)}</div>
                        <span className="text-sm truncate">Ruim</span>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <div className="w-16 sm:w-24 bg-muted rounded-full h-2">
                          <div
                            className="bg-red-500 h-2 rounded-full"
                            style={{ width: `${stats.total > 0 ? (stats.ruins / stats.total) * 100 : 0}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium w-6 sm:w-8 text-right">{stats.ruins}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border/50 bg-card/50 backdrop-blur-sm min-w-0">
                <CardHeader>
                  <CardTitle className="text-base sm:text-lg">Resumo de Satisfação</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="text-center">
                    <div className="text-3xl sm:text-4xl font-bold text-primary mb-2">
                      {stats.media.toFixed(1)}
                    </div>
                    <div className="flex justify-center mb-2">
                      {renderStars(stats.media)}
                    </div>
                    <p className="text-muted-foreground text-sm">
                      Baseado em {stats.total} avaliações
                    </p>
                  </div>

                  <div className="space-y-3 pt-4 border-t">
                    <div className="flex justify-between items-center gap-2">
                      <span className="text-sm truncate">Clientes Satisfeitos</span>
                      <span className="font-medium text-green-500 whitespace-nowrap">
                        {stats.total > 0 ? Math.round(((stats.excelentes + stats.bons) / stats.total) * 100) : 0}%
                      </span>
                    </div>
                    <div className="flex justify-between items-center gap-2">
                      <span className="text-sm truncate">Precisa Melhorar</span>
                      <span className="font-medium text-yellow-500 whitespace-nowrap">
                        {stats.total > 0 ? Math.round(((stats.regulares + stats.ruins) / stats.total) * 100) : 0}%
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}