import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const functionsDir = join(process.cwd(), 'amplify', 'functions');

const DIRECT_DATA_IMPORTS = [
    '@aws-sdk/client-dynamodb',
    '@aws-sdk/lib-dynamodb',
    '@aws-sdk/client-appsync',
];

const DIRECT_DATA_ALLOWLIST = new Map();

function walk(dir) {
    return readdirSync(dir).flatMap((entry) => {
        const path = join(dir, entry);
        return statSync(path).isDirectory() ? walk(path) : [path];
    });
}

function normalize(path) {
    return relative(functionsDir, path).replaceAll('\\', '/');
}

const failures = [];
const checked = {
    handlers: 0,
    generatedClientHandlers: 0,
    directDataAllowlisted: 0,
};

for (const file of walk(functionsDir)) {
    if (!file.endsWith('handler.ts')) continue;
    checked.handlers += 1;

    const rel = normalize(file);
    const source = readFileSync(file, 'utf8');
    const directImports = DIRECT_DATA_IMPORTS.filter((pkg) => source.includes(pkg));

    if (directImports.length > 0) {
        if (!DIRECT_DATA_ALLOWLIST.has(rel)) {
            failures.push(
                `${rel}: imports direct data client(s) ${directImports.join(', ')}. Use the Amplify Gen 2 generated data client or add a documented allowlist exception.`,
            );
        } else {
            checked.directDataAllowlisted += 1;
        }
    }

    const touchesModels = source.includes('client.models.');
    if (!touchesModels) continue;

    checked.generatedClientHandlers += 1;

    const requiredPatterns = [
        ['aws-amplify/data generateClient import', /from ['"]aws-amplify\/data['"]/],
        ['getAmplifyDataClientConfig import', /getAmplifyDataClientConfig/],
        ['function runtime env import', /from ['"]\$amplify\/env\//],
        ['Amplify.configure(resourceConfig, libraryOptions)', /Amplify\.configure\(\s*resourceConfig\s*,\s*libraryOptions\s*\)/],
        ['typed generateClient<Schema>()', /generateClient<\s*Schema\s*>\(\s*\)/],
    ];

    for (const [label, pattern] of requiredPatterns) {
        if (!pattern.test(source)) {
            failures.push(`${rel}: uses client.models.* but is missing ${label}.`);
        }
    }
}

if (failures.length > 0) {
    console.error('Amplify Gen 2 data access audit failed:');
    for (const failure of failures) console.error(`- ${failure}`);
    process.exit(1);
}

console.log('Amplify Gen 2 data access audit passed.');
console.log(`Handlers checked: ${checked.handlers}`);
console.log(`Generated-client model handlers: ${checked.generatedClientHandlers}`);
console.log(`Direct data access allowlisted: ${checked.directDataAllowlisted}`);
