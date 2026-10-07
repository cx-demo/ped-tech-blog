import { useEffect, useRef, useState } from 'react'
import Art from './Art.jsx'
import { articleUrl, formatDate, readStored, seedPosts, topics } from './posts.js'
import './App.css'

const currentYear = new Date().getFullYear()

function Icon({ name, size = 20 }) {
  const paths = {
    search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4.5 4.5" /></>,
    arrow: <path d="M4 12h15m-6-6 6 6-6 6" />,
    bookmark: <path d="M6 4h12v17l-6-4-6 4Z" />,
    edit: <><path d="m16 3 5 5-12 12-6 1 1-6Z" /><path d="m13 6 5 5" /></>,
    moon: <path d="M20 15A9 9 0 0 1 9 4a9 9 0 1 0 11 11Z" />,
    sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    close: <path d="m6 6 12 12M6 18 18 6" />,
    chevron: <path d="m8 10 4 4 4-4" />,
    code: <path d="m8 6-6 6 6 6m8-12 6 6-6 6m-3-16-2 20" />,
    bolt: <path d="m13 2-9 12h7l-1 8 10-13h-7Z" />,
    check: <path d="m5 12 4 4L19 6" />,
  }
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name] || paths.code}</svg>
}

function Logo() {
  return <a className="brand" href="/" aria-label="Stacked home"><span className="brand-symbol"><Icon name="code" size={23} /></span>stacked<span className="brand-period">.</span></a>
}

function PostMeta({ post }) {
  return <div className="post-meta"><span className={`avatar avatar-${post.initials.toLowerCase()}`}>{post.initials}</span><span className="author-name">{post.author}</span><span className="meta-dot">·</span><time dateTime={post.date}>{formatDate(post.date)}</time><span className="read-time"><Icon name="clock" size={13} />{post.minutes} min read</span></div>
}

function ArticleBody({ body }) {
  return body.split(/\n\n+/).map((block, index) => {
    if (!block.startsWith('## ')) return <p key={index}>{block}</p>
    const [heading, ...lines] = block.split('\n')
    return <section key={index}><h2>{heading.slice(3)}</h2>{lines.length > 0 && <p>{lines.join('\n')}</p>}</section>
  })
}

function Modal({ open, onClose, title, children, wide = false }) {
  const ref = useRef(null)
  useEffect(() => {
    const dialog = ref.current
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])
  return <dialog ref={ref} className={`modal ${wide ? 'modal-wide' : ''}`} onCancel={onClose} onClick={(event) => { if (event.target === event.currentTarget) onClose() }} aria-labelledby={wide ? 'write-title' : 'about-title'}><div className="modal-heading"><h2 id={wide ? 'write-title' : 'about-title'}>{title}</h2><button className="icon-button" onClick={onClose} aria-label="Close dialog"><Icon name="close" /></button></div>{children}</dialog>
}

