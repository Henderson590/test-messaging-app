// supabase.js
import { createClient } from '@supabase/supabase-js';

// Replace these with your actual Supabase project details
const supabaseUrl = 'https://ltpisvrkkjrhjlekektq.supabase.co'; // e.g., https://your-project.supabase.co
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx0cGlzdnJra2pyaGpsZWtla3RxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkzODY5MzksImV4cCI6MjA3NDk2MjkzOX0.fBlXegRgJzGiOXrK-kMVdw8HzyDEfNxvAuXyvhQwGeE'; // Your anon/public key

// Create Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Configure auth for React Native
    storage: require('@react-native-async-storage/async-storage').default,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

export default supabase;
