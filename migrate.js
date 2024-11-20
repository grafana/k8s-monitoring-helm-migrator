function migrate(oldValues) {
    const newValues = {};
    if (oldValues.cluster) {
        newValues.cluster = {
            name: oldValues.cluster.name
        };

        if (oldValues.cluster.platform) {
            newValues.global.platform = oldValues.cluster.platform;
        }
    }

    // Globals
    if (oldValues.metrics) {
        if (oldValues.metrics.maxCacheSize) {
            if (!newValues.global) {
                newValues.global = {};
            }
            newValues.global.maxCacheSize = oldValues.metrics.maxCacheSize
        }
        if (oldValues.metrics.scrapeInterval) {
            if (!newValues.global) {
                newValues.global = {};
            }
            newValues.global.scrapeInterval = oldValues.metrics.scrapeInterval
        }
    }

    if (oldValues["externalServices"]) {
        if (oldValues["externalServices"]["prometheus"]) {
            if (!newValues.destinations) {
                newValues.destinations = [];
            }
            if (oldValues["externalServices"]["prometheus"]["protocol"] === "otlp" || oldValues["externalServices"]["prometheus"]["protocol"] === "otlphttp") {
                newValues.destinations.push(migrateOtlpPrometheus(oldValues["externalServices"]["prometheus"]));
            } else {
                newValues.destinations.push(migratePrometheus(oldValues["externalServices"]["prometheus"]));
            }
        }
        if (oldValues["externalServices"]["loki"]) {
            if (!newValues.destinations) {
                newValues.destinations = [];
            }
            if (oldValues["externalServices"]["loki"]["protocol"] === "otlp" || oldValues["externalServices"]["loki"]["protocol"] === "otlphttp") {
                newValues.destinations.push(migrateOtlpLoki(oldValues["externalServices"]["loki"]));
            } else {
                newValues.destinations.push(migrateLoki(oldValues["externalServices"]["loki"]));
            }
        }
        if (oldValues["externalServices"]["tempo"]) {
            if (!newValues.destinations) {
                newValues.destinations = [];
            }
            newValues.destinations.push(migrateTempo(oldValues["externalServices"]["tempo"]));
        }
        if (oldValues["externalServices"]["pyroscope"]) {
            if (!newValues.destinations) {
                newValues.destinations = [];
            }
            newValues.destinations.push(migratePyroscope(oldValues["externalServices"]["pyroscope"]));
        }
    }

    // Features
    let alloys = {};
    let results = migrateClusterMetrics(oldValues);
    if (results) {
        newValues.clusterMetrics = results.clusterMetrics;
        alloys.metrics = results["alloy-metrics"];
    }

    results = migratePodLogs(oldValues);
    if (results) {
        newValues.podLogs = results.podLogs;
        alloys.logs = results["alloy-logs"];
    }

    results = migrateClusterEvents(oldValues);
    if (results) {
        newValues.clusterEvents = results.clusterEvents;
        alloys.singleton = results["alloy-singleton"];
    }

    results = migrateAnnotationAutodiscovery(oldValues);
    if (results) {
        newValues.annotationAutodiscovery = results.annotationAutodiscovery;
        alloys.metrics = results["alloy-metrics"];
    }

    results = migrateAutoinstrumentation(oldValues);
    if (results) {
        newValues.annotationAutodiscovery = results.annotationAutodiscovery;
        alloys.metrics = results["alloy-metrics"];
    }

    results = migratePromOperatorObjects(oldValues);
    if (results) {
        newValues.prometheusOperatorObjects = results.prometheusOperatorObjects;
        // merge this!
        alloys.metrics = results["alloy-metrics"];
    }

    if (alloys.metrics) { newValues["alloy-metrics"] = alloys.metrics; }
    if (alloys.logs) { newValues["alloy-logs"] = alloys.logs; }
    if (alloys.singleton) { newValues["alloy-singleton"] = alloys.singleton; }

    return newValues;
}

