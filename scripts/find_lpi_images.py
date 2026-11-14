import urllib.request
import re

url = 'https://www.lpi.usra.edu/lunar/lunar-south-pole-atlas/maps/'
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
try:
    with urllib.request.urlopen(req, timeout=10) as resp:
        html = resp.read().decode('utf-8')
        links = re.findall(r'href=[\'"]([^\'"]*(?:\.jpg|\.png|\.pdf)[^\'"]*)[\'"]', html, re.I)
        for l in links[:20]:
            print(l)
except Exception as e:
    print('Error:', e)
