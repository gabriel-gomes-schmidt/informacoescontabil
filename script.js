// Estado global simples
const state = {
  categoria: null, // 'interno' | 'externo'
  perfil: null,
  chartType: 'pie',
  chart: null,
  base: null // snapshot inicial para modelagem
};

// Perfis e ícones
const perfis = {
  interno: [
    { id: 'gestor', nome: 'Gestor', icon: '🧭' },
    { id: 'funcionario', nome: 'Funcionário', icon: '👩‍💼' },
    { id: 'socio', nome: 'Sócio', icon: '🤝' }
  ],
  externo: [
    { id: 'investidor', nome: 'Investidor', icon: '💹' },
    { id: 'banco', nome: 'Banco', icon: '🏦' },
    { id: 'governo', nome: 'Governo', icon: '🏛️' },
    { id: 'cliente', nome: 'Cliente', icon: '🧑‍🎓' },
    { id: 'fornecedor', nome: 'Fornecedor', icon: '🚚' },
    { id: 'sociedade', nome: 'Sociedade', icon: '🌱' }
  ]
};

// Texto breve de como cada usuário utiliza a informação contábil
const usoInfo = {
  gestor: 'Usa para planejar preços, custos e expansão de cursos.',
  funcionario: 'Acompanha estabilidade, metas e oportunidades.',
  socio: 'Avalia retorno do capital e decisões de reinvestimento.',
  investidor: 'Observa rentabilidade e riscos antes de investir.',
  banco: 'Analisa capacidade de pagamento e concessão de crédito.',
  governo: 'Calcula tributos e fiscaliza a conformidade.',
  cliente: 'Mede confiança e continuidade da oferta de cursos.',
  fornecedor: 'Avalia risco de recebimento e prazos.',
  sociedade: 'Observa impacto econômico e formação de mão de obra.'
};

// Utilidades
const fmt = (n) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const pct = (n) => `${(n*100).toFixed(0)}%`;

// Elementos
const screens = {
  home: document.getElementById('screen-home'),
  perfis: document.getElementById('screen-perfis'),
  sim: document.getElementById('screen-sim')
};

const btnInterno = document.getElementById('btn-interno');
const btnExterno = document.getElementById('btn-externo');
const backToHome = document.getElementById('back-to-home');
const backToPerfis = document.getElementById('back-to-perfis');
const perfilTitle = document.getElementById('perfil-title');
const perfilGrid = document.getElementById('perfil-grid');
const perfilLabel = document.getElementById('perfil-label');

// Inputs
const inputReceita = document.getElementById('input-receita');
const inputDespesas = document.getElementById('input-despesas');
const inputAlunos = document.getElementById('input-alunos');
const inputInvest = document.getElementById('input-invest');

// Outputs
const outLucro = document.getElementById('output-lucro');
const kpiReceita = document.getElementById('kpi-receita');
const kpiDespesas = document.getElementById('kpi-despesas');
const kpiLucro = document.getElementById('kpi-lucro');
const kpiMargem = document.getElementById('kpi-margem');
const feedbackBox = document.getElementById('feedback-box');

// Live value displays
const valReceita = document.getElementById('val-receita');
const valDespesas = document.getElementById('val-despesas');
const valAlunos = document.getElementById('val-alunos');
const valInvest = document.getElementById('val-invest');

const chartCanvas = document.getElementById('chart');

function show(screenName) {
  Object.values(screens).forEach(el => el.classList.remove('active'));
  screens[screenName].classList.add('active');
}

// Paint slider background with gradient fill according to current value
function paintRange(el) {
  if (!el || el.type !== 'range') return;
  const min = Number(el.min || 0);
  const max = Number(el.max || 100);
  const val = Number(el.value || 0);
  const pct = ((val - min) * 100) / (max - min);
  const fill = `linear-gradient(90deg, rgba(106,90,224,.9) 0% ${pct}%, rgba(17,181,229,.8) ${pct}%, rgba(255,255,255,.12) ${pct}%)`;
  el.style.background = fill;
}

function renderPerfis() {
  perfilGrid.innerHTML = '';
  const lista = perfis[state.categoria] || [];
  lista.forEach(p => {
    const card = document.createElement('div');
    card.className = 'card-perfil';
    const desc = usoInfo[p.id] || '';
    card.innerHTML = `<div class="icon">${p.icon}</div><h5>${p.nome}</h5><p class="perfil-desc">${desc}</p>`;
    card.addEventListener('click', () => {
      state.perfil = p.id;
      perfilLabel.textContent = p.nome;
      show('sim');
      updateAll();
    });
    perfilGrid.appendChild(card);
  });
}

