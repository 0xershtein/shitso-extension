// shit.so content script: "give a shit" pills in the X feed + a badge on profile headers.
const EMOJIS = [
	{ key: 'shit', char: '💩', en: 'shit', tr: 'boktan', bad: true },
	{ key: 'cap', char: '🧢', en: 'cap', tr: 'dümenci', bad: true },
	{ key: 'clown', char: '🤡', en: 'clown', tr: 'palyaço', bad: true },
	{ key: 'snake', char: '🐍', en: 'snake', tr: 'manipülatör', bad: true },
	{ key: 'bot', char: '🤖', en: 'npc', tr: 'npc', bad: true },
	{ key: 'brain', char: '🧠', en: 'big brain', tr: 'yetkin', bad: false },
	{ key: 'fire', char: '🔥', en: 'fire', tr: 'karizma', bad: false },
	{ key: 'goat', char: '🐐', en: 'goat', tr: 'zirve', bad: false },
	{ key: 'respect', char: '🫡', en: 'respect', tr: 'hayranlık', bad: false },
	{ key: 'gem', char: '💎', en: 'gem', tr: 'sahici', bad: false }
];
const TIER = {
	unrated: { color: '#a3a3a3', emoji: '❓', en: 'unrated', tr: 'puansız' },
	respected: { color: '#10b981', emoji: '🫡', en: 'respected', tr: 'saygın' },
	questionable: { color: '#eab308', emoji: '🤨', en: 'questionable', tr: 'şüpheli' },
	certified: { color: '#f59e0b', emoji: '💩', en: 'certified shit', tr: 'onaylı shit' },
	biohazard: { color: '#ef4444', emoji: '☣️', en: 'biohazard', tr: 'biyolojik tehlike' }
};
const L = (navigator.language || 'en').toLowerCase().startsWith('tr') ? 'tr' : 'en';
const T = {
	en: { give: 'give a shit', yours: 'your shit', shit: 'shit', votes: 'votes', vote: 'vote', remove: "i don't give a shit anymore", signin: 'sign in on shit.so to vote', open: 'open on shit.so →', none: 'nobody gave a shit yet', self: 'this is you' },
	tr: { give: 'give a shit', yours: 'senin shitin', shit: 'shit', votes: 'oy', vote: 'oy', remove: 'artık umrumda değil', signin: "oy için shit.so'da giriş yap", open: "shit.so'da aç →", none: 'henüz kimse shit vermedi', self: 'bu sensin' }
}[L];
const RESERVED = new Set(['home', 'explore', 'notifications', 'messages', 'i', 'settings', 'search', 'compose', 'login', 'signup', 'logout', 'tos', 'privacy', 'about', 'jobs', 'hashtag', 'intent', 'share', 'account', 'follower_requests', 'communities', 'premium', 'grok', 'lists', 'bookmarks', 'verified']);

const send = (msg) => new Promise((res) => chrome.runtime.sendMessage(msg, res));
const cache = new Map(); // handle -> { at, data }
const TTL = 60_000;
let me = null; // { signedIn, handle, eligible, reason }
let pendingHandles = new Set();
let flushTimer = null;

