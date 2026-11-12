// Motion lab: ten more concepts (more.html). The engine of ten.js: no libraries, native scroll, a pinned stage,
// transforms and opacity. No number is ever shown between two real values of a table: figures swap whole.
(() => {
  const M = window.MORE
  const root = document.documentElement
  const reduce = matchMedia('(prefers-reduced-motion: reduce)')
  const params = new URLSearchParams(location.search)
  const state = {
    tempo: Number(params.get('tempo') ?? 1),
    still: params.has('still') ? params.get('still') === '1' : reduce.matches,
  }

  // ── helpers (as in ten.js) ──
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
  const fitLen = (p, bw, bh, rot = 0) => {
    const a = Math.abs(rad(p.angle + rot)), r = p.thick / p.len
    return Math.min(bw / (Math.abs(Math.cos(a)) + r * Math.abs(Math.sin(a))), bh / (Math.abs(Math.sin(a)) + r * Math.abs(Math.cos(a))))
  }
  const poseOf = (p, x, y, L, rot = 0) => `translate(${x}px,${y}px) rotate(${rot}deg) scale(${L / p.len}) translate(${-p.cx}px,${-p.cy}px)`
  const pose = (node, p, x, y, L, rot = 0) => { node.style.transform = poseOf(p, x, y, L, rot) }
  const show = (node, v) => {
    node.style.opacity = v
    node.style.visibility = v <= 0.001 ? 'hidden' : 'visible'
  }
  const swapTo = (node, key, html, dir = 1) => {
    key = String(key)
    if (node.dataset.k === key) return
    const first = node.dataset.k == null
    node.dataset.k = key
    node.innerHTML = html
    if (!first && !state.still) {
      node.animate?.([{ opacity: 0, transform: `translateY(${dir * 0.35}em)` }, { opacity: 1, transform: 'none' }], { duration: 240, easing: 'cubic-bezier(.2,.7,.2,1)' })
    }
  }
  const figsHtml = (figures) =>
    figures?.length
      ? `<dl class="figs">${figures.map((f) => `<div class="fig"><dt>${esc(f.label)}</dt><dd>${esc(f.value)}</dd></div>`).join('')}</dl>`
      : ''
  const head = (d, tag = 'h2', lead = true) =>
    `<${tag} class="title">${esc(d.title)}</${tag}>${d.code ? `<p class="code">${esc(d.code)}</p>` : ''}${lead && d.lead ? `<p class="lead">${esc(d.lead)}</p>` : ''}`
  const colName = (c) => `${c.label}${c.unit ? `, ${c.unit}` : ''}`
  const tableHtml = (t, keys) => {
    const cols = keys ? t.cols.filter((c) => keys.includes(c.key)) : t.cols
    return `<table class="tbl"><thead><tr><th scope="col">Size</th>${cols.map((c) => `<th scope="col">${esc(colName(c))}</th>`).join('')}</tr></thead><tbody>${t.rows
      .map((r) => `<tr><th scope="row">${esc(r.size)}</th>${cols.map((c) => `<td>${esc(r.cells[c.key]?.text ?? '')}</td>`).join('')}</tr>`)
      .join('')}</tbody></table>`
  }
  const sceneOf = (id) => {
    const scene = document.getElementById(id)
    scene.textContent = ''
    const stage = el('div', 'stage')
    const still = el('div', 'still')
    scene.append(stage, still)
    return { scene, stage, still }
  }
  // Sits on whole steps for most of each step's scroll, so a tool or a row can be read before the next arrives.
  const dwell = (k) => { const i = Math.floor(k), f = k - i; return i + ease(clamp((f - 0.2) / 0.6)) }
  const approach = (cur, target, dt, tau = 150) => (Math.abs(cur - target) < 0.01 ? target : lerp(cur, target, 1 - Math.exp(-dt / tau)))
  function scrollToP(s, p) {
    const span = s.scene.offsetHeight - s.stage.offsetHeight
    const y = scrollY + s.scene.getBoundingClientRect().top - (innerHeight - s.stage.offsetHeight) + p * span
    scrollTo({ top: y, behavior: state.still ? 'auto' : 'smooth' })
  }
  const scrollToState = (s, i, n) => scrollToP(s, 0.04 + ((i + 0.5) / n) * 0.92)
  const stepOf = (p, n) => clamp(Math.floor(seg(p, 0.04, 0.96) * n), 0, n - 1)
  const cap1 = (s) => s.charAt(0).toUpperCase() + s.slice(1)

  // ── 1. The outline draws itself, then the metal fills it. ──
  function buildDraw() {
    const d = M.draw
    const { scene, stage, still } = sceneOf('draw')
    const glow = el('div', 'glow')
    const pic = img(d.img, d.title)
    const svg = svgEl('svg', { class: 'draw-svg', 'aria-hidden': 'true' })
    const g = svgEl('g')
    const loops = d.path.split('Z').filter((s) => s.length > 2).map((s) => {
      const p = svgEl('path', { d: s + 'Z', pathLength: 1, class: 'draw-line' })
      g.append(p)
      return p
    })
    const axis = svgEl('line', { class: 'draw-axis' })
    g.append(axis)
    svg.append(g)
    const txt = el('div', 'shell draw-txt', `<div>${head(d)}</div>${figsHtml(d.figures)}`)
    stage.append(glow, pic, svg, txt)
    still.innerHTML = `<img class="still-wide" src="${d.img.src}" alt="${esc(d.title)}">${head(d)}${figsHtml(d.figures)}`
    const ux = Math.cos(rad(d.img.angle)), uy = Math.sin(rad(d.img.angle))
    const a0 = { x: d.img.cx - ux * d.img.len * 0.58, y: d.img.cy - uy * d.img.len * 0.58 }
    const a1 = { x: d.img.cx + ux * d.img.len * 0.58, y: d.img.cy + uy * d.img.len * 0.58 }
    axis.setAttribute('x1', a0.x)
    axis.setAttribute('y1', a0.y)
    let ok = false
    const measure = () => {
      const W = stage.clientWidth, H = stage.clientHeight
      if (!W) return
      const narrow = W < 900
      const x = W / 2, y = narrow ? H * 0.3 : H * 0.36
      const L = fitLen(d.img, narrow ? W * 0.94 : W * 0.8, narrow ? H * 0.32 : H * 0.48)
      const s = L / d.img.len
      svg.setAttribute('width', W)
      svg.setAttribute('height', H)
      svg.setAttribute('viewBox', `0 0 ${W} ${H}`)
      g.setAttribute('transform', `translate(${x} ${y}) scale(${s}) translate(${-d.img.cx} ${-d.img.cy})`)
      // Strokes in the picture's own pixels, so the widths and the chain dashes are set against its scale.
      for (const l of loops) l.setAttribute('stroke-width', 1.2 / s)
      axis.setAttribute('stroke-width', 1 / s)
      axis.setAttribute('stroke-dasharray', `${22 / s} ${5 / s} ${3 / s} ${5 / s}`)
      pose(pic, d.img, x, y, L)
      glow.style.transform = `translate(${x}px,${y}px)`
      ok = true
    }
    return {
      scene, stage, len: 240, measure,
      frame(e, p) {
        if (!ok) measure()
        const a = ease(seg(p, 0.02, 0.42))
        for (const l of loops) l.style.strokeDashoffset = String(1 - a)
        const ax = out(seg(p, 0.06, 0.4))
        axis.setAttribute('x2', lerp(a0.x, a1.x, ax))
        axis.setAttribute('y2', lerp(a0.y, a1.y, ax))
        axis.style.opacity = ax > 0.002 ? 1 - 0.6 * seg(p, 0.62, 0.78) : 0
        const f = seg(p, 0.4, 0.64)
        pic.style.clipPath = `inset(0 ${((1 - f) * 100).toFixed(2)}% 0 0)`
        show(pic, f > 0 ? 1 : 0)
        for (const l of loops) l.style.opacity = String(1 - 0.85 * seg(p, 0.58, 0.74))
        const t = out(seg(p, 0.66, 0.86))
        show(txt, t)
        txt.style.transform = `translateY(${(1 - t) * 24}px)`
      },
    }
  }

  // ── 2. The view from above, to scale, size by size. ──
  function buildSection() {
    const d = M.section
    const rows = d.rows, n = rows.length
    const { scene, stage, still } = sceneOf('section')
    const self = { scene, stage, len: 300 }
    const top = el('div', 'shell sec-head', head(d, 'h2', false))
    const svg = svgEl('svg', { class: 'sec-svg', 'aria-hidden': 'true' })
    const band = svgEl('circle', { class: 'sec-band' })
    const lo = svgEl('circle', { class: 'sec-edge' })
    const hi = svgEl('circle', { class: 'sec-edge' })
    const liner = svgEl('circle', { class: 'sec-liner' })
    const bore = svgEl('circle', { class: 'sec-bore' })
    const cross = svgEl('path', { class: 'sec-cross' })
    const bar = svgEl('path', { class: 'sec-bar' })
    const barTxt = svgEl('text', { class: 'sec-bar-txt' })
    barTxt.textContent = '50 mm'
    svg.append(band, hi, lo, liner, bore, cross, bar, barTxt)
    const legend = el('div', 'sec-legend')
    const legendIn = el('div')
    legend.append(legendIn)
    const scale = el('div', 'fig-scale sec-scale', `<p class="fig-scale-name">Liner size</p><ol>${rows.map((r, i) => `<li><button type="button" data-i="${i}">${esc(r.size)}</button></li>`).join('')}<span class="fig-mark"></span></ol>`)
    const lis = [...scale.querySelectorAll('li')]
    const mark = scale.querySelector('.fig-mark')
    const note = el('p', 'sec-note', 'Top view, to scale. One scale for every size.')
    stage.append(top, svg, legend, scale, note)
    scale.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) scrollToState(self, Number(b.dataset.i), n) })
    still.innerHTML = `${head(d)}<div class="tbl-wrap"><table class="tbl"><thead><tr><th scope="col">Liner</th><th scope="col">Installation range, mm</th><th scope="col">Inner diameter min., mm</th><th scope="col">Load capacity, ${esc(d.unitLoad)}</th></tr></thead><tbody>${rows
      .map((r) => `<tr><th scope="row">${esc(r.size)}</th><td>${esc(r.lo.text)} to ${esc(r.hi.text)}</td><td>${esc(r.bore.text)}</td><td>${esc(r.load?.text ?? '')}</td></tr>`)
      .join('')}</tbody></table></div>`
    const legendHtml = (r) => `<dl>
      <div><dt><i class="sw sw-band"></i>Installation range</dt><dd>${esc(r.lo.text)} to ${esc(r.hi.text)} mm</dd></div>
      <div><dt><i class="sw sw-liner"></i>Liner</dt><dd>${esc(r.liner.label)}, ${esc(r.liner.text)} mm</dd></div>
      <div><dt><i class="sw sw-bore"></i>Inner diameter min.</dt><dd>${esc(r.bore.text)} mm</dd></div>
      ${r.load ? `<div><dt>Load capacity</dt><dd>${esc(r.load.text)} ${esc(d.unitLoad)}</dd></div>` : ''}</dl>`

    let g = null, cur = null
    const maxHi = Math.max(...rows.map((r) => r.hi.value))
    const measure = () => {
      const W = stage.clientWidth, H = stage.clientHeight
      if (!W) return
      const narrow = W < 900
      const cx = narrow ? W / 2 : W * 0.47, cy = narrow ? H * 0.36 : H * 0.47
      const R = narrow ? Math.min(W * 0.36, H * 0.16) : Math.min(H * 0.32, W * 0.18)
      svg.setAttribute('width', W)
      svg.setAttribute('height', H)
      svg.setAttribute('viewBox', `0 0 ${W} ${H}`)
      legend.style.top = narrow ? `${cy + R + 36}px` : ''
      const k = R / (maxHi / 2)
      const bx = cx + R * 0.35, by = cy + R + (narrow ? 18 : 26)
      bar.setAttribute('d', `M${bx} ${by - 4}V${by}H${bx + 50 * k}V${by - 4}`)
      barTxt.setAttribute('x', bx + 50 * k + 8)
      barTxt.setAttribute('y', by + 4)
      const base = scale.querySelector('ol').getBoundingClientRect()
      g = { cx, cy, R, k, marks: lis.map((li) => { const r = li.getBoundingClientRect(); return { x: r.left - base.left, w: r.width } }) }
      cur = null
    }
    return Object.assign(self, {
      measure,
      frame(e, p, dt) {
        if (!g) measure()
        if (!g) return
        const idx = stepOf(p, n)
        const r = rows[idx]
        const t = { lo: r.lo.value, hi: r.hi.value, liner: r.liner.value, bore: r.bore.value }
        if (!cur) cur = { ...t }
        let busy = false
        for (const key in t) {
          cur[key] = approach(cur[key], t[key], dt, 170)
          if (cur[key] !== t[key]) busy = true
        }
        const { cx, cy, k } = g
        const set = (c, rr) => { c.setAttribute('cx', cx); c.setAttribute('cy', cy); c.setAttribute('r', Math.max(0, rr)) }
        set(band, ((cur.lo + cur.hi) / 4) * k)
        band.setAttribute('stroke-width', ((cur.hi - cur.lo) / 2) * k)
        set(lo, (cur.lo / 2) * k)
        set(hi, (cur.hi / 2) * k)
        set(liner, (cur.liner / 2) * k)
        set(bore, (cur.bore / 2) * k)
        const c = (cur.hi / 2) * k + 16
        cross.setAttribute('d', `M${cx - c} ${cy}H${cx + c}M${cx} ${cy - c}V${cy + c}`)
        swapTo(legendIn, idx, legendHtml(r))
        lis.forEach((li, j) => li.classList.toggle('on', j === idx))
        mark.style.width = g.marks[idx].w + 'px'
        mark.style.transform = `translateX(${g.marks[idx].x}px)`
        return busy
      },
    })
  }

  // ── 3. Lowered into the well. ──
  function buildDescent() {
    const d = M.descent, r = d.row
    const { scene, stage, still } = sceneOf('descent')
    const world = el('div', 'world')
    const svg = svgEl('svg', { class: 'well-svg', 'aria-hidden': 'true' })
    const defs = svgEl('defs')
    const pat = svgEl('pattern', { id: 'cement', width: 7, height: 7, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' })
    pat.append(svgEl('rect', { width: 7, height: 7, class: 'cem-bg' }), svgEl('line', { x1: 0, y1: 0, x2: 0, y2: 7, class: 'cem-line' }))
    defs.append(pat)
    const fixed = svgEl('g')
    const cemL = svgEl('rect', { class: 'cem' }), cemR = svgEl('rect', { class: 'cem' })
    const linL = svgEl('rect', { class: 'wall-liner' }), linR = svgEl('rect', { class: 'wall-liner' })
    svg.append(defs, fixed, cemL, cemR, linL, linR)
    const pic = img(d.img, d.title)
    const tag = (text) => { const t = el('span', 'tag', text); world.append(t); return t }
    world.append(svg, pic)
    const tags = {
      casing: tag('Previous casing'),
      tool: tag(`${esc(d.code)} sets here`),
      liner: tag(`Liner ${esc(r.liner.label)}`),
      shoe: tag('Casing shoe'),
      hole: tag('Open hole'),
      cem: tag('Cement, when the well is cemented'),
    }
    const txt = el('div', 'shell descent-txt', `${head(d)}<dl class="descent-facts">
      <div><dt>Liner</dt><dd>${esc(r.liner.label)}, ${esc(r.liner.text)} mm</dd></div>
      <div><dt>Installation range</dt><dd>${esc(r.lo.text)} to ${esc(r.hi.text)} mm</dd></div>
      ${r.load ? `<div><dt>Load capacity</dt><dd>${esc(r.load.text)} ${esc(d.unitLoad)}</dd></div>` : ''}</dl><p class="descent-short">Schematic, not to scale.</p>`)
    const note = el('p', 'descent-note', 'Schematic. Casing and liner widths follow one row of the table; the tool’s width and every length are not to scale.')
    stage.append(world, txt, note)
    still.innerHTML = `<div class="still-two"><img src="${d.img.src}" alt="${esc(d.title)}" style="max-height:70vh;width:auto"><div>${txt.innerHTML}</div></div>`

    let g = null
    const measure = () => {
      const W = stage.clientWidth, H = stage.clientHeight
      if (!W) return
      const narrow = W < 900
      const ratio = d.img.thick / d.img.len
      const L = clamp(Math.max(H * 0.62, (narrow ? 52 : 96) / ratio), 0, H * 1.3)
      const toolW = L * ratio
      const k = toolW / (r.lo.value * 0.92)
      const cid = ((r.lo.value + r.hi.value) / 2) * k
      const wall = Math.max(6, cid * 0.07)
      const lin = r.liner.value * k
      const linWall = Math.max(4, lin * 0.08)
      const holeR = (cid / 2) * 0.97
      const cx = narrow ? W * 0.68 : W * 0.64
      const worldH = H * 3.4
      const shoeY = worldH * 0.62
      const landBottom = shoeY - H * 0.3
      world.style.height = worldH + 'px'
      svg.setAttribute('width', W)
      svg.setAttribute('height', worldH)
      svg.setAttribute('viewBox', `0 0 ${W} ${worldH}`)
      // The casing down to its shoe, the open hole below it, and depth ticks that give the descent a speed.
      let hole = ''
      let seed = 7
      const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
      for (const side of [-1, 1]) {
        let dd = `M${cx + side * holeR} ${shoeY}`
        for (let y = shoeY + 14; y < worldH; y += 14) dd += `L${cx + side * (holeR + (rnd() - 0.3) * 7)} ${y}`
        hole += dd
      }
      let ticks = ''
      for (let y = 0; y < worldH; y += 48) ticks += `M${cx - cid / 2 - wall - 44} ${y}h${y % 240 === 0 ? 16 : 8}`
      fixed.innerHTML = ''
      fixed.append(
        svgEl('path', { class: 'ticks', d: ticks }),
        svgEl('rect', { class: 'wall-casing', x: cx - cid / 2 - wall, y: 0, width: wall, height: shoeY }),
        svgEl('rect', { class: 'wall-casing', x: cx + cid / 2, y: 0, width: wall, height: shoeY }),
        svgEl('path', { class: 'shoe', d: `M${cx - cid / 2 - wall} ${shoeY}h${wall}l${-wall} ${-wall * 1.4}zM${cx + cid / 2 + wall} ${shoeY}h${-wall}l${wall} ${-wall * 1.4}z` }),
        svgEl('path', { class: 'hole', d: hole }),
      )
      const at = (t, x, y) => { t.style.transform = narrow ? `translate(${2 * cx - x}px,${y}px) translateX(-100%)` : `translate(${x}px,${y}px)` }
      at(tags.casing, cx + cid / 2 + wall + 12, landBottom - H * 0.9)
      at(tags.tool, cx + cid / 2 + wall + 12, landBottom - L * 0.55)
      at(tags.shoe, cx + cid / 2 + wall + 12, shoeY - 10)
      at(tags.liner, cx + lin / 2 + 12, shoeY + H * 0.22)
      at(tags.hole, cx + holeR + 14, shoeY + H * 0.5)
      at(tags.cem, cx + holeR + 14, shoeY + H * 0.36)
      g = { W, H, L, cx, lin, linWall, holeR, worldH, shoeY, landBottom, narrow }
    }
    return {
      scene, stage, len: 320, measure,
      frame(e, p) {
        if (!g) measure()
        if (!g) return
        const { H, L, cx, lin, linWall, holeR, worldH, shoeY, landBottom } = g
        const down = ease(seg(p, 0.03, 0.6))
        const yc = lerp(-L / 2 - 30, landBottom - L / 2, down)
        const follow = clamp(yc - H * 0.45, 0, worldH - H)
        const after = clamp(shoeY - H * 0.48, 0, worldH - H)
        const cam = lerp(follow, Math.max(follow, after), ease(seg(p, 0.6, 0.8)))
        world.style.transform = `translateY(${-cam}px)`
        pose(pic, d.img, cx, yc, L, 90 - d.img.angle)
        const bottom = yc + L / 2
        for (const [rect, x] of [[linL, cx - lin / 2], [linR, cx + lin / 2 - linWall]]) {
          rect.setAttribute('x', x)
          rect.setAttribute('y', bottom)
          rect.setAttribute('width', linWall)
          rect.setAttribute('height', Math.max(0, worldH - bottom))
        }
        const cemTop = lerp(worldH, landBottom + 8, ease(seg(p, 0.74, 0.96)))
        for (const [rect, x0, x1] of [[cemL, cx - holeR, cx - lin / 2], [cemR, cx + lin / 2, cx + holeR]]) {
          rect.setAttribute('x', x0)
          rect.setAttribute('width', Math.max(0, x1 - x0))
          rect.setAttribute('y', cemTop)
          rect.setAttribute('height', Math.max(0, worldH - cemTop))
        }
        show(tags.casing, seg(p, 0.1, 0.2))
        show(tags.tool, seg(p, 0.56, 0.64))
        show(tags.shoe, seg(p, 0.64, 0.72))
        show(tags.liner, seg(p, 0.66, 0.74))
        show(tags.hole, seg(p, 0.68, 0.76))
        show(tags.cem, seg(p, 0.86, 0.94))
      },
    }
  }

  // ── 4. Tools by pipe size. ──
  function buildFit() {
    const d = M.fit
    const n = d.sizes.length
    const { scene, stage, still } = sceneOf('fit')
    const self = { scene, stage, len: 360 }
    const side = el('div', 'fit-side', `<h2 class="title">Tools by pipe size</h2><p class="fit-size"></p><p class="fit-count"></p>`)
    const sizeEl = side.querySelector('.fit-size'), countEl = side.querySelector('.fit-count')
    const grid = el('ul', 'fit-grid')
    const tiles = d.tools.map((t) => {
      const li = el('li', 'fit-tile', `<img src="${t.img.src}" alt="" decoding="async"><span class="fit-code">${esc(t.code ?? t.title)}</span><span class="fit-role"></span>`)
      li.title = t.title
      grid.append(li)
      return li
    })
    const ruler = el('div', 'fit-ruler', `<ol>${d.sizes.map((s, i) => `<li><button type="button" data-i="${i}">${esc(s.label)}</button></li>`).join('')}</ol><span class="fit-mark"></span>`)
    const rlis = [...ruler.querySelectorAll('li')]
    const rmark = ruler.querySelector('.fit-mark')
    stage.append(side, grid, ruler)
    ruler.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) scrollToState(self, Number(b.dataset.i), n) })
    still.innerHTML = `<h2 class="title">Tools by pipe size</h2><div class="tbl-wrap"><table class="tbl"><thead><tr><th scope="col">Size</th><th scope="col">Tools</th></tr></thead><tbody>${d.sizes
      .map((s) => `<tr><th scope="row">${esc(s.label)}</th><td class="wrap">${d.tools.filter((t) => t.sizes[s.id]).map((t) => esc(t.code ?? t.title)).join(', ')}</td></tr>`)
      .join('')}</tbody></table></div>`
    let marks = null, shown = -1
    const measure = () => {
      const base = ruler.getBoundingClientRect()
      marks = rlis.map((li) => { const r = li.getBoundingClientRect(); return { x: r.left - base.left, w: r.width } })
      shown = -1
    }
    const apply = (idx) => {
      if (idx === shown) return
      shown = idx
      const s = d.sizes[idx]
      let count = 0
      d.tools.forEach((t, j) => {
        const roles = t.sizes[s.id]
        tiles[j].classList.toggle('on', !!roles)
        tiles[j].querySelector('.fit-role').textContent = roles ? roles.map(cap1).join(', ') : ''
        if (roles) count++
      })
      swapTo(sizeEl, idx, `${esc(s.label)}<span>${esc(s.mm)} mm</span>`)
      swapTo(countEl, idx, `${count} of ${d.tools.length} tools have a row for this size`)
      rlis.forEach((li, j) => li.classList.toggle('on', j === idx))
      if (marks?.[idx]) {
        rmark.style.width = marks[idx].w + 'px'
        rmark.style.transform = `translateX(${marks[idx].x}px)`
      }
    }
    return Object.assign(self, {
      measure,
      frame(e, p) {
        if (!marks) measure()
        apply(stepOf(p, n))
      },
    })
  }

  // ── 5. A line that stands up, one tool after another. ──
  function buildWave() {
    const d = M.wave
    const { scene, stage, still } = sceneOf('wave')
    const glow = el('div', 'glow')
    const top = el('div', 'shell wave-head', `<h2 class="title">${esc(d.title)}</h2><p class="code">${d.tools.length} tools</p>`)
    const floor = el('div', 'floor')
    const layer = el('div', 'layer')
    const pics = d.tools.map((t) => { const i = img(t.img, t.title); layer.append(i); return i })
    const codes = d.tools.map((t) => el('span', 'wave-code', esc(t.code ?? t.title)))
    stage.append(glow, top, floor, layer, ...codes)
    still.innerHTML = `<h2 class="title">${esc(d.title)}</h2><div class="still-rack">${d.tools.map((t) => `<a href="#"><img src="${t.img.src}" alt="">${esc(t.code ?? t.title)}</a>`).join('')}</div>`
    let g = null
    const measure = () => {
      const W = stage.clientWidth, H = stage.clientHeight
      if (!W) return
      const narrow = W < 900
      const m = narrow ? 16 : W * 0.05
      const n = narrow ? 6 : d.tools.length
      const slot = (W - 2 * m) / n
      const floorY = narrow ? H * 0.78 : H * 0.8
      floor.style.top = floorY + 'px'
      glow.style.transform = `translate(${W / 2}px,${floorY - H * 0.25}px)`
      g = {
        n, floorY,
        items: d.tools.slice(0, n).map((t, i) => {
          const p = t.img, ratio = p.thick / p.len
          const ux = Math.cos(rad(p.angle)), uy = Math.sin(rad(p.angle))
          const Ls = Math.min(narrow ? H * 0.42 : H * 0.56, (slot * 0.78) / ratio)
          return {
            Ls, Ll: Math.min(slot * 0.84, Ls), ratio,
            xs: m + slot * (i + 0.5), xl: m + slot * (i + 1) - slot * 0.08,
            bx: p.cx + (ux * p.len) / 2, by: p.cy + (uy * p.len) / 2, base: 90 - p.angle,
          }
        }),
      }
      codes.forEach((c, i) => {
        if (i >= n) return show(c, 0)
        c.style.transform = `translate(${g.items[i].xs}px,${floorY + 12}px) translateX(-50%)`
      })
    }
    return {
      scene, stage, len: 240, measure,
      frame(e, p) {
        if (!g) measure()
        if (!g) return
        const { n, floorY, items } = g
        d.tools.forEach((t, i) => {
          if (i >= n) return show(pics[i], 0)
          const it = items[i]
          const a = 0.04 + (n > 1 ? i / (n - 1) : 0) * 0.42
          const k = out(seg(p, a, a + 0.3))
          const L = lerp(it.Ll, it.Ls, k)
          const x = lerp(it.xl, it.xs, k)
          const y = floorY - (1 - k) * ((it.Ll * it.ratio) / 2)
          const s = L / t.img.len
          pics[i].style.transform = `translate(${x}px,${y}px) rotate(${-90 * (1 - k) + it.base}deg) scale(${s}) translate(${-it.bx}px,${-it.by}px)`
          show(pics[i], 1)
          show(codes[i], seg(p, a + 0.26, a + 0.34))
        })
      },
    }
  }

  // ── 6. A film strip. ──
  function buildStrip() {
    const d = M.strip, n = d.tools.length
    const { scene, stage, still } = sceneOf('strip')
    const self = { scene, stage, len: 340 }
    const glow = el('div', 'glow')
    const top = el('div', 'shell strip-head', `<h2 class="title">${esc(d.title)}</h2>`)
    const layer = el('div', 'layer')
    const pics = d.tools.map((t) => { const i = img(t.img, t.title); layer.append(i); return i })
    const cap = el('div', 'shell strip-cap')
    const ticks = el('ol', 'strip-ticks', d.tools.map((t, i) => `<li><button type="button" data-i="${i}" aria-label="${esc(t.title)}"></button></li>`).join(''))
    const tbtns = [...ticks.querySelectorAll('button')]
    stage.append(glow, top, layer, cap, ticks)
    ticks.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) scrollToP(self, Number(b.dataset.i) / (n - 1)) })
    still.innerHTML = `<h2 class="title">${esc(d.title)}</h2><div class="still-sys">${d.tools.map((t) => `<div><img src="${t.img.src}" alt=""><span>${esc(t.title)}</span></div>`).join('')}</div>`
    let g = null
    const measure = () => {
      const W = stage.clientWidth, H = stage.clientHeight
      if (!W) return
      const narrow = W < 900
      const S = narrow ? W * 0.82 : W * 0.36
      const y = narrow ? H * 0.38 : H * 0.42
      g = { W, H, S, y, Ls: d.tools.map((t) => fitLen(t.img, narrow ? W * 0.8 : S * 0.92, narrow ? H * 0.3 : H * 0.42)) }
      glow.style.transform = `translate(${W / 2}px,${y}px)`
    }
    return Object.assign(self, {
      measure,
      frame(e, p) {
        if (!g) measure()
        if (!g) return
        const k = dwell(p * (n - 1))
        d.tools.forEach((t, i) => {
          const dd = i - k, a = Math.min(1, Math.abs(dd))
          if (Math.abs(dd) > 2.6) return show(pics[i], 0)
          pose(pics[i], t.img, g.W / 2 + dd * g.S, g.y, g.Ls[i] * (1 - 0.42 * a))
          show(pics[i], 1 - 0.72 * a)
        })
        const i = clamp(Math.round(k), 0, n - 1), t = d.tools[i]
        swapTo(cap, i, `<div><h3 class="cap-title">${esc(t.title)}</h3>${t.code ? `<p class="code">${esc(t.code)}</p>` : ''}${t.lead ? `<p class="say">${esc(t.lead)}</p>` : ''}</div>${figsHtml(t.figures)}`)
        tbtns.forEach((b, j) => b.setAttribute('aria-current', String(j === i)))
      },
    })
  }

  // ── 7. A deck: each tool lands on the one before. ──
  function buildDeck() {
    const d = M.deck, n = d.tools.length
    const { scene, stage, still } = sceneOf('deck')
    const cards = d.tools.map((t, i) => {
      const c = el('article', 'deck-card', `<div class="deck-text"><p class="deck-n">${i + 1} of ${n}</p>${head(t, 'h3')}${figsHtml(t.figures)}</div><div class="deck-pic"><img src="${t.img.src}" alt="${esc(t.title)}" decoding="async"></div><div class="deck-shade"></div>`)
      stage.append(c)
      return { c, shade: c.querySelector('.deck-shade') }
    })
    still.innerHTML = `<h2 class="title">${esc(d.title)}</h2><div class="still-sys">${d.tools.map((t) => `<div><img src="${t.img.src}" alt=""><span>${esc(t.title)}</span></div>`).join('')}</div>`
    let H = 0
    return {
      scene, stage, len: 320,
      measure() { H = stage.clientHeight },
      frame(e, p) {
        if (!H) H = stage.clientHeight
        const k = dwell(p * (n - 1))
        cards.forEach(({ c, shade }, i) => {
          const enter = i === 0 ? 1 : clamp(k - (i - 1))
          const depth = Math.max(0, k - i)
          if (enter <= 0 || depth > 3.6) return show(c, 0)
          const dp = Math.min(depth, 3)
          c.style.transform = `translateY(${(1 - out(enter)) * H - 14 * dp}px) scale(${1 - 0.045 * dp})`
          shade.style.opacity = String(Math.min(1, depth) * 0.6)
          show(c, 1)
        })
      },
    }
  }

  // ── 8. A departure board: one table, row by row. Each cell flips once, straight to its new character. ──
  function buildBoard() {
    const d = M.board, n = d.rows.length
    const { scene, stage, still } = sceneOf('board')
    const self = { scene, stage, len: 300 }
    const C = Math.max(...d.rows.flat().map((s) => [...s].length))
    const top = el('div', 'shell board-head', `${head(d, 'h2', false)}<p class="board-row"></p>`)
    const rowEl = top.querySelector('.board-row')
    const board = el('div', 'board-grid')
    board.style.setProperty('--cells', C)
    const lines = d.labels.map((label) => {
      const line = el('div', 'board-line', `<span class="board-label">${esc(label)}</span><span class="board-cells">${'<span class="flap"><span class="ch"> </span></span>'.repeat(C)}</span>`)
      board.append(line)
      return [...line.querySelectorAll('.ch')]
    })
    const pic = el('div', 'board-pic', `<img src="${d.img.src}" alt="${esc(d.title)}">`)
    stage.append(top, board, pic)
    still.innerHTML = `${head(d, 'h2', false)}<div class="tbl-wrap"><table class="tbl"><thead><tr>${d.labels.map((l) => `<th scope="col">${esc(l)}</th>`).join('')}</tr></thead><tbody>${d.rows
      .map((r) => `<tr>${r.map((c, j) => (j ? `<td>${esc(c)}</td>` : `<th scope="row">${esc(c)}</th>`)).join('')}</tr>`)
      .join('')}</tbody></table></div>`
    let shown = -1
    const flip = (ch, nv, delay) => {
      ch.dataset.t = nv
      if (ch.dataset.busy) return
      if (ch.textContent === nv) return
      if (state.still || !ch.animate) { ch.textContent = nv; return }
      ch.dataset.busy = '1'
      const a = ch.animate([{ transform: 'rotateX(0deg)' }, { transform: 'rotateX(-90deg)' }], { duration: 80, delay, easing: 'ease-in', fill: 'forwards' })
      a.onfinish = () => {
        ch.textContent = ch.dataset.t
        a.cancel()
        const b = ch.animate([{ transform: 'rotateX(90deg)' }, { transform: 'rotateX(0deg)' }], { duration: 120, easing: 'ease-out' })
        b.onfinish = () => { delete ch.dataset.busy; if (ch.textContent !== ch.dataset.t) flip(ch, ch.dataset.t, 0) }
      }
    }
    const setRow = (i) => {
      if (i === shown) return
      const first = shown < 0
      shown = i
      d.labels.forEach((_, r) => {
        const chars = [...d.rows[i][r]]
        lines[r].forEach((ch, c) => {
          const nv = c < chars.length ? (chars[c] === ' ' ? ' ' : chars[c]) : ' '
          if (first) { ch.textContent = nv; ch.dataset.t = nv } else flip(ch, nv, c * 18 + r * 40)
        })
      })
      swapTo(rowEl, i, `Row ${i + 1} of ${n}`)
    }
    return Object.assign(self, {
      measure() {},
      frame(e, p) { setRow(stepOf(p, n)) },
    })
  }

  // ── 9. A system in orbit around its main tool. ──
  function buildOrbit() {
    const d = M.orbit, n = d.parts.length
    const { scene, stage, still } = sceneOf('orbit')
    const glow = el('div', 'glow')
    const top = el('div', 'shell orbit-head', `<h2 class="title">${esc(d.title)}</h2><p class="code">${esc(d.code)}</p>`)
    const main = img(d.main.img, d.main.title)
    main.style.zIndex = 2
    const pics = d.parts.map((t) => img(t.img, t.title))
    const cap = el('div', 'orbit-cap')
    stage.append(glow, top, main, ...pics, cap)
    still.innerHTML = `<h2 class="title">${esc(d.title)}</h2><p class="code">${esc(d.code)}</p><div class="still-sys">${d.parts.map((t) => `<div><img src="${t.img.src}" alt=""><span>${esc(t.title)} <em>${t.role === 'option' ? 'Optional' : 'Standard'}</em></span></div>`).join('')}</div>`
    let g = null
    const measure = () => {
      const W = stage.clientWidth, H = stage.clientHeight
      if (!W) return
      const narrow = W < 900
      const cx = W / 2, cy = narrow ? H * 0.56 : H * 0.55
      g = {
        cx, cy, rx: narrow ? W * 0.4 : Math.min(W * 0.34, 540), ry: narrow ? H * 0.12 : H * 0.15,
        Ls: d.parts.map((t) => fitLen(t.img, narrow ? W * 0.34 : W * 0.16, narrow ? H * 0.1 : H * 0.13)),
      }
      pose(main, d.main.img, cx, cy - H * 0.04, narrow ? H * 0.46 : H * 0.6, 90 - d.main.img.angle)
      glow.style.transform = `translate(${cx}px,${cy}px)`
    }
    return {
      scene, stage, len: 340, measure,
      frame(e, p) {
        if (!g) measure()
        if (!g) return
        const k = dwell(p * (n - 1))
        let front = 0, best = -2
        d.parts.forEach((t, i) => {
          const f = Math.PI / 2 + ((i - k) * 2 * Math.PI) / n
          const z = Math.sin(f)
          const s = 0.58 + 0.42 * ((z + 1) / 2)
          pose(pics[i], t.img, g.cx + g.rx * Math.cos(f), g.cy + g.ry * z, g.Ls[i] * s)
          show(pics[i], 0.28 + 0.72 * ((z + 1) / 2))
          pics[i].style.zIndex = z > 0 ? 3 : 1
          if (z > best) { best = z; front = i }
        })
        const t = d.parts[front]
        swapTo(cap, front, `<strong>${esc(t.title)}</strong>${t.code ? `<span class="code">${esc(t.code)}</span>` : ''}<span class="orbit-role">${t.role === 'option' ? 'Optional part of the system' : 'Standard part of the system'}</span>`)
      },
    }
  }

  // ── 10. A story in steps: the text scrolls, the picture answers each step. ──
  function buildStory() {
    const d = M.story
    const sec = document.getElementById('story')
    sec.textContent = ''
    const keys = ['install_range_min', 'tool_id_min', 'load_capacity']
    const t = d.table
    const range = (key) => {
      const cells = t.rows.map((r) => r.cells[key]).filter((c) => c && c.value != null)
      if (!cells.length) return null
      return cells.length ? `${t.rows[0].size} to ${t.rows[t.rows.length - 1].size}` : null
    }
    const more = d.withCount - d.with.length
    const steps = [
      { h: 'What it does', body: `<p>${esc(d.purpose)}</p>` },
      { h: 'How it works', body: d.how.map((x) => `<p>${esc(x)}</p>`).join('') },
      { h: 'Sizes', body: `<p>${t.rows.length} sizes in the table, liner ${esc(range(keys[0]) ?? '')}.</p>${figsHtml(d.figures.slice(1, 4))}` },
      { h: 'Combined with', body: `<p>The compatibility table pairs it with ${d.withCount} tools.</p><ul class="story-list">${d.with.map((w) => `<li>${esc(w.title)}</li>`).join('')}${more > 0 ? `<li>and ${more} more</li>` : ''}</ul>` },
    ]
    const wrap = el('div', 'story-body')
    const text = el('div', 'story-steps', `<header class="story-top">${head(d, 'h2', false)}</header>${steps.map((s, i) => `<article class="step" data-i="${i}"><h3>${esc(s.h)}</h3>${s.body}</article>`).join('')}`)
    const stage = el('div', 'story-stage')
    const up = img(d.upright, d.title)
    const lay = img(d.laid, d.title)
    const tbl = el('div', 'story-tbl tbl-wrap', tableHtml(t, keys))
    const ring = d.with.map((w) => {
      const f = el('figure', 'story-with', `<img src="${w.img.src}" alt=""><figcaption>${esc(w.title)}</figcaption>`)
      return f
    })
    stage.append(up, lay, tbl, ...ring)
    wrap.append(text, stage)
    const still = el('div', 'still', `<div class="still-two"><img src="${d.laid.src}" alt="${esc(d.title)}"><div>${head(d, 'h2', false)}${steps.map((s) => `<h3>${esc(s.h)}</h3>${s.body}`).join('')}</div></div><div class="tbl-wrap">${tableHtml(t, keys)}</div>`)
    sec.append(wrap, still)
    const arts = [...text.querySelectorAll('.step')]
    const trs = [...tbl.querySelectorAll('tbody tr')]
    trs.forEach((tr, i) => { tr.style.transitionDelay = `${i * 45}ms` })
    let cur = -1, poses = null
    const measure = () => {
      const W = stage.clientWidth, H = stage.clientHeight
      if (!W) return
      const narrow = W < 700
      const L0 = fitLen(d.upright, W * 0.5, H * 0.84)
      const L1 = fitLen(d.laid, W * 0.9, H * 0.6)
      const L2 = fitLen(d.laid, W * 0.84, H * 0.22)
      const L3 = fitLen(d.laid, W * 0.42, H * 0.18)
      poses = [
        { up: poseOf(d.upright, W / 2, H / 2, L0), upO: 1, lay: poseOf(d.laid, W / 2, H / 2, L1), layO: 0 },
        { up: poseOf(d.upright, W / 2, H / 2, L1, d.turn), upO: 0, lay: poseOf(d.laid, W / 2, H / 2, L1), layO: 1 },
        { up: poseOf(d.upright, W / 2, H * 0.17, L2, d.turn), upO: 0, lay: poseOf(d.laid, W / 2, H * 0.17, L2), layO: 1 },
        { up: poseOf(d.upright, W / 2, H * 0.48, L3, d.turn), upO: 0, lay: poseOf(d.laid, W / 2, H * 0.48, L3), layO: 1 },
      ]
      const rx = W * (narrow ? 0.34 : 0.36), ry = H * 0.33
      ring.forEach((f, i) => {
        const a = -Math.PI / 2 + (i / ring.length) * 2 * Math.PI
        f.style.setProperty('--x', `${W / 2 + rx * Math.cos(a)}px`)
        f.style.setProperty('--y', `${H * 0.48 + ry * Math.sin(a)}px`)
      })
      const c = cur
      cur = -1
      apply(Math.max(0, c))
    }
    const apply = (i) => {
      if (i === cur || !poses) return
      const prev = cur
      cur = i
      sec.dataset.step = i
      const s = poses[i]
      // The turn: the upright render swings to the laid one's axis first, then the two trade places.
      up.style.transitionDelay = prev === 0 && i === 1 ? '0s, .62s' : '0s, 0s'
      lay.style.transitionDelay = prev === 0 && i === 1 ? '0s, .6s' : '0s, 0s'
      up.style.transform = s.up
      up.style.opacity = s.upO
      lay.style.transform = s.lay
      lay.style.opacity = s.layO
      arts.forEach((a, j) => a.classList.toggle('on', j === i))
    }
    const onScroll = () => {
      if (state.still || !poses) return
      const narrow = innerWidth < 900
      const line = narrow ? innerHeight * 0.8 : innerHeight * 0.55
      let idx = 0
      arts.forEach((a, j) => { if (a.getBoundingClientRect().top < line) idx = j })
      apply(idx)
    }
    addEventListener('scroll', onScroll, { passive: true })
    return { measure: () => { measure(); onScroll() } }
  }

  // ── The frame loop (as in ten.js) ──
  let scenes = []
  let running = false
  let lastTime = 0
  const SETTLE = 90

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
  let story = null
  function remeasure() {
    for (const s of scenes) { s.measure(); s.e = s.p = null }
    story?.measure()
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
    if (e.target.closest('a[href="#"]')) e.preventDefault()
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

  scenes = [buildDraw(), buildSection(), buildDescent(), buildFit(), buildWave(), buildStrip(), buildDeck(), buildBoard(), buildOrbit()]
  story = buildStory()
  render()
  applyLengths()
  remeasure()
  addEventListener('scroll', wake, { passive: true })
  addEventListener('resize', remeasure)
  addEventListener('load', remeasure)
  document.fonts?.ready.then(remeasure)
})()
