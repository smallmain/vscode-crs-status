import * as vscode from 'vscode';
import { UsageInfo } from './usage';

export class StatusBarManager {
  private statusBarItem: vscode.StatusBarItem;

  constructor() {
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      100
    );
    this.statusBarItem.command = 'crsStatus.refresh';
    this.statusBarItem.text = '$(pulse)';
    this.statusBarItem.show();
  }

  /**
   * Format number as currency
   */
  private formatCurrency(value: number): string {
    return `$${value.toFixed(2)}`;
  }

  /**
   * Format token count
   */
  private formatTokens(tokens: number): string {
    if (tokens >= 1000000) {
      return `${(tokens / 1000000).toFixed(2)}M`;
    } else if (tokens >= 1000) {
      return `${(tokens / 1000).toFixed(2)}K`;
    }
    return tokens.toString();
  }

  /**
   * Format time as HH:MM:SS
   */
  private formatTime(date: Date): string {
    return date.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }

  /**
   * Update tooltip with usage information
   */
  public updateTooltip(usageInfo: UsageInfo): void {
    const md = new vscode.MarkdownString();
    md.isTrusted = true;

    md.appendMarkdown('**CRS Usage**\n\n');
    md.appendMarkdown('---\n\n');

    // Daily usage
    const dailyCost = `${this.formatCurrency(usageInfo.daily.cost.used)} / ${this.formatCurrency(usageInfo.daily.cost.total)}`;
    const dailyTokens = this.formatTokens(usageInfo.daily.tokens);
    md.appendMarkdown(`**Today** | ${dailyCost} | ${dailyTokens} tokens\n\n`);

    // Monthly usage
    const monthlyCost = `${this.formatCurrency(usageInfo.monthly.cost.used)} / ${this.formatCurrency(usageInfo.monthly.cost.total)}`;
    const monthlyTokens = this.formatTokens(usageInfo.monthly.tokens);
    md.appendMarkdown(`**This Month** | ${monthlyCost} | ${monthlyTokens} tokens\n\n`);

    // Total usage
    md.appendMarkdown(`**Total** | ${this.formatCurrency(usageInfo.total.cost)}\n\n`);

    md.appendMarkdown('---\n\n');

    // Last update time and error info
    if (usageInfo.error) {
      md.appendMarkdown(`*Error: ${usageInfo.error}*\n\n`);
    }
    md.appendMarkdown(`*Click to refresh | Last update: ${this.formatTime(usageInfo.lastUpdate)}*`);

    this.statusBarItem.tooltip = md;
  }

  /**
   * Show loading state
   */
  public showLoading(): void {
    this.statusBarItem.text = '$(sync~spin)';
    this.statusBarItem.tooltip = 'Loading CRS usage data...';
  }

  /**
   * Show error state
   */
  public showError(message: string): void {
    this.statusBarItem.text = '$(error)';
    const md = new vscode.MarkdownString();
    md.appendMarkdown(`**CRS Status Error**\n\n${message}`);
    this.statusBarItem.tooltip = md;
  }

  /**
   * Show configuration required state
   */
  public showConfigRequired(): void {
    this.statusBarItem.text = '$(gear)';
    this.statusBarItem.command = 'crsStatus.openSettings';
    const md = new vscode.MarkdownString();
    md.appendMarkdown('**CRS Status**\n\nClick to configure API settings');
    this.statusBarItem.tooltip = md;
  }

  /**
   * Reset to normal state (ready for usage display)
   */
  public showReady(): void {
    this.statusBarItem.text = '$(pulse)';
    this.statusBarItem.command = 'crsStatus.refresh';
  }

  /**
   * Dispose the status bar item
   */
  public dispose(): void {
    this.statusBarItem.dispose();
  }
}
