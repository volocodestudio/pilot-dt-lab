// Motion lab. No libraries: native scroll, a pinned (sticky) stage, transforms and opacity only.
// The page's scroll is never captured. Each frame only reads how far the page has moved.
(() => {
  const LAB = window.LAB
  const root = document.documentElement
  const reduce = matchMedia('(prefers-reduced-motion: reduce)')
  const params = new URLSearchParams(location.search)
  const state = {
    look: params.get('look') ?? 'dark',
    tempo: Number(params.get('tempo') ?? 1),
    still: params.has('still') ? params.get('still') === '1' : reduce.matches,
    tool: 0,
  }
  // A tool by its id (pl-lh-hsg, landing-collar|type I) or by its place in the list; the hanger by default.
  {
    const asked = params.get('tool')
    const byId = LAB.one.findIndex((o) => o.id === (asked ?? 'pl-lh-hsg'))
    state.tool = byId >= 0 ? byId : clampIndex(Number(asked))
  }
  function clampIndex(i) { return Number.isFinite(i) ? Math.min(LAB.one.length - 1, Math.max(0, Math.round(i))) : 0 }

  // ── helpers ──
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v))
  const seg = (v, a, b) => clamp((v - a) / (b - a))
  const lerp = (a, b, t) => a + (b - a) * t
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)
  const out = (t) => 1 - (1 - t) ** 3
  const el = (tag, cls, html) => {
    const n = document.createElement(tag)
    if (cls) n.className = cls
    if (html != null) n.innerHTML = html
    return n
  }
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
  const picture = (p, alt = '') => {
    const i = new Image(p.w, p.h)
    i.src = p.src
    i.alt = alt
    i.decoding = 'async'
    i.draggable = false
    i.style.width = p.w + 'px'
    i.style.height = p.h + 'px'
    return i
  }
  const noNav = (e) => { if (e.target.closest('a[href="#"]')) e.preventDefault() }
  document.addEventListener('click', noNav)

  const figsHtml = (figures) =>
    figures.length
      ? `<dl class="figs">${figures.map((f) => `<div class="fig"><dt>${esc(f.label)}</dt><dd>${esc(f.value)}</dd></div>`).join('')}</dl>`
      : ''

  // ── Type 1: one tool. The upright and the laid render share one axis, so the turn reads as one object. ──
  function buildOne() {
    const scene = document.getElementById('one')
    scene.textContent = ''
    const d = LAB.one[state.tool]
    const stage = el('div', 'stage')
    const glow = el('div', 'glow')
    const paper = el('div', 'paper')
    const layer = el('div', 'layer')
    const axis = el('div', 'axis')
    const up = picture(d.upright, `${d.title}, upright`)
    const laid = picture(d.laid, '')
    layer.append(axis, up, laid)

    const txtUp = el('div', 'shell txt-up', `
      <h2 class="title">${esc(d.title)}</h2>
      ${d.code ? `<p class="code">${esc(d.code)}</p>` : ''}
      <p class="lead">${esc(d.lead)}</p>`)
    const txtLay = el('div', 'shell txt-lay', `
      <div>
        <h3 class="title">${esc(d.title)}</h3>
        ${d.code ? `<p class="code">${esc(d.code)}</p>` : ''}
        ${d.advantages.length ? `<ul class="adv">${d.advantages.map((a) => `<li>${esc(a)}</li>`).join('')}</ul>` : ''}
      </div>
      <div class="figs-side">
        ${figsHtml(d.figures)}
        <div class="btns"><a class="btn btn-main" href="#">Request a selection</a>${d.figures.length ? '<a class="btn btn-out" href="#">Size table</a>' : ''}</div>
      </div>`)
    stage.append(glow, paper, layer, txtUp, txtLay)

    const still = el('div', 'still still-one', `
      <img class="v" src="${d.upright.src}" alt="${esc(d.title)}, upright">
      <div>
        <h2 class="title">${esc(d.title)}</h2>
        ${d.code ? `<p class="code">${esc(d.code)}</p>` : ''}
        <p class="lead">${esc(d.lead)}</p>
        <img class="b" src="${d.laid.src}" alt="${esc(d.title)}, view from below">
        ${figsHtml(d.figures)}
        <div class="btns" style="margin-top:14px"><a class="btn btn-main" href="#">Request a selection</a>${d.figures.length ? '<a class="btn btn-out" href="#">Size table</a>' : ''}</div>
      </div>`)
    scene.append(stage, still)

    // The turn is measured per pair (build.mjs): the upright axis onto the laid one, with the end that really leads.
    // Squat kits and pairs whose two views disagree get a plain change of view; a fake turn would read as a glitch.
    const turn = d.turn
    const fade = d.mode !== 'turn'
    let g = null
    const measure = () => {
      const W = stage.clientWidth, H = stage.clientHeight
      const narrow = W < 900
      const gutter = Math.max(16, W * 0.04)
      // A thick tool standing upright is shortened until its width leaves room for the text, and it stays inside the frame.
      const upRatio = d.upright.thick / d.upright.len
      const upLen = Math.min(narrow ? H * 0.8 : H * 0.88, (narrow ? W * 0.36 : W * 0.26) / upRatio)
      const upHalf = (upLen * upRatio) / 2
      const b = d.laid
      const toLaidPx = (L) => L / b.len
      // The laid picture takes the width it can, but leaves room under it for the text.
      const textRoom = narrow ? Math.max(H * 0.52, 290) : Math.max(H * 0.36, 250)
      const maxH = H - textRoom - (narrow ? 16 : 36)
      const maxW = W - (narrow ? 8 : gutter * 2.4)
      const scale = Math.min(maxW / b.w, maxH / b.h)
      const layLen = b.len * scale
      g = {
        W, H,
        upLen,
        upX: Math.min(narrow ? W * 0.82 : W * 0.72, W - upHalf - 12),
        upY: narrow ? H * 0.53 : H * 0.5,
        layLen,
        layX: W * 0.5,
        layY: (H - textRoom) / 2 + (narrow ? 4 : 10),
        toLaidPx,
        layScale: scale,
        upScale: Math.min((narrow ? W * 0.46 : W * 0.4) / d.upright.w, (narrow ? H * 0.5 : H * 0.84) / d.upright.h),
      }
    }
    const frameFade = (e, p) => {
      const rise = out(seg(e, 0.25, 1))
      const lay = ease(seg(p, 0.16, 0.58))
      layer.style.transform = 'none'
      const lift = (1 - rise) * g.H * 0.14
      up.style.transform = `translate(${g.upX}px,${g.upY + lift}px) scale(${g.upScale}) translate(${-d.upright.w / 2}px,${-d.upright.h / 2}px)`
      const s = g.layScale * lerp(0.94, 1, seg(lay, 0.4, 1))
      laid.style.transform = `translate(${g.layX}px,${g.layY}px) scale(${s}) translate(${-d.laid.w / 2}px,${-d.laid.h / 2}px)`
      // The two views overlap in time: a dip to an empty stage between them reads as a fault.
      laid.style.opacity = seg(lay, 0.25, 0.55)
      up.style.opacity = 1 - seg(lay, 0.4, 0.7)
      glow.style.transform = `translate(${lerp(g.upX, g.layX, lay)}px,${lerp(g.upY, g.layY, lay)}px)`
    }
    return {
      scene, stage, len: 230, measure,
      frame(e, p) {
        if (!g) measure()
        if (fade) frameFade(e, p)
        else turnFrame(e, p)
        texts(p)
      },
    }
    function turnFrame(e, p) {
        const rise = out(seg(e, 0.25, 1))
        const lay = ease(seg(p, 0.16, 0.58))
        // A slight dip in the length and a late rise keep the turning tool inside the stage.
        const L = lerp(g.upLen, g.layLen, lay) * (1 - 0.1 * Math.sin(Math.PI * lay))
        const X = lerp(g.upX, g.layX, lay)
        const Y = lerp(g.upY, g.layY, seg(lay, 0.35, 1)) + (1 - rise) * g.H * 0.14
        const th = turn * lay
        layer.style.transform = `translate(${X}px,${Y}px) rotate(${th}deg)`
        up.style.transform = `scale(${L / d.upright.len}) translate(${-d.upright.cx}px,${-d.upright.cy}px)`
        laid.style.transform = `rotate(${-turn}deg) scale(${L / d.laid.len}) translate(${-d.laid.cx}px,${-d.laid.cy}px)`
        // The laid render arrives late and fast, over the upright one, which leaves only once it is covered.
        // Earlier the two perspectives disagree too much, and the overlap reads as an X-ray.
        laid.style.opacity = seg(lay, 0.72, 0.86)
        up.style.opacity = 1 - seg(lay, 0.86, 0.92)
        glow.style.transform = `translate(${X}px,${Y}px)`
    }
    function texts(p) {
        const a = 1 - seg(p, 0.1, 0.24)
        txtUp.style.opacity = a
        txtUp.style.visibility = a <= 0 ? 'hidden' : 'visible'
        const b = seg(p, 0.56, 0.7)
        txtLay.style.opacity = b
        txtLay.style.visibility = b <= 0 ? 'hidden' : 'visible'
        txtLay.style.transform = `translateY(${(1 - out(b)) * 14}px)`
    }
  }

  // ── Type 2: the line. Tools rise through the floor; a soft focus walks along them with the scroll. ──
  function buildLine() {
    const scene = document.getElementById('line')
    const d = LAB.line
    const n = d.tools.length
    const stage = el('div', 'stage')
    const paper = el('div', 'paper')
    const head = el('div', 'shell head', `<h2 class="title">${esc(d.title)}</h2>`)
    const rack = el('div', 'rack')
    const track = el('div', 'rack-track')
    const floor = el('div', 'floor')
    const caption = el('div', 'shell caption')
    const links = d.tools.map((t) => {
      const a = el('a', 'rack-tool')
      a.href = '#'
      a.setAttribute('aria-label', t.title)
      const i = new Image()
      i.src = t.img.src
      i.alt = ''
      i.draggable = false
      a.append(i)
      track.append(a)
      return a
    })
    rack.append(track)
    stage.append(paper, head, rack, floor, caption)

    const still = el('div', 'still')
    still.innerHTML = `<h2 class="title">${esc(d.title)}</h2><div class="still-rack">${d.tools
      .map((t) => `<a href="#"><img src="${t.img.src}" alt="">${esc(t.title)}</a>`)
      .join('')}</div>`
    scene.append(stage, still)

    let g = null, shown = -1, picked = null, focus = 0, last = 0
    const say = (i) => {
      if (i === shown) return
      shown = i
      const t = d.tools[i]
      caption.innerHTML = `<div><h3>${esc(t.title)}</h3>${t.code ? `<p class="code">${esc(t.code)}</p>` : ''}</div>
        <p class="say">${esc(t.lead)}</p>
        <div class="btns"><a class="btn btn-out" href="#">View product</a></div>`
      caption.animate?.([{ opacity: 0 }, { opacity: 1 }], { duration: 180, easing: 'ease-out' })
    }
    links.forEach((a, i) => {
      a.addEventListener('pointerenter', () => { if (a.matches(':hover')) { picked = i; wake() } })
      a.addEventListener('focus', () => { picked = i; wake() })
    })
    const measure = () => {
      const W = stage.clientWidth, H = stage.clientHeight
      const narrow = W < 900
      const headH = head.offsetHeight + head.offsetTop + 8
      const capH = narrow ? 226 : 150
      const floorY = H - capH - 14
      const lift = H * 0.03
      const toolH = Math.max(160, floorY - headH - lift - 18)
      const gap = narrow ? 18 : clamp(W * 0.018, 14, 34)
      let total = 0
      const mids = []
      links.forEach((a, i) => {
        const t = d.tools[i].img
        const w = (toolH * t.w) / t.h
        a.style.width = w + 'px'
        a.style.height = toolH + 'px'
        a.style.marginRight = (i < n - 1 ? gap : 0) + 'px'
        mids.push(total + w / 2)
        total += w + gap
      })
      total -= gap
      rack.style.top = '0'
      rack.style.height = floorY + 'px'
      floor.style.top = floorY + 'px'
      caption.style.top = floorY + 14 + 'px'
      const fits = total <= W - 32
      g = { W, H, toolH, total, mids, fits, startX: fits ? (W - total) / 2 : 0 }
    }
    return {
      scene, stage, len: 220, measure,
      clearPick() { picked = null },
      frame(e, p, dt) {
        if (!g) measure()
        const riseAll = clamp(seg(e, 0.55, 1) * 0.72 + seg(p, 0, 0.14) * 0.28)
        const walk = seg(p, 0.14, 0.96) * (n - 1)
        const target = picked ?? walk
        // The pointer's and the keyboard's pick glides; the scroll's own position is already smoothed.
        focus = picked == null && Math.abs(focus - target) < 0.6 ? target : lerp(focus, target, 1 - Math.exp(-dt / 110))
        last = focus
        const dim = root.dataset.look === 'dark' ? 0.34 : 0.5
        links.forEach((a, i) => {
          const r = out(clamp(riseAll * (n * 0.34 + 1) - i * 0.34))
          const d2 = (i - focus) ** 2
          const w = Math.exp(-d2 / 1.1)
          const y = (1 - r) * (g.toolH + 40) - w * g.H * 0.022
          a.style.transform = `translateY(${y}px) scale(${1 + w * 0.05})`
          a.style.opacity = lerp(1, lerp(dim, 1, w), seg(riseAll, 0.8, 1))
        })
        if (!g.fits) {
          const lo = Math.floor(focus), hi = Math.min(n - 1, lo + 1)
          const mid = lerp(g.mids[lo], g.mids[hi], focus - lo)
          track.style.transform = `translateX(${g.W / 2 - mid}px)`
        } else {
          track.style.transform = `translateX(${g.startX}px)`
        }
        say(clamp(Math.round(focus), 0, n - 1))
        return Math.abs(focus - target) > 0.002
      },
    }
  }

  // ── Type 3: the system. Each component slides in along its own axis and stops in a parallel tray. ──
  function buildSystem() {
    const scene = document.getElementById('system')
    const d = LAB.system
    const n = d.items.length
    const stage = el('div', 'stage')
    const glow = el('div', 'glow')
    const paper = el('div', 'paper')
    const head = el('div', 'shell head', `
      <h2 class="title">${esc(d.title)}</h2>
      <p class="code">${esc(d.code)}</p>
      <p class="lead">${esc(d.lead)}</p>
      <div class="btns"><a class="btn btn-main" href="#">Request this system</a></div>`)
    const cta = head.querySelector('.btns')
    stage.append(glow, paper)
    const slant = d.items.reduce((s, i) => s + i.img.angle, 0) / n
    const rows = d.items.map((it) => {
      const layer = el('div', 'layer')
      const axis = el('div', 'axis')
      axis.style.transform = `rotate(${slant - 90}deg)`
      const img = picture(it.img, it.title)
      layer.append(axis, img)
      const tag = el('div', 'tag', `${esc(it.title)}${it.role === 'option' ? ' <span>optional</span>' : ''}`)
      stage.append(layer)
      return { it, layer, img, tag, axis }
    })
    // Names stand above every picture, whichever tool arrives later.
    rows.forEach((r) => stage.append(r.tag))
    stage.append(head)

    const still = el('div', 'still')
    still.innerHTML = `<h2 class="title">${esc(d.title)}</h2><p class="code">${esc(d.code)}</p><p class="lead">${esc(d.lead)}</p>
      <div class="still-sys">${d.items
        .map((i) => `<div><img src="${i.img.src}" alt=""><span>${esc(i.title)}${i.role === 'option' ? ' <em>optional</em>' : ''}</span></div>`)
        .join('')}</div>
      <div class="btns" style="margin-top:20px"><a class="btn btn-main" href="#">Request this system</a></div>`
    scene.append(stage, still)

    let g = null
    const measure = () => {
      const W = stage.clientWidth, H = stage.clientHeight
      const narrow = W < 900
      const rad = (slant * Math.PI) / 180
      const left = narrow ? 8 : head.offsetLeft + head.offsetWidth + 16
      const right = W - (narrow ? 8 : 20)
      const top = narrow ? head.offsetTop + head.offsetHeight + 18 : 34
      const bottom = H - (narrow ? 74 : 26)
      const trayW = right - left, trayH = bottom - top
      // One length for all, so the set reads as a set; the picture's real thickness stays as rendered.
      const L = Math.min(trayW / Math.cos(rad), (trayH * 0.72) / Math.sin(rad))
      const rise = L * Math.sin(rad)
      const step = n > 1 ? (trayH - rise - 18) / (n - 1) : 0
      const cx = (left + right) / 2
      const y0 = top + rise / 2 + 18
      // Equal lengths would make a thick tool a giant, so a tool is shortened until it fits its own row.
      // All rows start from one line at the upper left. On-screen lengths are not to scale, and the page must not imply it.
      // The row keeps a strip free above each tool, so its name never lands on the tool above.
      const maxThick = step * (narrow ? 0.68 : 0.8)
      for (const r of rows) {
        const im = r.it.img
        const thick = im.thick / im.len
        r.len = Math.min(L, maxThick / thick)
        r.thick = r.len * thick
        r.shift = (r.len - L) / 2
        // The centre line runs a little past each end of its own tool, never across the text beside the tray.
        r.axis.style.height = r.len + 56 + 'px'
        r.axis.style.top = -(r.len + 56) / 2 + 'px'
      }
      if (narrow) {
        cta.style.left = '0'; cta.style.right = '0'
        cta.style.top = bottom - head.offsetTop + 14 + 'px'
      } else {
        cta.style.left = cta.style.right = cta.style.top = ''
      }
      g = { W, H, L, rad, step, cx, y0 }
    }
    return {
      scene, stage, len: 240, measure,
      frame(e, p) {
        if (!g) measure()
        const reach = Math.hypot(g.W, g.H) * 1.05
        rows.forEach((r, i) => {
          const a = 0.04 + i * 0.165
          const t = out(seg(p, a, a + 0.21))
          // Alternate ends: a set closing from both sides. Optional parts come last, after a small pause.
          const dir = i % 2 ? -1 : 1
          const off = (1 - t) * reach * dir + r.shift
          const x = g.cx + Math.cos(g.rad) * off
          const y = g.y0 + i * g.step + Math.sin(g.rad) * off
          r.layer.style.transform = `translate(${x}px,${y}px)`
          const s = r.len / r.it.img.len
          // Each render is turned by its small difference from the set's slant, so the tools lie exactly parallel.
          r.img.style.transform = `rotate(${slant - r.it.img.angle}deg) scale(${s}) translate(${-r.it.img.cx}px,${-r.it.img.cy}px)`
          r.layer.style.visibility = t <= 0 ? 'hidden' : 'visible'
          // The name stands above the tool's upper end, and appears once the tool has nearly stopped.
          const lx = g.cx - (Math.cos(g.rad) * g.L) / 2
          const ly = g.y0 + i * g.step - (Math.sin(g.rad) * g.L) / 2
          const show = seg(t, 0.82, 1)
          r.tag.style.opacity = show
          r.tag.style.transform = `translate(${Math.max(6, lx)}px,${Math.max(2, ly - r.thick / 2 - 22)}px)`
        })
        glow.style.transform = `translate(${g.cx}px,${g.H / 2}px)`
        if (g.W < 900) {
          const c = seg(p, 0.86, 0.96)
          cta.style.opacity = c
          cta.style.visibility = c <= 0 ? 'hidden' : 'visible'
        } else {
          cta.style.opacity = ''
          cta.style.visibility = ''
        }
      },
    }
  }

  // ── The frame loop: one smoothed progress per scene, and it sleeps when nothing is left to do. ──
  let scenes = []
  let running = false
  let lastTime = 0
  const SETTLE = 90 // ms: the time constant that takes the steps out of a mouse wheel

  function targets(s) {
    const r = s.scene.getBoundingClientRect()
    const vh = innerHeight
    const bar = s.stage.getBoundingClientRect().height
    const span = r.height - bar
    const top = r.top - (vh - bar)
    return { e: clamp(1 - (r.top - (vh - bar)) / bar), p: clamp((vh - bar - r.top) / Math.max(1, span)), near: r.bottom > -vh && r.top < vh * 2, top }
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
    root.dataset.look = state.look
    root.classList.toggle('is-still', state.still)
    document.querySelectorAll('[data-set]').forEach((b) => {
      const on = String(state[b.dataset.set] === true ? 1 : state[b.dataset.set] === false ? 0 : state[b.dataset.set]) === b.dataset.value
      b.setAttribute('aria-pressed', on ? 'true' : 'false')
    })
  }

  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-set]')
    if (!b) return
    const key = b.dataset.set
    const before = state[key]
    if (key === 'still') state.still = b.dataset.value === '1'
    else if (key === 'look') state.look = b.dataset.value
    else state[key] = Number(b.dataset.value)
    if (state[key] === before) return
    render()
    if (key === 'tool') { scenes[0] = buildOne(); applyLengths(); scenes[0].measure() }
    if (key === 'tempo') applyLengths()
    if (key === 'look' || key === 'tool' || key === 'still' || key === 'tempo') remeasure()
  })
  // The tool list: every product and part with both views; a plain change of view is marked.
  const pickEl = document.getElementById('tool-pick')
  LAB.one.forEach((o, i) => {
    const opt = document.createElement('option')
    opt.value = String(i)
    opt.textContent = o.mode === 'turn' ? o.title : `${o.title} (без повороту)`
    pickEl.append(opt)
  })
  const setTool = (i) => {
    const next = clampIndex(i)
    pickEl.value = String(next)
    if (next === state.tool) return
    state.tool = next
    scenes[0] = buildOne(); applyLengths(); scenes[0].measure()
    const u = new URL(location.href)
    u.searchParams.set('tool', LAB.one[next].id)
    history.replaceState(null, '', u)
    remeasure()
  }
  pickEl.value = String(state.tool)
  pickEl.addEventListener('change', () => setTool(Number(pickEl.value)))
  document.querySelectorAll('[data-step]').forEach((b) => b.addEventListener('click', () => setTool(state.tool + Number(b.dataset.step))))

  const bar = document.querySelector('.bar')
  document.querySelector('.bar-toggle').addEventListener('click', (e) => {
    const open = bar.classList.toggle('open')
    e.currentTarget.setAttribute('aria-expanded', String(open))
  })
  reduce.addEventListener('change', () => { state.still = reduce.matches; render(); remeasure() })

  scenes = [buildOne(), buildLine(), buildSystem()]
  render()
  applyLengths()
  remeasure()
  let lastY = scrollY
  addEventListener('scroll', () => {
    // A real scroll hands the focus back to the page after a pointer pick.
    if (Math.abs(scrollY - lastY) > 12) { scenes[1].clearPick?.(); lastY = scrollY }
    wake()
  }, { passive: true })
  addEventListener('resize', remeasure)
  addEventListener('load', remeasure)
  document.fonts?.ready.then(remeasure)
})()
