---
description: Run the DTXent website update script to scrape events, update data, and deploy
---

# Update DTXent Website

This workflow runs the scheduled `run_update.bat` script. Note that `run_update.bat` executes the full update pipeline (scraping, merging, deduping, and syncing to GitHub/Firestore) and logs the output.

## Steps

// turbo-all

1. Execute the update batch script
```powershell
.\run_update.bat
```

2. Check the end of the update log to ensure it completed successfully
```powershell
Get-Content -Tail 20 execution\update_log.txt
```
