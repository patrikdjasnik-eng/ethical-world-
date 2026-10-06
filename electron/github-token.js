const tokenInput = document.getElementById('token');
const connectButton = document.getElementById('connect');
const errorLabel = document.getElementById('error');
document.getElementById('token-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  connectButton.disabled = true;
  const token = tokenInput.value.trim();
  tokenInput.value = '';
  try { await window.githubTokenPrompt.submit(token); }
  catch { errorLabel.textContent = 'Token se nepodařilo předat. Zkus připojení znovu.'; connectButton.disabled = false; }
});
document.getElementById('cancel').addEventListener('click', async () => {
  tokenInput.value = '';
  try { await window.githubTokenPrompt.submit(null); }
  catch { errorLabel.textContent = 'Okno zavři křížkem.'; }
});
