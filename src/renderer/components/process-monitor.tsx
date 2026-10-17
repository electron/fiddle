import * as React from 'react';

import { ProcessMetric } from '../../interfaces';

interface ProcessMonitorState {
  metrics: ProcessMetric[];
  isRunning: boolean;
}

/**
 * A panel that shows the live process tree (PID, CPU%, Memory) for a
 * running Fiddle. It is mounted in its own standalone window.
 */
export class ProcessMonitor extends React.Component<
  Record<string, never>,
  ProcessMonitorState
> {
  constructor(props: Record<string, never>) {
    super(props);
    this.state = { metrics: [], isRunning: true };
    this.handleMetricsUpdate = this.handleMetricsUpdate.bind(this);
  }

  public componentDidMount() {
    window.ElectronFiddle.addEventListener(
      'process-metrics-update',
      this.handleMetricsUpdate as () => void,
    );
  }

  public componentWillUnmount() {
    window.ElectronFiddle.removeAllListeners('process-metrics-update');
  }

  private handleMetricsUpdate(metrics: ProcessMetric[]) {
    // If we receive an empty array, the Fiddle stopped.
    this.setState({ metrics, isRunning: metrics.length > 0 });
  }

  private formatMemory(kb: number): string {
    if (kb >= 1024 * 1024) return `${(kb / 1024 / 1024).toFixed(1)} GB`;
    if (kb >= 1024) return `${(kb / 1024).toFixed(1)} MB`;
    return `${kb} KB`;
  }

  private formatCpu(cpu: number): string {
    return `${cpu.toFixed(1)}%`;
  }

  public render() {
    const { isRunning, metrics } = this.state;

    return (
      <div className="process-monitor" id="process-monitor-panel">
        <div className="process-monitor__header">
          <span className="process-monitor__title">
            <span className="process-monitor__icon">⚙</span>
            Process Monitor
          </span>
          {isRunning && (
            <span className="process-monitor__live-badge">● LIVE</span>
          )}
        </div>
        <div className="process-monitor__table-container">
          <table className="process-monitor__table">
            <thead>
              <tr>
                <th>Type / Name</th>
                <th>PID</th>
                <th>CPU</th>
                <th>Memory</th>
              </tr>
            </thead>
            <tbody>
              {metrics.length === 0 ? (
                <tr>
                  <td colSpan={4} className="process-monitor__empty">
                    {isRunning
                      ? 'Waiting for process data…'
                      : 'No Fiddle running.'}
                  </td>
                </tr>
              ) : (
                metrics.map((m) => (
                  <tr key={m.pid} className="process-monitor__row">
                    <td className="process-monitor__name">
                      {m.type ?? m.name ?? 'Unknown'}
                    </td>
                    <td className="process-monitor__pid">{m.pid}</td>
                    <td
                      className={`process-monitor__cpu ${
                        m.cpu > 50 ? 'process-monitor__cpu--high' : ''
                      }`}
                    >
                      {this.formatCpu(m.cpu)}
                    </td>
                    <td className="process-monitor__memory">
                      {this.formatMemory(m.memory)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }
}
