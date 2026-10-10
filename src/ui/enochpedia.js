// The Zionpedia: every mechanic and upgrade, built from the live data and tuning tables so it never drifts from
// the game. Laid out as icon cards: one line to scan, click (or Enter) to open the details. A search box finds a
// card on any tab, and the map is hover-only (no legend).
import { T } from '../tuning.js';
import { keyLabel } from '../input.js';
import { TRAP_INFO, MELEE, GUNS, THROWS, COMFORTS, COMFORT_INFO, FINDS, EFFECTS, CONDITIONS, GUN_MODS, MELEE_MODS, PADDING, TRICKS, KEEPSAKES, TRIALS, WEATHER, ROLES } from '../data.js';
import { trialTarget } from '../sim/nights.js';
import { ERRANDS } from '../data/errands.js';
import { Game } from '../sim/game.js';
import { mapPOIs, paintTownMap, paintStreetNames } from './poi.js';
import { icon, hasIcon, charSprite } from '../render/sprites.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const n = (v) => Number(v).toLocaleString('en-GB');
const strip = (h) => String(h).replace(/<[^>]*>/g, ' ').replace(/&[a-z]+;/g, ' ');

// ---- building blocks ----
const _urls = new Map();
// sprite icons are OffscreenCanvases, which can't make a data URL themselves
function dataUrl(im) { const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; c.getContext('2d').drawImage(im, 0, 0); return c.toDataURL(); }
const img = (key, cls = '') => { if (!hasIcon(key)) return ''; if (!_urls.has(key)) _urls.set(key, dataUrl(icon(key))); return `<img class="pi ${cls}" src="${_urls.get(key)}" alt="">`; };
// a character sprite (the dead, survivors) as a portrait
function sprite(kind, outfit = 0) {
  const k = 'spr|' + kind + '|' + outfit;
  if (!_urls.has(k)) { try { _urls.set(k, dataUrl(charSprite(kind, outfit, 0, 0, 'walk'))); } catch { _urls.set(k, ''); } }
  return _urls.get(k) ? `<img class="pi spr" src="${_urls.get(k)}" alt="">` : '';
}
const chip = (t, cls = '') => `<span class="chip ${cls}">${t}</span>`;
const cost = (v) => chip(`${img('scrap', 'tiny')}${n(v)}`, 'cost');
const parts = (v) => chip(`${img('part', 'tiny')}${n(v)}`, 'cost');
const from = (w) => chip(`wave ${w}`, 'wave');
// one card: pic, title, chips, a one-line summary, and optional details that open on click
function card({ pic = '', title, chips = '', line = '', more = '', color = '' }) {
  const open = more ? ' data-x="1" tabindex="0"' : '';
  return `<div class="pc${more ? ' x' : ''}"${open} data-s="${esc(strip(title + ' ' + line + ' ' + more).toLowerCase())}">
    <div class="pc-h">${pic ? `<span class="pic">${pic}</span>` : ''}<div class="pc-t"><b${color ? ` style="color:${color}"` : ''}>${title}</b>${line ? `<span class="ln">${line}</span>` : ''}</div>${chips ? `<span class="chips">${chips}</span>` : ''}</div>
    ${more ? `<div class="pc-more">${more}</div>` : ''}</div>`;
}
const grid = (cards, cls = '') => `<div class="pgrid ${cls}">${cards.join('')}</div>`;
const sec = (title, lead, body) => `<section class="ps"><h3>${title}</h3>${lead ? `<p class="lead">${lead}</p>` : ''}${body}</section>`;
const tbl = (head, rows) => `<table class="pedia">${head ? `<tr>${head.map((h) => `<th>${h}</th>`).join('')}</tr>` : ''}${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</table>`;
const bar = (label, v, max, txt = v) => `<div class="sbar"><span>${label}</span><i><em style="width:${Math.max(4, Math.min(100, v / max * 100))}%"></em></i><span class="v">${txt}</span></div>`;
const steps = (list) => `<ol class="steps">${list.map((s) => `<li>${s}</li>`).join('')}</ol>`;
const go = (tab, text) => `<a class="go" data-go="${tab}">${text}</a>`;

