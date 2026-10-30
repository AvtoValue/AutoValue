// Reads the text of the tab the user is looking at (only when they click the icon) and opens
// AutoValue with it in the URL fragment. Fragments are never sent to a server.
const DEFAULT_URL = 'https://avtovalue.github.io/AutoValue/';
const MAX_TEXT = 50000;

function readPage(maxText) {
  return { url: location.href, title: document.title, text: (document.body ? document.body.innerText : '').slice(0, maxText) };
}

chrome.action.onClicked.addListener(async tab => {
  if (!tab.id || !/^https?:/.test(tab.url || '')) return;
  try {
    const [{ result }] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: readPage, args: [MAX_TEXT] });
    const { appUrl } = await chrome.storage.sync.get({ appUrl: DEFAULT_URL });
    const base = appUrl.split('#')[0];
    await chrome.tabs.create({ url: base + '#ad=' + encodeURIComponent(JSON.stringify(result)), index: tab.index + 1 });
  } catch (e) {
    // Pages such as the Chrome Web Store cannot be read by extensions.
    chrome.action.setBadgeText({ tabId: tab.id, text: '!' });
    chrome.action.setTitle({ tabId: tab.id, title: 'AutoValue cannot read this page' });
  }
});
