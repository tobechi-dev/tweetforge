import { HealthState } from "./health-status.enum";

export interface ServiceHealth {
  /** Human-readable service name, e.g. "GitHub API" */
  label: string;
  /** Whether the env/config value was present */
  configured: boolean;
  /** Whether the remote endpoint responded successfully */
  reachable: boolean;
  /** Overall state derived from configured + reachable */
  state: HealthState;
  /** Optional short message for UI tooltip / log */
  message?: string;
  /** Round-trip time for the probe, ms */
  latencyMs?: number;
  /** When this probe was last run */
  checkedAt: string;
}
