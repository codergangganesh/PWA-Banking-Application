import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import TransactionList from '../TransactionList';

// Mock the supabase client
jest.mock('../../../services/supabaseClient', () => ({
  supabase: {
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockResolvedValue({ data: [], error: null })
  }
}));

describe('TransactionList', () => {
  const mockUserId = 'user-123';

  test('renders loading state initially', () => {
    render(<TransactionList userId={mockUserId} />);
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  test('renders empty state when no transactions', async () => {
    render(<TransactionList userId={mockUserId} />);
    
    // Wait for the loading to finish
    expect(await screen.findByText('No transactions')).toBeInTheDocument();
  });

  test('renders transactions when data is available', async () => {
    const mockTransactions = [
      {
        id: '1',
        type: 'deposit',
        amount: 100.00,
        description: 'Salary deposit',
        created_at: '2025-01-15T10:30:00Z'
      },
      {
        id: '2',
        type: 'withdrawal',
        amount: 25.50,
        description: 'Grocery shopping',
        created_at: '2025-01-14T14:20:00Z'
      }
    ];

    // Mock the supabase response
    require('../../../services/supabaseClient').supabase.order.mockResolvedValueOnce({
      data: mockTransactions,
      error: null
    });

    render(<TransactionList userId={mockUserId} />);
    
    // Wait for transactions to load
    expect(await screen.findByText('Salary deposit')).toBeInTheDocument();
    expect(screen.getByText('Grocery shopping')).toBeInTheDocument();
  });

  test('formats amounts correctly', async () => {
    const mockTransactions = [
      {
        id: '1',
        type: 'deposit',
        amount: 100.00,
        description: 'Test transaction',
        created_at: '2025-01-15T10:30:00Z'
      }
    ];

    // Mock the supabase response
    require('../../../services/supabaseClient').supabase.order.mockResolvedValueOnce({
      data: mockTransactions,
      error: null
    });

    render(<TransactionList userId={mockUserId} />);
    
    // Wait for transactions to load and check formatted amount
    expect(await screen.findByText('+₹100.00')).toBeInTheDocument();
  });
});