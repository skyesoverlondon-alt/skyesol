# SLO Mapping

This repo provides a minimal SLO (Service Level Objective) framework.

Recommended SLOs (examples):
- Auth success rate: 99.9% (rolling 30 days)
- API availability: 99.95% (rolling 30 days)
- p95 latency: < 300ms for /api/projects (excluding cold starts)

Signals:
- /api/health (liveness)
- /api/metrics (counters)
- SIEM outbox delivery success/failure counts

Operational controls:
- Alert when error budget burn rate exceeds threshold.
- Alert on sustained SIEM delivery failures.

This is intentionally minimal to keep the system self-hostable. In a full enterprise deployment,
wire these counters into Prometheus/Grafana or a vendor APM and set burn-rate alerts.
