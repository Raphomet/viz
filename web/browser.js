// viz scene browser: the Visual list as collapsible collections, a filter,
// favourites, and a thumbnail grid. Core keeps the registry and the version
// rules and lends them through VIZ.scenes; this file only decides how scenes
// are found and picked. Collections come from collections.js; thumbnails are
// pre-rendered by harness/thumbs.mjs into assets/thumbs/.
//
// Raph (2026-09-29): "the list of sketches is becoming very long and
// unnavigable". The set is played live, by keyboard, in a dark room, so every
// path here is a few keys long and none of it takes focus away from the
// performer keys unless asked (/ and G), and Esc always gives it back.
(function () {
  'use strict';

  var host = window.VIZ && window.VIZ.scenes;
  var C = window.VIZ_COLLECTIONS;
  if (!host || !C) return;

  // Each def's order as registered. A running scene may reuse this.order for
  // its own state (Abyss keeps an array there), which would file it under New.
  var orderAt = {};
  var coreRegister = window.VIZ.register;
  window.VIZ.register = function (def) {
    if (def && typeof def.id === 'string' && !(def.id in orderAt)) orderAt[def.id] = def.order;
    return coreRegister(def);
  };
  function orderOf(def) { return def.id in orderAt ? orderAt[def.id] : def.order; }

  var FAV_KEY = 'viz.favourites';
  var OPEN_KEY = 'viz.browser.open';
  var THUMBS = 'assets/thumbs/';

  // Guarded like core's: private windows and cleared site data can make
  // localStorage throw, and browsing must still work without it.
  function readStore(key) {
    try { var raw = window.localStorage.getItem(key); return raw == null ? null : JSON.parse(raw); }
    catch (e) { return null; }
  }
  function writeStore(key, value) {
    try { window.localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* storage unavailable */ }
  }

  var $ = function (id) { return document.getElementById(id); };
  function el(tag, attrs, text) {
    var n = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === 'class') n.className = attrs[k];
      else n.setAttribute(k, attrs[k]);
    });
    if (text != null) n.textContent = text;
    return n;
  }

  // ------------------------------------------------------------------ state
  // Favourites are family ids in the order they were starred, so starring a
  // new one never renumbers the keys already under the performer's fingers.
  var favs = (function () {
    var f = readStore(FAV_KEY);
    return Array.isArray(f) ? f.filter(function (x) { return typeof x === 'string'; }) : [];
  })();
  var open = (function () {
    var o = readStore(OPEN_KEY);
    return o && typeof o === 'object' && !Array.isArray(o) ? o : null;
  })();
  var query = '';
  var hi = 0;               // highlighted result in the panel's filter
  var thumbs = null;        // id -> version stamp from the manifest; null until known
  var thumbsFailed = false; // no manifest: try each image and fall back on error

  function families() { return host.listed(); }
  function byFamily(id) { return families().filter(function (d) { return d.id === id; })[0] || null; }
  function isFav(id) { return favs.indexOf(id) >= 0; }
  function favDefs() { return favs.map(byFamily).filter(Boolean); }
  function liveFamily() { var c = host.current(); return c ? host.familyOf(c) : null; }
  function collectionOf(def) { return C.of(def, orderOf(def)); }
  function partOf(def, cid) { return C.partOf(def, cid, orderOf(def)); }
  function collectionInfo(id) { return C.list.filter(function (c) { return c.id === id; })[0] || { id: id, name: id }; }

  function toggleFav(id) {
    var i = favs.indexOf(id);
    if (i >= 0) favs.splice(i, 1); else favs.push(id);
    writeStore(FAV_KEY, favs);
    renderAll();
  }

  // First run: Favourites and wherever the live scene lives are open, the rest
  // folded, so the list starts one screen long instead of a hundred rows.
  function isOpen(cid) {
    if (open && cid in open) return !!open[cid];
    if (cid === 'favourites' || cid === 'new') return true;
    var live = liveFamily();
    return !!(live && byFamily(live) && collectionOf(byFamily(live)) === cid);
  }
  function setOpen(cid, v) {
    if (!open) {
      open = {};
      sections().forEach(function (s) { open[s.id] = isOpenDefault(s.id); });
    }
    open[cid] = v;
    writeStore(OPEN_KEY, open);
  }
  function isOpenDefault(cid) { var o = open; open = null; var v = isOpen(cid); open = o; return v; }

  // Collections in display order, each with its scenes in menu order. New
  // sits under Favourites: an unfiled scene is usually the one just made.
  function sections() {
    var groups = {};
    families().forEach(function (def) {
      var cid = collectionOf(def);
      (groups[cid] = groups[cid] || []).push(def);
    });
    var out = [];
    var fd = favDefs();
    if (fd.length) out.push({ id: 'favourites', name: 'Favourites', about: 'Starred here; keys 1–9 play the first nine', defs: fd });
    if (groups['new']) out.push({ id: 'new', name: collectionInfo('new').name, about: collectionInfo('new').about, defs: groups['new'] });
    C.list.forEach(function (c) {
      if (c.id !== 'new' && groups[c.id]) out.push({ id: c.id, name: c.name, about: c.about, parts: c.parts, defs: groups[c.id] });
    });
    // A collection id collections.js maps to but does not list still shows.
    Object.keys(groups).forEach(function (cid) {
      if (!out.some(function (s) { return s.id === cid; })) out.push({ id: cid, name: cid, defs: groups[cid] });
    });
    return out;
  }

  // Every scene once, in the order the collections show them (for [ and ]).
  function canonicalOrder() {
    var out = [];
    sections().forEach(function (s) { if (s.id !== 'favourites') out = out.concat(s.defs); });
    return out;
  }

  // ----------------------------------------------------------------- search
  // Accents folded so "moire" finds Moiré and "guilloche" Guilloché.
  function fold(s) {
    s = String(s || '').toLowerCase();
    return s.normalize ? s.normalize('NFD').replace(/[̀-ͯ]/g, '') : s;
  }

  var hayCache = {};
  function hay(def) {
    var versions = host.versionsOf(def.id);
    var key = def.id + ':' + versions.length;
    if (hayCache[key]) return hayCache[key];
    var cid = collectionOf(def), info = collectionInfo(cid), part = partOf(def, cid);
    var text = [];
    versions.forEach(function (v) {
      var g = v.gallery || {};
      text.push(g.title, g.technique, g.brief, g.lineage);
    });
    return (hayCache[key] = {
      name: fold(def.name || def.id),
      id: fold(versions.map(function (v) { return v.id; }).join(' ')),
      coll: fold([info.name, info.about, part && part.name].join(' ')),
      text: fold(text.join(' '))
    });
  }

  // Every word must land somewhere; where it lands ranks the result, so a
  // name beats a collection and both beat a word in a brief.
  function score(def, terms) {
    var h = hay(def), total = 0;
    for (var i = 0; i < terms.length; i++) {
      var t = terms[i], s = 0;
      if (h.name.indexOf(t) === 0) s = 100;
      else if ((' ' + h.name).indexOf(' ' + t) >= 0) s = 80;
      else if (h.name.indexOf(t) >= 0) s = 60;
      else if (h.id.indexOf(t) >= 0) s = 50;
      else if (h.coll.indexOf(t) >= 0) s = 30;
      else if (h.text.indexOf(t) >= 0) s = 10;
      else return 0;
      total += s;
    }
    return total;
  }

  function search(q) {
    var terms = fold(q).split(/\s+/).filter(Boolean);
    if (!terms.length) return [];
    var order = canonicalOrder();
    return order.map(function (def, i) { return { def: def, s: score(def, terms), i: i }; })
      .filter(function (r) { return r.s > 0; })
      .sort(function (a, b) { return b.s - a.s || a.i - b.i; })
      .map(function (r) { return r.def; });
  }

  // -------------------------------------------------------------- thumbnails
  function loadThumbs() {
    if (!window.fetch) { thumbsFailed = true; return; }
    fetch(THUMBS + 'manifest.json', { cache: 'no-cache' })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (m) { thumbs = m && typeof m === 'object' ? m : {}; renderAll(); })
      .catch(function () { thumbsFailed = true; renderAll(); });
  }

  // The thumbnail of whichever version the entry currently plays.
  function thumbFor(def) {
    var shown = host.chosenVersion(def.id) || def;
    var ids = [shown.id, def.id];
    for (var i = 0; i < ids.length; i++) {
      if (thumbs && thumbs[ids[i]]) return THUMBS + ids[i] + '.jpg?v=' + encodeURIComponent(thumbs[ids[i]]);
    }
    return thumbsFailed ? THUMBS + shown.id + '.jpg' : null;
  }

  // Missing thumbnails get a typographic tile rather than a hole.
  function thumbEl(def, eager) {
    var box = el('span', { class: 'vthumb' });
    var type = el('span', { class: 'vtype' });
    type.appendChild(el('span', { class: 'vtype-name' }, def.name || def.id));
    box.appendChild(type);
    var src = thumbFor(def);
    if (src) {
      var img = el('img', { alt: '', loading: eager ? 'eager' : 'lazy', decoding: 'async', draggable: 'false' });
      img.addEventListener('load', function () { box.classList.add('has-img'); });
      img.addEventListener('error', function () { img.remove(); });
      img.src = src;
      box.appendChild(img);
    }
    return box;
  }

  // -------------------------------------------------------------- the panel
  var ui = null;

  function buildShell() {
    var list = $('viz-list');
    if (!list || ui) return;
    var bar = el('div', { class: 'vfind' });
    var wrap = el('div', { class: 'vfind-field' });
    var input = el('input', {
      type: 'search', id: 'viz-find', placeholder: 'Find a visual', autocomplete: 'off', spellcheck: 'false',
      'aria-label': 'Find a visual', 'aria-controls': 'viz-list', enterkeyhint: 'go'
    });
    wrap.appendChild(input);
    wrap.appendChild(el('kbd', { class: 'vfind-key', 'aria-hidden': 'true' }, '/'));
    bar.appendChild(wrap);
    var gridBtn = el('button', { type: 'button', class: 'btn vgrid-open', id: 'viz-grid-open', title: 'Browse as thumbnails (G)' });
    gridBtn.appendChild(el('span', null, 'Grid'));
    gridBtn.appendChild(el('kbd', null, 'G'));
    gridBtn.addEventListener('click', function () { openGrid(); });
    bar.appendChild(gridBtn);
    list.parentNode.insertBefore(bar, list);

    input.addEventListener('input', function () { query = input.value; hi = 0; renderList(); });
    input.addEventListener('keydown', function (e) {
      var results = query.trim() ? search(query) : [];
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        if (!results.length) return;
        hi = (hi + (e.key === 'ArrowDown' ? 1 : -1) + results.length) % results.length;
        renderList();
        e.preventDefault();
      } else if (e.key === 'Enter') {
        if (!results.length) return;
        var def = results[Math.min(hi, results.length - 1)];
        // Shift+Enter auditions and keeps looking; Enter plays and hands the
        // keys back to the performer.
        if (e.shiftKey) host.select(def.id);
        else { clearFind(); host.select(def.id); }
        e.preventDefault();
      } else if (e.key === 'Escape') {
        clearFind();
        e.preventDefault();
      }
    });
    ui = { input: input, list: list };
  }

  function clearFind() {
    query = ''; hi = 0;
    if (ui) { ui.input.value = ''; ui.input.blur(); }
    renderList();
  }

  function focusFind() {
    buildShell();
    if (!ui) return;
    ui.input.focus();
    ui.input.select();
    ui.input.scrollIntoView({ block: 'nearest' });
  }

  function versionTag(def, live, idSuffix) {
    var versions = host.versionsOf(def.id);
    if (versions.length < 2) return null;
    // As before: the tag names the newest version, filled while it is live.
    var shown = live === def.id ? host.current() : host.chosenVersion(def.id);
    var newest = versions[versions.length - 1];
    var attrs = { class: 'vtag' + (shown === newest ? ' live' : ''), title: 'Showing ' + host.versionLabel(shown) };
    if (idSuffix) attrs.id = idSuffix;
    return { tag: el('span', attrs, host.versionLabel(newest)), label: host.versionLabel(shown) };
  }

  function sceneRow(def, opts) {
    var live = liveFamily();
    var row = el('div', { class: 'vrow' + (opts.hi ? ' hi' : ''), 'aria-current': String(live === def.id) });
    if (opts.rowId) row.id = opts.rowId;
    var pick = el('button', { type: 'button', class: 'vpick', id: opts.id });
    if (opts.key) pick.appendChild(el('kbd', null, opts.key));
    pick.appendChild(el('span', { class: 'vname' }, def.name || def.id));
    if (opts.note) pick.appendChild(el('span', { class: 'vnote' }, opts.note));
    var vt = versionTag(def, live, opts.canonical ? 'viz-' + def.id + '-version' : null);
    if (vt) { pick.appendChild(vt.tag); pick.setAttribute('data-version', vt.label); }
    pick.addEventListener('click', function () { host.select(def.id); });
    row.appendChild(pick);
    var fav = isFav(def.id);
    // Text content on purpose: harness/fps.mjs finds a scene by an element
    // whose text ends with its name, and must land on the button, not the row.
    var star = el('button', {
      type: 'button', class: 'vstar', 'aria-pressed': String(fav),
      'aria-label': (fav ? 'Unstar ' : 'Star ') + (def.name || def.id),
      title: fav ? 'Remove from Favourites' : 'Add to Favourites'
    }, fav ? '★' : '☆');
    star.addEventListener('click', function () { toggleFav(def.id); });
    row.appendChild(star);
    attachPeek(row, def);
    return row;
  }

  function renderList() {
    buildShell();
    if (!ui) return;
    var list = ui.list;
    var focusId = list.contains(document.activeElement) ? document.activeElement.id : null;
    list.textContent = '';
    var fams = families();
    if (!fams.length) { list.appendChild(el('p', { class: 'empty' }, 'No visuals loaded.')); return; }

    if (query.trim()) {
      var results = search(query);
      if (hi >= results.length) hi = Math.max(0, results.length - 1);
      list.appendChild(el('p', { class: 'vcount', role: 'status' }, results.length
        ? results.length + (results.length === 1 ? ' match' : ' matches') + ' · ↑↓ then Enter'
        : 'Nothing matches “' + query.trim() + '”.'));
      results.forEach(function (def, i) {
        var cid = collectionOf(def), part = partOf(def, cid);
        list.appendChild(sceneRow(def, {
          id: 'viz-' + def.id, canonical: true, hi: i === hi, rowId: i === hi ? 'viz-find-hi' : null,
          note: part ? part.name : collectionInfo(cid).name
        }));
      });
      var h = $('viz-find-hi');
      if (h) h.scrollIntoView({ block: 'nearest' });
      return;
    }

    var fd = favDefs();
    var live = liveFamily();
    // Number badges show whatever 1-9 plays: favourites once there are any,
    // otherwise the first nine scenes, as before.
    var numbered = fd.length ? fd.slice(0, 9) : fams.slice(0, 9);
    sections().forEach(function (s) {
      var isFavs = s.id === 'favourites';
      var opened = isOpen(s.id);
      var box = el('div', { class: 'vcoll' + (isFavs ? ' favs' : '') + (s.id === 'new' ? ' fresh' : '') });
      var head = el('button', {
        type: 'button', class: 'vcoll-head', id: 'vcoll-' + s.id, 'aria-expanded': String(opened),
        title: s.about || ''
      });
      head.appendChild(el('span', { class: 'vcaret', 'aria-hidden': 'true' }));
      head.appendChild(el('span', { class: 'vcoll-name' }, s.name));
      // Where the live scene is, even with its collection folded.
      if (!isFavs && s.defs.some(function (d) { return d.id === live; })) {
        head.appendChild(el('span', { class: 'vcoll-live', title: 'The live scene is in here' }));
      }
      head.appendChild(el('span', { class: 'vcoll-n' }, String(s.defs.length)));
      head.addEventListener('click', function (e) {
        // Alt-click folds or unfolds every collection at once.
        if (e.altKey) {
          var to = !opened;
          sections().forEach(function (x) { setOpen(x.id, to); });
        } else setOpen(s.id, !opened);
        renderList();
      });
      box.appendChild(head);
      // Folded rows stay in the DOM, hidden: harness/fps.mjs (and anything
      // else that finds a scene by its label) must reach every scene.
      {
        var body = el('div', { class: 'vcoll-body', role: 'group', 'aria-labelledby': 'vcoll-' + s.id });
        body.hidden = !opened;
        var lastPart = null;
        s.defs.forEach(function (def) {
          var part = s.parts ? partOf(def, s.id) : null;
          if (part && part !== lastPart) body.appendChild(el('p', { class: 'vpart' }, part.name));
          lastPart = part;
          var n = numbered.indexOf(def);
          var showKey = n >= 0 && (fd.length ? isFavs : true);
          body.appendChild(sceneRow(def, {
            id: isFavs ? 'viz-fav-' + def.id : 'viz-' + def.id,
            canonical: !isFavs,
            key: showKey ? String(n + 1) : null
          }));
        });
        box.appendChild(body);
      }
      list.appendChild(box);
    });
    if (focusId && $(focusId)) $(focusId).focus();
  }

  // Hovering a row shows its thumbnail beside the panel, so the list can be
  // skimmed by eye without opening the grid. Mouse only, and only where the
  // panel sits beside the stage.
  var peek = null;
  var canPeek = window.matchMedia ? window.matchMedia('(hover: hover) and (min-width: 721px)') : null;
  function attachPeek(row, def) {
    row.addEventListener('pointerenter', function (e) {
      if (e.pointerType !== 'mouse' || !canPeek || !canPeek.matches) return;
      var src = thumbFor(def);
      if (!src || (thumbs == null && !thumbsFailed)) return;
      if (!peek) {
        peek = el('div', { class: 'vpeek', 'aria-hidden': 'true' });
        peek.appendChild(el('img', { alt: '' }));
        peek.querySelector('img').addEventListener('error', function () { peek.hidden = true; });
        document.body.appendChild(peek);
      }
      var img = peek.querySelector('img');
      if (img.getAttribute('src') !== src) img.src = src;
      var r = row.getBoundingClientRect(), panel = $('panel').getBoundingClientRect();
      var h = 180, top = Math.max(8, Math.min(window.innerHeight - h - 8, r.top + r.height / 2 - h / 2));
      peek.style.top = top + 'px';
      peek.style.left = (panel.left - 320 - 12) + 'px';
      peek.hidden = false;
    });
    row.addEventListener('pointerleave', function () { if (peek) peek.hidden = true; });
  }

  // --------------------------------------------------------------- the grid
  var grid = null;   // { root, body, input, tiles: [{ el, def }], hi, returnFocus }

  function buildGrid() {
    var root = el('div', { class: 'vgrid', id: 'viz-grid', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Visuals' });
    root.hidden = true;
    var bar = el('div', { class: 'vgrid-bar' });
    bar.appendChild(el('h2', { class: 'vgrid-title' }, 'Visuals'));
    var input = el('input', {
      type: 'search', id: 'viz-grid-find', placeholder: 'Find', autocomplete: 'off', spellcheck: 'false',
      'aria-label': 'Find a visual', 'aria-controls': 'viz-grid-body', enterkeyhint: 'go'
    });
    bar.appendChild(input);
    bar.appendChild(el('span', { class: 'vgrid-hint' }, '←↑↓→ move · Enter play · Esc close'));
    var close = el('button', { type: 'button', class: 'btn vgrid-close', id: 'viz-grid-close', 'aria-label': 'Close', title: 'Close (Esc)' }, '×');
    close.addEventListener('click', closeGrid);
    bar.appendChild(close);
    root.appendChild(bar);
    var body = el('div', { class: 'vgrid-body', id: 'viz-grid-body' });
    root.appendChild(body);
    // Clicking the backdrop between sections closes, like any overlay.
    body.addEventListener('click', function (e) { if (e.target === body) closeGrid(); });
    input.addEventListener('input', function () { renderGrid(); });
    input.addEventListener('keydown', gridKey);
    grid = { root: root, body: body, input: input, tiles: [], hi: -1, returnFocus: null };
  }

  function tile(def, idPrefix) {
    var cell = el('div', { class: 'vcell' });
    var live = liveFamily();
    var b = el('button', { type: 'button', class: 'vtile', id: idPrefix + def.id, tabindex: '-1', 'aria-current': String(live === def.id) });
    b.appendChild(thumbEl(def));
    var cap = el('span', { class: 'vcap' });
    cap.appendChild(el('span', { class: 'vname' }, def.name || def.id));
    var vt = versionTag(def, live, null);
    if (vt) cap.appendChild(vt.tag);
    b.appendChild(cap);
    b.addEventListener('click', function () { pickFromGrid(def, false); });
    cell.appendChild(b);
    var fav = isFav(def.id);
    var star = el('button', {
      type: 'button', class: 'vstar', tabindex: '-1', 'aria-pressed': String(fav),
      'aria-label': (fav ? 'Unstar ' : 'Star ') + (def.name || def.id)
    }, fav ? '★' : '☆');
    star.addEventListener('click', function (e) {
      e.stopPropagation();
      var keep = grid.body.scrollTop;
      toggleFav(def.id);
      grid.body.scrollTop = keep;
      grid.input.focus();
    });
    cell.appendChild(star);
    grid.tiles.push({ el: b, def: def });
    return cell;
  }

  function gridSection(title, about, defs, idPrefix, parts, sid) {
    var sec = el('section', { class: 'vgrid-sec', 'aria-label': title });
    var h = el('h3', { class: 'vgrid-head' });
    h.appendChild(el('span', { class: 'vgrid-name' }, title));
    if (about) h.appendChild(el('span', { class: 'vgrid-about' }, about));
    h.appendChild(el('span', { class: 'vcoll-n' }, String(defs.length)));
    sec.appendChild(h);
    var tiles = el('div', { class: 'vgrid-tiles' });
    var lastPart = null;
    defs.forEach(function (def) {
      var part = parts ? partOf(def, sid) : null;
      if (part && part !== lastPart) tiles.appendChild(el('p', { class: 'vpart' }, part.name));
      lastPart = part;
      tiles.appendChild(tile(def, idPrefix));
    });
    sec.appendChild(tiles);
    return sec;
  }

  function renderGrid(keepHi) {
    if (!grid) return;
    var prevId = keepHi && grid.tiles[grid.hi] ? grid.tiles[grid.hi].el.id : null;
    var scroll = grid.body.scrollTop;
    grid.body.textContent = '';
    grid.tiles = [];
    var q = grid.input.value.trim();
    if (q) {
      var results = search(q);
      if (results.length) grid.body.appendChild(gridSection(results.length + (results.length === 1 ? ' match' : ' matches'), null, results, 'vtile-'));
      else grid.body.appendChild(el('p', { class: 'vgrid-empty' }, 'Nothing matches “' + q + '”.'));
      setGridHi(results.length ? 0 : -1);
      grid.body.scrollTop = 0;
      return;
    }
    sections().forEach(function (s) {
      grid.body.appendChild(gridSection(s.name, s.about, s.defs, s.id === 'favourites' ? 'vtile-fav-' : 'vtile-', s.parts, s.id));
    });
    var idx = -1;
    if (prevId) grid.tiles.forEach(function (t, i) { if (t.el.id === prevId) idx = i; });
    if (idx < 0) {
      // Start on the live scene in its own collection, not its Favourites copy.
      var live = liveFamily();
      grid.tiles.forEach(function (t, i) { if (idx < 0 && t.def.id === live && t.el.id.indexOf('vtile-fav-') !== 0) idx = i; });
    }
    if (keepHi) grid.body.scrollTop = scroll;
    setGridHi(idx < 0 ? 0 : idx, !keepHi);
  }

  function setGridHi(i, center) {
    if (grid.tiles[grid.hi]) grid.tiles[grid.hi].el.classList.remove('hi');
    grid.hi = i;
    var t = grid.tiles[i];
    if (!t) { grid.input.removeAttribute('aria-activedescendant'); return; }
    t.el.classList.add('hi');
    grid.input.setAttribute('aria-activedescendant', t.el.id);
    t.el.scrollIntoView({ block: center ? 'center' : 'nearest' });
  }

  // Up and down go to the nearest tile in the next row, by position, so the
  // grid can reflow to any width without the arithmetic knowing its columns.
  function moveVertical(dir) {
    var cur = grid.tiles[grid.hi];
    if (!cur) return setGridHi(0);
    var a = cur.el.getBoundingClientRect(), ax = a.left + a.width / 2;
    var best = -1, bestD = Infinity;
    grid.tiles.forEach(function (t, i) {
      var b = t.el.getBoundingClientRect();
      var dy = dir > 0 ? b.top - a.top : a.top - b.top;
      if (dy < a.height / 2) return;
      var d = dy * 4 + Math.abs(b.left + b.width / 2 - ax);
      if (d < bestD) { bestD = d; best = i; }
    });
    if (best >= 0) setGridHi(best);
  }

  function gridKey(e) {
    var n = grid.tiles.length;
    if (e.key === 'Escape') { closeGrid(); e.preventDefault(); return; }
    if (!n) return;
    if (e.key === 'ArrowRight') setGridHi(Math.min(n - 1, grid.hi + 1));
    else if (e.key === 'ArrowLeft') setGridHi(Math.max(0, grid.hi - 1));
    else if (e.key === 'ArrowDown') moveVertical(1);
    else if (e.key === 'ArrowUp') moveVertical(-1);
    else if (e.key === 'Enter') { if (grid.tiles[grid.hi]) pickFromGrid(grid.tiles[grid.hi].def, e.shiftKey); }
    else return;
    e.preventDefault();
  }

  function pickFromGrid(def, stay) {
    host.select(def.id);
    if (!stay) closeGrid();
  }

  function openGrid(withQuery) {
    if (!grid) buildGrid();
    if (!grid.root.hidden) { grid.input.focus(); return; }
    grid.returnFocus = document.activeElement;
    // Fullscreen shows only the stage, so the grid has to live inside it then.
    var hostEl = document.fullscreenElement || document.body;
    if (grid.root.parentNode !== hostEl) hostEl.appendChild(grid.root);
    grid.input.value = withQuery || '';
    grid.root.hidden = false;
    renderGrid();
    grid.input.focus();
  }

  function closeGrid() {
    if (!grid || grid.root.hidden) return;
    grid.root.hidden = true;
    grid.input.blur();
    var back = grid.returnFocus;
    grid.returnFocus = null;
    // Back to the performer keys, never into a text field.
    if (back && back.focus && back !== document.body && back.tagName !== 'INPUT') back.focus();
  }

  function gridOpen() { return !!(grid && !grid.root.hidden); }

  // -------------------------------------------------------------- the keys
  // Called by core's key handler, after its own performer keys, with no
  // modifier held and focus outside any text field. Returns true when used.
  // T, B, comma and period stay free for the tempo row
  // (docs/superpowers/specs/2026-09-28-input-design.md).
  function onKey(e) {
    var k = e.key;
    if (k === '/') {
      if ($('app') && $('app').classList.contains('panel-hidden')) openGrid();
      else focusFind();
      return true;
    }
    if (k === 'g' || k === 'G') { if (gridOpen()) closeGrid(); else openGrid(); return true; }
    if (k === '[' || k === ']') {
      var order = canonicalOrder(), live = liveFamily();
      if (!order.length) return true;
      var i = order.map(function (d) { return d.id; }).indexOf(live);
      var next = order[(i + (k === ']' ? 1 : -1) + order.length) % order.length];
      if (i < 0) next = order[0];
      host.select(next.id);
      return true;
    }
    if (/^[1-9]$/.test(k)) {
      var fd = favDefs();
      if (!fd.length) return false;   // no favourites: core's first-nine behaviour
      var def = fd[Number(k) - 1];
      if (def) host.select(def.id);
      return true;
    }
    return false;
  }

  function renderAll() {
    renderList();
    if (gridOpen()) renderGrid(true);
  }

  host.browser = { render: renderAll, onKey: onKey, openGrid: openGrid, closeGrid: closeGrid };
  loadThumbs();
})();
