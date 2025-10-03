-- Supabase Database Schema for ChatterBox Mobile
-- Run this in your Supabase SQL Editor

-- Create users table (extends auth.users)
CREATE TABLE IF NOT EXISTS public.users (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  friends UUID[] DEFAULT '{}'::UUID[]
);

-- Create chats table
CREATE TABLE IF NOT EXISTS public.chats (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  participants UUID[] NOT NULL,
  is_group BOOLEAN DEFAULT FALSE,
  group_name VARCHAR(100),
  group_description TEXT
);

-- Create messages table
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  chat_id UUID REFERENCES public.chats(id) ON DELETE CASCADE,
  uid UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  text TEXT,
  image TEXT, -- URL to image
  displayname VARCHAR(100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create stories table (if you have stories feature)
CREATE TABLE IF NOT EXISTS public.stories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  content_type VARCHAR(20) NOT NULL, -- 'image', 'video', 'text'
  content_url TEXT,
  text_content TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '24 hours')
);

-- Row Level Security (RLS) policies

-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;

-- Users table policies
DROP POLICY IF EXISTS "Users can view all profiles" ON public.users;
CREATE POLICY "Users can view all profiles" ON public.users
  FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
CREATE POLICY "Users can update own profile" ON public.users
  FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.users;
CREATE POLICY "Users can insert own profile" ON public.users
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Chats table policies
DROP POLICY IF EXISTS "Users can view chats they participate in" ON public.chats;
CREATE POLICY "Users can view chats they participate in" ON public.chats
  FOR SELECT USING (auth.uid() = ANY(participants));

DROP POLICY IF EXISTS "Users can create chats" ON public.chats;
CREATE POLICY "Users can create chats" ON public.chats
  FOR INSERT WITH CHECK (auth.uid() = ANY(participants));

DROP POLICY IF EXISTS "Users can update chats they participate in" ON public.chats;
CREATE POLICY "Users can update chats they participate in" ON public.chats
  FOR UPDATE USING (auth.uid() = ANY(participants));

-- Messages table policies
DROP POLICY IF EXISTS "Users can view messages in their chats" ON public.messages;
CREATE POLICY "Users can view messages in their chats" ON public.messages
  FOR SELECT USING (
    auth.uid() IN (
      SELECT unnest(participants) 
      FROM public.chats 
      WHERE id = messages.chat_id
    )
  );

DROP POLICY IF EXISTS "Users can insert messages in their chats" ON public.messages;
CREATE POLICY "Users can insert messages in their chats" ON public.messages
  FOR INSERT WITH CHECK (
    auth.uid() = uid AND
    auth.uid() IN (
      SELECT unnest(participants) 
      FROM public.chats 
      WHERE id = messages.chat_id
    )
  );

-- Stories table policies
DROP POLICY IF EXISTS "Users can view all stories" ON public.stories;
CREATE POLICY "Users can view all stories" ON public.stories
  FOR SELECT USING (expires_at > NOW());

DROP POLICY IF EXISTS "Users can insert own stories" ON public.stories;
CREATE POLICY "Users can insert own stories" ON public.stories
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own stories" ON public.stories;
CREATE POLICY "Users can update own stories" ON public.stories
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own stories" ON public.stories;
CREATE POLICY "Users can delete own stories" ON public.stories
  FOR DELETE USING (auth.uid() = user_id);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON public.messages(chat_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON public.messages(created_at);
CREATE INDEX IF NOT EXISTS idx_chats_participants ON public.chats USING GIN(participants);
CREATE INDEX IF NOT EXISTS idx_stories_user_id ON public.stories(user_id);
CREATE INDEX IF NOT EXISTS idx_stories_expires_at ON public.stories(expires_at);

-- Create a function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for chats table
DROP TRIGGER IF EXISTS update_chats_updated_at ON public.chats;
CREATE TRIGGER update_chats_updated_at 
  BEFORE UPDATE ON public.chats 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Create a function to handle user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, username, created_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    NOW()
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Storage buckets and policies
-- Create buckets (public read)
insert into storage.buckets (id, name, public) values ('stories','stories', true) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('messages','messages', true) on conflict (id) do nothing;

-- RLS policies on storage.objects: users can only manage files in <userId>/ prefix
drop policy if exists "obj_insert_own_folder" on storage.objects;
create policy "obj_insert_own_folder"
  on storage.objects for insert to authenticated
  with check (
    bucket_id in ('stories','messages')
    and name like (auth.uid()::text || '/%')
  );

drop policy if exists "obj_update_own_folder" on storage.objects;
create policy "obj_update_own_folder"
  on storage.objects for update to authenticated
  using (
    bucket_id in ('stories','messages')
    and name like (auth.uid()::text || '/%')
  )
  with check (
    bucket_id in ('stories','messages')
    and name like (auth.uid()::text || '/%')
  );

drop policy if exists "obj_delete_own_folder" on storage.objects;
create policy "obj_delete_own_folder"
  on storage.objects for delete to authenticated
  using (
    bucket_id in ('stories','messages')
    and name like (auth.uid()::text || '/%')
  );
