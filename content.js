// shit.so — injects a "give a shit" badge under X profile headers.
const API = 'https://shit.so/api/v1/';
const SITE = 'https://shit.so/';
const RESERVED = new Set([
	'home', 'explore', 'notifications', 'messages', 'i', 'settings', 'search',
	'compose', 'login', 'signup', 'logout', 'tos', 'privacy', 'about', 'jobs',
	'hashtag', 'intent', 'share', 'account', 'follower_requests', 'communities',
	'premium', 'grok', 'lists', 'bookmarks', 'verified', 'jobs'
]);

let lastHandle = null;

function currentHandle() {
	const parts = location.pathname.split('/').filter(Boolean);
	if (parts.length !== 1) return null;
	const h = parts[0].toLowerCase();
	if (RESERVED.has(h) || !/^[a-z0-9_]{1,15}$/.test(h)) return null;
	return h;
}

function findAnchor() {
	// The profile header's "UserName" block; we attach right after it.
	return document.querySelector('[data-testid="UserName"]');
}

function render(handle, data) {
	const anchor = findAnchor();
	if (!anchor || anchor.parentElement.querySelector('.shitso-badge')) return;

	const a = document.createElement('a');
	a.className = 'shitso-badge';
	a.href = SITE + handle;
	a.target = '_blank';
	a.rel = 'noopener';

	if (data && data.total > 0) {
		const bad = data.shitScore >= 50;
		a.innerHTML =
			`<span class="shitso-badge__emoji">${data.top ? data.top.char : '💩'}</span>` +
			`<span class="shitso-badge__score ${bad ? 'shitso-badge__score--bad' : 'shitso-badge__score--good'}">${data.shitScore}% shit</span>` +
			`<span class="shitso-badge__cta">· ${data.total} votes · give yours →</span>`;
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
	try {
		const res = await fetch(API + handle);
		if (res.ok) data = await res.json();
	} catch {
		// offline or blocked; still render the CTA
	}
	if (currentHandle() === handle) render(handle, data);
}

new MutationObserver(() => tick()).observe(document.documentElement, {
	childList: true,
	subtree: true
});
tick();
