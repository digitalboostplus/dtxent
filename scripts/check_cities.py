import json
with open('.tmp/tixplug_events.json', encoding='utf-8') as f:
    events = json.load(f)

for e in events:
    city = e.get('venueCity', '')
    if city == 'Allen':
        print(f"{e.get('eventDate')} | {e.get('artistName')} | {city} | {e.get('ticketUrl')}")
