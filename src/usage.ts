/**
 * Usage information module for Claude Relay Service
 */

// Type definitions
interface CostInfo {
  used: number;
  total: number;
}

interface DailyUsage {
  cost: CostInfo;
  tokens: number;
}

interface MonthlyUsage {
  cost: CostInfo;
  tokens: number;
}

interface TotalUsage {
  cost: CostInfo;
  tokens: number;
}

export interface UsageInfo {
  daily: DailyUsage;
  monthly: MonthlyUsage;
  total: TotalUsage;
  lastUpdate: Date;
  error?: string;
}

// API response types
interface ApiResponse<T> {
  success: boolean;
  data?: T;
}

interface KeyIdData {
  id: string;
}

interface UserStatsData {
  usage?: {
    total?: {
      allTokens?: number;
    };
  };
  limits: {
    currentDailyCost?: number;
    dailyCostLimit?: number;
    currentTotalCost?: number;
    totalCostLimit?: number;
  };
}

interface ModelStatsData {
  allTokens?: number;
  costs?: {
    total?: number;
  };
}

// Cache configuration
const CACHE_TTL_MS = 10 * 1000;

// Cache state
let cachedResult: UsageInfo | null = null;
let lastFetchTime = 0;

/**
 * Clear the usage cache
 */
export function clearCache(): void {
  cachedResult = null;
  lastFetchTime = 0;
}

/**
 * Get API ID from API Key
 */
async function getApiId(baseUrl: string, apiKey: string): Promise<string> {
  const response = await fetch(`${baseUrl}/apiStats/api/get-key-id`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ apiKey }),
  });

  if (!response.ok) {
    throw new Error(`Failed to get API ID: ${response.status}`);
  }

  const data = (await response.json()) as ApiResponse<KeyIdData>;
  if (!data.success || !data.data?.id) {
    throw new Error('Invalid response from get-key-id API');
  }

  return data.data.id;
}

/**
 * Get user stats from API ID
 */
async function getUserStats(baseUrl: string, apiId: string): Promise<UserStatsData> {
  const response = await fetch(`${baseUrl}/apiStats/api/user-stats`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ apiId }),
  });

  if (!response.ok) {
    throw new Error(`Failed to get user stats: ${response.status}`);
  }

  const data = (await response.json()) as ApiResponse<UserStatsData>;
  if (!data.success || !data.data) {
    throw new Error('Invalid response from user-stats API');
  }

  return data.data;
}

/**
 * Get user model stats for a specific period
 */
async function getUserModelStats(
  baseUrl: string,
  apiId: string,
  period: 'daily' | 'monthly'
): Promise<ModelStatsData[]> {
  const response = await fetch(`${baseUrl}/apiStats/api/user-model-stats`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ apiId, period }),
  });

  if (!response.ok) {
    throw new Error(`Failed to get user model stats: ${response.status}`);
  }

  const data = (await response.json()) as ApiResponse<ModelStatsData[]>;
  if (!data.success || !data.data) {
    throw new Error('Invalid response from user-model-stats API');
  }

  return data.data;
}

/**
 * Fetch fresh usage data from API
 */
async function fetchUsageData(baseUrl: string, apiKey: string): Promise<UsageInfo> {
  // Step 1: Get API ID from API Key
  const apiId = await getApiId(baseUrl, apiKey);

  // Step 2: Get user stats and monthly model stats in parallel
  const [stats, monthlyModelStats] = await Promise.all([
    getUserStats(baseUrl, apiId),
    getUserModelStats(baseUrl, apiId, 'monthly'),
  ]);

  // Extract usage information
  const { usage, limits } = stats;

  // Aggregate monthly stats from all models
  const monthlyTotals = monthlyModelStats.reduce(
    (acc, model) => {
      acc.tokens += model.allTokens || 0;
      acc.cost += model.costs?.total || 0;
      return acc;
    },
    { tokens: 0, cost: 0 }
  );

  return {
    daily: {
      cost: {
        used: limits.currentDailyCost || 0,
        total: limits.dailyCostLimit || 0,
      },
      tokens: usage?.total?.allTokens || 0,
    },
    monthly: {
      cost: {
        used: monthlyTotals.cost,
        total: 0, // API doesn't provide monthly limit
      },
      tokens: monthlyTotals.tokens,
    },
    total: {
      cost: {
        used: limits.currentTotalCost || 0,
        total: limits.totalCostLimit || 0,
      },
      tokens: usage?.total?.allTokens || 0,
    },
    lastUpdate: new Date(),
  };
}

/**
 * Get usage information from Claude Relay Service
 * Results are cached for CACHE_TTL_MS to avoid excessive API calls
 */
export async function getUsageInfo(baseUrl: string, apiKey: string): Promise<UsageInfo> {
  if (!baseUrl || !apiKey) {
    throw new Error('Not configured');
  }

  const now = Date.now();

  // Return cached result if still valid
  if (cachedResult && now - lastFetchTime < CACHE_TTL_MS) {
    return cachedResult;
  }

  try {
    const result = await fetchUsageData(baseUrl, apiKey);
    cachedResult = result;
    lastFetchTime = now;
    return result;
  } catch (err) {
    // On error, return cached result if available, otherwise throw
    if (cachedResult) {
      return {
        ...cachedResult,
        lastUpdate: new Date(),
        error: err instanceof Error ? err.message : 'API Error',
      };
    }
    throw err;
  }
}
