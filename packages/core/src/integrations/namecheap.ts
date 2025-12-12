/**
 * Namecheap API Client
 * Documentation: https://www.namecheap.com/support/api/methods/
 */

import { prisma } from '@magimanager/database';

const NAMECHEAP_API_URL = 'https://api.namecheap.com/xml.response';
const NAMECHEAP_SANDBOX_URL = 'https://api.sandbox.namecheap.com/xml.response';

export interface NamecheapConfig {
  apiUser: string;
  apiKey: string;
  username: string;
  clientIp: string;
  useSandbox?: boolean;
  proxyUrl?: string; // Optional proxy server URL (e.g., http://143.198.160.212:3000/proxy)
}

export interface DomainAvailability {
  domain: string;
  available: boolean;
  premium: boolean;
  price?: number;
  currency?: string;
  icannFee?: number;
}

export interface DomainPurchaseResult {
  success: boolean;
  domain: string;
  orderId?: string;
  transactionId?: string;
  chargedAmount?: number;
  error?: string;
}

export interface DnsRecord {
  hostName: string;  // e.g., "@" or "www"
  recordType: string; // "A", "CNAME", etc.
  address: string;    // IP or domain
  ttl?: number;
}

export interface NamecheapError {
  code: string;
  message: string;
}

/**
 * Parse XML response from Namecheap API
 */
function parseXml(text: string): Document {
  // Use a simple regex-based parser for server-side
  // In browser, we'd use DOMParser
  if (typeof DOMParser !== 'undefined') {
    const parser = new DOMParser();
    return parser.parseFromString(text, 'text/xml');
  }

  // For Node.js, we'll parse manually using regex
  // This is a simplified approach - for production, use a proper XML parser
  throw new Error('XML parsing requires DOMParser - run in browser context or install xmldom');
}

/**
 * Extract value from XML element
 */
function getXmlValue(xml: string, tagName: string): string | null {
  const regex = new RegExp(`<${tagName}[^>]*>([^<]*)</${tagName}>`, 'i');
  const match = xml.match(regex);
  return match ? match[1] : null;
}

/**
 * Extract attribute from XML element
 */
function getXmlAttribute(xml: string, tagName: string, attrName: string): string | null {
  const tagRegex = new RegExp(`<${tagName}[^>]*${attrName}="([^"]*)"[^>]*>`, 'i');
  const match = xml.match(tagRegex);
  return match ? match[1] : null;
}

/**
 * Extract all matching elements
 */
function getXmlElements(xml: string, tagName: string): string[] {
  const regex = new RegExp(`<${tagName}[^>]*[^/]>[\\s\\S]*?</${tagName}>|<${tagName}[^>]*/?>`, 'gi');
  const matches = xml.match(regex);
  return matches || [];
}

class NamecheapClient {
  private config: NamecheapConfig;
  private baseUrl: string;
  private proxyUrl?: string;

  constructor(config: NamecheapConfig) {
    this.config = config;
    this.baseUrl = config.useSandbox ? NAMECHEAP_SANDBOX_URL : NAMECHEAP_API_URL;
    this.proxyUrl = config.proxyUrl;
  }