function migratePrometheus(prometheus) {
    const destination = {
        name: "metricsService",
        type: "prometheus"
    };
    if (prometheus.host) {
        const path = prometheus.writeEndpoint ? prometheus.writeEndpoint : "/api/prom/push";
        destination.url = prometheus.host + path;
    }
    if (prometheus.hostKey) {
        throw new Error(`externalServices.${destination.type}.hostKey is not supported in the new chart. Please set the host directly:\ndestinations:\n- name: ${destination.name}\n  type: ${destination.type}\n  url: <host>/<writeEndpoint>`);
    }

    let secretName = destination.name.toLowerCase();
    if (prometheus.secret) {
        destination.secret = {};
        if (prometheus.secret.create !== undefined) {
            destination.secret.create = prometheus.secret.create;
        }
        if (prometheus.secret.name) {
            secretName = prometheus.secret.name;
            destination.secret.name = prometheus.secret.name;
        }
        if (prometheus.secret.namespace) {
            destination.secret.namespace = prometheus.secret.namespace;
        }
    }

    destination.proxyURL = prometheus.proxyURL;

    if (prometheus.queryEndpoint) {
        console.log("externalServices.prometheus.queryEndpoint is not used in the new chart.");
    }

    destination.tenantId = prometheus.tenantId;
    destination.tenantIdKey = prometheus.tenantIdKey;
    destination.extraHeaders = prometheus.extraHeaders;
    destination.extraHeadersFrom = prometheus.extraHeadersFrom;
    destination.extraLabels = prometheus.externalLabels;
    destination.extraLabelsFrom = prometheus.externalLabelsFrom;
    destination.metricProcessingRules = prometheus.writeRelabelConfigRules;

    const authMode = prometheus.authMode || "basic";
    if (authMode === "basic") {
        destination.auth = {
            type: "basic",
        };
        if (prometheus.basicAuth.username) {
            destination.auth.username = prometheus.basicAuth.username;
        }
        if (prometheus.basicAuth.usernameKey) {
            destination.auth.usernameKey = prometheus.basicAuth.usernameKey;
        }
        if (prometheus.basicAuth.password) {
            destination.auth.password = prometheus.basicAuth.password;
        }
        if (prometheus.basicAuth.passwordKey) {
            destination.auth.passwordKey = prometheus.basicAuth.passwordKey;
        }
    } else if (authMode === "bearerToken") {
        destination.auth = {
            type: "bearerToken",
        };
        if (prometheus.bearerToken.token) {
            destination.auth.bearerToken = prometheus.bearerToken.token;
        }
        if (prometheus.bearerToken.tokenKey) {
            destination.auth.bearerTokenKey = prometheus.bearerToken.tokenKey;
        }
        if (prometheus.bearerToken.tokenFile) {
            destination.bearerTokenFile = prometheus.bearerToken.tokenFile;
        }
    } else if (authMode === "oauth2") {
        throw new Error("externalServices.authMode == oauth2 migration is not yet supported");
    }

    if (prometheus.tls) {
        destination.tls = {};
        if (prometheus.tls.insecureSkipVerify !== undefined) {
            destination.tls.insecureSkipVerify = prometheus.tls.insecureSkipVerify;
        }
        if (prometheus.tls.ca) {
            destination.tls.ca = prometheus.tls.ca;
        }
        if (prometheus.tls.caFile) {
            destination.tls.caFile = prometheus.tls.caFile;
        }
        if (prometheus.tls.caFrom) {
            destination.tls.caFrom = prometheus.tls.caFrom;
        }
        if (prometheus.tls.cert) {
            destination.tls.cert = prometheus.tls.cert;
        }
        if (prometheus.tls.certFile) {
            destination.tls.certFile = prometheus.tls.certFile;
        }
        if (prometheus.tls.certFrom) {
            destination.tls.certFrom = prometheus.tls.certFrom;
        }
        if (prometheus.tls.key) {
            destination.tls.key = prometheus.tls.key;
        }
        if (prometheus.tls.keyFile) {
            destination.tls.keyFile = prometheus.tls.keyFile;
        }
        if (prometheus.tls.keyFrom) {
            destination.tls.keyFrom = prometheus.tls.keyFrom;
        }
    }

    if (prometheus.sendNativeHistograms !== undefined) {
        destination.sendNativeHistograms = prometheus.sendNativeHistograms;
    }

    if (prometheus.queue_config) {
        destination.queueConfig = {};
        if (prometheus.queue_config.capacity !== undefined) {
            destination.queueConfig.capacity = prometheus.queue_config.capacity;
        }
        if (prometheus.queue_config.minShards !== undefined) {
            destination.queueConfig.minShards = prometheus.queue_config.minShards;
        }
        if (prometheus.queue_config.maxShards !== undefined) {
            destination.queueConfig.maxShards = prometheus.queue_config.maxShards;
        }
        if (prometheus.queue_config.maxSamplesPerSend !== undefined) {
            destination.queueConfig.maxSamplesPerSend = prometheus.queue_config.maxSamplesPerSend;
        }
        if (prometheus.queue_config.batchSendDeadline) {
            destination.queueConfig.batchSendDeadline = prometheus.queue_config.batchSendDeadline;
        }
        if (prometheus.queue_config.minBackoff) {
            destination.queueConfig.minBackoff = prometheus.queue_config.minBackoff;
        }
        if (prometheus.queue_config.maxBackoff) {
            destination.queueConfig.maxBackoff = prometheus.queue_config.maxBackoff;
        }
        if (prometheus.queue_config.retryOnHttp429 !== undefined) {
            destination.queueConfig.retryOnHttp429 = prometheus.queue_config.retryOnHttp429;
        }
        if (prometheus.queue_config.sampleAgeLimit) {
            destination.queueConfig.sampleAgeLimit = prometheus.queue_config.sampleAgeLimit;
        }
    }

    if (prometheus.wal) {
        throw new Error("externalServices.authMode == oauth2 migration is not yet supported");
    }

    return destination;
}

