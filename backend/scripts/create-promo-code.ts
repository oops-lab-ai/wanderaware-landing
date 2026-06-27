/**
 * Create a WanderAware plan/device-capacity grant promo code.
 *
 * Usage:
 *   $env:AWS_PROFILE="admin-amplify-1"
 *   npx tsx backend/scripts/create-promo-code.ts `
 *     --label "Pilot center" `
 *     --max-redemptions 5 `
 *     --expires-in-days 90 `
 *     --code-expires-in-days 90
 */

import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DynamoDBClient, ListTablesCommand, PutItemCommand } from '@aws-sdk/client-dynamodb';
import { fromIni } from '@aws-sdk/credential-providers';

interface Args {
    label?: string;
    maxRedemptions: number;
    expiresInDays?: number;
    codeExpiresInDays?: number;
    table?: string;
    baseUrl?: string;
}

function parseArgs(): Args {
    const args: Args = { maxRedemptions: 1 };
    const argv = process.argv.slice(2);
    for (let i = 0; i < argv.length; i++) {
        const flag = argv[i];
        const next = argv[i + 1];
        switch (flag) {
            case '--label':
                args.label = next;
                i++;
                break;
            case '--max-redemptions':
                args.maxRedemptions = Number.parseInt(next, 10);
                i++;
                break;
            case '--expires-in-days':
                args.expiresInDays = Number.parseInt(next, 10);
                i++;
                break;
            case '--code-expires-in-days':
                args.codeExpiresInDays = Number.parseInt(next, 10);
                i++;
                break;
            case '--table':
                args.table = next;
                i++;
                break;
            case '--base-url':
                args.baseUrl = next;
                i++;
                break;
            case '-h':
            case '--help':
                console.log('Create a WanderAware dashboard redemption code.');
                process.exit(0);
        }
    }
    return args;
}

function generateCode(label: string | undefined): string {
    const labelSlug = (label ?? 'pilot')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 16);
    return `${labelSlug}-${randomBytes(8).toString('base64url')}`;
}

const __dirname = dirname(fileURLToPath(import.meta.url));

async function findPromoCodeTable(client: DynamoDBClient): Promise<string> {
    const result = await client.send(new ListTablesCommand({}));
    const matches = (result.TableNames ?? []).filter((table) => table.startsWith('PromoCode-'));
    if (matches.length === 0) {
        throw new Error('No PromoCode table found. Deploy the backend before creating promo codes.');
    }
    if (matches.length > 1) {
        console.warn(`[create-promo-code] Multiple PromoCode tables found, using the first: ${matches[0]}`);
    }
    return matches[0];
}

function detectBaseUrl(): string {
    try {
        const outputsPath = resolve(__dirname, '../../shared/amplify_outputs.json');
        const outputs = JSON.parse(readFileSync(outputsPath, 'utf-8'));
        return outputs.custom?.frontendUrl ?? 'https://wanderaware.com';
    } catch {
        return 'https://wanderaware.com';
    }
}

async function main() {
    const args = parseArgs();
    const client = new DynamoDBClient({
        region: process.env.AWS_REGION ?? 'us-east-1',
        credentials: fromIni({ profile: process.env.AWS_PROFILE ?? 'admin-amplify-1' }),
    });

    const tableName = args.table ?? (await findPromoCodeTable(client));
    const baseUrl = args.baseUrl ?? detectBaseUrl();
    const code = generateCode(args.label);
    const now = new Date();
    const codeExpiresAt = args.codeExpiresInDays ? new Date(now.getTime() + args.codeExpiresInDays * 86_400_000).toISOString() : undefined;

    const item: Record<string, { S?: string; N?: string; BOOL?: boolean }> = {
        code: { S: code },
        redemptionCount: { N: '0' },
        maxRedemptions: { N: args.maxRedemptions.toString() },
        createdAt: { S: now.toISOString() },
        updatedAt: { S: now.toISOString() },
        __typename: { S: 'PromoCode' },
    };
    if (args.label) item.label = { S: args.label };
    if (args.expiresInDays !== undefined) item.expiresInDays = { N: args.expiresInDays.toString() };
    if (codeExpiresAt) item.expiresAt = { S: codeExpiresAt };

    await client.send(new PutItemCommand({ TableName: tableName, Item: item }));

    const url = `${baseUrl}/dashboard/redeem?code=${encodeURIComponent(code)}`;
    console.log('');
    console.log('Promo code created');
    console.log('');
    console.log(`  Code:            ${code}`);
    console.log(`  Label:           ${args.label ?? '(none)'}`);
    console.log(`  Max redemptions: ${args.maxRedemptions}`);
    console.log(`  Grant duration:  ${args.expiresInDays ? `${args.expiresInDays} days` : 'indefinite'}`);
    console.log(`  Code expires:    ${codeExpiresAt ?? 'never'}`);
    console.log('');
    console.log(`  ${url}`);
    console.log('');
}

main().catch((err) => {
    console.error('[create-promo-code] Failed:', err);
    process.exit(1);
});
