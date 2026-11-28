import { useState } from "react";
import { AIAssistantButton } from "@/components/ai/AIAssistantButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  MapPin, 
  Search, 
  Filter, 
  ArrowLeft,
  Loader2,
  LogOut,
  LayoutDashboard,
  User,
  Navigation,
  AlertCircle,
  Heart
} from "lucide-react";
import { BarbeariaCard } from "@/components/barbershop/BarbeariaCard";
import { useFavoritas } from "@/hooks/useFavoritas";
import { useToast } from "@/hooks/use-toast";
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
import { useBarbershopsList } from "@/hooks/useBarbershopsList";
import { chaveCidade, cidadeDaLocalizacao, correspondeBusca, proximidadeRegiao, rotuloLocal, type RegiaoCliente } from "@/lib/localizacao-barbearias";

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
  const [soFavoritas, setSoFavoritas] = useState(false);
  const { favoritas, alternar: alternarFavorita, logado } = useFavoritas();
  const { toast } = useToast();
  
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
  const temFiltros = Boolean(searchTerm.trim() || cidadeSelecionada || selectedCategories.length || soFavoritas);

  const handleLogout = async () => {
		await signOut();
		navigate("/");
	};

  // Região informada no cadastro (CEP → bairro/cidade); usada para mostrar primeiro as barbearias da região
  const regiaoCliente: RegiaoCliente | null = user?.user_metadata?.cidade
    ? { bairro: user.user_metadata.bairro, cidade: user.user_metadata.cidade }
    : null;

  const filteredShops = allBarberShops
    .filter(shop => {
      const matchesSearch = correspondeBusca(shop, searchTerm);
      const matchesCity = !cidadeSelecionada || chaveCidade(shop.cidade) === cidadeSelecionada;
      
      const matchesCategories = selectedCategories.length === 0 || 
                              selectedCategories.every(categoryId => 
                                shop.servicos.some(s => s.categoria_id === categoryId || s.categoria_id_2 === categoryId)
                              );

      const matchesFavoritas = !soFavoritas || favoritas.has(shop.id);

      return matchesSearch && matchesCity && matchesCategories && matchesFavoritas;
    })
    .sort((a, b) => {
      const regiao = proximidadeRegiao(a, regiaoCliente) - proximidadeRegiao(b, regiaoCliente);
      if (regiao !== 0) return regiao;
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
      <div className="glass-surface border-b border-border/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 sm:gap-4 min-w-0">
              <Button
                variant="ghost"
                size="icon"
                aria-label="Voltar"
                className="shrink-0"
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
                <h1 className="text-base font-bold leading-tight sm:text-2xl">
                  Barbearias Disponíveis
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

      <div className="page-enter max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {regiaoCliente && !locationFilter && (
          <p className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
            <span>Mostrando primeiro as barbearias perto de <strong className="text-foreground">{rotuloLocal(regiaoCliente.bairro ?? null, regiaoCliente.cidade ?? null)}</strong></span>
          </p>
        )}
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
              {logado && (
                <Button
                  variant={soFavoritas ? "default" : "outline"}
                  size="sm"
                  aria-pressed={soFavoritas}
                  onClick={() => setSoFavoritas((v) => !v)}
                  className="gap-2"
                >
                  <Heart className={soFavoritas ? "h-4 w-4 fill-current" : "h-4 w-4"} />
                  Favoritas{favoritas.size > 0 && ` (${favoritas.size})`}
                </Button>
              )}
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
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredShops.map((shop) => (
            <BarbeariaCard
              key={shop.id}
              shop={shop}
              favorita={favoritas.has(shop.id)}
              onFavoritar={() => {
                if (!logado) {
                  toast({ title: "Entre para salvar favoritas", description: "Faça login para guardar suas barbearias preferidas." });
                  navigate("/client-login");
                  return;
                }
                alternarFavorita(shop.id);
              }}
              onAbrir={() => shop.slug && navigate(`/barbearia/${shop.slug}`)}
            />
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
                setSoFavoritas(false);
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
