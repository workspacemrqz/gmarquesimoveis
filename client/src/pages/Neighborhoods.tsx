import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { MapPin } from "lucide-react";
import { Link } from "wouter";
import type { Neighborhood } from "@shared/schema";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { motion } from "framer-motion";

export default function Neighborhoods() {
  const { data: neighborhoods = [], isLoading } = useQuery<Neighborhood[]>({
    queryKey: ["/api/neighborhoods"],
  });

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      
      <div className="flex-1">
        <div className="container mx-auto max-w-7xl px-4 py-8">
          <motion.div 
            className="mb-8"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          >
            <h1 className="text-3xl md:text-4xl font-bold mb-2" style={{ color: '#060606' }} data-testid="text-page-title">
              Bairros Atendidos
            </h1>
            <p className="text-muted-foreground">
              Explore os bairros onde atuamos e encontre o local ideal para você
            </p>
          </motion.div>

          {!isLoading && neighborhoods.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {neighborhoods.map((neighborhood, index) => (
                <motion.div
                  key={neighborhood.id}
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: index * 0.1, ease: "easeOut" }}
                >
                  <Link href={`/bairros/${neighborhood.slug}`}>
                    <Card className="overflow-hidden hover-elevate active-elevate-2 transition-all cursor-pointer h-full group" data-testid={`card-neighborhood-${neighborhood.slug}`}>
                    <div className="aspect-video bg-muted relative overflow-hidden">
                      {neighborhood.imageUrl && (
                        <img 
                          src={neighborhood.imageUrl} 
                          alt={neighborhood.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          draggable="false"
                          onContextMenu={(e) => e.preventDefault()}
                          onDragStart={(e) => e.preventDefault()}
                          style={{ userSelect: 'none' }}
                        />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent flex items-end">
                        <div className="p-4 w-full">
                          <h3 className="text-white font-bold text-2xl drop-shadow-lg">{neighborhood.name}</h3>
                        </div>
                      </div>
                    </div>
                  </Card>
                </Link>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>

      <Footer />
    </div>
  );
}
