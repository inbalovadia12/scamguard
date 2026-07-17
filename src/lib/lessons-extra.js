// Extra lessons for existing categories — appended via lessons.js merge logic
export const EXTRA_LESSONS = {
  phishing_emails: [
    {
      id: "spear_phishing",
      title: "Spear Phishing: When Scammers Know Your Name",
      xp: 75,
      content: [
        {
          type: "text",
          heading: "What is Spear Phishing?",
          body: "Unlike regular phishing that casts a wide net, spear phishing targets specific people. Scammers research you on social media and LinkedIn to craft emails that feel personal. They might mention your boss's name, a project you're working on, or a recent purchase. This makes the email far more convincing.",
        },
        {
          type: "text",
          heading: "How They Get Your Info",
          body: "Scammers gather info from: your LinkedIn profile (job title, colleagues), your company website (org charts), social media posts (vacations, events), and data breaches (email, phone, passwords). With this info, they craft emails that look like they're from someone you know.",
        },
        {
          type: "tip",
          body: "If an email from a colleague seems unusual — different tone, unexpected request, odd urgency — verify through another channel. Text or call them directly using the number you already have, not one from the email.",
        },
      ],
      quiz: [
        {
          type: "multiple_choice",
          question: "You get an email from your CEO asking you to urgently buy gift cards for a client meeting. The email uses their real name and mentions a real project. What should you do?",
          options: [
            "Buy the gift cards immediately — it's the CEO",
            "Reply to the email asking for confirmation",
            "Verify through a different channel — call your CEO's office or message them on Slack",
            "Buy half the amount to be safe",
          ],
          correct: 2,
          explanation: "Spear phishers research your company to impersonate executives. Always verify unusual requests (especially financial) through a different communication channel.",
        },
        {
          type: "true_false",
          question: "If an email mentions your real name and job title, it must be from someone who knows you.",
          correct: false,
          explanation: "Scammers can find your name and job title on LinkedIn and company websites. Personal details don't prove the sender is legitimate.",
        },
      ],
    },
  ],
  scam_texts: [
    {
      id: "text_spoofing",
      title: "Text Spoofing: Fake Sender Numbers",
      xp: 50,
      content: [
        {
          type: "text",
          heading: "How Text Spoofing Works",
          body: "Scammers can make a text message appear to come from any number — even your bank's official short code or a friend's number. They use spoofing services that fake the sender ID. The message looks real because it comes from 'Bank of America' or shows your friend's name.",
        },
        {
          type: "text",
          heading: "How to Verify",
          body: "Never trust the sender name in a text. If a text asks you to take action (click a link, call a number, share info), independently verify. Open your bank's app directly or call the number on the back of your card. For friends, start a new message thread rather than replying.",
        },
        {
          type: "tip",
          body: "Banks never ask you to transfer money to a 'safe account' or share your full PIN via text. If a text creates urgency around money, verify through the official app or phone number.",
        },
      ],
      quiz: [
        {
          type: "multiple_choice",
          question: "You get a text from 'your bank' (shows the bank's name) saying a transfer was flagged. It asks you to reply YES or NO. What should you do?",
          options: [
            "Reply — it's clearly from the bank",
            "Open your banking app or call the number on your card to check",
            "Reply NO to cancel the transfer",
            "Text back asking for more details",
          ],
          correct: 1,
          explanation: "Sender IDs can be spoofed. Always verify through your bank's official app or the phone number printed on your card — never the one in the text.",
        },
        {
          type: "fill_blank",
          question: "Fill in the blank: Scammers can fake the sender ID in a text message, which is called ______.",
          text_before: "Scammers can fake the sender ID in a text message, which is called ",
          text_after: ".",
          acceptable_answers: ["spoofing", "spoof", "caller id spoofing", "text spoofing"],
          explanation: "Spoofing allows scammers to display any sender name or number, even legitimate ones. Never trust the sender name alone.",
        },
      ],
    },
  ],
  marketplace_scams: [
    {
      id: "marketplace_bait_switch",
      title: "Bait and Switch: When What You Get Isn't What You Saw",
      xp: 75,
      content: [
        {
          type: "text",
          heading: "The Bait and Switch",
          body: "A seller lists a high-quality item at a great price. You pay, but receive a cheap knockoff, a different model, or an empty box. By the time you realize, the seller has disappeared or changed their listing. This is common on platforms with weak seller verification.",
        },
        {
          type: "text",
          heading: "How to Protect Yourself",
          body: "1. Check seller history: account age, reviews, and previous sales.\n2. Compare photos: reverse image search the listing photos — if they appear on multiple listings, they're stolen.\n3. Use platform payment: never pay via wire, crypto, or gift cards.\n4. Record the unboxing: film yourself opening the package as evidence for disputes.\n5. Check the return policy before buying.",
        },
        {
          type: "tip",
          body: "If a deal looks too good on a seller's first listing, or the photos look like professional stock images, it's likely a bait and switch. Stick to established sellers with real reviews.",
        },
      ],
      quiz: [
        {
          type: "multiple_choice",
          question: "You order a branded jacket for $40 (normally $200) from a new seller. It arrives as a cheap, unlabeled knockoff. What went wrong?",
          options: [
            "You got unlucky — it's a one-time mistake",
            "It's a bait and switch scam — the listing used stolen photos and sent a fake",
            "The seller ran out of the real item",
            "Shipping damaged the product",
          ],
          correct: 1,
          explanation: "Bait and switch scams list premium products at deep discounts, then ship cheap fakes. Always check seller history and use platform payment protection.",
        },
        {
          type: "true_false",
          question: "Filming yourself opening a package can help you win a dispute if you receive a fake or wrong item.",
          correct: true,
          explanation: "An unboxing video is strong evidence for disputes. Many platforms accept it as proof that the item was wrong or fake on arrival.",
        },
      ],
    },
  ],
  crypto_fraud: [
    {
      id: "crypto_recovery_scams",
      title: "Crypto Recovery Scams: Double Victimization",
      xp: 75,
      content: [
        {
          type: "text",
          heading: "The Recovery Scam",
          body: "After you've been scammed out of crypto, scammers pose as 'recovery agents' or 'blockchain investigators' who can get your money back — for a fee. They find victims in scam support forums and social media groups. They sound professional, show fake 'recovered funds,' but just steal more from you.",
        },
        {
          type: "text",
          heading: "The Hard Truth About Crypto",
          body: "Once cryptocurrency is sent to a scammer's wallet, it is almost always gone forever. Crypto transactions are irreversible by design. No 'recovery service' can retrieve stolen crypto. Law enforcement can take reports but recovery is extremely rare. Anyone who claims they can recover your crypto for a fee is a scammer.",
        },
        {
          type: "tip",
          body: "If you've lost money to a crypto scam: report it to your local cybercrime unit and the FTC (or equivalent). Do NOT pay anyone who contacts you claiming they can recover your funds.",
        },
      ],
      quiz: [
        {
          type: "multiple_choice",
          question: "After losing money to a crypto scam, someone messages you saying they're a 'blockchain recovery expert' who can get your funds back for a 10% fee. What is this?",
          options: [
            "A legitimate recovery service",
            "A recovery scam — they're targeting you because you're already a victim",
            "A government agency offering help",
            "A crypto exchange refund program",
          ],
          correct: 1,
          explanation: "Recovery scammers specifically target people who have already been scammed. No service can reverse crypto transactions. Report the original scam to authorities instead.",
        },
        {
          type: "true_false",
          question: "Cryptocurrency transactions can be reversed if you contact the exchange quickly enough.",
          correct: false,
          explanation: "Crypto transactions are irreversible by design. Once sent, they cannot be undone. This is why scammers love crypto — there's no chargeback or refund mechanism.",
        },
      ],
    },
  ],
  family_safety: [
    {
      id: "family_security_audit",
      title: "Family Security Audit: A Step-by-Step Checklist",
      xp: 50,
      content: [
        {
          type: "text",
          heading: "Why Audit Your Family's Security?",
          body: "Scammers evolve constantly. What was safe last year may be risky today. A quarterly security audit ensures everyone in your household — kids, teens, adults, and seniors — has the right protections in place. Set a calendar reminder and go through this checklist together.",
        },
        {
          type: "text",
          heading: "The Checklist",
          body: "1. Passwords: Is everyone using a password manager? Are critical accounts (email, bank) using unique passwords?\n2. 2FA: Is two-factor authentication enabled on email, banking, and social media?\n3. Software: Are all devices updated to the latest OS and app versions?\n4. Privacy: Are social media profiles set to private? Is location sharing intentional?\n5. Scam awareness: Does everyone know the latest scam types? Have they completed their Vardin lessons?\n6. Seniors: Are they set up with Vardin alerts? Is remote access software removed if not needed?\n7. Kids: Are parental controls appropriate for their age? Do they know to report suspicious contacts?",
        },
        {
          type: "tip",
          body: "Make the audit a family activity — order pizza, go through the checklist together, and celebrate when everyone's security is upgraded. Security doesn't have to be scary.",
        },
      ],
      quiz: [
        {
          type: "multiple_answer",
          question: "Which of these should be part of a family security audit? (Select all that apply)",
          options: [
            "Checking that everyone uses unique passwords",
            "Ensuring 2FA is enabled on critical accounts",
            "Updating all devices to the latest software",
            "Sharing passwords among family members for convenience",
          ],
          correct: [0, 1, 2],
          explanation: "Unique passwords, 2FA, and software updates are all essential. Sharing passwords reduces security — use a password manager's shared vault instead if needed.",
        },
        {
          type: "true_false",
          question: "A family security audit should be done once and never repeated.",
          correct: false,
          explanation: "Scammers evolve constantly. Do a security audit quarterly to keep up with new threats and ensure new devices and accounts are protected.",
        },
      ],
    },
  ],
  password_security: [
    {
      id: "passkeys_authenticators",
      title: "Passkeys & Authenticator Apps: Beyond Passwords",
      xp: 75,
      content: [
        {
          type: "text",
          heading: "What are Passkeys?",
          body: "Passkeys are the future of authentication — they replace passwords entirely. Instead of typing a password, you use your face, fingerprint, or device PIN to sign in. Passkeys can't be phished, stolen in data breaches, or reused across sites. Google, Apple, and Microsoft all support passkeys now.",
        },
        {
          type: "text",
          heading: "Authenticator Apps",
          body: "If a service doesn't support passkeys yet, use an authenticator app for 2FA instead of SMS. Apps like Google Authenticator, Authy, or Microsoft Authenticator generate time-based codes that are more secure than text messages. SMS codes can be intercepted through SIM swapping — authenticator apps can't.",
        },
        {
          type: "tip",
          body: "Start by enabling passkeys on your Google and Apple accounts. Then add an authenticator app for banking and social media. Each step makes you dramatically harder to hack.",
        },
      ],
      quiz: [
        {
          type: "multiple_choice",
          question: "Which authentication method is most resistant to phishing?",
          options: [
            "SMS text code",
            "Password with special characters",
            "Passkey (biometric/device-based)",
            "Email verification link",
          ],
          correct: 2,
          explanation: "Passkeys can't be phished because they don't rely on you typing anything into a website. The device authenticates directly with the legitimate server.",
        },
        {
          type: "true_false",
          question: "SMS text message 2FA codes can be intercepted by scammers through SIM swapping.",
          correct: true,
          explanation: "SIM swapping allows scammers to take over your phone number and receive your 2FA texts. Authenticator apps are safer because they don't depend on your phone number.",
        },
      ],
    },
  ],
  deepfakes: [
    {
      id: "ai_video_calls",
      title: "AI Video Call Scams: When Faces Lie",
      xp: 75,
      content: [
        {
          type: "text",
          heading: "Deepfake Video Calls",
          body: "Scammers now use AI to create real-time deepfake video calls. They impersonate your boss, a colleague, or a family member on Zoom, Teams, or WhatsApp video. In 2024, a finance worker at a multinational firm transferred $25 million after a deepfake video call with their 'CFO' and other 'colleagues' — all were AI-generated.",
        },
        {
          type: "text",
          heading: "How to Verify Video Identity",
          body: "1. Ask the person to do something unusual: turn their head side to side, hold up fingers, or move their hand in front of their face — deepfakes struggle with these movements.\n2. Call back on a known number: don't trust the call you're on.\n3. Verify through a second person: message another colleague to confirm.\n4. Be suspicious of requests that come only through video — legitimate financial requests have paper trails.",
        },
        {
          type: "tip",
          body: "Agree on a verification procedure with your workplace: any unusual financial request, even from an executive, requires secondary verification through a pre-established channel. This protects everyone.",
        },
      ],
      quiz: [
        {
          type: "multiple_choice",
          question: "You're on a video call with your boss who asks you to urgently wire money to a new vendor. The video looks real. What should you do?",
          options: [
            "Wire the money — you can see your boss on video",
            "Ask them to verify their identity through a pre-established verification procedure",
            "Wire half now, half after confirmation",
            "Ask the person on the call to prove who they are",
          ],
          correct: 1,
          explanation: "Real-time deepfake video calls can impersonate anyone. Always verify financial requests through a pre-established secondary channel, regardless of what you see on video.",
        },
        {
          type: "true_false",
          question: "AI can create convincing real-time deepfake video calls, not just pre-recorded videos.",
          correct: true,
          explanation: "Modern AI can generate deepfake video in real-time during live calls. Never trust video alone for verifying identity during financial or sensitive requests.",
        },
      ],
    },
  ],
  qr_codes: [
    {
      id: "qr_payment_safety",
      title: "QR Payment Safety: Scanning to Pay",
      xp: 50,
      content: [
        {
          type: "text",
          heading: "QR Payment Risks",
          body: "QR codes are now used for payments at restaurants, parking meters, and stores. Scammers place fake QR stickers over real ones that redirect you to a phishing payment page. You think you're paying the restaurant, but you're sending money to the scammer — and giving them your card details.",
        },
        {
          type: "text",
          heading: "Safe QR Payment Habits",
          body: "1. Check the URL: before entering payment info, read the web address. Does it match the restaurant or parking app?\n2. Look for tampering: is the QR code a sticker over another code? Is it misaligned?\n3. Prefer the official app: if the restaurant or city has an app, use it instead of scanning.\n4. Use a credit card: never enter debit card or bank login details on a QR-linked payment page.\n5. Watch for urgency: if the page pressures you to pay quickly, it's suspicious.",
        },
        {
          type: "tip",
          body: "When in doubt, ask staff for the official payment method. A legitimate restaurant would rather you pay at the counter than risk you getting scammed.",
        },
      ],
      quiz: [
        {
          type: "multiple_choice",
          question: "You scan a QR code at a restaurant table to pay your bill. The website asks for your debit card number. What should you do?",
          options: [
            "Enter your debit card — it's the restaurant's payment system",
            "Check if the URL matches the restaurant's website, and prefer using your credit card",
            "Enter your bank login for faster payment",
            "Scan the QR code again to get a different page",
          ],
          correct: 1,
          explanation: "Always check the URL before entering payment info. Use a credit card (not debit) for QR-linked payments — credit cards have better fraud protection.",
        },
        {
          type: "true_false",
          question: "If a QR code is printed on the restaurant's official menu, it's always safe to scan.",
          correct: false,
          explanation: "Scammers can place sticker QR codes over printed ones. Always check the URL after scanning and before entering any payment information.",
        },
      ],
    },
  ],
  identity_theft: [
    {
      id: "data_breach_response",
      title: "Data Breach Response: What to Do When Your Data Is Leaked",
      xp: 75,
      content: [
        {
          type: "text",
          heading: "Data Breaches Happen",
          body: "Your personal data has likely already been exposed in at least one data breach. Major breaches at companies like Equifax, Yahoo, and Facebook have affected billions of accounts. When your data is breached, scammers can use it for phishing, identity theft, and account takeover.",
        },
        {
          type: "text",
          heading: "Your Response Plan",
          body: "1. Check: Visit HaveIBeenPwned.com to see which breaches exposed your email.\n2. Change passwords: Update passwords for any breached accounts immediately. Use unique passwords.\n3. Enable 2FA: Add two-factor authentication to all affected accounts.\n4. Monitor credit: Check your credit report for unfamiliar accounts. Consider a credit freeze.\n5. Watch for phishing: After a breach, expect targeted phishing emails using your leaked data. Be extra vigilant.\n6. Update security questions: If security questions were breached, change them to answers only you would know.",
        },
        {
          type: "tip",
          body: "Set up breach notifications at HaveIBeenPwned.com. You'll get an email when your data appears in a new breach, so you can act fast.",
        },
      ],
      quiz: [
        {
          type: "multiple_choice",
          question: "You find out your email was in a data breach from a shopping site. What should you do FIRST?",
          options: [
            "Ignore it — breaches happen to everyone",
            "Change the password on that account and any other account using the same password",
            "Delete your email account",
            "Post about it on social media",
          ],
          correct: 1,
          explanation: "Change the breached password immediately, and update any other accounts using the same password. Enable 2FA and monitor for phishing attempts using your leaked data.",
        },
        {
          type: "true_false",
          question: "After a data breach, you should expect scammers to use your leaked information for targeted phishing.",
          correct: true,
          explanation: "Breached data is sold on the dark web and used for targeted attacks. After a breach, be extra cautious of emails and texts that reference your real information.",
        },
      ],
    },
  ],
  online_shopping: [
    {
      id: "subscription_traps",
      title: "Subscription Traps & Free Trial Scams",
      xp: 50,
      content: [
        {
          type: "text",
          heading: "The Free Trial Trap",
          body: "You sign up for a 'free trial' that requires your credit card. The trial period is short, cancellation is deliberately difficult, and if you forget to cancel, you're charged a high monthly fee. Some scams don't even let you cancel — the cancellation link is buried, broken, or requires a phone call to a number that's never answered.",
        },
        {
          type: "text",
          heading: "How to Avoid Subscription Traps",
          body: "1. Use virtual cards: Services like Privacy.com let you create one-time-use card numbers for free trials.\n2. Set a cancellation reminder: The moment you sign up for a trial, set a calendar reminder 2 days before it ends.\n3. Read the fine print: Look for the cancellation policy before signing up. If it's hard to find, that's intentional.\n4. Check your statements: Review credit card statements monthly for unexpected subscription charges.\n5. Cancel immediately: If you decide you don't want the service, cancel right away — don't wait.",
        },
        {
          type: "tip",
          body: "If a 'free trial' requires your credit card and doesn't let you cancel online, it's a subscription trap. Legitimate services make cancellation easy — usually a single button click in your account settings.",
        },
      ],
      quiz: [
        {
          type: "multiple_choice",
          question: "You sign up for a 7-day free trial. What's the best way to avoid being charged?",
          options: [
            "Hope you remember to cancel before day 7",
            "Set a calendar reminder for day 5 and cancel immediately if you don't want it",
            "Use your debit card so it's easy to dispute",
            "Cancel after the trial ends and ask for a refund",
          ],
          correct: 1,
          explanation: "Set a reminder a few days before the trial ends. Better yet, cancel immediately after signing up — you'll still get the full trial period but won't be charged.",
        },
        {
          type: "true_false",
          question: "If a service makes it difficult to cancel your subscription (no cancel button, requires calling), it may be an intentional subscription trap.",
          correct: true,
          explanation: "Legitimate services make cancellation easy. If you have to call, email, or chat with support to cancel, or the cancel option is hidden, it's likely a trap designed to keep charging you.",
        },
      ],
    },
  ],
  social_media: [
    {
      id: "influencer_impersonation",
      title: "Influencer Impersonation: Fake Accounts & DM Scams",
      xp: 50,
      content: [
        {
          type: "text",
          heading: "Fake Influencer Accounts",
          body: "Scammers create accounts that look exactly like real influencers — same name, same profile photo, similar handle (like @johndoe_official instead of @johndoe). They follow the influencer's real followers and send DMs promoting fake crypto schemes, giveaway scams, or 'exclusive' investment opportunities.",
        },
        {
          type: "text",
          heading: "How to Spot Fake Accounts",
          body: "1. Check verification: Is the blue checkmark real or a purchased badge?\n2. Compare followers: Fake accounts have fewer followers than the real one.\n3. Check the handle: Scammers use slight variations — extra letters, underscores, or 'official' tags.\n4. Real influencers don't DM you: Legitimate creators don't send you investment opportunities in DMs.\n5. Cross-check: If an influencer is running a giveaway, it'll be on their main feed, not in a DM.",
        },
        {
          type: "tip",
          body: "Before engaging with any influencer promotion, check their official website or main social media profile to verify the offer is real. When in doubt, assume the DM is a scam.",
        },
      ],
      quiz: [
        {
          type: "multiple_choice",
          question: "An account that looks like a famous YouTuber DMs you about an exclusive crypto investment. The handle is @name_investments. What is this?",
          options: [
            "A legitimate investment opportunity from the YouTuber",
            "An impersonation scam — real influencers don't DM you about crypto investments",
            "A promotional partnership",
            "The YouTuber's investment company",
          ],
          correct: 1,
          explanation: "Real influencers promote products publicly, not in DMs. The different handle (@name_investments vs @name) is a sign of an impersonation account.",
        },
        {
          type: "true_false",
          question: "A blue verification badge on social media always means the account is trustworthy.",
          correct: false,
          explanation: "On some platforms, verification badges can now be purchased with a subscription. Check the handle, follower count, and content history — not just the badge.",
        },
      ],
    },
  ],
};

