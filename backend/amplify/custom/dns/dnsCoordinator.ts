import { Construct } from 'constructs';
import { Duration } from 'aws-cdk-lib';
import * as route53 from 'aws-cdk-lib/aws-route53';

type RecordType = 'TXT' | 'MX' | 'CNAME';

type TxtIntent = {
    type: 'TXT';
    name: string; // '' = apex
    values: string[]; // Route53 TXT values
    ttlSeconds?: number;
};

type CnameIntent = {
    type: 'CNAME';
    name: string;
    value: string;
    ttlSeconds?: number;
};

type MxIntent = {
    type: 'MX';
    name: string; // '' = apex
    values: route53.MxRecordValue[];
    ttlSeconds?: number;
};

type SpfIncludeIntent = {
    type: 'SPF_INCLUDE';
    include: string; // e.g. 'amazonses.com'
};

type Intent = TxtIntent | CnameIntent | MxIntent | SpfIncludeIntent;

export class DnsCoordinator extends Construct {
    public readonly zone: route53.IHostedZone;

    private intents: Intent[] = [];

    constructor(scope: Construct, id: string, props: { hostedZoneId: string; domainName: string }) {
        super(scope, id);

        this.zone = route53.HostedZone.fromHostedZoneAttributes(this, 'Zone', {
            hostedZoneId: props.hostedZoneId,
            zoneName: props.domainName
        });
    }

    // --- APIs modules call ---
    addTxt(name: string, values: string[], ttlSeconds = 3600) {
        this.intents.push({ type: 'TXT', name, values, ttlSeconds });
    }

    addCname(name: string, value: string, ttlSeconds = 3600) {
        this.intents.push({ type: 'CNAME', name, value, ttlSeconds });
    }

    addMx(name: string, values: route53.MxRecordValue[], ttlSeconds = 3600) {
        this.intents.push({ type: 'MX', name, values, ttlSeconds });
    }

    requireSpfInclude(include: string) {
        this.intents.push({ type: 'SPF_INCLUDE', include });
    }

    // --- Apply everything once ---
    apply() {
        // 1) Normalize SPF
        const spfIncludes = Array.from(
            new Set(this.intents.filter((i): i is SpfIncludeIntent => i.type === 'SPF_INCLUDE').map((i) => i.include))
        );
        if (spfIncludes.length > 0) {
            const spf = `v=spf1 ${spfIncludes.map((i) => `include:${i}`).join(' ')} ~all`;

            // IMPORTANT: apex record => name = ''
            this.intents.push({ type: 'TXT', name: '', values: [spf], ttlSeconds: 3600 });
        }

        // 2) Group record intents (ignore SPF_INCLUDE now)
        const records = this.intents.filter((i): i is TxtIntent | CnameIntent | MxIntent => i.type !== 'SPF_INCLUDE');

        // 3) Conflict checks and de-dup
        const key = (t: RecordType, name: string) => `${t}:${name || '<apex>'}`;

        const grouped = new Map<string, (TxtIntent | CnameIntent | MxIntent)[]>();
        for (const r of records) {
            const k = key(r.type as RecordType, r.name);
            grouped.set(k, [...(grouped.get(k) ?? []), r]);
        }

        // 4) Create Route53 records
        for (const [k, group] of grouped) {
            const [type, rawName] = k.split(':') as [RecordType, string];
            const name = rawName === '<apex>' ? '' : rawName;

            if (type === 'MX') {
                // Only allow one MX "definition" for same name unless identical
                if (group.length > 1) {
                    const asJson = group.map((g) => JSON.stringify((g as MxIntent).values));
                    const allSame = asJson.every((v) => v === asJson[0]);
                    if (!allSame) {
                        throw new Error(`DNS conflict: multiple MX records requested for ${name || 'apex'}`);
                    }
                }
                const mx = group[0] as MxIntent;
                new route53.MxRecord(this, `Mx-${name || 'apex'}`, {
                    zone: this.zone,
                    ...(name ? { recordName: name } : {}),
                    values: mx.values,
                    ttl: Duration.seconds(mx.ttlSeconds ?? 3600)
                });
            }

            if (type === 'CNAME') {
                // Multiple CNAME with same name is invalid
                if (group.length > 1) throw new Error(`DNS conflict: multiple CNAME records requested for ${name}`);
                const cn = group[0] as CnameIntent;
                new route53.CnameRecord(this, `Cname-${name}`, {
                    zone: this.zone,
                    recordName: name,
                    domainName: cn.value,
                    ttl: Duration.seconds(cn.ttlSeconds ?? 3600)
                });
            }

            if (type === 'TXT') {
                // TXT can be multiple strings, but for safety we merge only if identical or additive.
                // Here: merge all values and de-dup.
                const allValues = Array.from(new Set(group.flatMap((g) => (g as TxtIntent).values)));
                new route53.TxtRecord(this, `Txt-${name || 'apex'}`, {
                    zone: this.zone,
                    ...(name ? { recordName: name } : {}),
                    values: allValues,
                    ttl: Duration.seconds((group[0] as TxtIntent).ttlSeconds ?? 3600)
                });
            }
        }
    }
}
