import express from 'express';
import puppeteer from 'puppeteer';
import path from 'path';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import os from 'os';  // Importando 'os' para detectar o sistema operacional
import { promises as fs } from 'fs';  // Usando fs.promises para trabalhar com promessas

const app = express();

app.use(cors({
    origin: ['http://127.0.0.1:5500', 'http://localhost:5500'], // Define quais origens podem acessar a API
    methods: ['GET', 'POST'], // Permite apenas métodos GET e POST
    allowedHeaders: ['Content-Type'] // Permite apenas cabeçalhos com "Content-Type"
}));

app.use(express.json()); // Permite que o Express processe JSON nas requisições

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
app.use(express.static(path.join(__dirname, 'public'))); // Serve arquivos estáticos da pasta "public"

async function getChromePath() {
    // Obtém o sistema operacional do usuário
    const platform = os.platform();
    let possiblePaths = [];

    // Define possíveis caminhos do Chrome dependendo do sistema operacional
    if (platform === 'win32') {
        possiblePaths = [
            'C:/Program Files/Google/Chrome/Application/chrome.exe',
            'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
            'C:/Users/Jusbrasil/AppData/Local/Google/Chrome/Application/chrome.exe'
        ];
    } else if (platform === 'darwin') {
        possiblePaths = ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'];
    } else if (platform === 'linux') {
        possiblePaths = ['/usr/bin/google-chrome', '/opt/google/chrome/chrome'];
    }

    // Verifica se algum dos caminhos definidos realmente existe no sistema
    for (const path of possiblePaths) {
        if (await fs.access(path).then(() => true).catch(() => false)) {
            return path; // Retorna o caminho do Chrome se encontrado
        }
    }

    try {
        let chromePath = '';

        // Para Windows, tenta encontrar o Chrome dinamicamente com o comando 'where'
        if (platform === 'win32') {
            chromePath = execSync('where chrome').toString().split('\n')[0].trim();
        } else {
            // Para macOS e Linux, utiliza o comando 'which'
            chromePath = execSync('which google-chrome').toString().trim();
        }

        // Verifica se o caminho encontrado realmente existe e retorna
        if (chromePath && await fs.access(chromePath).then(() => true).catch(() => false)) {
            return chromePath;
        }
    } catch (error) {
        console.error('Erro ao buscar Chrome dinamicamente:', error.message);
    }

    // Se nenhum caminho válido for encontrado, lança um erro
    throw new Error('Google Chrome não encontrado no sistema!');
}

