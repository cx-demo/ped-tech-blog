---
title: Demo catalog user guide
description: Browse, search, export, and import demos in the Stacked demo catalog.
author: Stacked maintainers
ms.date: 2026-10-09
ms.topic: how-to
keywords:
  - demo catalog
  - import
  - export
  - archive
---

## What the catalog does

The Stacked demo catalog collects ready-to-run technology demos in one searchable place. Each demo is a small, self-contained project: a README, the files you need to run it, and a manifest that gives it a title, a description, and search tags.

You can:

* Find demos by keyword or tag.
* Read a demo's instructions and download individual files.
* Export any demo as a single `.zip` archive and run it anywhere.
* Import a `.zip` archive to add your own demo to the catalog.

## Find a demo

Open the catalog home page. Every demo appears as a card with its title, description, tags, last-updated date, and file count.

* Type in the search box to filter demos. Press Ctrl+K (Cmd+K on macOS) to jump to it. Search matches the title, description, tags, and author. When you type several words, a demo must match all of them.
* Select a tag on a card or in the "Browse by tag" panel to show only demos with that tag. Select it again, or the × next to the result count, to clear the filter.
* Use "Sort by" to order demos by most recently updated or alphabetically by title.

You can share a filtered view with a link such as `/?tag=CSS#catalog`.

## View a demo

Select a demo's title to open its page at `/catalog/<demo-id>/`. The page shows:

* The title, description, author, last-updated date, total size, and tags.
* The demo's README, which explains what the demo shows and how to run it.
* A "Files in this demo" list. Select the download icon next to a file to save it.

Files always download to your computer. The catalog never runs a demo's HTML or scripts inside the site, which keeps the catalog safe even when demos come from many people.

## Export a demo

Select "Export" on a card, or "Export demo (.zip)" on a demo page. Your browser downloads `<demo-id>.zip`.

The archive contains everything you need:

```text
<demo-id>.zip
├── demo.json        manifest: id, title, description, search tags
├── README.md        instructions shown on the demo page
└── ...              every other file in the demo, in its original folders
```

Extract the archive and follow the README to run the demo. You can also import the same archive into another Stacked catalog.

## Import a demo

Select "Import demo" in the header (or "Import a demo" in the sidebar). If you do not see the button, the server administrator has disabled imports.

1. Choose a `.zip` archive.
2. Leave "Replace an existing demo with the same ID" cleared unless you intend to update a demo you imported earlier.
3. If the catalog asks for a publishing key, enter the key the catalog owner gave you.
4. Select "Import demo".

After a successful import, the catalog opens the new demo's page and the demo appears in search results for everyone.

### Prepare an archive

The fastest way to create a valid archive is to export an existing demo, change its files, and import it again with a new `id`.

To build one from scratch:

1. Create a folder for your demo and add your files.
2. Add a `README.md` that explains what the demo does and how to run it.
3. Add a `demo.json` manifest at the top of the folder:

   ```json
   {
     "schemaVersion": 1,
     "id": "my-first-demo",
     "title": "My first demo",
     "description": "One or two sentences that tell people what they will learn.",
     "tags": ["JavaScript", "Beginner"],
     "author": "Your name",
     "updated": "2026-10-09"
   }
   ```

4. Compress the folder as a `.zip` file. On Windows, right-click the folder and choose "Compress to ZIP file". On macOS, right-click the folder and choose "Compress". You can zip the folder itself or only its contents; both layouts work.

### Manifest fields

| Field           | Required | Rules                                                                                                 |
|-----------------|----------|-------------------------------------------------------------------------------------------------------|
| `title`         | Yes      | 1 to 120 characters.                                                                                  |
| `description`   | Yes      | 1 to 500 characters. Shown on cards and used for search.                                              |
| `tags`          | Yes      | 1 to 10 search tags, each up to 30 characters. Duplicates that differ only by case are removed.       |
| `id`            | No       | Lower-case letters, numbers, and single hyphens, up to 64 characters. Becomes the demo's web address. |
| `author`        | No       | Up to 80 characters.                                                                                  |
| `updated`       | No       | A date in `YYYY-MM-DD` format. Defaults to the newest file date.                                      |
| `readme`        | No       | Path of the Markdown file shown on the demo page. Defaults to `README.md`.                            |
| `schemaVersion` | No       | Must be `1` when present.                                                                             |

Other fields are allowed and kept as-is, so tools can add their own metadata.

When `id` is missing, the catalog uses the name of the folder you zipped (if it is a valid ID) or a version of the title, such as `my-first-demo` for "My first demo".

### Archive limits

* The archive can be up to 25 MB.
* It can contain up to 200 files.
* Each file can be up to 10 MB once extracted, and all files together up to 50 MB.
* File paths can be up to 200 characters and 10 folders deep.
* Archives must use standard ZIP compression. Password-protected, split, and ZIP64 archives are not supported.
* System files and folders such as `__MACOSX/`, `.git/`, `node_modules/`, `.DS_Store`, and `Thumbs.db` are ignored.

### Replace a demo

To update a demo you imported earlier, import an archive with the same `id` and select "Replace an existing demo with the same ID". The previous version is swapped out in one step; if the import fails, the previous version stays in place.

Built-in demos that ship with the catalog cannot be replaced when the server keeps them separate from imported demos. To customize one, export it, change the `id` in `demo.json`, and import it as a new demo.

## Fix import errors

| Message                                                           | What to do                                                                                        |
|-------------------------------------------------------------------|---------------------------------------------------------------------------------------------------|
| Choose a .zip archive to import. / Upload a .zip archive.         | Select a file that ends in `.zip`.                                                                |
| The file is not a valid ZIP archive.                              | Re-create the archive with your operating system's built-in "Compress" command.                   |
| No demo.json manifest was found at the top of the archive.        | Put `demo.json` at the top of the archive, or zip a single folder that contains it.               |
| demo.json is not valid JSON.                                      | Check for missing quotes, commas, or brackets.                                                    |
| demo.json is invalid: ...                                         | The message lists each field to fix. Compare with the manifest fields table above.                |
| A demo with the ID "..." already exists.                          | Select "Replace an existing demo with the same ID", or change the `id` in `demo.json`.            |
| "..." is a built-in demo and cannot be replaced.                  | Change the `id` in `demo.json` to import your version as a new demo.                              |
| The archive contains an unsafe file path.                         | Remove files whose names start with `/`, contain `..`, or include a drive letter.                 |
| The archive is larger than the 25 MB import limit.                | Remove large files, such as videos or `node_modules`, and link to them from the README instead.   |
| ... is larger than the 10 MB per-file limit.                      | Shrink or remove that file.                                                                       |
| Encrypted or password-protected ZIP archives are not supported.   | Create the archive without a password.                                                            |
| A valid publishing key is required.                               | Ask the catalog owner for the current publishing key.                                             |
| Importing is disabled because the demo directory is not writable. | Contact the catalog administrator.                                                                |
| The catalog storage limit has been reached.                       | Contact the catalog administrator to remove unused demos.                                         |

## Privacy and preferences

The catalog stores your light or dark theme choice in your browser. It does not track what you search for or download.
