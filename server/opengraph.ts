import { Request, Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';
import { db } from './db';
import { properties } from '@shared/schema';
import { eq } from 'drizzle-orm';

/**
 * Detects if the request is from a social media crawler
 */
export function isSocialCrawler(userAgent: string): boolean {
  const crawlers = [
    'facebookexternalhit',
    'twitterbot',
    'linkedinbot',
    'slackbot',
    'whatsapp',
    'telegrambot',
    'discordbot',
    'bingbot',
    'googlebot',
    'mastodon'
  ];
  
  const lowerUserAgent = userAgent?.toLowerCase() || '';
  return crawlers.some(crawler => lowerUserAgent.includes(crawler));
}

/**
 * Generate Open Graph meta tags for a property
 */
function generatePropertyMetaTags(property: any): string {
  const title = property.title || 'Imóvel em São Sebastião';
  const description = property.description?.substring(0, 160) || 'Veja este imóvel incrível disponível para venda em São Sebastião - SP';
  const price = property.price ? `R$ ${property.price.toLocaleString('pt-BR')}` : 'Preço sob consulta';
  const fullDescription = `${description} - ${price}`;
  
  // Use the first image if available
  const imageUrl = property.images?.length > 0 ? property.images[0] : '';
  const siteUrl = process.env.SITE_URL || `http://localhost:${process.env.PORT || 5000}`;
  const propertyUrl = `${siteUrl}/imoveis/${property.slug}`;
  
  return `
    <!-- Open Graph Meta Tags -->
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${fullDescription}" />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="${propertyUrl}" />
    ${imageUrl ? `<meta property="og:image" content="${imageUrl}" />` : ''}
    ${imageUrl ? `<meta property="og:image:secure_url" content="${imageUrl}" />` : ''}
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:site_name" content="G Marques Imóveis" />
    <meta property="og:locale" content="pt_BR" />
    
    <!-- Twitter Card Meta Tags -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${title}" />
    <meta name="twitter:description" content="${fullDescription}" />
    ${imageUrl ? `<meta name="twitter:image" content="${imageUrl}" />` : ''}
    
    <!-- Additional SEO Meta Tags -->
    <meta name="description" content="${fullDescription}" />
    <link rel="canonical" href="${propertyUrl}" />
  `;
}

/**
 * Generate default Open Graph meta tags for the site
 */
function generateDefaultMetaTags(): string {
  const siteUrl = process.env.SITE_URL || `http://localhost:${process.env.PORT || 5000}`;
  
  return `
    <!-- Open Graph Meta Tags -->
    <meta property="og:title" content="G Marques Imóveis - Seu imóvel ideal está aqui" />
    <meta property="og:description" content="Encontre o imóvel perfeito com a G Marques Imóveis. Casas, apartamentos e terrenos para venda com atendimento personalizado." />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="${siteUrl}" />
    <meta property="og:site_name" content="G Marques Imóveis" />
    <meta property="og:locale" content="pt_BR" />
    
    <!-- Twitter Card Meta Tags -->
    <meta name="twitter:card" content="summary" />
    <meta name="twitter:title" content="G Marques Imóveis - Seu imóvel ideal está aqui" />
    <meta name="twitter:description" content="Encontre o imóvel perfeito com a G Marques Imóveis. Casas, apartamentos e terrenos para venda com atendimento personalizado." />
  `;
}

/**
 * Middleware to inject Open Graph meta tags for social media crawlers
 */
export async function openGraphMiddleware(req: Request, res: Response, next: NextFunction) {
  const userAgent = req.headers['user-agent'] || '';
  
  // Only process for social crawlers and property pages
  if (!isSocialCrawler(userAgent)) {
    return next();
  }
  
  // Check if this is a property page request
  const match = req.path.match(/^\/imoveis\/([^\/]+)$/);
  
  try {
    let metaTags = generateDefaultMetaTags();
    
    if (match) {
      const slug = match[1];
      
      // Fetch property from database
      const property = await db
        .select()
        .from(properties)
        .where(eq(properties.slug, slug))
        .limit(1);
      
      if (property.length > 0) {
        metaTags = generatePropertyMetaTags(property[0]);
      }
    }
    
    // Read the index.html file
    const indexPath = process.env.NODE_ENV === 'production' 
      ? path.join(process.cwd(), 'dist', 'public', 'index.html')
      : path.join(process.cwd(), 'client', 'index.html');
    
    fs.readFile(indexPath, 'utf8', (err, html) => {
      if (err) {
        console.error('Error reading index.html:', err);
        return next();
      }
      
      // Replace the placeholder with actual meta tags
      const modifiedHtml = html.replace(
        '<!-- OPEN_GRAPH_TAGS_PLACEHOLDER -->',
        metaTags
      );
      
      // Send the modified HTML
      res.set('Content-Type', 'text/html');
      res.send(modifiedHtml);
    });
  } catch (error) {
    console.error('Error in Open Graph middleware:', error);
    next();
  }
}