# Import and Export

Two things can be exported and imported, separately: your **saved sites** (the keep lists) and your **settings**. Both are plain JSON files, all the buttons live on the **Import / Export** page in the sidebar, and exported filenames get a timestamp appended so repeated backups don't overwrite each other. Resetting the settings to their defaults lives there too.

## Expressions

**Export saved sites** downloads every list as one JSON file. **Import saved sites** reads such a file and adds its expressions to your current lists — importing never deletes what you already have, and exact duplicates are skipped.

The file is a JSON object with one key per cookie store (usually just `default`), each holding an array of expressions:

```json
{
  "default": [
    {
      "expression": "*.example.com",
      "listType": "WHITE",
      "storeId": "default",
      "cleanSiteData": ["Cache", "LocalStorage"],
      "cookieNames": ["session_id"],
      "cleanAllCookies": false
    },
    {
      "expression": "news.site",
      "listType": "GREY",
      "storeId": "default"
    }
  ]
}
```

Field by field:

| Field             | Required | Meaning                                                                                                                                      |
| ----------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `expression`      | yes      | the pattern, exactly as you'd type it (see [Expressions and Lists](./expressions.md))                                                        |
| `listType`        | yes      | `"WHITE"` (a permanent **Keep** rule) or `"GREY"` (**Keep this session**)                                                                    |
| `storeId`         | yes      | which cookie store the expression belongs to — `"default"` for normal browsing, `"private"` for incognito                                    |
| `cleanSiteData`   | no       | array of site-data types this expression still cleans: any of `"Cache"`, `"IndexedDB"`, `"LocalStorage"`, `"PluginData"`, `"ServiceWorkers"` |
| `cookieNames`     | no       | cookie names to keep when `cleanAllCookies` is `false`                                                                                       |
| `cleanAllCookies` | no       | omit or `true` to keep every cookie; `false` to keep only the ones in `cookieNames`                                                          |

Invalid entries are rejected with a reason shown per entry (bad regex, empty expression, stray spaces), and everything valid in the same file still imports. This also makes hand-writing a list in a text editor perfectly workable: start from an export, edit, re-import.

### Importing from the original Cookie AutoDelete

Exports from the original Cookie AutoDelete extension import cleanly — the file format is the same. Firefox-era exports may contain extra keys for container tabs (`firefox-container-1` and so on), a Firefox feature that doesn't exist in Chromium browsers. Those entries would never match anything here, so the importer merges them into your default list instead, skips any whose pattern is already on it, and tells you how many were merged.

## Settings

**Export settings...** / **Import settings...** work the same way for the settings themselves. The import validates every entry and aborts with an error if the file contains a setting this version doesn't know — a guard against typos and stale files rather than a merge tool.

## What backups are for

Two situations make these files worth keeping around:

- **Moving browsers or machines.** Export both files, import them on the other side, done.
- **Before big experiments.** About to reorganize your lists or reset the extension? Export first; importing the file restores your expressions in one click.
