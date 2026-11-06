import { TACO_DATA } from './taco-data.js';

export const TACO_SOURCE = {
  title: 'Tabela Brasileira de Composição de Alimentos — TACO, 4ª edição revisada e ampliada (2011)',
  url: 'https://nepa.unicamp.br/wp-content/uploads/sites/27/2023/10/taco_4_edicao_ampliada_e_revisada.pdf'
};
const NUTRIENTS = [['k','energy_kcal'],['p','protein_g'],['c','carbohydrate_g'],['f','lipids_g'],['fi','dietary_fiber_g']];
const norm = s => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const STOP_WORDS = new Set(['de','da','do','e','a','o','uma','um','porcao','registre','registrar','adicionar','adicione','anotar','anote','consumi','comi','comemos','ingeri','quero','quanto','quantos','quantas','tem','em','caloria','calorias','proteina','proteinas','carboidrato','pesquisar','pesquisa','qual','quais','alimentacao','refeicao','refeicoes']);
// Closed, reversible spelling aliases only. Never infer a variety or preparation.
const WORD_ALIASES = new Map(Object.entries({bananas:'banana',pratas:'prata',peras:'pera',ovos:'ovo',macas:'maca',laranjas:'laranja',batatas:'batata',cenouras:'cenoura',tomates:'tomate',abobrinhas:'abobrinha',mandiocas:'mandioca',morangos:'morango',uvas:'uva',mangas:'manga',abacates:'abacate',abacaxis:'abacaxi',peitos:'peito',coxas:'coxa',sobrecoxas:'sobrecoxa',bifes:'bife',filetes:'filete',cruas:'crua',crus:'cru',cozidas:'cozida',cozidos:'cozido',assadas:'assada',assados:'assado',fritas:'frita',fritos:'frito'}));
const cleanWords = s => norm(s).split(' ').filter(x => x && !STOP_WORDS.has(x)).map(x=>WORD_ALIASES.get(x)||x);
const INDEX = TACO_DATA.foods.map(row=>({row,words:cleanWords(row.description),head:norm(row.description).split(' ')[0]}));
const round = n => Math.round((n + Number.EPSILON * Math.max(1, Math.abs(n))) * 100) / 100;
const sourceNote = 'Fonte: NEPA/UNICAMP, TACO — 4ª edição revisada e ampliada (2011), por 100 g de parte comestível. Estimativa calculada localmente; nada foi salvo ainda.';

