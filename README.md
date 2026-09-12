# Cyclops — Privacy-First Browsing Agent

🟧🟧🟧🟧🟧🟧🟧🟧🟧🟧🟧🟧🟧🟧🟧

██╗  ██╗███████╗██╗     ██╗      ██████╗
██║  ██║██╔════╝██║     ██║     ██╔═══██╗
███████║█████╗  ██║     ██║     ██║   ██║
██╔══██║██╔══╝  ██║     ██║     ██║   ██║
██║  ██║███████╗███████╗███████╗╚██████╔╝
╚═╝  ╚═╝╚══════╝╚══════╝╚══════╝ ╚═════╝

███████╗██╗   ██╗███████╗██████╗ ██╗   ██╗ ██████╗ ███╗   ██╗███████╗
██╔════╝██║   ██║██╔════╝██╔══██╗╚██╗ ██╔╝██╔═══██╗████╗  ██║██╔════╝
█████╗  ██║   ██║█████╗  ██████╔╝ ╚████╔╝ ██║   ██║██╔██╗ ██║█████╗
██╔══╝  ╚██╗ ██╔╝██╔══╝  ██╔══██╗  ╚██╔╝  ██║   ██║██║╚██╗██║██╔══╝
███████╗ ╚████╔╝ ███████╗██║  ██║   ██║   ╚██████╔╝██║ ╚████║███████╗
╚══════╝  ╚═══╝  ╚══════╝╚═╝  ╚═╝   ╚═╝    ╚═════╝ ╚═╝  ╚═══╝╚══════╝

🟧🟧🟧🟧🟧🟧🟧🟧🟧🟧🟧🟧🟧🟧🟧


> A lightweight, privacy-preserving browser agent that understands and operates web pages while keeping sensitive user information on the user's device.

Cyclops is a Chrome/Firefox browser extension designed around the SIH problem statement **“On-device Visual Perception for Light-weight Browser Agents.”**

The central design principle is:

> **The browser extension is trusted with the user's private data; the remote AI is not.**

Cyclops combines local webpage understanding, local sensitive-data detection and redaction, optional local vision, server-side LLM/VLM reasoning, and local browser action execution.

---

## Table of Contents

