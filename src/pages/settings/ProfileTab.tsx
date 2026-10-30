import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TabsContent } from "@/components/ui/tabs";
import { Store, Save, RefreshCw } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";

import { useSettings } from "./useBarbershopSettings";
import { ImageUploader } from "./ImageUploader";

const MAX_FOTOS = 4;

/** Aba Perfil: logo, galeria, dados e endereço da barbearia. */
export function ProfileTab() {
  const { saving, isFetchingCep, phone, handlePhoneChange, cep, handleCepChange, barbershop, setBarbershop, uploadingStates, handleBarbershopSubmit, handleImageUpload, handleImageRemove, handleCepBlur } = useSettings();

  return (
    <TabsContent value="profile">
      <Card>
        <CardHeader className="px-4 sm:px-6">
          <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
            <Store className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
            Perfil da Barbearia
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 sm:p-6">
          <form onSubmit={handleBarbershopSubmit} className="space-y-6 sm:space-y-8">

            {/* Seção de Logo e Galeria */}
            <div>
              <h3 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4 border-b pb-2">Identidade Visual</h3>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
                {/* Logo */}
                <div>
                  <Label className="text-sm sm:text-base font-medium">Logo da Barbearia</Label>
                  <p className="text-xs text-muted-foreground mb-3">Esta é a imagem principal que representa sua barbearia.</p>
                  <ImageUploader
                    type="logo"
                    imageUrl={barbershop.logo_url}
                    isUploading={uploadingStates['logo']}
                    onUpload={(file) => handleImageUpload(file, 'logo')}
                    onRemove={() => handleImageRemove('logo', barbershop.logo_url || '')}
                  />
                </div>

                {/* Galeria */}
                <div>
                  <Label className="text-sm sm:text-base font-medium">Galeria de Imagens</Label>
                  <p className="text-xs text-muted-foreground mb-3">
                    Mostre o ambiente da sua barbearia ({barbershop.gallery_urls.length} de {MAX_FOTOS} fotos). Clique numa foto para trocá-la.
                  </p>
                  <div className="grid grid-cols-2 gap-3 sm:gap-4">
                    {barbershop.gallery_urls.map((imageUrl, index) => (
                      <ImageUploader
                        key={imageUrl}
                        type="gallery"
                        imageUrl={imageUrl}
                        isUploading={uploadingStates[`gallery_${index}`]}
                        onUpload={(file) => handleImageUpload(file, "gallery", index)}
                        onRemove={() => handleImageRemove("gallery", imageUrl)}
                      />
                    ))}
                    {/* Um único espaço para adicionar: fotos novas entram no fim, na ordem em que o cliente vê */}
                    {barbershop.gallery_urls.length < MAX_FOTOS && (
                      <ImageUploader
                        type="gallery"
                        imageUrl={null}
                        isUploading={uploadingStates[`gallery_${barbershop.gallery_urls.length}`]}
                        onUpload={(file) => handleImageUpload(file, "gallery")}
                        onRemove={() => {}}
                      />
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Seção de Informações */}
            <div>
              <h3 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4 border-b pb-2">Informações Gerais</h3>
               <div className="space-y-4 sm:space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                    <div>
                      <Label htmlFor="nome" className="text-sm sm:text-base font-medium">Nome da Barbearia *</Label>
                      <Input
                        id="nome"
                        value={barbershop.nome}
                        onChange={(e) => setBarbershop(prev => ({ ...prev, nome: e.target.value }))}
                        placeholder="Nome da barbearia"
                        required
                        maxLength={100}
                        className="h-10 sm:h-11 mt-2"
                      />
                    </div>

                    <div>
                      <Label htmlFor="telefone" className="text-sm sm:text-base font-medium">Telefone</Label>
                      <Input
                        id="telefone"
                        value={phone}
                        onChange={handlePhoneChange}
                        placeholder="(11) 99999-9999"
                        className="h-10 sm:h-11 mt-2"
                      />
                      <p className="mt-1 text-xs text-muted-foreground">Vira o botão de WhatsApp na sua página.</p>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="descricao" className="text-sm sm:text-base font-medium">Descrição da Barbearia</Label>
                    <Textarea
                      id="descricao"
                      value={barbershop.descricao || ''}
                      onChange={(e) => setBarbershop(prev => ({ ...prev, descricao: e.target.value }))}
                      placeholder="Descreva sua barbearia: o ambiente, sua especialidade, etc."
                      className="mt-2 min-h-[80px] sm:min-h-[100px]"
                      maxLength={500}
                    />
                    <p className="mt-1 flex justify-between gap-2 text-xs text-muted-foreground">
                      <span>Aparece em "Sobre" na sua página e na lista de barbearias.</span>
                      <span>{barbershop.descricao.length}/500</span>
                    </p>
                  </div>

                  <div>
                    <Label htmlFor="email_contato" className="text-sm sm:text-base font-medium">E-mail de Contato</Label>
                    <Input
                      id="email_contato"
                      type="email"
                      value={barbershop.email_contato}
                      onChange={(e) => setBarbershop(prev => ({ ...prev, email_contato: e.target.value }))}
                      placeholder="contato@barbearia.com"
                      className="h-10 sm:h-11 mt-2"
                    />
                    <p className="mt-1 text-xs text-muted-foreground">Não aparece para os clientes.</p>
                  </div>
                </div>
            </div>

            {/* Seção de Endereço */}
            <div>
               <h3 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4 border-b pb-2">Endereço</h3>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
                    <div className="md:col-span-1">
                      <Label htmlFor="cep" className="text-sm sm:text-base font-medium">CEP</Label>
                      <div className="relative mt-2">
                        <Input
                          id="cep"
                          value={cep}
                          onChange={handleCepChange}
                          onBlur={(e) => handleCepBlur(e.target.value)}
                          placeholder="Apenas números"
                          className="h-10 sm:h-11"
                          disabled={isFetchingCep}
                        />
                        {isFetchingCep && (
                          <RefreshCw className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground animate-spin" />
                        )}
                      </div>
                    </div>
                    <div className="md:col-span-2">
                      <Label htmlFor="endereco" className="text-sm sm:text-base font-medium">Endereço</Label>
                      <Input
                        id="endereco"
                        value={barbershop.endereco}
                        onChange={(e) => setBarbershop(prev => ({ ...prev, endereco: e.target.value }))}
                        placeholder="Rua, número"
                        className="h-10 sm:h-11 mt-2"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                    <div>
                      <Label htmlFor="bairro" className="text-sm sm:text-base font-medium">Bairro</Label>
                      <Input
                        id="bairro"
                        value={barbershop.bairro}
                        onChange={(e) => setBarbershop(prev => ({ ...prev, bairro: e.target.value }))}
                        placeholder="Nome do bairro"
                        className="h-10 sm:h-11 mt-2"
                      />
                    </div>

                    <div>
                      <Label htmlFor="cidade" className="text-sm sm:text-base font-medium">Cidade *</Label>
                      <Input
                        id="cidade"
                        value={barbershop.cidade}
                        onChange={(e) => setBarbershop(prev => ({ ...prev, cidade: e.target.value }))}
                        placeholder="Nome da cidade"
                        required
                        className="h-10 sm:h-11 mt-2"
                      />
                    </div>
                  </div>
                </div>
            </div>

            <Button type="submit" disabled={saving} className="h-10 sm:h-11 min-w-28 sm:min-w-32 w-full sm:w-auto">
              {saving ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              <span className="text-sm sm:text-base">{saving ? "Salvando..." : "Salvar Alterações"}</span>
            </Button>
          </form>
        </CardContent>
      </Card>
    </TabsContent>
  );
}
