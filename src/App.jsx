import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { AuthProvider, useAuth } from './services/AuthContext';
import { 
  getTransactions, 
  addTransaction as addSupabaseTransaction, 
  getRecurringPayments as getSupabaseRecurringPayments,
  addRecurringPayment as addSupabaseRecurringPayment,
  getBillReminders as getSupabaseBillReminders,
  addBillReminder as addSupabaseBillReminder,
  updateRecurringPayment,
  updateBillReminder,
  deleteRecurringPayment,
  deleteBillReminder,
  getAccountInfo as getSupabaseAccountInfo,
  createAccount as createSupabaseAccount,
  updateAccount as updateSupabaseAccount,
  deleteTransaction as deleteSupabaseTransaction
} from './services/supabaseDataClient';
import SplashScreen from './components/SplashScreen';
import LoginScreen from './components/LoginScreen';
import SignupScreen from './components/SignupScreen';
import HomeScreen from './components/HomeScreen';
import ProfilePage from './components/ProfilePage';

/*********************************************************
 FIX: Removed react-dom/client `createRoot` usage.
 Canvas renders a React component directly, so we now
 **export default** a component instead of mounting to
 `#root`. Also added guards and runtime self-tests.
**********************************************************/

/**************** IndexedDB helpers (single-user) *********/
const DB_NAME = "bankingApp";
const DB_VERSION = 2; // Increased version for new object stores
let idb;

function openDB() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB not available in this environment"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error || new Error("DB open failed"));
    req.onsuccess = () => {
      idb = req.result;
      resolve(idb);
    };
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains("users")) {
        db.createObjectStore("users", { keyPath: "email" });
      }
      if (!db.objectStoreNames.contains("transactions")) {
        const store = db.createObjectStore("transactions", { keyPath: "id", autoIncrement: true });
        store.createIndex("byOwner", "ownerEmail", { unique: false });
      }
      if (!db.objectStoreNames.contains("recurringPayments")) {
        const store = db.createObjectStore("recurringPayments", { keyPath: "id", autoIncrement: true });
        store.createIndex("byOwner", "ownerEmail", { unique: false });
      }
      if (!db.objectStoreNames.contains("billReminders")) {
        const store = db.createObjectStore("billReminders", { keyPath: "id", autoIncrement: true });
        store.createIndex("byOwner", "ownerEmail", { unique: false });
      }
    };
  });
}

const dbRead = (store, key) =>
  new Promise((res, rej) => {
    const tx = idb.transaction(store, "readonly");
    const st = tx.objectStore(store);
    const r = st.get(key);
    r.onsuccess = () => res(r.result || null);
    r.onerror = () => rej(r.error);
  });

const dbWrite = (store, value) =>
  new Promise((res, rej) => {
    const tx = idb.transaction(store, "readwrite");
    const st = tx.objectStore(store);
    const r = st.put(value);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });

const dbDelete = (store, key) =>
  new Promise((res, rej) => {
    const tx = idb.transaction(store, "readwrite");
    const st = tx.objectStore(store);
    const r = st.delete(key);
    r.onsuccess = () => res(true);
    r.onerror = () => rej(r.error);
  });

const dbGetAllByOwner = (ownerEmail) =>
  new Promise((res, rej) => {
    const tx = idb.transaction("transactions", "readonly");
    const st = tx.objectStore("transactions");
    const idx = st.index("byOwner");
    const results = [];
    const cursorReq = idx.openCursor(ownerEmail);
    cursorReq.onsuccess = (ev) => {
      const cursor = ev.target.result;
      if (cursor) {
        results.push(cursor.value);
        cursor.continue();
      } else res(results);
    };
    cursorReq.onerror = () => rej(cursorReq.error);
  });

const dbClearOwner = (ownerEmail) =>
  new Promise((res, rej) => {
    const tx = idb.transaction("transactions", "readwrite");
    const st = tx.objectStore("transactions");
    const idx = st.index("byOwner");
    const cursorReq = idx.openCursor(ownerEmail);
    cursorReq.onsuccess = (ev) => {
      const cursor = ev.target.result;
      if (cursor) {
        st.delete(cursor.primaryKey);
        cursor.continue();
      } else res(true);
    };
    cursorReq.onerror = () => rej(cursorReq.error);
  });

/******************** Utilities ***************************/
const formatINR = (n) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(Number(n) || 0);
const todayISO = () => new Date().toISOString().slice(0, 10);
const formatDate = (dateString) => new Date(dateString).toLocaleDateString("en-IN", { year: 'numeric', month: 'short', day: 'numeric' });

// Get all recurring payments for a user
const getRecurringPayments = (ownerEmail) =>
  new Promise((res, rej) => {
    const tx = idb.transaction("recurringPayments", "readonly");
    const st = tx.objectStore("recurringPayments");
    const idx = st.index("byOwner");
    const results = [];
    const cursorReq = idx.openCursor(ownerEmail);
    cursorReq.onsuccess = (ev) => {
      const cursor = ev.target.result;
      if (cursor) {
        results.push(cursor.value);
        cursor.continue();
      } else res(results);
    };
    cursorReq.onerror = () => rej(cursorReq.error);
  });

// Get all bill reminders for a user
const getBillReminders = (ownerEmail) =>
  new Promise((res, rej) => {
    const tx = idb.transaction("billReminders", "readonly");
    const st = tx.objectStore("billReminders");
    const idx = st.index("byOwner");
    const results = [];
    const cursorReq = idx.openCursor(ownerEmail);
    cursorReq.onsuccess = (ev) => {
      const cursor = ev.target.result;
      if (cursor) {
        results.push(cursor.value);
        cursor.continue();
      } else res(results);
    };
    cursorReq.onerror = () => rej(cursorReq.error);
  });

/******************** Small components ********************/
const Card = ({ children, className = "" }) => (
  <div className={`bg-white dark:bg-gray-900 rounded-2xl shadow-md p-4 ${className}`}>{children}</div>
);

const BackButton = ({ onClick, label = "Back" }) => (
  <button onClick={onClick} className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline">← {label}</button>
);

