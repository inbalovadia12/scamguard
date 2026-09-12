// Additional bite-sized learning units for the gamified Learning Path.
// Each lesson follows the same content/quiz contract as the core lesson library.
export const GAMIFIED_CATEGORIES = [
  {
    id: "banking_payment_safety",
    name: "Banking & Payment Safety",
    icon: "ShieldCheck",
    color: "from-emerald-500 to-teal-600",
    description: "Protect your money when payments go wrong",
    lessons: [
      {
        id: "bank_impersonation",
        title: "Bank Impersonation: Stop the 'Safe Account' Scam",
        xp: 60,
        content: [
          { type: "text", heading: "The 'Safe Account' Trick", body: "A scammer calls claiming to be your bank's fraud team. They say your account is under attack and tell you to move your money to a 'safe' account. That new account belongs to the scammer. Your real bank will never tell you to transfer money to protect it." },
          { type: "tip", body: "If someone calls about fraud, hang up and call the number on the back of your card. Never move money because an incoming caller tells you to." },
        ],
        quiz: [
          { type: "multiple_choice", question: "A caller says your bank account is compromised and tells you to move your money to a 'safe account.' What should you do?", options: ["Move it immediately", "Ask for their employee ID", "Hang up and call your bank using an official number", "Transfer only half"], correct: 2, explanation: "A 'safe account' transfer is a classic impersonation scam. Your bank can protect an account without asking you to move your money to a stranger's account." },
          { type: "true_false", question: "A bank may ask you to transfer your savings to another account to protect it from fraud.", correct: false, explanation: "Legitimate banks do not tell customers to move money to a new 'safe' account controlled by the caller." },
        ],
      },
      {
        id: "payment_app_scams",
        title: "Payment App Scams: Zelle, Venmo & More",
        xp: 60,
        content: [
          { type: "text", heading: "Why Payment Apps Attract Scammers", body: "Fast payment apps are convenient, but scammers love them because transfers can be difficult to reverse. Common tricks include fake purchase requests, fake refunds, impersonation, and messages claiming you must pay a fee to receive money." },
          { type: "text", heading: "Your Safety Rule", body: "Never send money to someone you cannot independently verify. Never trust a screenshot as proof of payment. Check your actual account balance or transaction history instead." },
          { type: "tip", body: "A screenshot is not money. Verify inside your own banking or payment app before handing over an item or sending anything back." },
        ],
        quiz: [
          { type: "multiple_choice", question: "A buyer sends you a screenshot saying they paid you, but the money isn't visible in your payment app. What do you do?", options: ["Give them the item", "Refund them immediately", "Wait and verify the payment in your own account", "Ask them for another screenshot"], correct: 2, explanation: "Screenshots are easy to fake. Trust only the transaction history or balance in your own account." },
          { type: "true_false", question: "If someone sends you a payment screenshot, that proves the payment reached your account.", correct: false, explanation: "Only your own payment or banking app can confirm whether money actually arrived." },
        ],
      },
      {
        id: "atm_skimmer_awareness",
        title: "ATM & Card Skimmers: Check Before You Pay",
        xp: 60,
        content: [
          { type: "text", heading: "What Is a Skimmer?", body: "A skimmer is a device criminals attach to a card reader to copy card data. Some criminals also use hidden cameras or fake keypads to capture PINs. Tampering can be difficult to spot, so prefer ATMs in secure, well-monitored locations." },
          { type: "tip", body: "If a card reader looks loose, damaged, unusually bulky, or different from nearby machines, don't use it. Cover your PIN with your hand and choose a different ATM if anything feels wrong." },
        ],
        quiz: [
          { type: "multiple_choice", question: "An ATM card reader looks loose and has an unfamiliar attachment. What is the safest choice?", options: ["Use it carefully", "Pull the attachment off", "Don't use it and report the machine", "Enter your PIN quickly"], correct: 2, explanation: "Don't tamper with suspected criminal equipment. Use another ATM and notify the bank or operator." },
          { type: "true_false", question: "Covering your PIN while entering it can reduce the risk of a hidden camera capturing it.", correct: true, explanation: "Covering the keypad is a simple protective habit against cameras or people watching your PIN." },
        ],
      },
    ],
  },
  {
    id: "social_engineering",
    name: "Social Engineering",
    icon: "Users",
    color: "from-fuchsia-500 to-violet-600",
    description: "Understand the tricks scammers use on your brain",
    lessons: [
      {
        id: "authority_pressure",
        title: "Authority & Pressure: 'I'm Calling From...'",
        xp: 50,
        content: [
          { type: "text", heading: "Why Authority Works", body: "Scammers pretend to be people you are trained to trust: police officers, bank employees, bosses, doctors, or government agents. The title creates authority before they have proved who they are." },
          { type: "text", heading: "Flip the Script", body: "A title is not proof. Verify the identity independently. A legitimate organization will tolerate a callback or another verification step." },
          { type: "tip", body: "When someone says 'I'm calling from the bank,' translate it in your head to: 'Someone claims to be from the bank.' That small mental shift helps you verify." },
        ],
        quiz: [
          { type: "multiple_choice", question: "A caller says they're a police officer and demands immediate payment. What should you focus on first?", options: ["Their title", "How scary the threat sounds", "Independently verifying the caller", "Paying quickly"], correct: 2, explanation: "Authority can be faked. Verify independently before taking action." },
          { type: "true_false", question: "A caller's job title proves their identity.", correct: false, explanation: "Anyone can claim to be a bank employee, officer, or government agent. Identity still needs verification." },
        ],
      },
      {
        id: "scarcity_scam_tactics",
        title: "Scarcity & FOMO: 'Only 2 Left!'",
        xp: 50,
        content: [
          { type: "text", heading: "Scarcity Creates Speed", body: "Scammers use countdowns, limited spots, expiring offers, and 'last chance' messages to make you decide before you investigate. The goal isn't always the offer itself — it's preventing you from taking time to verify it." },
          { type: "tip", body: "A legitimate opportunity can survive a few minutes of verification. If someone says you must decide immediately, make the pressure itself a reason to stop." },
        ],
        quiz: [
          { type: "multiple_choice", question: "A stranger says an investment opportunity disappears in five minutes. What's the best response?", options: ["Invest a small amount", "Ask a friend while staying on the call", "Pause and verify independently", "Give them your details first"], correct: 2, explanation: "Artificial scarcity is a manipulation tactic. Slow down and verify through independent sources." },
          { type: "true_false", question: "A countdown timer on an offer proves the offer is legitimate.", correct: false, explanation: "Timers can be fake or used simply to create pressure." },
        ],
      },
      {
        id: "isolation_tactics",
        title: "Isolation: 'Don't Tell Anyone'",
        xp: 50,
        content: [
          { type: "text", heading: "Why Scammers Want Privacy", body: "A trusted friend, family member, coworker, or bank employee may spot a scam immediately. Scammers know this, so they may tell you to keep the situation secret or claim that talking to others will cause trouble." },
          { type: "tip", body: "'Don't tell anyone' is a reason to tell someone you trust. A second pair of eyes can break the scammer's control." },
        ],
        quiz: [
          { type: "multiple_choice", question: "A caller says you're under investigation and must not tell your family. What should you do?", options: ["Keep it secret", "Tell someone you trust and verify independently", "Pay first", "Stay on the call"], correct: 1, explanation: "Isolation is a classic social-engineering tactic. Getting another trusted person involved can stop the manipulation." },
          { type: "true_false", question: "Being told not to tell anyone is a strong reason to seek a second opinion.", correct: true, explanation: "Yes. Scammers use secrecy to prevent other people from recognizing the fraud." },
        ],
      },
    ],
  },
  {
    id: "travel_rental_scams",
    name: "Travel & Rental Scams",
    icon: "ShieldAlert",
    color: "from-sky-500 to-blue-600",
    description: "Travel without paying a scammer",
    lessons: [
      {
        id: "fake_rental_listings",
        title: "Fake Vacation Rentals",
        xp: 60,
        content: [
          { type: "text", heading: "The Too-Perfect Rental", body: "Scammers copy photos from real properties and advertise them at unusually low prices. They may pressure you to pay outside the booking platform because the platform's protections make their scam harder." },
          { type: "text", heading: "Verify Before Paying", body: "Check the property on multiple sources, inspect the listing history and reviews, and keep payment inside the trusted booking platform. Be suspicious of requests for wire transfers, crypto, gift cards, or direct bank payments." },
          { type: "tip", body: "A beautiful listing proves nothing. The safest signal is a verified booking and payment process with meaningful buyer protection." },
        ],
        quiz: [
          { type: "multiple_choice", question: "A vacation-rental host asks you to leave the booking platform and pay by bank transfer for a discount. What should you do?", options: ["Pay — the discount is worth it", "Pay half", "Keep the booking and payment on the platform", "Send your ID first"], correct: 2, explanation: "Moving off-platform removes important protections and is a common scam tactic." },
          { type: "true_false", question: "Scammers can copy photos from real vacation rentals and use them in fake listings.", correct: true, explanation: "Stolen photos are commonly used to make fake properties look legitimate." },
        ],
      },
      {
        id: "travel_booking_phishing",
        title: "Fake Hotel & Airline Messages",
        xp: 60,
        content: [
          { type: "text", heading: "The Booking Problem Scam", body: "You receive a message saying your hotel reservation or flight has a problem and you must pay a fee or confirm your card. The message may use your real booking details obtained through leaks or compromised accounts." },
          { type: "tip", body: "Don't use the link in the message. Open the airline, hotel, or booking app yourself and check the reservation there." },
        ],
        quiz: [
          { type: "multiple_choice", question: "A text says your flight is canceled and asks you to click a link to rebook. What's safest?", options: ["Click immediately", "Reply with your booking number", "Open the airline's official app or website yourself", "Call the number in the text"], correct: 2, explanation: "Use a trusted route to your airline rather than a link or phone number supplied by the message." },
          { type: "true_false", question: "A scammer may know real booking details and still be sending a fake message.", correct: true, explanation: "Leaked or compromised booking information can make phishing messages look convincing." },
        ],
      },
      {
        id: "public_wifi_traps",
        title: "Public Wi-Fi: Don't Trust the Network Name",
        xp: 50,
        content: [
          { type: "text", heading: "Fake Wi-Fi Networks", body: "Attackers can create networks with names that look like a hotel, airport, café, or conference network. Connecting may expose traffic or send you to fake login pages." },
          { type: "tip", body: "For sensitive tasks, use your mobile connection or a trusted network. Forget networks you no longer need and avoid entering banking credentials through unexpected Wi-Fi login pages." },
        ],
        quiz: [
          { type: "multiple_choice", question: "At an airport you see two Wi-Fi networks with almost identical names. What is safest?", options: ["Choose the stronger signal", "Connect to both", "Ask airport staff for the official network name", "Choose the one without a password"], correct: 2, explanation: "Signal strength and network names aren't proof of authenticity. Verify the official network through a trusted source." },
          { type: "true_false", question: "A Wi-Fi network name alone proves that the network is operated by the business it claims to represent.", correct: false, explanation: "Anyone nearby can create a Wi-Fi network with a convincing name." },
        ],
      },
    ],
  },
  {
    id: "scam_response",
    name: "Scam Response Skills",
    icon: "ShieldCheck",
    color: "from-green-500 to-emerald-600",
    description: "Know what to do after you spot a scam",
    lessons: [
      {
        id: "stop_contact_verify",
        title: "The 30-Second Scam Stop",
        xp: 50,
        content: [
          { type: "text", heading: "Step 1: Stop", body: "Don't click, pay, reply, download, or share information while you're under pressure. A pause breaks the scammer's momentum." },
          { type: "text", heading: "Step 2: Verify", body: "Use a trusted channel you found yourself: an official app, a phone number on your card, a known contact, or the organization's official website." },
          { type: "text", heading: "Step 3: Ask Someone", body: "If you're still unsure, show the message or situation to someone you trust. Scams become much easier to spot when you aren't emotionally inside the situation." },
          { type: "tip", body: "Remember: STOP → VERIFY → ASK. You don't have to solve a suspicious situation immediately." },
        ],
        quiz: [
          { type: "multiple_choice", question: "What is the best first move when a message makes you feel rushed or afraid?", options: ["Act quickly", "Stop and pause", "Reply to ask questions", "Forward it to everyone"], correct: 1, explanation: "Stopping interrupts the scammer's pressure and gives you time to verify." },
          { type: "true_false", question: "Asking a trusted person for a second opinion can help break a scammer's emotional pressure.", correct: true, explanation: "A second perspective often makes manipulation easier to recognize." },
        ],
      },
      {
        id: "after_clicking_phishing",
        title: "I Clicked the Link — Now What?",
        xp: 60,
        content: [
          { type: "text", heading: "Don't Panic", body: "Clicking a suspicious link does not automatically mean your accounts are compromised. What you do next matters. Stop interacting with the page and don't enter additional information." },
          { type: "text", heading: "If You Entered a Password", body: "Change that password immediately from the real website or app. If you reused it elsewhere, change those accounts too. Enable two-factor authentication and review recent account activity." },
          { type: "tip", body: "If you entered payment or identity information, contact the relevant bank or organization promptly using an official number." },
        ],
        quiz: [
          { type: "multiple_choice", question: "You entered your password into a suspicious page. What's the most important next step?", options: ["Wait and see", "Change the password from the real service and secure reused accounts", "Delete the browser", "Message the scammer"], correct: 1, explanation: "Change the compromised password using the legitimate service and secure any other account where it was reused." },
          { type: "true_false", question: "You should contact your bank using a number from the suspicious message if you entered card details.", correct: false, explanation: "Use the number on your card or the bank's official website, not contact details supplied by the scammer." },
        ],
      },
      {
        id: "scam_report_evidence",
        title: "Save Evidence Without Engaging",
        xp: 50,
        content: [
          { type: "text", heading: "What to Save", body: "Keep screenshots, sender addresses, phone numbers, URLs, transaction IDs, dates, and receipts. Don't delete evidence before you have recorded it." },
          { type: "text", heading: "Don't Fight the Scammer", body: "You don't need to confront or threaten a scammer. Blocking them and preserving evidence is safer than continuing the conversation." },
          { type: "tip", body: "Evidence is useful to your bank, the platform, and law enforcement. Save it first, then block and report." },
        ],
        quiz: [
          { type: "multiple_choice", question: "What's the best approach after documenting a scam message?", options: ["Argue with the scammer", "Threaten them", "Block/report them and keep the evidence", "Keep chatting to learn more"], correct: 2, explanation: "Preserve evidence, then disengage. Continuing contact gives the scammer more opportunities to manipulate you." },
          { type: "multiple_answer", question: "Which items can be useful evidence? (Select all that apply)", options: ["Screenshots", "Phone numbers", "URLs", "Transaction IDs"], correct: [0, 1, 2, 3], explanation: "All of these can help document what happened and support reports or disputes." },
        ],
      },
    ],
  },
];
