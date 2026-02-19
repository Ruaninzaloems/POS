import { createContext, useContext, useEffect, type ReactNode } from "react";

export interface PosAppConfig {
  apiBaseUrl?: string;
  authToken?: string;
  [key: string]: any;
}

let _globalConfig: PosAppConfig = {};

export function getGlobalConfig(): PosAppConfig {
  return _globalConfig;
}

export function setGlobalConfig(config: PosAppConfig): void {
  _globalConfig = { ..._globalConfig, ...config };
}

export function resolveApiUrl(path: string): string {
  const base = _globalConfig.apiBaseUrl;
  if (!base) return path;
  const cleanBase = base.replace(/\/+$/, "");
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${cleanBase}${cleanPath}`;
}

export function getAuthHeaders(): Record<string, string> {
  const token = _globalConfig.authToken;
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

const PosConfigContext = createContext<PosAppConfig>({});

export function PosConfigProvider({
  config,
  children,
}: {
  config: PosAppConfig;
  children: ReactNode;
}) {
  useEffect(() => {
    setGlobalConfig(config);
  }, [config]);

  return (
    <PosConfigContext.Provider value={config}>
      {children}
    </PosConfigContext.Provider>
  );
}

export function usePosConfig(): PosAppConfig {
  return useContext(PosConfigContext);
}
