import type { Express } from "express";
import express from "express";
import { createServer, type Server } from "http";
import type { RequestHandler } from "express";
import { storage } from "./storage";
import { setupAuth } from "./auth";
import { 
  generatePropertySuggestions, 
  extractPropertyFromDescription, 
  extractNeighborhoodFromDescription,
  extractClientFromDescription,
  extractOwnerFromDescription,
  extractFinancialFromDescription 
} from "./ai";
import { rateLimitChat, rateLimitExecute } from "./rateLimiter";
import multer from "multer";
import fs from "fs";
import path from "path";
import OpenAI from "openai";

// Simple admin authentication middleware
const isAdmin: RequestHandler = (req, res, next) => {
  if (req.session?.isAdmin) {
    return next();
  }
  res.status(401).json({ message: "Unauthorized" });
};
import { uploadPropertyImage, uploadNeighborhoodImage, uploadBannerImage, uploadBackgroundImage, uploadWatermarkImage } from "./upload";
import { secureImageMiddleware, generateImageTokens, getSecurityStats } from "./imageSecurityMiddleware";
import {
  insertPropertySchema,
  insertNeighborhoodSchema,
  insertBannerSchema,
  insertClientSchema,
  insertOwnerSchema,
  insertFinancialTransactionSchema,
  insertAboutContentSchema,
  insertContactHistorySchema,
  insertContactMessageSchema,
} from "@shared/schema";
import { fromError } from "zod-validation-error";


