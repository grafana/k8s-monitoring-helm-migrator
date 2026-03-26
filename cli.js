const _ = require('lodash')
const fs = require('fs');
const yaml = require('js-yaml');

// Parse --mode flag
let mode = "v1-to-v3";
let file;
const args = process.argv.slice(2);
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--mode" && i + 1 < args.length) {
    mode = args[i + 1];
    i++;
  } else {
    file = args[i];
  }
}

if (!file) {
  console.error("Usage: node cli.js [--mode v1-to-v3|v3-to-v4] <file>");
  process.exit(1);
}

const yamlOptions = {
  indent: 2,
  lineWidth: -1,
}

try {
  const oldValues = yaml.load(fs.readFileSync(file, 'utf8'));
  let newValues = {};
  let notes = [];

  if (mode === "v3-to-v4") {
    const { checkValuesV3, migrateV3toV4 } = require('./migrate-v3-to-v4.js');

    const validationError = checkValuesV3(oldValues);
    if (validationError) {
      console.error("This does not appear to be a K8s Monitoring v3 values file:");
      console.error(validationError);
    } else {
      const result = migrateV3toV4(oldValues);
      newValues = result.values;
      notes = result.notes;

      console.log(yaml.dump(newValues, yamlOptions));
      console.error("Notes: " + JSON.stringify(notes));
    }
  } else {
    const {
      checkValues,
      migrateCluster,
      migrateGlobals,
      migrateDestinations,
      migrateClusterMetrics,
      migrateClusterEvents,
      migrateNodeLogs,
      migratePodLogs,
      migrateAnnotationAutodiscovery,
      migrateApplicationObservability,
      migrateAutoinstrumentation,
      migratePromOperatorObjects,
      migrateProfiles,
      migrateAlloyIntegration,
      migrateCollectors
    } = require('./migrate.js');

    const clusterNotes = checkValues(oldValues)
    if (clusterNotes) {
      console.error("This does not appear to be a K8s Monitoring v1 values file:")
      console.error(clusterNotes);
    } else {

      {
        const results = migrateCluster(oldValues);
        newValues = _.merge(newValues, results.values);
        notes = notes.concat(results.notes);
      }
      newValues = _.merge(newValues, migrateGlobals(oldValues));

      {
        const results = migrateDestinations(oldValues);
        newValues = _.merge(newValues, results.values);
        notes = notes.concat(results.notes);
      }

      newValues = _.merge(newValues, migrateClusterMetrics(oldValues));
      newValues = _.merge(newValues, migrateClusterEvents(oldValues));
      newValues = _.merge(newValues, migrateNodeLogs(oldValues));
      newValues = _.merge(newValues, migratePodLogs(oldValues));
      {
        const results = migrateApplicationObservability(oldValues);
        newValues = _.merge(newValues, results.values);
        notes = notes.concat(results.notes);
      }
      newValues = _.merge(newValues, migrateAnnotationAutodiscovery(oldValues));
      newValues = _.merge(newValues, migrateAutoinstrumentation(oldValues));
      {
        const results = migratePromOperatorObjects(oldValues);
        newValues = _.merge(newValues, results.values);
        notes = notes.concat(results.notes);
      }
      newValues = _.merge(newValues, migrateProfiles(oldValues));
      {
        const results = migrateAlloyIntegration(oldValues);
        newValues = _.merge(newValues, results.values);
        notes = notes.concat(results.notes);
      }
      newValues = _.merge(newValues, migrateCollectors(oldValues));

      if (newValues.integrations && newValues.integrations.alloy) {
        for (const alloy of ["alloy-metrics", "alloy-singleton", "alloy-logs", "alloy-receiver", "alloy-profiles"]) {
          if (newValues[alloy] && newValues[alloy].enabled === true) {
            newValues.integrations.alloy.instances[0].labelSelectors["app.kubernetes.io/name"].push(alloy);
          }
        }
      }

      console.log(yaml.dump(newValues, yamlOptions));
      console.error("Notes: " + JSON.stringify(notes));
    }
  }
} catch (e) {
  console.error(e);
}
