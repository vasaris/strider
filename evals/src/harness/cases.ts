import type { RubricAxis } from './types.js';

/**
 * Calibration case set for the tone-judge.
 *
 * SOURCE OF TRUTH for the prose is `prompts/few-shot-drafts/scenes.v0.md` (G1-G6, B1-B7).
 * The strings here are copied from there -- keep them IN SYNC: if a scene is edited in the
 * drafts file, edit it here too. (A companion array avoids brittle markdown parsing.)
 *
 * kind: 'good' (must score high) / 'coarse' (deterministic gate catches) / 'subtle'
 * (deterministic gate is CLEAN by design -> only the LLM judge should catch it).
 * targetAxis (subtle only): the axis that must drop -- the calibration target.
 */
export interface CalibrationCase {
  readonly id: string;
  readonly prose: string;
  readonly kind: 'good' | 'coarse' | 'subtle';
  readonly targetAxis?: RubricAxis;
}

export const CALIBRATION_CASES: readonly CalibrationCase[] = [
  // --- GOOD (must aggregate >= 80) ---
  {
    id: 'G1',
    kind: 'good',
    prose:
      'Тропа отвернула от реки в ольшаник. Лёд под сапогами держался, ломался с сухим треском; тянуло дымом — кто-то жёг сырой ивняк впереди. На развилке камень обтёсан был под знак, да мох съел половину. Пальцы прошли по борозде: глубже она уходила к северу.',
  },
  {
    id: 'G2',
    kind: 'good',
    prose:
      '— До дождя бы через перевал, — он поправил лямку. — А там низом, мимо пасек, к ужину и дома затопят. За гребень не загадываю: было бы где чаю согреть да сапоги обсушить.',
  },
  {
    id: 'G3',
    kind: 'good',
    prose:
      'Орк качнулся вперёд, и древко копья прошло у самого плеча — холодом ожгло щёку. Сапог поехал на мокром камне. Герой перенёс вес, ударил в ответ — остриё ушло мимо, в глину. Пахнуло чужим: луком и старым железом.',
  },
  {
    id: 'G4',
    kind: 'good',
    prose:
      '— Кладка ровная, — гном повёл ладонью по шву. — Сухой простоит, сколько надо. А притолоку вело: камень сырым клали. Торопились.',
  },
  {
    id: 'G5',
    kind: 'good',
    prose:
      '— Эту дорогу мостили ещё при моём деде, и при его деде. — Голоса он не поднял. — Камни уходят в топь, мы кладём обратно. Покуда руки держат.',
  },
  {
    id: 'G6',
    kind: 'good',
    prose:
      '— Эту тропу торил не я, — сказал он, не сбавляя шага. — Тут стояли буки. Теперь ольха. — Он тронул молодой побег у обочины. — Выйдет доброе дерево. Не при тебе.',
  },
  // --- COARSE BAD (deterministic gate catches; must score low) ---
  {
    id: 'B1',
    kind: 'coarse',
    prose:
      'Древнее зло пробуждается на востоке, и тьма грядёт. Судьба мира висит на волоске, и лишь избранный остановит силы тьмы в этой эпической битве.',
  },
  {
    id: 'B2',
    kind: 'coarse',
    prose: 'Орк снял с героя пять хитов. Герой сделал спасбросок, провалил и потерял ещё очки жизни.',
  },
  {
    id: 'B3',
    kind: 'coarse',
    prose:
      'Время словно остановилось. Воздух наполнен напряжением, тишина давит, и по спине пробежал холодок от незримой угрозы, что витает над поляной.',
  },
  {
    id: 'B4',
    kind: 'coarse',
    prose: 'Стоит отметить, что данный путник, безусловно, храбрец. Поистине, его подвиг будет жить века и века.',
  },
  // --- SUBTLE BAD (deterministic gate CLEAN by design; only the LLM judge should catch).
  // targetAxis = the axis that must drop. ---
  {
    id: 'B5',
    kind: 'subtle',
    targetAxis: 'tone', // epic-inflation past the regex ("судьба всего Средиземья")
    prose:
      'Костёр оплывал, тянуло смолой. Герой подбросил веток; где-то ухнула сова. Но он знал: от этой ночи зависела судьба всего Средиземья.',
  },
  {
    id: 'B6',
    kind: 'subtle',
    targetAxis: 'specificity', // sec 0.9 named feeling ("охватил леденящий ужас")
    prose:
      'Дверь скрипнула. Пахнуло сыростью и мышами. Герой шагнул в темноту, и его охватил леденящий ужас. Под сапогом хрустнуло.',
  },
  {
    id: 'B7',
    kind: 'subtle',
    targetAxis: 'tone', // voice-mixing: a dwarf speaking like a hobbit
    prose:
      '— Камень добрый, — сказал гном и вздохнул. — А всё думается: что там, за холмами? Может, чудо, а может, тёплый угол да чаю горячего. Эх, кто ж его знает.',
  },
];
