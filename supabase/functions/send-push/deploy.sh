#!/bin/bash
# Deploy the send-push Edge Function to Supabase.
# Run this once after any changes to index.ts.
#
# Prerequisites:
#   npm install -g supabase   (or: brew install supabase/tap/supabase)
#   supabase login
#   supabase link --project-ref <your-project-ref>

set -e

echo "Deploying send-push Edge Function..."
supabase functions deploy send-push --no-verify-jwt

echo ""
echo "Done. The function is live at:"
echo "  \$SUPABASE_URL/functions/v1/send-push"
echo ""
echo "Make sure SUPABASE_SERVICE_ROLE_KEY is set in your project's"
echo "Edge Function secrets (Supabase Dashboard → Settings → Edge Functions)."