function candidates(label) {
  const words = cleanWords(label);
  if (!words.length) return [];
  // An exact catalog name wins over compound foods containing the same words.
  const exact = INDEX.filter(x=>x.words.join(' ')===words.join(' '));
  if (exact.length) return exact.map(x=>x.row);
  const q=words.join(' ');
  if (/^arroz(?: branco)?(?: cozido| cru)?$/.test(q)) {
    return TACO_DATA.foods.filter(x=>/^Arroz, tipo [12], (cozido|cru)$/.test(x.description) && (!words.includes('cozido')||x.description.endsWith('cozido')) && (!words.includes('cru')||x.description.endsWith('cru')));
  }
  let rows=INDEX.filter(x=>words.every(w=>x.words.includes(w)));
  // A pear is not an orange named 'pêra'; oil is not popcorn cooked in oil.
  const primary=rows.filter(x=>x.head===words[0]);
  if (primary.length) rows=primary;
  return rows.map(x=>x.row);
}
function suggestions(rows) { return rows.slice(0,4).map(x => x.description).join(' | '); }
function ambiguous(label, rows) {
  if (rows.length !== 1) return rows;
  // TACO preparations must never be guessed when user did not name one.
  const q=norm(label), d=norm(rows[0].description);
  if ((d.includes(' cozido') || d.includes(' cru')) && !(/\bcozid[oa]|\bcru[oa]?\b/.test(q))) {
    const stem=d.replace(/ (cozido|cru)$/,''); const variants=TACO_DATA.foods.filter(x=>norm(x.description).startsWith(stem+' '));
    if (variants.length>1) return variants;
  }
  return [];
}
function canonicalMass(text) {
  return text.replace(/(\d+(?:[,.]\d+)?)\s*(quilogramas?|kg|gramas?|grs?|g)\b/gi,(_,n,u)=>`${n} ${/^(kg|quilograma)/i.test(u)?'kg':'g'}`);
}
function massOnly(text) { return /^\d+(?:[,.]\d+)?\s*(kg|g)(?:\s+sem\s+casca)?[.!]?$/i.test(canonicalMass(text).trim()); }
function continueFood(input) {
  if (!massOnly(input.query)) return null;
  const history=[...(input.context.history||input.context.messages||[])];
  // Native chat may already include the current message. Never count it as prior context.
  if (history.at(-1)?.role==='user' && canonicalMass(history.at(-1).text).trim()===input.query) history.pop();
  let askedWeight=false;
  for (let i=history.length-1;i>=0;i--) {
    const m=history[i];
    if (m.role==='assistant') {
      const t=norm(m.text);
      if (/informe (o peso total|a quantidade).*gramas/.test(t)) {askedWeight=true;continue;}
      // Recover only a failed nutrient request, not a completed proposal or topic change.
      if (/base de dados nutricional/.test(t) && /calorias|nutrientes|valores/.test(t)) continue;
      return null;
    }
    if (m.role!=='user') return null;
    const q=canonicalMass(m.text);
    if (massOnly(q)) continue;
    if (!askedWeight || parseAmount(q) || isBlocked(q)) return null;
    const parts=portions(q).filter(p=>!/^(registre|registrar|adicionar|adicione) (alimentacao|refeicao|refeicoes)$/.test(norm(p)));
    if (parts.length!==1) return null;
    const rows=recognizedFoods(parts[0]);
    if (rows.length!==1 || ambiguous(foodLabel(parts[0]),rows).length) return null;
    if (!isInfo(q) && !isAdd(q) && !/^\d/.test(norm(q))) return null;
    return `${isInfo(q)?'calorias em':'Registrar'} ${input.query.replace(/\s+sem\s+casca[.!]?$/i,'')} de ${rows[0].description}`;
  }
  return null;
}
function parseAmount(text) {
  const normalized=text.replace(/(\d),(\d)/g,'$1.$2');
  const matches=[...normalized.matchAll(/(?:^|\s)(\d+(?:\.\d+)?)\s*(kg|g)\b/gi)];
  if (!matches.length) return null;
  const m=matches[0], n=Number(m[1]); if (!Number.isFinite(n)||n<=0||n>100000) return {error:true};
  return { grams: m[2].toLowerCase()==='kg' ? n*1000 : n, shown:n, unit:m[2].toLowerCase() };
}
function isInfo(text) { return /\b(quanto|quantos|quantas|caloria|calorias|proteina|proteinas|carboidrato|pesquisar|pesquisa|qual|quais|tem)\b/.test(norm(text)) || /^(fibra|fibras|gordura|gorduras|lipideos)\b/.test(norm(text)) || /\?\s*$/.test(text); }
function isBlocked(text) { return /\b(nao|não|nunca|sem registrar|nao registre|não registre|apagar|excluir|delete|remover|atualizar|editar|corrigir|ontem|anteontem|semana passada|dia \d{1,2}|\d{4}-\d{2}-\d{2})\b/.test(norm(text)); }
function isAdd(text) { return /\b(registre|registrar|adicionar|adicione|anotar|anote|comi|consumi|comemos|ingeri)\b/.test(norm(text)); }
function portions(query) { return query.split(/(?:\n|;|\s+e\s+(?=\d+(?:[,.]\d+)?\s*(?:g|kg)\b))/i).map(x=>x.trim()).filter(Boolean); }
// Only normalize known plural/size words; never choose a preparation or invent a unit weight.
function foodLabel(part) {
  const label=canonicalMass(part).replace(/\d+(?:[,.]\d+)?\s*(?:kg|g)\b/gi,' ').replace(/\d+(?:[,.]\d+)?\s*(?:unidades?|un)\b/gi,' ').replace(/\bm[eé]dias?\b/gi,' ');
  const words=cleanWords(label);
  // Remove only a leading count, preserving tipo 1/2, percentages and times.
  if (/^\d+$/.test(words[0]||'')) words.shift();
  return words.join(' ');
}
function recognizedFoods(part) { return candidates(foodLabel(part).replace(/\b(não|nao|ontem|anteontem)\b/gi,' ')); }
function appFoodIntent(input) {
  const q=norm(input.query);
  if (/\bagua\b/.test(q) && !/\bcoco\b/.test(q) && !/\bagua (doce|tonica)\b/.test(q)) return false;
  // Do not divert navigation, finance, water, modifications or general conversation.
  if (/\b(apagar|apague|excluir|delete|remover|atualizar|editar|corrigir|abrir|ir para|navegar)\b/.test(q)) return false;
  const explicitFoodEntry=isAdd(input.query) && /\b(alimentacao|refeicao|refeicoes)\b/.test(q);
  return explicitFoodEntry || ((isAdd(input.query)||isInfo(input.query)||!!parseAmount(input.query)||/^\d+(?:[,.]\d+)?\s/.test(q)) && recognizedFoods(input.query).length>0);
}
function foodFor(part) {
  const amount=parseAmount(part);
  if (!amount) {
    const rows=recognizedFoods(part);
    if(rows.length===1) return {message:`Encontrei na TACO: ${rows[0].description}. Informe o peso total em gramas da parte comestível (sem casca, quando houver). A TACO fornece os nutrientes por 100 g; não preciso que você informe calorias ou macros. Não converto unidades ou tamanho “médio” em peso sem uma referência. Nada foi salvo ainda.`};
    return {message:'Informe a quantidade em gramas de parte comestível (ex.: “128 g de arroz, tipo 1, cozido”). Não converto unidades, ml ou ovos sem o peso em gramas.'};
  }
  if (amount.error) return {message:'Informe uma quantidade positiva e segura em g ou kg.'};
  const label=foodLabel(part);
  const rows=candidates(label);
  if (!rows.length) return {message:`Não encontrei “${label}” na TACO. Para marca, receita ou alimento misto, envie o rótulo ou descreva os ingredientes e o peso em gramas.`};
  const unclear=ambiguous(label,rows);
  if (unclear.length || rows.length !== 1) return {message:`Qual opção exata? ${suggestions(unclear.length ? unclear : rows)}. Responda com o rótulo completo e ${amount.grams} g.`};
  const row=rows[0], factor=amount.grams/100, data={n:row.description,amount:round(amount.grams),unit:'g'};
  for (const [out,key] of NUTRIENTS) { const value=row.per_100g_edible_portion[key]; data[out]=value === null ? null : round(value*factor); }
  return {food:data};
}
function localFood(query, allowAdd) {
  if (isBlocked(query)) return {message:'Não vou criar registro para negação, alteração, exclusão ou data histórica. Envie um novo alimento com gramas quando quiser registrar.',foods:[]};
  const parts=portions(query).filter(part=>!/^(registre|registrar|adicionar|adicione) (alimentacao|refeicao|refeicoes)$/.test(norm(part)));
  if (!parts.length) return {message:'Informe o alimento e o peso em gramas da parte comestível. Os nutrientes são consultados na TACO, sem precisar informar calorias ou macros.',foods:[]};
  if(parts.length>30) return {message:'Envie no máximo 30 alimentos por vez.',foods:[]};
  const parsed=parts.map(foodFor); const problem=parsed.find(x=>x.message);
  if (problem) return {message:problem.message,foods:[]};
  const foods=parsed.map(x=>x.food);
  if (!allowAdd || isInfo(query)) return {message:`${foods.map(x=>`${x.n}: ${x.k ?? '—'} kcal; proteínas ${x.p ?? 'não disponível'} g; carboidratos ${x.c ?? 'não disponível'} g; gorduras ${x.f ?? 'não disponível'} g; fibras ${x.fi ?? 'não disponível'} g`).join('; ')}. ${sourceNote}`,foods:[]};
  return {message:`Estimativa nutricional calculada. ${sourceNote}`,foods};
}
function lookupFollowup(input) {
  const q=norm(input.query);
  // A lookup is read-only, even when an earlier turn requested an addition.
  if (!/^(?:(?:voce )?(?:consegue|pode) )?(?:buscar|busque|pesquisar|pesquise|consultar|consulte|procurar|procure)(?: (?:no sistema|na base|na base de dados|na taco|na tabela|isso))?$/.test(q)) return null;
  const history=[...(input.context.history||input.context.messages||[])];
  if (history.at(-1)?.role==='user' && norm(history.at(-1).text)===q) history.pop();
  const answer=history.pop(), prior=history.pop();
  if (answer?.role!=='assistant' || prior?.role!=='user') return null;
  const a=norm(answer.text);
  // Do not reuse a completed proposal, a saved record, or an unrelated topic.
  if (!/base de dados nutricional|informe .*gramas|nao encontrei|qual opcao|resposta de ia invalida/.test(a) || /estimativa nutricional calculada|foi salvo|registrado/.test(a)) return null;
  const query=canonicalMass(prior.text);
  const parts=portions(query).filter(p=>!/^(registre|registrar|adicionar|adicione) (alimentacao|refeicao|refeicoes)$/.test(norm(p)));
  if (isBlocked(query) || parts.length!==1 || !recognizedFoods(parts[0]).length) return null;
  return localFood(query,false);
}
export function localNutrition(input) {
  input={...input,query:canonicalMass(input.query)};
  if (['app','food'].includes(input.domain)) {
    const lookup=lookupFollowup(input);
    if (lookup) return input.domain==='app'?{message:lookup.message,actions:[]} : lookup;
  }
  if (['app','food'].includes(input.domain) && massOnly(input.query)) {
    const query=continueFood(input);
    if (!query) {
      const message='A qual alimento esse peso se refere? Envie o alimento junto do peso em gramas. Os nutrientes serão consultados na TACO; não precisa informar calorias ou macros.';
      return input.domain==='app'?{message,actions:[]}:{message,foods:[]};
    }
    input={...input,query};
  }
  if (input.domain === 'food') return localFood(input.query, true);
  if (input.domain === 'food_research') {
    const response=localFood(input.query, false);
    return {text:response.message,sources:[TACO_SOURCE],searched:false,hasSuggestions:/Qual opção|Informe|Não encontrei/.test(response.message)};
  }
  if (input.domain === 'app' && (input.context.module === 'nutrition' || appFoodIntent(input))) {
    if (/\b(apagar|excluir|delete|remover|atualizar|editar|corrigir|abrir|ir para|navegar)\b/.test(norm(input.query))) return null;
    const response=localFood(input.query, true);
    if (!response.foods.length) return {message:response.message,actions:[]};
    if (response.foods.length !== 1) return {message:'Registre um alimento por vez neste formulário. '+sourceNote,actions:[]};
    if (!input.context.permissions.includes('write:nutrition')) return {message:'Você não tem permissão para registrar alimentação.',actions:[]};
    return {message:response.message,actions:[{op:'add',module:'nutrition',date:input.context.date || undefined,data:response.foods[0]}]};
  }
  return null;
}
