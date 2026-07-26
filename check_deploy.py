import paramiko
import sys
sys.stdout.reconfigure(encoding='utf-8')

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('100.85.235.24', port=22, username='root', password='Computadora123@', timeout=15, look_for_keys=False, allow_agent=False)

stdin, stdout, stderr = client.exec_command('docker ps --format "table {{.Names}}\t{{.Status}}" 2>&1')
out = stdout.read().decode('utf-8', errors='replace')
print(out)
client.close()
