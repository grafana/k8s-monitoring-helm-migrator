document.getElementById('left-textarea').addEventListener('input', function() {
  const oldValues = jsyaml.load(this.value);
  let newValues = {};
  let notes = [];

  const clusterNotes = checkValues(oldValues)
  if (clusterNotes) {
    notes = notes.concat(["This does not appear to be a K8s Monitoring v1 values file:"], clusterNotes);
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
    newValues = _.merge(newValues, migratePromOperatorObjects(oldValues));
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
  }

  const yamlOptions = {
    indent: 2,
    lineWidth: -1,
  }
  document.getElementById('right-textarea').value = jsyaml.dump(newValues, yamlOptions);
  if (notes.length > 0) {
    document.getElementById('notesList').innerHTML = notes.map(note => `<li>${note}</li>`).join('');
  } else {
    document.getElementById('notesList').innerHTML = '';
  }
});
