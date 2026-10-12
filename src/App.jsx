import { useEffect, useMemo, useRef, useState } from 'react'
import Art from './Art.jsx'
import {
  artFor, demoUrl, exportUrl, fileUrl, formatBytes, formatDate, matchesQuery, MAX_IMPORT_BYTES, readStored,
} from './demos.js'
import { parseMarkdown, splitInline } from './markdown.js'
import './App.css'

const currentYear = new Date().getFullYear()
const SITE_TITLE = 'Stacked — Demo catalog'
const SITE_DESCRIPTION = 'Browse, search, export, and import ready-to-run technology demos. Each demo bundles its resources and a manifest in one portable archive.'
const PAGE_SIZE = 9

function Icon({ name, size = 20 }) {
  const paths = {
    search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4.5 4.5" /></>,
    arrow: <path d="M4 12h15m-6-6 6 6-6 6" />,
    moon: <path d="M20 15A9 9 0 0 1 9 4a9 9 0 1 0 11 11Z" />,
    sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    close: <path d="m6 6 12 12M6 18 18 6" />,
    chevron: <path d="m8 10 4 4 4-4" />,
    code: <path d="m8 6-6 6 6 6m8-12 6 6-6 6m-3-16-2 20" />,
    bolt: <path d="m13 2-9 12h7l-1 8 10-13h-7Z" />,
    check: <path d="m5 12 4 4L19 6" />,
    download: <path d="M12 3v12m-5-5 5 5 5-5M4 21h16" />,
    upload: <path d="M12 16V4m-5 5 5-5 5 5M4 21h16" />,
    file: <><path d="M6 2h8l5 5v15H6Z" /><path d="M14 2v5h5" /></>,
  }
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name] || paths.code}</svg>
}

function Logo() {
  return <a className="brand" href="/" aria-label="Stacked demo catalog home"><span className="brand-symbol"><Icon name="code" size={23} /></span>stacked<span className="brand-period">.</span></a>
}

function Inline({ text }) {
  return splitInline(text).map((part, index) => part.code ? <code key={index}>{part.text}</code> : <span key={index}>{part.text}</span>)
}

function Markdown({ source }) {
  return parseMarkdown(source).map((block, index) => {
    if (block.type === 'heading') {
      const Heading = `h${block.level + 1}`
      return <Heading key={index}><Inline text={block.text} /></Heading>
    }
    if (block.type === 'list') {
      const List = block.ordered ? 'ol' : 'ul'
      return <List key={index}>{block.items.map((item, itemIndex) => <li key={itemIndex}><Inline text={item} /></li>)}</List>
    }
    if (block.type === 'code') return <pre key={index}><code>{block.text}</code></pre>
    return <p key={index}><Inline text={block.text} /></p>
  })
}

function DemoMeta({ demo }) {
  return <div className="post-meta demo-meta">{demo.author && <><span className="author-name">{demo.author}</span><span className="meta-dot">·</span></>}<time dateTime={demo.updated}>Updated {formatDate(demo.updated)}</time><span className="meta-dot">·</span><span>{demo.fileCount} file{demo.fileCount === 1 ? '' : 's'} · {formatBytes(demo.size)}</span></div>
}

function Modal({ open, onClose, title, id, children, wide = false }) {
  const ref = useRef(null)
  useEffect(() => {
    const dialog = ref.current
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])
  return <dialog ref={ref} className={`modal ${wide ? 'modal-wide' : ''}`} onCancel={onClose} onClick={(event) => { if (event.target === event.currentTarget) onClose() }} aria-labelledby={id}><div className="modal-heading"><h2 id={id}>{title}</h2><button className="icon-button" onClick={onClose} aria-label="Close dialog"><Icon name="close" /></button></div>{children}</dialog>
}

