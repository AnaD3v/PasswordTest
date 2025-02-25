import express from 'express';
import puppeteer from 'puppeteer';
import path from 'path';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Criação da instância do Express
const app = express();

app.use(cors({
    origin: [
        'https://testpassword.onrender.com',
        'http://127.0.0.1:5500', // Live Server (padrão)
        'http://localhost:5500'  // Live Server com "localhost"
    ],
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type']
}));


app.use(express.json());

// Configuração do diretório público
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
app.use(express.static(path.join(__dirname, 'public'))); // Serve arquivos estáticos da pasta public

app.post('/login', async (req, res) => {
    console.log('Requisição recebida:', req.body);

    const { sites, username, password } = req.body;
    const results = [];
    let browser;

    try {
        (async () => {
            const browser = await puppeteer.launch({
                headless: true,
                args: ['--no-sandbox', '--disable-setuid-sandbox'],
                executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/google-chrome-stable'
            });
        
            console.log('Puppeteer iniciado com sucesso!');
            await browser.close();
        })();

        for (let site of sites) {
            let result = { site: site.title, success: false, message: '', cookies: [] };
            let page;

            const siteTimeout = site.timeout || 30000;

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

                // Capturar cookies iniciais
                const initialCookies = await page.cookies();
                console.log('Cookies iniciais:', JSON.stringify(initialCookies, null, 2));
                result.cookies.push({ stage: 'initial', cookies: initialCookies });

                let iframe = null;
                try {
                    // Tentar localizar um iframe
                    const iframeElement = await page.waitForSelector('iframe', { visible: true, timeout: 2000 }).catch(() => null);
                    if (iframeElement) {
                        iframe = await iframeElement.contentFrame();
                        console.log(`Iframe encontrado no site: ${site.title}`);
                    } else {
                        console.log(`Nenhum iframe encontrado no site: ${site.title}`);
                    }
                } catch (error) {
                    console.log(`Erro ao procurar iframe no site ${site.title}:`, error.message);
                }

                // Selecionar o contexto correto (iframe ou página principal)
                const context = iframe || page;

                // Preencher login e senha
                await context.waitForSelector('#txtUsuario, #username', { visible: true });
                await context.type('#txtUsuario, input#username, #username', username);

                await context.waitForSelector('#pwdSenha, #password', { visible: true });
                await context.type('#pwdSenha, input#password, #password', password);

                // Clicar no botão de login
                await context.waitForSelector('#sbmEntrar, #btnEntrar, #kc-login', { visible: true });
                await context.click('#sbmEntrar, #btnEntrar, #kc-login');

                // Esperar pela navegação pós-login
                await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: siteTimeout }).catch(() => null);


                // Capturar cookies pós-login
                const postLoginCookies = await page.cookies();
                console.log('Cookies pós-login:', JSON.stringify(postLoginCookies, null, 2));
                result.cookies.push({ stage: 'post-login', cookies: postLoginCookies });

                // Verificar elementos de erro no login
                const errorSelector = '#conteudologin > div.login > div.msg-login, #txaInfraMsg, div.msg-login, .error-message, .alert-danger, .invalid-feedback';
                const errorMessageElement = await page.waitForSelector(errorSelector, { visible: true, timeout: 5000 }).catch(() => null);
                if (errorMessageElement) {
                    const errorText = await page.evaluate(el => el.textContent, errorMessageElement);
                    result.message = `${errorText.trim()}`;
                    results.push(result);
                    continue;
                }

                // Verificar elementos que indicam sucesso no login
                const successSelector = 'body > pje-root > mat-sidenav-container > mat-sidenav-content > div > pje-menu-lateral, .dashboard, .user-profile, .logout-button';
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


const port = process.env.PORT || 3000; // Usa a porta fornecida pelo Render ou a porta 3000 localmente
app.listen(port, () => {
    console.log(`Servidor rodando na porta ${port}`);
});
