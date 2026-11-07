# Moderating transmissions

OBSCURA has no database and no server. Submissions arrive as **GitHub issues**, and the only thing the site ever shows publicly is `public/community.json`, which a person edits by hand. **Unreviewed submissions can never become public**, because nothing reads them except a human.

## The flow

1. A visitor prepares a transmission on the site. It is validated in their browser.
2. They open a prefilled draft issue on this repository and press **Submit new issue** with their own GitHub account.
3. The issue arrives labelled `submission` and `needs-review`.
4. You review it. If it is good, you add it to `public/community.json`. If not, you close it.

## Reviewing an issue

Treat every submission as untrusted.

- **Open the link in a private window**, ideally in a browser profile with nothing logged in. The site is someone else's code.
- Check that it does what the description says, that it needs no account or download, and that it is something you are happy to link to from your own archive.
- Look for the usual problems: misleading descriptions, advertising, malware, pages that demand permissions, content you would not want your name beside, anything that is not the creator's own work.
- The description is shown in the issue as plain text, so formatting or mentions in it do nothing.
- You do not need to reply to approve it, but a short thank-you is kind.

The checks the site makes in the visitor's browser (https only, no credentials, no IP addresses or internal hosts, hidden characters removed, length limits, a honeypot, a minimum fill time and a daily rate limit) stop accidents and low-effort spam. **They are not a security boundary.** Anyone can open the issue form directly, so review as if none of those checks existed.

## Approving a submission

Add an entry to the `entries` array in `public/community.json`:

```json
{
  "entries": [
    {
      "id": "slow-lantern",
      "title": "The Slow Lantern",
      "description": "A small experiment about a lantern that moves slower than you do.",
      "url": "https://example.com/slow-lantern",
      "category": "Interactive visual",
      "creator": "Ada",
      "addedAt": "2026-03-01"
    }
  ]
}
```

- `category` must be one of: Interactive visual, Audio, Puzzle or game, Narrative, Tool or utility, Other.
- `creator` is optional. Leave it out (or empty) for anonymous entries, and **never** put the visitor's private contact details in this file.
- `url` must be a public `https://` address.
- Keep the description short and factual; it is shown to everyone.

Then run the tests, which validate this file:

```bash
npm test
```

Commit and push to `main`. The workflow redeploys, and the entry appears on the **Transmit** page under *Approved transmissions*. Close the issue with a note that it was accepted.

## Removing an entry

Delete its object from `public/community.json`, commit and push. If a creator asks for removal, do it promptly. If a link later turns bad, remove it.

## Visitors' details

The optional "contact" field exists only for the reviewer. It lives in the issue, not on the site. Delete the issue (or edit the field out) when you no longer need it, and do not copy it into `community.json`.

## Housekeeping

- Create the labels `submission` and `needs-review` in **Issues → Labels** so the form's labels apply.
- If you start receiving abuse, you can limit who may open issues under **Settings → Moderation options**, or temporarily disable the issue form by renaming `.github/ISSUE_TEMPLATE/submission.yml`.
