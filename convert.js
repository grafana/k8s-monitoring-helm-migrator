const {migrate} = require('./migrate.js');
const fs = require('fs');
const file = process.argv[2];
const yaml = require('js-yaml');

try {
  const input = yaml.load(fs.readFileSync(file, 'utf8'));
  const output = migrate(input);
  console.log(yaml.dump(output));
} catch (e) {
  console.error(e);
}
