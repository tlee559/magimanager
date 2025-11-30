# TOKEN_ENCRYPTION_KEY Setup & Troubleshooting

## What It Does

`TOKEN_ENCRYPTION_KEY` is used to encrypt/decrypt OAuth tokens (Google Ads access & refresh tokens) stored in the database. Both **abra** and **kadabra** must use the **exact same key** since:
- Abra encrypts tokens during OAuth connection
- Kadabra decrypts them to fetch campaigns/metrics
- Either app may refresh tokens and re-encrypt them

## Key Format

- 64-character hex string (32 bytes = 256 bits for AES-256)
- Example: `06c5d1e46be97b4036889d2c02a1b5f77881cb79c16f9ebcafc3e0f3c7c83b5e`

## Generate a New Key

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Where It Must Be Set

### Local Development
Set in the root `.env` file (shared by both apps via Turborepo):
```
TOKEN_ENCRYPTION_KEY="your-64-char-hex-key"
```

### Vercel Production
**CRITICAL**: Both projects must have the SAME key!

1. Go to Vercel Dashboard → magimanager-abra → Settings → Environment Variables
2. Set `TOKEN_ENCRYPTION_KEY` for Production, Preview, and Development
3. Repeat for magimanager-kadabra with the **exact same value**

Or via CLI:
```bash
# For abra
cd apps/abra
vercel link  # if not linked
echo "your-64-char-hex-key" | vercel env add TOKEN_ENCRYPTION_KEY production
echo "your-64-char-hex-key" | vercel env add TOKEN_ENCRYPTION_KEY preview
echo "your-64-char-hex-key" | vercel env add TOKEN_ENCRYPTION_KEY development

# For kadabra
cd apps/kadabra
vercel link  # if not linked
echo "your-64-char-hex-key" | vercel env add TOKEN_ENCRYPTION_KEY production
echo "your-64-char-hex-key" | vercel env add TOKEN_ENCRYPTION_KEY preview
echo "your-64-char-hex-key" | vercel env add TOKEN_ENCRYPTION_KEY development
```

## Troubleshooting

### Symptom: 500 error on campaigns API
**Cause**: Key mismatch between apps
**Fix**: Ensure both apps have identical `TOKEN_ENCRYPTION_KEY`

### Symptom: 401 "Token decryption failed" error
**Cause**: Tokens in DB were encrypted with a different key
**Fix**:
1. Set correct key on both apps
2. Redeploy both apps
3. Re-authenticate affected accounts via OAuth

### Symptom: "Unsupported state or unable to authenticate data" on OAuth
**Cause**: OAuth state encryption/decryption failing
**Fix**: Same as above - key mismatch

## Prevention Checklist

- [ ] Never change `TOKEN_ENCRYPTION_KEY` on just one app
- [ ] Keep the key in root `.env` as the source of truth
- [ ] When rotating keys: update both apps simultaneously, then re-auth all accounts
- [ ] Add key verification to deployment checks (future improvement)

## Incident History

### 2025-11-30: Key Mismatch Issue
- **Problem**: Different keys on abra vs kadabra on Vercel
- **Symptoms**: 500 errors on campaigns, OAuth reconnect failing
- **Resolution**: Set matching keys on both apps, redeployed, reconnected accounts
