import urllib.request, json
req = urllib.request.Request(
    'https://mi-negocio.app/api/auth/register',
    data=json.dumps({'email': 'test789@test.com', 'password': 'Password123!', 'business_name': 'Test', 'phone': '123', 'name': 'test', 'business_type': 'test'}).encode('utf-8'),
    headers={'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0'}
)
try:
    res = urllib.request.urlopen(req)
    print("STATUS:", res.status)
    print(res.read().decode())
except Exception as e:
    print("ERROR STATUS:", getattr(e, 'code', 'Unknown'))
    print(e.read().decode())
