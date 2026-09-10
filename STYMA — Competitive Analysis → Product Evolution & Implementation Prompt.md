# STYMA
## Competitive Analysis → Product Evolution → UX / Architecture / Implementation Plan

You are working on **STYMA**, an existing Next.js application for identifying, researching and valuing second-hand / vintage / collectible objects.

This is NOT a greenfield project.

Before changing anything, inspect the existing repository, understand what already works, identify the current architecture and preserve working functionality unless this brief explicitly asks you to change it.

The goal of this task is to evolve STYMA into a significantly stronger product based on competitive analysis.

---

# 1. THE PRODUCT WE ARE BUILDING

STYMA should NOT primarily be:

> “Take a photo and discover what this object is worth.”

That category is becoming increasingly commoditized.

STYMA should become:

> **A resale decision engine for people who discover objects in the real world and want to know whether they should buy them.**

The central question is:

# SHOULD I BUY THIS?

The complete product loop should become:

**FIND → IDENTIFY → VERIFY → RESEARCH → VALUE → DECIDE → BUY → FLIP → SELL**

The identification and valuation are important, but they are means to an end.

The most important output is a decision.

Example:

> Seller asks €18  
> Estimated realistic resale: €55–70  
> Recommended maximum purchase price: €27  
> Confidence: 82%  
> Verdict: BUY  
> Why: strong comparable sales, good condition, recognizable maker, healthy resale demand.

This is much more useful than:

> “This object is probably worth €60.”

---

# 2. COMPETITIVE ANALYSIS

The product direction must take into account the strengths and weaknesses of these competitors and adjacent products:

## Direct / close competitors

### Flippi
Strengths:
- Extremely clear “should I buy this?” positioning
- Photo-based analysis
- Asking price as an input
- Buying advice
- Resale-oriented scores
- Fast field workflow

Weakness:
- Opportunity to go deeper into evidence
- Authenticity verification can be much more structured
- Market evidence can be explained better
- Maximum buy price can become a stronger signature feature
- Profit/liquidity/risk can be integrated more deeply

STYMA must NOT simply clone Flippi.

It should take the decision-oriented model and build a more credible, explainable investigation layer around it.

---

### WorthPoint
Strengths:
- Huge historical sales database
- Sold-price data
- Historical research
- Marks
- Maker information
- Collectibles knowledge

Weakness:
- Research-oriented
- Not optimized for a person standing at a flea market
- High information density without a simple purchase decision

STYMA should NOT try to compete with WorthPoint's database size.

Instead:

> Aggregate useful market evidence and translate it into a decision.

---

### Marks4Antiques
Strengths:
- Maker marks
- Hallmarks
- Authentic vs reproduction marks
- Specialist knowledge
- Sold-price information

Important lesson:

**Maker mark analysis is a major opportunity for STYMA.**

When a mark is visible, it can dramatically improve identification, authenticity confidence and valuation.

---

### Kovels
Strengths:
- Editorial expertise
- Price guides
- Marks
- Historical context
- Expert-reviewed information

Lesson:

STYMA should expose expert-like context in a compressed form.

Not an encyclopedia.

Instead:

**WHAT IT IS → WHY IT MATTERS → WHAT TO CHECK**

---

### Mearto
Strength:
- Human expert appraisal
- Strong credibility
- Specialist categories
- Fair-market valuation

Weakness:
- Slow
- Not designed for immediate flea-market decisions

Long-term STYMA opportunity:

> “Need an expert?”

Potential future escalation flow for high-value / low-confidence objects.

Do NOT implement expert escalation now unless the existing architecture already supports it.

---

## Marketplace / market-data competitors

### eBay
Strengths:
- Huge marketplace
- Visual search
- Current listings
- Sold/completed market information
- Natural resale destination

Weakness:

It gives the user information but expects them to interpret it.

STYMA's job is:

> Turn dozens of marketplace results into 3–5 meaningful comparables and explain why they matter.

---

### LiveAuctioneers
Strength:
- Historical auction results
- Real hammer prices
- Large database

Lesson:

STYMA must distinguish:

