import { ServiceHealth } from "./service-health.interface";

export interface HealthResponse {
  /** true only if every service is OPERATIONAL */
  healthy: boolean;
  /** ISO timestamp of the whole snapshot */
  timestamp: string;
  /** Uptime in seconds (from process.uptime) */
  uptime: number;
  /** Node version, useful in UI footer */
  version: string;
  /** NODE_ENV */
  environment: string;
  services: {
    github: ServiceHealth;
    huggingface: ServiceHealth;
    discord: ServiceHealth;
  };
}
