
# Supabase Setup Instructions for Push Notifications

This guide will help you set up Supabase to enable push notifications across all users when the boss spawns.

## Prerequisites

1. A Supabase account (sign up at https://supabase.com)
2. A Supabase project created
3. Supabase enabled in the Natively interface

## Step 1: Enable Supabase in Natively

1. Click the **Supabase** button in the Natively interface
2. Connect to your Supabase project
3. The app will automatically receive the `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` environment variables

## Step 2: Create the Push Tokens Table

Run this SQL in your Supabase SQL Editor:

```sql
-- Create push_tokens table
CREATE TABLE IF NOT EXISTS push_tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  token TEXT NOT NULL,
  device_id TEXT UNIQUE NOT NULL,
  platform TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_push_tokens_device_id ON push_tokens(device_id);
CREATE INDEX IF NOT EXISTS idx_push_tokens_token ON push_tokens(token);

-- Enable Row Level Security
ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;

-- Create policy to allow anyone to insert/update their own token
CREATE POLICY "Allow public insert" ON push_tokens
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow public update" ON push_tokens
  FOR UPDATE
  USING (true);

CREATE POLICY "Allow public read" ON push_tokens
  FOR SELECT
  USING (true);
```

## Step 3: Create the Supabase Edge Function

1. Install Supabase CLI if you haven't already:
   ```bash
   npm install -g supabase
   ```

2. Login to Supabase:
   ```bash
   supabase login
   ```

3. Link your project:
   ```bash
   supabase link --project-ref YOUR_PROJECT_REF
   ```

4. Create the edge function:
   ```bash
   supabase functions new send-boss-notification
   ```

5. Replace the content of `supabase/functions/send-boss-notification/index.ts` with:

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send'

interface PushToken {
  token: string
  device_id: string
  platform: string
}

interface NotificationRequest {
  title: string
  body: string
  data?: Record<string, any>
}

serve(async (req) => {
  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    )

    const { title, body, data } = await req.json() as NotificationRequest

    const { data: tokens, error } = await supabaseClient
      .from('push_tokens')
      .select('token, device_id, platform')

    if (error) {
      console.error('Error fetching tokens:', error)
      return new Response(
        JSON.stringify({ error: 'Failed to fetch push tokens' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    if (!tokens || tokens.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No devices registered', sent: 0 }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const messages = tokens.map((tokenData: PushToken) => ({
      to: tokenData.token,
      sound: 'default',
      title,
      body,
      data: data || {},
      priority: 'high',
      channelId: 'boss-timer',
    }))

    const chunks = []
    for (let i = 0; i < messages.length; i += 100) {
      chunks.push(messages.slice(i, i + 100))
    }

    let totalSent = 0
    const errors = []

    for (const chunk of chunks) {
      try {
        const response = await fetch(EXPO_PUSH_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify(chunk),
        })

        const result = await response.json()
        
        if (result.data) {
          totalSent += result.data.filter((r: any) => r.status === 'ok').length
          
          const failedTokens = result.data
            .map((r: any, idx: number) => ({ result: r, token: chunk[idx].to }))
            .filter((item: any) => item.result.status === 'error')
          
          if (failedTokens.length > 0) {
            errors.push(...failedTokens)
          }
        }
      } catch (error) {
        console.error('Error sending push notification chunk:', error)
        errors.push({ error: error.message })
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        sent: totalSent,
        total: tokens.length,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error in send-boss-notification function:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
```

6. Deploy the edge function:
   ```bash
   supabase functions deploy send-boss-notification
   ```

## Step 4: Test the Setup

1. Run your app on a physical device (push notifications don't work on simulators)
2. Grant notification permissions when prompted
3. The app will automatically register the device token with Supabase
4. Press the "Boss Spawned!" button
5. All registered devices should receive a push notification

## Troubleshooting

### No notifications received:
- Make sure you're testing on a physical device, not a simulator
- Check that notification permissions are granted
- Verify the push_tokens table has entries in Supabase
- Check the Supabase Edge Function logs for errors
- Ensure your Expo project ID is set correctly in the environment

### Supabase not configured warning:
- Make sure you've enabled Supabase in the Natively interface
- Verify the environment variables are set correctly
- Restart the app after enabling Supabase

### Edge function errors:
- Check the Supabase function logs: `supabase functions logs send-boss-notification`
- Verify the push_tokens table exists and has the correct schema
- Make sure the edge function is deployed successfully

## How It Works

1. **Device Registration**: When the app starts, it requests notification permissions and gets an Expo push token
2. **Token Storage**: The token is saved to the Supabase `push_tokens` table with a unique device ID
3. **Boss Spawn**: When a user presses "Boss Spawned!", the app calls the Supabase Edge Function
4. **Notification Broadcast**: The Edge Function fetches all registered tokens and sends push notifications via Expo's push service
5. **Notification Receipt**: All devices receive the notification and update their local timer

## Security Notes

- The current setup allows any user to send notifications (suitable for a trusted group)
- For production, consider adding authentication and authorization
- You can add rate limiting to prevent spam
- Consider adding user preferences for notification settings