function validHandle(h) {
	return h && /^[a-z0-9_]{1,15}$/.test(h) && !RESERVED.has(h);
}
function esc(s) {
	return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

async function refreshMe() {
	me = await send({ type: 'me' });
	return me;
}

function queueTally(handle) {
	const hit = cache.get(handle);
	if (hit && Date.now() - hit.at < TTL) return Promise.resolve(hit.data);
	return new Promise((resolve) => {
		pendingHandles.add(handle);
		waiters.set(handle, [...(waiters.get(handle) || []), resolve]);
		clearTimeout(flushTimer);
		flushTimer = setTimeout(flush, 150);
	});
}
const waiters = new Map();
async function flush() {
	const handles = [...pendingHandles].slice(0, 50);
	pendingHandles = new Set([...pendingHandles].slice(50));
	if (handles.length === 0) return;
	const res = await send({ type: 'tally', handles });
	for (const h of handles) {
		const data = (res.results || []).find((r) => r.handle === h) || { handle: h, total: 0, shitScore: 0, top: null, tier: 'unrated', mine: null };
		cache.set(h, { at: Date.now(), data });
		(waiters.get(h) || []).forEach((fn) => fn(data));
		waiters.delete(h);
	}
	if (pendingHandles.size) flush();
}

function pillHtml(data) {
	if (!data || data.total === 0) return `<span class="shitso-pill__emoji">💩</span><span class="shitso-pill__text">${T.give}</span>`;
	const tier = TIER[data.tier] || TIER.unrated;
	const mineChar = data.mine ? EMOJIS.find((e) => e.key === data.mine)?.char : null;
	return (
		`<span class="shitso-pill__emoji">${mineChar || tier.emoji}</span>` +
		`<span class="shitso-pill__score" style="color:${tier.color}">${data.shitScore}%</span>` +
		`<span class="shitso-pill__text">· ${data.total}</span>`
	);
}

function paint(pill, data) {
	pill.innerHTML = pillHtml(data);
	pill.classList.toggle('shitso-pill--mine', !!(data && data.mine));
	const tier = TIER[(data && data.tier) || 'unrated'];
	pill.style.borderColor = data && data.total ? tier.color : '';
}

// ---------- picker ----------
let picker = null;
function closePicker() {
	picker?.remove();
	picker = null;
}
document.addEventListener('click', (e) => {
	if (picker && !picker.contains(e.target) && !e.target.closest('.shitso-pill')) closePicker();
});
document.addEventListener('keydown', (e) => e.key === 'Escape' && closePicker());

async function openPicker(pill, handle) {
	closePicker();
	await refreshMe(); // cheap, and catches sign-out on the site
	const data = cache.get(handle)?.data;
	picker = document.createElement('div');
	picker.className = 'shitso-picker';
	const tier = TIER[(data && data.tier) || 'unrated'];
	const isSelf = me && me.signedIn && me.handle === handle;
	let head = `<div class="shitso-picker__head"><span>@${esc(handle)}</span>`;
	head += data && data.total ? `<span style="color:${tier.color}">${tier.emoji} ${esc(tier[L])} · ${data.shitScore}% ${T.shit} · ${data.total} ${T.votes}</span>` : `<span>${T.none}</span>`;
	head += '</div>';
	let body = '';
	if (!me || !me.signedIn) {
		body = `<button class="shitso-picker__cta" data-act="signin">${T.signin}</button>`;
	} else if (isSelf) {
		body = `<div class="shitso-picker__note">${T.self}</div>`;
	} else if (!me.eligible) {
		body = `<div class="shitso-picker__note">${esc(me.reason || '')}</div>`;
	} else {
		body = '<div class="shitso-picker__grid">';
		for (const e of EMOJIS) {
			const active = data && data.mine === e.key;
			body += `<button class="shitso-picker__emoji ${active ? 'is-active' : ''}" data-emoji="${e.key}" title="${esc(e[L])}"><span>${e.char}</span><small>${esc(e[L])}</small></button>`;
		}
		body += '</div>';
		if (data && data.mine) body += `<button class="shitso-picker__remove" data-emoji="none">${T.remove}</button>`;
	}
	body += `<button class="shitso-picker__open" data-act="open">${T.open}</button>`;
	picker.innerHTML = head + body;
	document.body.appendChild(picker);

	const r = pill.getBoundingClientRect();
	const w = picker.offsetWidth;
	picker.style.top = `${Math.min(r.bottom + 8, window.innerHeight - picker.offsetHeight - 8)}px`;
	picker.style.left = `${Math.max(8, Math.min(r.left, window.innerWidth - w - 8))}px`;

	picker.addEventListener('click', async (ev) => {
		const btn = ev.target.closest('button');
		if (!btn) return;
		ev.preventDefault();
		ev.stopPropagation();
		if (btn.dataset.act === 'signin') return send({ type: 'signin' });
		if (btn.dataset.act === 'open') return send({ type: 'open', handle });
		const emoji = btn.dataset.emoji;
		if (!emoji) return;
		btn.classList.add('is-busy');
		const res = await send({ type: 'vote', handle, emoji });
		if (res.ok) {
			const fresh = { handle, total: res.total, shitScore: res.shitScore, top: res.top, tier: tierFor(res.shitScore, res.total), mine: res.mine };
			cache.set(handle, { at: Date.now(), data: fresh });
			document.querySelectorAll(`.shitso-pill[data-handle="${handle}"]`).forEach((p) => paint(p, fresh));
			burst(btn, EMOJIS.find((e) => e.key === emoji)?.char || '💩');
			setTimeout(closePicker, 350);
		} else {
			btn.classList.remove('is-busy');
			const note = document.createElement('div');
			note.className = 'shitso-picker__note shitso-picker__note--error';
			note.textContent = res.error || 'error';
			picker.querySelector('.shitso-picker__note--error')?.remove();
			picker.appendChild(note);
			if (res.status === 401) me = null;
		}
	});
}

function tierFor(score, total) {
	if (total < 3) return 'unrated';
	if (score >= 80) return 'biohazard';
	if (score >= 50) return 'certified';
	if (score >= 25) return 'questionable';
	return 'respected';
}

function burst(el, char) {
	if (!el || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
	const r = el.getBoundingClientRect();
	for (let i = 0; i < 12; i++) {
		const p = document.createElement('span');
		p.className = 'shitso-burst';
		p.textContent = char;
		const a = (Math.PI * 2 * i) / 12 + (Math.random() - 0.5) * 0.6;
		const d = 50 + Math.random() * 70;
		p.style.setProperty('--dx', `${Math.cos(a) * d}px`);
		p.style.setProperty('--dy', `${Math.sin(a) * d - 30}px`);
		p.style.left = `${r.left + r.width / 2}px`;
		p.style.top = `${r.top + r.height / 2}px`;
		document.body.appendChild(p);
		p.addEventListener('animationend', () => p.remove(), { once: true });
	}
}

// ---------- injection ----------
function makePill(handle, big) {
	const pill = document.createElement('button');
	pill.type = 'button';
	pill.className = 'shitso-pill' + (big ? ' shitso-pill--big' : '');
	pill.dataset.handle = handle;
	pill.innerHTML = pillHtml(null);
	pill.addEventListener('click', (e) => {
		e.preventDefault();
		e.stopPropagation();
		openPicker(pill, handle);
	});
	queueTally(handle).then((d) => paint(pill, d));
	return pill;
}

function handleFromUserName(block) {
	// X marks the author block with data-testid="User-Name"; the @handle is a link to /handle.
	for (const a of block.querySelectorAll('a[href^="/"]')) {
		const m = a.getAttribute('href').match(/^\/([A-Za-z0-9_]{1,15})$/);
		if (m && a.textContent.trim().startsWith('@')) return m[1].toLowerCase();
	}
	return null;
}

function injectFeed() {
	for (const block of document.querySelectorAll('article[data-testid="tweet"] [data-testid="User-Name"]')) {
		if (block.dataset.shitso) continue;
		const handle = handleFromUserName(block);
		if (!validHandle(handle)) continue;
		block.dataset.shitso = '1';
		const pill = makePill(handle, false);
		block.appendChild(pill);
	}
}

function currentProfile() {
	const parts = location.pathname.split('/').filter(Boolean);
	if (parts.length !== 1) return null;
	const h = parts[0].toLowerCase();
	return validHandle(h) ? h : null;
}

function injectProfile() {
	const handle = currentProfile();
	const anchor = document.querySelector('[data-testid="UserName"]');
	const existing = anchor?.parentElement?.querySelector('.shitso-pill--big');
	if (!handle || !anchor) {
		existing?.remove();
		return;
	}
	observeProfile(handle);
	if (existing && existing.dataset.handle === handle) return;
	existing?.remove();
	anchor.insertAdjacentElement('afterend', makePill(handle, true));
}

// ---------- profile observation (follower counts, no X API cost) ----------
// X renders compact numbers: "1,234", "12.5K", "1.2M" (en) or "12,5 B", "1,2 Mn" (tr).
function parseCompact(text, lang = (document.documentElement.lang || navigator.language || '').toLowerCase()) {
	if (text == null) return null;
	const s = String(text).replace(/[\s\u00a0\u202f]+/g, '');
	const m = s.match(/^([\d.,]+)([A-Za-z]{0,2})$/);
	if (!m) return null;
	const num = m[1];
	const suffix = m[2].toLowerCase();
	if (suffix === '') {
		if (!/^(\d{1,3}([.,]\d{3})+|\d+)$/.test(num)) return null;
		return parseInt(num.replace(/[.,]/g, ''), 10);
	}
	// "B" is billion on the English UI and "bin" (thousand) on the Turkish UI.
	const factor = { k: 1e3, m: 1e6, mn: 1e6, b: lang.startsWith('tr') ? 1e3 : 1e9 }[suffix];
	if (!factor) return null;
	const parts = num.split(/[.,]/);
	if (parts.length > 2 || parts.some((p) => p === '')) return null;
	const val = parseFloat(parts.join('.'));
	return Number.isFinite(val) ? Math.round(val * factor) : null;
}

const observed = new Map(); // handle -> { at, followers, following }
const OBSERVE_TTL = 10 * 60_000;

function readProfileCounts(handle) {
	const pick = (suffix) => {
		// X keeps the handle's original casing in hrefs; match case-insensitively.
		const a =
			document.querySelector(`a[href="/${handle}/${suffix}" i]`) ||
			document.querySelector(`a[href$="/${handle}/${suffix}" i]`);
		if (!a) return null;
		const span = a.querySelector('span span') || a.querySelector('span');
		return parseCompact(span?.textContent);
	};
	const followers = pick('verified_followers') ?? pick('followers');
	const following = pick('following');
	const nameSpan = document.querySelector('[data-testid="UserName"] span');
	const name = nameSpan?.textContent?.trim() || undefined;
	const avatarImg = document.querySelector(`a[href="/${handle}/photo" i] img[src*="profile_images"]`) || document.querySelector('img[src*="profile_images"][src*="_200x200"], img[src*="profile_images"][src*="_400x400"]');
	const avatar = avatarImg?.src || undefined;
	return { followers, following, name, avatar };
}

function observeProfile(handle) {
	const { followers, following, name, avatar } = readProfileCounts(handle);
	if (followers == null || following == null) return;
	const prev = observed.get(handle);
	if (prev && Date.now() - prev.at < OBSERVE_TTL && prev.followers === followers && prev.following === following) return;
	observed.set(handle, { at: Date.now(), followers, following });
	send({ type: 'observe', handle, followers, following, name, avatar }).catch(() => {});
}

let scheduled = false;
function tick() {
	if (scheduled) return;
	scheduled = true;
	requestAnimationFrame(() => {
		scheduled = false;
		injectFeed();
		injectProfile();
	});
}
new MutationObserver(tick).observe(document.documentElement, { childList: true, subtree: true });
refreshMe().then(tick);
