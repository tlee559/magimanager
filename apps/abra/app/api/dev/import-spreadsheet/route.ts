import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

/**
 * POST /api/dev/import-spreadsheet
 *
 * One-time import of account data from spreadsheet.
 * Creates IdentityProfile and linked AdAccount for each record.
 */

// Data from spreadsheet - 6 complete records
const IMPORT_DATA = [
  {
    // A1 - Benny Jordan
    identity: {
      fullName: 'Benny Jordan',
      dob: new Date('1989-06-08'),
      address: '9340 N Jackson Ave.',
      city: 'Fresno',
      state: 'CA',
      zipcode: '93720',
      geo: 'US',
      website: 'https://rollthereels.com/',
      email: 'bennyboyjordan@gmail.com',
      emailPassword: 'Money@200',
      phone: '(405) 464-0380',
      twoFactorSecret: 'hxyi s23e ewwg akuf e3kq ubtk y7pk le26',
      backupCodes: 'n/a',
      ccNumber: '3700 215257 02963',
      ccExp: '10/30',
      ccCvv: '6495',
      ccName: 'Benny Jordan',
      billingZip: '93720',
    },
    account: {
      googleCid: '792-761-5043',
      mccId: '647-301-8125',
      status: 'provisioned', // Appeal denied = suspended account
      accountHealth: 'suspended',
      certStatus: 'errored',
      currentSpendTotal: 15900, // $159
      origin: 'takeover',
      notes: `ACCT: A1
IP SETUP: Acct Loader
EMAIL SETUP: Aged, Created Gmail
ADS ACCT SETUP: Google Ads & MCC
SITE TYPE: Social Casino
VPN: A1
IP: 144.126.130.106
IP LOGIN: Administrator/TestLoader99!
2FA: Yes
KEYWORDS: Free Play Online Game
TIMELINE: START(SA01)/CREATED GMAIL-6/15, GMAIL SUS/APP-6/17, GMAIL RECOVERED-6/18, 2FA-6/19, NUMBER REMOVED-6/19, MCC-6/19, 2FA-6/22, GOOGLE ADS(individual)-11/2, AD1 SUBMITTED-11/3, CERT WOULD NOT ALLOW ME TO SUBMIT-11/3, DISAPPROVED(needs cert)/NEEDS ADV VER-11/4, SUBMITTED ADV VER DOCS-11/4, VERIFIED/SPENDING/CERT STILL NOT WORKING-11/5, LOWERED BUDGET-11/5, LINKED MCC & GOOGLE ADS-11/5, SUS(cloaking)-11/7, APP(new appeal form)-11/7, APPEAL DENIED-11/8`,
    },
  },
  {
    // A2 - Henry Nicholas
    identity: {
      fullName: 'Henry Nicholas',
      dob: new Date('1989-11-14'),
      address: '8449 N Thyme Way',
      city: 'Fresno',
      state: 'CA',
      zipcode: '93720',
      geo: 'US',
      website: 'https://bounceandblitz.com/',
      email: 'henryjnicholas89@gmail.com',
      emailPassword: 'Planets212!',
      phone: '(731) 259-8612',
      twoFactorSecret: '6yv3 hspf zher nvz6 3f4k jccm v2nl ss6a',
      backupCodes: '3992 4783 0146 2498 1885 4898 5588 0113 7699 8537 9469 6033 2258 7257 7427 8154 9380 3640 0182 9482',
      ccNumber: '3700 215660 27429',
      ccExp: '10/30',
      ccCvv: '1126',
      ccName: 'Henry Nicholas',
      billingZip: '93720',
    },
    account: {
      googleCid: '830-742-1600',
      mccId: null,
      status: 'warming-up',
      accountHealth: 'active',
      certStatus: 'suspended', // Cert denied
      currentSpendTotal: 38900, // $389
      origin: 'takeover',
      notes: `ACCT: A2
IP SETUP: Adspower
EMAIL SETUP: Aged, Created Gmail
ADS ACCT SETUP: Google Ads
SITE TYPE: Social Casino
VPN: 120/A2
IP: 144.126.141.234
IP LOGIN: Adspower | Administrator/TestLoader99!
2FA: Yes
KEYWORDS: Free Game Play Online Now
STATUS: 11 ADS SPENDING - 11/25 ; ALEX TOOK OVER - 11/27
TIMELINE: START(S121)/CREATED GMAIL(rented number)/2FA-8/13, GMAIL SUS/RECOVERED-8/15, TRANSFERED TO ADSPOWER-11/2, GOOGLE ADS-11/9, AD1 SUBMITTED-11/10, CERT SUBMITTED-11/10, AD1 SPENDING-11/11, CERT DENIED (not a social casino game)-11/11, AD1 PAUSED (needs adv ver)-11/11, ADV VER DOCS SUBMITTED-11/11, VERIFIED/SPENDING AGAIN-11/12, BUDGET LOWERED-11/13, PAUSED/NEEDS VIDEO SELFIE-11/14, VERIFICATION UNDER REVIEW-11/16, VERIFICATION STILL UNDER REVIEW-11/17, SELFIE VER APPROVED/SPENDING AGAIN-11/18, AD2 SUBMITTED ($15-NYC)-11/19, AD2 SUSPENDED(unacceptable business practices)-11/20, APPEALED-11/20, CERT RE-SUBMITTED FOR AD2, AD3/AD4/AD5 SUBMITTED-11/21, AD3-5 SPENDING-11/22, AD6-10 SUBMITTED-11/22, AD6-10 SPENDING-11/23, ALL ADS BUDGETS LOWERED-11/23, AD11 SUBMITTED-11/23, AD2+AD11 SPENDING-11/25, ALL ADS LOWERED TO $1/DAY-11/25`,
    },
  },
  {
    // B1 - Steven Wong
    identity: {
      fullName: 'Steven Wong',
      dob: new Date('1993-04-04'),
      address: '9174 N Laureen Ave.',
      city: 'Fresno',
      state: 'CA',
      zipcode: '93720',
      geo: 'US',
      website: 'https://neonduckgames.com/',
      email: 'goldingh649@gmail.com',
      emailPassword: 'WongDong999!',
      phone: null,
      twoFactorSecret: null,
      backupCodes: null,
      ccNumber: '3700 211889 50032',
      ccExp: '11/30',
      ccCvv: '9148',
      ccName: 'Steven Wong',
      billingZip: '93720',
    },
    account: {
      googleCid: '996-372-0517',
      mccId: null,
      status: 'provisioned',
      accountHealth: 'suspended',
      certStatus: 'verified',
      currentSpendTotal: 0,
      origin: 'takeover',
      notes: `ACCT: B1
IP SETUP: Acct Loader
EMAIL SETUP: Purchased Gmail
ADS ACCT SETUP: Google Ads
SITE TYPE: Social Casino
VPN: B1
IP: 144.126.130.106
IP LOGIN: Administrator/TestLoader99!
2FA: Yes
KEYWORDS: New Game Online Free
STATUS: AD1 - APPEAL DENIED - 11/13
TIMELINE: START/BOUGHT GMAIL-11/2, 2FA-11/2, GOOGLE ADS-11/9, AD1 SUBMITTED-11/10, CERT SUBMITTED-11/10, AD1 SUSPENDED (cloaking)-11/11, CERT APPROVED-11/11, ADV VER SUBMITTED-11/11, VERIFIED-11/12, APPEALED-11/12, APPEAL DENIED-11/13`,
    },
  },
  {
    // B2 - Xavier Ng
    identity: {
      fullName: 'Xavier Ng',
      dob: new Date('1991-12-22'),
      address: '2762 E Deyoung Dr.',
      city: 'Fresno',
      state: 'CA',
      zipcode: '93720',
      geo: 'US',
      website: 'https://winstormzone.com/',
      email: 'xavierng569@gmail.com',
      emailPassword: 'Success00$',
      phone: '(936) 529-2577',
      twoFactorSecret: 'ipvw dc6u xtyv xwn5 jcgy xzuj gx3e pxbb',
      backupCodes: '2534 5398 2950 4990 2832 6877 6412 0639 6144 8332 9620 2013 8736 0523 1931 1004 8559 9880 1109 1188',
      ccNumber: '3700 215745 69404',
      ccExp: '11/30',
      ccCvv: '5136',
      ccName: 'Xavier Ng',
      billingZip: '93720',
    },
    account: {
      googleCid: '962-351-4217',
      mccId: null,
      status: 'provisioned',
      accountHealth: 'suspended',
      certStatus: null,
      currentSpendTotal: 0,
      origin: 'takeover',
      notes: `ACCT: B2
IP SETUP: Adspower
EMAIL SETUP: Aged, Created Gmail
ADS ACCT SETUP: Google Ads & MCC
SITE TYPE: Social Casino
VPN: 119/B2
IP: 144.126.141.234
IP LOGIN: Adspower | Administrator/TestLoader99!
2FA: Yes
KEYWORDS: Free Play Themed Gaming
STATUS: AD1 - APPEAL DENIED - 11/14
TIMELINE: START(S128)/GMAIL(rented number)/2FA-8/19, GMAIL SUS/RECOVERED-8/24, GMAIL SUS/RECOVERED AGAIN-9/14, TRANSFERED TO ADSPOWER-11/2, GOOGLE ADS-11/10, AD1 SUBMITTED-11/11, SUS(cloaking)-11/12, ADV VER DOCS SUBMITTED-11/12, VERIFIED-11/13, APPEALED SUSPENSION-11/13, APPEAL DENIED-11/14`,
    },
  },
  {
    // C1 - Uriah Paul
    identity: {
      fullName: 'Uriah Paul',
      dob: new Date('1988-09-09'),
      address: '2894 E Waterford Ave.',
      city: 'Fresno',
      state: 'CA',
      zipcode: '93720',
      geo: 'US',
      website: 'https://luckyreelhype.com/',
      email: 'uriahpaul366@gmail.com',
      emailPassword: 'Dancing^233',
      phone: '(802) 282-9371',
      twoFactorSecret: 'odns 3qwx tnt7 p6gx ern7 wqfq enqa vekt',
      backupCodes: '1428 1722 4560 2483 1590 9346 0233 1754 4979 8515 2287 1963 0778 6121 6981 9836 5840 8884 1677 3120',
      ccNumber: '3700 219370 56016',
      ccExp: '11/30',
      ccCvv: '6925',
      ccName: 'Uriah Paul',
      billingZip: '93720',
    },
    account: {
      googleCid: '585-199-4407',
      mccId: null,
      status: 'warming-up',
      accountHealth: 'active',
      certStatus: 'verified',
      currentSpendTotal: 13600, // $136
      origin: 'takeover',
      notes: `ACCT: C1
IP SETUP: Acct Loader
EMAIL SETUP: Aged, Created Gmail
ADS ACCT SETUP: Google Ads
SITE TYPE: Social Casino
VPN: C1
IP: 144.126.130.106
IP LOGIN: Administrator/TestLoader99!
2FA: Yes
KEYWORDS: Exciting New Game Nonstop Fun
STATUS: 1 AD SPENDING - 11/26 (ad2 submitted on 11/26)
TIMELINE: START(S122)/CREATED GMAIL(rented number)/2FA-8/14, GMAIL SUS/RECOVERED-8/18, GOOGLE ADS-11/11, AD1 SUBMITTED-11/12, CERT ERROR-11/12, DISAPPROVED/NEEDS CERT-11/13, CERT ERRORED AGAIN-11/13, CERT SUBMITTED-11/14, CERT APPROVED/SPENDING-11/16, AD1 PAUSED/NEEDS ADV VERIFICATION(waiting for ID)-11/16, AD1 SPENDING AGAIN-11/17, BUDGET LOWERED-11/18, SELFIE VERIFICATION SUBMITTED/UNDER REVIEW-11/25, VERIFIED/SPENDING AGAIN FULLY-11/26, AD2 SUBMITTED-11/26`,
    },
  },
  {
    // C2 - Derek Valdez
    identity: {
      fullName: 'Derek Valdez',
      dob: new Date('1988-10-09'),
      address: '9648 N Winery Ave.',
      city: 'Fresno',
      state: 'CA',
      zipcode: '93720',
      geo: 'US',
      website: 'https://popnspin.com/',
      email: 'derekwagner8631xa@gmail.com',
      emailPassword: 'Bulkwork333!',
      phone: '(919) 444-7868',
      twoFactorSecret: 'klly s25t 7sf6 572a vzoy wdiu qtcz qrwa',
      backupCodes: null,
      ccNumber: '3700 215025 85464',
      ccExp: '11/30',
      ccCvv: '0912',
      ccName: 'Derek Valdez',
      billingZip: '93720',
    },
    account: {
      googleCid: '602-690-5499',
      mccId: null,
      status: 'warming-up',
      accountHealth: 'active',
      certStatus: 'verified',
      currentSpendTotal: 12000, // $120
      origin: 'takeover',
      notes: `ACCT: C2
IP SETUP: Adspower
EMAIL SETUP: Purchased Gmail
ADS ACCT SETUP: Google Ads
SITE TYPE: Social Casino
VPN: 118/C2
IP: 144.126.141.234
IP LOGIN: Adspower | Administrator/TestLoader99!
2FA: Yes
KEYWORDS: Thrilling New Game Play Now
STATUS: 1 AD SPENDING - 11/26 (ad2 submitted on 11/26)
TIMELINE: START/BOUGHT GMAIL (didnt need phone number/on adspower)-10/31, 2FA-11/2, GOOGLE ADS-11/10, 2 STEP VER NEEDED/VERIFIED-11/17, AD1 SUBMITTED-11/17, CERT SUBMITTED-11/17, CERT APPROVED/AD1 SPENDING-11/18, BUDGET LOWERED-11/18, AD1 PAUSED/NEEDS ADV VER-11/19, NOW NEEDS VIDEO SELFIE-11/20, SELFIE VERIFICATION SUBMITTED/UNDER REVIEW-11/25, VERIFIED/SPENDING AGAIN-11/26, AD2 SUBMITTED-11/26`,
    },
  },
];