export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  // Simple login route
  app.post("/api/auth/login", async (req, res) => {
    const { username, password } = req.body;
    const adminLogin = process.env.LOGIN;
    const adminPassword = process.env.SENHA;

    console.log("Login attempt for user:", username);
    console.log("Expected login:", adminLogin);
    console.log("Session ID before login:", req.sessionID);
    
    if (username === adminLogin && password === adminPassword) {
      try {
        // Regenerate session to prevent session fixation attacks
        await new Promise<void>((resolve, reject) => {
          req.session.regenerate((err) => {
            if (err) {
              console.error("Error regenerating session:", err);
              reject(err);
            } else {
              resolve();
            }
          });
        });
        
        // Guard against null session after regeneration
        if (!req.session) {
          console.error("Session is null after regeneration");
          throw new Error("Session regeneration failed");
        }
        
        // Set admin flag on the regenerated session
        req.session.isAdmin = true;
        console.log("Session after setting isAdmin:", req.session);
        
        // Force save the session to ensure it's persisted
        await new Promise<void>((resolve, reject) => {
          req.session.save((saveErr) => {
            if (saveErr) {
              console.error("Error saving session:", saveErr);
              reject(saveErr);
            } else {
              resolve();
            }
          });
        });
        
        console.log("Session saved successfully, isAdmin:", req.session.isAdmin);
        console.log("Session ID after login:", req.sessionID);
        res.json({ success: true });
      } catch (error) {
        console.error("Error during login:", error);
        
        // Clean up session on error
        if (req.session) {
          req.session.destroy((destroyErr) => {
            if (destroyErr) {
              console.error("Error destroying session after failed login:", destroyErr);
            }
          });
        }
        
        // Clear the session cookie
        res.clearCookie('connect.sid');
        res.status(500).json({ message: "Login failed" });
      }
    } else {
      res.status(401).json({ message: "Invalid credentials" });
    }
  });

  // Check auth status
  app.get("/api/auth/check", async (req, res) => {
    console.log("Auth check - session ID:", req.sessionID);
    console.log("Auth check - session data:", JSON.stringify(req.session));
    console.log("Auth check - isAdmin value:", req.session?.isAdmin);
    console.log("Auth check - session cookie:", req.headers.cookie);
    
    if (req.session && req.session.isAdmin === true) {
      console.log("Auth check - Returning isAdmin: true from session");
      return res.json({ isAdmin: true });
    }
    
    res.json({ isAdmin: false });
  });

  // Logout route
  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy(() => {
      res.json({ success: true });
    });
  });

  // Note: Supabase Storage images are served directly from Supabase CDN
  // No need for a custom endpoint - the upload functions return public URLs

  // Document upload configuration with multer
  // Ensure uploads directory exists
  const uploadsDir = path.join(process.cwd(), 'uploads', 'documents');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  
  const documentStorage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const ext = path.extname(file.originalname);
      const nameWithoutExt = path.basename(file.originalname, ext);
      const sanitizedName = nameWithoutExt.replace(/[^a-zA-Z0-9-_]/g, '_');
      cb(null, `${sanitizedName}-${uniqueSuffix}${ext}`);
    }
  });
  
  const documentUpload = multer({
    storage: documentStorage,
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB
    },
    fileFilter: (req, file, cb) => {
      const allowedMimes = [
        'application/pdf',
        'image/jpeg',
        'image/jpg',
        'image/png',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ];
      
      if (allowedMimes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error('Tipo de arquivo não permitido. Use PDF, imagens (JPG, PNG) ou documentos Word (DOC, DOCX).'));
      }
    }
  });
  
  // Document upload endpoint
  app.post("/api/uploads/documents", isAdmin, documentUpload.array('documents', 10), async (req, res) => {
    try {
      if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
        return res.status(400).json({ message: "Nenhum arquivo enviado" });
      }
      
      const uploadedFiles = req.files.map((file: Express.Multer.File) => ({
        url: `/uploads/documents/${file.filename}`,
        filename: file.originalname,
        size: file.size,
        mimetype: file.mimetype
      }));
      
      res.json(uploadedFiles);
    } catch (error) {
      console.error("Error uploading documents:", error);
      res.status(500).json({ message: "Erro ao fazer upload dos documentos" });
    }
  });
  
  // Serve uploaded documents
  app.use('/uploads/documents', isAdmin, express.static(path.join(process.cwd(), 'uploads', 'documents')));

  // Public Properties Routes
  app.get("/api/properties", async (req, res) => {
    try {
      const filters = {
        propertyType: req.query.propertyType as string | undefined,
        status: req.query.status as string | undefined,
        minPrice: req.query.minPrice ? Number(req.query.minPrice) : undefined,
        maxPrice: req.query.maxPrice ? Number(req.query.maxPrice) : undefined,
        bedrooms: req.query.bedrooms ? Number(req.query.bedrooms) : undefined,
        bathrooms: req.query.bathrooms ? Number(req.query.bathrooms) : undefined,
        neighborhoodId: req.query.neighborhoodId as string | undefined,
        isFeatured: req.query.isFeatured === 'true' ? true : undefined,
        page: req.query.page ? Number(req.query.page) : 1,
        limit: req.query.limit ? Number(req.query.limit) : 12,
      };
      
      // If paginated is explicitly false or if it's an admin request without page param, 
      // use legacy method for backward compatibility
      if (req.query.paginated === 'false' || (!req.query.page && req.session?.isAdmin)) {
        const properties = await storage.getPropertiesLegacy(filters);
        res.json(properties);
      } else {
        const result = await storage.getProperties(filters);
        res.json(result);
      }
    } catch (error) {
      console.error("Error fetching properties:", error);
      res.status(500).json({ message: "Failed to fetch properties" });
    }
  });

  app.get("/api/properties/:idOrSlug", async (req, res) => {
    try {
      const { idOrSlug } = req.params;
      
      // Try to fetch by ID first (UUID format check)
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      let property;
      
      if (uuidRegex.test(idOrSlug)) {
        property = await storage.getProperty(idOrSlug);
      }
      
      // If not found by ID or not a UUID, try by slug
      if (!property) {
        property = await storage.getPropertyBySlug(idOrSlug);
      }
      
      if (!property) {
        return res.status(404).json({ message: "Property not found" });
      }
      
      res.json(property);
    } catch (error) {
      console.error("Error fetching property:", error);
      res.status(500).json({ message: "Failed to fetch property" });
    }
  });

  app.get("/api/properties/:idOrSlug/similar", async (req, res) => {
    try {
      const { idOrSlug } = req.params;
      
      // Try to fetch property by ID first (UUID format check)
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      let property;
      
      if (uuidRegex.test(idOrSlug)) {
        property = await storage.getProperty(idOrSlug);
      }
      
      // If not found by ID or not a UUID, try by slug
      if (!property) {
        property = await storage.getPropertyBySlug(idOrSlug);
      }
      
      if (!property) {
        return res.status(404).json({ message: "Property not found" });
      }
      
      const limit = req.query.limit ? Number(req.query.limit) : 4;
      const similar = await storage.getSimilarProperties(property.id, limit);
      res.json(similar);
    } catch (error) {
      console.error("Error fetching similar properties:", error);
      res.status(500).json({ message: "Failed to fetch similar properties" });
    }
  });

  // Property Order Management Routes
  app.patch("/api/admin/properties/:id/order", isAdmin, async (req, res) => {
    try {
      const { displayOrder } = req.body;
      
      if (typeof displayOrder !== 'number' || displayOrder < 0) {
        return res.status(400).json({ message: "Invalid displayOrder value" });
      }

      const updatedProperty = await storage.updatePropertyOrder(req.params.id, displayOrder);
      
      if (!updatedProperty) {
        return res.status(404).json({ message: "Property not found" });
      }
      
      res.json(updatedProperty);
    } catch (error) {
      console.error("Error updating property order:", error);
      res.status(500).json({ message: "Failed to update property order" });
    }
  });

  app.post("/api/admin/properties/bulk-order", isAdmin, async (req, res) => {
    try {
      const { updates } = req.body;
      
      if (!Array.isArray(updates) || updates.length === 0) {
        return res.status(400).json({ message: "Updates array is required" });
      }

      // Validate all updates have required fields
      for (const update of updates) {
        if (!update.id || typeof update.displayOrder !== 'number' || update.displayOrder < 0) {
          return res.status(400).json({ 
            message: "Each update must have an id and a valid displayOrder" 
          });
        }
      }

      await storage.bulkUpdatePropertyOrder(updates);
      res.json({ success: true, updatedCount: updates.length });
    } catch (error) {
      console.error("Error bulk updating property order:", error);
      res.status(500).json({ message: "Failed to update property order" });
    }
  });

  // Regenerate all property slugs from titles
  app.post("/api/admin/properties/regenerate-slugs", isAdmin, async (req, res) => {
    try {
      const result = await storage.regenerateAllPropertySlugs();
      res.json({
        success: true,
        updated: result.updated,
        errors: result.errors
      });
    } catch (error: any) {
      console.error("Error regenerating property slugs:", error);
      res.status(500).json({ 
        message: "Failed to regenerate property slugs",
        error: error.message 
      });
    }
  });

  // AI Suggestions Route
  app.post("/api/admin/ai/property-suggestions", isAdmin, async (req, res) => {
    try {
      const { propertyDataSchema } = await import("./ai");
      const validatedData = propertyDataSchema.parse(req.body);
      const suggestions = await generatePropertySuggestions(validatedData);
      res.json(suggestions);
    } catch (error: any) {
      console.error("Error generating AI suggestions:", error);
      // Differentiate validation errors from server errors
      if (error.name === "ZodError") {
        const validationError = fromError(error);
        return res.status(400).json({ message: validationError.toString() });
      }
      res.status(500).json({ message: "Failed to generate suggestions" });
    }
  });

  // AI Property Extraction Route
  app.post("/api/admin/ai/extract-property", isAdmin, async (req, res) => {
    try {
      const { description, images } = req.body;
      
      if (!description || typeof description !== 'string') {
        return res.status(400).json({ message: "Description is required" });
      }

      // Upload images to object storage if provided (optional - failures don't break the flow)
      let imageUrls: string[] = [];
      if (images && Array.isArray(images)) {
        for (const image of images) {
          try {
            const uploaded = await uploadPropertyImage(image.base64Data, image.filename);
            imageUrls.push(uploaded.url);
          } catch (error) {
            // Log the error but continue - images are optional for display only
            console.warn("Warning: Could not upload image during AI extraction (continuing without it):", error);
          }
        }
      }

      // Extract property data from description text only
      const extractedData = await extractPropertyFromDescription(description, imageUrls);
      
      // Return the extracted data along with uploaded image URLs
      res.json({
        ...extractedData,
        images: imageUrls
      });
    } catch (error: any) {
      console.error("Error extracting property data:", error);
      res.status(500).json({ message: error.message || "Failed to extract property information" });
    }
  });

  // AI Neighborhood Extraction Route
  app.post("/api/admin/ai/extract-neighborhood", isAdmin, async (req, res) => {
    try {
      const { description, imageBase64, imageFilename } = req.body;
      
      if (!description || typeof description !== 'string') {
        return res.status(400).json({ message: "Description is required" });
      }

      // Upload image if provided (optional)
      let imageUrl: string | undefined;
      if (imageBase64 && imageFilename) {
        try {
          const uploaded = await uploadNeighborhoodImage(imageBase64, imageFilename);
          imageUrl = uploaded.url;
        } catch (error) {
          console.warn("Warning: Could not upload neighborhood image (continuing without it):", error);
        }
      }

      // Extract neighborhood data from description text
      const extractedData = await extractNeighborhoodFromDescription(description, imageUrl);
      
      // Return the extracted data along with uploaded image URL
      res.json({
        ...extractedData,
        imageUrl
      });
    } catch (error: any) {
      console.error("Error extracting neighborhood data:", error);
      res.status(500).json({ message: error.message || "Failed to extract neighborhood information" });
    }
  });

  // AI Client Extraction Route
  app.post("/api/admin/ai/extract-client", isAdmin, async (req, res) => {
    try {
      const { description } = req.body;
      
      if (!description || typeof description !== 'string') {
        return res.status(400).json({ message: "Description is required" });
      }

      // Extract client data from description text
      const extractedData = await extractClientFromDescription(description);
      
      // Try to find mentioned properties
      const propertyIds: string[] = [];
      if (description) {
        const allProperties = await storage.getPropertiesLegacy();
        
        // Look for properties mentioned in the description
        for (const property of allProperties) {
          // Check if property title or part of it is mentioned in the description
          const titleLower = property.title.toLowerCase();
          const descLower = description.toLowerCase();
          
          // Check for exact match or partial match
          if (descLower.includes(titleLower)) {
            propertyIds.push(property.id);
          } else {
            // Check for partial matches (e.g., "Terreno de Esquina" matches "Terreno de Esquina 400m²")
            const titleWords = titleLower.split(/\s+/);
            if (titleWords.length >= 2) {
              const mainPart = titleWords.slice(0, -1).join(' '); // Remove last word (often the size)
              if (descLower.includes(mainPart)) {
                propertyIds.push(property.id);
              }
            }
          }
        }
      }
      
      res.json({ ...extractedData, propertyIds });
    } catch (error: any) {
      console.error("Error extracting client data:", error);
      res.status(500).json({ message: error.message || "Failed to extract client information" });
    }
  });

  // AI Owner Extraction Route
  app.post("/api/admin/ai/extract-owner", isAdmin, async (req, res) => {
    try {
      const { description } = req.body;
      
      if (!description || typeof description !== 'string') {
        return res.status(400).json({ message: "Description is required" });
      }

      // Extract owner data from description text
      const extractedData = await extractOwnerFromDescription(description);
      
      // Try to find mentioned properties
      const propertyIds: string[] = [];
      if (description) {
        const allProperties = await storage.getPropertiesLegacy();
        
        // Look for properties mentioned in the description
        for (const property of allProperties) {
          // Check if property title or part of it is mentioned in the description
          const titleLower = property.title.toLowerCase();
          const descLower = description.toLowerCase();
          
          // Check for exact match or partial match
          if (descLower.includes(titleLower)) {
            propertyIds.push(property.id);
          } else {
            // Check for partial matches (e.g., "Terreno de Esquina" matches "Terreno de Esquina 400m²")
            const titleWords = titleLower.split(/\s+/);
            if (titleWords.length >= 2) {
              const mainPart = titleWords.slice(0, -1).join(' '); // Remove last word (often the size)
              if (descLower.includes(mainPart)) {
                propertyIds.push(property.id);
              }
            }
          }
        }
      }
      
      res.json({ ...extractedData, propertyIds });
    } catch (error: any) {
      console.error("Error extracting owner data:", error);
      res.status(500).json({ message: error.message || "Failed to extract owner information" });
    }
  });

  // AI Financial Transaction Extraction Route
  app.post("/api/admin/ai/extract-financial", isAdmin, async (req, res) => {
    try {
      const { description } = req.body;
      
      if (!description || typeof description !== 'string') {
        return res.status(400).json({ message: "Description is required" });
      }

      // Extract financial transaction data from description text
      const extractedData = await extractFinancialFromDescription(description);
      
      res.json(extractedData);
    } catch (error: any) {
      console.error("Error extracting financial data:", error);
      res.status(500).json({ message: error.message || "Failed to extract financial information" });
    }
  });


  // Fix neighborhood names in existing properties
  app.post("/api/admin/fix-neighborhoods", isAdmin, async (req, res) => {
    try {
      const properties = await storage.getPropertiesLegacy();
      const neighborhoods = await storage.getNeighborhoods();
      
      let updatedCount = 0;
      const corrections = [];
      
      for (const property of properties) {
        let updated = false;
        let newTitle = property.title;
        let newDescription = property.description;
        let newNeighborhoodId = property.neighborhoodId;
        
        // Apply text corrections
        const titleBefore = newTitle;
        const descBefore = newDescription;
        
        newTitle = newTitle.replace(/\bCambury\b/gi, 'Camburi').replace(/\bBoissucanga\b/gi, 'Boiçucanga');
        newDescription = newDescription.replace(/\bCambury\b/gi, 'Camburi').replace(/\bBoissucanga\b/gi, 'Boiçucanga');
        
        if (titleBefore !== newTitle || descBefore !== newDescription) {
          updated = true;
        }
        
        // Try to match neighborhood if not set or needs correction
        if (!newNeighborhoodId || newTitle.toLowerCase().includes('camburi') || newTitle.toLowerCase().includes('boiçucanga')) {
          // Extract neighborhood from title
          for (const neighborhood of neighborhoods) {
            if (newTitle.toLowerCase().includes(neighborhood.name.toLowerCase())) {
              if (newNeighborhoodId !== neighborhood.id) {
                newNeighborhoodId = neighborhood.id;
                updated = true;
              }
              break;
            }
          }
        }
        
        if (updated) {
          await storage.updateProperty(property.id, {
            title: newTitle,
            description: newDescription,
            neighborhoodId: newNeighborhoodId,
          });
          
          updatedCount++;
          corrections.push({
            id: property.id,
            oldTitle: titleBefore,
            newTitle,
            neighborhoodId: newNeighborhoodId
          });
        }
      }
      
      res.json({
        success: true,
        updatedCount,
        corrections
      });
    } catch (error: any) {
      console.error("Error fixing neighborhoods:", error);
      res.status(500).json({ 
        message: error.message || "Failed to fix neighborhoods"
      });
    }
  });

  // Identify and update properties in condominiums
  app.post("/api/admin/fix-condominium-types", isAdmin, async (req, res) => {
    try {
      const properties = await storage.getPropertiesLegacy();
      
      let updatedCount = 0;
      const updates = [];
      
      // Keywords to identify condominiums in title or description
      const condominiumKeywords = [
        /\bcondom[ií]nio\b/i,
        /\bcond\.\s/i,
        /\bcond\s/i,
        /\bem\s+condom[ií]nio/i,
        /\bno\s+condom[ií]nio/i,
        /\bdentro\s+de\s+condom[ií]nio/i,
        /\bcondom[ií]nio\s+fechado/i,
      ];
      
      for (const property of properties) {
        // Skip if already set as condominio
        if (property.propertyType === 'condominio') {
          continue;
        }
        
        const titleLower = property.title.toLowerCase();
        const descriptionLower = property.description.toLowerCase();
        const combinedText = `${titleLower} ${descriptionLower}`;
        
        // Check if any keyword matches
        const isCondominium = condominiumKeywords.some(regex => regex.test(combinedText));
        
        if (isCondominium) {
          // Update the property type to condominio
          await storage.updateProperty(property.id, {
            propertyType: 'condominio',
          });
          
          updatedCount++;
          updates.push({
            id: property.id,
            title: property.title,
            oldType: property.propertyType,
            newType: 'condominio',
            matchedIn: condominiumKeywords.find(regex => regex.test(combinedText))?.source || 'unknown'
          });
        }
      }
      
      res.json({
        success: true,
        updatedCount,
        updates,
        message: `${updatedCount} imóveis foram atualizados para o tipo 'Condomínio'`
      });
    } catch (error: any) {
      console.error("Error fixing condominium types:", error);
      res.status(500).json({ 
        message: error.message || "Failed to fix condominium types"
      });
    }
  });


  // Image Upload Routes
  app.post("/api/admin/upload/property-image", isAdmin, async (req, res) => {
    try {
      const { base64Data, filename } = req.body;
      if (!base64Data || !filename) {
        return res.status(400).json({ message: "Missing base64Data or filename" });
      }
      const uploaded = await uploadPropertyImage(base64Data, filename);
      res.json(uploaded);
    } catch (error) {
      console.error("Error uploading property image:", error);
      res.status(500).json({ message: "Failed to upload image" });
    }
  });

  app.post("/api/admin/upload/neighborhood-image", isAdmin, async (req, res) => {
    try {
      const { base64Data, filename } = req.body;
      if (!base64Data || !filename) {
        return res.status(400).json({ message: "Missing base64Data or filename" });
      }
      const uploaded = await uploadNeighborhoodImage(base64Data, filename);
      res.json(uploaded);
    } catch (error) {
      console.error("Error uploading neighborhood image:", error);
      res.status(500).json({ message: "Failed to upload image" });
    }
  });

  app.post("/api/admin/upload/banner-image", isAdmin, async (req, res) => {
    try {
      const { base64Data, filename } = req.body;
      if (!base64Data || !filename) {
        return res.status(400).json({ message: "Missing base64Data or filename" });
      }
      const uploaded = await uploadBannerImage(base64Data, filename);
      res.json(uploaded);
    } catch (error) {
      console.error("Error uploading banner image:", error);
      res.status(500).json({ message: "Failed to upload image" });
    }
  });

  app.post("/api/admin/upload/background-image", isAdmin, async (req, res) => {
    try {
      const { base64Data, filename, type } = req.body;
      if (!base64Data || !filename || !type) {
        return res.status(400).json({ message: "Missing base64Data, filename or type" });
      }
      if (!['hero', 'about', 'logo'].includes(type)) {
        return res.status(400).json({ message: "Invalid type. Must be 'hero', 'about' or 'logo'" });
      }
      const uploaded = await uploadBackgroundImage(base64Data, filename, type as 'hero' | 'about' | 'logo');
      res.json(uploaded);
    } catch (error) {
      console.error("Error uploading background image:", error);
      res.status(500).json({ message: "Failed to upload background image" });
    }
  });

  app.post("/api/admin/upload/watermark-image", isAdmin, async (req, res) => {
    try {
      const { base64Data, filename } = req.body;
      if (!base64Data || !filename) {
        return res.status(400).json({ message: "Missing base64Data or filename" });
      }
      const uploaded = await uploadWatermarkImage(base64Data, filename);
      res.json(uploaded);
    } catch (error) {
      console.error("Error uploading watermark image:", error);
      res.status(500).json({ message: "Failed to upload watermark image" });
    }
  });

  // Generic image upload endpoint - uses property image folder
  app.post("/api/admin/upload-image", isAdmin, async (req, res) => {
    try {
      const { base64Data, filename, propertyFolderId } = req.body;
      if (!base64Data || !filename) {
        return res.status(400).json({ message: "Missing base64Data or filename" });
      }
      const uploaded = await uploadPropertyImage(base64Data, filename, propertyFolderId);
      res.json(uploaded);
    } catch (error) {
      console.error("Error uploading image:", error);
      res.status(500).json({ message: "Failed to upload image" });
    }
  });

  // Image Security Routes
  app.post("/api/image-tokens", async (req, res) => {
    try {
      await generateImageTokens(req, res);
    } catch (error) {
      console.error("Error generating image tokens:", error);
      res.status(500).json({ message: "Failed to generate image tokens" });
    }
  });

  app.get("/api/admin/security-stats", isAdmin, async (req, res) => {
    try {
      const stats = getSecurityStats();
      res.json(stats);
    } catch (error) {
      console.error("Error getting security stats:", error);
      res.status(500).json({ message: "Failed to get security stats" });
    }
  });

  // Apply security middleware to all image routes
  app.use('/api/images/*', secureImageMiddleware);
  app.use('*/uploads/*', secureImageMiddleware);

  // Security logging endpoint
  app.post("/api/security-log", async (req, res) => {
    try {
      const { type, timestamp, userAgent, key } = req.body;
      const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';
      
      const logEntry = {
        type,
        timestamp,
        ipAddress,
        userAgent,
        key,
        sessionId: req.sessionID
      };
      
      console.log('[SECURITY_ALERT]', JSON.stringify(logEntry));
      
      // Em produção, salvar em banco de dados
      // await storage.logSecurityEvent(logEntry);
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error logging security event:", error);
      res.status(500).json({ message: "Failed to log security event" });
    }
  });

  // Admin Properties Routes
  app.get("/api/admin/properties", isAdmin, async (req, res) => {
    try {
      const properties = await storage.getPropertiesLegacy();
      res.json(properties);
    } catch (error) {
      console.error("Error fetching admin properties:", error);
      res.status(500).json({ message: "Failed to fetch properties" });
    }
  });

  app.post("/api/admin/properties", isAdmin, async (req, res) => {
    try {
      const { propertyFolder, images, ...propertyData } = req.body;
      
      // Validate property data (excluding images)
      const validatedData = insertPropertySchema.omit({ images: true }).parse(propertyData);
      
      // Process images and upload to Supabase
      const uploadedImageUrls: string[] = [];
      
      if (images && images.length > 0) {
        for (let i = 0; i < images.length; i++) {
          const img = images[i];
          
          if (typeof img === 'string' && img.startsWith('http')) {
            // Already uploaded image URL
            uploadedImageUrls.push(img);
          } else if (typeof img === 'object' && img.base64Data) {
            // New image to upload
            const filename = `image-${i + 1}-${Date.now()}.jpg`;
            const folderName = propertyFolder || `property-${Date.now()}`;
            const uploaded = await uploadPropertyImage(img.base64Data, filename, folderName);
            uploadedImageUrls.push(uploaded.url);
          }
        }
      }
      
      // Create property with uploaded image URLs
      const propertyWithImages = {
        ...validatedData,
        images: uploadedImageUrls
      };
      
      const property = await storage.createProperty(propertyWithImages);
      res.status(201).json(property);
    } catch (error: any) {
      console.error("Error creating property:", error);
      const validationError = fromError(error);
      res.status(400).json({ message: validationError.toString() });
    }
  });

  app.patch("/api/admin/properties/:id", isAdmin, async (req, res) => {
    try {
      const { propertyFolder, images, ...propertyData } = req.body;
      
      // Process images and upload to Supabase
      const uploadedImageUrls: string[] = [];
      
      if (images && images.length > 0) {
        for (let i = 0; i < images.length; i++) {
          const img = images[i];
          
          if (typeof img === 'string' && img.startsWith('http')) {
            // Already uploaded image URL
            uploadedImageUrls.push(img);
          } else if (typeof img === 'object' && img.base64Data) {
            // New image to upload
            const filename = `image-${i + 1}-${Date.now()}.jpg`;
            const folderName = propertyFolder || `property-${Date.now()}`;
            const uploaded = await uploadPropertyImage(img.base64Data, filename, folderName);
            uploadedImageUrls.push(uploaded.url);
          }
        }
      }
      
      // Update property with new image URLs
      const propertyWithImages = {
        ...propertyData,
        images: uploadedImageUrls
      };
      
      const property = await storage.updateProperty(req.params.id, propertyWithImages);
      if (!property) {
        return res.status(404).json({ message: "Property not found" });
      }
      res.json(property);
    } catch (error) {
      console.error("Error updating property:", error);
      res.status(500).json({ message: "Failed to update property" });
    }
  });

  app.delete("/api/admin/properties/:id", isAdmin, async (req, res) => {
    try {
      const success = await storage.deleteProperty(req.params.id);
      if (!success) {
        return res.status(404).json({ message: "Property not found" });
      }
      res.json({ message: "Property deleted successfully" });
    } catch (error) {
      console.error("Error deleting property:", error);
      res.status(500).json({ message: "Failed to delete property" });
    }
  });

  app.patch("/api/admin/properties/:id/toggle-active", isAdmin, async (req, res) => {
    try {
      const property = await storage.getProperty(req.params.id);
      if (!property) {
        return res.status(404).json({ message: "Property not found" });
      }
      
      const updatedProperty = await storage.updateProperty(req.params.id, {
        isActive: !property.isActive
      });
      
      res.json(updatedProperty);
    } catch (error) {
      console.error("Error toggling property active status:", error);
      res.status(500).json({ message: "Failed to toggle property active status" });
    }
  });

  // Public Neighborhoods Routes
  app.get("/api/neighborhoods", async (req, res) => {
    try {
      const neighborhoods = await storage.getNeighborhoods();
      res.json(neighborhoods);
    } catch (error) {
      console.error("Error fetching neighborhoods:", error);
      res.status(500).json({ message: "Failed to fetch neighborhoods" });
    }
  });

  app.get("/api/neighborhoods/id/:id", async (req, res) => {
    try {
      const neighborhood = await storage.getNeighborhood(req.params.id);
      if (!neighborhood) {
        return res.status(404).json({ message: "Neighborhood not found" });
      }
      res.json(neighborhood);
    } catch (error) {
      console.error("Error fetching neighborhood:", error);
      res.status(500).json({ message: "Failed to fetch neighborhood" });
    }
  });

  app.get("/api/neighborhoods/:slug", async (req, res) => {
    try {
      const neighborhood = await storage.getNeighborhoodBySlug(req.params.slug);
      if (!neighborhood) {
        return res.status(404).json({ message: "Neighborhood not found" });
      }
      res.json(neighborhood);
    } catch (error) {
      console.error("Error fetching neighborhood:", error);
      res.status(500).json({ message: "Failed to fetch neighborhood" });
    }
  });

  app.get("/api/neighborhoods/:slug/properties", async (req, res) => {
    try {
      const neighborhood = await storage.getNeighborhoodBySlug(req.params.slug);
      if (!neighborhood) {
        return res.status(404).json({ message: "Neighborhood not found" });
      }
      const properties = await storage.getPropertiesLegacy({ neighborhoodId: neighborhood.id });
      res.json(properties);
    } catch (error) {
      console.error("Error fetching properties by neighborhood:", error);
      res.status(500).json({ message: "Failed to fetch properties" });
    }
  });

  // Admin Neighborhoods Routes
  app.post("/api/admin/neighborhoods", isAdmin, async (req, res) => {
    try {
      const validatedData = insertNeighborhoodSchema.parse(req.body);
      const neighborhood = await storage.createNeighborhood(validatedData);
      res.status(201).json(neighborhood);
    } catch (error: any) {
      console.error("Error creating neighborhood:", error);
      const validationError = fromError(error);
      res.status(400).json({ message: validationError.toString() });
    }
  });

  app.patch("/api/admin/neighborhoods/:id", isAdmin, async (req, res) => {
    try {
      const neighborhood = await storage.updateNeighborhood(req.params.id, req.body);
      if (!neighborhood) {
        return res.status(404).json({ message: "Neighborhood not found" });
      }
      res.json(neighborhood);
    } catch (error) {
      console.error("Error updating neighborhood:", error);
      res.status(500).json({ message: "Failed to update neighborhood" });
    }
  });

  app.delete("/api/admin/neighborhoods/:id", isAdmin, async (req, res) => {
    try {
      const success = await storage.deleteNeighborhood(req.params.id);
      if (!success) {
        return res.status(404).json({ message: "Neighborhood not found" });
      }
      res.json({ message: "Neighborhood deleted successfully" });
    } catch (error) {
      console.error("Error deleting neighborhood:", error);
      res.status(500).json({ message: "Failed to delete neighborhood" });
    }
  });

  // Public Banners Routes
  app.get("/api/banners", async (req, res) => {
    try {
      const activeOnly = req.query.activeOnly === 'true';
      const banners = await storage.getBanners(activeOnly);
      res.json(banners);
    } catch (error) {
      console.error("Error fetching banners:", error);
      res.status(500).json({ message: "Failed to fetch banners" });
    }
  });

  // Admin Banners Routes
  app.post("/api/admin/banners", isAdmin, async (req, res) => {
    try {
      const validatedData = insertBannerSchema.parse(req.body);
      const banner = await storage.createBanner(validatedData);
      res.status(201).json(banner);
    } catch (error: any) {
      console.error("Error creating banner:", error);
      const validationError = fromError(error);
      res.status(400).json({ message: validationError.toString() });
    }
  });

  app.patch("/api/admin/banners/:id", isAdmin, async (req, res) => {
    try {
      const banner = await storage.updateBanner(req.params.id, req.body);
      if (!banner) {
        return res.status(404).json({ message: "Banner not found" });
      }
      res.json(banner);
    } catch (error) {
      console.error("Error updating banner:", error);
      res.status(500).json({ message: "Failed to update banner" });
    }
  });

  app.delete("/api/admin/banners/:id", isAdmin, async (req, res) => {
    try {
      const success = await storage.deleteBanner(req.params.id);
      if (!success) {
        return res.status(404).json({ message: "Banner not found" });
      }
      res.json({ message: "Banner deleted successfully" });
    } catch (error) {
      console.error("Error deleting banner:", error);
      res.status(500).json({ message: "Failed to delete banner" });
    }
  });

  // Admin Clients Routes
  app.get("/api/admin/clients", isAdmin, async (req, res) => {
    try {
      const clients = await storage.getClients();
      res.json(clients);
    } catch (error) {
      console.error("Error fetching clients:", error);
      res.status(500).json({ message: "Failed to fetch clients" });
    }
  });

  app.get("/api/admin/clients/:id", isAdmin, async (req, res) => {
    try {
      const client = await storage.getClient(req.params.id);
      if (!client) {
        return res.status(404).json({ message: "Client not found" });
      }
      res.json(client);
    } catch (error) {
      console.error("Error fetching client:", error);
      res.status(500).json({ message: "Failed to fetch client" });
    }
  });

  app.post("/api/admin/clients", isAdmin, async (req, res) => {
    try {
      const validatedData = insertClientSchema.parse(req.body);
      const client = await storage.createClient(validatedData);
      res.status(201).json(client);
    } catch (error: any) {
      console.error("Error creating client:", error);
      const validationError = fromError(error);
      res.status(400).json({ message: validationError.toString() });
    }
  });

  app.patch("/api/admin/clients/:id", isAdmin, async (req, res) => {
    try {
      const client = await storage.updateClient(req.params.id, req.body);
      if (!client) {
        return res.status(404).json({ message: "Client not found" });
      }
      res.json(client);
    } catch (error) {
      console.error("Error updating client:", error);
      res.status(500).json({ message: "Failed to update client" });
    }
  });

  app.delete("/api/admin/clients/:id", isAdmin, async (req, res) => {
    try {
      const success = await storage.deleteClient(req.params.id);
      if (!success) {
        return res.status(404).json({ message: "Client not found" });
      }
      res.json({ message: "Client deleted successfully" });
    } catch (error) {
      console.error("Error deleting client:", error);
      res.status(500).json({ message: "Failed to delete client" });
    }
  });

  // Client Properties Management
  app.get("/api/admin/clients/:id/properties", isAdmin, async (req, res) => {
    try {
      const propertyIds = await storage.getClientProperties(req.params.id);
      res.json(propertyIds);
    } catch (error) {
      console.error("Error fetching client properties:", error);
      res.status(500).json({ message: "Failed to fetch client properties" });
    }
  });

  app.post("/api/admin/clients/:id/properties", isAdmin, async (req, res) => {
    try {
      const { propertyIds } = req.body;
      if (!Array.isArray(propertyIds)) {
        return res.status(400).json({ message: "propertyIds must be an array" });
      }
      await storage.setClientProperties(req.params.id, propertyIds);
      res.json({ message: "Properties updated successfully" });
    } catch (error) {
      console.error("Error updating client properties:", error);
      res.status(500).json({ message: "Failed to update client properties" });
    }
  });

  // Admin Contact History Routes
  app.get("/api/admin/clients/:id/history", isAdmin, async (req, res) => {
    try {
      const history = await storage.getContactHistory(req.params.id);
      res.json(history);
    } catch (error) {
      console.error("Error fetching contact history:", error);
      res.status(500).json({ message: "Failed to fetch contact history" });
    }
  });

  app.post("/api/admin/clients/:id/history", isAdmin, async (req, res) => {
    try {
      const validatedData = insertContactHistorySchema.parse({
        ...req.body,
        clientId: req.params.id,
      });
      const history = await storage.createContactHistory(validatedData);
      res.status(201).json(history);
    } catch (error: any) {
      console.error("Error creating contact history:", error);
      const validationError = fromError(error);
      res.status(400).json({ message: validationError.toString() });
    }
  });

  // Admin Owners Routes
  app.get("/api/admin/owners", isAdmin, async (req, res) => {
    try {
      const owners = await storage.getOwners();
      res.json(owners);
    } catch (error) {
      console.error("Error fetching owners:", error);
      res.status(500).json({ message: "Failed to fetch owners" });
    }
  });

  app.get("/api/admin/owners/:id", isAdmin, async (req, res) => {
    try {
      const owner = await storage.getOwner(req.params.id);
      if (!owner) {
        return res.status(404).json({ message: "Owner not found" });
      }
      res.json(owner);
    } catch (error) {
      console.error("Error fetching owner:", error);
      res.status(500).json({ message: "Failed to fetch owner" });
    }
  });

  app.post("/api/admin/owners", isAdmin, async (req, res) => {
    try {
      const validatedData = insertOwnerSchema.parse(req.body);
      const owner = await storage.createOwner(validatedData);
      res.status(201).json(owner);
    } catch (error: any) {
      console.error("Error creating owner:", error);
      const validationError = fromError(error);
      res.status(400).json({ message: validationError.toString() });
    }
  });

  app.patch("/api/admin/owners/:id", isAdmin, async (req, res) => {
    try {
      const owner = await storage.updateOwner(req.params.id, req.body);
      if (!owner) {
        return res.status(404).json({ message: "Owner not found" });
      }
      res.json(owner);
    } catch (error) {
      console.error("Error updating owner:", error);
      res.status(500).json({ message: "Failed to update owner" });
    }
  });

  app.delete("/api/admin/owners/:id", isAdmin, async (req, res) => {
    try {
      const success = await storage.deleteOwner(req.params.id);
      if (!success) {
        return res.status(404).json({ message: "Owner not found" });
      }
      res.json({ message: "Owner deleted successfully" });
    } catch (error) {
      console.error("Error deleting owner:", error);
      res.status(500).json({ message: "Failed to delete owner" });
    }
  });

  // Owner Properties Management
  app.get("/api/admin/owners/:id/properties", isAdmin, async (req, res) => {
    try {
      const propertyIds = await storage.getOwnerProperties(req.params.id);
      res.json(propertyIds);
    } catch (error) {
      console.error("Error fetching owner properties:", error);
      res.status(500).json({ message: "Failed to fetch owner properties" });
    }
  });

  app.post("/api/admin/owners/:id/properties", isAdmin, async (req, res) => {
    try {
      const { propertyIds } = req.body;
      if (!Array.isArray(propertyIds)) {
        return res.status(400).json({ message: "propertyIds must be an array" });
      }
      await storage.setOwnerProperties(req.params.id, propertyIds);
      res.json({ message: "Properties updated successfully" });
    } catch (error) {
      console.error("Error updating owner properties:", error);
      res.status(500).json({ message: "Failed to update owner properties" });
    }
  });

  // Admin Financial Transactions Routes
  app.get("/api/admin/financials", isAdmin, async (req, res) => {
    try {
      const filters = {
        type: req.query.type as string | undefined,
        startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
        endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
      };
      const transactions = await storage.getFinancialTransactions(filters);
      res.json(transactions);
    } catch (error) {
      console.error("Error fetching transactions:", error);
      res.status(500).json({ message: "Failed to fetch transactions" });
    }
  });

  app.get("/api/admin/financials/summary", isAdmin, async (req, res) => {
    try {
      const summary = await storage.getFinancialSummary();
      res.json(summary);
    } catch (error) {
      console.error("Error fetching financial summary:", error);
      res.status(500).json({ message: "Failed to fetch financial summary" });
    }
  });

  app.post("/api/admin/financials", isAdmin, async (req, res) => {
    try {
      const validatedData = insertFinancialTransactionSchema.parse(req.body);
      const transaction = await storage.createFinancialTransaction(validatedData);
      res.status(201).json(transaction);
    } catch (error: any) {
      console.error("Error creating transaction:", error);
      const validationError = fromError(error);
      res.status(400).json({ message: validationError.toString() });
    }
  });

  app.patch("/api/admin/financials/:id", isAdmin, async (req, res) => {
    try {
      const transaction = await storage.updateFinancialTransaction(req.params.id, req.body);
      if (!transaction) {
        return res.status(404).json({ message: "Transaction not found" });
      }
      res.json(transaction);
    } catch (error) {
      console.error("Error updating transaction:", error);
      res.status(500).json({ message: "Failed to update transaction" });
    }
  });

  app.delete("/api/admin/financials/:id", isAdmin, async (req, res) => {
    try {
      const success = await storage.deleteFinancialTransaction(req.params.id);
      if (!success) {
        return res.status(404).json({ message: "Transaction not found" });
      }
      res.json({ message: "Transaction deleted successfully" });
    } catch (error) {
      console.error("Error deleting transaction:", error);
      res.status(500).json({ message: "Failed to delete transaction" });
    }
  });

  // Public About Content Routes
  app.get("/api/about", async (req, res) => {
    try {
      const content = await storage.getAboutContent();
      res.json(content);
    } catch (error) {
      console.error("Error fetching about content:", error);
      res.status(500).json({ message: "Failed to fetch about content" });
    }
  });

  // Admin About Content Routes
  app.post("/api/admin/about", isAdmin, async (req, res) => {
    try {
      const validatedData = insertAboutContentSchema.parse(req.body);
      const content = await storage.upsertAboutContent(validatedData);
      res.status(201).json(content);
    } catch (error: any) {
      console.error("Error upserting about content:", error);
      const validationError = fromError(error);
      res.status(400).json({ message: validationError.toString() });
    }
  });

  // Admin Stats Route
  app.get("/api/admin/stats", isAdmin, async (req, res) => {
    try {
      const stats = await storage.getAdminStats();
      res.json(stats);
    } catch (error) {
      console.error("Error fetching admin stats:", error);
      res.status(500).json({ message: "Failed to fetch admin stats" });
    }
  });

  // Admin Analytics Route
  app.get("/api/admin/analytics", isAdmin, async (req, res) => {
    try {
      const analytics = await storage.getAdminAnalytics();
      // Add cache control to prevent stale data
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.json(analytics);
    } catch (error) {
      console.error("Error fetching admin analytics:", error);
      res.status(500).json({ message: "Failed to fetch admin analytics" });
    }
  });

  // Settings Routes
  app.get("/api/settings", async (req, res) => {
    try {
      const settings = await storage.getSettings();
      // Convert array to object for easier access
      const settingsObj = settings.reduce((acc, setting) => {
        acc[setting.key] = setting.value;
        return acc;
      }, {} as Record<string, string>);
      res.json(settingsObj);
    } catch (error) {
      console.error("Error fetching settings:", error);
      res.status(500).json({ message: "Failed to fetch settings" });
    }
  });

  app.get("/api/settings/:key", async (req, res) => {
    try {
      const setting = await storage.getSetting(req.params.key);
      if (!setting) {
        return res.status(404).json({ message: "Setting not found" });
      }
      res.json(setting);
    } catch (error) {
      console.error("Error fetching setting:", error);
      res.status(500).json({ message: "Failed to fetch setting" });
    }
  });

  // Admin Settings Routes
  app.post("/api/admin/settings", isAdmin, async (req, res) => {
    try {
      const { settings } = req.body;
      
      // Handle bulk update
      if (Array.isArray(settings)) {
        const results = await storage.bulkUpsertSettings(settings);
        res.json(results);
      } else {
        // Handle single setting update
        const { key, value, description } = req.body;
        if (!key || value === undefined) {
          return res.status(400).json({ message: "Key and value are required" });
        }
        const setting = await storage.upsertSetting(key, value, description);
        res.json(setting);
      }
    } catch (error) {
      console.error("Error updating settings:", error);
      res.status(500).json({ message: "Failed to update settings" });
    }
  });

  app.put("/api/admin/settings/:key", isAdmin, async (req, res) => {
    try {
      const { value, description } = req.body;
      if (value === undefined) {
        return res.status(400).json({ message: "Value is required" });
      }
      const setting = await storage.upsertSetting(req.params.key, value, description);
      res.json(setting);
    } catch (error) {
      console.error("Error updating setting:", error);
      res.status(500).json({ message: "Failed to update setting" });
    }
  });

  // Public Contact Message Routes
  app.post("/api/contact-messages", async (req, res) => {
    try {
      const validatedData = insertContactMessageSchema.parse(req.body);
      const message = await storage.createContactMessage(validatedData);
      res.json(message);
    } catch (error) {
      console.error("Error creating contact message:", error);
      if ((error as any).name === "ZodError") {
        const validationError = fromError(error);
        return res.status(400).json({ message: validationError.toString() });
      }
      res.status(500).json({ message: "Failed to send message" });
    }
  });

  // Admin Contact Message Routes
  app.get("/api/admin/contact-messages", isAdmin, async (req, res) => {
    try {
      const messages = await storage.getContactMessages();
      res.json(messages);
    } catch (error) {
      console.error("Error fetching contact messages:", error);
      res.status(500).json({ message: "Failed to fetch contact messages" });
    }
  });

  app.get("/api/admin/contact-messages/:id", isAdmin, async (req, res) => {
    try {
      const message = await storage.getContactMessage(req.params.id);
      if (!message) {
        return res.status(404).json({ message: "Message not found" });
      }
      res.json(message);
    } catch (error) {
      console.error("Error fetching contact message:", error);
      res.status(500).json({ message: "Failed to fetch contact message" });
    }
  });

  app.patch("/api/admin/contact-messages/:id/read", isAdmin, async (req, res) => {
    try {
      const message = await storage.markContactMessageAsRead(req.params.id);
      if (!message) {
        return res.status(404).json({ message: "Message not found" });
      }
      res.json(message);
    } catch (error) {
      console.error("Error marking message as read:", error);
      res.status(500).json({ message: "Failed to update message" });
    }
  });

  app.delete("/api/admin/contact-messages/:id", isAdmin, async (req, res) => {
    try {
      const deleted = await storage.deleteContactMessage(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Message not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting contact message:", error);
      res.status(500).json({ message: "Failed to delete message" });
    }
  });

  // Admin Intelligence Chat Routes
  app.post("/api/admin/intelligence/chat", isAdmin, rateLimitChat, async (req, res) => {
    const startTime = Date.now();
    console.log('[Intelligence Routes] POST /api/admin/intelligence/chat - Iniciando processamento');
    
    try {
      const { validateChatMessage, processUserMessage, IntelligenceError } = await import("./intelligence");
      
      let validatedData;
      try {
        validatedData = validateChatMessage(req.body);
        console.log('[Intelligence Routes] Dados validados com sucesso');
      } catch (error: any) {
        console.error('[Intelligence Routes] Erro de validação:', error.message);
        return res.status(400).json({ 
          message: error.userMessage || error.message || "Dados de entrada inválidos"
        });
      }

      const sessionId = req.sessionID;
      console.log('[Intelligence Routes] Processando mensagem do usuário (sessão:', sessionId, ')...');
      const result = await processUserMessage(validatedData.message, sessionId, validatedData.images);
      
      const duration = Date.now() - startTime;
      console.log(`[Intelligence Routes] Mensagem processada com sucesso em ${duration}ms`);
      
      res.json(result);
    } catch (error: any) {
      const duration = Date.now() - startTime;
      console.error(`[Intelligence Routes] Erro ao processar mensagem de chat (${duration}ms):`, error.message);
      
      const { IntelligenceError } = await import("./intelligence");
      
      if (error.name === 'IntelligenceError' || error.statusCode) {
        console.error('[Intelligence Routes] Erro de Intelligence:', {
          name: error.name,
          message: error.message,
          statusCode: error.statusCode,
          userMessage: error.userMessage,
        });
        
        return res.status(error.statusCode || 500).json({ 
          message: error.userMessage || error.message || "Erro ao processar mensagem"
        });
      }
      
      console.error('[Intelligence Routes] Erro inesperado:', error.stack);
      res.status(500).json({ 
        message: "Erro interno do servidor ao processar sua mensagem. Por favor, tente novamente."
      });
    }
  });

  app.post("/api/admin/intelligence/execute", isAdmin, rateLimitExecute, async (req, res) => {
    const startTime = Date.now();
    console.log('[Intelligence Routes] POST /api/admin/intelligence/execute - Iniciando execução');
    
    try {
      const { validateExecuteAction, executeAction, IntelligenceError } = await import("./intelligence");
      
      let validatedData;
      try {
        validatedData = validateExecuteAction(req.body);
        console.log('[Intelligence Routes] Dados de ação validados:', validatedData.messageId);
      } catch (error: any) {
        console.error('[Intelligence Routes] Erro de validação da ação:', error.message);
        return res.status(400).json({ 
          message: error.userMessage || error.message || "Dados de ação inválidos"
        });
      }

      console.log('[Intelligence Routes] Executando ação...');
      const userId = (req.user as any)?.id;
      const sessionId = req.sessionID;
      const result = await executeAction(validatedData.messageId, validatedData.confirmed, userId, sessionId);
      
      const duration = Date.now() - startTime;
      console.log(`[Intelligence Routes] Ação executada em ${duration}ms - sucesso: ${result.success}`);
      
      if (!result.success) {
        const statusCode = result.message?.includes('não encontrada') || result.message?.includes('expirada') ? 404 : 400;
        return res.status(statusCode).json(result);
      }
      
      res.json(result);
    } catch (error: any) {
      const duration = Date.now() - startTime;
      console.error(`[Intelligence Routes] Erro ao executar ação (${duration}ms):`, error.message);
      
      const { IntelligenceError } = await import("./intelligence");
      
      if (error.name === 'IntelligenceError' || error.statusCode) {
        console.error('[Intelligence Routes] Erro de Intelligence na execução:', {
          name: error.name,
          message: error.message,
          statusCode: error.statusCode,
          userMessage: error.userMessage,
        });
        
        return res.status(error.statusCode || 500).json({ 
          success: false,
          message: error.userMessage || error.message || "Erro ao executar ação"
        });
      }
      
      console.error('[Intelligence Routes] Erro inesperado na execução:', error.stack);
      res.status(500).json({ 
        success: false,
        message: "Erro interno do servidor ao executar a ação. Por favor, tente novamente."
      });
    }
  });

  app.get("/api/admin/intelligence/audit-logs", isAdmin, async (req, res) => {
    console.log('[Intelligence Routes] GET /api/admin/intelligence/audit-logs');
    
    try {
      const filters: any = {};
      
      if (req.query.userId) {
        filters.userId = req.query.userId as string;
      }
      if (req.query.action) {
        filters.action = req.query.action as string;
      }
      if (req.query.entityType) {
        filters.entityType = req.query.entityType as string;
      }
      if (req.query.status) {
        filters.status = req.query.status as string;
      }
      if (req.query.startDate) {
        filters.startDate = new Date(req.query.startDate as string);
      }
      if (req.query.endDate) {
        filters.endDate = new Date(req.query.endDate as string);
      }
      if (req.query.page) {
        filters.page = parseInt(req.query.page as string, 10);
      }
      if (req.query.limit) {
        filters.limit = parseInt(req.query.limit as string, 10);
      }
      
      console.log('[Intelligence Routes] Filtros aplicados:', filters);
      const result = await storage.getIntelligenceAuditLogs(filters);
      console.log('[Intelligence Routes] Logs recuperados:', result.logs.length, 'de', result.total);
      
      res.json(result);
    } catch (error: any) {
      console.error('[Intelligence Routes] Erro ao buscar logs de auditoria:', error.message, error.stack);
      res.status(500).json({ 
        message: "Erro ao buscar histórico de ações. Por favor, tente novamente."
      });
    }
  });

  // Clear conversation context
  app.post("/api/admin/intelligence/clear-context", isAdmin, async (req, res) => {
    console.log('[Intelligence Routes] POST /api/admin/intelligence/clear-context');
    
    try {
      const { clearContext } = await import("./intelligence");
      const sessionId = req.sessionID;
      
      clearContext(sessionId);
      console.log('[Intelligence Routes] Contexto limpo para sessão:', sessionId);
      
      res.json({ 
        success: true,
        message: "Contexto de conversa limpo com sucesso!"
      });
    } catch (error: any) {
      console.error('[Intelligence Routes] Erro ao limpar contexto:', error.message, error.stack);
      res.status(500).json({ 
        success: false,
        message: "Erro ao limpar contexto. Por favor, tente novamente."
      });
    }
  });

  // Get conversation context info
  app.get("/api/admin/intelligence/context-info", isAdmin, async (req, res) => {
    console.log('[Intelligence Routes] GET /api/admin/intelligence/context-info');
    
    try {
      const { getContextInfo } = await import("./intelligence");
      const sessionId = req.sessionID;
      
      const info = getContextInfo(sessionId);
      console.log('[Intelligence Routes] Info do contexto para sessão:', sessionId, '-', info);
      
      res.json(info);
    } catch (error: any) {
      console.error('[Intelligence Routes] Erro ao obter info do contexto:', error.message, error.stack);
      res.status(500).json({ 
        hasContext: false,
        messageCount: 0,
      });
    }
  });

  // Audio transcription endpoint
  const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 25 * 1024 * 1024 } // 25MB limit
  });

  app.post("/api/admin/intelligence/transcribe", isAdmin, upload.single('audio'), async (req, res) => {
    console.log('[Intelligence Routes] POST /api/admin/intelligence/transcribe - Iniciando transcrição');
    
    try {
      if (!req.file) {
        return res.status(400).json({ message: "Nenhum arquivo de áudio foi enviado" });
      }

      // Configure OpenAI client
      const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY || process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
        baseURL: process.env.OPENAI_API_KEY ? undefined : process.env.AI_INTEGRATIONS_OPENAI_BASE_URL
      });

      console.log('[Intelligence Routes] Transcrevendo áudio...');
      
      // Create a File object from the buffer
      const audioFile = new File([req.file.buffer], 'audio.webm', { type: req.file.mimetype });
      
      const transcription = await openai.audio.transcriptions.create({
        file: audioFile,
        model: "whisper-1",
        language: "pt",
      });

      console.log('[Intelligence Routes] Transcrição concluída:', transcription.text);
      
      res.json({ text: transcription.text });
    } catch (error: any) {
      console.error('[Intelligence Routes] Erro ao transcrever áudio:', error.message, error.stack);
      res.status(500).json({ 
        message: "Erro ao transcrever áudio. Por favor, tente novamente."
      });
    }
  });

  // Property search using Perplexity API + OpenAI for response generation
  app.post("/api/admin/intelligence/search-properties", isAdmin, async (req, res) => {
    console.log('[Intelligence Routes] POST /api/admin/intelligence/search-properties - Iniciando busca');
    
    try {
      const { query } = req.body;
      
      if (!query || typeof query !== 'string') {
        return res.status(400).json({ message: "Query de busca é obrigatória" });
      }

      const perplexityApiKey = process.env.PERPLEXITY_API_KEY;
      const openaiApiKey = process.env.OPENAI_API_KEY || process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
      
      if (!perplexityApiKey) {
        console.error('[Intelligence Routes] PERPLEXITY_API_KEY não configurada');
        return res.status(500).json({ 
          message: "Chave da API Perplexity não configurada" 
        });
      }

      if (!openaiApiKey) {
        console.error('[Intelligence Routes] OPENAI_API_KEY não configurada');
        return res.status(500).json({ 
          message: "Chave da API OpenAI não configurada" 
        });
      }

      console.log('[Intelligence Routes] Etapa 1: Buscando imóveis com Perplexity:', query);
      
      // Step 1: Use Perplexity to search for properties in São Sebastião - SP
      const searchPrompt = `Busque por imóveis à venda em São Sebastião - SP que correspondam aos seguintes critérios: ${query}. 

IMPORTANTE: A busca deve ser EXCLUSIVAMENTE na região de São Sebastião, estado de São Paulo, Brasil.

Forneça informações detalhadas sobre os imóveis encontrados, incluindo:
- Localização exata (bairro em São Sebastião - SP)
- Preço de venda
- Características principais (quartos, suítes, banheiros, vagas, área construída, área do terreno)
- Diferenciais e comodidades
- Estado de conservação
- Links ou fontes das informações

Foque apenas em imóveis À VENDA na região de São Sebastião - SP.`;

      const perplexityResponse = await fetch('https://api.perplexity.ai/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${perplexityApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'sonar-pro',
          messages: [
            {
              role: 'system',
              content: 'Você é um assistente especializado em busca de imóveis à venda em São Sebastião - SP, Brasil. Seja preciso, detalhado e forneça apenas informações sobre imóveis localizados em São Sebastião - SP.'
            },
            {
              role: 'user',
              content: searchPrompt
            }
          ],
          temperature: 0.2,
          max_tokens: 4000,
          search_recency_filter: 'month',
          return_related_questions: false
        })
      });

      if (!perplexityResponse.ok) {
        const errorText = await perplexityResponse.text();
        console.error('[Intelligence Routes] Erro na API Perplexity:', perplexityResponse.status, errorText);
        return res.status(perplexityResponse.status).json({ 
          message: `Erro ao Pesquisar Imóveis: ${perplexityResponse.statusText}` 
        });
      }

      const perplexityData = await perplexityResponse.json() as any;
      console.log('[Intelligence Routes] Resposta da Perplexity recebida');
      
      const searchResults = perplexityData.choices?.[0]?.message?.content || 'Nenhum resultado encontrado.';
      const citations = perplexityData.citations || [];
      
      console.log('[Intelligence Routes] Etapa 2: Criando resposta elaborada com OpenAI');

      // Step 2: Use OpenAI to create an elaborate response based on the search results
      const openai = new OpenAI({
        apiKey: openaiApiKey,
        baseURL: process.env.OPENAI_API_KEY ? undefined : process.env.AI_INTEGRATIONS_OPENAI_BASE_URL
      });

      const completionPrompt = `Você é um consultor imobiliário especializado em imóveis à venda em São Sebastião - SP. 

PERGUNTA DO CLIENTE:
${query}

RESULTADOS DA PESQUISA:
${searchResults}

INSTRUÇÕES:
Com base na pergunta do cliente e nos resultados da pesquisa acima, crie uma resposta profissional, amigável e bem elaborada que:

1. Cumprimente o cliente de forma cordial
2. Resuma os principais imóveis encontrados em São Sebastião - SP que atendem aos critérios
3. Destaque os diferenciais de cada opção
4. Organize as informações de forma clara e estruturada (use markdown quando apropriado)
5. Seja objetivo mas completo
6. Mencione fontes/links quando disponíveis
7. Finalize oferecendo ajuda adicional

A resposta deve ser em português do Brasil, profissional mas acessível, e focada em ajudar o cliente a tomar uma decisão informada.`;

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'Você é um consultor imobiliário experiente e prestativo, especializado em imóveis à venda em São Sebastião - SP. Sua comunicação é clara, profissional e focada em ajudar clientes a encontrar o imóvel ideal.'
          },
          {
            role: 'user',
            content: completionPrompt
          }
        ],
        temperature: 0.7,
        max_tokens: 2000,
      });

      const elaboratedResponse = completion.choices?.[0]?.message?.content || searchResults;
      
      console.log('[Intelligence Routes] Resposta elaborada criada com sucesso');
      
      res.json({ 
        results: elaboratedResponse,
        citations: citations,
        originalQuery: query,
        rawSearchResults: searchResults
      });
      
    } catch (error: any) {
      console.error('[Intelligence Routes] Erro ao Pesquisar Imóveis:', error.message, error.stack);
      res.status(500).json({ 
        message: "Erro ao Pesquisar Imóveis. Por favor, tente novamente."
      });
    }
  });

  // ============================
  // Image Security Routes
  // ============================
  
  const {
    createImageAccessToken,
    revokeImageToken,
    logImageAccess,
    imageSecurityHeaders,
    verifyImageToken,
    verifyReferer,
    verifyIpRestriction,
  } = await import("./imageSecurity");
  
  // Gerar token de acesso para uma imagem
  app.post("/api/secure-image/generate-token", async (req, res) => {
    try {
      const { imageUrl, userId } = req.body;
      
      if (!imageUrl) {
        return res.status(400).json({ error: 'URL da imagem é obrigatória' });
      }
      
      const tokenData = await createImageAccessToken(imageUrl, userId, req);
      
      res.json({
        success: true,
        token: tokenData.token,
        expiresAt: tokenData.expiresAt,
        url: tokenData.url,
      });
    } catch (error) {
      console.error('Erro ao gerar token de acesso:', error);
      res.status(500).json({ error: 'Erro ao gerar token de acesso' });
    }
  });
  
  // Servir imagem protegida com verificação de token
  app.get("/api/secure-image", 
    imageSecurityHeaders,
    verifyReferer,
    verifyIpRestriction,
    verifyImageToken,
    async (req, res) => {
      try {
        const tokenData = (req as any).imageToken;
        
        if (!tokenData || !tokenData.imageUrl) {
          return res.status(400).json({ error: 'Token inválido' });
        }
        
        // Buscar a imagem da URL original e stremar para o cliente
        // Isso evita expor a URL original
        const imageUrl = tokenData.imageUrl;
        
        // VALIDAÇÃO ADICIONAL: Verificar se a URL ainda é válida (prevenir bypass)
        const { isAllowedImageUrl } = await import("./imageSecurity");
        if (!isAllowedImageUrl(imageUrl)) {
          await logImageAccess(req, imageUrl, 'ssrf_attempt', false, 'URL de imagem não permitida no fetch');
          return res.status(403).json({ error: 'URL de imagem não autorizada' });
        }
        
        // Fazer fetch da imagem com opções de segurança
        const imageResponse = await fetch(imageUrl, {
          redirect: 'manual', // Não seguir redirecionamentos automaticamente
        });
        
        // Verificar se houve redirecionamento
        if (imageResponse.status >= 300 && imageResponse.status < 400) {
          await logImageAccess(req, imageUrl, 'redirect_attempt', false, 'Tentativa de redirecionamento detectada');
          return res.status(403).json({ error: 'Redirecionamentos não são permitidos' });
        }
        
        if (!imageResponse.ok) {
          await logImageAccess(req, imageUrl, 'fetch_error', false, `Erro ao buscar imagem: ${imageResponse.status}`);
          return res.status(imageResponse.status).json({ error: 'Erro ao buscar imagem' });
        }
        
        // Obter o content-type da imagem original
        const contentType = imageResponse.headers.get('content-type') || 'application/octet-stream';
        
        // Configurar cabeçalhos de resposta
        res.setHeader('Content-Type', contentType);
        res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        
        // Stremar a imagem para o cliente
        if (imageResponse.body) {
          const reader = imageResponse.body.getReader();
          
          const stream = async () => {
            try {
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                res.write(Buffer.from(value));
              }
              res.end();
            } catch (error) {
              console.error('Erro ao stremar imagem:', error);
              res.end();
            }
          };
          
          await stream();
        } else {
          // Fallback: converter para buffer
          const buffer = await imageResponse.arrayBuffer();
          res.send(Buffer.from(buffer));
        }
      } catch (error) {
        console.error('Erro ao servir imagem protegida:', error);
        res.status(500).json({ error: 'Erro ao servir imagem' });
      }
    }
  );
  
  // Revogar token de acesso (admin)
  app.post("/api/admin/secure-image/revoke-token", isAdmin, async (req, res) => {
    try {
      const { token } = req.body;
      
      if (!token) {
        return res.status(400).json({ error: 'Token é obrigatório' });
      }
      
      await revokeImageToken(token);
      
      res.json({ success: true, message: 'Token revogado com sucesso' });
    } catch (error) {
      console.error('Erro ao revogar token:', error);
      res.status(500).json({ error: 'Erro ao revogar token' });
    }
  });
  
  // Obter logs de acesso às imagens (admin)
  app.get("/api/admin/secure-image/access-logs", isAdmin, async (req, res) => {
    try {
      const filters = {
        imageUrl: req.query.imageUrl as string | undefined,
        ipAddress: req.query.ipAddress as string | undefined,
        accessType: req.query.accessType as string | undefined,
        success: req.query.success ? req.query.success === 'true' : undefined,
        page: req.query.page ? parseInt(req.query.page as string) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 50,
      };
      
      const result = await storage.getImageAccessLogs(filters);
      
      res.json(result);
    } catch (error) {
      console.error('Erro ao obter logs de acesso:', error);
      res.status(500).json({ error: 'Erro ao obter logs de acesso' });
    }
  });
  
  // Obter configurações de segurança de imagem (admin)
  app.get("/api/admin/secure-image/settings", isAdmin, async (req, res) => {
    try {
      const settings = await storage.getImageSecuritySettings();
      
      res.json(settings || {
        enableTokenAuth: true,
        enableRefererCheck: true,
        enableIpRestriction: false,
        tokenExpirationMinutes: 30,
        maxViewsPerToken: 10,
        enableWatermark: true,
        enableCanvasRendering: true,
        enableContextMenuBlock: true,
        enableDragBlock: true,
        enableSelectBlock: true,
        alertThreshold: 5,
      });
    } catch (error) {
      console.error('Erro ao obter configurações:', error);
      res.status(500).json({ error: 'Erro ao obter configurações' });
    }
  });
  
  // Atualizar configurações de segurança de imagem (admin)
  app.post("/api/admin/secure-image/settings", isAdmin, async (req, res) => {
    try {
      const settings = await storage.upsertImageSecuritySettings(req.body);
      
      res.json({
        success: true,
        settings,
      });
    } catch (error) {
      console.error('Erro ao atualizar configurações:', error);
      res.status(500).json({ error: 'Erro ao atualizar configurações' });
    }
  });
  
  // Registrar tentativa de acesso suspeita (frontend)
  app.post("/api/secure-image/log-suspicious-access", async (req, res) => {
    try {
      const { imageUrl, accessType, metadata } = req.body;
      
      if (!imageUrl || !accessType) {
        return res.status(400).json({ error: 'imageUrl e accessType são obrigatórios' });
      }
      
      await logImageAccess(req, imageUrl, accessType, false, 'Tentativa suspeita detectada no frontend', metadata);
      
      res.json({ success: true });
    } catch (error) {
      console.error('Erro ao registrar acesso suspeito:', error);
      res.status(500).json({ error: 'Erro ao registrar acesso' });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
