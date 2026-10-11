#!/usr/bin/env python3
"""Collect configuration without echoing secrets; optionally upload it via stdin."""
import getpass
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile

ROOT = Path(__file__).resolve().parent.parent
KEYS = [
    ('NEXT_PUBLIC_SUPABASE_URL', 'Supabase project URL (Settings > API)', False, ''),
    ('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'Supabase publishable/anon key', True, ''),
    ('SUPABASE_SERVICE_ROLE_KEY', 'Supabase service-role/secret key (server only)', True, ''),
    ('GROQ_API_KEY', 'Groq API key', True, ''),
    ('GROQ_MODEL', 'Groq evaluation model', False, 'openai/gpt-oss-120b'),
    ('GROQ_TRANSCRIPTION_MODEL', 'Groq transcription model', False, 'whisper-large-v3-turbo'),
    ('NEXT_PUBLIC_RESULTS_FORM_URL', 'Results form URL', False, 'https://forms.gle/oXsPai5qjkUb5okw9'),
    ('ADMIN_EMAILS', 'Authorized staff emails, separated by commas', False, ''),
    ('UPSTASH_REDIS_REST_URL', 'Upstash Redis REST URL', False, ''),
    ('UPSTASH_REDIS_REST_TOKEN', 'Upstash Redis REST token', True, ''),
]

def read_existing():
    values = {}
    path = ROOT / '.env.local'
    if path.exists():
        for line in path.read_text().splitlines():
            if not line or line.startswith('#') or '=' not in line:
                continue
            name, value = line.split('=', 1)
            try:
                value = json.loads(value.replace("\\$", "$"))
            except (ValueError, TypeError):
                value = value.strip('"').strip("'")
            values[name] = str(value).replace('\\$', '$')
    return values

def main():
    existing = read_existing()
    if '--check' in sys.argv:
        missing = [name for name, *_ in KEYS if not existing.get(name)]
        print('Missing: ' + ', '.join(missing) if missing else 'All required configuration fields are present. Values were not displayed.')
        return 1 if missing else 0
    print('\nIGNITE — service configuration\n')
    print('Private keys are hidden while you type or paste. Press Enter to keep a saved value or use a model/form default.')
    print('Use your own service dashboards. Never put keys in Git or chat.\n')
    values = {}
    for name, label, private, default in KEYS:
        saved = existing.get(name) or default
        while True:
            suffix = ' [saved value; Enter to keep]' if existing.get(name) else f' [{default}]' if default else ''
            prompt = f'{label}{suffix}: '
            value = (getpass.getpass(prompt) if private else input(prompt)).strip() or saved
            if not value:
                print('This value is required. Ctrl+C cancels without saving changes.')
                continue
            if any(ord(char) < 32 for char in value):
                print('Please paste a single-line value without control characters.')
                continue
            if name.endswith('_URL') and not value.startswith('https://'):
                print('Use the HTTPS URL from the service dashboard.')
                continue
            values[name] = value
            break
    content = '# Local secrets — ignored by Git. Do not share this file.\n'
    for name, *_ in KEYS:
        content += name + '=' + json.dumps(values[name]).replace('$', '\\$') + '\n'
    fd, temporary = tempfile.mkstemp(prefix='.env.local.', dir=ROOT)
    try:
        os.fchmod(fd, 0o600)
        with os.fdopen(fd, 'w') as file:
            file.write(content)
        os.replace(temporary, ROOT / '.env.local')
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)
    print('\nSaved .env.local with owner-only permissions. No values were printed.')
    answer = input('Also configure the linked Vercel Production environment? [Y/n]: ').strip().lower()
    uploaded = False
    if answer in ('', 'y', 'yes'):
        uploaded = True
        for name, label, private, default in KEYS:
            print(f'Configuring {name}…', flush=True)
            command = ['npx', '--yes', '--package', 'vercel@63.1.2', 'vercel', 'env', 'add', name, 'production', '--force']
            if not name.startswith('NEXT_PUBLIC_') and (private or name == 'ADMIN_EMAILS'):
                command.append('--sensitive')
            command.append('--yes')
            result = subprocess.run(command, cwd=ROOT, input=values[name] + '\n', text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            if result.returncode:
                print(f'Could not configure {name}. The local file is saved. Check Vercel login/project access and rerun this setup.')
                uploaded = False
                break
    marker = ROOT / '.local-setup'
    marker.mkdir(exist_ok=True)
    (marker / 'environment-ready.json').write_text(json.dumps({'localConfigured': True, 'vercelProductionConfigured': uploaded}) + '\n')
    print('\nConfiguration saved. Tell Codex when both setup terminals are finished so it can verify services and redeploy.')
    return 0

if __name__ == '__main__':
    try:
        raise SystemExit(main())
    except (KeyboardInterrupt, EOFError):
        print('\nSetup stopped. No keys were printed.')
        raise SystemExit(1)