function App() {
  const [posts, setPosts] = useState(seedPosts)
  const [loading, setLoading] = useState(true)
  const [publishing, setPublishing] = useState(false)
  const [requiresKey, setRequiresKey] = useState(false)
  const [saved, setSaved] = useState(() => {
    const stored = readStored('stacked-saved', [])
    return Array.isArray(stored) ? stored.filter((id) => typeof id === 'string') : []
  })
  const [query, setQuery] = useState('')
  const [topic, setTopic] = useState('All posts')
  const [tag, setTag] = useState(() => new URLSearchParams(window.location.search).get('tag') || '')
  const [sort, setSort] = useState('latest')
  const [limit, setLimit] = useState(6)
  const [savedOnly, setSavedOnly] = useState(false)
  const [writing, setWriting] = useState(false)
  const [about, setAbout] = useState(false)
  const [notice, setNotice] = useState('')
  const [formError, setFormError] = useState('')
  const [dark, setDark] = useState(() => readStored('stacked-dark', false) === true)
  const searchRef = useRef(null)
  const formRef = useRef(null)
  const articleId = new URLSearchParams(window.location.search).get('post')
    || window.location.pathname.match(/^\/articles\/([^/]+)\/?$/)?.[1]
  const article = posts.find((post) => post.id === articleId)
  const featured = seedPosts[0]

  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/posts', { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error('Could not load articles')
        return response.json()
      })
      .then((data) => {
        setPosts(data.posts)
        setRequiresKey(data.requiresKey)
        setLoading(false)
      })
      .catch((error) => {
        if (error.name !== 'AbortError') {
          setLoading(false)
          setNotice('Could not reach the blog server. Included articles are still available; please try again later.')
        }
      })
    return () => controller.abort()
  }, [])

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light'
    try { localStorage.setItem('stacked-dark', JSON.stringify(dark)) } catch { /* Theme still works without storage. */ }
  }, [dark])

  useEffect(() => {
    function handleKey(event) {
      if ((event.ctrlKey || event.metaKey) && event.key === 'k' && !articleId) {
        event.preventDefault()
        searchRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [articleId])

  useEffect(() => {
    const title = article ? `${article.title} — Stacked` : 'Stacked — Ideas for a better-built web'
    document.title = title
    const description = article?.excerpt || 'Fresh perspectives on web development, AI, design, and the tools that move technology forward. Read, learn, and share your next idea.'
    for (const selector of ['meta[name="description"]', 'meta[property="og:description"]', 'meta[name="twitter:description"]']) {
      document.querySelector(selector)?.setAttribute('content', description)
    }
    for (const selector of ['meta[property="og:title"]', 'meta[name="twitter:title"]']) {
      document.querySelector(selector)?.setAttribute('content', title)
    }
    document.querySelector('meta[name="keywords"]')?.setAttribute('content', article ? article.tags.join(', ') : 'web development, technology, React, AI, CSS, DevOps')
  }, [article])

  function toggleSave(id) {
    const next = saved.includes(id) ? saved.filter((value) => value !== id) : [...saved, id]
    try {
      localStorage.setItem('stacked-saved', JSON.stringify(next))
      setSaved(next)
    } catch {
      setNotice('Your browser could not save this bookmark. Please enable local storage.')
    }
  }

  function chooseTopic(value) {
    setTopic(value); setTag(''); setLimit(6)
  }

  function chooseTag(value) {
    setTag(tag === value ? '' : value); setTopic('All posts'); setLimit(6)
    document.getElementById('latest')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  async function publish(event) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const title = data.get('title').trim()
    const author = data.get('author').trim()
    const body = data.get('body').trim()
    const excerpt = data.get('excerpt').trim()
    const tags = [...new Set(data.get('tags').split(',').map((value) => value.trim()).filter(Boolean))]
    if (!title || !author || !body || !excerpt || !tags.length) {
      setFormError('Please complete all fields and add at least one tag.'); return
    }
    if (tags.length > 5 || tags.some((value) => value.length > 30)) {
      setFormError('Use up to 5 tags, each no longer than 30 characters.'); return
    }
    setPublishing(true); setFormError('')
    try {
      const response = await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(requiresKey ? { 'X-Publish-Key': data.get('publishKey') } : {}) },
        body: JSON.stringify({ title, author, body, excerpt, tags, category: data.get('category') }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Could not publish your article.')
      setPosts((current) => [result, ...current])
      setWriting(false); setFormError(''); formRef.current.reset()
      setQuery(''); setTopic('All posts'); setTag(''); setSavedOnly(false); setSort('latest'); setLimit(6)
      setNotice('Your article is published. Nice work!')
      if (articleId) window.location.assign(articleUrl(result))
    } catch (error) {
      setFormError(`${error.message} Your draft is still here.`)
    } finally {
      setPublishing(false)
    }
  }

  const filtered = posts.filter((post) => post.id !== featured.id || query || tag || topic !== 'All posts' || savedOnly)
    .filter((post) => topic === 'All posts' || post.category === topic)
    .filter((post) => !tag || post.tags.includes(tag))
    .filter((post) => !savedOnly || saved.includes(post.id))
    .filter((post) => `${post.title} ${post.excerpt} ${post.body} ${post.tags.join(' ')} ${post.author}`.toLowerCase().includes(query.toLowerCase().trim()))
    .sort((a, b) => sort === 'latest' ? b.date.localeCompare(a.date) : b.minutes - a.minutes)
  const popularTags = ['JavaScript', 'React', 'AI', 'Web Development', 'CSS', 'DevOps', 'Open Source', 'UI/UX', 'Next.js', 'Docker', 'Security', 'Best Practices']

  return (
    <>
      <a className="skip-link" href="#main">Skip to content</a>
      <header className="site-header"><div className="header-inner">
        <Logo />
        <nav className="desktop-nav" aria-label="Main navigation"><a className={!articleId ? 'nav-active' : ''} href="/#latest">Explore</a><a href="/#topics">Topics</a><button onClick={() => setAbout(true)}>About</button></nav>
        <div className="header-actions"><button className="icon-button theme-toggle" onClick={() => setDark(!dark)} aria-label={`Switch to ${dark ? 'light' : 'dark'} theme`}><Icon name={dark ? 'sun' : 'moon'} size={19} /></button><span className="header-divider" /><button className="primary-button write-button" onClick={() => { setFormError(''); setWriting(true) }}><Icon name="edit" size={16} /><span>Write a post</span></button></div>
      </div></header>

      <main id="main" className="page-shell">
        {articleId ? article ? (
          <article className="article-page">
            <a className="back-link" href="/#latest">← Back to all articles</a>
            <div className="article-heading"><span className="category-label">{article.category}</span><h1>{article.title}</h1><p>{article.excerpt}</p><PostMeta post={article} /><div className="article-tags">{article.tags.map((value) => <a href={`/?tag=${encodeURIComponent(value)}#latest`} className="tag" key={value}>#{value}</a>)}</div></div>
            <Art kind={article.art} large />
            <div className="article-body"><ArticleBody body={article.body} /></div>
            <div className="article-end"><span>Keep a good idea close.</span><button className="secondary-button" onClick={() => toggleSave(article.id)}><Icon name="bookmark" size={16} />{saved.includes(article.id) ? 'Saved to reading list' : 'Save this article'}</button></div>
          </article>
        ) : <div className="empty-state"><Icon name="search" size={32} /><h1>{loading ? 'Loading your next good read…' : 'Article not found'}</h1><p>{loading ? 'Just a moment.' : 'This link may be incorrect or the server may be unavailable.'}</p><a className="primary-button" href="/">Explore articles</a></div> : (
          <>
            <section className="intro"><div className="eyebrow"><span className="green-dot" /> A SPACE FOR CURIOUS MINDS</div><h1>Ideas for a <span>better-built</span> web<span className="title-dot">.</span></h1><p>Fresh perspectives, practical guides, and a little inspiration.<br className="mobile-break" /> For the people who never stop building.</p><div className="intro-decoration" aria-hidden="true"><span>{'{'}<span> / </span>{'}'}</span><i /><i /><i /></div></section>
            <section className="featured" aria-label="Featured article"><div className="feature-copy"><div className="feature-label"><Icon name="bolt" size={13} /> EDITOR’S PICK <span>·</span> <span className="feature-topic">THE BIG PICTURE</span></div><a href={articleUrl(featured)}><h2>{featured.title}</h2></a><p>{featured.excerpt}</p><div className="feature-meta"><span className="avatar avatar-am">{featured.initials}</span><div><strong>{featured.author}</strong><span>{formatDate(featured.date)} <b>·</b> {featured.minutes} min read</span></div><a className="feature-arrow" href={articleUrl(featured)} aria-label={`Read ${featured.title}`}><Icon name="arrow" size={23} /></a></div></div><a className="feature-visual" href={articleUrl(featured)} aria-label={`Read ${featured.title}`}><Art kind="feature" large /></a></section>
            <div className="content-layout">
              <section id="latest" className="feed" aria-label="Articles">
                <div className="section-heading"><h2>{savedOnly ? 'Your reading list' : 'The latest'}<span className="heading-dot" /></h2><span className="section-kicker">{savedOnly ? `${saved.length} saved for later` : 'Good reads. Fresh ideas.'}</span></div>
                <div className="search-row"><div className="search-field"><Icon name="search" size={18} /><input ref={searchRef} aria-label="Search articles" placeholder="Search articles, topics, or keywords..." value={query} onChange={(event) => { setQuery(event.target.value); setLimit(6) }} />{query ? <button className="clear-search" onClick={() => setQuery('')} aria-label="Clear search"><Icon name="close" size={15} /></button> : <kbd>⌘ K</kbd>}</div><button className={`reading-list-button ${savedOnly ? 'is-active' : ''}`} aria-label="Show saved articles" aria-pressed={savedOnly} onClick={() => { setSavedOnly(!savedOnly); setLimit(6) }}><Icon name="bookmark" size={19} /></button></div>
                <div className="topic-tabs" aria-label="Filter by topic">{topics.map((value) => <button key={value} className={topic === value ? 'selected' : ''} aria-pressed={topic === value} onClick={() => chooseTopic(value)}>{value}</button>)}</div>
                <div className="results-row"><span aria-live="polite">{query || tag || topic !== 'All posts' || savedOnly ? `${filtered.length} article${filtered.length === 1 ? '' : 's'}${tag ? ` tagged #${tag}` : ''}` : 'A little knowledge goes a long way.'}{tag && <button className="remove-filter" onClick={() => setTag('')} aria-label="Clear tag filter">×</button>}</span><label className="sort-select">Sort by: <select aria-label="Sort articles" value={sort} onChange={(event) => setSort(event.target.value)}><option value="latest">Latest</option><option value="longest">Longest read</option></select><Icon name="chevron" size={13} /></label></div>
                <div className="post-grid">{filtered.slice(0, limit).map((post) => <article className="post-card" key={post.id}><div className="card-visual"><a href={articleUrl(post)} tabIndex={-1} aria-hidden="true"><Art kind={post.art} /></a><button className={`bookmark-button ${saved.includes(post.id) ? 'is-saved' : ''}`} onClick={() => toggleSave(post.id)} aria-label={`${saved.includes(post.id) ? 'Unsave' : 'Save'} ${post.title}`} aria-pressed={saved.includes(post.id)}><Icon name="bookmark" size={16} /></button></div><div className="card-body"><span className={`category-label category-${post.category.split(' ')[0].toLowerCase()}`}>{post.category}</span><a className="card-title" href={articleUrl(post)}><h3>{post.title}</h3></a><p>{post.excerpt}</p><div className="card-tags">{post.tags.map((value) => <button key={value} onClick={() => chooseTag(value)}>#{value}</button>)}</div><PostMeta post={post} /></div></article>)}</div>
                {!filtered.length && <div className="empty-state"><Icon name={savedOnly ? 'bookmark' : 'search'} size={30} /><h3>{savedOnly ? 'Your next good read belongs here' : 'No articles found'}</h3><p>{savedOnly ? 'Tap the bookmark on an article to save it for later.' : 'Try another keyword or explore a different topic.'}</p><button className="secondary-button" onClick={() => { setQuery(''); setTag(''); setTopic('All posts'); setSavedOnly(false) }}>Explore all articles</button></div>}
                {filtered.length > limit && <button className="load-more" onClick={() => setLimit(limit + 6)}>More to explore <Icon name="arrow" size={17} /></button>}
                <p className="feed-end"><span /> You’re in good company. Keep exploring. <span /></p>
              </section>
              <aside className="sidebar">
                <section className="tag-section" id="topics"><div className="sidebar-heading"><span className="tiny-hash">#</span><h2>Find your rabbit hole</h2></div><p>A topic for every kind of curious.</p><div className="popular-tags">{popularTags.map((value) => <button className={`tag ${tag === value ? 'tag-active' : ''}`} key={value} onClick={() => chooseTag(value)} aria-pressed={tag === value}><span>#</span>{value}</button>)}</div></section>
                <section className="trending-section"><div className="sidebar-heading"><Icon name="bolt" size={17} /><h2>Worth your attention</h2></div><div className="trending-list">{[seedPosts[1], seedPosts[2], seedPosts[6]].map((post, index) => <a key={post.id} href={articleUrl(post)}><span className="trend-number">0{index + 1}</span><div><h3>{post.title}</h3><span>{post.category} <b>·</b> {post.minutes} min read</span></div><Icon name="arrow" size={15} /></a>)}</div></section>
                <section className="contribute-card"><span className="contribute-icon"><Icon name="code" size={27} /></span><span className="contribute-eyebrow">YOUR PERSPECTIVE MATTERS</span><h2>Got an idea?<br />Give it a home.</h2><p>A lesson learned. A side project.<br />The thing you wish you’d known.<br />Someone’s waiting to read it.</p><button onClick={() => { setFormError(''); setWriting(true) }}>Start writing <Icon name="arrow" size={17} /></button><span className="contribute-note">Made by builders. For builders.</span></section>
                <div className="sidebar-foot"><span className="green-dot" /> Less noise. More signal.</div>
              </aside>
            </div>
          </>
        )}
        {notice && <div className="notice" role="status"><Icon name="check" size={18} /><span>{notice}</span><button className="icon-button" aria-label="Dismiss message" onClick={() => setNotice('')}><Icon name="close" size={16} /></button></div>}
      </main>
      <footer className="site-footer"><div className="footer-inner"><div><Logo /><p>A little perspective for your next big thing.</p></div><div className="footer-links"><a href="/#latest">Explore</a><a href="/#topics">Topics</a><button onClick={() => setAbout(true)}>About Stacked</button></div><span className="copyright">© {currentYear} Stacked. Stay curious.</span></div></footer>

      <Modal open={writing} onClose={() => setWriting(false)} title="Share your next great idea." wide>
        <p className="modal-intro">Good things start with a little perspective. What’s yours?</p>
        <div className="local-note"><Icon name="code" size={17} /><span>Your article will be published on this blog, ready for everyone to discover.</span></div>
        <form ref={formRef} onSubmit={publish} className="publish-form">
          <label>Article title<input name="title" required maxLength={120} placeholder="Give your idea a great headline" /></label>
          <div className="form-columns"><label>Your name<input name="author" required maxLength={60} placeholder="How should we credit you?" /></label><label>Topic<select name="category">{topics.slice(1).map((value) => <option key={value}>{value}</option>)}</select></label></div>
          <label>Short description<textarea name="excerpt" required maxLength={240} rows={2} placeholder="A little preview to draw your readers in..." /></label>
          <label>Tags <span className="field-hint">Comma separated · up to 5</span><input name="tags" required maxLength={160} placeholder="React, JavaScript, Web Development" /></label>
          <label>Your story <span className="field-hint">Use ## for section headings</span><textarea name="body" required maxLength={50000} rows={9} placeholder="Start with what inspired you. Share what you learned." /></label>
          {requiresKey && <label>Publishing key <span className="field-hint">Ask the blog owner for access</span><input name="publishKey" type="password" required autoComplete="off" placeholder="Enter your publishing key" /></label>}
          {formError && <p className="form-error" role="alert">{formError}</p>}
          <div className="form-actions"><button className="secondary-button" type="button" onClick={() => setWriting(false)}>Keep editing later</button><button className="primary-button" type="submit" disabled={loading || publishing}>{publishing ? 'Publishing…' : loading ? 'Connecting…' : 'Publish post'} <Icon name="arrow" size={16} /></button></div>
        </form>
      </Modal>
      <Modal open={about} onClose={() => setAbout(false)} title="For the endlessly curious.">
        <p className="modal-intro">Stacked is a little corner of the web for people who love to build.</p><div className="about-copy"><p>Explore practical perspectives on development, design, AI, cloud tools, and security. Find your next rabbit hole, save a good read, or share a lesson of your own.</p><p>Powered by Express. Published articles are shared across the blog, with readable pages and search-friendly tags. Your bookmarks and theme preference stay in this browser.</p></div><button className="primary-button" onClick={() => { setAbout(false); setWriting(true) }}>Share your perspective <Icon name="arrow" size={16} /></button>
      </Modal>
    </>
  )
}

export default App
