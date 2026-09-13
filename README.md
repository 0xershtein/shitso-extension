# shit.so chrome extension

Vote on anyone from inside X. A `💩 give a shit` pill appears next to every author in the feed
and a bigger one under profile headers. Click → pick one of ten emojis → done. The pill turns into
the live score (`☣️ 95% · 19`).

Voting uses your shit.so session: sign in once on shit.so (the popup has a button), the extension's
background worker sends that cookie with every request. No separate login on X.

When you open a profile, the extension also reports the follower/following counts it sees on the
page to shit.so (at most once per handle every 10 minutes), so profiles can show those numbers without
paying for the X API.

## install (dev)

1. `chrome://extensions` → enable **Developer mode**.
2. **Load unpacked** → pick this `extension/` folder.
3. Open any X profile or your feed.

Host is auto-detected (`shit.so`, falling back to `shitso.vercel.app`); the popup can reset it.
