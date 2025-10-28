import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { useSettings } from "@/hooks/useSettings";
import type { AboutContent } from "@shared/schema";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { motion } from "framer-motion";

export default function About() {
  const { companyName } = useSettings();
  
  // Query for Settings to get background images
  const { data: settingsData = {} } = useQuery<Record<string, string>>({
    queryKey: ["/api/settings"],
  });

  // Query for About content
  const { data: aboutContents = [] } = useQuery<AboutContent[]>({
    queryKey: ["/api/about"],
  });
  const companyAbout = aboutContents.find(c => c.section === 'company');
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      
      <div className="flex-1">
        <div className="container mx-auto max-w-7xl px-4 py-8">
          <div className="py-8">
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <motion.div
                initial={{ opacity: 0, x: -30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6, ease: "easeOut" }}
              >
                <div className="mb-8">
                  <h2 className="text-3xl md:text-4xl font-bold mb-4" style={{ color: '#060606' }} data-testid="text-about-title">
                    {companyAbout?.title || companyName}
                  </h2>
                  <div className="h-1 w-24 rounded-full" style={{ backgroundColor: '#004274' }}></div>
                </div>
                
                <div className="text-muted-foreground text-lg leading-relaxed prose prose-lg max-w-none prose-headings:text-foreground prose-p:text-muted-foreground prose-strong:text-foreground prose-ul:text-muted-foreground prose-ol:text-muted-foreground">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {companyAbout?.content || `Com anos de experiência no mercado imobiliário, a ${companyName} se destaca pelo atendimento personalizado e compromisso com a satisfação dos clientes.\n\nNossa equipe especializada está pronta para ajudá-lo a encontrar o imóvel ideal, seja para compra ou investimento. Trabalhamos com os melhores imóveis nas melhores localizações de São Paulo.`}
                  </ReactMarkdown>
                </div>
              </motion.div>
              
              <motion.div 
                className="relative group"
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
              >
                {settingsData.aboutBackgroundImage && (
                  <Card className="aspect-square rounded-2xl overflow-hidden shadow-lg border-0">
                    <div className="relative w-full h-full">
                      <img 
                        src={settingsData.aboutBackgroundImage} 
                        alt="Imóvel moderno" 
                        className="w-full h-full object-cover"
                        draggable="false"
                        onContextMenu={(e) => e.preventDefault()}
                        onDragStart={(e) => e.preventDefault()}
                        style={{ userSelect: 'none' }}
                      />
                    </div>
                  </Card>
                )}
              </motion.div>
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
