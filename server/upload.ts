import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";
import sharp from "sharp";
import axios from "axios";
import { storage } from "./storage";

let supabaseClient: SupabaseClient | null = null;

function getSupabaseClient(): SupabaseClient {
  if (!supabaseClient) {
    const anonKey = process.env.SUPABASE_ANON_KEY;
    
    if (!anonKey) {
      throw new Error("SUPABASE_ANON_KEY environment variable is not set");
    }
    
    let supabaseUrl: string | undefined;
    
    // Check if SUPABASE_URL is set (preferred method)
    if (process.env.SUPABASE_URL) {
      supabaseUrl = process.env.SUPABASE_URL;
    } else {
      // Try to extract project ref from connection string
      // Format: postgresql://postgres.PROJECT_REF:PASSWORD@...
      const userMatch = process.env.SUPABASE?.match(/postgresql:\/\/postgres\.([^:@]+)/);
      const projectRef = userMatch?.[1];
      
      if (projectRef) {
        supabaseUrl = `https://${projectRef}.supabase.co`;
      }
    }
    
    if (!supabaseUrl) {
      throw new Error(
        "Could not determine Supabase URL. " +
        "Please set SUPABASE_URL environment variable (e.g., https://yourproject.supabase.co) " +
        "or ensure SUPABASE connection string includes project ref in username (postgres.PROJECT_REF)"
      );
    }
    
    supabaseClient = createClient(supabaseUrl, anonKey);
  }
  return supabaseClient;
}

export interface UploadedFile {
  url: string;
  key: string;
  thumbnail?: string;
  medium?: string;
}

