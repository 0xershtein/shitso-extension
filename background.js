// Service worker: talks to shit.so with the user's site session.
// Extension requests with host permissions carry cookies regardless of SameSite,
// so signing in on shit.so once is enough to vote from X.
const HOSTS = ['https://shit.so', 'https://shitso.vercel.app'];
let host = null;

async function pickHost() {
	if (host) return host;
	const stored = (await chrome.storage.local.get('host')).host;
	if (stored) return (host = stored);
	for (const h of HOSTS) {
		try {
			const r = await fetch(h + '/api/v1/me', { credentials: 'include' });
			if (r.ok) {
				host = h;
				await chrome.storage.local.set({ host: h });
				return h;
			}
		} catch {
			/* next */
		}
	}
	return (host = HOSTS[1]);
}

async function api(path, init = {}) {
	const h = await pickHost();
	const r = await fetch(h + path, { credentials: 'include', ...init });
	const body = await r.json().catch(() => ({}));
	return { status: r.status, ...body };
}

chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
	(async () => {
		switch (msg.type) {
			case 'host':
				return reply({ host: await pickHost() });
			case 'me':
				return reply(await api('/api/v1/me'));
			case 'tally':
				return reply(await api('/api/v1/tally?handles=' + encodeURIComponent(msg.handles.join(','))));
			case 'vote':
				return reply(
					await api('/api/v1/vote', {
						method: 'POST',
						headers: { 'content-type': 'application/json' },
						body: JSON.stringify({ handle: msg.handle, emoji: msg.emoji })
					})
				);
			case 'observe':
				return reply(
					await api('/api/v1/observe', {
						method: 'POST',
						headers: { 'content-type': 'application/json' },
						body: JSON.stringify({ handle: msg.handle, followers: msg.followers, following: msg.following, name: msg.name })
					})
				);
			case 'signin': {
				const h = await pickHost();
				await chrome.tabs.create({ url: h + '/signin?redirectTo=/' });
				return reply({ ok: true });
			}
			case 'open': {
				const h = await pickHost();
				await chrome.tabs.create({ url: h + '/@' + msg.handle });
				return reply({ ok: true });
			}
			default:
				return reply({ error: 'unknown message' });
		}
	})().catch((e) => reply({ error: String(e) }));
	return true; // async reply
});
