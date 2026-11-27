import { useState } from "react";
import { AIAssistantButton } from "@/components/ai/AIAssistantButton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  MapPin, 
  Star, 
  Search, 
  Filter, 
  Calendar,
  ArrowLeft,
  Clock,
  Phone,
  Loader2,
  LogOut,
  LayoutDashboard,
  User,
  Navigation,
  AlertCircle
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useGeolocation } from "@/hooks/useGeolocation";
import { resumirHorarios } from "@/lib/horarios";
import { useBarbershopsList } from "@/hooks/useBarbershopsList";
import { chaveCidade, cidadeDaLocalizacao, correspondeBusca } from "@/lib/localizacao-barbearias";

const BarberShops = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { role, loading: roleLoading } = useUserRole();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCity, setSelectedCity] = useState("");
  const { data: lista, isLoading: loading, isError: loadError, refetch } = useBarbershopsList();
  const allBarberShops = lista?.barbearias ?? [];
  const cities = lista?.cidades ?? [];
  const allCategories = lista?.categorias ?? [];
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState("name_asc");
  const [locationFilter, setLocationFilter] = useState(false);
  
  // Hook de geolocalização
  const { 
    city: detectedCity,
    error: locationError, 
    loading: locationLoading, 
    geocodingLoading,
    getCurrentLocation,
  } = useGeolocation();
  const buscandoLocalizacao = locationLoading || geocodingLoading;
  const cidadeDetectada = locationFilter ? cidadeDaLocalizacao(detectedCity, cities) : undefined;
  const cidadeSelecionada = cidadeDetectada?.chave ?? (cities.some((cidade) => cidade.chave === selectedCity) ? selectedCity : "");
  const temFiltros = Boolean(searchTerm.trim() || cidadeSelecionada || selectedCategories.length);

  const handleLogout = async () => {
		await signOut();
		navigate("/");
	};

  const filteredShops = allBarberShops
    .filter(shop => {
      const matchesSearch = correspondeBusca(shop, searchTerm);
      const matchesCity = !cidadeSelecionada || chaveCidade(shop.cidade) === cidadeSelecionada;
      
      const matchesCategories = selectedCategories.length === 0 || 
                              selectedCategories.every(categoryId => 
                                shop.servicos.some(s => s.categoria_id === categoryId || s.categoria_id_2 === categoryId)
                              );

      return matchesSearch && matchesCity && matchesCategories;
    })
    .sort((a, b) => {
      const ordem = a.nome.localeCompare(b.nome, "pt-BR");
      return sortBy === "name_desc" ? -ordem : ordem;
    });



	if (loading || roleLoading) {
		return (
			<div className="min-h-screen bg-gradient-bg flex items-center justify-center">
				<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
			</div>
		);
	}

  return (
    <div className="min-h-screen bg-gradient-bg">
      {/* Header */}
      <div className="border-b border-border/50 bg-card/30 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 sm:gap-4 min-w-0">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  if (!user) {
                    navigate("/");
                  } else if (role === "admin" || role === "funcionario") {
                    navigate("/dashboard");
                  } else {
                    navigate("/client-panel");
                  }
                }}
              >
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <div className="min-w-0">
                <h1 className="text-lg sm:text-2xl font-bold truncate">
                  Barbearias<span className="hidden sm:inline"> Disponíveis</span>
                </h1>
                <p className="hidden sm:block text-muted-foreground">
                  Encontre a barbearia ideal para você
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-4 shrink-0">
              <ThemeToggle />
              {user ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      className="relative h-10 w-10 rounded-full"
                    >
                      <Avatar className="h-10 w-10">
                        <AvatarImage
                          src={user.user_metadata?.avatar_url}
                          alt={user.user_metadata?.name || user.email}
                        />
                        <AvatarFallback>
                          {user.email?.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-56" align="end" forceMount>
                    <DropdownMenuLabel className="font-normal">
                      <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium leading-none">
                          {user.user_metadata?.name || user.email}
                        </p>
                        <p className="text-xs leading-none text-muted-foreground capitalize">
                          {role}
                        </p>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {role && ["admin", "funcionario"].includes(role) && (
                      <DropdownMenuItem onClick={() => navigate("/dashboard")}>
                        <LayoutDashboard className="mr-2 h-4 w-4" />
                        <span>Dashboard</span>
                      </DropdownMenuItem>
                    )}
                    {role === "cliente" && (
                      <DropdownMenuItem onClick={() => navigate("/client-panel")}>
                        <User className="mr-2 h-4 w-4" />
                        <span>Meu Painel</span>
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onClick={handleLogout}>
                      <LogOut className="mr-2 h-4 w-4" />
                      <span>Sair</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <Button
                  variant="outline"
                  onClick={() => navigate("/client-login")}
                >
                  Login Cliente
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {locationFilter && (
          <Alert className="mb-4">
            {buscandoLocalizacao ? <Loader2 className="h-4 w-4 animate-spin" /> : cidadeDetectada ? (
              <Navigation className="h-4 w-4" />
            ) : <AlertCircle className="h-4 w-4" />}
            <AlertDescription className="flex flex-wrap items-center gap-x-3 gap-y-1">
              {buscandoLocalizacao ? "Identificando sua cidade..." : cidadeDetectada ? (
                <span>Exibindo barbearias em <strong>{cidadeDetectada.nome}</strong></span>
              ) : (
                <span>{locationError ?? "Ainda não há barbearias cadastradas na cidade detectada."} A lista mostra todas as cidades.</span>
              )}
              {!buscandoLocalizacao && (
                <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => setLocationFilter(false)}>
                  {cidadeDetectada ? "Ver todas" : "Fechar aviso"}
                </Button>
              )}
            </AlertDescription>
          </Alert>
        )}

        {/* Filters */}
        <div className="mb-8 space-y-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Buscar por nome, bairro, cidade ou CEP"
                aria-label="Buscar por nome, bairro, cidade ou CEP"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select
                aria-label="Filtrar por cidade"
                value={cidadeSelecionada}
                onChange={(event) => {
                  setSelectedCity(event.target.value);
                  setLocationFilter(false);
                }}
                className="h-9 max-w-full rounded-full border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">Todas as cidades</option>
                {cities.map((cidade) => <option key={cidade.chave} value={cidade.chave}>{cidade.nome}</option>)}
              </select>
              <Button
                variant={cidadeDetectada ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setSelectedCity("");
                  setLocationFilter(true);
                  void getCurrentLocation();
                }}
                disabled={buscandoLocalizacao}
                className="gap-2"
              >
                <Navigation className="h-4 w-4" />
                Usar localização
              </Button>
              <Sheet>
                <SheetTrigger asChild>
              <Button variant="outline" size="sm">
                    <Filter className="w-4 h-4 mr-2" />
                Filtros
              </Button>
                </SheetTrigger>
                <SheetContent>
                  <SheetHeader>
                    <SheetTitle>Filtros Avançados</SheetTitle>
                  </SheetHeader>
                  <div className="py-4 space-y-6">
                    {/* Ordenar por */}
                    <div className="space-y-3">
                      <Label className="font-semibold">Ordenar por</Label>
                      <RadioGroup value={sortBy} onValueChange={setSortBy}>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="name_asc" id="name_asc" />
                          <Label htmlFor="name_asc">Nome (A-Z)</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="name_desc" id="name_desc" />
                          <Label htmlFor="name_desc">Nome (Z-A)</Label>
                        </div>
                      </RadioGroup>
                    </div>

                    {/* Filtrar por Categorias */}
                    <div className="space-y-3">
                      <Label className="font-semibold">Categorias de Serviço</Label>
                      <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                        {allCategories.map(category => (
                          <div key={category.id} className="flex items-center space-x-2">
                            <Checkbox
                              id={`category-${category.id}`}
                              checked={selectedCategories.includes(category.id)}
                              onCheckedChange={(checked) => {
                                setSelectedCategories(prev => 
                                  checked 
                                    ? [...prev, category.id]
                                    : prev.filter(id => id !== category.id)
                                )
                              }}
                            />
                            <Label htmlFor={`category-${category.id}`} className="font-normal">
                              {category.nome}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </div>

        {/* Results */}
        {/* Layout para Desktop/Tablet */}
        <div className="hidden md:grid md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredShops.map((shop) => (
            <Card key={shop.id} className="border-border/50 bg-card/50 backdrop-blur-sm hover:shadow-brand-md transition-all duration-300 overflow-hidden">
              <div className="aspect-square bg-muted/50 relative">
                <img 
                  src={shop.logo_url || '/placeholder.svg'} 
                  alt={shop.nome}
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-3 right-3">
                  <Badge variant="secondary" className="bg-background/90 text-foreground">
                    <Star className="w-3 h-3 mr-1 fill-yellow-400 text-yellow-400" />
                    {shop.rating && shop.rating > 0 ? shop.rating.toFixed(1) : 'S/A'}
                  </Badge>
                </div>
              </div>
              
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{shop.nome}</CardTitle>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <MapPin className="w-4 h-4" />
                    {shop.cidade || "Cidade não informada"}
                  </div>
                </div>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    {resumirHorarios(shop.horarios_funcionamento)?.horas ?? "Horário não informado"}
                  </div>
                  {shop.telefone && (
                    <div className="flex items-center gap-1">
                      <Phone className="w-4 h-4" />
                      {shop.telefone}
                    </div>
                  )}
                </div>
              </CardHeader>
              
              <CardContent className="pt-0">
                 <p className="text-xs text-muted-foreground mb-3 h-8 overflow-hidden">
                   {shop.descricao || 'Esta barbearia ainda não adicionou uma descrição.'}
                 </p>
                
                <div className="flex gap-2">
                  <Button 
                    variant="premium" 
                    className="flex-1"
                    onClick={() => {
                      if (!shop.slug) {
                        console.error('[NAVIGATION ERROR] Slug is null/undefined for:', shop.nome);
                        return;
                      }
                      navigate(`/barbearia/${shop.slug}`);
                    }}
                  >
                    <Calendar className="w-4 h-4 mr-2" />
                    Ver Agenda
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Layout para Mobile - Cards horizontais compactos */}
        <div className="md:hidden space-y-4">
          {filteredShops.map((shop) => (
            <Card 
              key={shop.id} 
              className="border-border/50 bg-card/50 backdrop-blur-sm hover:shadow-brand-md transition-all duration-300 overflow-hidden cursor-pointer"
              onClick={() => {
                if (!shop.slug) {
                  console.error('[NAVIGATION ERROR] Slug is null/undefined for:', shop.nome);
                  return;
                }
                navigate(`/barbearia/${shop.slug}`);
              }}
            >
              <div className="flex">
                {/* Imagem da barbearia */}
                <div className="w-20 h-20 bg-muted/50 relative flex-shrink-0 rounded-l-lg overflow-hidden">
                  <img 
                    src={shop.logo_url || '/placeholder.svg'} 
                    alt={shop.nome}
                    className="w-full h-full object-cover"
                  />
                </div>
                
                {/* Conteúdo */}
                <div className="flex-1 p-4 min-w-0">
                  <div className="flex items-start justify-between mb-2">
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold text-base truncate">{shop.nome}</h3>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                        <MapPin className="w-3 h-3 flex-shrink-0" />
                        <span className="truncate">{shop.cidade || "Cidade não informada"}</span>
                      </div>
                    </div>
                    <Badge variant="secondary" className="bg-background/90 text-foreground ml-2 flex-shrink-0">
                      <Star className="w-3 h-3 mr-1 fill-yellow-400 text-yellow-400" />
                      {shop.rating && shop.rating > 0 ? shop.rating.toFixed(1) : 'S/A'}
                    </Badge>
                  </div>
                  
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mb-2">
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      <span>{resumirHorarios(shop.horarios_funcionamento)?.horas ?? "Horário não informado"}</span>
                    </div>
                    {shop.telefone && (
                      <div className="flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        <span className="truncate">{shop.telefone}</span>
                      </div>
                    )}
                  </div>
                  
                   <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                     {shop.descricao || 'Esta barbearia ainda não adicionou uma descrição.'}
                   </p>
                </div>
              </div>
            </Card>
          ))}
         </div>

        {loadError ? (
          <div className="flex flex-col items-center gap-3 text-center py-12">
            <p className="text-muted-foreground">Não foi possível carregar as barbearias.</p>
            <Button variant="outline" onClick={() => refetch()}>
              Tentar novamente
            </Button>
          </div>
        ) : filteredShops.length === 0 && (
          <div className="space-y-3 text-center py-12">
            <p className="text-muted-foreground">
              {temFiltros ? "Nenhuma barbearia encontrada com esses filtros." : "Nenhuma barbearia disponível no momento."}
            </p>
            {temFiltros && (
              <Button variant="outline" onClick={() => {
                setSearchTerm("");
                setSelectedCity("");
                setLocationFilter(false);
                setSelectedCategories([]);
              }}>
                Limpar filtros
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Botão flutuante do Assistente IA */}
      <AIAssistantButton />
    </div>
  );
};

export default BarberShops;
