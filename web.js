document.getElementById('left-textarea').addEventListener('input', function() {
  const oldValues = jsyaml.load(this.value);
  let newValues = {};
  newValues = _.merge(newValues, migrateCluster(oldValues));
  newValues = _.merge(newValues, migrateGlobals(oldValues));
  newValues = _.merge(newValues, migrateDestinations(oldValues));
  newValues = _.merge(newValues, migrateClusterMetrics(oldValues));
  newValues = _.merge(newValues, migrateClusterEvents(oldValues));
  newValues = _.merge(newValues, migratePodLogs(oldValues));
  // newValues = _.merge(newValues, migrateApplicationObservability(oldValues));
  newValues = _.merge(newValues, migrateAnnotationAutodiscovery(oldValues));
  newValues = _.merge(newValues, migrateAutoinstrumentation(oldValues));
  newValues = _.merge(newValues, migratePromOperatorObjects(oldValues));
  document.getElementById('right-textarea').value = jsyaml.dump(newValues);
});