// Get public URL for uploaded object from Supabase Storage
function getPublicUrl(bucket: string, path: string): string {
  const client = getSupabaseClient();
  const { data } = client.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

// Optimize and compress image buffer
async function optimizeImage(
  buffer: Buffer,
  options: {
    maxWidth?: number;
    maxHeight?: number;
    quality?: number;
    format?: 'jpeg' | 'webp';
  } = {}
): Promise<Buffer> {
  const {
    maxWidth = 1920,
    maxHeight = 1920,
    quality = 85,
    format = 'webp'
  } = options;

  let pipeline = sharp(buffer)
    .resize(maxWidth, maxHeight, {
      fit: 'inside',
      withoutEnlargement: true
    });

  if (format === 'webp') {
    pipeline = pipeline.webp({ quality, effort: 6 });
  } else {
    pipeline = pipeline.jpeg({ quality, progressive: true, mozjpeg: true });
  }

  return pipeline.toBuffer();
}

// Cache for watermark image to avoid downloading multiple times
let watermarkCache: { buffer: Buffer; timestamp: number } | null = null;
const WATERMARK_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Download and cache watermark image
async function getWatermarkBuffer(watermarkUrl: string): Promise<Buffer | null> {
  try {
    // Check cache first
    if (watermarkCache && Date.now() - watermarkCache.timestamp < WATERMARK_CACHE_TTL) {
      return watermarkCache.buffer;
    }

    // Download watermark image
    const response = await axios.get(watermarkUrl, {
      responseType: 'arraybuffer',
      timeout: 10000,
    });

    const buffer = Buffer.from(response.data);
    
    // Cache it
    watermarkCache = {
      buffer,
      timestamp: Date.now(),
    };

    return buffer;
  } catch (error) {
    console.error("Error downloading watermark:", error);
    return null;
  }
}

// Apply watermark to image buffer
async function applyWatermark(
  imageBuffer: Buffer,
  watermarkUrl: string,
  size: number,
  opacity: number
): Promise<Buffer> {
  try {
    // Get watermark buffer
    const watermarkBuffer = await getWatermarkBuffer(watermarkUrl);
    if (!watermarkBuffer) {
      console.warn("Failed to get watermark, returning original image");
      return imageBuffer;
    }

    // Get image metadata to calculate watermark dimensions
    const image = sharp(imageBuffer);
    const metadata = await image.metadata();
    
    if (!metadata.width || !metadata.height) {
      console.warn("Could not get image dimensions, returning original image");
      return imageBuffer;
    }

    // Calculate watermark size as percentage of image diagonal
    const diagonal = Math.sqrt(metadata.width ** 2 + metadata.height ** 2);
    const watermarkWidth = Math.floor((diagonal * size) / 100);

    // Resize and apply opacity to watermark
    const processedWatermark = await sharp(watermarkBuffer)
      .resize(watermarkWidth, null, { 
        fit: 'contain',
        withoutEnlargement: true 
      })
      .composite([{
        input: Buffer.from([255, 255, 255, Math.floor((opacity / 100) * 255)]),
        raw: {
          width: 1,
          height: 1,
          channels: 4
        },
        tile: true,
        blend: 'dest-in'
      }])
      .toBuffer();

    // Get watermark dimensions after resize
    const watermarkMetadata = await sharp(processedWatermark).metadata();
    
    if (!watermarkMetadata.width || !watermarkMetadata.height) {
      console.warn("Could not get watermark dimensions, returning original image");
      return imageBuffer;
    }

    // Position watermark at bottom-right with 20px padding
    const left = metadata.width - watermarkMetadata.width - 20;
    const top = metadata.height - watermarkMetadata.height - 20;

    // Composite watermark onto image
    const result = await image
      .composite([{
        input: processedWatermark,
        left: Math.max(0, left),
        top: Math.max(0, top),
      }])
      .toBuffer();

    return result;
  } catch (error) {
    console.error("Error applying watermark:", error);
    // Return original image if watermarking fails
    return imageBuffer;
  }
}

export async function uploadPropertyImage(
  base64Data: string,
  filename: string,
  propertyFolder?: string
): Promise<UploadedFile> {
  try {
    const base64Match = base64Data.match(/^data:image\/\w+;base64,(.+)$/);
    const base64Content = base64Match ? base64Match[1] : base64Data;
    
    let buffer = Buffer.from(base64Content, 'base64');
    
    // Check if watermark is enabled and apply it
    try {
      const watermarkEnabled = await storage.getSetting('watermarkEnabled');
      if (watermarkEnabled && watermarkEnabled.value === 'true') {
        const watermarkImage = await storage.getSetting('watermarkImage');
        const watermarkSize = await storage.getSetting('watermarkSize');
        const watermarkOpacity = await storage.getSetting('watermarkOpacity');
        
        if (watermarkImage && watermarkImage.value) {
          const size = watermarkSize ? Number(watermarkSize.value) : 20;
          const opacity = watermarkOpacity ? Number(watermarkOpacity.value) : 50;
          
          console.log(`Applying watermark: size=${size}%, opacity=${opacity}%`);
          buffer = await applyWatermark(buffer, watermarkImage.value, size, opacity);
        }
      }
    } catch (error) {
      console.warn("Failed to apply watermark, continuing with original image:", error);
    }
    
    // Create folder structure: properties/propertyFolder/filename
    // Use the provided folder name (sanitized title) or fallback to timestamp
    const folder = propertyFolder || `property-${Date.now()}`;
    const baseFilename = `${Date.now()}-${randomUUID()}`;
    
    const client = getSupabaseClient();
    const uploadOptions = {
      contentType: 'image/webp',
      cacheControl: '31536000', // 1 year cache
      upsert: false
    };
    
    // Optimize and upload main image (1920px max, WebP, quality 85)
    const optimizedBuffer = await optimizeImage(buffer, {
      maxWidth: 1920,
      maxHeight: 1920,
      quality: 85,
      format: 'webp'
    });
    
    const mainKey = `properties/${folder}/${baseFilename}.webp`;
    const { error: mainError } = await client.storage
      .from('gmarquesimoveis')
      .upload(mainKey, optimizedBuffer, uploadOptions);
    
    if (mainError) {
      throw mainError;
    }
    
    const url = getPublicUrl('gmarquesimoveis', mainKey);
    
    // Generate and upload medium version (800px max, for cards)
    let mediumUrl: string | undefined;
    try {
      const mediumBuffer = await optimizeImage(buffer, {
        maxWidth: 800,
        maxHeight: 800,
        quality: 80,
        format: 'webp'
      });
      
      const mediumKey = `properties/${folder}/${baseFilename}_medium.webp`;
      await client.storage
        .from('gmarquesimoveis')
        .upload(mediumKey, mediumBuffer, uploadOptions);
      
      mediumUrl = getPublicUrl('gmarquesimoveis', mediumKey);
    } catch (error) {
      console.warn("Failed to generate medium image, will use main image:", error);
    }
    
    // Generate and upload thumbnail (400px max, for previews)
    let thumbnailUrl: string | undefined;
    try {
      const thumbnailBuffer = await optimizeImage(buffer, {
        maxWidth: 400,
        maxHeight: 400,
        quality: 75,
        format: 'webp'
      });
      
      const thumbnailKey = `properties/${folder}/${baseFilename}_thumb.webp`;
      await client.storage
        .from('gmarquesimoveis')
        .upload(thumbnailKey, thumbnailBuffer, uploadOptions);
      
      thumbnailUrl = getPublicUrl('gmarquesimoveis', thumbnailKey);
    } catch (error) {
      console.warn("Failed to generate thumbnail, will use main image:", error);
    }
    
    return {
      url,
      key: mainKey,
      medium: mediumUrl,
      thumbnail: thumbnailUrl
    };
  } catch (error) {
    console.error("Error uploading property image:", error);
    throw new Error("Failed to upload property image");
  }
}

export async function uploadNeighborhoodImage(
  base64Data: string,
  filename: string
): Promise<UploadedFile> {
  try {
    const base64Match = base64Data.match(/^data:image\/\w+;base64,(.+)$/);
    const base64Content = base64Match ? base64Match[1] : base64Data;
    const buffer = Buffer.from(base64Content, 'base64');
    
    // Optimize image (WebP, 1920px max)
    const optimizedBuffer = await optimizeImage(buffer, {
      maxWidth: 1920,
      maxHeight: 1920,
      quality: 85,
      format: 'webp'
    });
    
    const key = `Bairros/${randomUUID()}.webp`;
    
    const client = getSupabaseClient();
    const { error } = await client.storage
      .from('gmarquesimoveis')
      .upload(key, optimizedBuffer, {
        contentType: 'image/webp',
        cacheControl: '31536000', // 1 year cache
        upsert: false
      });
    
    if (error) {
      throw error;
    }
    
    const url = getPublicUrl('gmarquesimoveis', key);
    
    return { url, key };
  } catch (error) {
    console.error("Error uploading neighborhood image:", error);
    throw new Error("Failed to upload neighborhood image");
  }
}

export async function uploadBannerImage(
  base64Data: string,
  filename: string
): Promise<UploadedFile> {
  try {
    const base64Match = base64Data.match(/^data:image\/\w+;base64,(.+)$/);
    const base64Content = base64Match ? base64Match[1] : base64Data;
    const buffer = Buffer.from(base64Content, 'base64');
    
    // Optimize image (WebP, 1920px max)
    const optimizedBuffer = await optimizeImage(buffer, {
      maxWidth: 1920,
      maxHeight: 1920,
      quality: 90,
      format: 'webp'
    });
    
    const key = `banners/${randomUUID()}.webp`;
    
    const client = getSupabaseClient();
    const { error } = await client.storage
      .from('gmarquesimoveis')
      .upload(key, optimizedBuffer, {
        contentType: 'image/webp',
        cacheControl: '31536000', // 1 year cache
        upsert: false
      });
    
    if (error) {
      throw error;
    }
    
    const url = getPublicUrl('gmarquesimoveis', key);
    
    return { url, key };
  } catch (error) {
    console.error("Error uploading banner image:", error);
    throw new Error("Failed to upload banner image");
  }
}

export async function uploadBackgroundImage(
  base64Data: string,
  filename: string,
  type: 'hero' | 'about' | 'logo'
): Promise<UploadedFile> {
  try {
    const base64Match = base64Data.match(/^data:image\/\w+;base64,(.+)$/);
    const base64Content = base64Match ? base64Match[1] : base64Data;
    const buffer = Buffer.from(base64Content, 'base64');
    
    // Optimize image (WebP or PNG for logos, 1920px max)
    const isLogo = type === 'logo';
    const optimizedBuffer = await optimizeImage(buffer, {
      maxWidth: isLogo ? 800 : 1920,
      maxHeight: isLogo ? 800 : 1920,
      quality: isLogo ? 95 : 90,
      format: 'webp'
    });
    
    const key = isLogo 
      ? `Imagens/logo-${Date.now()}.webp` 
      : `Imagens/${type}-background-${Date.now()}.webp`;
    
    const client = getSupabaseClient();
    const { error } = await client.storage
      .from('gmarquesimoveis')
      .upload(key, optimizedBuffer, {
        contentType: 'image/webp',
        cacheControl: '31536000', // 1 year cache
        upsert: false
      });
    
    if (error) {
      throw error;
    }
    
    const url = getPublicUrl('gmarquesimoveis', key);
    
    return { url, key };
  } catch (error) {
    console.error("Error uploading background image:", error);
    throw new Error("Failed to upload background image");
  }
}

export async function uploadWatermarkImage(
  base64Data: string,
  filename: string
): Promise<UploadedFile> {
  try {
    const base64Match = base64Data.match(/^data:image\/\w+;base64,(.+)$/);
    const base64Content = base64Match ? base64Match[1] : base64Data;
    const buffer = Buffer.from(base64Content, 'base64');
    const ext = filename.split('.').pop() || 'png';
    const key = `Imagens/watermark-${Date.now()}.${ext}`;
    
    // Clear watermark cache when a new watermark is uploaded
    watermarkCache = null;
    
    const client = getSupabaseClient();
    const { error } = await client.storage
      .from('gmarquesimoveis')
      .upload(key, buffer, {
        contentType: `image/${ext}`,
        cacheControl: '3600',
        upsert: false
      });
    
    if (error) {
      throw error;
    }
    
    const url = getPublicUrl('gmarquesimoveis', key);
    
    return { url, key };
  } catch (error) {
    console.error("Error uploading watermark image:", error);
    throw new Error("Failed to upload watermark image");
  }
}

export async function deleteImage(key: string): Promise<void> {
  try {
    const client = getSupabaseClient();
    await client.storage
      .from('gmarquesimoveis')
      .remove([key]);
  } catch (error) {
    console.error("Error deleting image:", error);
  }
}