// New categories — appended via lessons.js merge logic
export const NEW_CATEGORIES = [
  {
    id: "phone_scams",
    name: "Phone Call Scams",
    icon: "Phone",
    logo: "https://media.base44.com/images/public/6a46a8e315996af6f0443792/dbc65d00e_generated_image.png",
    color: "from-violet-500 to-purple-500",
    description: "Defend against scam calls",
    lessons: [
      {
        id: "tech_support_calls",
        title: "Tech Support Scam Calls",
        xp: 75,
        content: [
          {
            type: "text",
            heading: "The Tech Support Call",
            body: "Your phone rings. The caller says they're from Microsoft, Apple, or 'Windows Support.' They claim your computer has a virus, your IP address is compromised, or your software license is expiring. They ask you to install remote access software so they can 'fix' it — but instead, they steal your files, passwords, and banking info.",
          },
          {
            type: "text",
            heading: "Red Flags",
            body: "1. Unsolicited tech support calls: Real tech companies don't call you about computer problems.\n2. Remote access requests: Never install software (like AnyDesk, TeamViewer) at a stranger's request.\n3. Urgency and fear: 'Your computer will be permanently disabled!' is designed to panic you.\n4. Payment demands: They ask for payment via gift cards, crypto, or wire transfer.",
          },
          {
            type: "tip",
            body: "If someone calls about a computer problem you didn't report, hang up. Microsoft, Apple, and Google never make unsolicited support calls. If you're worried about your computer, contact support directly through the official website.",
          },
        ],
        quiz: [
          {
            type: "multiple_choice",
            question: "Someone calls saying they're from Microsoft and your computer has a virus. They ask you to install remote access software. What do you do?",
            options: [
              "Install it — they're from Microsoft",
              "Hang up — Microsoft never makes unsolicited support calls",
              "Let them access your computer but watch what they do",
              "Ask them to prove they work at Microsoft",
            ],
            correct: 1,
            explanation: "Microsoft, Apple, and other tech companies never call you about computer problems. Hang up immediately. If you have a real issue, contact support through the official website.",
          },
          {
            type: "true_false",
            question: "If a caller knows your computer's operating system, they must be from a real tech company.",
            correct: false,
            explanation: "Scammers can guess your OS (most people use Windows) or find it through data breaches. Knowing your OS doesn't prove they're legitimate.",
          },
        ],
      },
      {
        id: "government_impostor_calls",
        title: "Government Impostor Calls: IRS, SSA & Police",
        xp: 75,
        content: [
          {
            type: "text",
            heading: "The Government Impostor Scam",
            body: "Scammers call pretending to be from the IRS, Social Security Administration, police, or immigration. They claim you owe taxes, your SSN is suspended, there's a warrant for your arrest, or your benefits are being cut off. They threaten arrest, deportation, or legal action if you don't pay immediately — usually via gift cards, wire transfer, or crypto.",
          },
          {
            type: "text",
            heading: "How Real Agencies Work",
            body: "1. The IRS never calls as a first contact — they always mail letters first.\n2. Government agencies never demand payment via gift cards, crypto, or wire transfer.\n3. Police don't call to collect fines — if there's a warrant, they show up in person.\n4. The SSA never threatens to suspend your Social Security number.\n5. Real agencies give you time to verify and appeal — they don't demand instant payment.",
          },
          {
            type: "tip",
            body: "If someone calls claiming to be from a government agency and demands immediate payment, hang up. Then look up the agency's official number and call them directly to verify. Government agencies never object to you verifying through official channels.",
          },
        ],
        quiz: [
          {
            type: "multiple_choice",
            question: "Someone calls claiming to be from the IRS and says you'll be arrested today if you don't pay $500 in gift cards. What do you do?",
            options: [
              "Buy the gift cards — you don't want to be arrested",
              "Hang up — the IRS never demands gift card payment and always mails first",
              "Ask them to send the arrest warrant by email",
              "Pay half now and half later",
            ],
            correct: 1,
            explanation: "The IRS never calls as first contact, never demands gift cards, and never threatens immediate arrest. Hang up and report the call. If you're worried about taxes, call the IRS directly.",
          },
          {
            type: "fill_blank",
            question: "Fill in the blank: Real government agencies never demand payment via gift cards, wire transfers, or ______.",
          text_before: "Real government agencies never demand payment via gift cards, wire transfers, or ",
          text_after: ".",
          acceptable_answers: ["cryptocurrency", "crypto", "bitcoin", "bitcoin crypto"],
          explanation: "Government agencies only accept payment through official channels (check, card, bank transfer to official accounts). Gift cards, wire transfers, and crypto are scammers' preferred methods because they're irreversible.",
          },
        ],
      },
      {
        id: "robocall_scams",
        title: "Robocalls & Automated Scam Calls",
        xp: 50,
        content: [
          {
            type: "text",
            heading: "The Robocall Epidemic",
            body: "Robocalls are automated phone calls that deliver pre-recorded messages. Scammers use them because they can dial millions of numbers cheaply. Common robocall scams include: 'Your car warranty is expiring,' 'You owe money on your student loans,' 'You've won a prize,' and 'There's a problem with your Amazon account.' If you press a button or respond, you're transferred to a scammer.",
          },
          {
            type: "text",
            heading: "How to Handle Robocalls",
            body: "1. Don't answer unknown numbers: If it's important, they'll leave a voicemail.\n2. Never press buttons: Pressing '1' to be removed from the list actually marks your number as active.\n3. Don't say 'yes': Scammers record your 'yes' and use it to authorize charges.\n4. Use call blocking: Enable your carrier's spam filter or use apps like Hiya, Truecaller, or Nomorobo.\n5. Report: File complaints with your country's telecom regulator.\n6. Register: In the US, add your number to the Do Not Call Registry (though scammers ignore it, legitimate telemarketers don't).",
          },
          {
            type: "tip",
            body: "If you accidentally answer a robocall, hang up immediately. Don't press any buttons, don't say anything, just hang up. Engaging in any way confirms your number is active and leads to more calls.",
          },
        ],
        quiz: [
          {
            type: "multiple_choice",
            question: "You answer a robocall that says 'Press 1 to be removed from our call list.' What should you do?",
            options: [
              "Press 1 to stop getting calls",
              "Hang up without pressing anything — pressing buttons confirms your number is active",
              "Press 0 to speak to a representative",
              "Stay on the line to waste their time",
            ],
            correct: 1,
            explanation: "Pressing any button tells the scammer your number is active and a real person answers. This leads to MORE robocalls, not fewer. Hang up immediately.",
          },
          {
            type: "true_false",
            question: "Saying 'yes' on a phone call with a scammer can be used to authorize charges.",
            correct: true,
            explanation: "Scammers record your 'yes' and use it as voice authorization for fraudulent charges. If asked 'Can you hear me?' or 'Are you the account holder?', don't say yes — hang up or say 'I can't hear you.'",
          },
        ],
      },
      {
        id: "phone_scam_defense",
        title: "Phone Scam Defense: Your Action Plan",
        xp: 50,
        content: [
          {
            type: "text",
            heading: "Your Defense Toolkit",
            body: "Phone scams are the most common type of scam. Build your defense with these habits: 1. Let unknown numbers go to voicemail. 2. Enable spam call filtering on your phone (iPhone: Silence Unknown Callers; Android: Caller ID & Spam). 3. Register on your country's Do Not Call list. 4. Install a call-blocking app. 5. Never give personal info to inbound callers — verify first.",
          },
          {
            type: "text",
            heading: "The Callback Rule",
            body: "If someone calls claiming to be from your bank, a government agency, or a company you use, don't trust the caller. Hang up, look up the official number (from their website or the back of your card), and call back. Legitimate organizations never mind you verifying through official channels — scammers will pressure you to stay on the line.",
          },
          {
            type: "tip",
            body: "Set up a 'callback verification' habit: any time someone calls asking for money or personal info, your default response is 'I'll call you back' — then look up the official number yourself.",
          },
        ],
        quiz: [
          {
            type: "multiple_choice",
            question: "Someone calls from 'your bank' about fraud on your account. What's the safest action?",
            options: [
              "Answer their security questions to verify your identity",
              "Hang up and call the number on the back of your card",
              "Ask them to prove they work at the bank",
              "Give them your account number so they can look you up",
            ],
            correct: 1,
            explanation: "Always hang up and call back using the number on your card or the bank's official website. This ensures you're talking to the real bank, not an impostor.",
          },
          {
            type: "multiple_answer",
          question: "Which of these help protect against phone scams? (Select all that apply)",
          options: [
            "Letting unknown numbers go to voicemail",
            "Enabling spam call filtering on your phone",
            "Giving personal info to prove you're you",
            "Hanging up and calling back on an official number",
          ],
          correct: [0, 1, 3],
          explanation: "Screening calls, enabling spam filters, and verifying through official callbacks are all effective defenses. Never give personal info to an inbound caller — they should verify YOU, not the other way around.",
          },
        ],
      },
    ],
  },
  {
    id: "job_scams",
    name: "Job & Employment Scams",
    icon: "Briefcase",
    logo: "https://media.base44.com/images/public/6a46a8e315996af6f0443792/e4f5cb057_generated_image.png",
    color: "from-cyan-500 to-blue-500",
    description: "Don't let scammers exploit your job search",
    lessons: [
      {
        id: "fake_job_offers",
        title: "Fake Job Offers: When the Dream Job Is a Scam",
        xp: 75,
        content: [
          {
            type: "text",
            heading: "How Job Scams Work",
            body: "Scammers post fake job listings on real job boards (LinkedIn, Indeed, Glassdoor). The job sounds perfect: high salary, remote work, minimal experience required. After a quick 'interview' (often via text or a chat app), you're 'hired' immediately. Then the scam starts: they ask for your bank info for 'direct deposit,' send you a fake check to buy equipment, or ask you to pay for training.",
          },
          {
            type: "text",
            heading: "Red Flags",
            body: "1. Hired without a real interview: No legitimate company hires after a text chat.\n2. Too good to be true: High salary + no experience + remote = scam.\n3. Upfront payment: Real employers never ask you to pay for training, equipment, or background checks.\n4. Fake check: They send a check for 'equipment' and ask you to return the excess — the check bounces.\n5. Personal info too early: Asking for your SSN or bank details before you've signed a contract.\n6. Communication via personal apps: Real companies use official email, not WhatsApp or Telegram.",
          },
          {
            type: "tip",
            body: "Research the company: visit their official website, check their LinkedIn page, and call their published phone number to verify the job exists. If the 'recruiter' only communicates via chat apps, it's a scam.",
          },
        ],
        quiz: [
          {
            type: "multiple_choice",
            question: "You apply for a remote job and are hired after a 15-minute text interview. They send you a check for $3,000 to buy a laptop and ask you to send back $500 for 'software licensing.' What is this?",
            options: [
              "A generous employer helping you get set up",
              "A fake check scam — the check will bounce and you'll lose the $500",
              "A standard remote work onboarding process",
              "A tax advance on your salary",
            ],
            correct: 1,
            explanation: "The fake check scam is the most common job scam. The check looks real but bounces after you send money back. By the time your bank notifies you, the scammer has your $500 and you owe the bank $3,000.",
          },
          {
            type: "true_false",
            question: "A legitimate employer might ask you to pay for your own background check before starting.",
            correct: false,
            explanation: "Real employers cover the cost of background checks. If you're asked to pay for anything — training, equipment, background checks, or certification — before starting a job, it's a scam.",
          },
        ],
      },
      {
        id: "work_from_home_scams",
        title: "Work-From-Home Scams: Remote Work Risks",
        xp: 75,
        content: [
          {
            type: "text",
            heading: "The WFH Scam Landscape",
            body: "Work-from-home scams exploit people looking for remote income. Common variants: 1. Package mule: You're asked to receive and reship packages (stolen goods) — you become an accessory to fraud. 2. Data entry 'jobs': You pay for training materials that never arrive. 3. Reshipping scams: You forward packages to scammers using prepaid labels. 4. Virtual assistant: You're asked to handle financial transactions for a 'client' — money laundering.",
          },
          {
            type: "text",
            heading: "Spotting Legitimate Remote Work",
            body: "Real remote jobs: are posted on established job boards, have detailed job descriptions, require a real video interview, use company email addresses, don't ask for money upfront, and don't involve reshipping packages or handling others' money. If a remote job involves receiving and forwarding packages or money, it's illegal and you could be prosecuted.",
          },
          {
            type: "tip",
            body: "If a job asks you to receive packages at your home and reship them, you're being used as a 'money mule' or 'package mule.' This is illegal and you could face criminal charges. Report it to authorities and stop immediately.",
          },
        ],
        quiz: [
          {
            type: "multiple_choice",
            question: "A remote job asks you to receive packages at your home and reship them to another address using prepaid labels. What is this?",
            options: [
              "A legitimate logistics job",
              "A package mule scam — you're handling stolen goods and could face criminal charges",
              "A dropshipping business",
              "A fulfillment center job",
            ],
            correct: 1,
            explanation: "Reshipping packages for someone you've never met is almost always a scam involving stolen goods. You could be charged as an accessory to fraud. Never accept a job that involves receiving and forwarding packages.",
          },
          {
            type: "true_false",
            question: "If a work-from-home job requires you to handle financial transactions for a 'client,' it may be a money laundering scheme.",
            correct: true,
            explanation: "Scammers use 'virtual assistant' or 'financial agent' jobs to recruit money mules. You'd be processing stolen funds, which is illegal. Never handle money or financial transactions for someone you haven't thoroughly verified.",
          },
        ],
      },
    ],
  },
  {
    id: "romance_scams",
    name: "Romance Scams",
    icon: "Flame",
    logo: "https://media.base44.com/images/public/6a46a8e315996af6f0443792/459091435_generated_image.png",
    color: "from-rose-500 to-red-500",
    description: "Protect your heart and your wallet",
    lessons: [
      {
        id: "romance_scam_basics",
        title: "Romance Scam Basics: Love That Costs Everything",
        xp: 75,
        content: [
          {
            type: "text",
            heading: "The Romance Scam Playbook",
            body: "Romance scammers create fake profiles on dating apps and social media. They use stolen photos (often of military personnel, models, or oil rig workers). The relationship moves fast — 'I love you' within weeks. They always have a reason not to meet in person or video call: deployed overseas, working on an oil rig, or a medical emergency. Then the requests for money start: travel expenses, visa fees, medical bills, or 'investment opportunities.'",
          },
          {
            type: "text",
            heading: "Red Flags",
            body: "1. Moves fast: 'I love you' within days or weeks.\n2. Can't meet: Always has an excuse (overseas, oil rig, military deployment).\n3. No video calls: Refuses or makes excuses when you try to video chat.\n4. Asks for money: Any request for money, gift cards, or crypto is a scam.\n5. Asks for personal info: Wants your bank details, SSN, or passwords.\n6. Isolation: Tries to distance you from friends and family who might warn you.\n7. Too perfect: Their photos look like a model, their profile is too good to be true.",
          },
          {
            type: "tip",
            body: "Reverse image search their profile photos. If the photos appear on stock photo sites or belong to someone else entirely, it's a scam. Never send money to someone you haven't met in person.",
          },
        ],
        quiz: [
          {
            type: "multiple_choice",
            question: "You meet someone on a dating app. They say they're deployed overseas in the military. Within two weeks they say 'I love you,' then ask for $500 for a leave application fee. What is this?",
            options: [
              "True love — military leave is expensive",
              "A romance scam — the military never charges for leave, and moving fast + asking for money are red flags",
              "A legitimate request — you should help",
              "A cultural difference in dating",
            ],
            correct: 1,
            explanation: "The military never charges service members for leave. Romance scammers use the 'military deployed overseas' story to explain why they can't meet. Fast declarations of love + requests for money = romance scam.",
          },
          {
            type: "true_false",
            question: "If someone you met online refuses to video chat but sends you photos, they might be a romance scammer.",
            correct: true,
            explanation: "Refusing video calls is a top red flag. Scammers use stolen photos and can't show a live video of the person in the photos. If they always have an excuse to avoid video chat, it's a scam.",
          },
        ],
      },
      {
        id: "romance_scam_recovery",
        title: "Romance Scam Recovery: Healing After Betrayal",
        xp: 75,
        content: [
          {
            type: "text",
            heading: "You're Not Alone",
            body: "Romance scams cause the highest financial losses of any scam type. Victims lose an average of $15,000, and many lose their entire life savings. If you've been scammed, you are not alone and you are not foolish. These scammers are professionals who manipulate emotions for a living. The shame you feel is part of their trap — it keeps you from reporting and recovering.",
          },
          {
            type: "text",
            heading: "Recovery Steps",
            body: "1. Stop all contact: Block the scammer on every platform. Do NOT confront them — they'll just manipulate you further.\n2. Report: File reports with the FTC (IdentityTheft.gov or ReportFraud.ftc.gov), your local police, and the dating platform.\n3. Contact your bank: If you sent money, report it as fraud immediately. Some transfers can be reversed if reported fast enough.\n4. Freeze credit: If you shared personal info, freeze your credit to prevent identity theft.\n5. Beware recovery scams: Anyone who contacts you claiming they can recover your money is also a scammer.\n6. Seek support: Romance scam support groups exist online and in person. Talking helps break the shame cycle.",
          },
          {
            type: "tip",
            body: "The emotional damage of a romance scam can be worse than the financial loss. Consider talking to a therapist who understands romance scam trauma. You trusted someone who manipulated you — that's not your fault.",
          },
        ],
        quiz: [
          {
            type: "multiple_choice",
            question: "After a romance scam, someone contacts you saying they're a 'recovery specialist' who can get your money back for a fee. What should you do?",
            options: [
              "Pay them — they can help recover your money",
              "Ignore them — recovery scammers target previous scam victims",
              "Ask them for credentials first",
              "Pay only if they recover the money first",
            ],
            correct: 1,
            explanation: "Recovery scammers specifically target people who have already been scammed. No one can recover stolen romance scam money. Report the original scam to authorities and ignore all 'recovery' offers.",
          },
          {
            type: "true_false",
            question: "Feeling shame after a romance scam is normal, and it shouldn't stop you from reporting the crime.",
            correct: true,
            explanation: "Shame is the scammer's final weapon — it keeps victims silent. Reporting helps authorities track scammers and warns others. You were manipulated by a professional; that's not your fault.",
          },
        ],
      },
    ],
  },
  {
    id: "articles",
    name: "Articles & Insights",
    icon: "Newspaper",
    logo: "https://media.base44.com/images/public/6a46a8e315996af6f0443792/6921fd193_generated_image.png",
    color: "from-slate-500 to-slate-700",
    description: "Read, learn, and stay informed",
    lessons: [
      {
        id: "article_scam_statistics",
        title: "Scam Statistics: The Numbers Behind the Threat",
        xp: 40,
        content: [
          {
            type: "text",
            heading: "The Scale of the Problem",
            body: "Scams are a global epidemic. In 2023, consumers reported losing over $10 billion to fraud in the US alone — and that's only reported losses. The FTC estimates that less than 10% of scams are reported. Worldwide, scam losses exceed $1 trillion annually. Romance scams alone caused over $1.3 billion in losses, with an average victim losing $15,000.\n\nPhone scams remain the most common contact method, followed by text messages, email, and social media. But email scams cause the highest average losses per victim, as they often target businesses with sophisticated social engineering.",
          },
          {
            type: "text",
            heading: "Who Gets Scammed?",
            body: "Contrary to popular belief, younger people (20-29) report scams more frequently than older adults. However, older adults (70+) lose significantly more money per scam — an average of $800 compared to $500 for younger victims. Scammers target everyone, but they tailor their approach: young people get investment and job scams, while older adults get tech support and government impersonation scams.\n\nThe most underreported statistic: 1 in 4 scam victims are scammed more than once. Scammers share 'sucker lists' of people who have previously fallen for scams, leading to repeat targeting.",
          },
          {
            type: "tip",
            body: "Reporting scams — even if you didn't lose money — helps authorities track trends and warn others. Every report contributes to a database that helps shut down scam operations.",
          },
        ],
        quiz: [
          {
            type: "multiple_choice",
            question: "Which age group loses the most money per scam on average?",
            options: [
              "Teens (13-19)",
              "Young adults (20-29)",
              "Adults 70+",
              "Middle-aged (40-59)",
            ],
            correct: 2,
            explanation: "While younger people report scams more often, adults 70+ lose significantly more per incident — an average of $800. Scammers tailor their approach by age group.",
          },
          {
            type: "true_false",
            question: "Less than 10% of scams are reported to authorities.",
            correct: true,
            explanation: "The FTC estimates the vast majority of scams go unreported, often due to shame or the belief that nothing can be done. Reporting helps track trends and protect others.",
          },
        ],
      },
      {
        id: "article_psychology_of_scams",
        title: "The Psychology of Scams: Why Smart People Fall",
        xp: 40,
        content: [
          {
            type: "text",
            heading: "It's Not About Intelligence",
            body: "Scam victims are not gullible or unintelligent. Scammers use decades of research in psychology, behavioral economics, and social engineering to manipulate human emotions. Even cybersecurity experts have fallen for sophisticated scams. The key isn't being 'smart enough' — it's understanding the psychological tactics scammers use so you can recognize them in the moment.\n\nScammers exploit cognitive biases: authority bias (trusting people who seem official), scarcity bias (acting fast when something seems limited), reciprocity (feeling obligated when given something), and social proof (trusting what others seem to trust). Understanding these biases is your first line of defense.",
          },
          {
            type: "text",
            heading: "The Emotional Hijack",
            body: "Scams work by hijacking emotions. Fear ('Your account will be closed!'), greed ('You won a prize!'), urgency ('Act now!'), authority ('This is the IRS'), and trust ('I love you') all bypass rational thinking. When you're in an emotional state, your brain's prefrontal cortex — the part responsible for critical thinking — takes a backseat to the amygdala, which handles fear and urgency responses.\n\nThis is why scammers always create urgency. They know that if you take time to think, you'll see through the scam. Their entire strategy is to keep you in an emotional state where you act before you think.",
          },
          {
            type: "tip",
            body: "The most powerful anti-scam tool is a 30-second pause. When you feel urgency, fear, or excitement from a message, force yourself to wait 30 seconds before acting. That's enough time for your prefrontal cortex to re-engage.",
          },
        ],
        quiz: [
          {
            type: "multiple_choice",
            question: "Why do scammers always create urgency in their messages?",
            options: [
              "Because the offer really is time-limited",
              "To bypass your rational thinking and make you act on emotion",
              "Because they're in a hurry",
              "To make the message seem more important",
            ],
            correct: 1,
            explanation: "Urgency triggers the amygdala (emotional brain) and suppresses the prefrontal cortex (rational brain). Scammers know that if you take time to think, you'll see through the scam.",
          },
          {
            type: "true_false",
            question: "Only gullible or unintelligent people fall for scams.",
            correct: false,
            explanation: "Scam victims span all education and intelligence levels. Scammers use professional psychological manipulation. Even cybersecurity experts have fallen for well-crafted scams.",
          },
        ],
      },
      {
        id: "article_real_stories",
        title: "Real Stories: Lessons from Scam Survivors",
        xp: 40,
        content: [
          {
            type: "text",
            heading: "The Widow and the 'Soldier'",
            body: "Sarah, a 68-year-old widow, met 'Marcus' on a dating site. He said he was a deployed soldier who would be coming home soon. Over six months, they texted daily. He sent flowers, called her 'my love,' and planned their future. Then came the requests: $500 for a leave application, $2,000 for a flight home, $1,500 for 'customs fees' for a gift he was sending. Sarah lost $28,000 before her daughter discovered the truth. 'Marcus' was a team of scammers in Nigeria using stolen photos. Sarah's story is devastatingly common — but she now speaks at senior centers to warn others.\n\nThe lesson: No real soldier asks for money. No one you haven't met in person should be asking for money for any reason.",
          },
          {
            type: "text",
            heading: "The Executive and the Deepfake",
            body: "A finance manager at a multinational engineering firm received an email from their CFO requesting an urgent wire transfer. The email seemed routine, so they joined a video call with the 'CFO' and other 'colleagues' who all looked and sounded real. After the call, they authorized 15 transfers totaling $25.6 million to five different bank accounts. It was all a deepfake — every person on the call was AI-generated. The scammers had used publicly available video of the real executives to train their AI.\n\nThe lesson: Video calls can no longer be trusted for identity verification. Financial requests — even from executives — need secondary verification through pre-established channels.",
          },
          {
            type: "tip",
            body: "Reading scam survivor stories isn't just educational — it breaks the shame barrier. If you've been scammed, your story could help someone else. Consider sharing it anonymously through scam awareness organizations.",
          },
        ],
        quiz: [
          {
            type: "multiple_choice",
          question: "In the story about 'Marcus' the soldier, what was the biggest red flag?",
          options: [
            "He sent flowers",
            "He asked for money for leave, flights, and customs fees — real soldiers never do this",
            "He called her 'my love'",
            "He was deployed overseas",
          ],
          correct: 1,
          explanation: "No legitimate service member asks for money for leave applications, flights, or customs fees. These are standard romance scam tactics targeting people who trust military personnel.",
          },
          {
            type: "true_false",
            question: "Real-time video calls can now be faked using AI, so you can't trust video alone for identity verification.",
            correct: true,
            explanation: "The $25.6 million deepfake heist proved that AI can generate convincing real-time video calls. Always verify financial requests through a pre-established secondary channel.",
          },
        ],
      },
      {
        id: "article_reporting_guide",
        title: "How to Report Scams: Your Complete Guide",
        xp: 40,
        content: [
          {
            type: "text",
            heading: "Why Reporting Matters",
            body: "Reporting scams does more than document your loss — it helps authorities track patterns, warn others, and sometimes shut down scam operations. Even if you didn't lose money, reporting attempted scams helps build the case against scammers. Many successful law enforcement actions started with individual reports that revealed larger patterns.\n\nReports also feed into databases used by telecom regulators, banks, and tech companies to block scam phone numbers, email addresses, and websites. Your report might be the one that gets a scammer's number blocked for thousands of other potential victims.",
          },
          {
            type: "text",
            heading: "Where to Report",
            body: "United States:\n• FTC: ReportFraud.ftc.gov — for all types of fraud\n• IdentityTheft.gov — if your identity was stolen\n• IC3.gov — FBI's internet crime complaint center\n• Your state's attorney general\n\nUnited Kingdom:\n• Action Fraud: actionfraud.police.uk\n\nAustralia:\n• Scamwatch: scamwatch.gov.au\n\nIsrael:\n• Israel Police cybercrime unit\n• National Cyber Directorate: cyber.gov.il\n\nUniversal:\n• Your bank or credit card company — report fraud immediately\n• The platform where the scam occurred (social media, job board, dating app)\n• Local police — for a police report (often needed for bank disputes)",
          },
          {
            type: "tip",
            body: "When reporting, include as much detail as possible: dates, times, phone numbers, email addresses, screenshots, and any payment details. The more information you provide, the more useful your report is to investigators.",
          },
        ],
        quiz: [
          {
            type: "multiple_choice",
            question: "Should you report a scam even if you didn't lose any money?",
            options: [
              "No — there's nothing to report if you didn't lose money",
              "Yes — reports help track patterns, warn others, and block scam operations",
              "Only if the scam was particularly clever",
              "Only if you lost more than $1,000",
            ],
            correct: 1,
            explanation: "Even attempted scam reports are valuable. They help authorities track emerging scam patterns and can lead to blocking scam phone numbers, emails, and websites before others fall victim.",
          },
          {
            type: "true_false",
            question: "Reporting a scam to your bank immediately can sometimes help reverse a fraudulent transaction.",
            correct: true,
            explanation: "Banks have fraud departments that can sometimes reverse transfers or freeze accounts if reported quickly. The faster you report, the better your chances of recovery.",
          },
        ],
      },
      {
        id: "article_future_of_scams",
        title: "The Future of Scams: AI, Deepfakes & What's Next",
        xp: 40,
        content: [
          {
            type: "text",
            heading: "AI-Powered Scams",
            body: "Artificial intelligence is transforming the scam landscape. AI can now: write convincing phishing emails in perfect grammar (defeating the old 'bad spelling = scam' rule), clone voices from 3 seconds of audio, create real-time deepfake video calls, generate personalized messages at scale, and automate social media engagement to build fake personas.\n\nThe era of the 'Nigerian prince' email with broken English is over. Today's scams are personalized, grammatically perfect, and increasingly difficult to distinguish from legitimate communication. AI also allows scammers to target thousands of victims simultaneously with individually personalized messages.",
          },
          {
            type: "text",
            heading: "What's Coming Next",
            body: "Emerging scam trends to watch: 1. AI chatbots that maintain long-term romantic relationships with hundreds of victims simultaneously. 2. Deepfake video calls impersonating family members for emergency money requests. 3. AI-generated investment advice from fake 'financial advisors' on social media. 4. Synthetic identity fraud — AI creates entirely fake personas with realistic digital footprints. 5. Smart contract scams in DeFi (decentralized finance) that automatically drain wallets.\n\nThe defense? Human verification. As AI makes digital identity unreliable, the most secure verification is in-person or through pre-established human contact. A family code word, a secondary phone call to a known number, or a face-to-face meeting will outlast any AI deception.",
          },
          {
            type: "tip",
            body: "Stay ahead of scammers by keeping your Vardin lessons current. As new scam types emerge, new lessons are added. Education is your best defense in the AI era — scammers evolve, and so should you.",
          },
        ],
        quiz: [
          {
            type: "multiple_choice",
            question: "How has AI changed phishing emails?",
            options: [
              "They still have obvious spelling mistakes",
              "They're now grammatically perfect and personalized, making them harder to detect",
              "They've decreased in number",
              "They only target businesses now",
            ],
            correct: 1,
            explanation: "AI generates phishing emails with perfect grammar and personalization. The old advice of 'look for spelling errors' no longer works. Focus on verifying sender addresses and links instead.",
          },
          {
            type: "true_false",
            question: "As AI makes digital identity unreliable, in-person or pre-established human verification becomes the most secure defense.",
            correct: true,
            explanation: "AI can fake text, voice, and video. But it can't fake an in-person meeting or a pre-agreed code word. Human verification through trusted channels is the future of scam defense.",
          },
        ],
      },
      {
        id: "article_senior_targeting",
        title: "Why Scammers Target Seniors — and How to Help",
        xp: 40,
        content: [
          {
            type: "text",
            heading: "The Targeting Problem",
            body: "Scammers disproportionately target older adults, and the results are devastating. Adults over 60 lose the most money per scam of any age group. But why? Scammers target seniors because they may have accumulated savings, own their homes, be more trusting of authority figures, be less familiar with evolving technology, and may be socially isolated — making them more susceptible to relationship-based scams.\n\nCommon senior-targeting scams include: tech support scams ('Your computer has a virus'), government impersonation ('You owe the IRS'), grandparent scams ('I'm in jail, don't tell mom'), Medicare fraud, and romance scams. Each exploits a different vulnerability — trust in authority, fear of government, love for family, or loneliness.",
          },
          {
            type: "text",
            heading: "How to Protect Your Older Family Members",
            body: "1. Set up Vardin for them: Add them to your family protection circle so you get alerts when they scan suspicious messages.\n2. Install call blocking: Enable spam filters on their phone and install a call-blocking app.\n3. Remove remote access: If they have TeamViewer or AnyDesk installed and don't need it, remove it — tech support scammers use these.\n4. Create a family code word: If someone calls claiming to be a grandchild in trouble, the caller must know the code word.\n5. Freeze their credit: If they're not applying for new credit, a freeze prevents identity theft.\n6. Talk regularly: The most important protection is regular, non-judgmental communication. Make it clear they can always come to you with suspicious messages — no shame, no blame.\n7. Review their setup: Are their passwords unique? Is 2FA enabled? Are software updates current?",
          },
          {
            type: "tip",
            body: "Frame scam awareness as empowerment, not limitation. Instead of 'you're vulnerable,' say 'let's make sure you're protected.' Seniors who feel respected are more likely to report suspicious activity.",
          },
        ],
        quiz: [
          {
            type: "multiple_choice",
            question: "What is the most important thing you can do to protect an older family member from scams?",
            options: [
              "Monitor all their financial transactions",
              "Take away their phone and computer",
              "Maintain regular, non-judgmental communication so they feel safe reporting suspicious activity",
              "Change their phone number",
            ],
            correct: 2,
            explanation: "Open communication is the strongest defense. Seniors who know they can come to you without shame are more likely to report scams early — before money is lost. Tools like Vardin help, but human connection is key.",
          },
          {
            type: "true_false",
            question: "Having a family code word can protect seniors from grandparent and voice cloning scams.",
            correct: true,
            explanation: "A family code word that only real family members know defeats impersonation scams. If a caller doesn't know the word, they're not your family member — no matter how convincing their story or voice.",
          },
        ],
      },
    ],
  },
];