**ASKING PRICE ≠ SOLD PRICE ≠ AUCTION RESULT**

Never mix them into a single misleading number.

---

### Barnebys
Strength:
- Broad auction discovery
- Many auction houses
- Global market coverage

Lesson:

Auction evidence can improve valuation for antiques, collectibles and higher-value objects.

Again, STYMA should aggregate and simplify.

---

### Google Lens
Strength:
- Massive visual search
- Image recognition
- Similar images
- Text extraction

Weakness:

It doesn't answer:

> Should I buy it?

STYMA must provide the interpretation layer.

---

### Replacements
Strength:
- Visual search
- Excellent photo guidance
- Specific focus on marks, backs, bottoms and details

Lesson:

STYMA's photo capture flow should become much more intelligent.

Do not simply say:

> Upload 4–8 photos.

Instead explain WHY each photo matters.

For example:

1. Whole object
2. Front/detail
3. Back or underside
4. Maker mark
5. Serial/model number
6. Damage
7. Material/detail

The system should ideally identify missing evidence and request another photo.

---

### PriceCharting
Strength:
- Multi-object photo recognition
- Lot analysis
- Value per item
- Saved collections

Lesson:

STYMA should eventually support:

> “I'm looking at a table with six objects.”

Then allow the user to investigate the interesting ones.

This is particularly useful at flea markets.

---

### AntiqueAI and similar apps
Strengths:
- Identification
- Value estimate
- Historical information
- Collection
- Listing generation

Lesson:

Identification + story + listing generation are NOT strong differentiators anymore.

STYMA should still have these capabilities, but they should not be the core product identity.

---

# 3. WHAT MUST CHANGE

## Current conceptual model

The current STYMA flow is approximately:

PHOTO → IDENTIFY → VALUE → SAVE

This is too linear and too shallow.

Change it to:

PHOTO → IDENTIFY → VERIFY → MARKET → VALUE → BUY DECISION → OPTIONAL INVESTIGATION → BUY / PASS → RESELL

The product should feel like an investigation rather than a generic AI scanner.

---

# 4. WHAT TO KEEP

Preserve and improve the existing foundations where they already work:

- Next.js architecture
- Authentication
- Supabase
- Storage
- Existing object photo upload
- Existing image recognition
- Existing market search
- Existing valuation logic
- Existing inventory
- Existing listing generation
- Existing PWA behavior
- Existing APIs and integrations
- Existing working data models

Do NOT rewrite working infrastructure just for architectural purity.

Before modifying anything:

1. inspect the repository
2. map current architecture
3. identify existing services
4. identify existing API routes
5. identify existing database schema
6. identify existing components
7. identify what can be extended instead of rewritten

---

# 5. WHAT TO REDUCE OR REMOVE

Do NOT blindly delete working code.

Instead, identify UI/features that no longer deserve to be first-class product concepts.

## Reduce the importance of:

### Generic object identification

Identification remains essential but should no longer be the hero of the product.

Instead of:

> “We identified your object!”

The product should move quickly toward:

> “Here's what we think it is. Here's why. Now here's whether it's worth buying.”

---

### Generic valuation

Avoid presenting a single magical number.

Replace:

> Value: €80

with:

> Estimated market range: €65–90

and explain:

- asking prices
- sold prices
- auction results
- comparable quality
- confidence
- condition assumptions

---

### Generic “AI” language

STYMA copy must NEVER rely on “AI” as a selling point.

Do not use:

- AI-powered
- AI valuation
- AI object recognition
- AI assistant
- powered by AI

The user doesn't care about the underlying technology.

The product should communicate:

- evidence
- market intelligence
- research
- confidence
- decisions
- opportunity

---

### Inventory as a passive archive

The current inventory concept:

> “Every object with the valuation it had when you saved it.”

is too passive.

Inventory should become:

# MY FINDS

or another equally strong concept.

An object should have a lifecycle:

**FOUND → BOUGHT → LISTED → SOLD**

and potentially:

**PASSED**

This turns inventory into a resale workflow rather than a gallery.

---

# 6. NEW CORE INFORMATION ARCHITECTURE

