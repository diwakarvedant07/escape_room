// Generated from data/scenes.json by tools/sync-data.mjs. Edit the JSON, then re-run it.
(globalThis.OF_DATA = globalThis.OF_DATA || {})["scenes"] = {
  "version": 1,
  "scenes": [
    {
      "id": 1,
      "title": "Sticky-note password",
      "image": "assets/scenes/scene-01.jpg",
      "badPractice": "Writing down and exposing a password",
      "concept": "Password security",
      "rightBehavior": "Keep passwords in a password manager and never write them where someone can read or photograph them.",
      "cards": {
        "main": "Sticky note on the monitor bezel reads \"Sun@1234\".",
        "a": "Nameplate: \"N. Rao — Finance Ops, Desk 4-17\".",
        "b": "Monitor login screen shows the user name n.rao."
      }
    },
    {
      "id": 2,
      "title": "Unlocked workstation",
      "image": "assets/scenes/scene-02.jpg",
      "badPractice": "Leaving a workstation unlocked and unattended",
      "concept": "Device security",
      "rightBehavior": "Lock the screen (Win+L) every time you step away, even for a minute.",
      "cards": {
        "main": "Screen unlocked with the mailbox open; nobody at the desk.",
        "a": "Employee badge left lying on the desk.",
        "b": "Floor 2 signage and a nameplate: \"K. Nair — Procurement\"."
      }
    },
    {
      "id": 3,
      "title": "Excessive app permissions",
      "image": "assets/scenes/scene-03.jpg",
      "badPractice": "Approving OAuth scopes without review",
      "concept": "Excessive OAuth permissions",
      "rightBehavior": "Check the publisher and the scopes, and send unverified apps for admin review instead of clicking Allow.",
      "cards": {
        "main": "Pop-up \"MeetMate AI wants to access your account\" lists five scopes; the cursor is over Allow.",
        "a": "Publisher shown as \"Unverified\".",
        "b": "Consent page URL: meetmate-ai.example/consent."
      }
    },
    {
      "id": 4,
      "title": "Tailgating",
      "image": "assets/scenes/scene-04.jpg",
      "badPractice": "Letting an unverified person through a badge door",
      "concept": "Tailgating / physical security",
      "rightBehavior": "Let the door close behind you and send anyone without a badge to reception.",
      "cards": {
        "main": "A second person with no badge (black hoodie, backpack) walks through behind the employee.",
        "a": "The door is held open after a single badge swipe.",
        "b": "Sign: \"Employees Only — Door D-3, Floor 4\"."
      }
    },
    {
      "id": 5,
      "title": "Sharing credentials",
      "image": "assets/scenes/scene-05.jpg",
      "badPractice": "Sharing a login with a colleague",
      "concept": "Access control / accountability",
      "rightBehavior": "Never share a login; request proper access so every action is tied to one person.",
      "cards": {
        "main": "Phone note reads \"Sun@1234 / VPN login / Don't forget!\".",
        "a": "The note is labelled \"VPN login\".",
        "b": "Colleague's laptop: asset tag DEV-A-882 and a name tag \"A. Kulkarni\"."
      }
    },
    {
      "id": 6,
      "title": "QR-code phishing",
      "image": "assets/scenes/scene-06.jpg",
      "badPractice": "Scanning an untrusted QR code",
      "concept": "Quishing",
      "rightBehavior": "Type known addresses yourself and treat a sticker over an official QR code as suspicious.",
      "cards": {
        "main": "A QR sticker has been pasted over the Wellness Week poster.",
        "a": "Tiny text under the QR code: orbit-wellness-portal.example.",
        "b": "Half-covered poster text: wellness.orbitfinancial.example."
      }
    },
    {
      "id": 7,
      "title": "Shadow AI",
      "image": "assets/scenes/scene-07.jpg",
      "badPractice": "Uploading confidential files to an unapproved AI tool",
      "concept": "Shadow AI / data leakage",
      "rightBehavior": "Use only approved AI tools and keep confidential files out of public services.",
      "cards": {
        "main": "Project_Plan_Confidential.pdf uploaded to a public AI chat tool.",
        "a": "User chip: \"M. Joshi — Marketing\".",
        "b": "Project title: \"Helios launch plan\"."
      }
    },
    {
      "id": 8,
      "title": "MFA fatigue",
      "image": "assets/scenes/scene-08.jpg",
      "badPractice": "Approving a push the user did not initiate",
      "concept": "MFA fatigue / push bombing",
      "rightBehavior": "Deny any sign-in prompt you did not start and report it to the security team straight away.",
      "cards": {
        "main": "Push prompt \"Approve sign-in? New York, US\" with a finger over Approve.",
        "a": "Notification badge shows 7.",
        "b": "Lock-screen time reads 02:14."
      }
    },
    {
      "id": 9,
      "title": "CEO impersonation",
      "image": "assets/scenes/scene-09.jpg",
      "badPractice": "Acting on an unverified executive request",
      "concept": "Executive impersonation / deepfake",
      "rightBehavior": "Verify urgent payment or bank-detail requests on a known number, whoever appears to be asking.",
      "cards": {
        "main": "Shared screen: change bank details for Kestrel Logistics and release ₹4.2 crore urgently.",
        "a": "Caller ID: rohit.mehta@orbit-financial-corp.example — the company domain is orbitfinancial.example.",
        "b": "Video artefact around the jaw; the lip movement lags the audio."
      }
    },
    {
      "id": 10,
      "title": "Whiteboard leak",
      "image": "assets/scenes/scene-10.jpg",
      "badPractice": "Leaving sensitive information on a shared whiteboard",
      "concept": "Information leakage",
      "rightBehavior": "Wipe whiteboards after meetings and never write credentials, keys or server details on shared surfaces.",
      "cards": {
        "main": "Whiteboard lists a client name, production URL, DB server IP, an API key and a Finance UAT login.",
        "a": "Kestrel Logistics phone number written on the board.",
        "b": "Line reads \"Finance UAT portal: n.rao / Sun@1234\"."
      }
    }
  ]
};