// Define uma rota POST para o endpoint '/login'
app.post('/login', async (req, res) => {
    console.log('Requisição recebida:', req.body);

    // Extrai os dados do corpo da requisição
    const { sites, username, password } = req.body;
    const results = [];
    let browser;

    try {
        // Obtém o caminho do Chrome no sistema
        const chromePath = await getChromePath();
        console.log('Google Chrome encontrado em:', chromePath);

        // Inicializa o navegador com o caminho do Chrome
        browser = await puppeteer.launch({
            executablePath: chromePath,
            headless: false,
            ignoreDefaultArgs: ['--disable-extensions'],
        });

        console.log('Chrome aberto com o perfil do Chrome');

        for (let site of sites) { // Loop para testar cada site recebido na requisição
            let result = { site: site.title, success: false, message: '', cookies: [] }; // Objeto para armazenar resultado do site
            let page;

            const siteTimeout = site.timeout || 20000; // Define o tempo limite para carregar cada site

            try {
                page = await browser.newPage(); // Abre uma nova aba no navegador

                // Se houver cookies fornecidos, define-os antes de acessar o site
                if (site.cookies && site.cookies.length > 0) {
                    const validCookies = site.cookies.filter(cookie => cookie.name && cookie.value && cookie.domain);
                    if (validCookies.length > 0) {
                        await page.setCookie(...validCookies);
                        console.log('Cookies configurados:', JSON.stringify(validCookies, null, 2));
                    } else {
                        console.log('Nenhum cookie válido encontrado.');
                    }
                }

                // Acessa o site
                await page.goto(site.url, { timeout: siteTimeout, waitUntil: 'networkidle2' });

                console.log(`URL atual após carregamento: ${page.url()}`);

                // Captura cookies iniciais antes do login
                const initialCookies = await page.cookies();
                console.log('Cookies iniciais:', JSON.stringify(initialCookies, null, 2));
                result.cookies.push({ stage: 'initial', cookies: initialCookies });

                let context = page; // Começa assumindo que o login está na página principal

                try {
                    // Verifica se há um iframe para realizar login dentro dele
                    const iframeElement = await page.waitForSelector('iframe', { visible: true, timeout: 5000 }).catch(() => null);
                    if (iframeElement) {
                        const tempIframe = await iframeElement.contentFrame();
                        if (tempIframe) {
                            context = tempIframe; // Se o iframe for acessível, define como contexto
                            console.log(`Iframe encontrado e acessível no site: ${site.title}`);
                        } else {
                            console.log(`Iframe encontrado, mas inacessível. Usando página principal.`);
                        }
                    } else {
                        console.log(`Nenhum iframe encontrado no site.`);
                    }
                } catch (error) {
                    console.log(`Erro ao procurar iframe:`, error.message);
                }

                // Insere login e senha
                await context.waitForSelector('#usernameForm, #txtUsuario, #username', { visible: true });
                await context.type('#usernameForm, #txtUsuario, input#username, #username', username);

                await context.waitForSelector('#passwordForm, #pwdSenha, #password', { visible: true });
                await context.type('#passwordForm, #pwdSenha, input#password, #password', password);

                // Clica no botão de login
                await context.waitForSelector('#pbEntrar, #sbmEntrar, #btnEntrar, #kc-login', { visible: true });
                await context.click('#pbEntrar, #sbmEntrar, #btnEntrar, #kc-login');

                // Aguarda a navegação pós-login
                await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: siteTimeout }).catch(() => null);

                // Captura cookies após login
                const postLoginCookies = await page.cookies();
                console.log('Cookies pós-login:', JSON.stringify(postLoginCookies, null, 2));
                result.cookies.push({ stage: 'post-login', cookies: postLoginCookies });

                // Verifica se houve erro no login
                const errorSelector = '.error-message, .alert-danger, .invalid-feedback';
                const errorMessageElement = await page.waitForSelector(errorSelector, { visible: true, timeout: 5000 }).catch(() => null);
                if (errorMessageElement) {
                    const errorText = await page.evaluate(el => el.textContent, errorMessageElement);
                    result.message = `Erro: ${errorText.trim()}`;
                    results.push(result);
                    continue;
                }

                // Verifica se o login foi bem-sucedido
                const successSelector = '.dashboard, .user-profile, .logout-button';
                const successElement = await page.waitForSelector(successSelector, { visible: true, timeout: siteTimeout }).catch(() => null);

                if (successElement) {
                    result.success = true;
                    result.message = 'Login bem-sucedido!';
                } else {
                    result.message = 'Falha no login: Não foi possível verificar o sucesso.';
                }

                results.push(result);

            } catch (error) {
                console.error(`Erro ao processar o site ${site.title}:`, error);
                result.message = `Erro inesperado: ${error.message}`;
                results.push(result);
            } finally {
                if (page) {
                    try {
                        await page.close();
                    } catch (error) {
                        console.error('Erro ao fechar a página:', error.message);
                    }
                }
            }
        }
    } catch (error) {
        console.error('Erro ao iniciar o navegador ou processar os sites:', error);
        res.status(500).json({ error: 'Erro ao processar o login. Tente novamente mais tarde.' });
        return;
    } finally {
        if (browser?.isConnected()) {
            try {
                await browser.close();
            } catch (error) {
                console.error('Erro ao fechar o navegador:', error.message);
            }
        }
    }

    console.log('Resultado:', results);
    res.json(results);
});

// Inicia o servidor na porta 3000
app.listen(3000, () => {
    console.log('Servidor rodando na porta 3000');
});