The primary object result should follow this hierarchy:

## 01 — WHAT IS IT?

Show:

- probable identification
- category
- brand / maker
- model / pattern if available
- era
- material
- origin
- confidence

Also show:

### WHY THIS MATCH?

A concise explanation of the evidence supporting the identification.

Example:

> “The backstamp, proportions and handle shape match examples from Brand X, 1970–1980.”

Never fabricate evidence.

---

# 7. 02 — SHOULD I BUY IT?

This must become the visual and functional centerpiece.

The user enters:

### ASKING PRICE

Example:

€18

Then STYMA calculates:

### MARKET VALUE

€55–70

### MAX BUY PRICE

€27

### VERDICT

# BUY

or:

# NEGOTIATE

or:

# PASS

The verdict must be explainable.

Example:

> BUY  
> Seller asks €18.  
> We estimate a realistic resale range of €55–70.  
> Even after expected selling costs, there is enough margin.

---

# 8. MAX BUY PRICE

This should become one of STYMA's signature metrics.

The product should answer:

> **What is the most I should pay?**

Conceptually:

Expected resale price
− selling fees
− shipping / packaging
− risk buffer
− target profit
= maximum purchase price

The exact calculation must be based on the available data and clearly documented.

Do NOT invent precise financial numbers when the underlying market data is weak.

If confidence is low, the maximum buy price should become more conservative or be presented as uncertain.

Example:

> Expected sale: €65  
> Fees: €8  
> Shipping/packaging: €5  
> Risk buffer: €7  
> Target profit: €18  
> **Max buy: €27**

The calculation must be inspectable.

---

# 9. PRICE ZONES

Instead of one number, create three useful zones:

### BUY
Price range where the opportunity is attractive.

### NEGOTIATE
Possible opportunity, but only at a better price.

### PASS
Too expensive relative to expected resale and risk.

This is more useful in real-world buying situations.

---

# 10. DEAL SCORE

Introduce a transparent opportunity score.

Potential factors:

- margin
- identification confidence
- condition
- demand
- liquidity
- market evidence
- authenticity risk

Do NOT make the score look like a mysterious algorithm.

Always allow the user to understand WHY the score is high or low.

Potential presentation:

**DEAL SCORE 82/100**

Then:

- Margin: Strong
- Confidence: High
- Demand: Medium
- Liquidity: Good
- Risk: Low

The exact weighting should be determined after inspecting the existing valuation architecture.

Do not hardcode arbitrary weights without documenting the reasoning.

---

# 11. VALUE ≠ LIQUIDITY

This is important.

An object can be worth €150 and still be a terrible resale opportunity if it takes six months to sell.

Therefore distinguish:

### VALUE

How much the market may pay.

### LIQUIDITY

How easily / quickly the object is likely to sell.

Potential states:

- HIGH
- MEDIUM
- LOW
- UNKNOWN

If sufficient data exists, eventually estimate:

> “Likely slower sale. Specialist buyer required.”

Do NOT fabricate days-to-sale if the data doesn't support it.

---

# 12. MARKET INTELLIGENCE

The market section must distinguish data types.

Use separate categories:

### CURRENT ASKING
What sellers currently ask.

### SOLD
What buyers actually paid, where reliable sold data is available.

### AUCTION
Hammer prices / auction outcomes.

### RETAIL / DEALER
Useful as context, but should not be confused with resale market value.

Every comparable should ideally include:

- image
- price
- source
- date if available
- condition
- similarity
- marketplace
- status: asking / sold / auction

The interface should make these distinctions obvious.

---

# 13. COMPARABLES

Do not dump 30 search results onto the user.

Select the strongest evidence.

Target:

**3–5 strong comparables**

For each:

- image
- price
- source
- type
- similarity
- reason it is relevant

Example:

> 91% visual match  
> Same maker  
> Same pattern  
> Sold €62

The system must distinguish between:

**strong comparable**

and

**visual similarity only**

A visually similar object is not necessarily a valid price comparable.

---

# 14. CONFIDENCE

Every important conclusion should have confidence.

At minimum:

### IDENTIFICATION CONFIDENCE

High / Medium / Low

### VALUE CONFIDENCE

High / Medium / Low

### AUTHENTICITY CONFIDENCE

High / Medium / Low / Cannot determine

Do not pretend certainty.

The product's credibility depends on being comfortable saying:

> “We don't have enough evidence.”

---

# 15. AUTHENTICITY

Introduce an authenticity layer.

Potential states:

### LIKELY ORIGINAL

### NEEDS VERIFICATION

### HIGH RISK

### CANNOT DETERMINE

Never claim definitive authentication from photographs alone.

Instead provide:

### WHAT SUPPORTS IT

Example:

- mark shape consistent
- construction consistent
- material consistent

### RED FLAGS

Example:

- mark differs from known examples
- modern construction
- suspicious proportions
- inconsistent material

### WHAT TO CHECK

Example:

> Photograph the underside of the mark at closer range.

This should connect directly to the photo workflow.

---

# 16. SMART PHOTO CAPTURE

Replace generic:

> Upload 4–8 photos.

with an investigative capture flow.

The product should suggest useful shots:

### REQUIRED

- whole object

### HIGH VALUE

- back / underside
- maker mark
- logo
- serial number
- label
- construction detail

### CONDITION

- scratches
- chips
- cracks
- restoration
- missing parts

The system should explain:

> “A photo of the underside could increase identification confidence.”

This is much more useful than simply asking for more photos.

---

# 17. SECOND LOOK / INVESTIGATION MODE

After the first analysis, the user should not have to restart everything.

Provide targeted actions such as:

- Check the mark
- Find more comparables
- Check authenticity
- Investigate history
- Recalculate with another asking price
- Check condition impact
- Find similar sold objects

This creates a second layer of product depth.

Think:

**First pass = fast decision**

**Second pass = deeper investigation**

This distinction is critical.

---

# 18. BEFORE YOU BUY

Every result should have a concise checklist.

Example:

### BEFORE YOU BUY

☐ Check underside mark  
☐ Check for restoration  
☐ Check cracks / chips  
☐ Confirm dimensions  
☐ Confirm all parts are present  
☐ Compare against the strongest sold comparable

This should be optimized for someone standing at a flea market.

---

# 19. NEGOTIATION MODE

If the verdict is NEGOTIATE, expose a useful negotiation target.

Example:

> Asking: €35  
> Target: €24  
> Max: €27

Then optionally:

### WHAT TO SAY

Provide a short, natural negotiation phrase.

Example:

> “Would you take €24 for it?”

Do not make this gimmicky.

---

# 20. PROFIT CALCULATOR

When the user intends to buy, show the economics.

Inputs:

- purchase price
- expected sale price
- marketplace
- fees
- shipping
- packaging
- optional restoration cost

Outputs:

- expected revenue
- estimated costs
- expected profit
- ROI
- conservative / realistic / optimistic scenario

Example:

### BUY FOR
€20

### SELL FOR
€65

### ESTIMATED COSTS
€14

### EXPECTED PROFIT
€31

### ROI
155%

The exact values must come from actual calculations.

---

# 21. THE STORY

Keep historical context, but move it below the decision layer.

The story should answer:

- What is it?
- When is it from?
- Who made it?
- Why is it interesting?
- Why might collectors care?

Keep it short.

Avoid encyclopedia-style walls of text.

---

# 22. RISKS

Add a concise risk section.

Possible risks:

- identification uncertain
- authenticity uncertain
- weak market evidence
- low liquidity
- condition issue
- difficult shipping
- niche buyer pool
- inconsistent comparable prices

This should directly affect the buying recommendation.

---

# 23. SELL

Listing generation remains valuable, but it should come AFTER the buying decision.

Support eventually:

- Vinted
- eBay
- Subito
- Etsy
- Facebook Marketplace

For each:

- title
- description
- condition
- category
- price
- keywords
- hashtags where appropriate

Important:

Listing copy must inherit verified facts from the investigation.

Never turn uncertain attribution into a definitive statement.

For example:

If identification is uncertain:

