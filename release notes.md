## RSS-Discord-Bridge v1.3
**Major Feature: Exhaustive History Retrieval**
- The bot now retrieves **all** missed articles since the last check, not just the latest one.
- Ensures zero missed posts even if a feed publishes multiple times between checks.
- Posts are sent in chronological order (oldest to newest).

**Safety & Stability**
- **Smart Desync Protection**: Detects if the feed history doesn't match the local state (e.g., new URL or too much time passed) and safely resets to the latest post to avoid spamming channels.
- **Startup Validation**: Checks for `DISCORD_WEBHOOKS` and valid configuration files before running.
- **Rate Limiting**: Adds a 1-second delay between Discord messages to respect API limits.
- **JSON Fixes**: Corrected syntax errors in `feeds.json`.

## RSS-Discord-Bridge v1.2
**New feature : Multi-Channel Support**
- Route feeds to different Discord channels
  - Structured feeds.json with channel mapping
  - Single JSON secret for all webhooks

**Enhanced Error Handling**
  - Better validation of webhook configuration
  - Detailed error logging

## RSS-Discord-Bridge v1.01

Fix on duplicate management

## RSS-Discord-Bridge v1.00

Initial release
