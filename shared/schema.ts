import { sql } from "drizzle-orm";
import { pgTable, text, varchar, numeric, timestamp, jsonb, serial, integer, boolean } from "drizzle-orm/pg-core";
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

export const conversations = pgTable("conversations", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").notNull(),
  role: text("role").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const communicationLogs = pgTable("communication_logs", {
  id: serial("id").primaryKey(),
  accountId: text("account_id").notNull(),
  accountNumber: text("account_number"),
  accountHolder: text("account_holder"),
  method: text("method").notNull(),
  recipients: text("recipients").notNull(),
  subject: text("subject"),
  messageBody: text("message_body"),
  statementType: text("statement_type"),
  financialYear: text("financial_year"),
  periodFrom: text("period_from"),
  periodTo: text("period_to"),
  status: text("status").notNull().default("sent"),
  sentBy: text("sent_by"),
  sentByName: text("sent_by_name"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertCommunicationLogSchema = createInsertSchema(communicationLogs).omit({
  id: true,
  createdAt: true,
});

export type InsertCommunicationLog = z.infer<typeof insertCommunicationLogSchema>;
export type CommunicationLog = typeof communicationLogs.$inferSelect;
