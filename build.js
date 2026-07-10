import { readFileSync, writeFileSync } from 'node:fs';

const read = (p) => readFileSync(p, 'utf8');
const stripExports = (s) => s.replace(/^export /gm, '');

let html = read('src/shell.html');
const inject = (marker, content) => { html = html.replace(marker, () => content); };
inject('/*INJECT:CSS*/', read('src/styles.css'));
inject('/*INJECT:DATA*/', stripExports(read('src/data.js')));
inject('/*INJECT:LOGIC*/', stripExports(read('src/logic.js')));
inject('/*INJECT:UI*/', read('src/ui.js'));

writeFileSync('executive-command-center.html', html);
console.log(`Built executive-command-center.html (${(html.length / 1024).toFixed(1)} KB)`);