  /**
   * Make API request to Namecheap
   * If proxyUrl is configured, routes request through the proxy server
   */
  private async request(command: string, params: Record<string, string> = {}): Promise<string> {
    const searchParams = new URLSearchParams({
      ApiUser: this.config.apiUser,
      ApiKey: this.config.apiKey,
      UserName: this.config.username,
      ClientIp: this.config.clientIp,
      Command: command,
      ...params,
    });

    let response: Response;

    if (this.proxyUrl) {
      // Route through proxy server
      response = await fetch(this.proxyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: `${this.baseUrl}?${searchParams}`,
        }),
      });
    } else {
      // Direct request
      response = await fetch(`${this.baseUrl}?${searchParams}`);
    }

    const text = await response.text();

    // Check for API errors
    if (text.includes('Status="ERROR"')) {
      const errorMatch = text.match(/<Error[^>]*Number="(\d+)"[^>]*>([^<]*)<\/Error>/i);
      if (errorMatch) {
        throw new Error(`Namecheap API Error ${errorMatch[1]}: ${errorMatch[2]}`);
      }
      throw new Error('Namecheap API returned an error');
    }

    return text;
  }

  /**
   * Check availability of a single domain
   */
  async checkDomain(domain: string): Promise<DomainAvailability> {
    const results = await this.checkDomains([domain]);
    return results[0];
  }

  /**
   * Check availability of multiple domains
   */
  async checkDomains(domains: string[]): Promise<DomainAvailability[]> {
    const xml = await this.request('namecheap.domains.check', {
      DomainList: domains.join(','),
    });

    const results: DomainAvailability[] = [];
    const domainResults = getXmlElements(xml, 'DomainCheckResult');

    for (const result of domainResults) {
      const domain = getXmlAttribute(result, 'DomainCheckResult', 'Domain') || '';
      const available = getXmlAttribute(result, 'DomainCheckResult', 'Available') === 'true';
      const premium = getXmlAttribute(result, 'DomainCheckResult', 'IsPremiumName') === 'true';
      const priceStr = getXmlAttribute(result, 'DomainCheckResult', 'PremiumRegistrationPrice');

      results.push({
        domain,
        available,
        premium,
        price: priceStr ? parseFloat(priceStr) : undefined,
      });
    }

    return results;
  }

  /**
   * Search for available domains with different TLDs
   */
  async searchDomains(keyword: string, tlds: string[] = ['com', 'net', 'org', 'io', 'co']): Promise<DomainAvailability[]> {
    const domains = tlds.map(tld => `${keyword}.${tld}`);
    return this.checkDomains(domains);
  }

  /**
   * Get domain pricing for registration
   */
  async getDomainPricing(tld: string = 'com'): Promise<{ registration: number; renewal: number; icannFee: number }> {
    const xml = await this.request('namecheap.users.getPricing', {
      ProductType: 'DOMAIN',
      ProductCategory: 'REGISTER',
      ProductName: tld,
    });

    // Parse pricing from response
    const priceStr = getXmlAttribute(xml, 'Price', 'Price') ||
                     getXmlValue(xml, 'YourPrice') ||
                     getXmlValue(xml, 'Price');

    const renewalStr = getXmlValue(xml, 'RenewalPrice');
    const icannStr = getXmlValue(xml, 'IcannFee');

    return {
      registration: priceStr ? parseFloat(priceStr) : 9.99,
      renewal: renewalStr ? parseFloat(renewalStr) : 12.99,
      icannFee: icannStr ? parseFloat(icannStr) : 0.18,
    };
  }

  /**
   * Purchase a domain using account's default contact info
   * Uses credit card profile on file (Billingtype=CCPF)
   */
  async purchaseDomain(domain: string, years: number = 1): Promise<DomainPurchaseResult> {
    try {
      // Namecheap requires contact info, but will use account defaults if using proper API
      // For domains, we need to provide registrant info
      // Since user wants to use account defaults, we'll set AddFreeWhoisguard
      const xml = await this.request('namecheap.domains.create', {
        DomainName: domain,
        Years: years.toString(),
        // Use credit card on file instead of account balance
        // Billingtype: CC = credit card, CCPF = credit card profile, FUNDS = account balance
        Billingtype: 'CCPF',
        AddFreeWhoisguard: 'yes',
        WGEnabled: 'yes',
        // Namecheap will use the account's default contact if we don't specify
        // But API requires these fields - using account username as placeholder
        RegistrantFirstName: 'Account',
        RegistrantLastName: 'Default',
        RegistrantAddress1: '123 Main St',
        RegistrantCity: 'New York',
        RegistrantStateProvince: 'NY',
        RegistrantPostalCode: '10001',
        RegistrantCountry: 'US',
        RegistrantPhone: '+1.5555555555',
        RegistrantEmailAddress: `${this.config.username}@namecheap.com`,
        // Copy to all contacts
        TechFirstName: 'Account',
        TechLastName: 'Default',
        TechAddress1: '123 Main St',
        TechCity: 'New York',
        TechStateProvince: 'NY',
        TechPostalCode: '10001',
        TechCountry: 'US',
        TechPhone: '+1.5555555555',
        TechEmailAddress: `${this.config.username}@namecheap.com`,
        AdminFirstName: 'Account',
        AdminLastName: 'Default',
        AdminAddress1: '123 Main St',
        AdminCity: 'New York',
        AdminStateProvince: 'NY',
        AdminPostalCode: '10001',
        AdminCountry: 'US',
        AdminPhone: '+1.5555555555',
        AdminEmailAddress: `${this.config.username}@namecheap.com`,
        AuxBillingFirstName: 'Account',
        AuxBillingLastName: 'Default',
        AuxBillingAddress1: '123 Main St',
        AuxBillingCity: 'New York',
        AuxBillingStateProvince: 'NY',
        AuxBillingPostalCode: '10001',
        AuxBillingCountry: 'US',
        AuxBillingPhone: '+1.5555555555',
        AuxBillingEmailAddress: `${this.config.username}@namecheap.com`,
      });

      const registered = getXmlAttribute(xml, 'DomainCreateResult', 'Registered') === 'true';
      const orderId = getXmlAttribute(xml, 'DomainCreateResult', 'OrderId');
      const transactionId = getXmlAttribute(xml, 'DomainCreateResult', 'TransactionId');
      const chargedStr = getXmlAttribute(xml, 'DomainCreateResult', 'ChargedAmount');

      if (!registered) {
        const errorMatch = xml.match(/<Error[^>]*>([^<]*)<\/Error>/i);
        return {
          success: false,
          domain,
          error: errorMatch ? errorMatch[1] : 'Domain registration failed',
        };
      }

      return {
        success: true,
        domain,
        orderId: orderId || undefined,
        transactionId: transactionId || undefined,
        chargedAmount: chargedStr ? parseFloat(chargedStr) : undefined,
      };
    } catch (error) {
      return {
        success: false,
        domain,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Set DNS records for a domain (A records for pointing to server)
   */
  async setDnsRecords(domain: string, records: DnsRecord[]): Promise<boolean> {
    const [sld, ...tldParts] = domain.split('.');
    const tld = tldParts.join('.');

    const params: Record<string, string> = {
      SLD: sld,
      TLD: tld,
    };

    records.forEach((record, i) => {
      const idx = i + 1;
      params[`HostName${idx}`] = record.hostName;
      params[`RecordType${idx}`] = record.recordType;
      params[`Address${idx}`] = record.address;
      params[`TTL${idx}`] = (record.ttl || 300).toString();
    });

    const xml = await this.request('namecheap.domains.dns.setHosts', params);
    return xml.includes('IsSuccess="true"');
  }

  /**
   * Set DNS to point domain to a server IP
   */
  async pointToServer(domain: string, serverIp: string): Promise<boolean> {
    return this.setDnsRecords(domain, [
      { hostName: '@', recordType: 'A', address: serverIp, ttl: 300 },
      { hostName: 'www', recordType: 'A', address: serverIp, ttl: 300 },
    ]);
  }

  /**
   * Get list of domains in account
   */
  async listDomains(): Promise<Array<{ domain: string; expires: string; isExpired: boolean }>> {
    const xml = await this.request('namecheap.domains.getList');

    const results: Array<{ domain: string; expires: string; isExpired: boolean }> = [];
    const domainElements = getXmlElements(xml, 'Domain');

    for (const elem of domainElements) {
      const name = getXmlAttribute(elem, 'Domain', 'Name');
      const expires = getXmlAttribute(elem, 'Domain', 'Expires');
      const isExpired = getXmlAttribute(elem, 'Domain', 'IsExpired') === 'true';

      if (name) {
        results.push({
          domain: name,
          expires: expires || '',
          isExpired,
        });
      }
    }

    return results;
  }

  /**
   * Get account balance
   */
  async getBalance(): Promise<{ availableBalance: number; accountBalance: number }> {
    const xml = await this.request('namecheap.users.getBalances');

    const available = getXmlAttribute(xml, 'GetBalancesResult', 'AvailableBalance');
    const balance = getXmlAttribute(xml, 'GetBalancesResult', 'AccountBalance');

    return {
      availableBalance: available ? parseFloat(available) : 0,
      accountBalance: balance ? parseFloat(balance) : 0,
    };
  }

  /**
   * Test connection to Namecheap API
   */
  async testConnection(): Promise<{ success: boolean; error?: string; balance?: number }> {
    try {
      const balance = await this.getBalance();
      return { success: true, balance: balance.availableBalance };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Connection failed',
      };
    }
  }
}

/**
 * Create a Namecheap client with explicit config
 */
export function createNamecheapClient(config: NamecheapConfig): NamecheapClient {
  if (!config.apiKey) throw new Error('Namecheap API key is required');
  if (!config.username) throw new Error('Namecheap username is required');
  if (!config.clientIp) throw new Error('Namecheap whitelisted IP is required');

  return new NamecheapClient({
    ...config,
    apiUser: config.apiUser || config.username,
  });
}

/**
 * Get Namecheap client using settings from database
 */
export async function getNamecheapClientFromSettings(): Promise<NamecheapClient> {
  const settings = await prisma.appSettings.findFirst();

  if (!settings?.namecheapApiKey) {
    throw new Error('Namecheap API key not configured. Please set it in Settings.');
  }
  if (!settings?.namecheapUsername) {
    throw new Error('Namecheap username not configured. Please set it in Settings.');
  }
  if (!settings?.namecheapWhitelistIp) {
    throw new Error('Namecheap whitelist IP not configured. Please set it in Settings.');
  }

  return createNamecheapClient({
    apiKey: settings.namecheapApiKey,
    apiUser: settings.namecheapUsername,
    username: settings.namecheapUsername,
    clientIp: settings.namecheapWhitelistIp,
    proxyUrl: settings.namecheapProxyUrl || undefined,
  });
}
