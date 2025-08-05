const ReleaseName = "grafana-k8s-monitoring";

function checkValues(oldValues) {
    if (!oldValues.cluster || !oldValues.cluster.name) {
        return "cluster.name is missing";
    }

    if (!oldValues.externalServices) {
        return "externalServices is missing";
    }
}

function migrateCluster(oldValues) {
    const values = {
        cluster: {
            name: oldValues.cluster.name
        }
    };
    const notes = [];
    if (oldValues.cluster.kubernetesAPIService) {
        notes.push("cluster.kubernetesAPIService is not used in the new chart.");
    }
    return { values, notes };
}

function migrateGlobals(oldValues) {
    const newValues = {};
    if (oldValues.global) {
        newValues.global = oldValues.global;
    }

    if (oldValues.cluster && oldValues.cluster.platform) {
        if (!newValues.global) {
            newValues.global = {};
        }
        newValues.global.platform = oldValues.cluster.platform;
    }

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
    return newValues;
}

function migrateDestinations(oldValues) {
    const destinations = [];
    const notes = [];
    if (oldValues["externalServices"]) {
        if (oldValues.externalServices["prometheus"]) {
            const result = migratePrometheus(oldValues.externalServices.prometheus);
            destinations.push(result.destination);
            notes.push(...result.notes);
        }
        if (oldValues.externalServices["loki"]) {
            const result = migrateLoki(oldValues.externalServices.loki);
            destinations.push(result.destination);
            notes.push(...result.notes);
        }
        if (oldValues.externalServices["tempo"]) {
            const result = migrateTempo(oldValues.externalServices.tempo);
            destinations.push(result.destination);
            notes.push(...result.notes);
        }
        if (oldValues.externalServices["pyroscope"]) {
            const result = migratePyroscope(oldValues.externalServices.pyroscope);
            destinations.push(result.destination);
            notes.push(...result.notes);
        }
    }
    return {values: {destinations}, notes};
}

