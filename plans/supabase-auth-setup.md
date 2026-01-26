# Supabase Auth Setup Guide

## Magic Link Configuration

### Step 1: Enable Email Provider

1. Go to your Supabase Dashboard
2. Navigate to **Authentication** → **Providers**
3. Find **Email** in the list
4. Toggle it **ON**

### Step 2: Configure Email Settings

In the Email provider settings:

**Confirm email:**
- ❌ **Turn OFF** (we want passwordless magic links, not email confirmation)

**Secure email change:**
- ✅ **Turn ON** (security best practice)

**Magic Link:**
- This is enabled by default when "Confirm email" is OFF
- Users will receive a link they click to sign in (no password)

### Step 3: Set Site URL

1. Go to **Authentication** → **URL Configuration**
2. Set **Site URL:**
   - Development: `http://localhost:3000`
   - Production: `https://realpolitik.world`

This tells Supabase where to redirect users after clicking the magic link.

### Step 4: Configure Redirect URLs

Add allowed redirect URLs (optional, for extra security):

1. Still in **URL Configuration**
2. Under **Redirect URLs**, add:
   ```
   http://localhost:3000/**
   https://realpolitik.world/**
   ```

This restricts where magic links can redirect to.

### Step 5: Customize Email Template (Recommended)

1. Go to **Authentication** → **Email Templates**
2. Find **Magic Link**
3. Replace the default template with the custom one:

**Custom template:** See `plans/magic-link-email-template.html`

Copy the entire HTML file into the template editor.

**Features:**
- Dark theme matching the app
- Monospace fonts (intelligence aesthetic)
- Violet gradient button
- Globe icon
- Professional layout
- Mobile-responsive

**Variables available:**
- `{{ .ConfirmationURL }}` - The magic link
- `{{ .SiteURL }}` - Your site URL
- `{{ .Email }}` - User's email address

### Step 6: SMTP Settings (Optional)

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

## Testing Magic Links

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
- Click "Send magic link"

### 5. Check Email

You'll receive an email with subject: **"Confirm your signup"** (default template)

### 6. Click Link

Click the link in email → redirects to `http://localhost:3000`

### 7. Verify Signed In

- UserMenu appears in top-left
- Shows your email and "9 of 10" briefings
- Features are now unlocked

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

### "Magic link doesn't redirect"

**Check:**
1. Site URL matches your development URL exactly
2. No typos in redirect URLs
3. Browser isn't blocking redirects

**Solution:**
- Verify Site URL in dashboard
- Try different browser
- Check browser console for errors

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
- [ ] Email template customized with branding
- [ ] Rate limiting configured (Supabase Pro if needed)
- [ ] Auth logs monitored for suspicious activity
- [ ] Redirect URLs restricted to your domain only
- [ ] Test magic link flow on production URL
- [ ] Verify profile auto-creation works
- [ ] Test cross-device sync

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
