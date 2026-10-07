export const topics = ['All posts', 'Development', 'AI & ML', 'Cloud & DevOps', 'Design', 'Cybersecurity']

export const seedPosts = [
  {
    id: 'the-future-of-web-development',
    title: 'The future of web development is already here',
    excerpt: 'From server components to edge computing, explore the technologies reshaping how we build for the web.',
    category: 'Development', tags: ['Web Development', 'React', 'Next.js'],
    author: 'Alex Morgan', initials: 'AM', date: '2026-10-06', minutes: 8, art: 'feature',
    body: `The web never stands still. But the most interesting changes today are not about a new framework every week. They are about putting the right work in the right place — and making the result feel effortless to the people using it.

## The server is part of the interface
Server-rendered components can keep data access and expensive processing close to their source. The browser receives the interface instead of all the code required to produce it. That can mean smaller bundles and faster first loads, especially on slower devices.

Interactive components still belong on the client. The practical question is not “server or client?” but “what actually needs to be interactive?” Start there, then move the rest toward the server when your framework supports it.

## Closer to the user
Edge computing places selected workloads nearer to visitors. It is useful for lightweight request handling, regional personalization, and caching. It is not a replacement for every database or backend: consistency, runtime limitations, and observability still matter.

## Better foundations, better experiences
Modern CSS gives us container queries, grid, and powerful layout primitives. Browser APIs are also getting more capable. Before adding a library, check whether the platform can solve your problem.

## What to try next
Measure your current page load. Identify a heavy client component that does not need interactivity. Make one small change, then measure again. The future of the web is less about chasing every trend and more about building fast, accessible experiences that work for everyone.`,
  },
  {
    id: 'react-server-components-explained', title: 'React Server Components, explained simply',
    excerpt: 'Less JavaScript. Faster pages. A practical guide to the new mental model for building with React.',
    category: 'Development', tags: ['React', 'JavaScript'], author: 'Sarah Chen', initials: 'SC', date: '2026-10-05', minutes: 6, art: 'react',
    body: `Server Components let you render parts of a React application on the server without shipping those components' JavaScript to the browser. They are a framework capability, not something you switch on in a client-only Vite application.

## Where the boundary lives
Use a Server Component for reading server-side data and rendering non-interactive content. Use a Client Component when you need state, effects, or browser APIs. A small interactive button can sit inside a larger server-rendered page.

## Keep secrets on the server
Server-only credentials must never be passed into client props. Anything sent to the browser is visible to the user. Treat serialized data as a public boundary and return only the fields the interface needs.

## Start small
Choose a framework that supports Server Components, build a simple data-backed page, and inspect the network payload. Compare the client bundle with your previous approach rather than assuming every server-rendered page will automatically be faster.`,
  },
  {
    id: 'local-ai-models', title: 'Small models. Big possibilities.',
    excerpt: 'Why running AI locally could be the next big shift — and how to get started on your own machine.',
    category: 'AI & ML', tags: ['AI', 'Open Source'], author: 'David Park', initials: 'DP', date: '2026-10-04', minutes: 7, art: 'ai',
    body: `Local language models make it possible to experiment without sending every prompt to a remote service. For prototypes, offline tools, and sensitive workflows, that can be a useful trade-off.

## Match the model to the machine
Model size, quantization, and context length all affect memory use. Start with a small model that fits your available memory. A smaller model responding reliably is more useful than a larger one that exhausts your device.

## Privacy is a process
Local inference does not guarantee privacy on its own. Check whether your runtime sends telemetry, where prompts and logs are stored, and how downloaded models are verified.

## Evaluate before you ship
Create a set of realistic questions and score the responses for correctness. Keep a human review step for high-impact decisions. Models can sound confident even when they are wrong.`,
  },
  {
    id: 'docker-without-the-headache', title: 'Docker, without the headache',
    excerpt: 'A developer-friendly introduction to containers that actually makes sense. Ship with confidence.',
    category: 'Cloud & DevOps', tags: ['Docker', 'DevOps'], author: 'Alex Morgan', initials: 'AM', date: '2026-10-03', minutes: 9, art: 'docker',
    body: `A container packages an application with the files and libraries it needs to run. It shares the host kernel, making it lighter than a full virtual machine while still providing an isolated process environment.

## Make builds predictable
Use a small, maintained base image. Copy your dependency manifest first so dependency layers can be cached. Pin versions and rebuild regularly to pick up security fixes.

## Keep credentials out
Never copy secret files into an image. Exclude local environment files with a dockerignore and inject secrets at runtime through your deployment platform.

## Build for production
Run as a non-root user where possible, configure health checks, and send logs to standard output. Containers simplify packaging, but production still needs monitoring, backups, and a plan for failures.`,
  },
  {
    id: 'javascript-patterns', title: '5 JavaScript patterns worth knowing',
    excerpt: 'Write cleaner, more maintainable code with patterns you can put to work in your next project.',
    category: 'Development', tags: ['JavaScript', 'Best Practices'], author: 'Sarah Chen', initials: 'SC', date: '2026-10-02', minutes: 5, art: 'javascript',
    body: `Good patterns help you express intent. They should make code easier to understand, not turn a simple function into a framework.

## 1. Guard clauses
Return early for invalid input. Keeping the main path free from deeply nested conditions makes a function easier to read.

## 2. Small pure functions
Separate transformations from side effects. A function that depends only on its inputs is easier to test and reuse.

## 3. Explicit state
Use clear state names rather than collections of loosely related booleans. Loading, success, and error are often better represented as a single status.

## 4. Composition
Combine small pieces with well-defined responsibilities instead of building a large inheritance hierarchy.

## 5. Structured error handling
Catch errors at a boundary where you can do something useful: retry, show a message, or record context. Do not silently swallow failures.`,
  },
  {
    id: 'designing-with-css', title: 'A little CSS. A lot of possibility.',
    excerpt: 'Container queries, modern layouts, and the CSS features that deserve a spot in your toolkit.',
    category: 'Design', tags: ['CSS', 'UI/UX'], author: 'Maya Patel', initials: 'MP', date: '2026-10-01', minutes: 6, art: 'css',
    body: `The most resilient interfaces begin with good document structure. CSS can then adapt that structure to the space available, without making every layout decision in JavaScript.

## Design around the component
Container queries let a component respond to its own available width. This is useful when the same card appears in a sidebar, a grid, and a full-width layout.

## Let layout do the work
Use Grid for two-dimensional layouts and Flexbox for one-dimensional alignment. Prefer flexible tracks and natural wrapping over rigid pixel widths.

## Accessibility is part of polish
Keep focus indicators visible, respect reduced-motion preferences, and check contrast in every theme. A beautiful interface must remain usable with a keyboard and at high zoom.`,
  },
  {
    id: 'secure-by-default', title: 'Build secure. Not just secure-looking.',
    excerpt: 'The everyday security habits that make a real difference to your web applications.',
    category: 'Cybersecurity', tags: ['Security', 'Web Development'], author: 'David Park', initials: 'DP', date: '2026-09-30', minutes: 8, art: 'security',
    body: `Security works best when it is a default, not a final checklist. Small decisions about input, permissions, and dependencies can prevent entire classes of problems.

## Treat input as untrusted
Validate data at the server boundary. Render user content as text unless you have a deliberate, well-tested sanitization strategy. Client-side validation helps users, but it is not a security boundary.

## Minimize access
Give services only the permissions they require. Use secure, HTTP-only cookies for sessions where appropriate and protect state-changing requests against cross-site request forgery.

## Stay current
Review dependency advisories, update maintained packages, and avoid keeping unused libraries around. Record your deployment configuration so security controls are repeatable.`,
  },
  {
    id: 'accessible-interfaces', title: 'Accessibility is good engineering',
    excerpt: 'Simple, thoughtful decisions that make the web better for everyone.',
    category: 'Design', tags: ['UI/UX', 'Best Practices'], author: 'Maya Patel', initials: 'MP', date: '2026-09-28', minutes: 5, art: 'css',
    body: `Accessible interfaces are clearer, more robust interfaces. Start with semantic HTML and let the browser provide familiar behavior.

## Use the right element
Use buttons for actions and links for navigation. Associate labels with inputs and give icon-only buttons an accessible name.

## Try the keyboard
Move through the page without a mouse. Check that focus order matches the visual order and that dialogs return focus to their trigger.

## Give useful feedback
Explain errors near the relevant field. Announce important status changes without interrupting every interaction. Test at narrow widths and with enlarged text.`,
  },
  {
    id: 'a-better-developer-workflow', title: 'Make room for deep work',
    excerpt: 'A practical developer workflow for fewer distractions and more meaningful progress.',
    category: 'Cloud & DevOps', tags: ['DevOps', 'Best Practices'], author: 'Alex Morgan', initials: 'AM', date: '2026-09-26', minutes: 4, art: 'docker',
    body: `A productive workflow is not the one with the most tools. It is the one that makes it easy to understand the next step and get useful feedback.

## Shorten the feedback loop
Run focused checks while you work. Keep builds reproducible and document the few commands a contributor actually needs.

## Make changes easy to review
Prefer small, coherent changes with a clear explanation. A review should reveal intent, not require the reviewer to reconstruct it.

## Protect attention
Group routine tasks, write down open questions, and leave yourself a clear next step. Consistent progress matters more than constant activity.`,
  },
]

