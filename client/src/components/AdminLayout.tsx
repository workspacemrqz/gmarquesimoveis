import { Link, useLocation } from "wouter";
import { 
  Building2, 
  LayoutDashboard, 
  MapPin, 
  Users, 
  DollarSign, 
  Settings,
  LogOut,
  Mail,
  Home,
  Sparkles
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { useSettings } from "@/hooks/useSettings";
import { queryClient } from "@/lib/queryClient";

const menuCategories = [
  {
    label: "Dashboard",
    items: [
      { title: "Dashboard", url: "/admin", icon: LayoutDashboard },
    ]
  },
  {
    label: "Imóveis",
    items: [
      { title: "Imóveis", url: "/admin/imoveis", icon: Building2 },
      { title: "Bairros", url: "/admin/bairros", icon: MapPin },
    ]
  },
  {
    label: "CRM",
    items: [
      { title: "Clientes", url: "/admin/clientes", icon: Users },
      { title: "Proprietários", url: "/admin/proprietarios", icon: Users },
      { title: "Financeiro", url: "/admin/financeiro", icon: DollarSign },
      { title: "Formulários", url: "/admin/mensagens-contato", icon: Mail },
    ]
  },
  {
    label: "Inteligência Artificial",
    items: [
      { title: "Inteligência", url: "/admin/inteligencia", icon: Sparkles },
    ]
  },
  {
    label: "Sistema",
    items: [
      { title: "Configurações", url: "/admin/configuracoes", icon: Settings },
    ]
  }
];

export function AppSidebar() {
  const [location, setLocation] = useLocation();
  const { logoImage, companyName, showCompanyNameInLogo } = useSettings();

  const handleLogout = async () => {
    try {
      // Faz logout no backend
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
      
      // Limpa o cache do React Query
      queryClient.clear();
      
      // Redireciona imediatamente para a página inicial
      setLocation('/');
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
      // Mesmo com erro, redireciona para a home
      setLocation('/');
    }
  };

  return (
    <Sidebar>
      <SidebarHeader className="border-b p-4">
        <Link href="/admin" className="cursor-pointer p-2 block" data-testid="link-admin-logo">
          <div className="flex items-center gap-3">
            {logoImage ? (
              <img src={logoImage} alt="Logo" className="h-16 object-contain" />
            ) : (
              <span className="font-bold text-lg">Imobiliária</span>
            )}
            {showCompanyNameInLogo && (
              <span className="font-bold text-lg text-white leading-tight">{companyName}</span>
            )}
          </div>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        {menuCategories.map((category) => (
          <SidebarGroup key={category.label}>
            <SidebarGroupLabel>{category.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {category.items.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={location === item.url}
                    >
                      <Link href={item.url} data-testid={`sidebar-link-${item.title.toLowerCase()}`}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter className="border-t p-4">
        <Button
          variant="ghost"
          className="w-full justify-start"
          size="sm"
          onClick={handleLogout}
          data-testid="sidebar-button-logout"
        >
          <LogOut className="h-4 w-4 mr-2" />
          Sair
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}

interface AdminLayoutProps {
  children: React.ReactNode;
}

export function AdminLayout({ children }: AdminLayoutProps) {
  return <>{children}</>;
}
