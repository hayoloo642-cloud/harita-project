const fs = require('fs');
const path = require('path');
const vm = require('vm');

const code = fs.readFileSync(path.join(__dirname, '../../static/js/data.js'), 'utf8');
const sandbox = { pad2: (n) => String(n).padStart(2, '0'), console };
vm.createContext(sandbox);
vm.runInContext(`${code}\nthis.addMonthsClamped = addMonthsClamped;`, sandbox);

const cases = [
  ['2026-01-31', 1, '2026-02-28'],
  ['2024-01-31', 1, '2024-02-29'],
  ['2024-02-29', 12, '2025-02-28'],
  ['2026-08-31', 1, '2026-09-30'],
  ['2026-12-31', 1, '2027-01-31'],
  ['2026-03-15', -1, '2026-02-15'],
];

let failed = 0;
for (const [start, n, expected] of cases) {
  const got = sandbox.addMonthsClamped(start, n);
  if (got !== expected) {
    failed += 1;
    console.error(`FAIL ${start} +${n} month -> ${got}, expected ${expected}`);
  } else {
    console.log(`ok   ${start} +${n} -> ${got}`);
  }
}
if (failed) {
  console.error(`${failed} failed`);
  process.exit(1);
}
console.log(`${cases.length} passed`);