function Modal({ open, onClose, title, children, danger = false }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/50" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <motion.div className="w-full max-w-md bg-white dark:bg-gray-900 rounded-2xl shadow-2xl overflow-hidden" initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 10, opacity: 0 }}>
            <div className={`px-4 py-3 border-b dark:border-gray-800 ${danger ? "bg-red-600 text-white" : "bg-gradient-to-r from-indigo-600 to-purple-600 text-white"}`}>
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">{title}</h3>
                <button onClick={onClose} className="opacity-90 hover:opacity-100">✕</button>
              </div>
            </div>
            <div className="p-4">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/******************** Main App ****************************/
function AppContent() {
  const [splashComplete, setSplashComplete] = useState(false);
  const [currentPage, setCurrentPage] = useState('splash'); // splash, home, login, signup, dashboard, settings, forgot, recurring, bills, statements, profile
  const [transactions, setTransactions] = useState([]); // empty for new users
  const [recurringPayments, setRecurringPayments] = useState([]);
  const [billReminders, setBillReminders] = useState([]);
  const [showLogout, setShowLogout] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [confirmPw, setConfirmPw] = useState("");
  const [dateRange, setDateRange] = useState({ start: new Date(Date.now() - 30*24*60*60*1000).toISOString().slice(0, 10), end: todayISO() });
  const [theme, setTheme] = useState('light'); // 'light' or 'dark'
  const [profileImage, setProfileImage] = useState(null);
  const [showBalance, setShowBalance] = useState(true);
  const [balance, setBalance] = useState(0);
  const [accountNumber, setAccountNumber] = useState('');
  const [accountId, setAccountId] = useState(null); // To store the account ID from Supabase
  const [showBalancePopup, setShowBalancePopup] = useState(false);
  const [newBalance, setNewBalance] = useState('');
  const [dataSynced, setDataSynced] = useState(false); // New state to track if data has been synced
  const [phone, setPhone] = useState(''); // Add phone state
  
  const { user, signOut } = useAuth();

  // Debugging - log state changes
  useEffect(() => {
    console.log('App state changed:', { currentPage, splashComplete, user });
  }, [currentPage, splashComplete, user]);

  // Initialize theme from localStorage or system preference
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const savedProfileImage = localStorage.getItem('profileImage');
    const savedPhone = localStorage.getItem('phone'); // Get saved phone
    
    if (savedTheme) {
      setTheme(savedTheme);
    } else if (systemPrefersDark) {
      setTheme('dark');
    }
    
    if (savedProfileImage) {
      setProfileImage(savedProfileImage);
    }
    
    if (savedPhone) {
      setPhone(savedPhone);
    }
  }, []);

  // Apply theme to document
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Save profile image and phone to localStorage
  useEffect(() => {
    if (profileImage) {
      localStorage.setItem('profileImage', profileImage);
    } else {
      localStorage.removeItem('profileImage');
    }
    
    if (phone) {
      localStorage.setItem('phone', phone);
    } else {
      localStorage.removeItem('phone');
    }
  }, [profileImage, phone]);

  // Initialize database
  useEffect(() => {
    openDB().catch(console.error);
  }, []);

  // Fetch user data when authenticated
  useEffect(() => {
    if (user && splashComplete) {
      fetchUserData();
    }
  }, [user, splashComplete]);

  // Fetch user data from Supabase
  const fetchUserData = async () => {
    if (!user) return;
    
    try {
      // Fetch transactions from Supabase
      const supabaseTransactions = await getTransactions(user.email);
      setTransactions(supabaseTransactions);
      
      // Fetch recurring payments from Supabase
      const supabaseRecurringPayments = await getSupabaseRecurringPayments(user.email);
      setRecurringPayments(supabaseRecurringPayments);
      
      // Fetch bill reminders from Supabase
      const supabaseBillReminders = await getSupabaseBillReminders(user.email);
      setBillReminders(supabaseBillReminders);
      
      // Fetch account information from Supabase
      const accountInfo = await getSupabaseAccountInfo(user.email);
      if (accountInfo) {
        setBalance(accountInfo.balance || 0);
        setAccountNumber(accountInfo.account_number || '');
        setAccountId(accountInfo.id);
      } else {
        // If no account info exists, calculate balance from transactions and show the popup to create it
        const transactionBalance = supabaseTransactions.reduce((sum, transaction) => {
          return sum + transaction.amount;
        }, 0);
        
        setBalance(transactionBalance);
        setShowBalancePopup(true);
      }
      
      // Sync local data to Supabase if not already done
      if (!dataSynced) {
        // Get local data
        const localTransactions = await dbGetAllByOwner(user.email);
        const localRecurringPayments = await getRecurringPayments(user.email);
        const localBillReminders = await getBillReminders(user.email);
        
        // If there's local data, sync it to Supabase
        if (localTransactions.length > 0 || localRecurringPayments.length > 0 || localBillReminders.length > 0) {
          await syncLocalDataToSupabase(
            user.email,
            localTransactions,
            localRecurringPayments,
            localBillReminders
          );
          setDataSynced(true);
          
          // Clear local data after sync
          await dbClearOwner(user.email);
        }
      }
      
      setCurrentPage('dashboard');
    } catch (error) {
      console.error('Error fetching user data:', error);
      setCurrentPage('dashboard');
    }
  };

  // Handle profile image change
  const handleProfileImageChange = (imageData) => {
    setProfileImage(imageData);
    // In a real app, you would save this to user metadata
  };

  // Handle phone change
  const handlePhoneChange = (phoneData) => {
    setPhone(phoneData);
  };

  // Toggle theme
  const toggleTheme = () => {
    setTheme(theme === 'light' ? 'dark' : 'light');
  };

  const handleLoginSuccess = () => {
    console.log('Login successful, setting page to dashboard');
    setCurrentPage('dashboard');
  };

  const handleSignupSuccess = () => {
    console.log('Signup successful, setting page to dashboard');
    setCurrentPage('dashboard');
  };

  const handleLogoutConfirmed = async () => {
    console.log('Logout confirmed');
    setConfirmPw("");
    setShowLogout(false);
    await signOut();
    setCurrentPage("home"); // return to home as requested
  };

  const handleDeleteConfirmed = async () => {
    if (!user) return;
    await dbDelete("users", user.email);
    await dbClearOwner(user.email);
    setConfirmPw("");
    setShowDelete(false);
    setTransactions([]);
    alert("Your account data has been deleted.");
  };

  const addTransaction = async ({ type, amount, description, category }) => {
    if (!user) return;
    
    // Calculate amount value
    const amountValue = Number(amount) * (type === "expense" ? -1 : 1);
    
    // Create transaction object
    const transaction = {
      owner_email: user.email,
      type,
      amount: amountValue,
      description,
      category,
      date: todayISO(),
    };
    
    // Update balance immediately for instant UI feedback
    let newBalance = balance;
    if (accountId) {
      newBalance = balance + amountValue;
      setBalance(newBalance);
    }
    
    // Add to local state immediately for instant UI feedback
    const tempId = `temp_${Date.now()}`; // Temporary ID for UI purposes
    const tempTransaction = {
      ...transaction,
      id: tempId,
      created_at: new Date().toISOString()
    };
    
    setTransactions(prev => [tempTransaction, ...prev]);
    
    try {
      // Add to Supabase in the background
      const newTransaction = await addSupabaseTransaction(transaction);
      if (newTransaction) {
        // Replace temporary transaction with the real one from Supabase
        setTransactions(prev => 
          [newTransaction, ...prev.filter(t => t.id !== tempId)]
        );
        
        // Update balance in Supabase in the background
        if (accountId) {
          await updateSupabaseAccount(accountId, { balance: newBalance });
        }
      } else {
        // If Supabase addition failed, remove the temporary transaction and revert balance
        setTransactions(prev => prev.filter(t => t.id !== tempId));
        if (accountId) {
          setBalance(balance);
        }
      }
    } catch (error) {
      // If Supabase addition failed, remove the temporary transaction and revert balance
      setTransactions(prev => prev.filter(t => t.id !== tempId));
      if (accountId) {
        setBalance(balance);
      }
      console.error('Error adding transaction:', error);
    }
  };

  // Import/Export (JSON)
  const exportJSON = async () => {
    if (!user) return;
    const txns = await dbGetAllByOwner(user.email);
    const data = { user: { ...user, password: undefined }, transactions: txns };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mybank-backup-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importJSON = async (file) => {
    if (!user || !file) return;
    const text = await file.text();
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed.transactions)) {
        // Clear existing owner's transactions, then add
        await dbClearOwner(user.email);
        for (const t of parsed.transactions) {
          await dbWrite("transactions", { ...t, id: undefined, ownerEmail: user.email });
        }
        const updated = await dbGetAllByOwner(user.email);
        setTransactions(updated);
        
        // Recalculate balance based on imported transactions
        if (accountId) {
          const total = updated.reduce((sum, transaction) => {
            return sum + transaction.amount;
          }, balance); // Start with current balance
          
          setBalance(total);
          // Update balance in Supabase
          await updateSupabaseAccount(accountId, { balance: total });
        }
        
        alert("Transactions imported");
      } else {
        alert("Invalid backup format");
      }
    } catch (e) {
      alert("Failed to parse JSON");
    }
  };
  
  // Recurring Payments
  const addRecurringPayment = async ({ amount, description, category, frequency, nextDate }) => {
    if (!user) return;
    
    const payment = {
      owner_email: user.email,
      amount: Number(amount),
      description,
      category,
      frequency,
      next_date: nextDate,
      created_at: new Date().toISOString(),
    };
    
    try {
      // Add to Supabase
      const newPayment = await addSupabaseRecurringPayment(payment);
      if (newPayment) {
        setRecurringPayments(prev => [...prev, newPayment]);
      }
    } catch (error) {
      console.error('Error adding recurring payment:', error);
    }
  };
  
  const deleteRecurringPayment = async (id) => {
    if (!user) return;
    
    try {
      // Delete from Supabase
      const success = await deleteRecurringPayment(id);
      if (success) {
        setRecurringPayments(prev => prev.filter(p => p.id !== id));
      }
    } catch (error) {
      console.error('Error deleting recurring payment:', error);
    }
  };
  
  const processRecurringPayment = async (payment) => {
    // Add transaction from recurring payment
    // We'll add the transaction immediately for UI feedback
    const amountValue = Number(payment.amount) * -1; // Expense
    
    // Update balance immediately
    let newBalance = balance;
    if (accountId) {
      newBalance = balance + amountValue;
      setBalance(newBalance);
    }
    
    // Add transaction to UI immediately
    const tempId = `temp_${Date.now()}`; // Temporary ID for UI purposes
    const tempTransaction = {
      owner_email: user.email,
      type: "expense",
      amount: amountValue,
      description: `${payment.description} (Recurring)`,
      category: payment.category,
      date: todayISO(),
      id: tempId,
      created_at: new Date().toISOString()
    };
    
    setTransactions(prev => [tempTransaction, ...prev]);
    
    try {
      // Add transaction to Supabase in background
      const newTransaction = await addSupabaseTransaction({
        owner_email: user.email,
        type: "expense",
        amount: amountValue,
        description: `${payment.description} (Recurring)`,
        category: payment.category,
        date: todayISO(),
      });
      
      if (newTransaction) {
        // Replace temporary transaction with real one
        setTransactions(prev => 
          [newTransaction, ...prev.filter(t => t.id !== tempId)]
        );
        
        // Update balance in Supabase
        if (accountId) {
          await updateSupabaseAccount(accountId, { balance: newBalance });
        }
      } else {
        // If failed, remove temp transaction and revert balance
        setTransactions(prev => prev.filter(t => t.id !== tempId));
        if (accountId) {
          setBalance(balance);
        }
      }
      
      // Update next payment date based on frequency
      const nextDate = new Date(payment.next_date);
      switch(payment.frequency) {
        case 'weekly':
          nextDate.setDate(nextDate.getDate() + 7);
          break;
        case 'monthly':
          nextDate.setMonth(nextDate.getMonth() + 1);
          break;
        case 'quarterly':
          nextDate.setMonth(nextDate.getMonth() + 3);
          break;
        case 'yearly':
          nextDate.setFullYear(nextDate.getFullYear() + 1);
          break;
      }
      
      const updatedPayment = {
        ...payment,
        next_date: nextDate.toISOString().slice(0, 10)
      };
      
      // Update in Supabase
      const result = await updateRecurringPayment(payment.id, {
        next_date: updatedPayment.next_date
      });
      if (result) {
        setRecurringPayments(prev => 
          prev.map(p => p.id === payment.id ? result : p)
        );
      }
    } catch (error) {
      // If failed, remove temp transaction and revert balance
      setTransactions(prev => prev.filter(t => t.id !== tempId));
      if (accountId) {
        setBalance(balance);
      }
      console.error('Error processing recurring payment:', error);
    }
  };
  
  // Bill Reminders
  const addBillReminderLocal = async ({ description, amount, dueDate, category }) => {
    if (!user) return;
    
    const reminder = {
      owner_email: user.email,
      description,
      amount: Number(amount),
      due_date: dueDate,
      category,
      is_paid: false,
      created_at: new Date().toISOString(),
    };
    
    try {
      // Add to Supabase
      const newReminder = await addSupabaseBillReminder(reminder);
      if (newReminder) {
        setBillReminders(prev => [...prev, newReminder]);
      }
    } catch (error) {
      console.error('Error adding bill reminder:', error);
    }
  };
  
  const markBillAsPaidLocal = async (id) => {
    if (!user) return;
    
    const bill = billReminders.find(b => b.id === id);
    if (!bill) return;
    
    // Add transaction for the bill payment
    // We'll add the transaction immediately for UI feedback
    const amountValue = Number(bill.amount) * -1; // Expense
    
    // Update balance immediately
    let newBalance = balance;
    if (accountId) {
      newBalance = balance + amountValue;
      setBalance(newBalance);
    }
    
    // Add transaction to UI immediately
    const tempId = `temp_${Date.now()}`; // Temporary ID for UI purposes
    const tempTransaction = {
      owner_email: user.email,
      type: "expense",
      amount: amountValue,
      description: `${bill.description} (Bill Payment)`,
      category: bill.category,
      date: todayISO(),
      id: tempId,
      created_at: new Date().toISOString()
    };
    
    setTransactions(prev => [tempTransaction, ...prev]);
    
    try {
      // Add transaction to Supabase in background
      const newTransaction = await addSupabaseTransaction({
        owner_email: user.email,
        type: "expense",
        amount: amountValue,
        description: `${bill.description} (Bill Payment)`,
        category: bill.category,
        date: todayISO(),
      });
      
      if (newTransaction) {
        // Replace temporary transaction with real one
        setTransactions(prev => 
          [newTransaction, ...prev.filter(t => t.id !== tempId)]
        );
        
        // Update balance in Supabase
        if (accountId) {
          await updateSupabaseAccount(accountId, { balance: newBalance });
        }
      } else {
        // If failed, remove temp transaction and revert balance
        setTransactions(prev => prev.filter(t => t.id !== tempId));
        if (accountId) {
          setBalance(balance);
        }
      }
      
      // Update bill status
      const updatedBill = { ...bill, is_paid: true };
      
      // Update in Supabase
      const result = await updateBillReminder(id, { is_paid: true });
      if (result) {
        setBillReminders(prev => 
          prev.map(b => b.id === id ? result : b)
        );
      }
    } catch (error) {
      // If failed, remove temp transaction and revert balance
      setTransactions(prev => prev.filter(t => t.id !== tempId));
      if (accountId) {
        setBalance(balance);
      }
      console.error('Error marking bill as paid:', error);
    }
  };
  
  const deleteBillReminderLocal = async (id) => {
    if (!user) return;
    
    try {
      // Delete from Supabase
      const success = await deleteBillReminder(id);
      if (success) {
        setBillReminders(prev => prev.filter(b => b.id !== id));
      }
    } catch (error) {
      console.error('Error deleting bill reminder:', error);
    }
  };
  
  // Account Statement
  const generateStatement = () => {
    if (!transactions.length) return [];
    
    // Filter transactions by date range
    const filteredTransactions = transactions.filter(t => {
      return t.date >= dateRange.start && t.date <= dateRange.end;
    });
    
    return filteredTransactions.sort((a, b) => new Date(b.date) - new Date(a.date));
  };

  // UI Components for new features
  const RecurringPaymentsPage = () => {
    const [showAddForm, setShowAddForm] = useState(false);
    const [newPayment, setNewPayment] = useState({
      amount: "",
      description: "",
      category: "Bills",
      frequency: "monthly",
      nextDate: todayISO(),
    });
    
    const handleInputChange = (e) => {
      const { name, value } = e.target;
      setNewPayment(prev => ({ ...prev, [name]: value }));
    };
    
    const handleSubmit = (e) => {
      e.preventDefault();
      addRecurringPayment(newPayment);
      setNewPayment({
        amount: "",
        description: "",
        category: "Bills",
        frequency: "monthly",
        nextDate: todayISO(),
      });
      setShowAddForm(false);
    };
    
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold">Recurring Payments</h2>
          <div>
            <button 
              onClick={() => setShowAddForm(!showAddForm)}
              className="px-3 py-1 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm"
            >
              {showAddForm ? "Cancel" : "Add New"}
            </button>
            <button 
              onClick={() => setCurrentPage("dashboard")}
              className="ml-2 px-3 py-1 bg-gray-200 dark:bg-gray-800 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-700 text-sm"
            >
              Back
            </button>
          </div>
        </div>
        
        {showAddForm && (
          <Card>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <input 
                  type="text" 
                  name="description" 
                  value={newPayment.description} 
                  onChange={handleInputChange} 
                  className="w-full p-2 border rounded dark:bg-gray-800 dark:border-gray-700" 
                  required 
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Amount</label>
                <input 
                  type="number" 
                  name="amount" 
                  value={newPayment.amount} 
                  onChange={handleInputChange} 
                  className="w-full p-2 border rounded dark:bg-gray-800 dark:border-gray-700" 
                  min="0" 
                  step="0.01" 
                  required 
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Category</label>
                <select 
                  name="category" 
                  value={newPayment.category} 
                  onChange={handleInputChange} 
                  className="w-full p-2 border rounded dark:bg-gray-800 dark:border-gray-700"
                >
                  <option>Bills</option>
                  <option>Rent</option>
                  <option>Subscription</option>
                  <option>Insurance</option>
                  <option>Loan</option>
                  <option>Other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Frequency</label>
                <select 
                  name="frequency" 
                  value={newPayment.frequency} 
                  onChange={handleInputChange} 
                  className="w-full p-2 border rounded dark:bg-gray-800 dark:border-gray-700"
                >
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="yearly">Yearly</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Next Payment Date</label>
                <input 
                  type="date" 
                  name="nextDate" 
                  value={newPayment.nextDate} 
                  onChange={handleInputChange} 
                  className="w-full p-2 border rounded dark:bg-gray-800 dark:border-gray-700" 
                  required 
                />
              </div>
              <button 
                type="submit" 
                className="w-full py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
              >
                Save
              </button>
            </form>
          </Card>
        )}
        
        {recurringPayments.length > 0 ? (
          <div className="space-y-3">
            {recurringPayments.map(payment => (
              <Card key={payment.id} className="flex justify-between items-center">
                <div>
                  <h3 className="font-medium">{payment.description}</h3>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    {payment.frequency.charAt(0).toUpperCase() + payment.frequency.slice(1)} • {payment.category} • Next: {formatDate(payment.nextDate)}
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="font-semibold">{formatINR(payment.amount)}</div>
                  <button 
                    onClick={() => processRecurringPayment(payment)}
                    className="p-1 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 rounded hover:bg-green-200 dark:hover:bg-green-800"
                    title="Process payment now"
                  >
                    ✓
                  </button>
                  <button 
                    onClick={() => deleteRecurringPayment(payment.id)}
                    className="p-1 bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 rounded hover:bg-red-200 dark:hover:bg-red-800"
                    title="Delete recurring payment"
                  >
                    ✕
                  </button>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center text-gray-600 dark:text-gray-400">No recurring payments yet.</div>
        )}
      </div>
    );
  };



  const StatementsPage = () => {
    const statement = generateStatement();
    const totalIncome = statement.reduce((acc, t) => acc + (t.type === "income" ? t.amount : 0), 0);
    const totalExpenses = statement.reduce((acc, t) => acc + (t.type === "expense" ? t.amount : 0), 0);
    const balance = totalIncome + totalExpenses;

    const incomeData = statement
      .filter(t => t.type === "income")
      .reduce((acc, t) => {
        const existing = acc.find(d => d.category === t.category);
        if (existing) {
          existing.value += t.amount;
        } else {
          acc.push({ name: t.category, value: t.amount });
        }
        return acc;
      }, []);

    const expenseData = statement
      .filter(t => t.type === "expense")
      .reduce((acc, t) => {
        const existing = acc.find(d => d.category === t.category);
        if (existing) {
          existing.value -= t.amount;
        } else {
          acc.push({ name: t.category, value: -t.amount });
        }
        return acc;
      }, []);

    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold">Account Statement</h2>
          <button 
            onClick={() => setCurrentPage("dashboard")}
            className="px-3 py-1 bg-gray-200 dark:bg-gray-800 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-700 text-sm"
          >
            Back
          </button>
        </div>
        <div className="flex justify-between items-center">
          <div className="space-y-1">
            <h3 className="text-lg font-semibold">Income</h3>
            <div className="text-gray-600 dark:text-gray-400">{formatINR(totalIncome)}</div>
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-semibold">Expenses</h3>
            <div className="text-gray-600 dark:text-gray-400">{formatINR(totalExpenses)}</div>
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-semibold">Balance</h3>
            <div className="text-gray-600 dark:text-gray-400">{formatINR(balance)}</div>
          </div>
        </div>
        <div className="space-y-3">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={statement}>
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="amount" fill="#8884d8" />
            </BarChart>
          </ResponsiveContainer>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <h3 className="text-lg font-semibold">Income Breakdown</h3>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={incomeData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} fill="#8884d8" label />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-semibold">Expense Breakdown</h3>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={expenseData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} fill="#82ca9d" label />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const SettingsPage = () => {
    const [newTheme, setNewTheme] = useState(theme);
    const [newProfileImage, setNewProfileImage] = useState(profileImage);
    const [newBalance, setNewBalance] = useState(balance);
    const [showDelete, setShowDelete] = useState(false);
    const [confirmPw, setConfirmPw] = useState("");
    const [showLogout, setShowLogout] = useState(false);

    const handleThemeChange = (e) => {
      setNewTheme(e.target.value);
    };

    const handleProfileImageChange = (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onloadend = () => {
          setNewProfileImage(reader.result);
        };
        reader.readAsDataURL(file);
      }
    };

    const handleBalanceChange = (e) => {
      setNewBalance(e.target.value);
    };

    const handleDeleteConfirmed = async () => {
      if (!user) return;
      await dbDelete("users", user.email);
      await dbClearOwner(user.email);
      setConfirmPw("");
      setShowDelete(false);
      setTransactions([]);
      alert("Your account data has been deleted.");
    };

    const handleLogoutConfirmed = async () => {
      setConfirmPw("");
      setShowLogout(false);
      await signOut();
      setCurrentPage("home"); // return to home as requested
    };

    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold">Settings</h2>
          <button 
            onClick={() => setCurrentPage("dashboard")}
            className="px-3 py-1 bg-gray-200 dark:bg-gray-800 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-700 text-sm"
          >
            Back
          </button>
        </div>
        <div className="space-y-1">
          <label className="block text-sm font-medium mb-1">Theme</label>
          <select 
            value={newTheme} 
            onChange={handleThemeChange} 
            className="w-full p-2 border rounded dark:bg-gray-800 dark:border-gray-700"
          >
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </div>
        <div className="space-y-1">
          <label className="block text-sm font-medium mb-1">Profile Image</label>
          <input 
            type="file" 
            accept="image/*" 
            onChange={handleProfileImageChange} 
            className="w-full p-2 border rounded dark:bg-gray-800 dark:border-gray-700"
          />
          {newProfileImage && (
            <img 
              src={newProfileImage} 
              alt="Profile" 
              className="w-24 h-24 rounded-full mt-2"
            />
          )}
        </div>
        <div className="space-y-1">
          <label className="block text-sm font-medium mb-1">Balance</label>
          <input 
            type="number" 
            value={newBalance} 
            onChange={handleBalanceChange} 
            className="w-full p-2 border rounded dark:bg-gray-800 dark:border-gray-700" 
            min="0" 
            step="0.01" 
          />
        </div>
        <div className="flex justify-between items-center">
          <button 
            onClick={() => setShowDelete(true)}
            className="px-3 py-1 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm"
          >
            Delete Account
          </button>
          <button 
            onClick={() => setShowLogout(true)}
            className="px-3 py-1 bg-gray-200 dark:bg-gray-800 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-700 text-sm"
          >
            Logout
          </button>
        </div>
        <Modal open={showDelete} onClose={() => setShowDelete(false)} title="Delete Account" danger>
          <div className="space-y-3">
            <p className="text-sm text-gray-600 dark:text-gray-400">Are you sure you want to delete your account? This action is irreversible.</p>
            <input 
              type="password" 
              value={confirmPw} 
              onChange={(e) => setConfirmPw(e.target.value)} 
              placeholder="Enter your password" 
              className="w-full p-2 border rounded dark:bg-gray-800 dark:border-gray-700"
            />
            <button 
              onClick={handleDeleteConfirmed}
              className="w-full py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              disabled={confirmPw !== user.password}
            >
              Confirm Delete
            </button>
          </div>
        </Modal>
        <Modal open={showLogout} onClose={() => setShowLogout(false)} title="Logout">
          <div className="space-y-3">
            <p className="text-sm text-gray-600 dark:text-gray-400">Are you sure you want to logout?</p>
            <button 
              onClick={handleLogoutConfirmed}
              className="w-full py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
            >
              Confirm Logout
            </button>
          </div>
        </Modal>
      </div>
    );
  };

  const DashboardPage = () => {
    const totalIncome = transactions.reduce((acc, t) => acc + (t.type === "income" ? t.amount : 0), 0);
    const totalExpenses = transactions.reduce((acc, t) => acc + (t.type === "expense" ? t.amount : 0), 0);
    const balance = totalIncome + totalExpenses;

    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold">Dashboard</h2>
          <button 
            onClick={() => setCurrentPage("settings")}
            className="px-3 py-1 bg-gray-200 dark:bg-gray-800 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-700 text-sm"
          >
            Settings
          </button>
        </div>
        <div className="flex justify-between items-center">
          <div className="space-y-1">
            <h3 className="text-lg font-semibold">Income</h3>
            <div className="text-gray-600 dark:text-gray-400">{formatINR(totalIncome)}</div>
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-semibold">Expenses</h3>
            <div className="text-gray-600 dark:text-gray-400">{formatINR(totalExpenses)}</div>
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-semibold">Balance</h3>
            <div className="text-gray-600 dark:text-gray-400">{formatINR(balance)}</div>
          </div>
        </div>
        <div className="space-y-3">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={transactions}>
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="amount" fill="#8884d8" />
            </BarChart>
          </ResponsiveContainer>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <h3 className="text-lg font-semibold">Income Breakdown</h3>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={transactions.filter(t => t.type === "income")} dataKey="amount" nameKey="category" cx="50%" cy="50%" outerRadius={80} fill="#8884d8" label />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-semibold">Expense Breakdown</h3>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={transactions.filter(t => t.type === "expense")} dataKey="amount" nameKey="category" cx="50%" cy="50%" outerRadius={80} fill="#82ca9d" label />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
        <div className="flex justify-between items-center">
          <button 
            onClick={() => setCurrentPage("recurring")}
            className="px-3 py-1 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm"
          >
            Recurring Payments
          </button>
          <button 
            onClick={() => setCurrentPage("bills")}
            className="px-3 py-1 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm"
          >
            Bill Reminders
          </button>
          <button 
            onClick={() => setCurrentPage("statements")}
            className="px-3 py-1 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm"
          >
            Account Statement
          </button>
        </div>
      </div>
    );
  };

  const renderPage = () => {
    switch (currentPage) {
      case 'splash':
        return <SplashScreen onComplete={() => setSplashComplete(true)} />;
      case 'home':
        return <HomeScreen onLogin={() => setCurrentPage('login')} onSignup={() => setCurrentPage('signup')} />;
      case 'login':
        return <LoginScreen onSuccess={handleLoginSuccess} />;
      case 'signup':
        return <SignupScreen onSuccess={handleSignupSuccess} />;
      case 'dashboard':
        return <DashboardPage />;
      case 'settings':
        return <SettingsPage />;
      case 'recurring':
        return <RecurringPaymentsPage />;
      case 'bills':
        return <BillRemindersPage />;
      case 'statements':
        return <StatementsPage />;
      case 'profile':
        return <ProfilePage />;
      default:
        return <div>404 Not Found</div>;
    }
  };
  
  const BillRemindersPage = () => {
    const [showAddForm, setShowAddForm] = useState(false);
    const [newBill, setNewBill] = useState({
      description: "",
      amount: "",
      dueDate: todayISO(),
      category: "Utilities",
    });
    
    const handleInputChange = (e) => {
      const { name, value } = e.target;
      setNewBill(prev => ({ ...prev, [name]: value }));
    };
    
    const handleSubmit = (e) => {
      e.preventDefault();
      addBillReminderLocal(newBill);
      setNewBill({
        description: "",
        amount: "",
        dueDate: todayISO(),
        category: "Utilities",
      });
      setShowAddForm(false);
    };
    
    // Sort bills by due date (upcoming first)
    const sortedBills = [...billReminders].sort((a, b) => new Date(a.due_date) - new Date(b.due_date));
    const unpaidBills = sortedBills.filter(bill => !bill.is_paid);
    const paidBills = sortedBills.filter(bill => bill.is_paid);
    
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold">Bill Reminders</h2>
          <div>
            <button 
              onClick={() => setShowAddForm(!showAddForm)}
              className="px-3 py-1 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm"
            >
              {showAddForm ? "Cancel" : "Add New"}
            </button>
            <button 
              onClick={() => setCurrentPage("dashboard")}
              className="ml-2 px-3 py-1 bg-gray-200 dark:bg-gray-800 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-700 text-sm"
            >
              Back
            </button>
          </div>
        </div>
        
        {showAddForm && (
          <Card>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <input 
                  type="text" 
                  name="description" 
                  value={newBill.description} 
                  onChange={handleInputChange} 
                  className="w-full p-2 border rounded dark:bg-gray-800 dark:border-gray-700" 
                  required 
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Amount</label>
                <input 
                  type="number" 
                  name="amount" 
                  value={newBill.amount} 
                  onChange={handleInputChange} 
                  className="w-full p-2 border rounded dark:bg-gray-800 dark:border-gray-700" 
                  min="0" 
                  step="0.01" 
                  required 
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Category</label>
                <select 
                  name="category" 
                  value={newBill.category} 
                  onChange={handleInputChange} 
                  className="w-full p-2 border rounded dark:bg-gray-800 dark:border-gray-700"
                >
                  <option>Utilities</option>
                  <option>Rent</option>
                  <option>Phone</option>
                  <option>Internet</option>
                  <option>Credit Card</option>
                  <option>Other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Due Date</label>
                <input 
                  type="date" 
                  name="dueDate" 
                  value={newBill.dueDate} 
                  onChange={handleInputChange} 
                  className="w-full p-2 border rounded dark:bg-gray-800 dark:border-gray-700" 
                  required 
                />
              </div>
              <button 
                type="submit" 
                className="w-full py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
              >
                Save
              </button>
            </form>
          </Card>
        )}
        
        <div className="space-y-4">
          {unpaidBills.length > 0 && (
            <div>
              <h3 className="font-medium mb-2">Upcoming & Overdue Bills</h3>
              <div className="space-y-3">
                {unpaidBills.map(bill => {
                  const dueDate = new Date(bill.due_date);
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  const isOverdue = dueDate < today;
                  
                  return (
                    <Card 
                      key={bill.id} 
                      className={`flex justify-between items-center ${isOverdue ? 'border-l-4 border-red-500' : ''}`}
                    >
                      <div>
                        <h3 className="font-medium">{bill.description}</h3>
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          {bill.category} • Due: {formatDate(bill.due_date)}
                          {isOverdue && <span className="text-red-500 ml-2">OVERDUE</span>}
                        </div>
                      </div>
                      <div className="flex items-center space-x-3">
                        <div className="font-semibold">{formatINR(bill.amount)}</div>
                        <button 
                          onClick={() => markBillAsPaidLocal(bill.id)}
                          className="p-1 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 rounded hover:bg-green-200 dark:hover:bg-green-800"
                          title="Mark as paid"
                        >
                          ✓
                        </button>
                        <button 
                          onClick={() => deleteBillReminderLocal(bill.id)}
                          className="p-1 bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 rounded hover:bg-red-200 dark:hover:bg-red-800"
                          title="Delete bill reminder"
                        >
                          ✕
                        </button>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}
          
          {paidBills.length > 0 && (
            <div>
              <h3 className="font-medium mb-2">Paid Bills</h3>
              <div className="space-y-3">
                {paidBills.map(bill => (
                  <Card key={bill.id} className="flex justify-between items-center opacity-70">
                    <div>
                      <h3 className="font-medium">{bill.description}</h3>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        {bill.category} • Paid • Due: {formatDate(bill.due_date)}
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <div className="font-semibold">{formatINR(bill.amount)}</div>
                      <button 
                        onClick={() => deleteBillReminderLocal(bill.id)}
                        className="p-1 bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 rounded hover:bg-red-200 dark:hover:bg-red-800"
                        title="Delete bill reminder"
                      >
                        ✕
                      </button>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}
          
          {billReminders.length === 0 && (
            <Card className="text-center py-8 text-gray-500 dark:text-gray-400">
              <p>No bill reminders set up yet.</p>
              <button 
                onClick={() => setShowAddForm(true)}
                className="mt-2 text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                Add your first bill reminder
              </button>
            </Card>
          )}
        </div>
      </div>
    );
  };
  
  const AccountStatementPage = () => {
    const statement = generateStatement();
    
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold">Account Statement</h2>
          <button 
            onClick={() => setCurrentPage("dashboard")}
            className="px-3 py-1 bg-gray-200 dark:bg-gray-800 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-700 text-sm"
          >
            Back
          </button>
        </div>
        
        <Card>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4">
            <div>
              <h3 className="font-medium">Statement Period</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {formatDate(dateRange.start)} to {formatDate(dateRange.end)}
              </p>
            </div>
            <div className="mt-2 sm:mt-0 flex space-x-2">
              <div>
                <label className="block text-xs mb-1">From</label>
                <input 
                  type="date" 
                  value={dateRange.start} 
                  onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))} 
                  className="p-1 text-sm border rounded dark:bg-gray-800 dark:border-gray-700" 
                />
              </div>
              <div>
                <label className="block text-xs mb-1">To</label>
                <input 
                  type="date" 
                  value={dateRange.end} 
                  onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))} 
                  className="p-1 text-sm border rounded dark:bg-gray-800 dark:border-gray-700" 
                />
              </div>
            </div>
          </div>
          
          <div className="border-t dark:border-gray-800 pt-4">
            <div className="flex justify-between font-medium mb-2 text-sm">
              <div>Account Number</div>
              <div>{accountNumber || user?.email?.split('@')[0] || 'N/A'}</div>
            </div>
            <div className="flex justify-between font-medium mb-4 text-sm">
              <div>Account Holder</div>
              <div>{user?.user_metadata?.full_name || user?.email || 'N/A'}</div>
            </div>
            
            <div className="flex justify-between font-semibold mb-2 pb-2 border-b dark:border-gray-800">
              <div>Current Balance</div>
              <div>{formatINR(balance)}</div>
            </div>
          </div>
          
          {statement.length > 0 ? (
            <div className="mt-4">
              <h3 className="font-medium mb-2">Transaction History</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left border-b dark:border-gray-800">
                      <th className="pb-2">Date</th>
                      <th className="pb-2">Description</th>
                      <th className="pb-2">Category</th>
                      <th className="pb-2 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {statement.map(txn => (
                      <tr key={txn.id} className="border-b dark:border-gray-800">
                        <td className="py-2">{formatDate(txn.date)}</td>
                        <td className="py-2">{txn.description}</td>
                        <td className="py-2">{txn.category}</td>
                        <td className={`py-2 text-right ${txn.amount >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                          {formatINR(txn.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              <div className="mt-4 flex justify-end">
                <button 
                  onClick={() => window.print()}
                  className="px-3 py-1 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm"
                >
                  Print Statement
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <p>No transactions found for the selected period.</p>
            </div>
          )}
        </Card>
      </div>
    );
  };
  
  const ProfilePage = () => {
    const [showEdit, setShowEdit] = useState(false);
    const [newName, setNewName] = useState(user?.user_metadata?.full_name || '');
    const [newEmail, setNewEmail] = useState(user?.email || '');
    const [newImage, setNewImage] = useState(profileImage);
    
    const handleSave = async () => {
      // In a real app, you would update the user metadata with Supabase
      alert("Profile would be updated in a real implementation");
      setShowEdit(false);
    };
    
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold">Profile</h2>
          <button 
            onClick={() => setCurrentPage("dashboard")}
            className="px-3 py-1 bg-gray-200 dark:bg-gray-800 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-700 text-sm"
          >
            Back
          </button>
        </div>
        
        <Card>
          <div className="flex flex-col items-center">
            <div className="w-24 h-24 rounded-full bg-gray-200 dark:bg-gray-800 relative">
              {newImage ? (
                <img src={newImage} alt="Profile" className="w-full h-full rounded-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-4xl font-bold text-gray-500 dark:text-gray-400">
                  {newName?.[0]?.toUpperCase() || newEmail?.[0]?.toUpperCase() || "U"}
                </div>
              )}
              <button 
                onClick={() => setShowEdit(true)}
                className="absolute bottom-0 right-0 bg-indigo-600 text-white rounded-full p-2"
              >
                ✒️
              </button>
            </div>
            <h3 className="font-medium mt-2">{newName || newEmail}</h3>
          </div>
        </Card>
        
        {showEdit && (
          <Card>
            <form onSubmit={handleSave} className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">Full Name</label>
                <input 
                  type="text" 
                  value={newName} 
                  onChange={(e) => setNewName(e.target.value)} 
                  className="w-full p-2 border rounded dark:bg-gray-800 dark:border-gray-700" 
                  required 
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Email</label>
                <input 
                  type="email" 
                  value={newEmail} 
                  onChange={(e) => setNewEmail(e.target.value)} 
                  className="w-full p-2 border rounded dark:bg-gray-800 dark:border-gray-700" 
                  required 
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Profile Image</label>
                <input 
                  type="file" 
                  accept="image/*" 
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = (ev) => setNewImage(ev.target.result);
                      reader.readAsDataURL(file);
                    }
                  }} 
                  className="w-full p-2 border rounded dark:bg-gray-800 dark:border-gray-700" 
                />
              </div>
              <div className="flex justify-end gap-2">
                <button 
                  className="px-3 py-2 rounded-lg bg-gray-200 dark:bg-gray-800" 
                  onClick={() => setShowEdit(false)}
                  type="button"
                >
                  Cancel
                </button>
                <button className="px-3 py-2 rounded-lg bg-indigo-600 text-white" type="submit">Save</button>
              </div>
            </form>
          </Card>
        )}
      </div>
    );
  };
  
  // Show splash screen initially
  if (currentPage === 'splash' || !splashComplete) {
    return <SplashScreen onSplashComplete={() => {
      setSplashComplete(true);
      // If user is authenticated, go to dashboard, otherwise go to home
      if (user) {
        setCurrentPage('dashboard');
      } else {
        setCurrentPage('home');
      }
    }} />;
  }

  // Show login screen
  if (currentPage === 'login') {
    return <LoginScreen onRegisterClick={() => setCurrentPage('signup')} onLoginSuccess={handleLoginSuccess} />;
  }

  // Show signup screen
  if (currentPage === 'signup') {
    return <SignupScreen onLoginClick={() => setCurrentPage('login')} onSignupSuccess={handleSignupSuccess} />;
  }

  // Show home screen when not authenticated
  if (currentPage === 'home' && !user) {
    return <HomeScreen onLogin={() => setCurrentPage('login')} onRegister={() => setCurrentPage('signup')} />;
  }

  // Fallback - if we get here and don't match any conditions, go to home
  if (!user) {
    console.log('Fallback: No user, going to home');
    setCurrentPage('home');
    return null; // Return null while state updates
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100">
      <div className="max-w-md mx-auto p-4 pb-24">
        <Header 
          user={user} 
          onSettings={() => setCurrentPage("settings")} 
          onLogout={() => setShowLogout(true)} 
          onProfileClick={() => setCurrentPage("profile")}
          profileImage={profileImage}
        />
        <main className="mt-4 space-y-4">
          {currentPage === "dashboard" && user && (
            <Dashboard 
              user={user} 
              transactions={transactions} 
              onAdd={addTransaction} 
              onRecurringPayments={() => setCurrentPage("recurringPayments")} 
              onBillReminders={() => setCurrentPage("billReminders")} 
              onStatements={() => setCurrentPage("statements")} 
              onProfileClick={() => setCurrentPage("profile")}
              profileImage={profileImage}
              showBalance={showBalance}
              setShowBalance={setShowBalance}
              balance={balance}
              setBalance={setBalance}
              accountNumber={accountNumber}
              setAccountNumber={setAccountNumber}
              accountId={accountId}
              setAccountId={setAccountId}
              showBalancePopup={showBalancePopup}
              setShowBalancePopup={setShowBalancePopup}
              newBalance={newBalance}
              setNewBalance={setNewBalance}
            />
          )}
          {currentPage === "profile" && user && (
            <div key="profile-page-container">
              <ProfilePage 
                onBack={() => setCurrentPage("dashboard")}
                onThemeToggle={toggleTheme}
                currentTheme={theme}
                onProfileImageChange={handleProfileImageChange}
                profileImage={profileImage}
                accountNumber={accountNumber}
                balance={balance}
              />
            </div>
          )}
          {currentPage === "recurringPayments" && user && <RecurringPaymentsPage />}
          {currentPage === "billReminders" && user && <BillRemindersPage />}
          {currentPage === "statements" && user && <AccountStatementPage />}
          {currentPage === "settings" && user && (
            <Settings
              user={user}
              onBack={() => setCurrentPage("dashboard")}
              onForgot={() => setCurrentPage("forgot")}
              onExport={exportJSON}
              onImport={importJSON}
              onDelete={() => setShowDelete(true)}
            />
          )}
          {currentPage === "forgot" && user && (
            <ForgotPassword
              onBack={() => setCurrentPage("settings")}
              onSave={async (newPw) => {
                // In a real app, you would update the password with Supabase
                alert("Password would be updated in a real implementation");
                setCurrentPage("settings");
              }}
            />
          )}
        </main>
      </div>

      {/* Fabulous confirmation dialogs */}
      <Modal open={showLogout} onClose={() => setShowLogout(false)} title="Confirm Logout">
        <p className="text-sm opacity-80 mb-3">Confirm logout from your account.</p>
        <div className="flex justify-end gap-2 mt-4">
          <button className="px-4 py-2 rounded-lg bg-gray-200 dark:bg-gray-800" onClick={() => setShowLogout(false)}>Cancel</button>
          <button className="px-4 py-2 rounded-lg bg-indigo-600 text-white" onClick={handleLogoutConfirmed}>Logout</button>
        </div>
      </Modal>

      <Modal open={showDelete} onClose={() => setShowDelete(false)} title="Delete Account" danger>
        <p className="text-sm opacity-90 mb-3">This action is irreversible. All local data will be erased.</p>
        <input value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} type="password" placeholder="Confirm password" className="w-full p-2 rounded-lg bg-white/90 dark:bg-gray-800 border border-white/20 dark:border-gray-700" />
        <div className="flex justify-end gap-2 mt-4">
          <button className="px-4 py-2 rounded-lg bg-white/20 dark:bg-gray-800/60" onClick={() => setShowDelete(false)}>Cancel</button>
          <button className="px-4 py-2 rounded-lg bg-red-700 text-white" onClick={handleDeleteConfirmed}>Delete</button>
        </div>
      </Modal>
    </div>
  );
}

/******************** Screens *****************************/
function Header({ user, onSettings, onLogout, onProfileClick, profileImage }) {
  const [showDropdown, setShowDropdown] = useState(false);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showDropdown && !event.target.closest('.profile-dropdown')) {
        setShowDropdown(false);
      }
    };
    
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [showDropdown]);

  // Default profile image as a gradient circle
  const defaultProfileImage = (
    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold">
      {user?.user_metadata?.full_name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || "U"}
    </div>
  );

  return (
    <div className="sticky top-0 z-10 backdrop-blur supports-[backdrop-filter]:bg-white/60 dark:supports-[backdrop-filter]:bg-gray-900/60 bg-white/70 dark:bg-gray-900/70 border-b border-gray-200 dark:border-gray-800 rounded-b-xl">
      <div className="max-w-md mx-auto p-4 flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400">{user ? "Welcome back," : "Welcome to"}</p>
          <h1 className="font-bold text-lg">{user ? (user.user_metadata?.full_name || user.email) : "MyBank"}</h1>
        </div>
        <div className="flex items-center gap-2">
          {user && (
            <div className="profile-dropdown relative">
              <button 
                onClick={() => setShowDropdown(!showDropdown)}
                className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white font-bold flex items-center justify-center"
              >
                {profileImage ? (
                  <img src={profileImage} alt="Profile" className="w-10 h-10 rounded-full object-cover" />
                ) : (
                  user.user_metadata?.full_name?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase() || "U"
                )}
              </button>
              
              {showDropdown && (
                <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg py-2 z-20 border border-gray-200 dark:border-gray-700">
                  <button 
                    onClick={() => {
                      onProfileClick();
                      setShowDropdown(false);
                    }}
                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    Profile
                  </button>
                  <button 
                    onClick={() => {
                      onSettings();
                      setShowDropdown(false);
                    }}
                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    Settings
                  </button>
                  <hr className="my-1 border-gray-200 dark:border-gray-700" />
                  <button 
                    onClick={() => {
                      onLogout();
                      setShowDropdown(false);
                    }}
                    className="block w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                  >
                    Logout
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Home({ onLogin, onRegister }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="text-center pt-10">
      <h2 className="text-3xl font-extrabold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent mb-2">MyBank PWA</h2>
      <p className="text-sm opacity-80 mb-6">Personal, offline, private banking app.</p>
      <div className="flex gap-3 justify-center">
        <button onClick={onLogin} className="px-4 py-2 rounded-xl bg-indigo-600 text-white shadow">Login</button>
        <button onClick={onRegister} className="px-4 py-2 rounded-xl bg-gray-200 dark:bg-gray-800">Register</button>
      </div>
    </motion.div>
  );
}

function RegisterForm({ onSubmit, onBack }) {
  const [form, setForm] = useState({ name: "", email: "", password: "", accountNumber: "", initialBalance: "" });
  const handle = (e) => setForm((s) => ({ ...s, [e.target.name]: e.target.value }));
  const canSubmit = form.name && form.email && form.password && form.accountNumber !== "";
  return (
    <Card>
      <BackButton onClick={onBack} />
      <h2 className="text-xl font-bold mt-2 mb-4">Create your secure account</h2>
      <div className="space-y-3">
        <Input label="Full Name" name="name" value={form.name} onChange={handle} placeholder="Alex Doe" />
        <Input label="Email" name="email" type="email" value={form.email} onChange={handle} placeholder="alex@example.com" />
        <Input label="Password" name="password" type="password" value={form.password} onChange={handle} placeholder="••••••••" />
        <Input label="Account Number" name="accountNumber" value={form.accountNumber} onChange={handle} placeholder="1234567890" />
        <Input label="Initial Balance (₹)" name="initialBalance" type="number" value={form.initialBalance} onChange={handle} placeholder="5000" />
      </div>
      <button disabled={!canSubmit} onClick={() => onSubmit(form)} className="mt-4 w-full px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white disabled:opacity-50">Sign Up</button>
    </Card>
  );
}

function LoginForm({ onSubmit, onBack }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  return (
    <Card>
      <BackButton onClick={onBack} />
      <h2 className="text-xl font-bold mt-2 mb-4">Log in</h2>
      <div className="space-y-3">
        <Input label="Email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="alex@example.com" />
        <Input label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
      </div>
      <button onClick={() => onSubmit(email, password)} className="mt-4 w-full px-4 py-2 rounded-xl bg-indigo-600 text-white">Login</button>
    </Card>
  );
}

function Dashboard({ user, transactions, onAdd, onRecurringPayments, onBillReminders, onStatements, 
                   onProfileClick, profileImage, showBalance, setShowBalance, balance, setBalance, 
                   accountNumber, setAccountNumber, accountId, setAccountId,
                   showBalancePopup, setShowBalancePopup, newBalance, setNewBalance }) {
  const total = balance || 0;
  const recent = useMemo(() => [...transactions].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5), [transactions]);
  
  // State for transaction editing
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [editForm, setEditForm] = useState({ type: 'expense', amount: '', description: '', category: 'Food' });
  
  // State for account number visibility
  const [showAccountNumber, setShowAccountNumber] = useState(true);

  const handleSaveBalance = async () => {
    const balanceValue = parseFloat(newBalance);
    if (!isNaN(balanceValue) && user) {
      if (accountId) {
        // Update existing account
        const updatedAccount = await updateSupabaseAccount(accountId, {
          balance: balanceValue,
          account_number: accountNumber
        });
        if (updatedAccount) {
          setBalance(balanceValue);
          setAccountId(updatedAccount.id);
        }
      } else {
        // Create new account with the balance and account number
        const newAccount = await createSupabaseAccount({
          owner_email: user.email,
          balance: balanceValue,
          account_number: accountNumber
        });
        if (newAccount) {
          setBalance(balanceValue);
          setAccountId(newAccount.id);
        }
      }
      setShowBalancePopup(false);
      setNewBalance('');
    }
  };

  // Function to start editing a transaction
  const startEditingTransaction = (transaction) => {
    setEditingTransaction(transaction);
    setEditForm({
      type: transaction.type,
      amount: Math.abs(transaction.amount),
      description: transaction.description,
      category: transaction.category
    });
  };

  // Function to save edited transaction
  const saveEditedTransaction = async () => {
    if (!editingTransaction || !user) return;
    
    try {
      // Calculate the new amount based on type
      const amountValue = Number(editForm.amount) * (editForm.type === "expense" ? -1 : 1);
      
      // Update local state immediately for instant UI feedback
      const oldTransaction = { ...editingTransaction };
      const updatedLocalTransaction = {
        ...editingTransaction,
        type: editForm.type,
        amount: amountValue,
        description: editForm.description,
        category: editForm.category
      };
      
      setTransactions(prev => prev.map(t => 
        t.id === editingTransaction.id ? updatedLocalTransaction : t
      ));
      
      // Update balance immediately if needed
      let newBalance = balance;
      if (accountId) {
        // Calculate the difference
        const oldAmount = editingTransaction.amount;
        const newAmount = amountValue;
        const difference = newAmount - oldAmount;
        
        newBalance = balance + difference;
        setBalance(newBalance);
      }
      
      // Close edit modal immediately
      setEditingTransaction(null);
      
      // Update in Supabase in the background
      const updatedTransaction = await updateTransaction(editingTransaction.id, {
        type: editForm.type,
        amount: amountValue,
        description: editForm.description,
        category: editForm.category
      });
      
      if (updatedTransaction) {
        // If Supabase update was successful, ensure local state matches
        setTransactions(prev => prev.map(t => 
          t.id === editingTransaction.id ? { ...updatedTransaction } : t
        ));
        
        // Update balance in Supabase in the background
        if (accountId) {
          await updateSupabaseAccount(accountId, { balance: newBalance });
        }
      } else {
        // If Supabase update failed, revert local changes
        setTransactions(prev => prev.map(t => 
          t.id === editingTransaction.id ? oldTransaction : t
        ));
        if (accountId) {
          setBalance(balance);
        }
      }
    } catch (error) {
      console.error('Error updating transaction:', error);
    }
  };

  // Function to delete a transaction
  const handleDeleteTransaction = (id) => {
    if (!user) return;
    
    // Find the transaction to delete
    const transactionToDelete = transactions.find(t => t.id === id);
    if (!transactionToDelete) return;
    
    // Update local state immediately for instant UI feedback
    setTransactions(prev => prev.filter(t => t.id !== id));
    
    // Update balance immediately for instant UI feedback
    let newBalance = balance;
    if (accountId) {
      const amountValue = transactionToDelete.amount;
      newBalance = balance - amountValue;
      setBalance(newBalance);
    }
    
    // Delete from Supabase in the background (don't wait for result)
    deleteSupabaseTransaction(id)
      .then(async (success) => {
        if (!success) {
          console.error('Failed to delete transaction from Supabase');
          // Revert the UI changes if deletion failed
          setTransactions(prev => [...prev, transactionToDelete]);
          if (accountId) {
            setBalance(balance);
          }
          // Show error message to user
          alert('Failed to delete transaction. Please try again.');
        } else {
          // Update balance in Supabase in the background
          if (accountId) {
            try {
              await updateSupabaseAccount(accountId, { balance: newBalance });
            } catch (error) {
              console.error('Error updating account balance:', error);
            }
          }
        }
      })
      .catch(error => {
        console.error('Error deleting transaction:', error);
        // Revert the UI changes if deletion failed
        setTransactions(prev => [...prev, transactionToDelete]);
        if (accountId) {
          setBalance(balance);
        }
        // Show error message to user
        alert('Error deleting transaction. Please try again.');
      });
  };

  // State for delete confirmation modal
  const [transactionToDelete, setTransactionToDelete] = useState(null);
  
  // Function to confirm deletion
  const confirmDeleteTransaction = (id) => {
    const transaction = transactions.find(t => t.id === id);
    if (transaction) {
      setTransactionToDelete(transaction);
    }
  };
  
  // Function to actually delete after confirmation
  const executeDeleteTransaction = () => {
    if (transactionToDelete) {
      handleDeleteTransaction(transactionToDelete.id);
      setTransactionToDelete(null);
    }
  };

  // Load account number from localStorage on component mount
  useEffect(() => {
    const savedAccountNumber = localStorage.getItem('accountNumber');
    if (savedAccountNumber) {
      setAccountNumber(savedAccountNumber);
    }
  }, []);

  return (
    <div className="space-y-4">
      {/* Edit Transaction Modal */}
      {editingTransaction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden">
            <div className="px-4 py-3 border-b dark:border-gray-700 bg-gradient-to-r from-indigo-600 to-purple-600 text-white">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Edit Transaction</h3>
                <button 
                  onClick={() => setEditingTransaction(null)}
                  className="opacity-90 hover:opacity-100"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="p-4">
              <div className="grid gap-3">
                <div className="grid grid-cols-2 gap-2">
                  <button 
                    className={`px-3 py-2 rounded-lg ${editForm.type === "expense" ? "bg-red-500 text-white" : "bg-gray-200 dark:bg-gray-800"}`} 
                    onClick={() => setEditForm(prev => ({ ...prev, type: "expense" }))}
                  >
                    Expense
                  </button>
                  <button 
                    className={`px-3 py-2 rounded-lg ${editForm.type === "income" ? "bg-green-600 text-white" : "bg-gray-200 dark:bg-gray-800"}`} 
                    onClick={() => setEditForm(prev => ({ ...prev, type: "income" }))}
                  >
                    Income
                  </button>
                </div>
                <Input 
                  label="Amount (₹)" 
                  type="number" 
                  value={editForm.amount} 
                  onChange={(e) => setEditForm(prev => ({ ...prev, amount: e.target.value }))} 
                />
                <Input 
                  label="Description" 
                  value={editForm.description} 
                  onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))} 
                />
                <label className="block">
                  <span className="block text-xs mb-1 opacity-80">Category</span>
                  <select 
                    value={editForm.category} 
                    onChange={(e) => setEditForm(prev => ({ ...prev, category: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-800 bg-white dark:bg-gray-900 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {["Food", "Rent", "Bills", "Shopping", "Income", "Entertainment", "Travel"].map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </label>
                <div className="flex justify-end gap-2">
                  <button 
                    className="px-3 py-2 rounded-lg bg-gray-200 dark:bg-gray-800" 
                    onClick={() => setEditingTransaction(null)}
                  >
                    Cancel
                  </button>
                  <button 
                    className="px-3 py-2 rounded-lg bg-indigo-600 text-white" 
                    onClick={saveEditedTransaction}
                  >
                    Save
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Balance Popup Modal */}
      {showBalancePopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden">
            <div className="px-4 py-3 border-b dark:border-gray-700 bg-gradient-to-r from-indigo-600 to-purple-600 text-white">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Set Your Account Details</h3>
                <button 
                  onClick={() => setShowBalancePopup(false)}
                  className="opacity-90 hover:opacity-100"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="p-4">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Enter your account number and current balance to get started.
              </p>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">Account Number</label>
                <input 
                  type="text" 
                  value={accountNumber} 
                  onChange={(e) => setAccountNumber(e.target.value)} 
                  className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
                  placeholder="Enter your account number"
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">Current Balance (₹)</label>
                <input 
                  type="number" 
                  value={newBalance} 
                  onChange={(e) => setNewBalance(e.target.value)} 
                  className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
                  placeholder="0.00"
                  step="0.01"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button 
                  className="px-4 py-2 rounded-lg bg-gray-200 dark:bg-gray-700"
                  onClick={() => setShowBalancePopup(false)}
                >
                  Cancel
                </button>
                <button 
                  className="px-4 py-2 rounded-lg bg-indigo-600 text-white"
                  onClick={handleSaveBalance}
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {transactionToDelete && (
        <Modal open={true} onClose={() => setTransactionToDelete(null)} title="Confirm Deletion" danger>
          <div className="space-y-3">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Are you sure you want to delete the transaction "{transactionToDelete.description}"? 
              This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button 
                className="px-4 py-2 rounded-lg bg-gray-200 dark:bg-gray-700"
                onClick={() => setTransactionToDelete(null)}
              >
                Cancel
              </button>
              <button 
                className="px-4 py-2 rounded-lg bg-red-600 text-white"
                onClick={executeDeleteTransaction}
              >
                Delete
              </button>
            </div>
          </div>
        </Modal>
      )}

      <Card className="bg-gradient-to-br from-indigo-600 to-purple-600 text-white relative">
        <div className="flex justify-between items-start">
          <div>
            <p className="opacity-80">Total Balance</p>
            <p className="text-4xl font-extrabold tracking-tight">
              {showBalance ? formatINR(total) : '••••••'}
            </p>
            <p className="text-xs mt-1 opacity-80 flex items-center">
              Acct: 
              <span className="ml-1">
                {showAccountNumber ? (accountNumber || user?.email?.split('@')[0] || 'N/A') : '••••••'}
              </span>
              <button 
                onClick={() => setShowAccountNumber(!showAccountNumber)}
                className="ml-2 p-1 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
              >
                {showAccountNumber ? (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                    <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z" clipRule="evenodd" />
                    <path d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.741L2.335 6.578A9.98 9.98 0 00.458 10c1.274 4.057 5.065 7 9.542 7 .847 0 1.669-.105 2.454-.303z" />
                  </svg>
                )}
              </button>
            </p>
          </div>
          <div className="flex space-x-2">
            <button 
              onClick={() => setShowBalance(!showBalance)}
              className="p-2 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
            >
              {showBalance ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                  <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z" clipRule="evenodd" />
                  <path d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.741L2.335 6.578A9.98 9.98 0 00.458 10c1.274 4.057 5.065 7 9.542 7 .847 0 1.669-.105 2.454-.303z" />
                </svg>
              )}
            </button>
            <button 
              onClick={() => setShowBalancePopup(true)}
              className="p-2 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>
      </Card>

      {/* Banking Features */}
      <Card>
        <h3 className="font-semibold mb-3">Banking Features</h3>
        <div className="grid grid-cols-3 gap-2">
          <button 
            onClick={onRecurringPayments}
            className="p-2 rounded-lg bg-indigo-100 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-200 text-sm font-medium flex flex-col items-center justify-center"
          >
            <span className="text-xl mb-1">🔄</span>
            <span>Recurring Payments</span>
          </button>
          <button 
            onClick={onBillReminders}
            className="p-2 rounded-lg bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 text-sm font-medium flex flex-col items-center justify-center"
          >
            <span className="text-xl mb-1">📅</span>
            <span>Bill Reminders</span>
          </button>
          <button 
            onClick={onStatements}
            className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 text-sm font-medium flex flex-col items-center justify-center"
          >
            <span className="text-xl mb-1">📊</span>
            <span>Statements</span>
          </button>
        </div>
      </Card>

      <Card>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">Recent Transactions</h3>
          <AddTxn onAdd={onAdd} balance={balance} />
        </div>
        {recent.length === 0 ? (
          <p className="text-sm opacity-70">No transactions yet.</p>
        ) : (
          <ul className="divide-y divide-gray-200 dark:divide-gray-800">
            {recent.map((t) => (
              <li key={t.id} className="py-2 flex items-center justify-between">
                <div>
                  <p className="font-medium">{t.description}</p>
                  <p className="text-xs opacity-70">{new Date(t.date).toLocaleDateString()} • {t.category}</p>
                </div>
                <div className="flex items-center space-x-2">
                  <span className={`font-semibold ${t.amount < 0 ? "text-red-600" : "text-green-600"}`}>
                    {t.amount < 0 ? "-" : "+"}{formatINR(Math.abs(t.amount))}
                  </span>
                  <div className="flex space-x-1">
                    <button 
                      onClick={() => startEditingTransaction(t)}
                      className="p-1 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900 rounded"
                      title="Edit transaction"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                      </svg>
                    </button>
                    <button 
                      onClick={() => confirmDeleteTransaction(t.id)}
                      className="p-1 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900 rounded"
                      title="Delete transaction"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Analytics transactions={transactions} />
    </div>
  );
}

function Settings({ user, onBack, onForgot, onExport, onImport, onDelete }) {
  const fileRef = useRef(null);
  return (
    <div className="space-y-4">
      <Card>
        <BackButton onClick={onBack} />
        <h2 className="text-xl font-bold mt-2 mb-1">Settings</h2>
        <p className="text-sm opacity-70 mb-3">Manage your account & data</p>
        <div className="grid grid-cols-1 gap-2">
          <button onClick={onForgot} className="px-3 py-2 rounded-lg bg-indigo-600 text-white">Forgot / Change Password</button>
          <button onClick={onDelete} className="px-3 py-2 rounded-lg bg-red-600 text-white">Delete Account</button>
        </div>
      </Card>

      <Card>
        <h3 className="font-semibold mb-2">Data Management</h3>
        <div className="flex gap-2">
          <button onClick={onExport} className="px-3 py-2 rounded-lg bg-gray-200 dark:bg-gray-800">Export Data (JSON)</button>
          <button onClick={() => fileRef.current?.click()} className="px-3 py-2 rounded-lg bg-gray-200 dark:bg-gray-800">Import Transactions (JSON)</button>
          <input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={(e) => e.target.files?.[0] && onImport(e.target.files[0])} />
        </div>
        <p className="text-xs opacity-70 mt-2">Import expects a JSON with a `transactions` array.</p>
      </Card>
    </div>
  );
}

function ForgotPassword({ onBack, onSave }) {
  const [npw, setNpw] = useState("");
  const [cpw, setCpw] = useState("");
  const can = npw.length >= 4 && npw === cpw;
  return (
    <Card>
      <BackButton onClick={onBack} />
      <h2 className="text-xl font-bold mt-2 mb-4">Reset Password</h2>
      <div className="space-y-3">
        <Input label="New Password" type="password" value={npw} onChange={(e) => setNpw(e.target.value)} placeholder="New password" />
        <Input label="Confirm Password" type="password" value={cpw} onChange={(e) => setCpw(e.target.value)} placeholder="Confirm password" />
      </div>
      <button disabled={!can} onClick={() => onSave(npw)} className="mt-4 w-full px-4 py-2 rounded-xl bg-indigo-600 text-white disabled:opacity-50">Save</button>
    </Card>
  );
}

/******************** Widgets *****************************/
function Input({ label, className = "", ...rest }) {
  return (
    <label className="block">
      <span className="block text-xs mb-1 opacity-80">{label}</span>
      <input className={`w-full rounded-lg border border-gray-300 dark:border-gray-800 bg-white dark:bg-gray-900 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 ${className}`} {...rest} />
    </label>
  );
}

function AddTxn({ onAdd, balance }) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState("expense");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Food");
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  // Show toast message
  const showToastMessage = (message) => {
    setToastMessage(message);
    setShowToast(true);
    setTimeout(() => {
      setShowToast(false);
      setToastMessage("");
    }, 3000);
  };

  const handleAdd = () => {
    // Validate amount for expense transactions
    if (type === "expense") {
      const amountValue = Number(amount);
      if (amountValue > balance) {
        showToastMessage("Insufficient balance for this transaction!");
        return;
      }
    }
    
    onAdd({ type, amount, description, category });
    setOpen(false);
    // Reset form
    setAmount("");
    setDescription("");
    setCategory("Food");
  };

  return (
    <>
      {/* Toast message */}
      {showToast && (
        <div className="fixed top-4 right-4 z-50 bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg">
          {toastMessage}
        </div>
      )}
      
      <button onClick={() => setOpen(true)} className="px-3 py-2 rounded-lg bg-indigo-600 text-white">+ Add</button>
      <Modal open={open} onClose={() => setOpen(false)} title="Add Transaction">
        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-2">
            <button className={`px-3 py-2 rounded-lg ${type === "expense" ? "bg-red-500 text-white" : "bg-gray-200 dark:bg-gray-800"}`} onClick={() => setType("expense")}>Expense</button>
            <button className={`px-3 py-2 rounded-lg ${type === "income" ? "bg-green-600 text-white" : "bg-gray-200 dark:bg-gray-800"}`} onClick={() => setType("income")}>Income</button>
          </div>
          <Input label="Amount (₹)" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <Input label="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
          <label className="block">
            <span className="block text-xs mb-1 opacity-80">Category</span>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full rounded-lg border border-gray-300 dark:border-gray-800 bg-white dark:bg-gray-900 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500">
              {["Food", "Rent", "Bills", "Shopping", "Income", "Entertainment", "Travel"].map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </label>
          <div className="flex justify-end gap-2">
            <button className="px-3 py-2 rounded-lg bg-gray-200 dark:bg-gray-800" onClick={() => setOpen(false)}>Cancel</button>
            <button className="px-3 py-2 rounded-lg bg-indigo-600 text-white" onClick={handleAdd}>Add</button>
          </div>
        </div>
      </Modal>
    </>
  );
}

function Analytics({ transactions }) {
  const spending = useMemo(() => {
    const byCat = {};
    for (const t of transactions) {
      if (t.amount < 0) {
        byCat[t.category] = (byCat[t.category] || 0) + Math.abs(t.amount);
      }
    }
    return Object.entries(byCat).map(([name, value]) => ({ name, value }));
  }, [transactions]);

  const monthly = useMemo(() => {
    const byMonth = {};
    for (const t of transactions) {
      const key = new Date(t.date).toLocaleString("default", { month: "short" });
      if (!byMonth[key]) byMonth[key] = { name: key, income: 0, expense: 0 };
      if (t.amount >= 0) byMonth[key].income += t.amount; else byMonth[key].expense += Math.abs(t.amount);
    }
    // ensure stable order (latest first)
    const order = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    return order.filter((m) => byMonth[m]).map((m) => byMonth[m]);
  }, [transactions]);

  const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884d8", "#ef4444", "#22c55e"]; // nice palette

  return (
    <div className="space-y-4">
      <Card>
        <h3 className="font-semibold text-center mb-2">Spending by Category</h3>
        <div style={{ width: "100%", height: 260 }}>
          <ResponsiveContainer>
            <PieChart>
              <Pie data={spending} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                {spending.map((entry, idx) => (
                  <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v) => formatINR(v)} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card>
        <h3 className="font-semibold text-center mb-2">Income vs Expense</h3>
        <div style={{ width: "100%", height: 280 }}>
          <ResponsiveContainer>
            <BarChart data={monthly}>
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip formatter={(v) => formatINR(v)} />
              <Legend />
              <Bar dataKey="income" fill="#22c55e" />
              <Bar dataKey="expense" fill="#ef4444" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}

/******************** END ********************************/

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}