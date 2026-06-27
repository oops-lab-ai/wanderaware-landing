/**
 * Extract the parent domain from a fully qualified domain name (FQDN)
 * @param fqdn - The fully qualified domain name (e.g., 'login.wanderaware.com')
 * @returns The parent domain (e.g., 'wanderaware.com')
 */
export function extractParentDomain(fqdn: string): string {
    return fqdn.split('.').slice(-2).join('.');
}

/**
 * Extract the subdomain part from a fully qualified domain name (FQDN)
 * @param fqdn - The fully qualified domain name (e.g., 'login.wanderaware.com')
 * @returns The subdomain part (e.g., 'login')
 */
export function extractSubdomain(fqdn: string): string {
    return fqdn.split('.')[0];
}
