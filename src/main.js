import { app, BrowserWindow, dialog } from 'electron';
import path from 'path';
import express from 'express';
import puppeteer from 'puppeteer';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import os from 'os';
import { promises as fs } from 'fs';
import log from 'electron-log';
import pkg from 'electron-updater';
import { Tray, Menu } from 'electron';

const { autoUpdater } = pkg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
let win;

// Função para enviar logs para o servidor remoto
async function sendLogToServer(message) {
    try {
        await fetch('http://localhost:4000/logs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ log: message }),
        });
    } catch (error) {
        console.error('Erro ao enviar log:', error.message);
    }
}

// Hook para capturar e enviar logs automaticamente
log.hooks.push((message) => {
    sendLogToServer(message);
});

function createWindow() {
    win = new BrowserWindow({
        width: 1200,
        height: 700,
        webPreferences: {
            nodeIntegration: false,  // Habilita a integração do node.js no renderer
            contextIsolation: true, // Habilita a comunicação entre o processo principal e o renderer (caso precise de IPC)
            icon: path.resolve(__dirname, 'public/icons/app-icon.ico')
        },

    });

    console.log('Ícone do aplicativo:', path.resolve(__dirname, 'public/icons/app-icon.ico'));

    win.loadFile(path.join(__dirname, '../public/index.html'));

}

function startAutoUpdater() {
    // Definir o nível de log
    log.transports.file.level = 'info';
    autoUpdater.logger = log;

    autoUpdater.on('checking-for-update', () => {
        log.info('Verificando atualizações...');
    });

    autoUpdater.on('update-available', (info) => {
        log.info(`Atualização disponível: versão ${info.version}`);
        dialog.showMessageBox({
            type: 'info',
            title: 'Atualização Disponível',
            message: `Uma nova versão (${info.version}) está disponível. Baixando atualização...`
        });
    });

    autoUpdater.on('update-not-available', () => {
        log.info('Nenhuma atualização disponível.');
    });

    autoUpdater.on('error', (err) => {
        log.error(`Erro ao buscar atualizações: ${err.message}`);
    });

    autoUpdater.on('download-progress', (progress) => {
        log.info(`Progresso do download: ${progress.percent.toFixed(2)}%`);
    });

    autoUpdater.on('update-downloaded', () => {
        log.info('Atualização baixada. Reiniciando o aplicativo...');
        dialog.showMessageBox({
            type: 'info',
            title: 'Atualização Pronta',
            message: 'A atualização foi baixada. O aplicativo será reiniciado para aplicar as mudanças.',
        }).then(() => {
            autoUpdater.quitAndInstall();
        });
    });

    autoUpdater.checkForUpdatesAndNotify();
}

