let predefinedSites = [];
const API_URL = "https://testpassword.onrender.com"; // Substitua pela URL correta

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
    if (!suggestionBox) {
        suggestionBox = document.createElement('div');
        suggestionBox.id = 'suggestions';
        suggestionBox.style.position = 'absolute';
        suggestionBox.style.backgroundColor = '#fff';
        suggestionBox.style.border = '1px solid #ccc';
        suggestionBox.style.maxHeight = '150px';
        suggestionBox.style.overflowY = 'auto';
        document.body.appendChild(suggestionBox);
    } else {
        suggestionBox.innerHTML = ''; // Limpa sugestões anteriores
    }

    suggestions.forEach(site => {
        const suggestionItem = document.createElement('div');
        suggestionItem.textContent = site.title; // Exibe apenas o título
        suggestionItem.style.padding = '5px 10px';
        suggestionItem.style.cursor = 'pointer';
        suggestionItem.addEventListener('click', () => {
            document.getElementById('url-input').value = ''; // Limpa a URL ao selecionar um título
            addChip(site); // Adiciona o site à lista de chips
            setTimeout(() => suggestionBox.remove(), 100);
        });
        suggestionBox.appendChild(suggestionItem);
    });

    // Remove o suggestionBox quando o input perde o foco
    const inputField = document.getElementById('url-input');
    inputField.addEventListener('blur', () => {
        setTimeout(() => suggestionBox.remove(), 200); // Delay para evitar conflitos
    });
}

// Função para lidar com o input do usuário e filtrar os sites disponíveis
document.getElementById('url-input').addEventListener('input', function () {
    const inputValue = this.value.toLowerCase();
    const matches = predefinedSites.filter(site => site.url.toLowerCase().includes(inputValue));

    if (matches.length > 0) {
        showAutocompleteSuggestions(matches);
    }
});

// Função para adicionar chips (sites) à lista
function addChip(site) {
    if (!selectedSites.some(s => s.url === site.url)) {
        selectedSites.push(site);
        updateChipsList();
    }
}

function updateChipsList() {
    const chipsList = document.getElementById('chips-list');
    const placeholder = document.getElementById('chips-placeholder');

    chipsList.innerHTML = ''; // Limpa os chips

    selectedSites.forEach(site => {
        const chip = document.createElement('div');
        chip.className = 'chip';
        chip.innerHTML = `<span>${site.title}</span><span class="remove-chip" onclick="removeChip('${site.url}')">✖</span>`;
        chipsList.appendChild(chip);
    });

    // Mostra ou oculta o placeholder
    placeholder.style.display = selectedSites.length === 0 ? 'block' : 'none';
}

// Função para limpar os campos e remover todos os chips
function clearFields() {
    document.getElementById('url-input').value = '';
    document.getElementById('username').value = '';
    document.getElementById('password').value = '';
    document.getElementById('result').innerText = '';

    selectedSites = [];
    updateChipsList();
}

// Função para remover chips (sites) da lista
function removeChip(siteUrl) {
    selectedSites = selectedSites.filter(s => s.url !== siteUrl);
    updateChipsList();
}

// Função para executar o login com múltiplos sites
async function executeLogin() {
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    if (selectedSites.length === 0) {
        alert('Por favor, selecione ao menos um tribunal.');
        return;
    }

    if (!username || !password) {
        alert('Por favor, preencha os campos de usuário e senha!');
        return;
    }

    document.getElementById('result').innerText = 'Aguarde, processando...';

    try {
        const response = await fetch(`https://testpassword.onrender.com/login`, {  // 🔥 URL do backend no Render
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                sites: selectedSites.map(site => site.url), // Enviando apenas as URLs dos sites
                username,
                password,
            })
        });

        if (!response.ok) {
            throw new Error(`Erro na resposta do servidor: ${response.statusText}`);
        }

        const result = await response.json();
        document.getElementById('result').innerText = result.length === 0
            ? 'Nenhum site processado.'
            : result.map(res => `${res.site}: ${res.message}`).join('\n');

    } catch (error) {
        console.error('Erro ao executar login:', error);
        document.getElementById('result').innerText = `Erro: ${error.message}`;
    }
}
