# Greedy Dragons MVP

## Context

A joke-turned-product: a leaderboard game where your score IS how much real money you've spent. You're a dragon hoarding gold. $1 buys 1 gold. The leaderboard shows who has the biggest hoard. That's it. The creators keep all the money. It's "pay to win" taken literally, and the pitch is the absurdity.

Revenue split: 50/50 between you and your friend.

## MVP Spec

- **What it is**: A pixel-art styled web page with a live leaderboard of dragon gold hoards
- **Core loop**: Visit site → enter a display name → buy gold ($1 each via Stripe) → see your rank rise
- **Identity**: Anonymous. UUID stored in localStorage ties you to your hoard across visits. Display name chosen on first visit.
- **Payments**: Stripe Checkout, $1 per gold. Framed as "entertainment purchase" (buying dragon gold).
- **Leaderboard**: Ever-growing, no weekly reset for MVP
- **Design**: Full pixel art / game feel — dragon sprites, gold pile imagery, medieval dark theme, animations, sound effects

## Architecture

```
Browser (Next.js)  →  Vercel (API Routes)  →  Supabase (Postgres)
                            ↕
                     Stripe Checkout + Webhooks
```

### Tech Stack
- **Framework**: Next.js 14+ (App Router)
- **Styling**: Tailwind CSS + custom pixel art CSS
- **Database**: Supabase (free tier Postgres, easy setup, realtime subscriptions)
- **Payments**: Stripe Checkout Sessions
- **Hosting**: Vercel (free tier)
- **Assets**: Pixel art (AI-generated or free asset packs + custom CSS)

### Database Schema

```sql
-- Players table
CREATE TABLE players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name TEXT NOT NULL,
  gold_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Transactions table (audit trail)
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES players(id),
  gold_amount INTEGER NOT NULL DEFAULT 1,
  amount_cents INTEGER NOT NULL,
  stripe_session_id TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for leaderboard query
CREATE INDEX idx_players_gold ON players(gold_count DESC);
```

### Player Identity Flow
1. First visit → generate UUID, store in `localStorage`
2. Prompt for display name → POST to `/api/players` (creates DB row)
3. Return visit → UUID found in localStorage → fetch existing player data

### Payment Flow
1. Player clicks "Buy Gold" → POST to `/api/checkout` with player UUID
2. API creates Stripe Checkout Session ($1, quantity selector for bulk buys) with player UUID in metadata
3. Player completes payment on Stripe's hosted checkout page
4. Stripe sends webhook to `/api/webhooks/stripe` → `checkout.session.completed`
5. Webhook handler: look up player by UUID from metadata, increment `gold_count`, insert into `transactions`
6. Player redirected back to site → sees updated leaderboard

### Security Considerations
- **Gold can ONLY be added via Stripe webhooks** — never from client requests
- Verify Stripe webhook signatures to prevent spoofing
- Rate-limit the checkout endpoint to prevent abuse
- Display names: sanitize input, limit length (20 chars), filter profanity (basic blocklist)

## Implementation Plan

### Step 1: Project Setup
- Initialize Next.js project with App Router and Tailwind
- Set up Supabase project and create tables
- Install dependencies: `@supabase/supabase-js`, `stripe`
- Configure environment variables (Stripe keys, Supabase URL/key)

### Step 2: Core Backend
- `POST /api/players` — create player with display name, return UUID
- `GET /api/leaderboard` — return top 100 players ordered by gold_count
- `POST /api/checkout` — create Stripe Checkout Session for gold purchase
- `POST /api/webhooks/stripe` — handle `checkout.session.completed`, increment gold

### Step 3: Frontend - Leaderboard Page
- Main page: leaderboard table showing rank, dragon name, gold count
- "Enter the Dragon's Lair" modal for first-time visitors (name entry)
- "Buy Gold" button that triggers Stripe Checkout
- Success/cancel return pages
- Auto-refresh leaderboard (polling every 10s or Supabase realtime)

### Step 4: Pixel Art & Design
- Dark medieval theme (dark purples, blacks, gold accents)
- Pixel art dragon header/mascot
- Gold coin / treasure pile imagery for scores
- Pixelated font (e.g., Press Start 2P from Google Fonts)
- Animated gold pile that grows with your score
- "Cha-ching" or coin drop sound effect on purchase
- Responsive design (works on mobile)

### Step 5: Polish & Deploy
- Stripe test mode end-to-end testing
- Deploy to Vercel
- Configure custom domain (when purchased)
- Switch to Stripe live mode
- Smoke test with real $1 payment

## What You'll Need to Set Up Manually
1. **Stripe account** — sign up at stripe.com, get API keys
2. **Supabase project** — sign up at supabase.com, create project, run schema SQL
3. **Vercel account** — sign up at vercel.com, connect GitHub repo
4. **Domain** — register `greedydragons.com` or similar (optional for MVP, can use Vercel's free `.vercel.app` subdomain)

## Out of Scope (Future Ideas)
- Weekly leaderboard reset with archives
- Daily spending limits / "play to pay" unlock mechanic
- Crypto wallet payments
- Dragon customization / visual upgrades
- Social sharing ("I'm #3 on Greedy Dragons!")
- Sound toggle
- Multiple gold tiers ($1, $5, $10, $25)

## Verification
1. Run `npm run dev` and verify the leaderboard page loads
2. Create a player via the name entry flow
3. Click "Buy Gold" → complete Stripe test payment → verify gold count increments
4. Verify leaderboard ranking updates correctly
5. Test with multiple players to confirm ordering
6. Test on mobile viewport
7. Deploy to Vercel and repeat smoke test
