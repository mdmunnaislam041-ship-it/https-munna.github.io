content://com.android.externalstorage.documents/tree/primary%3AItoshi::primary:Itoshi/server.js
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// In-memory storage (in production, use a proper database)
let users = [];
let transactions = [];

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Helper function to calculate level based on referrals
function calculateLevel(referralCount) {
  if (referralCount >= 50) return 5;
  if (referralCount >= 30) return 4;
  if (referralCount >= 20) return 3;
  if (referralCount >= 10) return 2;
  if (referralCount >= 1) return 1;
  return 0;
}

// Helper function to calculate commission rate
function calculateCommissionRate(level) {
  return 30 + (level * 2); // Base 30% + 2% per level
}

// Register new user
app.post('/api/register', async (req, res) => {
  try {
    const { username, email, password, phone, referralCode } = req.body;

    // Check if user exists
    const existingUser = users.find(u => u.email === email || u.username === username);
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Generate unique referral code
    const userReferralCode = uuidv4().slice(0, 8).toUpperCase();

    // Create new user
    const newUser = {
      id: uuidv4(),
      username,
      email,
      password: hashedPassword,
      phone,
      referralCode: userReferralCode,
      referredBy: null,
      balance: 0,
      referralCount: 0,
      level: 0,
      isActive: false,
      createdAt: new Date()
    };

    // Handle referral
    let referrer = null;
    if (referralCode) {
      referrer = users.find(u => u.referralCode === referralCode);
      if (referrer) {
        newUser.referredBy = referrer.id;
      }
    }

    users.push(newUser);

    res.status(201).json({
      message: 'User registered successfully',
      user: {
        id: newUser.id,
        username: newUser.username,
        email: newUser.email,
        referralCode: newUser.referralCode,
        balance: newUser.balance,
        level: newUser.level,
        isActive: newUser.isActive
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Login user
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = users.find(u => u.email === email);
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        referralCode: user.referralCode,
        balance: user.balance,
        level: user.level,
        referralCount: user.referralCount,
        isActive: user.isActive
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Activate account (payment of 1000 taka)
app.post('/api/activate', async (req, res) => {
  try {
    const { userId, paymentMethod, transactionId } = req.body;

    const user = users.find(u => u.id === userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.isActive) {
      return res.status(400).json({ message: 'Account already active' });
    }

    // Activate user
    user.isActive = true;
    user.balance += 100; // New user gets 100 taka

    // Create transaction record
    const transaction = {
      id: uuidv4(),
      userId: user.id,
      type: 'activation',
      amount: 1000,
      paymentMethod,
      transactionId,
      createdAt: new Date()
    };
    transactions.push(transaction);

    // Handle referral commission
    if (user.referredBy) {
      const referrer = users.find(u => u.id === user.referredBy);
      if (referrer && referrer.isActive) {
        // Update referrer's referral count and level
        referrer.referralCount += 1;
        referrer.level = calculateLevel(referrer.referralCount);
        
        // Calculate commission
        const commissionRate = calculateCommissionRate(referrer.level);
        const commission = (1000 * commissionRate) / 100;
        referrer.balance += commission;

        // Create commission transaction
        const commissionTransaction = {
          id: uuidv4(),
          userId: referrer.id,
          type: 'referral_commission',
          amount: commission,
          fromUser: user.id,
          commissionRate,
          createdAt: new Date()
        };
        transactions.push(commissionTransaction);

        // Handle sub-referral commission (1% to the referrer's referrer)
        if (referrer.referredBy) {
          const subReferrer = users.find(u => u.id === referrer.referredBy);
          if (subReferrer && subReferrer.isActive) {
            const subCommission = (1000 * 1) / 100; // 1% sub-referral commission
            subReferrer.balance += subCommission;

            const subCommissionTransaction = {
              id: uuidv4(),
              userId: subReferrer.id,
              type: 'sub_referral_commission',
              amount: subCommission,
              fromUser: user.id,
              commissionRate: 1,
              createdAt: new Date()
            };
            transactions.push(subCommissionTransaction);
          }
        }
      }
    }

    res.json({
      message: 'Account activated successfully',
      user: {
        id: user.id,
        username: user.username,
        balance: user.balance,
        level: user.level,
        isActive: user.isActive
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get user dashboard data
app.get('/api/dashboard/:userId', (req, res) => {
  try {
    const { userId } = req.params;
    
    const user = users.find(u => u.id === userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const userTransactions = transactions.filter(t => t.userId === userId);
    const referrals = users.filter(u => u.referredBy === userId);

    res.json({
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        referralCode: user.referralCode,
        balance: user.balance,
        level: user.level,
        referralCount: user.referralCount,
        isActive: user.isActive
      },
      transactions: userTransactions,
      referrals: referrals.map(r => ({
        username: r.username,
        email: r.email,
        isActive: r.isActive,
        createdAt: r.createdAt
      }))
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get referral link
app.get('/api/referral-link/:userId', (req, res) => {
  try {
    const { userId } = req.params;
    
    const user = users.find(u => u.id === userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const referralLink = `${req.protocol}://${req.get('host')}/register?ref=${user.referralCode}`;
    
    res.json({ referralLink });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Serve main page
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Itoshi server running on port ${PORT}`);
});
