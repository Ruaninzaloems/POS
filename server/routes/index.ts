import type { Express } from "express";
import type { Server } from "http";
import { registerAuthRoutes } from "./auth.routes";
import { registerPosRoutes } from "./pos.routes";
import { registerBillingRoutes } from "./billing.routes";
import { registerClearanceRoutes } from "./clearance.routes";
import { registerEnquiriesRoutes } from "./enquiries.routes";
import { registerDayendRoutes } from "./dayend.routes";
import { registerDepositsRoutes } from "./deposits.routes";
import { registerSupervisorRoutes } from "./supervisor.routes";
import { registerReceiptsRoutes } from "./receipts.routes";
import { registerDebtRoutes } from "./debt.routes";
import { registerLegalRoutes } from "./legal.routes";
import { registerCommunicationsRoutes } from "./communications.routes";
import { registerAnalyticsRoutes } from "./analytics.routes";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  registerAuthRoutes(app, httpServer);
  registerPosRoutes(app, httpServer);
  registerBillingRoutes(app, httpServer);
  registerClearanceRoutes(app, httpServer);
  registerEnquiriesRoutes(app, httpServer);
  registerDayendRoutes(app, httpServer);
  registerDepositsRoutes(app, httpServer);
  registerSupervisorRoutes(app, httpServer);
  registerReceiptsRoutes(app, httpServer);
  registerDebtRoutes(app, httpServer);
  registerLegalRoutes(app, httpServer);
  registerCommunicationsRoutes(app, httpServer);
  registerAnalyticsRoutes(app, httpServer);

  return httpServer;
}
