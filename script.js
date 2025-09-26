// Global variables
let currentUser = null;
const API_BASE = '/api';

// DOM elements
const loginModal = document.getElementById('loginModal');
const registerModal = document.getElementById('registerModal');
const activationModal = document.getElementById('activationModal');
const dashboard = document.getElementById('dashboard');
const mainContent = document.querySelector('main');

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
    bindEvents();
    checkReferralCode();
});

function initializeApp() {
    // Check if user is logged in
    const token = localStorage.getItem('token');
    if (token) {
        // Validate token and load dashboard
        loadDashboard();
    }
}

function bindEvents() {
    // Navigation buttons
    document.getElementById('loginBtn').addEventListener('click', showLoginModal);
    document.getElementById('registerBtn').addEventListener('click', showRegisterModal);
    document.getElementById('heroLogin').addEventListener('click', showLoginModal);
    document.getElementById('heroRegister').addEventListener('click', showRegisterModal);
    
    // Modal close buttons
    document.querySelectorAll('.close').forEach(closeBtn => {
        closeBtn.addEventListener('click', closeModals);
    });
    
    // Click outside modal to close
    window.addEventListener('click', function(e) {
        if (e.target.classList.contains('modal')) {
            closeModals();
        }
    });
    
    // Forms
    document.getElementById('loginForm').addEventListener('submit', handleLogin);
    document.getElementById('registerForm').addEventListener('submit', handleRegister);
    document.getElementById('activationForm').addEventListener('submit', handleActivation);
    
    // Dashboard buttons
    document.getElementById('logoutBtn').addEventListener('click', handleLogout);
    document.getElementById('activateBtn').addEventListener('click', showActivationModal);
    document.getElementById('copyLinkBtn').addEventListener('click', copyReferralLink);
}

function checkReferralCode() {
    const urlParams = new URLSearchParams(window.location.search);
    const ref = urlParams.get('ref');
    if (ref) {
        document.getElementById('registerReferral').value = ref;
        showRegisterModal();
    }
}

// Modal functions
function showLoginModal() {
    closeModals();
    loginModal.style.display = 'block';
}

function showRegisterModal() {
    closeModals();
    registerModal.style.display = 'block';
}

function showActivationModal() {
    activationModal.style.display = 'block';
}

function closeModals() {
    loginModal.style.display = 'none';
    registerModal.style.display = 'none';
    activationModal.style.display = 'none';
}

// Authentication functions
async function handleLogin(e) {
    e.preventDefault();
    
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    
    try {
        const response = await fetch(`${API_BASE}/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            localStorage.setItem('token', data.token);
            currentUser = data.user;
            closeModals();
            showDashboard();
            loadDashboardData();
            showNotification('Login successful!', 'success');
        } else {
            showNotification(data.message, 'error');
        }
    } catch (error) {
        showNotification('Login failed. Please try again.', 'error');
    }
}

async function handleRegister(e) {
    e.preventDefault();
    
    const username = document.getElementById('registerUsername').value;
    const email = document.getElementById('registerEmail').value;
    const password = document.getElementById('registerPassword').value;
    const phone = document.getElementById('registerPhone').value;
    const referralCode = document.getElementById('registerReferral').value;
    
    try {
        const response = await fetch(`${API_BASE}/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, email, password, phone, referralCode })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            closeModals();
            showNotification('Registration successful! Please login to continue.', 'success');
            showLoginModal();
        } else {
            showNotification(data.message, 'error');
        }
    } catch (error) {
        showNotification('Registration failed. Please try again.', 'error');
    }
}

