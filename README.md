# Alerta Viagem PRO

Plataforma web responsiva com buscas reais de:

- Voos pelo Google Flights via SerpApi
- Hotéis pelo Google Hotels via SerpApi
- Pacotes calculados pela soma das melhores opções reais de voo e hotel

## Configuração local

1. Crie `.env.local` com `SERPAPI_API_KEY=sua_chave`.
2. Instale as dependências com `npm install`.
3. Rode com a CLI da Vercel: `npx vercel dev`.

## Publicação na Vercel

Adicione a variável `SERPAPI_API_KEY` nas configurações do projeto na Vercel. Não publique `.env.local` no GitHub.

A busca usa a mesma chave da SerpApi para voos e hotéis.
