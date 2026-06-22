/* ============================================================
   Veil of the Elements — Story & Dialogue data
   Faithful to the original script, with light expansion.
   Each line: { who, text, choices?:[{text, set?, then?:[lines], onPick?}] }
   ============================================================ */
(function () {
"use strict";
const VEIL = window.VEIL;

const S = VEIL.story = {};

/* ---------- Realm metadata ---------- */
S.realms = {
  hall:    { kicker: 'Act I', title: 'The Lesson', sub: 'Hall of Balance', music: 'temple' },
  descent: { kicker: 'Act II', title: 'Descent from the Hall', sub: 'The Misted Path', music: 'mountain' },
  forest:  { kicker: 'Act III', title: 'The Spirit Forest', sub: 'Where the roots remember', music: 'forest' },
  earth:   { kicker: 'Act IV', title: 'The Weight of Life', sub: 'Earth Realm', music: 'earth' },
  water:   { kicker: 'Act V', title: 'Echoes of Reflection', sub: 'Water Realm', music: 'water' },
  fire:    { kicker: 'Act VI', title: 'Trial of Control', sub: 'Fire Realm', music: 'fire' },
  air:     { kicker: 'Act VII', title: 'The Weightless Path', sub: 'Air Realm', music: 'air' },
  return:  { kicker: 'Act VIII', title: 'Return to the Hall', sub: 'The Veil thins', music: 'dark' },
};

S.fragments = {
  earth: 'Decay renews.',
  water: 'Shadow defines clarity.',
  fire:  'Containment is not destruction.',
  air:   'Freedom needs grounding.',
};

/* ---------- ACT 1: The Lesson ---------- */
S.act1Opening = (engine) => ([
  { who: 'master', text: 'Each element breathes life into this world — Earth, Water, Fire, Air…' },
  { who: 'master', text: '…and Dark. Without one, balance fades.' },
  {
    who: 'disciple', text: 'You may listen, or you may ask.', choices: [
      { text: 'Listen quietly.' },
      {
        text: 'Ask about Dark.', set: 'askedDark', then: [
          { who: 'disciple', text: 'Why is Dark always last, Master?' },
          { who: 'master', text: 'Because it waits. Shadow reveals what the light cannot.' },
        ],
      },
    ],
  },
]);
S.act1Vanish = [
  { who: 'narrator', text: 'The Dark sigil on the temple wall flickers… and is gone. The candles die. Dust falls from the ceiling.' },
  { who: 'disciple', text: 'Master — it’s gone!' },
  { who: 'master', text: 'Then balance begins to fall.' },
  { who: 'master', text: 'Take the Compass, and find what was taken.' },
];

/* ---------- ACT 2: Descent — whispers & murals ---------- */
S.whispers = [
  'The fifth was never evil…',
  'Without shadow, the world burns too bright.',
  'We sealed what we could not understand.',
  'Follow the needle. It remembers the way.',
];
S.murals = [
  'The mural shows five lights ringed about a tree — until one light is struck away, and the tree begins to wither.',
  'Here the elements war: gold against gold, with no shadow to hold the line between them.',
  'A figure kneels before an empty frame where the fifth sigil should burn.',
];
S.act2Intro = [
  { who: 'narrator', text: 'The Compass warms in your hand. Its needle pulls you down, out of the clouds.' },
];
S.act2Shrine = [
  { who: 'narrator', text: 'A shrine waits at the mountain’s foot. The Compass pulses — once, twice — and points toward the Spirit Forest.' },
];

/* ---------- ACT 3: Spirit Forest ---------- */
S.act3Spirit = [
  { who: 'forest', text: 'You seek the lost shadow? Then learn why the others turned away.' },
  { who: 'disciple', text: 'They feared it?' },
  { who: 'forest', text: 'They feared themselves.' },
  { who: 'forest', text: 'Cleanse the roots, child. The way to Earth opens only to clean hands.' },
];
S.act3Cleansed = [
  { who: 'forest', text: 'The corruption recedes. Take this — the first key fragment. Earth will test what you believe.' },
];

/* ---------- ACT 4: Earth — Tharos ---------- */
S.act4Intro = [
  { who: 'tharos', text: 'Dark rots the ground it touches. How can you defend what decays?' },
  { who: 'disciple', text: 'Decay feeds life. You’ve forgotten that.' },
  { who: 'tharos', text: 'Then carry the Heartstone to the summit — and prove that weight can be borne without breaking.' },
];
S.act4Win = [
  { who: 'tharos', text: 'The stone did not crush you. Perhaps decay does renew.' },
  { who: 'tharos', text: 'Take the Earth Gauntlets. And take this truth.' },
  { who: 'narrator', text: 'Fragment of Truth — “Decay renews.”' },
];

/* ---------- ACT 5: Water — Nerai ---------- */
S.act5Intro = [
  { who: 'nerai', text: 'Dark clouds the mirror. It hides truth.' },
  { who: 'disciple', text: 'No — Dark reveals depth.' },
  { who: 'nerai', text: 'Then face your reflection. Let us see which of you is the truer.' },
];
S.act5Win = [
  { who: 'nerai', text: 'You looked past the surface. Few do.' },
  { who: 'nerai', text: 'The Flow Staff is yours. Time itself will slow to your patience.' },
  { who: 'narrator', text: 'Fragment of Truth — “Shadow defines clarity.”' },
];

/* ---------- ACT 6: Fire — Rion ---------- */
S.act6Intro = [
  { who: 'rion', text: 'Dark devours flame. Why keep what consumes?' },
  { who: 'disciple', text: 'Dark doesn’t destroy fire — it gives it a shape.' },
  { who: 'rion', text: 'Then shape it. Light the ancient forges — but spare the ruins, or your fire becomes ruin too.' },
];
S.act6Win = [
  { who: 'rion', text: 'Contained, yet not extinguished. You understand.' },
  { who: 'rion', text: 'The Ember Blade will answer you now.' },
  { who: 'narrator', text: 'Fragment of Truth — “Containment is not destruction.”' },
];

/* ---------- ACT 7: Air — Aelra ---------- */
S.act7Intro = [
  { who: 'aelra', text: 'Darkness anchors what should soar.' },
  { who: 'disciple', text: 'An anchor keeps freedom from drifting into nothing.' },
  { who: 'aelra', text: 'Cross the weightless path, then. Let the wind decide if you are right.' },
];
S.act7Win = [
  { who: 'aelra', text: 'You did not fight the wind. You listened to it.' },
  { who: 'aelra', text: 'The Sky Bow is yours. Glide where others fall.' },
  { who: 'narrator', text: 'Fragment of Truth — “Freedom needs grounding.”' },
];

/* ---------- ACT 8: Return & Revelation ---------- */
S.act8 = [
  { who: 'narrator', text: 'Four lights burn upon the Compass. The fifth remains dim. The Hall is half-swallowed by corruption.' },
  { who: 'disciple', text: 'I’ve seen it all. They never hated Dark — they feared it.' },
  { who: 'master', text: 'Fear kept us safe.' },
  { who: 'disciple', text: 'Fear also blinded you.' },
  { who: 'master', text: '…You have grown beyond my lessons.' },
  { who: 'master', text: 'Yes. I sealed the Dark Element, long ago. I thought a world of only light would be a world of only good.' },
  { who: 'dark', text: 'Light without shadow is a lamp with nothing to reveal.' },
];
S.act8Choice = [
  {
    who: 'narrator', text: 'The sealed sigil waits before you. The choice is yours alone.', choices: [
      { text: 'Restore the Dark. (Path of Balance)', set: 'chooseBalance' },
      { text: 'Keep it Sealed. (Path of Light)', set: 'chooseLight' },
    ],
  },
];

/* ---------- ACT 9: Endings ---------- */
S.endingBalance = [
  { who: 'narrator', text: 'You press your palm to the sigil. Light and shadow rush together, interwoven, and the temple blazes with both at once.' },
  { who: 'narrator', text: 'Across the realms, the corruption unknits. The world begins to heal.' },
  { who: 'master', text: 'I was wrong to fear you. To fear it.' },
  { who: 'narrator', text: 'The disciple becomes the new Keeper of Balance.' },
  { who: 'narrator', text: '“In darkness, light found its shape.”' },
];
S.endingLight = [
  { who: 'narrator', text: 'You turn from the sigil. The seal holds. The corruption stills — and the world settles into a flawless, even calm.' },
  { who: 'narrator', text: 'But the colors fade, one by one, until all is a gentle grey.' },
  { who: 'narrator', text: 'The disciple looks down at the Compass. Its needle no longer moves. It is lifeless.' },
  { who: 'narrator', text: '“Peace without truth is silence.”' },
];

/* ---------- Tutorials / hints ---------- */
S.hints = {
  move: 'Move with A / D · Jump with Space',
  jump: 'Hold Space to jump higher · double-back if you fall',
  attack: 'Attack: J (combo) · Heavy: K',
  dash: 'Dash with Shift — you are untouchable mid-dash',
  block: 'Hold F to Block · release at the right moment to Parry',
  slam: 'In the air, press ↓ (S) to Ground Slam',
  ember: 'Press L to loose an Ember',
  flow: 'Press R to slow the flow of time',
  glide: 'Hold Space while falling to Glide',
};

})();
