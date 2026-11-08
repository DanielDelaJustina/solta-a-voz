// Eco, o mascote (assets/eco.riv, feito no Rive). Muda de humor conforme a pessoa canta.
// humor: 0 normal, 1 esperando, 2 animado, 3 desafinado (mãos nos ouvidos), 4 astro, 5 procurando
// boca: abertura da boca (0 a 1), segue o volume da voz.
(function () {
  var HUMOR = { normal: 0, esperando: 1, animado: 2, desafinado: 3, astro: 4, procurando: 5 };

  function criar(canvas, aoCarregar) {
    var api = { pronto: false, humor: function () {}, boca: function () {}, parar: function () {} };
    if (!window.rive || !canvas || /[?&]eco=0/.test(location.search)) return api;
    var vm = null, humorAtual = -1, bocaAtual = -1;
    var r;
    try {
      r = new rive.Rive({
        src: (window.ECO_BASE || '') + 'assets/eco.riv',
        canvas: canvas,
        artboard: 'Eco',
        autoplay: true,
        stateMachines: 'State Machine 1',
        autoBind: true,
        onLoad: function () {
          r.resizeDrawingSurfaceToCanvas();
          vm = r.viewModelInstance;
          api.pronto = !!vm;
          api.humor(0);
          api.boca(0.2);
          if (aoCarregar) aoCarregar(api.pronto);
        },
        onLoadError: function () { if (aoCarregar) aoCarregar(false); },
      });
    } catch (e) {
      if (aoCarregar) aoCarregar(false);
      return api;
    }
    api.humor = function (h) {
      if (typeof h === 'string') h = HUMOR[h];
      if (!vm || h === humorAtual) return;
      humorAtual = h;
      var p = vm.number('humor');
      if (p) p.value = h;
    };
    api.boca = function (v) {
      v = Math.round(Math.max(0, Math.min(1, v)) * 100) / 100;
      if (!vm || v === bocaAtual) return;
      bocaAtual = v;
      var p = vm.number('boca');
      if (p) p.value = v;
    };
    api.parar = function () { try { r.cleanup(); } catch (e) {} };
    window.addEventListener('resize', function () { try { r.resizeDrawingSurfaceToCanvas(); } catch (e) {} });
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