export async function POST() {
  // Safety check - don't allow in production without explicit override
  if (process.env.NODE_ENV === 'production' && !process.env.ALLOW_DEV_IMPORT) {
    return NextResponse.json(
      { error: 'Import disabled in production. Set ALLOW_DEV_IMPORT=true to override.' },
      { status: 403 }
    );
  }

  const results: { success: string[]; failed: string[] } = {
    success: [],
    failed: [],
  };

  for (const record of IMPORT_DATA) {
    try {
      // Check if CID already exists
      const existingAccount = await prisma.adAccount.findFirst({
        where: { googleCid: record.account.googleCid },
      });

      if (existingAccount) {
        results.failed.push(`${record.identity.fullName}: CID ${record.account.googleCid} already exists`);
        continue;
      }

      // Check if email already exists
      const existingIdentity = await prisma.identityProfile.findFirst({
        where: { email: record.identity.email },
      });

      if (existingIdentity) {
        results.failed.push(`${record.identity.fullName}: Email ${record.identity.email} already exists`);
        continue;
      }

      // Create identity profile
      const identity = await prisma.identityProfile.create({
        data: record.identity,
      });

      // Create ad account linked to identity
      await prisma.adAccount.create({
        data: {
          ...record.account,
          identityProfileId: identity.id,
          billingStatus: 'verified', // All have CC info
          warmupTargetSpend: 5000, // $50 default
        },
      });

      // Log activity
      await prisma.identityActivity.create({
        data: {
          identityProfileId: identity.id,
          action: 'CREATED',
          details: 'Identity imported from spreadsheet',
        },
      });

      results.success.push(`${record.identity.fullName} (CID: ${record.account.googleCid})`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      results.failed.push(`${record.identity.fullName}: ${message}`);
    }
  }

  return NextResponse.json({
    message: 'Import complete',
    imported: results.success.length,
    failed: results.failed.length,
    details: results,
  });
}
