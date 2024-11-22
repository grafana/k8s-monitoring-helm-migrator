const {
  migrateCluster,
  migrateGlobals,
  migrateDestinations,
  migrateClusterMetrics,
  migrateClusterEvents,
  migratePodLogs,
  migrateAnnotationAutodiscovery,
  migrateAutoinstrumentation,
  migratePromOperatorObjects,
} = require('./migrate.js');
const _ = require('lodash')
const fs = require('fs');
const file = process.argv[2];
const yaml = require('js-yaml');

try {
  const oldValues = yaml.load(fs.readFileSync(file, 'utf8'));
  let newValues = {};
  newValues = _.merge(newValues, migrateCluster(oldValues));
  newValues = _.merge(newValues, migrateGlobals(oldValues));
  newValues = _.merge(newValues, migrateDestinations(oldValues));
  newValues = _.merge(newValues, migrateClusterMetrics(oldValues));
  newValues = _.merge(newValues, migrateClusterEvents(oldValues));
  newValues = _.merge(newValues, migratePodLogs(oldValues));
  newValues = _.merge(newValues, migrateApplicationObservability(oldValues));
  newValues = _.merge(newValues, migrateAnnotationAutodiscovery(oldValues));
  newValues = _.merge(newValues, migrateAutoinstrumentation(oldValues));
  newValues = _.merge(newValues, migratePromOperatorObjects(oldValues));
  console.log(yaml.dump(newValues));
} catch (e) {
  console.error(e);
}