function migrateLoki(loki) {
    const destination = {
        name: "logsService",
        type: "loki"
    };
    if (loki.host) {
        const path = loki.writeEndpoint ? loki.writeEndpoint : "/loki/api/v1/push";
        destination.url = loki.host + path;
    }
    if (loki.hostKey) {
        throw new Error(`externalServices.${destination.type}.hostKey is not supported in the new chart. Please set the host directly:\ndestinations:\n- name: ${destination.name}\n  type: ${destination.type}\n  url: <host>/<writeEndpoint>`);
    }

    if (loki.secret) {
        destination.secret = {};
        if (loki.secret.create !== undefined) {
            destination.secret.create = loki.secret.create;
        }
        if (loki.secret.name) {
            destination.secret.name = loki.secret.name;
        }
        if (loki.secret.namespace) {
            destination.secret.namespace = loki.secret.namespace;
        }
    }

    destination.proxyURL = loki.proxyURL;

    if (loki.queryEndpoint) {
        console.log("externalServices.loki.queryEndpoint is not used in the new chart.");
    }

    destination.extraHeaders = loki.extraHeaders;
    destination.extraHeadersFrom = loki.extraHeadersFrom;
    destination.extraLabels = loki.extraLabels;
    destination.extraLabelsFrom = loki.extraLabelsFrom;
    destination.tenantId = loki.tenantId;
    destination.tenantIdKey = loki.tenantIdKey;

    const authMode = loki.authMode || "basic";
    if (authMode === "basic") {
        destination.auth = {
            type: "basic",
        };
        if (loki.basicAuth.username) {
            destination.auth.username = loki.basicAuth.username;
        }
        if (loki.basicAuth.usernameKey) {
            destination.auth.usernameKey = loki.basicAuth.usernameKey;
        }
        if (loki.basicAuth.password) {
            destination.auth.password = loki.basicAuth.password;
        }
        if (loki.basicAuth.passwordKey) {
            destination.auth.passwordKey = loki.basicAuth.passwordKey;
        }
    } else if (authMode === "oauth2") {
        throw new Error("externalServices.loki.authMode == oauth2 migration is not yet supported");
    }

    if (loki.tls) {
        destination.tls = {};
        if (loki.tls.insecureSkipVerify !== undefined) {
            destination.tls.insecureSkipVerify = loki.tls.insecureSkipVerify;
        }
        if (loki.tls.ca) {
            destination.tls.ca = loki.tls.ca;
        }
        if (loki.tls.caFile) {
            destination.tls.caFile = loki.tls.caFile;
        }
        if (loki.tls.caFrom) {
            destination.tls.caFrom = loki.tls.caFrom;
        }
        if (loki.tls.cert) {
            destination.tls.cert = loki.tls.cert;
        }
        if (loki.tls.certFile) {
            destination.tls.certFile = loki.tls.certFile;
        }
        if (loki.tls.certFrom) {
            destination.tls.certFrom = loki.tls.certFrom;
        }
        if (loki.tls.key) {
            destination.tls.key = loki.tls.key;
        }
        if (loki.tls.keyFile) {
            destination.tls.keyFile = loki.tls.keyFile;
        }
        if (loki.tls.keyFrom) {
            destination.tls.keyFrom = loki.tls.keyFrom;
        }
    }

    return destination;
}