function App() {
  const params = new URLSearchParams(window.location.search)
  const demoId = (() => {
    const match = window.location.pathname.match(/^\/catalog\/([^/]+)\/?$/)?.[1]
    try { return match ? decodeURIComponent(match) : null } catch { return null }
  })()
  const [demos, setDemos] = useState([])
  const [loading, setLoading] = useState(true)
  const [requiresKey, setRequiresKey] = useState(false)
  const [canImport, setCanImport] = useState(false)
  const [detail, setDetail] = useState(null)
  const [detailState, setDetailState] = useState(demoId ? 'loading' : 'idle')
  const [query, setQuery] = useState('')
  const [tag, setTag] = useState(() => params.get('tag') || '')
  const [sort, setSort] = useState('updated')
  const [limit, setLimit] = useState(PAGE_SIZE)
  const [importing, setImporting] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [about, setAbout] = useState(false)
  const [notice, setNotice] = useState(() => params.get('imported') ? 'Demo imported. It is now part of the catalog.' : '')
  const [formError, setFormError] = useState('')
  const [dark, setDark] = useState(() => readStored('stacked-dark', false) === true)
  const searchRef = useRef(null)
  const formRef = useRef(null)

  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/demos', { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error('Could not load demos')
        return response.json()
      })
      .then((data) => {
        setDemos(data.demos)
        setRequiresKey(data.requiresKey)
        setCanImport(data.canImport)
        setLoading(false)
      })
      .catch((error) => {
        if (error.name !== 'AbortError') {
          setLoading(false)
          setNotice('Could not reach the demo catalog server. Please try again later.')
        }
      })
    return () => controller.abort()
  }, [])

  useEffect(() => {
    if (!demoId) return undefined
    const controller = new AbortController()
    fetch(`/api/demos/${encodeURIComponent(demoId)}`, { signal: controller.signal })
      .then((response) => {
        if (response.status === 404) throw new Error('missing')
        if (!response.ok) throw new Error('unavailable')
        return response.json()
      })
      .then((data) => { setDetail(data); setDetailState('ready') })
      .catch((error) => { if (error.name !== 'AbortError') setDetailState(error.message) })
    return () => controller.abort()
  }, [demoId])

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light'
    try { localStorage.setItem('stacked-dark', JSON.stringify(dark)) } catch { /* Theme still works without storage. */ }
  }, [dark])

  useEffect(() => {
    function handleKey(event) {
      if ((event.ctrlKey || event.metaKey) && event.key === 'k' && !demoId) {
        event.preventDefault()
        searchRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [demoId])

  useEffect(() => {
    const title = detail ? `${detail.title} — Stacked demos` : SITE_TITLE
    document.title = title
    const description = detail?.description || SITE_DESCRIPTION
    for (const selector of ['meta[name="description"]', 'meta[property="og:description"]', 'meta[name="twitter:description"]']) {
      document.querySelector(selector)?.setAttribute('content', description)
    }
    for (const selector of ['meta[property="og:title"]', 'meta[name="twitter:title"]']) {
      document.querySelector(selector)?.setAttribute('content', title)
    }
    document.querySelector('meta[name="keywords"]')?.setAttribute('content', detail ? detail.tags.join(', ') : 'demos, demo catalog, code samples, web development, DevOps')
  }, [detail])

  const tagCounts = useMemo(() => {
    const counts = new Map()
    for (const demo of demos) for (const value of demo.tags) counts.set(value, (counts.get(value) || 0) + 1)
    return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 18)
  }, [demos])

  const recent = useMemo(() => [...demos].sort((a, b) => b.updated.localeCompare(a.updated)).slice(0, 3), [demos])

  const filtered = demos
    .filter((demo) => !tag || demo.tags.some((value) => value.toLowerCase() === tag.toLowerCase()))
    .filter((demo) => matchesQuery(demo, query))
    .sort((a, b) => sort === 'title' ? a.title.localeCompare(b.title) : b.updated.localeCompare(a.updated) || a.title.localeCompare(b.title))

  function chooseTag(value) {
    setTag(tag.toLowerCase() === value.toLowerCase() ? '' : value)
    setLimit(PAGE_SIZE)
    document.getElementById('catalog')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  function openImport() {
    setFormError('')
    setImporting(true)
  }

  async function submitImport(event) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const file = data.get('archive')
    if (!file || !file.size) { setFormError('Choose a .zip archive to import.'); return }
    if (!/\.zip$/i.test(file.name)) { setFormError('Choose a file that ends in .zip.'); return }
    if (file.size > MAX_IMPORT_BYTES) { setFormError('The archive is larger than the 25 MB import limit.'); return }
    setSubmitting(true); setFormError('')
    try {
      const response = await fetch(`/api/demos/import${data.get('replace') ? '?replace=1' : ''}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/zip', ...(requiresKey ? { 'X-Publish-Key': data.get('publishKey') } : {}) },
        body: file,
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result.error || 'The demo could not be imported.')
      formRef.current.reset()
      window.location.assign(`${demoUrl(result.id)}?imported=1`)
    } catch (error) {
      setFormError(error.message)
    } finally {
      setSubmitting(false)
    }
  }

  const importButton = (label, className) => canImport && <button className={className} onClick={openImport}><Icon name="upload" size={16} /><span>{label}</span></button>

  return (
    <>
      <a className="skip-link" href="#main">Skip to content</a>
      <header className="site-header"><div className="header-inner">
        <Logo />
        <nav className="desktop-nav" aria-label="Main navigation"><a className={!demoId ? 'nav-active' : ''} href="/#catalog">Catalog</a><a href="/#tags">Tags</a><button onClick={() => setAbout(true)}>About</button></nav>
        <div className="header-actions"><button className="icon-button theme-toggle" onClick={() => setDark(!dark)} aria-label={`Switch to ${dark ? 'light' : 'dark'} theme`}><Icon name={dark ? 'sun' : 'moon'} size={19} /></button><span className="header-divider" />{importButton('Import demo', 'primary-button write-button')}</div>
      </div></header>

      <main id="main" className="page-shell">
        {demoId ? detail ? (
          <article className="article-page">
            <a className="back-link" href="/#catalog">← Back to all demos</a>
            <div className="article-heading"><span className="category-label">Demo</span><h1>{detail.title}</h1><p>{detail.description}</p><DemoMeta demo={detail} /><div className="article-tags">{detail.tags.map((value) => <a href={`/?tag=${encodeURIComponent(value)}#catalog`} className="tag" key={value}>#{value}</a>)}</div>
              <div className="demo-actions"><a className="primary-button" href={exportUrl(detail.id)} download={`${detail.id}.zip`}><Icon name="download" size={16} />Export demo (.zip)</a>{detail.readOnly && <span className="field-hint">Built-in demo</span>}</div>
            </div>
            <Art kind={artFor(detail.tags)} large />
            <div className="article-body">
              {detail.readme ? <Markdown source={detail.readme.text} /> : <p>This demo has no README.</p>}
              {detail.readme?.truncated && <p className="field-hint">The README is long; download it to read the rest.</p>}
              <section className="file-section" aria-labelledby="files-heading">
                <h2 id="files-heading">Files in this demo</h2>
                <ul className="file-list">{detail.files.map((file) => <li key={file.path}><Icon name="file" size={16} /><span className="file-path">{file.path}</span><span className="file-size">{formatBytes(file.size)}</span><a href={fileUrl(detail.id, file.path)} download aria-label={`Download ${file.path}`}><Icon name="download" size={15} /></a></li>)}</ul>
              </section>
            </div>
          </article>
        ) : <div className="empty-state"><Icon name="search" size={32} /><h1>{detailState === 'loading' ? 'Loading demo…' : detailState === 'missing' ? 'Demo not found' : 'Demo unavailable'}</h1><p>{detailState === 'loading' ? 'Just a moment.' : detailState === 'missing' ? 'This link may be incorrect, or the demo was removed.' : 'The server could not be reached. Please try again later.'}</p><a className="primary-button" href="/">Browse demos</a></div> : (
          <>
            <section className="intro"><div className="eyebrow"><span className="green-dot" /> A CATALOG OF READY-TO-RUN DEMOS</div><h1>Demos you can <span>take with you</span><span className="title-dot">.</span></h1><p>Search by topic or tag, export any demo as a .zip,<br className="mobile-break" /> and import your own to share it with everyone.</p><div className="intro-decoration" aria-hidden="true"><span>{'{'}<span> / </span>{'}'}</span><i /><i /><i /></div></section>
            <div className="content-layout">
              <section id="catalog" className="feed" aria-label="Demos">
                <div className="section-heading"><h2>The catalog<span className="heading-dot" /></h2><span className="section-kicker">{loading ? 'Loading demos…' : `${demos.length} demo${demos.length === 1 ? '' : 's'} ready to explore`}</span></div>
                <div className="search-row"><div className="search-field"><Icon name="search" size={18} /><input ref={searchRef} type="search" aria-label="Search demos" placeholder="Search titles, descriptions, or tags..." value={query} onChange={(event) => { setQuery(event.target.value); setLimit(PAGE_SIZE) }} />{query ? <button className="clear-search" onClick={() => setQuery('')} aria-label="Clear search"><Icon name="close" size={15} /></button> : <kbd>⌘ K</kbd>}</div></div>
                <div className="results-row"><span aria-live="polite">{query || tag ? `${filtered.length} demo${filtered.length === 1 ? '' : 's'}${tag ? ` tagged #${tag}` : ''}` : 'Every demo is one download away.'}{tag && <button className="remove-filter" onClick={() => setTag('')} aria-label="Clear tag filter">×</button>}</span><label className="sort-select">Sort by: <select aria-label="Sort demos" value={sort} onChange={(event) => setSort(event.target.value)}><option value="updated">Recently updated</option><option value="title">Title (A–Z)</option></select><Icon name="chevron" size={13} /></label></div>
                <div className="post-grid">{filtered.slice(0, limit).map((demo) => <article className="post-card" key={demo.id}><div className="card-visual"><a href={demoUrl(demo.id)} tabIndex={-1} aria-hidden="true"><Art kind={artFor(demo.tags)} /></a></div><div className="card-body"><span className="category-label">{demo.tags[0]}</span><a className="card-title" href={demoUrl(demo.id)}><h3>{demo.title}</h3></a><p>{demo.description}</p><div className="card-tags">{demo.tags.map((value) => <button key={value} onClick={() => chooseTag(value)} aria-pressed={tag.toLowerCase() === value.toLowerCase()}>#{value}</button>)}</div><div className="card-footer"><span>{formatDate(demo.updated)} · {demo.fileCount} file{demo.fileCount === 1 ? '' : 's'}</span><a className="export-link" href={exportUrl(demo.id)} download={`${demo.id}.zip`} aria-label={`Export ${demo.title} as a .zip archive`}><Icon name="download" size={14} />Export</a></div></div></article>)}</div>
                {!loading && !filtered.length && <div className="empty-state"><Icon name="search" size={30} /><h3>{demos.length ? 'No demos found' : 'The catalog is empty'}</h3><p>{demos.length ? 'Try another keyword or tag.' : 'Import a demo archive to get started.'}</p>{demos.length ? <button className="secondary-button" onClick={() => { setQuery(''); setTag('') }}>Show all demos</button> : importButton('Import a demo', 'secondary-button')}</div>}
                {filtered.length > limit && <button className="load-more" onClick={() => setLimit(limit + PAGE_SIZE)}>More demos <Icon name="arrow" size={17} /></button>}
              </section>
              <aside className="sidebar">
                <section className="tag-section" id="tags"><div className="sidebar-heading"><span className="tiny-hash">#</span><h2>Browse by tag</h2></div><p>Search tags come from each demo’s manifest.</p><div className="popular-tags">{tagCounts.map(([value, count]) => <button className={`tag ${tag.toLowerCase() === value.toLowerCase() ? 'tag-active' : ''}`} key={value} onClick={() => chooseTag(value)} aria-pressed={tag.toLowerCase() === value.toLowerCase()} aria-label={`${value}, ${count} demo${count === 1 ? '' : 's'}`}><span>#</span>{value}</button>)}</div></section>
                {recent.length > 0 && <section className="trending-section"><div className="sidebar-heading"><Icon name="clock" size={17} /><h2>Recently updated</h2></div><div className="trending-list">{recent.map((demo, index) => <a key={demo.id} href={demoUrl(demo.id)}><span className="trend-number">0{index + 1}</span><div><h3>{demo.title}</h3><span>{formatDate(demo.updated)} <b>·</b> {demo.fileCount} files</span></div><Icon name="arrow" size={15} /></a>)}</div></section>}
                {canImport && <section className="contribute-card"><span className="contribute-icon"><Icon name="upload" size={27} /></span><span className="contribute-eyebrow">SHARE YOUR WORK</span><h2>Built a demo?<br />Add it to the catalog.</h2><p>Zip your demo folder with a<br />demo.json manifest and import it.<br />Everyone can export it from here.</p><button onClick={openImport}>Import a demo <Icon name="arrow" size={17} /></button><span className="contribute-note">See the user guide for the archive format.</span></section>}
                <div className="sidebar-foot"><span className="green-dot" /> Portable. Searchable. Ready to run.</div>
              </aside>
            </div>
          </>
        )}
        {notice && <div className="notice" role="status"><Icon name="check" size={18} /><span>{notice}</span><button className="icon-button" aria-label="Dismiss message" onClick={() => setNotice('')}><Icon name="close" size={16} /></button></div>}
      </main>
      <footer className="site-footer"><div className="footer-inner"><div><Logo /><p>Demos worth sharing, one archive at a time.</p></div><div className="footer-links"><a href="/#catalog">Catalog</a><a href="/#tags">Tags</a><button onClick={() => setAbout(true)}>About Stacked</button></div><span className="copyright">© {currentYear} Stacked. Keep building.</span></div></footer>

      <Modal open={importing} onClose={() => setImporting(false)} title="Import a demo." id="import-title" wide>
        <p className="modal-intro">Upload a .zip archive that contains a demo.json manifest and the demo’s files.</p>
        <div className="local-note"><Icon name="file" size={17} /><span>The manifest needs a title, description, and search tags. Archives exported from this catalog are ready to import.</span></div>
        <form ref={formRef} onSubmit={submitImport} className="publish-form">
          <label>Demo archive <span className="field-hint">.zip · up to 25 MB</span><input name="archive" type="file" accept=".zip,application/zip,application/x-zip-compressed" required /></label>
          <label className="checkbox-label"><input name="replace" type="checkbox" value="1" />Replace an existing demo with the same ID</label>
          {requiresKey && <label>Publishing key <span className="field-hint">Ask the catalog owner for access</span><input name="publishKey" type="password" required autoComplete="off" placeholder="Enter your publishing key" /></label>}
          {formError && <p className="form-error" role="alert">{formError}</p>}
          <div className="form-actions"><button className="secondary-button" type="button" onClick={() => setImporting(false)}>Cancel</button><button className="primary-button" type="submit" disabled={submitting}>{submitting ? 'Importing…' : 'Import demo'} <Icon name="upload" size={16} /></button></div>
        </form>
      </Modal>
      <Modal open={about} onClose={() => setAbout(false)} title="A catalog of portable demos." id="about-title">
        <p className="modal-intro">Stacked collects ready-to-run technology demos in one searchable place.</p><div className="about-copy"><p>Each demo lives in its own folder with a demo.json manifest that provides its title, description, and search tags. Export any demo as a .zip archive to run it anywhere, or import an archive to add a demo to the catalog.</p><p>Resource files always download rather than run in the browser. Your theme preference stays in this browser.</p></div>{canImport ? <button className="primary-button" onClick={() => { setAbout(false); openImport() }}>Import a demo <Icon name="arrow" size={16} /></button> : <a className="primary-button" href="/#catalog" onClick={() => setAbout(false)}>Browse demos <Icon name="arrow" size={16} /></a>}
      </Modal>
    </>
  )
}

export default App
