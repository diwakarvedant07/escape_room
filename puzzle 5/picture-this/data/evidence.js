// Generated from data/evidence.json by tools/sync-data.mjs. Edit the JSON, then re-run it.
(globalThis.OF_DATA = globalThis.OF_DATA || {})["evidence"] = {
  "version": 1,
  "lenses": [
    "physical",
    "identity",
    "cloud",
    "finance"
  ],
  "lensLabels": {
    "physical": "Physical",
    "identity": "Identity",
    "cloud": "Cloud",
    "finance": "Finance"
  },
  "emptyText": "No records for this lens.",
  "scenes": {
    "1": {
      "record": {
        "scene": "1 — Sticky-note password",
        "user_id": "E-2041 (n.rao) — Neha Rao",
        "department": "Finance Ops",
        "location_or_system": "Floor 4, desk 4-17",
        "observed_at": "Tue 20 Oct, 09:47:20"
      },
      "physical": [
        "20 Oct 09:47:20 CCTV tag, Floor 4, desk 4-17: unbadged person, black hoodie, phone raised toward monitor (6 s)."
      ],
      "identity": [],
      "cloud": [],
      "finance": []
    },
    "2": {
      "record": {
        "scene": "2 — Unlocked workstation",
        "user_id": "E-3310 (k.nair) — Kabir Nair",
        "department": "Procurement",
        "location_or_system": "Floor 2, WS-2-114",
        "observed_at": "Wed 14 Oct, 13:05"
      },
      "physical": [
        "14 Oct 13:05 WS-2-114, Floor 2: session active, no input for 38 min, desk unattended."
      ],
      "identity": [
        "14 Oct 13:05 K. Nair (E-3310) session unlocked; no sign-ins from external IPs."
      ],
      "cloud": [],
      "finance": []
    },
    "3": {
      "record": {
        "scene": "3 — Excessive app permissions",
        "user_id": "E-2041 (n.rao) — Neha Rao",
        "department": "Finance Ops",
        "location_or_system": "Cloud tenant: OAuth consent",
        "observed_at": "Thu 22 Oct, 14:40:12"
      },
      "physical": [],
      "identity": [],
      "cloud": [
        "22 Oct 14:40:12 OAuth consent granted. User n.rao. App \"MeetMate AI\". Publisher: Unverified. Scopes: Mail.ReadWrite, Files.ReadWrite.All, Calendars.Read, Contacts.Read, Directory.Read.All.",
        "22 Oct 23:55:08 token use from 203.0.113.58: 340 mailbox reads."
      ],
      "finance": []
    },
    "4": {
      "record": {
        "scene": "4 — Tailgating",
        "user_id": "E-2041 (n.rao) swiped; second person unbadged",
        "department": "Finance Ops",
        "location_or_system": "Floor 4, door D-3",
        "observed_at": "Tue 20 Oct, 09:12:04"
      },
      "physical": [
        "20 Oct 09:12:04 D-3 badge reader: SWIPE OK E-2041.",
        "20 Oct 09:12:06–09:12:11 door contact: OPEN.",
        "20 Oct 09:12 headcount sensor: +2 entries on 1 swipe. CCTV: unbadged person, black hoodie, backpack."
      ],
      "identity": [],
      "cloud": [],
      "finance": []
    },
    "5": {
      "record": {
        "scene": "5 — Sharing credentials",
        "user_id": "E-2041 (n.rao) shared with E-2188 (a.kulkarni)",
        "department": "Finance Ops",
        "location_or_system": "VPN / device DEV-A-882",
        "observed_at": "Wed 21 Oct, 16:05:00"
      },
      "physical": [],
      "identity": [
        "21 Oct 16:05:00 note shown on phone: \"Sun@1234 / VPN login\".",
        "21 Oct 16:09:41 VPN login n.rao from device DEV-A-882 (asset owner A. Kulkarni, E-2188)."
      ],
      "cloud": [],
      "finance": [
        "23 Oct 17:42:11 PAY-88213 approvals. Maker: n.rao. Checker: n.rao (device DEV-A-882). Single login used for both roles."
      ]
    },
    "6": {
      "record": {
        "scene": "6 — QR-code phishing",
        "user_id": "E-2041 (n.rao) — Neha Rao",
        "department": "Finance Ops",
        "location_or_system": "Web proxy: orbit-wellness-portal.example",
        "observed_at": "Thu 22 Oct, 11:20:33"
      },
      "physical": [],
      "identity": [],
      "cloud": [
        "22 Oct 11:20:33 web proxy: n.rao POST to orbit-wellness-portal.example (198.51.100.77). Category: newly registered domain. Form type: credential."
      ],
      "finance": []
    },
    "7": {
      "record": {
        "scene": "7 — Shadow AI",
        "user_id": "E-1877 (m.joshi) — Meera Joshi",
        "department": "Marketing",
        "location_or_system": "Web proxy: chat.chatai.example",
        "observed_at": "Mon 19 Oct, 15:22"
      },
      "physical": [],
      "identity": [],
      "cloud": [
        "19 Oct 15:22 proxy: M. Joshi (E-1877) uploaded Project_Plan_Confidential.pdf (2.4 MB) to chat.chatai.example. Project: Helios launch plan."
      ],
      "finance": []
    },
    "8": {
      "record": {
        "scene": "8 — MFA fatigue",
        "user_id": "E-2041 (n.rao) — Neha Rao",
        "department": "Finance Ops",
        "location_or_system": "Identity provider: MFA push / VPN",
        "observed_at": "Fri 23 Oct, 02:14:37"
      },
      "physical": [],
      "identity": [
        "Push log for n.rao, all from 203.0.113.58 (New York, US):",
        "23 Oct 02:03:11 push 1 — no response",
        "23 Oct 02:05:02 push 2 — timed out",
        "23 Oct 02:06:47 push 3 — timed out",
        "23 Oct 02:08:30 push 4 — denied",
        "23 Oct 02:10:12 push 5 — timed out",
        "23 Oct 02:12:01 push 6 — timed out",
        "23 Oct 02:14:37 push 7 — APPROVED",
        "23 Oct 02:14:39 VPN session established, n.rao, 203.0.113.58."
      ],
      "cloud": [],
      "finance": []
    },
    "9": {
      "record": {
        "scene": "9 — CEO impersonation",
        "user_id": "E-2041 (n.rao) — call received",
        "department": "Finance Ops",
        "location_or_system": "Video call / payment portal",
        "observed_at": "Fri 23 Oct, 17:31:05"
      },
      "physical": [],
      "identity": [],
      "cloud": [],
      "finance": [
        "23 Oct 17:31:05 video call from \"Rohit Mehta, CEO\", 7 min. Caller email rohit.mehta@orbit-financial-corp.example (company domain is orbitfinancial.example).",
        "Request: change bank details for vendor Kestrel Logistics and release ₹4.2 crore urgently. PAY-88213 released 17:42:18."
      ]
    },
    "10": {
      "record": {
        "scene": "10 — Whiteboard leak",
        "user_id": "E-2041 (n.rao) — last editor",
        "department": "Finance Ops",
        "location_or_system": "Floor 4, Meeting Room 2",
        "observed_at": "Tue 20 Oct, 09:31"
      },
      "physical": [
        "20 Oct 09:31–09:44 MR-2 occupancy sensor active. No badge-in for the room.",
        "Whiteboard last edited 19 Oct 17:05 by E-2041."
      ],
      "identity": [],
      "cloud": [],
      "finance": []
    }
  }
};
