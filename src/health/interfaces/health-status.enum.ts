export enum HealthState {
  /** Configured and the last probe succeeded */
  OPERATIONAL = "operational",
  /** Configuredureded, reachable, but degraded (e.g. rate limited) */
  DEGRADED = "degraded",
  /** Configuredured but the probe failed */
  ERROR = "error",
  /** Env var missing / empty */
  UNCONFIGURED = "unconfigured",
  /** Probe not yet run or timed out */
  UNKNOWN = "unknown",
}
