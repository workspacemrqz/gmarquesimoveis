import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Mail, Phone, Clock, MapPin, Send } from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { useState } from "react";
import { PhoneInput } from "@/components/ui/masked-input";
import { useSettings } from "@/hooks/useSettings";
import { formatPhone } from "@/lib/utils";
import { motion } from "framer-motion";

export default function Contact() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const { companyPhone, companyEmail, companyAddress, mapUrl } = useSettings();

  // Função para converter URL do Google Maps em URL de embed
  const getEmbedUrl = (url: string | undefined): string | null => {
    if (!url) return null;
    
    // Remove espaços em branco
    url = url.trim();
    
    // Se já é uma URL de embed, retorna como está
    if (url.includes('/maps/embed') || url.includes('output=embed')) {
      return url;
    }
    
    try {
      // Se é um iframe HTML completo, extrai a URL src
      if (url.includes('<iframe')) {
        const srcMatch = url.match(/src="([^"]+)"/);
        if (srcMatch) {
          return srcMatch[1];
        }
      }
      
      // Para URLs do Google Maps compartilhadas
      if (url.includes('google.com') && url.includes('/maps')) {
        // Extrair coordenadas da URL (formato @lat,lng,zoom)
        const coordMatch = url.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/);
        if (coordMatch) {
          const lat = coordMatch[1];
          const lng = coordMatch[2];
          return `https://maps.google.com/maps?q=${lat},${lng}&output=embed&z=15`;
        }
        
        // Extrair nome do lugar da URL (formato /place/Nome+do+Lugar/)
        const placeMatch = url.match(/\/place\/([^\/\?@]+)/);
        if (placeMatch) {
          const placeName = decodeURIComponent(placeMatch[1]).replace(/\+/g, ' ');
          return `https://maps.google.com/maps?q=${encodeURIComponent(placeName)}&output=embed`;
        }
        
        // Extrair query de busca (formato ?q=)
        const searchMatch = url.match(/[?&]q=([^&]+)/);
        if (searchMatch) {
          const query = decodeURIComponent(searchMatch[1]);
          return `https://maps.google.com/maps?q=${encodeURIComponent(query)}&output=embed`;
        }
      }
      
      // Para URLs encurtadas do Google Maps
      if (url.includes('maps.app.goo.gl') || url.includes('goo.gl/maps')) {
        // Usa o endereço da empresa como fallback
        return `https://maps.google.com/maps?q=${encodeURIComponent(companyAddress)}&output=embed`;
      }
      
      // Se começa com http mas não conseguiu processar, usa o endereço da empresa
      if (url.startsWith('http')) {
        return `https://maps.google.com/maps?q=${encodeURIComponent(companyAddress)}&output=embed`;
      }
      
      // Se não é uma URL, assume que é um endereço ou query direto
      return `https://maps.google.com/maps?q=${encodeURIComponent(url)}&output=embed`;
    } catch {
      return null;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setName("");
      setEmail("");
      setPhone("");
      setMessage("");
    } catch (error) {
      // Error sending message - no notification
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      
      <div className="flex-1">
        <div className="container mx-auto max-w-7xl px-4 py-8">
          <div className="py-8">
            <div className="max-w-6xl mx-auto">
              <div className="grid md:grid-cols-2 gap-8">
                <motion.div
                  initial={{ opacity: 0, x: -30 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                >
                  <div className="space-y-3">
                  <Card className="group hover-elevate active-elevate-2 transition-all duration-300 shadow-md border-0 overflow-hidden" data-testid="card-contact-info-phone">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-primary/10 to-transparent rounded-bl-full"></div>
                    <CardContent className="p-6 relative">
                      <div className="flex items-start gap-4">
                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary via-primary/80 to-primary/60 flex items-center justify-center flex-shrink-0 shadow-lg transform group-hover:scale-110 group-hover:rotate-3 transition-all duration-500">
                          <Phone className="h-8 w-8 text-white" />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-bold text-xl mb-2 group-hover:text-primary transition-colors duration-300">Telefone</h3>
                          <p className="text-muted-foreground mb-2">Ligue para nós</p>
                          <a href={`tel:${companyPhone.replace(/\D/g, '')}`} className="text-accent font-semibold hover:underline text-lg">
                            {formatPhone(companyPhone)}
                          </a>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="group hover-elevate active-elevate-2 transition-all duration-300 shadow-md border-0 overflow-hidden" data-testid="card-contact-info-email">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-primary/10 to-transparent rounded-bl-full"></div>
                    <CardContent className="p-6 relative">
                      <div className="flex items-start gap-4">
                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary via-primary/80 to-primary/60 flex items-center justify-center flex-shrink-0 shadow-lg transform group-hover:scale-110 group-hover:rotate-3 transition-all duration-500">
                          <Mail className="h-8 w-8 text-white" />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-bold text-xl mb-2 group-hover:text-primary transition-colors duration-300">E-mail</h3>
                          <p className="text-muted-foreground mb-2">Envie uma mensagem</p>
                          <a href={`mailto:${companyEmail}`} className="text-accent font-semibold hover:underline text-lg break-all">
                            {companyEmail}
                          </a>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="group hover-elevate active-elevate-2 transition-all duration-300 shadow-md border-0 overflow-hidden" data-testid="card-contact-info-address">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-primary/10 to-transparent rounded-bl-full"></div>
                    <CardContent className="p-6 relative">
                      <div className="flex items-start gap-4">
                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary via-primary/80 to-primary/60 flex items-center justify-center flex-shrink-0 shadow-lg transform group-hover:scale-110 group-hover:rotate-3 transition-all duration-500">
                          <MapPin className="h-8 w-8 text-white" />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-bold text-xl mb-2 group-hover:text-primary transition-colors duration-300">Localização</h3>
                          <p className="text-muted-foreground mb-2">Visite nosso escritório</p>
                          <p className="text-accent font-semibold text-lg">{companyAddress}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  </div>

                  {/* Mapa do Google Maps */}
                  {mapUrl && getEmbedUrl(mapUrl) && (
                    <Card className="mt-4 shadow-lg border-0 overflow-hidden" data-testid="card-google-maps">
                      <CardContent className="p-0">
                        <div className="relative w-full h-[400px] md:h-[450px]">
                          <iframe
                            src={getEmbedUrl(mapUrl)!}
                            width="100%"
                            height="100%"
                            style={{ border: 0 }}
                            allowFullScreen
                            loading="lazy"
                            referrerPolicy="no-referrer-when-downgrade"
                            title="Localização no Google Maps"
                            className="w-full h-full"
                            data-testid="iframe-google-maps"
                          />
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, x: 30 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
                >
                  <Card className="shadow-lg border-0 overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-accent/10 via-primary/10 to-transparent rounded-bl-full"></div>
                  <CardContent className="p-8 relative">
                    <h3 className="text-2xl md:text-3xl font-bold mb-6" style={{ color: '#060606' }}>
                      Envie uma Mensagem
                    </h3>
                    <form onSubmit={handleSubmit} className="space-y-5">
                      <div className="space-y-2">
                        <Label htmlFor="name">Nome Completo</Label>
                        <Input
                          id="name"
                          type="text"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="Digite seu nome"
                          required
                          data-testid="input-contact-name"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="email">E-mail</Label>
                        <Input
                          id="email"
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="seu@email.com"
                          required
                          data-testid="input-contact-email"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="phone">Telefone</Label>
                        <PhoneInput
                          id="phone"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          required
                          data-testid="input-contact-phone"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="message">Mensagem</Label>
                        <Textarea
                          id="message"
                          value={message}
                          onChange={(e) => setMessage(e.target.value)}
                          placeholder="Como podemos ajudá-lo?"
                          rows={5}
                          required
                          data-testid="input-contact-message"
                        />
                      </div>

                      <Button
                        type="submit"
                        className="w-full bg-gradient-to-r from-accent to-accent/90 hover:from-accent/90 hover:to-accent/80 text-white border-0"
                        disabled={loading}
                        data-testid="button-submit-contact"
                      >
                        {loading ? (
                          <span className="flex items-center gap-2">
                            <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                            Enviando...
                          </span>
                        ) : (
                          <span className="flex items-center gap-2">
                            <Send className="h-4 w-4" />
                            <span>Enviar Mensagem</span>
                          </span>
                        )}
                      </Button>
                    </form>
                  </CardContent>
                  </Card>
                </motion.div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
