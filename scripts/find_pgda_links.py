import urllib.request
import re

url = 'https://pgda.gsfc.nasa.gov/products/90'
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
try:
    with urllib.request.urlopen(req, timeout=10) as resp:
        html = resp.read().decode('utf-8')
        links = re.findall(r'href=[\'"]([^\'"]*HILL[^\'"]*)[\'"]', html, re.I)
        for l in links:
            print(l)
except Exception as e:
    print('Error:', e)
