Active Tab Time Tracker (Local)
--------------------------------
What it does:
- Tracks which browser tab (domain) you actively work in.
- Pauses when system is idle for >5 minutes.
- Stores daily aggregated durations locally in chrome.storage.local.
- Click the extension icon to open the dashboard (today/week/month), export data, or clear.

Install:
1. Create a folder (e.g., active-tab-tracker) and put the files:
   - manifest.json
   - background.js
   - popup.html
   - popup.css
   - popup.js
   - utils.js
   - icons/ (placeholders for icon16/48/128)
2. Open Chrome → Extensions → Developer mode → Load unpacked → select the folder.
3. Click the extension icon to open dashboard.

Design / Notes:
- Data shape stored under key "activityData" in chrome.storage.local:
  { "2025-09-16": { "example.com": 123456, ... }, ... }
- Times are stored in milliseconds.
- Background service worker writes accumulated time periodically and on events to be resilient to worker lifecycle.
- For demo, chart is a simple canvas bar chart. Replace with Chart.js or D3 for polished visuals (bundle locally).

How I used AI while building (example points to include in your submission):
- Prompted for MV3 service worker code to detect tab activation and idle events.
- Asked to help design storage schema and a minimal dashboard.
- Used AI to iterate on UX copy, README text, and to refactor timer persistence logic.

Possible improvements:
- Map domains to categories (Work/Social/Productivity).
- Offline export history / CSV.
- Visualize session timelines.
- Add options page to set idle threshold, exclude domains, or anonymize hostnames.

    