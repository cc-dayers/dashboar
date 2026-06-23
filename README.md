# Show Me

A lightweight, zero-cost report viewer hosted on Vercel. Pass an `id` in the URL — it fetches the corresponding JSON blob from Azure Storage and renders it as a clean dashboard.

```
https://your-app.vercel.app?id=my-report-id
```

---

## Local development

```bash
cp .env.example .env.local   # fill in AZURE_BLOB_BASE_URL
npm install
npm run dev                   # starts Vite + API server together
```

Open `http://localhost:5173?id=example` — the `fixtures/example.json` file works as a reference payload once uploaded to your blob container.

---

## Deploying to Vercel

```bash
vercel deploy
```

Set `AZURE_BLOB_BASE_URL` as an environment variable in the Vercel project settings. The `/api/get-blob` function runs server-side so the storage URL is never exposed to the browser.

---

## JSON payload format

Every blob is a JSON file named `{id}.json` stored in your Azure container. The full schema is in [`report.schema.json`](./report.schema.json). Here is a field-by-field reference:

### Top level

| Field | Type | Required | Rendered as |
|---|---|---|---|
| `title` | string | no | Header — main heading |
| `subtitle` | string | no | Header — secondary line |
| `generatedAt` | ISO 8601 string | no | Header — timestamp |
| `status` | [Status](#status-values) | no | Header — coloured badge |
| `metadata` | `{ [key: string]: string \| number \| boolean }` | no | Key-value table in the content area (when no category is selected) |
| `categories` | Category[] | no | Sidebar nav + card grids |

If `categories` is absent the dashboard shows `metadata` and any remaining top-level keys as a raw JSON view — useful for quick data dumps that don't need a structured layout.

### Category

| Field | Type | Required | Rendered as |
|---|---|---|---|
| `id` | string | **yes** | Internal key for sidebar selection |
| `name` | string | **yes** | Sidebar label |
| `status` | [Status](#status-values) | no | Coloured dot in the sidebar |
| `items` | Item[] | no | Card grid in the content area |

### Item

| Field | Type | Required | Rendered as |
|---|---|---|---|
| `id` | string | **yes** | Internal key |
| `label` | string | **yes** | Card heading |
| `value` | string \| number \| boolean | no | Monospace value below the label |
| `status` | [Status](#status-values) | no | Coloured badge on the card |
| `details` | string | no | Explanatory sentence(s) below the value |
| `timestamp` | ISO 8601 string | no | Small timestamp at the bottom of the card |
| `tags` | string[] | no | Pill labels at the bottom of the card |

### Status values

| Value | Colour |
|---|---|
| `success` | Green |
| `warning` | Amber |
| `error` | Red |
| `info` | Blue |
| `neutral` | Grey |

A complete working example is in [`fixtures/example.json`](./fixtures/example.json).

---

## Using an AI agent to transform arbitrary JSON

The schema is designed to be consumed by an LLM. Give an agent the schema plus the source data and ask it to produce a conforming payload.

### Prompt template

Paste this as a system prompt (or the first user message) when calling an AI API, then provide the raw source data as the next message:

```
You are a data transformer. Convert the JSON I provide into the Show Me report format.

Show Me renders JSON as a dashboard:
- A header shows title, subtitle, status badge, and generatedAt.
- A sidebar lists categories (each with a coloured status dot and item count).
- The main area shows items for the selected category as cards.

Schema rules:
1. Map logical groupings in the source data to categories. Use kebab-case ids.
2. Map individual data points, metrics, or log entries to items within categories.
3. Choose status (success / warning / error / info / neutral) based on semantic meaning:
   - success  → passing, healthy, completed, ok
   - warning  → degraded, approaching limit, needs attention
   - error    → failing, crashed, exceeded threshold
   - info     → informational, pending, scheduled
   - neutral  → unknown, not applicable, no data
4. Derive category status from the worst item status within it.
5. Derive top-level status from the worst category status.
6. Put identifying or summary fields (environment, version, region, etc.) in metadata.
7. item.value should be the primary metric — keep it short (a number, percentage, state string).
8. item.details should provide 1-2 sentences of context for a human reader.
9. Use ISO 8601 (e.g. "2026-06-19T08:00:00Z") for all timestamps.
10. Every id must be unique within its scope. Use kebab-case.

The full JSON Schema is:

<SCHEMA>
PASTE THE CONTENTS OF report.schema.json HERE
</SCHEMA>

Return only a single valid JSON object. No markdown fences, no explanation.
```

### Calling Claude via API (example)

```typescript
import Anthropic from '@anthropic-ai/sdk'
import schema from './report.schema.json'

const client = new Anthropic()

const message = await client.messages.create({
  model: 'claude-sonnet-4-6',
  max_tokens: 4096,
  system: `You are a data transformer. Convert JSON into the Show Me report format.
Follow these rules: ...  (paste rules above)
Schema: ${JSON.stringify(schema, null, 2)}`,
  messages: [
    {
      role: 'user',
      content: `Transform this data:\n\n${JSON.stringify(sourceData, null, 2)}`,
    },
  ],
})

const reportJson = JSON.parse((message.content[0] as { text: string }).text)
```

### Using structured output (recommended for reliability)

If the API supports JSON Schema–constrained output, pass `report.schema.json` directly as the response schema. This guarantees the model can't return malformed JSON.

With the Anthropic API this looks like defining a tool whose `input_schema` is the report schema, and asking the model to call it with the transformed data.
