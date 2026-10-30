// Generated from data/stages.json by tools/sync-data.mjs. Edit the JSON, then re-run it.
(globalThis.OF_DATA = globalThis.OF_DATA || {})["stages"] = {
  "version": 1,
  "story": {
    "heading": "Orbit Financial — Incident #OF-2026-1023",
    "paragraphs": [
      "On Friday 23 October at 17:42 IST, ₹4,20,00,000 was released to a bank account that was not Kestrel Logistics'. The payment was approved after a video call from \"the CEO\".",
      "You are the incident response team. The case file holds ten findings from Orbit's Floor 4 and neighboring offices, plus the logs that were frozen at 18:00.",
      "Find out how the attacker got in, rebuild the sequence, and decide what would have stopped it.",
      "You have 45 minutes before the bank locks the evidence."
    ]
  },
  "stages": [
    {
      "n": 1,
      "short": "Sweep",
      "title": "Evidence sweep",
      "intro": "Open each scene and click what is wrong. Each scene hides one main finding. Every find adds an evidence card to the case file."
    },
    {
      "n": 2,
      "short": "Logs",
      "title": "Read the logs",
      "intro": "Answer all six questions from the Evidence Viewer. The suggested lens is free guidance."
    },
    {
      "n": 3,
      "short": "Sort",
      "title": "Sort real from noise",
      "intro": "Mark every finding as part of this attack or unrelated, then submit."
    },
    {
      "n": 4,
      "short": "Timeline",
      "title": "Rebuild the timeline",
      "intro": "Put the eight real findings in order, earliest at the top. Read each card's observed-at time in the Evidence Viewer."
    },
    {
      "n": 5,
      "short": "Chain",
      "title": "Break the chain",
      "intro": "Place up to three controls on the rack, then run the attacker simulation. The vault digit goes to the lowest-cost set that cuts every route."
    },
    {
      "n": 6,
      "short": "Vault",
      "title": "Vault",
      "intro": "Enter the five-digit code from your recovered digits."
    }
  ],
  "questions": [
    {
      "id": "q1",
      "gate": "s2q1",
      "lens": "Identity",
      "text": "Which account received the push prompts?",
      "type": "choice",
      "options": [
        "n.rao",
        "a.kulkarni",
        "k.nair",
        "m.joshi"
      ]
    },
    {
      "id": "q2",
      "gate": "s2q2",
      "lens": "Identity",
      "text": "How many push prompts went unapproved before the one that was approved?",
      "type": "keypad"
    },
    {
      "id": "q3",
      "gate": "s2q3",
      "lens": "Cloud",
      "text": "Which unverified app was granted mailbox and Drive access?",
      "type": "choice",
      "options": [
        "MeetMate AI",
        "ChatAI",
        "Wellness Portal",
        "CalSync"
      ]
    },
    {
      "id": "q4",
      "gate": "s2q4",
      "lens": "Cloud",
      "text": "Which source IP appears in both the push prompts and the OAuth token use?",
      "type": "choice",
      "options": [
        "198.51.100.77",
        "203.0.113.9",
        "203.0.113.58",
        "192.0.2.14"
      ]
    },
    {
      "id": "q5",
      "gate": "s2q5",
      "lens": "Physical",
      "text": "How many people entered door D-3 on a single badge swipe?",
      "type": "choice",
      "options": [
        "1",
        "2",
        "3",
        "4"
      ]
    },
    {
      "id": "q6",
      "gate": "s2q6",
      "lens": "Any",
      "text": "In how many of the ten scenes does the password Sun@1234 appear?",
      "type": "keypad"
    }
  ],
  "relevanceRule": "A finding belongs to this incident only if it involves the victim account (E-2041 / n.rao), her floor (Floor 4) or the attacker's infrastructure, within 20–23 October.",
  "timelineStart": [
    9,
    3,
    6,
    10,
    8,
    1,
    4,
    5
  ],
  "hints": {
    "1": [
      "Every scene hides one main failure. Look for what a person did or left behind.",
      "Hotspots sit on objects: notes, screens, doors, phones, posters."
    ],
    "2": [
      "Use the right lens: Identity for sign-ins and MFA, Cloud for apps and IPs, Physical for doors and rooms.",
      "Each question is answered by one specific log line. Read the lines for that scene."
    ],
    "3": [
      "Ask three things of every card: whose account, which floor or system, and when.",
      "Two findings involve other people, elsewhere in the company, away from the victim."
    ],
    "4": [
      "Use each card's \"Observed at\" time, not the date the mistake first existed.",
      "The first three events happen on Tuesday morning, inside one hour."
    ],
    "5": [
      "Two controls are enough. Look for the points every route has to pass through.",
      "Every route must pass through either the session stage or the payment stage."
    ]
  },
  "messages": {
    "frozen": "Evidence frozen. The bank locked the case.",
    "sufficient": "Sufficient, but not minimal. The vault digit is released only for the lowest-cost solution.",
    "allCut": "All paths cut.",
    "revealLine": "Sun@1234 worked everywhere.",
    "unrelatedLabel": "Real hygiene failures, not part of this attack.",
    "lesson": "Hygiene controls such as door control, clean desk and QR filtering each cut one route. The attacker had several. The minimal fixes sit at chokepoints: MFA that resists push fatigue plus OAuth governance, or payment verification plus real dual approval. A real program needs both layers."
  }
};
