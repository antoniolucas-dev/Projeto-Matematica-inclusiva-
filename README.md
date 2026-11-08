# Matemática Inclusiva

Site do projeto: um carrinho de supermercado inteligente que usa localização, direção e distância
para orientar, por áudio, pessoas com deficiência visual.

## Estrutura

- `index.html`: conteúdo da página
- `style.css`: visual (cores, tipografia, temas claro, escuro e alto contraste)
- `script.js`: opções de leitura e mapa interativo
- `images/`: logo e foto de abertura

Não precisa instalar nada: abra o `index.html` no navegador. As fontes (Atkinson Hyperlegible e
Bricolage Grotesque) carregam do Google Fonts; sem internet, a página usa as fontes do sistema.

## Como o mapa funciona

O supermercado é um plano com coordenadas, com a entrada em (0, 0). Cada trajeto é uma lista de
pontos em `ROTAS`, no `script.js`. O código calcula sozinho os trechos retos, a direção de cada
curva (pelo produto vetorial entre trechos seguidos) e a distância total (a soma dos trechos).
Para criar um novo destino, basta acrescentar uma rota e um botão com o mesmo `data-rota`.
