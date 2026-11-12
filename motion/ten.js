// Motion lab: ten presentations after the DJI Inspire 3 page. The same rules as lab.js: no libraries, native scroll,
// a pinned stage, transforms and opacity. No number is ever shown between two real values of the table.
(() => {
  const T = window.TEN
  const root = document.documentElement
  const reduce = matchMedia('(prefers-reduced-motion: reduce)')
  const params = new URLSearchParams(location.search)
  const state = {
    tempo: Number(params.get('tempo') ?? 1),
    still: params.has('still') ? params.get('still') === '1' : reduce.matches,
  }

  // ── helpers ──
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v))
  const seg = (v, a, b) => clamp((v - a) / (b - a))
  const lerp = (a, b, t) => a + (b - a) * t
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)
  const out = (t) => 1 - (1 - t) ** 3
  const rad = (d) => (d * Math.PI) / 180
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
  const el = (tag, cls, html) => {
    const n = document.createElement(tag)
    if (cls) n.className = cls
    if (html != null) n.innerHTML = html
    return n
  }
  const svgEl = (tag, attrs = {}) => {
    const n = document.createElementNS('http://www.w3.org/2000/svg', tag)
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v)
    return n
  }
  const img = (p, alt = '') => {
    const i = new Image(p.w, p.h)
    i.src = p.src
    i.alt = alt
    i.decoding = 'async'
    i.draggable = false
    i.className = 'pic'
    i.style.width = p.w + 'px'
    i.style.height = p.h + 'px'
    return i
  }
  // The on-screen length that fits a tool into a box, at its own slant turned by `rot`.
  const fitLen = (p, bw, bh, rot = 0) => {
    const a = Math.abs(rad(p.angle + rot)), r = p.thick / p.len
    return Math.min(bw / (Math.abs(Math.cos(a)) + r * Math.abs(Math.sin(a))), bh / (Math.abs(Math.sin(a)) + r * Math.abs(Math.cos(a))))
  }
  // A picture placed by its own axis: its centre at (x, y), its length L, turned by rot.
  const pose = (node, p, x, y, L, rot = 0) => {
    node.style.transform = `translate(${x}px,${y}px) rotate(${rot}deg) scale(${L / p.len}) translate(${-p.cx}px,${-p.cy}px)`
  }
  const show = (node, v) => {
    node.style.opacity = v
    node.style.visibility = v <= 0.001 ? 'hidden' : 'visible'
  }
  // Swaps content whole. A changed figure is replaced, never counted through the numbers between.
  const swapTo = (node, key, html, dir = 1) => {
    if (node.dataset.k === key) return
    const first = node.dataset.k == null
    node.dataset.k = key
    node.innerHTML = html
    if (!first && !state.still) {
      node.animate?.([{ opacity: 0, transform: `translateY(${dir * 0.35}em)` }, { opacity: 1, transform: 'none' }], { duration: 240, easing: 'cubic-bezier(.2,.7,.2,1)' })
    }
  }
  const figsHtml = (figures) =>
    figures.length
      ? `<dl class="figs">${figures.map((f) => `<div class="fig"><dt>${esc(f.label)}</dt><dd>${esc(f.value)}</dd></div>`).join('')}</dl>`
      : ''
  const head = (d, tag = 'h2', lead = true) =>
    `<${tag} class="title">${esc(d.title)}</${tag}>${d.code ? `<p class="code">${esc(d.code)}</p>` : ''}${lead && d.lead ? `<p class="lead">${esc(d.lead)}</p>` : ''}`
  const colName = (c) => `${c.label}${c.unit ? `, ${c.unit}` : ''}`
  const tableHtml = (t) => `<table class="tbl"><thead><tr><th scope="col">Size</th>${t.cols
    .map((c) => `<th scope="col">${esc(colName(c))}</th>`)
    .join('')}</tr></thead><tbody>${t.rows
    .map((r) => `<tr><th scope="row">${esc(r.size)}</th>${t.cols.map((c) => `<td>${esc(r.cells[c.key]?.text ?? '')}</td>`).join('')}</tr>`)
    .join('')}</tbody></table>`
  const rangeOf = (t, key) => {
    const cells = t.rows.map((r) => r.cells[key]).filter((c) => c && c.value != null)
    if (!cells.length) return ''
    const lo = cells.reduce((a, b) => (b.value < a.value ? b : a))
    const hi = cells.reduce((a, b) => (b.value > a.value ? b : a))
    return lo.text === hi.text ? lo.text : `${lo.text} to ${hi.text}`
  }
  const sceneOf = (id) => {
    const scene = document.getElementById(id)
    scene.textContent = ''
    const stage = el('div', 'stage')
    const still = el('div', 'still')
    scene.append(stage, still)
    return { scene, stage, still }
  }
  const noNav = (e) => { if (e.target.closest('a[href="#"]')) e.preventDefault() }
  document.addEventListener('click', noNav)

  // ── 1. The word opens into the tool. ──
  // The deepest point of any stroke, found on a canvas copy of the word: the zoom flies through there.
  function thickest(word, fs, W, H, baseY) {
    const q = 4
    const cw = Math.ceil(W / q), ch = Math.ceil(H / q)
    const c = document.createElement('canvas')
    c.width = cw; c.height = ch
    const x = c.getContext('2d', { willReadFrequently: true })
    x.font = `700 ${fs / q}px Inter, system-ui, sans-serif`
    x.textAlign = 'center'
    x.textBaseline = 'alphabetic'
    x.fillStyle = '#fff'
    x.fillText(word, W / 2 / q, baseY / q)
    const px = x.getImageData(0, 0, cw, ch).data
    const D = new Float32Array(cw * ch)
    for (let i = 0; i < D.length; i++) D[i] = px[i * 4 + 3] > 127 ? 1e9 : 0
    for (let y = 0; y < ch; y++)
      for (let k = 0; k < cw; k++) {
        const i = y * cw + k
        if (!D[i]) continue
        let m = D[i]
        if (k > 0) m = Math.min(m, D[i - 1] + 1)
        if (y > 0) m = Math.min(m, D[i - cw] + 1)
        if (k > 0 && y > 0) m = Math.min(m, D[i - cw - 1] + 1.414)
        if (k < cw - 1 && y > 0) m = Math.min(m, D[i - cw + 1] + 1.414)
        D[i] = m
      }
    for (let y = ch - 1; y >= 0; y--)
      for (let k = cw - 1; k >= 0; k--) {
        const i = y * cw + k
        if (!D[i]) continue
        let m = D[i]
        if (k < cw - 1) m = Math.min(m, D[i + 1] + 1)
        if (y < ch - 1) m = Math.min(m, D[i + cw] + 1)
        if (k < cw - 1 && y < ch - 1) m = Math.min(m, D[i + cw + 1] + 1.414)
        if (k > 0 && y < ch - 1) m = Math.min(m, D[i + cw - 1] + 1.414)
        D[i] = m
      }
    let best = 0, bi = 0
    for (let i = 0; i < D.length; i++) {
      // A slight pull to the middle of the word, so the flight goes in near the centre.
      const v = D[i] - Math.abs((i % cw) - cw / 2) * 0.004
      if (v > best) { best = v; bi = i }
    }
    return { x: (bi % cw) * q + q / 2, y: Math.floor(bi / cw) * q + q / 2, r: Math.max(2, D[bi] * q) }
  }

  function buildWord() {
    const d = T.word
    const { scene, stage, still } = sceneOf('word')
    const glow = el('div', 'glow')
    const svg = svgEl('svg', { class: 'word-svg', 'aria-hidden': 'true' })
    const mask = svgEl('mask', { id: 'word-mask', maskUnits: 'userSpaceOnUse', x: 0, y: 0 })
    const mBg = svgEl('rect', { fill: '#000' })
    const mText = svgEl('text', { fill: '#fff', class: 'word-text', 'text-anchor': 'middle' })
    mText.textContent = d.word
    const mFull = svgEl('rect', { fill: '#fff', opacity: 0 })
    mask.append(mBg, mText, mFull)
    const defs = svgEl('defs')
    defs.append(mask)
    const g = svgEl('g', { mask: 'url(#word-mask)' })
    const lift = svgEl('rect', { class: 'word-lift' })
    const im = svgEl('image', { href: d.img.src, width: d.img.w, height: d.img.h })
    g.append(lift, im)
    svg.append(defs, g)
    const txt = el('div', 'shell word-txt', `${head(d)}<div class="btns"><a class="btn btn-main" href="#">Request a selection</a></div>`)
    stage.append(glow, svg, txt)
    still.innerHTML = `<div class="still-two"><img src="${d.img.src}" alt="${esc(d.title)}"><div>${head(d)}</div></div>`

    let g0 = null
    const measure = () => {
      const W = stage.clientWidth, H = stage.clientHeight
      if (!W) return
      const narrow = W < 900
      svg.setAttribute('width', W)
      svg.setAttribute('height', H)
      svg.setAttribute('viewBox', `0 0 ${W} ${H}`)
      mask.setAttribute('width', W)
      mask.setAttribute('height', H)
      for (const r of [mBg, mFull, lift]) { r.setAttribute('width', W); r.setAttribute('height', H) }
      mText.removeAttribute('transform')
      mText.setAttribute('font-size', 100)
      mText.setAttribute('x', W / 2)
      mText.setAttribute('y', H / 2)
      const w100 = mText.getComputedTextLength()
      if (!w100) return
      const fs = Math.min(((W * (narrow ? 0.92 : 0.86)) / w100) * 100, H * 0.42)
      const baseY = H * (narrow ? 0.44 : 0.47) + fs * 0.36
      mText.setAttribute('font-size', fs)
      mText.setAttribute('y', baseY)
      const wordW = (w100 * fs) / 100
      const P = thickest(d.word, fs, W, H, baseY)
      g0 = {
        W, H, P, wordW,
        kMax: (Math.hypot(W, H) / 2 / P.r) * 1.15,
        // Inside the word the tool lies flat along it; at the end it lies at its own slant beside the text.
        L1: wordW * 1.12, x1: W / 2, y1: baseY - fs * 0.36,
        L2: fitLen(d.img, narrow ? W * 0.94 : W * 0.6, narrow ? H * 0.34 : H * 0.62),
        x2: narrow ? W * 0.5 : W * 0.64, y2: narrow ? H * 0.3 : H * 0.44,
      }
    }
    return {
      scene, stage, len: 260, measure,
      frame(e, p) {
        if (!g0) measure()
        if (!g0) return
        const { W, H, P, kMax } = g0
        // The flight ends inside the stroke before anything else moves: the letter's edges must never cross the screen
        // while the tool is on its way, or they read as broken wedges.
        const z = ease(seg(p, 0.2, 0.5))
        const k = Math.pow(kMax, z)
        const cx = lerp(P.x, W / 2, z), cy = lerp(P.y, H / 2, z)
        mText.setAttribute('transform', `translate(${cx} ${cy}) scale(${k}) translate(${-P.x} ${-P.y})`)
        // Before the flight the metal drifts slowly inside the letters: our stand-in for DJI's footage.
        const drift = (seg(p, 0, 0.3) - 0.5) * g0.wordW * 0.1
        const m = ease(seg(p, 0.5, 0.78))
        const L = lerp(g0.L1, g0.L2, m)
        const x = lerp(g0.x1 + drift, g0.x2, m), y = lerp(g0.y1, g0.y2, m)
        const r = lerp(-d.img.angle, 0, m)
        im.setAttribute('transform', `translate(${x} ${y}) rotate(${r}) scale(${L / d.img.len}) translate(${-d.img.cx} ${-d.img.cy})`)
        mFull.setAttribute('opacity', seg(p, 0.46, 0.5))
        lift.style.opacity = 1 - seg(p, 0.52, 0.72)
        show(glow, seg(p, 0.62, 0.78))
        glow.style.transform = `translate(${g0.x2}px,${g0.y2}px)`
        const t = seg(p, 0.76, 0.88)
        show(txt, t)
        txt.style.transform = `translateY(${(1 - out(t)) * 14}px)`
      },
    }
  }

  // ── 2. Light walks along the tool. ──
  function buildLight() {
    const d = T.light
    const { scene, stage, still } = sceneOf('light')
    const glow = el('div', 'glow')
    const layer = el('div', 'layer')
    const dim = img(d.img)
    dim.classList.add('light-dim')
    const lit = img(d.img, d.title)
    const full = img(d.img)
    layer.append(dim, lit, full)
    const top = el('div', 'shell light-head', head(d))
    const figs = el('div', 'shell light-figs', `${figsHtml(d.figures)}<div class="btns"><a class="btn btn-out" href="#">Size table</a></div>`)
    stage.append(glow, layer, top, figs)
    still.innerHTML = `${head(d)}<img class="still-wide" src="${d.img.src}" alt="">${figsHtml(d.figures)}`

    let g = null
    const measure = () => {
      const W = stage.clientWidth, H = stage.clientHeight
      if (!W) return
      const narrow = W < 900
      const L = fitLen(d.img, W * (narrow ? 0.96 : 0.84), H * (narrow ? 0.3 : 0.4))
      g = { W, H, L, x: W / 2, y: H * (narrow ? 0.5 : 0.53) }
      for (const n of [dim, lit, full]) pose(n, d.img, g.x, g.y, L)
    }
    const a = rad(d.img.angle)
    return {
      scene, stage, len: 220, measure,
      frame(e, p) {
        if (!g) measure()
        if (!g) return
        const x = lerp(-0.3, 1.3, seg(p, 0.06, 0.6))
        // The band runs across the tool's axis, so it is a cut of light, not a wipe across the screen.
        const m = `linear-gradient(${90 + d.img.angle}deg, transparent ${(x - 0.15) * 100}%, #000 ${x * 100}%, transparent ${(x + 0.15) * 100}%)`
        lit.style.maskImage = m
        lit.style.webkitMaskImage = m
        show(full, seg(p, 0.58, 0.76))
        const along = (clamp(x, 0, 1) - 0.5) * g.L
        glow.style.transform = `translate(${g.x + Math.cos(a) * along}px,${g.y + Math.sin(a) * along}px)`
        show(glow, seg(p, 0.02, 0.1))
        const t = seg(p, 0.74, 0.86)
        show(figs, t)
        figs.style.transform = `translateY(${(1 - out(t)) * 14}px)`
      },
    }
  }

  // ── 3. The camera runs along the cutaway while the sentence lights up. ──
  function buildInside() {
    const d = T.inside
    const { scene, stage, still } = sceneOf('inside')
    const win = el('div', 'inside-win')
    const layer = el('div', 'layer')
    const im = img(d.img, `${d.title}, cutaway`)
    layer.append(im)
    win.append(layer)
    const words = d.lead.split(/\s+/)
    const text = el('div', 'inside-text', `${head(d, 'h2', false)}<p class="inside-say">${words.map((w) => `<span>${esc(w)}</span>`).join(' ')}</p><div class="inside-figs">${figsHtml(d.figures)}</div>`)
    const spans = [...text.querySelectorAll('.inside-say span')]
    const figs = text.querySelector('.inside-figs')
    stage.append(win, text)
    still.innerHTML = `<div class="still-two"><div>${head(d)}${figsHtml(d.figures)}</div><img src="${d.img.src}" alt="${esc(d.title)}, cutaway"></div>`

    let g = null
    const a = rad(d.img.angle)
    const measure = () => {
      const W = stage.clientWidth, H = stage.clientHeight
      if (!W) return
      const narrow = W < 900
      const box = narrow ? { l: 0, t: H * 0.44, w: W, h: H * 0.56 } : { l: W * 0.42, t: 0, w: W * 0.58, h: H }
      Object.assign(win.style, { left: box.l + 'px', top: box.t + 'px', width: box.w + 'px', height: box.h + 'px' })
      const s1 = (box.h * 0.86) / d.img.thick
      const s0 = fitLen(d.img, box.w * 0.9, box.h * 0.7, -d.img.angle) / d.img.len
      g = { box, s1, s0 }
    }
    return {
      scene, stage, len: 260, measure,
      frame(e, p) {
        if (!g) measure()
        if (!g) return
        const z = ease(seg(p, 0.7, 0.88))
        const u = lerp(-0.36, 0.36, ease(seg(p, 0.04, 0.7))) * d.img.len * (1 - z)
        const s = g.s1 * Math.pow(g.s0 / g.s1, z)
        layer.style.transform = `translate(${g.box.w / 2}px,${g.box.h / 2}px) rotate(${-d.img.angle}deg) scale(${s}) translate(${-(d.img.cx + Math.cos(a) * u)}px,${-(d.img.cy + Math.sin(a) * u)}px)`
        const f = seg(p, 0.04, 0.66) * spans.length
        spans.forEach((sp, i) => { sp.style.opacity = lerp(0.26, 1, clamp(f - i)) })
        const t = seg(p, 0.84, 0.94)
        show(figs, t)
      },
    }
  }

  // ── 4. Into the open end, and out into the table. ──
  function buildThrough() {
    const d = T.through
    const { scene, stage, still } = sceneOf('through')
    const glow = el('div', 'glow')
    const zoom = el('div', 'zoom')
    const im = img(d.img, d.title)
    zoom.append(im)
    const veil = el('div', 'veil')
    const top = el('div', 'shell through-head', head(d))
    const tbl = el('div', 'shell through-tbl', `<h3 class="tbl-title">${esc(d.title)}</h3><div class="tbl-wrap">${tableHtml(d.table)}</div>`)
    const rows = [...tbl.querySelectorAll('thead tr, tbody tr')]
    stage.append(glow, zoom, veil, top, tbl)
    still.innerHTML = `${head(d)}<img class="still-wide" src="${d.img.src}" alt=""><div class="tbl-wrap">${tableHtml(d.table)}</div>`

    let g = null
    const measure = () => {
      const W = stage.clientWidth, H = stage.clientHeight
      if (!W) return
      const narrow = W < 900
      const L = fitLen(d.img, narrow ? W * 0.96 : W * 0.68, narrow ? H * 0.36 : H * 0.56)
      const x0 = narrow ? W * 0.5 : W * 0.6, y0 = narrow ? H * 0.64 : H * 0.55
      pose(im, d.img, x0, y0, L)
      const s = L / d.img.len
      const bx = x0 + (d.bore.x - d.img.cx) * s, by = y0 + (d.bore.y - d.img.cy) * s
      g = { W, H, bx, by, kMax: (Math.hypot(W, H) / (d.bore.d * s)) * 2.2, x0, y0 }
      glow.style.transform = `translate(${x0}px,${y0}px)`
    }
    return {
      scene, stage, len: 260, measure,
      frame(e, p) {
        if (!g) measure()
        if (!g) return
        const z = ease(seg(p, 0.1, 0.62))
        const k = Math.pow(g.kMax, z)
        const x = lerp(g.bx, g.W / 2, z), y = lerp(g.by, g.H / 2, z)
        zoom.style.transform = `translate(${x}px,${y}px) scale(${k}) translate(${-g.bx}px,${-g.by}px)`
        show(top, 1 - seg(p, 0.06, 0.16))
        show(glow, 1 - seg(p, 0.1, 0.3))
        show(veil, seg(p, 0.48, 0.62))
        show(tbl, seg(p, 0.6, 0.66))
        rows.forEach((r, i) => {
          const t = seg(p, 0.62 + i * 0.018, 0.68 + i * 0.018)
          r.style.opacity = t
          r.style.transform = `translateY(${(1 - out(t)) * 10}px)`
        })
      },
    }
  }

  // ── 5. One real figure across the screen, size by size. ──
  function buildFigure() {
    const d = T.figure
    const t = T.bars.table // the same product's table
    const { scene, stage, still } = sceneOf('figure')
    const keys = ['load_capacity', 'pressure_testing']
    const cols = keys.map((k) => t.cols.find((c) => c.key === k))
    const n = t.rows.length
    const glow = el('div', 'glow')
    const layer = el('div', 'layer')
    const im = img(d.img, d.title)
    layer.append(im)
    const top = el('div', 'shell figure-head', head(d, 'h2', false))
    const nums = el('div', 'fig-nums', cols.map((c) => `<div class="fig-num"><p class="fig-label">${esc(c.label)}</p><p class="fig-value"><span class="fig-val"></span><span class="fig-unit">${esc(c.unit)}</span></p></div>`).join(''))
    const vals = [...nums.querySelectorAll('.fig-val')]
    const scale = el('div', 'fig-scale', `<p class="fig-scale-name">Size</p><ol>${t.rows.map((r) => `<li>${esc(r.size)}</li>`).join('')}</ol><span class="fig-mark" aria-hidden="true"></span>`)
    const ticks = [...scale.querySelectorAll('li')]
    const mark = scale.querySelector('.fig-mark')
    stage.append(glow, layer, top, nums, scale)
    still.innerHTML = `${head(d, 'h2', false)}<div class="tbl-wrap">${tableHtml({ cols, rows: t.rows })}</div>`

    let g = null, shown = -1
    const measure = () => {
      const W = stage.clientWidth, H = stage.clientHeight
      if (!W) return
      const narrow = W < 900
      nums.style.setProperty('--num', (narrow ? Math.min(W * 0.2, H * 0.11) : Math.min(W * 0.085, H * 0.17)) + 'px')
      const L = fitLen(d.img, narrow ? W * 0.9 : W * 0.4, narrow ? H * 0.14 : H * 0.5)
      const x = narrow ? W * 0.5 : W * 0.74, y = narrow ? H * 0.24 : H * 0.44
      pose(im, d.img, x, y, L)
      glow.style.transform = `translate(${x}px,${y}px)`
      const base = scale.querySelector('ol').getBoundingClientRect()
      g = { ticks: ticks.map((li) => { const r = li.getBoundingClientRect(); return { x: r.left - base.left, w: r.width } }) }
      shown = -1
    }
    const put = (i) => {
      if (i === shown) return
      const dir = i > shown ? 1 : -1
      shown = i
      const row = t.rows[i]
      keys.forEach((k, j) => swapTo(vals[j], `${i}`, esc(row.cells[k]?.text ?? ''), dir))
      ticks.forEach((li, j) => li.classList.toggle('on', j === i))
      const tk = g.ticks[i]
      mark.style.width = tk.w + 'px'
      mark.style.transform = `translateX(${tk.x}px)`
    }
    return {
      scene, stage, len: 300, measure,
      frame(e, p) {
        if (!g) measure()
        if (!g) return
        put(clamp(Math.floor(seg(p, 0.05, 0.95) * n), 0, n - 1))
      },
    }
  }

  // ── 6. Dimension lines: what the table measures, drawn on the tool. ──
  function buildDims() {
    const d = T.dims
    const t = d.table
    const pic = d.laid
    const { scene, stage, still } = sceneOf('dims')
    const top = el('div', 'shell dims-head', head(d, 'h2', false))
    const layer = el('div', 'layer')
    const im = img(pic, d.title)
    layer.append(im)
    const svg = svgEl('svg', { class: 'dims-svg', 'aria-hidden': 'true' })
    svg.innerHTML = `<defs><marker id="dim-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="9" markerHeight="9" orient="auto-start-reverse" markerUnits="userSpaceOnUse"><path d="M1 1.5 L9 5 L1 8.5" fill="none" stroke="currentColor" stroke-width="1.4"/></marker></defs>`
    const grp = svgEl('g')
    svg.append(grp)
    const mk = () => { const n = svgEl('path', { 'marker-end': 'url(#dim-arrow)' }); grp.append(n); return n }
    const lines = { A: [mk(), mk()], B: [mk(), mk()] }
    const ticksA = svgEl('path', { class: 'dim-tick' })
    const ticksB = svgEl('path', { class: 'dim-tick' })
    grp.append(ticksA, ticksB)
    const colA = t.cols.find((c) => c.key === 'install_range_min')
    const colB = t.cols.find((c) => c.key === 'tool_id_min')
    const lab = (c) => el('div', 'dim-label', `<span class="dl-name">${esc(c.label)}</span><span class="dl-val"></span>`)
    const labA = lab(colA), labB = lab(colB)
    const valA = labA.querySelector('.dl-val'), valB = labB.querySelector('.dl-val')
    const tabs = el('div', 'seg dims-tabs', `<span class="seg-name">Size</span>${t.rows.map((r, i) => `<button type="button" data-i="${i}">${esc(r.size)}</button>`).join('')}`)
    tabs.setAttribute('role', 'group')
    tabs.setAttribute('aria-label', 'Size')
    const note = el('p', 'dims-note', 'Diagram: the lines show what is measured, not the scale.')
    stage.append(top, layer, svg, labA, labB, tabs, note)
    still.innerHTML = `${head(d, 'h2', false)}<img class="still-wide" src="${pic.src}" alt=""><div class="tbl-wrap">${tableHtml({ cols: [colA, colB], rows: t.rows })}</div>`

    let sel = 0
    const setSel = (i) => {
      sel = i
      tabs.querySelectorAll('button').forEach((b, j) => b.setAttribute('aria-pressed', String(j === i)))
      swapTo(valA, String(i), `${esc(t.rows[i].cells[colA.key].text)} ${esc(colA.unit)}`)
      swapTo(valB, String(i), `${esc(t.rows[i].cells[colB.key].text)} ${esc(colB.unit)}`)
    }
    tabs.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) setSel(Number(b.dataset.i)) })
    setSel(0)

    let g = null
    const measure = () => {
      const W = stage.clientWidth, H = stage.clientHeight
      if (!W) return
      const narrow = W < 900
      const L = fitLen(pic, narrow ? W * 0.74 : W * 0.54, narrow ? H * 0.3 : H * 0.42)
      const x = W * 0.5, y = narrow ? H * 0.4 : H * 0.45
      pose(im, pic, x, y, L)
      svg.setAttribute('width', W)
      svg.setAttribute('height', H)
      grp.setAttribute('transform', `translate(${x} ${y}) rotate(${pic.angle})`)
      const th = (L * pic.thick) / pic.len
      const gx = Math.max(18, L * 0.05)
      g = { W, H, narrow, x, y, L, th, xA: -L / 2 - gx, xB: L / 2 + gx, hA: (th / 2) * 1.3, hB: th * 0.3 }
      ticksA.setAttribute('d', `M${g.xA - 7} ${-g.hA} H${g.xA + 7} M${g.xA - 7} ${g.hA} H${g.xA + 7}`)
      ticksB.setAttribute('d', `M${g.xB - 7} ${-g.hB} H${g.xB + 7} M${g.xB - 7} ${g.hB} H${g.xB + 7}`)
      const a = rad(pic.angle)
      const at = (lx, ly) => [x + lx * Math.cos(a) - ly * Math.sin(a), y + lx * Math.sin(a) + ly * Math.cos(a)]
      labA.classList.toggle('right', !narrow)
      labB.classList.toggle('right', narrow)
      if (narrow) {
        // No room beside the ends on a phone: the labels stand under the tool, each on its own side.
        labA.style.transform = `translate(${16}px,${H * 0.62}px)`
        labB.style.transform = `translate(${W - 16}px,${H * 0.62}px) translateX(-100%)`
      } else {
        const [ax, ay] = at(g.xA - 16, 0)
        const [bx, by] = at(g.xB + 16, 0)
        labA.style.transform = `translate(${ax}px,${ay}px) translate(-100%,-50%)`
        labB.style.transform = `translate(${bx}px,${by}px) translateY(-50%)`
      }
    }
    const draw = (pair, x, h, t) => {
      pair[0].setAttribute('d', `M${x} 0 V${-h * t}`)
      pair[1].setAttribute('d', `M${x} 0 V${h * t}`)
      pair.forEach((n) => n.style.opacity = t > 0.02 ? 1 : 0)
    }
    return {
      scene, stage, len: 200, measure,
      frame(e, p) {
        if (!g) measure()
        if (!g) return
        const tA = out(seg(p, 0.12, 0.34)), tB = out(seg(p, 0.3, 0.52))
        draw(lines.A, g.xA, g.hA, tA)
        draw(lines.B, g.xB, g.hB, tB)
        ticksA.style.opacity = seg(tA, 0.9, 1)
        ticksB.style.opacity = seg(tB, 0.9, 1)
        show(labA, seg(p, 0.32, 0.4))
        show(labB, seg(p, 0.5, 0.58))
        const c = seg(p, 0.56, 0.66)
        show(tabs, c)
        show(note, c)
      },
    }
  }

  // ── Stepped scenes share one rule: the scroll picks a state, tabs move the scroll there. ──
  function scrollToState(s, i, n) {
    const span = s.scene.offsetHeight - s.stage.offsetHeight
    const p = 0.04 + ((i + 0.5) / n) * 0.92
    const y = scrollY + s.scene.getBoundingClientRect().top - (innerHeight - s.stage.offsetHeight) + p * span
    scrollTo({ top: y, behavior: state.still ? 'auto' : 'smooth' })
  }
  const stepOf = (p, n) => clamp(Math.floor(seg(p, 0.04, 0.96) * n), 0, n - 1)

  // ── 7. The four anchor types, one at a time. ──
  function buildTypes() {
    const d = T.types
    const n = d.types.length
    const { scene, stage, still } = sceneOf('types')
    const glow = el('div', 'glow')
    const layer = el('div', 'layer')
    const pics = d.types.map((x) => { const i = img(x.img, `${x.name} anchor`); layer.append(i); return i })
    const top = el('div', 'shell types-head', `<h2 class="title">${esc(d.title)}</h2>${d.advantages.length ? `<ul class="adv">${d.advantages.map((a) => `<li>${esc(a)}</li>`).join('')}</ul>` : ''}`)
    const tabs = el('div', 'tabs', `${d.types.map((x, i) => `<button type="button" data-i="${i}">${esc(x.name)}</button>`).join('')}<span class="tabs-mark" aria-hidden="true"></span>`)
    tabs.setAttribute('role', 'group')
    tabs.setAttribute('aria-label', 'Anchor type')
    const btns = [...tabs.querySelectorAll('button')]
    const tmark = tabs.querySelector('.tabs-mark')
    const used = el('p', 'types-used')
    stage.append(glow, layer, top, tabs, used)
    still.innerHTML = `<h2 class="title">${esc(d.title)}</h2><div class="still-grid">${d.types.map((x) => `<figure><img src="${x.img.src}" alt=""><figcaption><strong>${esc(x.name)}</strong> ${x.usedIn.map((u) => `Part of the ${esc(u)}`).join('; ')}</figcaption></figure>`).join('')}</div>`
    const self = { scene, stage, len: 280 }
    tabs.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) scrollToState(self, Number(b.dataset.i), n) })

    let g = null, cur = null
    const measure = () => {
      const W = stage.clientWidth, H = stage.clientHeight
      if (!W) return
      const narrow = W < 900
      const x = narrow ? W * 0.5 : W * 0.62, y = narrow ? H * 0.56 : H * 0.54
      const Ls = d.types.map((t) => fitLen(t.img, narrow ? W * 0.94 : W * 0.56, narrow ? H * 0.3 : H * 0.44))
      const base = tabs.getBoundingClientRect()
      g = { x, y, L: Math.min(...Ls), tabs: btns.map((b) => { const r = b.getBoundingClientRect(); return { x: r.left - base.left + tabs.scrollLeft, w: r.width } }) }
      glow.style.transform = `translate(${x}px,${y}px)`
    }
    return Object.assign(self, {
      measure,
      frame(e, p, dt) {
        if (!g) measure()
        if (!g) return
        const idx = stepOf(p, n)
        cur = cur == null ? idx : Math.abs(cur - idx) < 0.002 ? idx : lerp(cur, idx, 1 - Math.exp(-dt / 140))
        d.types.forEach((t, j) => {
          const dd = j - cur
          const off = dd * 0.22 * g.L
          const a = rad(t.img.angle)
          pose(pics[j], t.img, g.x + Math.cos(a) * off, g.y + Math.sin(a) * off, g.L)
          show(pics[j], clamp(1 - Math.abs(dd) * 1.6))
        })
        const lo = Math.floor(cur), hi = Math.min(n - 1, lo + 1), f = cur - lo
        tmark.style.width = lerp(g.tabs[lo].w, g.tabs[hi].w, f) + 'px'
        tmark.style.transform = `translateX(${lerp(g.tabs[lo].x, g.tabs[hi].x, f)}px)`
        btns.forEach((b, j) => b.setAttribute('aria-pressed', String(j === idx)))
        const shownType = d.types[clamp(Math.round(cur), 0, n - 1)]
        swapTo(used, shownType.name, shownType.usedIn.map((u) => `Part of the ${esc(u)}`).join('<br>'))
        return cur !== idx
      },
    })
  }

  // ── 8. One table as bars. ──
  function buildBars() {
    const d = T.bars
    const t = d.table
    const n = t.rows.length
    const { scene, stage, still } = sceneOf('bars')
    const metrics = d.metrics.map((k) => t.cols.find((c) => c.key === k))
    const top = el('div', 'bars-head', `${head(d, 'h2', false)}<div class="seg bars-switch" role="group" aria-label="Figure">${metrics.map((c, i) => `<button type="button" data-m="${i}">${esc(c.label)}</button>`).join('')}</div>`)
    const chart = el('div', 'chart', `<p class="chart-title"></p><div class="plot">${t.rows
      .map((r, i) => `<button type="button" class="bar-col" data-i="${i}" aria-label="${esc(r.size)}"><span class="bar-val"></span><span class="bar-rect"></span><span class="bar-size">${esc(r.size)}</span></button>`)
      .join('')}</div><p class="chart-row"></p>`)
    const ctitle = chart.querySelector('.chart-title')
    const crow = chart.querySelector('.chart-row')
    const plot = chart.querySelector('.plot')
    const colsEls = [...chart.querySelectorAll('.bar-col')]
    const barEls = colsEls.map((c) => c.querySelector('.bar-rect'))
    const valEls = colsEls.map((c) => c.querySelector('.bar-val'))
    stage.append(top, chart)
    still.innerHTML = `${head(d, 'h2', false)}<div class="tbl-wrap">${tableHtml({ cols: metrics, rows: t.rows })}</div>`

    let mi = 0, hot = null
    const heights = new Array(n).fill(null)
    const target = () => {
      const k = metrics[mi].key
      const v = t.rows.map((r) => r.cells[k]?.value ?? 0)
      const max = Math.max(...v) * 1.12
      return v.map((x) => x / max)
    }
    let goal = target()
    const rowText = (r) => `${r.size}: ${t.cols.map((c) => `${c.label.toLowerCase()} ${r.cells[c.key]?.text ?? ''} ${c.unit}`.trim()).join(', ')}`
    const setMetric = (i) => {
      mi = i
      goal = target()
      top.querySelectorAll('[data-m]').forEach((b, j) => b.setAttribute('aria-pressed', String(j === i)))
      swapTo(ctitle, String(i), esc(colName(metrics[i])))
      wake()
    }
    const setHot = (i) => {
      hot = i
      chart.classList.toggle('has-hot', i != null)
      colsEls.forEach((c, j) => c.classList.toggle('is-hot', j === i))
      swapTo(crow, String(i), i == null ? 'Point at a size to read its whole row.' : esc(rowText(t.rows[i])))
    }
    top.addEventListener('click', (e) => { const b = e.target.closest('[data-m]'); if (b) setMetric(Number(b.dataset.m)) })
    colsEls.forEach((c, j) => {
      c.addEventListener('pointerenter', () => setHot(j))
      c.addEventListener('focus', () => setHot(j))
      c.addEventListener('pointerleave', () => setHot(null))
      c.addEventListener('blur', () => setHot(null))
    })
    setMetric(0)
    setHot(null)

    let g = null
    const measure = () => {
      const W = stage.clientWidth
      if (!W) return
      g = { plotH: plot.clientHeight - 54 }
    }
    return {
      scene, stage, len: 220, measure,
      frame(e, p, dt) {
        if (!g) measure()
        if (!g) return
        let busy = false
        const k = 1 - Math.exp(-dt / 160)
        const key = metrics[mi].key
        for (let j = 0; j < n; j++) {
          heights[j] = heights[j] == null ? goal[j] : Math.abs(heights[j] - goal[j]) < 0.001 ? goal[j] : lerp(heights[j], goal[j], k)
          if (heights[j] !== goal[j]) busy = true
          const a = 0.08 + j * 0.045
          const grow = out(seg(p, a, a + 0.2))
          barEls[j].style.height = Math.max(0, g.plotH * heights[j] * grow) + 'px'
          // The value appears only once its bar stands; the bar never carries a number it has not reached.
          show(valEls[j], seg(p, a + 0.19, a + 0.23))
          swapTo(valEls[j], `${mi}`, esc(t.rows[j].cells[key]?.text ?? ''))
        }
        return busy
      },
    }
  }

  // ── 9. Two tools of one profile, and what really sets them apart. ──
  function buildPair() {
    const { a, b } = T.pair
    const { scene, stage, still } = sceneOf('pair')
    const keysA = a.table.cols.map((c) => c.key), keysB = b.table.cols.map((c) => c.key)
    const same = [], differ = [], onlyA = [], onlyB = []
    for (const c of a.table.cols) {
      if (!keysB.includes(c.key)) { onlyA.push(c); continue }
      const eq = a.table.rows.length === b.table.rows.length && a.table.rows.every((r) => {
        const rb = b.table.rows.find((x) => x.size === r.size)
        return rb && rb.cells[c.key]?.text === r.cells[c.key]?.text
      })
      ;(eq ? same : differ).push(c)
    }
    for (const c of b.table.cols) if (!keysA.includes(c.key)) onlyB.push(c)
    // Advantages worded almost the same count as one; a different noun ("slips" against "packer elements") does not.
    const words = (s) => new Set(s.toLowerCase().match(/[a-z0-9]+/g))
    const close = (x, y) => {
      const A = words(x), B = words(y)
      let i = 0
      for (const w of A) if (B.has(w)) i++
      return i / (A.size + B.size - i) >= 0.75
    }
    const advA = a.advantages.filter((x) => !b.advantages.some((y) => close(x, y)))
    const advB = b.advantages.filter((x) => !a.advantages.some((y) => close(x, y)))
    const colItem = (tbl, c) => `<li><span>${esc(c.label)}</span> <strong>${esc(rangeOf(tbl, c.key))} ${esc(c.unit)}</strong></li>`
    const block = (code, cols, tbl, adv) =>
      cols.length || adv.length
        ? `<div class="pd-block"><h4>Only in ${esc(code)}</h4><ul>${cols.map((c) => colItem(tbl, c)).join('')}${adv.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>`
        : ''
    const panelHtml = `<h3 class="pd-title">What differs</h3>${block(b.code, onlyB, b.table, advB)}${block(a.code, onlyA, a.table, advA)}${
      differ.length ? `<div class="pd-block"><h4>Different values</h4><ul>${differ.map((c) => `<li><span>${esc(c.label)}</span> <strong>${esc(rangeOf(a.table, c.key))} against ${esc(rangeOf(b.table, c.key))} ${esc(c.unit)}</strong></li>`).join('')}</ul></div>` : ''
    }${same.length ? `<div class="pd-block pd-same"><h4>The same in both, size by size</h4><p>${same.map((c) => esc(c.label)).join(', ')}</p></div>` : ''}`
    const layer = el('div', 'layer')
    const ib = img(b.img, b.title), ia = img(a.img, a.title)
    layer.append(ib, ia)
    const na = el('div', 'pair-name', head(a, 'h3', false)), nb = el('div', 'pair-name', head(b, 'h3', false))
    const panel = el('div', 'pair-panel', panelHtml)
    const items = [...panel.querySelectorAll('.pd-title, h4, li, .pd-same p')]
    stage.append(layer, na, nb, panel)
    still.innerHTML = `<div class="still-pair"><figure><img src="${a.img.src}" alt="">${head(a, 'h3', false)}</figure><figure><img src="${b.img.src}" alt="">${head(b, 'h3', false)}</figure><div class="pair-panel">${panelHtml}</div></div>`

    let g = null
    const measure = () => {
      const W = stage.clientWidth, H = stage.clientHeight
      if (!W) return
      const narrow = W < 900
      const L = Math.min(...[a, b].map((x) => fitLen(x.img, narrow ? W * 0.3 : W * 0.16, narrow ? H * 0.34 : H * 0.66)))
      const y = narrow ? H * 0.22 : H * 0.42
      const xa = narrow ? W * 0.27 : W * 0.13, xb = narrow ? W * 0.73 : W * 0.32
      g = { W, H, L, y, xa, xb, x0: (xa + xb) / 2, narrow }
      const nameY = y + L / 2 + 14
      na.style.transform = `translate(${xa}px,${nameY}px) translateX(-50%)`
      nb.style.transform = `translate(${xb}px,${nameY}px) translateX(-50%)`
    }
    return {
      scene, stage, len: 220, measure,
      frame(e, p) {
        if (!g) measure()
        if (!g) return
        const s = ease(seg(p, 0.06, 0.32))
        pose(ia, a.img, lerp(g.x0, g.xa, s), g.y, g.L)
        pose(ib, b.img, lerp(g.x0, g.xb, s), g.y, g.L * lerp(0.96, 1, s))
        ib.style.opacity = lerp(0.5, 1, s)
        show(na, seg(p, 0.28, 0.36))
        show(nb, seg(p, 0.28, 0.36))
        items.forEach((it, i) => show(it, seg(p, 0.34 + i * 0.03, 0.4 + i * 0.03)))
      },
    }
  }

  // ── 10. The four whipstock systems: what each set is made of. ──
  function buildScheme() {
    const { systems, parts } = T.scheme
    const n = systems.length
    const { scene, stage, still } = sceneOf('scheme')
    const ROLE = { standard: 'Standard', option: 'Optional', 'not-included': 'Not included', variant: 'Variant' }
    const tabs = el('div', 'tabs', `${systems.map((s, i) => `<button type="button" data-i="${i}">${esc(s.name)}</button>`).join('')}<span class="tabs-mark" aria-hidden="true"></span>`)
    tabs.setAttribute('role', 'group')
    tabs.setAttribute('aria-label', 'System')
    const btns = [...tabs.querySelectorAll('button')]
    const tmark = tabs.querySelector('.tabs-mark')
    const top = el('div', 'scheme-head')
    const code = el('p', 'code')
    const lead = el('p', 'lead')
    top.append(tabs, code, lead)
    const list = el('ul', 'bom', parts.map((pt) => `<li data-id="${esc(pt.id)}"><span class="bom-pic"><img src="${pt.img.src}" alt=""></span><span class="bom-name">${esc(pt.title)}</span><span class="bom-role"></span></li>`).join(''))
    const lis = [...list.querySelectorAll('li')]
    stage.append(top, list)
    still.innerHTML = `<div class="tbl-wrap"><table class="tbl"><thead><tr><th scope="col">Component</th>${systems.map((s) => `<th scope="col">${esc(s.name)}<br><span class="code">${esc(s.code)}</span></th>`).join('')}</tr></thead><tbody>${parts
      .map((pt) => `<tr><th scope="row">${esc(pt.title)}</th>${systems.map((s) => `<td class="role-${esc(s.roles[pt.id] ?? 'not-included')}">${esc(ROLE[s.roles[pt.id]] ?? 'Not included')}${s.types[pt.id] ? `: ${esc(s.types[pt.id])}` : ''}</td>`).join('')}</tr>`)
      .join('')}</tbody></table></div>`
    const self = { scene, stage, len: 300 }
    tabs.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) scrollToState(self, Number(b.dataset.i), n) })

    let shown = -1, g = null
    const apply = (i) => {
      if (i === shown) return
      shown = i
      const s = systems[i]
      btns.forEach((b, j) => b.setAttribute('aria-pressed', String(j === i)))
      const r = btns[i].getBoundingClientRect(), base = tabs.getBoundingClientRect()
      tmark.style.width = r.width + 'px'
      tmark.style.transform = `translateX(${r.left - base.left + tabs.scrollLeft}px)`
      swapTo(code, String(i), `<strong>${esc(s.title)}</strong> ${esc(s.code)}`)
      swapTo(lead, String(i), esc(s.lead))
      parts.forEach((pt, j) => {
        const role = s.roles[pt.id] ?? 'not-included'
        lis[j].dataset.role = role
        const type = s.types[pt.id]
        swapTo(lis[j].querySelector('.bom-role'), `${i}`, esc(`${ROLE[role] ?? role}${type ? `: ${type}` : ''}`))
        const pic = type && pt.typed[type] ? pt.typed[type] : pt.img
        const im = lis[j].querySelector('img')
        if (!im.src.endsWith(pic.src)) {
          im.src = pic.src
          if (!state.still) im.animate?.([{ opacity: 0 }, { opacity: 1 }], { duration: 260, easing: 'ease-out' })
        }
      })
    }
    return Object.assign(self, {
      measure() { g = stage.clientWidth ? {} : null; shown = -1 },
      frame(e, p) {
        if (!g) return
        apply(stepOf(p, n))
      },
    })
  }

  // ── The frame loop: one smoothed progress per scene; it sleeps when nothing is left to do. ──
  let scenes = []
  let running = false
  let lastTime = 0
  const SETTLE = 90 // ms: the time constant that takes the steps out of a mouse wheel

  function targets(s) {
    const r = s.scene.getBoundingClientRect()
    const vh = innerHeight
    const bar = s.stage.getBoundingClientRect().height
    const span = r.height - bar
    return { e: clamp(1 - (r.top - (vh - bar)) / bar), p: clamp((vh - bar - r.top) / Math.max(1, span)), near: r.bottom > -vh && r.top < vh * 2 }
  }
  function tick(now) {
    const dt = Math.min(64, now - lastTime || 16)
    lastTime = now
    let busy = false
    for (const s of scenes) {
      const t = targets(s)
      if (!t.near) continue
      const k = 1 - Math.exp(-dt / SETTLE)
      s.e = s.e == null ? t.e : lerp(s.e, t.e, k)
      s.p = s.p == null ? t.p : lerp(s.p, t.p, k)
      if (Math.abs(s.e - t.e) < 0.0004) s.e = t.e
      if (Math.abs(s.p - t.p) < 0.0004) s.p = t.p
      const more = s.frame(s.e, s.p, dt)
      if (more || s.e !== t.e || s.p !== t.p) busy = true
    }
    if (busy) requestAnimationFrame(tick)
    else running = false
  }
  function wake() {
    if (running || state.still) return
    running = true
    lastTime = performance.now()
    requestAnimationFrame(tick)
  }
  function applyLengths() {
    for (const s of scenes) s.scene.style.setProperty('--len', String(Math.round(s.len * state.tempo)))
  }
  function remeasure() {
    for (const s of scenes) { s.measure(); s.e = s.p = null }
    wake()
  }
  function render() {
    root.classList.toggle('is-still', state.still)
    document.querySelectorAll('[data-set]').forEach((b) => {
      const v = b.dataset.set === 'still' ? (state.still ? '1' : '0') : String(state[b.dataset.set])
      b.setAttribute('aria-pressed', v === b.dataset.value ? 'true' : 'false')
    })
  }
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-set]')
    if (!b) return
    if (b.dataset.set === 'still') state.still = b.dataset.value === '1'
    else state.tempo = Number(b.dataset.value)
    render()
    applyLengths()
    remeasure()
  })
  const bar = document.querySelector('.bar')
  document.querySelector('.bar-toggle').addEventListener('click', (e) => {
    const open = bar.classList.toggle('open')
    e.currentTarget.setAttribute('aria-expanded', String(open))
  })
  reduce.addEventListener('change', () => { state.still = reduce.matches; render(); remeasure() })

  scenes = [buildWord(), buildLight(), buildInside(), buildThrough(), buildFigure(), buildDims(), buildTypes(), buildBars(), buildPair(), buildScheme()]
  render()
  applyLengths()
  remeasure()
  addEventListener('scroll', wake, { passive: true })
  addEventListener('resize', remeasure)
  addEventListener('load', remeasure)
  document.fonts?.ready.then(remeasure)
})()
