
import { createClient, User, Session } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://zvcmuednvteoflmcxynj.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_RmHLZwJkG2j-8U2TZVdeVg_4EfJF-Sc';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Auth Functions
export const signUp = (email: string, password: string) => 
  supabase.auth.signUp({ email, password });

export const signIn = (email: string, password: string) => 
  supabase.auth.signInWithPassword({ email, password });

export const signOut = () => supabase.auth.signOut();

export const getCurrentUser = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
};

// Data Functions
export async function saveTranscription(amharic: string, english?: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error("User must be logged in to save data.");

  const { data, error } = await supabase
    .from('transcriptions')
    .insert([
      { 
        amharic_text: amharic, 
        english_text: english,
        user_id: user.id,
        created_at: new Date().toISOString()
      },
    ])
    .select();

  if (error) throw error;
  return data;
}
