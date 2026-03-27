function getSelectedMode() {
  return document.querySelector('input[name="migration-mode"]:checked').value;
}

function updateLabels(mode) {
  if (mode === "v3-to-v4") {
    document.getElementById('input-label').textContent = "values.yaml (v3)";
    document.getElementById('output-label').textContent = "values.yaml (v4)";
    document.getElementById('upload-label').textContent = "Upload v3 values.yaml file:";
  } else {
    document.getElementById('input-label').textContent = "values.yaml (v1)";
    document.getElementById('output-label').textContent = "values.yaml (v2/v3)";
    document.getElementById('upload-label').textContent = "Upload v1 values.yaml file:";
  }
}

function processMigration() {
  const leftTextarea = document.getElementById('left-textarea');

  let oldValues = {};
  try {
    oldValues = jsyaml.load(leftTextarea.value);
  } catch (error) {
    document.getElementById('notesList').innerHTML = `<li class="error">Error parsing YAML: ${error.message}</li>`;
    return;
  }

  let newValues = {};
  let notes = [];

  const mode = getSelectedMode();

  if (mode === "v3-to-v4") {
    const validationError = checkValuesV3(oldValues);
    if (validationError) {
      notes = notes.concat(["This does not appear to be a K8s Monitoring v3 values file:"], [validationError]);
    } else {
      const result = migrateV3toV4(oldValues);
      newValues = result.values;
      notes = result.notes;
    }
  } else {
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
}

document.getElementById('file-upload').addEventListener('change', function(event) {
  const file = event.target.files[0];
  if (file) {
    // Validate file type
    const fileName = file.name.toLowerCase();
    if (!fileName.endsWith('.yaml') && !fileName.endsWith('.yml')) {
      document.getElementById('notesList').innerHTML = '<li class="error">Please select a YAML file (.yaml or .yml)</li>';
      event.target.value = ''; // Clear the file input
      return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
      document.getElementById('left-textarea').value = e.target.result;
      processMigration();
    };
    reader.readAsText(file);
  }
});

document.getElementById('left-textarea').addEventListener('input', processMigration);

document.querySelectorAll('input[name="migration-mode"]').forEach(function(radio) {
  radio.addEventListener('change', function() {
    updateLabels(this.value);
    processMigration();
  });
});
