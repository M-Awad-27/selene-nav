import urllib.request

url = 'https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/LDEM_80S_80MPP_ADJ_HILL.TIF'
req = urllib.request.Request(url, method='HEAD', headers={'User-Agent': 'Mozilla/5.0'})
try:
    with urllib.request.urlopen(req, timeout=10) as resp:
        print('HTTP Status:', resp.status)
        print('Content-Length:', resp.headers.get('Content-Length'))
except Exception as e:
    print('Error:', e)
