import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, numeric, timestamp, boolean, jsonb, serial } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export const cashierSessions = pgTable("cashier_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  cashierId: text("cashier_id").notNull(),
  cashierName: text("cashier_name").notNull(),
  cashOfficeId: text("cash_office_id").notNull(),
  cashOfficeName: text("cash_office_name"),
  floatAmount: numeric("float_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  startedAt: timestamp("started_at").notNull().defaultNow(),
  endedAt: timestamp("ended_at"),
  status: text("status").notNull().default("ACTIVE"),
});

export const insertCashierSessionSchema = createInsertSchema(cashierSessions).omit({
  id: true,
  startedAt: true,
  endedAt: true,
});

export type InsertCashierSession = z.infer<typeof insertCashierSessionSchema>;
export type CashierSession = typeof cashierSessions.$inferSelect;

export const transactions = pgTable("transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  receiptNumber: text("receipt_number").notNull(),
  sessionId: varchar("session_id"),
  cashierId: text("cashier_id").notNull(),
  cashierName: text("cashier_name"),
  cashOfficeId: text("cash_office_id"),
  totalAmount: numeric("total_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  cashAmount: numeric("cash_amount", { precision: 12, scale: 2 }).default("0"),
  cardAmount: numeric("card_amount", { precision: 12, scale: 2 }).default("0"),
  chequeAmount: numeric("cheque_amount", { precision: 12, scale: 2 }).default("0"),
  tenderAmount: numeric("tender_amount", { precision: 12, scale: 2 }).default("0"),
  changeAmount: numeric("change_amount", { precision: 12, scale: 2 }).default("0"),
  paymentType: text("payment_type").default("Cash"),
  status: text("status").notNull().default("COMPLETED"),
  cancellationReason: text("cancellation_reason"),
  items: jsonb("items").default([]),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertTransactionSchema = createInsertSchema(transactions).omit({
  id: true,
  createdAt: true,
});

export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type Transaction = typeof transactions.$inferSelect;

export const legalRuleVersions = pgTable("legal_rule_versions", {
  id: serial("id").primaryKey(),
  ruleCode: text("rule_code").notNull().unique(),
  legislationRef: text("legislation_ref").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  version: integer("version").notNull().default(1),
  effectiveFrom: timestamp("effective_from").notNull().defaultNow(),
  effectiveTo: timestamp("effective_to"),
  category: text("category").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertLegalRuleVersionSchema = createInsertSchema(legalRuleVersions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertLegalRuleVersion = z.infer<typeof insertLegalRuleVersionSchema>;
export type LegalRuleVersion = typeof legalRuleVersions.$inferSelect;

export const legalComplianceLog = pgTable("legal_compliance_log", {
  id: serial("id").primaryKey(),
  actionType: text("action_type").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  ruleVersionId: integer("rule_version_id"),
  legislationRef: text("legislation_ref"),
  processStage: text("process_stage"),
  proofOfDelivery: text("proof_of_delivery"),
  userId: text("user_id"),
  userName: text("user_name"),
  ipAddress: text("ip_address"),
  apiCallId: text("api_call_id").notNull(),
  documentVersion: text("document_version"),
  communicationProof: jsonb("communication_proof"),
  metadata: jsonb("metadata"),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
});

export const insertLegalComplianceLogSchema = createInsertSchema(legalComplianceLog).omit({
  id: true,
  timestamp: true,
});

export type InsertLegalComplianceLog = z.infer<typeof insertLegalComplianceLogSchema>;
export type LegalComplianceLog = typeof legalComplianceLog.$inferSelect;

export const litigationEvidenceBundles = pgTable("litigation_evidence_bundles", {
  id: serial("id").primaryKey(),
  accountNo: text("account_no").notNull(),
  bundleReference: text("bundle_reference").notNull().unique(),
  generatedBy: text("generated_by").notNull(),
  generatedAt: timestamp("generated_at").notNull().defaultNow(),
  bundleData: jsonb("bundle_data"),
  status: text("status").notNull().default("GENERATED"),
});

export const insertLitigationEvidenceBundleSchema = createInsertSchema(litigationEvidenceBundles).omit({
  id: true,
  generatedAt: true,
});

export type InsertLitigationEvidenceBundle = z.infer<typeof insertLitigationEvidenceBundleSchema>;
export type LitigationEvidenceBundle = typeof litigationEvidenceBundles.$inferSelect;