function migratePrometheus(prometheus) {
    const protocol = prometheus.protocol || "remote_write";
    const destination = {
        name: "metricsService",
        type: "prometheus"
    };
    const notes = [];

    if (protocol === "otlp") {
        destination.type = "otlp";
        destination.protocol = "grpc";
        destination.metrics = { enabled: true }
        destination.traces = { enabled: false }
    } else if (protocol === "otlphttp") {
        destination.type = "otlp";
        destination.protocol = "http";
        destination.metrics = { enabled: true }
        destination.traces = { enabled: false }
    }

    if (prometheus.host) {
        const path = prometheus.writeEndpoint ? prometheus.writeEndpoint : "/api/prom/push";
        destination.url = prometheus.host + path;
    }
    if (prometheus.hostKey) {
        notes.push(`ERROR: externalServices.${destination.type}.hostKey is not supported in the new chart. Please set the host directly:\ndestinations:\n- name: ${destination.name}\n  type: ${destination.type}\n  url: <host>/<writeEndpoint>`);
    }

    if (prometheus.secret) {
        destination.secret = {};
        if (prometheus.secret.create !== undefined) {
            destination.secret.create = prometheus.secret.create;
        }
        if (prometheus.secret.name) {
            destination.secret.name = prometheus.secret.name;
        }
        if (prometheus.secret.namespace) {
            destination.secret.namespace = prometheus.secret.namespace;
        }
    }

    if (protocol === "remote_write") {
        destination.proxyURL = prometheus.proxyURL;
    }

    if (prometheus.queryEndpoint) {
        notes.push("externalServices.prometheus.queryEndpoint is not used in the new chart.");
    }

    destination.extraHeaders = prometheus.extraHeaders;
    destination.extraHeadersFrom = prometheus.extraHeadersFrom;
    destination.extraLabels = prometheus.externalLabels;
    destination.extraLabelsFrom = prometheus.externalLabelsFrom;
    if (protocol === "remote_write") {
        destination.metricProcessingRules = prometheus.writeRelabelConfigRules;
    }
    destination.tenantId = prometheus.tenantId;
    destination.tenantIdKey = prometheus.tenantIdKey;

    const authMode = prometheus.authMode || "basic";
    if (authMode === "basic" && prometheus.basicAuth) {
        destination.auth = { type: "basic" };
        if (prometheus.basicAuth.username)      { destination.auth.username = prometheus.basicAuth.username; }
        if (prometheus.basicAuth.usernameKey)   { destination.auth.usernameKey = prometheus.basicAuth.usernameKey; }
        if (prometheus.basicAuth.password)      { destination.auth.password = prometheus.basicAuth.password; }
        if (prometheus.basicAuth.passwordKey)   { destination.auth.passwordKey = prometheus.basicAuth.passwordKey; }
    } else if (authMode === "bearerToken" && prometheus.bearerToken) {
        destination.auth = { type: "bearerToken" };
        if (prometheus.bearerToken.token)       { destination.auth.bearerToken = prometheus.bearerToken.token; }
        if (prometheus.bearerToken.tokenKey)    { destination.auth.bearerTokenKey = prometheus.bearerToken.tokenKey; }
        if (prometheus.bearerToken.tokenFile)   { destination.bearerTokenFile = prometheus.bearerToken.tokenFile; }
    } else if (authMode === "sigv4" && prometheus.sigv4) {
        destination.auth = { type: "sigv4", sigv4: {}};
        destination.auth.sigv4.accessKey = prometheus.sigv4.accessKey;
        destination.auth.sigv4.profile = prometheus.sigv4.profile;
        destination.auth.sigv4.region = prometheus.sigv4.region;
        destination.auth.sigv4.roleArn = prometheus.sigv4.roleArn;
        destination.auth.sigv4.secretKey = prometheus.sigv4.secretKey;
        destination.auth.sigv4.secretKeyKey = prometheus.sigv4.secretKeyKey;
    } else if (authMode === "oauth2" && prometheus.oauth2) {
        if (prometheus.oauth2.clientId)               { destination.auth.oauth2.clientId = prometheus.oauth2.clientId; }
        if (prometheus.oauth2.clientIdKey)            { destination.auth.oauth2.clientIdKey = prometheus.oauth2.clientIdKey; }
        if (prometheus.oauth2.clientSecret)           { destination.auth.oauth2.clientSecret = prometheus.oauth2.clientSecret; }
        if (prometheus.oauth2.clientSecretKey)        { destination.auth.oauth2.clientSecretKey = prometheus.oauth2.clientSecretKey; }
        if (prometheus.oauth2.clientSecretFile)       { destination.auth.oauth2.clientSecretFile = prometheus.oauth2.clientSecretFile; }
        if (prometheus.oauth2.endpointParams)         { destination.auth.oauth2.endpointParams = prometheus.oauth2.endpointParams; }
        if (prometheus.oauth2.proxyURL)               { destination.auth.oauth2.proxyURL = prometheus.oauth2.proxyURL; }
        if (prometheus.oauth2.noProxy)                { destination.auth.oauth2.noProxy = prometheus.oauth2.noProxy; }
        if (prometheus.oauth2.proxyFromEnvironment)   { destination.auth.oauth2.proxyFromEnvironment = prometheus.oauth2.proxyFromEnvironment; }
        if (prometheus.oauth2.proxyConnectHeader)     { destination.auth.oauth2.proxyConnectHeader = prometheus.oauth2.proxyConnectHeader; }
        if (prometheus.oauth2.scopes)                 { destination.auth.oauth2.scopes = prometheus.oauth2.scopes; }
        if (prometheus.oauth2.tokenURL)               { destination.auth.oauth2.tokenURL = prometheus.oauth2.tokenURL; }
    }

    if (prometheus.tls) {
        destination.tls = {};
        if (prometheus.tls.insecureSkipVerify !== undefined) {
            destination.tls.insecureSkipVerify = prometheus.tls.insecureSkipVerify;
        }
        if (prometheus.tls.ca)          { destination.tls.ca = prometheus.tls.ca; }
        if (prometheus.tls.caFile)      { destination.tls.caFile = prometheus.tls.caFile; }
        if (prometheus.tls.caFrom)      { destination.tls.caFrom = prometheus.tls.caFrom; }
        if (prometheus.tls.cert)        { destination.tls.cert = prometheus.tls.cert; }
        if (prometheus.tls.certFile)    { destination.tls.certFile = prometheus.tls.certFile; }
        if (prometheus.tls.certFrom)    { destination.tls.certFrom = prometheus.tls.certFrom; }
        if (prometheus.tls.key)         { destination.tls.key = prometheus.tls.key; }
        if (prometheus.tls.keyFile)     { destination.tls.keyFile = prometheus.tls.keyFile; }
        if (prometheus.tls.keyFrom)     { destination.tls.keyFrom = prometheus.tls.keyFrom; }
    }

    if (protocol === "remote_write") {
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
            if (prometheus.wal.truncateFrequency)   { destination.writeAheadLog.truncateFrequency = prometheus.wal.truncateFrequency; }
            if (prometheus.wal.minKeepaliveTime)    { destination.writeAheadLog.minKeepaliveTime = prometheus.wal.minKeepaliveTime; }
            if (prometheus.wal.maxKeepaliveTime)    { destination.writeAheadLog.maxKeepaliveTime = prometheus.wal.maxKeepaliveTime; }
        }

        if (prometheus.openTelemetryConversion) {
            destination.openTelemetryConversion = prometheus.openTelemetryConversion;
        }
    }

    return {destination, notes};
}

