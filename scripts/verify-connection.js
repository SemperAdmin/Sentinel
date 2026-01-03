import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const url = process.env.VITE_SUPABASE_URL
const key = process.env.VITE_SUPABASE_ANON_KEY

console.log('Testing connection to:', url)

const supabase = createClient(url, key)

async function test() {
  try {
    const { data, error } = await supabase.from('apps').select('id, name').limit(1)
    if (error) {
      console.error('Supabase Error:', error)
    } else {
      console.log('Success! Data:', data)
    }
  } catch (err) {
    console.error('Fetch Error:', err)
  }
}

test()
