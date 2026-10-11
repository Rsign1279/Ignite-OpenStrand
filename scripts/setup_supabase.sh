#!/bin/zsh
set -eu
cd "${0:A:h:h}"
print '\nIGNITE — Supabase authorization and database setup\n'
print 'Authorize your account directly in the browser. Do not send access tokens in chat.'
npx supabase login
print '\nFind the project reference in Supabase > Project Settings > General.'
read 'project_ref?Supabase project reference: '
if [[ ! "$project_ref" =~ '^[a-z0-9]{20}$' ]]; then
  print 'Invalid project reference. Rerun this setup with the reference from your dashboard.'
  exit 1
fi
npx supabase link --project-ref "$project_ref"
npx supabase db push
mkdir -p .local-setup
print '{"migrationApplied":true}' > .local-setup/supabase-ready.json
print '\nDatabase migration applied.'
print 'Hosted dashboard: enable anonymous sign-ins; disable public email signups; provision your actual staff account.'
print 'Set the Site URL to https://ignite-interview-coach.vercel.app and add http://localhost:3000 to allowed redirects.'
print 'Tell Codex when both setup terminals are finished.'
