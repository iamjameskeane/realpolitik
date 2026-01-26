# Supabase Auth Setup Guide

## OTP (One-Time Password) Configuration

### Step 1: Enable Email Provider

1. Go to your Supabase Dashboard
2. Navigate to **Authentication** → **Providers**
3. Find **Email** in the list
4. Toggle it **ON**

### Step 2: Configure Email Settings

In the Email provider settings:

**Confirm email:**
- Can be ON or OFF (OTP works with both)
- Recommend: ❌ **Turn OFF** for simpler flow

**Secure email change:**
- ✅ **Turn ON** (security best practice)

**Email OTP:**
- Enabled by default with the Email provider
- Users will receive a 6-digit code via email to authenticate (no password, no link)

### Step 3: Set Site URL

1. Go to **Authentication** → **URL Configuration**
2. Set **Site URL:**
   - Development: `http://localhost:3000`
   - Production: `https://realpolitik.world`

**Note:** For OTP authentication, the Site URL is less critical than with magic links since there's no browser redirect. However, it's still good practice to set it.

### Step 4: Customize Email Template (Recommended)

1. Go to **Authentication** → **Email Templates**
2. Find **Confirm signup** or **Magic Link** template
3. Replace the default template with the custom one:

**Custom template:** See `plans/otp-email-template.html`

Copy the entire HTML file into the template editor.

**Features:**
- Dark theme matching the app
- Monospace fonts (intelligence aesthetic)
- Large, prominent 6-digit OTP code display
- Violet gradient border around code
- Globe icon
- Professional layout
- Mobile-responsive

**Variables available:**
- `{{ .Token }}` - The 6-digit OTP code
- `{{ .SiteURL }}` - Your site URL
- `{{ .Email }}` - User's email address

### Step 5: SMTP Settings (Optional)

By default, Supabase uses their SMTP server (limited to 3-4 emails/hour in development).

**For production, configure custom SMTP:**

1. Go to **Project Settings** → **Auth**
2. Scroll to **SMTP Settings**
3. Configure your email service:
   - SendGrid
   - AWS SES
   - Mailgun
   - Postmark
   - etc.

**Why custom SMTP:**
- Higher rate limits (hundreds/thousands per hour)
- Better deliverability
- Custom sender address
- Email analytics

**For now:** Supabase's default SMTP is fine for testing.

---

## Testing OTP Authentication

### 1. Start Dev Server

```bash
npm run dev
```

### 2. Open App

Go to `http://localhost:3000`

### 3. Trigger Sign In

- Click any event dot
- Click yellow "Sign in to access smart features" banner
- OR click Settings → Sign In

### 4. Enter Email

- Enter your email: `you@example.com`
- Click "Send Code"

### 5. Check Email

You'll receive an email with a **6-digit OTP code** (e.g., `123456`)

### 6. Enter Code

- Enter the 6-digit code in the app
- Click "Verify Code"

### 7. Verify Signed In

- UserMenu appears in top-left
- Shows your email and "9 of 10" briefings
- Features are now unlocked

---

## How It Works

**OTP Flow:**

1. **User enters email** → App calls `supabase.auth.signInWithOtp({ email })`
2. **Supabase sends 6-digit code** via email
3. **User enters code in app** → App calls `supabase.auth.verifyOtp({ email, token: code, type: "email" })`
4. **User is authenticated** in the same session (no browser redirect!)

**Benefits vs Magic Links:**

✅ **Works in PWA mode** - no browser context switching  
✅ **Works in browser mode** - same flow everywhere  
✅ **Better mobile UX** - numeric keyboard, auto-complete  
✅ **No redirect complexity** - all happens in one session  
✅ **Simpler setup** - no redirect URL configuration needed

---

## Common Issues

### "Email not sent"

**Check:**
1. Email provider is enabled in dashboard
2. Site URL is set correctly
3. You're not hitting rate limit (3-4 emails/hour on default SMTP)
4. Check spam folder

**Solution:**
- Wait 15 minutes if rate limited
- Configure custom SMTP for higher limits

### "Invalid code" or "Code doesn't work"

**Check:**
1. Code is 6 digits exactly
2. Code hasn't expired (10 minutes)
3. You're using the most recent code (old codes are invalidated)
4. Email address matches exactly

**Solution:**
- Request a new code
- Check for typos in email or code
- Try copy-paste from email

### "User created but profile not created"

**Check:**
1. Migration ran successfully
2. Trigger `handle_new_user()` exists
3. Check Supabase logs for errors

**Solution:**
```bash
# Re-run migration
npx supabase db push

# Manually create profile
INSERT INTO profiles (id, email)
SELECT id, email FROM auth.users
WHERE id NOT IN (SELECT id FROM profiles);
```

### "Session expires immediately"

**Check:**
1. JWT expiry settings in Auth config
2. Client-side session management

**Default:** Sessions last 1 hour, refresh tokens last 1 week (this is fine)

---

## Production Checklist

Before going live:

- [ ] Site URL set to production domain
- [ ] Custom SMTP configured (optional but recommended)
- [ ] Email template customized with OTP code display
- [ ] Rate limiting configured (Supabase Pro if needed)
- [ ] Auth logs monitored for suspicious activity
- [ ] Test OTP flow on production URL
- [ ] Verify profile auto-creation works
- [ ] Test cross-device sync
- [ ] Verify OTP expiry is appropriate (default: 1 hour, can be adjusted)

---

## Current Configuration

**Site URL:** Not set yet (needs manual configuration)  
**Email Provider:** Not enabled yet (needs manual configuration)  
**SMTP:** Default Supabase SMTP (3-4 emails/hour limit)

**Action Required:** Go to Supabase Dashboard and complete Steps 1-3 above.

---

## Quick Start Commands

```bash
# 1. Run migrations
npx supabase db push

# 2. Start dev server
npm run dev

# 3. Go to browser
open http://localhost:3000

# 4. Configure Supabase (manual)
# → Go to dashboard.supabase.com
# → Enable Email provider
# → Set Site URL: http://localhost:3000
# → Click Save

# 5. Test sign in
# → Enter email in app
# → Check inbox
# → Click link
# → Verify signed in
```

That's it! Magic links will work.
