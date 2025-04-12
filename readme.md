# 🗳️ Afstemninger Embedding Project

This project fetches Danish parliamentary voting data (_afstemninger_) from the [Folketinget API](https://oda.ft.dk), generates semantic vector embeddings using OpenAI, and stores them in Supabase with `pgvector` to support semantic search.

---

## 🚀 Features

- Fetches _afstemninger_ (votes) with metadata
- Embeds:
  - `titel` (title)
  - `titelkort` (short title)
  - `resume` (summary)
- Stores data + embedding in Supabase
- Enables semantic search for topics like "palæstina" or "udlændingepolitik"

---

---

## Setup

### 1. Clone the repo

```bash
git clone https://github.com/your-username/afstemninger-embedding.git
cd afstemninger-embedding
```

### 2. Install dependencies

```bash
npm install
```

### Create env file

```bash
touch .env
```

Insert your api keys:

OPENAI_API_KEY=your-openai-api-key
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key

### Run main script

```bash
node index.js
```
