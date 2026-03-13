import json
with open('.tmp/tixplug_events.json', encoding='utf-8') as f:
    events = json.load(f)

for e in events:
    if not e.get('venueName') or not e.get('venueCity'):
        print(f"{e.get('eventDate')} | {e.get('artistName')} | {e.get('venueName')} | {e.get('venueCity')} | {e.get('ticketUrl')}")
