// services/SupabaseService.js
import { supabase } from '../supabase';

export class SupabaseService {
  // Auth functions
  static async getCurrentUser() {
    const { data: { user } } = await supabase.auth.getUser();
    return user;
  }

  static async signOut() {
    return await supabase.auth.signOut();
  }

  static async updatePassword(newPassword) {
    return await supabase.auth.updateUser({ password: newPassword });
  }

  // User profile functions
  static async getUserProfile(userId) {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();
    return { data, error };
  }

  static async updateUserProfile(userId, updates) {
    const { data, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', userId)
      .select()
      .single();
    return { data, error };
  }

  static async searchUsers(searchTerm) {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .or(`username.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`);
    return { data, error };
  }

  // Friends functions
  static async addFriend(userId, friendId) {
    // Add friend to current user's friends list
    const { data: currentUser } = await this.getUserProfile(userId);
    if (!currentUser) return { error: 'User not found' };

    const currentFriends = currentUser.friends || [];
    if (currentFriends.includes(friendId)) {
      return { error: 'Already friends' };
    }

    const { error: error1 } = await supabase
      .from('users')
      .update({ friends: [...currentFriends, friendId] })
      .eq('id', userId);

    // Add current user to friend's friends list
    const { data: friend } = await this.getUserProfile(friendId);
    if (friend) {
      const friendFriends = friend.friends || [];
      if (!friendFriends.includes(userId)) {
        await supabase
          .from('users')
          .update({ friends: [...friendFriends, userId] })
          .eq('id', friendId);
      }
    }

    return { error: error1 };
  }

  static async removeFriend(userId, friendId) {
    // Remove friend from current user's friends list
    const { data: currentUser } = await this.getUserProfile(userId);
    if (!currentUser) return { error: 'User not found' };

    const updatedFriends = (currentUser.friends || []).filter(id => id !== friendId);
    
    const { error: error1 } = await supabase
      .from('users')
      .update({ friends: updatedFriends })
      .eq('id', userId);

    // Remove current user from friend's friends list
    const { data: friend } = await this.getUserProfile(friendId);
    if (friend) {
      const updatedFriendFriends = (friend.friends || []).filter(id => id !== userId);
      await supabase
        .from('users')
        .update({ friends: updatedFriendFriends })
        .eq('id', friendId);
    }

    return { error: error1 };
  }

  // Chat functions
  static async createChat(participants, isGroup = false, groupName = null) {
    const { data, error } = await supabase
      .from('chats')
      .insert([{
        participants,
        is_group: isGroup,
        group_name: groupName,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }])
      .select()
      .single();
    return { data, error };
  }

  static async getOrCreateChat(currentUserId, friendId) {
    const participants = [currentUserId, friendId].sort();
    
    // Check if chat already exists
    const { data: existingChat, error: searchError } = await supabase
      .from('chats')
      .select('*')
      .contains('participants', participants)
      .eq('is_group', false)
      .single();

    if (existingChat) {
      return { data: existingChat, error: null };
    }

    // Create new chat
    return await this.createChat(participants, false);
  }

  static async getUserChats(userId) {
    const { data, error } = await supabase
      .from('chats')
      .select(`
        *,
        messages (
          id,
          text,
          created_at,
          uid
        )
      `)
      .contains('participants', [userId])
      .order('updated_at', { ascending: false });
    
    return { data, error };
  }

  // Message functions
  static async sendMessage(chatId, userId, text, image = null, displayName = 'Anonymous') {
    const { data, error } = await supabase
      .from('messages')
      .insert([{
        chat_id: chatId,
        uid: userId,
        text: text || '',
        image,
        displayname: displayName,
        created_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (!error) {
      // Update chat's updated_at timestamp
      await supabase
        .from('chats')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', chatId);
    }

    return { data, error };
  }

  static async getChatMessages(chatId) {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('chat_id', chatId)
      .order('created_at', { ascending: true });
    return { data, error };
  }

  static async subscribeToMessages(chatId, callback) {
    return supabase
      .channel(`messages:${chatId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `chat_id=eq.${chatId}`,
        },
        callback
      )
      .subscribe();
  }

  // Story functions
  static async createStory(userId, contentType, contentUrl, textContent = null) {
    const { data, error } = await supabase
      .from('stories')
      .insert([{
        user_id: userId,
        content_type: contentType,
        content_url: contentUrl,
        text_content: textContent,
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours
      }])
      .select()
      .single();
    return { data, error };
  }

  static async getUserStories(userId) {
    const { data, error } = await supabase
      .from('stories')
      .select('*')
      .eq('user_id', userId)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false });
    return { data, error };
  }

  static async getAllStories() {
    const { data, error } = await supabase
      .from('stories')
      .select(`
        *,
        users (
          username,
          email
        )
      `)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false });
    if (error) return { data, error };
    // Treat content_url as a storage path and attach a signed URL for display
    const withUrls = await Promise.all((data || []).map(async (row) => {
      if (row.content_url) {
        const { signedUrl } = await this.getSignedUrl('stories', row.content_url).then(r => ({ signedUrl: r.signedUrl }));
        return { ...row, signed_url: signedUrl };
      }
      return row;
    }));
    return { data: withUrls };
  }

  // Group functions
  static async createGroup(creatorId, groupName, groupDescription, memberIds) {
    const participants = [creatorId, ...memberIds].filter((id, index, self) => self.indexOf(id) === index); // Remove duplicates
    
    const { data, error } = await supabase
      .from('chats')
      .insert([{
        participants,
        is_group: true,
        group_name: groupName,
        group_description: groupDescription,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }])
      .select()
      .single();
    return { data, error };
  }

  static async addGroupMembers(chatId, newMemberIds) {
    const { data: chat } = await supabase
      .from('chats')
      .select('participants')
      .eq('id', chatId)
      .single();

    if (chat) {
      const updatedParticipants = [...new Set([...chat.participants, ...newMemberIds])];
      const { error } = await supabase
        .from('chats')
        .update({ 
          participants: updatedParticipants,
          updated_at: new Date().toISOString()
        })
        .eq('id', chatId);
      return { error };
    }
    return { error: 'Chat not found' };
  }

  static async leaveGroup(chatId, userId) {
    const { data: chat } = await supabase
      .from('chats')
      .select('participants')
      .eq('id', chatId)
      .single();

    if (chat) {
      const updatedParticipants = chat.participants.filter(id => id !== userId);
      const { error } = await supabase
        .from('chats')
        .update({ 
          participants: updatedParticipants,
          updated_at: new Date().toISOString()
        })
        .eq('id', chatId);
      return { error };
    }
    return { error: 'Chat not found' };
  }

  // Utility functions
  static async deleteMessage(messageId) {
    const { error } = await supabase
      .from('messages')
      .delete()
      .eq('id', messageId);
    return { error };
  }

  static async updateMessage(messageId, updates) {
    const { data, error } = await supabase
      .from('messages')
      .update(updates)
      .eq('id', messageId)
      .select()
      .single();
    return { data, error };
  }

  // Storage helpers
  static async uploadImageFromUri(bucket, uri, fileName) {
    try {
      const res = await fetch(uri);
      const blob = await res.blob();
      const filePath = `${fileName}`;
      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(filePath, blob, { upsert: true, contentType: blob.type || 'image/jpeg' });
      if (uploadError) throw uploadError;
      return { path: filePath };
    } catch (error) {
      return { error };
    }
  }

  static async getSignedUrl(bucket, path, expiresIn = 3600) {
    try {
      const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresIn);
      if (error) throw error;
      return { signedUrl: data.signedUrl };
    } catch (error) {
      return { error };
    }
  }

  static async getFriendsProfiles(userId) {
    const { data: userData } = await this.getUserProfile(userId);
    const friendIds = userData?.friends || [];
    if (!friendIds.length) return { data: [] };
    const { data: rows, error } = await supabase
      .from('users')
      .select('*')
      .in('id', friendIds);
    const friends = (rows || []).map(row => ({ uid: row.id, ...row }));
    return { data: friends, error };
  }

  static async sendImageToFriend(currentUserId, friendId, imageUrl) {
    const { data: chat } = await this.getOrCreateChat(currentUserId, friendId);
    if (!chat) return { error: 'Chat not found' };
    return await this.sendMessage(chat.id, currentUserId, '', imageUrl);
  }
}

export default SupabaseService;
