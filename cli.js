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
  console.error("Usage: node cli.js [--mode v1-to-v3|v3-to-v4|v1-to-v4] <file>");
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
  } else if (mode === "v1-to-v4") {
    const { checkValues, migrateV1toV3 } = require('./migrate.js');
    const { migrateV3toV4 } = require('./migrate-v3-to-v4.js');

    const validationError = checkValues(oldValues);
    if (validationError) {
      console.error("This does not appear to be a K8s Monitoring v1 values file:");
      console.error(validationError);
    } else {
      // Step 1: v1 -> v3
      const v3Result = migrateV1toV3(oldValues);
      notes = notes.concat(v3Result.notes);

      // Step 2: v3 -> v4
      const v4Result = migrateV3toV4(v3Result.values);
      newValues = v4Result.values;
      notes = notes.concat(v4Result.notes);

      console.log(yaml.dump(newValues, yamlOptions));
      console.error("Notes: " + JSON.stringify(notes));
    }
  } else {
    const { checkValues, migrateV1toV3 } = require('./migrate.js');

    const clusterNotes = checkValues(oldValues)
    if (clusterNotes) {
      console.error("This does not appear to be a K8s Monitoring v1 values file:")
      console.error(clusterNotes);
    } else {
      const result = migrateV1toV3(oldValues);
      newValues = result.values;
      notes = result.notes;

      console.log(yaml.dump(newValues, yamlOptions));
      console.error("Notes: " + JSON.stringify(notes));
    }
  }
} catch (e) {
  console.error(e);
}