function migrateTempo(tempo) {
    const destination = {
        name: "tracesService",
        type: "otlp"
    };
    if (tempo.host) {
        destination.url = tempo.host;
    }
    if (tempo.hostKey) {
        throw new Error(`externalServices.${destination.type}.hostKey is not supported in the new chart. Please set the host directly:\ndestinations:\n- name: ${destination.name}\n  type: ${destination.type}\n  url: <host>/<writeEndpoint>`);
    }

    let secretName = destination.name.toLowerCase();
    if (tempo.secret) {
        destination.secret = {};
        if (tempo.secret.create !== undefined) {
            destination.secret.create = tempo.secret.create;
        }
        if (tempo.secret.name) {
            secretName = tempo.secret.name;
            destination.secret.name = tempo.secret.name;
        }
        if (tempo.secret.namespace) {
            destination.secret.namespace = tempo.secret.namespace;
        }
    }

    destination.proxyURL = tempo.proxyURL;

    if (tempo.searchEndpoint) {
        console.log("externalServices.tempo.searchEndpoint is not used in the new chart.");
    }

    destination.extraHeaders = tempo.extraHeaders;
    destination.extraHeadersFrom = tempo.extraHeadersFrom;
    destination.tenantId = tempo.tenantId;
    destination.tenantIdKey = tempo.tenantIdKey;

    const authMode = tempo.authMode || "basic";
    if (authMode === "basic") {
        destination.auth = {
            type: "basic",
        };
        if (tempo.basicAuth.username) {
            destination.auth.username = tempo.basicAuth.username;
        }
        if (tempo.basicAuth.usernameKey) {
            destination.auth.usernameKey = tempo.basicAuth.usernameKey;
        }
        if (tempo.basicAuth.password) {
            destination.auth.password = tempo.basicAuth.password;
        }
        if (tempo.basicAuth.passwordKey) {
            destination.auth.passwordKey = tempo.basicAuth.passwordKey;
        }
    }

    if (tempo.tls) {
        destination.tls = {};
        if (tempo.tls.insecureSkipVerify !== undefined) {
            destination.tls.insecureSkipVerify = tempo.tls.insecureSkipVerify;
        }
        if (tempo.tls.ca) {
            destination.tls.ca = tempo.tls.ca;
        }
        if (tempo.tls.caFile) {
            destination.tls.caFile = tempo.tls.caFile;
        }
        if (tempo.tls.caFrom) {
            destination.tls.caFrom = tempo.tls.caFrom;
        }
        if (tempo.tls.cert) {
            destination.tls.cert = tempo.tls.cert;
        }
        if (tempo.tls.certFile) {
            destination.tls.certFile = tempo.tls.certFile;
        }
        if (tempo.tls.certFrom) {
            destination.tls.certFrom = tempo.tls.certFrom;
        }
        if (tempo.tls.key) {
            destination.tls.key = tempo.tls.key;
        }
        if (tempo.tls.keyFile) {
            destination.tls.keyFile = tempo.tls.keyFile;
        }
        if (tempo.tls.keyFrom) {
            destination.tls.keyFrom = tempo.tls.keyFrom;
        }
    }
    if (tempo.tlsOptions) {
        throw new Error("externalServices.tempo.tlsOptions is deprecated. Please use externalServices.tempo.tls instead.");
    }

    return destination;
}

