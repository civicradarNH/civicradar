import urllib.request
import time
u = f'http://127.0.0.1:8095/sw.js?e2e={int(time.time()*1000)}'
s = urllib.request.urlopen(u, timeout=5).read().decode('utf-8')
print('v292', 'civicradar-v292' in s)
print('v291', 'civicradar-v291' in s)
print('no_slash_index', "'/index.html'" not in s)
print('has_index', "'index.html'" in s)
print('no_slash_app', "'/js/app.js'" not in s)
print([ln for ln in s.splitlines() if 'CACHE' in ln][:3])
