import { Mail, Phone, MapPin } from "lucide-react";
import { Link } from "wouter";
import { useSettings } from "@/hooks/useSettings";
import { formatPhone } from "@/lib/utils";

export function Footer() {
  const { companyName, footerText, companyPhone, companyEmail, companyAddress, logoImage, showCompanyNameInLogo } = useSettings();

  return (
    <footer className="mt-auto bg-gradient-to-r from-primary to-primary/90 text-white">
      <div className="container mx-auto max-w-7xl px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <div className="mb-4">
              <Link href="/" className="cursor-pointer" data-testid="link-footer-title">
                <div className="flex items-center gap-3">
                  {logoImage ? (
                    <img 
                      src={logoImage} 
                      alt="Logo" 
                      className="h-16 object-contain"
                      draggable="false"
                      onContextMenu={(e) => e.preventDefault()}
                      onDragStart={(e) => e.preventDefault()}
                      style={{ userSelect: 'none' }}
                    />
                  ) : (
                    <span className="text-xl font-bold hover:text-accent transition-colors">
                      Imobiliária
                    </span>
                  )}
                  {showCompanyNameInLogo && (
                    <span className="font-bold text-lg text-white leading-tight">{companyName}</span>
                  )}
                </div>
              </Link>
            </div>
            <p className="text-white/80 text-sm">
              {footerText}
            </p>
          </div>

          <div>
            <h3 className="font-semibold mb-4 text-lg">Links Rápidos</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/imoveis" className="text-white/80 hover:text-accent transition-colors" data-testid="link-footer-imoveis">
                  Imóveis
                </Link>
              </li>
              <li>
                <Link href="/bairros" className="text-white/80 hover:text-accent transition-colors" data-testid="link-footer-bairros">
                  Bairros
                </Link>
              </li>
              <li>
                <Link href="/sobre" className="text-white/80 hover:text-accent transition-colors" data-testid="link-footer-sobre">
                  Sobre Nós
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold mb-4 text-lg">Contato</h3>
            <ul className="space-y-2 text-sm text-white/80">
              <li className="flex items-start gap-2">
                <Phone className="h-4 w-4 text-accent mt-0.5" />
                <span>{formatPhone(companyPhone)}</span>
              </li>
              <li className="flex items-start gap-2">
                <Mail className="h-4 w-4 text-accent mt-0.5" />
                <span>{companyEmail}</span>
              </li>
              <li className="flex items-start gap-2">
                <MapPin className="h-4 w-4 text-accent mt-0.5" />
                <span>{companyAddress}</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-white/20 mt-8 pt-6 pb-6 text-center text-sm text-white/60">
          <Link href="/entrar">
            <p className="cursor-pointer hover:text-white/80 transition-colors">&copy; {new Date().getFullYear()} {companyName}. Todos os direitos reservados.</p>
          </Link>
          <a 
            href="https://api.whatsapp.com/send/?phone=556281938192&text=Ol%C3%A1%21+Vim+atrav%C3%A9s+do+site+da+G+Marques+Im%C3%B3veis+e+gostaria+de+conhecer+mais+sobre+os+servi%C3%A7os+da+Evolut+IA.&type=phone_number&app_absent=0"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 block hover:opacity-80 transition-opacity"
            style={{ color: '#FFFFFF' }}
            data-testid="link-evolut-ia"
          >
            Desenvolvido por <span className="font-bold">Evolut IA</span>
          </a>
        </div>
      </div>
    </footer>
  );
}