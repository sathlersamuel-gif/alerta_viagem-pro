const fs = require('fs');

const path = 'index.html';
let html = fs.readFileSync(path, 'utf8');

const option = '<label class="checkbox-line full"><input type="checkbox" id="anyDestination"><span><b>Qualquer destino barato</b><div class="small">Procura rotas disponíveis automaticamente.</div></span></label>';
const anchor = '<div class="actions"><button class="primary" type="submit" id="searchButton">Buscar e analisar com IA</button>';
const moved = '<div class="avp-any-destination-section" style="margin-top:16px;padding:14px;border:1px solid var(--line);border-radius:14px;background:var(--panel2)"><div class="small" style="margin-bottom:8px;font-weight:800;color:#c4d6e4">Busca alternativa</div>' + option.replace('checkbox-line full', 'checkbox-line') + '</div>';

if (!html.includes(option)) {
  throw new Error('Opção original não encontrada no index.html');
}
if (!html.includes(anchor)) {
  throw new Error('Ponto de inserção não encontrado no index.html');
}

html = html.replace(option, '');
html = html.replace(anchor, moved + anchor);
fs.writeFileSync(path, html, 'utf8');

const fieldIndex = html.indexOf('id="destination"');
const optionIndex = html.indexOf('id="anyDestination"');
const buttonIndex = html.indexOf('id="searchButton"');
if (!(fieldIndex < optionIndex && optionIndex < buttonIndex)) {
  throw new Error('Validação da nova posição falhou');
}

console.log('Opção "Qualquer destino barato" movida para o fim do formulário.');