app.whenReady().then(() => {
    // Criar a janela do Electron
    createWindow();

    startAutoUpdater(); // Inicia o autoUpdater
    // Iniciar o servidor Express
    startExpressServer();
    // Encerrar o Electron quando a última janela for fechada
    win.on('closed', () => {
        win = null;
    });
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
// Função para iniciar o servidor Express
function startExpressServer() {
    const app = express();
    app.use(cors());
    app.use(express.json());
    // Servir arquivos estáticos da pasta 'public'
    app.use(express.static(path.join(__dirname, 'public')));

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
            possiblePaths = [
                '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
                '/opt/homebrew-cask/Caskroom/google-chrome/latest/Google Chrome.app/Contents/MacOS/Google Chrome',
                path.join(os.homedir(), 'Applications/Google Chrome.app/Contents/MacOS/Google Chrome'),
                '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
                '/Applications/Google Chrome Beta.app/Contents/MacOS/Google Chrome Beta',
                '/Applications/Google Chrome Dev.app/Contents/MacOS/Google Chrome Dev',
                '/opt/local/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
                path.join(os.homedir(), 'Library/Mobile Documents/com~apple~CloudDocs/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')
            ];
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

            for (let site of sites) {
                let result = { site: site.title, success: false, message: '', cookies: [] };
                let page;

                const siteTimeout = site.timeout || 20000;

                try {
                    page = await browser.newPage();

                    // Validação e configuração de cookies
                    if (site.cookies && site.cookies.length > 0) {
                        const validCookies = site.cookies.filter(cookie => cookie.name && cookie.value && cookie.domain);
                        if (validCookies.length > 0) {
                            await page.setCookie(...validCookies);
                            console.log('Cookies configurados:', JSON.stringify(validCookies, null, 2));
                        } else {
                            console.log('Nenhum cookie válido encontrado.');
                        }
                    }

                    // Navegar para o site
                    await page.goto(site.url, { timeout: siteTimeout, waitUntil: 'networkidle2' });

                    // Verificar se há redirecionamentos ou mudanças de URL                
                    console.log(`URL atual após carregamento: ${page.url()}`);


                    // Capturar cookies iniciais
                    const initialCookies = await page.cookies();
                    console.log('Cookies iniciais:', JSON.stringify(initialCookies, null, 2));
                    result.cookies.push({ stage: 'initial', cookies: initialCookies });

                    let context = page; // Começa assumindo que o login está na página principal

                    try {
                        const iframeElement = await page.waitForSelector('iframe', { visible: true, timeout: 5000 }).catch(() => null);
                        if (iframeElement) {
                            const tempIframe = await iframeElement.contentFrame();
                            if (tempIframe) {
                                context = tempIframe;
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

                    let loginSuccess = false;
                    for (let attempt = 0; attempt < 2; attempt++) {
                        try {
                            const usernameSelector = '#username.form-control, #usernameForm, input#username,  #txtUsuario, #username';
                            const passwordSelector = '#passwordForm, #pwdSenha, #password';
                            const loginButtonSelector = '#fm1 > div:nth-child(3) > div.text-right.col-md-4.col-sm-4 > input, #pbEntrar, #sbmEntrar, #btnEntrar, #kc-login';

                            const usernameField = await context.waitForSelector(usernameSelector, { visible: true, timeout: 5000 }).catch(() => null);
                            const passwordField = await context.waitForSelector(passwordSelector, { visible: true, timeout: 5000 }).catch(() => null);

                            if (usernameField && passwordField) {
                                await context.type(usernameSelector, username);
                                await context.type(passwordSelector, password);

                                await context.waitForSelector(loginButtonSelector, { visible: true });
                                await context.click(loginButtonSelector);

                                await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: siteTimeout }).catch(() => null);
                                loginSuccess = true;
                                break;
                            } else {
                                // Tenta clicar no botão PDPJ se não encontrou os campos
                                const loginPdpj = '#btnSsoPdpj';
                                const loginPdpjElement = await page.waitForSelector(loginPdpj, { visible: true, timeout: siteTimeout }).catch(() => null);
                                if (loginPdpjElement) {
                                    await page.click(loginPdpj);
                                    await new Promise(resolve => setTimeout(resolve, 3000));
                                } else {
                                    console.log('Botão PDPJ não encontrado.');
                                    break;
                                }
                            }
                        } catch (err) {
                            console.log('Erro durante tentativa de login:', err.message);
                        }
                    }

                    if (!loginSuccess) {
                        result.message = 'Falha ao localizar campos de login mesmo após clicar no botão PDPJ.';
                    }


                    // Capturar cookies pós-login
                    const postLoginCookies = await page.cookies();
                    console.log('Cookies pós-login:', JSON.stringify(postLoginCookies, null, 2));
                    result.cookies.push({ stage: 'post-login', cookies: postLoginCookies });

                    // Verificar elementos de erro no login
                    const errorSelector = '#kc-content-wrapper > div:nth-child(2) > span, #mensagemRetorno, #loginForm > div > div:nth-child(1) > div > div:nth-child(4) > div > div, #conteudologin > div.login > div.msg-login, #txaInfraMsg, div.msg-login, .error-message, .alert-danger, .invalid-feedback';
                    const errorMessageElement = await page.waitForSelector(errorSelector, { visible: true, timeout: 5000 }).catch(() => null);
                    if (errorMessageElement) {
                        const errorText = await page.evaluate(el => el.textContent, errorMessageElement);
                        result.message = `${errorText.trim()}`;
                        results.push(result);
                        continue;
                    }

                    // Verificar elementos que indicam sucesso no login
                    const successSelector = '#esajMenuArea > li:nth-child(1) > a, #btnProfile > i, #btnValidar, #root > div > header > nav > button.header__navbar__menu-hamburger.open__aside-nav--left, #root > div > header > nav > h1, #barraSuperiorPrincipal > div > div.navbar-collapse, body > pje-root > mat-sidenav-container > mat-sidenav-content > div > pje-menu-lateral, .dashboard, .user-profile, .logout-button';
                    const successElement = await page.waitForSelector(successSelector, { visible: true, timeout: siteTimeout }).catch(() => null);

                    // Seletor do botão que abre o menu do usuário
                    const userMenuSelector = '#barraSuperiorPrincipal > div > div.navbar-collapse > ul > li > a > span.avatar.tip-bottom > img, #btnProfile, .user-menu, .perfil, #menuUsuario, .avatar, .user-dropdown';

                    // Seletor do botão de logout dentro do menu
                    const logoutSelector = '#papeisUsuarioForm > div.menu-sair > a, .logout-button, #btnSair, .sair, #barraSuperiorPrincipal .logout';

                    if (successElement) {
                        result.success = true;
                        result.message = 'Login bem-sucedido!';

                        // 1º Clique: Abre o menu do usuário
                        const userMenuElement = await page.waitForSelector(userMenuSelector, { visible: true, timeout: 5000 }).catch(() => null);
                        if (userMenuElement) {
                            await page.click(userMenuSelector);
                            await new Promise(resolve => setTimeout(resolve, 5000));

                            // 2º Clique: Clica no botão de logout
                            const logoutElement = await page.waitForSelector(logoutSelector, { visible: true, timeout: 5000 }).catch(() => null);
                            if (logoutElement) {
                                await page.click(logoutSelector);
                                result.message += ' | Logoff realizado com sucesso!';
                            } else {
                                result.message += ' | Falha ao localizar o botão de logout.';
                            }
                        } else {
                            result.message += ' | Falha ao localizar o menu de usuário.';
                        }

                    } else {
                        result.message = 'Falha no login: Não foi possível verificar o sucesso.';
                    }

                    const twoFactor = '#btnValidar';
                    const twoFactorElement = await page.waitForSelector(twoFactor, { visible: true, timeout: siteTimeout }).catch(() => null);

                    if (twoFactorElement) {
                        result.success = true;
                        result.message = 'Autenticação em 2 fatores ativada.';
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
}