const FIND_DESC = {
  ammo: 'Refills every gun and melee durability, refills your pocket and repairs a Padding layer.',
  adrenaline: `${T.finds.timed} s: every hit kills a normal walker outright; specials take x${T.finds.adrenalineSpecialMult}.`,
  double: `${T.finds.timed} s: double Scrap.`, dynamite: `Kills everything on the map after ${T.finds.dynamiteDelay} s (Brutes take ${n(T.finds.dynamiteBrute)}). +${T.finds.dynamiteScrap} Scrap.`,
  toolbox: `Every barricade fully boarded. +${T.finds.toolboxScrap} Scrap.`, sale: `${T.finds.timed} s: the trader's crate costs ${T.prices.crate.sale}, at every crate spot.`,
  chainsaw: `${T.finds.timed} s of chainsaw: damage scales with the wave (${T.chainsaw.hpMult}x a walker's health per second), cleaves everything, ignores armour, +15% speed.`,
  wallet: `+${T.finds.wallet} Scrap.`, guts: `${T.finds.guts} s: walkers that haven't noticed you ignore you.`,
};
// [sprite kind, name, from wave, one line, details]
const FOES = [
  ['walker', 'Walker', 1, 'Shambles at you.', 'Gets tougher every wave (150 HP at wave 1, x1.1 a wave after 9).'],
  ['crawler', 'Crawler', T.types.crawler.from, 'Low and slow; takes longer to climb in.', 'Never speeds up as the last one.'],
  ['bloater', 'Bloater', T.types.bloater.from, 'Bursts into gas when killed.', 'The Gasmask makes you immune.'],
  ['tangled', 'Tangled', T.tangled.from, 'Wrapped in barbed wire.', 'Melee costs double durability and nicks you for 5. Guns and shoves are fine.'],
  ['armoured', 'Armoured', T.types.armoured.from, 'Soaks 75% from the front.', 'Hit it from behind, with a sledge, or with explosives.'],
  ['screamer', 'Screamer', T.screamer.from, 'Its scream calls 4 more.', 'Keeps its distance and winds up a scream every 6 s. Kill it mid-scream to stop it.'],
  ['hazmat', 'Hazmat', T.hazmat.from, 'Green gas hurts you, heals the dead.', 'Fire burns the cloud away.'],
  ['runner', 'Runner', T.types.runner.from, 'Fast.', 'More of them every wave until wave 25.'],
  ['walker', 'Burning', '-', 'Set alight, it keeps coming.', 'It sets fire to you and to planks.'],
  ['dog', 'Dogs', '5-7', 'Come from the dark, no barricades.', 'From the 3rd dog wave a scarred leader makes them lunge together.'],
  ['brute', 'Brute', T.brute.first, `Riot cop with a shield, ${n(T.brute.hp)}+ HP.`, `Shove him while he winds up a charge. Pays ${T.scrap.brute} Scrap, a find and ${T.parts.brute} Parts. Your first Brute kill raises the comfort limit.`],
  ['butcher', 'The Butcher', T.butcher.from, 'Grabs you. Drops his cleaver.', 'Takes a Brute\'s slot every 6-8 waves. Shove during the wind-up to dodge; mash attack to break free.'],
  ['looter', 'Looter', T.looter.from, 'Steals from town caches.', `A yellow "!" marks him, on the map and at the screen edge. He runs between ${T.looter.caches.join('-')} caches (never the Red Lion, never you), ${T.looter.grab} s at each, then leaves. Hit him once and he drops half; kill him for the rest plus ${T.rewards.looterMult}x a walker's Scrap.`],
  ['raider:captain', 'Raiders', T.raiders.from, 'Living people with guns.', `Their bullets are slow enough to dodge and cover stops them. Kill the Captain (red laser) and the rest run. Some go to loot the Red Lion: a red card warns you, they break in through a window and take ${T.pubTheft.parts} Part (or ${T.pubTheft.scrap} Scrap) every ${T.pubTheft.every} s, up to ${T.pubTheft.cap}. Killing one gives back what it took. Worth ${T.rewards.raiderMult}x a walker.`],
];
const ERRAND_ICON = { fuel: 'jerry', fuse: 'fuse', supplyDrop: 'supplies', cellar: 'hatch', medicine: 'antibiotics', beacons: 'flare_item', sealDrain: 'bomb', trader: 'parcel', sluice: 'wheel', wire: 'cable', bounty: 'wallet', lostDog: 'biscuit' };
const ERRAND_REWARD = { fuel: 'Power stays on', fuse: 'Power back, +300', supplyDrop: '2 finds, a free crate pull, 3 Parts, padding', cellar: 'A survivor', medicine: 'Cures a sick survivor, +1 Bandages use',
  beacons: 'Herd 25% smaller, beacons stay lit', sealDrain: 'The drain never spawns again, +1,000', trader: 'Crate 25% cheaper; next pull Fine+', sluice: 'Flooded underpass slows the dead',
  wire: 'Traps worked from the Red Lion switchboard, +500', bounty: '1,500 + a keepsake', lostDog: 'Biscuit' };
const SOURCE = { radio: 'Radio', board: 'Noticeboard', world: 'Found in town', auto: 'Automatic', pub: 'The spool in the Red Lion' };
// anything not written up above still reads sensibly
function rewardText(e) {
  if (ERRAND_REWARD[e.id]) return ERRAND_REWARD[e.id];
  return (e.rewards || []).map((r) => Object.entries(r).map(([k, v]) => (k === 'scrap' ? `+${n(v)} Scrap` : k === 'parts' ? `${v} Parts` : k)).join(' ')).join(', ') || 'Its own reward';
}