function migrateLoki(loki) {
    const protocol = loki.protocol || "loki";
    const destination = {
        name: "logsService",
        type: "loki"
    };
    const notes = [];

    if (protocol === "otlp") {
        destination.type = "otlp";
        destination.protocol = "grpc";
        destination.logs = { enabled: true }
        destination.traces = { enabled: false }
    } else if (protocol === "otlphttp") {
        destination.type = "otlp";
        destination.protocol = "http";
        destination.logs = { enabled: true }
        destination.traces = { enabled: false }
    }

    if (loki.host) {
        const path = loki.writeEndpoint ? loki.writeEndpoint : "/loki/api/v1/push";
        destination.url = loki.host + path;
    } else if (loki.hostKey) {
        notes.push(`ERROR: externalServices.${destination.type}.hostKey is not supported in the new chart. Please set the host directly:\ndestinations:\n- name: ${destination.name}\n  type: ${destination.type}\n  url: <host>/<writeEndpoint>`);
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
        notes.push("externalServices.loki.queryEndpoint is not used in the new chart.");
    }

    destination.extraHeaders = loki.extraHeaders;
    destination.extraHeadersFrom = loki.extraHeadersFrom;
    destination.extraLabels = loki.externalLabels;
    destination.extraLabelsFrom = loki.externalLabelsFrom;
    destination.tenantId = loki.tenantId;
    destination.tenantIdKey = loki.tenantIdKey;

    const authMode = loki.authMode || "basic";
    if (authMode === "basic" && loki.basicAuth) {
        destination.auth = { type: "basic" };
        if (loki.basicAuth.username)    { destination.auth.username = loki.basicAuth.username; }
        if (loki.basicAuth.usernameKey) { destination.auth.usernameKey = loki.basicAuth.usernameKey; }
        if (loki.basicAuth.password)    { destination.auth.password = loki.basicAuth.password; }
        if (loki.basicAuth.passwordKey) { destination.auth.passwordKey = loki.basicAuth.passwordKey; }
    } else if (authMode === "bearerToken" && loki.bearerToken) {
        destination.auth = { type: "bearerToken" };
        if (loki.bearerToken.token)     { destination.auth.bearerToken = loki.bearerToken.token; }
        if (loki.bearerToken.tokenKey)  { destination.auth.bearerTokenKey = loki.bearerToken.tokenKey; }
        if (loki.bearerToken.tokenFile) { destination.auth.bearerTokenFile = loki.bearerToken.tokenFile; }
    } else if (authMode === "oauth2" && loki.oauth2) {
        destination.auth = { type: "oauth2" };
        if (loki.oauth2.clientId)               { destination.auth.oauth2.clientId = loki.oauth2.clientId; }
        if (loki.oauth2.clientIdKey)            { destination.auth.oauth2.clientIdKey = loki.oauth2.clientIdKey; }
        if (loki.oauth2.clientSecret)           { destination.auth.oauth2.clientSecret = loki.oauth2.clientSecret; }
        if (loki.oauth2.clientSecretKey)        { destination.auth.oauth2.clientSecretKey = loki.oauth2.clientSecretKey; }
        if (loki.oauth2.clientSecretFile)       { destination.auth.oauth2.clientSecretFile = loki.oauth2.clientSecretFile; }
        if (loki.oauth2.endpointParams)         { destination.auth.oauth2.endpointParams = loki.oauth2.endpointParams; }
        if (loki.oauth2.proxyURL)               { destination.auth.oauth2.proxyURL = loki.oauth2.proxyURL; }
        if (loki.oauth2.noProxy)                { destination.auth.oauth2.noProxy = loki.oauth2.noProxy; }
        if (loki.oauth2.proxyFromEnvironment)   { destination.auth.oauth2.proxyFromEnvironment = loki.oauth2.proxyFromEnvironment; }
        if (loki.oauth2.proxyConnectHeader)     { destination.auth.oauth2.proxyConnectHeader = loki.oauth2.proxyConnectHeader; }
        if (loki.oauth2.scopes)                 { destination.auth.oauth2.scopes = loki.oauth2.scopes; }
        if (loki.oauth2.tokenURL)               { destination.auth.oauth2.tokenURL = loki.oauth2.tokenURL; }
    }

    if (loki.tls) {
        destination.tls = {};
        if (loki.tls.insecureSkipVerify !== undefined) {
            destination.tls.insecureSkipVerify = loki.tls.insecureSkipVerify;
        }
        if (loki.tls.ca)        { destination.tls.ca = loki.tls.ca; }
        if (loki.tls.caFile)    { destination.tls.caFile = loki.tls.caFile; }
        if (loki.tls.caFrom)    { destination.tls.caFrom = loki.tls.caFrom; }
        if (loki.tls.cert)      { destination.tls.cert = loki.tls.cert; }
        if (loki.tls.certFile)  { destination.tls.certFile = loki.tls.certFile; }
        if (loki.tls.certFrom)  { destination.tls.certFrom = loki.tls.certFrom; }
        if (loki.tls.key)       { destination.tls.key = loki.tls.key; }
        if (loki.tls.keyFile)   { destination.tls.keyFile = loki.tls.keyFile; }
        if (loki.tls.keyFrom)   { destination.tls.keyFrom = loki.tls.keyFrom; }
    }

    return {destination, notes};
}

