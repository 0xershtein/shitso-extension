const send = (msg) => new Promise((res) => chrome.runtime.sendMessage(msg, res));
const tr = (navigator.language || 'en').toLowerCase().startsWith('tr');
(async () => {
	const { host } = await send({ type: 'host' });
	const me = await send({ type: 'me' });
	const status = document.getElementById('status');
	const actions = document.getElementById('actions');
	if (me.signedIn) {
		status.innerHTML = `<span class="ok">@${me.handle}</span> · ${me.eligible ? (tr ? 'oy verebilirsin' : 'you can vote') : `<span class="warn">${me.reason || ''}</span>`}`;
	} else {
		status.textContent = tr ? "X'te oy vermek için shit.so'da giriş yap." : 'sign in on shit.so to vote from X.';
		const b = document.createElement('button');
		b.className = 'primary';
		b.textContent = tr ? 'giriş yap' : 'sign in';
		b.onclick = () => send({ type: 'signin' });
		actions.appendChild(b);
	}
	const a = document.createElement('a');
	a.href = host;
	a.target = '_blank';
	a.textContent = host.replace('https://', '');
	actions.appendChild(a);
	const reset = document.createElement('button');
	reset.textContent = tr ? 'sunucuyu yeniden seç' : 'reset host';
	reset.onclick = async () => {
		await chrome.storage.local.remove('host');
		window.close();
	};
	actions.appendChild(reset);
})();
