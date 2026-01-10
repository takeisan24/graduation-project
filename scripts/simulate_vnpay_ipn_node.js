const crypto = require('crypto');

// 1. EDIT THESE VALUES TO MATCH A REAL RECORD IN YOUR 'orders' TABLE
const MOCK_ORDER = {
    txnRef: 'ORD-20260106-002', // CHANGE THIS to your last created Order ID (look in DB)
    amount: 2985000,            // CHANGE THIS to match the order amount (Integer, no decimals)
    orderInfo: 'Thanh toan Creator - 200 credits',
    createdDate: '20260107000000' // Format yyyyMMddHHmmss
};

// 2. SECRET KEY (Must match .env.local VNPAY_HASH_SECRET)
const HASH_SECRET = process.env.VNPAY_HASH_SECRET || 'GSJ3SRR8SS34GV3X3HHC8GYCKQYWHF4Q'; 

if (MOCK_ORDER.txnRef === 'CHANGE_THIS_TO_YOUR_REAL_ORDER_REF') {
    console.error("Please edit the script to put a REAL order ref from your database!");
    process.exit(1);
}

// 3. Construct Params
const ipnParams = {
    vnp_TmnCode: '9GAAG3M9',
    vnp_Amount: (MOCK_ORDER.amount * 100).toString(), // VNPay sends Amount * 100
    vnp_BankCode: 'NCB',
    vnp_BankTranNo: 'VNP12345678',
    vnp_CardType: 'ATM',
    vnp_PayDate: '20260107123000',
    vnp_OrderInfo: MOCK_ORDER.orderInfo,
    vnp_TransactionNo: '12345678',
    vnp_ResponseCode: '00', // Success
    vnp_TransactionStatus: '00', // Success
    vnp_TxnRef: MOCK_ORDER.txnRef,
    vnp_SecureHashType: 'SHA512',
    vnp_Version: '2.1.0'
};

// 4. Generate Signature
function generateSignature(params, secret) {
    const signData = Object.keys(params)
        .filter(key => key !== 'vnp_SecureHash' && params[key] !== undefined && params[key] !== '') // Filter like utils
        .sort()
        .map(key => `${key}=${encodeURIComponent(params[key])}`)
        .join('&');
    
    const hmac = crypto.createHmac('sha512', secret);
    return hmac.update(signData, 'utf-8').digest('hex');
}

ipnParams.vnp_SecureHash = generateSignature(ipnParams, HASH_SECRET);

// 5. Build Query String
const queryString = Object.keys(ipnParams)
    .sort()
    .map(key => `${key}=${encodeURIComponent(ipnParams[key])}`)
    .join('&');

// 6. Output the URL
const localhostUrl = `http://localhost:3000/api/payment/vnpay/ipn?${queryString}`;

console.log('---------------------------------------------------');
console.log('✅ SIMULATION URL GENERATED');
console.log('---------------------------------------------------');
console.log('Paste this URL into your browser to simulate a successful payment from VNPay:');
console.log('\n' + localhostUrl + '\n');
console.log('---------------------------------------------------');
