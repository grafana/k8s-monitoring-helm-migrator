const _ = require('lodash');

const ALLOY_PRESETS = {
    "alloy-metrics":   ["clustered", "statefulset"],
    "alloy-logs":      ["filesystem-log-reader", "daemonset"],
    "alloy-singleton": ["singleton"],
    "alloy-receiver":  ["deployment"],
    "alloy-profiles":  ["privileged", "daemonset"],
};
const ALLOY_KEYS = Object.keys(ALLOY_PRESETS);
const TELEMETRY_SERVICE_KEYS = ["node-exporter", "windows-exporter", "kube-state-metrics"];

// Fields that affect the deployment of a telemetry service sub-chart
const DEPLOYMENT_FIELDS = new Set([
    "deploy", "resources", "tolerations", "image", "imagePullSecrets",
    "nameOverride", "fullnameOverride", "replicas", "autosharding",
    "podAnnotations", "rbac",
]);

// Extra fields specific to opencost that go to telemetryServices (not costMetrics)
const OPENCOST_DEPLOYMENT_FIELDS = new Set([
    ...DEPLOYMENT_FIELDS, "metricsSource", "opencost",
]);

function checkValuesV3(oldValues) {
    if (!oldValues.cluster || !oldValues.cluster.name) {
        return "cluster.name is missing";
    }
    const hasDestinationsList = oldValues.destinations && Array.isArray(oldValues.destinations);
    const hasDestinationsMap = !!oldValues.destinationsMap;
    const hasAlloyKeys = ALLOY_KEYS.some(key => !!oldValues[key]);
    if (!hasDestinationsList && !hasDestinationsMap && !hasAlloyKeys) {
        return "Could not detect a v3 values file (no destinations list, destinationsMap, or alloy-* keys found)";
    }
}

function migrateDestinationsV3toV4(oldValues) {
    const notes = [];
    const destinationsMap = {};

    // Convert destinations list to map
    if (oldValues.destinations && Array.isArray(oldValues.destinations)) {
        for (const dest of oldValues.destinations) {
            if (!dest.name) {
                notes.push("WARNING: destination entry without a name field, skipping.");
                continue;
            }
            if (destinationsMap[dest.name]) {
                notes.push(`WARNING: duplicate destination name "${dest.name}", later entry will overwrite.`);
            }
            const { name, ...rest } = dest;
            destinationsMap[name] = rest;
        }
    }

    // destinationsMap is already a map, just rename to destinations
    if (oldValues.destinationsMap) {
        Object.assign(destinationsMap, oldValues.destinationsMap);
    }

    if (Object.keys(destinationsMap).length === 0) {
        return { values: {}, notes };
    }
    return { values: { destinations: destinationsMap }, notes };
}

function migrateCollectorsV3toV4(oldValues) {
    const collectors = {};

    for (const [key, presets] of Object.entries(ALLOY_PRESETS)) {
        if (oldValues[key]) {
            const { enabled, ...rest } = oldValues[key];
            collectors[key] = { presets, ...rest };
        }
    }

    if (Object.keys(collectors).length === 0) {
        return {};
    }
    return { collectors };
}

// In v3, each feature was implicitly assigned to a collector based on which alloy-*
// instance was enabled. In v4, each feature must explicitly declare its collector.
const FEATURE_COLLECTOR_MAP = {
    "clusterMetrics":              "alloy-metrics",
    "costMetrics":                 "alloy-metrics",
    "hostMetrics":                 "alloy-metrics",
    "clusterEvents":               "alloy-singleton",
    "podLogs":                     "alloy-logs",
    "podLogsViaLoki":              "alloy-logs",
    "podLogsViaOpenTelemetry":     "alloy-logs",
    "podLogsViaKubernetesApi":     "alloy-logs",
    "nodeLogs":                    "alloy-logs",
    "applicationObservability":    "alloy-receiver",
    "annotationAutodiscovery":     "alloy-metrics",
    "autoInstrumentation":         "alloy-metrics",
    "prometheusOperatorObjects":   "alloy-metrics",
    "profiling":                   "alloy-profiles",
    "profilesReceiver":            "alloy-receiver",
    "integrations":                "alloy-metrics",
};

function migrateFeatureCollectors(newValues) {
    for (const [feature, collector] of Object.entries(FEATURE_COLLECTOR_MAP)) {
        if (newValues[feature] && !newValues[feature].collector) {
            // Most features use an "enabled" flag; integrations are enabled by having instances
            if (newValues[feature].enabled || feature === "integrations") {
                newValues[feature].collector = collector;
            }
        }
    }
}

