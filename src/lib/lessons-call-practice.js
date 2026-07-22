// Call Practice lessons — interactive scam call training with real scammer transcripts
export const CALL_PRACTICE_CATEGORY = {
  id: "call_practice",
  name: "Call Practice",
  icon: "PhoneCall",
  color: "from-rose-500 to-red-600",
  description: "Practice handling real scam calls with audio transcripts",
  lessons: [
    {
      id: "call_practice_tech_support",
      title: "Scam Call Simulator: Tech Support Scam",
      xp: 75,
      content: [
        {
          type: "text",
          heading: "What You'll Learn",
          body: "In this lesson, you'll read a REAL transcript of a tech support scam call. These scammers call claiming your computer has a virus. You'll see exactly how they manipulate victims, and practice choosing the right responses.",
        },
        {
          type: "audio_transcript",
          heading: "Real Scam Call Transcript",
          speaker: "scammer",
          lines: [
            { speaker: "scammer", text: "Hello, this is Windows Support calling about your computer. We've detected critical security alerts on your device." },
            { speaker: "scammer", text: "Your computer is infected with dangerous malware that could steal your banking information. We need to act immediately." },
            { speaker: "scammer", text: "I need you to go to your computer right now. I'll guide you through removing the virus. Can you turn it on?" },
            { speaker: "scammer", text: "Don't worry, this is a free service from Microsoft. We just need to run a security scan. Go to the website I'll give you." },
            { speaker: "scammer", text: "Type in www.windows-security-check.com and download the tool. It will show you the infections." },
            { speaker: "scammer", text: "I see the infections on our end. To remove them, I need you to grant me remote access so I can clean them personally." },
            { speaker: "scammer", text: "Yes, I'll need you to stay on the line. Don't hang up or your computer will be permanently damaged." },
          ],
          analysis: "This is a textbook tech support scam. Key red flags: (1) Microsoft/Windows never calls you about infections — they don't know your computer's status. (2) The scammer creates urgency by claiming the computer is 'permanently damaged' if you hang up. (3) The fake website looks like a real Microsoft site but is not. (4) Remote access is the goal — once granted, scammers can steal files, install malware, and access your banking. (5) 'Free service' builds false trust.",
        },
        {
          type: "tip",
          body: "Real Microsoft support NEVER calls you. If you have a computer problem, YOU contact them — using the phone number from the official Microsoft website. Never grant remote access to anyone who calls you.",
        },
        {
          type: "text",
          heading: "The Scammer's Playbook",
          body: "1. Claim authority: 'Windows Support' / 'Microsoft' — sounds official\n2. Create fear: 'critical security alerts', 'dangerous malware'\n3. Create urgency: 'act immediately', 'permanently damaged'\n4. Build trust: 'free service from Microsoft'\n5. Direct action: 'go to this website', 'download this tool'\n6. Goal: remote access — full control of your computer\n7. Trap: 'don't hang up' — prevents you from thinking or verifying",
        },
      ],
      quiz: [
        {
          type: "scenario",
          question: "The caller says: 'We've detected critical security alerts on your device.' What's the best response?",
          options: [
            "Go to your computer immediately and follow their instructions",
            "Ask 'How do I know you're really from Microsoft?'",
            "Hang up — Microsoft never calls you about computer problems",
            "Ask for their employee ID number to verify",
          ],
          correct: 2,
          explanation: "Microsoft NEVER calls you about infections. The fact that they called YOU is the red flag. No legitimate company monitors your home computer for viruses and calls you about it. Hang up immediately.",
        },
        {
          type: "scenario",
          question: "The caller says: 'Don't hang up or your computer will be permanently damaged.' What does this tell you?",
          options: [
            "The threat is real and I should stay on the line",
            "This is a manipulation tactic — real support doesn't threaten permanent damage",
            "I should ask for a second opinion from their supervisor",
            "I should let them remote in quickly before it's too late",
          ],
          correct: 1,
          explanation: "Creating false urgency and threatening permanent damage is a manipulation tactic. Real tech support NEVER threatens you. This is designed to make you panic and comply without thinking. Hang up.",
        },
        {
          type: "multiple_choice",
          question: "What is the scammer's ultimate goal in a tech support scam?",
          options: [
            "To genuinely fix your computer",
            "To get remote access to your computer so they can steal data and install malware",
            "To sell you legitimate antivirus software",
            "To check if your Windows license is valid",
          ],
          correct: 1,
          explanation: "Remote access is the ultimate goal. Once they have it, scammers can steal passwords, banking info, personal files, and install ransomware. Never grant remote access to anyone who calls you.",
        },
        {
          type: "true_false",
          question: "If a website looks like the real Microsoft website, it must be legitimate.",
          correct: false,
          explanation: "Scammers create exact copies of real websites. The URL is what matters: microsoft.com is real, windows-security-check.com is fake. Always check the actual web address, not just the look of the page.",
        },
      ],
    },
    {
      id: "call_practice_irs",
      title: "Scam Call Simulator: IRS Impersonation",
      xp: 75,
      content: [
        {
          type: "text",
          heading: "What You'll Learn",
          body: "The IRS phone scam is one of the most reported scams worldwide. You'll read a real transcript and practice identifying every manipulation tactic used.",
        },
        {
          type: "audio_transcript",
          heading: "Real Scam Call Transcript",
          lines: [
            { speaker: "scammer", text: "This is Officer Kevin Marshall from the Internal Revenue Service. We have a legal case filed against your name for tax fraud." },
            { speaker: "scammer", text: "There is an arrest warrant issued for you. The police are on their way to your home right now." },
            { speaker: "scammer", text: "You owe $4,800 in back taxes and penalties. If you don't pay within the next 30 minutes, you will be arrested." },
            { speaker: "scammer", text: "The only way to stop this is to pay immediately. We accept payment via Google Play gift cards, Apple gift cards, or Bitcoin." },
            { speaker: "scammer", text: "You need to go to the store, purchase $4,800 in gift cards, and read me the numbers on the back. Do not tell anyone what you're doing." },
            { speaker: "scammer", text: "This is a federal investigation. If you tell anyone — your family, your lawyer, your bank — you will be charged with obstructing justice." },
            { speaker: "scammer", text: "Do not hang up this phone. If you hang up, I will note that you refused to cooperate and the arrest will proceed immediately." },
          ],
          analysis: "This is a classic IRS/government impersonation scam. MASSIVE red flags: (1) The IRS NEVER calls you — they communicate by mail. (2) The IRS does NOT accept gift cards or Bitcoin — ever. (3) Police don't come for tax issues within 30 minutes. (4) 'Don't tell anyone' is designed to isolate you from people who'd recognize the scam. (5) 'Don't hang up' prevents you from verifying. (6) Gift cards are irreversible and untraceable — that's why scammers love them.",
        },
        {
          type: "tip",
          body: "The real IRS will ALWAYS mail you a letter first. They never call as the first contact. They never demand immediate payment. They never ask for gift cards. They never threaten arrest over the phone. If you get this call, it's 100% a scam — no exceptions.",
        },
        {
          type: "text",
          heading: "Why Gift Cards?",
          body: "Scammers love gift cards because they're impossible to reverse. Once you read the numbers on the back, the money is gone — instantly, untraceably. No bank can help you. No police report can recover the money. The IRS, banks, and government agencies NEVER accept gift cards as payment. If ANYONE asks you to pay with gift cards, it is ALWAYS a scam — 100% of the time, no exceptions.",
        },
      ],
      quiz: [
        {
          type: "scenario",
          question: "The caller says: 'The police are on their way to your home right now.' What should you do?",
          options: [
            "Pay immediately to avoid arrest",
            "Ask for proof of the arrest warrant",
            "Hang up — the IRS doesn't call and police don't arrest for tax issues within minutes",
            "Offer to pay half now and half later",
          ],
          correct: 2,
          explanation: "Police don't come to your home within minutes for tax issues. The IRS communicates by mail first, always. This is pure fear-mongering. Hang up. If you're worried about taxes, call the real IRS using the number from IRS.gov.",
        },
        {
          type: "scenario",
          question: "The caller says: 'We accept payment via Google Play gift cards.' This tells you:",
          options: [
            "They have modern payment options",
            "This is 100% a scam — no government agency accepts gift cards",
            "I should ask what denomination they prefer",
            "Gift cards are a normal way to pay taxes",
          ],
          correct: 1,
          explanation: "NO legitimate organization — not the IRS, not your bank, not the government, not tech support — accepts gift cards as payment. If ANYONE asks for gift cards, it's a scam. Always. 100% of the time. No exceptions.",
        },
        {
          type: "multiple_choice",
          question: "The caller says 'Don't tell anyone — this is a federal investigation.' Why do scammers say this?",
          options: [
            "To protect your privacy during the investigation",
            "To isolate you from family or friends who would recognize the scam",
            "Because it's actually illegal to discuss IRS matters",
            "To speed up the legal process",
          ],
          correct: 1,
          explanation: "Scammers isolate you because anyone you tell — your spouse, your adult child, your bank teller — would immediately say 'That's a scam! Hang up!' Isolation is a key tactic. When someone tells you not to tell anyone, that's when you should tell everyone.",
        },
        {
          type: "fill_blank",
          question: "Fill in the blank: The real IRS will ALWAYS contact you first by ______, not by phone.",
          text_before: "The real IRS will ALWAYS contact you first by ",
          text_after: ", not by phone.",
          acceptable_answers: ["mail", "letter", "postal mail", "post"],
          explanation: "The IRS always sends a letter by mail as their first contact. They never call you first. If you get a call claiming to be the IRS and you haven't received a letter, it's a scam.",
        },
      ],
    },
    {
      id: "call_practice_grandparent",
      title: "Real Scammer Exposed: The Grandparent Scam",
      xp: 60,
      content: [
        {
          type: "text",
          heading: "The Grandparent Scam",
          body: "This is one of the cruelest scams — it targets grandparents by pretending their grandchild is in trouble. Scammers play on love and fear to extract money. Here's a real transcript.",
        },
        {
          type: "audio_transcript",
          heading: "Real Scam Call Transcript",
          lines: [
            { speaker: "scammer", text: "Grandma? Is that you? It's me... I'm in trouble." },
            { speaker: "scammer", text: "I was in a car accident. I hit another car and the driver is hurt. I'm at the police station right now." },
            { speaker: "scammer", text: "Please don't tell mom and dad — they'll be so angry. I need your help, Grandma. I need money for a lawyer." },
            { speaker: "scammer", text: "The lawyer needs $3,000 in cash. I'll give you the address to send it. Please hurry, Grandma — they're going to put me in jail." },
            { speaker: "scammer", text: "I'm so scared. Please don't tell anyone in the family. Just send the money and I'll explain everything when I get out." },
          ],
          analysis: "This is the grandparent scam. Red flags: (1) 'Grandma? Is that you?' — the scammer doesn't even know the grandchild's name or gender. They wait for YOU to fill in the name. (2) 'Don't tell mom and dad' — isolating you from family who'd recognize the scam. (3) Urgency and fear — jail, accident, lawyer fees. (4) Unusual payment request — cash, wire transfer, gift cards. (5) The grandchild 'sounds different' because they're upset — this explains away any voice differences. The fix: always verify with the parents before sending ANY money.",
        },
        {
          type: "tip",
          body: "Set up a family code word — a secret word only your real family knows. If someone calls claiming to be a grandchild in trouble, ask: 'What's the family code word?' If they don't know it, hang up immediately.",
        },
        {
          type: "text",
          heading: "How to Verify",
          body: "If you get a call from a 'grandchild' in trouble:\n1. Don't panic — scammers WANT you panicked\n2. Don't send money — no matter how urgent\n3. Hang up and call the grandchild's parents directly\n4. Use a phone number you already have — not one the caller gave you\n5. If you can't reach the parents, call the grandchild directly\n6. Never tell the caller any information — they can use it against you\n7. If they say 'don't tell anyone,' that's your signal to tell everyone",
        },
      ],
      quiz: [
        {
          type: "scenario",
          question: "A caller says 'Grandma? It's me!' but doesn't say their name. What's happening?",
          options: [
            "They're your grandchild and assume you'd recognize their voice",
            "They're a scammer — they don't know your grandchild's name or gender and want YOU to fill it in",
            "They have laryngitis and sound different",
            "They're using a new phone and the connection is bad",
          ],
          correct: 1,
          explanation: "Scammers say 'It's me' because they don't know your grandchild's name or gender. When you say 'Michael, is that you?' they now have the name. They want YOU to provide the information they don't have. Always ask: 'Who is this? Say your name.'",
        },
        {
          type: "scenario",
          question: "The caller says 'Please don't tell mom and dad.' What should you do?",
          options: [
            "Respect their wishes and send the money quietly",
            "Call the parents immediately — the secrecy is a huge red flag",
            "Wait until the situation resolves, then tell them",
            "Ask the caller why they don't want you to tell the parents",
          ],
          correct: 1,
          explanation: "When someone tells you NOT to tell your family, that's exactly when you SHOULD tell your family. Real family members in genuine trouble would want you to involve their parents. The secrecy is designed to stop you from consulting someone who'd say 'That's a scam.'",
        },
        {
          type: "true_false",
          question: "A family code word that only your real family knows can defeat grandparent scams and voice cloning.",
          correct: true,
          explanation: "A secret code word that only real family members know defeats impersonation scams. If the caller doesn't know the word, they're not your grandchild — no matter how convincing their story or how much their voice sounds right.",
        },
        {
          type: "multiple_choice",
          question: "What's the best first step when a 'grandchild' calls asking for money?",
          options: [
            "Send the money quickly to help them",
            "Ask for their lawyer's contact information",
            "Hang up and call the grandchild or their parents using a number you already have",
            "Ask the caller to prove they're your grandchild",
          ],
          correct: 2,
          explanation: "Hang up and call back using a number you already have. This is the single most effective defense — if it's a scam, the real grandchild will answer their phone and be fine. If they don't answer, call their parents. Never call a number the caller gave you.",
        },
      ],
    },
    {
      id: "call_practice_legitimate",
      title: "Not Every Call is a Scam — Spotting Real Calls",
      xp: 50,
      content: [
        {
          type: "text",
          heading: "Learning to Tell the Difference",
          body: "Scam awareness doesn't mean being suspicious of EVERY call. Many calls are legitimate — from your bank, your doctor, your delivery service, or your employer. The key is knowing the difference between a legitimate caller and a scammer. This lesson teaches you how to verify without refusing every call.",
        },
        {
          type: "text",
          heading: "Legitimate Call Characteristics",
          body: "A real call from a legitimate organization:\n• Never demands immediate payment or action\n• Never asks for gift cards, crypto, or wire transfers\n• Never asks for your full password, PIN, or full SSN\n• Never threatens arrest 'in the next 30 minutes'\n• Never says 'don't tell anyone'\n• Is happy for you to call back using the official number\n• Has your account information already (they called YOU)\n• Doesn't pressure you to stay on the line\n• Can verify your identity without asking for sensitive info",
        },
        {
          type: "tip",
          body: "The golden rule: 'I'm going to hang up and call back using the number from your official website or my card.' A real organization says 'Of course, no problem.' A scammer panics, insists you stay on the line, or threatens consequences if you hang up. That reaction tells you everything.",
        },
        {
          type: "example",
          title: "Real Legitimate Call",
          body: "'Hello, this is Sarah from Chase Bank. We noticed an unusual charge on your debit card and wanted to verify it was you. I'm not going to ask for any personal information on this call. If you'd like, you can hang up and call the number on the back of your card, ask for the fraud department, and reference case number 7742.'\n\nThis is legitimate: no demands, no urgency, suggests hanging up and calling back, no sensitive info requested, provides a reference number.",
        },
        {
          type: "example",
          title: "Fake 'Legitimate' Call",
          body: "'Hello, this is Sarah from Chase Bank. We've noticed unusual activity. I need to verify your identity. Can you please confirm your full Social Security number, your date of birth, and your online banking password? We've also put a hold on your account — I can remove it once we verify your information.'\n\nThis is a scam: asking for SSN and password, creating urgency (account hold), demanding info before helping. Real banks never ask for your password — they already have it.",
        },
      ],
      quiz: [
        {
          type: "scenario",
          question: "A caller says 'I'm from your bank. I need your password to verify your identity.' What do you do?",
          options: [
            "Give it to them — they're from your bank",
            "Refuse — your bank already has your password and would never ask for it",
            "Give them a fake password to see what happens",
            "Ask them to verify their identity first",
          ],
          correct: 1,
          explanation: "Your bank already HAS your password. They never need you to tell them what it is. If someone asks for your password, it's a scam — 100% of the time, no exceptions. No legitimate organization asks for your password.",
        },
        {
          type: "scenario",
          question: "You tell the caller 'I'll hang up and call the number on my card.' They say 'If you hang up, your account will be frozen.' What does this mean?",
          options: [
            "It's an urgent situation and you should stay on the line",
            "It's a scam — real organizations encourage you to call back through official channels",
            "You should ask for their supervisor instead",
            "You should ask them to send you an email as proof",
          ],
          correct: 1,
          explanation: "A real bank encourages you to call back through the official number — they WANT you to be safe. If a caller panics or threatens you when you want to call back, they're a scammer. The threat of account freezing is designed to keep you on the line so they can manipulate you.",
        },
        {
          type: "multiple_choice",
          question: "Which of these is a sign of a LEGITIMATE call?",
          options: [
            "The caller demands payment within 30 minutes",
            "The caller says 'I can't discuss this unless you stay on the line'",
            "The caller suggests you hang up and call back using the number on your card",
            "The caller asks for gift card payment",
          ],
          correct: 2,
          explanation: "A legitimate caller welcomes verification. They suggest you call back through official channels. They never demand instant payment, gift cards, or secrecy. When in doubt, say 'I'll call back' — the reaction tells you everything.",
        },
        {
          type: "true_false",
          question: "If a caller knows your name and account number, they must be from your bank.",
          correct: false,
          explanation: "Scammers can buy your name and account info from data breaches. Knowing your name or partial account number proves nothing. Real verification goes one way: YOU call THEM using a number you trust, not the other way around.",
        },
      ],
    },
  ],
};