// Chart.js setup
function ensureChart(type, receita, despesas, lucro) {
  const data = {
    labels: ['Receita', 'Despesas', 'Lucro'],
    datasets: [{
      label: 'Multi Tech',
      data: [receita, despesas, Math.max(lucro, 0)],
      backgroundColor: ['#4dd0ff', '#ff6b6b', '#12d18e'],
      borderWidth: 0,
      hoverOffset: 8
    }]
  };

  if (state.chart && state.chart.config.type === type) {
    state.chart.data = data;
    state.chart.update();
    return;
  }

  if (state.chart) {
    state.chart.destroy();
  }

  state.chart = new Chart(chartCanvas, {
    type,
    data,
    options: {
      responsive: true,
      plugins: {
        legend: { labels: { color: '#e9e9f1' } },
        tooltip: { callbacks: { label: (ctx) => `${ctx.label}: ${fmt(ctx.parsed)}` } }
      },
      scales: type === 'bar' ? {
        x: { ticks: { color: '#e9e9f1' }, grid: { color: 'rgba(255,255,255,.07)' } },
        y: { ticks: { color: '#e9e9f1' }, grid: { color: 'rgba(255,255,255,.07)' } }
      } : {}
    }
  });
}

function calc() {
  const receita = Number(inputReceita.value || 0);
  const despesas = Number(inputDespesas.value || 0);
  const alunos = Number(inputAlunos.value || 0);
  const invest = Number(inputInvest.value || 0);
  const lucro = receita - despesas; // lucro definido pelo enunciado
  const margem = receita > 0 ? lucro / receita : 0;
  return { receita, despesas, lucro, margem, alunos, invest };
}

// Modelo de efeitos: alunos e investimento impactam receita e despesas efetivas
// - Receita por aluno (RPA) = receita_base / alunos_base
// - Custo por aluno (CPA) = despesas_base / alunos_base
// - Investimento afeta: +30% vira receita potencial, +50% é custo imediato do período
function effective(m) {
  const base = state.base || { receita: m.receita, despesas: m.despesas, alunos: m.alunos, invest: m.invest };
  const alunosBase = Math.max(base.alunos || 0, 1);
  const rpa = (base.receita || 0) / alunosBase;
  const cpa = (base.despesas || 0) / alunosBase;

  const deltaAlunos = Math.max((m.alunos - (base.alunos || 0)), 0); // só somar quando aumenta
  const receitaFromAlunos = deltaAlunos * rpa;
  const despesaFromAlunos = deltaAlunos * cpa;

  const deltaInvest = Math.max(m.invest - (base.invest || 0), 0); // só considerar investimento adicional
  const receitaFromInvest = deltaInvest * 0.30; // 30% do novo investimento
  const despesaFromInvest = deltaInvest * 0.50; // 50% custo imediato

  const receitaEfetiva = Math.max(0, m.receita + receitaFromAlunos + receitaFromInvest);
  const despesasEfetivas = Math.max(0, m.despesas + despesaFromAlunos + despesaFromInvest);
  const lucroEfetivo = Math.max(0, receitaEfetiva - despesasEfetivas);
  const margemEfetiva = receitaEfetiva > 0 ? lucroEfetivo / receitaEfetiva : 0;

  return {
    receitaEfetiva,
    despesasEfetivas,
    lucroEfetivo,
    margemEfetiva,
    detalhes: { rpa, cpa, receitaFromAlunos, despesaFromAlunos, receitaFromInvest, despesaFromInvest }
  };
}

function renderKPIs(eff) {
  if (outLucro) outLucro.textContent = fmt(eff.lucroEfetivo);
  kpiReceita.textContent = fmt(eff.receitaEfetiva);
  kpiDespesas.textContent = fmt(eff.despesasEfetivas);
  kpiLucro.textContent = fmt(eff.lucroEfetivo);
  kpiMargem.textContent = pct(eff.margemEfetiva);
}

function buildFeedback({ receita, despesas, lucro, margem, alunos, invest }) {
  const posNeg = lucro >= 0 ? 'positivo' : 'negativo';
  const margemStr = pct(margem);
  const base = `Receita de ${fmt(receita)}, despesas de ${fmt(despesas)} e lucro ${posNeg} de ${fmt(lucro)} (margem ${margemStr}).`;

  const sugestaoInvest = invest > 0 ? ` Há ${fmt(invest)} planejados para novos cursos, o que pode aumentar a base de alunos e a receita futura.` : '';

  const map = {
    gestor: `Como gestor, foco em eficiência e crescimento. ${base} Com esse nível de lucro, ${margem >= 0.2 ? 'é viável expandir a oferta de cursos' : 'é prudente otimizar custos antes de expandir'}. Alunos atuais: ${alunos}.${sugestaoInvest}`,
    funcionario: `Como funcionário, estabilidade depende da saúde financeira. ${base} ${lucro >= 0 ? 'Cenário favorável' : 'Atenção: contenção de gastos pode ocorrer'}. Com mais alunos (${alunos}), há espaço para bônus e capacitações.${sugestaoInvest}`,
    socio: `Como sócio, avalio retorno e sustentabilidade. ${base} ${margem >= 0.15 ? 'Retorno alinhado ao esperado' : 'Retorno aquém; revisar preços e despesas'}. Distribuições devem considerar o investimento planejado (${fmt(invest)}).`,

    investidor: `Como investidor, observo a margem (${margemStr}) e a escalabilidade. ${base} ${margem >= 0.15 ? 'Indicador de bom retorno potencial' : 'Risco maior; é necessário plano de melhoria de margem'}.`,
    banco: `Como banco, avalio capacidade de pagamento. ${base} A geração de caixa ${lucro >= 0 ? 'suporta' : 'não suporta'} novas dívidas no momento. ${margem >= 0.2 ? 'Perfil de crédito bom' : margem >= 0.1 ? 'Perfil moderado' : 'Perfil de risco elevado'}.`,
    governo: `Como governo, resultados impactam a arrecadação. ${base} Lucros maiores elevam a base tributária; prejuízo reduz a contribuição. Investimentos em educação também geram benefícios sociais.`,
    cliente: `Como cliente, busco qualidade e confiança. ${base} ${lucro >= 0 ? 'Empresa sólida tende a manter e melhorar cursos' : 'Resultados fracos podem afetar oferta e qualidade'}. Mais alunos (${alunos}) fortalecem a comunidade de aprendizagem.`,
    fornecedor: `Como fornecedor, analiso risco de recebimento. ${base} ${lucro >= 0 ? 'Boa capacidade de cumprir prazos' : 'Risco de atrasos; negociar condições'}.`,
    sociedade: `Como sociedade, avalio impacto local. ${base} Mais alunos qualificados (${alunos}) fortalecem o mercado de trabalho de Unaí/MG e o desenvolvimento regional.`
  };

  return map[state.perfil] || 'Ajuste os valores e escolha um perfil para ver a interpretação.';
}