export function pediaTabs(keys) {
  const K = (a) => `<kbd>${esc(keyLabel(keys[a]))}</kbd>`;
  const g = g0();
  const tabs = [];

  // ---------- Start ----------
  tabs.push({ name: 'Start', html:
    `<div class="hero"><p>You are <b>Cain</b>. For a year you and your partner lived in silence in <b>Zion</b>; the dead hunt by sound. Tonight one gunshot broke it, and every sound since brings more. <b>This is your last night in Zion.</b> Hilltop, up on the ridge with binoculars and a radio, will tell you where things are.</p></div>` +
    sec('How a run ends', 'Chase either ending, both, or neither.', grid([
      card({ pic: img('receiver'), title: 'Answer the Signal', chips: from(T.signal.from), line: 'Reach Ashworth: help is coming.',
        more: `<p>Someone is broadcasting after dark from <b>Ashworth</b>, a town with power, a doctor and room. Answer it and every comfort ripens, the comfort limit goes, and the fire engine's last stand drops to ${T.escape.lastStandSignal} s.</p>` + steps([
          `Hear the broadcast on the radio (wave ${T.signal.from}+).`, `Find the receiver: a walker in a hunting jacket carries it (by wave ${T.signal.receiverBy}).`, 'Wire it into the mains at the garage bench (generator on).',
          'Find three frequency cards: church noticeboard, school staffroom, pub dartboard.', 'Climb the church tower with the receiver.', 'Count the bells at the start of the next wave, then answer from the tower.',
          `Build a booster at the garage bench (${T.signal.boostParts} Parts, +2 if the mast needs fixing) and switch it on at the school roof.`,
          `<b>Defend the booster</b>: ${T.booster.groups.reduce((a, b) => a + b, 0)} raiders in ${T.booster.groups.length} groups (${T.booster.groups.join(', ')}), at most ${T.booster.maxAlive} at once. Each raider at the mast takes ${T.booster.dps}% a second off it; if it's wrecked, build another. The Red Lion is safe until it's over.`]) }),
      card({ pic: img('engine'), title: 'The fire engine', chips: from(T.escape.unlockRound), line: 'Fix it, hold the station, drive out. Wins the run.',
        more: `<p>Needs the generator to have run once. Fitting parts is loud and draws the dead.</p>` + steps([`${img('battery', 'tiny')} A battery from the tow truck`, `${img('tyre', 'tiny')} A tyre (carried)`, `${img('jerry', 'tiny')} Two jerry cans of diesel`, `${img('keys', 'tiny')} The keys: the Fire Chief (white helmet) has them`,
          `Call it in, then hold the fire station for <b>${T.escape.lastStand} s</b> while the whole town comes.`]) }),
      card({ pic: img('diamond'), title: 'Or just survive', chips: from(1), line: 'See how many waves you last.', more: '<p>The dead get tougher every wave. Your score counts either way.</p>' }),
    ])) +
    sec('Every run', 'The things you\'ll juggle all night.', grid([
      card({ pic: img('scrap'), title: 'Scrap', line: 'Money. Melee kills pay best.', more: tbl(['Source', 'Scrap'], [['Hit (melee or gun)', T.scrap.hit], ['Melee kill', `${T.scrap.killMelee} (${T.scrap.killMeleeLate} from wave ${T.scrap.meleeLateFrom})`], ['Critical melee kill', T.scrap.killCrit], ['Gun kill / headshot', `${T.scrap.killGun} / ${T.scrap.killHead}`], ['Trap kill', T.scrap.killTrap], ['Biscuit\'s kill', T.biscuit.scrap], ['Plank repaired', `${T.scrap.plank} (up to ${T.scrap.plankCapPerRound} a wave)`], ['Plank slammed in a walker\'s face', `+${T.barricadeSlam.scrap}`]]) + `<p>Kill streaks: every ${T.streak.stepKills} kills within ${T.streak.window} s adds +${T.streak.stepBonus * 100}% (max +${T.streak.max * 100}%). Getting hit resets it.</p>` }),
      card({ pic: img('part'), title: 'Parts', line: 'Spent at benches to craft and improve.', more: `<p>From Brutes, Looters, the last dog of a dog wave, trials, the Scavenger, a few lying around town, and <b>+${T.parts.errand} per finished errand</b>. Benches: the <b>garage</b> (weapons, builds), the <b>fire station</b> (padding), the <b>builders' yard</b> (your Trick).</p>` }),
      card({ pic: img('power'), title: 'The generator', line: 'Lights, comforts, workshop and traps need it.', more: `<p>In the fire station yard. Fuel lasts ${T.generator.fuelRounds} waves; at 2 left the <b>Fuel Run</b> starts: buy a jerry can (${T.generator.jerryCost}) at the garage and carry it back. Dropped cans explode if shot. Traps and the workshop can blow the fuse (${T.fuse.blowChance * 100}%).</p>` }),
      card({ pic: img('plank'), title: 'Waves', line: 'The dead come over the barricades; a short lull between.', more: '<p>Kill them all for a short break. Guns are loud, and noise brings more of them, faster. Waves get longer and the dead get tougher. See ' + go('The night', 'The night') + ' for special waves and weather.</p>' }),
      card({ pic: img('secondWind'), title: 'Going down', line: 'With Bandages or Second Wind you go down, not out.', more: `<p>You crawl with a pistol for ${T.downed.time} s, lose ${T.downed.scrapLoss * 100}% of your Scrap and every comfort (Bandages keeps itself if it has uses left), and your Padding is used up. Second Wind costs ${T.prices.secondWind.map(n).join(' / ')} and takes no slot.</p>` }),
      card({ pic: img('eagle'), title: 'Score', line: 'Scrap, tasks, stories, waves and survivors, times a multiplier.', more: tbl(['', 'Points'], [['Scrap earned', `${T.score.scrap} per Scrap`], ['Tasks and errands', n(T.score.task) + ' each'], ['Storylines (Signal, fire engine, Blowtorch)', n(T.score.story) + ' each'], ['Waves survived', T.score.wave + ' each'], ['Survivors alive', T.score.survivor + ' each']]) + `<p>Escape with the Signal answered x${T.score.signalEscape}, in the fire engine x${T.score.engineEscape}, death x${T.score.death}.</p>` }),
    ])) });

  // ---------- Controls ----------
  const ctl = (k, title, line, more = '') => card({ pic: `<span class="cap">${k}</span>`, title, line, more });
  tabs.push({ name: 'Controls', html:
    sec('Moving and fighting', '', grid([
      ctl(`${K('up')}${K('left')}${K('down')}${K('right')}`, 'Move', 'You face the way you move.'),
      ctl(K('attack'), 'Attack', 'Tap to swing or fire. Hold with melee to charge.', `<p>Guns bend slightly toward a raider near your aim (12°) and a zombie right on it (5°), never through cover.</p><p><b>Power attack:</b> hold with a melee weapon. You slow while it charges; at full (or when stamina runs out) Cain holds it with a flash and a ping. <b>Let go to swing.</b> It hits everything within reach + ${T.power.reachAdd} px; Brutes and the Butcher are interrupted instead.</p>` + tbl(['Charge', '20%', '50%', 'Full', 'Tap'], [['Damage and Scrap', '0.4x', '0.7x', '1.5x', '1x'], ['Knockback', '20 px', '40 px', '80 px', 'small']])),
      ctl(K('lock'), 'Lock facing', 'Hold: back off while attacking.'),
      ctl(K('shove'), 'Shove', 'Knocks walkers back and staggers them.', `<p>Staggered = critical hits. Costs ${Math.round(T.shove.stamina * 100)}% stamina (the thin bar under your weapon; green = enough to shove, gold = charging). Refills in about ${Math.round(1 / T.stamina.regen)} s.</p>`),
      ctl('<kbd>1</kbd><kbd>2</kbd><kbd>3</kbd><kbd>4</kbd>', 'Switch weapon', 'Picks a slot.'),
      ctl(K('reload'), 'Reload', 'Empty guns reload themselves.', '<p>Switching weapon cancels a reload.</p>'),
      ctl(K('throw'), 'Throw', 'Throws what\'s in your pocket.', '<p>While carrying something, drops it.</p>'),
      ctl(K('trick'), 'Trick', 'Use your Trick when charged.', '<p>Double tap: use a held keepsake.</p>'),
      ctl(K('dog'), 'Biscuit', 'Tap: send him. Hold 1 s: stay.'),
    ])) +
    sec('Everything else', '', grid([
      ctl(K('interact'), 'Use', 'Hold on anything that glows.', '<p>Face it and a prompt names it; press and hold to see the price, keep holding to do it. Quest objects come first, then pickups, then doors and ladders, then repairs. Every action needs a fresh press.</p>'),
      ctl(`${K('prev')}${K('next')}`, 'Flip options', 'At benches, boards, hatches and the workshop.', '<p>They never change your weapon.</p>'),
      ctl(K('log'), 'Journal', 'Errands, items, notes, how-tos. Pauses.'),
      ctl(K('map'), 'Town map', 'Hold. Hover anything on it.', '<p>The same map is in the ' + go('Map', 'Map') + ' tab.</p>'),
    ])) });

  // ---------- Weapons ----------
  const mel = Object.entries(MELEE), gun = Object.entries(GUNS);
  const mx = (arr, f) => Math.max(...arr.map(([, w]) => (Number.isFinite(f(w)) ? f(w) : 0)));
  const mDmg = mx(mel, (m) => m.dmg), mReach = mx(mel, (m) => m.reach), mCleave = mx(mel, (m) => m.cleave), mDur = mx(mel, (m) => m.dur);
  const gDmg = mx(gun, (w) => w.dmg * w.pellets), gMag = mx(gun, (w) => w.mag), gRange = mx(gun, (w) => w.range);
  const price = (w) => (w.cost ? cost(w.cost) : w.special ? chip('quest') : w.crateOnly ? chip('crate') : chip('starter', 'good'));
  tabs.push({ name: 'Weapons', html:
    sec('Your slots', `<b>1</b> melee &middot; <b>2</b> primary (rifles, shotguns, bows, nail gun) &middot; <b>3</b> secondary (pistols, SMGs, flare gun) &middot; <b>4</b> a spare with Pack Mule. A new gun never replaces the one you hold: extras wait in the Red Lion stash, and survivors shoot the best of them from the windows.`, '') +
    sec('Melee', 'Quiet, and the best Scrap.', grid(mel.map(([id, m]) => card({ pic: img(id), title: m.name, chips: price(m), line: `${m.feel}${m.cleave > 1 ? `, hits ${m.cleave}` : ''}${Number.isFinite(m.dur) ? '' : ', never breaks'}`,
      more: bar('Damage', m.dmg, mDmg) + bar('Reach', m.reach, mReach) + bar('Cleave', m.cleave, mCleave) + bar('Swings', Number.isFinite(m.dur) ? m.dur : mDur, mDur, Number.isFinite(m.dur) ? m.dur : '&infin;') })))) +
    sec('Guns', 'Loud: noise brings the dead.', grid(gun.map(([id, w]) => card({ pic: img(id), title: w.name, chips: price(w), line: `${w.noise === 'vloud' ? 'very loud' : w.noise}${w.pen > 50 ? ', pierces all' : w.pen > 1 ? `, pierces ${w.pen}` : ''}`,
      more: bar('Damage', w.dmg * w.pellets, gDmg, w.pellets > 1 ? `${w.dmg}x${w.pellets}` : w.dmg) + bar('Magazine', w.fire === 'flame' ? gMag : w.mag, gMag, w.fire === 'flame' ? `${T.blowtorch.fuel} s fuel` : w.mag) + bar('Range', w.range, gRange) })))) +
    sec('Throwables', `Kept in your pocket; ${K('throw')} throws.`, grid(Object.entries(THROWS).map(([id, t]) => card({ pic: img(id), title: t.name, chips: (t.cost ? cost(t.cost) : chip('free each wave', 'good')) + chip(`carry ${t.max}`),
      line: { brick: 'Knocks one down.', molotov: 'Fire on the ground.', pipe: 'Pulls the dead in, then blows.', alarm: 'Rings and draws them away.' }[id] || '',
      more: id === 'pipe' ? `<p>Beeps for ${T.pipeBomb.fuse} s, faster and faster, pulling in every zombie within about a screen and a half. Brutes ignore it; rain doesn't stop it. Anything burned or blasted counts as a fire/explosive kill.</p>` : '' })))) +
    sec('Upgrading', 'Two ways to make a weapon better.', grid([
      card({ pic: img('bench'), title: 'The workshop', chips: T.prices.workshop.map(cost).join(''), line: `At the garage, with power. Back in ${T.workshop.workTime} s.`,
        more: `<p>Hand over the weapon you hold. Take it back within ${T.workshop.waitTime} s or it's gone. <b>I</b> doubles damage and makes melee unbreakable; <b>II</b> adds an effect (pick one of two with ${K('prev')}/${K('next')}); <b>III</b> adds more damage.</p>` }),
      card({ pic: img('part'), title: 'Condition', line: 'Racks sell Worn. Improve it at any bench with Parts.',
        more: tbl(['', 'Damage', '', 'Parts'], CONDITIONS.map((c, i) => [`<b style="color:${c.color}">${c.name}</b>`, `${T.condition.damage[i] >= 0 ? '+' : ''}${Math.round(T.condition.damage[i] * 100)}%`, ['Guns jam 5%; melee wears 30% faster', 'Standard', 'Melee lasts 30% longer', '+1 mod', '+2 mods; melee never breaks'][i], i ? T.condition.partCosts[i - 1] : '-'])) +
          `<p><b>Gun mods:</b> ${Object.values(GUN_MODS).map((m) => `${m.name} (${m.desc})`).join(', ')}.</p><p><b>Melee mods:</b> ${Object.values(MELEE_MODS).map((m) => `${m.name} (${m.desc})`).join(', ')}.</p>` }),
    ])) +
    sec('Workshop effects', 'Tier II adds one of these.', grid(Object.values(EFFECTS).map((e) => card({ title: e.name, color: e.color, line: e.desc, more: `<p>${e.long}</p>` })))) });

  // ---------- Kit ----------
  tabs.push({ name: 'Kit', html:
    sec('Comforts', `Permanent upgrades bought around town (most need power). Hold ${T.comforts.cap} (${T.comforts.capRaised} after your first Brute). Each <b>ripens</b> after ${T.comforts.ripenRounds} waves.`,
      grid(Object.entries(COMFORTS).map(([k, c]) => card({ pic: img(k), title: c.name, chips: cost(c.cost), line: c.desc, more: `<p>${COMFORT_INFO[k].does}</p><p><b>Ripe:</b> ${COMFORT_INFO[k].ripe.replace('Ripened: ', '')}</p>` })))) +
    sec('Tricks', `An ability on ${K('trick')}, picked before wave 1, charged by kills. Upgrade it once at the builders' yard bench (${n(T.tricks.upgradeCost)}, needs power).`,
      grid(Object.entries(TRICKS).map(([k, t]) => card({ pic: img('t_' + k), title: t.name, chips: chip(`${T.tricks.charge[k]} kills`), line: t.desc, more: `<p><b>Upgraded:</b> ${t.up.replace('Upgraded: ', '')}</p>` })))) +
    sec('Finds', 'The dead sometimes drop one (max 4 a wave). From wave 15 some are <b style="color:#7ad04a">rotten</b>: half of those curse you instead.',
      grid(Object.entries(FINDS).map(([k, f]) => card({ pic: img(k), title: f.name.charAt(0) + f.name.slice(1).toLowerCase(), chips: f.timed ? chip(`${T.finds.timed} s`) : '', line: FIND_DESC[k] })))) +
    sec('Padding', `Armour over your health: ${T.padding.layers} layers of ${T.padding.pointsPerLayer} points, each soaking ${T.padding.absorb * 100}% of a hit. Buying a layer repairs them all; patch at the fire station bench (${n(T.padding.scrapRepair)} Scrap = ${T.padding.partRepair} points).`,
      grid(PADDING.map((p, i) => card({ pic: img('helmet'), title: p.name, chips: cost(T.padding.costs[i]), line: ['Always available', `From wave ${T.padding.unlockRound2}`, 'Once the generator has run'][i] })))) +
    sec('Keepsakes', `From the Red Lion jukebox (needs power): one a wave for ${T.keepsakes.costs.map(n).join(' / ')}. Each run's jukebox holds ${T.keepsakes.poolSize}. <b>Kept</b> ones wait for a double tap of ${K('trick')}.`,
      grid(Object.entries(KEEPSAKES).map(([k, s]) => card({ pic: img('k_' + k), title: s.name, chips: s.held ? chip('kept') : chip('instant', 'good'), line: s.desc })))) });

  // ---------- The night ----------
  tabs.push({ name: 'The night', html:
    sec('The dead', 'Click one for how to deal with it.', grid(FOES.map(([kind, name, w, line, more]) => card({ pic: sprite(kind), title: name, chips: w === '-' ? '' : from(w), line, more: `<p>${more}</p>` })))) +
    sec('Special waves', '', grid([
      card({ pic: sprite('dog'), title: 'Dog wave', chips: from('5-7'), line: 'Then every 4-6 waves.' }),
      card({ pic: sprite('raider:captain'), title: 'Raider wave', chips: from(T.raiders.from), line: 'Alternate with dog waves.' }),
      card({ pic: sprite('walker', 3), title: 'The herd', chips: chip(`every ${T.specials.herdEvery}th`), line: 'Passes through town edge to edge.', more: `<p>They only turn on you within ${T.specials.herdAggro} px or if you make noise. Kill the whole herd for +${n(T.specials.herdBonus)} Scrap, or stay out of sight. Light the Beacons makes it smaller.</p>` }),
      card({ pic: img('closed'), title: 'Town events', chips: from(6), line: 'About one wave in four.', more: '<p>A helicopter crash (loot when the fire dies), a bus through the fence (a free shortcut), car alarms, a survivor on a roof, a supply truck, a building on fire, or the quiet...</p>' }),
    ])) +
    sec('Weather', `Rolled each wave from wave ${T.weather.fromRound}.`, grid(Object.entries(WEATHER).filter(([k]) => k !== 'clear').map(([k, w]) => card({ pic: img('w_' + k), title: w.name, line: w.desc })))) });

  // ---------- Town ----------
  const traps = [...new Map(g.map.traps.map((t) => [t.kind, t])).values()];
  tabs.push({ name: 'Town', html:
    sec('Defences', '', grid([
      card({ pic: img('plank'), title: 'Barricades', line: `${T.barricade.planks} planks, ${T.barricade.tearTime} s each to tear. Repairing is free and pays.`,
        more: `<p>Hold ${K('interact')} inside to repair: <b>${T.scrap.plank} Scrap a plank</b> (up to ${T.scrap.plankCapPerRound} a wave). Nail one while a walker tears at it to slam it back (+${T.barricadeSlam.scrap}). With power, reinforce a full barricade from either side:</p>` +
          tbl(['', 'Scrap', 'Effect'], [['Steel bars', T.reinforce.bars.scrap, `${T.reinforce.bars.tear} s per plank`], ['Sheet metal', T.reinforce.sheet.scrap, `${T.reinforce.sheet.tear} s per plank; hurts them ${T.reinforce.sheet.dmg}`], ['Red Lion oak shutter', T.pubReinforce.oak.scrap, `${T.pubReinforce.oak.tear} s per plank`], ['Red Lion steel shutter', T.pubReinforce.steel.scrap, `${T.pubReinforce.steel.tear} s per plank; hurts them ${T.pubReinforce.steel.dmg}; x${T.pubSafe.tearMult} slower with the door bolted`]]) }),
      card({ pic: img('switch'), title: 'Traps', line: `Armed traps fire themselves when ${T.traps.armN}+ of the dead are in them.`,
        more: `<p>Need power. Arm one at its switch (or the Red Lion switchboard, after Wire the Town). One special is enough to set it off. You pay each time it fires. Trap kills pay ${T.scrap.killTrap} Scrap and charge your Trick at half rate.</p>` }),
      ...traps.map((t) => card({ pic: img('switch'), title: t.name, chips: cost(t.cost) + chip(`${t.active} s / ${t.cooldown} s`), line: TRAP_INFO[t.kind] })),
    ])) +
    sec('Places', 'Hover anything on the ' + go('Map', 'map') + ' to see where it is.', grid([
      card({ pic: img('pub'), title: 'The Red Lion', line: 'Your safe house once someone lives there.', more: `<p>The door starts broken: fix it to get in, then hold ${K('interact')} to bolt it. Nothing comes through a bolted door; the dead must tear a window down, three times slower. ${go('Survivors', 'Survivors')} live here.</p>` }),
      card({ pic: img('stash'), title: 'The stash', line: 'Behind the bar. Spare weapons wait here.', more: '<p>Take one and it swaps with whatever is in its slot, or store one you carry. Survivors arm themselves from it at each break.</p>' }),
      card({ pic: img('hatch'), title: 'Cellar hatches', line: 'One per zone. Fix them to travel underground.', more: `<p>Fix the Red Lion's door, then its cellar hatch, then the ones in town. Hold ${K('interact')} at a fixed hatch to drop in; ${K('prev')}/${K('next')} pick where to come up. They won't work with the dead close by.</p>` }),
      card({ pic: img('case'), title: 'The trader', chips: cost(T.prices.crate.base), line: 'Her crate gives a random weapon.', more: `<p>While it spins, each item shows its worth in Scrap. Gold means a jackpot: +${T.prices.crate.step} a pull, up to ${n(T.prices.crate.max)}. Sometimes it's CLOSED and she moves on (refunded). Below ${T.loan.threshold} Scrap she'll lend you ${n(T.loan.amount)}, repaid as ${n(T.loan.repay)}.</p>` }),
      card({ pic: img('key'), title: 'Town safe', line: `Post office. Earns ${T.bank.interest * 100}% a wave.`, more: `<p>Deposit ${n(T.bank.unit)} at a time; ${T.bank.fee * 100}% fee to withdraw.</p>` }),
      card({ pic: img('ammo'), title: 'Ammo crate', line: '+50% reserves, once a wave.' }),
      card({ pic: img('board'), title: 'Noticeboard', line: 'In the square: errands, trials, bounties.', more: `<p>See ${go('Jobs', 'Jobs')}.</p>` }),
      card({ pic: img('bench'), title: 'Benches', line: 'Spend Parts. Garage, fire station, builders\' yard.' }),
    ])) });

  tabs.push({ name: 'Map', html: mapHtml() });

  // ---------- Jobs ----------
  tabs.push({ name: 'Jobs', html:
    sec('Errands', `Short jobs across town while the wave goes on; follow the <b style="color:#6cbf4a">green arrow</b>. One at a time (plus the Fuel Run and Blown Fuse). Time limits are <b>in waves</b>; the tracker says "Fails end of wave N". Abandon from the journal (${K('log')}).`,
      grid(ERRANDS.map((e) => card({ pic: img(ERRAND_ICON[e.id] || 'board'), title: e.name, chips: (e.offer.minRound ? from(e.offer.minRound) : '') + (e.timeRounds ? chip(`${e.timeRounds} waves`) : ''), line: esc(e.brief),
        more: `<p><b>Comes from:</b> ${SOURCE[e.offer.source] || 'Town'}</p>${e.steps.length ? steps(e.steps.map((s) => esc(s.text))) : ''}${e.build === 'wireSteps' ? '<p>Then wire each trap in an open zone.</p>' : ''}<p><b>Reward:</b> ${rewardText(e)}</p>` })))) +
    `<p class="lead">Radio errands start on their own and only fail if you haven't done the first step within ${T.errands.firstStepWaves} waves. <b>Carrying</b> something heavy: slower, no guns; three hits and you drop it.</p>` +
    sec('Trials', `Every ${T.trials.every} waves from wave ${T.trials.fromRound} the noticeboard posts one. Hit the target for a reward; double it for a better one.`,
      grid(Object.entries(TRIALS).map(([id, t]) => card({ pic: img('board'), title: t.name.replace('{n} ', '').replace('{w}', 'a gun').replace('{z}', 'a zone'), chips: chip(`${trialTarget(id, 10, 9 + T.trials.every)} at wave 10`) })))) +
    sec('Secrets', '', grid([card({ pic: img('tape'), title: 'Things to find', line: 'A voice after dark, tapes, a teddy bear, a locked shed.', more: '<p>There is a voice on the radio after dark. Tapes glint around town. A teddy bear by the war memorial has a name tag (Ellie\'s Bears, in the journal). There is a weed burner in a locked shed. That\'s all we\'ll say.</p>' })])) });

  // ---------- Survivors ----------
  tabs.push({ name: 'Survivors', html:
    sec('The safe house', `Rescue someone (the knocking in the pharmacy cellar) or wait for a knock at the Red Lion. Up to ${T.survivors.max} live there, each with a job.`, grid([
      card({ pic: img('pub'), title: 'How they help', line: 'They hold the pub and bolt the door behind you.', more: `<p>At each break they take the best spare weapons from the stash: guns to shoot from the windows, blades to stab through them. Three or more hold the pub on their own. Behind a bolted door they fight at double strength. Talk to them with ${K('interact')}, or hover one to see its gun.</p>` }),
      card({ pic: img('bandages'), title: 'Healing them', line: `${T.survivors.healPerRound} HP a wave on their own.`, more: tbl(null, [['A healthy Medic', `${T.heal.medicPerRound} HP a wave instead`], [`Talk + a Bandages use`, `${T.heal.bandage} HP at once`], ['Sick (from wave ' + T.survivors.sickFromRound + ')', `Only a Medicine Run cures them, within ${T.survivors.sickDeathRounds} waves`], ['Killed', 'They rise again as the dead']]) }),
    ])) +
    sec('Jobs', '', grid(Object.entries(ROLES).map(([k, r], i) => card({ pic: sprite(`survivor:${k}`, i), title: r.name, line: r.desc })))) +
    sec('Biscuit', 'A terrier with a red collar, found through the Lost Dog errand.', grid([
      card({ pic: img('biscuit'), title: 'Biscuit', chips: chip(`${T.biscuit.hp} HP`), line: 'Crowd control, not a killer.',
        more: tbl(null, [['Trip', `${Math.round(T.biscuit.tripChance * 100)}% of bites cripple a walker into a crawler`], ['Pin', `Every ${T.biscuit.pinEvery}nd bite holds one ${T.biscuit.pinTime} s; your hits on it are criticals`], ['Bark', `Knocks back anything crowding you or him (every ${T.biscuit.barkEvery} s)`], ['Hurt', `Below ${Math.round(T.biscuit.wary * 100)}% he stays behind you; below ${Math.round(T.biscuit.flee * 100)}% he runs home`], ['Down', `Hold ${K('interact')} by him for ${T.biscuit.reviveHold} s`]]) +
          `<p>+${T.biscuit.hpGrowth} HP every 5 waves; heals ${T.heal.biscuitBreak} HP/s between waves. Your bullets and swings never hurt him; explosions and fire do.</p>` }),
    ])) });
  return tabs;
}

