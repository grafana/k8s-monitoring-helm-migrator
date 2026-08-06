function getSelectedMode() {
  return document.querySelector('input[name="migration-mode"]:checked').value;
}

function updateLabels(mode) {
  if (mode === "v3-to-v4") {
    document.getElementById('input-label').textContent = "values.yaml (v3)";
    document.getElementById('output-label').textContent = "values.yaml (v4)";
    document.getElementById('upload-label').textContent = "Upload v3 values.yaml file:";
  } else if (mode === "v1-to-v4") {
    document.getElementById('input-label').textContent = "values.yaml (v1)";
    document.getElementById('output-label').textContent = "values.yaml (v4)";
    document.getElementById('upload-label').textContent = "Upload v1 values.yaml file:";
  } else {
    document.getElementById('input-label').textContent = "values.yaml (v1)";
    document.getElementById('output-label').textContent = "values.yaml (v2/v3)";
    document.getElementById('upload-label').textContent = "Upload v1 values.yaml file:";
  }
}

function runV1toV3(oldValues) {
  let newValues = {};
  let notes = [];

  const clusterNotes = checkValues(oldValues);
  if (clusterNotes) {
    return { values: {}, notes: ["This does not appear to be a K8s Monitoring v1 values file:", clusterNotes] };
  }

  const result = migrateV1toV3(oldValues);
  return result;
}

function runV3toV4(oldValues) {
  const validationError = checkValuesV3(oldValues);
  if (validationError) {
    return { values: {}, notes: ["This does not appear to be a K8s Monitoring v3 values file:", validationError] };
  }

  return migrateV3toV4(oldValues);
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
    const result = runV3toV4(oldValues);
    newValues = result.values;
    notes = result.notes;
  } else if (mode === "v1-to-v4") {
    // Step 1: v1 -> v3
    const v3Result = runV1toV3(oldValues);
    if (v3Result.notes.some(n => n.startsWith("This does not appear"))) {
      newValues = v3Result.values;
      notes = v3Result.notes;
    } else {
      notes = notes.concat(v3Result.notes);
      // Step 2: v3 -> v4
      const v4Result = runV3toV4(v3Result.values);
      newValues = v4Result.values;
      notes = notes.concat(v4Result.notes);
    }
  } else {
    const result = runV1toV3(oldValues);
    newValues = result.values;
    notes = result.notes;
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
