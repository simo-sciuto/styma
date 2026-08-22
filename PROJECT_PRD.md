# PROJECT PRD — Reselling Object Intelligence

## 1. Product vision

Build a modern web application for people who buy interesting objects at flea markets, second-hand shops, auctions, Vinted, eBay and similar marketplaces.

The core question the product must answer is:

> "I found this object. Should I buy it, and how much is it actually worth?"

The user takes 4–8 photos of an object. The application analyzes the images and returns:

- object identification
- category
- brand / manufacturer
- model or product family when identifiable
- approximate age / period
- materials and notable characteristics
- short historical/contextual description
- estimated market value range
- confidence level
- market demand
- estimated selling difficulty / liquidity
- potential resale margin
- a simple BUY / MAYBE / PASS recommendation
- a transparent score explaining why

The product should feel fast and useful in the field. The user may literally be standing at a flea market with one hand on the phone and the other holding the object.

The application is NOT primarily an image-recognition demo. Image recognition is only the first step. The valuable output is the decision.

---

## 2. Target user

Primary user:

A casual or semi-professional reseller who:

- visits flea markets and second-hand stores
- buys objects based on potential resale value
- sells on Vinted, eBay, Subito or similar platforms
- does not necessarily know every category deeply
- wants a quick second opinion before spending money

The interface must therefore prioritize:

1. speed
2. clarity
3. confidence
4. actionable information

Avoid overwhelming the user with technical AI terminology.

---

## 3. Core user journey

### Step 1 — Discover

Homepage presents one dominant action:

"Analyze an object"

Secondary actions:

- View inventory
- View previous analyses

### Step 2 — Photograph

User uploads 4–8 photographs.

Provide simple photographic guidance:

- front
- back
- side
- bottom / maker mark
- close-up of logo or serial number
- close-up of damage
- detail / texture

Allow fewer photos if the object is already identifiable.

### Step 3 — Analyze

The backend sends the images to the vision model.

The AI should produce a structured identification result.

Do NOT let the frontend depend on raw model text.

Use a validated structured schema.

### Step 4 — Research

Once the object is identified, gather comparable market information where available.

The system should distinguish between:

- asking prices
- actual sold prices
- weak comparables
- strong comparables

Never present an asking price as if it were a confirmed sale.

### Step 5 — Valuation

Calculate an estimated market range.

Example:

€70–€110

Then explain:

"Most comparable sold items cluster around €85–€95."

### Step 6 — Decision

Show the most important result prominently:

BUY / MAYBE / PASS

And a score, for example:

87 / 100

The score must be explainable.

Example:

+ strong demand
+ 23 relevant comparables
+ recognizable brand
+ good resale liquidity
- visible condition issue
- estimated shipping cost relatively high

### Step 7 — Save

Allow the user to save the object.

Optional fields:

- purchase price
- purchase location
- purchase date
- notes

This creates the user's personal inventory.

---

## 4. Main screens

### Home

Minimal landing page.

Primary CTA:

"Analyze an object"

Secondary navigation:

- Inventory
- History

The home page should immediately communicate the value proposition.

Example:

"Find out what that weird little thing is worth."

Avoid generic AI marketing language.

### Analyze

Camera/upload-oriented interface.

Requirements:

- drag and drop on desktop
- mobile photo upload
- preview thumbnails
- remove / reorder photos
- photographic guidance
- analyze button

### Analysis result

This is the most important screen.

Suggested structure:

1. Object identification
2. Confidence
3. Estimated value
4. BUY / MAYBE / PASS
5. Flip score
6. Why?
7. Short history
8. Comparable sales
9. Risks / uncertainty
10. Save to inventory

The result must be scannable in a few seconds.

### Inventory

Simple list/grid of saved objects.

Each item should show:

- image
- object name
- purchase price if known
- estimated value
- status

Possible statuses:

- Found
- Bought
- Listed
- Sold

### Item detail

Show complete analysis plus:

- purchase price
- selling price
- profit
- ROI
- notes
- sale date
- marketplace

### History

Previous analyses.

Allow the user to revisit an analysis without repeating the AI call.

---

## 5. Valuation model

The valuation system should be modular.

Do not hard-code the valuation logic inside React components or API routes.

Create a dedicated valuation service.

Conceptual pipeline:

IDENTIFICATION
→ COMPARABLE SEARCH
→ COMPARABLE FILTERING
→ WEIGHTING
→ MARKET RANGE
→ RESALE FACTORS
→ FLIP SCORE

### Comparable weighting

Potential weighting factors:

- exact model match
- same brand
- same product family
- same period
- same material
- same condition
- geographic relevance
- recency
- source reliability

Example conceptual weights:

Exact model: 1.00
Same variant/family: 0.80
Same brand/category: 0.60
Similar category/style: 0.35

These values are starting points, not immutable rules.

Keep them configurable.

### Value calculation

Do not return a fake precision value such as:

€93.42

Prefer:

€80–€110

and optionally:

Most likely: €95

The system should communicate uncertainty.

### Confidence

Confidence should depend on factors such as:

- quality of identification
- number of strong comparables
- similarity of comparables
- consistency of prices
- image quality

Example:

High confidence
Medium confidence
Low confidence

Never invent confidence merely because the AI sounds certain.

---

## 6. Flip score

Create a score from 0–100.

The score is NOT the object's intrinsic value.

It represents how attractive the object is as a resale opportunity.

Possible inputs:

- expected resale value
- purchase price
- expected selling fees
- expected shipping / handling
- market demand
- liquidity
- price volatility
- identification confidence
- condition
- number and quality of comparables

Conceptual calculation:

Expected Profit =
Expected Sale Price
- Purchase Price
- Marketplace Fees
- Shipping / Handling
- Other known costs

Then combine profitability with confidence and liquidity.

The exact formula should live in a dedicated service and be easy to change.

Always expose the major factors behind the score.

---

## 7. AI architecture

Use AI for:

- image understanding
- object identification
- OCR / maker mark interpretation
- historical/contextual description
- generation of structured hypotheses

Do NOT use the language model alone as the source of market value.

Market valuation should be grounded in external comparable data whenever possible.

All AI output must be validated with a schema.

Use Zod.

Example conceptual response:

{
  "identification": {
    "name": "...",
    "category": "...",
    "brand": "...",
    "model": "...",
    "period": "...",
    "confidence": 0.86
  },
  "valuation": {
    "currency": "EUR",
    "low": 70,
    "high": 110,
    "likely": 95,
    "confidence": 0.74
  },
  "decision": {
    "score": 87,
    "recommendation": "BUY"
  }
}

Adapt the exact schema to the implementation.

---

## 8. Data model

Use Supabase/PostgreSQL.

Initial entities:

### User

Managed by Supabase Auth.

### Item

Fields should include at least:

- id
- user_id
- title
- category
- brand
- model
- description
- estimated_period
- identification_confidence
- purchase_price
- purchase_currency
- purchase_date
- purchase_location
- status
- created_at
- updated_at

### ItemImage

- id
- item_id
- storage_path
- sort_order
- created_at

### Valuation

- id
- item_id
- low_value
- high_value
- likely_value
- currency
- confidence
- flip_score
- recommendation
- reasoning
- created_at

### Comparable

- id
- valuation_id
- title
- source
- url
- price
- currency
- sold_price
- sold_at
- similarity_score
- source_type

Do not over-engineer the schema before the first working vertical slice.

---

## 9. Technical stack

Preferred stack:

- Next.js
- React
- TypeScript
- Tailwind CSS
- shadcn/ui
- Supabase
- PostgreSQL
- Supabase Storage
- Zod
- Vercel

Use the latest stable versions available when implementation starts.

Use TypeScript strict mode.

Avoid unnecessary dependencies.

Do not introduce a state-management library unless the application actually requires one.

---

## 10. Architecture principles

Keep responsibilities separated.

Recommended conceptual structure:

- app/
- components/
- features/
- lib/
- services/
- schemas/
- types/
- db/

Frontend components should not contain business logic.

API routes / server actions should orchestrate services.

Services should contain business logic.

Schemas should validate external input.

Database access should be isolated.

AI provider integration should be isolated behind a service interface so the provider can be replaced later.

Marketplace/comparable-data integrations should also be isolated.

---

## 11. UX principles

The application should feel like a tool, not a dashboard.

Prioritize:

- large readable values
- strong visual hierarchy
- minimal forms
- mobile-first design
- fast transitions
- clear loading states
- clear error states
- progressive disclosure

Do not display every piece of information immediately.

The first screen of an analysis should answer:

"What is it?"

"How much is it worth?"

"Should I buy it?"

Everything else can follow.

---

## 12. Loading experience

Analysis may take several seconds.

Do not show a generic spinner only.

Use meaningful progress states:

"Reading the object..."
"Identifying the manufacturer..."
"Looking for comparable items..."
"Estimating market value..."
"Calculating resale potential..."

These messages should reflect actual backend stages where practical.

---

## 13. Error handling

Handle explicitly:

- invalid images
- too few useful images
- oversized files
- AI provider failure
- unidentified object
- insufficient comparable data
- database failure
- rate limits
- timeout

If valuation cannot be reliably calculated, say so.

Example:

"We can identify the object, but we don't have enough reliable market data to estimate its resale value."

Never manufacture a number to make the UI look complete.

---

## 14. Security

Implement:

- Supabase Row Level Security
- user-specific data isolation
- server-side API keys
- file upload validation
- file size limits
- MIME type validation
- rate limiting where appropriate

Never expose provider API keys to the client.

---

## 15. MVP boundaries

The first implementation should focus on one complete vertical slice:

Upload photos
→ AI identification
→ structured result
→ basic valuation
→ result page
→ save item

Do not block the first working version on:

- marketplace integrations
- automatic listing creation
- advanced analytics
- social features
- notifications
- barcode scanning
- maps
- community features
- complex recommendation systems

These can come later.

---

## 16. Future roadmap

Potential future features:

### Selling assistant

Generate:

- title
- description
- category
- suggested listing price
- keywords

### Marketplace integrations

Potential integrations with:

- eBay
- Vinted
- Subito
- other relevant marketplaces

### Personal analytics

Track:

- total profit
- ROI
- average time to sale
- best categories
- average purchase price
- average resale price

### Opportunity discovery

Suggest categories and objects worth looking for.

### Watchlists

Track objects and market prices.

### Market trends

Identify categories whose prices or demand are increasing.

### Local discovery

Potentially combine the product with flea-market and auction discovery.

---

## 17. Product philosophy

The product should be opinionated.

Do not merely say:

"This object might be worth €80–€120."

Instead say:

"Estimated resale value: €80–€120.
At €20 purchase price: BUY.
At €70: MAYBE.
At €100: PASS."

The product exists to improve decisions.

Accuracy and transparency are more important than impressive-looking AI output.

---

## 18. Development workflow for Claude Code

Act as a senior staff engineer and product-minded technical lead.

Before writing significant code:

1. Inspect the repository.
2. Inspect existing configuration.
3. Identify what already exists.
4. Do not overwrite working code without reason.
5. Propose the smallest coherent implementation.

Work incrementally.

For each milestone:

1. Explain what will be implemented.
2. Implement it.
3. Run type checks.
4. Run linting.
5. Run tests where available.
6. Fix issues.
7. Summarize what changed.
8. State what the next milestone is.

Do not implement the entire roadmap in one pass.

Do not create speculative abstractions.

Prefer boring, maintainable code over clever architecture.

When a requirement is ambiguous, choose the simplest reasonable interpretation and document the assumption.

If a technical decision materially affects cost, scalability, security, or future extensibility, call it out before implementation.

---

## 19. First milestone

Start with project reconnaissance.

Do NOT immediately build the whole application.

First:

- inspect the repository
- determine whether a Next.js project already exists
- inspect package.json
- inspect existing routes/components
- inspect environment configuration
- inspect Git status
- identify installed dependencies
- identify missing infrastructure

Then provide a concise implementation plan for the first vertical slice.

After that, begin implementation.

---

## 20. Definition of done for the first vertical slice

A user must be able to:

1. Open the application.
2. Start an analysis.
3. Upload multiple photos.
4. Submit them.
5. Receive a structured identification.
6. See an estimated value range.
7. See confidence.
8. See a BUY / MAYBE / PASS recommendation.
9. See the reasoning behind the recommendation.
10. Save the analysis.
11. Return later and see the saved item.

The result must work on mobile.

The code must pass TypeScript checks and linting.

The implementation must be structured so that real market-data integrations can be added later without rewriting the core product.

---

## 21. Important instruction

Do not optimize for maximum feature count.

Optimize for the moment where a person at a flea market takes four photos and thinks:

"Okay. Now I know whether this is worth buying."

That moment is the product.
