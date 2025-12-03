import * as vscode from 'vscode';
import { StatusBarManager } from './statusBar';
import { getUsageInfo, clearCache } from './usage';

let statusBarManager: StatusBarManager | undefined;
let refreshInterval: NodeJS.Timeout | undefined;

/**
 * Check if the extension is configured
 */
function isConfigured(): boolean {
  const config = vscode.workspace.getConfiguration('crsStatus');
  const baseUrl = config.get<string>('baseUrl', '');
  const apiKey = config.get<string>('apiKey', '');
  return baseUrl.length > 0 && apiKey.length > 0;
}

/**
 * Get configuration values
 */
function getConfig(): {
  baseUrl: string;
  apiKey: string;
  refreshInterval: number;
} {
  const config = vscode.workspace.getConfiguration('crsStatus');
  return {
    baseUrl: config.get<string>('baseUrl', ''),
    apiKey: config.get<string>('apiKey', ''),
    refreshInterval: config.get<number>('refreshInterval', 60),
  };
}

/**
 * Refresh usage data
 */
async function refreshUsageData(forceRefresh: boolean = false): Promise<void> {
  if (!statusBarManager) {
    return;
  }

  if (!isConfigured()) {
    statusBarManager.showConfigRequired();
    return;
  }

  const { baseUrl, apiKey } = getConfig();

  // Clear cache if force refresh
  if (forceRefresh) {
    clearCache();
  }

  statusBarManager.showLoading();

  try {
    const usageInfo = await getUsageInfo(baseUrl, apiKey);
    if (usageInfo.error) {
      throw new Error(usageInfo.error);
    }
    statusBarManager.showReady();
    statusBarManager.updateTooltip(usageInfo);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    statusBarManager.showError(message);
  }
}

/**
 * Set up auto-refresh timer
 */
function setupAutoRefresh(): void {
  // Clear existing interval
  if (refreshInterval) {
    clearInterval(refreshInterval);
  }

  const { refreshInterval: intervalSeconds } = getConfig();
  const intervalMs = intervalSeconds * 1000;

  refreshInterval = setInterval(() => {
    refreshUsageData(false);
  }, intervalMs);
}

/**
 * Extension activation
 */
export function activate(context: vscode.ExtensionContext): void {
  // Create status bar manager
  statusBarManager = new StatusBarManager();

  // Register refresh command
  const refreshCommand = vscode.commands.registerCommand(
    'crsStatus.refresh',
    () => {
      refreshUsageData(true);
    },
  );

  // Register open settings command
  const openSettingsCommand = vscode.commands.registerCommand(
    'crsStatus.openSettings',
    () => {
      vscode.commands.executeCommand(
        'workbench.action.openSettings',
        'crsStatus',
      );
    },
  );

  // Listen for configuration changes
  const configChangeListener = vscode.workspace.onDidChangeConfiguration(
    (event) => {
      if (event.affectsConfiguration('crsStatus')) {
        // Re-setup auto-refresh with new interval
        setupAutoRefresh();
        // Refresh data with new config
        refreshUsageData(true);
      }
    },
  );

  // Add disposables to context
  context.subscriptions.push(
    statusBarManager,
    refreshCommand,
    openSettingsCommand,
    configChangeListener,
  );

  // Initial state check
  if (isConfigured()) {
    // Set up auto-refresh
    setupAutoRefresh();
    // Initial data fetch
    refreshUsageData(false);
  } else {
    statusBarManager.showConfigRequired();
  }
}

/**
 * Extension deactivation
 */
export function deactivate(): void {
  // Clear auto-refresh interval
  if (refreshInterval) {
    clearInterval(refreshInterval);
    refreshInterval = undefined;
  }

  // Status bar manager will be disposed via context.subscriptions
  statusBarManager = undefined;
}