> “Possibly attributed to…”

rather than:

> “Made by…”

---

# 24. MY FINDS

Redesign the current inventory concept.

Potential statuses:

### FOUND

Interesting object saved for later.

### BOUGHT

User purchased it.

### LISTED

Currently for sale.

### SOLD

Successfully sold.

### PASSED

Opportunity rejected.

Each object should preserve:

- original asking price
- user's purchase price
- STYMA estimate at time of discovery
- confidence
- verdict
- max buy price
- eventual sale price
- eventual profit
- time to sell

This creates a much more valuable personal history.

---

# 25. MARKET SESSION

This is an important future-facing feature and should be considered in the architecture now.

A user should eventually be able to start:

# NEW MARKET SESSION

Then scan multiple objects.

Example:

> 12 objects scanned  
> 4 BUY  
> 3 NEGOTIATE  
> 5 PASS

If purchases are recorded:

> Spent: €74  
> Estimated resale: €310–420  
> Potential profit: €180–260

And:

### BEST FIND

Object X  
Deal Score: 91

This turns STYMA from a single-object scanner into an actual flea-market companion.

Do NOT overbuild this in the first implementation phase, but make the architecture compatible with it.

---

# 26. MULTI-OBJECT SCANNING

Consider support for photographing a table / group of objects.

The system could identify:

- object 1
- object 2
- object 3
- object 4

Then allow:

> Investigate object

This is particularly useful for flea markets and estate sales.

Treat as P1/P2 unless the existing recognition architecture makes this trivial.

---

# 27. LONG-TERM MOAT

Do not build this immediately, but design the data model with this future in mind.

STYMA can eventually learn from actual user outcomes:

- what users considered buying
- asking price
- STYMA estimated value
- actual purchase price
- actual sale price
- days to sell
- profit
- category
- condition
- marketplace
- market location

This could eventually become proprietary resale intelligence.

The system should therefore avoid designing a database that stores only:

> object + generated description

Instead, think:

> object + evidence + decision + transaction outcome

---

# 28. FEATURE PRIORITY

Do not implement everything at once.

Use this priority framework.

## P0 — CORE PRODUCT DIFFERENTIATION

These are required for the new STYMA concept.

1. Asking price input
2. BUY / NEGOTIATE / PASS
3. Maximum buy price
4. Market value range
5. Identification confidence
6. Evidence / “Why this match?”
7. Comparable breakdown
8. Asking vs sold distinction
9. Before You Buy checklist
10. Risk flags
11. Profit estimate
12. Better photo guidance

---

## P1 — MAJOR PRODUCT DEPTH

13. Authenticity analysis
14. Maker mark analysis
15. Liquidity
16. Demand
17. Deal Score
18. Auction data
19. Second Look / Investigation mode
20. Negotiation mode
21. My Finds lifecycle
22. Marketplace-specific selling
23. Market Session
24. Multi-object scanning

---

## P2 — LONG-TERM DIFFERENTIATION

25. Expert escalation
26. Scout
27. Saved buying criteria
28. Market alerts
29. Price trends
30. Personal reseller analytics
31. Personal category performance
32. Community/shared finds
33. Local market intelligence
34. Personal resale dataset

Do NOT implement P1/P2 before the P0 flow is coherent.

---

# 29. UX PRINCIPLES

STYMA is primarily used:

- outdoors
- at flea markets
- standing
- on a phone
- with one hand
- quickly
- sometimes with poor network
- with limited attention

Therefore:

## FAST FIRST

The first useful decision should happen quickly.

## PROGRESSIVE DISCLOSURE

Do not show the entire investigation at once.

First:

> WHAT IS IT?

Then:

> SHOULD I BUY IT?

Then:

> WHY?

Then deeper evidence.

## NO DASHBOARD FEEL

Avoid turning STYMA into a generic SaaS dashboard.

Avoid:

- excessive cards
- excessive rounded containers
- huge grids of metrics
- meaningless badges
- “AI magic” UI
- gradients everywhere
- fintech aesthetics
- crypto aesthetics
- glassmorphism
- excessive animations

---

