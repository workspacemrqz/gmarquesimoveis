import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AdminLayout";
import { DocumentTitle } from "@/components/DocumentTitle";
import Home from "@/pages/Home";
import Properties from "@/pages/Properties";
import PropertyDetails from "@/pages/PropertyDetails";
import Neighborhoods from "@/pages/Neighborhoods";
import NeighborhoodDetails from "@/pages/NeighborhoodDetails";
import About from "@/pages/About";
import Contact from "@/pages/Contact";
import Login from "@/pages/Login";
import AdminDashboard from "@/pages/admin/AdminDashboard";
import AdminProperties from "@/pages/admin/AdminProperties";
import AdminNeighborhoods from "@/pages/admin/AdminNeighborhoods";
import AdminClients from "@/pages/admin/AdminClients";
import AdminOwners from "@/pages/admin/AdminOwners";
import AdminFinancials from "@/pages/admin/AdminFinancials";
import AdminSettings from "@/pages/admin/AdminSettings";
import AdminContactMessages from "@/pages/admin/AdminContactMessages";
import AdminIntelligence from "@/pages/admin/AdminIntelligence";
import NotFound from "@/pages/not-found";
import { useEffect, useState } from "react";
import { useFavicon } from "@/hooks/useFavicon";
import { useImageProtection } from "@/hooks/useImageProtection";
import { Button } from "@/components/ui/button";
import { Sun, Moon } from "lucide-react";

function ScrollToTop() {
  const [location] = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location]);

  return null;
}

function PublicRoutes() {
  useImageProtection();
  
  return (
    <>
      <ScrollToTop />
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/imoveis" component={Properties} />
        <Route path="/imoveis/:id" component={PropertyDetails} />
        <Route path="/bairros" component={Neighborhoods} />
        <Route path="/bairros/:slug" component={NeighborhoodDetails} />
        <Route path="/sobre" component={About} />
        <Route path="/contato" component={Contact} />
        <Route path="/entrar" component={Login} />
        <Route component={NotFound} />
      </Switch>
    </>
  );
}

function AdminRoutes() {
  const [location] = useLocation();
  const [isDarkMode, setIsDarkMode] = useState(false);
  const isIntelligencePage = location === "/admin/inteligencia";

  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <ScrollToTop />
      <div className="flex h-screen w-full">
        <AppSidebar />
        <div className="flex flex-col flex-1 overflow-hidden">
          <header 
            className="flex items-center gap-2 border-b p-2"
            style={{
              backgroundColor: (isIntelligencePage && isDarkMode) ? '#060606' : undefined,
              borderColor: (isIntelligencePage && isDarkMode) ? '#333333' : undefined
            }}
          >
            <SidebarTrigger 
              data-testid="button-sidebar-toggle"
              style={{
                color: (isIntelligencePage && isDarkMode) ? '#FFFFFF' : undefined
              }}
            />
            <div className="flex-1" />
            {isIntelligencePage && (
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleDarkMode}
                data-testid="button-theme-toggle"
                className="mr-2"
                style={{
                  color: isDarkMode ? '#FFFFFF' : undefined
                }}
              >
                {isDarkMode ? (
                  <Moon className="h-5 w-5" />
                ) : (
                  <Sun className="h-5 w-5" />
                )}
              </Button>
            )}
          </header>
          <main className="flex-1 overflow-auto">
            <Switch>
              <Route path="/admin" component={AdminDashboard} />
              <Route path="/admin/imoveis" component={AdminProperties} />
              <Route path="/admin/bairros" component={AdminNeighborhoods} />
              <Route path="/admin/clientes" component={AdminClients} />
              <Route path="/admin/proprietarios" component={AdminOwners} />
              <Route path="/admin/financeiro" component={AdminFinancials} />
              <Route path="/admin/inteligencia">
                {() => <AdminIntelligence isDarkMode={isDarkMode} />}
              </Route>
              <Route path="/admin/configuracoes" component={AdminSettings} />
              <Route path="/admin/mensagens-contato" component={AdminContactMessages} />
            </Switch>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function Router() {
  const [location] = useLocation();
  const isAdmin = location.startsWith("/admin");

  // Atualiza dinamicamente o favicon baseado no logotipo configurado
  useFavicon();

  if (isAdmin) {
    return <AdminRoutes />;
  }

  return <PublicRoutes />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <DocumentTitle />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
