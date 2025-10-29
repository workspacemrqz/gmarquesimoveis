import { sql } from 'drizzle-orm';
import {
  index,
  jsonb,
  pgTable,
  timestamp,
  varchar,
  text,
  integer,
  boolean,
  decimal,
  unique,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// Session storage table - Required for session management
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid", { length: 255 }).primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire", { mode: "date" }).notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table - Required for user management
export const users = pgTable("users", {
  id: varchar("id", { length: 255 }).primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  firstName: varchar("first_name", { length: 255 }),
  lastName: varchar("last_name", { length: 255 }),
  profileImageUrl: varchar("profile_image_url", { length: 500 }),
  isAdmin: boolean("is_admin").default(false).notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
});

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

// Neighborhoods
export const neighborhoods = pgTable("neighborhoods", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 100 }).notNull(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  description: text("description"),
  imageUrl: varchar("image_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertNeighborhoodSchema = createInsertSchema(neighborhoods).omit({
  id: true,
  slug: true, // Slug is auto-generated on the backend
  createdAt: true,
  updatedAt: true,
});

export type InsertNeighborhood = z.infer<typeof insertNeighborhoodSchema>;
export type Neighborhood = typeof neighborhoods.$inferSelect;

// Properties
export const properties = pgTable("properties", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: varchar("title", { length: 200 }).notNull(),
  slug: varchar("slug", { length: 250 }).notNull().unique(),
  description: text("description").notNull(),
  propertyType: varchar("property_type", { length: 50 }).notNull(), // casa, apartamento, terreno, comercial, condomínio
  status: varchar("status", { length: 20 }).notNull(), // venda, aluguel, ambos
  price: decimal("price", { precision: 12, scale: 2 }).notNull(),
  bedrooms: integer("bedrooms").default(0),
  bathrooms: integer("bathrooms").default(0),
  parkingSpaces: integer("parking_spaces").default(0),
  area: decimal("area", { precision: 10, scale: 2 }), // m²
  landArea: decimal("land_area", { precision: 10, scale: 2 }), // m²
  neighborhoodId: varchar("neighborhood_id").references(() => neighborhoods.id),
  isFeatured: boolean("is_featured").default(false),
  isActive: boolean("is_active").default(true),
  images: text("images").array().default(sql`'{}'::text[]`), // Array of image URLs
  amenities: text("amenities").array().default(sql`'{}'::text[]`), // Array of amenities
  externalId: varchar("external_id", { length: 100 }), // ID from gmarquesimoveis.com.br
  sourceUrl: text("source_url"), // Original URL from gmarquesimoveis.com.br
  displayOrder: integer("display_order").default(0), // Controls the display order of properties
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const propertiesRelations = relations(properties, ({ one }) => ({
  neighborhood: one(neighborhoods, {
    fields: [properties.neighborhoodId],
    references: [neighborhoods.id],
  }),
}));

export const insertPropertySchema = createInsertSchema(properties).omit({
  id: true,
  slug: true, // Slug is auto-generated on the backend from title
  createdAt: true,
  updatedAt: true,
}).extend({
  price: z.string().or(z.number()),
  area: z.string().or(z.number()).nullable().optional(),
  landArea: z.string().or(z.number()).nullable().optional(),
  displayOrder: z.number().optional(),
});

export type InsertProperty = z.infer<typeof insertPropertySchema>;
export type Property = typeof properties.$inferSelect;

// Banners
export const banners = pgTable("banners", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: varchar("title", { length: 200 }).notNull(),
  imageUrl: varchar("image_url").notNull(),
  link: varchar("link"),
  isActive: boolean("is_active").default(true),
  order: integer("order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertBannerSchema = createInsertSchema(banners).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertBanner = z.infer<typeof insertBannerSchema>;
export type Banner = typeof banners.$inferSelect;

// About content (editable from admin)
export const aboutContent = pgTable("about_content", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  section: varchar("section", { length: 50 }).notNull().unique(), // company, realtor
  title: varchar("title", { length: 200 }).notNull(),
  content: text("content").notNull(),
  imageUrl: varchar("image_url"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertAboutContentSchema = createInsertSchema(aboutContent).omit({
  id: true,
  updatedAt: true,
});

export type InsertAboutContent = z.infer<typeof insertAboutContentSchema>;
export type AboutContent = typeof aboutContent.$inferSelect;

// Clients
export const clients = pgTable("clients", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 200 }).notNull(),
  email: varchar("email", { length: 200 }),
  phone: varchar("phone", { length: 50 }),
  notes: text("notes"),
  documents: text("documents").array().default(sql`'{}'::text[]`), // Array of document URLs
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertClientSchema = createInsertSchema(clients).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertClient = z.infer<typeof insertClientSchema>;
export type Client = typeof clients.$inferSelect;

// Client Properties (many-to-many relationship for properties of interest)
export const clientProperties = pgTable("client_properties", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").references(() => clients.id, { onDelete: 'cascade' }).notNull(),
  propertyId: varchar("property_id").references(() => properties.id, { onDelete: 'cascade' }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  unique().on(table.clientId, table.propertyId)
]);

export const clientPropertiesRelations = relations(clientProperties, ({ one }) => ({
  client: one(clients, {
    fields: [clientProperties.clientId],
    references: [clients.id],
  }),
  property: one(properties, {
    fields: [clientProperties.propertyId],
    references: [properties.id],
  }),
}));

// Contact history for clients
export const contactHistory = pgTable("contact_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").references(() => clients.id, { onDelete: 'cascade' }).notNull(),
  contactType: varchar("contact_type", { length: 50 }).notNull(), // email, phone, meeting, whatsapp
  notes: text("notes"),
  contactDate: timestamp("contact_date").defaultNow(),
});

export const contactHistoryRelations = relations(contactHistory, ({ one }) => ({
  client: one(clients, {
    fields: [contactHistory.clientId],
    references: [clients.id],
  }),
}));

export const insertContactHistorySchema = createInsertSchema(contactHistory).omit({
  id: true,
});

export type InsertContactHistory = z.infer<typeof insertContactHistorySchema>;
export type ContactHistory = typeof contactHistory.$inferSelect;

// Property owners
export const owners = pgTable("owners", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 200 }).notNull(),
  email: varchar("email", { length: 200 }),
  phone: varchar("phone", { length: 50 }),
  notes: text("notes"),
  documents: text("documents").array().default(sql`'{}'::text[]`), // Array of document URLs
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertOwnerSchema = createInsertSchema(owners).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertOwner = z.infer<typeof insertOwnerSchema>;
export type Owner = typeof owners.$inferSelect;

// Owner Properties (many-to-many relationship)
export const ownerProperties = pgTable("owner_properties", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ownerId: varchar("owner_id").references(() => owners.id, { onDelete: 'cascade' }).notNull(),
  propertyId: varchar("property_id").references(() => properties.id, { onDelete: 'cascade' }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  unique().on(table.ownerId, table.propertyId)
]);

export const ownerPropertiesRelations = relations(ownerProperties, ({ one }) => ({
  owner: one(owners, {
    fields: [ownerProperties.ownerId],
    references: [owners.id],
  }),
  property: one(properties, {
    fields: [ownerProperties.propertyId],
    references: [properties.id],
  }),
}));

// Financial transactions
export const financialTransactions = pgTable("financial_transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  description: varchar("description", { length: 200 }).notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  type: varchar("type", { length: 20 }).notNull(), // receita, despesa
  category: varchar("category", { length: 50 }),
  date: timestamp("date").notNull(),
  frequencyType: varchar("frequency_type", { length: 20 }).notNull().default('unico'), // unico, semanal, mensal, anual
  dayOfMonth: integer("day_of_month"), // Para recorrências mensais: dia do mês (1-31)
  dayOfWeek: integer("day_of_week"), // Para recorrências semanais: dia da semana (0-6, 0=Domingo)
  documents: text("documents").array().default(sql`'{}'::text[]`), // Array of document URLs
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertFinancialTransactionSchema = createInsertSchema(financialTransactions).omit({
  id: true,
  createdAt: true,
}).extend({
  amount: z.string().or(z.number()),
  date: z.string(),
  dayOfMonth: z.number().min(1).max(31).optional(),
  dayOfWeek: z.number().min(0).max(6).optional(),
});

export type InsertFinancialTransaction = z.infer<typeof insertFinancialTransactionSchema>;
export type FinancialTransaction = typeof financialTransactions.$inferSelect;

// Global Settings
export const settings = pgTable("settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  key: varchar("key", { length: 100 }).notNull().unique(),
  value: text("value").notNull(),
  description: text("description"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertSettingSchema = createInsertSchema(settings).omit({
  id: true,
  updatedAt: true,
});

export type InsertSetting = z.infer<typeof insertSettingSchema>;
export type Setting = typeof settings.$inferSelect;

// Contact Messages (from website contact form)
export const contactMessages = pgTable("contact_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 200 }).notNull(),
  email: varchar("email", { length: 200 }).notNull(),
  phone: varchar("phone", { length: 50 }).notNull(),
  message: text("message").notNull(),
  isRead: boolean("is_read").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertContactMessageSchema = createInsertSchema(contactMessages).omit({
  id: true,
  isRead: true,
  createdAt: true,
});

export type InsertContactMessage = z.infer<typeof insertContactMessageSchema>;
export type ContactMessage = typeof contactMessages.$inferSelect;

// Intelligence Audit Logs
export const intelligenceAuditLogs = pgTable("intelligence_audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  action: text("action").notNull(), // update_property, create_client, delete_property, etc
  entityType: text("entity_type").notNull(), // property, client, neighborhood, owner, financial
  entityId: text("entity_id"), // ID of the affected entity
  details: jsonb("details"), // Action details (before/after data, changes)
  userMessage: text("user_message"), // Original user message
  aiResponse: text("ai_response"), // AI response
  status: varchar("status", { length: 20 }).notNull().default('success'), // success, failed, cancelled
  errorMessage: text("error_message"), // Error message if failed
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("IDX_audit_logs_created_at").on(table.createdAt),
  index("IDX_audit_logs_user_id").on(table.userId),
  index("IDX_audit_logs_action").on(table.action),
  index("IDX_audit_logs_status").on(table.status),
]);

export const insertIntelligenceAuditLogSchema = createInsertSchema(intelligenceAuditLogs).omit({
  id: true,
  createdAt: true,
});

export type InsertIntelligenceAuditLog = z.infer<typeof insertIntelligenceAuditLogSchema>;
export type IntelligenceAuditLog = typeof intelligenceAuditLogs.$inferSelect;

// Image Access Tokens - Temporary tokens for secure image viewing
export const imageAccessTokens = pgTable("image_access_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  token: varchar("token", { length: 255 }).notNull().unique(),
  imageUrl: text("image_url").notNull(), // URL da imagem protegida
  userId: varchar("user_id").references(() => users.id), // Opcional - pode ser público com token
  ipAddress: varchar("ip_address", { length: 50 }),
  userAgent: text("user_agent"),
  referer: text("referer"),
  expiresAt: timestamp("expires_at").notNull(), // Tempo de expiração do token
  maxViews: integer("max_views").default(10), // Número máximo de visualizações
  viewCount: integer("view_count").default(0), // Contador de visualizações
  isRevoked: boolean("is_revoked").default(false), // Se o token foi revogado
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("IDX_image_tokens_token").on(table.token),
  index("IDX_image_tokens_expires").on(table.expiresAt),
]);

export const insertImageAccessTokenSchema = createInsertSchema(imageAccessTokens).omit({
  id: true,
  createdAt: true,
  viewCount: true,
});

export type InsertImageAccessToken = z.infer<typeof insertImageAccessTokenSchema>;
export type ImageAccessToken = typeof imageAccessTokens.$inferSelect;

// Image Access Logs - Track all image access attempts
export const imageAccessLogs = pgTable("image_access_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  imageUrl: text("image_url").notNull(),
  tokenId: varchar("token_id").references(() => imageAccessTokens.id),
  userId: varchar("user_id").references(() => users.id),
  ipAddress: varchar("ip_address", { length: 50 }),
  userAgent: text("user_agent"),
  referer: text("referer"),
  accessType: varchar("access_type", { length: 50 }).notNull(), // view, download_attempt, right_click, devtools, etc
  success: boolean("success").default(true),
  blockReason: text("block_reason"), // Motivo do bloqueio se success = false
  metadata: jsonb("metadata"), // Dados adicionais (screen size, browser extensions detected, etc)
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("IDX_image_logs_created_at").on(table.createdAt),
  index("IDX_image_logs_ip").on(table.ipAddress),
  index("IDX_image_logs_image_url").on(table.imageUrl),
]);

export const insertImageAccessLogSchema = createInsertSchema(imageAccessLogs).omit({
  id: true,
  createdAt: true,
});

export type InsertImageAccessLog = z.infer<typeof insertImageAccessLogSchema>;
export type ImageAccessLog = typeof imageAccessLogs.$inferSelect;

// Image Security Settings - Global configuration for image protection
export const imageSecuritySettings = pgTable("image_security_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  enableTokenAuth: boolean("enable_token_auth").default(true), // Ativar autenticação por token
  enableRefererCheck: boolean("enable_referer_check").default(true), // Verificar referer
  enableIpRestriction: boolean("enable_ip_restriction").default(false), // Restringir por IP
  allowedReferers: text("allowed_referers").array().default(sql`'{}'::text[]`), // Lista de referers permitidos
  allowedIps: text("allowed_ips").array().default(sql`'{}'::text[]`), // Lista de IPs permitidos
  tokenExpirationMinutes: integer("token_expiration_minutes").default(30), // Tempo de expiração do token em minutos
  maxViewsPerToken: integer("max_views_per_token").default(10), // Máximo de visualizações por token
  enableWatermark: boolean("enable_watermark").default(true), // Ativar marca d'água
  enableCanvasRendering: boolean("enable_canvas_rendering").default(true), // Renderizar via canvas
  enableContextMenuBlock: boolean("enable_context_menu_block").default(true), // Bloquear menu de contexto
  enableDragBlock: boolean("enable_drag_block").default(true), // Bloquear arrastar
  enableSelectBlock: boolean("enable_select_block").default(true), // Bloquear seleção
  alertThreshold: integer("alert_threshold").default(5), // Número de tentativas suspeitas antes de alertar
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertImageSecuritySettingSchema = createInsertSchema(imageSecuritySettings).omit({
  id: true,
  updatedAt: true,
});

export type InsertImageSecuritySetting = z.infer<typeof insertImageSecuritySettingSchema>;
export type ImageSecuritySetting = typeof imageSecuritySettings.$inferSelect;
