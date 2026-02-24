import requests
from bs4 import BeautifulSoup
import os
import urllib.parse

def scrape_images(url, output_name):
    print(f"Scraping {url}...")
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    }
    try:
        response = requests.get(url, headers=headers, timeout=10)
        response.raise_for_status()
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # Try to find images in og:image or first large image
        og_image = soup.find('meta', property='og:image')
        if og_image:
            image_url = og_image['content']
            print(f"Found og:image: {image_url}")
        else:
            # Fallback to first large-ish image
            images = soup.find_all('img')
            image_url = None
            for img in images:
                src = img.get('src')
                if src and ('.jpg' in src or '.png' in src or '.webp' in src):
                    if src.startswith('//'):
                        image_url = 'https:' + src
                    elif src.startswith('/'):
                        image_url = urllib.parse.urljoin(url, src)
                    else:
                        image_url = src
                    break
        
        if image_url:
            print(f"Downloading {image_url}...")
            img_data = requests.get(image_url, headers=headers, timeout=10).content
            with open(f"assets/{output_name}", 'wb') as handler:
                handler.write(img_data)
            print(f"Saved to assets/{output_name}")
            return True
        else:
            print("No suitable image found.")
            return False
    except Exception as e:
        print(f"Error scraping {url}: {e}")
        return False

# Ensure assets dir exists
if not os.path.exists('assets'):
    os.makedirs('assets')

sites = [
    ("https://santafemcallen.com/", "santa_fe.jpg"),
    ("https://grupomendezusa.com/la-doble-m", "la_doble_m.jpg"),
    ("https://www.mousaimcallen.com/", "mousai.jpg")
]

for url, name in sites:
    scrape_images(url, name)