function migratePyroscope(pyroscope) {
    const destination = {
        name: "profilesService",
        type: "pyroscope"
    };
    if (pyroscope.host) {
        destination.url = pyroscope.host;
    }
    if (pyroscope.hostKey) {
        throw new Error(`externalServices.${destination.type}.hostKey is not supported in the new chart. Please set the host directly:\ndestinations:\n- name: ${destination.name}\n  type: ${destination.type}\n  url: <host>/<writeEndpoint>`);
    }

    if (pyroscope.secret) {
        destination.secret = {};
        if (pyroscope.secret.create !== undefined) {
            destination.secret.create = pyroscope.secret.create;
        }
        if (pyroscope.secret.name) {
            destination.secret.name = pyroscope.secret.name;
        }
        if (pyroscope.secret.namespace) {
            destination.secret.namespace = pyroscope.secret.namespace;
        }
    }

    destination.proxyURL = pyroscope.proxyURL;

    destination.extraHeaders = pyroscope.extraHeaders;
    destination.extraHeadersFrom = pyroscope.extraHeadersFrom;
    destination.tenantId = pyroscope.tenantId;
    destination.tenantIdKey = pyroscope.tenantIdKey;

    const authMode = pyroscope.authMode || "basic";
    if (authMode === "basic") {
        destination.auth = {
            type: "basic",
        };
        if (pyroscope.basicAuth.username) {
            destination.auth.username = pyroscope.basicAuth.username;
        }
        if (pyroscope.basicAuth.usernameKey) {
            destination.auth.usernameKey = pyroscope.basicAuth.usernameKey;
        }
        if (pyroscope.basicAuth.password) {
            destination.auth.password = pyroscope.basicAuth.password;
        }
        if (pyroscope.basicAuth.passwordKey) {
            destination.auth.passwordKey = pyroscope.basicAuth.passwordKey;
        }
    }

    if (pyroscope.tls) {
        destination.tls = {};
        if (pyroscope.tls.insecureSkipVerify !== undefined) {
            destination.tls.insecureSkipVerify = pyroscope.tls.insecureSkipVerify;
        }
        if (pyroscope.tls.ca) {
            destination.tls.ca = pyroscope.tls.ca;
        }
        if (pyroscope.tls.caFile) {
            destination.tls.caFile = pyroscope.tls.caFile;
        }
        if (pyroscope.tls.caFrom) {
            destination.tls.caFrom = pyroscope.tls.caFrom;
        }
        if (pyroscope.tls.cert) {
            destination.tls.cert = pyroscope.tls.cert;
        }
        if (pyroscope.tls.certFile) {
            destination.tls.certFile = pyroscope.tls.certFile;
        }
        if (pyroscope.tls.certFrom) {
            destination.tls.certFrom = pyroscope.tls.certFrom;
        }
        if (pyroscope.tls.key) {
            destination.tls.key = pyroscope.tls.key;
        }
        if (pyroscope.tls.keyFile) {
            destination.tls.keyFile = pyroscope.tls.keyFile;
        }
        if (pyroscope.tls.keyFrom) {
            destination.tls.keyFrom = pyroscope.tls.keyFrom;
        }
    }

    return destination;
}

// metrics.beyla