# 30. VISUAL / BRAND DIRECTION

The visual identity should evolve toward:

**EDITORIAL + ARCHIVAL + FIELD TOOL + MARKET INTELLIGENCE**

It should feel like:

- a sophisticated research notebook
- an object archive
- a professional reseller tool
- a field guide
- a market intelligence interface

Not:

> generic AI SaaS

The design should retain STYMA's existing identity where appropriate, but significantly increase sophistication.

Use strong typography, hierarchy, whitespace and editorial composition.

Information should feel curated.

The interface should communicate:

> “We investigated this.”

not:

> “Our model generated this.”

---

# 31. CORE RESULT PAGE

The ideal result page should approximately follow:

## HEADER

Object name

Confidence

Category / maker / era

---

## DECISION

### SHOULD I BUY IT?

Asking price

Market range

Maximum buy price

BUY / NEGOTIATE / PASS

Deal Score

---

## WHY

Short explanation.

Key evidence.

Risk factors.

---

## MARKET

Current asking

Sold

Auction

Strong comparables

---

## VALUE

Conservative

Realistic

Optimistic

Confidence

---

## FLIP

Expected resale

Fees

Shipping

Profit

ROI

Liquidity

---

## BEFORE YOU BUY

Checklist

---

## AUTHENTICITY

Signals

Red flags

What to verify

---

## STORY

Historical context

---

## INVESTIGATE

Check mark

More comps

Authenticity

Condition

History

---

## SELL

Listing generator

---

# 32. DATA QUALITY RULES

This is critical.

STYMA must never manufacture confidence.

Every important piece of information should internally be understood as one of:

### FACT

Directly supported by source/evidence.

### ESTIMATE

Calculated from available evidence.

### INFERENCE

Reasonable interpretation but not directly confirmed.

### UNKNOWN

Insufficient evidence.

The UI should communicate uncertainty naturally.

Never invent:

- sold prices
- market demand
- authenticity
- historical facts
- maker attribution
- liquidity
- transaction outcomes

If evidence is insufficient, say so.

This is a core product principle.

---

# 33. TECHNICAL APPROACH

Before coding:

## STEP 1 — AUDIT

Inspect the entire existing application.

Produce:

- current routes
- components
- data flow
- API routes
- server actions
- database tables
- Supabase usage
- authentication
- storage
- recognition pipeline
- search pipeline
- valuation pipeline
- inventory model
- listing generation
- current design system

---

## STEP 2 — MAP CURRENT → FUTURE

Create a table:

| Current | Future | Action |
|---|---|---|
| Identify | Identify + confidence | Extend |
| Value | Market range | Refactor |
| Save | My Finds | Refactor |
| Inventory | Resale lifecycle | Extend |
| Analysis | Investigation | Extend |
| Photos | Smart evidence capture | Extend |
| Listing | Sell workflow | Keep + improve |

Also explicitly identify:

- things to delete
- things to hide
- things to rename
- things to preserve
- things to refactor

---

# 34. DO NOT CODE IMMEDIATELY

First produce a product/technical implementation plan.

The first response should NOT be a giant code dump.

Return:

## A. PRODUCT AUDIT

What STYMA currently does.

## B. COMPETITIVE GAP ANALYSIS

Where STYMA is behind competitors.

## C. WHAT TO REMOVE / REDUCE

Specific existing UI/features that should disappear or become secondary.

## D. NEW INFORMATION ARCHITECTURE

Routes and user journeys.

## E. P0 FEATURE PLAN

Detailed implementation order.

## F. P1 / P2 BACKLOG

Clearly separated.

## G. DATA MODEL CHANGES

Tables / fields / relationships required.

## H. API / SERVICE CHANGES

Existing endpoints to extend and new ones required.

## I. COMPONENT ARCHITECTURE

What components should be created or refactored.

## J. UX FLOW

Describe the new journey screen by screen.

## K. RISKS / UNKNOWNs

Identify what cannot yet be implemented reliably because of missing data sources or existing architectural constraints.

---

# 35. IMPLEMENTATION PHASES

After the audit, propose implementation phases.

Recommended structure:

### PHASE 0
Audit + architecture

### PHASE 1
Decision Engine MVP

- asking price
- verdict
- max buy price
- market range
- confidence
- evidence
- risk
- comparables

### PHASE 2
Resale economics

- profit
- fees
- shipping
- ROI
- liquidity

### PHASE 3
Investigation

- authenticity
- marks
- second look
- deeper comparables
- photo requests

### PHASE 4
My Finds

- Found
- Bought
- Listed
- Sold
- Passed

### PHASE 5
Field workflow

- market session
- multi-object scan
- negotiation mode

### PHASE 6
Advanced intelligence

- Scout
- alerts
- personal analytics
- expert escalation

---

# 36. IMPORTANT IMPLEMENTATION RULE

Do not make a huge rewrite.

Prefer:

**small, verifiable increments**

For every phase:

1. explain what will change
2. identify affected files
3. implement
4. test
5. verify
6. stop at a logical checkpoint

Do not modify unrelated systems.

Do not change backend logic unless required.

Do not replace existing integrations without evidence that the current implementation is inadequate.

---

# 37. DESIGN SYSTEM

Before implementing major UI changes, inspect the current design system.

Define or refine:

- typography
- spacing
- colors
- borders
- radius
- shadows
- buttons
- badges
- status indicators
- data blocks
- evidence blocks
- price displays
- confidence indicators
- verdict indicators

The new UI should feel coherent.

Do not introduce random component styles page by page.

---

# 38. RESPONSIVE PRIORITY

Mobile is primary.

Desktop is secondary.

The mobile result page should be usable with one hand.

The most important information should appear without excessive scrolling:

1. object
2. asking price
3. market value
4. max buy
5. verdict

Everything else can progressively expand.

---

# 39. COPY RULES

STYMA copy should be:

- concise
- confident but honest
- editorial
- intelligent
- practical
- slightly irreverent where appropriate

Never:

- hype
- fake certainty
- technical jargon
- generic AI language
- “magic”
- “revolutionary”
- meaningless startup copy

Prefer:

> “Seller asks €18. We'd pay up to €27.”

over:

> “Our advanced technology estimates this object has excellent investment potential.”

---

# 40. FINAL PRODUCT TEST

Before declaring the redesign complete, simulate this real-world scenario:

A user is at a flea market.

They see an object for €12.

They take 3–4 photos.

STYMA should help answer:

1. What is it?
2. How confident are we?
3. What evidence supports that?
4. Is it authentic?
5. What is the realistic resale range?
6. What have similar objects actually sold for?
7. Is €12 a good price?
8. What is the maximum I should pay?
9. Should I buy, negotiate or pass?
10. What should I check before handing over the money?
11. If I buy it, how much could I realistically make?
12. How do I sell it later?

If STYMA cannot answer these questions, the product is still incomplete.

---

# 41. MOST IMPORTANT PRODUCT PRINCIPLE

Do not optimize STYMA for:

> “Wow, it identified the object.”

Optimize it for:

> **“I knew whether to buy it before I walked away from the stall.”**

That is the product.

The recognition, market research, valuation, authenticity analysis, history and listing generation all exist to support that decision.

---

# YOUR TASK NOW

Do NOT immediately start rewriting the application.

First inspect the existing repository and produce the complete:

**STYMA PRODUCT EVOLUTION PLAN**

including:

1. Current architecture audit
2. Current UX audit
3. Competitive gap analysis
4. Features to remove/reduce
5. Features to add
6. New information architecture
7. P0/P1/P2 prioritization
8. Data model changes
9. API/service changes
10. Component changes
11. Screen-by-screen UX
12. Design system changes
13. Implementation phases
14. Risks and unknowns
15. Recommended first coding task

At the end, give a very explicit:

# FIRST IMPLEMENTATION STEP

with:

- exact files to touch
- exact feature to implement
- why this is the correct first step
- what must NOT be touched
- acceptance criteria
- test plan

Only after this plan is reviewed should implementation begin.

Remember:

**Do not turn STYMA into a bigger app.**

Turn it into a **better decision engine**.