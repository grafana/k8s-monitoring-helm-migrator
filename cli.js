const {
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
  migrateCollectors
} = require('./migrate.js');
const _ = require('lodash')
const fs = require('fs');
const file = process.argv[2];
const yaml = require('js-yaml');

try {
  const oldValues = yaml.load(fs.readFileSync(file, 'utf8'));
  let newValues = {};
  let notes = [];

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

    const yamlOptions = {
      indent: 2,
      lineWidth: -1,
    }
    console.log(yaml.dump(newValues, yamlOptions));
    console.error("Notes: " + JSON.stringify(notes));
  }
} catch (e) {
  console.error(e);
}
