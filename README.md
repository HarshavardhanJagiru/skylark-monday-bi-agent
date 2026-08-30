# Skylark Drones — Monday.com Business Intelligence Conversational Agent

A production-quality conversational Business Intelligence (BI) MVP built for Skylark Drones. The agent reads live data dynamically from two Monday.com boards (**Deals** and **Work Orders**) via Monday.com's GraphQL API, normalizes inconsistent/messy values, executes deterministic business calculations in JavaScript, and provides executive-ready natural language insights via Gemini AI.

---

## Overview

Executive teams need quick, reliable answers about revenue, pipeline health, sector bottlenecks, and operational delays without manually exporting spreadsheets or writing SQL queries. This application connects directly to Monday.com, processes messy real-world data, and provides founder-level answers with complete transparency around data quality limitations.

---

## Problem

* **Raw Data Messiness**: Deal records and Work Orders contain inconsistent text formatting, missing close dates, missing probability indicators, mixed currency strings, and unstructured sector names.
* **Math Risks in LLMs**: Generative AI models struggle with reliable arithmetic when calculating total pipeline values, weighted probabilities, or outstanding receivables.
* **Ambiguous Founder Queries**: Executive prompts like *"Show top performance"* can mean sales revenue, deal value, or execution speed, requiring contextual clarification rather than guessing.

---

## Solution

1. **Separation of Math & Language**: Deterministic JS/TS analytics engine handles all numerical aggregations, financial sums, and probability weightings. The LLM is restricted to intent classification, ambiguity detection, and natural-language executive synthesis.
2. **Dynamic Normalization & Audit**: Dynamic cleanup layer canonicalizes sector names (e.g. `energy` → `Energy`), parses dates (ISO, Excel serials, DD/MM/YYYY) to `YYYY-MM-DD`, strips currency formatting without converting nulls into fake zeroes, and tracks data quality caveats.
3. **Monday.com GraphQL Integration**: Direct read-only connection via Monday.com GraphQL API v2 with pagination, in-memory caching, and automated board population scripts.

---

## Architecture

```
                       ┌──────────────────────────────┐
                       │     React + Vite Frontend    │
                       │  (Conversational BI Chat UI) │
                       └──────────────┬───────────────┘
                                      │ HTTP / JSON (POST /api/chat)
                                      ▼
                       ┌──────────────────────────────┐
                       │    Node.js / Express Backend  │
                       └──────────────┬───────────────┘
                                      │
         ┌────────────────────────────┼────────────────────────────┐
         ▼                            ▼                            ▼
┌─────────────────┐       ┌───────────────────────┐      ┌─────────────────┐
│ AI Query Engine │       │   Monday.com Service  │      │  BI & Analytics │
│(Intent Classifier│       │ (GraphQL API Client   │      │   Engine (JS)   │
│ & Gemini LLM)   │       │  with 60s Cache)      │      │(Pipeline, Rev,  │
└────────┬────────┘       └───────────┬───────────┘      │ Cross-Board BI) │
         │                            │                  └────────┬────────┘
         │                            ▼                           │
         │                 ┌────────────────────┐                 │
         │                 │  Monday.com Boards │                 │
         │                 │(Deals & WorkOrders)│                 │
         │                 └────────────────────┘                 │
         │                                                        │
         └────────────────────────────┬───────────────────────────┘
                                      ▼
                       ┌──────────────────────────────┐
                       │ Dynamic Data Normalization   │
                       │  & Quality Caveats Generator │
                       └──────────────────────────────┘
```

---

## Tech Stack

* **Frontend**: React 19, Vite, Lucide Icons, Vanilla CSS (Design System with HSL tokens, dark mode, glassmorphism).
* **Backend**: Node.js (ES Modules), Express.
* **Database / Source of Truth**: Monday.com GraphQL API v2 (`https://api.monday.com/v2`).
* **AI Provider**: Google Gemini API (`gemini-1.5-flash` via `@google/generative-ai`) with deterministic rule-based fallback.
* **Testing**: Vitest (`npm test`).

---

## Monday.com Setup & Data Import

