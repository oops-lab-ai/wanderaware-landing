import { Construct } from 'constructs';
import { CfnOutput } from 'aws-cdk-lib';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as r53targets from 'aws-cdk-lib/aws-route53-targets';
import { extractParentDomain, extractSubdomain } from '../shared/domainUtils';

interface CognitoLoginDomainProps {
    userPool: cognito.IUserPool;
    loginFqdn: string;
    hostedZoneId: string;
}

export class CognitoLoginDomainStack extends Construct {
    constructor(scope: Construct, id: string, props: CognitoLoginDomainProps) {
        super(scope, id);

        const { userPool, loginFqdn, hostedZoneId } = props;

        // Import the hosted zone using the hosted zone ID (no lookup needed)
        // zoneName should be the parent domain (e.g., 'wanderaware.com'), not the subdomain
        const parentDomain = extractParentDomain(loginFqdn);
        const subdomain = extractSubdomain(loginFqdn);

        const loginZone = route53.HostedZone.fromHostedZoneAttributes(this, 'LoginSubZone', {
            hostedZoneId,
            zoneName: parentDomain
        });

        // Create ACM certificate validated via Route 53. The stack must run in the
        // same region as the Cognito user pool (typically us-east-1 for custom domains).
        const loginCert = new acm.Certificate(this, 'LoginCert', {
            domainName: loginFqdn,
            validation: acm.CertificateValidation.fromDns(loginZone)
        });

        // Create the Cognito Hosted UI custom domain
        const userPoolDomain = new cognito.UserPoolDomain(this, 'LoginDomain', {
            userPool,
            customDomain: { domainName: loginFqdn, certificate: loginCert }
        });

        // Alias the subdomain apex to Cognito's CloudFront target
        new route53.ARecord(this, 'AliasToCognito', {
            zone: loginZone,
            recordName: subdomain,
            target: route53.RecordTarget.fromAlias(new r53targets.UserPoolDomainTarget(userPoolDomain))
        });

        // IPv6 alias to Cognito's CloudFront target
        new route53.AaaaRecord(this, 'AliasToCognitoV6', {
            zone: loginZone,
            recordName: subdomain,
            target: route53.RecordTarget.fromAlias(new r53targets.UserPoolDomainTarget(userPoolDomain))
        });

        new CfnOutput(this, 'CognitoCloudFrontTarget', {
            value: userPoolDomain.cloudFrontEndpoint
        });
    }
}
