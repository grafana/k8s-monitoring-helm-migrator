# K8s Monitoring Helm Chart Migrator

This repo contains a utility to migrate values files from v1.x to v2.0 and v3.x. It's meant to be a best-effort
migration utility and might not result in an optimal solution, please inspect the output values file and adjust as
necessary.

[Migrator Utility](https://grafana.github.io/k8s-monitoring-helm-migrator)

For more details about migration, see https://github.com/grafana/k8s-monitoring-helm/blob/main/charts/k8s-monitoring/docs/Migration.md

## Default values

This utility will attempt to use the same default values in v1, even though they're not the same defaults in v2.

## Known gaps

* Alloy integration
  * `metrics.alloy` --> `integrations.alloy` with only `alloy_build_info`
  * `metrics.alloy` with `useIntegrationAllowList` --> `integrations.alloy`
* Many places where `authMode == oauth2`

Check out the [Issues](https://github.com/grafana/k8s-monitoring-helm-migrator/issues) list for other known limitations.
