import { runtimeCompatibility } from '../src/names.mjs';
const result = runtimeCompatibility();
console.log(JSON.stringify(result, null, 2));
if (!result.compatible) process.exitCode = 1;
