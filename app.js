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
        // Lança o navegador dentro do handler da requisição
        browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
        });

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

                // Processo de login e verificação
                // (restante do seu código de login...)

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