### 1. Obtain Monday.com API Token
1. Log into your [Monday.com](https://monday.com) workspace.
2. Go to **Avatar (Bottom Left) → Administration → API**.
3. Copy your Personal API Token.

### 2. Automated Import Script (`scripts/import_to_monday.js`)
We provide a zero-configuration script that automatically creates the **Deals** and **Work Orders** boards in your Monday.com workspace and populates them using the provided Excel files (`Deal funnel Data.xlsx` and `Work_Order_Tracker Data.xlsx`):

```bash
# 1. Set MONDAY_API_TOKEN in .env
MONDAY_API_TOKEN=your_monday_api_token_here

# 2. Run the automated importer
npm run import-data
```

The script will log the created board IDs:
```
✅ Deals Board Created: 1234567890
✅ Work Orders Board Created: 0987654321
```

Copy these IDs into your `.env` file!

---

## Environment Variables

Copy `.env.example` to `.env`:

```ini
# Monday.com API Configuration
MONDAY_API_TOKEN=your_monday_api_token_here
MONDAY_DEALS_BOARD_ID=1234567890
MONDAY_WORK_ORDERS_BOARD_ID=0987654321

# Google Gemini AI API Key
GEMINI_API_KEY=your_gemini_api_key_here
AI_API_KEY=your_gemini_api_key_here

# Server Port
PORT=3001
```

---

## Local Setup & Running

```bash
# 1. Clone the repository
git clone https://github.com/your-username/skylark-monday-bi-agent.git
cd skylark-monday-bi-agent

# 2. Install dependencies
npm install

# 3. Run automated tests
npm test

# 4. Start full-stack development mode
# Runs Express Backend on http://localhost:3001 and Vite Frontend on http://localhost:5173
npm run server & npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## Deployment Instructions

### Deployment Option 1: Unified Render / Railway Node Server (Recommended)
1. Build the production bundle:
   ```bash
   npm run build
   ```
2. Deploy to **Render** or **Railway** as a Web Service.
3. Build Command: `npm install && npm run build`
4. Start Command: `npm start`
5. Configure Environment Variables (`MONDAY_API_TOKEN`, `MONDAY_DEALS_BOARD_ID`, `MONDAY_WORK_ORDERS_BOARD_ID`, `GEMINI_API_KEY`) in the Render/Railway dashboard.

### Deployment Option 2: Split Vercel (Frontend) + Render (Backend)
* Deploy `server/` to Render Web Service.
* Deploy root directory to Vercel with build command `npm run build` and set `VITE_API_URL` to your Render backend domain.

---

## Supported Queries

1. **Pipeline Queries**: *"How is our pipeline looking this quarter?"*
2. **Sector Performance**: *"Which sector has the highest pipeline value?"*
3. **Financials & Receivables**: *"What is our current receivables position?"*
4. **Operations & Delays**: *"Which projects are delayed?"*
5. **Cross-Board Analysis**: *"Compare sales pipeline and execution by sector."*
6. **Executive Briefing**: *"Prepare a leadership update"* (or click the top **Generate Leadership Update** button).
7. **Ambiguity Test**: *"Show top performance"* (Triggers intent clarification modal).

---

## Data Normalization Rules

* **Text**: Trims trailing spaces. Maps variations like `energy`, `ENERGY`, `Renewable Sector` to canonical titles (`Energy`, `Renewables`). Strips prefixes from deal stages (`A. Lead Generated` → `Lead Generated`).
* **Dates**: Converts ISO strings, DD/MM/YYYY, and Excel timestamp serial numbers into `YYYY-MM-DD`. Returns `null` if invalid.
* **Numbers**: Removes `₹`, `$`, `,`, and whitespace. Converts to floating point. Missing/blank values remain `null` to avoid fake zeroes.

---

## Data Quality Handling

Every query response contains an explicit **Data Quality & Caveats Box**:
* Audits missing close dates, unrecorded deal values, and missing closure probabilities.
* Audits work orders missing execution status or receivables figures.
* Communicates explicit sample limitations (e.g. *"258 deal records are missing closure probability, so weighted pipeline excludes those specific records."*).

---

## AI Approach

* **Zero Math in LLM**: The LLM is used purely for **Query Classification** (extracting intent, sector, time period) and **Executive Natural Language Synthesis**.
* **Deterministic Engine**: Pure JavaScript functions calculate pipeline sums, weighted values ($Value \times Probability$), receivables, and operational completion percentages.
* **Fallback Resilience**: If Gemini API key is not present or hits rate limits, the system seamlessly uses a deterministic rule-based query classifier and executive template generator.

---

## Error Handling

* **Monday.com API Failures**: Caught gracefully with clear diagnostic messages. Falls back dynamically to on-the-fly Excel parsing if credentials are unconfigured.
* **Invalid Input / Ambiguity**: Returns structured clarification options rather than making arbitrary guesses.
* **Secret Protection**: API tokens remain strictly on the backend Node server and are never sent to the browser client.

---

## Assumptions & Trade-offs

* **Primary Matching Key**: `Deal Name` in Deals board matches `Deal name masked` in Work Orders.
* **Weighted Pipeline Calculation**: Excludes records missing probability rather than inventing $0\%$ or $100\%$.
* **Trade-off**: Chose a single unified Node/Express + Vite architecture to simplify deployment and allow evaluation with a single command.

---

## AI Tools Used

* **Gemini 1.5 Flash**: Intent classification & executive response synthesis.
* **Antigravity AI Agent**: Code generation, architecture design, unit testing, and documentation.

---

## Limitations & Future Improvements

* **Current Limitations**: Cross-board matching relies on exact string match between Deal Name and WO Deal Name.
* **Future Roadmap**: Implement fuzzy string matching (Levenshtein distance) for deal names, add automated webhooks for real-time Monday.com change notifications, and support multi-currency conversion.