function migrateTempo(tempo) {
    const destination = {
        name: "tracesService",
        type: "otlp",
        protocol: tempo.protocol,
        metrics: { enabled: false },
        logs: { enabled: false },
        traces: { enabled: true }
    };
    const notes = [];
    if (tempo.host) {
        destination.url = tempo.host;
    }
    if (tempo.hostKey) {
        notes.push(`ERROR: externalServices.${destination.type}.hostKey is not supported in the new chart. Please set the host directly:\ndestinations:\n- name: ${destination.name}\n  type: ${destination.type}\n  url: <host>/<writeEndpoint>`);
    }

    if (tempo.secret) {
        destination.secret = {};
        if (tempo.secret.create !== undefined) {
            destination.secret.create = tempo.secret.create;
        }
        if (tempo.secret.name) {
            destination.secret.name = tempo.secret.name;
        }
        if (tempo.secret.namespace) {
            destination.secret.namespace = tempo.secret.namespace;
        }
    }

    destination.proxyURL = tempo.proxyURL;

    if (tempo.searchEndpoint) {
        notes.push("externalServices.tempo.searchEndpoint is not used in the new chart.");
    }

    destination.extraHeaders = tempo.extraHeaders;
    destination.extraHeadersFrom = tempo.extraHeadersFrom;
    destination.tenantId = tempo.tenantId;
    destination.tenantIdKey = tempo.tenantIdKey;

    const authMode = tempo.authMode || "basic";
    if (authMode === "basic" && tempo.basicAuth) {
        destination.auth = { type: "basic" };
        if (tempo.basicAuth.username)       { destination.auth.username = tempo.basicAuth.username; }
        if (tempo.basicAuth.usernameKey)    { destination.auth.usernameKey = tempo.basicAuth.usernameKey; }
        if (tempo.basicAuth.password)       { destination.auth.password = tempo.basicAuth.password; }
        if (tempo.basicAuth.passwordKey)    { destination.auth.passwordKey = tempo.basicAuth.passwordKey; }
    } else if (authMode === "bearerToken" && tempo.bearerToken) {
        destination.auth = { type: "bearerToken" };
        if (tempo.bearerToken.token)        { destination.auth.bearerToken = tempo.bearerToken.token; }
        if (tempo.bearerToken.tokenKey)     { destination.auth.bearerTokenKey = tempo.bearerToken.tokenKey; }
    }

    if (tempo.tls) {
        destination.tls = {};
        if (tempo.tls.insecureSkipVerify !== undefined) {
            destination.tls.insecureSkipVerify = tempo.tls.insecureSkipVerify;
        }
        if (tempo.tls.ca)       { destination.tls.ca = tempo.tls.ca; }
        if (tempo.tls.caFile)   { destination.tls.caFile = tempo.tls.caFile; }
        if (tempo.tls.caFrom)   { destination.tls.caFrom = tempo.tls.caFrom; }
        if (tempo.tls.cert)     { destination.tls.cert = tempo.tls.cert; }
        if (tempo.tls.certFile) { destination.tls.certFile = tempo.tls.certFile; }
        if (tempo.tls.certFrom) { destination.tls.certFrom = tempo.tls.certFrom; }
        if (tempo.tls.key)      { destination.tls.key = tempo.tls.key; }
        if (tempo.tls.keyFile)  { destination.tls.keyFile = tempo.tls.keyFile; }
        if (tempo.tls.keyFrom)  { destination.tls.keyFrom = tempo.tls.keyFrom; }
    }
    if (tempo.tlsOptions) {
        notes.push("ERROR: externalServices.tempo.tlsOptions is deprecated. Please use externalServices.tempo.tls instead.");
    }

    return {destination, notes};
}