- [Overview](#overview)
- [Problem We Are Solving](#problem-we-are-solving)
- [Core Principle](#core-principle)
- [How Cyclops Works](#how-cyclops-works)
- [Architecture](#architecture)
- [Major Components](#major-components)
- [User Experience](#user-experience)
- [Local Privacy Boundary](#local-privacy-boundary)
- [DOM-First, Vision-Assisted Perception](#dom-first-vision-assisted-perception)
- [Local Vision](#local-vision)
- [Server-Side AI](#server-side-ai)
- [LLM/VLM Provider Selection](#llmvlm-provider-selection)
- [Tool / Action System](#tool--action-system)
- [Local User Profile](#local-user-profile)
- [Agent Loop](#agent-loop)
- [Project Structure](#project-structure)
- [Technology Stack](#technology-stack)
- [Development Setup](#development-setup)
- [Configuration](#configuration)
- [Privacy and Security Rules](#privacy-and-security-rules)
- [Evaluation](#evaluation)
- [Planned Demonstration](#planned-demonstration)
- [Project Scope](#project-scope)
- [Team Ownership](#team-ownership)
- [Current Status](#current-status)
- [Contributing](#contributing)
- [License](#license)

---

## Overview

Cyclops is a privacy-first browser agent for Chrome and Firefox.

A user can give the agent a task through the extension, using either text or voice. Cyclops then understands the current webpage, determines what information is needed, protects sensitive information locally, and sends only sanitized context to the server-side reasoning model.

The server does not directly control the browser.

Instead, the server returns a structured action plan such as:

```json
{
  "actions": [
    {
      "action": "click",
      "target": "submit_button"
    }
  ]
}
```

The browser extension validates the action and executes it locally.

The resulting page state is then observed again and the process can repeat until the task is completed, stopped by the user, or requires confirmation.

---

## Problem We Are Solving

Modern browser agents can automate complex workflows, but sending raw visual or webpage information to a remote AI can expose highly sensitive information.

Examples include:

- Names
- Email addresses
- Phone numbers
- Addresses
- Passwords
- Authentication tokens
- Government IDs
- Financial information
- Private documents
- Faces and other sensitive visual information

Cyclops is designed to bridge the gap between:

1. **Local resources and privacy**
2. **Remote AI reasoning capability**

The lightweight client handles perception and privacy-sensitive processing locally, while the remote AI performs the heavier reasoning over sanitized information.

---

## Core Principle

Cyclops is built around one non-negotiable invariant:

```text
                  TRUST BOUNDARY
                       │
                       ▼
              ┌───────────────────┐
              │ BROWSER EXTENSION │
              │                   │
              │ Raw user data     │
              │ PII               │
              │ Credentials       │
              │ Local documents   │
              │ Raw visual input  │
              │ Local vision      │
              └─────────┬─────────┘
                        │
                   SANITIZATION
                        │
                        ▼
              ┌───────────────────┐
              │      NETWORK      │
              │                   │
              │ Sanitized context │
              │ No raw secrets    │
              └─────────┬─────────┘
                        │
                        ▼
              ┌───────────────────┐
              │    AI SERVER      │
              │                   │
              │ Reasoning only    │
              └───────────────────┘
```

The remote model should never receive unsanitized sensitive information.

This rule applies regardless of whether information originated from:

- The DOM
- A screenshot
- A canvas
- An image
- A PDF
- A scanned document
- Another local visual source

---

## How Cyclops Works

At a high level:

```text
USER
  │
  │ Text / Voice
  ▼
EXTENSION UI
  │
  ▼
PAGE UNDERSTANDING
  │
  ├── DOM sufficient ──────────────┐
  │                                │
  └── DOM insufficient              │
           │                        │
           ▼                        │
      LOCAL VISION                  │
           │                        │
           └──────────┬─────────────┘
                      ▼
              LOCAL PRIVACY
              Detection/Redaction
                      │
                      ▼
              CONTEXT BUILDER
                      │
               SANITIZED ONLY
                      │
                      ▼
                    FASTAPI
                      │
                      ▼
                AGENT PLANNER
                      │
                      ▼
                 SELECTED
                 LLM / VLM
                      │
                      ▼
               STRUCTURED ACTION
                      │
                      ▼
              EXTENSION TOOLS
                      │
                      ▼
                 WEB PAGE
                      │
                      └──────► repeat
```

---

## Architecture

### 1. Extension / UI

The extension is the user's control surface.

It provides:

- Text task input
- Voice input
- Current task/status
- Current action
- Privacy status
- Vision status
- Network status
- Confirmation requests
- Basic settings
- LLM/VLM provider selection

Typical user interaction:

```text
Open webpage
    ↓
Open Cyclops
    ↓
"Fill this application using my information."
    ↓
Cyclops works
    ↓
User sees progress
    ↓
Confirmation before sensitive/destructive action
```

### 2. Page Understanding

Cyclops first tries to understand the webpage through the DOM.

It extracts useful information such as:

- Headings
- Labels
- Text
- Inputs
- Textareas
- Buttons
- Links
- Selects
- Checkboxes
- Radio buttons
- File upload controls
- Form boundaries
- Visibility
- Enabled/disabled state
- Selected/checked state
- Accessible names
- Relevant relationships
- Position/bounding information when needed

The extension should avoid blindly serializing the entire DOM.

The goal is to produce a compact, useful representation of the current page.

### 3. Privacy Engine

The privacy engine runs locally.

It combines semantic and pattern-based signals to identify sensitive information.

Examples:

```text
<input type="password">
autocomplete="email"
autocomplete="tel"
field label = "Phone"
field label = "Address"
```

It may also detect patterns such as:

```text
Email addresses
Phone numbers
Credit-card-like values
Authentication tokens
API keys
Sensitive URLs
```

Detected sensitive values are redacted or replaced with semantic placeholders.

Example:

```text
Original:
Email: anish@example.com

Sanitized:
Email: [REDACTED]
```

The server can understand that an email field exists without receiving the user's actual email address.

### 4. Local Vision

Vision is a fallback/augmentation mechanism rather than the default page-understanding path.

Cyclops uses the DOM first because structured webpage data is usually:

- Faster
- Smaller
- Easier to sanitize
- More structured
- More reliable for ordinary HTML forms

Vision can be invoked when the DOM is insufficient, such as for:

- Canvas applications
- Images
- PDFs
- Scanned documents
- Custom-rendered interfaces
- Visually positioned controls

Raw visual input remains local during processing.

### 5. Context Builder

The context builder combines safe information from:

- DOM extraction
- Page metadata
- Sanitized elements
- Optional local vision results
- User task
- Relevant safe local state

The output is the **sanitized agent context**.

Only that context is eligible for transmission to the backend.

### 6. Agent Planner

The backend planner determines:

1. What the user is trying to accomplish
2. What the current page contains
3. What should happen next
4. Which available tool should be used

The planner should produce machine-readable structured actions rather than arbitrary free-form browser instructions.

### 7. Browser Tool Runtime

The extension exposes a fixed set of browser capabilities.

Core actions include:

```text
click
fill
upload
scroll
navigate
screenshot
wait
press_key
select
```

The remote AI can request only capabilities exposed by the extension.

The extension remains in control of execution.

---

## Major Components

```text
extension/
├── ui/
├── dom/
├── privacy/
├── vision/
├── context/
├── agent/
├── tools/
├── profile/
├── memory/
├── network/
└── background/

server/
├── api/
├── agent/
├── providers/
└── config/

shared/
├── schemas/
└── tools/
```

These are implementation boundaries rather than separate networked services.

---

## User Experience

### Idle

```text
┌──────────────────────────────────┐
│ Cyclops                          │
│                                  │
│ What would you like me to do?    │
│                                  │
│ ┌──────────────────────────────┐ │
│ │ Fill this application...    │ │
│ └──────────────────────────────┘ │
│                                  │
│ 🎤                       Send →  │
│                                  │
│ Privacy: Protected               │
│ Vision: Not required             │
└──────────────────────────────────┘
```

### Working

```text
┌──────────────────────────────────┐
│ Cyclops                          │
│                                  │
│ ● Working                       │
│                                  │
│ Task:                            │
│ Fill this application            │
│                                  │
│ ✓ Page understood                │
│ ✓ Sensitive data protected       │
│ ✓ Personal fields filled         │
│ → Uploading resume               │
│                                  │
│ Privacy: Protected               │
│ Vision: Not required             │
│                                  │
│ [ Stop ]                         │
└──────────────────────────────────┘
```

### Confirmation

For actions such as final submission, deletion, purchases, sending messages, financial transactions, or other important changes:

```text
┌──────────────────────────────────┐
│ Confirmation Required             │
│                                  │
│ The next action will submit      │
│ this application.                │
│                                  │
│ [ Cancel ]          [ Confirm ]  │
└──────────────────────────────────┘
```

---

## Local Privacy Boundary

### Normal form example

Suppose a webpage contains:

```text
Full Name: Anish Achutha
Email: anish@gmail.com
Phone: 9876543210
Address: Bangalore, India
Resume: anish_resume.pdf

[Submit Application]
```

Locally, Cyclops extracts the structure and detects sensitive data.

The server-side context can become:

```text
Job Application

Full Name: [REDACTED]
Email: [REDACTED]
Phone: [REDACTED]
Address: [REDACTED]

Resume: [LOCAL_FILE]

[Submit Application]
```

The remote model can reason about the existence and meaning of these fields without receiving their actual values.

### Local sensitive values

When the AI needs a sensitive value to complete an action, it should reference local data rather than receiving that data itself.

For example:

```json
{
  "action": "fill",
  "target": "email_field",
  "value_source": "local_profile.email"
}
```

The extension resolves the value locally and fills the webpage.

The remote server never needs the actual email address.

The same concept applies to local documents:

```json
{
  "action": "upload",
  "target": "resume_input",
  "file_source": "local_profile.resume"
}
```

---

## DOM-First, Vision-Assisted Perception

Cyclops does not send screenshots by default.

The decision path is:

```text
DOM information
      │
      ▼
Is it sufficient?
   /        \
 YES        NO
  │          │
  │          ▼
  │      Local vision
  │          │
  └────┬─────┘
       ▼
Local sanitization
       │
       ▼
Sanitized context
```

This strategy keeps common tasks lightweight while still allowing Cyclops to handle visual interfaces that cannot be represented adequately through HTML structure alone.

---

## Local Vision

The local vision model runs on the user's machine/browser-side environment.

The project does not require training a vision model from scratch.

The intended direction is to use a lightweight pretrained model with browser-compatible inference technologies such as:

- ONNX Runtime Web
- WebGPU
- WebAssembly
- Hugging Face-compatible model assets where appropriate

The final model choice is an implementation and benchmarking decision.

### Vision flow

```text
RAW SCREENSHOT / VISUAL INPUT
              │
              ▼
        LOCAL VISION
              │
              ▼
      LOCAL SANITIZATION
              │
              ▼
       SANITIZED OUTPUT
              │
              ▼
            SERVER
```

Raw visual input must not be transmitted before sanitization.

---

## Server-Side AI

The heavy reasoning layer runs on the backend.

The backend is responsible for:

- Receiving sanitized context
- Validating the request
- Building the reasoning prompt
- Calling the selected LLM/VLM provider
- Parsing structured output
- Returning an action plan

The backend does not directly operate the user's browser.

### Backend flow

```text
Sanitized Context
      +
User Task
      +
Available Tools
      │
      ▼
FastAPI
      │
      ▼
Agent Planner
      │
      ▼
Selected LLM/VLM
      │
      ▼
Structured Action Plan
      │
      ▼
Extension
```

---

## LLM/VLM Provider Selection

Cyclops is designed to be model-provider agnostic.

The extension can expose a settings interface where the user selects the provider/model used for server-side reasoning.

Potential providers include:

- OpenAI
- Google
- Anthropic
- OpenRouter
- Custom/OpenAI-compatible endpoints

The exact provider list may evolve during implementation.

Conceptually:

```text
Provider:
[ OpenAI ▼ ]

Model:
[ Selected model ▼ ]

Connection:
[ Configured ]
```

The important architectural property is:

> **Changing the reasoning provider must not change the local privacy boundary.**

Regardless of which provider is selected, only sanitized context should cross the network.

Provider credentials should be handled through the backend's secure configuration rather than being casually exposed in client-side code.

---

## Tool / Action System

The server-side model does not receive unrestricted browser control.

Instead, Cyclops exposes a fixed action protocol.

### Core tools

```text
click
fill
upload
scroll
navigate
screenshot
wait
press_key
select
```

### Example: click

```json
{
  "action": "click",
  "target": "submit_button"
}
```

### Example: fill

```json
{
  "action": "fill",
  "target": "email_field",
  "value_source": "local_profile.email"
}
```

### Example: upload

```json
{
  "action": "upload",
  "target": "resume_input",
  "file_source": "local_profile.resume"
}
```

### Example: scroll

```json
{
  "action": "scroll",
  "direction": "down",
  "amount": 600
}
```

### Example: navigate

```json
{
  "action": "navigate",
  "url": "https://example.com"
}
```

### Advice

Not every model response is an executable action.

The agent may instead return advice such as:

```json
{
  "type": "advice",
  "message": "A required document is not available in the local profile."
}
```

---

## Local User Profile

The local profile stores information that Cyclops may need during browser tasks.

Examples:

### Personal information

```text
Name
Email
Phone
Address
```

### Documents

```text
Resume
Certificates
Other user-selected files
```

### Other local references

```text
Common form values
Work information
Education information
User preferences
```

The profile is local and should not be transmitted to the remote reasoning model.

Sensitive credentials require appropriate secure local storage and should not be treated as ordinary plaintext application data.

---

## Agent Loop

Cyclops works as a repeated observe → reason → act cycle.

```text
USER TASK
   │
   ▼
OBSERVE PAGE
   │
   ▼
UNDERSTAND PAGE
   │
   ▼
PROTECT SENSITIVE DATA
   │
   ▼
BUILD SANITIZED CONTEXT
   │
   ▼
SERVER REASONING
   │
   ▼
RECEIVE ACTION
   │
   ▼
VALIDATE ACTION
   │
   ▼
EXECUTE LOCALLY
   │
   ▼
PAGE CHANGES
   │
   └──────────────► OBSERVE AGAIN
```

The loop ends when:

- The task succeeds
- The user stops the agent
- The agent requires user input
- A safety policy requires confirmation
- An unrecoverable error occurs

---

## Project Structure

```text
privacy-browser-agent/
│
├── README.md
├── .gitignore
├── .env.example
├── docker-compose.yml
│
├── extension/
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   ├── manifest.json
│   │
│   └── src/
│       ├── ui/
│       │   ├── App.tsx
│       │   ├── TaskInput.tsx
│       │   ├── VoiceInput.tsx
│       │   ├── AgentStatus.tsx
│       │   ├── Confirmation.tsx
│       │   └── Settings.tsx
│       │
│       ├── dom/
│       │   ├── parser.ts
│       │   ├── extractor.ts
│       │   └── state.ts
│       │
│       ├── privacy/
│       │   ├── detector.ts
│       │   ├── redactor.ts
│       │   └── sanitizer.ts
│       │
│       ├── vision/
│       │   ├── model.ts
│       │   ├── inference.ts
│       │   ├── config.ts
│       │   └── preprocessing.ts
│       │
│       ├── context/
│       │   └── builder.ts
│       │
│       ├── agent/
│       │   ├── agent-loop.ts
│       │   └── task-manager.ts
│       │
│       ├── tools/
│       │   ├── tool-runtime.ts
│       │   ├── click.ts
│       │   ├── fill.ts
│       │   ├── upload.ts
│       │   ├── scroll.ts
│       │   ├── navigate.ts
│       │   ├── select.ts
│       │   ├── keyboard.ts
│       │   ├── wait.ts
│       │   └── screenshot.ts
│       │
│       ├── profile/
│       │   ├── profile.ts
│       │   └── storage.ts
│       │
│       ├── memory/
│       │   ├── task-memory.ts
│       │   └── workflow-memory.ts
│       │
│       ├── network/
│       │   └── api-client.ts
│       │
│       └── background/
│           └── service-worker.ts
│
├── server/
│   ├── requirements.txt
│   ├── pyproject.toml
│   ├── Dockerfile
│   │
│   └── app/
│       ├── main.py
│       │
│       ├── api/
│       │   ├── agent.py
│       │   ├── providers.py
│       │   └── health.py
│       │
│       ├── agent/
│       │   ├── planner.py
│       │   ├── prompt_builder.py
│       │   └── action_parser.py
│       │
│       ├── providers/
│       │   ├── base.py
│       │   ├── registry.py
│       │   ├── openai.py
│       │   ├── google.py
│       │   ├── anthropic.py
│       │   ├── openrouter.py
│       │   └── custom.py
│       │
│       └── config/
│           └── settings.py
│
├── shared/
│   ├── schemas/
│   │   ├── context.json
│   │   ├── action.json
│   │   ├── action-plan.json
│   │   └── response.json
│   │
│   └── tools/
│       └── tool-definitions.json
│
└── evaluation/
    └── README.md
```

---

## Technology Stack

### Browser extension

- Chrome / Firefox WebExtension APIs
- TypeScript
- React
- Vite
- Manifest V3 where supported
- Browser DOM APIs
- MutationObserver

### Local privacy and perception

- TypeScript
- DOM/semantic analysis
- Pattern/regex-based detection
- Local redaction/sanitization
- ONNX Runtime Web
- WebGPU and/or WebAssembly
- Lightweight pretrained vision model

### Backend

- Python
- FastAPI
- Pydantic-oriented request/response validation
- REST/JSON communication

### Server-side AI

Provider-agnostic LLM/VLM integration, potentially including:

- OpenAI
- Google
- Anthropic
- OpenRouter
- Other compatible endpoints

### Shared contracts

- JSON-based schemas
- Versioned client/server protocol
- Shared tool definitions

### Development

- Docker / Docker Compose for the backend environment
- Git / GitHub

---

## Development Setup

The repository is currently organized as a monorepo with separate client, server, shared-contract, and evaluation areas.

### Clone

```bash
git clone <repository-url>
cd privacy-browser-agent
```

### Extension

```bash
cd extension
npm install
```

Build/development commands will be defined in the extension package configuration as implementation progresses.

### Server

```bash
cd server
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Run the FastAPI application according to the server configuration.

### Environment

Copy the example environment file:

```bash
cp .env.example .env
```

Do not commit secrets.

> The exact provider/environment variables will be finalized as the backend provider layer is implemented.

---

## Configuration

Cyclops has two distinct categories of configuration.

### Local/browser configuration

Examples:

- Selected LLM provider/model
- Vision configuration
- User preferences
- Local profile settings

### Backend configuration

Examples:

- Provider credentials
- Backend configuration
- Model-specific settings
- Service endpoints

Provider credentials should not be hard-coded into the extension source.

---

## Privacy and Security Rules

These rules are architectural requirements.

### Rule 1 — Sensitive data stays local

Raw PII, credentials, private documents, and other sensitive information should remain within the trusted client boundary.

### Rule 2 — Sanitization happens before network transmission

The system must sanitize context locally before a request containing page context is sent to the backend.

### Rule 3 — Raw visual input remains local

Screenshots, canvas contents, scanned documents, and similar visual inputs must be processed locally before any relevant information is sent remotely.

### Rule 4 — The server does not directly control the browser

The server returns structured actions.

The extension validates and executes them.

### Rule 5 — Local data references remain local

For example:

```text
local_profile.email
local_profile.resume
```

are resolved by the extension.

### Rule 6 — Sensitive/destructive actions may require confirmation

Examples include:

- Final form submission
- Purchases
- Sending messages or email
- Deleting data
- Financial transactions
- Important account changes

### Rule 7 — Minimize context

The extension should send only the page information that is necessary for the current task.

---

## Evaluation

The project is intended to be evaluated against the SIH problem's major criteria:

| Metric | Weight |
|---|---:|
| Visual context accuracy | 25% |
| Sensitive-data detection precision/recall | 20% |
| Redaction precision | 20% |
| Client resource utilization | 20% |
| End-to-end task latency | 15% |

### Evaluation goals

#### Visual accuracy

Measure whether the system correctly identifies and interprets relevant page elements, especially when visual perception is required.

#### Sensitive-data detection

Measure:

- True positives
- False positives
- False negatives
- Precision
- Recall

#### Redaction precision

Measure whether:

- Sensitive information was successfully removed
- Useful non-sensitive information was preserved
- Over-redaction was minimized

#### Client resource utilization

Measure:

- CPU
- GPU
- RAM
- Extension overhead
- Vision model startup time
- Vision inference time

#### End-to-end latency

Measure:

```text
User command
      ↓
Context extraction
      ↓
Privacy processing
      ↓
Network
      ↓
LLM reasoning
      ↓
Action return
      ↓
Browser execution
```

---

## Planned Demonstration

The primary demonstration should show the complete privacy-preserving workflow rather than only a static redaction screen.

### Example scenario

A user visits a realistic application page and says:

> “Fill this application using my information and submit it.”

Cyclops should demonstrate:

```text
1. User opens webpage
2. User gives task
3. Extension observes webpage
4. DOM is extracted locally
5. Sensitive information is identified locally
6. Sensitive information is sanitized
7. Sanitized context is prepared
8. Sanitized context is sent to the backend
9. Server-side LLM/VLM determines the next action
10. Structured action is returned
11. Extension validates the action
12. Extension executes it locally
13. Page state changes
14. Extension observes the new state
15. The process continues
16. User confirmation is requested where appropriate
17. Task completes
```

### Additional visual demonstration

A canvas/image/PDF-based scenario can demonstrate:

```text
Visual input
    ↓
Local vision
    ↓
Local privacy processing
    ↓
Sanitized visual representation
    ↓
Server-side reasoning
    ↓
Local browser action
```

This demonstrates the project's core distinction between local perception/privacy and remote reasoning.

---

## Project Scope

### We are building

- A browser extension for Chrome/Firefox
- Local webpage understanding
- Local sensitive-data detection
- Local redaction and sanitization
- Lightweight local visual perception
- Sanitized context generation
- Server-side LLM/VLM reasoning
- A structured browser-action protocol
- Local browser action execution
- Local user profile support
- Lightweight task/workflow memory
- Text and optional voice interaction
- Model/provider selection
- End-to-end demonstration
- Evaluation against the SIH criteria

### We are not building

- A new web browser
- A foundation model from scratch
- A VLM from scratch
- A system that continuously sends screenshots to a server
- A huge model running continuously in the browser
- A universal autonomous agent from the beginning
- A system that uploads the user's entire profile to the server
- Permanent storage of every raw screenshot

---

## Team Ownership

The repository is organized so contributors can work on largely independent areas.

| Area | Primary directory |
|---|---|
| GUI / UX | `extension/src/ui` |
| DOM / Page Understanding | `extension/src/dom` |
| Privacy / PII | `extension/src/privacy` |
| Local Vision | `extension/src/vision` |
| Agent Logic | `extension/src/agent` |
| Browser Tools / Execution | `extension/src/tools` |
| Local Profile | `extension/src/profile` |
| Memory | `extension/src/memory` |
| Extension ↔ Backend | `extension/src/network` |
| Backend / API | `server/` |
| LLM/VLM Providers | `server/app/providers` |
| Shared Contracts | `shared/` |
| Evaluation | `evaluation/` |

The shared schemas and tool definitions act as the contract between the extension and backend teams.

---

## Current Status

The repository currently contains the initial project architecture and module boundaries.

Implementation is expected to proceed incrementally.

Recommended order:

```text
1. Shared contracts
2. Basic extension + popup
3. DOM extraction
4. Local privacy detection/redaction
5. Context building
6. FastAPI backend
7. Single LLM provider
8. Structured action protocol
9. Local browser tools
10. End-to-end task loop
11. Local vision
12. Additional providers
13. Voice
14. Evaluation and optimization
```

This order allows the team to reach a working end-to-end prototype early while keeping the privacy boundary central throughout development.

---

## Contributing

Cyclops is designed as a team project.

When contributing:

1. Work primarily inside the directory owned by your feature/team.
2. Do not bypass the local privacy boundary.
3. Keep client/server contracts synchronized through `shared/`.
4. Do not introduce direct server-side browser control.
5. Avoid sending raw PII or unsanitized visual information to external services.
6. Keep changes focused and easy to integrate.
7. Update relevant shared schemas when changing protocol behavior.

Before merging a feature that affects the end-to-end workflow, verify that it does not weaken the privacy invariant.

---

## License

This project is released under the license specified in `LICENSE`.
