// Eco, o mascote, desenhado em SVG (o mesmo desenho do arquivo do Rive em assets/eco.riv).
// As expressões são classes CSS (css/estilo.css, seção "Eco"), então rodam leves até na TV de 2019.
// humor: 0 normal, 1 esperando, 2 animado, 3 desafinado (mãos nos ouvidos), 4 astro, 5 procurando
// boca: abertura da boca (0 a 1), segue o volume da voz.
(function () {
  var HUMOR = { normal: 0, esperando: 1, animado: 2, desafinado: 3, astro: 4, procurando: 5 };
  var contador = 0;

  function estrela(cx, cy, pontas, raio, interno) {
    var p = [];
    for (var i = 0; i < pontas * 2; i++) {
      var r = i % 2 ? raio * interno : raio;
      var a = (Math.PI * i) / pontas - Math.PI / 2;
      p.push((cx + r * Math.cos(a)).toFixed(1) + ',' + (cy + r * Math.sin(a)).toFixed(1));
    }
    return p.join(' ');
  }

  function desenho(u) {
    var g = function (id) { return 'url(#' + u + id + ')'; };
    var mao = function (lado) {
      var s = lado === 'e' ? 1 : -1;
      return '<g class="eco-mao eco-mao-' + lado + '"><g transform="translate(' + (-s * 165) + ' 70)">' +
        '<ellipse cx="' + (s * 24) + '" cy="-14" rx="11" ry="17" fill="#eef0fa" stroke="#8a90b0" stroke-width="3"/>' +
        '<ellipse rx="29" ry="35" fill="' + g('palma') + '" stroke="#8a90b0" stroke-width="3"/></g></g>';
    };
    var olho = function (x) {
      return '<ellipse cx="' + x + '" cy="-34" rx="27" ry="32" fill="#fff" stroke="#1b1f3b" stroke-width="3"/>' +
        '<g class="eco-pupila"><ellipse cx="' + x + '" cy="-30" rx="16" ry="19" fill="' + g('iris') + '"/>' +
        '<circle cx="' + (x - 7) + '" cy="-38" r="5.5" fill="#fff"/><circle cx="' + (x + 7) + '" cy="-22" r="2.5" fill="#fff"/></g>';
    };
    var nota = function (x, y, cor) {
      return '<g transform="translate(' + x + ' ' + y + ')" fill="' + cor + '">' +
        '<rect x="7.5" y="-48" width="5" height="48"/><ellipse rx="13" ry="10" transform="rotate(-20)"/>' +
        '<path d="M10,-48 C22,-44 30,-36 26,-24 C22,-32 16,-34 12,-34 Z"/></g>';
    };
    var lente = function (x) {
      return '<polygon points="' + estrela(x, -34, 5, 48, 0.52) + '" fill="' + g('lente') + '" stroke="#e879f9" stroke-width="4" stroke-linejoin="round"/>';
    };
    return '<svg class="eco h0" viewBox="0 0 500 500" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><defs>' +
      '<radialGradient class="eco-aura" id="' + u + 'aura"><stop class="eco-a1" offset="0" stop-color="#22d3ee" stop-opacity=".6"/><stop class="eco-a2" offset=".45" stop-color="#22d3ee" stop-opacity=".25"/><stop class="eco-a3" offset="1" stop-color="#22d3ee" stop-opacity="0"/></radialGradient>' +
      '<linearGradient id="' + u + 'cabo"><stop offset="0" stop-color="#262a4a"/><stop offset=".45" stop-color="#4a5080"/><stop offset="1" stop-color="#1a1d36"/></linearGradient>' +
      '<linearGradient id="' + u + 'botao" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#67e8f9"/><stop offset="1" stop-color="#0891b2"/></linearGradient>' +
      '<linearGradient id="' + u + 'anel"><stop offset="0" stop-color="#6b7090"/><stop offset=".4" stop-color="#e3e6f3"/><stop offset="1" stop-color="#8a8fae"/></linearGradient>' +
      '<radialGradient id="' + u + 'cabeca" gradientUnits="userSpaceOnUse" cx="-40" cy="-100" r="212"><stop offset="0" stop-color="#f3f5fc"/><stop offset=".6" stop-color="#c3c8de"/><stop offset="1" stop-color="#868ca9"/></radialGradient>' +
      '<linearGradient id="' + u + 'concha"><stop offset="0" stop-color="#4a5296"/><stop offset="1" stop-color="#1e2350"/></linearGradient>' +
      '<radialGradient id="' + u + 'iris"><stop offset="0" stop-color="#3b82f6"/><stop offset=".7" stop-color="#1b1f3b"/></radialGradient>' +
      '<linearGradient id="' + u + 'lente" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#312e81"/><stop offset="1" stop-color="#0b0820"/></linearGradient>' +
      '<linearGradient id="' + u + 'palma" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#c9cde2"/></linearGradient>' +
      '</defs><g transform="translate(250 262)">' +
      '<ellipse cx="0" cy="-10" rx="220" ry="235" fill="' + g('aura') + '"/>' +
      '<g class="eco-corpo">' +
        '<rect x="-48" y="65" width="96" height="170" rx="40" fill="' + g('cabo') + '"/>' +
        '<rect x="-9" y="128" width="18" height="44" rx="9" fill="' + g('botao') + '"/>' +
        '<rect x="-88" y="50" width="176" height="44" rx="20" fill="' + g('anel') + '"/>' +
        '<ellipse cx="0" cy="-40" rx="120" ry="114" fill="' + g('cabeca') + '"/>' +
        '<path d="M-130,-46 C-130,-222 130,-222 130,-46" fill="none" stroke="#2b3160" stroke-width="22" stroke-linecap="round"/>' +
        '<path d="M-118,-70 C-112,-196 112,-196 118,-70" fill="none" stroke="#5b66b0" stroke-width="6" stroke-linecap="round"/>' +
        '<rect x="-157" y="-88" width="54" height="104" rx="26" fill="' + g('concha') + '"/><rect x="-161" y="-92" width="62" height="112" rx="30" fill="none" stroke="#22d3ee" stroke-width="4"/>' +
        '<rect x="103" y="-88" width="54" height="104" rx="26" fill="' + g('concha') + '"/><rect x="99" y="-92" width="62" height="112" rx="30" fill="none" stroke="#a855f7" stroke-width="4"/>' +
        '<ellipse cx="-82" cy="2" rx="15" ry="8" fill="#f472b6" opacity=".5"/><ellipse cx="82" cy="2" rx="15" ry="8" fill="#f472b6" opacity=".5"/>' +
        '<g class="eco-olhos">' + olho(-46) + olho(46) + '</g>' +
        '<g class="eco-fechados" fill="none" stroke="#1b1f3b" stroke-width="5" stroke-linecap="round"><path d="M-66,-32 C-56,-20 -36,-20 -26,-32"/><path d="M26,-32 C36,-20 56,-20 66,-32"/></g>' +
        '<g class="eco-sobrancelhas" stroke="#1b1f3b" stroke-width="6" stroke-linecap="round"><path d="M-66,-76 L-28,-88"/><path d="M66,-76 L28,-88"/></g>' +
        '<g class="eco-boca"><path d="M-34,14 C-34,60 34,60 34,14 Z" fill="#3b0b2e" stroke="#1b1f3b" stroke-width="3"/><ellipse cx="0" cy="40" rx="15" ry="6" fill="#f472b6"/></g>' +
        '<path class="eco-careta" d="M-30,26 C-20,14 -10,36 0,25 C10,14 20,36 30,26" fill="none" stroke="#1b1f3b" stroke-width="6" stroke-linecap="round"/>' +
        '<g class="eco-oculos"><rect x="-13" y="-42" width="26" height="8" rx="4" fill="#e879f9"/>' + lente(-48) + lente(48) + '</g>' +
        mao('e') + mao('d') +
        '<path class="eco-gota" d="M118,-148 C128,-134 133,-125 133,-118 C133,-109 125,-103 118,-103 C111,-103 103,-109 103,-118 C103,-125 108,-134 118,-148 Z" fill="#7dd3fc" stroke="#0ea5e9" stroke-width="2"/>' +
      '</g>' +
      '<g class="eco-notas">' + nota(-180, -110, '#a3e635') + nota(178, -150, '#22d3ee') + nota(-150, -200, '#e879f9') + '</g>' +
      '<g class="eco-brilhos" fill="#fbbf24">' +
        '<polygon points="' + estrela(-175, -165, 4, 22, 0.28) + '"/><polygon points="' + estrela(182, -70, 4, 17, 0.28) + '"/>' +
        '<polygon points="' + estrela(-170, 70, 4, 15, 0.28) + '"/><polygon points="' + estrela(160, -200, 4, 20, 0.28) + '"/></g>' +
      '</g></svg>';
  }

  // cria um Eco dentro de "lugar" (um elemento HTML vazio)
  function criar(lugar) {
    var api = { humor: function () {}, boca: function () {} };
    if (!lugar) return api;
    lugar.innerHTML = desenho('eco' + (contador++) + '_');
    var svg = lugar.firstChild;
    var boca = svg.querySelector('.eco-boca');
    var humorAtual = 0, bocaAtual = -1;
    api.el = svg;
    api.humor = function (h) {
      if (typeof h === 'string') h = HUMOR[h];
      if (h === humorAtual || h == null) return;
      humorAtual = h;
      svg.setAttribute('class', 'eco h' + h);
    };
    // escala vertical a partir da borda de cima da boca (y = 14)
    api.boca = function (v) {
      v = Math.max(0.12, Math.min(1, v));
      if (Math.abs(v - bocaAtual) < 0.03) return;
      bocaAtual = v;
      boca.setAttribute('transform', 'translate(0 14) scale(1 ' + v.toFixed(2) + ') translate(0 -14)');
    };
    api.boca(0.35);
    return api;
  }

  // humor do resultado de uma linha ou da música inteira
  function humorDaNota(n) {
    if (n >= 85) return HUMOR.astro;
    if (n >= 55) return HUMOR.animado;
    if (n >= 30) return HUMOR.normal;
    return HUMOR.desafinado;
  }

  window.ECO = { criar: criar, HUMOR: HUMOR, humorDaNota: humorDaNota };
})();