function updateAll() {
  const m = calc();
  const eff = effective(m);
  renderKPIs(eff);
  ensureChart(state.chartType, eff.receitaEfetiva, eff.despesasEfetivas, eff.lucroEfetivo);
  feedbackBox.textContent = buildFeedback(m);
  // Update live labels
  if (valReceita) valReceita.textContent = fmt(m.receita);
  if (valDespesas) valDespesas.textContent = fmt(m.despesas);
  if (valAlunos) valAlunos.textContent = `${m.alunos}`;
  if (valInvest) valInvest.textContent = fmt(m.invest);
  // Repaint slider tracks
  [inputReceita, inputDespesas, inputAlunos, inputInvest].forEach(paintRange);
}

function setChartToggle() {
  document.querySelectorAll('.toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.chartType = btn.dataset.chart;
      updateAll();
    });
  });
}

function initNav() {
  btnInterno.addEventListener('click', () => {
    state.categoria = 'interno';
    perfilTitle.textContent = 'Escolha um perfil interno';
    renderPerfis();
    show('perfis');
  });

  btnExterno.addEventListener('click', () => {
    state.categoria = 'externo';
    perfilTitle.textContent = 'Escolha um perfil externo';
    renderPerfis();
    show('perfis');
  });

  backToHome.addEventListener('click', () => {
    show('home');
  });

  backToPerfis.addEventListener('click', () => {
    show('perfis');
  });
}

function initInputs() {
  [inputReceita, inputDespesas, inputAlunos, inputInvest].forEach(el => {
    // paint on load
    paintRange(el);
    el.addEventListener('input', () => { paintRange(el); updateAll(); });
    el.addEventListener('change', updateAll);
  });
}

function initScenarios() {
  const btns = document.querySelectorAll('.scenario-btn');
  btns.forEach(btn => {
    btn.addEventListener('click', () => {
      const sc = btn.dataset.scenario;
      const clamp = (v, min, max) => Math.min(Math.max(v, min), max);
      switch (sc) {
        case 'alta-demanda': {
          inputAlunos.value = clamp(Math.round(Number(inputAlunos.value) * 1.2), Number(inputAlunos.min), Number(inputAlunos.max));
          break;
        }
        case 'campanha': {
          inputInvest.value = clamp(Number(inputInvest.value) + 10000, Number(inputInvest.min), Number(inputInvest.max));
          break;
        }
        case 'corte-custos': {
          inputDespesas.value = clamp(Math.round(Number(inputDespesas.value) * 0.9), Number(inputDespesas.min), Number(inputDespesas.max));
          break;
        }
        case 'curso-premium': {
          inputReceita.value = clamp(Number(inputReceita.value) + 15000, Number(inputReceita.min), Number(inputReceita.max));
          inputInvest.value = clamp(Number(inputInvest.value) + 5000, Number(inputInvest.min), Number(inputInvest.max));
          break;
        }
        case 'crise': {
          inputReceita.value = clamp(Math.round(Number(inputReceita.value) * 0.85), Number(inputReceita.min), Number(inputReceita.max));
          inputAlunos.value = clamp(Math.round(Number(inputAlunos.value) * 0.9), Number(inputAlunos.min), Number(inputAlunos.max));
          break;
        }
      }
      updateAll();
    });
  });
}

// Inicialização
window.addEventListener('DOMContentLoaded', () => {
  initNav();
  initInputs();
  initScenarios();
  setChartToggle();
  // Estado inicial
  // Snapshot da base (ponto de partida) para o modelo
  state.base = {
    receita: Number(inputReceita.value || 0),
    despesas: Number(inputDespesas.value || 0),
    alunos: Number(inputAlunos.value || 0),
    invest: Number(inputInvest.value || 0)
  };
  updateAll();
});
