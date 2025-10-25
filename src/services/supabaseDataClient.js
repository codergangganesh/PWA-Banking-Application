import { supabase } from './supabaseClient';

// Transactions
export const getTransactions = async (ownerEmail) => {
  try {
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('owner_email', ownerEmail)
      .order('date', { ascending: false });

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error fetching transactions:', error);
    return [];
  }
};

export const addTransaction = async (transaction) => {
  try {
    const { data, error } = await supabase
      .from('transactions')
      .insert([transaction])
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error adding transaction:', error);
    return null;
  }
};

export const updateTransaction = async (id, updates) => {
  try {
    const { data, error } = await supabase
      .from('transactions')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error updating transaction:', error);
    return null;
  }
};

export const deleteTransaction = async (id) => {
  try {
    const { data, error } = await supabase
      .from('transactions')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error deleting transaction:', error);
    return false;
  }
};

// Recurring Payments
export const getRecurringPayments = async (ownerEmail) => {
  try {
    const { data, error } = await supabase
      .from('recurring_payments')
      .select('*')
      .eq('owner_email', ownerEmail)
      .order('next_date', { ascending: true });

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error fetching recurring payments:', error);
    return [];
  }
};

export const addRecurringPayment = async (payment) => {
  try {
    const { data, error } = await supabase
      .from('recurring_payments')
      .insert([payment])
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error adding recurring payment:', error);
    return null;
  }
};

export const updateRecurringPayment = async (id, updates) => {
  try {
    const { data, error } = await supabase
      .from('recurring_payments')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error updating recurring payment:', error);
    return null;
  }
};

export const deleteRecurringPayment = async (id) => {
  try {
    const { data, error } = await supabase
      .from('recurring_payments')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error deleting recurring payment:', error);
    return false;
  }
};

// Bill Reminders
export const getBillReminders = async (ownerEmail) => {
  try {
    const { data, error } = await supabase
      .from('bill_reminders')
      .select('*')
      .eq('owner_email', ownerEmail)
      .order('due_date', { ascending: true });

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error fetching bill reminders:', error);
    return [];
  }
};

export const addBillReminder = async (reminder) => {
  try {
    const { data, error } = await supabase
      .from('bill_reminders')
      .insert([reminder])
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error adding bill reminder:', error);
    return null;
  }
};

export const updateBillReminder = async (id, updates) => {
  try {
    const { data, error } = await supabase
      .from('bill_reminders')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error updating bill reminder:', error);
    return null;
  }
};

export const deleteBillReminder = async (id) => {
  try {
    const { data, error } = await supabase
      .from('bill_reminders')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error deleting bill reminder:', error);
    return false;
  }
};

// Account Information
export const getAccountInfo = async (ownerEmail) => {
  try {
    const { data, error } = await supabase
      .from('accounts')
      .select('*')
      .eq('owner_email', ownerEmail)
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error fetching account info:', error);
    return null;
  }
};

export const createAccount = async (account) => {
  try {
    const { data, error } = await supabase
      .from('accounts')
      .insert([account])
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error creating account:', error);
    return null;
  }
};

export const updateAccount = async (id, updates) => {
  try {
    const { data, error } = await supabase
      .from('accounts')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error updating account:', error);
    return null;
  }
};

// Sync local data to Supabase (for initial migration)
export const syncLocalDataToSupabase = async (ownerEmail, localTransactions, localRecurringPayments, localBillReminders) => {
  try {
    // Sync transactions
    const transactionPromises = localTransactions.map(transaction => 
      addTransaction({ ...transaction, owner_email: ownerEmail })
    );
    await Promise.all(transactionPromises);

    // Sync recurring payments
    const recurringPaymentPromises = localRecurringPayments.map(payment => 
      addRecurringPayment({ ...payment, owner_email: ownerEmail })
    );
    await Promise.all(recurringPaymentPromises);

    // Sync bill reminders
    const billReminderPromises = localBillReminders.map(reminder => 
      addBillReminder({ ...reminder, owner_email: ownerEmail })
    );
    await Promise.all(billReminderPromises);

    return true;
  } catch (error) {
    console.error('Error syncing local data to Supabase:', error);
    return false;
  }
};