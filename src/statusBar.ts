import * as vscode from 'vscode';
import { UsageInfo } from './usage';

export class StatusBarManager {
  private statusBarItem: vscode.StatusBarItem;

  constructor() {
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      100,
    );
    this.statusBarItem.command = 'crsStatus.refresh';
    this.statusBarItem.text = '$(credit-card)';
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
   * Generate a progress bar using Unicode characters
   */
  private generateProgressBar(used: number, total: number, width: number = 25) {
    if (total <= 0) {
      return null;
    }
    const percentage = Math.min(used / total, 1);
    const filled = Math.round(percentage * width);
    const empty = width - filled;
    const bar = '▓'.repeat(filled) + '░'.repeat(empty);
    const percentText = (percentage * 100).toFixed(1);
    return { bar, text: `${percentText}%` };
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
   * Find the most constrained limit (smallest remaining)
   * Returns null if no limits are set
   */
  private getMostConstrainedLimit(
    usageInfo: UsageInfo,
  ): { name: string; used: number; total: number; percentage: number } | null {
    const limits: { name: string; used: number; total: number }[] = [];

    if (usageInfo.daily.cost.total > 0) {
      limits.push({
        name: 'Daily',
        used: usageInfo.daily.cost.used,
        total: usageInfo.daily.cost.total,
      });
    }
    if (usageInfo.monthly.cost.total > 0) {
      limits.push({
        name: 'Monthly',
        used: usageInfo.monthly.cost.used,
        total: usageInfo.monthly.cost.total,
      });
    }
    if (usageInfo.total.cost.total > 0) {
      limits.push({
        name: 'Total',
        used: usageInfo.total.cost.used,
        total: usageInfo.total.cost.total,
      });
    }

    if (limits.length === 0) {
      return null;
    }

    // Find the one with smallest remaining (most constrained)
    let mostConstrained = limits[0];
    let smallestRemaining = mostConstrained.total - mostConstrained.used;

    for (let i = 1; i < limits.length; i++) {
      const remaining = limits[i].total - limits[i].used;
      if (remaining < smallestRemaining) {
        smallestRemaining = remaining;
        mostConstrained = limits[i];
      }
    }

    const percentage = (mostConstrained.used / mostConstrained.total) * 100;
    return { ...mostConstrained, percentage };
  }

  /**
   * Format the status bar text for usage display
   */
  private formatStatusBarText(
    usageInfo: UsageInfo,
    showAmount: boolean,
  ): string {
    const constrained = this.getMostConstrainedLimit(usageInfo);
    if (!constrained) {
      return '$(credit-card)';
    }

    const percentage = constrained.percentage.toFixed(1);
    if (!showAmount) {
      return `$(credit-card) ${percentage}%`;
    }

    const used = constrained.used.toFixed(1);
    const total = constrained.total.toFixed(1);
    return `$(credit-card) ${percentage}% ($${used}/$${total})`;
  }

  /**
   * Update tooltip with usage information
   */
  public updateTooltip(usageInfo: UsageInfo): void {
    // Update status bar text based on config
    const config = vscode.workspace.getConfiguration('crsStatus');
    const showUsageInStatusBar = config.get<boolean>(
      'showUsageInStatusBar',
      true,
    );
    const showAmountInStatusBar = config.get<boolean>(
      'showAmountInStatusBar',
      true,
    );

    if (showUsageInStatusBar) {
      this.statusBarItem.text = this.formatStatusBarText(
        usageInfo,
        showAmountInStatusBar,
      );
    } else {
      this.statusBarItem.text = '$(credit-card)';
    }
    this.statusBarItem.backgroundColor = undefined;

    const md = new vscode.MarkdownString();
    md.isTrusted = true;
    md.supportHtml = true;
    md.supportThemeIcons = true;

    // Header
    md.appendMarkdown(`<table width="100%">
    <tbody>
      <tr>
        <td width="50%"><h4>CRS Usage</h4></td>
        <td width="50%" align="right">
          <a
            href="command:crsStatus.openSettings"
            title="Settings"
            ><span class="codicon codicon-gear"></span></a
          >
        </td>
      </tr>
    </tbody>
  </table>\n\n`);

    // Daily usage section
    const dailyCostText =
      usageInfo.daily.cost.total > 0
        ? `${this.formatCurrency(
            usageInfo.daily.cost.used,
          )} / ${this.formatCurrency(usageInfo.daily.cost.total)}`
        : this.formatCurrency(usageInfo.daily.cost.used);
    const dailyProgressBar = this.generateProgressBar(
      usageInfo.daily.cost.used,
      usageInfo.daily.cost.total,
    );
    md.appendMarkdown(`<table width="100%">
<tbody>
<tr><td><strong>Daily</strong></td><td align="right">${
      dailyProgressBar ? dailyProgressBar.text : 'Unlimited'
    }</td></tr>
${
  dailyProgressBar
    ? `<tr><td colspan="2">${dailyProgressBar.bar}</td></tr>`
    : ''
}
<tr><td>Cost</td><td align="right">${dailyCostText}</td></tr>
<tr><td>Tokens</td><td align="right">${this.formatTokens(
      usageInfo.daily.tokens,
    )}</td></tr>
</tbody>
</table>\n\n`);

    md.appendMarkdown('---\n\n<span style="height: 5px"></span>');

    // Monthly usage section
    const monthlyCostText =
      usageInfo.monthly.cost.total > 0
        ? `${this.formatCurrency(
            usageInfo.monthly.cost.used,
          )} / ${this.formatCurrency(usageInfo.monthly.cost.total)}`
        : this.formatCurrency(usageInfo.monthly.cost.used);
    const monthlyProgressBar = this.generateProgressBar(
      usageInfo.monthly.cost.used,
      usageInfo.monthly.cost.total,
    );
    md.appendMarkdown(`<table width="100%">
<tbody>
<tr><td><strong>Monthly</strong></td><td align="right">${
      monthlyProgressBar ? monthlyProgressBar.text : 'Unlimited'
    }</td></tr>
${
  monthlyProgressBar
    ? `<tr><td colspan="2">${monthlyProgressBar.bar}</td></tr>`
    : ''
}
<tr><td>Cost</td><td align="right">${monthlyCostText}</td></tr>
<tr><td>Tokens</td><td align="right">${this.formatTokens(
      usageInfo.monthly.tokens,
    )}</td></tr>
</tbody>
</table>\n\n`);

    md.appendMarkdown('---\n\n<span style="height: 5px"></span>');

    // Total usage section
    const totalCostText =
      usageInfo.total.cost.total > 0
        ? `${this.formatCurrency(
            usageInfo.total.cost.used,
          )} / ${this.formatCurrency(usageInfo.total.cost.total)}`
        : this.formatCurrency(usageInfo.total.cost.used);
    const totalProgressBar = this.generateProgressBar(
      usageInfo.total.cost.used,
      usageInfo.total.cost.total,
    );
    md.appendMarkdown(`<table width="100%">
<tbody>
<tr><td><strong>Total</strong></td><td align="right">${
      totalProgressBar ? totalProgressBar.text : 'Unlimited'
    }</td></tr>
${
  totalProgressBar
    ? `<tr><td colspan="2">${totalProgressBar.bar}</td></tr>`
    : ''
}
<tr><td>Cost</td><td align="right">${totalCostText}</td></tr>
<tr><td>Tokens</td><td align="right">${this.formatTokens(
      usageInfo.total.tokens,
    )}</td></tr>
</tbody>
</table>\n\n`);

    md.appendMarkdown('---\n\n');

    // Footer
    md.appendMarkdown(
      `<p align="right"><em>Last updated: ${this.formatTime(
        usageInfo.lastUpdate,
      )}</em></p>`,
    );

    this.statusBarItem.tooltip = md;
  }

  /**
   * Show loading state
   */
  public showLoading(): void {
    this.statusBarItem.text = '$(sync~spin)';
    this.statusBarItem.tooltip = 'Loading CRS usage data...';
    this.statusBarItem.backgroundColor = undefined;
  }

  /**
   * Show error state
   */
  public showError(message: string): void {
    this.statusBarItem.text = '$(error) Error';
    this.statusBarItem.backgroundColor = new vscode.ThemeColor(
      'statusBarItem.errorBackground',
    );
    const md = new vscode.MarkdownString();
    md.appendMarkdown(`**CRS Status Error**\n\n${message}`);
    this.statusBarItem.tooltip = md;
  }

  /**
   * Show configuration required state
   */
  public showConfigRequired(): void {
    this.statusBarItem.text = '$(debug-disconnect) Invalid Config';
    this.statusBarItem.backgroundColor = new vscode.ThemeColor(
      'statusBarItem.errorBackground',
    );
    this.statusBarItem.command = 'crsStatus.openSettings';
    const md = new vscode.MarkdownString();
    md.appendMarkdown('**CRS Status**\n\nClick to configure API settings');
    this.statusBarItem.tooltip = md;
  }

  /**
   * Reset to normal state (ready for usage display)
   */
  public showReady(): void {
    this.statusBarItem.text = '$(credit-card)';
    this.statusBarItem.backgroundColor = undefined;
    this.statusBarItem.command = 'crsStatus.refresh';
  }

  /**
   * Dispose the status bar item
   */
  public dispose(): void {
    this.statusBarItem.dispose();
  }
}
