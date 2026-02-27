import { vi } from 'vitest';

vi.stubGlobal('fetch', vi.fn());

vi.mock('@/lib/pos-config-context', () => ({
  resolveApiUrl: (path: string) => `http://localhost:5000${path}`,
  getAuthHeaders: () => ({ 'Content-Type': 'application/json' }),
}));