let _g0 = null, _mapHtml = null;
export function mapHtml() { return (_mapHtml ||= mapTab()); }
function g0() { return _g0 || (_g0 = new Game({ seed: 1, attract: true, hitStop: false })); }

// the whole town as one picture, with a hover tooltip on every place of interest
function mapTab() {
  const g = g0(), k = 6, W = g.W, H = g.H;
  const cv = document.createElement('canvas'); cv.width = W * k; cv.height = H * k; const m = cv.getContext('2d'); m.imageSmoothingEnabled = false;
  paintTownMap(m, g, k, true); paintStreetNames(m, 0, 0, k, 9); // v1.4 H1
  for (const b of g.map.buildings) if (b.name) { m.font = '900 8px Nunito, sans-serif'; m.textAlign = 'center'; m.textBaseline = 'middle'; m.fillStyle = '#1d1410'; m.fillText(b.name, (b.x + b.w / 2) * k + 1, (b.y + b.h / 2) * k + 1); m.fillStyle = '#f0ead8'; m.fillText(b.name, (b.x + b.w / 2) * k, (b.y + b.h / 2) * k); }
  const pct = (v, d) => `${(v / d * 100).toFixed(2)}%`;
  let spots = '';
  for (const q of mapPOIs(g, true)) {
    const sz = q.size || 0.5;
    if (q.icon) { const im = icon(q.icon), w = im.width * sz, h = im.height * sz; m.drawImage(im, q.x / 16 * k - w / 2, q.y / 16 * k - h / 2, w, h); }
    const hw = q.icon ? 14 * sz * 100 / (W * k) : 100 * 7 / (W * k);
    spots += `<i class="spot" style="left:${pct(q.x / 16, W)};top:${pct(q.y / 16, H)};width:${hw * 1.2}%;aspect-ratio:1"><span class="tip"><b>${esc(q.title)}</b>${esc(q.body)}</span></i>`;
  }
  return `<p class="lead">Hover anything for what it is. Hold the map key in game for the same view.</p><div class="pediamap"><img src="${cv.toDataURL()}" style="width:100%;image-rendering:pixelated;display:block">${spots}</div>`;
}

