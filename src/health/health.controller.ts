import { Controller, Get } from "@nestjs/common";
import { HealthService } from "./health.service";
import { HealthResponse } from "./interfaces/health-response.interface";

@Controller("api/health")
export class HealthController {
  constructor(private readonly health: HealthService) {}

  /**
   * Full snapshot — used by the dashboard.
   * Returns 200 always; the payload tells you what's healthy.
   */
  @Get()
  async check(): Promise<HealthResponse> {
    return this.health.check();
  }

  /**
   * Cheap liveness — no outbound calls. Good for k8s probes / uptime monitors.
   */
  @Get("live")
  live(): { status: "ok"; uptime: number } {
    return { status: "ok", uptime: Math.round(process.uptime()) };
  }
}
