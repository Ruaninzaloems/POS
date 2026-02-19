import { createContext, useContext, type ReactNode } from "react";

export interface PosAppConfig {
  apiBaseUrl?: string;
  [key: string]: any;
}

const PosConfigContext = createContext<PosAppConfig>({});

export function PosConfigProvider({
  config,
  children,
}: {
  config: PosAppConfig;
  children: ReactNode;
}) {
  return (
    <PosConfigContext.Provider value={config}>
      {children}
    </PosConfigContext.Provider>
  );
}

export function usePosConfig(): PosAppConfig {
  return useContext(PosConfigContext);
}