async function handleActivation(e) {
    e.preventDefault();
    
    const paymentMethod = document.getElementById('paymentMethod').value;
    const transactionId = document.getElementById('transactionId').value;
    
    try {
        const response = await fetch(`${API_BASE}/activate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                userId: currentUser.id,
                paymentMethod,
                transactionId
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            currentUser = data.user;
            closeModals();
            loadDashboardData();
            showNotification('Account activated successfully!', 'success');
        } else {
            showNotification(data.message, 'error');
        }
    } catch (error) {
        showNotification('Activation failed. Please try again.', 'error');
    }
}

function handleLogout() {
    localStorage.removeItem('token');
    currentUser = null;
    hideDashboard();
    showNotification('Logged out successfully!', 'success');
}

// Dashboard functions
function showDashboard() {
    mainContent.style.display = 'none';
    dashboard.classList.remove('hidden');
}

function hideDashboard() {
    mainContent.style.display = 'block';
    dashboard.classList.add('hidden');
}

async function loadDashboard() {
    try {
        // In a real app, you would validate the token with the server
        showDashboard();
        // Load user data from token or make API call
    } catch (error) {
        localStorage.removeItem('token');
    }
}

async function loadDashboardData() {
    if (!currentUser) return;
    
    try {
        const response = await fetch(`${API_BASE}/dashboard/${currentUser.id}`);
        const data = await response.json();
        
        if (response.ok) {
            updateDashboardUI(data);
            loadReferralLink();
        }
    } catch (error) {
        showNotification('Failed to load dashboard data', 'error');
    }
}

function updateDashboardUI(data) {
    const { user, transactions, referrals } = data;
    
    // Update user info
    document.getElementById('dashboardUsername').textContent = user.username;
    document.getElementById('userBalance').textContent = `৳${user.balance}`;
    document.getElementById('userLevel').textContent = user.level;
    document.getElementById('userReferrals').textContent = user.referralCount;
    document.getElementById('userCommission').textContent = `${30 + (user.level * 2)}%`;
    
    // Update account status
    const accountStatus = document.getElementById('accountStatus');
    if (user.isActive) {
        accountStatus.innerHTML = '<p>Account is active! You can start earning from referrals.</p>';
        accountStatus.className = 'status-active';
    } else {
        accountStatus.innerHTML = `
            <p>Account not activated. Pay ৳1,000 to activate and start earning!</p>
            <button id="activateBtn" class="btn-primary">Activate Account</button>
        `;
        accountStatus.className = 'status-inactive';
        document.getElementById('activateBtn').addEventListener('click', showActivationModal);
    }
    
    // Update transactions
    const transactionsList = document.getElementById('transactionsList');
    if (transactions.length === 0) {
        transactionsList.innerHTML = '<p>No transactions yet.</p>';
    } else {
        transactionsList.innerHTML = transactions.map(transaction => `
            <div class="transaction-item">
                <h4>${formatTransactionType(transaction.type)}</h4>
                <p>Amount: ৳${transaction.amount}</p>
                <p>Date: ${new Date(transaction.createdAt).toLocaleDateString()}</p>
            </div>
        `).join('');
    }
    
    // Update referrals
    const referralsList = document.getElementById('referralsList');
    if (referrals.length === 0) {
        referralsList.innerHTML = '<p>No referrals yet. Share your link to start earning!</p>';
    } else {
        referralsList.innerHTML = referrals.map(referral => `
            <div class="referral-item">
                <h4>${referral.username}</h4>
                <p>Email: ${referral.email}</p>
                <p>Status: ${referral.isActive ? 'Active' : 'Pending'}</p>
                <p>Joined: ${new Date(referral.createdAt).toLocaleDateString()}</p>
            </div>
        `).join('');
    }
    
    currentUser = user;
}

async function loadReferralLink() {
    if (!currentUser) return;
    
    try {
        const response = await fetch(`${API_BASE}/referral-link/${currentUser.id}`);
        const data = await response.json();
        
        if (response.ok) {
            document.getElementById('referralLink').value = data.referralLink;
        }
    } catch (error) {
        console.error('Failed to load referral link');
    }
}

function copyReferralLink() {
    const referralLinkInput = document.getElementById('referralLink');
    referralLinkInput.select();
    document.execCommand('copy');
    showNotification('Referral link copied to clipboard!', 'success');
}

// Utility functions
function formatTransactionType(type) {
    const types = {
        'activation': 'Account Activation',
        'referral_commission': 'Referral Commission',
        'sub_referral_commission': 'Sub-Referral Commission'
    };
    return types[type] || type;
}

function showNotification(message, type) {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    
    // Add styles
    Object.assign(notification.style, {
        position: 'fixed',
        top: '20px',
        right: '20px',
        padding: '15px 20px',
        borderRadius: '5px',
        color: 'white',
        fontSize: '16px',
        zIndex: '3000',
        opacity: '0',
        transition: 'opacity 0.3s'
    });
    
    if (type === 'success') {
        notification.style.backgroundColor = '#28a745';
    } else {
        notification.style.backgroundColor = '#dc3545';
    }
    
    document.body.appendChild(notification);
    
    // Show notification
    setTimeout(() => {
        notification.style.opacity = '1';
    }, 100);
    
    // Hide notification after 3 seconds
    setTimeout(() => {
        notification.style.opacity = '0';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 3000);
}