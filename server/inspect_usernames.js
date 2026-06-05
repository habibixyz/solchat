import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function inspect() {
  const { data, error } = await supabase.from('usernames').select('*');
  console.log("Usernames:", data);
  console.log("Error:", error);
}
inspect();
