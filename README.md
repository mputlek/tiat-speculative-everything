# tiat-speculative-everything

Exhibition materials for a book club project built around Dunne & Raby's
*Speculative Everything*.

## Projects

- **[`funguy-app/`](./funguy-app)** — "Fun-Guy": a multi-sensory
  installation visitors talk to via a Claude-powered chat, visualized as a
  living globe (`/globe`) healing in real time as messages come in. A
  single Next.js app — chat (`app/`) and the globe display
  (`public/globe/`) both deploy together, connected via Ably pub/sub.
  Deployed at `fun-guy.netlify.app`. See its own README for setup.
  (Formerly a two-repo, two-page static setup under `globe-project/` —
  consolidated into this one app once the chat experience replaced the
  simpler placeholder `/message` page.)

A related TouchDesigner + Ableton generative audio-visual piece
(movement-driven ambient soundscape) is a separate project, not tracked in
this repo.
