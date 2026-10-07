export default function Art({ kind, large = false }) {
  return (
    <div className={`art art-${kind}${large ? ' art-large' : ''}`} aria-hidden="true">
      <div className="art-grid" />
      {kind === 'feature' ? (
        <>
          <div className="floating-label label-top"><span className="green-dot" /> THE NEXT CHAPTER OF THE WEB</div>
          <div className="code-window">
            <div className="window-bar"><i /><i /><i /><span>future.tsx</span><span className="window-code">‹/›</span></div>
            <div className="code-lines">
              <div><em>1</em><span className="code-purple">import</span> {'{'} future {'}'} <span className="code-purple">from</span> <span className="code-green">'the-web'</span>;</div>
              <div><em>2</em></div>
              <div><em>3</em><span className="code-purple">export default function</span> <span className="code-yellow">NextChapter</span>() {'{'}</div>
              <div><em>4</em>  <span className="code-purple">return</span> (</div>
              <div><em>5</em>    &lt;<span className="code-green">Web</span></div>
              <div><em>6</em>      faster={'{'}<span className="code-yellow">true</span>{'}'}</div>
              <div><em>7</em>      smarter={'{'}<span className="code-yellow">true</span>{'}'}</div>
              <div><em>8</em>      possibilities=<span className="code-green">"endless"</span></div>
              <div><em>9</em>    /&gt;</div>
              <div><em>10</em>  );</div>
              <div><em>11</em>{'}'}</div>
            </div>
          </div>
          <div className="floating-label label-bottom"><span>✧</span> Built for what’s next.</div>
          <div className="art-spark spark-one">+</div><div className="art-spark spark-two">+</div>
        </>
      ) : kind === 'react' ? (
        <><svg className="react-atom" viewBox="-110 -100 220 200"><g fill="none" stroke="currentColor" strokeWidth="3"><ellipse rx="93" ry="35" /><ellipse rx="93" ry="35" transform="rotate(60)" /><ellipse rx="93" ry="35" transform="rotate(120)" /></g><circle r="10" fill="currentColor" /></svg><span className="art-caption">RETHINK THE RENDER.</span><span className="art-small-label">React / Server Components</span></>
      ) : kind === 'ai' ? (
        <><div className="ai-orb"><div /><div /><div /></div><span className="ai-symbol">✳</span><span className="art-small-label">Intelligence, closer to home.</span></>
      ) : kind === 'docker' ? (
        <><div className="terminal"><div className="terminal-top"><i /><i /><i /><span>~/your-next-project</span></div><p><span>❯</span> docker compose up</p><p className="terminal-muted">[+] Running 3/3</p><p><b>✓</b> Network created</p><p><b>✓</b> Container started</p><p><b>✓</b> You’re ready to ship<span className="cursor">▌</span></p></div></>
      ) : kind === 'javascript' ? (
        <><div className="js-bracket bracket-left">{'{'}</div><div className="js-logo">JS<span>LESS NOISE. MORE CLARITY.</span></div><div className="js-bracket bracket-right">{'}'}</div><span className="art-small-label">Small patterns. Better code.</span></>
      ) : kind === 'css' ? (
        <><div className="design-panel panel-back"><div className="panel-top" /><div className="design-square" /><div className="design-lines" /></div><div className="design-panel panel-front"><div className="panel-top" /><div className="design-circle" /><div className="design-lines" /></div><span className="css-label">display: possibility;</span></>
      ) : (
        <><svg className="shield-art" viewBox="0 0 100 110" fill="none"><path d="M50 8 87 22v32c0 24-20 40-37 48C33 94 13 78 13 54V22Z" stroke="currentColor" strokeWidth="2" /><rect x="33" y="46" width="34" height="29" rx="6" stroke="currentColor" strokeWidth="3" /><path d="M40 46V36a10 10 0 0 1 20 0v10" stroke="currentColor" strokeWidth="3" /><circle cx="50" cy="60" r="3" fill="currentColor" /></svg><span className="art-small-label">Secure by design.</span></>
      )}
    </div>
  )
}
