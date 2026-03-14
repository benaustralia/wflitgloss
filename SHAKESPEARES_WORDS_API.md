# ShakespearesWords.com — API Research Notes

> Research conducted: 2026-03-14
> Purpose: Answering Ben Crystal's questions about the shakespeareswords.com API

---

## Summary

ShakespearesWords.com does **not** publish an official/documented public API. However, it exposes a working AJAX endpoint used by its own web interface that can be queried programmatically.

---

## The AJAX Endpoint

**URL:** `POST https://www.shakespeareswords.com/ajax/AjaxResponder.aspx`

**Request format (JSON body):**
```json
{ "commandName": "cmd_name_here", "parameters": "search string or data" }
```

**Response format (JSON):**
```json
{ "commandName": "cmd_name_here", "parameters": "[...JSON-encoded string...]" }
```

> Note: The `parameters` field in the response is a JSON-encoded *string* — you must `JSON.parse()` it a second time.

The server sets `access-control-allow-origin: *` so cross-origin requests work from the browser.

---

## Discovered Commands

### 1. `cmd_autocomplete` — Glossary word lookup

**Best for:** Looking up a Shakespearean word and getting its modern definition(s) + glossary ID.

**Request:**
```bash
curl -X POST https://www.shakespeareswords.com/ajax/AjaxResponder.aspx \
  -H "Content-Type: application/json" \
  -d '{"commandName":"cmd_autocomplete","parameters":"love"}'
```

**Response (parameters, after parsing):**
```json
[
  { "Headword": "love", "Definition": "mistress, lover, paramour", "Id": 19537 },
  { "Headword": "love", "Definition": "for love's sake", "Id": 19504 },
  { "Headword": "love", "Definition": "be friend to, be attractive to", "Id": 19680 },
  { "Headword": "love in idleness", "Definition": "pansy", "Id": 21562 },
  { "Headword": "love-book", "Definition": "book dealing with matters of love, courtship manual", "Id": 19547 }
]
```

- Returns up to ~10 matches including compound words (`love-book`, `love in idleness`, etc.)
- Each entry has: `Headword` (with grammatical part of speech), `Definition`, `Id`
- The `Id` links to the full glossary entry: `https://www.shakespeareswords.com/Public/Glossary.aspx?Id=<Id>`
- **Works on free tier** — no login required

**Example — "hark":**
```json
[{ "Headword": "hark", "Definition": "listen", "Id": 21110 }]
```

**Example — "wherefore":**
```json
[{ "Headword": "wherefore (adv.)", "Definition": "why", "Id": 21519 }]
```

---

### 2. `cmd_fulltextautocomplete` — Full-text search (plays & poems)

**Best for:** Finding specific lines/quotations in Shakespeare's works.

**Request:**
```bash
curl -X POST https://www.shakespeareswords.com/ajax/AjaxResponder.aspx \
  -H "Content-Type: application/json" \
  -d '{"commandName":"cmd_fulltextautocomplete","parameters":"wherefore art|false"}'
```

> Parameters format: `"search string|wholeWordSearch"` (true/false)

**Response (parameters, after parsing):**
```json
[
  {
    "Text": "but <span class='txtSelection'>wherefore art</span> not in thy shop today?",
    "KeyLine": "JC I.i.27",
    "Origin": "PlayOrPoem",
    "IdContent": "179151",
    "Name": "Julius Caesar",
    "WorkId": "19",
    "Act": "1",
    "Scene": "1"
  },
  {
    "Text": "o romeo, romeo! – <span class='txtSelection'>wherefore art</span> thou romeo?",
    "KeyLine": "RJ II.ii.33",
    "Origin": "PlayOrPoem",
    "IdContent": "229331",
    "Name": "Romeo and Juliet",
    "WorkId": "32",
    "Act": "2",
    "Scene": "2"
  }
]
```

- Returns up to 10 results
- `KeyLine` = the standard citation format (play abbreviation, Act, Scene, Line)
- `Text` includes HTML `<span>` tags around the matched phrase
- Results come from both plays (WorkId < 50) and poems (WorkId ≥ 50)
- Link to play: `https://www.shakespeareswords.com/Public/Play.aspx?WorkId=<WorkId>&Act=<Act>&Scene=<Scene>#<IdContent>`
- **Works on free tier**

---

### 3. `cmd_fulltextautocompletemenu` — Full-text search (nav menu variant)

Same as `cmd_fulltextautocomplete` but also returns glossary matches mixed in.

**Request:**
```bash
curl -X POST https://www.shakespeareswords.com/ajax/AjaxResponder.aspx \
  -H "Content-Type: application/json" \
  -d '{"commandName":"cmd_fulltextautocompletemenu","parameters":"love|false"}'
```

**Response** includes items with `"Origin": "glossary"` or `"Origin": "PlayOrPoem"`.

For glossary items: `{ "Text": "love", "Origin": "glossary", "IdContent": "19537" }`
For play items: same structure as `cmd_fulltextautocomplete`.

---

### 4. `cmd_addspeaker` — Character/speaker lookup

**Best for:** Finding character names across plays.

**Request:**
```bash
curl -X POST https://www.shakespeareswords.com/Ajax/AjaxResponder.aspx \
  -H "Content-Type: application/json" \
  -d '{"commandName":"cmd_addspeaker","parameters":"Hamlet","onWorks":"2"}'
```

**Response:**
```json
[{ "speakerName": "HAMLET", "play": "Hamlet", "speakerID": "704388" }]
```

---

## Full Glossary Entries (Paywalled)

The full glossary entry page (`Glossary.aspx?Id=X`) shows:
- The headword (e.g., `love (n.)`)
- Old forms (e.g., `Loue`)
- Definition (e.g., `mistress, lover, paramour`)
- Citations from plays — **but these are hidden behind a subscription** for most entries

Free tier shows: headword + one definition.
Paid tier shows: all definitions, all play citations with line references.

---

## Works Reference (WorkId)

| WorkId | Play |
|--------|------|
| 1 | The Comedy of Errors |
| 2 | Hamlet |
| 3 | Coriolanus |
| 4 | A Midsummer Night's Dream |
| 5 | The Two Gentlemen of Verona |
| 6 | Richard III |
| 7 | Cymbeline |
| 8 | Antony and Cleopatra |
| 9 | Othello |
| 10 | Troilus and Cressida |
| 19 | Julius Caesar |
| 21 | Twelfth Night |
| 32 | Romeo and Juliet |
| 53 | Sonnets (poems) |

---

## Practical Use for This App

The most useful endpoint for Shake-o-Lingo would be **`cmd_autocomplete`** as a source of Shakespeare-specific definitions:

```js
async function getShakespeareanDefinition(word) {
  const response = await fetch(
    'https://www.shakespeareswords.com/ajax/AjaxResponder.aspx',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        commandName: 'cmd_autocomplete',
        parameters: word.toLowerCase()
      })
    }
  );
  const data = await response.json();
  return JSON.parse(data.parameters); // array of { Headword, Definition, Id }
}
```

**Caveats:**
- No official API key required (free to query, no rate limit documented)
- No terms of service explicitly permitting programmatic use — best to use sparingly
- Returns max ~10 results per query
- Definitions are brief (1 short phrase), not full dictionary entries
- Full citation data requires a paid subscription
