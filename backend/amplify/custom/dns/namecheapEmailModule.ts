import { Construct } from 'constructs';
import { DnsCoordinator } from './dnsCoordinator';

interface NamecheapEmailModuleProps {
    dns: DnsCoordinator;
    dkimValue: string;
}

/**
 * Namecheap PrivateEmail DNS Module
 *
 * Registers DNS intents for Namecheap email:
 * - SPF include for Namecheap mail servers
 * - DKIM TXT record
 * - MX records for mail routing
 */
export class NamecheapEmailModule extends Construct {
    constructor(scope: Construct, id: string, props: NamecheapEmailModuleProps) {
        super(scope, id);

        const { dns, dkimValue } = props;

        // SPF include for Namecheap (needed if you send via Namecheap)
        dns.requireSpfInclude('spf.privateemail.com');

        // DKIM record
        dns.addTxt('default._domainkey', [dkimValue]);

        // MX records for receiving email
        dns.addMx('', [
            { priority: 10, hostName: 'mx1.privateemail.com' },
            { priority: 10, hostName: 'mx2.privateemail.com' }
        ]);
    }
}
