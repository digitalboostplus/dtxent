---
name: update-dtxent
description: Update DTXENT events data by running the update script
disable-model-invocation: true
allowed-tools: Bash
---

Run the update script and report the results:

```bash
python execution/update_dtxent.py 2>&1
```

Wait for completion and report the output, including any errors.
