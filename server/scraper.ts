import * as cheerio from 'cheerio';
import axios from 'axios';
import { uploadPropertyImage } from './upload';

export interface ScrapedPropertyData {
  title: string;
  description: string;
  propertyType: string;
  status: string;
  price: string;
  bedrooms: number;
  bathrooms: number;
  parkingSpaces: number;
  area: string | null;
  landArea: string | null;
  images: string[];
  amenities: string[];
  externalId?: string;
  city?: string;
  state?: string;
  neighborhood?: string;
}

async function downloadAndUploadImage(imageUrl: string, index: number, propertyFolder: string): Promise<string | null> {
  try {
    const response = await axios.get(imageUrl, {
      responseType: 'arraybuffer',
      timeout: 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      }
    });
    
    const base64 = Buffer.from(response.data, 'binary').toString('base64');
    const contentType = response.headers['content-type'] || 'image/jpeg';
    const base64Image = `data:${contentType};base64,${base64}`;
    
    const ext = imageUrl.split('.').pop()?.split('?')[0] || 'jpg';
    const filename = `image-${index}.${ext}`;
    
    const uploaded = await uploadPropertyImage(base64Image, filename, propertyFolder);
    console.log(`Uploaded image ${index + 1}: ${uploaded.url}`);
    return uploaded.url;
  } catch (error) {
    console.error(`Failed to download/upload image ${imageUrl}:`, error);
    return null;
  }
}

function improvePropertyType(rawType: string, title: string, description: string): string {
  // First, normalize the raw type from the website
  const normalizedRawType = rawType.toLowerCase().trim();
  
  // Map common property type names from the website to our standard types
  if (normalizedRawType.includes('casa') || normalizedRawType.includes('residência') || 
      normalizedRawType.includes('sobrado') || normalizedRawType.includes('padrão')) {
    return 'casa';
  }
  if (normalizedRawType.includes('apartamento') || normalizedRawType.includes('apto')) {
    return 'apartamento';
  }
  if (normalizedRawType.includes('terreno') || normalizedRawType.includes('lote')) {
    return 'terreno';
  }
  if (normalizedRawType.includes('comercial') || normalizedRawType.includes('loja') || 
      normalizedRawType.includes('sala comercial')) {
    return 'comercial';
  }
  if (normalizedRawType.includes('condomínio') || normalizedRawType.includes('condominio') || 
      normalizedRawType.includes('condo')) {
    return 'condominio';
  }
  
  // If raw type is not conclusive, check title and description
  const combined = `${title} ${description}`.toLowerCase();
  
  if (combined.includes('apartamento')) return 'apartamento';
  if (combined.includes('terreno') || combined.includes('lote')) return 'terreno';
  if (combined.includes('sala comercial') || combined.includes('comercial') || combined.includes('loja')) return 'comercial';
  if (combined.includes('condomínio') || combined.includes('condominio') || combined.includes('condo')) return 'condominio';
  if (combined.includes('sobrado') || combined.includes('casa') || combined.includes('residência')) return 'casa';
  
  return 'casa';
}

function extractFullDescription($: cheerio.CheerioAPI): string {
  const descriptionSelectors = [
    '.block-content-wrap',
    '.property-description',
    '.description-text',
    '#description',
    '.detail-wrap .block-content',
  ];
  
  for (const selector of descriptionSelectors) {
    const element = $(selector).first();
    if (element.length) {
      let fullText = '';
      
      // Try to get all paragraphs and list items
      element.find('p, div, li').each((_, elem) => {
        const text = $(elem).text().trim();
        if (text && text.length > 5) {
          // Skip if it's a parent element that already had its children processed
          const hasNestedContent = $(elem).find('p, div, li').length > 0;
          if (!hasNestedContent) {
            fullText += text + '\n';
          }
        }
      });
      
      if (fullText.length > 50) {
        return fullText.trim();
      }
      
      // Fallback to direct text
      const directText = element.text().trim();
      if (directText.length > 50) {
        return directText;
      }
    }
  }
  
  return 'Sem descrição disponível';
}

