(() => {
  "use strict";

  const $ = (seletor, base = document) => base.querySelector(seletor);
  const $$ = (seletor, base = document) => [...base.querySelectorAll(seletor)];
  const raiz = document.documentElement;
  const CHAVE = "matematica-inclusiva-v2";
  const reduzMovimento = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ------------------------------------------------------------------
     Voz
     ------------------------------------------------------------------ */
  const temVoz = "speechSynthesis" in window;

  function falar(texto) {
    if (!temVoz || !texto) return;
    window.speechSynthesis.cancel();
    const fala = new SpeechSynthesisUtterance(texto);
    fala.lang = "pt-BR";
    fala.rate = 0.95;
    const voz = window.speechSynthesis.getVoices().find(v => v.lang.toLowerCase().startsWith("pt-br"));
    if (voz) fala.voice = voz;
    window.speechSynthesis.speak(fala);
  }

  function calarVoz() {
    if (temVoz) window.speechSynthesis.cancel();
  }

  /* ------------------------------------------------------------------
     Preferências de leitura
     ------------------------------------------------------------------ */
  const padrao = { fonte: 0, contraste: false, escuro: null, ouvir: false };
  let prefs = { ...padrao };

  try {
    Object.assign(prefs, JSON.parse(localStorage.getItem(CHAVE) || "{}"));
  } catch (e) { /* sem armazenamento: segue com o padrão */ }

  if (typeof prefs.escuro !== "boolean") {
    prefs.escuro = window.matchMedia("(prefers-color-scheme: dark)").matches;
  }

  const botaoAjustes = $(".ajustes__btn");
  const painel = $("#painel-ajustes");
  const valorFonte = $("#fonte-valor");

  function salvar() {
    try { localStorage.setItem(CHAVE, JSON.stringify(prefs)); } catch (e) { /* ignora */ }
  }

  function marcar(acao, ligado) {
    const botao = $(`[data-acao="${acao}"]`);
    if (!botao) return;
    botao.setAttribute("aria-pressed", String(ligado));
    const estado = $(".opcao__estado", botao);
    if (estado) estado.textContent = ligado ? "Ligado" : "Desligado";
  }

  function aplicar() {
    const porcento = 100 + prefs.fonte * 12.5;
    raiz.style.fontSize = porcento + "%";
    raiz.dataset.theme = prefs.escuro ? "dark" : "light";
    raiz.dataset.contrast = prefs.contraste ? "high" : "normal";
    valorFonte.textContent = porcento + "%";
    $('[data-acao="fonte-menos"]').disabled = prefs.fonte <= -1;
    $('[data-acao="fonte-mais"]').disabled = prefs.fonte >= 3;
    marcar("contraste", prefs.contraste);
    marcar("escuro", prefs.escuro);
    marcar("ouvir", prefs.ouvir);
    salvar();
  }

  function abrirPainel(abrir) {
    painel.hidden = !abrir;
    botaoAjustes.setAttribute("aria-expanded", String(abrir));
  }

  botaoAjustes.addEventListener("click", () => abrirPainel(painel.hidden));

  document.addEventListener("click", evento => {
    if (!painel.hidden && !evento.target.closest(".ajustes")) abrirPainel(false);
  });

  document.addEventListener("keydown", evento => {
    if (evento.key === "Escape" && !painel.hidden) {
      abrirPainel(false);
      botaoAjustes.focus();
    }
  });

  painel.addEventListener("click", evento => {
    const botao = evento.target.closest("[data-acao]");
    if (!botao) return;
    switch (botao.dataset.acao) {
      case "fonte-menos": prefs.fonte = Math.max(-1, prefs.fonte - 1); break;
      case "fonte-mais": prefs.fonte = Math.min(3, prefs.fonte + 1); break;
      case "contraste": prefs.contraste = !prefs.contraste; break;
      case "escuro": prefs.escuro = !prefs.escuro; break;
      case "ouvir":
        prefs.ouvir = !prefs.ouvir;
        if (!prefs.ouvir) calarVoz();
        break;
      case "restaurar":
        prefs = { ...padrao, escuro: window.matchMedia("(prefers-color-scheme: dark)").matches };
        calarVoz();
        break;
    }
    aplicar();
  });

  /* Ouvir o trecho selecionado, quando a opção está ligada */
  const lerSelecao = () => {
    if (!prefs.ouvir) return;
    const texto = String(window.getSelection()).trim();
    if (texto.length > 1) falar(texto.slice(0, 700));
  };
  document.addEventListener("mouseup", lerSelecao);
  document.addEventListener("keyup", evento => { if (evento.shiftKey) lerSelecao(); });
  document.addEventListener("touchend", () => setTimeout(lerSelecao, 250));

  aplicar();

  /* ------------------------------------------------------------------
     Mapa: o supermercado como um plano com coordenadas
     Origem (0, 0) na entrada, canto inferior esquerdo.
     Cada trajeto é uma lista de pontos; entre dois pontos há um trecho reto.
     A direção das curvas sai do produto vetorial entre trechos seguidos.
     ------------------------------------------------------------------ */
  const CELULA = 60;
  const ORIGEM_X = 50;
  const ORIGEM_Y = 360;
  const COLUNAS = 8;
  const LINHAS = 5;
  const px = x => ORIGEM_X + CELULA * x;
  const py = y => ORIGEM_Y - CELULA * y;
  const NS = "http://www.w3.org/2000/svg";

  const ROTAS = {
    horti: { nome: "Hortifruti", lado: "direita", pontos: [[0, 0], [0, 5], [3, 5]] },
    merc: { nome: "Mercearia", lado: "esquerda", pontos: [[0, 0], [6, 0]] },
    lat: { nome: "Laticínios", lado: "direita", pontos: [[0, 0], [4, 0], [4, 5], [7, 5]] }
  };

  const mapa = $(".mapa__svg");
  if (!mapa) return;

  const el = {
    nos: $("#nos"),
    eixos: $("#eixos"),
    borda: $("#rota-borda"),
    rota: $("#rota"),
    pontos: $("#rota-pontos"),
    mascara: $("#rota-mask"),
    carro: $("#carro"),
    pino: $("#pino"),
    pinoXY: $("#pino-xy"),
    agora: $("#agora"),
    trechos: $("#trechos"),
    conta: $("#conta"),
    contaEq: $("#conta-eq"),
    repetir: $("#btn-repetir"),
    som: $("#btn-som"),
    somEstado: $("#som-estado"),
    chips: $$(".chip"),
    setores: $$(".m-setor")
  };

  /* Grade de pontos e numeração dos eixos */
  for (let x = 0; x <= COLUNAS; x++) {
    for (let y = 0; y <= LINHAS; y++) {
      const ponto = document.createElementNS(NS, "circle");
      ponto.setAttribute("cx", px(x));
      ponto.setAttribute("cy", py(y));
      ponto.setAttribute("r", 1.8);
      el.nos.appendChild(ponto);
    }
  }
  const rotulo = (texto, x, y) => {
    const t = document.createElementNS(NS, "text");
    t.setAttribute("x", x);
    t.setAttribute("y", y);
    t.textContent = texto;
    el.eixos.appendChild(t);
  };
  for (let x = 0; x <= COLUNAS; x++) rotulo(x, px(x), 410);
  for (let y = 0; y <= LINHAS; y++) rotulo(y, 12, py(y) + 4);
  rotulo("x", 566, 410);
  rotulo("y", 12, 46);

  /* Trechos retos, com a ação em cada curva */
  function calcularTrechos(pontos) {
    let direcao = [0, 1]; // quem entra pela porta olha para o norte
    const trechos = [];
    for (let i = 1; i < pontos.length; i++) {
      const [x0, y0] = pontos[i - 1];
      const [x1, y1] = pontos[i];
      const dx = Math.sign(x1 - x0);
      const dy = Math.sign(y1 - y0);
      const cruz = direcao[0] * dy - direcao[1] * dx;
      trechos.push({
        acao: cruz === 0 ? "frente" : cruz > 0 ? "esquerda" : "direita",
        n: Math.abs(x1 - x0) + Math.abs(y1 - y0),
        dx, dy
      });
      direcao = [dx, dy];
    }
    return trechos;
  }

  const quadrados = n => `${n} ${n === 1 ? "quadrado" : "quadrados"}`;
  const frase = t => t.acao === "frente"
    ? `Siga em frente por ${quadrados(t.n)}.`
    : `Vire à ${t.acao} e siga por ${quadrados(t.n)}.`;
  const fraseFinal = r => `Você está perto: ${r.nome} fica à sua ${r.lado}.`;
  const angulo = t => Math.atan2(t.dx, t.dy) * 180 / Math.PI; // 0 = norte, 90 = leste

  /* Estado da demonstração */
  let quadroId = 0;
  let atual = null;
  let narrar = false;
  let sessao = { trechos: [], textos: [], itens: [], ativo: -1, rota: null };

  function posicionarCarro(ponto, graus) {
    el.carro.setAttribute("transform", `translate(${ponto.x} ${ponto.y}) rotate(${graus})`);
  }

  function ativarPasso(indice) {
    sessao.ativo = indice;
    const ultimo = sessao.textos.length - 1;
    sessao.itens.forEach((item, i) => {
      item.classList.toggle("feito", i < indice || (indice === ultimo && i === ultimo));
      if (i === indice && indice < ultimo) item.setAttribute("aria-current", "step");
      else item.removeAttribute("aria-current");
    });
    const texto = sessao.textos[indice];
    el.agora.textContent = texto;
    if (narrar) falar(texto);
  }

  function mostrarConta(trechos) {
    const total = trechos.reduce((soma, t) => soma + t.n, 0);
    const equacao = trechos.length > 1
      ? `${trechos.map(t => t.n).join(" + ")} = ${total}`
      : String(total);
    el.contaEq.textContent = equacao;
    el.conta.hidden = false;
  }

  function iniciar(chave) {
    window.cancelAnimationFrame(quadroId);
    calarVoz();
    atual = chave;

    const rota = ROTAS[chave];
    const trechos = calcularTrechos(rota.pontos);
    const textos = [...trechos.map(frase), fraseFinal(rota)];

    /* Destaque do setor e dos botões */
    el.chips.forEach(chip => chip.setAttribute("aria-pressed", String(chip.dataset.rota === chave)));
    el.setores.forEach(setor => setor.classList.toggle("is-sel", setor.dataset.setor === chave));

    /* Lista de instruções */
    el.trechos.textContent = "";
    const itens = textos.map((texto, i) => {
      const li = document.createElement("li");
      const numero = document.createElement("span");
      numero.className = "n";
      numero.setAttribute("aria-hidden", "true");
      numero.textContent = i < trechos.length ? i + 1 : "✓";
      const corpo = document.createElement("span");
      corpo.textContent = texto;
      li.append(numero, corpo);
      el.trechos.appendChild(li);
      return li;
    });
    sessao = { trechos, textos, itens, ativo: -1, rota };

    /* Traçado */
    const d = rota.pontos.map((p, i) => `${i ? "L" : "M"}${px(p[0])} ${py(p[1])}`).join(" ");
    [el.borda, el.rota, el.pontos, el.mascara].forEach(caminho => caminho.setAttribute("d", d));
    const comprimento = el.rota.getTotalLength();
    [el.borda, el.rota, el.mascara].forEach(caminho => {
      caminho.style.strokeDasharray = comprimento;
      caminho.style.strokeDashoffset = comprimento;
    });

    /* Destino */
    const destino = rota.pontos[rota.pontos.length - 1];
    el.pino.setAttribute("transform", `translate(${px(destino[0])} ${py(destino[1])})`);
    el.pinoXY.textContent = `(${destino[0]}, ${destino[1]})`;
    const naBase = destino[1] === 0; // na linha de baixo o rótulo vai ao lado, para não cobrir a prateleira
    el.pinoXY.setAttribute("x", naBase ? 32 : 0);
    el.pinoXY.setAttribute("y", naBase ? 5 : -34);
    el.pinoXY.setAttribute("text-anchor", naBase ? "start" : "middle");
    el.pino.removeAttribute("hidden");

    el.conta.hidden = true;
    el.repetir.disabled = false;
    posicionarCarro({ x: px(0), y: py(0) }, 0);

    /* Quem prefere menos movimento recebe o trajeto completo, sem animação */
    if (reduzMovimento) {
      [el.borda, el.rota, el.mascara].forEach(caminho => { caminho.style.strokeDashoffset = 0; });
      const fim = el.rota.getPointAtLength(comprimento);
      posicionarCarro(fim, angulo(trechos[trechos.length - 1]));
      sessao.ativo = textos.length - 1;
      itens.forEach(item => item.classList.add("feito"));
      el.agora.textContent = textos[textos.length - 1];
      mostrarConta(trechos);
      if (narrar) falar(textos.join(" "));
      return;
    }

    /* Marcos: distância (em pixels do desenho) em que cada trecho começa */
    const inicios = [];
    trechos.reduce((soma, t) => { inicios.push(soma); return soma + t.n * CELULA; }, 0);

    const duracao = Math.max(2400, (comprimento / 170) * 1000);
    const t0 = performance.now();

    const quadro = agora => {
      const progresso = Math.min(1, (agora - t0) / duracao);
      const distancia = comprimento * progresso;

      [el.borda, el.rota, el.mascara].forEach(caminho => {
        caminho.style.strokeDashoffset = comprimento - distancia;
      });

      let indice = 0;
      for (let i = 0; i < inicios.length; i++) if (distancia >= inicios[i]) indice = i;

      posicionarCarro(el.rota.getPointAtLength(distancia), angulo(trechos[indice]));
      if (progresso < 1 && indice !== sessao.ativo) ativarPasso(indice);

      if (progresso < 1) {
        quadroId = window.requestAnimationFrame(quadro);
      } else {
        ativarPasso(textos.length - 1);
        mostrarConta(trechos);
      }
    };
    quadroId = window.requestAnimationFrame(quadro);
  }

  el.chips.forEach(chip => chip.addEventListener("click", () => iniciar(chip.dataset.rota)));
  el.repetir.addEventListener("click", () => { if (atual) iniciar(atual); });

  el.som.addEventListener("click", () => {
    narrar = !narrar;
    el.som.setAttribute("aria-pressed", String(narrar));
    el.somEstado.textContent = narrar ? "ligada" : "desligada";
    if (!narrar) calarVoz();
    else if (!temVoz) {
      el.somEstado.textContent = "indisponível neste navegador";
      narrar = false;
      el.som.setAttribute("aria-pressed", "false");
    }
  });

  if (temVoz) window.speechSynthesis.getVoices();
})();
