import React, { useState, useEffect } from 'react';
import { useAuth } from '../../services/AuthContext';
import TransactionFilter from './TransactionFilter';
import TransactionList from './TransactionList';
import TransactionSummary from './TransactionSummary';
import { supabase } from '../../services/supabaseClient';

const TransactionsPage = () => {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [filteredTransactions, setFilteredTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (user) {
      fetchTransactions();
    }
  }, [user]);

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      setTransactions(data || []);
      setFilteredTransactions(data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (filters) => {
    let filtered = [...transactions];

    // Filter by type
    if (filters.type !== 'all') {
      filtered = filtered.filter(t => t.type === filters.type);
    }

    // Filter by search term
    if (filters.search) {
      const searchTerm = filters.search.toLowerCase();
      filtered = filtered.filter(t => 
        (t.description && t.description.toLowerCase().includes(searchTerm)) ||
        (t.type && t.type.toLowerCase().includes(searchTerm))
      );
    }

    // Filter by date range
    if (filters.dateRange !== 'all') {
      const now = new Date();
      let startDate = new Date();

      switch (filters.dateRange) {
        case 'today':
          startDate.setHours(0, 0, 0, 0);
          break;
        case 'week':
          startDate.setDate(now.getDate() - 7);
          break;
        case 'month':
          startDate.setMonth(now.getMonth() - 1);
          break;
        case 'year':
          startDate.setFullYear(now.getFullYear() - 1);
          break;
        default:
          break;
      }

      filtered = filtered.filter(t => new Date(t.created_at) >= startDate);
    }

    setFilteredTransactions(filtered);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
        <strong>Error:</strong> {error}
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Transactions</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          View and manage your transaction history
        </p>
      </div>

      <TransactionSummary transactions={filteredTransactions} />
      <TransactionFilter onFilterChange={handleFilterChange} />
      <TransactionList userId={user?.id} />
    </div>
  );
};

export default TransactionsPage;