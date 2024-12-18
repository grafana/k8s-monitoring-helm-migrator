document.getElementById('left-textarea').addEventListener('input', function() {
  const oldValues = jsyaml.load(this.value);
  let newValues = {};
  let notes = [];

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

  document.getElementById('right-textarea').value = jsyaml.dump(newValues);
  if (notes.length > 0) {
    document.getElementById('notesList').innerHTML = notes.map(note => `<li>${note}</li>`).join('');
  } else {
    document.getElementById('notesList').innerHTML = '';
  }
});
