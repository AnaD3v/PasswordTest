import express from 'express';
import puppeteer from 'puppeteer';
import path from 'path';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const app = express();

app.use(cors({
    origin: ['http://127.0.0.1:5500', 'http://localhost:5500'],
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type']
}));

app.use(express.json());

// Configuração do diretório público
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
app.use(express.static(path.join(__dirname, 'public')));

app.post('/login', async (req, res) => {
    console.log('Requisição recebida:', req.body);

    const { sites, username, password } = req.body;
    const results = [];
    let browser;

    try {
        browser = await puppeteer.launch({
            headless: 'true',
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
        });

        for (let site of sites) {
            let result = { site: site.title, success: false, message: '', cookies: [] };
            let page;

            const siteTimeout = site.timeout || 30000;

            try {
                page = await browser.newPage();

                // Configuração de cookies
                if (site.cookies?.length) {
                    const validCookies = site.cookies.filter(c => c.name && c.value && c.domain);
                    if (validCookies.length) {
                        await page.setCookie(...validCookies);
                        console.log('Cookies configurados:', JSON.stringify(validCookies, null, 2));
                    }
                }

                // Acessa a página
                await page.goto(site.url, { timeout: siteTimeout, waitUntil: 'networkidle2' });

                // Captura cookies iniciais
                result.cookies.push({ stage: 'initial', cookies: await page.cookies() });

                let iframe = null;
                try {
                    const iframeElement = await page.waitForSelector('iframe', { visible: true, timeout: 2000 }).catch(() => null);
                    if (iframeElement) iframe = await iframeElement.contentFrame();
                } catch (error) {
                    console.log(`Erro ao verificar iframe: ${error.message}`);
                }

                const context = iframe || page;

                // Preencher login e senha
                const usernameField = await context.waitForSelector('#txtUsuario, #username', { visible: true }).catch(() => null);
                if (usernameField) {
                    await usernameField.type(username);
                } else {
                    result.message = 'Campo de usuário não encontrado.';
                    results.push(result);
                    continue;
                }

                const passwordField = await context.waitForSelector('#pwdSenha, #password', { visible: true }).catch(() => null);
                if (passwordField) {
                    await passwordField.type(password);
                } else {
                    result.message = 'Campo de senha não encontrado.';
                    results.push(result);
                    continue;
                }

                // Clicar no botão de login
                const loginButton = await context.waitForSelector('#sbmEntrar, #btnEntrar, #kc-login', { visible: true }).catch(() => null);
                if (loginButton) {
                    await loginButton.click();
                } else {
                    result.message = 'Botão de login não encontrado.';
                    results.push(result);
                    continue;
                }

                // Esperar navegação
                await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: siteTimeout }).catch(() => null);

                // Capturar cookies pós-login
                result.cookies.push({ stage: 'post-login', cookies: await page.cookies() });

                // Verificação de erro
                const errorSelector = '.msg-login, .alert-danger, .error-message, .invalid-feedback';
                const errorMessageElement = await page.waitForSelector(errorSelector, { visible: true, timeout: 5000 }).catch(() => null);
                if (errorMessageElement) {
                    result.message = await page.evaluate(el => el.textContent.trim(), errorMessageElement);
                    results.push(result);
                    continue;
                }

                // Verificação de sucesso
                const pageContent = await page.content();
                if (pageContent.includes('Bem-vindo') || pageContent.includes('Dashboard')) {
                    result.success = true;
                    result.message = 'Login bem-sucedido!';
                } else {
                    result.message = 'Login pode ter falhado.';
                }

                results.push(result);

            } catch (error) {
                result.message = `Erro inesperado: ${error.message}`;
                results.push(result);
            } finally {
                if (page) await page.close();
            }
        }
    } catch (error) {
        console.error('Erro ao iniciar o navegador:', error);
        res.status(500).json({ error: 'Erro ao processar o login.' });
        return;
    } finally {
        if (browser?.isConnected()) await browser.close();
    }

    console.log('Resultado:', results);
    res.json(results);
});

// Inicia o servidor corretamente no Render
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
