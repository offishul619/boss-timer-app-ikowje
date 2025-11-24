import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Database } from './types';
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = "https://fqlfasxkmdbpfrkgpjhh.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZxbGZhc3hrbWRicGZya2dwamhoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM5OTgxNTMsImV4cCI6MjA3OTU3NDE1M30.aSlKiaGMiIEB-kLpvzw7lMujlOdX21ZfVKr1du20ASA";

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})
