import urllib.request
import re
from PIL import Image
import os

url = 'https://imbrium.mit.edu/BROWSE/LOLA_GDR/POLAR/SOUTH_POLE/'
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
try:
    with urllib.request.urlopen(req, timeout=10) as resp:
        html = resp.read().decode('utf-8')
        files = re.findall(r'href=[\'"]([A-Za-z0-9_\.]+\.JPG)[\'"]', html, re.I)
        print('Available JPGs:', files)
except Exception as e:
    print('Dir list error:', e)

# Download LDEM_80S_40M.JPG
out_path = 'public/lola_south_pole_80s.jpg'
dl_url = 'https://imbrium.mit.edu/BROWSE/LOLA_GDR/POLAR/SOUTH_POLE/LDEM_80S_40M.JPG'
req2 = urllib.request.Request(dl_url, headers={'User-Agent': 'Mozilla/5.0'})
with urllib.request.urlopen(req2, timeout=15) as resp2:
    with open(out_path, 'wb') as f:
        f.write(resp2.read())
print('Downloaded:', out_path, os.path.getsize(out_path))

im = Image.open(out_path)
print('Image dimensions:', im.size, im.mode)