function extractPropertyGalleryImages($: cheerio.CheerioAPI): string[] {
  const imageUrls: string[] = [];
  const seenUrls = new Set<string>();
  
  // Primary selectors for gallery images on gmarquesimoveis site
  const gallerySelectors = [
    '.houzez-trigger-popup-slider-js img', // Main gallery images
    '.img-wrap-1 img, .img-wrap-2 img, .img-wrap-3 img', // Numbered image wrappers
    '.gallery-hidden img', // Hidden gallery images
    'a[data-toggle="modal"][data-target="#property-lightbox"] img', // Modal trigger images
    '#pills-gallery img', // Tab gallery images
    '.swipebox img', // Swipebox gallery
    '.property-gallery img', // General property gallery
    '.gallery-item img', // Gallery items
    '.lightslider img', // Light slider images
  ];
  
  // Extract images from primary selectors
  for (const selector of gallerySelectors) {
    $(selector).each((_, elem) => {
      const src = $(elem).attr('src') || $(elem).attr('data-src');
      
      if (src) {
        const fullUrl = src.startsWith('http') ? src : `https://gmarquesimoveis.com.br${src}`;
        
        // Filter out non-property images
        if (!fullUrl.includes('profile-avatar') && 
            !fullUrl.includes('loading') && 
            !fullUrl.includes('logo') &&
            !fullUrl.includes('icon') &&
            !fullUrl.includes('/themes/') && // Exclude theme assets
            fullUrl.includes('/uploads/') && // Include only uploaded content
            !seenUrls.has(fullUrl)) {
          
          // Check if it's a property image (usually has WhatsApp or property in name, or is in year/month folders)
          if (fullUrl.match(/\/(202[3-5])\/\d{2}\//) || fullUrl.includes('WhatsApp') || fullUrl.includes('imovel')) { // Year/month pattern or WhatsApp images
            seenUrls.add(fullUrl);
            imageUrls.push(fullUrl);
          }
        }
      }
    });
  }
  
  // If no images found, try background images in gallery divs
  if (imageUrls.length === 0) {
    $('[style*="background-image"]').each((_, elem) => {
      const style = $(elem).attr('style');
      if (style) {
        const match = style.match(/url\((['"]?)(.*?)(['"]?)\)/);
        if (match && match[2]) {
          const url = match[2];
          const fullUrl = url.startsWith('http') ? url : `https://gmarquesimoveis.com.br${url}`;
          
          if (fullUrl.includes('/uploads/') && 
              (fullUrl.match(/\/(202[3-5])\/\d{2}\//) || fullUrl.includes('WhatsApp') || fullUrl.includes('imovel')) &&
              !seenUrls.has(fullUrl)) {
            seenUrls.add(fullUrl);
            imageUrls.push(fullUrl);
          }
        }
      }
    });
  }
  
  console.log(`Extracted ${imageUrls.length} property images from HTML`);
  
  return imageUrls.filter(url => {
    const hasImageExtension = /\.(jpg|jpeg|png|webp)($|\?)/i.test(url);
    return hasImageExtension;
  });
}

export async function scrapePropertyFromGMarques(url: string): Promise<ScrapedPropertyData> {
  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      }
    });
    
    const $ = cheerio.load(response.data);
    
    const title = $('h1').first().text().trim() || 'Sem título';
    
    let price = '0';
    const priceText = $('.item-price').first().text().trim();
    if (priceText) {
      price = priceText
        .replace(/[^\d,]/g, '')
        .replace(/\./g, '')
        .replace(',', '.');
    }
    
    const description = extractFullDescription($);
    
    let bedrooms = 0;
    let bathrooms = 0;
    let parkingSpaces = 0;
    let area: string | null = null;
    let landArea: string | null = null;
    let externalId = '';
    let propertyType = 'casa';
    let city = '';
    let state = '';
    let neighborhood = '';
    
    $('.detail-wrap ul li').each((_, elem) => {
      const text = $(elem).text().trim();
      const label = $(elem).find('strong').text().trim().toLowerCase();
      
      if (label.includes('quarto') || text.toLowerCase().includes('quarto')) {
        const match = text.match(/(\d+)/);
        if (match) bedrooms = parseInt(match[1], 10);
      }
      
      if (label.includes('banheiro') || text.toLowerCase().includes('banheiro')) {
        const match = text.match(/(\d+)/);
        if (match) bathrooms = parseInt(match[1], 10);
      }
      
      if (label.includes('garagem') || label.includes('vaga') || text.toLowerCase().includes('garagem') || text.toLowerCase().includes('vaga')) {
        const match = text.match(/(\d+)/);
        if (match) parkingSpaces = parseInt(match[1], 10);
      }
      
      if (label.includes('tamanho construção') || label.includes('área construída') || label.includes('área construida')) {
        const match = text.match(/([\d.,]+)\s*m/);
        if (match) {
          area = match[1].replace(/\./g, '').replace(',', '.');
        }
      }
      
      if (label.includes('tamanho terreno') || label.includes('área do terreno') || label.includes('tamanho do terreno') || label.includes('lote')) {
        const match = text.match(/([\d.,]+)\s*m/);
        if (match) {
          landArea = match[1].replace(/\./g, '').replace(',', '.');
        }
      }
      
      if (label.includes('id:')) {
        const match = text.match(/[A-Z0-9]+/);
        if (match) externalId = match[0];
      }
      
      if (label.includes('tipo:')) {
        propertyType = text.replace(/tipo[:\s]*/i, '').trim().toLowerCase();
      }
      
      if (label.includes('cidade')) {
        city = text.replace(/cidade[:\s]*/i, '').trim();
      }
      
      if (label.includes('estado')) {
        state = text.replace(/estado[:\s]*/i, '').trim();
      }
      
      if (label.includes('bairro') || label.includes('neighbourhood')) {
        neighborhood = text.replace(/bairro[:\s]*/i, '').trim();
      }
    });
    
    if (!area) {
      const areaMatch = $('.property-meta .item-amenities').text().match(/([\d.,]+)\s*m²/);
      if (areaMatch) {
        area = areaMatch[1].replace(/\./g, '').replace(',', '.');
      }
    }
    
    if (!landArea) {
      const propertyMetaText = $('.property-meta, .detail-wrap').text();
      const landMatches = propertyMetaText.match(/(\d[\d.,]+)\s*m²/g);
      if (landMatches && landMatches.length > 1) {
        const secondMatch = landMatches[1].replace(/[^\d.,]/g, '').replace(/\./g, '').replace(',', '.');
        landArea = secondMatch;
      }
    }
    
    propertyType = improvePropertyType(propertyType, title, description);
    
    let status = 'venda';
    const statusText = $('.label-status, .property-status').text().toLowerCase();
    if (statusText.includes('aluguel')) {
      status = 'aluguel';
    } else if (statusText.includes('venda')) {
      status = 'venda';
    }
    
    const imageUrls = extractPropertyGalleryImages($);
    
    console.log(`Found ${imageUrls.length} gallery images to download`);
    
    const propertyFolder = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').substring(0, 50);
    
    const uploadedImages: string[] = [];
    for (let i = 0; i < Math.min(imageUrls.length, 20); i++) {
      const uploadedUrl = await downloadAndUploadImage(imageUrls[i], i, propertyFolder);
      if (uploadedUrl) {
        uploadedImages.push(uploadedUrl);
      }
      if (i < imageUrls.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    console.log(`Successfully uploaded ${uploadedImages.length} images`);
    
    // Extract neighborhood from breadcrumb or title if not found in details
    if (!neighborhood) {
      const breadcrumbText = $('.breadcrumbs, .breadcrumb').text().toLowerCase();
      const titleLower = title.toLowerCase();
      
      // Common neighborhoods to look for - including typo variations
      const commonNeighborhoods = [
        { search: ['camburi', 'cambury'], name: 'Camburi' },
        { search: ['boiçucanga', 'boissucanga', 'boicucanga'], name: 'Boiçucanga' },
        { search: ['praia do canto'], name: 'Praia do Canto' },
        { search: ['centro'], name: 'Centro' },
        { search: ['jardim camburi'], name: 'Jardim Camburi' },
        { search: ['vitória'], name: 'Vitória' },
      ];
      
      for (const n of commonNeighborhoods) {
        for (const searchTerm of n.search) {
          if (breadcrumbText.includes(searchTerm) || titleLower.includes(searchTerm)) {
            neighborhood = n.name;
            break;
          }
        }
        if (neighborhood) break;
      }
    }
    
    return {
      title,
      description,
      propertyType,
      status,
      price,
      bedrooms,
      bathrooms,
      parkingSpaces,
      area,
      landArea,
      images: uploadedImages,
      amenities: [], // Amenities will be extracted by AI from description
      externalId,
      city,
      state,
      neighborhood,
    };
    
  } catch (error) {
    console.error('Error scraping property:', error);
    throw new Error(`Failed to scrape property: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function reimportPropertyImages(url: string, propertyTitle: string): Promise<string[]> {
  try {
    console.log(`Re-importing images from: ${url}`);
    
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      }
    });
    
    const $ = cheerio.load(response.data);
    const imageUrls = extractPropertyGalleryImages($);
    
    console.log(`Found ${imageUrls.length} gallery images to re-import`);
    
    const propertyFolder = propertyTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').substring(0, 50);
    
    const uploadedImages: string[] = [];
    for (let i = 0; i < Math.min(imageUrls.length, 20); i++) {
      const uploadedUrl = await downloadAndUploadImage(imageUrls[i], i, propertyFolder);
      if (uploadedUrl) {
        uploadedImages.push(uploadedUrl);
      }
      if (i < imageUrls.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    console.log(`Successfully re-imported ${uploadedImages.length} images`);
    return uploadedImages;
  } catch (error) {
    console.error('Error re-importing images:', error);
    throw new Error(`Failed to re-import images: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
