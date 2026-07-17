import { EXTRA_LESSONS, NEW_CATEGORIES } from './lessons-extra';

export const LESSON_CATEGORIES = [
  {
    id: "phishing_emails",
    name: "Phishing Emails",
    icon: "Mail",
    logo: "https://media.base44.com/images/public/6a46a8e315996af6f0443792/88d6e25de_generated_image.png",
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
            body: "Phishing is when scammers send fake emails that look real. They pretend to be your bank, a delivery service, or the government. Their goal? To trick you into clicking a bad link, opening a dangerous file, or typing your password on a fake website.",
          },
          {
            type: "tip",
            body: "The word 'phishing' comes from 'fishing' — scammers cast a wide net hoping someone bites.",
          },
          {
            type: "text",
            heading: "The 5 Red Flags",
            body: "1. Urgency: 'Your account will be closed in 24 hours!'\n2. Generic greeting: 'Dear Customer' instead of your real name\n3. Suspicious links: The link says 'bank.com' but really goes to 'fake-site.xyz'\n4. Asking for passwords: Real banks never ask for your password by email\n5. Surprise attachments: Especially .zip, .exe, or .html files you didn't ask for",
          },
          {
            type: "example",
            title: "Real Example",
            body: "Subject: Urgent: Your Account Has Been Limited\n\n'Dear Customer, We detected unusual activity on your account. Click here to verify your identity within 24 hours or your account will be permanently suspended.'\n\nWhy this is fake: generic greeting, urgent threat, suspicious link, no specific account details.",
          },
        ],
        quiz: [
          {
            type: "multiple_choice",
            question: "Which of these is the strongest sign of a phishing email?",
            options: [
              "The email has a professional logo",
              "The email says 'Dear Customer' and threatens to close your account",
              "The email is sent during business hours",
              "The email has an unsubscribe link",
            ],
            correct: 1,
            explanation: "Generic greetings plus urgency threats are classic phishing signs.",
          },
          {
            type: "true_false",
            question: "Your bank will never ask you to confirm your password through an email link.",
            correct: true,
            explanation: "Correct! Banks never ask for passwords by email. If unsure, go to your bank's website directly by typing the address yourself.",
          },
          {
            type: "fill_blank",
            question: "Fill in the blank: Phishing emails often create a false sense of ______ to make you act quickly without thinking.",
            text_before: "Phishing emails often create a false sense of ",
            text_after: " to make you act quickly without thinking.",
            acceptable_answers: ["urgency", "emergency", "panic", "fear"],
            explanation: "Urgency is the #1 tool scammers use. They want you to panic and click before you think.",
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
            body: "A web address (URL) has parts: the protocol (https://), the domain (google.com), and the path (/inbox). Scammers hide their real domain inside the address.\n\nExample: 'https://google.com.scam-site.xyz/login' — the real website is 'scam-site.xyz', NOT 'google.com'. The scammer just put 'google.com' in the middle to fool you.",
          },
          {
            type: "tip",
            body: "Always read web addresses from right to left. The real domain is the word right before the first single slash after the protocol.",
          },
          {
            type: "text",
            heading: "URL Shorteners",
            body: "Services like bit.ly and tinyurl.com hide where a link really goes. If you get a shortened link, use a link expander tool (like checkshorturl.com) to see the real destination before you click.",
          },
        ],
        quiz: [
          {
            type: "multiple_choice",
            question: "Which part of 'https://login.paypal.com.secure-verify.xyz/signin' is the real domain?",
            options: [
              "paypal.com",
              "login.paypal.com",
              "secure-verify.xyz",
              "paypal.com.secure-verify.xyz",
            ],
            correct: 2,
            explanation: "Read right to left — 'secure-verify.xyz' is the real domain. 'paypal.com' is just part of the subdomain used to trick you.",
          },
          {
            type: "true_false",
            question: "A link that says 'Click here to verify your account' always goes where it says.",
            correct: false,
            explanation: "Correct! Link text can say anything. The real destination is in the actual URL, not the clickable text.",
          },
        ],
      },
      {
        id: "email_spoofing",
        title: "Email Spoofing: Fake Sender Addresses",
        xp: 50,
        content: [
          {
            type: "text",
            heading: "What is Email Spoofing?",
            body: "Scammers can make an email look like it came from someone you trust. The 'From' name might say 'Bank of America' or 'Amazon Security', but the real sender address is completely different. Always check the actual email address, not just the display name.",
          },
          {
            type: "text",
            heading: "How to Check the Real Sender",
            body: "On a computer, hover over or click the sender's name to see the full email address. On a phone, tap the sender's name to expand the details. If the address looks strange (like 'security@bank-alert-verify.com' instead of 'security@bank.com'), it's fake.",
          },
          {
            type: "tip",
            body: "If an email asks you to do something urgent, take 5 seconds to check the sender's real email address. Those 5 seconds can save you thousands of dollars.",
          },
        ],
        quiz: [
          {
            type: "fill_blank",
            question: "Fill in the blank: Even if an email's display name says 'Your Bank', you should always check the actual ______ address.",
            text_before: "Even if an email's display name says 'Your Bank', you should always check the actual ",
            text_after: " address.",
            acceptable_answers: ["email", "sender", "from", "sender email", "email address"],
            explanation: "The display name can say anything. The real email address tells you who actually sent it.",
          },
          {
            type: "true_false",
            question: "If an email looks professional and has a company logo, it must be real.",
            correct: false,
            explanation: "Correct! Scammers can easily copy logos and design to make emails look professional. Always verify the sender's email address.",
          },
        ],
      },
    ],
  },
  {
    id: "scam_texts",
    name: "Scam Text Messages",
    icon: "MessageSquare",
    logo: "https://media.base44.com/images/public/6a46a8e315996af6f0443792/4e413e7aa_generated_image.png",
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
            body: "Smishing (SMS + phishing) is when scammers send text messages pretending to be from your bank, a delivery service, or the government. They usually include a link or phone number to steal your info or money.",
          },
          {
            type: "text",
            heading: "Common Text Scams",
            body: "1. Package delivery: 'Your package is on hold. Pay $2 fee here: [link]'\n2. Bank alerts: 'Suspicious activity detected. Verify here: [link]'\n3. Prize: 'You won a $500 gift card! Claim at: [link]'\n4. Government: 'You owe taxes. Pay now or face legal action: [link]'",
          },
          {
            type: "tip",
            body: "Real companies never ask you to pay fees or verify account details through a text message link. When in doubt, contact the company directly using the phone number from their official website.",
          },
          {
            type: "example",
            title: "Real Example",
            body: "From: +1-555-0192\n'USPS: Package [TRACKING#] held at facility due to incomplete address. Confirm delivery details: http://usp-delivery.xyz/track'\n\nWhy it's fake: random sender number, fake USPS domain (usp-delivery.xyz), creates urgency, link doesn't go to usps.com.",
          },
        ],
        quiz: [
          {
            type: "multiple_choice",
            question: "You get a text saying 'Your package is on hold. Click to confirm your address.' What's the safest action?",
            options: [
              "Click the link to confirm your address",
              "Reply with your address",
              "Check your actual delivery app or tracking number from your original order",
              "Call the number in the text",
            ],
            correct: 2,
            explanation: "Always check through official channels. Look at your order confirmation or delivery app instead of clicking links in texts.",
          },
          {
            type: "true_false",
            question: "You can win a prize from a contest you never entered.",
            correct: false,
            explanation: "Correct! You can't win a contest you didn't enter. Prize texts are almost always scams.",
          },
          {
            type: "fill_blank",
            question: "Fill in the blank: If a text message creates ______ and asks you to click a link, it's likely a scam.",
            text_before: "If a text message creates ",
            text_after: " and asks you to click a link, it's likely a scam.",
            acceptable_answers: ["urgency", "panic", "fear", "pressure", "stress"],
            explanation: "Scammers use urgency to make you panic and act before you think. Slow down and verify.",
          },
        ],
      },
      {
        id: "two_factor_texts",
        title: "2FA Code Scams: Don't Share Your Code",
        xp: 50,
        content: [
          {
            type: "text",
            heading: "The 2FA Code Scam",
            body: "You get a text with a verification code you didn't ask for. Then someone messages you saying 'Did you get a code? I'm trying to log in, can you send it to me?' This is a scam. They're trying to log into your account and need YOUR code to finish.",
          },
          {
            type: "text",
            heading: "Never Share Your Code",
            body: "Verification codes are like keys to your accounts. No legitimate company will ever ask you to share a 2FA code. If you get a code you didn't request, someone may be trying to hack your account — change your password right away.",
          },
          {
            type: "tip",
            body: "If you get a 2FA code you didn't ask for, ignore it. But check your account — someone may be trying to log in. Change your password if it keeps happening.",
          },
        ],
        quiz: [
          {
            type: "true_false",
            question: "It's safe to share your 2FA verification code if someone says they need it to verify your account.",
            correct: false,
            explanation: "Correct! NEVER share your 2FA code with anyone. No legitimate company will ask for it.",
          },
          {
            type: "multiple_choice",
            question: "You get a text with a code, then someone messages: 'Hey, I sent that to the wrong number. Can you send me the code?' What do you do?",
            options: [
              "Send them the code — they seem nice",
              "Ask them who they are first, then send it",
              "Don't send the code — they're trying to hack an account",
              "Send them a fake code instead",
            ],
            correct: 2,
            explanation: "This is a common scam. The person is trying to log into an account and needs your code to finish. Never share verification codes.",
          },
        ],
      },
    ],
  },
  {
    id: "marketplace_scams",
    name: "Marketplace Scams",
    icon: "ShoppingCart",
    logo: "https://media.base44.com/images/public/6a46a8e315996af6f0443792/e4f5cb057_generated_image.png",
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
            body: "Never complete a marketplace deal outside the platform. Scammers try to move you to WhatsApp, email, or direct bank transfer to bypass the platform's buyer protection.",
          },
          {
            type: "text",
            heading: "Common Buyer Scams",
            body: "1. Too good to be true: A $2000 laptop for $300? Walk away.\n2. Fake escrow: 'I'll use this escrow service' — it's a fake website they control.\n3. Overpayment: They send more than the price and ask you to refund the difference. The original payment is fake.\n4. Gift card payment: No real buyer pays with gift cards.",
          },
          {
            type: "text",
            heading: "Common Seller Scams",
            body: "1. Fake payment confirmation: A forged email that looks like it's from PayPal.\n2. Fake tracking: They provide a fake tracking number and claim the item was delivered.\n3. Bait and switch: The item you receive is different from the photos.",
          },
          {
            type: "tip",
            body: "Always check seller ratings and reviews. New accounts with no history selling expensive items at low prices are a big red flag.",
          },
        ],
        quiz: [
          {
            type: "multiple_choice",
            question: "A buyer on Facebook Marketplace offers to pay via Zelle and asks you to ship the item. What should you do?",
            options: [
              "Accept — Zelle is a legitimate payment app",
              "Ship the item immediately",
              "Decline — there's no seller protection for off-platform payments and shipping",
              "Ask them to pay with gift cards instead",
            ],
            correct: 2,
            explanation: "Zelle payments can't be reversed, and Marketplace doesn't protect shipped items paid via Zelle. Stick to in-person cash or the platform's built-in payment.",
          },
          {
            type: "true_false",
            question: "If a buyer sends you more money than the asking price and asks for a refund of the difference, it's likely a scam.",
            correct: true,
            explanation: "Correct! This is the overpayment scam. The original payment is fake and will be reversed, leaving you out both the item and the refund.",
          },
          {
            type: "fill_blank",
            question: "Fill in the blank: If a deal seems too ______ to be true, it probably is.",
            text_before: "If a deal seems too ",
            text_after: " to be true, it probably is.",
            acceptable_answers: ["good", "great", "amazing", "cheap", "cheap"],
            explanation: "Trust your gut. If something seems too good to be true, walk away.",
          },
        ],
      },
      {
        id: "selling_safely",
        title: "Selling Safely: Avoid Getting Scammed",
        xp: 75,
        content: [
          {
            type: "text",
            heading: "Meet in Safe Places",
            body: "When selling locally, always meet in a public, well-lit place. Many police stations have 'safe exchange zones' in their parking lots with cameras. Never meet at someone's home or invite strangers to yours.",
          },
          {
            type: "text",
            heading: "Payment Red Flags",
            body: "1. 'I'll send a check for more than the price' — fake check scam\n2. 'I paid via PayPal, check your email' — the email is forged\n3. 'I need your bank details to transfer' — they'll drain your account\n4. 'Can you ship it to my cousin overseas?' — they'll never pay\n\nOnly accept cash in person or the platform's official payment system.",
          },
          {
            type: "tip",
            body: "Take photos of the item and any communication before meeting. If something goes wrong, you'll have evidence.",
          },
        ],
        quiz: [
          {
            type: "multiple_answer",
            question: "Which of these are safe payment methods when selling locally? (Select all that apply)",
            options: [
              "Cash in person",
              "Platform's built-in payment",
              "Wire transfer to their bank",
              "Gift cards",
              "Cryptocurrency",
            ],
            correct: [0, 1],
            explanation: "Cash in person and platform payments are safest. Wire transfers, gift cards, and crypto can't be reversed and are scam favorites.",
          },
          {
            type: "true_false",
            question: "Meeting a buyer at a police station parking lot is a good safety practice.",
            correct: true,
            explanation: "Correct! Many police stations have designated safe exchange zones with cameras. Always meet in public, well-lit places.",
          },
        ],
      },
    ],
  },
  {
    id: "crypto_fraud",
    name: "Investment & Crypto Fraud",
    icon: "TrendingUp",
    logo: "https://media.base44.com/images/public/6a46a8e315996af6f0443792/6836b0e50_generated_image.png",
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
            body: "Crypto scammers promise guaranteed high returns with little or no risk. They might say they have a 'trading bot' or 'mining pool' that makes 5-10% daily returns. This is impossible — no investment can sustain those returns.",
          },
          {
            type: "text",
            heading: "Common Crypto Scams",
            body: "1. Pig butchering: Scammers build a romantic or friendly relationship over weeks, then introduce a 'crypto investment' that turns out to be fake.\n2. Fake exchanges: Websites that look real but steal your deposit.\n3. Giveaway scams: 'Send us 1 ETH and we'll send back 2!' — they never send anything.\n4. Rug pulls: Developers create a new coin, build hype, then steal all the money and disappear.",
          },
          {
            type: "tip",
            body: "If someone you met online starts talking about crypto investments — especially a romantic interest — it's almost certainly a scam. Real financial advisors don't find clients on dating apps.",
          },
          {
            type: "example",
            title: "Real Example",
            body: "After weeks of chatting on a dating app, your match mentions they make $500/day trading crypto on 'CoinSafePro'. They show fake screenshots of profits and offer to teach you. You deposit money, see fake profits, but when you try to withdraw, they say you need to pay a 'tax' or 'withdrawal fee' first. The money is gone.",
          },
        ],
        quiz: [
          {
            type: "multiple_choice",
            question: "An online romantic interest introduces you to a crypto platform with guaranteed daily returns. What is this?",
            options: [
              "A great investment opportunity",
              "A legitimate way to build wealth together",
              "A 'pig butchering' scam — the relationship is fake and they'll steal your money",
              "A standard dating experience",
            ],
            correct: 2,
            explanation: "Pig butchering scams combine romance fraud with crypto fraud. The relationship is built over weeks to gain trust before stealing your money.",
          },
          {
            type: "true_false",
            question: "An investment that guarantees 5% daily returns with zero risk is legitimate.",
            correct: false,
            explanation: "Correct! 5% daily returns would turn $1,000 into $5 billion in a year. Any investment promising guaranteed high returns is a scam.",
          },
          {
            type: "fill_blank",
            question: "Fill in the blank: In a 'giveaway scam', scammers ask you to send crypto and promise to send back ______.",
            text_before: "In a 'giveaway scam', scammers ask you to send crypto and promise to send back ",
            text_after: ".",
            acceptable_answers: ["more", "double", "extra", "twice as much", "2x"],
            explanation: "Giveaway scammers promise to send back more than you sent. They never send anything back — they just take your money.",
          },
        ],
      },
      {
        id: "crypto_giveaway",
        title: "Crypto Giveaway Scams & Fake Exchanges",
        xp: 75,
        content: [
          {
            type: "text",
            heading: "The Giveaway Trap",
            body: "Scammers impersonate celebrities, influencers, or crypto brands on social media. They announce a 'limited time giveaway': send them 1 ETH, and they'll send back 2. This is always a scam. No one gives away free cryptocurrency. Once you send yours, it's gone forever — crypto transactions cannot be reversed.",
          },
          {
            type: "text",
            heading: "Fake Exchanges",
            body: "Scammers create websites that look like real crypto exchanges (Binance, Coinbase, Kraken). You create an account, deposit crypto, and see fake 'profits' on the dashboard. But when you try to withdraw, they demand 'withdrawal fees' or 'tax payments' first. The exchange was never real — your money was stolen the moment you deposited it.",
          },
          {
            type: "tip",
            body: "Only use well-known, established exchanges. Check the URL carefully — scammers use look-alike domains like 'binance-pro.com' or 'coinbase-secure.net'. Bookmark the real site and always use the bookmark.",
          },
        ],
        quiz: [
          {
            type: "multiple_choice",
            question: "Someone impersonating a celebrity on social media posts: 'Sending 0.5 ETH to this address, I'll send back 1 ETH!' What is this?",
            options: [
              "A legitimate promotion from the celebrity",
              "A crypto giveaway scam — they keep your ETH and send nothing back",
              "A marketing campaign by Ethereum",
              "A test of the blockchain network",
            ],
            correct: 1,
            explanation: "Celebrity crypto giveaways are always scams. No one will double your crypto. The account is impersonating a real person.",
          },
          {
            type: "true_false",
            question: "If a crypto exchange website looks professional and shows your balance growing, it must be real.",
            correct: false,
            explanation: "Fake exchanges show fake dashboards with fake profits. When you try to withdraw, they demand more fees. The money was stolen on deposit.",
          },
        ],
      },
      {
        id: "crypto_wallet_security",
        title: "Crypto Wallet Security: Protecting Your Keys",
        xp: 75,
        content: [
          {
            type: "text",
            heading: "Hot vs Cold Wallets",
            body: "A 'hot wallet' is connected to the internet (like an exchange account or mobile app). It's convenient but vulnerable to hacking. A 'cold wallet' is offline (like a hardware device — Ledger, Trezor). It's the safest way to store significant crypto amounts. Rule of thumb: keep only what you need for daily use in a hot wallet. Store the rest in cold storage.",
          },
          {
            type: "text",
            heading: "Your Seed Phrase is Sacred",
            body: "When you create a crypto wallet, you get a 'seed phrase' — 12 or 24 words that can restore your entire wallet. If anyone gets your seed phrase, they can steal all your crypto instantly. Never type it into a website. Never share it with 'support'. Never store it in a photo on your phone. Write it on paper and store it in a safe.",
          },
          {
            type: "tip",
            body: "No legitimate crypto support agent will ever ask for your seed phrase. If someone asks for it — even claiming to be from the wallet company — it's a scam.",
          },
        ],
        quiz: [
          {
            type: "multiple_choice",
            question: "Someone claiming to be from 'MetaMask Support' asks for your 12-word seed phrase to 'fix a syncing issue'. What do you do?",
            options: [
              "Give them the seed phrase — they're from support",
              "Give them only half the words",
              "Never share it — real support never asks for your seed phrase",
              "Ask them to prove they work there first",
            ],
            correct: 2,
            explanation: "Your seed phrase IS your wallet. Anyone who has it can take everything. No legitimate support agent will ever ask for it.",
          },
          {
            type: "true_false",
            question: "A hardware wallet (cold storage) is safer than keeping crypto on an exchange.",
            correct: true,
            explanation: "Cold wallets keep your keys offline, where hackers can't reach them. For large amounts, cold storage is the safest option.",
          },
        ],
      },
    ],
  },
  {
    id: "family_safety",
    name: "Family Digital Safety",
    icon: "Users",
    logo: "https://media.base44.com/images/public/6a46a8e315996af6f0443792/e2fd5665a_generated_image.png",
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
            body: "1. Talk regularly about scams — make it normal to discuss suspicious messages.\n2. Set up Vardin for them and add them to your family circle so you get alerts.\n3. Turn on caller ID and spam filtering on their phone.\n4. Set up automatic updates on their devices.\n5. Remove remote access software if they don't need it — scammers use it to 'fix' fake problems.",
          },
          {
            type: "tip",
            body: "Create a family code word. If someone calls claiming to be a grandchild in trouble, ask for the code word. Scammers won't know it.",
          },
        ],
        quiz: [
          {
            type: "multiple_choice",
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
          {
            type: "fill_blank",
            question: "Fill in the blank: Having a family ______ word can help verify if a caller is really your family member.",
            text_before: "Having a family ",
            text_after: " word can help verify if a caller is really your family member.",
            acceptable_answers: ["code", "safe", "secret", "password", "code safe", "safe code"],
            explanation: "A family code word that only your real family knows can stop impersonation scams.",
          },
        ],
      },
      {
        id: "protecting_kids",
        title: "Protecting Children Online",
        xp: 50,
        content: [
          {
            type: "text",
            heading: "Online Grooming",
            body: "Scammers and predators befriend children through games, social media, or chat apps. They build trust over time, then ask for personal info, photos, or money. Watch for signs: your child is secretive about their phone, has new 'friends' you don't know, receives gifts or money from strangers, or seems anxious after being online.",
          },
          {
            type: "text",
            heading: "Gaming Scams",
            body: "Kids are targeted through games like Roblox, Fortnite, and Minecraft. Common scams: 'Buy cheap V-Bucks here' (fake sites steal card details), 'I'll level up your account for free' (they steal the account), or 'Trade me your rare item and I'll trade back' (they never do). Teach kids to never share account passwords or click links from strangers in games.",
          },
          {
            type: "tip",
            body: "Talk to your kids about scams the same way you talk about stranger danger. Make it clear they won't get in trouble if they tell you about something suspicious — you're there to help, not to punish.",
          },
        ],
        quiz: [
          {
            type: "multiple_choice",
            question: "Your child says someone in a game offered to give them free in-game currency if they click a link. What should you teach them?",
            options: [
              "Click it — free currency is great",
              "Ask the stranger for their real name first",
              "Never click links from strangers in games — it's likely a scam",
              "Click it but don't enter any passwords",
            ],
            correct: 2,
            explanation: "Free in-game currency offers are almost always scams. Teach kids to never click links from strangers and to tell you about suspicious offers.",
          },
          {
            type: "true_false",
            question: "If your child falls for a scam, they should be punished so they learn their lesson.",
            correct: false,
            explanation: "Punishment makes kids hide things. If they come to you about a scam, thank them for telling you. You want them to feel safe reporting suspicious activity.",
          },
        ],
      },
    ],
  },
  {
    id: "password_security",
    name: "Password Security",
    icon: "Lock",
    logo: "https://media.base44.com/images/public/6a46a8e315996af6f0443792/6921fd193_generated_image.png",
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
            body: "A strong password is at least 16 characters long. It should have a mix of upper and lowercase letters, numbers, and symbols. But length matters most — 'purple-elephant-dancing-7' is stronger than 'P@ssw0rd!' and easier to remember.",
          },
          {
            type: "text",
            heading: "Never Reuse Passwords",
            body: "If you use the same password for your email, bank, and social media, one breach gives hackers access to everything. Use a password manager (like Bitwarden or 1Password) to create and store unique passwords for every account.",
          },
          {
            type: "text",
            heading: "Enable 2FA Everywhere",
            body: "Two-factor authentication (2FA) adds a second layer of security. Even if someone steals your password, they can't log in without the second code from your phone. Use an authenticator app (like Google Authenticator or Authy) instead of text messages when possible.",
          },
          {
            type: "tip",
            body: "Your email password is the most important one — it's the key to resetting all your other passwords. Make it unique, long, and impossible to guess.",
          },
        ],
        quiz: [
          {
            type: "multiple_choice",
            question: "Which is the strongest password?",
            options: [
              "P@ssw0rd2024!",
              "correct-horse-battery-staple-9",
              "Qwerty123!",
              "YourName2024",
            ],
            correct: 1,
            explanation: "Length is the most important factor. A 30+ character passphrase is much harder to crack than a short complex password.",
          },
          {
            type: "true_false",
            question: "Using the same password for your email and bank account is safe as long as the password is complex.",
            correct: false,
            explanation: "Correct! Never reuse passwords. If one site gets hacked, scammers will try that password on all your other accounts.",
          },
          {
            type: "fill_blank",
            question: "Fill in the blank: Two-factor authentication is also called ______ for short.",
            text_before: "Two-factor authentication is also called ",
            text_after: " for short.",
            acceptable_answers: ["2fa", "2 fa", "two-factor", "two factor"],
            explanation: "2FA stands for 'Two-Factor Authentication' — an extra security layer beyond just your password.",
          },
        ],
      },
      {
        id: "password_managers",
        title: "Password Managers: Your Digital Vault",
        xp: 50,
        content: [
          {
            type: "text",
            heading: "What is a Password Manager?",
            body: "A password manager is like a secure digital vault. It creates strong, unique passwords for every account and remembers them all. You only need to remember ONE master password. Popular options include Bitwarden (free), 1Password, and Google Password Manager.",
          },
          {
            type: "text",
            heading: "Why You Need One",
            body: "The average person has 70-80 online accounts. You can't remember 80 unique strong passwords — but a password manager can. It fills in passwords automatically on legitimate websites and warns you if a site looks suspicious.",
          },
          {
            type: "tip",
            body: "Your master password should be a long passphrase — like 'my-dog-loves-pizza-2024'. Make it something you'll remember but no one could guess.",
          },
        ],
        quiz: [
          {
            type: "multiple_choice",
            question: "How many passwords do you need to remember when using a password manager?",
            options: [
              "All of them — one for each account",
              "Just one — your master password",
              "Two — your master password and email password",
              "None — it works automatically",
            ],
            correct: 1,
            explanation: "You only need to remember your master password. The manager handles all the rest automatically.",
          },
          {
            type: "true_false",
            question: "Password managers can generate strong, unique passwords for every account.",
            correct: true,
            explanation: "Correct! Password managers create random, strong passwords that are nearly impossible to crack, and they remember them for you.",
          },
        ],
      },
    ],
  },
  {
    id: "deepfakes",
    name: "AI Deepfake Scams",
    icon: "Bot",
    logo: "https://media.base44.com/images/public/6a46a8e315996af6f0443792/e7608ba85_generated_image.png",
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
            body: "Deepfakes use AI to create fake videos or audio of real people. Scammers use them to impersonate bosses, celebrities, or family members. In 2024, a company lost $25 million after a deepfake video call with their 'CFO'.",
          },
          {
            type: "text",
            heading: "How to Spot Deepfakes",
            body: "1. Unnatural blinking or no blinking at all\n2. Blurry areas around the face or hairline\n3. Lips that don't match the audio\n4. Inconsistent lighting or shadows\n5. Unusual pauses or robotic speech\n6. The person avoids showing their hands or full body",
          },
          {
            type: "text",
            heading: "Voice Cloning Scams",
            body: "With just 3 seconds of audio, AI can copy someone's voice. Scammers call pretending to be a family member in distress — 'I've been in an accident, I need money for medical bills.' Always verify by calling back on a known number.",
          },
          {
            type: "tip",
            body: "Agree on a family safe word. If someone calls sounding like a loved one in trouble, ask for the safe word. A voice clone can't know your secret word.",
          },
        ],
        quiz: [
          {
            type: "multiple_choice",
            question: "You get a voicemail from your boss asking you to urgently transfer funds to a new vendor. The voice sounds exactly like them. What do you do?",
            options: [
              "Transfer the funds immediately — it's clearly your boss",
              "Reply to the voicemail asking if they're sure",
              "Verify through a secondary channel — call your boss directly or check with a colleague",
              "Transfer half the amount to be safe",
            ],
            correct: 2,
            explanation: "Voice cloning can copy anyone's voice from seconds of audio. Always verify financial requests through a separate, known communication channel.",
          },
          {
            type: "true_false",
            question: "AI needs hours of audio to clone someone's voice.",
            correct: false,
            explanation: "Correct! Modern AI can clone a voice from just 3 seconds of audio. That's why you should always verify voice requests through another channel.",
          },
          {
            type: "fill_blank",
            question: "Fill in the blank: A family ______ word can protect you from voice cloning scams.",
            text_before: "A family ",
            text_after: " word can protect you from voice cloning scams.",
            acceptable_answers: ["safe", "code", "secret", "password"],
            explanation: "A safe word that only your real family knows stops voice clone scammers who can't possibly know it.",
          },
        ],
      },
      {
        id: "deepfake_detection",
        title: "Deepfake Detection: Train Your Eye",
        xp: 75,
        content: [
          {
            type: "text",
            heading: "Technical Signs of a Deepfake",
            body: "Deepfakes are getting better, but they still leave clues. Look for: unnatural skin texture (too smooth or too blurry), inconsistent lighting (shadows don't match the face), weird eye behavior (blinking too much or not at all), teeth that look blurred or wrong, and hair edges that look painted. If something feels 'off', trust your instinct.",
          },
          {
            type: "text",
            heading: "Verification Strategies",
            body: "If you see a video making an unbelievable claim from a celebrity or public figure: 1. Check if major news outlets are reporting it. 2. Search for the original source — deepfakes often lack a verifiable origin. 3. Do a reverse image search on a screenshot. 4. Look for the same video on the person's official accounts. If it's only on random social media accounts, be suspicious.",
          },
          {
            type: "tip",
            body: "Deepfakes are designed to trigger strong emotions — anger, fear, outrage. If a video makes you feel extremely emotional, take a breath and verify before sharing. Scammers count on you sharing before thinking.",
          },
        ],
        quiz: [
          {
            type: "multiple_choice",
            question: "You see a viral video of a politician saying something shocking. What's the best way to verify if it's real?",
            options: [
              "Share it immediately — if it's fake, someone will correct you",
              "Check if major news outlets and the politician's official accounts confirm it",
              "Read the comments — if people believe it, it's real",
              "Look at how many views it has — popular videos are real",
            ],
            correct: 1,
            explanation: "Always verify shocking claims through multiple independent sources. Deepfakes spread because people share before verifying. Check official accounts and news outlets.",
          },
          {
            type: "true_false",
            question: "Deepfakes are designed to trigger strong emotions so you share before verifying.",
            correct: true,
            explanation: "Scammers use emotion — anger, fear, outrage — to make you act quickly. If a video makes you feel extremely emotional, that's a sign to slow down and verify.",
          },
        ],
      },
    ],
  },
  {
    id: "qr_codes",
    name: "QR Code Scams",
    icon: "QrCode",
    logo: "https://media.base44.com/images/public/6a46a8e315996af6f0443792/dbc65d00e_generated_image.png",
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
            body: "A QR code is just a link in disguise. You can't see where it goes until you scan it — and by then it may have opened a scam website, started a download, or initiated a payment. Scammers place fake QR codes on parking meters, restaurant menus, and posters.",
          },
          {
            type: "text",
            heading: "Common QR Scams",
            body: "1. Fake parking meters: A sticker over the real QR code sends you to a site that steals your card details.\n2. Restaurant menu scam: A fake QR code on a table leads to a phishing site.\n3. Package delivery: A QR code in a scam text leads to a fake delivery site.\n4. Crypto giveaway: 'Scan to claim free Bitcoin' — the site drains your wallet.",
          },
          {
            type: "tip",
            body: "Before scanning, check if the QR code is a sticker placed over another code. Use your phone's built-in QR scanner (not a third-party app) which often shows the URL before opening it.",
          },
        ],
        quiz: [
          {
            type: "multiple_choice",
            question: "You're at a parking meter and see a QR code sticker for payment. How can you verify it's legitimate?",
            options: [
              "Scan it — QR codes are always safe",
              "Check if it's a sticker placed over another code and look for tampering",
              "Scan it and enter your credit card — if it looks official, it's fine",
              "Take a photo and send it to a friend",
            ],
            correct: 1,
            explanation: "Scammers often place sticker QR codes over real ones. If the code looks like a sticker or is peeling, don't scan it. Use the official parking app instead.",
          },
          {
            type: "true_false",
            question: "A QR code is just a hidden website link that you can't read until you scan it.",
            correct: true,
            explanation: "Correct! That's why QR codes can be dangerous — you don't know where they'll take you until it's too late.",
          },
        ],
      },
      {
        id: "safe_qr_scanning",
        title: "Safe QR Scanning Habits",
        xp: 50,
        content: [
          {
            type: "text",
            heading: "Preview Before You Open",
            body: "Most modern phones show you the URL before opening it when you scan a QR code. Always read this URL. If it looks suspicious — a random string of characters, an unknown domain, or a .tk/.xyz/.top extension — don't open it. You can always decline and type a known URL manually instead.",
          },
          {
            type: "text",
            heading: "Where Scammers Place Fake QR Codes",
            body: "Scammers target high-traffic areas: parking meters, restaurant tables, public transit stations, and even on flyers and posters. They stick their fake QR code on top of the real one. Always check if a QR code looks like a sticker placed over another code. If it's peeling, misaligned, or looks tampered with, don't scan it.",
          },
          {
            type: "tip",
            body: "When possible, use the official app instead of scanning a QR code. If a parking meter has a QR code, check if the city has an official parking app and use that instead. It's safer and often faster.",
          },
        ],
        quiz: [
          {
            type: "multiple_choice",
            question: "You scan a QR code at a restaurant and your phone shows a URL that looks like a random string of characters. What should you do?",
            options: [
              "Open it — it's probably just a short link",
              "Open it but don't enter any personal info",
              "Don't open it — type the restaurant's known website instead",
              "Open it and see what happens",
            ],
            correct: 2,
            explanation: "Legitimate restaurant QR codes usually show a clean, readable URL. Random strings are a red flag. When in doubt, ask staff for the real menu or type the restaurant's website directly.",
          },
          {
            type: "true_false",
            question: "If a QR code is printed on official-looking material, it's always safe to scan.",
            correct: false,
            explanation: "Scammers can print professional-looking stickers and place them over real QR codes. Always check for tampering, especially on public QR codes like parking meters and restaurant tables.",
          },
        ],
      },
    ],
  },
  {
    id: "identity_theft",
    name: "Identity Theft",
    icon: "ShieldAlert",
    logo: "https://media.base44.com/images/public/6a46a8e315996af6f0443792/a035c363d_generated_image.png",
    color: "from-red-500 to-orange-500",
    description: "Protect your personal identity",
    lessons: [
      {
        id: "identity_basics",
        title: "Identity Theft: What You Need to Know",
        xp: 75,
        content: [
          {
            type: "text",
            heading: "What is Identity Theft?",
            body: "Identity theft is when someone steals your personal information — like your Social Security number, bank details, or date of birth — and uses it to open accounts, get loans, or make purchases in your name. It can ruin your credit and take months to fix.",
          },
          {
            type: "text",
            heading: "How Thieves Get Your Info",
            body: "1. Phishing emails and texts that trick you into giving info\n2. Data breaches at companies you use\n3. Stolen mail or trash with personal documents\n4. Public Wi-Fi snooping\n5. Social media oversharing (posting your full birth date, address, etc.)",
          },
          {
            type: "text",
            heading: "How to Protect Yourself",
            body: "1. Shred documents with personal info before throwing them away\n2. Don't carry your Social Security card in your wallet\n3. Use strong, unique passwords for all accounts\n4. Check your credit report yearly for free at AnnualCreditReport.com\n5. Freeze your credit if you're not applying for new accounts",
          },
          {
            type: "tip",
            body: "A credit freeze is free and stops anyone from opening accounts in your name. You can unfreeze it temporarily when you need to apply for credit.",
          },
        ],
        quiz: [
          {
            type: "multiple_choice",
            question: "Which of these is the best way to dispose of documents with personal information?",
            options: [
              "Throw them in the trash",
              "Recycle them as-is",
              "Shred them first",
              "Keep them forever",
            ],
            correct: 2,
            explanation: "Always shred documents with personal info. Thieves go through trash to find bank statements, credit card offers, and other documents.",
          },
          {
            type: "true_false",
            question: "Posting your full birth date and hometown on social media is safe.",
            correct: false,
            explanation: "Correct! Your birth date, full name, and hometown are often enough to steal your identity. Share as little personal info as possible online.",
          },
          {
            type: "fill_blank",
            question: "Fill in the blank: A credit ______ stops anyone from opening new accounts in your name.",
            text_before: "A credit ",
            text_after: " stops anyone from opening new accounts in your name.",
            acceptable_answers: ["freeze", "lock", "block", "freeze lock"],
            explanation: "A credit freeze is free and is one of the best ways to prevent identity theft. You can unfreeze it when you need to apply for credit.",
          },
        ],
      },
      {
        id: "identity_recovery",
        title: "Recovering from Identity Theft",
        xp: 75,
        content: [
          {
            type: "text",
            heading: "Act Fast",
            body: "If your identity is stolen, time is critical. The faster you act, the more you can limit the damage. Step 1: Call the fraud departments of any affected banks or credit card companies. Step 2: Place a fraud alert on your credit report by contacting any one of the three major bureaus (Equifax, Experian, TransUnion). Step 3: File a report with the FTC at IdentityTheft.gov. Step 4: File a police report — many banks require this to reverse fraudulent charges.",
          },
          {
            type: "text",
            heading: "Freeze Your Credit",
            body: "A credit freeze stops anyone (including you) from opening new accounts in your name. It's free and can be done online with each of the three credit bureaus. If you need to apply for credit, you can temporarily lift the freeze. This is the single most effective step to prevent further damage after identity theft.",
          },
          {
            type: "tip",
            body: "Keep records of everything: dates, times, who you spoke with, and reference numbers. This documentation is essential for disputing charges and proving your case to banks and credit bureaus.",
          },
        ],
        quiz: [
          {
            type: "multiple_choice",
            question: "You discover someone opened a credit card in your name. What should you do FIRST?",
            options: [
              "Wait to see if they make charges before acting",
              "Call the fraud department of the affected bank and place a fraud alert",
              "Post about it on social media to warn others",
              "Pay off the fraudulent card to protect your credit score",
            ],
            correct: 1,
            explanation: "Act immediately. Call the bank's fraud department, place a fraud alert on your credit, and file reports with the FTC and police. Never pay off fraudulent charges — that's accepting responsibility for debt that isn't yours.",
          },
          {
            type: "true_false",
            question: "A credit freeze costs money and hurts your credit score.",
            correct: false,
            explanation: "Credit freezes are free by federal law and do NOT affect your credit score. They simply prevent new accounts from being opened in your name. You can lift the freeze temporarily when needed.",
          },
        ],
      },
    ],
  },
  {
    id: "online_shopping",
    name: "Online Shopping Safety",
    icon: "ShoppingBag",
    logo: "https://media.base44.com/images/public/6a46a8e315996af6f0443792/1f0a82069_generated_image.png",
    color: "from-blue-500 to-cyan-500",
    description: "Shop online without getting scammed",
    lessons: [
      {
        id: "shopping_basics",
        title: "Safe Online Shopping",
        xp: 50,
        content: [
          {
            type: "text",
            heading: "Check Before You Buy",
            body: "Before buying from a new website, check for: 1. 'https' in the web address (the 's' means secure) 2. A padlock icon in the address bar 3. Contact info like a real address and phone number 4. Clear return and refund policies. If any of these are missing, shop elsewhere.",
          },
          {
            type: "text",
            heading: "Use a Credit Card, Not Debit",
            body: "Always pay with a credit card or PayPal when shopping online. Credit cards have fraud protection — if you're scammed, you can dispute the charge. Debit cards take money directly from your bank, and getting it back is much harder.",
          },
          {
            type: "text",
            heading: "Watch Out for Fake Reviews",
            body: "If all reviews are 5 stars, sound very similar, or were all posted on the same day, they might be fake. Check reviews on multiple sites, not just the store's page. Look for reviews that mention specific details — both good and bad.",
          },
          {
            type: "tip",
            body: "If a website asks for your Social Security number or bank login to buy something, it's a scam. No legitimate store needs that information.",
          },
        ],
        quiz: [
          {
            type: "multiple_choice",
            question: "Which payment method offers the best fraud protection for online shopping?",
            options: [
              "Debit card",
              "Bank transfer",
              "Credit card or PayPal",
              "Gift card",
            ],
            correct: 2,
            explanation: "Credit cards and PayPal have strong fraud protection. You can dispute charges and get your money back. Debit cards and bank transfers are much harder to reverse.",
          },
          {
            type: "true_false",
            question: "A website with 'https' and a padlock icon is always safe to buy from.",
            correct: false,
            explanation: "Not quite! 'https' means the connection is secure, but it doesn't mean the website itself is trustworthy. Scammers can also get 'https' certificates. Check for reviews and contact info too.",
          },
          {
            type: "fill_blank",
            question: "Fill in the blank: If all reviews are 5 stars and sound the same, they might be ______.",
            text_before: "If all reviews are 5 stars and sound the same, they might be ",
            text_after: ".",
            acceptable_answers: ["fake", "false", "fake reviews", "not real", "fake false"],
            explanation: "Fake reviews are common on scam websites. Check reviews on independent sites and look for detailed, balanced reviews.",
          },
        ],
      },
      {
        id: "fake_stores",
        title: "Spotting Fake Online Stores",
        xp: 50,
        content: [
          {
            type: "text",
            heading: "Signs of a Fake Store",
            body: "Fake online stores are designed to steal your money and card details. Watch for: prices 50-90% below normal (a $1000 camera for $150 is a scam), no physical address or phone number, poor grammar and spelling, no return policy, a domain that's very new (check with whois.com), and payment only via wire transfer, crypto, or gift cards. If the deal is impossibly good, the store is fake.",
          },
          {
            type: "text",
            heading: "Social Media Ad Scams",
            body: "Many fake stores advertise on Facebook, Instagram, and TikTok. They show professional product photos stolen from real brands. You order, they take your money, and either send nothing or send a cheap knockoff. Before buying from a social media ad: search for the store name + 'scam' or 'reviews', check how long the domain has existed, and see if they have a real social media presence with real customer interactions.",
          },
          {
            type: "tip",
            body: "Use a credit card for all online purchases. If the store is fake, you can dispute the charge and get your money back. Never pay with debit card, wire transfer, crypto, or gift cards — these can't be reversed.",
          },
        ],
        quiz: [
          {
            type: "multiple_choice",
            question: "You see a Facebook ad for a luxury watch brand selling $500 watches for $39.99. The store looks professional. What should you do?",
            options: [
              "Buy it — it's probably a clearance sale",
              "Buy one and see if it arrives",
              "Search for the store name + 'scam' and check the domain age before buying",
              "Buy it but use PayPal for protection",
            ],
            correct: 2,
            explanation: "Luxury brands don't sell at 90% off. Search for the store name + 'scam', check the domain age on whois.com, and look for reviews on independent sites. If it's a new domain with no real reviews, it's a scam.",
          },
          {
            type: "true_false",
            question: "A professional-looking website with high-quality photos is always a legitimate store.",
            correct: false,
            explanation: "Scammers steal product photos from real brands and build professional-looking websites in minutes. The design doesn't make it real. Check for physical addresses, return policies, domain age, and independent reviews.",
          },
        ],
      },
    ],
  },
  {
    id: "social_media",
    name: "Social Media Scams",
    icon: "Heart",
    logo: "https://media.base44.com/images/public/6a46a8e315996af6f0443792/459091435_generated_image.png",
    color: "from-pink-500 to-purple-500",
    description: "Stay safe on social platforms",
    lessons: [
      {
        id: "social_basics",
        title: "Social Media Scam Basics",
        xp: 50,
        content: [
          {
            type: "text",
            heading: "Common Social Media Scams",
            body: "1. Fake giveaways: 'Share this post and we'll send you a free iPhone!' — they just want your data.\n2. Romance scams: Someone falls in love with you fast, then needs money for an 'emergency'.\n3. Account takeover: 'You've been hacked! Click here to secure your account' — the link steals your login.\n4. Fake brand accounts: Impersonators offering customer support to steal your info.",
          },
          {
            type: "text",
            heading: "Protect Your Account",
            body: "1. Use a strong, unique password for each social media account\n2. Enable two-factor authentication\n3. Set profiles to private so strangers can't see your personal info\n4. Don't accept friend requests from people you don't know\n5. Never share your 2FA codes or login details with anyone",
          },
          {
            type: "tip",
            body: "Be careful what you share publicly. Scammers use your posts — vacation photos, family details, location check-ins — to target you or pretend to be you.",
          },
        ],
        quiz: [
          {
            type: "multiple_choice",
            question: "Someone you just met on social media falls in love with you quickly, then says they have an emergency and needs money. What is this?",
            options: [
              "True love",
              "A romance scam — they're after your money, not a relationship",
              "A misunderstanding",
              "Normal online dating",
            ],
            correct: 1,
            explanation: "Romance scammers move fast, avoid video calls, and eventually ask for money. Never send money to someone you haven't met in person.",
          },
          {
            type: "true_false",
            question: "It's safe to click links in direct messages from accounts you don't know.",
            correct: false,
            explanation: "Correct! Never click links from strangers. They often lead to phishing sites designed to steal your login or install malware.",
          },
          {
            type: "fill_blank",
            question: "Fill in the blank: If someone falls in love with you very quickly online and then asks for money, it's likely a ______ scam.",
            text_before: "If someone falls in love with you very quickly online and then asks for money, it's likely a ",
            text_after: " scam.",
            acceptable_answers: ["romance", "love", "dating", "catfish", "catfishing"],
            explanation: "Romance scams are one of the most common and costly social media scams. Real relationships don't move that fast or ask for money.",
          },
        ],
      },
      {
        id: "social_media_privacy",
        title: "Protecting Your Social Media Privacy",
        xp: 50,
        content: [
          {
            type: "text",
            heading: "What Not to Share",
            body: "Scammers use your social media to target you. Never post: your full birth date (month, day, AND year), your home address, photos of the front of your house, vacation plans while you're away (post after you return), photos of IDs or boarding passes, or your phone number. Each piece of info helps scammers impersonate you, guess your security questions, or target you with personalized scams.",
          },
          {
            type: "text",
            heading: "Lock Down Your Accounts",
            body: "1. Set profiles to private so only friends can see your posts. 2. Review your friend list — remove people you don't know. 3. Turn off location tagging in posts and photos. 4. Disable 'check-ins' that reveal where you are. 5. Review third-party apps connected to your social media and remove any you don't use. 6. Enable two-factor authentication on every account.",
          },
          {
            type: "tip",
            body: "Scammers stalk social media to build convincing phishing messages. If you post about your bank, they'll send you a fake email from that bank. If you post about a delivery, they'll text you about a 'package issue'. Share less, get scammed less.",
          },
        ],
        quiz: [
          {
            type: "multiple_choice",
            question: "Which of these is safe to post on social media?",
            options: [
              "Your full birth date including year",
              "A photo of your boarding pass",
              "A vacation photo after you've returned home",
              "Your home address and phone number",
            ],
            correct: 2,
            explanation: "Posting vacation photos after you return is safe. Everything else gives scammers information they can use to target you. Never post your full birth date, boarding passes, or home address publicly.",
          },
          {
            type: "true_false",
            question: "Scammers can use your social media posts to create convincing phishing emails.",
            correct: true,
            explanation: "If you post about your bank or a recent purchase, scammers use that info to craft personalized phishing messages that look real. The less you share, the harder you are to target.",
          },
        ],
      },
    ],
  },
  {
    id: "final_review",
    name: "Final Review",
    icon: "ShieldCheck",
    logo: "https://media.base44.com/images/public/6a46a8e315996af6f0443792/e7608ba85_generated_image.png",
    color: "from-primary to-primary/70",
    description: "Test everything you've learned",
    lessons: [
      {
        id: "final_review_quiz",
        title: "Scam Detection Final Exam",
        xp: 200,
        content: [
          {
            type: "text",
            heading: "You've Come a Long Way!",
            body: "This final review tests everything you've learned across all the lessons. You'll face questions about phishing emails, scam texts, marketplace fraud, crypto scams, password security, deepfakes, QR code scams, identity theft, online shopping, social media, and family safety.\n\nTake your time. Think before you answer. And remember — the same skills that help you pass this exam will keep you and your family safe in the real world.",
          },
          {
            type: "tip",
            body: "The golden rule of scam detection: If something creates urgency, fear, or greed — slow down. Scammers want you to act before you think. Taking 30 seconds to verify can save you thousands.",
          },
        ],
        quiz: [
          {
            type: "multiple_choice",
            question: "You receive an email from 'security@paypal-verify.com' saying your account is limited. It asks you to click a link and log in. What's the safest action?",
            options: [
              "Click the link and log in to verify",
              "Reply to the email asking if it's real",
              "Open a new browser tab, type paypal.com yourself, and log in there to check",
              "Forward it to a friend and ask them to check it",
            ],
            correct: 2,
            explanation: "Never click links in suspicious emails. Always go to the website directly by typing the address yourself. The domain 'paypal-verify.com' is NOT paypal.com — it's a phishing site.",
          },
          {
            type: "true_false",
            question: "A QR code is always safe to scan because it's just a barcode.",
            correct: false,
            explanation: "A QR code is just a hidden website link. You can't see where it goes until you scan it, and it might lead to a scam website. Check for tampering and use your phone's built-in scanner.",
          },
          {
            type: "fill_blank",
            question: "Fill in the blank: Scammers create a false sense of ______ to make you act before you think.",
            text_before: "Scammers create a false sense of ",
            text_after: " to make you act before you think.",
            acceptable_answers: ["urgency", "panic", "fear", "emergency", "pressure"],
            explanation: "Urgency is the #1 tool scammers use. They want you to panic and act without thinking. If you feel rushed, that's a sign to slow down.",
          },
          {
            type: "multiple_choice",
            question: "Which of these is the strongest password?",
            options: [
              "Password123!",
              "correct-horse-battery-staple-9",
              "YourName2026",
              "Qwerty!",
            ],
            correct: 1,
            explanation: "Length is the most important factor in password strength. A long passphrase is both harder to crack and easier to remember than a short complex password.",
          },
          {
            type: "true_false",
            question: "If a buyer on a marketplace sends you more money than the asking price and asks for a refund of the difference, it's a legitimate mistake.",
            correct: false,
            explanation: "This is the classic overpayment scam. The original payment is fake and will be reversed, leaving you out both the item and the refund money. Never refund overpayments.",
          },
          {
            type: "multiple_answer",
            question: "Which of these are signs of a phishing email? (Select all that apply)",
            options: [
              "Generic greeting like 'Dear Customer'",
              "Threats to close your account if you don't act fast",
              "A professional company logo",
              "A link to a website that doesn't match the company's real domain",
            ],
            correct: [0, 1, 3],
            explanation: "Generic greetings, urgency threats, and mismatched URLs are all phishing red flags. A professional logo alone doesn't mean an email is fake — but it also doesn't mean it's real. Scammers copy logos easily.",
          },
          {
            type: "true_false",
            question: "AI can clone someone's voice from just 3 seconds of audio.",
            correct: true,
            explanation: "Modern AI voice cloning is incredibly advanced. Scammers can call pretending to be a family member in distress. Always verify by calling back on a known number and use a family safe word.",
          },
          {
            type: "fill_blank",
            question: "Fill in the blank: A credit ______ stops anyone from opening new accounts in your name.",
            text_before: "A credit ",
            text_after: " stops anyone from opening new accounts in your name.",
            acceptable_answers: ["freeze", "lock", "block"],
            explanation: "A credit freeze is free and is one of the best tools against identity theft. You can unfreeze it temporarily when you need to apply for credit.",
          },
          {
            type: "multiple_choice",
            question: "An online romantic interest you've never met introduces you to a crypto investment platform with guaranteed daily returns. What should you do?",
            options: [
              "Invest a small amount to test it",
              "Ask them for proof of their earnings",
              "Stop communicating — this is a 'pig butchering' romance + crypto scam",
              "Introduce your friends so they can invest too",
            ],
            correct: 2,
            explanation: "Pig butchering scams combine romance fraud with crypto fraud. The relationship is fake, built over weeks to gain trust. The investment platform is fake. Once you deposit money, it's gone forever.",
          },
          {
            type: "true_false",
            question: "Your bank will never ask you to confirm your password or full Social Security number through an email link.",
            correct: true,
            explanation: "Correct! Banks never ask for passwords or full SSNs by email. If you're unsure about a bank message, call the number on the back of your card — never the number in the email.",
          },
          {
            type: "fill_blank",
            question: "Fill in the blank: Having a family ______ word can protect you from voice cloning and impersonation scams.",
            text_before: "Having a family ",
            text_after: " word can protect you from voice cloning and impersonation scams.",
            acceptable_answers: ["safe", "code", "secret", "password"],
            explanation: "A family safe word that only your real family knows stops scammers who can clone voices or impersonate family members. If they don't know the word, they're not your family.",
          },
          {
            type: "multiple_choice",
            question: "You get a text: 'USPS: Package on hold. Pay $2 fee here: [link]'. What's the safest action?",
            options: [
              "Click the link and pay the $2 fee",
              "Reply to confirm your address",
              "Check your actual delivery app or tracking number from your original order",
              "Call the number in the text",
            ],
            correct: 2,
            explanation: "Package delivery scams are extremely common. Real delivery services don't send payment links by text. Check your original order confirmation or delivery app instead.",
          },
          {
            type: "multiple_answer",
            question: "Which payment methods are safe for online shopping? (Select all that apply)",
            options: [
              "Credit card",
              "PayPal",
              "Bank transfer to an unknown seller",
              "Gift cards",
              "Cryptocurrency to an unknown seller",
            ],
            correct: [0, 1],
            explanation: "Credit cards and PayPal have strong fraud protection and let you dispute charges. Bank transfers, gift cards, and crypto can't be reversed — they're scammers' favorite payment methods.",
          },
          {
            type: "true_false",
            question: "If a website has 'https' and a padlock icon in the address bar, it's always safe to buy from.",
            correct: false,
            explanation: "'https' means the connection is secure, not that the website is trustworthy. Scammers can also get 'https' certificates. Always check for reviews, contact info, and return policies before buying.",
          },
          {
            type: "fill_blank",
            question: "Fill in the blank: Two-factor authentication is also called ______ for short.",
            text_before: "Two-factor authentication is also called ",
            text_after: " for short.",
            acceptable_answers: ["2fa", "2 fa", "two-factor", "two factor"],
            explanation: "2FA adds a second layer of security beyond your password. Even if someone steals your password, they can't log in without the second code.",
          },
        ],
      },
    ],
  },
];

// Merge extra lessons into existing categories
LESSON_CATEGORIES.forEach((cat) => {
  if (EXTRA_LESSONS[cat.id]) {
    cat.lessons.push(...EXTRA_LESSONS[cat.id]);
  }
});

// Append new categories
LESSON_CATEGORIES.push(...NEW_CATEGORIES);

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
    ShieldAlert: "ShieldAlert",
    ShoppingBag: "ShoppingBag",
    Heart: "Heart",
    Phone: "Phone",
    Briefcase: "Briefcase",
    Flame: "Flame",
    Newspaper: "Newspaper",
  };
  return icons[name] || "ShieldCheck";
}