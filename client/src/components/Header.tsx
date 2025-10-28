import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useSettings } from "@/hooks/useSettings";

export function Header() {
  const [location] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { logoImage, companyName, showCompanyNameInLogo } = useSettings();

  const navLinks = [
    { href: "/", label: "Início" },
    { href: "/imoveis", label: "Imóveis" },
    { href: "/bairros", label: "Bairros" },
    { href: "/sobre", label: "Sobre" },
    { href: "/contato", label: "Contato" },
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-gradient-to-r from-primary to-primary/90 shadow-md">
      <div className="container mx-auto max-w-7xl px-4">
        <div className="flex h-16 items-center justify-between">
          <Link href="/" className="cursor-pointer" data-testid="link-site-title">
            <div className="flex items-center gap-3">
              {logoImage && (
                <img 
                  src={logoImage} 
                  alt="Logo" 
                  className="h-10 object-contain" 
                  draggable="false"
                  onContextMenu={(e) => e.preventDefault()}
                  onDragStart={(e) => e.preventDefault()}
                  style={{ userSelect: 'none' }}
                />
              )}
              {showCompanyNameInLogo && (
                <span className="font-bold text-lg text-white leading-tight">{companyName}</span>
              )}
            </div>
          </Link>

          <nav className="hidden md:flex items-center space-x-2">
            {navLinks.map((link) => (
              <Link key={link.href} href={link.href}>
                <div
                  className={cn(
                    "relative px-4 py-2 text-white font-medium transition-all duration-300 cursor-pointer group",
                    "hover:text-white/90"
                  )}
                  data-testid={`link-${link.label.toLowerCase()}`}
                >
                  <span className="relative z-10">{link.label}</span>
                  
                  {/* Hover effect - animated underline */}
                  <div
                    className={cn(
                      "absolute bottom-0 left-0 right-0 h-[2px] bg-white transition-all duration-300",
                      location === link.href
                        ? "opacity-100 scale-x-100"
                        : "opacity-0 scale-x-0 group-hover:opacity-100 group-hover:scale-x-100"
                    )}
                  />
                </div>
              </Link>
            ))}
          </nav>

          <Button
            variant="ghost"
            size="icon"
            className="md:hidden text-white"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            data-testid="button-menu-toggle"
          >
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </Button>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden pb-4 space-y-2 animate-in slide-in-from-top">
            {navLinks.map((link) => (
              <Link key={link.href} href={link.href} onClick={() => setMobileMenuOpen(false)}>
                <div
                  className={cn(
                    "relative w-full px-4 py-3 text-white font-medium transition-all duration-300 cursor-pointer group"
                  )}
                  data-testid={`link-mobile-${link.label.toLowerCase()}`}
                >
                  <span className="relative z-10">{link.label}</span>
                  
                  {/* Left border indicator for active and hover state */}
                  <div
                    className={cn(
                      "absolute left-0 top-0 bottom-0 w-1 bg-white transition-all duration-300",
                      location === link.href
                        ? "opacity-100 scale-y-100"
                        : "opacity-0 scale-y-0 group-hover:opacity-50 group-hover:scale-y-100"
                    )}
                  />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </header>
  );
}
