export const LESSON_CATEGORIES = [
  {
    id: "phishing_emails",
    name: "Phishing Emails",
    icon: "Mail",
    color: "from-blue-500 to-blue-600",
    description: "Spot fake emails before you click",
    lessons: [
      {
        id: "phishing_basics",
        title: "Phishing 101: Spotting Fake Emails",
        xp: 50,
        content: [
          {
            type: "text",
            heading: "What is Phishing?",
            body: "Phishing is when scammers send fraudulent emails pretending to be from legitimate companies — your bank, a delivery service, or a government agency. Their goal is to trick you into clicking a link, downloading an attachment, or entering your password on a fake website.",
          },
          {
            type: "tip",
            body: "The name 'phishing' comes from 'fishing' — scammers cast a wide net hoping someone bites.",
          },
          {
            type: "text",
            heading: "The 5 Red Flags",
            body: "1. Urgency: 'Your account will be suspended in 24 hours!'\n2. Generic greetings: 'Dear Customer' instead of your name\n3. Mismatched URLs: The link text says 'bank.com' but the actual URL is 'secure-bank-login.xyz'\n4. Requests for sensitive info: Banks never ask for your password by email\n5. Unexpected attachments: Especially .zip, .exe, or .html files",
          },
          {
            type: "example",
            title: "Real Example",
            body: "Subject: Urgent: Your Account Has Been Limited\n\n'Dear Customer, We detected unusual activity on your account. Click here to verify your identity within 24 hours or your account will be permanently suspended.'\n\nRed flags: generic greeting, urgent threat, suspicious link, no specific account details.",
          },
        ],
        quiz: [
          {
            question: "Which of these is the strongest sign of a phishing email?",
            options: [
              "The email has a professional logo",
              "The email addresses you as 'Dear Customer' and threatens account suspension",
              "The email is sent during business hours",
              "The email has an unsubscribe link",
            ],
            correct: 1,
            explanation: "Generic greetings combined with urgency threats are classic phishing indicators.",
          },
          {
            question: "Your bank emails asking you to 'confirm your password' via a link. What do you do?",
            options: [
              "Click the link and enter your password",
              "Reply with your password",
              "Go directly to your bank's website by typing the URL yourself",
              "Forward it to friends to warn them",
            ],
            correct: 2,
            explanation: "Never click links in suspicious emails. Always navigate to your bank's website directly.",
          },
        ],
      },
      {
        id: "phishing_links",
        title: "Link Detective: Reading URLs Safely",
        xp: 50,
        content: [
          {
            type: "text",
            heading: "How to Read a URL",
            body: "A URL has several parts: protocol (https://), subdomain (mail.), domain (google.com), and path (/inbox). Scammers exploit this by hiding their real domain in the subdomain or path.\n\nExample: 'https://google.com.scam-site.xyz/login' — the real domain is 'scam-site.xyz', not 'google.com'. The scammer just put 'google.com' in the subdomain to trick you.",
          },
          {
            type: "tip",
            body: "Always read URLs from right to left. The real domain is just before the first single slash after the protocol.",
          },
          {
            type: "text",
            heading: "URL Shorteners",
            body: "Services like bit.ly and tinyurl.com hide the real destination. If you receive a shortened link, use a link expander service (like checkshorturl.com) to see where it actually goes before clicking.",
          },
        ],
        quiz: [
          {
            question: "Which part of 'https://login.paypal.com.secure-verify.xyz/signin' is the real domain?",
            options: [
              "paypal.com",
              "login.paypal.com",
              "secure-verify.xyz",
              "paypal.com.secure-verify.xyz",
            ],
            correct: 2,
            explanation: "Read right to left — 'secure-verify.xyz' is the real domain. 'paypal.com' is just part of the subdomain.",
          },
        ],
      },
    ],
  },
  {
    id: "scam_texts",
    name: "Scam Text Messages",
    icon: "MessageSquare",
    color: "from-green-500 to-green-600",
    description: "Don't fall for SMS traps",
    lessons: [
      {
        id: "smishing_basics",
        title: "Smishing: When Texts Attack",
        xp: 50,
        content: [
          {
            type: "text",
            heading: "What is Smishing?",
            body: "Smishing (SMS + phishing) is when scammers send text messages pretending to be from banks, delivery services, or government agencies. They usually include a link or phone number designed to steal your information or money.",
          },
          {
            type: "text",
            heading: "Common Smishing Scams",
            body: "1. Package delivery: 'Your package is held at the depot. Pay $2 redelivery fee here: [link]'\n2. Bank alerts: 'Suspicious activity detected. Verify here: [link]'\n3. Prize notifications: 'You've won a $500 gift card! Claim at: [link]'\n4. Government: 'You owe the IRS. Pay now or face legal action: [link]'",
          },
          {
            type: "tip",
            body: "Legitimate companies never ask you to pay fees or verify account details via a text message link. When in doubt, contact the company directly using the phone number from their official website.",
          },
          {
            type: "example",
            title: "Real Example",
            body: "From: +1-555-0192\n'USPS: Package [TRACKING#] held at facility due to incomplete address. Confirm delivery details: http://usp-delivery.xyz/track'\n\nRed flags: random sender number, fake USPS domain (usp-delivery.xyz), urgency to act, link that doesn't go to usps.com.",
          },
        ],
        quiz: [
          {
            question: "You get a text saying 'Your package is on hold. Click to confirm your address.' What's the safest action?",
            options: [
              "Click the link to confirm your address",
              "Reply with your address",
              "Check your actual delivery app or tracking number from the original order",
              "Call the number in the text",
            ],
            correct: 2,
            explanation: "Always verify through official channels. Check your order confirmation or delivery app instead of clicking links in texts.",
          },
          {
            question: "Which text is most likely a scam?",
            options: [
              "A text from your carrier about your data usage",
              "A text saying 'You won a $1000 Walmart gift card! Click here to claim'",
              "A text confirming your doctor's appointment",
              "A text with a 2FA code you just requested",
            ],
            correct: 1,
            explanation: "Unsolicited prize notifications are almost always scams. You can't win a contest you didn't enter.",
          },
        ],
      },
    ],
  },
  {
    id: "marketplace_scams",
    name: "Marketplace Scams",
    icon: "ShoppingCart",
    color: "from-orange-500 to-red-500",
    description: "Buy and sell safely online",
    lessons: [
      {
        id: "marketplace_basics",
        title: "Marketplace Safety: Buying & Selling",
        xp: 75,
        content: [
          {
            type: "text",
            heading: "The Golden Rule",
            body: "Never complete a marketplace transaction outside the platform. Scammers will try to move you to WhatsApp, email, or direct bank transfer to bypass the platform's buyer protection.",
          },
          {
            type: "text",
            heading: "Common Buyer Scams",
            body: "1. Too good to be true: A $2000 laptop for $300? Walk away.\n2. Fake escrow: 'I'll use this escrow service' — it's a fake website they control.\n3. Overpayment: They send more than the price and ask you to refund the difference. The original payment is fake.\n4. Gift card payment: No legitimate buyer pays with gift cards.",
          },
          {
            type: "text",
            heading: "Common Seller Scams",
            body: "1. Fake payment confirmation: A forged email that looks like it's from PayPal.\n2. Shipping scam: They provide a fake tracking number and claim non-delivery.\n3. Bait and switch: The item you receive is different from the photos.",
          },
          {
            type: "tip",
            body: "Always check seller ratings and reviews. New accounts with no history selling high-value items at discount prices are a major red flag.",
          },
        ],
        quiz: [
          {
            question: "A buyer on Facebook Marketplace offers to pay via Zelle and asks you to ship the item. What should you do?",
            options: [
              "Accept — Zelle is a legitimate payment app",
              "Ship the item immediately to seem reliable",
              "Decline — Facebook Marketplace has no seller protection for off-platform payments and shipping",
              "Ask them to pay with gift cards instead",
            ],
            correct: 2,
            explanation: "Zelle payments can't be reversed, and Facebook Marketplace doesn't protect shipped items paid via Zelle. Stick to local, in-person cash transactions or the platform's built-in payment system.",
          },
          {
            question: "Someone offers to buy your $500 item for $800 and asks you to refund the $300 difference. What's happening?",
            options: [
              "They made an honest mistake",
              "It's an overpayment scam — the original payment is fake",
              "They're being generous",
              "It's a standard marketplace practice",
            ],
            correct: 1,
            explanation: "Overpayment scams use fake payments that will later be reversed, leaving you out both the item and the refunded difference.",
          },
        ],
      },
    ],
  },
  {
    id: "crypto_fraud",
    name: "Investment & Crypto Fraud",
    icon: "TrendingUp",
    color: "from-purple-500 to-pink-500",
    description: "Protect your investments",
    lessons: [
      {
        id: "crypto_basics",
        title: "Crypto Scams: Too Good to Be True",
        xp: 75,
        content: [
          {
            type: "text",
            heading: "The Promise",
            body: "Crypto scammers promise guaranteed high returns with little or no risk. They might claim to have a 'trading bot', 'mining pool', or 'arbitrage system' that generates 5-10% daily returns. This is mathematically impossible — no investment can sustain those returns.",
          },
          {
            type: "text",
            heading: "Common Crypto Scams",
            body: "1. Pig butchering: Scammers build a romantic or friendly relationship over weeks, then introduce a 'crypto investment opportunity' that turns out to be a fake exchange.\n2. Fake exchanges: Websites that look like real crypto exchanges but steal your deposit.\n3. Giveaway scams: 'Send us 1 ETH and we'll send back 2!' — they never send anything back.\n4. Rug pulls: Developers create a new token, build hype, then drain the liquidity pool and disappear.",
          },
          {
            type: "tip",
            body: "If someone you met online starts talking about crypto investments — especially if they're a romantic interest — it's almost certainly a scam. Real financial advisors don't solicit through dating apps.",
          },
          {
            type: "example",
            title: "Real Example",
            body: "After weeks of chatting on a dating app, your match mentions they make $500/day trading crypto on a platform called 'CoinSafePro'. They show you screenshots of their 'earnings' and offer to teach you. You deposit money, see fake profits, but when you try to withdraw, you're told you need to pay a 'tax' or 'withdrawal fee' first. The money is gone.",
          },
        ],
        quiz: [
          {
            question: "An online romantic interest introduces you to a crypto investment platform with guaranteed daily returns. What is this?",
            options: [
              "A great investment opportunity",
              "A legitimate way to build wealth together",
              "A 'pig butchering' scam — the relationship is fake and the platform will steal your money",
              "A standard dating experience",
            ],
            correct: 2,
            explanation: "Pig butchering scams combine romance fraud with crypto fraud. The relationship is built over weeks to gain trust before the financial ask.",
          },
          {
            question: "A crypto project guarantees 5% daily returns with 'zero risk'. What should you do?",
            options: [
              "Invest immediately before the opportunity closes",
              "Invest a small amount to test it",
              "Recognize it as a Ponzi scheme — guaranteed high returns with no risk don't exist",
              "Tell your friends about this great opportunity",
            ],
            correct: 2,
            explanation: "5% daily returns would turn $1000 into $5 billion in a year. Any investment promising guaranteed high returns is a scam.",
          },
        ],
      },
    ],
  },
  {
    id: "family_safety",
    name: "Family Digital Safety",
    icon: "Users",
    color: "from-teal-500 to-cyan-500",
    description: "Protect your loved ones",
    lessons: [
      {
        id: "protecting_seniors",
        title: "Protecting Elderly Family Members",
        xp: 50,
        content: [
          {
            type: "text",
            heading: "Why Seniors Are Targeted",
            body: "Scammers target older adults because they may have savings, be less familiar with technology, and be more trusting. Common scams include Medicare fraud, grandparent scams ('I'm in jail, send money'), tech support scams, and romance scams.",
          },
          {
            type: "text",
            heading: "How to Help",
            body: "1. Have regular conversations about scams — make it normal to discuss suspicious messages.\n2. Set up Vardin for them and add them to your family circle so you get alerts.\n3. Enable caller ID and spam filtering on their phone.\n4. Set up automatic updates on their devices.\n5. Remove remote access software if they don't need it — scammers use it to 'fix' fake problems.",
          },
          {
            type: "tip",
            body: "Create a family code word. If someone calls claiming to be a grandchild in trouble, ask for the code word. Scammers won't know it.",
          },
        ],
        quiz: [
          {
            question: "You get a call from 'your grandson' saying he's in jail and needs bail money urgently. He begs you not to tell his parents. What do you do?",
            options: [
              "Send the money immediately",
              "Keep it secret and send money",
              "Hang up and call your grandson or his parents directly to verify",
              "Give the caller your credit card details",
            ],
            correct: 2,
            explanation: "This is the classic grandparent scam. Always verify through a known phone number. The urgency and secrecy are manipulation tactics.",
          },
        ],
      },
    ],
  },
  {
    id: "password_security",
    name: "Password Security",
    icon: "Lock",
    color: "from-indigo-500 to-purple-500",
    description: "Lock down your accounts",
    lessons: [
      {
        id: "password_basics",
        title: "Password Essentials",
        xp: 50,
        content: [
          {
            type: "text",
            heading: "Strong Passwords",
            body: "A strong password is at least 16 characters, includes a mix of upper/lowercase letters, numbers, and symbols. But length matters more than complexity — 'purple-elephant-dancing-7' is stronger than 'P@ssw0rd!' and easier to remember.",
          },
          {
            type: "text",
            heading: "Never Reuse Passwords",
            body: "If you use the same password for your email, bank, and social media, one breach compromises everything. Use a password manager (like Bitwarden or 1Password) to generate and store unique passwords for every account.",
          },
          {
            type: "text",
            heading: "Enable 2FA Everywhere",
            body: "Two-factor authentication adds a second layer of security. Even if someone steals your password, they can't log in without the second factor (usually a code from your phone). Use an authenticator app (Google Authenticator, Authy) rather than SMS when possible — SIM swapping can intercept texts.",
          },
          {
            type: "tip",
            body: "Your email password is the most important one — it's the key to resetting all your other passwords. Make it unique, long, and impossible to guess.",
          },
        ],
        quiz: [
          {
            question: "Which is the strongest password?",
            options: [
              "P@ssw0rd2024!",
              "correct-horse-battery-staple-9",
              "Qwerty123!",
              "YourName2024",
            ],
            correct: 1,
            explanation: "Length is the most important factor. A 30+ character passphrase is exponentially harder to crack than a short complex password.",
          },
          {
            question: "Why should you use an authenticator app instead of SMS for 2FA?",
            options: [
              "SMS is too slow",
              "SIM swapping attacks can intercept SMS codes",
              "Authenticator apps look better",
              "SMS costs money",
            ],
            correct: 1,
            explanation: "SIM swapping lets attackers take over your phone number and receive your SMS 2FA codes. Authenticator apps are immune to this attack.",
          },
        ],
      },
    ],
  },
  {
    id: "deepfakes",
    name: "AI Deepfake Scams",
    icon: "Bot",
    color: "from-rose-500 to-pink-500",
    description: "When seeing isn't believing",
    lessons: [
      {
        id: "deepfake_basics",
        title: "Deepfakes: When Video Lies",
        xp: 75,
        content: [
          {
            type: "text",
            heading: "What are Deepfakes?",
            body: "Deepfakes use AI to create realistic fake videos or audio of real people. Scammers use them to impersonate executives, celebrities, or even family members. In 2024, a Hong Kong company lost $25 million after a deepfake video call with their 'CFO'.",
          },
          {
            type: "text",
            heading: "How to Spot Deepfakes",
            body: "1. Unnatural blinking or no blinking at all\n2. Blurry areas around the face or hairline\n3. Lips that don't quite match the audio\n4. Inconsistent lighting or shadows\n5. Unusual pauses or robotic speech patterns\n6. The person avoids showing their hands or full body",
          },
          {
            type: "text",
            heading: "Voice Cloning Scams",
            body: "With just 3 seconds of audio, AI can clone someone's voice. Scammers call pretending to be a family member in distress — 'I've been in an accident, I need money for medical bills.' Always verify by calling back on a known number.",
          },
          {
            type: "tip",
            body: "Agree on a family safe word. If someone calls sounding like a loved one in trouble, ask for the safe word. A voice clone can't know your secret word.",
          },
        ],
        quiz: [
          {
            question: "You get a voicemail from your boss asking you to urgently transfer funds to a new vendor. The voice sounds exactly like them. What do you do?",
            options: [
              "Transfer the funds immediately — it's clearly your boss",
              "Reply to the voicemail asking if they're sure",
              "Verify through a secondary channel — call your boss directly or check with a colleague",
              "Transfer half the amount to be safe",
            ],
            correct: 2,
            explanation: "Voice cloning can replicate anyone's voice from seconds of audio. Always verify financial requests through a separate, known communication channel.",
          },
        ],
      },
    ],
  },
  {
    id: "qr_codes",
    name: "QR Code Scams",
    icon: "QrCode",
    color: "from-amber-500 to-orange-500",
    description: "Scan with caution",
    lessons: [
      {
        id: "qr_basics",
        title: "QR Code Dangers",
        xp: 50,
        content: [
          {
            type: "text",
            heading: "What's in a QR Code?",
            body: "A QR code is just a link in disguise. You can't see where it goes until you scan it — and by then it may have opened a phishing site, started a download, or initiated a payment. Scammers place fake QR codes on parking meters, restaurant menus, and posters.",
          },
          {
            type: "text",
            heading: "Common QR Scams",
            body: "1. Fake parking meters: A sticker over the real QR code sends you to a payment site that steals your card details.\n2. Restaurant menu scam: A fake QR code on a table leads to a phishing site.\n3. Package delivery: A QR code in a scam text leads to a fake delivery site.\n4. Crypto giveaway: 'Scan to claim free Bitcoin' — the site drains your wallet.",
          },
          {
            type: "tip",
            body: "Before scanning a QR code, check if it's a sticker placed over another code. Use your phone's built-in QR scanner (not a third-party app) which often shows the URL before opening it.",
          },
        ],
        quiz: [
          {
            question: "You're at a parking meter and see a QR code sticker for payment. How can you verify it's legitimate?",
            options: [
              "Scan it — QR codes are always safe",
              "Check if it's a sticker placed over another code and look for tampering",
              "Scan it and enter your credit card — if it looks official, it's fine",
              "Take a photo and send it to a friend",
            ],
            correct: 1,
            explanation: "Scammers often place sticker QR codes over legitimate ones. If the code looks like a sticker or is peeling, don't scan it. Pay through the official parking app instead.",
          },
        ],
      },
    ],
  },
];

export function getIcon(name) {
  const icons = {
    Mail: "Mail",
    MessageSquare: "MessageSquare",
    ShoppingCart: "ShoppingCart",
    TrendingUp: "TrendingUp",
    Users: "Users",
    Lock: "Lock",
    Bot: "Bot",
    QrCode: "QrCode",
  };
  return icons[name] || "ShieldCheck";
}