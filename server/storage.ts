import {
  type User, type InsertUser,
  type CashierSession, type InsertCashierSession,
  type Transaction, type InsertTransaction,
  users, cashierSessions, transactions
} from "@shared/schema";
import { db } from "./db";
import { eq, and, gte, lte, desc, ilike, or } from "drizzle-orm";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  createSession(session: InsertCashierSession): Promise<CashierSession>;
  getSession(id: string): Promise<CashierSession | undefined>;
  getActiveSession(cashierId: string): Promise<CashierSession | undefined>;
  endSession(id: string): Promise<CashierSession | undefined>;

  createTransaction(tx: InsertTransaction): Promise<Transaction>;
  getTransaction(id: string): Promise<Transaction | undefined>;
  getTransactionByReceipt(receiptNumber: string): Promise<Transaction | undefined>;
  listTransactions(filters: {
    cashierId?: string;
    cashOfficeId?: string;
    fromDate?: Date;
    toDate?: Date;
    status?: string;
  }): Promise<Transaction[]>;
  updateTransactionStatus(id: string, status: string, reason?: string): Promise<Transaction | undefined>;
  updateTransactionReceiptNumber(id: string, receiptNumber: string): Promise<Transaction | undefined>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async createSession(session: InsertCashierSession): Promise<CashierSession> {
    const [created] = await db.insert(cashierSessions).values(session).returning();
    return created;
  }

  async getSession(id: string): Promise<CashierSession | undefined> {
    const [session] = await db.select().from(cashierSessions).where(eq(cashierSessions.id, id));
    return session;
  }

  async getActiveSession(cashierId: string): Promise<CashierSession | undefined> {
    const [session] = await db.select().from(cashierSessions)
      .where(and(eq(cashierSessions.cashierId, cashierId), eq(cashierSessions.status, "ACTIVE")));
    return session;
  }

  async endSession(id: string): Promise<CashierSession | undefined> {
    const [updated] = await db.update(cashierSessions)
      .set({ endedAt: new Date(), status: "ENDED" })
      .where(eq(cashierSessions.id, id))
      .returning();
    return updated;
  }

  async createTransaction(tx: InsertTransaction): Promise<Transaction> {
    const [created] = await db.insert(transactions).values(tx).returning();
    return created;
  }

  async getTransaction(id: string): Promise<Transaction | undefined> {
    const [tx] = await db.select().from(transactions).where(eq(transactions.id, id));
    return tx;
  }

  async getTransactionByReceipt(receiptNumber: string): Promise<Transaction | undefined> {
    const [tx] = await db.select().from(transactions).where(eq(transactions.receiptNumber, receiptNumber));
    return tx;
  }

  async listTransactions(filters: {
    cashierId?: string;
    cashOfficeId?: string;
    fromDate?: Date;
    toDate?: Date;
    status?: string;
  }): Promise<Transaction[]> {
    const conditions = [];
    if (filters.cashierId) conditions.push(eq(transactions.cashierId, filters.cashierId));
    if (filters.cashOfficeId) conditions.push(eq(transactions.cashOfficeId!, filters.cashOfficeId));
    if (filters.fromDate) conditions.push(gte(transactions.createdAt, filters.fromDate));
    if (filters.toDate) conditions.push(lte(transactions.createdAt, filters.toDate));
    if (filters.status) conditions.push(eq(transactions.status, filters.status));

    if (conditions.length > 0) {
      return db.select().from(transactions).where(and(...conditions)).orderBy(desc(transactions.createdAt));
    }
    return db.select().from(transactions).orderBy(desc(transactions.createdAt));
  }

  async updateTransactionStatus(id: string, status: string, reason?: string): Promise<Transaction | undefined> {
    const [updated] = await db.update(transactions)
      .set({ status, cancellationReason: reason || null })
      .where(eq(transactions.id, id))
      .returning();
    return updated;
  }

  async updateTransactionReceiptNumber(id: string, receiptNumber: string): Promise<Transaction | undefined> {
    const [updated] = await db.update(transactions)
      .set({ receiptNumber })
      .where(eq(transactions.id, id))
      .returning();
    return updated;
  }
}

export const storage = new DatabaseStorage();
