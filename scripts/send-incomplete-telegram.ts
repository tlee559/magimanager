import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function escapeMarkdown(text: string): string {
  return text.replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&');
}

async function main() {
  // Get settings with telegram config - check both DB and env vars
  const settings = await prisma.appSettings.findFirst();

  const telegramBotToken = settings?.telegramBotToken || process.env.TELEGRAM_BOT_TOKEN;
  const telegramChatId = settings?.telegramChatId || process.env.TELEGRAM_CHAT_ID;

  if (!telegramBotToken || !telegramChatId) {
    console.log('Telegram not configured');
    console.log('Token:', telegramBotToken ? 'SET' : 'NOT SET');
    console.log('Chat ID:', telegramChatId ? 'SET' : 'NOT SET');
    return;
  }

  console.log('Telegram configured, fetching incomplete identities...');

  // Get incomplete identities
  const identities = await prisma.identityProfile.findMany({
    where: { archived: false },
    include: { documents: true, gologinProfile: true },
  });

  const incomplete: { name: string; missing: string[] }[] = [];
  for (const identity of identities) {
    const missing: string[] = [];
    if (!identity.documents?.length) missing.push('Documents');
    if (!identity.website) missing.push('Website');
    if (!identity.gologinProfile || identity.gologinProfile.status !== 'ready') missing.push('GoLogin Profile');
    if (missing.length > 0) {
      incomplete.push({ name: identity.fullName, missing });
    }
  }

  if (incomplete.length === 0) {
    console.log('No incomplete identities found');
    return;
  }

  console.log(`Found ${incomplete.length} incomplete identities`);

  // Build message
  const identityList = incomplete
    .map((i) => `• *${escapeMarkdown(i.name)}*: ${escapeMarkdown(i.missing.join(', '))}`)
    .join('\n');

  const message = `⚠️ *Daily Incomplete Identity Report*\n\n` +
    `${incomplete.length} identity profile${incomplete.length > 1 ? 's' : ''} need attention:\n\n` +
    identityList;

  console.log('Sending to Telegram...');

  // Send to Telegram
  const url = `https://api.telegram.org/bot${telegramBotToken}/sendMessage`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: telegramChatId,
      text: message,
      parse_mode: 'Markdown',
    }),
  });

  const result = await response.json();
  console.log('Telegram response:', JSON.stringify(result, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
