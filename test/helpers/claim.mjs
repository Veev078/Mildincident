import { DraftLedger } from '../../src/ledger.js';
const [filename, preparedJson] = process.argv.slice(2);
const ledger = new DraftLedger(filename);
try {
  ledger.claim(JSON.parse(preparedJson));
  console.log('claimed');
} catch (error) {
  console.log(error.code);
} finally { ledger.close(); }
