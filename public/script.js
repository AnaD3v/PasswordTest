let predefinedSites = [];

// Função para carregar os seletores dos sites a partir do arquivo JSON
async function loadSelectors() {
    try {
        const response = await fetch('site-selectors.json');
        if (!response.ok) {
            throw new Error('Não foi possível carregar os seletores dos sites.');
        }
        predefinedSites = await response.json();
        console.log('Seletores carregados:', predefinedSites);
    } catch (error) {
        console.error(error);
        alert("Erro ao carregar os seletores.");
    }
}

// Chama a função para carregar os seletores
loadSelectors();

let selectedSites = []; // Para armazenar os sites selecionados

// Função para mostrar sugestões de autocomplete para o input de URL
function showAutocompleteSuggestions(suggestions) {
    let suggestionBox = document.getElementById('suggestions');
    let inputField = document.getElementById('url-input');

    if (!suggestionBox) {
        suggestionBox = document.createElement('div');
        suggestionBox.id = 'suggestions';
        suggestionBox.style.position = 'absolute';
        suggestionBox.style.backgroundColor = '#fff';
        suggestionBox.style.border = '1px solid #ccc';
        suggestionBox.style.maxHeight = '150px';
        suggestionBox.style.overflowY = 'auto';
        suggestionBox.style.width = `${inputField.offsetWidth}px`; // Define a largura igual ao input
        suggestionBox.style.zIndex = '1000'; // Garante que fique acima de outros elementos
        document.body.appendChild(suggestionBox);
    } else {
        suggestionBox.innerHTML = ''; // Limpa sugestões anteriores
    }

    // Posiciona a caixinha logo abaixo do campo de entrada
    const rect = inputField.getBoundingClientRect();
    suggestionBox.style.top = `${rect.bottom + window.scrollY + 78}px`; // Move mais para baixo
    suggestionBox.style.left = `${rect.left + window.scrollX + 210}px`; // Move mais para a direita

    suggestions.slice(0, 400).forEach(site => { // Limita a 400 sugestões visíveis
        const suggestionItem = document.createElement('div');
        suggestionItem.textContent = site.title; // Exibe apenas o título
        suggestionItem.style.padding = '5px 10px';
        suggestionItem.style.cursor = 'pointer';
        suggestionItem.style.backgroundColor = selectedSites.some(s => s.url === site.url) ? '#ddd' : '#fff';
        suggestionItem.addEventListener('click', () => {
            addChip(site); // Adiciona o site à lista de chips
            updateSuggestionsUI();
        });
        suggestionBox.appendChild(suggestionItem);
    });

    document.addEventListener('click', (event) => {
        if (!suggestionBox.contains(event.target) && event.target.id !== 'url-input') {
            suggestionBox.style.display = 'none';
        }
    });

    suggestionBox.style.display = 'block'; // Garante que a caixinha reapareça
}

function updateSuggestionsUI() {
    let suggestionBox = document.getElementById('suggestions');
    if (suggestionBox) {
        suggestionBox.childNodes.forEach(item => {
            if (selectedSites.some(s => s.title === item.textContent)) {
                item.style.backgroundColor = '#ddd';
            } else {
                item.style.backgroundColor = '#fff';
            }
        });
    }
}

// Função para lidar com o input do usuário e filtrar os sites disponíveis
document.getElementById('url-input').addEventListener('input', function () {
    const inputValue = this.value.toLowerCase();
    // Filtra os sites considerando traços e espaços
    const matches = predefinedSites.filter(site => site.url.toLowerCase().replace(/[-\s]/g, '').includes(inputValue.replace(/[-\s]/g, '')));

    if (matches.length > 0) {
        showAutocompleteSuggestions(matches);
    }
});

document.getElementById('url-input').addEventListener('focus', function () {
    const inputValue = this.value.toLowerCase();
    const matches = predefinedSites.filter(site => site.url.toLowerCase().replace(/[-\s]/g, '').includes(inputValue.replace(/[-\s]/g, '')));
    if (matches.length > 0) {
        showAutocompleteSuggestions(matches);
    }
});

// Função para adicionar chips (sites) à lista
function addChip(site) {
    // Previne a duplicação de sites na lista de chips
    if (!selectedSites.some(s => s.url === site.url)) {
        selectedSites.push(site);
        updateChipsList();
        updateSuggestionsUI();
    }
}

// Função para limpar os campos e remover todos os chips
function clearFields() {
    // Limpa os campos de URL, username e password
    document.getElementById('url-input').value = '';
    document.getElementById('username').value = '';
    document.getElementById('password').value = '';
    document.getElementById('result').innerText = ''; // Limpa a mensagem de resultado

    // Limpa a lista de chips (sites selecionados)
    selectedSites = [];
    updateChipsList();
}

function updateChipsList() {
    const chipsList = document.getElementById('chips-list');
    const placeholder = document.getElementById('chips-placeholder');

    // Remove todos os chips antes de adicionar os novos
    Array.from(chipsList.children).forEach(child => {
        if (child !== placeholder) {
            child.remove();
        }
    });

    // Adiciona os chips
    selectedSites.forEach(site => {
        const chip = document.createElement('div');
        chip.className = 'chip';
        chip.innerHTML = `<span>${site.title}</span><span class="remove-chip" onclick="removeChip('${site.url}')">✖</span>`;
        chipsList.appendChild(chip);
    });

    // Mostra ou oculta o placeholder
    placeholder.style.display = selectedSites.length === 0 ? 'block' : 'none';
}

// Função para remover chips (sites) da lista
function removeChip(siteUrl) {
    selectedSites = selectedSites.filter(s => s.url !== siteUrl);
    updateChipsList(); // Atualiza a lista de chips após remoção
    updateSuggestionsUI();
}

// Função para executar o login com múltiplos sites
async function executeLogin() {
    const usernameField = document.getElementById('username');
    const passwordField = document.getElementById('password');
    const urlInputField = document.getElementById('url-input');

    // Desabilita os campos enquanto o login está sendo processado
    usernameField.disabled = true;
    passwordField.disabled = true;
    urlInputField.disabled = true;

    const username = usernameField.value;
    const password = passwordField.value;

    if (selectedSites.length === 0) {
        alert('Por favor, selecione ao menos um tribunal.');
        resetInputFields();
        return;
    }

    if (!username || !password) {
        alert('Por favor, preencha os campos de usuário e senha!');
        resetInputFields();
        return;
    }

    document.getElementById('result').innerText = 'Aguarde, processando...';

    try {
        // Envia os dados de login para o servidor
        const response = await fetch('http://127.0.0.1:3000/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                sites: selectedSites,
                username: username,
                password: password,
            })
        });

        if (!response.ok) {
            throw new Error(`Erro na resposta do servidor: ${response.statusText}`);
        }

        const result = await response.json();
        if (result.length === 0) {
            document.getElementById('result').innerText = 'Nenhum site processado.';
        } else {
            document.getElementById('result').innerText = result.map(res => `${res.site}: ${res.message}`).join('\n');
        }

    } catch (error) {
        console.error('Erro ao executar login:', error);
        document.getElementById('result').innerText = `Erro: ${error.message}`;
    } finally {
        // Garantir que os campos sejam reabilitados após o login (seja bem-sucedido ou com erro)
        resetInputFields();
    }
}

function resetInputFields() {
    const usernameField = document.getElementById('username');
    const passwordField = document.getElementById('password');
    const urlInputField = document.getElementById('url-input');

    // Reabilitar os campos
    usernameField.disabled = false;
    passwordField.disabled = false;
    urlInputField.disabled = false;
    console.log("Campos reabilitados.");
}
