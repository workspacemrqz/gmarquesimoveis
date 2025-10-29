import { 
  users,
  properties,
  neighborhoods,
  banners,
  clients,
  owners,
  financialTransactions,
  aboutContent,
  contactHistory,
  contactMessages,
  ownerProperties,
  clientProperties,
  intelligenceAuditLogs,
  imageAccessTokens,
  imageAccessLogs,
  imageSecuritySettings,
  type User,
  type UpsertUser,
  type Property,
  type InsertProperty,
  type Neighborhood,
  type InsertNeighborhood,
  type Banner,
  type InsertBanner,
  type Client,
  type InsertClient,
  type Owner,
  type InsertOwner,
  type FinancialTransaction,
  type InsertFinancialTransaction,
  type AboutContent,
  type InsertAboutContent,
  type ContactHistory,
  type InsertContactHistory,
  type ContactMessage,
  type InsertContactMessage,
  type IntelligenceAuditLog,
  type InsertIntelligenceAuditLog,
  type ImageAccessToken,
  type InsertImageAccessToken,
  type ImageAccessLog,
  type InsertImageAccessLog,
  type ImageSecuritySetting,
  type InsertImageSecuritySetting,
  settings,
  type Setting,
  type InsertSetting,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, asc, sql, gte } from "drizzle-orm";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  
  // Properties
  getProperties(filters?: {
    propertyType?: string;
    status?: string;
    minPrice?: number;
    maxPrice?: number;
    bedrooms?: number;
    bathrooms?: number;
    neighborhoodId?: string;
    isFeatured?: boolean;
    page?: number;
    limit?: number;
  }): Promise<{ properties: Property[]; total: number; page: number; totalPages: number }>;
  getPropertiesLegacy(filters?: {
    propertyType?: string;
    status?: string;
    minPrice?: number;
    maxPrice?: number;
    bedrooms?: number;
    bathrooms?: number;
    neighborhoodId?: string;
    isFeatured?: boolean;
  }): Promise<Property[]>;
  getProperty(id: string): Promise<Property | undefined>;
  getPropertyBySlug(slug: string): Promise<Property | undefined>;
  getSimilarProperties(propertyId: string, limit?: number): Promise<Property[]>;
  createProperty(property: InsertProperty): Promise<Property>;
  updateProperty(id: string, property: Partial<InsertProperty>): Promise<Property | undefined>;
  deleteProperty(id: string): Promise<boolean>;
  updatePropertyOrder(id: string, displayOrder: number): Promise<Property | undefined>;
  bulkUpdatePropertyOrder(updates: { id: string; displayOrder: number }[]): Promise<void>;
  regenerateAllPropertySlugs(): Promise<{ updated: number; errors: string[] }>;
  
  // Neighborhoods
  getNeighborhoods(): Promise<Neighborhood[]>;
  getNeighborhood(id: string): Promise<Neighborhood | undefined>;
  getNeighborhoodBySlug(slug: string): Promise<Neighborhood | undefined>;
  createNeighborhood(neighborhood: InsertNeighborhood): Promise<Neighborhood>;
  updateNeighborhood(id: string, neighborhood: Partial<InsertNeighborhood>): Promise<Neighborhood | undefined>;
  deleteNeighborhood(id: string): Promise<boolean>;
  
  // Banners
  getBanners(activeOnly?: boolean): Promise<Banner[]>;
  getBanner(id: string): Promise<Banner | undefined>;
  createBanner(banner: InsertBanner): Promise<Banner>;
  updateBanner(id: string, banner: Partial<InsertBanner>): Promise<Banner | undefined>;
  deleteBanner(id: string): Promise<boolean>;
  
  // Clients
  getClients(): Promise<Client[]>;
  getClient(id: string): Promise<Client | undefined>;
  createClient(client: InsertClient): Promise<Client>;
  updateClient(id: string, client: Partial<InsertClient>): Promise<Client | undefined>;
  deleteClient(id: string): Promise<boolean>;
  setClientProperties(clientId: string, propertyIds: string[]): Promise<void>;
  getClientProperties(clientId: string): Promise<string[]>;
  
  // Contact History
  getContactHistory(clientId: string): Promise<ContactHistory[]>;
  createContactHistory(history: InsertContactHistory): Promise<ContactHistory>;
  
  // Owners
  getOwners(): Promise<Owner[]>;
  getOwner(id: string): Promise<Owner | undefined>;
  createOwner(owner: InsertOwner): Promise<Owner>;
  updateOwner(id: string, owner: Partial<InsertOwner>): Promise<Owner | undefined>;
  deleteOwner(id: string): Promise<boolean>;
  setOwnerProperties(ownerId: string, propertyIds: string[]): Promise<void>;
  getOwnerProperties(ownerId: string): Promise<string[]>;
  
  // Financial Transactions
  getFinancialTransactions(filters?: {
    type?: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<FinancialTransaction[]>;
  getFinancialTransaction(id: string): Promise<FinancialTransaction | undefined>;
  createFinancialTransaction(transaction: InsertFinancialTransaction): Promise<FinancialTransaction>;
  updateFinancialTransaction(id: string, transaction: Partial<InsertFinancialTransaction>): Promise<FinancialTransaction | undefined>;
  deleteFinancialTransaction(id: string): Promise<boolean>;
  getFinancialSummary(): Promise<{ totalRevenue: number; totalExpenses: number; balance: number }>;
  
  // About Content
  getAboutContent(): Promise<AboutContent[]>;
  getAboutContentBySection(section: string): Promise<AboutContent | undefined>;
  upsertAboutContent(content: InsertAboutContent): Promise<AboutContent>;
  
  // Admin Stats
  getAdminStats(): Promise<{
    properties: number;
    neighborhoods: number;
    clients: number;
    banners: number;
  }>;
  
  // Settings
  getSettings(): Promise<Setting[]>;
  getSetting(key: string): Promise<Setting | undefined>;
  upsertSetting(key: string, value: string, description?: string): Promise<Setting>;
  bulkUpsertSettings(settings: { key: string; value: string; description?: string }[]): Promise<Setting[]>;
  
  // Contact Messages
  getContactMessages(): Promise<ContactMessage[]>;
  getContactMessage(id: string): Promise<ContactMessage | undefined>;
  createContactMessage(message: InsertContactMessage): Promise<ContactMessage>;
  markContactMessageAsRead(id: string): Promise<ContactMessage | undefined>;
  deleteContactMessage(id: string): Promise<boolean>;
  
  // Intelligence Audit Logs
  getIntelligenceAuditLogs(filters?: {
    userId?: string;
    action?: string;
    entityType?: string;
    status?: string;
    startDate?: Date;
    endDate?: Date;
    page?: number;
    limit?: number;
  }): Promise<{ logs: IntelligenceAuditLog[]; total: number; page: number; totalPages: number }>;
  createIntelligenceAuditLog(log: InsertIntelligenceAuditLog): Promise<IntelligenceAuditLog>;
  
  // Image Security
  getImageAccessToken(token: string): Promise<ImageAccessToken | undefined>;
  createImageAccessToken(tokenData: InsertImageAccessToken): Promise<ImageAccessToken>;
  incrementTokenViewCount(token: string): Promise<void>;
  revokeImageToken(token: string): Promise<void>;
  deleteExpiredImageTokens(): Promise<number>;
  createImageAccessLog(log: InsertImageAccessLog): Promise<ImageAccessLog>;
  getRecentFailedImageAccess(ipAddress: string, imageUrl: string, minutesBack: number): Promise<number>;
  getImageSecuritySettings(): Promise<ImageSecuritySetting | undefined>;
  upsertImageSecuritySettings(settings: Partial<InsertImageSecuritySetting>): Promise<ImageSecuritySetting>;
  getImageAccessLogs(filters?: {
    imageUrl?: string;
    ipAddress?: string;
    accessType?: string;
    success?: boolean;
    startDate?: Date;
    endDate?: Date;
    page?: number;
    limit?: number;
  }): Promise<{ logs: ImageAccessLog[]; total: number; page: number; totalPages: number }>;
}

export class DatabaseStorage implements IStorage {
  // Users
  async getUser(id: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return result[0];
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
    return result[0];
  }

  async upsertUser(user: UpsertUser): Promise<User> {
    const result = await db
      .insert(users)
      .values(user)
      .onConflictDoUpdate({
        target: users.email,
        set: {
          firstName: user.firstName,
          lastName: user.lastName,
          profileImageUrl: user.profileImageUrl,
          updatedAt: new Date(),
        },
      })
      .returning();
    return result[0];
  }

  // Properties
  async getProperties(filters?: {
    propertyType?: string;
    status?: string;
    minPrice?: number;
    maxPrice?: number;
    bedrooms?: number;
    bathrooms?: number;
    neighborhoodId?: string;
    isFeatured?: boolean;
    isActive?: boolean;
    page?: number;
    limit?: number;
  }): Promise<{ properties: Property[]; total: number; page: number; totalPages: number }> {
    const page = filters?.page || 1;
    const limit = filters?.limit || 12;
    const offset = (page - 1) * limit;
    
    // Build conditions for both queries
    const conditions = [];
    if (filters?.propertyType) {
      conditions.push(eq(properties.propertyType, filters.propertyType));
    }
    if (filters?.status) {
      conditions.push(eq(properties.status, filters.status));
    }
    if (filters?.minPrice !== undefined) {
      conditions.push(sql`${properties.price}::numeric >= ${filters.minPrice}`);
    }
    if (filters?.maxPrice !== undefined) {
      conditions.push(sql`${properties.price}::numeric <= ${filters.maxPrice}`);
    }
    if (filters?.bedrooms !== undefined) {
      conditions.push(gte(properties.bedrooms, filters.bedrooms));
    }
    if (filters?.bathrooms !== undefined) {
      conditions.push(gte(properties.bathrooms, filters.bathrooms));
    }
    if (filters?.neighborhoodId) {
      conditions.push(eq(properties.neighborhoodId, filters.neighborhoodId));
    }
    if (filters?.isFeatured !== undefined) {
      conditions.push(eq(properties.isFeatured, filters.isFeatured));
    }
    if (filters?.isActive !== undefined) {
      conditions.push(eq(properties.isActive, filters.isActive));
    }
    
    // Get total count
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    const countResult = whereClause
      ? await db.select({ count: sql<number>`count(*)` }).from(properties).where(whereClause)
      : await db.select({ count: sql<number>`count(*)` }).from(properties);
    const total = Number(countResult[0].count);
    
    // Get paginated results
    let query = db.select().from(properties);
    if (whereClause) {
      query = query.where(whereClause) as any;
    }
    
    const results = await query
      .orderBy(desc(properties.displayOrder), desc(properties.createdAt))
      .limit(limit)
      .offset(offset);
    
    return {
      properties: results,
      total,
      page,
      totalPages: Math.ceil(total / limit)
    };
  }
  
  // Legacy method for backward compatibility
  async getPropertiesLegacy(filters?: {
    propertyType?: string;
    status?: string;
    minPrice?: number;
    maxPrice?: number;
    bedrooms?: number;
    bathrooms?: number;
    neighborhoodId?: string;
    isFeatured?: boolean;
    isActive?: boolean;
  }): Promise<Property[]> {
    let query = db.select().from(properties);
    
    const conditions = [];
    if (filters?.propertyType) {
      conditions.push(eq(properties.propertyType, filters.propertyType));
    }
    if (filters?.status) {
      conditions.push(eq(properties.status, filters.status));
    }
    if (filters?.minPrice !== undefined) {
      conditions.push(sql`${properties.price}::numeric >= ${filters.minPrice}`);
    }
    if (filters?.maxPrice !== undefined) {
      conditions.push(sql`${properties.price}::numeric <= ${filters.maxPrice}`);
    }
    if (filters?.bedrooms !== undefined) {
      conditions.push(gte(properties.bedrooms, filters.bedrooms));
    }
    if (filters?.bathrooms !== undefined) {
      conditions.push(gte(properties.bathrooms, filters.bathrooms));
    }
    if (filters?.neighborhoodId) {
      conditions.push(eq(properties.neighborhoodId, filters.neighborhoodId));
    }
    if (filters?.isFeatured !== undefined) {
      conditions.push(eq(properties.isFeatured, filters.isFeatured));
    }
    if (filters?.isActive !== undefined) {
      conditions.push(eq(properties.isActive, filters.isActive));
    }
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }
    
    return query.orderBy(desc(properties.displayOrder), desc(properties.createdAt));
  }

  async getProperty(id: string): Promise<Property | undefined> {
    const result = await db.select().from(properties).where(eq(properties.id, id)).limit(1);
    return result[0];
  }

  async getPropertyBySlug(slug: string): Promise<Property | undefined> {
    const result = await db.select().from(properties).where(eq(properties.slug, slug)).limit(1);
    return result[0];
  }

  async getSimilarProperties(propertyId: string, limit = 4, activeOnly = false): Promise<Property[]> {
    const property = await this.getProperty(propertyId);
    if (!property) {
      return [];
    }

    // Find similar properties based on type, neighborhood, and price range
    const priceNum = parseFloat(property.price);
    const priceLower = priceNum * 0.7; // 30% lower
    const priceUpper = priceNum * 1.3; // 30% higher

    const conditions = [
      eq(properties.propertyType, property.propertyType),
      sql`${properties.id} != ${propertyId}`,
    ];

    if (property.neighborhoodId) {
      conditions.push(eq(properties.neighborhoodId, property.neighborhoodId));
    }

    // Filter by active status for public pages
    if (activeOnly) {
      conditions.push(eq(properties.isActive, true));
    }

    const result = await db
      .select()
      .from(properties)
      .where(and(...conditions))
      .orderBy(desc(properties.createdAt))
      .limit(limit * 2); // Get more to filter by price

    // Filter by price range and return limited results
    return result
      .filter((p) => {
        const price = parseFloat(p.price);
        return price >= priceLower && price <= priceUpper;
      })
      .slice(0, limit);
  }

  async createProperty(property: InsertProperty): Promise<Property> {
    // Generate unique slug from title
    const slug = await this.generateUniquePropertySlug(property.title);
    
    // Get the maximum displayOrder and set new property to appear first
    const maxOrderResult = await db
      .select({ maxOrder: sql<number>`COALESCE(MAX(${properties.displayOrder}), 0)` })
      .from(properties);
    const maxOrder = maxOrderResult[0]?.maxOrder || 0;
    
    const insertData: any = {
      ...property,
      slug,
      displayOrder: property.displayOrder !== undefined ? property.displayOrder : maxOrder + 1,
      price: typeof property.price === 'number' ? property.price.toString() : property.price,
      area: property.area ? (typeof property.area === 'number' ? property.area.toString() : property.area) : property.area,
      landArea: property.landArea ? (typeof property.landArea === 'number' ? property.landArea.toString() : property.landArea) : property.landArea,
    };
    const result = await db.insert(properties).values(insertData).returning();
    return result[0];
  }

  async updateProperty(id: string, property: Partial<InsertProperty>): Promise<Property | undefined> {
    const values: any = { ...property, updatedAt: new Date() };
    
    // If title is being updated, regenerate slug from new title
    if (property.title) {
      values.slug = await this.generateUniquePropertySlug(property.title, id);
    }
    
    if (property.price !== undefined) {
      values.price = typeof property.price === 'number' ? property.price.toString() : property.price;
    }
    if (property.area !== undefined) {
      values.area = typeof property.area === 'number' ? property.area.toString() : property.area;
    }
    if (property.landArea !== undefined) {
      values.landArea = typeof property.landArea === 'number' ? property.landArea.toString() : property.landArea;
    }
    const result = await db
      .update(properties)
      .set(values)
      .where(eq(properties.id, id))
      .returning();
    return result[0];
  }

  async deleteProperty(id: string): Promise<boolean> {
    const result = await db.delete(properties).where(eq(properties.id, id)).returning();
    return result.length > 0;
  }

  async updatePropertyOrder(id: string, displayOrder: number): Promise<Property | undefined> {
    const result = await db
      .update(properties)
      .set({ displayOrder, updatedAt: new Date() })
      .where(eq(properties.id, id))
      .returning();
    return result[0];
  }

  async bulkUpdatePropertyOrder(updates: { id: string; displayOrder: number }[]): Promise<void> {
    // Use a transaction to update all properties at once
    await db.transaction(async (tx) => {
      for (const { id, displayOrder } of updates) {
        await tx
          .update(properties)
          .set({ displayOrder, updatedAt: new Date() })
          .where(eq(properties.id, id));
      }
    });
  }

  async regenerateAllPropertySlugs(): Promise<{ updated: number; errors: string[] }> {
    const errors: string[] = [];
    let updated = 0;

    try {
      // Get all properties
      const allProperties = await db.select().from(properties);
      
      // Process each property
      for (const property of allProperties) {
        try {
          // Generate new slug from title
          const newSlug = await this.generateUniquePropertySlug(property.title, property.id);
          
          // Only update if slug has changed
          if (newSlug !== property.slug) {
            await db
              .update(properties)
              .set({ slug: newSlug, updatedAt: new Date() })
              .where(eq(properties.id, property.id));
            updated++;
          }
        } catch (error: any) {
          errors.push(`Erro ao regenerar slug do imóvel "${property.title}" (ID: ${property.id}): ${error.message}`);
        }
      }

      return { updated, errors };
    } catch (error: any) {
      errors.push(`Erro geral ao regenerar slugs: ${error.message}`);
      return { updated, errors };
    }
  }

  // Neighborhoods
  async getNeighborhoods(): Promise<Neighborhood[]> {
    return db.select().from(neighborhoods).orderBy(asc(neighborhoods.name));
  }

  async getNeighborhood(id: string): Promise<Neighborhood | undefined> {
    const result = await db.select().from(neighborhoods).where(eq(neighborhoods.id, id)).limit(1);
    return result[0];
  }

  async getNeighborhoodBySlug(slug: string): Promise<Neighborhood | undefined> {
    const result = await db.select().from(neighborhoods).where(eq(neighborhoods.slug, slug)).limit(1);
    return result[0];
  }

  async createNeighborhood(neighborhood: InsertNeighborhood): Promise<Neighborhood> {
    // Generate slug from name (always generate it since it's not in the insert schema)
    const slug = this.generateSlug(neighborhood.name);
    const dataToInsert = { ...neighborhood, slug };
    const result = await db.insert(neighborhoods).values(dataToInsert).returning();
    return result[0];
  }

  async updateNeighborhood(id: string, neighborhood: Partial<InsertNeighborhood>): Promise<Neighborhood | undefined> {
    const updateData: any = { ...neighborhood, updatedAt: new Date() };
    
    // If name is being updated, regenerate slug from new name
    if (neighborhood.name) {
      updateData.slug = this.generateSlug(neighborhood.name);
    }
    
    const result = await db
      .update(neighborhoods)
      .set(updateData)
      .where(eq(neighborhoods.id, id))
      .returning();
    return result[0];
  }

  private generateSlug(text: string): string {
    return text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // Remove accents
      .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/-+/g, '-') // Replace multiple hyphens with single
      .trim();
  }

  private async generateUniquePropertySlug(title: string, excludeId?: string): Promise<string> {
    const baseSlug = this.generateSlug(title);
    let slug = baseSlug;
    let counter = 2;

    // Check if slug exists (excluding the current property if updating)
    while (true) {
      const conditions = [eq(properties.slug, slug)];
      if (excludeId) {
        conditions.push(sql`${properties.id} != ${excludeId}`);
      }
      
      const existing = await db
        .select()
        .from(properties)
        .where(and(...conditions))
        .limit(1);

      if (existing.length === 0) {
        break;
      }

      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    return slug;
  }

  async deleteNeighborhood(id: string): Promise<boolean> {
    const result = await db.delete(neighborhoods).where(eq(neighborhoods.id, id)).returning();
    return result.length > 0;
  }

  // Banners
  async getBanners(activeOnly = false): Promise<Banner[]> {
    let query = db.select().from(banners);
    if (activeOnly) {
      query = query.where(eq(banners.isActive, true)) as any;
    }
    return query.orderBy(asc(banners.order));
  }

  async getBanner(id: string): Promise<Banner | undefined> {
    const result = await db.select().from(banners).where(eq(banners.id, id)).limit(1);
    return result[0];
  }

  async createBanner(banner: InsertBanner): Promise<Banner> {
    const result = await db.insert(banners).values(banner).returning();
    return result[0];
  }

  async updateBanner(id: string, banner: Partial<InsertBanner>): Promise<Banner | undefined> {
    const result = await db
      .update(banners)
      .set({ ...banner, updatedAt: new Date() })
      .where(eq(banners.id, id))
      .returning();
    return result[0];
  }

  async deleteBanner(id: string): Promise<boolean> {
    const result = await db.delete(banners).where(eq(banners.id, id)).returning();
    return result.length > 0;
  }

  // Clients
  async getClients(): Promise<Client[]> {
    return db.select().from(clients).orderBy(desc(clients.createdAt));
  }

  async getClient(id: string): Promise<Client | undefined> {
    const result = await db.select().from(clients).where(eq(clients.id, id)).limit(1);
    return result[0];
  }

  async createClient(client: InsertClient): Promise<Client> {
    const result = await db.insert(clients).values(client).returning();
    return result[0];
  }

  async updateClient(id: string, client: Partial<InsertClient>): Promise<Client | undefined> {
    const result = await db
      .update(clients)
      .set({ ...client, updatedAt: new Date() })
      .where(eq(clients.id, id))
      .returning();
    return result[0];
  }

  async deleteClient(id: string): Promise<boolean> {
    const result = await db.delete(clients).where(eq(clients.id, id)).returning();
    return result.length > 0;
  }

  // Contact History
  async getContactHistory(clientId: string): Promise<ContactHistory[]> {
    return db
      .select()
      .from(contactHistory)
      .where(eq(contactHistory.clientId, clientId))
      .orderBy(desc(contactHistory.contactDate));
  }

  async createContactHistory(history: InsertContactHistory): Promise<ContactHistory> {
    const result = await db.insert(contactHistory).values(history).returning();
    return result[0];
  }

  // Owners
  async getOwners(): Promise<Owner[]> {
    return db.select().from(owners).orderBy(desc(owners.createdAt));
  }

  async getOwner(id: string): Promise<Owner | undefined> {
    const result = await db.select().from(owners).where(eq(owners.id, id)).limit(1);
    return result[0];
  }

  async createOwner(owner: InsertOwner): Promise<Owner> {
    const result = await db.insert(owners).values(owner).returning();
    return result[0];
  }

  async updateOwner(id: string, owner: Partial<InsertOwner>): Promise<Owner | undefined> {
    const result = await db
      .update(owners)
      .set({ ...owner, updatedAt: new Date() })
      .where(eq(owners.id, id))
      .returning();
    return result[0];
  }

  async deleteOwner(id: string): Promise<boolean> {
    const result = await db.delete(owners).where(eq(owners.id, id)).returning();
    return result.length > 0;
  }

  async setOwnerProperties(ownerId: string, propertyIds: string[]): Promise<void> {
    // Delete existing relationships
    await db.delete(ownerProperties).where(eq(ownerProperties.ownerId, ownerId));
    
    // Insert new relationships
    if (propertyIds.length > 0) {
      await db.insert(ownerProperties).values(
        propertyIds.map(propertyId => ({
          ownerId,
          propertyId,
        }))
      );
    }
  }

  async getOwnerProperties(ownerId: string): Promise<string[]> {
    const result = await db
      .select({ propertyId: ownerProperties.propertyId })
      .from(ownerProperties)
      .where(eq(ownerProperties.ownerId, ownerId));
    return result.map(r => r.propertyId);
  }

  async setClientProperties(clientId: string, propertyIds: string[]): Promise<void> {
    // Delete existing relationships
    await db.delete(clientProperties).where(eq(clientProperties.clientId, clientId));
    
    // Insert new relationships
    if (propertyIds.length > 0) {
      await db.insert(clientProperties).values(
        propertyIds.map(propertyId => ({
          clientId,
          propertyId,
        }))
      );
    }
  }

  async getClientProperties(clientId: string): Promise<string[]> {
    const result = await db
      .select({ propertyId: clientProperties.propertyId })
      .from(clientProperties)
      .where(eq(clientProperties.clientId, clientId));
    return result.map(r => r.propertyId);
  }

  // Financial Transactions
  async getFinancialTransactions(filters?: {
    type?: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<FinancialTransaction[]> {
    let query = db.select().from(financialTransactions);
    
    const conditions = [];
    if (filters?.type) {
      conditions.push(eq(financialTransactions.type, filters.type));
    }
    if (filters?.startDate) {
      conditions.push(sql`${financialTransactions.date} >= ${filters.startDate}`);
    }
    if (filters?.endDate) {
      conditions.push(sql`${financialTransactions.date} <= ${filters.endDate}`);
    }
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }
    
    return query.orderBy(desc(financialTransactions.date));
  }

  async getFinancialTransaction(id: string): Promise<FinancialTransaction | undefined> {
    const result = await db
      .select()
      .from(financialTransactions)
      .where(eq(financialTransactions.id, id))
      .limit(1);
    return result[0];
  }

  async createFinancialTransaction(transaction: InsertFinancialTransaction): Promise<FinancialTransaction> {
    const values = {
      ...transaction,
      amount: typeof transaction.amount === 'string' ? transaction.amount : transaction.amount.toString(),
      date: new Date(transaction.date),
    };
    const result = await db.insert(financialTransactions).values(values).returning();
    return result[0];
  }

  async updateFinancialTransaction(
    id: string,
    transaction: Partial<InsertFinancialTransaction>
  ): Promise<FinancialTransaction | undefined> {
    const values: any = { ...transaction };
    if (transaction.amount !== undefined) {
      values.amount = typeof transaction.amount === 'string' ? transaction.amount : transaction.amount.toString();
    }
    if (transaction.date !== undefined) {
      values.date = new Date(transaction.date);
    }
    const result = await db
      .update(financialTransactions)
      .set(values)
      .where(eq(financialTransactions.id, id))
      .returning();
    return result[0];
  }

  async deleteFinancialTransaction(id: string): Promise<boolean> {
    const result = await db
      .delete(financialTransactions)
      .where(eq(financialTransactions.id, id))
      .returning();
    return result.length > 0;
  }

  async getFinancialSummary(): Promise<{ totalRevenue: number; totalExpenses: number; balance: number }> {
    const transactions = await db.select().from(financialTransactions);
    
    let totalRevenue = 0;
    let totalExpenses = 0;
    
    transactions.forEach((t) => {
      const amount = parseFloat(t.amount);
      if (t.type === 'receita') {
        totalRevenue += amount;
      } else if (t.type === 'despesa') {
        totalExpenses += amount;
      }
    });
    
    return {
      totalRevenue,
      totalExpenses,
      balance: totalRevenue - totalExpenses,
    };
  }

  // About Content
  async getAboutContent(): Promise<AboutContent[]> {
    return db.select().from(aboutContent);
  }

  async getAboutContentBySection(section: string): Promise<AboutContent | undefined> {
    const result = await db
      .select()
      .from(aboutContent)
      .where(eq(aboutContent.section, section))
      .limit(1);
    return result[0];
  }

  async upsertAboutContent(content: InsertAboutContent): Promise<AboutContent> {
    const result = await db
      .insert(aboutContent)
      .values(content)
      .onConflictDoUpdate({
        target: aboutContent.section,
        set: {
          title: content.title,
          content: content.content,
          imageUrl: content.imageUrl,
          updatedAt: new Date(),
        },
      })
      .returning();
    return result[0];
  }

  // Admin Stats
  async getAdminStats(): Promise<{
    properties: number;
    neighborhoods: number;
    clients: number;
    banners: number;
  }> {
    const [propertiesCount, neighborhoodsCount, clientsCount, bannersCount] = await Promise.all([
      db.select({ count: sql<number>`count(*)::int` }).from(properties),
      db.select({ count: sql<number>`count(*)::int` }).from(neighborhoods),
      db.select({ count: sql<number>`count(*)::int` }).from(clients),
      db.select({ count: sql<number>`count(*)::int` }).from(banners),
    ]);

    return {
      properties: propertiesCount[0]?.count || 0,
      neighborhoods: neighborhoodsCount[0]?.count || 0,
      clients: clientsCount[0]?.count || 0,
      banners: bannersCount[0]?.count || 0,
    };
  }

  async getAdminAnalytics(): Promise<{
    propertyStats: {
      byStatus: { status: string; count: number }[];
      byType: { type: string; count: number }[];
      byNeighborhood: { neighborhood: string; count: number }[];
      priceRange: { min: number; max: number; avg: number };
      recent: { month: string; count: number }[];
    };
    financialStats: {
      byMonth: { month: string; revenue: number; expense: number }[];
      totals: { revenue: number; expense: number; balance: number };
      byCategory: { category: string; amount: number }[];
    };
    clientStats: {
      total: number;
      recent: number;
      growth: number;
    };
    ownerStats: {
      total: number;
      withProperties: number;
    };
  }> {
    // Property stats by status
    const propertyByStatus = await db
      .select({
        status: properties.status,
        count: sql<number>`count(*)::int`,
      })
      .from(properties)
      .groupBy(properties.status);

    // Property stats by type
    const propertyByTypeRaw = await db
      .select({
        type: properties.propertyType,
        count: sql<number>`count(*)::int`,
      })
      .from(properties)
      .groupBy(properties.propertyType);
    
    // Convert property types to display labels using case-insensitive matching
    const getTypeLabel = (rawType: string | null | undefined): string => {
      if (!rawType) return 'Outro';
      
      const normalized = rawType.toLowerCase().trim();
      
      if (normalized === 'casa' || normalized === 'casa padrão') {
        return 'Casa padrão';
      }
      if (normalized === 'apartamento' || normalized === 'apto') {
        return 'Apartamento';
      }
      if (normalized === 'terreno') {
        return 'Terreno';
      }
      if (normalized === 'comercial') {
        return 'Comercial';
      }
      if (normalized === 'condominio' || normalized === 'condomínio' || normalized === 'casa em condomínio') {
        return 'Casa em condomínio';
      }
      
      return 'Outro';
    };
    
    const propertyByType = propertyByTypeRaw.map(item => ({
      type: getTypeLabel(item.type),
      count: item.count,
    }));

    // Property stats by neighborhood
    const propertyByNeighborhood = await db
      .select({
        neighborhood: neighborhoods.name,
        count: sql<number>`count(*)::int`,
      })
      .from(properties)
      .leftJoin(neighborhoods, eq(properties.neighborhoodId, neighborhoods.id))
      .groupBy(neighborhoods.name)
      .orderBy(sql`count(*) desc`)
      .limit(10);

    // Price statistics - fixed to work with actual status values
    const priceStats = await db
      .select({
        min: sql<number>`min(cast(${properties.price} as numeric))`,
        max: sql<number>`max(cast(${properties.price} as numeric))`,
        avg: sql<number>`avg(cast(${properties.price} as numeric))`,
      })
      .from(properties)
      .where(sql`${properties.status} IN ('venda', 'aluguel', 'ambos')`);

    // Recent properties by month (last 6 months)
    const recentProperties = await db
      .select({
        month: sql<string>`to_char(${properties.createdAt}, 'YYYY-MM')`,
        count: sql<number>`count(*)::int`,
      })
      .from(properties)
      .where(sql`${properties.createdAt} >= now() - interval '6 months'`)
      .groupBy(sql`to_char(${properties.createdAt}, 'YYYY-MM')`)
      .orderBy(sql`to_char(${properties.createdAt}, 'YYYY-MM')`);

    // Financial stats - get last 6 months of available data
    const financialByMonth = await db
      .select({
        month: sql<string>`to_char(${financialTransactions.date}, 'YYYY-MM')`,
        type: financialTransactions.type,
        amount: sql<number>`sum(cast(${financialTransactions.amount} as numeric))`,
      })
      .from(financialTransactions)
      .groupBy(sql`to_char(${financialTransactions.date}, 'YYYY-MM')`, financialTransactions.type)
      .orderBy(sql`to_char(${financialTransactions.date}, 'YYYY-MM') desc`)
      .limit(12); // Get last 12 records to ensure we have 6 months

    // Financial totals - calculate for all transactions
    const financialTotals = await db
      .select({
        type: financialTransactions.type,
        total: sql<number>`sum(cast(${financialTransactions.amount} as numeric))`,
      })
      .from(financialTransactions)
      .groupBy(financialTransactions.type);

    // Financial by category
    const financialByCategory = await db
      .select({
        category: financialTransactions.category,
        amount: sql<number>`sum(cast(${financialTransactions.amount} as numeric))`,
      })
      .from(financialTransactions)
      .where(eq(financialTransactions.type, 'receita'))
      .groupBy(financialTransactions.category)
      .orderBy(sql`sum(cast(${financialTransactions.amount} as numeric)) desc`)
      .limit(5);

    // Client stats
    const totalClients = await db.select({ count: sql<number>`count(*)::int` }).from(clients);
    const recentClients = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(clients)
      .where(sql`${clients.createdAt} >= now() - interval '30 days'`);

    // Owner stats
    const totalOwners = await db.select({ count: sql<number>`count(*)::int` }).from(owners);

    // Process financial data for chart - group data by month
    const monthlyFinancial: { [key: string]: { revenue: number; expense: number } } = {};
    
    // Get unique months from the data
    const uniqueMonths = new Set<string>();
    financialByMonth.forEach((item) => {
      uniqueMonths.add(item.month);
      if (!monthlyFinancial[item.month]) {
        monthlyFinancial[item.month] = { revenue: 0, expense: 0 };
      }
      if (item.type === 'receita') {
        monthlyFinancial[item.month].revenue = item.amount || 0;
      } else if (item.type === 'despesa') {
        monthlyFinancial[item.month].expense = item.amount || 0;
      }
    });
    
    // Sort months and take last 6
    const sortedMonths = Array.from(uniqueMonths).sort().slice(-6);
    
    const financialByMonthArray = sortedMonths.map((month) => {
      const [year, monthNum] = month.split('-');
      const monthName = new Date(parseInt(year), parseInt(monthNum) - 1).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' });
      return {
        month: monthName,
        revenue: monthlyFinancial[month]?.revenue || 0,
        expense: monthlyFinancial[month]?.expense || 0,
      };
    });

    const revenue = financialTotals.find((t) => t.type === 'receita')?.total || 0;
    const expense = financialTotals.find((t) => t.type === 'despesa')?.total || 0;

    return {
      propertyStats: {
        byStatus: propertyByStatus.map((p) => ({
          status: p.status === 'venda' ? 'Para Venda' : 
                  p.status === 'aluguel' ? 'Para Aluguel' : 
                  p.status === 'ambos' ? 'Venda/Aluguel' : 
                  p.status === 'vendido' ? 'Vendido' : 'Inativo',
          count: p.count,
        })),
        byType: propertyByType,
        byNeighborhood: propertyByNeighborhood.map((p) => ({
          neighborhood: p.neighborhood || 'Sem bairro',
          count: p.count,
        })),
        priceRange: {
          min: priceStats[0]?.min || 0,
          max: priceStats[0]?.max || 0,
          avg: priceStats[0]?.avg || 0,
        },
        recent: recentProperties.map((p) => ({
          month: p.month,
          count: p.count,
        })),
      },
      financialStats: {
        byMonth: financialByMonthArray,
        totals: {
          revenue,
          expense,
          balance: revenue - expense,
        },
        byCategory: financialByCategory.map((c) => ({
          category: c.category || 'Sem categoria',
          amount: c.amount,
        })),
      },
      clientStats: {
        total: totalClients[0]?.count || 0,
        recent: recentClients[0]?.count || 0,
        growth: totalClients[0]?.count ? 
          ((recentClients[0]?.count || 0) / totalClients[0].count) * 100 : 0,
      },
      ownerStats: {
        total: totalOwners[0]?.count || 0,
        withProperties: 0, // Could be implemented with a join
      },
    };
  }
  
  // Settings
  async getSettings(): Promise<Setting[]> {
    return await db.select().from(settings);
  }
  
  async getSetting(key: string): Promise<Setting | undefined> {
    const result = await db.select().from(settings).where(eq(settings.key, key)).limit(1);
    return result[0];
  }
  
  async upsertSetting(key: string, value: string, description?: string): Promise<Setting> {
    const existingSetting = await this.getSetting(key);
    
    if (existingSetting) {
      const updated = await db
        .update(settings)
        .set({ value, description, updatedAt: new Date() })
        .where(eq(settings.key, key))
        .returning();
      return updated[0];
    } else {
      const created = await db
        .insert(settings)
        .values({ key, value, description })
        .returning();
      return created[0];
    }
  }
  
  async bulkUpsertSettings(settingsToUpsert: { key: string; value: string; description?: string }[]): Promise<Setting[]> {
    const results: Setting[] = [];
    
    for (const setting of settingsToUpsert) {
      const result = await this.upsertSetting(setting.key, setting.value, setting.description);
      results.push(result);
    }
    
    return results;
  }
  
  // Contact Messages
  async getContactMessages(): Promise<ContactMessage[]> {
    return await db.select().from(contactMessages).orderBy(desc(contactMessages.createdAt));
  }
  
  async getContactMessage(id: string): Promise<ContactMessage | undefined> {
    const result = await db.select().from(contactMessages).where(eq(contactMessages.id, id)).limit(1);
    return result[0];
  }
  
  async createContactMessage(message: InsertContactMessage): Promise<ContactMessage> {
    const result = await db.insert(contactMessages).values(message).returning();
    return result[0];
  }
  
  async markContactMessageAsRead(id: string): Promise<ContactMessage | undefined> {
    const result = await db
      .update(contactMessages)
      .set({ isRead: true })
      .where(eq(contactMessages.id, id))
      .returning();
    return result[0];
  }
  
  async deleteContactMessage(id: string): Promise<boolean> {
    const result = await db.delete(contactMessages).where(eq(contactMessages.id, id)).returning();
    return result.length > 0;
  }
  
  // Intelligence Audit Logs
  async getIntelligenceAuditLogs(filters?: {
    userId?: string;
    action?: string;
    entityType?: string;
    status?: string;
    startDate?: Date;
    endDate?: Date;
    page?: number;
    limit?: number;
  }): Promise<{ logs: IntelligenceAuditLog[]; total: number; page: number; totalPages: number }> {
    const page = filters?.page || 1;
    const limit = filters?.limit || 20;
    const offset = (page - 1) * limit;
    
    const conditions = [];
    if (filters?.userId) {
      conditions.push(eq(intelligenceAuditLogs.userId, filters.userId));
    }
    if (filters?.action) {
      conditions.push(eq(intelligenceAuditLogs.action, filters.action));
    }
    if (filters?.entityType) {
      conditions.push(eq(intelligenceAuditLogs.entityType, filters.entityType));
    }
    if (filters?.status) {
      conditions.push(eq(intelligenceAuditLogs.status, filters.status));
    }
    if (filters?.startDate) {
      conditions.push(sql`${intelligenceAuditLogs.createdAt} >= ${filters.startDate}`);
    }
    if (filters?.endDate) {
      conditions.push(sql`${intelligenceAuditLogs.createdAt} <= ${filters.endDate}`);
    }
    
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    
    const countResult = whereClause
      ? await db.select({ count: sql<number>`count(*)` }).from(intelligenceAuditLogs).where(whereClause)
      : await db.select({ count: sql<number>`count(*)` }).from(intelligenceAuditLogs);
    const total = Number(countResult[0].count);
    
    let query = db.select().from(intelligenceAuditLogs);
    if (whereClause) {
      query = query.where(whereClause) as any;
    }
    
    const results = await query
      .orderBy(desc(intelligenceAuditLogs.createdAt))
      .limit(limit)
      .offset(offset);
    
    return {
      logs: results,
      total,
      page,
      totalPages: Math.ceil(total / limit)
    };
  }
  
  async createIntelligenceAuditLog(log: InsertIntelligenceAuditLog): Promise<IntelligenceAuditLog> {
    const result = await db.insert(intelligenceAuditLogs).values(log).returning();
    return result[0];
  }
  
  // Image Security
  async getImageAccessToken(token: string): Promise<ImageAccessToken | undefined> {
    const result = await db.select().from(imageAccessTokens).where(eq(imageAccessTokens.token, token)).limit(1);
    return result[0];
  }
  
  async createImageAccessToken(tokenData: InsertImageAccessToken): Promise<ImageAccessToken> {
    const result = await db.insert(imageAccessTokens).values(tokenData).returning();
    return result[0];
  }
  
  async incrementTokenViewCount(token: string): Promise<void> {
    await db
      .update(imageAccessTokens)
      .set({ viewCount: sql`${imageAccessTokens.viewCount} + 1` })
      .where(eq(imageAccessTokens.token, token));
  }
  
  async revokeImageToken(token: string): Promise<void> {
    await db
      .update(imageAccessTokens)
      .set({ isRevoked: true })
      .where(eq(imageAccessTokens.token, token));
  }
  
  async deleteExpiredImageTokens(): Promise<number> {
    const result = await db
      .delete(imageAccessTokens)
      .where(sql`${imageAccessTokens.expiresAt} < NOW()`)
      .returning();
    return result.length;
  }
  
  async createImageAccessLog(log: InsertImageAccessLog): Promise<ImageAccessLog> {
    const result = await db.insert(imageAccessLogs).values(log).returning();
    return result[0];
  }
  
  async getRecentFailedImageAccess(ipAddress: string, imageUrl: string, minutesBack: number): Promise<number> {
    const cutoffTime = new Date(Date.now() - minutesBack * 60 * 1000);
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(imageAccessLogs)
      .where(
        and(
          eq(imageAccessLogs.ipAddress, ipAddress),
          eq(imageAccessLogs.imageUrl, imageUrl),
          eq(imageAccessLogs.success, false),
          gte(imageAccessLogs.createdAt, cutoffTime)
        )
      );
    return Number(result[0]?.count || 0);
  }
  
  async getImageSecuritySettings(): Promise<ImageSecuritySetting | undefined> {
    const result = await db.select().from(imageSecuritySettings).limit(1);
    return result[0];
  }
  
  async upsertImageSecuritySettings(settings: Partial<InsertImageSecuritySetting>): Promise<ImageSecuritySetting> {
    // Primeiro, tentar obter as configurações existentes
    const existing = await this.getImageSecuritySettings();
    
    if (existing) {
      // Atualizar configurações existentes
      const result = await db
        .update(imageSecuritySettings)
        .set({ ...settings, updatedAt: new Date() })
        .where(eq(imageSecuritySettings.id, existing.id))
        .returning();
      return result[0];
    } else {
      // Criar novas configurações
      const result = await db.insert(imageSecuritySettings).values(settings as InsertImageSecuritySetting).returning();
      return result[0];
    }
  }
  
  async getImageAccessLogs(filters?: {
    imageUrl?: string;
    ipAddress?: string;
    accessType?: string;
    success?: boolean;
    startDate?: Date;
    endDate?: Date;
    page?: number;
    limit?: number;
  }): Promise<{ logs: ImageAccessLog[]; total: number; page: number; totalPages: number }> {
    const page = filters?.page || 1;
    const limit = filters?.limit || 50;
    const offset = (page - 1) * limit;
    
    const conditions = [];
    if (filters?.imageUrl) {
      conditions.push(eq(imageAccessLogs.imageUrl, filters.imageUrl));
    }
    if (filters?.ipAddress) {
      conditions.push(eq(imageAccessLogs.ipAddress, filters.ipAddress));
    }
    if (filters?.accessType) {
      conditions.push(eq(imageAccessLogs.accessType, filters.accessType));
    }
    if (filters?.success !== undefined) {
      conditions.push(eq(imageAccessLogs.success, filters.success));
    }
    if (filters?.startDate) {
      conditions.push(sql`${imageAccessLogs.createdAt} >= ${filters.startDate}`);
    }
    if (filters?.endDate) {
      conditions.push(sql`${imageAccessLogs.createdAt} <= ${filters.endDate}`);
    }
    
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    
    const countResult = whereClause
      ? await db.select({ count: sql<number>`count(*)` }).from(imageAccessLogs).where(whereClause)
      : await db.select({ count: sql<number>`count(*)` }).from(imageAccessLogs);
    const total = Number(countResult[0].count);
    
    let query = db.select().from(imageAccessLogs);
    if (whereClause) {
      query = query.where(whereClause) as any;
    }
    
    const results = await query
      .orderBy(desc(imageAccessLogs.createdAt))
      .limit(limit)
      .offset(offset);
    
    return {
      logs: results,
      total,
      page,
      totalPages: Math.ceil(total / limit)
    };
  }
}

export const storage = new DatabaseStorage();