export function articleUrl(post) {
  return `/articles/${encodeURIComponent(post.id)}/`
}

export function formatDate(date) {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC',
  })
}

export function readStored(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback
  } catch {
    return fallback
  }
}

export function isValidPost(post) {
  return post && typeof post.id === 'string' && /^post-[a-z0-9-]+$/.test(post.id)
    && typeof post.title === 'string' && typeof post.excerpt === 'string'
    && typeof post.body === 'string' && typeof post.author === 'string'
    && typeof post.initials === 'string' && typeof post.art === 'string' && topics.slice(1).includes(post.category)
    && Array.isArray(post.tags) && post.tags.every((tag) => typeof tag === 'string')
    && /^\d{4}-\d{2}-\d{2}$/.test(post.date) && Number.isFinite(post.minutes)
}

export function validateInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null
  const fields = { title: 120, author: 60, excerpt: 240, body: 50000 }
  const value = {}
  for (const [key, max] of Object.entries(fields)) {
    if (typeof input[key] !== 'string' || !input[key].trim() || input[key].trim().length > max) return null
    value[key] = input[key].trim()
  }
  if (!topics.slice(1).includes(input.category) || !Array.isArray(input.tags) || input.tags.length > 5) return null
  if (input.tags.some((tag) => typeof tag !== 'string' || !tag.trim() || tag.trim().length > 30)) return null
  value.tags = [...new Set(input.tags.map((tag) => tag.trim()))]
  if (!value.tags.length) return null
  return { ...value, category: input.category }
}
