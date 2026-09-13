// shit.so — injects a "give a shit" badge under X profile headers.
// shit.so DNS may lag; fall back to the vercel alias.
const HOSTS = ['https://shit.so', 'https://shitso.vercel.app'];
let host = HOSTS[0];
const API = () => host + '/api/v1/';
const SITE = () => host + '/';
const RESERVED = new Set([
	'home', 'explore', 'notifications', 'messages', 'i', 'settings', 'search',
	'compose', 'login', 'signup', 'logout', 'tos', 'privacy', 'about', 'jobs',
	'hashtag', 'intent', 'share', 'account', 'follower_requests', 'communities',
	'premium', 'grok', 'lists', 'bookmarks', 'verified'
]);
const TIER_COLOR = { respected: '#10b981', questionable: '#eab308', certified: '#f59e0b', biohazard: '#ef4444' };

let lastHandle = null;

function currentHandle() {
	const parts = location.pathname.split('/').filter(Boolean);
	if (parts.length !== 1) return null;
	const h = parts[0].toLowerCase();
	if (RESERVED.has(h) || !/^[a-z0-9_]{1,15}$/.test(h)) return null;
	return h;
}

function findAnchor() {
	return document.querySelector('[data-testid="UserName"]');
}

function esc(s) {
	return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

function render(handle, data) {
	const anchor = findAnchor();
	if (!anchor || anchor.parentElement.querySelector('.shitso-badge')) return;

	const a = document.createElement('a');
	a.className = 'shitso-badge';
	a.href = SITE() + '@' + handle;
	a.target = '_blank';
	a.rel = 'noopener';

	if (data && data.total > 0) {
		const tier = data.tier || {};
		const color = TIER_COLOR[tier.key] || '#a3a3a3';
		a.style.borderColor = color;
		a.innerHTML =
			`<span class="shitso-badge__emoji">${esc(tier.emoji || (data.top ? data.top.char : '💩'))}</span>` +
			`<span class="shitso-badge__score" style="color:${color}">${esc(data.shitScore)}% shit</span>` +
			(tier.key && tier.key !== 'unrated' ? `<span class="shitso-badge__tier" style="color:${color}">· ${esc(tier.label)}</span>` : '') +
			`<span class="shitso-badge__cta">· ${esc(data.total)} votes${data.last24h ? ` · 🔥 ${esc(data.last24h)} today` : ''} · give yours →</span>`;
		if (tier.warning) a.title = tier.warning;
	} else {
		a.innerHTML =
			`<span class="shitso-badge__emoji">💩</span>` +
			`<span class="shitso-badge__cta">nobody gave a shit yet · be first →</span>`;
	}
	anchor.insertAdjacentElement('afterend', a);
}

async function tick() {
	const handle = currentHandle();
	if (!handle) {
		lastHandle = null;
		return;
	}
	const anchor = findAnchor();
	if (!anchor) return;
	if (handle === lastHandle && anchor.parentElement.querySelector('.shitso-badge')) return;
	lastHandle = handle;
	document.querySelectorAll('.shitso-badge').forEach((n) => n.remove());

	let data = null;
	for (const h of [host, ...HOSTS.filter((x) => x !== host)]) {
		try {
			const res = await fetch(h + '/api/v1/' + handle);
			if (res.ok) {
				data = await res.json();
				host = h;
				break;
			}
		} catch {
			// try next host
		}
	}
	if (currentHandle() === handle) render(handle, data);
}

new MutationObserver(() => tick()).observe(document.documentElement, { childList: true, subtree: true });
tick();