function migratePyroscope(pyroscope) {
    const destination = {
        name: "profilesService",
        type: "pyroscope"
    };
    const notes = [];
    if (pyroscope.host) {
        destination.url = pyroscope.host;
    }
    if (pyroscope.hostKey) {
        notes.push(`ERROR: externalServices.${destination.type}.hostKey is not supported in the new chart. Please set the host directly:\ndestinations:\n- name: ${destination.name}\n  type: ${destination.type}\n  url: <host>/<writeEndpoint>`);
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
    if (authMode === "basic" && pyroscope.basicAuth) {
        destination.auth = { type: "basic" };
        if (pyroscope.basicAuth.username)    { destination.auth.username = pyroscope.basicAuth.username; }
        if (pyroscope.basicAuth.usernameKey) { destination.auth.usernameKey = pyroscope.basicAuth.usernameKey; }
        if (pyroscope.basicAuth.password)    { destination.auth.password = pyroscope.basicAuth.password; }
        if (pyroscope.basicAuth.passwordKey) { destination.auth.passwordKey = pyroscope.basicAuth.passwordKey; }
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

    return {destination, notes};
}

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
    if (oldValues["prometheus-windows-exporter"]) {
        results.clusterMetrics["windows-exporter"] = oldValues["prometheus-windows-exporter"];
        results.clusterMetrics["windows-exporter"].deploy = results.clusterMetrics["windows-exporter"].enabled
        delete results.clusterMetrics["windows-exporter"].enabled
    }
    if (oldValues["opencost"]) {
        results.clusterMetrics.opencost = oldValues.opencost;
        if (oldValues.opencost.opencost && oldValues.opencost.opencost.prometheus) {
            results.clusterMetrics.opencost.metricsSource = "metricsService";
            results.clusterMetrics.opencost.opencost.prometheus.existingSecretName = "metricsservice-" + ReleaseName;
        }
    }
    if (oldValues["kepler"]) {
        results.clusterMetrics.kepler = oldValues.kepler;
    }

    // Metrics targets
    const targets = {
        kubelet: "kubelet",
        kubeletResource: "kubeletResource",
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
            if (oldValues.metrics[oldName].nodeAddressFormat) {
                notes.push(`ERROR: metrics.${oldName}.nodeAddressFormat is not used in the new chart.`);
            }
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

function migrateApplicationObservability(oldValues) {
    const notes = [];
    if (!oldValues.traces || oldValues.traces.enabled === false) {
        return {values: null, notes: []};
    }
    const results = {
        applicationObservability: {
            enabled: true
        },
        "alloy-receiver": oldValues.alloy || {}
    };
    results["alloy-receiver"].enabled = true;

    if (oldValues.receivers) {
        results.applicationObservability.receivers = {};
        if (oldValues.receivers.grpc || oldValues.receivers.http) {
            results.applicationObservability.receivers.otlp = {
                includeDebugMetrics: !oldValues.receivers.grpc.disable_debug_metrics || !oldValues.receivers.http.disable_debug_metrics
            }
        }

        if (oldValues.receivers.grpc && oldValues.receivers.grpc.enabled !== false) {
            results.applicationObservability.receivers.otlp.grpc = {
                enabled: oldValues.receivers.grpc.enabled,
                port: oldValues.receivers.grpc.port,
            }
        }
        if (oldValues.receivers.http && oldValues.receivers.http.enabled !== false) {
            results.applicationObservability.receivers.otlp.http = {
                enabled: oldValues.receivers.http.enabled,
                port: oldValues.receivers.http.port,
            }
        }
        if (oldValues.receivers.prometheus) {
            notes.push("ERROR: receivers.prometheus is not supported in the new chart.");
        }
        if (oldValues.receivers.jaeger) {
            results.applicationObservability.receivers.zipkin = {
                grpc: {
                    enabled: oldValues.receivers.jaeger.grpc.enabled,
                    port: oldValues.receivers.jaeger.grpc.port,
                },
                thriftBinary: {
                    enabled: oldValues.receivers.jaeger.thriftBinary.enabled,
                    port: oldValues.receivers.jaeger.thriftBinary.port,
                },
                thriftCompact: {
                    enabled: oldValues.receivers.jaeger.thriftCompact.enabled,
                    port: oldValues.receivers.jaeger.thriftCompact.port,
                },
                thriftHttp: {
                    enabled: oldValues.receivers.jaeger.thriftHttp.enabled,
                    port: oldValues.receivers.jaeger.thriftHttp.port,
                },
                includeDebugMetrics: !oldValues.receivers.jaeger.disable_debug_metrics
            }
        }
        if (oldValues.receivers.zipkin) {
            results.applicationObservability.receivers.zipkin = {
                enabled: oldValues.receivers.zipkin.enabled,
                port: oldValues.receivers.zipkin.port,
                includeDebugMetrics: !oldValues.receivers.zipkin.disable_debug_metrics
            }
        }
        if (oldValues.receivers.grafanaCloudMetrics && oldValues.receivers.grafanaCloudMetrics.enabled === true) {
            results.applicationObservability.connectors = {
                grafanaCloudMetrics: {enabled: true}
            };
        }
    }
    return {values: results, notes};
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

    if (oldValues.metrics && oldValues.metrics.autoDiscover) {
        results.annotationAutodiscovery.annotations = oldValues.metrics.autoDiscover.annotations;
        results.annotationAutodiscovery.extraDiscoveryRules = oldValues.metrics.autoDiscover.extraRelabelingRules;
        results.annotationAutodiscovery.scrapeInterval = oldValues.metrics.autoDiscover.scrapeInterval;
        results.annotationAutodiscovery.metricsTuning = oldValues.metrics.autoDiscover.metricsTuning;
        results.annotationAutodiscovery.extraMetricProcessingRules = oldValues.metrics.autoDiscover.extraMetricRelabelingRules;
        results.annotationAutodiscovery.maxCacheSize = oldValues.metrics.autoDiscover.maxCacheSize;
        results.annotationAutodiscovery.bearerToken = oldValues.metrics.autoDiscover.bearerToken;
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
    if (oldValues.logs && (oldValues.logs.pod_logs && oldValues.logs.pod_logs.enabled === false)) {
        return null;
    }
    const notes = [];

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
        if (oldValues.logs.pod_logs.volumeGatherSettings) {
            results.podLogs.volumeGatherSettings = oldValues.logs.pod_logs.volumeGatherSettings;
        }
        results.podLogs.namespaces = oldValues.logs.pod_logs.namespaces;
        results.podLogs.excludeNamespaces = oldValues.logs.pod_logs.excludeNamespaces;
        results.podLogs.extraDiscoveryRules = oldValues.logs.pod_logs.extraRelabelingRules;
        results.podLogs.extraLogProcessingStages = oldValues.logs.pod_logs.extraStageBlocks;
        results.podLogs.annotations = oldValues.logs.pod_logs.annotations;
        results.podLogs.labels = oldValues.logs.pod_logs.labels;

        if (oldValues.logs.pod_logs.structuredMetadata) {
            notes.push("ERROR: logs.pod_logs.structuredMetadata is not used in the new chart.");
        }
        if (oldValues.logs.pod_logs.discovery) {
            notes.push("ERROR: logs.pod_logs.discovery is not used in the new chart.");
        }
        if (oldValues.logs.pod_logs.annotation) {
            notes.push("ERROR: logs.pod_logs.annotation is not used in the new chart.");
        }
    }

    return results;
}

function migrateClusterEvents(oldValues) {
    if (oldValues.logs && (oldValues.logs.cluster_events && oldValues.logs.cluster_events.enabled === false)) {
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
    const notes = [];

    if (!oldValues["prometheus-operator-crds"] || oldValues["prometheus-operator-crds"].enabled !== false) {
        results.prometheusOperatorObjects.crds = {
            deploy: true
        };
    }

    if (oldValues.metrics) {
        if (oldValues.metrics.podMonitors) {
            const podMonitorsResult = migratePromOperatorObjectTarget(oldValues.metrics.podMonitors, "podMonitors");
            results.prometheusOperatorObjects.podMonitors = podMonitorsResult.result;
            notes.push(...podMonitorsResult.notes);
        }
        if (oldValues.metrics.probes) {
            const probesResult = migratePromOperatorObjectTarget(oldValues.metrics.probes, "probes");
            results.prometheusOperatorObjects.probes = probesResult.result;
            notes.push(...probesResult.notes);
        }
        if (oldValues.metrics.serviceMonitors) {
            const serviceMonitorsResult = migratePromOperatorObjectTarget(oldValues.metrics.serviceMonitors, "serviceMonitors");
            results.prometheusOperatorObjects.serviceMonitors = serviceMonitorsResult.result;
            notes.push(...serviceMonitorsResult.notes);
        }
    }

    return {values: results, notes};
}

// Parse v1 selector format and convert to v2 labelSelectors
function parseV1Selector(selector) {
    if (!selector || typeof selector !== 'string') {
        return null;
    }
    
    // Handle the format: match_labels = {key = "value", key2 = "value2"} or match_labels = {}
    const matchLabelsMatch = selector.match(/match_labels\s*=\s*\{([^}]*)\}/);
    if (!matchLabelsMatch) {
        return null;
    }
    
    const labelsString = matchLabelsMatch[1].trim();
    
    // Handle empty selector case: match_labels = {}
    if (labelsString === '') {
        return {};
    }
    
    const labelPairs = labelsString.split(',');
    const labelSelectors = {};
    
    for (const pair of labelPairs) {
        const match = pair.trim().match(/(\w+)\s*=\s*"([^"]+)"/);
        if (match) {
            const [, key, value] = match;
            labelSelectors[key] = value;
        }
    }
    
    return labelSelectors;
}

function migratePromOperatorObjectTarget(object, objectType) {
    const result = {
        enabled: object.enabled,
        namespaces: object.namespaces,
        scrapeInterval: object.scrapeInterval,
        extraDiscoveryRules: object.extraRelabelingRules,
        extraMetricProcessingRules: object.extraMetricRelabelingRules,
        maxCacheSize: object.maxCacheSize,
    };
    const notes = [];
    
    // Convert v1 selector format to v2 labelSelectors format
    if (object.selector) {
        const labelSelectors = parseV1Selector(object.selector);
        if (labelSelectors !== null) {
            result.labelSelectors = labelSelectors;
        } else {
            notes.push(`ERROR: Cannot parse selector "${object.selector}" for ${objectType}. Manual migration required. Please convert to labelSelectors format in the v2 values file.`);
            // Keep the original selector for reference
            result.selector = object.selector;
        }
    }
    
    return { result, notes };
}

function migrateProfiles(oldValues) {
    if (!oldValues.profiles || oldValues.profiles.enabled === false) {
        return {};
    }

    const values = {
        profiles: {
            enabled: true,
        },
        "alloy-profiles": oldValues["alloy-profiles"] || {}
    };
    values["alloy-profiles"].enabled = true;

    values.profiles.ebpf = oldValues.profiles.ebpf;
    if (values.profiles.ebpf && values.profiles.ebpf.extraRelabelingRules) {
        values.profiles.ebpf.extraDiscoveryRules = values.profiles.ebpf.extraRelabelingRules;
        delete values.profiles.ebpf.extraRelabelingRules;
    }
    values.profiles.java = oldValues.profiles.java;
    if (values.profiles.java && values.profiles.java.extraRelabelingRules) {
        values.profiles.java.extraDiscoveryRules = values.profiles.java.extraRelabelingRules;
        delete values.profiles.java.extraRelabelingRules;
    }
    values.profiles.pprof = oldValues.profiles.pprof;
    if (values.profiles.pprof && values.profiles.pprof.extraRelabelingRules) {
        values.profiles.pprof.extraDiscoveryRules = values.profiles.pprof.extraRelabelingRules;
        delete values.profiles.pprof.extraRelabelingRules;
    }

    return values;
}

function migrateAlloyIntegration(oldValues) {
    if (oldValues.metrics && (oldValues.metrics.enabled === false || (oldValues.metrics.alloy && oldValues.metrics.alloy.enabled === false))) {
        return {values: {}, notes: []};
    }
    const notes = [];
    const values = {
        integrations: {
            alloy: {
                instances: [{
                    name: "alloy",
                    labelSelectors: {
                        "app.kubernetes.io/name": []  // Will be appended to later
                    },
                    metrics: {
                        tuning: {
                            useDefaultAllowList: false,
                            includeMetrics: ["alloy_build_info"]
                        }
                    }
                }]
            }
        },
        "alloy-metrics": oldValues.alloy || {}
    }
    values["alloy-metrics"].enabled = true

    if (oldValues.metrics && oldValues.metrics.alloy) {
        if (oldValues.metrics.alloy.scrapeInterval) {
            values.integrations.alloy.instances[0].metrics.scrapeInterval = oldValues.metrics.alloy.scrapeInterval
        }
        if (oldValues.metrics.alloy.maxCacheSize) {
            values.integrations.alloy.instances[0].maxCacheSize = oldValues.metrics.alloy.maxCacheSize
        }
        if (oldValues.metrics.alloy.extraRelabelingRules) {
            notes.push("metrics.alloy.extraRelabelingRules is not yet in the v2 alloy integration.");
        }
        if (oldValues.metrics.alloy.extraMetricRelabelingRules) {
            notes.push("metrics.alloy.extraMetricRelabelingRules is not yet in the v2 alloy integration.");
        }

        if (oldValues.metrics.alloy.metricsTuning) {
            if (oldValues.metrics.alloy.metricsTuning.useIntegrationAllowList === true) {
                values.integrations.alloy.instances[0].metrics.tuning.useDefaultAllowList = true
            }
            if (oldValues.metrics.alloy.metricsTuning.includeMetrics) {
                values.integrations.alloy.instances[0].metrics.tuning.includeMetrics = oldValues.metrics.alloy.metricsTuning.includeMetrics
            }
            if (oldValues.metrics.alloy.metricsTuning.excludeMetrics) {
                values.integrations.alloy.instances[0].metrics.tuning.excludeMetrics = oldValues.metrics.alloy.metricsTuning.excludeMetrics
            }
        }
    }
    return { values, notes };
}

function migrateCollectors(oldValues) {
    const values = {};
    if (oldValues.extraConfig) {
        values["alloy-metrics"] = {
            extraConfig: oldValues.extraConfig
        }
    }
    if (oldValues.logs && oldValues.logs.extraConfig) {
        values["alloy-logs"] = {
            extraConfig: oldValues.logs.extraConfig
        }
    }
    if (oldValues.logs && oldValues.cluster_events && oldValues.cluster_events.extraConfig) {
        values["alloy-singleton"] = {
            extraConfig: oldValues.cluster_events.extraConfig
        }
    }
    if (oldValues.profiles && oldValues.profiles.extraConfig) {
        values["alloy-profiles"] = {
            extraConfig: oldValues.profiles.extraConfig
        }
    }
    return values;
}

module.exports = {
    checkValues,
    migrateCluster,
    migrateGlobals,
    migrateDestinations,
    migrateClusterMetrics,
    migrateClusterEvents,
    migratePodLogs,
    migrateAnnotationAutodiscovery,
    migrateApplicationObservability,
    migrateAutoinstrumentation,
    migratePromOperatorObjects,
    migrateProfiles,
    migrateAlloyIntegration,
    migrateCollectors,
};