function migrateClusterMetrics(oldValues) {
    if (oldValues.metrics && oldValues.metrics.enabled === false) {
        return null;
    }
    const results = {
        clusterMetrics: {
            enabled: true
        },
        "alloy-metrics": oldValues.alloy || {}
    }
    results["alloy-metrics"].enabled = true;

    // Deployments
    if (oldValues["kube-state-metrics"]) {
        results.clusterMetrics["kube-state-metrics"] = oldValues["kube-state-metrics"];
        results.clusterMetrics["kube-state-metrics"].deploy = results.clusterMetrics["kube-state-metrics"].enabled
        delete results.clusterMetrics["kube-state-metrics"].enabled
    }
    if (oldValues["prometheus-node-exporter"]) {
        results.clusterMetrics["node-exporter"] = oldValues["prometheus-node-exporter"];
        results.clusterMetrics["node-exporter"].deploy = results.clusterMetrics["node-exporter"].enabled
        delete results.clusterMetrics["node-exporter"].enabled
    }
    if (oldValues["opencost"]) {
        results.clusterMetrics.opencost = oldValues["opencost"];
        results.clusterMetrics.opencost.opencost.prometheus.existingSecretName = "grafana-k8s-monitoring-metricsservice"
    }

    // Metrics targets
    const targets = {
        kubelet: "kubelet",
        cadvisor: "cadvisor",
        apiserver: "apiServer",
        "kube-state-metrics": "kube-state-metrics",
        "node-exporter": "node-exporter",
        "windows-exporter": "windows-exporter",
        kubeControllerManager: "kubeControllerManager",
        kubeProxy: "kubeProxy",
        kubeScheduler: "kubeScheduler",
        kepler: "kepler",
        cost: "opencost",
    };
    for (const [oldName, newName] of Object.entries(targets)) {
        if (oldValues.metrics && oldValues.metrics[oldName]) {
            results.clusterMetrics[newName] = migrateMetricsTarget(oldValues.metrics[oldName], results.clusterMetrics[newName]);
        }
    }

    return results;
}

function migrateMetricsTarget(target, current) {
    if (!current) {
        current = {};
    }
    current.enabled = target.enabled;
    current.extraDiscoveryRules = target.extraRelabelingRules;
    current.extraMetricProcessingRules = target.extraMetricRelabelingRules;
    current.metricsTuning = target.metricsTuning;
    current.maxCacheSize = target.maxCacheSize;
    current.scrapeInterval = target.scrapeInterval;
    return current;
}

function migrateAnnotationAutodiscovery(oldValues) {
    if (oldValues.metrics && (oldValues.metrics.enabled === false || (oldValues.metrics.autoDiscover && oldValues.metrics.autoDiscover.enabled === false))) {
        return null;
    }
    const results = {
        annotationAutodiscovery: {
            enabled: true
        },
        "alloy-metrics": oldValues.alloy || {}
    };
    results["alloy-metrics"].enabled = true;

    if (oldValues.metrics && oldValues.metrics.autoDiscovery) {
        results.annotationAutodiscovery.annotations = oldValues.metrics.autoDiscovery.annotations;
        results.annotationAutodiscovery.extraDiscoveryRules = oldValues.metrics.autoDiscovery.extraRelabelingRules;
        results.annotationAutodiscovery.scrapeInterval = oldValues.metrics.autoDiscovery.scrapeInterval;
        results.annotationAutodiscovery.metricsTuning = oldValues.metrics.autoDiscovery.metricsTuning;
        results.annotationAutodiscovery.extraMetricProcessingRules = oldValues.metrics.autoDiscovery.extraMetricRelabelingRules;
        results.annotationAutodiscovery.maxCacheSize = oldValues.metrics.autoDiscovery.maxCacheSize;
        results.annotationAutodiscovery.bearerToken = oldValues.metrics.autoDiscovery.bearerToken;
    }

    return results;
}

function migrateAutoinstrumentation(oldValues) {

    if (!oldValues.beyla || oldValues.beyla.enabled === false) {
        return null;
    }
    const results = {
        autoInstrumentation: {
            enabled: true,
            beyla: {}
        },
        "alloy-metrics": oldValues.alloy || {}
    };
    results["alloy-metrics"].enabled = true;

    if (oldValues.metrics && oldValues.metrics.beyla) {
        results.autoInstrumentation.beyla = oldValues.beyla;
        results.autoInstrumentation.extraDiscoveryRules = oldValues.metrics.beyla.extraRelabelingRules;
        results.autoInstrumentation.scrapeInterval = oldValues.metrics.beyla.scrapeInterval;
        results.autoInstrumentation.metricsTuning = oldValues.metrics.beyla.metricsTuning;
        results.autoInstrumentation.extraMetricProcessingRules = oldValues.metrics.beyla.extraMetricRelabelingRules;
        results.autoInstrumentation.maxCacheSize = oldValues.metrics.beyla.maxCacheSize;
    }

    return results;
}

