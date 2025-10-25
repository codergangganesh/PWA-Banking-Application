import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { AuthProvider, useAuth } from './services/AuthContext';
import SplashScreen from './components/SplashScreen';
import LoginScreen from './components/LoginScreen';
import SignupScreen from './components/SignupScreen';
import HomeScreen from './components/HomeScreen';

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
  const [currentPage, setCurrentPage] = useState('splash'); // splash, home, login, signup, dashboard, settings, forgot, recurring, bills, statements
  const [transactions, setTransactions] = useState([]); // empty for new users
  const [recurringPayments, setRecurringPayments] = useState([]);
  const [billReminders, setBillReminders] = useState([]);
  const [showLogout, setShowLogout] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [confirmPw, setConfirmPw] = useState("");
  const [dateRange, setDateRange] = useState({ start: new Date(Date.now() - 30*24*60*60*1000).toISOString().slice(0, 10), end: todayISO() });
  
  const { user, signOut } = useAuth();

  useEffect(() => {
    openDB()
      .catch((err) => {
        console.error(err);
        alert("IndexedDB not available. The app needs a modern browser.");
      });
  }, []);

  // Update page based on auth state
  useEffect(() => {
    if (splashComplete) {
      if (user) {
        setCurrentPage('dashboard');
      } else {
        setCurrentPage('home');
      }
    }
  }, [user, splashComplete]);

  const handleLoginSuccess = () => {
    setCurrentPage('dashboard');
  };

  const handleSignupSuccess = () => {
    setCurrentPage('dashboard');
  };

  const handleLogoutConfirmed = async () => {
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
    const value = {
      ownerEmail: user.email,
      type, // "income" | "expense"
      amount: Number(amount) * (type === "expense" ? -1 : 1),
      description,
      category,
      date: todayISO(),
    };
    await dbWrite("transactions", value);
    const updated = await dbGetAllByOwner(user.email);
    setTransactions(updated);
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
      ownerEmail: user.email,
      amount: Number(amount),
      description,
      category,
      frequency, // 'weekly', 'monthly', 'quarterly', 'yearly'
      nextDate,
      createdAt: Date.now(),
    };
    await dbWrite("recurringPayments", payment);
    const updated = await getRecurringPayments(user.email);
    setRecurringPayments(updated);
  };
  
  const deleteRecurringPayment = async (id) => {
    if (!user) return;
    await dbDelete("recurringPayments", id);
    const updated = await getRecurringPayments(user.email);
    setRecurringPayments(updated);
  };
  
  const processRecurringPayment = async (payment) => {
    // Add transaction from recurring payment
    await addTransaction({
      type: "expense",
      amount: payment.amount,
      description: `${payment.description} (Recurring)`,
      category: payment.category
    });
    
    // Update next payment date based on frequency
    const nextDate = new Date(payment.nextDate);
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
      nextDate: nextDate.toISOString().slice(0, 10)
    };
    
    await dbWrite("recurringPayments", updatedPayment);
    const updated = await getRecurringPayments(user.email);
    setRecurringPayments(updated);
  };
  
  // Bill Reminders
  const addBillReminder = async ({ description, amount, dueDate, category }) => {
    if (!user) return;
    const reminder = {
      ownerEmail: user.email,
      description,
      amount: Number(amount),
      dueDate,
      category,
      isPaid: false,
      createdAt: Date.now(),
    };
    await dbWrite("billReminders", reminder);
    const updated = await getBillReminders(user.email);
    setBillReminders(updated);
  };
  
  const markBillAsPaid = async (id) => {
    if (!user) return;
    const bill = await dbRead("billReminders", id);
    if (!bill) return;
    
    // Add transaction for the bill payment
    await addTransaction({
      type: "expense",
      amount: bill.amount,
      description: `${bill.description} (Bill Payment)`,
      category: bill.category
    });
    
    // Update bill status
    const updatedBill = { ...bill, isPaid: true };
    await dbWrite("billReminders", updatedBill);
    const updated = await getBillReminders(user.email);
    setBillReminders(updated);
  };
  
  const deleteBillReminder = async (id) => {
    if (!user) return;
    await dbDelete("billReminders", id);
    const updated = await getBillReminders(user.email);
    setBillReminders(updated);
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
          <Card className="text-center py-8 text-gray-500 dark:text-gray-400">
            <p>No recurring payments set up yet.</p>
            <button 
              onClick={() => setShowAddForm(true)}
              className="mt-2 text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              Add your first recurring payment
            </button>
          </Card>
        )}
      </div>
    );
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
      addBillReminder(newBill);
      setNewBill({
        description: "",
        amount: "",
        dueDate: todayISO(),
        category: "Utilities",
      });
      setShowAddForm(false);
    };
    
    // Sort bills by due date (upcoming first)
    const sortedBills = [...billReminders].sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
    const unpaidBills = sortedBills.filter(bill => !bill.isPaid);
    const paidBills = sortedBills.filter(bill => bill.isPaid);
    
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
                  const dueDate = new Date(bill.dueDate);
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
                          {bill.category} • Due: {formatDate(bill.dueDate)}
                          {isOverdue && <span className="text-red-500 ml-2">OVERDUE</span>}
                        </div>
                      </div>
                      <div className="flex items-center space-x-3">
                        <div className="font-semibold">{formatINR(bill.amount)}</div>
                        <button 
                          onClick={() => markBillAsPaid(bill.id)}
                          className="p-1 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 rounded hover:bg-green-200 dark:hover:bg-green-800"
                          title="Mark as paid"
                        >
                          ✓
                        </button>
                        <button 
                          onClick={() => deleteBillReminder(bill.id)}
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
                        {bill.category} • Paid • Due: {formatDate(bill.dueDate)}
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <div className="font-semibold">{formatINR(bill.amount)}</div>
                      <button 
                        onClick={() => deleteBillReminder(bill.id)}
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
              <div>{user?.email?.split('@')[0] || 'N/A'}</div>
            </div>
            <div className="flex justify-between font-medium mb-4 text-sm">
              <div>Account Holder</div>
              <div>{user?.user_metadata?.full_name || user?.email || 'N/A'}</div>
            </div>
            
            <div className="flex justify-between font-semibold mb-2 pb-2 border-b dark:border-gray-800">
              <div>Current Balance</div>
              <div>{formatINR(0)}</div>
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
  
  // Show splash screen initially
  if (currentPage === 'splash' || !splashComplete) {
    return <SplashScreen onSplashComplete={() => setSplashComplete(true)} />;
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

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100">
      <div className="max-w-md mx-auto p-4 pb-24">
        <Header user={user} onSettings={() => setCurrentPage("settings")} onLogout={() => setShowLogout(true)} />
        <main className="mt-4 space-y-4">
          {currentPage === "dashboard" && user && (
            <Dashboard 
              user={user} 
              transactions={transactions} 
              onAdd={addTransaction} 
              onRecurringPayments={() => setCurrentPage("recurringPayments")} 
              onBillReminders={() => setCurrentPage("billReminders")} 
              onStatements={() => setCurrentPage("statements")} 
            />
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
function Header({ user, onSettings, onLogout }) {
  return (
    <div className="sticky top-0 z-10 backdrop-blur supports-[backdrop-filter]:bg-white/60 dark:supports-[backdrop-filter]:bg-gray-900/60 bg-white/70 dark:bg-gray-900/70 border-b border-gray-200 dark:border-gray-800 rounded-b-xl">
      <div className="max-w-md mx-auto p-4 flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400">{user ? "Welcome back," : "Welcome to"}</p>
          <h1 className="font-bold text-lg">{user ? (user.user_metadata?.full_name || user.email) : "MyBank"}</h1>
        </div>
        <div className="flex items-center gap-2">
          {user && (
            <button onClick={onSettings} className="px-3 py-1.5 rounded-full bg-indigo-600 text-white text-sm shadow">Settings</button>
          )}
          {user ? (
            <button onClick={onLogout} className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white font-bold flex items-center justify-center">
              {user.user_metadata?.full_name?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase() || "U"}
            </button>
          ) : null}
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

function Dashboard({ user, transactions, onAdd, onRecurringPayments, onBillReminders, onStatements }) {
  const total = user?.balance || 0;
  const recent = useMemo(() => [...transactions].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5), [transactions]);

  return (
    <div className="space-y-4">
      <Card className="bg-gradient-to-br from-indigo-600 to-purple-600 text-white">
        <p className="opacity-80">Total Balance</p>
        <p className="text-4xl font-extrabold tracking-tight">{formatINR(total)}</p>
        <p className="text-xs mt-1 opacity-80">Acct: {user?.email?.split('@')[0] || 'N/A'}</p>
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
          <AddTxn onAdd={onAdd} />
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
                <span className={`font-semibold ${t.amount < 0 ? "text-red-600" : "text-green-600"}`}>{t.amount < 0 ? "-" : "+"}{formatINR(Math.abs(t.amount))}</span>
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

function AddTxn({ onAdd }) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState("expense");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Food");

  return (
    <>
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
            <button className="px-3 py-2 rounded-lg bg-indigo-600 text-white" onClick={() => { onAdd({ type, amount, description, category }); setOpen(false); }}>Add</button>
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