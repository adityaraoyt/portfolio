# RAG Chatbot Setup

This guide walks through deploying the portfolio RAG chatbot (Cloudflare Worker + Supabase + Gemini).

## Prerequisites

- [Supabase](https://supabase.com) free account
- [Google AI Studio](https://aistudio.google.com) Gemini API key
- [Cloudflare](https://cloudflare.com) free account with Wrangler CLI
- GitHub repo secrets access

## 1. Supabase

1. Create a new Supabase project.
2. Open **SQL Editor** and run the migration in `[supabase/migrations/001_documents.sql](supabase/migrations/001_documents.sql)`.
3. Copy from **Project Settings → API**:
  - Project URL → `SUPABASE_URL`
  - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (keep secret)



## 2. Gemini API key

1. Go to [Google AI Studio](https://aistudio.google.com/apikey).
2. Create an API key → save as `GEMINI_API_KEY`.



## 3. Index the knowledge base



### Option A: GitHub Actions (recommended)

Add these repository secrets under **Settings → Secrets and variables → Actions**:


| Secret                      | Value                       |
| --------------------------- | --------------------------- |
| `GEMINI_API_KEY`            | Your Gemini API key         |
| `SUPABASE_URL`              | `https://xxxxx.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key   |


Then run the **Index knowledge base** workflow manually from the Actions tab, or push a change to `knowledge/`.

### Option B: Run locally

```bash
pip install -r scripts/requirements.txt

export GEMINI_API_KEY="your-key"
export SUPABASE_URL="https://xxxxx.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"

python scripts/index_knowledge.py
```



## 4. Deploy the Cloudflare Worker

```bash
cd worker
npm install

# Set secrets (one-time)
npx wrangler secret put GEMINI_API_KEY
npx wrangler secret put SUPABASE_URL
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY

# Deploy
npm run deploy
```

After deploy, note your Worker URL (e.g. `https://portfolio-chat.your-name.workers.dev`).

### Configure CORS

Edit `[worker/wrangler.toml](worker/wrangler.toml)` and add your GitHub Pages URL to `ALLOWED_ORIGINS`:

```toml
ALLOWED_ORIGINS = "https://yourusername.github.io,http://127.0.0.1:5500,http://localhost:8787"
```

Redeploy after updating:

```bash
npm run deploy
```



## 5. Connect the frontend widget

In `[index.html](index.html)`, update the chat script tag with your Worker URL:

```html
<script src="chat.js" data-api-url="https://portfolio-chat.your-name.workers.dev/chat"></script>
```

Push to `master` to deploy the site via GitHub Pages.

## 6. Test locally



### Worker

```bash
cd worker
npx wrangler dev
```



### Frontend

Serve the site locally (e.g. Live Server on port 5500) and ensure `ALLOWED_ORIGINS` in `wrangler.toml` includes your local URL.

### Test questions

- "What has Aditya built with RAG?"
- "What is his email?"
- "Tell me about his education"
- "What is the weather in Tokyo?" → should say it doesn't know



## Troubleshooting


| Issue                       | Fix                                                               |
| --------------------------- | ----------------------------------------------------------------- |
| CORS error                  | Add your exact origin to `ALLOWED_ORIGINS` and redeploy Worker    |
| Empty answers               | Re-run the indexer; verify `documents` table has rows in Supabase |
| 429 rate limit              | Wait an hour or lower traffic; default is 20 messages/hour/IP     |
| Chat not configured message | Set `data-api-url` on the `<script>` tag in `index.html`          |




## Architecture

```
Browser widget → Cloudflare Worker → Gemini (embed + chat)
                                   → Supabase pgvector (retrieve)
GitHub Action  → index_knowledge.py → Supabase (index)
```



## Updating content

Edit files in `[knowledge/](knowledge/)` then either:

- Push to `master` (triggers auto-index if `knowledge/**` changed), or
- Run `python scripts/index_knowledge.py` manually

