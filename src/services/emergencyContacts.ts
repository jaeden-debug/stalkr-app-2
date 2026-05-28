import { supabase } from './supabase';
import type { EmergencyContact } from '@/types/models';

export async function fetchEmergencyContacts(userId: string): Promise<EmergencyContact[]> {
  const { data, error } = await supabase
    .from('emergency_contacts')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });
  if (error || !data) return [];
  return data as EmergencyContact[];
}

export async function createEmergencyContact(
  userId: string,
  contactName: string,
  phoneNumber: string,
): Promise<EmergencyContact | null> {
  const { data, error } = await supabase
    .from('emergency_contacts')
    .insert({ user_id: userId, contact_name: contactName, phone_number: phoneNumber })
    .select()
    .single();
  if (error || !data) return null;
  return data as EmergencyContact;
}

export async function updateEmergencyContact(
  contactId: string,
  updates: Partial<Pick<EmergencyContact, 'contact_name' | 'phone_number'>>,
): Promise<boolean> {
  const { error } = await supabase.from('emergency_contacts').update(updates).eq('id', contactId);
  return !error;
}

export async function deleteEmergencyContact(contactId: string): Promise<boolean> {
  const { error } = await supabase.from('emergency_contacts').delete().eq('id', contactId);
  return !error;
}