// wires a rendered Zionpedia: cards open on click / Enter, links jump tabs, and the search box finds cards on any tab
export function wirePedia(root, screen, rerender, keys) {
  const body = root.querySelector('.tabbody'), tabsEl = root.querySelector('.tabs');
  if (!body || !tabsEl) return;
  const host = root.querySelector('.plaque') || root, toggle = (el) => el.classList.toggle('open');
  host.addEventListener('click', (e) => {
    const a = e.target.closest('[data-go]');
    if (a) { const names = pediaTabs(keys).map((t) => t.name); screen.tab = Math.max(0, names.indexOf(a.dataset.go)); screen.q = ''; rerender(); return; }
    const c = e.target.closest('.pc.x'); if (c) toggle(c);
  });
  host.addEventListener('keydown', (e) => { const c = e.target.closest?.('.pc.x'); if (c && (e.code === 'Enter' || e.code === 'Space')) { toggle(c); e.preventDefault(); e.stopPropagation(); } });
  const box = document.createElement('input');
  box.type = 'search'; box.className = 'psearch'; box.placeholder = 'Search  ( / )'; if (screen.qTab !== screen.tab) screen.q = ''; screen.qTab = screen.tab; box.value = screen.q || '';
  tabsEl.appendChild(box);
  const normal = body.innerHTML;
  const run = () => {
    const q = box.value.trim().toLowerCase(); screen.q = box.value;
    if (!q) { body.innerHTML = normal; return; }
    const out = [];
    for (const t of pediaTabs(keys)) {
      const tmp = document.createElement('div'); tmp.innerHTML = t.html;
      const hits = [...tmp.querySelectorAll('.pc')].filter((c) => c.dataset.s.includes(q) );
      if (hits.length) out.push(`<section class="ps"><h3>${esc(t.name)}</h3><div class="pgrid">${hits.map((c) => c.outerHTML).join('')}</div></section>`);
    }
    body.innerHTML = out.join('') || `<p class="lead">Nothing matches "${esc(box.value)}".</p>`;
    body.scrollTop = 0;
  };
  box.addEventListener('input', run);
  if (box.value) { run(); box.focus(); }
  screen.focusSearch = () => box.focus();
}
