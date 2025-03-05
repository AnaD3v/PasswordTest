const { ipcRenderer } = require('electron');

document.getElementById('loginForm').addEventListener('submit', async (event) => {
  event.preventDefault();  // Impede o envio do formulário tradicional

  // Captura os dados inseridos pelo usuário
  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;

  // Solicita ao processo principal a lista de sites a partir do JSON
  const sites = await ipcRenderer.invoke('get-sites-list');

  // Envia os dados do login para o processo principal via IPC
  const results = await ipcRenderer.invoke('perform-login', { sites, username, password });

  // Exibe os resultados na interface
  displayResults(results);
});

// Função para exibir os resultados do login
function displayResults(results) {
  const resultsContainer = document.getElementById('results');
  resultsContainer.innerHTML = '';  // Limpa os resultados anteriores

  results.forEach(result => {
    const resultElement = document.createElement('div');
    resultElement.classList.add('result');
    resultElement.innerHTML = `
      <h3>${result.site}</h3>
      <p>Status: ${result.success ? 'Sucesso' : 'Falha'}</p>
      <p>Mensagem: ${result.message}</p>
      <p><strong>Cookies:</strong></p>
      <pre>${JSON.stringify(result.cookies, null, 2)}</pre>
    `;
    resultsContainer.appendChild(resultElement);
  });
}
