const DEFAULT_URL = 'https://avtovalue.github.io/AutoValue/';
const input = document.getElementById('appUrl');
chrome.storage.sync.get({ appUrl: DEFAULT_URL }, ({ appUrl }) => { input.value = appUrl; });
document.getElementById('save').addEventListener('click', () => {
  const value = input.value.trim() || DEFAULT_URL;
  if (!/^https?:\/\//i.test(value)) { document.getElementById('saved').textContent = 'Must start with https:// or http://'; return; }
  chrome.storage.sync.set({ appUrl: value }, () => { document.getElementById('saved').textContent = 'Saved'; });
});