function migrateClusterMetricsV3toV4(oldValues) {
    if (!oldValues.clusterMetrics) {
        return { values: {}, notes: [] };
    }

    const clusterName = oldValues.cluster && oldValues.cluster.name;
    const notes = [];
    const clusterMetrics = {};
    const telemetryServices = {};
    const costMetrics = {};
    const hostMetrics = {};

    for (const [key, value] of Object.entries(oldValues.clusterMetrics)) {
        if (key === "kepler") {
            // kepler config fields -> hostMetrics.energyMetrics
            // kepler deployment fields -> telemetryServices.kepler
            const tsFields = {};
            const featureFields = {};
            for (const [field, fieldValue] of Object.entries(value)) {
                if (DEPLOYMENT_FIELDS.has(field)) {
                    tsFields[field] = fieldValue;
                } else if (field !== "enabled") {
                    featureFields[field] = fieldValue;
                }
            }
            if (value.enabled !== false) {
                hostMetrics.energyMetrics = { enabled: true, ...featureFields };
                telemetryServices.kepler = { deploy: true, ...tsFields };
            }
        } else if (key === "opencost") {
            // opencost config fields -> costMetrics
            // opencost deployment fields -> telemetryServices.opencost
            const tsFields = {};
            const featureFields = {};
            for (const [field, fieldValue] of Object.entries(value)) {
                if (OPENCOST_DEPLOYMENT_FIELDS.has(field)) {
                    tsFields[field] = fieldValue;
                } else if (field !== "enabled") {
                    featureFields[field] = fieldValue;
                }
            }
            if (value.enabled !== false) {
                costMetrics.enabled = true;
            }
            // Feature fields go to costMetrics
            if (Object.keys(featureFields).length > 0) {
                Object.assign(costMetrics, featureFields);
            }
            // Deployment fields go to telemetryServices.opencost
            const opencostTS = { deploy: true, ...tsFields };
            // v4 requires metricsSource to link to a prometheus destination
            if (!opencostTS.metricsSource && !featureFields.metricsSource && oldValues.destinations) {
                const promDest = oldValues.destinations.find(d => d.type === "prometheus");
                if (promDest && promDest.name) {
                    opencostTS.metricsSource = promDest.name;
                }
            }
            // v4 requires opencost.prometheus.external.url for querying
            if (!(opencostTS.opencost && opencostTS.opencost.prometheus && opencostTS.opencost.prometheus.external && opencostTS.opencost.prometheus.external.url)) {
                if (oldValues.destinations) {
                    const promDest = oldValues.destinations.find(d => d.type === "prometheus");
                    if (promDest && promDest.url) {
                        const queryUrl = promDest.url.replace(/\/api\/prom\/push$/, '/api/v1/query').replace(/\/api\/v1\/write$/, '/api/v1/query');
                        if (!opencostTS.opencost) opencostTS.opencost = {};
                        if (!opencostTS.opencost.prometheus) opencostTS.opencost.prometheus = {};
                        if (!opencostTS.opencost.prometheus.external) opencostTS.opencost.prometheus.external = {};
                        opencostTS.opencost.prometheus.external.url = queryUrl;
                    }
                }
            }
            // v4 requires opencost.exporter.defaultClusterId to match cluster.name
            if (clusterName && !(opencostTS.opencost && opencostTS.opencost.exporter && opencostTS.opencost.exporter.defaultClusterId)) {
                if (!opencostTS.opencost) opencostTS.opencost = {};
                if (!opencostTS.opencost.exporter) opencostTS.opencost.exporter = {};
                opencostTS.opencost.exporter.defaultClusterId = clusterName;
            }
            telemetryServices.opencost = opencostTS;
        } else if (key === "node-exporter") {
            // node-exporter config fields -> hostMetrics.linuxHosts
            // node-exporter deployment fields -> telemetryServices.node-exporter
            const tsFields = {};
            const featureFields = {};
            for (const [field, fieldValue] of Object.entries(value)) {
                if (DEPLOYMENT_FIELDS.has(field)) {
                    tsFields[field] = fieldValue;
                } else if (field !== "enabled") {
                    featureFields[field] = fieldValue;
                }
            }
            if (value.deploy !== false) {
                telemetryServices["node-exporter"] = { deploy: true, ...tsFields };
            }
            if (Object.keys(featureFields).length > 0) {
                hostMetrics.linuxHosts = { enabled: true, ...featureFields };
            } else if (value.enabled !== false) {
                hostMetrics.linuxHosts = { enabled: true };
            }
        } else if (key === "windows-exporter") {
            // windows-exporter config fields -> hostMetrics.windowsHosts
            // windows-exporter deployment fields -> telemetryServices.windows-exporter
            const tsFields = {};
            const featureFields = {};
            for (const [field, fieldValue] of Object.entries(value)) {
                if (DEPLOYMENT_FIELDS.has(field)) {
                    tsFields[field] = fieldValue;
                } else if (field !== "enabled") {
                    featureFields[field] = fieldValue;
                }
            }
            if (value.deploy !== false) {
                telemetryServices["windows-exporter"] = { deploy: true, ...tsFields };
            }
            if (Object.keys(featureFields).length > 0) {
                hostMetrics.windowsHosts = { enabled: true, ...featureFields };
            } else if (value.enabled !== false) {
                hostMetrics.windowsHosts = { enabled: true };
            }
        } else if (key === "kube-state-metrics") {
            // kube-state-metrics config fields stay in clusterMetrics
            // kube-state-metrics deployment fields -> telemetryServices
            const tsFields = {};
            const featureFields = {};
            for (const [field, fieldValue] of Object.entries(value)) {
                if (DEPLOYMENT_FIELDS.has(field)) {
                    tsFields[field] = fieldValue;
                } else if (field !== "enabled") {
                    featureFields[field] = fieldValue;
                }
            }
            if (value.deploy !== false) {
                telemetryServices["kube-state-metrics"] = { deploy: true, ...tsFields };
            }
            if (Object.keys(featureFields).length > 0) {
                clusterMetrics["kube-state-metrics"] = featureFields;
            }
        } else {
            clusterMetrics[key] = value;
        }
    }

    // If hostMetrics has any sub-features, mark it as enabled
    if (Object.keys(hostMetrics).length > 0 && !hostMetrics.enabled) {
        hostMetrics.enabled = true;
    }

    // When clusterMetrics is enabled, kube-state-metrics must be explicitly deployed in v4
    // Skip if clusterMetrics already has KSM config (externally managed)
    if (clusterMetrics.enabled && !telemetryServices["kube-state-metrics"] && !clusterMetrics["kube-state-metrics"]) {
        telemetryServices["kube-state-metrics"] = { deploy: true };
    }

    const values = {};
    if (Object.keys(clusterMetrics).length > 0) {
        values.clusterMetrics = clusterMetrics;
    }
    if (Object.keys(telemetryServices).length > 0) {
        values.telemetryServices = telemetryServices;
    }
    if (Object.keys(costMetrics).length > 0) {
        values.costMetrics = costMetrics;
    }
    if (Object.keys(hostMetrics).length > 0) {
        values.hostMetrics = hostMetrics;
    }

    return { values, notes };
}

