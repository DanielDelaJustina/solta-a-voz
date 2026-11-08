// Celular: entra na sala, vira microfone (descobre a nota cantada aqui mesmo e manda para a TV)
// e, para quem entrou primeiro, escolhe as músicas e controla a reprodução.
(function () {
  var esc = KA.esc;
  var tela = document.getElementById('tela');
  var params = new URLSearchParams(location.search);
  var sala = (params.get('sala') || '').toUpperCase();
  var base = 'salas/' + sala;
  var publico = null;
  var ultimaMsg = 0;
  var mic = null, micLigado = false, travaTela = null;
  var amostras = [], seq = 0, rnd = Math.random().toString(36).slice(2, 6);
  var modoAtual = '';
  var busca = { termo: '', itens: null, carregando: false, escolhida: null };
  var eco = null, janela = [], humorAlvo = 0, humorPendente = -1, astroAte = 0, ruimAte = 0, silencioDesde = 0;
  var NOTAS = ['Dó', 'Dó#', 'Ré', 'Ré#', 'Mi', 'Fá', 'Fá#', 'Sol', 'Sol#', 'Lá', 'Lá#', 'Si'];

  if (!/^[A-Z0-9]{5}$/.test(sala)) {
    location.href = './';
    return;
  }
  var slot = 'key_' + sala + (params.get('j') || '');
  var key = KA.ls(slot);
  if (!key) {
    key = Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
    KA.ls(slot, key);
  }
  var tag = key.slice(-4);

  function enviar(acao) {
    acao.key = key;
    acao.t = Date.now();
    return FB.push(base + '/acoes', acao).catch(function () { erro('Sem conexão. Tente de novo.'); });
  }
  function erro(msg) {
    var el = document.getElementById('erro');
    el.textContent = msg;
    el.classList.remove('hidden');
    clearTimeout(erro.t);
    erro.t = setTimeout(function () { el.classList.add('hidden'); }, 4500);
  }
  function eu() {
    if (!publico || !publico.jogadores) return -1;
    for (var i = 0; i < publico.jogadores.length; i++) if (publico.jogadores[i].tag === tag) return i;
    return -1;
  }

  // ---------- microfone ----------
  function ligarMic() {
    var Classe = params.get('sim') ? AFINADOR.Simulado : AFINADOR.Afinador;
    mic = new Classe({ aoMedir: aoMedir });
    mic.ligar().then(function () {
      micLigado = true;
      manterTelaAcesa();
      desenhar(true);
    }).catch(function (e) {
      erro(e && e.name === 'NotAllowedError' ? 'Permita o uso do microfone para cantar.' : (e.message || 'Não consegui ligar o microfone.'));
    });
  }
  function manterTelaAcesa() {
    if (!navigator.wakeLock || travaTela) return;
    navigator.wakeLock.request('screen').then(function (t) {
      travaTela = t;
      t.addEventListener('release', function () { travaTela = null; });
    }).catch(function () {});
  }
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible' && micLigado) manterTelaAcesa();
  });

  function cantandoAgora() {
    var r = publico && publico.relogio;
    return publico && publico.fase === 'cantando' && r && !r.pausado && r.n === (publico.musica && publico.musica.n) && eu() >= 0;
  }

  function aoMedir(m) {
    if (cantandoAgora()) {
      var t = Math.round(FB.agora() - publico.relogio.inicio);
      amostras.push(t + ',' + Math.round(m.midi * 100));
    }
    // último segundo de voz, para o humor do Eco
    janela.push(m.midi);
    if (janela.length > 20) janela.shift();
    if (m.midi) silencioDesde = 0;
    else if (!silencioDesde) silencioDesde = Date.now();
    if (eco) eco.boca(m.midi ? 0.35 + 0.65 * m.nivel : 0.2);
    var nota = document.getElementById('nota');
    if (!nota) return;
    var agulha = document.getElementById('agulha');
    if (m.midi) {
      var perto = Math.round(m.midi);
      var desvio = (m.midi - perto) * 100;
      nota.textContent = NOTAS[((perto % 12) + 12) % 12];
      agulha.style.left = (50 + desvio).toFixed(1) + '%';
      agulha.className = 'agulha' + (Math.abs(desvio) < 15 ? ' certa' : '');
    } else {
      nota.textContent = '·';
      agulha.className = 'agulha apagada';
    }
  }

  // humor do Eco: o que a voz está fazendo agora + o resultado da última linha
  function humorAgora() {
    var H = ECO.HUMOR;
    if (!micLigado || !publico) return H.esperando;
    var f = publico.fase;
    if (f === 'fim') {
      var r = (publico.resultado || []).filter(function (x) { return x.tag === tag; })[0];
      return r ? ECO.humorDaNota(r.nota) : H.normal;
    }
    if (f !== 'cantando' || (publico.relogio && publico.relogio.pausado)) return H.normal;
    var agora = Date.now();
    if (astroAte > agora) return H.astro;
    var voz = 0, desvio = 0;
    janela.forEach(function (m) {
      if (!m) return;
      voz++;
      desvio += Math.abs((m - Math.round(m)) * 100);
    });
    if (voz >= 6) {
      desvio /= voz;
      if (desvio > 21 || ruimAte > agora) return H.desafinado;
      return desvio < 13 ? H.animado : H.normal;
    }
    if (ruimAte > agora) return H.desafinado;
    return silencioDesde && agora - silencioDesde > 3000 ? H.esperando : H.normal;
  }
  // só troca de cara quando o novo humor se repete (evita o Eco piscando de uma cara para outra)
  setInterval(function () {
    if (!eco) return;
    var h = humorAgora();
    if (h !== humorAlvo && h === humorPendente) {
      humorAlvo = h;
      eco.humor(h);
    }
    humorPendente = h;
  }, 250);

  setInterval(function () {
    if (!amostras.length) return;
    if (!cantandoAgora()) {
      amostras = [];
      return;
    }
    var pacote = {};
    pacote['k' + (seq++) + rnd] = publico.musica.n + '|' + amostras.join(';');
    amostras = [];
    FB.patch(base + '/voz/' + tag, pacote).catch(function () {});
  }, 250);

  // ---------- escolha de música (só quem entrou primeiro) ----------
  function recentes() {
    try { return JSON.parse(KA.ls('recentes') || '[]'); } catch (e) { return []; }
  }
  function guardarRecente(m) {
    var lista = recentes().filter(function (r) { return r.id !== m.id; });
    lista.unshift(m);
    KA.ls('recentes', JSON.stringify(lista.slice(0, 12)));
  }
  function buscar(termo) {
    busca.termo = termo;
    busca.carregando = true;
    busca.itens = null;
    desenharBusca();
    fetch('https://lrclib.net/api/search?q=' + encodeURIComponent(termo)).then(function (r) { return r.json(); }).then(function (lista) {
      var vistos = {};
      busca.itens = (lista || []).filter(function (r) {
        if (!r.syncedLyrics || r.instrumental) return false;
        var k = (r.artistName + '|' + r.trackName + '|' + Math.round(r.duration / 3)).toLowerCase();
        if (vistos[k]) return false;
        vistos[k] = true;
        return true;
      }).slice(0, 20).map(function (r) {
        return { id: r.id, titulo: r.trackName, artista: r.artistName, dur: r.duration };
      });
    }).catch(function () {
      busca.itens = [];
      erro('Não consegui buscar agora. Confira a internet.');
    }).then(function () {
      busca.carregando = false;
      desenharBusca();
    });
  }
  function itemMusica(m, i, extra) {
    return '<button class="item" data-op="escolher" data-i="' + i + '"' + (extra || '') + '><span class="t">' + esc(m.titulo) + '</span>' +
      '<span class="a">' + esc(m.artista) + ' · ' + KA.mmss(m.dur) + '</span></button>';
  }
  function desenharBusca() {
    var el = document.getElementById('busca');
    if (!el) return;
    var html = '';
    if (busca.escolhida) {
      var m = busca.escolhida;
      var q = encodeURIComponent(m.artista + ' ' + m.titulo + ' karaoke');
      html += '<div class="cartao escolhida"><div class="rotulo">Música</div><div class="t">' + esc(m.titulo) + '</div><div class="a">' + esc(m.artista) + ' · ' + KA.mmss(m.dur) + '</div></div>' +
        '<div class="passo"><b>1.</b> Ache um vídeo de karaokê (sem a voz do cantor), de preferência com <b>' + KA.mmss(m.dur) + '</b> de duração.</div>' +
        '<a class="botao sec" target="_blank" rel="noopener" href="https://www.youtube.com/results?search_query=' + q + '">Procurar no YouTube</a>' +
        '<div class="passo"><b>2.</b> No YouTube, toque em Compartilhar → Copiar link e cole aqui:</div>' +
        '<div class="linha-input"><input id="linkVideo" class="campo" placeholder="https://youtu.be/..." value="' + esc(m.video || '') + '" autocomplete="off">' +
        (navigator.clipboard && navigator.clipboard.readText ? '<button class="botao mini" data-op="colar">Colar</button>' : '') + '</div>' +
        '<button class="botao" data-op="cantar">Cantar!</button>' +
        '<button class="botao fantasma" data-op="desistir">← Escolher outra música</button>';
    } else {
      html += '<form id="formBusca" class="linha-input"><input id="termo" class="campo" placeholder="Música ou artista" value="' + esc(busca.termo) + '" autocomplete="off" enterkeyhint="search">' +
        '<button class="botao mini" type="submit">Buscar</button></form>';
      if (busca.carregando) html += '<p class="dica">Buscando…</p>';
      else if (busca.itens && !busca.itens.length) html += '<p class="dica">Nada com letra sincronizada. Tente com o nome do artista junto.</p>';
      else if (busca.itens) busca.itens.forEach(function (m, i) { html += itemMusica(m, i); });
      else {
        var rec = recentes();
        if (rec.length) {
          html += '<div class="rotulo">Cantadas aqui</div>';
          rec.forEach(function (m, i) { html += itemMusica(m, i, ' data-rec="1"'); });
        } else {
          html += '<p class="dica">Busque pelo nome da música. A letra vem do LRCLIB e o som de um vídeo do YouTube.</p>';
        }
      }
    }
    el.innerHTML = html;
    var form = document.getElementById('formBusca');
    if (form) {
      form.onsubmit = function (e) {
        e.preventDefault();
        var t = document.getElementById('termo').value.trim();
        if (t) {
          document.getElementById('termo').blur();
          buscar(t);
        }
      };
    }
  }

  // ---------- cliques ----------
  tela.addEventListener('click', function (e) {
    var b = e.target.closest ? e.target.closest('[data-op]') : null;
    if (!b) return;
    var op = b.getAttribute('data-op');
    if (op === 'entrar') {
      var n = (document.getElementById('nome').value || '').trim() || 'Cantor';
      KA.ls('nomeCantor', n);
      b.disabled = true;
      enviar({ tipo: 'entrar', nome: n });
    } else if (op === 'mic') {
      if (!micLigado) ligarMic();
    } else if (op === 'nome') {
      var idx = eu();
      var nome = prompt('Seu nome (até 14 letras):', idx < 0 ? '' : publico.jogadores[idx].nome);
      if (nome && nome.trim()) {
        KA.ls('nomeCantor', nome.trim());
        enviar({ tipo: 'renomear', nome: nome.trim() });
      }
    } else if (op === 'sair') {
      if (confirm('Sair da sala?')) enviar({ tipo: 'sair' });
    } else if (op === 'escolher') {
      var lista = b.getAttribute('data-rec') ? recentes() : busca.itens;
      busca.escolhida = lista[Number(b.getAttribute('data-i'))];
      desenharBusca();
      window.scrollTo(0, 0);
    } else if (op === 'desistir') {
      busca.escolhida = null;
      desenharBusca();
    } else if (op === 'colar') {
      navigator.clipboard.readText().then(function (t) { document.getElementById('linkVideo').value = t; }).catch(function () {});
    } else if (op === 'cantar') {
      var id = KA.idDoVideo(document.getElementById('linkVideo').value);
      if (!id) return erro('Esse link não parece ser de um vídeo do YouTube.');
      var m = busca.escolhida;
      m.video = id;
      guardarRecente(m);
      enviar({ tipo: 'musica', id: m.id, video: id, titulo: m.titulo });
      busca.escolhida = null;
      busca.itens = null;
      busca.termo = '';
    } else if (op === 'pausar' || op === 'continuar' || op === 'parar' || op === 'voltar') {
      if (op === 'parar' && !confirm('Terminar a música agora e ver o resultado?')) return;
      enviar({ tipo: op });
    } else if (op === 'ajuste') {
      enviar({ tipo: 'ajuste', delta: Number(b.getAttribute('data-d')) });
    }
  });

  // ---------- telas ----------
  function painelMic() {
    return '<button class="orbe-area" data-op="mic">' +
      '<div class="eco-cel" id="ecoCel"></div><span class="nota-chip' + (micLigado ? '' : ' ligar') + '" id="nota">' + (micLigado ? '·' : '🎤 Toque para ligar') + '</span></button>' +
      '<div class="estado-mic" id="estadoMic"></div>' +
      '<div class="afinacao' + (micLigado ? '' : ' hidden') + '"><span>♭</span><div class="regua"><div class="centro"></div><div class="agulha apagada" id="agulha"></div></div><span>♯</span></div>' +
      '<div class="placar-cel"><div><div class="rotulo">Sua nota</div><div class="pts" id="minhaNota">–</div></div><div class="elogio" id="meuElogio"></div></div>';
  }

  function desenhar(forcar) {
    if (!publico) {
      tela.innerHTML = '<p class="dica centro">Procurando a sala ' + esc(sala) + '…<br>Ela foi aberta na TV?</p>';
      modoAtual = '';
      return;
    }
    var idx = eu();
    var f = publico.fase;
    var dono = idx === 0;
    var modo = [idx < 0 ? 'fora' : 'dentro', dono, f, micLigado].join('/');
    if (modo !== modoAtual || forcar) {
      modoAtual = modo;
      var html = '';
      if (idx < 0) {
        html += '<div class="cartao"><h2>Entrar para cantar</h2><input class="campo" id="nome" maxlength="14" placeholder="Seu nome na TV" value="' + esc(KA.ls('nomeCantor') || '') + '">' +
          '<button class="botao" data-op="entrar">Entrar</button></div>';
      } else {
        var j = publico.jogadores[idx];
        document.documentElement.style.setProperty('--c', j.cor);
        html += painelMic();
        if (dono) {
          if (f === 'sala' || f === 'fim') html += '<div class="cartao"><h2>Escolha a música</h2><div id="busca"></div></div>';
          else {
            html += '<div class="cartao controles"><div class="linha-botoes">' +
              '<button class="botao sec" data-op="' + (publico.relogio && publico.relogio.pausado ? 'continuar">▶ Continuar' : 'pausar">❚❚ Pausar') + '</button>' +
              '<button class="botao sec" data-op="parar">■ Terminar</button></div>' +
              '<div class="rotulo">Letra fora do tempo?</div><div class="linha-botoes">' +
              '<button class="botao mini sec" data-op="ajuste" data-d="-250">Letra antes</button>' +
              '<span class="ajuste" id="ajuste"></span>' +
              '<button class="botao mini sec" data-op="ajuste" data-d="250">Letra depois</button></div></div>';
          }
        } else {
          html += '<p class="dica centro">' + esc(publico.jogadores[0].nome) + ' escolhe as músicas.</p>';
        }
        html += '<div class="linha-botoes rodape"><button class="botao fantasma" data-op="nome">Mudar nome</button><button class="botao fantasma" data-op="sair">Sair</button></div>';
      }
      tela.innerHTML = html;
      var lugarEco = document.getElementById('ecoCel');
      eco = lugarEco ? ECO.criar(lugarEco) : null;
      humorAlvo = 0;
      if (eco) eco.humor(humorAgora());
      desenharBusca();
    }
    atualizarDetalhes(idx);
  }

  function atualizarDetalhes(idx) {
    if (idx < 0) return;
    var f = publico.fase;
    var p = publico.placar && publico.placar[tag];
    var el = document.getElementById('minhaNota');
    if (el) {
      if (f === 'fim' && publico.resultado) {
        var r = publico.resultado.filter(function (x) { return x.tag === tag; })[0];
        el.textContent = r ? r.nota : '–';
      } else el.textContent = p && p.linhas ? Math.round(p.soma / p.linhas) : '–';
    }
    var el2 = document.getElementById('meuElogio');
    if (el2 && p && p.ultima && atualizarDetalhes.ultima !== p.ultima.i) {
      atualizarDetalhes.ultima = p.ultima.i;
      if (p.ultima.nota >= 85) astroAte = Date.now() + 2500;
      else if (p.ultima.nota < 30) ruimAte = Date.now() + 2000;
      el2.textContent = p.ultima.txt;
      el2.className = 'elogio mostra ' + (p.ultima.nota >= 65 ? 'bom' : p.ultima.nota >= 40 ? 'ok' : 'ruim');
    }
    var aj = document.getElementById('ajuste');
    if (aj) aj.textContent = (publico.ajuste > 0 ? '+' : '') + (publico.ajuste / 1000).toFixed(2).replace('.', ',') + ' s';
    var em = document.getElementById('estadoMic');
    if (em) {
      var m = publico.musica;
      em.innerHTML = !micLigado ? 'Toque no Eco para ligar o microfone'
        : f === 'cantando' ? (publico.relogio && publico.relogio.pausado ? 'Pausado' : 'Cante! <small>' + esc(m.titulo) + '</small>')
        : f === 'preparando' ? 'Prepare-se…'
        : f === 'fim' ? (function () {
          var r2 = (publico.resultado || []).filter(function (x) { return x.tag === tag; })[0];
          return r2 ? esc(KA.titulo(r2.nota)) + ' · no tempo ' + r2.pres + '% · afinação ' + r2.afin + '%' : 'Fim da música';
        })()
        : 'Microfone pronto. Cante perto do celular.';
    }
  }

  FB.medirRelogio(base + '/relogioCel/' + tag).then(function () {
    FB.listen(base + '/publico', function (d) {
      publico = d;
      document.getElementById('status').textContent = 'sala ' + sala;
      if (d && d.msg && d.msg.t > ultimaMsg) {
        if (FB.agora() - d.msg.t < 15000) erro(d.msg.txt);
        ultimaMsg = d.msg.t;
      }
      desenhar(false);
    });
  });
  desenhar(false);
})();