function migratePodLogs(oldValues) {
    if (oldValues.logs && (oldValues.logs.enabled === false || (oldValues.logs.pod_logs && oldValues.logs.pod_logs.enabled === false))) {
        return null;
    }

    const results = {
        podLogs: {
            enabled: true
        },
        "alloy-logs": oldValues["alloy-logs"] || {}
    };
    results["alloy-logs"].enabled = true;

    if (oldValues.logs && oldValues.logs.pod_logs) {
        if (oldValues.logs.pod_logs.gatherMethod === "volumes") {
            results.podLogs.gatherMethod = "volumes";
        } else if (oldValues.logs.pod_logs.gatherMethod === "api") {
            results.podLogs.gatherMethod = "kubernetesApi";
        }
        results.podLogs.namespaces = oldValues.logs.pod_logs.namespaces;
        results.podLogs.excludeNamespaces = oldValues.logs.pod_logs.excludeNamespaces;
        results.podLogs.extraDiscoveryRules = oldValues.logs.pod_logs.extraRelabelingRules;
        results.podLogs.extraLogProcessingStages = oldValues.logs.pod_logs.extraStageBlocks;
    }

    // podLogs.discovery
    // podLogs.annotation
    // podLogs.labels
    // podLogs.annotations
    // podLogs.structuredMetadata
    return results;
}

function migrateClusterEvents(oldValues) {
    if (oldValues.logs && (oldValues.logs.enabled === false || (oldValues.logs.cluster_events && oldValues.logs.cluster_events.enabled === false))) {
        return null;
    }

    const results = {
        clusterEvents: {
            enabled: true
        },
        "alloy-singleton": oldValues["alloy-events"] || {}
    };
    results["alloy-singleton"].enabled = true;

    if (oldValues.logs && oldValues.logs.cluster_events) {
        results.clusterEvents.namespaces = oldValues.logs.cluster_events.namespaces;
        results.clusterEvents.logFormat = oldValues.logs.cluster_events.logFormat;
        results.clusterEvents.extraProcessingStages = oldValues.logs.cluster_events.extraStageBlocks;
    }

    // clusterEvents.logToStdout
    return results;
}

function migratePromOperatorObjects(oldValues) {
    if (oldValues.metrics
        && (oldValues.metrics.enabled === false
        || (oldValues.metrics.podMonitors && oldValues.metrics.podMonitors.enabled === false
        && oldValues.metrics.probes && oldValues.metrics.probes.enabled === false
        && oldValues.metrics.serviceMonitors && oldValues.metrics.serviceMonitors.enabled === false))) {
        return null;
    }

    const results = {
        prometheusOperatorObjects: {
            enabled: true
        },
        "alloy-metrics": oldValues.alloy || {}
    };
    results["alloy-metrics"].enabled = true;

    if (!oldValues["prometheus-operator-crds"] || oldValues["prometheus-operator-crds"].enabled !== false) {
        results.prometheusOperatorObjects.crds = {
            deploy: true
        };
    }

    if (oldValues.metrics) {
        if (oldValues.metrics.podMonitors) {
            results.prometheusOperatorObjects.podMonitors = migratePromOperatorObjectTarget(oldValues.metrics.podMonitors)
        }
        if (oldValues.metrics.probes) {
            results.prometheusOperatorObjects.probes = migratePromOperatorObjectTarget(oldValues.metrics.probes);
        }
        if (oldValues.metrics.serviceMonitors) {
            results.prometheusOperatorObjects.serviceMonitors = migratePromOperatorObjectTarget(oldValues.metrics.serviceMonitors);
        }
    }

    return results;
}

function migratePromOperatorObjectTarget(object) {
    return {
        enabled: object.enabled,
        namespaces: object.namespaces,
        selector: object.selector,
        scrapeInterval: object.scrapeInterval,
        extraDiscoveryRules: object.extraRelabelingRules,
        extraMetricProcessingRules: object.extraMetricRelabelingRules,
        maxCacheSize: object.maxCacheSize,
    };
}

module.exports = { migrate };