function migrateV3toV4(oldValues) {
    let newValues = {};
    let notes = [];

    // Keys handled by specific migration functions (renamed or restructured)
    const handledKeys = new Set([
        "destinations",
        "destinationsMap",
        "clusterMetrics",
        ...ALLOY_KEYS,
    ]);

    // Migrate destinations: list -> map
    {
        const result = migrateDestinationsV3toV4(oldValues);
        newValues = _.merge(newValues, result.values);
        notes = notes.concat(result.notes);
    }

    // Migrate alloy-* instances -> collectors map with presets
    newValues = _.merge(newValues, migrateCollectorsV3toV4(oldValues));

    // Migrate clusterMetrics split
    {
        const result = migrateClusterMetricsV3toV4(oldValues);
        newValues = _.merge(newValues, result.values);
        notes = notes.concat(result.notes);
    }

    // Pass through all other top-level keys unchanged
    for (const [key, value] of Object.entries(oldValues)) {
        if (!handledKeys.has(key)) {
            if (key === "podLogs") {
                // TODO: podLogs and podLogsViaKubernetesApi were refactored in v4
                // to remove fields like "labelsToKeep". Need special handling here.
                const { gatherMethod, ...rest } = value;
                const method = gatherMethod || "volumes";
                if (method === "volumes") {
                    newValues["podLogsViaLoki"] = rest;
                } else if (method === "filelog") {
                    newValues["podLogsViaOpenTelemetry"] = rest;
                } else if (method === "kubernetesApi") {
                    newValues["podLogsViaKubernetesApi"] = rest;
                } else {
                    notes.push(`ERROR: podLogs.gatherMethod "${method}" is not recognized. Please migrate podLogs manually.`);
                    newValues["podLogsViaLoki"] = rest;
                }
            } else {
                newValues[key] = value;
            }
        }
    }

    // Assign collectors to enabled features
    migrateFeatureCollectors(newValues);

    return { values: newValues, notes };
}

module.exports = {
    checkValuesV3,
    migrateDestinationsV3toV4,
    migrateCollectorsV3toV4,
    migrateClusterMetricsV3toV4,
    migrateV3toV4,
};
