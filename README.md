# JARVIS — Personal AI Assistant

A privacy-first personal AI assistant inspired by JARVIS, built with vanilla HTML, CSS and JavaScript.

## Features (Phase 1)
- **Chat** — OpenAI, Google Gemini, or local Ollama support
- **Voice** — Speech-to-text (Web Speech API) + text-to-speech
- **Camera** — Live capture and visual Q&A
- **Memory** — Local, inspectable, deletable conversation memory
- **Token tracking** — Budget enforcement with cost estimates
- **Privacy** — API keys in session only, no telemetry, local-only mode

## Quick Start
1. Open index.html in **Chrome or Edge** (required for Speech APIs)
2. Choose your AI provider on the onboarding screen
3. Paste your API key (stored in session only, never on disk)
4. Or point it at a local [Ollama](https://ollama.ai) instance for 100% free + private use

## File Structure
`
index.html   — UI shell (onboarding, chat, settings, camera modals)
style.css    — Full design system (dark/light/midnight themes)
app.js       — All application logic (AI, voice, camera, memory, tokens)
`

## Supported AI Providers
| Provider | Models | Cost |
|---|---|---|
| OpenAI | gpt-4o-mini, gpt-4o | Pay-per-token |
| Google Gemini | gemini-1.5-flash, gemini-1.5-pro | Pay-per-token |
| Local Ollama | llama3, phi3, mistral, etc. | Free |

## Privacy
- API keys held in sessionStorage only — cleared on tab close
- No analytics, no telemetry, no tracking
- Camera frames only sent to AI when you explicitly click "Ask →"
- All memories stored locally in localStorage

## Roadmap
- Phase 2: Push-to-talk + voice activation
- Phase 3: Live frame analysis + OCR
- Phase 4: Local model manager (Ollama)
- Phase 5: Encrypted memory + biometric auth
- Phase 6: Web search integration
- Phase 7: Full token dashboard + cost controls
- Phase 8: UX polish + security audit

## License
MIT
